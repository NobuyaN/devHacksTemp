// TEAM HANDOFF — toolbar popup (visuals + settings).
// TODO(UI): Test draft logo readability, spacing and keyboard focus at 100% / 125% zoom.
// TODO(SECURITY): The backend URL is *not* a secret. Never save API keys/tokens here.
// TODO(PRIVACY): If adding a global scan toggle, keep opt-in / per-site consent visible.
// See docs/TEAM_TASKS.md and docs/SECURITY_AND_CREDITS.md before adding features.

const $ = id => document.getElementById(id);
const sample = "Electric vehicles produce zero emissions.";

function setMessage(message) { $("message").textContent = message || ""; }

async function sendToPage(message) {
  try {
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
  setMessage("Sample ready! Click “Check this claim” to see the design preview.");
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
  pill.textContent = url ? "✿ Connected to your backend" : "✦ Design preview mode";
  pill.classList.toggle("live", Boolean(url));
}

$("save-btn").addEventListener("click", async () => {
  const url = $("api-url").value.trim();
  if (!validUrl(url)) return setMessage("Use an https://…run.app URL, or http://localhost for testing.");
  await chrome.storage.local.set({ apiUrl: new URL(url).origin });
  updateMode(url);
  setMessage("Endpoint saved. Live checks may use Google Cloud credits—please keep Auto Scan off when not testing.");
});
$("reset-btn").addEventListener("click", async () => {
  await chrome.storage.local.remove("apiUrl");
  $("api-url").value = "";
  updateMode("");
  setMessage("Back in design preview mode.");
});
chrome.storage.local.get("apiUrl").then(({ apiUrl }) => {
  if (apiUrl) $("api-url").value = apiUrl;
  updateMode(apiUrl);
});


// Auto Scan is explicitly opted into PER WEBSITE and starts disabled everywhere else.
let currentOrigin = null;
function describeSite() { return currentOrigin ? new URL(currentOrigin).hostname : "this page"; }
async function initializeAutoScan() {
  const toggle = $("auto-toggle");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab?.url || "");
    if (!(["https:", "http:"].includes(url.protocol))) throw new Error("unsupported");
    currentOrigin = url.origin;
    const { autoScanSites = {} } = await chrome.storage.local.get("autoScanSites");
    toggle.checked = autoScanSites[currentOrigin] === true;
    $("auto-note").textContent = `${toggle.checked ? "On" : "Off"} for ${describeSite()} · saved for this website`;
  } catch (_) {
    toggle.disabled = true;
    $("auto-note").textContent = "Open a normal website to use Auto Scan.";
  }
}
$("auto-toggle").addEventListener("change", async event => {
  if (!currentOrigin) return;
  const toggle = event.currentTarget;
  toggle.disabled = true;
  try {
    const { autoScanSites = {} } = await chrome.storage.local.get("autoScanSites");
    const updated = { ...autoScanSites };
    if (toggle.checked) updated[currentOrigin] = true;
    else delete updated[currentOrigin];
    await chrome.storage.local.set({ autoScanSites: updated });
    $("auto-note").textContent = `${toggle.checked ? "On" : "Off"} for ${describeSite()} · saved for this website`;
    setMessage(toggle.checked ? "Auto Scan enabled! The current page will show gentle claim indicators." : "Auto Scan disabled here. Existing indicators are removed.");
  } catch (error) {
    toggle.checked = !toggle.checked;
    setMessage(`Couldn't save Auto Scan: ${error.message}`);
  } finally { toggle.disabled = false; }
});
initializeAutoScan();
