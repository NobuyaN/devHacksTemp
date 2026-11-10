// TEAM HANDOFF — request broker. No AI keys/secrets belong in an extension package.
// TODO(API / teammate): Add health checks, better request error UX and automated tests.
// TODO(SECURITY): A Cloud Run URL is NOT authentication. A public backend requires
//   server-side auth/abuse control/quotas before launch; see docs/SECURITY_AND_CREDITS.md.
// TODO(PRIVACY): Only send minimum needed context. Never send entire page content.
// Network requests run here, not inside the webpage.
const ALLOWED_STATUSES = new Set(["supported", "needs_context", "contradicted", "insufficient_evidence"]);

function allowedApiBase(value) {
  try {
    const url = new URL(value);
    const localhost = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    const cloudRun = url.protocol === "https:" && url.hostname.endsWith(".run.app");
    if ((!localhost && !cloudRun) || url.username || url.password || url.search || url.hash) return null;
    return url.origin;
  } catch (_) { return null; }
}

function demoResult(claim) {
  const normalized = claim.toLowerCase().replace(/[“”"'.!?]/g, "").trim();
  if (normalized.includes("electric vehicles produce zero emissions")) {
    return {
      status: "needs_context",
      summary: "There's a little more to this.",
      detail: "Electric vehicles have no tailpipe emissions, but electricity generation and manufacturing can still produce emissions. This is a prewritten example, not a live check.",
      sources: [],
      demo: true
    };
  }
  if (normalized.includes("humans need oxygen to survive")) {
    return {
      status: "supported",
      summary: "This example is generally supported.",
      detail: "Oxygen is necessary for typical human cellular respiration. This is a prewritten example, not a live check.",
      sources: [],
      demo: true
    };
  }
  if (normalized.includes("the sun revolves around the earth")) {
    return {
      status: "contradicted",
      summary: "This example contradicts established science.",
      detail: "Earth orbits the Sun. This is a prewritten example, not a live check.",
      sources: [],
      demo: true
    };
  }
  return {
    status: "insufficient_evidence",
    summary: "Your highlight is ready to investigate.",
    detail: "You're viewing the design preview. Connect your own Cloud Run endpoint in Mikata's toolbar popup to check arbitrary claims with real sources.",
    sources: [],
    demo: true
  };
}

const pendingChecks = new Map();

async function checkClaim(message) {
  const claim = String(message.claim || "").trim().slice(0, 1000);
  if (!claim) return { error: "Please select or paste a claim first." };
  const { apiUrl = "" } = await chrome.storage.local.get("apiUrl");
  const base = allowedApiBase(apiUrl);
  if (!base) return demoResult(claim);

  const key = JSON.stringify([base, claim, String(message.sourceTitle || "").slice(0, 200)]);
  if (pendingChecks.has(key)) return pendingChecks.get(key);
  const pending = requestClaim(base, claim, message);
  pendingChecks.set(key, pending);
  try { return await pending; }
  finally { pendingChecks.delete(key); }
}

async function requestClaim(base, claim, message) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55000);
  try {
    const response = await fetch(`${base}/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claim,
        // We intentionally DO NOT transmit the full page URL: it may contain
        // private tokens or query parameters, and the backend doesn't use it.
        source_title: String(message.sourceTitle || "").slice(0, 200)
      }),
      signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Backend returned HTTP ${response.status}`);
    if (!ALLOWED_STATUSES.has(data.status) || typeof data.summary !== "string") {
      throw new Error("The backend returned an unexpected result.");
    }
    return {
      status: data.status,
      summary: data.summary.slice(0, 500),
      detail: typeof data.detail === "string" ? data.detail.slice(0, 1600) : "",
      sources: Array.isArray(data.sources) ? data.sources.slice(0, 5).filter(s => {
        try { return s && new URL(s.url).protocol === "https:" && typeof s.title === "string"; }
        catch (_) { return false; }
      }).map(s => ({ title: s.title.slice(0, 120), url: s.url })) : [],
      results: Array.isArray(data.results) ? data.results : [],
      processing_ms: typeof data.processing_ms === "number" ? data.processing_ms : null,
      demo: false
    };
  } catch (error) {
    return { error: error.name === "AbortError" ? "The check took too long. Please try again." : `Couldn't connect to your backend. ${error.message}` };
  } finally { clearTimeout(timer); }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "MIKATA_CHECK") return;
  checkClaim(message).then(sendResponse).catch(error => sendResponse({ error: String(error) }));
  return true;
});
