# mikata. みかた — a little perspective goes a long way

A warm, cozy **Chrome Manifest V3 extension starter** for highlighting and exploring claims, with opt-in per-site Auto Scan. Designed for a hackathon demo.

> **Team handoff / v0.3:** This ZIP is ready to open in VS Code and commit. First read [TEAM_TASKS](docs/TEAM_TASKS.md), [SECURITY_AND_CREDITS](docs/SECURITY_AND_CREDITS.md), [BRAND_GUIDE](docs/BRAND_GUIDE.md), and [CONTRIBUTING](CONTRIBUTING.md). The new popup logo is **a proposal, not a final brand asset**. The backend is **not deployed or authenticated**, and **the project is not production-ready**.

## What's working right now

- A friendly popup, sage-and-cream color palette, and custom extension icon. **New: proposed hand-drawn logo in the popup**, plus original/refined sketches in `design/` (the toolbar icon has not changed).
- **NEW: Auto Scan toggle** in the toolbar popup, **off by default** and saved separately for each website.
- Auto Scan examines article-like paragraphs and suggests **up to two checkable sentences per page** with gentle sage dotted underlines. This *heuristic claim detection is not itself a misinformation detector*.
- In design preview, **no automatic AI requests or misinformation warnings** are made: underlines mean “worth exploring.”
- With a backend configured, Auto Scan sends at most **two claims per page load** for AI-assisted assessment. It changes underlines to amber/rose warnings **only** for `needs_context` or `contradicted` results that include cited sources. Other underlines are removed.
- Clicking a warning displays its existing result and citations in the sidebar (without repeating the backend request).
- Turning Auto Scan off immediately removes the markers for that site.
- Highlight at least 12 characters on an ordinary webpage; a floating **Check with mikata ✦** button appears.
- Click it to open a polished evidence sidebar, complete with verdict colors, summary, details and source slots.
- Toolbar popup also lets you check selected text, paste a claim, or try a sample.
- Clearly labeled **design preview** when there is no backend. Three canned examples demonstrate the UI only; arbitrary text is **not fact-checked** in preview mode.
- Optional Google Cloud Run + Vertex AI Gemini backend under `backend/`, for live checks with Google Search grounding and returned source links.

## Install on Chrome now (no cloud, no build step)

1. Download the project and **unzip** it.
2. In Google Chrome, open `chrome://extensions`.
3. Turn on **Developer mode** (upper right).
4. Select **Load unpacked** and choose the **`extension`** folder (the folder containing `manifest.json`), **not** the outer `mikata-project` folder.
5. Open or refresh a normal `https://` webpage, then highlight a sentence. Click **Check with mikata ✦**.
6. To see a prepared example, highlight exactly: `Electric vehicles produce zero emissions.`
7. Click the **Mikata toolbar icon → Auto Scan switch** to opt in on this website. This enables soft dotted claim markers; turning it off removes them.
8. The popup still supports manual selection, pasted text, and sample claims.

**Note:** It cannot inject into `chrome://` pages, Chrome Web Store pages, or some protected browser screens. Refresh open tabs after installing or reloading the extension.

## Local test webpage

To test with our styled sample page:

```sh
cd mikata-project
python3 -m http.server 8000
```

Then browse to `http://localhost:8000/sample-article.html`. Open Mikata’s popup, enable **Auto Scan** for localhost and look for dotted underlines on the article sentences. With no backend, they indicate checkable claims only. You can also highlight text and check it manually.

## Optional: connect Google Cloud Run + Vertex AI Gemini

**You do not need to do this just to work on the visuals.** Only do this when the team is ready for a live demo. The server uses your Cloud Run service account, not a browser-side API key. Enable Vertex AI and billing on your Google Cloud project.

With Google Cloud CLI installed and authenticated, from the `backend/` directory:

```sh
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com aiplatform.googleapis.com

gcloud run deploy mikata-api \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --max-instances 1 \
  --set-env-vars GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GOOGLE_CLOUD_LOCATION=global,GEMINI_MODEL=gemini-2.5-flash
```

You may need to grant the **Vertex AI User** role to the service account running your service and Cloud Run build permissions to the builder service account. Cloud Run will print a URL like `https://mikata-api-...a.run.app`.

Click Mikata in Chrome > **Connect your AI backend** > paste the Cloud Run URL > **Save endpoint**. On the next check, the extension sends the highlighted claim to `POST /check` using the extension service worker. Only a successfully grounded response provides citations; a result without cited sources gets an **Insufficient evidence** label.

### Important hackathon / budget cautions

- **Auto Scan adds API costs!** Each enabled page load can trigger up to two Gemini + Google Search grounded fact checks. Switch it off when you are not testing. Limits in the extension are not a hard cloud billing cap.


- Google Cloud promotional credits do not automatically guarantee all API and model costs are covered; check your project billing and model eligibility.
- An `--allow-unauthenticated` endpoint is public. **Not publicizing its URL does not secure it.** Anyone who finds it can consume quota. Do NOT use it for uncontrolled public deployment; add server-side auth/abuse protection and quotas. `--max-instances 1` is **not** a dollar cap.
- Set Cloud Billing **budget alerts**. Alerts-only budgets do not hard-stop spending. On eligible services/projects, check whether **spend-cap budgets** are available; enforcement can lag. See `docs/SECURITY_AND_CREDITS.md`.
- The backend has not been deployed or live-tested against Vertex AI in this package; credentials, permissions, models, costs and Google Cloud configuration vary by project.
- Google Search grounding is helpful but not a truth oracle. These judgments are **AI-assisted assessments**. Review citations carefully.

## Folder map

```
mikata-project/
  extension/
    manifest.json       Chrome extension definition
    popup.html/css/js    Friendly toolbar popup
    content.js/css      Highlight button + results panel on webpages
    background.js       Demo result or Cloud Run request
    icons/              Generated PNG icon assets
  backend/
    main.py             Optional Flask API, Gemini + Search grounding
    Dockerfile
    requirements.txt
    .env.example        Safe placeholder config (not credentials)
  design/               Original team sketch + refined LOGO PROPOSALS
  landing/              Firebase landing page TODO (not implemented)
  docs/                 Team tasks, security/credits, brand, and testing guide
  scripts/smoke_check.py    Basic structural checks
  .gitignore            Basic secret/caches exclusion (still review commits!)
  CONTRIBUTING.md       GitHub teamwork / commit steps
  sample-article.html   Local design/testing page
  README.md             This guide
```

## Privacy and security details

- Mikata runs on normal HTTP(S) pages to detect text selections. **Auto Scan is disabled by default, and opt-in applies only to the website where you switched it on**. The extension keeps an allowlist of enabled site origins in local extension storage.
- When Auto Scan is enabled, local code examines at most 120 paragraph/list elements in the primary reading area. It does **not** read input fields, rich text editors or password pages. Only chosen claim snippets are considered for a check; it does not send the entire article.
- Without a backend, Auto Scan **never** sends the scanned sentences to a remote service, nor does it label them as misleading. With a backend, it sends **up to two shortlisted sentences per page load**, each with the webpage title (not the full page URL), to the Cloud Run API. Site-by-site scanning will repeat after reloading the page.
- Automatic warnings are not a guarantee that a claim is false. They only appear for a cited AI-assisted result classified as needing context or contradicted; cited sources may still be incorrect or irrelevant.
- When you explicitly click check, the selected claim and page title are passed to the background service; with a backend configured, those fields are sent to Cloud Run/Google services. The full page URL is NOT sent to the backend in this handoff (it may contain tokens). Avoid using it with private/confidential text.
- The extension stores **only** the backend URL and the enabled-site allowlist (not highlights or results) in Chrome local extension storage.
- DOM text is inserted with `textContent`, not unsanitized HTML; source links are limited to HTTPS.
- Source quality, prompt injection from text, and accuracy should be evaluated before publishing a production extension.

## Color palette

- Warm paper `#FBF9F3`
- Deep sage `#336952`
- Mint `#DFEEE2`
- Honey `#E9B764`
- Soft amber `#FFF0D9`
- Dusty rose `#F9E7E4`

**Credit:** Mikata (見方 = perspective / 味方 = ally) is a working name. Check Chrome Web Store naming/trademark availability before publishing.

## Auto Scan test checklist

1. Reload the unpacked extension at `chrome://extensions`, then refresh the sample webpage.
2. Open the popup. **Auto Scan** should be **off** initially.
3. Switch it on. After a short pause, sample text should show gentle sage dotted underlines and a little bottom-corner notice.
4. Click a dotted phrase. With no backend, the panel must clearly say **Design preview · not verified**. It must NOT display a red/amber misinformation warning *in the page itself*.
5. Turn Auto Scan off. Underlines and the scan notice should disappear immediately.
6. Optional live integration: set a Cloud Run endpoint, enable Auto Scan, and verify that **only** a returned `needs_context`/`contradicted` result **with citations** becomes an amber/rose warning. `supported`, errors, and insufficient-evidence responses must not produce page warnings.
7. Try a different website. Its switch should initially be off, even if Auto Scan is enabled for the sample website.

**Testing status:** JavaScript syntax and file/package structure checked for this handoff. Interactive Chrome end-to-end behavior and real Gemini/Cloud Run results have not been verified here; run these steps before demoing.

## Team contribution + static checks

Open this directory in VS Code. Before pushing to the team's GitHub repository, read `CONTRIBUTING.md`, agree on who owns which TODOs in `docs/TEAM_TASKS.md`, and run:

```sh
python3 scripts/smoke_check.py
node --check extension/popup.js
node --check extension/background.js
node --check extension/content.js
```

The tests check structure/syntax only; they **do not** verify live Chrome behavior, cloud costs, or Gemini correctness.
