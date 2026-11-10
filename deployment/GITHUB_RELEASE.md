# GitHub Release submission

Submit a release URL from the hackathon's designated repository. The local checkout currently points to `NobuyaN/devHacksTemp`; confirm that this is the correct submission repository before publishing. Do not replace a team remote or force-push history.

## Prepared release

- Proposed tag: `v0.4.0-beta.1` (Chrome manifest version `0.4.0`).
- Title: `Mikata v0.4.0-beta.1`.
- Notes: `docs/releases/v0.4.0-beta.1.md`.
- Extension asset: `build/public-bilingual-v0.4.0/release-assets/mikata-extension-v0.4.0-beta.1.zip`.
- Checksum asset: `build/public-bilingual-v0.4.0/release-assets/SHA256SUMS.txt`.

Artifacts are generated and Git-ignored. A teammate can rebuild from the repository and the public Auth configuration described in `PUBLIC_BETA.md`:

```sh
python3 scripts/build_public.py --config build/public-config.json --output build/public-bilingual-v0.4.0
mkdir -p build/public-bilingual-v0.4.0/release-assets
cp build/public-bilingual-v0.4.0/hosting/downloads/mikata-extension.zip build/public-bilingual-v0.4.0/release-assets/mikata-extension-v0.4.0-beta.1.zip
(cd build/public-bilingual-v0.4.0/release-assets && shasum -a 256 mikata-extension-v0.4.0-beta.1.zip > SHA256SUMS.txt)
```

Choose a new empty output directory if it already exists. Never put backend credentials in the release. The Firebase Auth API identifier in the configured extension is intentionally public and restricted to Auth APIs.

## Publish after approval

1. Confirm the submission repository and obtain approval to push and publish. Review staged changes for secrets.
2. Push the reviewed feature branch without force. For this checkout: `git push origin feat/backend-source-verification`. Follow team review/merge requirements if the release must target the default branch.
3. On GitHub, open that repository's **Releases → Draft a new release**. Create tag `v0.4.0-beta.1` targeting the pushed, reviewed commit/branch (or its merged commit), not an older default-branch snapshot.
4. Set the title above and paste the release notes. Attach the configured extension ZIP and checksum file. Save a draft while checking the assets.
5. Mark it a prerelease to reflect the beta status if the submission rules allow prereleases; otherwise follow the rules without hiding prototype limitations. Publish and submit the resulting release URL.

GitHub's automatic Source code ZIP is useful for source review but contains developer defaults. Judges should install the attached configured extension asset. The cloud service must remain available and funded, and the shared daily allowance must have capacity when judges test it.

This preparation did not push, create a remote tag, publish a release or submit an entry. No GitHub CLI is installed in the current environment; publication can use GitHub's web interface.

Official publishing reference: [Managing releases on GitHub](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository).
