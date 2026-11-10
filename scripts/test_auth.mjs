// Controlled Firebase REST fixtures. No real tokens, accounts, email or network.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const code = readFileSync(new URL('../extension/auth.js', import.meta.url), 'utf8');
function authFixture(responses, initial = null) {
  let state = initial;
  const calls = [];
  const context = vm.createContext({
    SOURCELENS_CONFIG: { authRequired: true, firebaseApiKey: 'fixture-public-auth-key', projectId: 'fixture-project' },
    chrome: { storage: { session: {
      get: async key => ({ [key]: state }), set: async value => { state = value.sourcelensAuthSession; }, remove: async () => { state = null; }
    }, local: { set() { throw new Error('Auth must not use persistent local storage'); } } } },
    URLSearchParams, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => { calls.push({ url, options }); const next = responses.shift(); if (!next) throw new Error('Unexpected fixture request'); return { ok: next.ok !== false, json: async () => next.data }; }
  });
  vm.runInContext(code, context);
  return { api: context.SourceLensAuth, calls, state: () => state };
}
const session = { idToken: 'fixture-id-token', refreshToken: 'fixture-refresh-token', expiresAt: Date.now() + 3600000, email: 'user@example.test', emailVerified: false };
test('fresh profile has no session or account token', async () => {
  const fixture = authFixture([]);
  assert.equal(await fixture.api.token(), null);
  assert.equal((await fixture.api.status()).signedIn, false);
  assert.equal(fixture.calls.length, 0);
});
test('account creation stores tokens only in session, not password, and requests verification', async () => {
  const fixture = authFixture([{ data: { idToken: 'fixture-id-token', refreshToken: 'fixture-refresh-token', expiresIn: '3600' } }, { data: {} }]);
  const result = await fixture.api.signUp('user@example.test', 'fixture-password');
  assert.equal(result.verificationSent, true);
  assert.equal(result.emailVerified, false);
  assert.equal(fixture.calls.length, 2);
  assert.match(fixture.calls[1].options.body, /VERIFY_EMAIL/);
  assert.doesNotMatch(JSON.stringify(fixture.state()), /fixture-password/);
  assert.doesNotMatch(JSON.stringify(await fixture.api.status()), /fixture-id-token|fixture-refresh-token/);
});
test('parallel expired-token requests share one refresh', async () => {
  const fixture = authFixture([{ data: { id_token: 'fixture-new-id', refresh_token: 'fixture-new-refresh', expires_in: '3600' } }], { ...session, expiresAt: 0 });
  const tokens = await Promise.all([fixture.api.token(), fixture.api.token()]);
  assert.equal(tokens[0], 'fixture-new-id'); assert.equal(tokens[1], 'fixture-new-id');
  assert.equal(fixture.calls.length, 1);
  assert.match(fixture.calls[0].url, /^https:\/\/securetoken.googleapis.com/);
});
test('verification refresh obtains a fresh token and looks up verified state', async () => {
  const fixture = authFixture([{ data: { id_token: 'fixture-new-id', refresh_token: 'fixture-new-refresh', expires_in: '3600' } }, { data: { users: [{ emailVerified: true }] } }], session);
  assert.equal((await fixture.api.refresh()).emailVerified, true);
  assert.equal(fixture.state().idToken, 'fixture-new-id');
});
test('account deletion is explicit and removes the local session', async () => {
  const fixture = authFixture([{ data: {} }], session);
  assert.equal((await fixture.api.deleteAccount()).signedIn, false);
  assert.equal(fixture.state(), null);
  assert.match(fixture.calls[0].url, /accounts:delete/);
});
test('provider auth error bodies are replaced by safe messages', async () => {
  const fixture = authFixture([{ ok: false, data: { error: { message: 'PRIVATE_PROVIDER_BODY' } } }]);
  await assert.rejects(fixture.api.signIn('user@example.test', 'fixture-password'), error => !error.message.includes('PRIVATE_PROVIDER_BODY'));
});
