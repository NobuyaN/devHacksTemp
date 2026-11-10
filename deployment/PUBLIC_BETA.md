# SourceLens shared public beta

The owner approved provisioning and public deployment on 2026-11-10. The existing project `saladmanderdevhacks` was verified as number `261427009524`. Firebase Authentication, the Tokyo named Firestore database and quota TTL, dedicated service accounts, the Auth-only public API key, Cloud Run and Firebase Hosting have been provisioned. This is a monitored beta, not a Chrome Web Store release or an unlimited commercial service.

- Install: https://saladmanderdevhacks.web.app/install.html
- Dashboard: https://saladmanderdevhacks.web.app/
- API health through Hosting: https://saladmanderdevhacks.web.app/api/health
- Direct backend: https://sourcelens-api-6gj6yd2pfq-an.a.run.app
- Released package/build configuration: `build/public-manual-v0.3.1` (generated, Git-ignored). Rebuild from source and a build-local public Auth config; do not rely on that local directory being present in a teammate's clone.

The first regional routing initialization took about ten minutes after the container became ready. Do not publish a new installation link until both the health check and a hosted signed request pass.

## What changes for users

Users install a release package with the shared endpoint already configured, create a **SourceLens** email/password account, verify email, and check selected text. They do not install CLIs, authenticate to your cloud account, enter a project ID or run a server. Each Chrome profile has its own sign-in session; the service address is packaged rather than stored manually per profile. The current extension supports manual checks only; Auto Scan was removed in version 0.3.1.

The initial distribution is a downloadable ZIP that users load unpacked. Chrome Web Store submission, developer-account review and publication remain separate approvals. Do not call this package a published store extension.

## Resources and limits

- Existing Google project, with the additional APIs below enabled.
- Firebase linked to that project; one SourceLens Web app; email/password Firebase Authentication with verified-email enforcement in the backend.
- A **new dedicated Auth-only public Web API key**, restricted to Identity Toolkit and Secure Token APIs. Never use a Gemini/Vertex key in a client bundle. Do not change a shared existing key's restrictions and break other apps.
- Cloud Run `sourcelens-api`, `asia-northeast1`, one maximum instance, zero minimum instances, concurrency 4, 55-second service timeout, 512 MiB/1 CPU. It is network-accessible, but every research route verifies Firebase ID tokens, revocation and email verification **before** reserving quota or calling Gemini.
- Dedicated runtime and build service accounts. Runtime: Vertex AI User, Firebase Authentication Viewer (revocation/user checks), and Datastore User conditioned on the isolated `sourcelens` database. Builder: Cloud Run Builder. No service-account keys.
- Named Firestore Native database **`sourcelens`**, Tokyo. It holds only daily hashed-user and global counters, not claims or images. Client rules deny all access; server IAM permits the runtime. Atomic transactions enforce **100 requests per verified user per UTC day** and **100 requests across the entire beta per UTC day**, including reserved requests that later fail. Model requests never start when quota storage fails.
- Counter TTL configured for `expires_at`, scheduled after 30 days; actual deletion can lag. A late transaction can consume quota after a client-visible timeout without starting an AI request.
- Firebase Hosting serves the optional dashboard, sample article, install/privacy pages, release ZIP and `/api/**` rewrite to Cloud Run. No customer uses localhost.

These are request limits, **not a dollar cap**. Cloud Run, builds/artifact storage, Firebase Authentication, Firestore operations and Vertex/search can incur charges. Signing up many accounts cannot exceed the shared AI-request limit, but anonymous HTTP traffic and authentication/quota checks can still consume infrastructure resources. Credit eligibility/expiry and billing alerts must be reviewed by the owner. The beta is not an unlimited or fully abuse-hardened commercial release. Larger rollout needs measured costs and additional abuse controls.

## Preflight — read only

```sh
gcloud auth list --filter=status:ACTIVE --format='value(account)'
gcloud projects describe saladmanderdevhacks --format='yaml(projectId,projectNumber,lifecycleState)'
gcloud billing projects describe saladmanderdevhacks
gcloud services list --enabled --project saladmanderdevhacks
firebase projects:list
```

Confirm the account, existing resources, project, credits and approved settings. The current Firebase CLI and gcloud accounts match. Resource-creation, Auth/key management, Hosting-site update, rules and TTL checks were allowed. Source-object upload permission is not established by the project-scoped check; verify it on the actual Cloud Run staging bucket and, if needed, grant only scoped upload access to that bucket as part of the approved setup. Do not replace an existing team's Hosting site or service unexpectedly. Stop and review if a different resource already owns these names.

## Provisioning — execute only after explicit owner approval

```sh
export PROJECT_ID=saladmanderdevhacks
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com aiplatform.googleapis.com iam.googleapis.com \
  firebase.googleapis.com firebasehosting.googleapis.com firebaserules.googleapis.com \
  firestore.googleapis.com identitytoolkit.googleapis.com apikeys.googleapis.com \
  --project "$PROJECT_ID"

# Link Firebase to the existing project; do not create another cloud project.
firebase projects:addfirebase "$PROJECT_ID" --non-interactive
firebase apps:create WEB "SourceLens Web" --project "$PROJECT_ID" --non-interactive
backend/.venv/bin/python scripts/configure_public_auth.py --project "$PROJECT_ID" --enable-email-password

gcloud services api-keys create --key-id=sourcelens-public-auth \
  --display-name="SourceLens public Auth only" \
  --api-target=service=identitytoolkit.googleapis.com \
  --api-target=service=securetoken.googleapis.com --project "$PROJECT_ID"
```

Reuse the SourceLens app/key if already provisioned; do not repeatedly create resources on retries. Obtain the Auth-only key string with `gcloud services api-keys get-key-string sourcelens-public-auth --project "$PROJECT_ID"`. This is public Firebase configuration, not a secret backend credential. Confirm its API restrictions before packaging.

```sh
gcloud firestore databases create --database=sourcelens --location=asia-northeast1 \
  --type=firestore-native --delete-protection --project "$PROJECT_ID"
gcloud firestore fields ttls update expires_at --collection-group=_sourcelens_usage \
  --database=sourcelens --enable-ttl --project "$PROJECT_ID"

gcloud iam service-accounts create sourcelens-runtime --project "$PROJECT_ID"
gcloud iam service-accounts create sourcelens-build --project "$PROJECT_ID"
export RUNTIME_SA="sourcelens-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
export BUILD_SA="sourcelens-build@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${RUNTIME_SA}" --role=roles/aiplatform.user
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${RUNTIME_SA}" --role=roles/firebaseauth.viewer
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${RUNTIME_SA}" --role=roles/datastore.user \
  --condition='expression=resource.name=="projects/saladmanderdevhacks/databases/sourcelens",title=SourceLensQuotaOnly'
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${BUILD_SA}" --role=roles/run.builder
```

Do not grant Owner/Editor to runtime/build identities. Deployer needs actAs on the selected identities; read-only preflight found the current deployer had that permission. Keep existing resources if present and compare their settings instead of blindly recreating or overwriting them.

## Build and validate the release

Copy `deployment/public-config.example.json` to a **build-local** JSON file. Fill the public Auth-only key. Optionally add an operator-approved public support email; a blank contact field publishes no personal email. The builder rejects missing placeholders. `apiOrigin` is the approved Hosting origin. Public Auth configuration is allowed in the package; OAuth tokens, passwords and service-account keys are not.

```sh
python3 scripts/build_public.py --config build/public-config.json --output build/public-100
(cd backend && .venv/bin/python -m unittest discover -s tests -v)
npm run test:extension
npm run build
python3 scripts/smoke_check.py
```

Each output directory must be new/empty. The builder produces the extension folder, reproducible ZIP, Hosting site and a matching Firebase config. It applies the app CSP only to app pages, preserving Firebase reserved email-verification/reset handlers. It limits release host permissions to the pinned service and Firebase Auth APIs, hides manual endpoint settings, and includes the privacy/data-flow page. The backend never trusts client quota or verification flags.

## Deployment — owner approval required for future releases

```sh
gcloud run deploy sourcelens-api --source backend --project "$PROJECT_ID" \
  --region asia-northeast1 --service-account "$RUNTIME_SA" \
  --build-service-account "projects/${PROJECT_ID}/serviceAccounts/${BUILD_SA}" \
  --no-allow-unauthenticated --max=1 --min=0 --max-instances 1 --min-instances 0 \
  --concurrency 4 --timeout 55 --memory 512Mi --cpu 1 \
  --env-vars-file deployment/public.env.yaml
```

Check the private service health using an authorized operator's identity token without printing or committing that token. Then make the service reachable for Firebase/browser requests; application authentication still rejects unsigned research requests:

```sh
gcloud run services add-iam-policy-binding sourcelens-api --region asia-northeast1 \
  --project "$PROJECT_ID" --member=allUsers --role=roles/run.invoker
firebase deploy --config build/public-100/firebase.json --only hosting,firestore:rules --project "$PROJECT_ID"
```

Confirm the default Firebase Hosting site exists; creating it is part of the approved Firebase provisioning if absent. Deployment pins the selected Cloud Run revision. Smoke-test **401 for an unsigned `/api/check` request**, verify no Gemini call is made, then test signup/email verification and a signed check in a second Chrome profile using the **release** extension. Test quota rejection, sign-out/deletion and counter persistence. Do not send verification/reset emails to anyone unless they explicitly initiate the corresponding account action.

## Current verification and limits

Browser script-generated highlight/retry clicks cannot start paid manual requests; existing results can still be opened without a new request. Controlled tests cover public-mode fail-closed defaults, token/verifier gating, verified-email enforcement, quota read/write ordering, persistent per-user/global counters, model blocking on quota failure, public package defaults, token routing to the pinned origin, account session handling and profile-isolated state. Live deployed tests additionally confirmed unsigned requests return 401, an unverified synthetic account returns 403, a verified synthetic account completes a real grounded research request, its durable counter persists, and its exhausted daily allowance returns 429. Synthetic accounts were deleted afterward; no verification/reset emails were sent. Hosted astronomy checks completed in 16.8 seconds initially and 14.2 seconds on final revision `sourcelens-api-00002-482`. The final check returned zero inspected pages (three grounding-redirect robots denials and one publisher-candidate timeout). IPv4-first connections and a bounded checked-address fallback are deployed, but these tests do not establish improved publisher retrieval rates or generally resolved independence. Direct Firebase-client database access also returned 403. Automated validation passed 61 backend tests, 30 extension tests, TypeScript/JavaScript checks and the structure smoke check. The published ZIP was downloaded and hash-matched to the release artifact. Interactive installation/email verification in a real Chrome profile still needs manual testing; no browser was connected in this environment.

`robots.txt` presence does not imply denial. Rules are checked per URL. Some public publisher pages were fetched successfully, but Google grounding redirects explicitly disallow automated crawling; candidates and inaccessible pages remain labeled. This deployment does not convert unknown provenance into confirmed independence. The general independence detector remains a prototype with narrow positive coverage.

## Allowance update — 2026-11-10

At the owner's request, the allowance was raised to **100 per verified account per UTC day**, with **100 requests per UTC day across the shared beta**. Existing counters were preserved; this is a larger daily limit, not a fresh allocation of 100 additional requests. Auto Scan and reserved research failures still count. The shared limit can be reached before an individual account uses its entire allowance.

Cloud Run revision `sourcelens-api-00003-zww` has both quota environment variables set to `100`, and Firebase Hosting was repinned to it. The install page, hosted ZIP and prepared GitHub release assets in `build/public-100/release-assets/` reflect the updated limits. Existing extensions inherit the new server-side allowance without reinstalling.

64 backend tests and the structural smoke check passed. A temporary verified test account had only its own counter seeded to 99: its next hosted research request succeeded and returned `daily_limit: 100, remaining: 0`; the following request returned `429 DAILY_QUOTA_EXCEEDED`. The test account was deleted. No verification/reset emails were sent, real-user counters were untouched, and the shared counter was not reset. The downloaded hosted ZIP hash matched the generated artifact. This raises possible provider usage; request quotas do not establish a dollar spending cap.


## Manual-only extension update — 2026-11-10

At the owner’s request, version 0.3.1 removes Auto Scan’s popup controls, paragraph detection, automatic research requests, page markers, timers, storage listeners and scan notices. Legacy enabled-site preferences are ignored. Highlighted-text and pasted-claim checks, account handling, source provenance and the 100/100 server allowances remain available. Refresh article tabs after updating to stop an old content script. No backend deployment is needed for this frontend change.

The current public build is `build/public-manual-v0.3.1`; GitHub assets are in its `release-assets/` directory and use tag proposal `v0.3.1-beta.1`. The previous quota-update build and earlier Auto Scan test results above are historical. Current extension tests cover absence of automatic requests even with legacy enabled preferences, manual checks/citations, provenance, account UI and synthetic-click guards.

For this release, 23 extension tests, 18 backend public-access/package tests, TypeScript/JavaScript checks and the structural smoke check passed. The hosted ZIP was downloaded, hash-matched and inspected for version 0.3.1 and absence of the scanning controls/code. Hosted app/install/privacy/sample pages no longer advertise Auto Scan, and the authenticated backend health check passed. No live model calls were needed for this frontend-only change; interactive Chrome QA remains manual.
