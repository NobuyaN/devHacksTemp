"""Controlled fixtures only. No live search, cloud calls or real accuracy claims."""
import base64
import socket
import unittest
from types import SimpleNamespace as NS
from unittest.mock import patch, Mock
from dependencies import analyze_independence
from inspection import normalize_url, inspect_source, stable_id, fetch_html, MAX_BYTES
from main import create_app
from research import ResearchEngine


def article(url, html):
    return inspect_source(dict(id=stable_id(url), url=url, title='Controlled fixture', grounding_chunk_indices=[0]),
                          lambda _: (url, html))


def claim(text='Fixture claim', checkable=True):
    return dict(id=stable_id(text), text=text, checkable=checkable, reason='Fixture')

class DependencyTests(unittest.TestCase):
    def test_normalization(self):
        self.assertEqual(normalize_url('https://EXAMPLE.com:443/a?utm_source=test&b=2&a=1#x'),
                         normalize_url('https://example.com/a?a=1&b=2'))
        for url in ['file:///etc/passwd', 'http://example.com', 'https://user:pass@example.com', 'https://example.com:444']:
            with self.assertRaises(ValueError): normalize_url(url)

    def test_common_original_report(self):
        sources = [article(f'https://{x}.example/story', '<p>According to <a href="https://doi.org/10.1234/study">this study</a>, the recorded result is 42.</p>') for x in ('one', 'two', 'three')]
        graph = analyze_independence(sources)
        self.assertEqual(graph['documented_origin_count'], 1)
        self.assertEqual(graph['confirmed_dependent_articles'], 3)
        self.assertEqual(len(graph['evidence_origins'][0]['source_ids']), 3)
        self.assertTrue(all(e['evidence'] and e['supporting_source_url'] for e in graph['dependencies']))
        self.assertEqual(graph['confirmed_distinct_evidence_origins'], 0)

    def test_syndication(self):
        sources = [article(f'https://{x}.example/a', '<p>Originally published by <a href="https://wire.example/original">Wire News</a>.</p>') for x in ('a', 'b')]
        graph = analyze_independence(sources)
        self.assertEqual(graph['documented_origin_count'], 1)
        self.assertTrue(all(e['relationship_type'] == 'syndicated_from' for e in graph['dependencies']))

    def test_separate_original_artifacts_do_not_prove_independent_data(self):
        sources = [article(f'https://{x}.example/a', f'<p>We collected original measurements. Data from <a href="https://catalog.data.gov/dataset/{x}">our original dataset</a>.</p>') for x in ('survey-a', 'survey-b')]
        graph = analyze_independence(sources)
        self.assertEqual(graph['documented_origin_count'], 2)
        self.assertEqual(graph['confirmed_distinct_evidence_origins'], 0)
        self.assertEqual(len(graph['unresolved_relationships']), 1)

    def test_documented_distinct_original_evidence(self):
        a = article('https://research-a.example/paper', '<meta name="citation_doi" content="10.1234/first"><meta name="citation_author" content="Team A"><p>Original study methods.</p>')
        b = article('https://research-b.example/paper', '<meta name="citation_doi" content="10.5678/second"><meta name="citation_author" content="Team B"><p>We independently replicated the experiment with new participants, following <a href="https://doi.org/10.1234/first">the original study</a>.</p>')
        graph = analyze_independence([a,b])
        self.assertEqual(graph['confirmed_distinct_evidence_origins'], 2)
        self.assertEqual(graph['dependencies'][0]['relationship_type'], 'distinct_original_evidence')
        self.assertEqual(graph['unresolved_relationships'], [])

    def test_similarity_and_domains_never_prove_relationship(self):
        sources = [article(f'https://{x}.example/a', '<p>The same sentence appears in both publications.</p>') for x in ('a', 'b')]
        graph = analyze_independence(sources)
        self.assertEqual(graph['dependencies'], [])
        self.assertEqual(len(graph['sources_with_unresolved_independence']), 2)
        self.assertEqual(graph['unresolved_relationships'][0]['suspected_relationship_type'], 'possible_duplicate_or_syndication')

    def test_plain_link_and_canonical_not_dependency(self):
        source = article('https://a.example/a', '<link rel="canonical" href="https://b.example/a"><p>Read more <a href="https://b.example/a">here</a>.</p>')
        self.assertEqual(analyze_independence([source])['dependencies'], [])

    def test_inaccessible(self):
        with patch('inspection.socket.getaddrinfo', side_effect=socket.gaierror):
            source = inspect_source(dict(id='a', url='https://a.example/a'))
        graph = analyze_independence([source])
        self.assertEqual(graph['total_articles_inspected'], 0)
        self.assertEqual(graph['sources_with_unresolved_independence'], ['a'])

    def test_private_addresses(self):
        for ip in ['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', '::ffff:127.0.0.1']:
            with patch('inspection.socket.getaddrinfo', return_value=[(2,1,6,'',(ip,443))]):
                with self.assertRaises(ValueError): fetch_html('https://metadata.example/')

    def test_redirect_to_private_is_blocked(self):
        response = Mock(status=302)
        response.getheader.return_value = 'https://127.0.0.1/secret'
        connection = Mock(); connection.getresponse.return_value = response
        with patch('inspection.socket.getaddrinfo', side_effect=[[(2,1,6,'',('8.8.8.8',443))], [(2,1,6,'',('127.0.0.1',443))]]), patch('inspection.PinnedHTTPS', return_value=connection) as ctor:
            with self.assertRaises(ValueError): fetch_html('https://public.example/')
            self.assertEqual(ctor.call_count, 1)

    def test_oversized_response(self):
        response = Mock(status=200)
        response.getheader.side_effect = lambda key, default=None: {'Content-Type': 'text/html', 'Content-Encoding': 'identity'}.get(key, default)
        response.read1.side_effect = lambda size: b'x' * size
        connection = Mock(); connection.getresponse.return_value = response
        with patch('inspection.socket.getaddrinfo', return_value=[(2,1,6,'',('8.8.8.8',443))]), patch('inspection.PinnedHTTPS', return_value=connection):
            with self.assertRaises(ValueError): fetch_html('https://public.example/')

class ResearchTests(unittest.TestCase):
    def engine(self, response):
        engine = ResearchEngine.__new__(ResearchEngine)
        engine.client = Mock(); engine.client.models.generate_content.return_value = response; engine.model = 'fixture'
        return engine

    def test_multimodal_multiple_claims(self):
        engine = self.engine(NS(text='{"claims":[{"text":"Claim one","checkable":true},{"text":"Claim two","checkable":true}]}'))
        claims = engine.extract(image=b'fixture', mime='image/png')
        self.assertEqual(len(claims), 2)
        contents = engine.client.models.generate_content.call_args.kwargs['contents']
        self.assertEqual(contents[1].inline_data.data, b'fixture')

    def test_no_grounding_evidence(self):
        engine = self.engine(NS(text='{"assessment":"SUPPORTED"}', candidates=[]))
        assessment, sources, grounding = engine.discover(claim())
        self.assertEqual(assessment['assessment'], 'INSUFFICIENT_EVIDENCE')
        self.assertEqual(sources, [])

    def test_chunks_without_support_are_inadequate(self):
        metadata = Mock(); metadata.model_dump.return_value = {'grounding_chunks':[{'web':{'uri':'https://a.example/', 'title':'A'}}]}
        engine = self.engine(NS(text='{"assessment":"SUPPORTED"}', candidates=[NS(grounding_metadata=metadata)]))
        self.assertEqual(engine.discover(claim())[0]['assessment'], 'INSUFFICIENT_EVIDENCE')

    def test_model_hypothesis_cannot_promote_independence(self):
        sources = [article(f'https://{x}.example/', '<p>Original evidence is not established.</p>') for x in ('a','b')]
        graph = analyze_independence(sources)
        import json
        engine = self.engine(NS(text=json.dumps({'hypotheses':[{'source_ids':[s['id'] for s in sources], 'hypothesis':'These are independent', 'rationale':'Model guess only', 'verification_status':'confirmed'}]})))
        engine.interpret_unresolved(sources, graph)
        self.assertEqual(graph['confirmed_distinct_evidence_origins'], 0)
        self.assertEqual(graph['dependencies'], [])
        self.assertEqual(graph['unresolved_relationships'][0]['verification_status'], 'unresolved')
        self.assertEqual(graph['unresolved_relationships'][0]['model_verification_status'], 'unverified')

    def test_discovery_deduplicates_urls_and_preserves_attribution_indices(self):
        metadata = Mock()
        metadata.model_dump.return_value = {'grounding_chunks':[
            {'web':{'uri':'https://a.example/story?utm_source=x', 'title':'A'}},
            {'web':{'uri':'https://a.example/story', 'title':'A again'}}],
            'grounding_supports':[{'segment':{'text':'Evidence summary'}, 'grounding_chunk_indices':[0,1]}],
            'search_entry_point':{'rendered_content':'<p>Fixture only</p>'}}
        engine = self.engine(NS(text='{"assessment":"SUPPORTED","summary":"Evidence summary"}', candidates=[NS(grounding_metadata=metadata)]))
        assessment, sources, grounding = engine.discover(claim())
        self.assertEqual(len(sources), 1)
        self.assertEqual(sources[0]['grounding_chunk_indices'], [0,1])
        self.assertIn('search_entry_point', grounding)
        self.assertEqual(assessment['assessment'], 'SUPPORTED')

    def test_opinion_skips_search(self):
        engine = self.engine(None)
        self.assertEqual(engine.check([claim(checkable=False)])[0]['assessment'], 'NOT_FACT_CHECKABLE')
        engine.client.models.generate_content.assert_not_called()

class APITests(unittest.TestCase):
    def setUp(self):
        self.engine = Mock(); self.engine.extract.return_value = [claim()]
        self.engine.check.return_value = [dict(claim=claim(), assessment='SUPPORTED', evidence_summary='Fixture only', explanation='Fixture explanation', sources=[])]
        self.client = create_app(lambda: self.engine).test_client()

    def test_existing_contract_and_alias(self):
        for route in ['/check', '/api/check']:
            response = self.client.post(route, json={'claim':'A controlled fixture claim', 'source_title':'Fixture'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json['status'], 'supported')
            self.assertIn('results', response.json)

    def test_invalid_inputs(self):
        for payload in [None, [], {'claim':123}, {'claim':'short'}, {'claim':'x'*2001}]:
            self.assertEqual(self.client.post('/api/check', json=payload).status_code, 400)

    def test_image_validation(self):
        self.assertEqual(self.client.post('/api/analyze-image', json={'image_base64':'%%%', 'mime_type':'image/png'}).status_code, 400)
        self.assertEqual(self.client.post('/api/analyze-image', json={'image_base64':base64.b64encode(b'not an image').decode(), 'mime_type':'image/png'}).status_code, 400)

    def test_image_multiple_claims(self):
        self.engine.extract.return_value = [claim('One'), claim('Two')]
        self.engine.check.return_value *= 2
        encoded = base64.b64encode(b'\x89PNG\r\n\x1a\n' + b'fixture bytes').decode()
        response = self.client.post('/api/analyze-image', json={'image_base64':encoded, 'mime_type':'image/png'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json['claims']), 2)
        self.assertEqual(response.json['status'], 'insufficient_evidence')

    def test_upstream_error(self):
        self.engine.extract.side_effect = RuntimeError('private upstream contents')
        response = self.client.post('/check', json={'claim':'Fixture claim text'})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('private', response.text)

    def test_unavailable_model_has_actionable_sanitized_error(self):
        from google.genai.errors import ClientError
        self.engine.extract.side_effect = ClientError(404, {'error': {'message':'private provider body'}})
        response = self.client.post('/check', json={'claim':'Fixture claim text'})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json['code'], 'MODEL_UNAVAILABLE')
        self.assertNotIn('private provider body', response.text)

    def test_expired_credentials_have_actionable_error(self):
        from google.auth.exceptions import RefreshError
        self.engine.extract.side_effect = RefreshError('private token details')
        response = self.client.post('/check', json={'claim':'Fixture claim text'})
        self.assertEqual(response.json['code'], 'CLOUD_AUTH_ERROR')
        self.assertNotIn('private token details', response.text)

    def test_rate_limit(self):
        for _ in range(6): self.client.post('/check', json={'claim':'Fixture claim text'})
        response = self.client.post('/check', json={'claim':'Fixture claim text'})
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers['Retry-After'], '60')

    def test_health(self):
        self.assertEqual(self.client.get('/api/health').status_code, 200)


class PublisherPolicyTests(unittest.TestCase):
    def test_disallowed_robots_prevents_article_request(self):
        response = Mock(status=200)
        response.getheader.side_effect = lambda key, default=None: {'Content-Type': 'text/plain', 'Content-Encoding': 'identity'}.get(key, default)
        response.read1.side_effect = [b'User-agent: *\nDisallow: /\n', b'']
        connection = Mock(); connection.getresponse.return_value = response
        with patch('inspection.socket.getaddrinfo', return_value=[(2,1,6,'',('8.8.8.8',443))]), patch('inspection.PinnedHTTPS', return_value=connection) as ctor:
            with self.assertRaises(ValueError): fetch_html('https://public.example/story', check_robots=True)
            self.assertEqual(ctor.call_count, 1)
            self.assertEqual(connection.request.call_args.args[1], '/robots.txt')

    def test_unrelated_attribution_does_not_confirm_adjacent_link(self):
        source = article('https://a.example/', '<p>According to the report, temperatures rose. <a href="https://b.example/">Subscribe here</a>.</p>')
        self.assertEqual(analyze_independence([source])['dependencies'], [])

if __name__ == '__main__': unittest.main()
