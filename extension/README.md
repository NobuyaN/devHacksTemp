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
