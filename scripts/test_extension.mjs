// Integration fixtures only; no Chrome session and no live research.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const code = readFileSync(new URL('../extension/background.js', import.meta.url), 'utf8');
function broker(payload, status = 200) {
  const calls = [];
  let listener;
  const context = vm.createContext({
    chrome: { storage: { local: { get: async () => ({ apiUrl: 'http://localhost:8080' }) } },
      runtime: { onMessage: { addListener(fn) { listener = fn; } } } },
    URL, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return { ok: status === 200, status, json: async () => payload }; }
  });
  vm.runInContext(code, context);
  return { calls, check: (message = {}) => new Promise(resolve => listener({ type: 'MIKATA_CHECK', claim: 'Controlled fixture claim', sourceTitle: 'Fixture page', ...message }, {}, resolve)) };
}
test('existing broker accepts additive backend contract and retains grounding', async () => {
  const server = broker({ status: 'supported', summary: 'Fixture only', detail: 'Not live evidence', sources: [{ title: 'Example', url: 'https://example.com/' }], results: [{ grounding: { search_entry_point: { rendered_content: '<p>Fixture Google suggestions</p>' } }, independence: { dependencies: [] } }] });
  const result = await server.check();
  assert.equal(result.status, 'supported');
  assert.equal(result.demo, false);
  assert.equal(result.results[0].grounding.search_entry_point.rendered_content, '<p>Fixture Google suggestions</p>');
  assert.equal(server.calls[0].url, 'http://localhost:8080/check');
  assert.equal(server.calls[0].body.source_title, 'Fixture page');
  assert.equal('source_url' in server.calls[0].body, false);
});
test('broker returns an error when API is unavailable', async () => {
  const result = await broker({}, 503).check();
  assert.match(result.error, /503/);
});

test('simultaneous identical checks share one HTTP request and later checks stay fresh', async () => {
  const server = broker({ status: 'supported', summary: 'Fixture only', sources: [] });
  const [a, b] = await Promise.all([server.check(), server.check()]);
  assert.equal(a.status, 'supported'); assert.equal(b.status, 'supported');
  assert.equal(server.calls.length, 1);
  await server.check();
  assert.equal(server.calls.length, 2);
});
test('different claims do not share an HTTP request', async () => {
  const server = broker({ status: 'supported', summary: 'Fixture only', sources: [] });
  await Promise.all([server.check(), server.check({ claim: 'A different controlled fixture claim' })]);
  assert.equal(server.calls.length, 2);
});
test('actionable backend errors reach the extension', async () => {
  const result = await broker({ error: 'The configured Gemini model is unavailable.' }, 503).check();
  assert.match(result.error, /configured Gemini model/);
});
