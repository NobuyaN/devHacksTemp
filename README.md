# Mikata · みかた

Mikata is a Chrome extension for investigating highlighted or pasted claims with Gemini, Google Search grounding, source links, and experimental source-dependency analysis. The interface supports **English / 日本語**. Checks are manual; Auto Scan has been removed.

**Current extension: 0.4.1.** The shared backend is deployed on Cloud Run, and the dashboard/download pages use Firebase Hosting. This beta is installed through Chrome Developer mode; it is not published in the Chrome Web Store.

## Use Mikata — no development setup needed

**Users and judges do not need a terminal, Firebase CLI, gcloud, a Google Cloud account, or a project ID.** Use the configured release ZIP:

- **[Download Mikata 0.4.1](https://saladmanderdevhacks.web.app/downloads/mikata-extension-0.4.1.zip)**
- [Installation page](https://saladmanderdevhacks.web.app/install.html)
- [Optional dashboard for text and image checks](https://saladmanderdevhacks.web.app/)
- [Privacy notice](https://saladmanderdevhacks.web.app/privacy.html)

### Load the extension in Chrome

1. Download the ZIP above and **unzip it into a new folder**. If an older Mikata extension is installed, remove or disable it first.
2. Open **`chrome://extensions`** in Google Chrome.
3. Turn **Developer mode** on, then click **Load unpacked**.
4. Select the unzipped folder containing **`manifest.json`**. Select the folder, not the ZIP or the outer repository folder.
5. Confirm the extension card shows **version 0.4.1**. Open Chrome’s puzzle-piece Extensions menu, find **mikata**, and optionally pin it to the toolbar.
6. Open Mikata and **create a Mikata account** or sign in to an existing one. Open the verification email, follow its link, then click **I've verified my email · Refresh** in the popup. Check spam if the email does not arrive.
7. **Refresh an ordinary article tab** after installing or updating. Chrome settings pages and the Chrome Web Store do not allow the extension to run.

Each Chrome profile signs in separately. Signing in with the same Mikata account in another profile uses the same account allowance. You do not need to sign Chrome itself into a Google account.

### Check a claim

- Highlight a factual sentence of at least **8 characters**, then click the floating **Check with mikata** button. The result opens in the sidebar.
- Alternatively, open the popup, paste a claim, and click **Check this claim** while a normal webpage is open.
- Review the explanation and open the source links. Expand **Source independence** for inspection counts, documented relationships and unresolved sources. Several extracted claims receive separate assessments.
- Select **English** or **日本語** in the popup/sidebar to change the interface and the language requested for new results. The choice is saved for that profile. Switching the UI does not start research; existing generated results keep their original text. **Check again** starts a new request and uses an allowance. Source titles, quotes and Google attribution stay in their original form.
- The optional dashboard also accepts images. You do not need to keep the dashboard open to use the extension.

### 日本語での使い方

1. 上の **Mikata 0.4.1** の ZIP をダウンロードして展開します。
2. Chrome で `chrome://extensions` を開き、**デベロッパー モード → パッケージ化されていない拡張機能を読み込む**から、`manifest.json` が入ったフォルダを選びます。
3. Mikata を開き、**日本語**に切り替えます。アカウントを作成し、認証メールのリンクを開いてから、**メール認証が完了しました · 更新**を押します。
4. 記事のタブを再読み込みし、8 文字以上の文章を選択して **Mikata で確認**を押します。ポップアップに文章を貼り付けて確認することもできます。
5. 説明と出典を確認してください。情報源の独立性が未解決の場合、それを独立した根拠として数えることはできません。利用者にクラウドの設定や CLI のインストールは不要です。

### Allowances and current limitations

- **100 requests per verified account per UTC day**, subject to **100 requests total per day across the entire beta**. The shared limit may be reached before your own allowance. Reset is midnight UTC (**9 a.m. Japan time**). Reserved requests can count even if Google research later fails.
- This is AI-assisted research, not a guarantee of factual accuracy. Review citations before relying on or sharing a result.
- **Source independence is experimental.** Google grounding redirects, publisher robots policies, paywalls and timeouts can prevent inspection. Zero inspected articles means article-level provenance was not verified. Different domains and repeated reporting do not automatically count as independent evidence.
- Selected text and page title, or an explicitly uploaded dashboard image, are processed by Google Cloud. Avoid confidential content. The hosted service must remain enabled and funded.

### If something does not work

| What you see | What to do |
| --- | --- |
| Old version or no language buttons | Use the version-specific download above; select the newly unzipped folder, check its version, and refresh article tabs. |
| No floating check button | Open a normal article, refresh it, and select at least 8 characters. Try the popup’s pasted-claim input. |
| Sign-in or email-verification request | Open the popup, sign in, complete email verification, then refresh the verified session. |
| Daily allowance reached | Wait for the UTC daily reset. Switching Chrome profiles does not reset the account allowance. |
| Google research unavailable | Wait briefly and retry a short factual claim. Regular users do not need to configure Google Cloud credentials. |
| Design preview or an unexpected backend URL field | You probably loaded the repository’s developer folder. Install the configured release ZIP above for the shared service. |

## Develop Mikata

Read [CONTRIBUTING.md](CONTRIBUTING.md), [forDevsREADME.md](forDevsREADME.md), [team tasks](docs/TEAM_TASKS.md), and [security guidance](docs/SECURITY_AND_CREDITS.md) first. `forDevsREADME.md` describes the original starter; the current installation instructions are above. Keep teammates’ work and existing cloud resource IDs intact.

The repository’s **`extension/` directory has developer/preview defaults**; it does not automatically connect to the public service. For UI-only work, load that directory using Chrome’s **Load unpacked** button. Preview results are labeled and are not live fact checks. No extension bundler/build step is required. For live local research, run your own local backend and configure its URL as described below.

### Clone and run automated checks

Requires **Python 3.13** and **Node 22.13+ or 24+**. The current implementation is on `feat/backend-source-verification`:

```sh
git clone --branch feat/backend-source-verification https://github.com/NobuyaN/devHacksTemp.git mikata
cd mikata
python3.13 -m venv backend/.venv
backend/.venv/bin/pip install --require-hashes -r backend/requirements.txt
npm ci

(cd backend && .venv/bin/python -m unittest discover -s tests -q)
npm run test:extension
npm run build
python3 scripts/smoke_check.py
```

Tests use controlled fixtures and mocks; they require **no cloud account or credentials**. `npm run build` checks TypeScript contracts and JavaScript syntax; it does not generate a release ZIP or validate live model accuracy.

### Run the backend locally for real research

Developers running their own backend need Google Cloud CLI and permission to use Vertex AI in the project. Ask the project owner for the required access; never share service-account keys or personal credential files. These steps are **not needed by regular extension users**.

From the repository root:

```sh
gcloud auth login
gcloud config set project saladmanderdevhacks
gcloud auth application-default login
gcloud auth application-default set-quota-project saladmanderdevhacks

export GOOGLE_CLOUD_PROJECT=saladmanderdevhacks
export GOOGLE_CLOUD_LOCATION=global
export GEMINI_MODEL=gemini-3.5-flash
export GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite
export AUTH_MODE=local
export ALLOWED_ORIGINS=http://localhost:5000,http://127.0.0.1:5000
backend/.venv/bin/gunicorn --chdir backend --bind 127.0.0.1:8080 --workers 1 --threads 4 --timeout 55 main:app
```

Keep that terminal running. Load the source **`extension/`** folder in Chrome, open its popup, expand **Connect your AI backend**, enter **`http://127.0.0.1:8080`**, and save. Refresh an article tab before checking a claim. Local mode uses the loopback server and does not require a Mikata account; do not use local authentication mode for public deployment. Real Vertex/search requests can incur cloud charges.

To run the optional dashboard, open another terminal at the repository root:

```sh
python3 -m http.server 5000 --bind 127.0.0.1 --directory landing
```

Visit **http://127.0.0.1:5000**. The dashboard calls the local API on port 8080. `backend/.env.example` is a configuration reference; `.env` files are not loaded automatically, so export the values in your shell.

### Detailed documentation

| Guide | Contents |
| --- | --- |
| [Extension guide](extension/README.md) | Local loading, shared release versus developer defaults, results and language switching |
| [Backend guide](backend/README.md) | API examples, architecture, tests, configuration, Google Cloud IAM and troubleshooting |
| [Dashboard guide](landing/README.md) | Local dashboard and language preferences |
| [Public beta runbook](deployment/PUBLIC_BETA.md) | Shared authentication/quotas, reproducible release packaging, Cloud Run and Firebase Hosting deployment |
| [GitHub Release submission](deployment/GITHUB_RELEASE.md) | Release tag, configured extension asset, checksums and publishing steps |
| [Current release notes](docs/releases/v0.4.1-beta.1.md) | Judge-facing installation steps, features and limitations |

Generated `build/` artifacts are Git-ignored. Follow the public beta runbook to build a configured release from a clone; do not distribute the unconfigured source folder as though it were the hosted release. Get approval before public deployment or changes to shared billable resources.

---

The original organizer-provided repository instructions are preserved below.

# DevFest Hackathon 2026 提出用リポジトリ

  DevFest Hackathon 2026 のチームの **最終提出用** リポジトリです。提出期限までに、作品のコードと資料をこのリポジトリに置いてください。

  このリポジトリは **公開（public）** です。開催中も、運営・審査員・ほかの参加者が見られます。

  ## はじめに

  1. GitHub から届いた招待を受け入れてください（招待の期限は 7 日です）
  2. このリポジトリを clone して、提出物を置いてください

  招待の期限が切れたときや、メンバーが変わったときは、運営に連絡してください。

  ## 開発用のリポジトリは別に作ることをおすすめします

  このリポジトリでは **GitHub Actions と GitHub Pages が使えません**。CI やデプロイ、Pages での公開をしたいときは、チームで開発用のリポジトリを別に作ってください。

  - 開発用のリポジトリは、チームのメンバーのアカウントや、チームで作った Organization に作ってください
  - 開発はそちらで進めて、提出期限までに最終版のコードと資料をこのリポジトリに push してください
  - 審査はこのリポジトリの内容で行います。開発用のリポジトリにしかないものは、審査の対象になりません
  - デプロイした作品の URL があれば、この README に書いてください

  ## 秘密情報をコミットしない

  API キー・パスワード・サービスアカウントの鍵などは、**絶対にコミットしないでください**。公開リポジトリなので、push
  した時点で誰でも見られます。開発用のリポジトリから持ってくるときも、履歴ごと push すると、過去のコミットに含まれる秘密情報も公開されます。

  - 秘密情報は `.env` や `.dev.vars` などに書き、コミットしない（`.gitignore` に入れてあります）
  - 誤って push したら、すぐにキー（鍵）を無効にして作り直し、運営に連絡してください。履歴から消すだけでは不十分です
  - GitHub の push protection が、よく知られた形式のキーの push を止めることがあります。止められたら、そのキーをコミットから外してください

  ## 提出

  提出の方法と締切は、運営からの案内に従ってください。提出期限を過ぎると、このリポジトリは読み取り専用になり、push できなくなります。

  ## ライセンス

  [MIT License](LICENSE) です。ほかのライセンスにしたいときは、LICENSE を書き換えてください。
