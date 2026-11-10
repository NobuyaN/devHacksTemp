"""Quick stdlib-only structural test. Not a substitute for Chrome / Cloud Run E2E tests."""
import ast
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    "extension/manifest.json", "extension/popup.html", "extension/popup.css",
    "extension/popup.js", "extension/content.js", "extension/content.css",
    "extension/background.js", "extension/assets/brand/logo-candidate.png",
    "backend/main.py", "backend/.env.example", ".gitignore", "docs/TEAM_TASKS.md",
]
for name in REQUIRED:
    assert (ROOT / name).is_file(), f"Missing: {name}"
assert (ROOT / "extension/i18n.js").read_bytes() == (ROOT / "landing/i18n.js").read_bytes(), "Local dashboard i18n mirror must match extension/i18n.js"
manifest = json.loads((ROOT / "extension/manifest.json").read_text())
assert manifest["manifest_version"] == 3
assert manifest["background"]["service_worker"] == "background.js"
for icon in manifest["icons"].values():
    assert (ROOT / "extension" / icon).is_file(), f"Missing Chrome icon: {icon}"
ast.parse((ROOT / "backend/main.py").read_text())
assert (ROOT / "extension/assets/brand/logo-candidate.png").stat().st_size > 1000
print("OK — structure, manifest paths and backend Python syntax.")
print("Remember: Chrome interaction, live API grounding, IAM, and billing need manual tests.")
