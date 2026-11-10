/* Shared UI localization. Only Mikata-owned nodes are translated; evidence and source titles stay original. */
(() => {
  const ja = {
    "Language / 言語": "Language / 言語",
    "みかた • your reading buddy": "みかた • 読むときのパートナー",
    "A LITTLE PERSPECTIVE, EVERY DAY": "毎日の情報に、もうひとつの見方を",
    "Curious if it's": "本当かどうか、",
    "true?": "気になりますか？",
    "Highlight something you read. We'll help you look a little closer.": "気になる文章を選択して、根拠を一緒に確かめましょう。",
    "✦ Design preview mode": "✦ デザインのプレビュー",
    "✿ Shared Mikata service": "✿ Mikata に接続中",
    "✿ Connected to your backend": "✿ バックエンドに接続中",
    "Mikata account": "Mikata アカウント",
    "Sign in to use the shared service.": "利用するにはログインしてください。",
    "Email": "メールアドレス",
    "Password": "パスワード",
    "Sign in": "ログイン",
    "Create account": "アカウント作成",
    "Reset password": "パスワードを再設定",
    "I've verified my email · Refresh": "メール認証が完了しました · 更新",
    "Resend verification email": "認証メールを再送",
    "Sign out": "ログアウト",
    "Delete Mikata account": "Mikata アカウントを削除",
    "A Mikata account is enough. No cloud account or developer tools are needed.": "Mikata のアカウントだけで利用できます。クラウドアカウントや開発ツールは不要です。",
    "Privacy": "プライバシー",
    "Check my highlighted text": "選択した文章を確認",
    "or paste a claim here": "または確認したい文章を貼り付け",
    "Claim to check": "確認したい主張",
    "I read that electric cars produce zero emissions...": "電気自動車は排出ガスをまったく出さないと聞きました…",
    "Check this claim": "この主張を確認",
    "✷ Try a sample claim": "✷ サンプルの主張を試す",
    "✿ Connect your AI backend": "✿ AI バックエンドを設定",
    "For real checks, enter a team-approved Cloud Run URL. Never paste an API key or private token here. Public endpoints can use cloud credits.": "実際に確認するには、チームが承認した Cloud Run の URL を入力してください。API キーや秘密のトークンは入力しないでください。利用料金が発生する場合があります。",
    "Cloud Run URL": "Cloud Run の URL",
    "Save endpoint": "接続先を保存",
    "Use demo mode": "デモに切り替え",
    "Read thoughtfully. Stay curious.": "じっくり読んで、問い続けよう。",
    "No webpage is active.": "ウェブページを開いてください。",
    "Open a normal webpage and refresh it first.": "通常のウェブページを開いて、再読み込みしてください。",
    "Open a normal webpage (not a Chrome settings page), refresh, and try again.": "Chrome の設定画面以外のウェブページを開き、再読み込みしてから試してください。",
    "Paste a sentence first, and I'll open it on the webpage.": "確認したい文章を先に貼り付けてください。",
    "Sample ready. Click Check this claim to run a live check.": "サンプルを入力しました。「この主張を確認」で調査できます。",
    "Sample ready! Click Check this claim to see the design preview.": "サンプルを入力しました。「この主張を確認」でプレビューを表示します。",
    "Use an https://…run.app URL, or http://localhost for testing.": "https://…run.app の URL を入力してください。ローカルテストでは http://localhost を使えます。",
    "Endpoint saved. Checking a claim sends it to your backend and may use Google Cloud credits.": "接続先を保存しました。確認する文章はバックエンドに送信され、利用料金が発生する場合があります。",
    "Back in design preview mode.": "デザインのプレビューに切り替えました。",
    "Sign-in service is unavailable.": "現在ログインできません。しばらくしてから試してください。",
    "Sign in or create a Mikata account to check claims.": "主張を確認するには、Mikata にログインするかアカウントを作成してください。",
    "Signed in as {email}. Refresh the article to start checking.": "{email} でログイン中です。記事を再読み込みすると確認できます。",
    "Verify the email sent to {email}, then click Refresh.": "{email} に届いたメールで認証し、「更新」を押してください。",
    "Account created. Use Resend verification email to try sending your verification link.": "アカウントを作成しました。「認証メールを再送」から認証メールを送信してください。",
    "Verification email sent.": "認証メールを送信しました。",
    "Enter your email first.": "メールアドレスを入力してください。",
    "If this account exists, a password reset email will be sent.": "アカウントが存在する場合は、パスワード再設定メールが送信されます。",
    "Delete your Mikata account? This cannot be undone. Usage counters expire separately after their retention period.": "Mikata アカウントを削除しますか？元に戻すことはできません。利用回数の記録は、別途保存期間の終了後に削除されます。",
    "Delete your Mikata account? This cannot be undone.": "Mikata アカウントを削除しますか？元に戻すことはできません。",
    "That email already has an account. Sign in instead.": "このメールアドレスは登録済みです。ログインしてください。",
    "Email or password is incorrect.": "メールアドレスまたはパスワードが正しくありません。",
    "Enter a valid email address.": "正しいメールアドレスを入力してください。",
    "Choose a stronger password with at least eight characters.": "8 文字以上の安全なパスワードを設定してください。",
    "Choose a password with at least eight characters.": "8 文字以上のパスワードを設定してください。",
    "Account sign-in is not enabled on this service yet.": "このサービスでは、まだログインを利用できません。",
    "Sign out and sign in again before deleting your account.": "アカウントを削除する前に、ログアウトして再度ログインしてください。",
    "Too many sign-in attempts. Try again later.": "ログインの試行回数が多すぎます。しばらくしてから試してください。",
    "Sign-in could not complete. Check your details or try again later.": "ログインできませんでした。入力内容を確認するか、しばらくしてから試してください。",
    "Account sign-in has not been configured.": "アカウントのログイン設定が完了していません。",
    "Invalid sign-in response.": "ログイン情報を取得できませんでした。再度ログインしてください。",
    "Sign in first.": "先にログインしてください。",
    "Check selected text with Mikata": "選択した文章を Mikata で確認",
    "Check with mikata": "Mikata で確認",
    "Mikata fact-check panel": "Mikata の確認結果",
    "a little perspective goes a long way": "もうひとつの見方が、理解を変える",
    "Close Mikata": "Mikata を閉じる",
    "Let's look a little closer": "もう少し詳しく見てみましょう",
    "✦ Design preview · not verified": "✦ プレビュー · 未検証",
    "The claim": "確認する主張",
    "Taking a look...": "確認しています…",
    "Preparing your claim.": "主張を確認する準備をしています。",
    "The little details": "詳しい説明",
    "We're getting ready to explore the context.": "背景情報を調べる準備をしています。",
    "Where this comes from": "情報の出典",
    "Live source links appear when your backend is connected.": "バックエンドに接続すると、出典のリンクが表示されます。",
    "Check again": "もう一度確認",
    "Mikata is a reading companion, not a final authority. AI-assisted assessments may be wrong. Read sources before sharing.": "Mikata は情報を読むための補助ツールです。AI による評価には誤りがあり得ます。共有する前に出典を確認してください。",
    "Looks supported": "根拠による支持あり",
    "There's more context": "追加の文脈が必要",
    "Evidence suggests otherwise": "反証となる根拠あり",
    "Let's stay curious": "根拠が不十分です",
    "Couldn't complete the check": "確認を完了できませんでした",
    "Extracted claim": "抽出された主張",
    "Source independence": "情報源の独立性",
    "{articles} articles inspected. {origins} confirmed distinct evidence origins. {unresolved} sources with unresolved independence.": "調査できた記事：{articles} 件。別個の根拠と確認できた起点：{origins} 件。独立性が未解決の情報源：{unresolved} 件。",
    "Unresolved sources do not count as independent. Published methodology statements are not a raw-data audit.": "独立性が未解決の情報源は、独立した根拠として数えません。公開された手法の記載は、生データの監査を意味しません。",
    "Article-level provenance could not be checked. The verdict above is based on grounded search, not verified independent origins.": "記事の出典関係は確認できませんでした。上記の評価は検索による根拠に基づいており、情報源の独立性を確認したものではありません。",
    "{targets} documented attribution targets; {articles} articles with confirmed attribution.": "明示された参照先：{targets} 件。帰属関係を確認できた記事：{articles} 件。",
    "Fetched publisher candidate · not a grounding attribution or independence proof": "取得できた候補ページ · Google の出典や独立性の証明ではありません",
    "Page fetched · independence still requires provenance evidence": "ページ取得済み · 独立性の判断には出典関係の根拠が必要です",
    "Unverified: {reason}": "未検証：{reason}",
    "Page could not be inspected": "ページを調査できませんでした",
    "Inspection limits: {reasons}.": "調査の制約：{reasons}。",
    "Inspect supporting source ↗": "関係の根拠を確認 ↗",
    "Referenced source ↗": "参照先を開く ↗",
    "Unverified model suggestion: {hypothesis}": "AI による未検証の推測：{hypothesis}",
    "Please refresh this page and try again.": "ページを再読み込みしてから、もう一度試してください。",
    "Open the extension popup to sign in or refresh your verified session.": "拡張機能のポップアップを開いてログインするか、認証状態を更新してください。",
    "The extension reached your backend, but the research could not finish.": "バックエンドには接続できましたが、調査を完了できませんでした。",
    "Check that your backend is running and its saved endpoint is correct.": "バックエンドが起動しているか、保存した接続先が正しいか確認してください。",
    "Sign in required": "ログインが必要です",
    "Research unavailable": "調査を利用できません",
    "Connection issue": "接続の問題",
    "No evidence was retrieved.": "根拠を取得できませんでした。",
    "✿ Live AI-assisted assessment": "✿ AI による調査結果",
    "{count} checks left today": "本日の残り {count} 回",
    "Google Search suggestions": "Google 検索の候補",
    "Preview only. Connect a Cloud Run backend to check claims and retrieve sources.": "プレビューです。実際の調査と出典の取得には Cloud Run のバックエンドに接続してください。",
    "No cited sources returned. This claim is not verified.": "出典を取得できませんでした。この主張は未検証です。",
    "✦ Looking into the claim...": "✦ 主張を調べています…",
    "Gathering the context...": "背景情報を収集しています…",
    "Mikata is preparing your result.": "Mikata が結果を準備しています。",
    "Sources appear here when a live check finds them.": "調査で見つかった出典がここに表示されます。",
    "Mikata couldn't reach its background service.": "拡張機能のバックグラウンド処理に接続できませんでした。",
    "Highlight a sentence on this page first.": "このページの文章を先に選択してください。",
    "Please enter some text.": "文章を入力してください。",
    "Please select or paste a claim first.": "主張を選択するか貼り付けてください。",
    "Results stay in their original language. Check again to request this language (uses one check).": "既存の結果は元の言語のままです。この言語で再調査するには「もう一度確認」を押してください（利用回数を消費します）。",
    "Mikata · Evidence explorer": "Mikata · 根拠を調べる",
    "Look closer at the source.": "情報の出典を、もっと詳しく。",
    "Explore a claim and trace where its evidence comes from. AI assessments can be wrong; inspect the citations.": "主張を調べ、その根拠がどこから来ているのかを確認しましょう。AI による評価には誤りがあり得るため、出典も確認してください。",
    "Selected text or factual claim": "選択した文章、または確認したい主張",
    "Paste a claim to investigate": "確認したい主張を貼り付けてください",
    "Or submit an image (PNG, JPEG, WebP; up to 4 MiB)": "または画像を送信（PNG、JPEG、WebP、最大 4 MiB）",
    "Submitting sends your text or image to Google Cloud for AI processing and search. Avoid private information.": "送信した文章や画像は、AI 処理と検索のため Google Cloud に送られます。個人情報や機密情報は送信しないでください。",
    "Investigate evidence": "根拠を調べる",
    "Open the sample article to test manual highlighting": "サンプル記事で文章の選択を試す",
    "· demo text, not a real publication": "· 実際の記事ではなく、デモ用の文章です",
    "Source independence and factual accuracy are separate questions. An unresolved relationship is not an independent source.": "情報源の独立性と主張の正しさは別の問題です。関係が未解決の情報源は、独立した根拠として扱いません。",
    "Evidence provenance": "根拠の出典関係",
    "Confirmed independent evidence origins: {count}": "別個の根拠と確認できた起点：{count} 件",
    "{articles} articles inspected · {targets} documented attribution targets · {dependent} attributed articles · {unresolved} unresolved independence.": "調査できた記事 {articles} 件 · 明示された参照先 {targets} 件 · 帰属関係を確認できた記事 {dependent} 件 · 独立性が未解決 {unresolved} 件。",
    "Fetched research candidate": "取得できた調査候補",
    "Article-level provenance could not be checked. The factual verdict uses grounded search, not verified independent origins.": "記事の出典関係は確認できませんでした。主張の評価は検索による根拠に基づき、情報源の独立性を確認したものではありません。",
    "Inspect attribution": "帰属関係の根拠を確認",
    "Attributed target:": "参照先：",
    "Grounding citations and source graph data": "検索の出典と情報源グラフのデータ",
    "Researching evidence. This can take up to a minute.": "根拠を調べています。最大 1 分程度かかる場合があります。",
    "Image must be at most 4 MiB.": "画像は 4 MiB 以下にしてください。",
    "Sign in to Mikata first.": "先に Mikata にログインしてください。",
    "Research unavailable.": "現在、調査を利用できません。",
    "Review the evidence and uncertainty below.": "以下の根拠と不確かな点を確認してください。",
    "No factual claims extracted.": "検証可能な主張は見つかりませんでした。",
    "Research timed out. Try a shorter claim.": "調査がタイムアウトしました。短い主張でもう一度試してください。",
    "Your Mikata account": "Mikata アカウント",
    "Refresh verified session": "メール認証の状態を更新",
    "Delete account": "アカウントを削除",
    "Create an account or sign in to check claims.": "主張を確認するには、アカウントを作成するかログインしてください。",
    "{email}: signed in": "{email}：ログイン中",
    "{email}: check your email to verify your account, then refresh your session": "{email}：認証メールを確認してから、認証状態を更新してください。",
    "SUPPORTED": "支持する根拠あり", "CONTRADICTED": "反証あり", "MIXED": "根拠が混在", "INSUFFICIENT_EVIDENCE": "根拠が不十分", "NOT_FACT_CHECKABLE": "事実として検証できません",
    "inspected": "調査済み", "unverified": "未検証", "confirmed": "確認済み", "unresolved": "未解決",
    "explicit_attribution": "明示された帰属関係", "syndicated_from": "転載元", "cites_original_artifact": "元の資料への参照", "distinct_original_evidence": "別個の独自の根拠",
    "ROBOTS_DISALLOWED": "サイトの robots 方針により取得不可", "TIMEOUT": "取得時間の上限", "DNS_FAILED": "名前解決に失敗", "TLS_FAILED": "安全な接続を確認できません", "FETCH_FAILED": "取得に失敗", "SIZE_LIMIT": "ページのサイズ上限", "UNSUPPORTED_CONTENT": "未対応の形式", "UNSUPPORTED_ENCODING": "未対応の文字圧縮形式", "REDIRECT_LIMIT": "転送回数の上限", "ACCESS_WALL": "アクセス制限", "NOT_ARTICLE_PAGE": "記事ページではありません", "NO_ARTICLE_TEXT": "本文を取得できません",
    "This site disallows automated inspection of this URL in robots.txt": "この URL は、サイトの robots.txt により自動取得が許可されていません。",
    "Page inspection timed out": "ページの取得がタイムアウトしました。",
    "Page hostname could not be resolved": "ページのホスト名を解決できませんでした。",
    "Page TLS certificate could not be verified": "ページの TLS 証明書を確認できませんでした。",
    "Page could not be safely retrieved": "ページを安全に取得できませんでした。",
    "Page is not supported HTML content": "対応している HTML ページではありません。",
    "Page exceeds the 750 KB inspection limit": "ページが調査のサイズ上限（750 KB）を超えています。"
  };
  Object.assign(ja, {
    "Mikata logo": "みかたのロゴ",
    "There's a little more to this.": "追加の文脈が必要です。",
    "Electric vehicles have no tailpipe emissions, but electricity generation and manufacturing can still produce emissions. This is a prewritten example, not a live check.": "電気自動車は走行時に排気ガスを出しませんが、発電や製造の過程では排出が生じます。これは事前に用意した例であり、実際の調査結果ではありません。",
    "This example is generally supported.": "このサンプルの主張には支持する根拠があります。",
    "Oxygen is necessary for typical human cellular respiration. This is a prewritten example, not a live check.": "通常の人の細胞呼吸には酸素が必要です。これは事前に用意した例であり、実際の調査結果ではありません。",
    "This example contradicts established science.": "このサンプルの主張は、確立された科学的知見と矛盾します。",
    "Earth orbits the Sun. This is a prewritten example, not a live check.": "地球は太陽の周りを公転しています。これは事前に用意した例であり、実際の調査結果ではありません。",
    "Your highlight is ready to investigate.": "選択した文章を調べる準備ができました。",
    "You're viewing the design preview. Connect your own Cloud Run endpoint in Mikata's toolbar popup to check arbitrary claims with real sources.": "デザインのプレビューです。実際の出典を使って調べるには、ポップアップで Cloud Run の接続先を設定してください。",
    "Documented origins establish attribution only; distinct artifacts may share underlying data.": "参照先の記録は帰属関係のみを示します。異なる資料でも同じ元データを使っている場合があります。",
    "Positive independence means inspected primary studies document independent replication with new data; it is not a raw-data audit.": "独立性の確認は、調査した一次研究に新たなデータでの独立した追試の記載があることを意味します。生データの監査ではありません。",
    "Canonical tags, publication dates and duplicated text are hints, not proof of dependence.": "正規 URL、公開日、文章の類似は手がかりであり、依存関係の証明ではありません。",
    "Linked origins are not fetched unless included among the bounded discovery sources.": "参照先の資料は、調査対象として選ばれたものだけを取得します。",
    "Factual assessment is AI-assisted and separate from source provenance.": "事実の評価は AI による補助であり、出典関係の確認とは別です。",
    "Search may miss relevant sources. At most six grounding sources plus two publisher candidates are inspected.": "検索で関連する情報源が見つからない場合があります。検索の出典は最大 6 件、追加の候補ページは最大 2 件を調査します。",
    "Fetched research candidates are not grounding attributions and are not proof of independent provenance.": "取得できた候補ページは、Google の出典や情報源の独立性を証明するものではありません。"
  });
  const errorCodes = {
    AUTH_REQUIRED: "Mikata にログインしてください。", INVALID_SESSION: "ログインの有効期限が切れました。再度ログインしてください。", EMAIL_NOT_VERIFIED: "メールを認証してから、認証状態を更新してください。",
    AUTH_UNAVAILABLE: "ログイン情報を確認できません。しばらくしてから試してください。", QUOTA_UNAVAILABLE: "利用回数を確認できません。しばらくしてから試してください。",
    DAILY_QUOTA_EXCEEDED: "本日の利用上限に達しました。翌日のリセット後にお試しください。", SERVICE_DAILY_QUOTA_EXCEEDED: "サービス全体の本日の利用上限に達しました。翌日のリセット後にお試しください。",
    RATE_LIMITED: "リクエストが多すぎます。少し待ってから試してください。", BUSY: "現在混み合っています。少し待ってから試してください。",
    PROVIDER_UNAVAILABLE: "Google の調査を完了できませんでした。短い主張で試すか、少し待ってから試してください。", PROVIDER_RATE_LIMITED: "Google が混み合っています。少し待ってから試してください。",
    RESEARCH_UNAVAILABLE: "調査を完了できませんでした。しばらくしてから試してください。", REQUEST_TIMEOUT: "確認がタイムアウトしました。もう一度試してください。", NETWORK_ERROR: "接続できませんでした。ネットワークを確認して、もう一度試してください。",
    CLOUD_AUTH_ERROR: "調査サービスが Google に接続できません。運営者にお問い合わせください。", MODEL_UNAVAILABLE: "調査用の AI モデルを利用できません。運営者にお問い合わせください。", SERVICE_NOT_CONFIGURED: "サービスの設定が完了していません。運営者にお問い合わせください。", INVALID_INPUT: "入力内容を確認してください。", RESEARCH_REQUEST_REJECTED: "Google が調査リクエストを受け付けませんでした。短い主張で試してください。"
  };
  let language = 'en';
  const listeners = new Set();
  const valid = code => code === 'ja' ? 'ja' : 'en';
  function t(key, values = {}) {
    const message = language === 'ja' ? ja[key] || key : key;
    return String(message).replace(/\{(\w+)\}/g, (all, name) => Object.hasOwn(values, name) ? String(values[name]) : all);
  }
  function apply(code) {
    code = valid(code);
    if (code === language) return;
    language = code;
    for (const listener of listeners) listener(language);
  }
  const storage = globalThis.chrome?.storage?.local;
  const ready = (async () => {
    try { apply(storage ? (await storage.get('mikataLanguage')).mikataLanguage : globalThis.localStorage?.getItem('mikataLanguage')); }
    catch (_) { /* Storage unavailable: retain English for this session. */ }
  })();
  if (storage && globalThis.chrome.storage.onChanged) chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.mikataLanguage) apply(changes.mikataLanguage.newValue);
  });
  if (!storage && globalThis.addEventListener) globalThis.addEventListener('storage', event => {
    if (event.key === 'mikataLanguage') apply(event.newValue);
  });
  async function setLanguage(code) {
    if (!['en','ja'].includes(code)) throw new Error('Unsupported language');
    await ready;
    if (storage) await storage.set({mikataLanguage:code});
    else globalThis.localStorage?.setItem('mikataLanguage',code);
    apply(code);
  }
  function bind(root) {
    const document = root.ownerDocument || root;
    const records = [];
    const walker = document.createTreeWalker(root, 4); // text only
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest('script,style,[data-no-i18n]')) continue;
      const key = node.textContent.trim();
      if (Object.hasOwn(ja,key)) records.push([node,'textContent',key,node.textContent]);
    }
    for (const element of [root,...root.querySelectorAll('*')]) {
      for (const attr of ['aria-label','placeholder','title','alt']) {
        const key=element.getAttribute?.(attr);
        if (key && Object.hasOwn(ja,key)) records.push([element,attr,key,null]);
      }
    }
    const render = () => {
      root.lang = language;
      for (const [node,attr,key,original] of records) {
        if (!node.isConnected) continue;
        const translated=t(key);
        if (attr==='textContent') node.textContent=original.replace(key,()=>translated);
        else node.setAttribute(attr,translated);
      }
    };
    listeners.add(render); render(); ready.then(render);
    return () => listeners.delete(render);
  }
  function mountSwitch(parent) {
    const document=parent.ownerDocument;
    const group=document.createElement('div');group.className='mikata-language-switch';group.setAttribute('role','group');group.setAttribute('aria-label','Language / 言語');
    const buttons=['en','ja'].map(code=>{
      const button=document.createElement('button');button.type='button';button.lang=code;button.textContent=code==='en'?'English':'日本語';
      button.addEventListener('click',()=>setLanguage(code).catch(()=>{ group.title=code==='ja'?'言語設定を保存できませんでした。':'Could not save language preference.'; }));
      group.append(button);return button;
    });
    const render=()=>buttons.forEach((button,index)=>button.setAttribute('aria-pressed',String(language===(index?'ja':'en'))));
    listeners.add(render);render();ready.then(render);parent.append(group);return group;
  }
  globalThis.MikataI18n={t,ready,bind,inspection(source){
    if (language==='ja' && source.inspection_error_code) {
      const code=source.inspection_error_code;
      if (Object.hasOwn(ja,code)) return t(code);
      if (/^HTTP_\d{3}$/.test(code)) return 'ページを取得できませんでした（'+code.replace('_',' ')+ '）。';
    }
    return t(source.inspection_error || 'Page could not be inspected');
  },mountSwitch,setLanguage,get language(){return language;},onChange(fn){listeners.add(fn);return ()=>listeners.delete(fn);},error(result){return language==='ja' ? errorCodes[result?.code] || t(result?.error || 'Research unavailable.') : result?.error || 'Research unavailable.';}};
})();
