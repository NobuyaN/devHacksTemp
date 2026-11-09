# Security, privacy, and $20 Google Cloud credit guide

**Read before deploying, adding secrets, or sharing the repository.** This hackathon prototype is not security-hardened. A local design preview uses no Google Cloud credits. A deployed AI endpoint can create real charges even if a team believes it is just running a demo.

## Protect the $20 credit budget

1. **Check credit eligibility and expiry:** Some services, models and billing accounts may not be covered by a specific credit award. Use the Google Cloud Billing console, not assumptions.
2. **Configure a project-scoped budget and alerts:** Consider thresholds well below $20 (for example $5, $10, $15) so your team has time to respond. **Alerts-only budgets do not stop spending.** Google Cloud has spend-cap budgets for certain eligible services/projects; if available, consider a cap as an extra safeguard, but enforcement may not be instantaneous and overruns are possible.
3. **Use Cloud Run maximum instances** (for example 1 in a demo) to limit scale, and consider request/concurrency/time-out restrictions. Instance limits **are not a hard dollar cap**, and brief overshoots are possible.
4. **Do not leave live Auto Scan on** across many tabs or reloads. The extension normally checks at most two claims *per page load*, not per account/day. Repeated reloads and manual checks are additional requests.
5. **Plan server-side request limits:** This starter does not implement abuse-proof rate limiting or a hard daily quota. Anyone able to call a publicly accessible endpoint can bypass the extension's UI limit.
6. **Clean up promptly:** Disable live backend usage when you stop demoing; remove/disable unused services and review Cloud Billing usage afterward.

Official references (review current guidance in your own account):
- [Cloud Billing budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets)
- [Eligible spend-cap budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps)
- [Cloud Run maximum instances](https://docs.cloud.google.com/run/docs/configuring/max-instances)

## API keys / secrets — non-negotiable

- **Never paste a Gemini API key or service-account JSON into** `extension/*.js`, `manifest.json`, `popup.html`, screenshots, slides, or GitHub issues.
- Anything shipped in the Chrome extension is extractable by end users. Minifying/obfuscating code does **not** hide an API key.
- The backend template uses **Cloud Run service identity / Application Default Credentials** for Vertex AI. Give the service account only the roles it actually needs; avoid owner/editor project permissions.
- `.gitignore` and `backend/.env.example` are included, but inspect every commit. If a secret is ever committed, **revoke/rotate it**; removing it from the latest commit does not erase Git history.
- Use a trusted Cloud Run HTTPS URL. The popup only accepts `*.run.app` and local development URLs. **The URL is not a secret or an access-control mechanism.**
- Avoid remote JavaScript/remote fonts in the extension. Keep content injected with `textContent`, and verify outgoing source URLs use HTTPS.

## Public Cloud Run deployment is risky

The example command in README uses `--allow-unauthenticated` because a local extension cannot automatically acquire the team's Cloud Run IAM identity token. **It is a demo-only option** and exposes `/check` to anyone who can call the URL. Hiding the URL, restricting browser CORS, limiting Chrome UI checks, or setting `--max-instances 1` does not authenticate requests.

**Before a public demo or distribution**, have the cloud/backend teammate choose a real protection approach, such as an authenticated user flow paired with server-side rate limiting, quotas/monitoring, and abuse controls. Keep usage small, monitor live, and avoid a widely shared endpoint until these controls exist.

Avoid hardcoding a shared "demo key" in the extension: people can extract it. For any actual user-facing launch, design auth with a proper backend session/user identity and enforce limits on the server. Consider separating demo and production projects.

## Data privacy: what goes where

- Manual checks: selected/pasted claim text plus **page title** go to the extension background script and, when configured, to the backend. The entire webpage is not sent. The page URL is purposely **not transmitted to the backend** in this handoff.
- Auto Scan: enabled **separately per website**; heuristically reads article-like text locally, and may submit up to 2 selected claims per page load to the backend when connected. Preview mode makes no AI requests.
- Never use Mikata for confidential documents, password recovery pages, personal messages, or sensitive workplace systems. The current local heuristics skip password fields and common editors, but that is not a full privacy audit.
- Consent, retention, privacy notice, domain exclusions, abuse reporting and prompt-injection testing are **TODOs**, not completed protections.
- Search grounding may return sources that are irrelevant, outdated, or contradictory. A citation is not proof. Never advertise Mikata as guaranteeing truth.

## If you think credentials were exposed

1. Disable or restrict the affected API/deployment if possible.
2. Revoke/rotate the affected key or service-account credential immediately.
3. Check Cloud Logging and billing usage for unusual traffic; notify the team owner.
4. Remove the secret from source and Git history with coordinated help, but do not assume history cleanup is sufficient to make a leaked key safe again.
