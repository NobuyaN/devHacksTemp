"""Inspectable dependencies only. Similarity, domains and model guesses never prove independence."""
import re
from itertools import combinations
from urllib.parse import urlsplit
from inspection import normalize_url, stable_id


def original_artifact(url):
    p = urlsplit(url)
    # These identify artifacts, not necessarily independent methods, authors or data.
    return ((p.hostname == 'doi.org' and bool(re.match(r'^/10\.\d{4,9}/\S+', p.path)))
            or (p.hostname == 'catalog.data.gov' and p.path.startswith('/dataset/')))


def similar_text(a, b):
    def shingles(source):
        words = re.findall(r'\w+', source.get('text_excerpt', '').lower())
        return {tuple(words[i:i + 5]) for i in range(max(0, len(words) - 4))}
    left, right = shingles(a), shingles(b)
    return bool(left and right and len(left & right) / len(left | right) >= 0.8)


def analyze_independence(sources):
    edges, origins, unresolved = [], {}, []
    distinct = []
    verified_originals = {}
    known = {normalize_url(s['url']): s['id'] for s in sources}
    known.update({s['resolved_url']: s['id'] for s in sources if s.get('resolved_url')})
    known.update({s['original_evidence']['identifier']: s['id'] for s in sources if s.get('original_evidence')})
    dependent = set()
    for source in sources:
        if source['inspection_status'] != 'inspected':
            continue
        for citation in source['citations']:
            if not citation['attributed'] or citation['url'] == source['url']:
                continue
            url = citation['url']
            target = known.get(url, 'origin_' + stable_id(url))
            kind = 'cites_original_artifact' if original_artifact(url) else 'explicit_attribution'
            if re.search(r'originally published|republished (?:from|with)|reporting by', citation['excerpt'], re.I):
                kind = 'syndicated_from'
            edge = dict(id=stable_id(source['id'] + target + kind), source_id=source['id'], target_id=target,
                        relationship_type=kind, evidence=citation['excerpt'], supporting_source_url=source['url'],
                        target_url=url, verification_status='confirmed')
            if any(e['id'] == edge['id'] for e in edges):
                continue
            edges.append(edge)
            dependent.add(source['id'])
            origin = origins.setdefault(target, dict(id=target, url=url, source_ids=[], evidence_edge_ids=[],
                                                      original_artifact_identified=original_artifact(url)))
            origin['source_ids'].append(source['id'])
            origin['evidence_edge_ids'].append(edge['id'])
    # A narrowly supported positive case: an inspected primary study explicitly documents
    # independent replication with new data and links the other inspected primary study.
    for a, b in combinations(sources, 2):
        for replication, prior in ((a, b), (b, a)):
            original = replication.get('original_evidence')
            previous = prior.get('original_evidence')
            if not original or not previous or not original['methodology_excerpt']:
                continue
            if original['identifier'] == previous['identifier'] or original['author'] == previous['author']:
                continue
            if not any(c['url'] == previous['identifier'] and c.get('context_sentence') == original['methodology_excerpt'] for c in replication['citations']):
                continue
            method = original['methodology_excerpt']
            # Both source identities are inspected; the methodological statement remains
            # a documented primary-source assertion, not an audit of raw participant data.
            edge = dict(id=stable_id(replication['id'] + prior['id'] + 'distinct'),
                        source_id=replication['id'], target_id=prior['id'],
                        relationship_type='distinct_original_evidence', evidence=method,
                        supporting_source_url=replication['url'], target_url=prior['url'],
                        verification_status='confirmed')
            distinct.append(edge)
            verified_originals[original['identifier']] = replication['id']
            verified_originals[previous['identifier']] = prior['id']
    # Dependency edges do not imply exclusivity or independence of other evidence.
    for a, b in combinations(sources, 2):
        shared = [o['id'] for o in origins.values() if a['id'] in o['source_ids'] and b['id'] in o['source_ids']]
        direct = any({e['source_id'], e['target_id']} == {a['id'], b['id']} for e in edges)
        separate = any({e['source_id'], e['target_id']} == {a['id'], b['id']} for e in distinct)
        if not shared and not direct and not separate:
            relationship = dict(source_ids=[a['id'], b['id']], verification_status='unresolved',
                                reason='No inspectable dependency or verified independent provenance established')
            if similar_text(a, b):
                relationship.update(suspected_relationship_type='possible_duplicate_or_syndication',
                                    evidence='Substantially overlapping inspected text; similarity does not establish dependence',
                                    supporting_source_urls=[a['url'], b['url']])
            unresolved.append(relationship)
    # Independence is not transitive: count only a mutually documented set.
    chosen = []
    candidate_ids = sorted(set(verified_originals.values()))
    pairs = {frozenset((e['source_id'], e['target_id'])) for e in distinct}
    for size in range(len(candidate_ids), 1, -1):
        for group in combinations(candidate_ids, size):
            if all(frozenset(pair) in pairs for pair in combinations(group, 2)):
                chosen = list(group)
                break
        if chosen:
            break
    verified_originals = {k: v for k, v in verified_originals.items() if v in chosen}
    # Even cited artifacts can share authors/data. Do not report distinct URLs as independence.
    return dict(total_articles_inspected=sum(s['inspection_status'] == 'inspected' for s in sources),
                confirmed_distinct_evidence_origins=len(verified_originals),
                confirmed_original_evidence=[dict(identifier=k, source_id=v) for k, v in verified_originals.items()],
                documented_origin_count=len(origins), confirmed_dependent_articles=len(dependent),
                sources_with_unresolved_independence=[s['id'] for s in sources if s['id'] not in verified_originals.values() or any(s['id'] in r['source_ids'] for r in unresolved)],
                evidence_origins=list(origins.values()), dependencies=edges + distinct, unresolved_relationships=unresolved,
                limitations=['Documented origins establish attribution only; distinct artifacts may share underlying data.',
                             'Positive independence means inspected primary studies document independent replication with new data; it is not a raw-data audit.',
                             'Canonical tags, publication dates and duplicated text are hints, not proof of dependence.',
                             'Linked origins are not fetched unless included among the bounded discovery sources.'])
