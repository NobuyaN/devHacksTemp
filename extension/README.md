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

Checks start only when you explicitly submit highlighted or pasted text. The local backend must remain running, and live requests can incur Google Cloud charges. Local development does not require a public cloud deployment.

## Speed and privacy

Claim extraction uses a lower-latency reasoning setting, backend model clients are reused, and the optional ambiguity-model pass is skipped when too few articles can be inspected. Grounded research and deterministic verification remain enabled. Simultaneous duplicate checks share a request; later checks perform fresh research. No persistent result cache was added. The displayed duration measures backend processing time; search and network latency vary.

Automated fixture and broker tests do not verify installation in a real Chrome profile. Run an interactive selection/popup check after loading the extension.

## Research unavailable versus connection issue

**Research unavailable** means the extension reached the backend, but Google processing, credentials, capacity or request validation prevented a completed result. Follow the specific message. Temporary provider failures get one bounded automatic retry; persistent provider issues may still require waiting or a cloud administrator's quota/IAM review.

**Connection issue** means the request could not reach the saved endpoint or exceeded its browser timeout. Confirm that the local backend is running and the saved URL is `http://127.0.0.1:8080`. After extension code changes, reload its card on `chrome://extensions` and refresh the article page.

## Manual checks only

Auto Scan was removed in version 0.3.1. The extension does not inspect article paragraphs or start research when a page loads. Legacy per-site scanning preferences are ignored. Highlight a factual sentence or paste a claim in the popup to start research. Refresh existing tabs after updating so the old content script stops running.

The optional localhost dashboard on port **5000** is a second frontend for pasted text, image uploads and inspecting raw API/graph results. The local API on port **8080** serves both clients and must keep running for the extension. You do not need to open the dashboard to use the extension.

For provenance, expand **Source independence** to see each page's fetch status and failure reason. Grounding redirects may block automated retrieval; additional fetched publisher candidates are labeled separately and do not automatically count as independent. Zero inspected articles means article-level provenance was not checked; the factual assessment may still use Google grounding citations.

## Shared release versus developer folder

The source `extension/` folder keeps developer/preview defaults. A fresh Chrome profile does not inherit another profile's endpoint setting or session. For public users, distribute the artifact produced by `scripts/build_public.py` after the shared service is deployed; do not distribute the unconfigured developer folder and expect it to connect automatically.

The release contains the approved shared API origin and a public Firebase Auth identifier, hides developer endpoint controls, and works without a local server. Users create/sign into SourceLens, verify their email and refresh the session. Their account does not grant access to the operator's Google Cloud project. Research requires an explicit manual check. Sign-in tokens/email live only in trusted browser-session storage; passwords and results are not persisted. Closing the browser can require signing in again. Sign-out, verification resend, password reset and account deletion are available in the popup; deletion may require recent sign-in.

The backend verifies project/signature/expiry, revocation and email status and enforces durable user/global quotas before research. Modifying the extension or calling the API directly cannot bypass those server checks. A packaged endpoint overrides old per-profile developer settings; tokens are never sent to a user-supplied endpoint override. A failed public configuration reports an error rather than silently returning a design-preview verdict.

See [public beta deployment plan](../deployment/PUBLIC_BETA.md). A ZIP loaded through Developer mode is the initial beta distribution; Chrome Web Store submission and approval are separate. The shared service is deployed. Controlled fixtures cover account handling; interactive multi-profile Chrome checks remain a manual QA step.
