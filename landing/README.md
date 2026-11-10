# Mikata dashboard

A separate static dashboard for text/image research, source cards, inspectable relationship evidence, raw graph data and Google Search attribution. The existing extension design is preserved.

Run `python3 -m http.server 5000 --directory landing` from the repository root with the API on port 8080. See [backend setup and deployment](../backend/README.md). `firebase.json` serves this directory and rewrites `/api/**` to the approved Cloud Run service in the same project.

Firebase Hosting configuration is implemented; actual publication and live verification are pending project/account confirmation and explicit deployment approval. This site makes no background AI requests: submitting the form sends text/image data to Google Cloud.
