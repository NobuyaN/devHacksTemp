# SourceLens backend handoff

SourceLens extends the repository's Flask + Vertex AI starter and preserves Mikata's `/check` contract and extension design. No OpenAI services or browser API keys are used. Existing contributor/security instructions still apply.

## Run from a fresh clone

Requires Python 3.13, Node 22+ (contract checks only), and Google Cloud CLI for live research. The web dashboard is plain HTML/JS and has no bundling step.

```sh
python3.13 -m venv backend/.venv
backend/.venv/bin/pip install --require-hashes -r backend/requirements.txt
npm ci
```

For tests, no Google account or credentials are needed. For real research, authenticate in your own environment (never copy credential files into this repo):

```sh
gcloud auth login
gcloud projects describe 261427009524 --format='value(projectId,projectNumber)'
export PROJECT_ID="$(gcloud projects describe 261427009524 --format='value(projectId)')"
gcloud auth application-default login
gcloud auth application-default set-quota-project "$PROJECT_ID"
export GOOGLE_CLOUD_PROJECT="$PROJECT_ID"
export GOOGLE_CLOUD_LOCATION=global
export GEMINI_MODEL=gemini-2.5-flash
export ALLOWED_ORIGINS=http://localhost:5000,http://127.0.0.1:5000
backend/.venv/bin/gunicorn --chdir backend --bind 127.0.0.1:8080 --workers 1 --threads 4 --timeout 55 main:app
```

In another terminal, preview the dashboard:

```sh
python3 -m http.server 5000 --directory landing
```

Open `http://localhost:5000`. It calls `http://localhost:8080/api/*` locally. On Firebase it calls same-origin `/api/*`, rewritten by `firebase.json` to `sourcelens-api` in `asia-northeast1`. Set the extension's existing **Connect your AI backend** field to `http://localhost:8080` or the approved Cloud Run URL; no manifest permissions change is required. Auto Scan remains opt-in.

`backend/.env.example` documents all runtime variables. `.env` is not automatically loaded; export values in the terminal. `PORT` defaults to 8080. Health reports configuration presence, not successful Vertex authentication.

## Architecture and data flow

1. `main.py` validates JSON, image signatures and sizes; enforces coarse per-process limits and two active research requests.
2. `research.py` uses Gemini on Vertex AI to extract at most three separate claims, including image input. Opinion/satire/unverifiable statements are marked non-checkable. Image bytes are passed as multimodal input, never fetched from a user URL.
3. Each checkable claim gets one grounded Gemini call (up to three in parallel). It requests primary and contradicting evidence. Only Google grounding chunks supply source URLs; model-authored URLs are ignored. Missing citation supports force `INSUFFICIENT_EVIDENCE`.
4. `inspection.py` normalizes/deduplicates discovery URLs and inspects up to six per claim concurrently. Redirect aliases are deduplicated after inspection. It records visible text, links, explicit attribution, canonical hints, publisher/date metadata and primary-study DOI metadata. Missing dates/publishers remain null. No scripts execute.
5. `dependencies.py` produces stable nodes/edges and documented attribution groups. Explicit attribution, syndication language, and artifact identifiers support confirmed edges, each with a quote and supporting URL. Similar text, canonical hints and different domains cannot establish dependency or independence. Overlapping text shingles produce an unresolved possible-duplication/syndication hint; they never merge origins or create confirmed dependency edges. Content hashes are hints only.
6. A narrow positive rule recognizes inspected primary studies documenting independent replication with new data, different DOI identities/authors, and a link to the inspected prior study. It counts only a mutually documented subset; A–B and B–C do not establish A–C. This is verification of published methodological statements, not forensic verification of raw data. Ambiguous relationships stay unresolved; a separate Gemini interpretation pass can add labeled unverified hypotheses to those pairs, but cannot change edges, counts or verification status. No LLM guess becomes a confirmed edge.
7. Factual assessment is returned separately from provenance counts. Counts never determine the verdict. Multi-claim inputs have no aggregate verdict; legacy fields are neutral.

A source may cite multiple origins and appear in multiple groups. Groups are overlapping documented relationships, not an assertion of exclusive dependence. An inaccessible origin URL can be a documented attribution target, but its contents are never invented. `confirmed_distinct_evidence_origins` can be zero even when several origins are documented. Positive original artifacts are listed in `confirmed_original_evidence`; attribution targets are in `evidence_origins`. Every target is represented by a source or origin ID. Per-pair unresolved relationships and unresolved source IDs are returned independently.

## API

- `GET /api/health`: liveness; no model call.
- `POST /api/check`: `{ "claim": "A factual proposition...", "source_title": "Optional page title" }`; `text` is also accepted. Claim length 8–2000; title up to 200. Page title is validated for legacy compatibility and is not evidence.
- `POST /check`: identical request/response with legacy fields preserved.
- `POST /api/analyze-image`: `{ "mime_type": "image/png", "image_base64": "BASE64_BYTES_WITHOUT_DATA_URL_PREFIX" }`. PNG/JPEG/WebP; decoded maximum 4 MiB; JSON maximum 6 MiB. No remote image URL input.

```sh
curl http://localhost:8080/api/health
curl -X POST http://localhost:8080/api/check \
  -H 'Content-Type: application/json' \
  -d '{"claim":"Electric vehicles produce zero emissions."}'
```

Response shape (illustrative schema example, **not a live verified result**):

```json
{
  "schema_version": "1.0",
  "claims": [{"id":"stable-id","text":"Example proposition","checkable":true,"reason":"Factual statement"}],
  "results": [{
    "claim": {"id":"stable-id","text":"Example proposition","checkable":true,"reason":"Factual statement"},
    "assessment":"INSUFFICIENT_EVIDENCE",
    "evidence_summary":"Adequately attributed evidence was not returned.",
    "explanation":"Grounded citations and relevant support are required.",
    "sources": [],
    "independence": {
      "total_articles_inspected":0,"confirmed_distinct_evidence_origins":0,
      "confirmed_original_evidence":[],"documented_origin_count":0,
      "confirmed_dependent_articles":0,"sources_with_unresolved_independence":[],
      "evidence_origins":[],"dependencies":[],"unresolved_relationships":[],"limitations":[]
    },
    "grounding": {}, "limitations": []
  }],
  "status":"insufficient_evidence","summary":"Adequately attributed evidence was not returned.",
  "detail":"Grounded citations and relevant support are required.","sources":[]
}
```

See `contracts/api.ts` for `Claim`, `FactCheckResult`, `EvidenceSource`, `SourceDependency`, `IndependenceAnalysis`, `ErrorResponse`, and envelope types. Assessment values: `SUPPORTED`, `CONTRADICTED`, `MIXED`, `INSUFFICIENT_EVIDENCE`, `NOT_FACT_CHECKABLE`. Legacy mapping: supported, contradicted, needs_context, insufficient_evidence (last two neutral assessments both map to insufficient_evidence).

Errors are `{ "error": "Readable message", "code": "INVALID_INPUT" }`: 400 invalid input, 413 oversized JSON, 429 rate limit (`Retry-After: 60`), 503 unavailable/busy/upstream timeout. No private model bodies are exposed or logged. Unknown routes/methods use structured HTTP errors. No persistence of selected text or uploaded images is implemented.

Grounding metadata is retained in full with original chunk indices, supports, web search queries, and `search_entry_point.rendered_content`. The dashboard and extension render Google Search suggestions inside isolated sandboxed frames without scripts; citations link to returned HTTPS sources. Extension brokerage preserves the full `results` array. Page CSP can block injected attribution frames; verify on demo pages. Review Google's required display terms before wider distribution: [grounding documentation](https://firebase.google.com/docs/ai-logic/grounding-google-search).

## Safety bounds and limitations

HTTPS/443 only; no credentials in URLs, private/reserved/link-local/loopback destinations, or automatic unchecked redirects. All DNS answers must be global; connections are pinned to a checked IP with original-host TLS verification. Every redirect is revalidated. Four-hop request cap, 750 KB response cap, identity encoding, 5-second article deadline, 1-second DNS wait, bounded resolver workers. Failed/unsupported/PDF/paywalled/JS-rendered sources remain unverified; authentication and access restrictions are not bypassed. Robots.txt is checked conservatively (404/410 means no declared policy; unavailable/disallowed policies leave the article unverified). Publisher licensing permissions still require review before broader crawling.

Extraction/discovery SDK requests have 16-second timeouts with one attempt; an optional ambiguity interpretation call per claim has a 6-second timeout; parallel claim research fits the Firebase 60-second proxy budget under normal operation. Client timeout is 55 seconds; pathological transport/platform delays can still cause a neutral timeout. Gemini can issue multiple internal searches in one grounded call: at most seven model calls per request (one extraction, up to three grounded searches and three optional ambiguity passes); provider internal searches are not a guaranteed search or dollar cap. Model text and website metadata may be malicious or inaccurate; explicit attribution rules do not prove a claim relevant, true, or independently audited. English attribution/replication rules miss other languages and many valid independent investigations. Source dates are reported, not used to invent causal chronology. No ambiguous relationship is promoted by Gemini.

Limits: six POST requests per remote address per minute, twelve globally per process, two active research requests, three claims, six articles per claim. Forwarded IP headers are not trusted, so proxy callers can share an IP quota. These are coarse demo guards; restarts/multiple instances reset counters, and Cloud Run instance limits are not spending caps. There is no authenticated user flow, durable quota or production abuse protection. Keep Cloud Run private until an explicitly approved, monitored demo; do not treat CORS as authentication.

## Tests and build

```sh
(cd backend && .venv/bin/python -m unittest discover -s tests -v)
node --test scripts/test_extension.mjs
npm run build
python3 scripts/smoke_check.py
backend/.venv/bin/pip check
# Optional container build when Docker is installed:
docker build -t sourcelens-api backend
```

Tests use only controlled inline example articles and mocked Vertex objects. They cover deduplication, shared report attribution, syndication, documented separate original evidence, inconclusive similarity/domains, inaccessible sources, SSRF/redirect/body bounds, image multiple-claim extraction, missing grounding, invalid requests, rate limits, and sanitized upstream errors. Passing fixtures is not evidence of real-world verification accuracy. `npm run build` checks strict TypeScript contracts and JS syntax; HTML/JS dashboard needs no bundler. Python is runtime-tested and syntax-checked, not statically typed.

To refresh dependencies intentionally (review the diff):

```sh
backend/.venv/bin/pip install pip-tools==7.6.2
backend/.venv/bin/pip-compile --generate-hashes --output-file backend/requirements.txt backend/requirements.in
```

`requirements.txt` pins transitive dependencies with hashes. `package-lock.json` pins TypeScript. The Docker base is Python 3.13 slim; pin its approved image digest for a byte-identical production base.

## Cloud preflight — read-only, required before deployment

The supplied project number is **261427009524**. Its project ID has **not been confirmed in this development environment** (Google Cloud CLI unavailable). Do not guess the project ID or use the number as a Firebase alias. After installing official Cloud/Firebase CLIs, run:

```sh
gcloud auth list --filter=status:ACTIVE --format='value(account)'
gcloud config list
gcloud projects describe 261427009524 --format='yaml(projectId,projectNumber,lifecycleState)'
export PROJECT_ID="$(gcloud projects describe 261427009524 --format='value(projectId)')"
gcloud projects get-iam-policy "$PROJECT_ID"
gcloud services list --enabled --project "$PROJECT_ID"
gcloud billing projects describe "$PROJECT_ID"
firebase projects:list
```

Have the cloud owner verify the account, billing account/credit eligibility and expiry, model/location availability, quotas, active services, IAM policies, and org restrictions. Billing alerts do not cap spending. Do not enable services, change billing/IAM, or publish until the user approves those specific changes.

IAM handoff (grant only as needed, with approval):

- Runtime: dedicated `sourcelens-runtime` service account, `roles/aiplatform.user`; no Owner/Editor or service-account keys.
- Source deployer: `roles/run.sourceDeveloper`, `roles/serviceusage.serviceUsageConsumer`, and `roles/iam.serviceAccountUser` scoped to the runtime identity. Additional service-policy permissions are required to make a service public.
- Build identity: dedicated build service account with `roles/run.builder`. Deployer needs actAs on that identity if selecting it; account-specific additional permissions may be required by org policy. Confirm the actual Cloud Build identity; do not blindly grant the default identity Editor.
- Firebase deployer: `roles/firebasehosting.admin`; project read access and Cloud Run read/update permissions as required for revision pinning.
- Administrator only when provisioning: service enablement (`roles/serviceusage.serviceUsageAdmin`), service-account creation and scoped IAM-policy administration. Billing changes require billing-account authority separately.

Reference: [source deployment roles](https://docs.cloud.google.com/run/docs/deploying-source-code), [build service identity](https://docs.cloud.google.com/run/docs/configuring/services/build-service-account).

## Deployment commands — approval required, not executed

After preflight and explicit approval for billable API enablement, runtime/build identity creation, IAM grants and deployment, an administrator provisions the two identities and minimum roles above. Provisioning commands for the approved administrator (replace `DEPLOYER_EMAIL` with the verified teammate account; do not run until approved):

```sh
export DEPLOYER_EMAIL=teammate@example.com
gcloud iam service-accounts create sourcelens-runtime --project "$PROJECT_ID"
gcloud iam service-accounts create sourcelens-build --project "$PROJECT_ID"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:sourcelens-runtime@${PROJECT_ID}.iam.gserviceaccount.com" --role=roles/aiplatform.user
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:sourcelens-build@${PROJECT_ID}.iam.gserviceaccount.com" --role=roles/run.builder
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="user:${DEPLOYER_EMAIL}" --role=roles/run.sourceDeveloper
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="user:${DEPLOYER_EMAIL}" --role=roles/serviceusage.serviceUsageConsumer
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="user:${DEPLOYER_EMAIL}" --role=roles/firebasehosting.admin
gcloud iam service-accounts add-iam-policy-binding "sourcelens-runtime@${PROJECT_ID}.iam.gserviceaccount.com" --project "$PROJECT_ID" --member="user:${DEPLOYER_EMAIL}" --role=roles/iam.serviceAccountUser
gcloud iam service-accounts add-iam-policy-binding "sourcelens-build@${PROJECT_ID}.iam.gserviceaccount.com" --project "$PROJECT_ID" --member="user:${DEPLOYER_EMAIL}" --role=roles/iam.serviceAccountUser
```

The deployer making a service public also needs `run.services.setIamPolicy` through an appropriately scoped admin role; do not grant project-wide Owner/Editor. Commands below assume the approved identities exist:

```sh
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com aiplatform.googleapis.com firebasehosting.googleapis.com \
  --project "$PROJECT_ID"
export RUNTIME_SA="sourcelens-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
export BUILD_SA="sourcelens-build@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud run deploy sourcelens-api --source backend \
  --project "$PROJECT_ID" --region asia-northeast1 \
  --service-account "$RUNTIME_SA" --build-service-account "projects/${PROJECT_ID}/serviceAccounts/${BUILD_SA}" \
  --no-allow-unauthenticated --max-instances 1 --min-instances 0 \
  --concurrency 4 --timeout 55 --memory 512Mi --cpu 1 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=global,GEMINI_MODEL=gemini-2.5-flash"
export API_URL="$(gcloud run services describe sourcelens-api --project "$PROJECT_ID" --region asia-northeast1 --format='value(status.url)')"
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" "$API_URL/api/health"
```

Private Cloud Run will not accept anonymous extension requests or the public Firebase rewrite. Only after explicit public-demo approval and acceptance of the current coarse abuse controls:

```sh
gcloud run services add-iam-policy-binding sourcelens-api \
  --project "$PROJECT_ID" --region asia-northeast1 \
  --member=allUsers --role=roles/run.invoker
firebase deploy --only hosting --project "$PROJECT_ID"
```

Firebase must already be attached to the **same verified project** with a default Hosting site; initialize that through the approved Firebase console if missing. `--project` makes an unverified `.firebaserc` unnecessary. `firebase.json` is committed and pins the Cloud Run revision using `pinTag`. Deploy backend first, Hosting second; redeploy Hosting to move its pin after a later backend release. [Firebase Cloud Run rewrite documentation](https://firebase.google.com/docs/hosting/cloud-run).

Verify the actual published dashboard by submitting a low-cost test, inspecting `/api/check` in browser Network, opening citation links, checking Search suggestions and provenance quotes, and confirming Cloud Run logs contain no private content. Test the extension separately with the returned Cloud Run URL. No deployment, authenticated live Gemini check, billing/model eligibility check, or interactive Chrome/dashboard test has been performed here. Docker is unavailable here, so the container image build is also pending.
