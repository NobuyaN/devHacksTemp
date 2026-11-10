const i18nCode = readFileSync(new URL('../extension/i18n.js', import.meta.url), 'utf8');
// DOM fixtures with mocked Chrome storage/runtime. No browser profile, Google calls or live accuracy claims.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
const code = readFileSync(new URL('../extension/content.js', import.meta.url), 'utf8');
const paragraphs = '<article><p>Scientists report that electric vehicles always produce zero emissions.</p><p>Research shows that the Sun revolves around the Earth.</p><p>Experts report that this fictional drink cures every disease.</p></article>';
const cited = status => ({ status, summary: 'Controlled fixture only', detail: 'Not live research', sources: [{ title: 'Fixture source', url: 'https://source.example/report' }], demo: false });
function page({ enabled = true, result = cited('contradicted'), html = paragraphs, endpoint = 'http://127.0.0.1:8080', config = null, language = 'en' } = {}) {
  const dom = new JSDOM(html, { url: 'https://fixture.example/article', runScripts: 'outside-only' });
  const calls = [];
  const changes = [];
  const messages = [];
  const { window } = dom;
  const timer = window.setTimeout.bind(window);
  window.setTimeout = (fn, ms, ...args) => timer(fn, Math.min(ms, 5), ...args);
  if (config) window.SOURCELENS_CONFIG = config;
  window.chrome = {
    storage: { local: { get: async () => ({ mikataLanguage: language, apiUrl: endpoint, autoScanSites: enabled ? { 'https://fixture.example': true } : {} }), set: async values => { if (values.mikataLanguage) { language = values.mikataLanguage; changes.forEach(fn => fn({ mikataLanguage: { newValue: language } }, 'local')); } } }, onChanged: { addListener: fn => changes.push(fn) } },
    runtime: { onMessage: { addListener: fn => messages.push(fn) }, sendMessage: async message => { calls.push(message); return structuredClone(result); } }
  };
  window.eval(i18nCode);
  window.eval(code);
  return { dom, calls, window, document: window.document,
    open(text) { messages.forEach(fn => fn({ type: 'MIKATA_CHECK_TEXT', text }, {}, () => {})); },
    toggle(value) { changes.forEach(fn => fn({ autoScanSites: { newValue: value ? { 'https://fixture.example': true } : {} } }, 'local')); } };
}
async function until(predicate) {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await delay(5); }
  throw new Error('Fixture DOM did not reach the expected state');
}
test('page loading never checks claims, including legacy enabled-site preferences', async t => {
  const p = page({ enabled: true, config: { authRequired: true, apiOrigin: 'https://fixture-project.web.app' } });
  t.after(() => p.window.close());
  await delay(50);
  p.toggle(true);
  await delay(30);
  assert.equal(p.calls.length, 0);
  assert.equal(p.document.querySelector('article').innerHTML, paragraphs.replace(/^<article>|<\/article>$/g, ''));
  assert.equal(p.document.querySelectorAll('.mikata-claim-highlight, #mk-scan-toast').length, 0);
});
test('explicit popup checks still render the claim, verdict and citations', async t => {
  const p = page(); t.after(() => p.window.close());
  p.open('A controlled manual fixture claim.');
  await until(() => p.document.querySelector('#mk-status').dataset.status === 'contradicted');
  assert.equal(p.calls.length, 1);
  assert.equal(p.calls[0].claim, 'A controlled manual fixture claim.');
  assert.match(p.document.querySelector('#mk-claim').textContent, /controlled manual fixture/);
  assert.equal(p.document.querySelector('#mk-sources a').href, 'https://source.example/report');
});

test('manual results disclose zero inspection and per-source blocking reasons', async t => {
  const result = cited('supported');
  result.results = [{ claim: { text: 'Fixture claim' }, sources: [{ title: 'Grounding fixture', url: 'https://source.example/', inspection_status: 'unverified', inspection_error: 'Site robots policy disallows automated inspection' }], independence: { total_articles_inspected: 0, confirmed_distinct_evidence_origins: 0, sources_with_unresolved_independence: ['g'], dependencies: [], unresolved_relationships: [] } }];
  const p = page({ enabled: false, result }); t.after(() => p.window.close());
  p.open('A controlled manual fixture claim.');
  await until(() => p.document.querySelector('#mk-provenance'));
  const text = p.document.querySelector('#mk-provenance').textContent;
  assert.match(text, /Article-level provenance could not be checked/);
  assert.match(text, /robots policy disallows/);
  assert.match(text, /0 confirmed distinct evidence origins/);
});

test('webpage scripts cannot synthesize a paid highlight or retry click', async t => {
  const p = page({ enabled: false }); t.after(() => p.window.close());
  p.window.getSelection = () => ({ isCollapsed: false, rangeCount: 1, anchorNode: p.document.querySelector('article p').firstChild,
    toString: () => 'A controlled highlight fixture claim.', getRangeAt: () => ({ getBoundingClientRect: () => ({ left: 0, bottom: 50, width: 200, height: 20 }) }) });
  p.document.body.dispatchEvent(new p.window.MouseEvent('mouseup', { bubbles: true }));
  await until(() => p.document.querySelector('#mk-bubble').classList.contains('is-visible'));
  p.document.querySelector('#mk-bubble').click();
  await delay(10);
  assert.equal(p.calls.length, 0);
  p.open('A legitimate privileged popup message fixture.');
  await until(() => p.calls.length === 1 && !p.document.querySelector('#mk-retry').disabled);
  p.document.querySelector('#mk-retry').click();
  await delay(10);
  assert.equal(p.calls.length, 1);
});

test('saved Japanese preference localizes the sidebar without changing the webpage or making checks', async t => {
  const result = {...cited('supported'),language:'ja',summary:'根拠による支持があります。',detail:'調査結果です。'};
  const p=page({language:'ja',result});t.after(()=>p.window.close());
  await p.window.MikataI18n.ready;
  assert.equal(p.document.querySelector('#mikata-extension-root').lang,'ja');
  assert.notEqual(p.document.documentElement.lang,'ja');
  assert.match(p.document.querySelector('#mk-bubble').textContent,/Mikata で確認/);
  assert.equal(p.calls.length,0);
  p.open('地球は太陽の周りを公転しています。');
  await until(()=>p.document.querySelector('#mk-status').dataset.status==='supported');
  assert.equal(p.calls[0].language,'ja');
  assert.match(p.document.querySelector('#mk-status-title').textContent,/支持/);
  assert.match(p.document.querySelector('#mk-status-text').textContent,/根拠による/);
  const source=p.document.querySelector('#mk-sources a');assert.match(source.textContent,/Fixture source/);
  await p.window.MikataI18n.setLanguage('en');
  assert.match(p.document.querySelector('#mk-status-title').textContent,/Looks supported/);
  assert.match(p.document.querySelector('#mk-detail').textContent,/Results stay in their original language/);
  assert.equal(p.calls.length,1);
  assert.match(p.document.querySelector('#mk-status-text').textContent,/根拠による/);
});
