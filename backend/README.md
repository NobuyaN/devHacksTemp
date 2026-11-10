# Mikata backend handoff

Mikata extends the repository's Flask + Vertex AI starter and preserves Mikata's `/check` contract and extension design. No OpenAI services or browser API keys are used. Existing contributor/security instructions still apply.

## Run from a fresh clone

Requires Python 3.13, Node 22.13+ or 24+ (contract and DOM checks only), and Google Cloud CLI for live research. The web dashboard is plain HTML/JS and has no bundling step.

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
export GEMINI_MODEL=gemini-3.5-flash
export ALLOWED_ORIGINS=http://localhost:5000,http://127.0.0.1:5000
backend/.venv/bin/gunicorn --chdir backend --bind 127.0.0.1:8080 --workers 1 --threads 4 --timeout 55 main:app
```

In another terminal, preview the dashboard:

```sh
python3 -m http.server 5000 --bind 127.0.0.1 --directory landing
```

Open `http://127.0.0.1:5000`. It calls `http://localhost:8080/api/*` locally. On Firebase it calls same-origin `/api/*`, rewritten by `firebase.json` to `sourcelens-api` in `asia-northeast1`. Set the extension's existing **Connect your AI backend** field to `http://localhost:8080` or the approved Cloud Run URL; no manifest permissions change is required. Auto Scan remains opt-in.

`backend/.env.example` documents all runtime variables. `.env` is not automatically loaded; export values in the terminal. `PORT` defaults to 8080. Health reports configuration presence, not successful Vertex authentication.

## Architecture and data flow

1. `main.py` validates JSON, image signatures and sizes; enforces coarse per-process limits and two active research requests.
2. `research.py` uses Gemini on Vertex AI to extract at most three separate claims, including image input. Opinion/satire/unverifiable statements are marked non-checkable. Image bytes are passed as multimodal input, never fetched from a user URL.
3. Each checkable claim gets one grounded Gemini call (up to three in parallel). It requests primary and contradicting evidence. Only Google grounding chunks supply factual citation URLs. The same response can propose at most two direct publisher URLs as separate inspection candidates; these are not grounding attributions and are not promoted into the evidence graph unless their actual page can be fetched. Unknown candidate URLs are omitted, and failed candidates are summarized by failure reason without being presented as evidence sources. Missing citation supports force `INSUFFICIENT_EVIDENCE`.
4. `inspection.py` normalizes/deduplicates discovery URLs and attempts up to eight pages per claim concurrently (at most six grounding sources and two direct publisher candidates). Redirect aliases are deduplicated after inspection. It records visible text, links, explicit attribution, canonical hints, publisher/date metadata and primary-study DOI metadata. Missing dates/publishers remain null. No scripts execute.
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
  "processing_ms": 0,
  "claims": [{"id":"stable-id","text":"Example proposition","checkable":true,"reason":"Factual statement"}],
  "results": [{
    "claim": {"id":"stable-id","text":"Example proposition","checkable":true,"reason":"Factual statement"},
    "assessment":"INSUFFICIENT_EVIDENCE",
    "timings_ms": {},
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

The legacy `sources` field contains only grounding citations; structured per-claim `sources` also includes successfully fetched publisher candidates labeled `discovery_method: research_candidate`. A fetched candidate establishes page availability, not claim relevance, grounding attribution, origin identity or independence. `inspection_summary` reports bounded attempts, fetched pages, candidate pages inspected and categorized failure reasons.

Grounding metadata is retained in full with original chunk indices, supports, web search queries, and `search_entry_point.rendered_content`. The dashboard and extension render Google Search suggestions inside isolated sandboxed frames without scripts; citations link to returned HTTPS sources. Extension brokerage preserves the full `results` array. Page CSP can block injected attribution frames; verify on demo pages. Review Google's required display terms before wider distribution: [grounding documentation](https://firebase.google.com/docs/ai-logic/grounding-google-search).

## Safety bounds and limitations

HTTPS/443 only; no credentials in URLs, private/reserved/link-local/loopback destinations, or automatic unchecked redirects. All DNS answers must be global; connections are pinned to a checked IP with original-host TLS verification. Every redirect is revalidated. Four-hop request cap, 750 KB response cap, identity encoding, 5-second article deadline, 1-second DNS wait, bounded resolver workers. Failed/unsupported/PDF/paywalled/JS-rendered sources remain unverified; authentication and access restrictions are not bypassed. Robots.txt is checked conservatively (404/410 means no declared policy; unavailable/disallowed policies leave the article unverified). Publisher licensing permissions still require review before broader crawling.

Extraction/discovery SDK attempts share total stage budgets of 10 seconds for extraction and 22 seconds for search, with at most one delayed retry for HTTP 429/500/502/503/504; an optional ambiguity interpretation call per claim has a 6-second timeout; parallel claim research fits the Firebase 60-second proxy budget under normal operation. Client timeout is 55 seconds; pathological transport/platform delays can still cause a neutral timeout. Gemini can issue multiple internal searches in one grounded call: at most eleven model attempts per request including bounded retries (two extraction attempts, up to six grounded-search attempts and three optional ambiguity calls); provider internal searches are not a guaranteed search or dollar cap. Model text and website metadata may be malicious or inaccurate; explicit attribution rules do not prove a claim relevant, true, or independently audited. English attribution/replication rules miss other languages and many valid independent investigations. Source dates are reported, not used to invent causal chronology. No ambiguous relationship is promoted by Gemini.

Limits: six POST requests per authenticated user (remote address in local mode) per minute, twelve globally per process, two active research requests, three claims, six grounding articles plus two publisher candidates per claim. Forwarded IP headers are not trusted. These in-memory guards supplement the public-mode Firebase authentication and atomic Firestore daily quotas described below; they reset on process restarts. Cloud Run instance limits and request quotas are not spending caps. The shared beta still needs monitoring and stronger abuse controls before a larger commercial rollout; CORS is not authentication.

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

The supplied project number **261427009524** was confirmed as project ID **saladmanderdevhacks** using a read-only Cloud CLI check. Vertex AI and billing were confirmed enabled. Credit eligibility and deployment IAM still require review. Do not use the project number as a Firebase alias. To repeat preflight with your own account, run:

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

## Deployment — use the authenticated public-beta runbook

The local backend is still compatible with the existing `/check` contract. A Cloud Run deployment now requires Firebase authentication and durable quota reservations; it cannot start with `AUTH_MODE=local` or emulator bypass settings. Do not use the old unauthenticated starter deployment command for a shared service.

Use [deployment/PUBLIC_BETA.md](../deployment/PUBLIC_BETA.md) for the concrete resources, least-privilege IAM, service configuration, named quota database, Auth-only client key, release packaging and deployment commands. [deployment/public.env.yaml](../deployment/public.env.yaml) declares the deployed runtime limits. Future billable changes, public releases and Store publication require the owner's explicit approval.

Public release users do not install CLIs or run localhost services. Their browser package includes the shared endpoint and Mikata account sign-in. Local development remains opt-in with a manually configured endpoint. Firebase/Firestore authentication and hosted research have been live-tested; interactive Chrome installation and email verification remain a manual release check. Controlled fixtures do not establish model accuracy.

## Model availability troubleshooting

The original starter used `gemini-2.5-flash`, which returned Vertex 404 in this project. The default and examples now use `gemini-3.5-flash`; a controlled live extraction was verified against this project. An existing `GEMINI_MODEL` environment variable overrides the default, so export the replacement and restart an already running backend. See [Google model lifecycle](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-versions). `MODEL_UNAVAILABLE` and `CLOUD_AUTH_ERROR` distinguish model/access failures without exposing provider bodies, tokens or input text.

## Extension-first use and latency

The Chrome extension is a direct client of `/check` and does not need the dashboard. Follow [extension/README.md](../extension/README.md) to load it unpacked and set `http://127.0.0.1:8080` as the local endpoint. Keep the API running. The sidebar preserves the existing design and adds collapsible provenance details, per-claim results for multi-claim selections, confirmed edge quotes/links, unresolved source counts and explicitly unverified model suggestions.

Latency improvements retain the grounded search, article inspection limits and deterministic verifier:

- Claim extraction uses `MINIMAL` thinking only for the known-compatible `gemini-3.5-flash`; grounded factual research retains its model reasoning configuration. Other model overrides retain their default extraction configuration.
- The optional relationship interpretation call is skipped unless at least two sources were successfully inspected. Failed pages provide no article text to interpret. Deterministic provenance still runs in all cases.
- At most two initialized Vertex clients are reused through an idle pool, avoiding fresh client/auth/connection setup on every request. Each active request borrows its own client; this stores no claim results.
- Simultaneous identical extension requests share one pending HTTP request. Once completed, the pending entry is removed; later checks run fresh research. There is no result cache or persistence of selections.
- The response includes `processing_ms`, and each result includes `timings_ms` for grounded search, source inspection and provenance analysis. The extension shows backend processing duration after completion. These timings are measurements, not guarantees of later performance.

Search/provider latency and accessible-site response times still vary. Fewer independent sources are never invented to make a response appear faster. Google documents thinking-level latency tradeoffs in its [Gemini 3.5 Flash guide](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-3-5-flash).

A controlled local `/check` request after these changes completed in 11,808 ms with six grounding source URLs (grounded search 7,863 ms, source inspection 1,325 ms). This single observation is not a latency guarantee or verification-accuracy benchmark; inaccessible articles remain unresolved.

## Intermittent provider failures

A successful local API connection can still be followed by a Google provider failure. The extension now displays such errors as **Research unavailable**, separately from a failed network connection. It preserves the backend's safe error code rather than adding a misleading connection-failure prefix.

Extraction and grounded search each retry at most once after a randomized 1–1.5 second delay for transient Google HTTP 429, 500, 502, 503 or 504. Retry-After values that exceed the remaining stage budget prevent an immediate retry; date-based Retry-After values are conservatively left to a later user request. SDK-level retries remain disabled to avoid nested retry multiplication. Authentication, permission, invalid-request and missing-model failures are never retried. Transport timeouts are not retried automatically. A retry can incur an additional API charge and does not guarantee recovery or quota availability.

Exhausted capacity/server failures return `PROVIDER_RATE_LIMITED` or `PROVIDER_UNAVAILABLE` with HTTP 503 and `Retry-After: 30`. HTTP 400 is `RESEARCH_REQUEST_REJECTED`; authentication/model errors keep their existing codes. Provider bodies and selected text are not exposed. Google recommends bounded backoff for transient capacity failures: [Vertex API errors](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/models/api-errors).

A later controlled extraction plus grounded-search diagnostic succeeded in 10.4 seconds, but the preceding user-reported failure was not reproduced, so its original provider status remains unknown. Passing a later request does not establish that intermittent failures cannot recur.

## Why grounding can show zero inspected articles

A live read of `https://vertexaisearch.cloud.google.com/robots.txt` showed `Disallow: /grounding-api-redirect` and `Disallow: /grounding-redirect`. Grounding citations commonly use that Google redirect service. The fetcher respects this policy; it does not follow those URLs by bypassing robots rules. Such nodes now expose `ROBOTS_DISALLOWED` and a readable reason instead of a generic failure.

Direct NASA URLs were retrievable in a controlled diagnostic. Large pages, PDF-only sources, inaccessible robots policies, bot walls and timeouts can still prevent inspection. The grounded research response now additionally requests exact direct publisher candidates; titles for promoted candidates come from fetched HTML, not model guesses. Failed/unknown/duplicate candidates are not counted as inspected or independent. Original grounding links/indices/Search suggestions are retained separately. Candidate retrieval is bounded and SSRF protections apply unchanged.

Positive independence remains narrow: the current rule requires inspected primary-study metadata and a published independent-replication/new-data statement linked to the other inspected study. This is not broad verification of independent authorship, reporting or datasets. Different domains, reachable pages, separate DOI links and model suggestions still do not establish independence. The system should not be advertised as a generally validated independent-source detector. A confirmed dependency based on a quote/link is a more attainable result for news articles; unresolved is an explicit limitation, not a hidden independent-source vote.

Run `npm run test:extension` for the broker and DOM fixture tests. DOM tests simulate per-site enablement, two-check limits, preview behavior, source-backed warning clicks, supported results, missing citations, failed requests and password-page exclusion; they do not replace an interactive test in the user's real Chrome profile.

Live retrieval validation after the candidate change: a controlled Earth-orbit grounded search returned six grounding sources and one direct candidate; NASA’s `Earth Fact Sheet` at `https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html` was actually fetched and inspected. This verifies publisher retrieval for that page only. No independent-origin conclusion was inferred from availability. A prior diagnostic hit a provider deadline; source access and model response times remain variable.

## Public authentication and durable quotas

`access.py` verifies Firebase ID tokens for the configured project, checks revocation/user-disabled state and requires verified email. `AUTH_MODE=firebase` enables it locally for integration testing; Cloud Run forces this mode. Research POST routes are gated before model construction. `AUTH_REQUIRED`/`INVALID_SESSION` use 401, `EMAIL_NOT_VERIFIED` uses 403, and exhausted daily quotas use 429. Verification/storage failures fail closed with 503 and never start an AI request. The public `/api/health` reports whether authentication is required without exposing tokens or account data.

`QUOTA_DATABASE` defaults to the isolated named Firestore database `sourcelens`. `DAILY_USER_LIMIT=100` and `DAILY_GLOBAL_LIMIT=100` are the deployed beta limits. Two document counters are read and incremented in one transaction before AI work. UTC day boundaries are returned in `quota.resets_at`; successful responses include the remaining per-user allowance. Requests reserved before an eventual provider failure still count. Quota calls have a bounded caller wait; late commits can consume an allowance without starting research. In-process rate/concurrency guards supplement this durable limit and are not the global budget mechanism.

The quota store contains hashed identifiers, counts and an expiration timestamp, not selected text, images or article bodies. Client Firestore rules deny all reads/writes; the runtime's IAM condition scopes its database access. Configure TTL before public deployment; a timestamp alone does not enable deletion. Firebase Authentication stores the user account separately. Account verification/password reset/deletion are initiated by the user; controlled tests do not send emails or create accounts.

The extension calls Firebase Auth REST endpoints directly, stores sign-in tokens/email in trusted session storage, and sends tokens only to the pinned release API. Passwords are not saved. No remote SDK code is loaded into the extension. A public Firebase Auth API identifier is permitted in the release; it must be restricted to Authentication/Token services and must not be a Gemini/Vertex credential. See [Firebase API keys](https://firebase.google.com/docs/projects/api-keys) and [Firebase token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens).

Public request processing duration includes server-side authentication and quota verification. Caller-side token refresh and network transit are not part of that server measurement. Synthetic webpage clicks cannot trigger paid highlight/retry research; privileged popup messages and trusted user gestures still work, and opening an already fetched warning does not repeat research.


## Shared beta deployment record (2026-11-10)

The approved Cloud Run backend and Firebase Hosting are deployed. Users install from https://saladmanderdevhacks.web.app/install.html and create a verified Mikata account; no Google Cloud tools or local server are required. See [the deployment runbook](../deployment/PUBLIC_BETA.md) for rebuild/deploy commands and actual live validation. Public distribution is a ZIP for Load unpacked, not a Chrome Web Store listing.

Publisher connections prefer checked public IPv4 addresses and try at most two checked addresses within the existing five-second deadline. This avoids selecting an unreachable IPv6 address first on Cloud Run. All DNS results must still be public; every redirect and robots policy is checked. No dependency or independence conclusion follows from reachability alone.


## Recovery from transient Google research errors

The deployed main model is `GEMINI_MODEL=gemini-3.5-flash`; `GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite` configures a second Gemini model for the existing single retry. The fallback is optional: omit/blank it to retry the main model as before. Use a model compatible with the request's Search grounding and thinking settings; the deployed pair was tested in this project. No competing LLM API or client API key is used.

Extraction and grounded search retain their 10/22-second total stage budgets. With a fallback configured, the first call is capped at 6/14 seconds, leaving time for one delayed fallback attempt. HTTP 429/500/502/503/504 and transport timeouts are eligible; permanent permission/configuration errors are not retried. Retry-After and remaining stage time still gate retries. No extra attempt is added, so the existing model-attempt and server-side quota bounds remain. A fallback cannot guarantee recovery if both Google models are unavailable.

Grounded research explicitly uses LOW thinking on the tested 3.5 Flash/Flash-Lite pair; extraction keeps its guarded MINIMAL setting. Source inspection, citation adequacy checks and deterministic independence rules are unchanged. A fallback response without adequate grounding remains insufficient evidence. Stage/model/attempt/status failures are logged without prompts, images, model response bodies, tokens or email. Exhausted transport deadlines return a sanitized `PROVIDER_UNAVAILABLE` with Retry-After.

References: [Google API errors](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/models/api-errors), [thinking settings](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/thinking).
