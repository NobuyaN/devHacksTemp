# Use SourceLens through the Mikata Chrome extension

The extension keeps the existing Mikata visual design. The backend provides live SourceLens research and inspectable source-provenance results inside its webpage sidebar. The dashboard is an optional second client.

## Install locally

1. Start the API as described in [backend/README.md](../backend/README.md). For local development its URL is `http://127.0.0.1:8080`.
2. In **Google Chrome**, open `chrome://extensions`.
3. Turn **Developer mode** on, then click **Load unpacked**.
4. Select this repository's **extension** folder, which contains `manifest.json`. Select the folder itself, not the whole repository.
5. Open Chrome's puzzle-piece Extensions menu and click **mikata — a little perspective**. Optionally pin it to the toolbar.
6. Expand **Connect your AI backend**, enter `http://127.0.0.1:8080`, and click **Save endpoint**.
7. Open or refresh a normal website, highlight a sentence of at least 12 characters, then click **Check with mikata**. The result opens in the webpage sidebar. The popup also supports pasting a claim.

Official Chrome installation steps: [load an unpacked extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).

If the extension was already loaded, click its reload button on `chrome://extensions`, then refresh the webpage. Backend reloads do not reload Chrome extension files. Chrome settings pages and the Chrome Web Store do not allow content injection.

## Reading results

- The factual verdict and source list appear in the existing result cards.
- Expand **Source independence** to inspect article counts, confirmed distinct origins, unresolved source counts, and supporting quotes/links for confirmed relationships.
- Multi-claim selections get separate collapsible claim results; no aggregate truth verdict is invented.
- Unresolved sources do not count as independent. Model suggestions are explicitly unverified. Distinct-origin verification records published methodology assertions, not a forensic audit of underlying participant data.
- Google Search attribution is preserved in isolated frames. Website CSP restrictions may prevent a frame from rendering; verify on the actual demo sites before distribution.

Keep Auto Scan off unless you deliberately want per-site automatic requests. It remains opt-in and limited to two claims per page load in the UI, which is not a billing cap. The local backend must remain running, and live requests can incur Google Cloud charges. Local development does not require a public cloud deployment.

## Speed and privacy

Claim extraction uses a lower-latency reasoning setting, backend model clients are reused, and the optional ambiguity-model pass is skipped when too few articles can be inspected. Grounded research and deterministic verification remain enabled. Simultaneous duplicate checks share a request; later checks perform fresh research. No persistent result cache was added. The displayed duration measures backend processing time; search and network latency vary.

Automated fixture and broker tests do not verify installation in a real Chrome profile. Run an interactive selection/popup/Auto Scan check after loading the extension.

## Research unavailable versus connection issue

**Research unavailable** means the extension reached the backend, but Google processing, credentials, capacity or request validation prevented a completed result. Follow the specific message. Temporary provider failures get one bounded automatic retry; persistent provider issues may still require waiting or a cloud administrator's quota/IAM review.

**Connection issue** means the request could not reach the saved endpoint or exceeded its browser timeout. Confirm that the local backend is running and the saved URL is `http://127.0.0.1:8080`. After extension code changes, reload its card on `chrome://extensions` and refresh the article page.

## What Auto Scan actually checks

Turn the per-site **Auto Scan** switch on in the popup while visiting an ordinary article page. It looks at up to 120 reading-oriented paragraph/list elements, heuristically selects up to two candidate sentences, and sends only those snippets for research when a backend is configured. English keyword/sentence heuristics miss many claims, especially text split across links, late-loading content and non-English articles. It is not a whole-page fact check or a background misinformation classifier.

Temporary dotted markers identify candidates. Cited `contradicted` results become rose warnings and cited `needs_context` results become amber warnings. Supported results, missing citations and errors remove the markers. Clicking a retained warning opens its already fetched result; switching the site off removes its markers. Reloading the page permits another pair of checks and therefore can incur additional charges.

Status messages now distinguish candidate absence, successful selected checks, insufficient evidence and failed requests. An empty page or “no warnings” does not prove the whole page accurate. Failed requests are shown as **Scan incomplete**.

The optional localhost dashboard on port **5000** is a second frontend for pasted text, image uploads and inspecting raw API/graph results. The local API on port **8080** serves both clients and must keep running for the extension. You do not need to open the dashboard to use the extension.

For provenance, expand **Source independence** to see each page's fetch status and failure reason. Grounding redirects may block automated retrieval; additional fetched publisher candidates are labeled separately and do not automatically count as independent. Zero inspected articles means article-level provenance was not checked; the factual assessment may still use Google grounding citations.

For a reproducible manual Auto Scan demonstration with the existing local dashboard server, open `http://127.0.0.1:5000/sample-article.html`, enable Auto Scan for that site, and refresh. This is a copy of the repository’s labeled sample article, not a real publication. With a backend configured, its selected sentences receive real research calls; no live result is fabricated. Preview mode displays neutral candidate markers only.
