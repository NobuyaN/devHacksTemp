const I = globalThis.MikataI18n;
const tr = (key, values) => I.t(key, values);
I.mountSwitch(document.querySelector('#language-control'));
I.bind(document.documentElement);
let lastResponse = null;
I.onChange(() => {
  if (!lastResponse) return;
  results.replaceChildren(); lastResponse.results.forEach(render);
  status.textContent = tr('Results stay in their original language. Check again to request this language (uses one check).');
});
const form = document.querySelector('#check');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
const publicConfig = globalThis.SOURCELENS_CONFIG || {};
function node(tag, text, parent) { const el = document.createElement(tag); el.textContent = tr(text); parent.append(el); return el; }
function sourceLink(parent, title, url) {
  try { if (new URL(url).protocol !== 'https:') return; } catch { return; }
  const a = node('a', '', parent); a.textContent = title; a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
}
function render(result) {
  const card = node('article', '', results);
  node('h2', '', card).textContent = result.claim.text;
  node('strong', I.language === 'ja' ? tr(result.assessment) : result.assessment.replaceAll('_', ' '), card);
  node('p', '', card).textContent = result.evidence_summary; node('p', '', card).textContent = result.explanation;
  const graph = result.independence;
  node('h3', 'Evidence provenance', card);
  node('p', tr("{articles} articles inspected · {targets} documented attribution targets · {dependent} attributed articles · {unresolved} unresolved independence.", {articles: graph.total_articles_inspected, targets: graph.documented_origin_count, dependent: graph.confirmed_dependent_articles, unresolved: graph.sources_with_unresolved_independence.length}), card);
  node('p', tr("Confirmed independent evidence origins: {count}", {count: graph.confirmed_distinct_evidence_origins}), card);
  const list = node('ul', '', card);
  for (const source of result.sources) {
    const li = node('li', '', list); sourceLink(li, source.title, source.url);
    node('small', ` — ${source.discovery_method === 'research_candidate' ? tr('Fetched research candidate') + ' · ' : ''}${tr(source.inspection_status)}${source.publisher ? ' · ' + source.publisher : ''}${source.published_at ? ' · ' + source.published_at : ''}`, li);
  }
  if (!graph.total_articles_inspected) node('p', 'Article-level provenance could not be checked. The factual verdict uses grounded search, not verified independent origins.', card);
  for (const source of result.sources) if (source.inspection_error) node('p', `${source.title}: ${I.inspection(source)}`, card);
  for (const edge of graph.dependencies) {
    const detail = node('details', '', card); node('summary', I.language === 'ja' ? tr(edge.relationship_type) : edge.relationship_type.replaceAll('_', ' '), detail);
    node('p', '', detail).textContent = edge.evidence; sourceLink(detail, tr('Inspect attribution'), edge.supporting_source_url);
    node('p', 'Attributed target:', detail); sourceLink(detail, edge.target_url, edge.target_url);
  }
  const html = result.grounding?.search_entry_point?.rendered_content;
  if (html) {
    node('h3', 'Google Search suggestions', card);
    // Provider attribution is isolated from the application origin; scripts/forms/navigation disabled.
    const frame = node('iframe', '', card); frame.title = tr('Google Search suggestions'); frame.sandbox = 'allow-popups allow-popups-to-escape-sandbox'; frame.srcdoc = html;
  }
  const raw = node('details', '', card); node('summary', 'Grounding citations and source graph data', raw);
  node('pre', JSON.stringify({ grounding: result.grounding, independence: graph }, null, 2), raw);
  node('p', result.limitations.map(item => tr(item)).join(' '), card);
}
form.addEventListener('submit', async event => {
  event.preventDefault(); await I.ready; lastResponse = null; results.replaceChildren(); form.querySelector('button').disabled = true;
  status.textContent = tr('Researching evidence. This can take up to a minute.');
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 55000);
  try {
    const file = document.querySelector('#image').files[0];
    let payload; let route;
    if (file) {
      if (file.size > 4 * 1024 * 1024) throw new Error('Image must be at most 4 MiB.');
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      payload = { image_base64: data.split(',')[1], mime_type: file.type }; route = '/api/analyze-image';
    } else { payload = { claim: document.querySelector('#claim').value }; route = '/api/check'; }
    payload.language = I.language;
    // Local preview only; deployed Firebase uses its same-origin Cloud Run rewrite.
    const base = ['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://localhost:8080' : '';
    const headers = { 'Content-Type': 'application/json' };
    if (publicConfig.authRequired) {
      const token = await SourceLensAuth.token();
      if (!token) throw new Error('Sign in to Mikata first.');
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(base + route, { method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal });
    const data = await response.json(); if (!response.ok) throw new Error(I.error(data));
    lastResponse = data; data.results.forEach(render); status.textContent = tr(data.results.length ? 'Review the evidence and uncertainty below.' : 'No factual claims extracted.');
  } catch (error) { status.textContent = tr(error.name === 'AbortError' ? 'Research timed out. Try a shorter claim.' : error.message); }
  finally { clearTimeout(timer); form.querySelector('button').disabled = false; }
});

if (publicConfig.authRequired) {
  const account = document.createElement('section');
  account.innerHTML = '<h2>Your Mikata account</h2><p id="account-note" role="status"></p><form id="account-form"><label for="account-email">Email</label><input id="account-email" type="email" required autocomplete="email"><label for="account-password">Password</label><input id="account-password" type="password" required minlength="8" maxlength="128" autocomplete="current-password"><button>Sign in</button> <button type="button" id="account-create">Create account</button> <button type="button" id="account-reset">Reset password</button></form><p><button id="account-refresh" type="button">Refresh verified session</button> <button id="account-verify" type="button">Resend verification email</button> <button id="account-signout" type="button">Sign out</button> <button id="account-delete" type="button">Delete account</button></p>';
  form.before(account);
  I.bind(account);
  const get = id => account.querySelector('#' + id);
  const render = async () => {
    const state = await SourceLensAuth.status();
    get('account-note').textContent = state.signedIn ? tr(state.emailVerified ? '{email}: signed in' : '{email}: check your email to verify your account, then refresh your session', {email: state.email}) : tr('Create an account or sign in to check claims.');
    get('account-form').hidden = state.signedIn;
    for (const id of ['account-refresh','account-verify','account-signout','account-delete']) get(id).hidden = !state.signedIn;
  };
  const run = async action => {
    try { await action(); await render(); }
    catch (error) { get('account-note').textContent = tr(error.message); }
    finally { get('account-password').value = ''; }
  };
  get('account-form').addEventListener('submit', event => { event.preventDefault(); run(() => SourceLensAuth.signIn(get('account-email').value.trim(), get('account-password').value)); });
  get('account-create').onclick = () => { if (get('account-form').reportValidity()) run(() => SourceLensAuth.signUp(get('account-email').value.trim(), get('account-password').value)); };
  get('account-refresh').onclick = () => run(() => SourceLensAuth.refresh());
  get('account-verify').onclick = () => run(async () => { await SourceLensAuth.sendVerification(); });
  get('account-signout').onclick = () => run(() => SourceLensAuth.signOut());
  get('account-delete').onclick = () => { if (confirm(tr('Delete your Mikata account? This cannot be undone.'))) run(() => SourceLensAuth.deleteAccount()); };
  get('account-reset').onclick = () => run(() => SourceLensAuth.resetPassword(get('account-email').value.trim()));
  render(); I.onChange(render);
}
