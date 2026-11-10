// Mikata manual selection and fact-check sidebar.
// Page scripts cannot synthesize paid highlight or retry clicks.
(() => {
  const I = globalThis.MikataI18n;
  const tr = (key, values) => I.t(key, values);
  if (document.getElementById("mikata-extension-root")) return;

  const root = document.createElement("div");
  root.id = "mikata-extension-root";
  root.innerHTML = `
    <button class="mk-bubble" id="mk-bubble" type="button" aria-label="Check selected text with Mikata">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/></svg>
      Check with mikata <span aria-hidden="true">✦</span>
    </button>
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
        <div class="mk-source-section"><div class="mk-section-title">☷ &nbsp;<span>Where this comes from</span></div><div class="mk-sources" id="mk-sources"></div><div class="mk-source-empty" id="mk-no-sources">Live source links appear when your backend is connected.</div></div>
        <button class="mk-retry" id="mk-retry" type="button">↻ &nbsp; <span>Check again</span></button>
        <div class="mk-footer">Mikata is a reading companion, not a final authority. AI-assisted assessments may be wrong. Read sources before sharing.</div>
      </div>
    </aside>`;
  (document.body || document.documentElement).append(root);
  const $ = id => root.querySelector(`#${id}`);
  const bubble = $("mk-bubble");
  const panel = $("mk-panel");
  let savedSelection = "";
  let activeClaim = "";
  let requestNumber = 0;
  let lastResult = null;
  let working = false;
  const languageControl = document.createElement("div");
  languageControl.className = "mk-language-control";
  root.querySelector(".mk-header").after(languageControl);
  I.mountSwitch(languageControl);
  I.bind(root);
  I.onChange(() => {
    if (lastResult) showCheckResult(lastResult);
    else if (working) {
      setStatus("insufficient_evidence", "Gathering the context...", "Mikata is preparing your result.");
      $("mk-mode").textContent = tr("✦ Looking into the claim...");
    }
  });

  function refreshSelection() {
    if (panel.classList.contains("is-open")) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount || root.contains(selection.anchorNode)) {
      bubble.classList.remove("is-visible"); return;
    }
    const text = selection.toString().replace(/\s+/g, " ").trim();
    if (text.length < 8) { bubble.classList.remove("is-visible"); return; }
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
  bubble.addEventListener("click", event => { if (event.isTrusted) openClaim(savedSelection); });
  $("mk-retry").addEventListener("click", event => { if (event.isTrusted) openClaim(activeClaim); });

  const metadata = {
    supported: ["✓", "Looks supported"],
    needs_context: ["✦", "There's more context"],
    contradicted: ["!", "Evidence suggests otherwise"],
    insufficient_evidence: ["?", "Let's stay curious"],
    error: ["!", "Couldn't complete the check"]
  };

  function setStatus(status, summary, detail, originalText = false) {
    $("mk-status").dataset.status = status;
    $("mk-status-icon").textContent = metadata[status]?.[0] || "?";
    $("mk-status-title").textContent = tr(metadata[status]?.[1] || "Let's stay curious");
    $("mk-status-text").textContent = originalText ? summary : tr(summary);
    $("mk-detail").textContent = originalText ? detail : tr(detail);
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

  function renderProvenance(results) {
    root.querySelector("#mk-provenance")?.remove();
    if (!Array.isArray(results) || !results.length) return;
    const section = document.createElement("div");
    section.id = "mk-provenance";
    const add = (tag, text, parent = section) => {
      const element = document.createElement(tag);
      element.textContent = tr(text);
      parent.append(element);
      return element;
    };
    const link = (parent, text, url, translateLabel = false) => {
      try {
        if (new URL(url).protocol !== "https:") return;
        const anchor = add("a", "", parent);
        anchor.textContent = translateLabel ? tr(text) : text;
        anchor.href = url; anchor.target = "_blank"; anchor.rel = "noopener noreferrer";
        anchor.className = "mk-source-link";
      } catch (_) { /* invalid citation omitted */ }
    };
    for (const result of results) {
      const details = add("details", "");
      details.className = "mk-card";
      const heading = add("summary", results.length > 1 ? "" : "Source independence", details);
      if (results.length > 1) heading.textContent = result.claim?.text || tr("Extracted claim");
      if (results.length > 1) {
        add("p", `${tr(result.assessment || "INSUFFICIENT_EVIDENCE")}: ${result.evidence_summary || ""}`, details);
        for (const source of result.sources || []) link(details, source.title, source.url);
      }
      const graph = result.independence;
      if (!graph) continue;
      add("p", tr("{articles} articles inspected. {origins} confirmed distinct evidence origins. {unresolved} sources with unresolved independence.", {articles: graph.total_articles_inspected || 0, origins: graph.confirmed_distinct_evidence_origins || 0, unresolved: (graph.sources_with_unresolved_independence || []).length}), details);
      add("p", "Unresolved sources do not count as independent. Published methodology statements are not a raw-data audit.", details);
      if (!graph.total_articles_inspected) add("p", "Article-level provenance could not be checked. The verdict above is based on grounded search, not verified independent origins.", details);
      add("p", tr("{targets} documented attribution targets; {articles} articles with confirmed attribution.", {targets: graph.documented_origin_count || 0, articles: graph.confirmed_dependent_articles || 0}), details);
      for (const source of result.sources || []) {
        const row = add("div", "", details);
        link(row, source.title || source.url, source.resolved_url || source.url);
        add("p", source.inspection_status === "inspected"
          ? (source.discovery_method === "research_candidate" ? "Fetched publisher candidate · not a grounding attribution or independence proof" : "Page fetched · independence still requires provenance evidence")
          : tr("Unverified: {reason}", {reason: I.inspection(source)}), row);
      }
      if (result.inspection_summary) {
        const reasons = Object.entries(result.inspection_summary.failure_reasons || {}).map(([reason, count]) => `${count} ${I.language === "ja" ? tr(reason) : reason.replaceAll("_", " ").toLowerCase()}`);
        if (reasons.length) add("p", tr("Inspection limits: {reasons}.", {reasons: reasons.join("; ")}), details);
      }
      for (const edge of graph.dependencies || []) {
        const relationship = add("details", "", details);
        add("summary", `${I.language === "ja" ? tr(edge.relationship_type) : edge.relationship_type.replaceAll("_", " ")} · ${tr(edge.verification_status)}`, relationship);
        add("p", "", relationship).textContent = edge.evidence;
        link(relationship, "Inspect supporting source ↗", edge.supporting_source_url, true);
        link(relationship, "Referenced source ↗", edge.target_url, true);
      }
      for (const relationship of graph.unresolved_relationships || []) {
        if (relationship.model_hypothesis) add("p", tr("Unverified model suggestion: {hypothesis}", {hypothesis: relationship.model_hypothesis}), details);
      }
    }
    $("mk-sources").after(section);
  }

  function showCheckResult(result) {
    lastResult = result;
    if (!result || result.error) {
      const signInNeeded = ["AUTH_REQUIRED", "INVALID_SESSION", "EMAIL_NOT_VERIFIED"].includes(result?.code);
      const reachedBackend = result?.backend_reached !== false && result?.code && !["NETWORK_ERROR", "REQUEST_TIMEOUT"].includes(result.code);
      setStatus("error", result?.error ? I.error(result) : tr("Please refresh this page and try again."), signInNeeded ? "Open the extension popup to sign in or refresh your verified session." : reachedBackend
        ? "The extension reached your backend, but the research could not finish."
        : "Check that your backend is running and its saved endpoint is correct.");
      $("mk-mode").textContent = tr(signInNeeded ? "Sign in required" : reachedBackend ? "Research unavailable" : "Connection issue");
      $("mk-no-sources").textContent = tr("No evidence was retrieved.");
      return;
    }
    $("mk-mode").textContent = tr(result.demo ? "✦ Design preview · not verified" : "✿ Live AI-assisted assessment");
    $("mk-mode").classList.toggle("is-live", !result.demo);
    if (!result.demo && Number.isFinite(result.processing_ms)) $("mk-mode").textContent += ` · ${(result.processing_ms / 1000).toFixed(1)}s`;
    if (Number.isFinite(result.quota?.remaining)) $("mk-mode").textContent += ` · ${tr("{count} checks left today", {count: result.quota.remaining})}`;
    setStatus(result.status, result.demo ? tr(result.summary) : result.summary, result.demo ? tr(result.detail) : result.detail, true);
    if ((result.language || "en") !== I.language) $("mk-detail").textContent += " " + tr("Results stay in their original language. Check again to request this language (uses one check).");
    renderSources(result.sources);
    renderProvenance(result.results);
    document.getElementById("mk-search-attribution")?.remove();
    const attribution = document.createElement("div");
    attribution.id = "mk-search-attribution";
    for (const item of result.results || []) {
      const html = item.grounding?.search_entry_point?.rendered_content;
      if (typeof html !== "string" || !html) continue;
      const frame = document.createElement("iframe");
      frame.title = tr("Google Search suggestions");
      frame.setAttribute("sandbox", "allow-popups allow-popups-to-escape-sandbox");
      frame.style.cssText = "width:100%;min-height:180px;border:0";
      frame.srcdoc = html;
      attribution.appendChild(frame);
    }
    $("mk-sources").after(attribution);
    if (result.demo) $("mk-no-sources").textContent = tr("Preview only. Connect a Cloud Run backend to check claims and retrieve sources.");
    else if (!result.sources?.length) $("mk-no-sources").textContent = tr("No cited sources returned. This claim is not verified.");
  }

  async function openClaim(text, requestedLanguage) {
    await I.ready;
    const language = ["en", "ja"].includes(requestedLanguage) ? requestedLanguage : I.language;
    const claim = String(text || "").replace(/\s+/g, " ").trim().slice(0, 1000);
    if (!claim) return false;
    lastResult = null;
    working = true;
    requestNumber += 1;
    const myRequest = requestNumber;
    activeClaim = claim;
    $("mk-claim").textContent = `“${claim}”`;
    bubble.classList.remove("is-visible");
    panel.classList.add("is-open");
    $("mk-mode").textContent = tr("✦ Looking into the claim...");
    $("mk-mode").classList.remove("is-live");
    setStatus("insufficient_evidence", "Gathering the context...", "Mikata is preparing your result.");
    renderSources([]);
    renderProvenance([]);
    root.querySelector("#mk-search-attribution")?.remove();
    $("mk-no-sources").textContent = tr("Sources appear here when a live check finds them.");
    $("mk-retry").disabled = true;
    try {
      const result = await chrome.runtime.sendMessage({ type: "MIKATA_CHECK", claim, language, sourceUrl: location.href, sourceTitle: document.title });
      if (myRequest === requestNumber) showCheckResult(result);
    } catch (_) {
      if (myRequest === requestNumber) showCheckResult({ error: "Mikata couldn't reach its background service." });
    } finally { if (myRequest === requestNumber) { working = false; $("mk-retry").disabled = false; } }
    return true;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "MIKATA_OPEN_SELECTION") {
      const text = window.getSelection()?.toString().trim() || savedSelection;
      if (text) { openClaim(text, message.language); sendResponse({ ok: true }); }
      else sendResponse({ ok: false, error: "Highlight a sentence on this page first." });
    }
    if (message?.type === "MIKATA_CHECK_TEXT") {
      if (message.text?.trim()) { openClaim(message.text, message.language); sendResponse({ ok: true }); }
      else sendResponse({ ok: false, error: "Please enter some text." });
    }
  });
})();
