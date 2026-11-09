# Local Mikata test checklist

## Before testing

- Unzip/open in VS Code. In Chrome, go to `chrome://extensions`, turn on Developer mode, click **Load unpacked**, select `extension/`.
- Reload the extension after JS/CSS changes, then refresh the webpage.
- Open `sample-article.html` through a local server: `python3 -m http.server 8000` at the project root; then browse to `http://localhost:8000/sample-article.html`.

## Extension UI

- [ ] Draft wordmark is visible in popup; no clipped text or ugly scaling.
- [ ] Popup opens with design-preview label when backend is unset.
- [ ] Highlight text over 12 characters; floating "Check with mikata" button appears.
- [ ] Clicking the button opens the sidebar and displays an explanatory design-preview result.
- [ ] Pasting a claim from popup opens the sidebar.
- [ ] Escape and close button dismiss sidebar; controls can be used with keyboard.
- [ ] No extension injection occurs on protected `chrome://` pages.

## Auto Scan

- [ ] Initially OFF on all sites; ON setting only affects the website on which it's enabled.
- [ ] In preview mode, detected claims get **neutral** dotted markers, not false/misleading labels.
- [ ] Turning OFF removes the markers without reloading.
- [ ] Live mode only shows an amber/rose warning when `needs_context` or `contradicted` is backed by cited sources.
- [ ] Error/no sources/supported results never trigger a misinformation warning.
- [ ] Repeated toggling does not break the document or make unlimited requests.
- [ ] Test on several pages with nested markup, forms, links, Japanese-language text, and a dynamically updated article. Record bugs.

## Backend, billing, security (once connected)

- [ ] `POST /check` with malformed/non-object JSON returns 400.
- [ ] Backend reports errors without logging or returning secrets.
- [ ] Gemini result has actual grounding metadata, usable source links and a cautious conclusion.
- [ ] No API key/service-account file is in repository or extension bundle.
- [ ] Cloud project billing alert or eligible spend-cap budget set, plus Cloud Run max instances.
- [ ] Confirm public endpoint restrictions/rate limits before widely sharing URL.
- [ ] Review actual cloud usage after demo and disable/clean up resources.

## Test honesty

Syntax/packaging checks are useful but **not** proof of in-Chrome end-to-end behavior. Mark a checkbox only after testing it in a real browser/cloud environment. Do not claim live fact-check accuracy until sources are checked by a person.
