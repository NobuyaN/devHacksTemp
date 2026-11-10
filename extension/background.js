if (typeof importScripts === "function") importScripts("config.js", "i18n.js", "auth.js");
const publicConfig = globalThis.SOURCELENS_CONFIG || {};
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
    const packagedService = url.protocol === "https:" && url.origin === publicConfig.apiOrigin;
    if ((!localhost && !cloudRun && !packagedService) || url.username || url.password || url.search || url.hash) return null;
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
  await globalThis.MikataI18n.ready;
  const language = ["en", "ja"].includes(message.language) ? message.language : globalThis.MikataI18n.language;
  message = { ...message, language };
  const claim = String(message.claim || "").trim().slice(0, 1000);
  if (!claim) return { error: "Please select or paste a claim first." };
  const { apiUrl = "" } = await chrome.storage.local.get("apiUrl");
  const base = allowedApiBase(publicConfig.authRequired ? publicConfig.apiOrigin : apiUrl || publicConfig.apiOrigin);
  if (!base) return publicConfig.authRequired
    ? { error: "The shared service has not been configured. Contact the service owner.", code: "SERVICE_NOT_CONFIGURED", backend_reached: false }
    : { ...demoResult(claim), language };

  const key = JSON.stringify([base, claim, String(message.sourceTitle || "").slice(0, 200), language]);
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
    const headers = { "Content-Type": "application/json" };
    if (publicConfig.authRequired) {
      // Tokens are sent only to the pinned release service, never an endpoint override.
      if (base !== publicConfig.apiOrigin) return { error: "The shared service is not configured correctly.", code: "SERVICE_NOT_CONFIGURED", backend_reached: false };
      let token;
      try { token = await globalThis.SourceLensAuth.token(); }
      catch (_) { return { error: "Your sign-in session could not be refreshed. Open the popup and sign in again.", code: "INVALID_SESSION", backend_reached: false }; }
      if (!token) return { error: "Open the Mikata popup and sign in to Mikata first.", code: "AUTH_REQUIRED", backend_reached: false };
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(`${base}${publicConfig.authRequired ? "/api/check" : "/check"}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        claim, language: message.language,
        // We intentionally DO NOT transmit the full page URL: it may contain
        // private tokens or query parameters, and the backend doesn't use it.
        source_title: String(message.sourceTitle || "").slice(0, 200)
      }),
      signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok) return {
      error: data.error || `Backend returned HTTP ${response.status}`,
      code: typeof data.code === "string" ? data.code : "BACKEND_ERROR", backend_reached: true,
      retryable: ["PROVIDER_RATE_LIMITED", "PROVIDER_UNAVAILABLE", "BUSY", "RATE_LIMITED"].includes(data.code)
    };
    if (!ALLOWED_STATUSES.has(data.status) || typeof data.summary !== "string") {
      throw new Error("The backend returned an unexpected result.");
    }
    return {
      language: data.language || message.language,
      status: data.status,
      summary: data.summary.slice(0, 500),
      detail: typeof data.detail === "string" ? data.detail.slice(0, 1600) : "",
      sources: Array.isArray(data.sources) ? data.sources.slice(0, 5).filter(s => {
        try { return s && new URL(s.url).protocol === "https:" && typeof s.title === "string"; }
        catch (_) { return false; }
      }).map(s => ({ title: s.title.slice(0, 120), url: s.url })) : [],
      results: Array.isArray(data.results) ? data.results : [],
      processing_ms: typeof data.processing_ms === "number" ? data.processing_ms : null,
      quota: data.quota && Number.isFinite(data.quota.remaining) ? data.quota : null,
      demo: false
    };
  } catch (error) {
    return {
      error: error.name === "AbortError" ? "The check took too long. Please try again." : `Couldn't connect to your backend. ${error.message}`,
      code: error.name === "AbortError" ? "REQUEST_TIMEOUT" : "NETWORK_ERROR"
    };
  } finally { clearTimeout(timer); }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type?.startsWith("MIKATA_AUTH_")) {
    if (sender?.id !== chrome.runtime.id || sender?.url !== chrome.runtime.getURL("popup.html")) return;
    const actions = { MIKATA_AUTH_STATUS: () => SourceLensAuth.status(),
      MIKATA_AUTH_SIGN_IN: () => SourceLensAuth.signIn(String(message.email || ""), String(message.password || "")),
      MIKATA_AUTH_SIGN_UP: () => SourceLensAuth.signUp(String(message.email || ""), String(message.password || "")),
      MIKATA_AUTH_REFRESH: () => SourceLensAuth.refresh(), MIKATA_AUTH_VERIFY: () => SourceLensAuth.sendVerification(),
      MIKATA_AUTH_RESET: () => SourceLensAuth.resetPassword(String(message.email || "")),
      MIKATA_AUTH_DELETE: () => SourceLensAuth.deleteAccount(),
      MIKATA_AUTH_SIGN_OUT: () => SourceLensAuth.signOut().then(() => SourceLensAuth.status()) };
    const action = actions[message.type];
    if (!action || !globalThis.SourceLensAuth) return;
    Promise.resolve().then(action).then(sendResponse).catch(error => sendResponse({ error: error.message }));
    return true;
  }
  if (message?.type !== "MIKATA_CHECK") return;
  checkClaim(message).then(sendResponse).catch(error => sendResponse({ error: String(error) }));
  return true;
});
