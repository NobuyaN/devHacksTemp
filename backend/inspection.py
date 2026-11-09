"""Bounded, DNS-pinned HTTPS retrieval. Never executes article markup or scripts."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import http.client
import ipaddress
import re
import socket
import ssl
import time
from html.parser import HTMLParser
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser

MAX_BYTES = 750_000
RESOLVER = ThreadPoolExecutor(max_workers=4, thread_name_prefix="dns")

def stable_id(value):
    return hashlib.sha256(value.encode()).hexdigest()[:20]

def normalize_url(value):
    p = urlsplit(value)
    if p.scheme != 'https' or not p.hostname or p.username or p.password or p.port not in (None, 443):
        raise ValueError('Only credential-free HTTPS URLs on port 443 are supported')
    host = p.hostname.encode('idna').decode().lower().rstrip('.')
    if ':' in host:
        host = '[' + host + ']'
    query = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True)
             if not k.lower().startswith('utm_') and k.lower() not in ('fbclid', 'gclid')]
    return urlunsplit(('https', host, p.path or '/', urlencode(sorted(query)), ''))

class PinnedHTTPS(http.client.HTTPSConnection):
    def __init__(self, host, address, timeout):
        super().__init__(host, timeout=timeout, context=ssl.create_default_context())
        self.address = address
    def connect(self):
        sock = socket.create_connection((self.address, 443), self.timeout)
        self.sock = self._context.wrap_socket(sock, server_hostname=self.host)


def fetch_html(url, deadline=None, robots=False, check_robots=False):
    deadline = deadline or time.monotonic() + 5
    for _ in range(4):
        url = normalize_url(url)
        if check_robots:
            _, rules = fetch_html(urljoin(url, '/robots.txt'), deadline=deadline, robots=True)
            policy = RobotFileParser()
            policy.parse(rules.splitlines())
            if not policy.can_fetch('SourceLens', url):
                raise ValueError('Publisher robots policy disallows inspection')
        host = urlsplit(url).hostname
        lookup = RESOLVER.submit(socket.getaddrinfo, host, 443, type=socket.SOCK_STREAM)
        try:
            rows = lookup.result(timeout=min(1, max(0.01, deadline - time.monotonic())))
        finally:
            lookup.cancel()
        addresses = {row[4][0] for row in rows}
        if not addresses or any(not ipaddress.ip_address(a).is_global for a in addresses):
            raise ValueError('Non-public destination blocked')
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError('Inspection deadline exceeded')
        conn = PinnedHTTPS(host, sorted(addresses)[0], min(remaining, 3))
        try:
            p = urlsplit(url)
            conn.request('GET', urlunsplit(('', '', p.path, p.query, '')), headers={
                'User-Agent': 'SourceLens/1.0 (bounded evidence inspection)', 'Accept': 'text/html',
                'Accept-Encoding': 'identity'})
            response = conn.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                url = urljoin(url, response.getheader('Location') or '')
                continue
            if robots and response.status in (404, 410):
                return url, ''
            content_type = response.getheader('Content-Type') or ''
            if response.status != 200 or not ('text/html' in content_type or (robots and 'text/plain' in content_type)):
                raise ValueError('Article is inaccessible or not HTML')
            if response.getheader('Content-Encoding', 'identity') != 'identity':
                raise ValueError('Encoded responses are not supported')
            body = bytearray()
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError('Inspection deadline exceeded')
                if conn.sock:
                    conn.sock.settimeout(min(remaining, 3))
                part = response.read1(min(16384, MAX_BYTES + 1 - len(body)))
                if not part:
                    break
                body.extend(part)
                if len(body) > MAX_BYTES:
                    raise ValueError('Article exceeds response size limit')
            return url, body.decode('utf-8', errors='replace')
        finally:
            conn.close()
    raise ValueError('Redirect limit exceeded')

def fetch_article(url):
    return fetch_html(url, deadline=time.monotonic() + 5, check_robots=True)

class ArticleParser(HTMLParser):
    def __init__(self, url):
        super().__init__(convert_charrefs=True)
        self.url, self.parts, self.links, self.canonicals = url, [], [], []
        self.skip = 0
        self.text_length = 0
        self.anchor = None
        self.date = None
        self.publisher = None
        self.doi = None
        self.author = None
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('script', 'style', 'nav', 'footer', 'noscript'):
            self.skip += 1
        if self.skip:
            return
        if tag == 'meta':
            key = attrs.get('property', attrs.get('name', ''))
            if key in ('article:published_time', 'datePublished'):
                self.date = attrs.get('content')
            if key == 'citation_doi':
                self.doi = attrs.get('content')
            if key == 'citation_author':
                self.author = attrs.get('content')
            if key == 'og:site_name':
                self.publisher = attrs.get('content')
        if tag == 'link' and 'canonical' in attrs.get('rel', '').split():
            self.canonicals.append(urljoin(self.url, attrs.get('href', '')))
        if tag == 'a' and attrs.get('href'):
            self.anchor = {'url': urljoin(self.url, attrs['href']), 'start': self.text_length + (1 if self.parts else 0), 'label': ''}
    def handle_data(self, data):
        if not self.skip:
            data = re.sub(r'\s+', ' ', data).strip()
            if data:
                self.text_length += len(data) + (1 if self.parts else 0)
                self.parts.append(data)
                if self.anchor:
                    self.anchor['label'] += data + ' '
    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'nav', 'footer', 'noscript') and self.skip:
            self.skip -= 1
        if tag == 'a' and self.anchor:
            self.links.append(self.anchor)
            self.anchor = None

def inspect_source(source, fetcher=fetch_article):
    result = dict(source, inspection_status='unverified', inspection_error=None,
                  citations=[], canonical_urls=[], published_at=None, publisher=None, original_evidence=None)
    try:
        final_url, html = fetcher(source['url'])
        parser = ArticleParser(final_url)
        parser.feed(html)
        text = ' '.join(parser.parts)
        citations = []
        for link in parser.links[:400]:
            try:
                target = normalize_url(link['url'])
            except ValueError:
                continue
            start = link['start']
            excerpt = text[max(0, start - 160):start + min(len(link['label']), 160) + 180]
            # An ordinary hyperlink is not evidence of information dependence.
            prefix = text[max(0, start - 100):start]
            attributed = bool(re.search(r'\b(according to|reported by|reporting by|originally published(?: by| in)?|republished (?:from|with)|study (?:by|in)|research (?:by|in)|data from|report from)\s*(?:the\s+)?$', prefix, re.I))
            left = max(text.rfind('. ', 0, start), text.rfind('! ', 0, start), text.rfind('? ', 0, start))
            left = left + 2 if left >= 0 else 0
            right = re.search(r'[.!?](?:\s|$)', text[start + len(link['label'].strip()):])
            end = start + len(link['label'].strip()) + right.end() if right else len(text)
            citations.append({'url': target, 'excerpt': excerpt, 'attributed': attributed,
                              'context_sentence': text[left:end].strip()})
        original = None
        # Narrow, auditable primary-study rule. Never infer original evidence from a news domain.
        if parser.doi and re.fullmatch(r'10\.\d{4,9}/\S+', parser.doi) and parser.author:
            original = {'identifier': 'https://doi.org/' + parser.doi.lower(), 'author': parser.author,
                        'methodology_excerpt': None}
            for sentence in re.split(r'(?<=[.!?])\s+', text):
                if (re.search(r'\b(?:we|our (?:team|study))\b', sentence, re.I)
                        and re.search(r'\bindependent(?:ly)? replicat(?:ion|ed)\b', sentence, re.I)
                        and re.search(r'\b(?:new participants|separately collected|newly collected|new cohort)\b', sentence, re.I)):
                    original['methodology_excerpt'] = sentence[:1200]
                    break
        result.update(original_evidence=original, inspection_status='inspected', resolved_url=normalize_url(final_url),
                      citations=citations, canonical_urls=parser.canonicals[:3],
                      published_at=parser.date, publisher=parser.publisher,
                      content_hash=stable_id(text), text_excerpt=text[:2000])
    except (OSError, ValueError, http.client.HTTPException, TimeoutError):
        result['inspection_error'] = 'Inaccessible, blocked, timed out, oversized, or unsupported content'
    return result
