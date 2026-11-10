// TEAM HANDOFF — toolbar popup (visuals + settings).
// TODO(UI): Test draft logo readability, spacing and keyboard focus at 100% / 125% zoom.
// TODO(SECURITY): The backend URL is *not* a secret. Never save API keys/tokens here.
// See docs/TEAM_TASKS.md and docs/SECURITY_AND_CREDITS.md before adding features.

const $ = id => document.getElementById(id);
const publicConfig = globalThis.SOURCELENS_CONFIG || {};
const I = globalThis.MikataI18n;
const tr = (key, values) => I.t(key, values);
I.mountSwitch($("language-control"));
I.bind(document.documentElement);
let accountState = null;
let lastMessage = "";
I.onChange(() => { updateMode($("api-url").value); if (accountState) renderAccount(accountState); setMessage(lastMessage); });

const sample = "Electric vehicles produce zero emissions.";

function setMessage(message) { lastMessage = message; $("message").textContent = tr(message || ""); }

async function sendToPage(message) {
  try {
    await I.ready;
    message = { ...message, language: I.language };
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No webpage is active.");
    const response = await chrome.tabs.sendMessage(tab.id, message);
    if (!response?.ok) throw new Error(response?.error || "Open a normal webpage and refresh it first.");
    window.close();
  } catch (error) {
    setMessage(error.message?.includes("Receiving end") ? "Open a normal webpage (not a Chrome settings page), refresh, and try again." : error.message);
  }
}

$("selection-btn").addEventListener("click", () => sendToPage({ type: "MIKATA_OPEN_SELECTION" }));
$("paste-btn").addEventListener("click", () => {
  const text = $("claim-input").value.trim();
  if (!text) return setMessage("Paste a sentence first, and I'll open it on the webpage.");
  sendToPage({ type: "MIKATA_CHECK_TEXT", text });
});
$("sample-btn").addEventListener("click", () => {
  $("claim-input").value = sample;
  setMessage($("mode-pill").classList.contains("live") ? "Sample ready. Click Check this claim to run a live check." : "Sample ready! Click Check this claim to see the design preview.");
});

function validUrl(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return false;
    return (url.protocol === "https:" && url.hostname.endsWith(".run.app")) ||
      (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  } catch (_) { return false; }
}

function updateMode(url) {
  const pill = $("mode-pill");
  pill.textContent = tr(publicConfig.authRequired ? "✿ Shared Mikata service" : url ? "✿ Connected to your backend" : "✦ Design preview mode");
  pill.classList.toggle("live", Boolean(url));
}

$("save-btn").addEventListener("click", async () => {
  const url = $("api-url").value.trim();
  if (!validUrl(url)) return setMessage("Use an https://…run.app URL, or http://localhost for testing.");
  await chrome.storage.local.set({ apiUrl: new URL(url).origin });
  updateMode(url);
  setMessage("Endpoint saved. Checking a claim sends it to your backend and may use Google Cloud credits.");
});
$("reset-btn").addEventListener("click", async () => {
  await chrome.storage.local.remove("apiUrl");
  $("api-url").value = "";
  updateMode("");
  setMessage("Back in design preview mode.");
});
chrome.storage.local.get("apiUrl").then(({ apiUrl }) => {
  const endpoint = publicConfig.authRequired ? publicConfig.apiOrigin : apiUrl || publicConfig.apiOrigin;
  if (endpoint) $("api-url").value = endpoint;
  updateMode(endpoint);
  if (publicConfig.authRequired) $("settings").hidden = true;
});


async function accountAction(type) {
  const request = { type };
  const credentials = ["MIKATA_AUTH_SIGN_IN", "MIKATA_AUTH_SIGN_UP"].includes(type);
  if (credentials || type === "MIKATA_AUTH_RESET") request.email = $("account-email").value.trim();
  if (credentials) request.password = $("account-password").value;
  const buttons = $("account-panel").querySelectorAll("button");
  buttons.forEach(button => { button.disabled = true; });
  try {
    const response = await chrome.runtime.sendMessage(request);
    if (!response || response.error) throw new Error(response?.error || "Sign-in service is unavailable.");
    if (typeof response.signedIn === "boolean") renderAccount(response);
    return response;
  } finally {
    if (credentials) $("account-password").value = "";
    buttons.forEach(button => { button.disabled = false; });
  }
}

function renderAccount(state) {
  accountState = state;
  $("account-form").hidden = state.signedIn;
  $("account-session").hidden = !state.signedIn;
  $("account-refresh").hidden = state.emailVerified;
  $("account-verify").hidden = state.emailVerified;
  $("account-status").textContent = state.signedIn
    ? (state.emailVerified ? tr("Signed in as {email}. Refresh the article to start checking.", {email: state.email}) : tr("Verify the email sent to {email}, then click Refresh.", {email: state.email}))
    : tr("Sign in or create a Mikata account to check claims.");
}
if (publicConfig.authRequired) {
  $("account-panel").hidden = false;
  $("account-privacy").href = publicConfig.apiOrigin + "/privacy.html";
  accountAction("MIKATA_AUTH_STATUS").catch(error => setMessage(error.message));
}
$("account-form").addEventListener("submit", event => { event.preventDefault(); accountAction("MIKATA_AUTH_SIGN_IN").catch(error => setMessage(error.message)); });
$("account-create").addEventListener("click", () => {
  if (!$("account-form").reportValidity()) return;
  accountAction("MIKATA_AUTH_SIGN_UP").then(state => { if (state.verificationSent === false) setMessage("Account created. Use Resend verification email to try sending your verification link."); }).catch(error => setMessage(error.message));
});
for (const [id, action] of [["account-refresh", "REFRESH"], ["account-signout", "SIGN_OUT"], ["account-verify", "VERIFY"]]) {
  $(id).addEventListener("click", () => accountAction(`MIKATA_AUTH_${action}`).then(result => { if (result.sent) setMessage("Verification email sent."); }).catch(error => setMessage(error.message)));
}

$("account-reset").addEventListener("click", () => {
  if (!$("account-email").reportValidity() || !$("account-email").value.trim()) return setMessage("Enter your email first.");
  accountAction("MIKATA_AUTH_RESET").then(() => setMessage("If this account exists, a password reset email will be sent.")).catch(error => setMessage(error.message));
});
$("account-delete").addEventListener("click", () => {
  if (confirm(tr("Delete your Mikata account? This cannot be undone. Usage counters expire separately after their retention period."))) accountAction("MIKATA_AUTH_DELETE").catch(error => setMessage(error.message));
});
