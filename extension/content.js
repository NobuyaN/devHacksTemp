// Mikata manual selection and fact-check sidebar.
// Page scripts cannot synthesize paid highlight or retry clicks.
(() => {
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
        <div class="mk-source-section"><div class="mk-section-title">☷ &nbsp;Where this comes from</div><div class="mk-sources" id="mk-sources"></div><div class="mk-source-empty" id="mk-no-sources">Live source links appear when your backend is connected.</div></div>
        <button class="mk-retry" id="mk-retry" type="button">↻ &nbsp; Check again</button>
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
  bubble.addEventListener("click", event => { if (event.isTrusted) openClaim(savedSelection); });
  $("mk-retry").addEventListener("click", event => { if (event.isTrusted) openClaim(activeClaim); });

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

  function renderProvenance(results) {
    root.querySelector("#mk-provenance")?.remove();
    if (!Array.isArray(results) || !results.length) return;
    const section = document.createElement("div");
    section.id = "mk-provenance";
    const add = (tag, text, parent = section) => {
      const element = document.createElement(tag);
      element.textContent = text;
      parent.append(element);
      return element;
    };
    const link = (parent, text, url) => {
      try {
        if (new URL(url).protocol !== "https:") return;
        const anchor = add("a", text, parent);
        anchor.href = url; anchor.target = "_blank"; anchor.rel = "noopener noreferrer";
        anchor.className = "mk-source-link";
      } catch (_) { /* invalid citation omitted */ }
    };
    for (const result of results) {
      const details = add("details", "");
      details.className = "mk-card";
      add("summary", results.length > 1 ? result.claim?.text || "Extracted claim" : "Source independence", details);
      if (results.length > 1) {
        add("p", `${result.assessment || "INSUFFICIENT_EVIDENCE"}: ${result.evidence_summary || ""}`, details);
        for (const source of result.sources || []) link(details, source.title, source.url);
      }
      const graph = result.independence;
      if (!graph) continue;
      add("p", `${graph.total_articles_inspected || 0} articles inspected. ${graph.confirmed_distinct_evidence_origins || 0} confirmed distinct evidence origins. ${(graph.sources_with_unresolved_independence || []).length} sources with unresolved independence.`, details);
      add("p", "Unresolved sources do not count as independent. Published methodology statements are not a raw-data audit.", details);
      if (!graph.total_articles_inspected) add("p", "Article-level provenance could not be checked. The verdict above is based on grounded search, not verified independent origins.", details);
      add("p", `${graph.documented_origin_count || 0} documented attribution targets; ${graph.confirmed_dependent_articles || 0} articles with confirmed attribution.`, details);
      for (const source of result.sources || []) {
        const row = add("div", "", details);
        link(row, source.title || source.url, source.resolved_url || source.url);
        add("p", source.inspection_status === "inspected"
          ? (source.discovery_method === "research_candidate" ? "Fetched publisher candidate · not a grounding attribution or independence proof" : "Page fetched · independence still requires provenance evidence")
          : `Unverified: ${source.inspection_error || "Page could not be inspected"}`, row);
      }
      if (result.inspection_summary) {
        const reasons = Object.entries(result.inspection_summary.failure_reasons || {}).map(([reason, count]) => `${count} ${reason.replaceAll("_", " ").toLowerCase()}`);
        if (reasons.length) add("p", `Inspection limits: ${reasons.join("; ")}.`, details);
      }
      for (const edge of graph.dependencies || []) {
        const relationship = add("details", "", details);
        add("summary", `${edge.relationship_type.replaceAll("_", " ")} · ${edge.verification_status}`, relationship);
        add("p", edge.evidence, relationship);
        link(relationship, "Inspect supporting source ↗", edge.supporting_source_url);
        link(relationship, "Referenced source ↗", edge.target_url);
      }
      for (const relationship of graph.unresolved_relationships || []) {
        if (relationship.model_hypothesis) add("p", `Unverified model suggestion: ${relationship.model_hypothesis}`, details);
      }
    }
    $("mk-sources").after(section);
  }

  function showCheckResult(result) {
    if (!result || result.error) {
      const signInNeeded = ["AUTH_REQUIRED", "INVALID_SESSION", "EMAIL_NOT_VERIFIED"].includes(result?.code);
      const reachedBackend = result?.backend_reached !== false && result?.code && !["NETWORK_ERROR", "REQUEST_TIMEOUT"].includes(result.code);
      setStatus("error", result?.error || "Please refresh this page and try again.", signInNeeded ? "Open the extension popup to sign in or refresh your verified session." : reachedBackend
        ? "The extension reached your backend, but the research could not finish."
        : "Check that your backend is running and its saved endpoint is correct.");
      $("mk-mode").textContent = signInNeeded ? "Sign in required" : reachedBackend ? "Research unavailable" : "Connection issue";
      $("mk-no-sources").textContent = "No evidence was retrieved.";
      return;
    }
    $("mk-mode").textContent = result.demo ? "✦ Design preview · not verified" : "✿ Live AI-assisted assessment";
    $("mk-mode").classList.toggle("is-live", !result.demo);
    if (!result.demo && Number.isFinite(result.processing_ms)) $("mk-mode").textContent += ` · ${(result.processing_ms / 1000).toFixed(1)}s`;
    if (Number.isFinite(result.quota?.remaining)) $("mk-mode").textContent += ` · ${result.quota.remaining} checks left today`;
    setStatus(result.status, result.summary, result.detail);
    renderSources(result.sources);
    renderProvenance(result.results);
    document.getElementById("mk-search-attribution")?.remove();
    const attribution = document.createElement("div");
    attribution.id = "mk-search-attribution";
    for (const item of result.results || []) {
      const html = item.grounding?.search_entry_point?.rendered_content;
      if (typeof html !== "string" || !html) continue;
      const frame = document.createElement("iframe");
      frame.title = "Google Search suggestions";
      frame.setAttribute("sandbox", "allow-popups allow-popups-to-escape-sandbox");
      frame.style.cssText = "width:100%;min-height:180px;border:0";
      frame.srcdoc = html;
      attribution.appendChild(frame);
    }
    $("mk-sources").after(attribution);
    if (result.demo) $("mk-no-sources").textContent = "Preview only. Connect a Cloud Run backend to check claims and retrieve sources.";
    else if (!result.sources?.length) $("mk-no-sources").textContent = "No cited sources returned. This claim is not verified.";
  }

  async function openClaim(text) {
    const claim = String(text || "").replace(/\s+/g, " ").trim().slice(0, 1000);
    if (!claim) return false;
    requestNumber += 1;
    const myRequest = requestNumber;
    activeClaim = claim;
    $("mk-claim").textContent = `“${claim}”`;
    bubble.classList.remove("is-visible");
    panel.classList.add("is-open");
    $("mk-mode").textContent = "✦ Looking into the claim...";
    $("mk-mode").classList.remove("is-live");
    setStatus("insufficient_evidence", "Gathering the context...", "Mikata is preparing your result.");
    renderSources([]);
    renderProvenance([]);
    root.querySelector("#mk-search-attribution")?.remove();
    $("mk-no-sources").textContent = "Sources appear here when a live check finds them.";
    $("mk-retry").disabled = true;
    try {
      const result = await chrome.runtime.sendMessage({ type: "MIKATA_CHECK", claim, sourceUrl: location.href, sourceTitle: document.title });
      if (myRequest === requestNumber) showCheckResult(result);
    } catch (_) {
      if (myRequest === requestNumber) showCheckResult({ error: "Mikata couldn't reach its background service." });
    } finally { if (myRequest === requestNumber) $("mk-retry").disabled = false; }
    return true;
  }

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
