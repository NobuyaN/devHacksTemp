// DOM fixtures with mocked Chrome storage/runtime. No browser profile, Google calls or live accuracy claims.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
const code = readFileSync(new URL('../extension/content.js', import.meta.url), 'utf8');
const paragraphs = '<article><p>Scientists report that electric vehicles always produce zero emissions.</p><p>Research shows that the Sun revolves around the Earth.</p><p>Experts report that this fictional drink cures every disease.</p></article>';
const cited = status => ({ status, summary: 'Controlled fixture only', detail: 'Not live research', sources: [{ title: 'Fixture source', url: 'https://source.example/report' }], demo: false });
function page({ enabled = true, result = cited('contradicted'), html = paragraphs, endpoint = 'http://127.0.0.1:8080' } = {}) {
  const dom = new JSDOM(html, { url: 'https://fixture.example/article', runScripts: 'outside-only' });
  const calls = [];
  const changes = [];
  const messages = [];
  const { window } = dom;
  const timer = window.setTimeout.bind(window);
  window.setTimeout = (fn, ms, ...args) => timer(fn, Math.min(ms, 5), ...args);
  window.chrome = {
    storage: { local: { get: async () => ({ apiUrl: endpoint, autoScanSites: enabled ? { 'https://fixture.example': true } : {} }) }, onChanged: { addListener: fn => changes.push(fn) } },
    runtime: { onMessage: { addListener: fn => messages.push(fn) }, sendMessage: async message => { calls.push(message); return structuredClone(result); } }
  };
  window.eval(code);
  return { dom, calls, window, document: window.document,
    open(text) { messages.forEach(fn => fn({ type: 'MIKATA_CHECK_TEXT', text }, {}, () => {})); },
    toggle(value) { changes.forEach(fn => fn({ autoScanSites: { newValue: value ? { 'https://fixture.example': true } : {} } }, 'local')); } };
}
async function until(predicate) {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await delay(5); }
  throw new Error('Fixture DOM did not reach the expected state');
}
test('Auto Scan is off by default and does not make cloud requests', async t => {
  const p = page({ enabled: false }); t.after(() => p.window.close());
  await delay(30); assert.equal(p.calls.length, 0);
  assert.equal(p.document.querySelectorAll('.mikata-claim-highlight').length, 0);
});
test('Auto Scan checks at most two candidates and clicking a warning reuses its result', async t => {
  const p = page(); t.after(() => p.window.close());
  await until(() => /source-backed warnings/.test(p.document.querySelector('#mk-toast-message').textContent));
  assert.equal(p.calls.length, 2);
  assert.equal(p.document.querySelectorAll('.mikata-claim-highlight.is-contradicted').length, 2);
  p.document.querySelector('.mikata-claim-highlight').click();
  await until(() => p.document.querySelector('#mk-status').dataset.status === 'contradicted');
  assert.equal(p.calls.length, 2);
  p.toggle(false);
  assert.equal(p.document.querySelectorAll('.mikata-claim-highlight').length, 0);
  p.toggle(true);
  await until(() => /limit reached/.test(p.document.querySelector('#mk-toast-message').textContent));
  assert.equal(p.calls.length, 2);
});
test('supported claims remove markers and do not imply the whole page was checked', async t => {
  const p = page({ result: cited('supported') }); t.after(() => p.window.close());
  await until(() => /rest of the page was not checked/.test(p.document.querySelector('#mk-toast-message').textContent));
  assert.equal(p.calls.length, 2);
  assert.equal(p.document.querySelectorAll('.mikata-claim-highlight').length, 0);
});
test('failed checks are reported as incomplete, not as a clean scan', async t => {
  const p = page({ result: { error: 'Fixture provider busy', code: 'PROVIDER_UNAVAILABLE' } }); t.after(() => p.window.close());
  await until(() => /Scan incomplete: 2 checks failed/.test(p.document.querySelector('#mk-toast-message').textContent));
  assert.equal(p.document.querySelectorAll('.mikata-claim-highlight').length, 0);
});
test('uncited checks produce no warnings and explicitly report missing evidence', async t => {
  const p = page({ result: { ...cited('contradicted'), sources: [] } }); t.after(() => p.window.close());
  await until(() => /lacked cited evidence/.test(p.document.querySelector('#mk-toast-message').textContent));
  assert.equal(p.document.querySelectorAll('.mikata-claim-highlight').length, 0);
});
test('preview markers never become misinformation warnings or send requests', async t => {
  const p = page({ endpoint: '' }); t.after(() => p.window.close());
  await until(() => /preview only/.test(p.document.querySelector('#mk-toast-message').textContent));
  assert.equal(p.calls.length, 0);
  assert.equal(p.document.querySelectorAll('.mikata-claim-highlight.is-review').length, 2);
});
test('no candidate means not fact checked, and password pages are skipped', async t => {
  const p = page({ html: '<input type="password">' + paragraphs }); t.after(() => p.window.close());
  await until(() => /has not been fact-checked/.test(p.document.querySelector('#mk-toast-message').textContent));
  assert.equal(p.calls.length, 0);
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
