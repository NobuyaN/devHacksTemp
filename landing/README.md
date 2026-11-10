# Mikata dashboard

A separate static dashboard for text/image research, source cards, inspectable relationship evidence, raw graph data and Google Search attribution. The existing extension design is preserved.

Run `python3 -m http.server 5000 --directory landing` from the repository root with the API on port 8080. See [backend setup and deployment](../backend/README.md). `firebase.json` serves this directory and rewrites `/api/**` to the approved Cloud Run service in the same project.

Firebase Hosting configuration is implemented; actual publication and live verification are pending project/account confirmation and explicit deployment approval. This site makes no background AI requests: submitting the form sends text/image data to Google Cloud.


The English / 日本語 switch is saved for this website in local storage. It updates the controls and requests the chosen language for new research. Existing generated results retain their original text. For local development, `landing/i18n.js` must match the canonical `extension/i18n.js`; `scripts/smoke_check.py` verifies the mirror. No remote translation script is loaded.
