# Contributing to Mikata

Start with `docs/TEAM_TASKS.md` to claim an area of work, and `docs/SECURITY_AND_CREDITS.md` before connecting Cloud services.

## Share through GitHub

If the repository already exists, clone it and copy the **contents** of this handoff folder into the clone. If not, unzip this project, open the folder in VS Code, and initialize Git:

```bash
git init
git add .
git diff --cached --stat
git diff --cached                  # CHECK for secrets or accidental personal data
git commit -m "chore: add Mikata starter, draft logo, and team handoff"
```

Then follow the repo owner's instructions to connect the proper remote, e.g. `git remote add origin <TEAM_REPO_URL>` and push to the agreed default branch. Do not overwrite team history with `git push --force`. If the teammate has already created the repo, cloning first is safer than initializing a separate history.

Use small branches and PRs (`feat/auto-scan`, `design/brand`, `fix/backend`) so the team can review changes. Write who owns each task in `docs/TEAM_TASKS.md`.

No real credentials belong in Git. `.gitignore` is included but cannot catch everything. Never use browser-side Gemini keys. If you accidentally commit one, rotate it promptly and tell the cloud owner.
