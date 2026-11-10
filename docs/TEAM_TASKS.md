# Mikata — teammate task board

**Status:** Hackathon prototype / **not a production misinformation detector**. Take a task, write your initials/name beside it, create a branch, and open a small pull request. Do not commit directly over somebody else's in-progress work.

## Suggested split (priority order)

| Priority | Area / owner | File(s) to start with | Task | Definition of done |
| --- | --- | --- | --- | --- |
| **P0** | **UI / Design — ____** | `extension/popup.html`, `popup.css`, `content.css`, `design/` | Review 3 logo proposals and polish colors, button sizes, sidebar spacing | Popup looks legible in Chrome; image licensing recorded; toolbar icon still clear at 16px |
| **P0** | **AI / Backend — SourceLens backend implementation** | `backend/main.py`, `backend/requirements.txt` | Validate Gemini + Google Search grounding responses with a cloud account, with billing permission | Verified citations come from real results; failures return neutral uncertainty; no made-up URLs |
| **P0** | **Cloud / Security — ____** | `docs/SECURITY_AND_CREDITS.md`, `backend/` | Set up billing alerts/spend caps if available, least-privilege runtime identity, deployment access control | Costs are monitored, deployer knows demo endpoint risks, no real secrets in commits |
| **P0** | **Extension / Auto Scan — ____** | `extension/content.js`, `background.js` | Test Auto Scan with real news articles, stop duplicate checks, handle dynamic pages | Auto Scan is opt-in per site, only marks evidence-backed warnings and has no unsafe page changes |
| **P1** | **QA / Privacy — ____** | `docs/TEST_PLAN.md`, `sample-article.html` | Test permissions, private pages, keyboard navigation, error states, source links | All test cases documented; never frame heuristic candidate as falsehood |
| **P1** | **Presentation — ____** | `README.md`, `design/`, demo recording | Make 30–60 sec demo and slides; document actual Google technologies deployed | Claims match verified functionality; sources and AI usage documented |
| **P2** | **Firebase demo site — ____** | `landing/` | Create separate educational/demo site if two listed infrastructure services required | Real Firebase Hosting deployment, screenshot/URL evidence; do not count unless deployed |

> **Important:** Backend, Firebase, and Chrome deployment are independent things. Gemini is an AI API; it may not count as one of the hackathon's specifically listed hosting/deployment services. Verify the official rules instead of assuming it does.

## Current status (as packaged)

- **Implemented in code:** Toolbar popup, manual selection, floating button, result sidebar, design-preview samples, per-site Auto Scan toggle, heuristic candidate markers, optional Cloud Run request path.
- **Design proposal:** Draft image assets and a small draft logo in the popup; current Chrome icon remains unchanged.
- **Starter only:** Flask/Gemini backend in `backend/` — NOT deployed, NOT live-tested.
- **Not yet implemented:** Authentication, robust server-side rate limiting/spend controls, dedicated Firebase site, comprehensive browser tests, and production privacy disclosures.

## Good TODO labels to search in VS Code

`TODO(BRAND)`, `TODO(UI)`, `TODO(SCANNING)`, `TODO(PRIVACY)`, `TODO(API)`, `TODO(BACKEND)`, `TODO(SECURITY)`, `TODO(COST)`, `TODO(TESTS)`, `TODO(QUALITY)`.

VS Code → Search → `TODO(` will show handoff notes across the codebase.

## Coordination rules

1. Each person edits the file(s) for their task; communicate before touching overlapping CSS or `content.js`.
2. Never commit `.env`, tokens, service-account JSON, billing identifiers, or private user content. `.gitignore` helps but is **not** a guarantee. Inspect `git diff --staged`.
3. Avoid deploying a public Cloud Run API until the cloud owner has explicitly approved the risks. A web endpoint can receive requests even when the extension UI has a 2-check limit.
4. Keep new features off by default if they send user text to cloud services. Explicit user selections are also sensitive.
5. Use short, descriptive branches: `feat/auto-scan-quality`, `design/logo`, `fix/backend-timeout`, `docs/security`.
6. Any result with no evidence should be labeled `insufficient_evidence`, not `false`.

## SourceLens public-beta update

The backend owner has prepared a self-configuring extension release, Firebase end-user authentication, verified-email enforcement, durable named-Firestore quotas and release/deployment documentation. Local development remains available; public provisioning is pending owner approval. The resource/permission/cost proposal is in `deployment/PUBLIC_BETA.md`; no public deployment or Chrome Web Store publication is claimed. Controlled tests cover profile-isolated sessions and quota/model gates. The original packaged-starter status above is historical; source independence remains a prototype with explicit unresolved results.
