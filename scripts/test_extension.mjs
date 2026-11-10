const i18nCode = readFileSync(new URL('../extension/i18n.js', import.meta.url), 'utf8');
// Integration fixtures only; no Chrome session and no live research.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const code = readFileSync(new URL('../extension/background.js', import.meta.url), 'utf8');
function broker(payload, status = 200, networkError = null, options = {}) {
  const calls = [];
  let listener;
  const context = vm.createContext({
    SOURCELENS_CONFIG: options.config || {},
    SourceLensAuth: { token: async () => options.token || null, status: async () => ({ signedIn: true }) },
    chrome: { storage: { local: { get: async () => ({ apiUrl: options.apiUrl ?? 'http://localhost:8080' }) } },
      runtime: { id: 'fixture-extension', getURL: path => 'chrome-extension://fixture-extension/' + path, onMessage: { addListener(fn) { listener = fn; } } } },
    URL, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => { if (networkError) throw networkError; calls.push({ url, headers: options.headers, body: JSON.parse(options.body) }); return { ok: status === 200, status, json: async () => payload }; }
  });
  vm.runInContext(i18nCode, context);
  vm.runInContext(code, context);
  return { calls, dispatch: (message, sender, sendResponse = () => {}) => listener(message, sender, sendResponse), check: (message = {}) => new Promise(resolve => listener({ type: 'MIKATA_CHECK', claim: 'Controlled fixture claim', sourceTitle: 'Fixture page', ...message }, {}, resolve)) };
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

test('provider failures are not reported as backend connection failures', async () => {
  const result = await broker({ error: 'Google is temporarily busy.', code: 'PROVIDER_RATE_LIMITED' }, 503).check();
  assert.equal(result.code, 'PROVIDER_RATE_LIMITED');
  assert.equal(result.retryable, true);
  assert.doesNotMatch(result.error, /Couldn't connect/);
});
test('network failures retain the connection error code', async () => {
  const result = await broker({}, 200, new TypeError('Fixture offline')).check();
  assert.equal(result.code, 'NETWORK_ERROR');
  assert.match(result.error, /Couldn't connect/);
});

test('public package works in fresh profile with pinned service and signed-in user', async () => {
  const server = broker({ status: 'supported', summary: 'Fixture only', sources: [] }, 200, null,
    { config: { apiOrigin: 'https://fixture-project.web.app', authRequired: true }, apiUrl: '', token: 'fixture-id-token' });
  assert.equal((await server.check()).status, 'supported');
  assert.equal(server.calls[0].url, 'https://fixture-project.web.app/api/check');
  assert.equal(server.calls[0].headers.Authorization, 'Bearer fixture-id-token');
});
test('stored endpoint overrides cannot redirect public authentication tokens', async () => {
  const server = broker({ status: 'supported', summary: 'Fixture only', sources: [] }, 200, null,
    { config: { apiOrigin: 'https://fixture-project.web.app', authRequired: true }, apiUrl: 'https://untrusted.run.app', token: 'fixture-id-token' });
  await server.check();
  assert.equal(server.calls[0].url, 'https://fixture-project.web.app/api/check');
});
test('signed-out public users do not trigger backend research', async () => {
  const server = broker({}, 200, null, { config: { apiOrigin: 'https://fixture-project.web.app', authRequired: true }, apiUrl: '' });
  const result = await server.check();
  assert.equal(result.code, 'AUTH_REQUIRED'); assert.equal(result.backend_reached, false);
  assert.equal(server.calls.length, 0);
});
test('content scripts cannot invoke privileged account operations', () => {
  const server = broker({}); let responded = false;
  assert.equal(server.dispatch({ type: 'MIKATA_AUTH_STATUS' }, { id: 'fixture-extension', url: 'https://article.example/' }, () => { responded = true; }), undefined);
  assert.equal(responded, false);
});

test('misconfigured public release never silently returns design-preview verdicts', async () => {
  const server = broker({}, 200, null, { config: { authRequired: true, apiOrigin: '' }, apiUrl: '' });
  const result = await server.check();
  assert.equal(result.code, 'SERVICE_NOT_CONFIGURED');
  assert.notEqual(result.demo, true);
  assert.equal(server.calls.length, 0);
});

test('English and Japanese checks do not coalesce and retain the requested language',async()=>{
  const server=broker({status:'supported',summary:'Fixture only',sources:[]});
  const [english,japanese]=await Promise.all([server.check({language:'en'}),server.check({language:'ja'})]);
  assert.equal(server.calls.length,2);
  assert.equal(server.calls[0].body.language,'en');assert.equal(server.calls[1].body.language,'ja');
  assert.equal(english.language,'en');assert.equal(japanese.language,'ja');
});
