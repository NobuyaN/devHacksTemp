// TEAM HANDOFF — content script (floating check button, sidebar, Auto Scan).
// TODO(DESIGN): Compare the proposed hand-drawn logo in design/logo-explorations/
//   to the existing sidebar icon. Keep user-facing warnings friendly and cautious.
// TODO(SCANNING): Extend heuristics beyond English and improve selection safety;
//   never equate a high heuristic score with a false or misleading claim.
// TODO(PRIVACY): Avoid scanning forms, private apps, or contenteditable elements;
//   before launch consider explicit site allow/deny lists and clear disclosure.
// TODO(TESTS): Test complex DOMs, navigations, dynamic pages and accessibility.
// Every candidate is only a heuristic suggestion, NOT a misinformation verdict.
(() => {
  if (document.getElementById("mikata-extension-root")) return;

  const root = document.createElement("div");
  root.id = "mikata-extension-root";
  root.innerHTML = `
    <button class="mk-bubble" id="mk-bubble" type="button" aria-label="Check selected text with Mikata">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/></svg>
      Check with mikata <span aria-hidden="true">✦</span>
    </button>
    <div class="mk-scan-toast" id="mk-scan-toast" role="status" aria-live="polite" hidden>
      <span class="mk-toast-symbol" aria-hidden="true">✿</span>
      <span class="mk-toast-message" id="mk-toast-message"></span>
      <button type="button" id="mk-toast-close" aria-label="Dismiss Mikata scan notice">×</button>
    </div>
    <aside class="mk-panel" id="mk-panel" role="complementary" aria-label="Mikata fact-check panel">
      <div class="mk-header">
        <div class="mk-brand">
          <div class="mk-brand-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><circle cx="13" cy="13" r="8" stroke="#467E6C" stroke-width="3.5"/><path d="m19 20 8 8" stroke="#467E6C" stroke-width="3.8" stroke-linecap="round"/><path d="m24 3 1 3M28 7l-3 1" stroke="#E9B96A" stroke-width="2.5" stroke-linecap="round"/></svg></div>
          <div><div class="mk-wordmark">mikata<span>.</span></div><div class="mk-subtitle">a little perspective goes a long way</div></div>
        </div>
        <button class="mk-close" id="mk-close" type="button" aria-label="Close Mikata">✕</button>
      </div>
      <div class="mk-body">
        <div class="mk-greeting">Let's look a little closer <span aria-hidden="true">✿</span></div>
        <div id="mk-mode" class="mk-mode">✦ Design preview · not verified</div>
        <div class="mk-card"><span class="mk-label">The claim</span><div class="mk-claim" id="mk-claim"></div></div>
        <div class="mk-status-card" id="mk-status" data-status="insufficient_evidence">
          <div class="mk-status-row"><div class="mk-status-icon" id="mk-status-icon">◌</div><div class="mk-status-title" id="mk-status-title">Taking a look...</div></div>
          <p class="mk-status-text" id="mk-status-text">Preparing your claim.</p>
        </div>
        <div class="mk-card"><span class="mk-label">The little details</span><p class="mk-detail" id="mk-detail">We're getting ready to explore the context.</p></div>
        <div class="mk-source-section"><div class="mk-section-title">☷ &nbsp;Where this comes from</div><div class="mk-sources" id="mk-sources"></div><div class="mk-source-empty" id="mk-no-sources">Live source links appear when your backend is connected.</div></div>
        <button class="mk-retry" id="mk-retry" type="button">↻ &nbsp; Check again</button>
        <div class="mk-footer">Mikata is a reading companion, not a final authority. Automated warnings are AI-assisted and may be wrong. Read sources before sharing.</div>
      </div>
    </aside>`;
  (document.body || document.documentElement).append(root);
  const $ = id => root.querySelector(`#${id}`);
  const bubble = $("mk-bubble");
  const panel = $("mk-panel");
  let savedSelection = "";
  let activeClaim = "";
  let requestNumber = 0;

  function refreshSelection() {
    if (panel.classList.contains("is-open")) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount || root.contains(selection.anchorNode)) {
      bubble.classList.remove("is-visible"); return;
    }
    const text = selection.toString().replace(/\s+/g, " ").trim();
    if (text.length < 12) { bubble.classList.remove("is-visible"); return; }
    savedSelection = text.slice(0, 1000);
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (!rect.width && !rect.height) { bubble.classList.remove("is-visible"); return; }
    bubble.style.left = `${Math.round(Math.min(window.innerWidth - 190, Math.max(12, rect.left)))}px`;
    bubble.style.top = `${Math.round(Math.max(8, Math.min(window.innerHeight - 51, rect.bottom + 12)))}px`;
    bubble.classList.add("is-visible");
  }

  document.addEventListener("mouseup", event => {
    if (!root.contains(event.target)) setTimeout(refreshSelection, 35);
  }, true);
  document.addEventListener("keyup", event => {
    if (event.key === "Shift" || event.key.startsWith("Arrow")) setTimeout(refreshSelection, 35);
  }, true);
  document.addEventListener("mousedown", event => {
    if (!root.contains(event.target)) bubble.classList.remove("is-visible");
  }, true);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") { closePanel(); bubble.classList.remove("is-visible"); }
  });

  function closePanel() { panel.classList.remove("is-open"); }
  $("mk-close").addEventListener("click", closePanel);
  bubble.addEventListener("mousedown", event => event.preventDefault());
  bubble.addEventListener("click", () => openClaim(savedSelection));
  $("mk-retry").addEventListener("click", () => openClaim(activeClaim));
  $("mk-toast-close").addEventListener("click", () => { $("mk-scan-toast").hidden = true; });

  const metadata = {
    supported: ["✓", "Looks supported"],
    needs_context: ["✦", "There's more context"],
    contradicted: ["!", "Evidence suggests otherwise"],
    insufficient_evidence: ["?", "Let's stay curious"],
    error: ["!", "Couldn't complete the check"]
  };

  function setStatus(status, summary, detail) {
    $("mk-status").dataset.status = status;
    $("mk-status-icon").textContent = metadata[status]?.[0] || "?";
    $("mk-status-title").textContent = metadata[status]?.[1] || "Let's stay curious";
    $("mk-status-text").textContent = summary;
    $("mk-detail").textContent = detail;
  }

  function renderSources(sources) {
    const list = $("mk-sources");
    list.replaceChildren();
    $("mk-no-sources").hidden = false;
    for (const source of Array.isArray(sources) ? sources : []) {
      try {
        const uri = new URL(source.url);
        if (uri.protocol !== "https:") continue;
        const anchor = document.createElement("a");
        anchor.className = "mk-source-link";
        anchor.href = uri.href;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.textContent = `${source.title} ↗`;
        list.append(anchor);
      } catch (_) { /* invalid link ignored */ }
    }
    $("mk-no-sources").hidden = list.childElementCount > 0;
  }

  function showCheckResult(result) {
    if (!result || result.error) {
      setStatus("error", result?.error || "Please refresh this page and try again.", "Check your Cloud Run connection in Mikata's toolbar popup.");
      $("mk-mode").textContent = "Connection issue";
      $("mk-no-sources").textContent = "No evidence was retrieved.";
      return;
    }
    $("mk-mode").textContent = result.demo ? "✦ Design preview · not verified" : "✿ Live AI-assisted assessment";
    $("mk-mode").classList.toggle("is-live", !result.demo);
    setStatus(result.status, result.summary, result.detail);
    renderSources(result.sources);
    if (result.demo) $("mk-no-sources").textContent = "Preview only. Connect a Cloud Run backend to check claims and retrieve sources.";
    else if (!result.sources?.length) $("mk-no-sources").textContent = "No cited sources returned. This claim is not verified.";
  }

  async function openClaim(text, existingResult = null) {
    const claim = String(text || "").replace(/\s+/g, " ").trim().slice(0, 1000);
    if (!claim) return false;
    requestNumber += 1;
    const myRequest = requestNumber;
    activeClaim = claim;
    $("mk-claim").textContent = `“${claim}”`;
    bubble.classList.remove("is-visible");
    panel.classList.add("is-open");
    $("mk-mode").textContent = existingResult ? "✿ Reviewing scanned claim" : "✦ Looking into the claim...";
    $("mk-mode").classList.remove("is-live");
    setStatus("insufficient_evidence", "Gathering the context...", "Mikata is preparing your result.");
    renderSources([]);
    $("mk-no-sources").textContent = "Sources appear here when a live check finds them.";
    $("mk-retry").disabled = true;
    try {
      const result = existingResult || await chrome.runtime.sendMessage({ type: "MIKATA_CHECK", claim, sourceUrl: location.href, sourceTitle: document.title });
      if (myRequest === requestNumber) showCheckResult(result);
    } catch (_) {
      if (myRequest === requestNumber) showCheckResult({ error: "Mikata couldn't reach its background service." });
    } finally { if (myRequest === requestNumber) $("mk-retry").disabled = false; }
    return true;
  }

  // --- Auto Scan: off by default, enabled individually for each website. ---
  const MAX_AUTO_CHECKS = 2; // A UI soft limit per tab load, NOT a billing cap.
  // TODO(COST): Enforce request quotas server-side, or one malicious client can
  // bypass this UI limit and spend the project's cloud credits.
  let scanEnabled = false;
  let autoRequestsUsed = 0; // Never reset on toggle; cap all automatic requests for this page load.
  let scanGeneration = 0;
  let scanStarted = false;
  let scanMarkers = [];
  let scanTimer = null;

  function showScanToast(message) {
    $("mk-toast-message").textContent = message;
    $("mk-scan-toast").hidden = !message;
  }

  function removeMarker(marker) {
    if (!marker?.isConnected) return;
    marker.replaceWith(document.createTextNode(marker.textContent));
  }

  function disableScan() {
    scanEnabled = false;
    scanGeneration++;
    scanStarted = false;
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = null;
    for (const marker of scanMarkers) removeMarker(marker.element);
    scanMarkers = [];
    showScanToast("");
  }

  // This is a *candidate detector*, NOT an offline model for detecting fake news.
  function scoreCandidate(sentence) {
    if (sentence.length < 30 || sentence.length > 280) return -1;
    if (!/[.!?。！？]$/.test(sentence)) return -1;
    if (/\b(i think|i believe|in my opinion|please click|sign up|subscribe|your cart|privacy policy)\b/i.test(sentence)) return -1;
    const test = sentence.toLowerCase();
    let score = 0;
    if (/\b(always|never|everyone|nobody|guarantee(?:s|d)?|cures?|prevents?|zero|all|none|impossible|proven|revolves|completely|100\s*%)\b/i.test(test)) score += 3;
    if (/\b\d+(?:\.\d+)?\s*(?:%|percent|million|billion|times|years|minutes|hours)(?!\w)/i.test(test)) score += 2;
    if (/\b(stud(?:y|ies)|research(?:ers)?|scientists?|reports?|survey|experts?|according to|data shows|found that|causes?|reduces?|increases?|improves?|results? in)\b/i.test(test)) score += 2;
    if (/\b(is|are|was|were|has|have|can|will|produces?|affects?|revolves)\b/i.test(test)) score += 1;
    return score >= 3 ? score : -1;
  }

  function findCandidates() {
    if (document.querySelector('input[type="password"]')) return []; // Avoid sign-in/account pages.
    const scope = document.querySelector("article, main, [role='main']") || document.body;
    if (!scope) return [];
    const found = [];
    const seen = new Set();
    let inspected = 0;
    // Inspect text in reading-oriented elements only. Never read inputs, editors, etc.
    for (const para of scope.querySelectorAll("p, blockquote, li")) {
      if (++inspected > 120) break;
      if (para.closest("nav, header, footer, aside, form, [contenteditable], [role='dialog'], #mikata-extension-root")) continue;
      if (para.querySelector("input, textarea, [contenteditable]")) continue;
      const walker = document.createTreeWalker(para, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (!node.parentElement || node.parentElement.closest("a, button, label, code, pre, script, style, noscript, svg, [contenteditable], #mikata-extension-root")) continue;
        const text = node.nodeValue || "";
        if (text.length < 30 || text.length > 1800) continue;
        const expression = /[^.!?。！？\n]+[.!?。！？]/g;
        let match;
        while ((match = expression.exec(text))) {
          const raw = match[0];
          const sentence = raw.trim().replace(/\s+/g, " ");
          const score = scoreCandidate(sentence);
          const key = sentence.toLowerCase();
          if (score < 0 || seen.has(key)) continue;
          const start = match.index + raw.indexOf(raw.trimStart());
          const end = match.index + raw.trimEnd().length;
          seen.add(key);
          found.push({ node, start, end, text: sentence, score });
        }
      }
    }
    const uniqueNodes = new Set();
    return found.sort((a, b) => b.score - a.score).filter(item => {
      if (uniqueNodes.has(item.node)) return false;
      uniqueNodes.add(item.node);
      return true;
    }).slice(0, MAX_AUTO_CHECKS);
  }

  function insertMarker(candidate) {
    if (!candidate.node.isConnected) return null;
    const range = document.createRange();
    range.setStart(candidate.node, candidate.start);
    range.setEnd(candidate.node, candidate.end);
    const marker = document.createElement("span");
    marker.className = "mikata-claim-highlight is-review";
    marker.setAttribute("role", "button");
    marker.tabIndex = 0;
    marker.setAttribute("aria-label", `Review this claim with Mikata: ${candidate.text}`);
    marker.title = "Mikata: this looks like a checkable claim (not yet verified). Click to explore.";
    marker.append(range.extractContents());
    range.insertNode(marker);
    const record = { element: marker, claim: candidate.text, result: null };
    const open = event => {
      event.stopPropagation();
      openClaim(record.claim, record.result);
    };
    marker.addEventListener("click", open);
    marker.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(event); }
    });
    scanMarkers.push(record);
    return record;
  }

  async function runScan(generation) {
    if (!scanEnabled || generation !== scanGeneration || scanStarted) return;
    scanStarted = true;
    const candidates = findCandidates();
    if (!scanEnabled || generation !== scanGeneration) return;
    const records = candidates.map(insertMarker).filter(Boolean);
    if (!records.length) {
      showScanToast("Mikata couldn't spot any strong checkable claims here.");
      return;
    }
    const { apiUrl = "" } = await chrome.storage.local.get("apiUrl");
    if (!scanEnabled || generation !== scanGeneration) return;
    if (!apiUrl) {
      showScanToast(`✦ ${records.length} claim${records.length > 1 ? "s" : ""} worth exploring · preview only`);
      return; // No API calls, and importantly no fake-news warning without evidence.
    }

    if (autoRequestsUsed >= MAX_AUTO_CHECKS) {
      showScanToast("✿ Auto-check limit reached for this page. Dotted phrases can still be checked manually.");
      return;
    }
    showScanToast(`✿ Checking up to ${MAX_AUTO_CHECKS - autoRequestsUsed} claim${MAX_AUTO_CHECKS - autoRequestsUsed > 1 ? "s" : ""} with sources...`);
    let warnings = 0;
    for (const record of records) {
      if (!scanEnabled || generation !== scanGeneration || autoRequestsUsed >= MAX_AUTO_CHECKS) break;
      autoRequestsUsed++;
      let result;
      try {
        result = await chrome.runtime.sendMessage({
          type: "MIKATA_CHECK", claim: record.claim, sourceUrl: location.href, sourceTitle: document.title
        });
      } catch (_) { result = { error: "The live check could not connect." }; }
      if (!scanEnabled || generation !== scanGeneration) break;
      record.result = result;
      // IMPORTANT: no warning for unverified preview content, no-source checks or errors.
      const evidence = !result?.demo && !result?.error && Array.isArray(result?.sources) && result.sources.length > 0;
      if (evidence && (result.status === "needs_context" || result.status === "contradicted")) {
        record.element.classList.remove("is-review");
        record.element.classList.add(result.status === "contradicted" ? "is-contradicted" : "is-context");
        const label = result.status === "contradicted" ? "evidence may contradict this" : "this may need context";
        record.element.title = `Mikata: ${label}. Click to read the AI-assisted assessment and sources.`;
        record.element.setAttribute("aria-label", `${label}. Click to review sources with Mikata.`);
        warnings++;
      } else {
        removeMarker(record.element);
      }
    }
    if (!scanEnabled || generation !== scanGeneration) return;
    showScanToast(warnings ? `✿ ${warnings} claim${warnings > 1 ? "s" : ""} may need a closer look. Tap the dotted underline.`
      : "✿ Scan finished · no source-backed warnings found.");
  }

  function enableScan() {
    if (scanEnabled) return;
    scanEnabled = true;
    const generation = ++scanGeneration;
    showScanToast("✿ Mikata is looking for checkable claims...");
    scanTimer = setTimeout(() => runScan(generation).catch(() => showScanToast("Mikata couldn't finish this scan.")), 650);
  }

  // Website permissions are managed from the popup and persisted in chrome.storage.local.
  const website = location.origin;
  chrome.storage.local.get("autoScanSites").then(({ autoScanSites = {} }) => {
    if (autoScanSites && autoScanSites[website] === true) enableScan();
  }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.autoScanSites) {
      const enabled = changes.autoScanSites.newValue?.[website] === true;
      if (enabled) enableScan(); else disableScan();
    }
    if (changes.apiUrl && scanEnabled) { // New endpoint or demo switch: re-evaluate the markers.
      disableScan();
      enableScan();
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "MIKATA_OPEN_SELECTION") {
      const text = window.getSelection()?.toString().trim() || savedSelection;
      if (text) { openClaim(text); sendResponse({ ok: true }); }
      else sendResponse({ ok: false, error: "Highlight a sentence on this page first." });
    }
    if (message?.type === "MIKATA_CHECK_TEXT") {
      if (message.text?.trim()) { openClaim(message.text); sendResponse({ ok: true }); }
      else sendResponse({ ok: false, error: "Please enter some text." });
    }
  });
})();
