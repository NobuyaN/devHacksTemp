"""Build a self-configuring extension and Firebase site. No deployment or secrets."""
import argparse
import html
import ipaddress
import json
import re
import shutil
import zipfile
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


def build(config, output):
    project = config.get('projectId', '')
    origin = config.get('apiOrigin', '')
    api_key = config.get('firebaseApiKey', '')
    support = config.get('supportEmail', '')
    if support and not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', support):
        raise ValueError('supportEmail must be blank or an email approved for public display')
    parsed = urlsplit(origin)
    if not re.fullmatch(r'[a-z][a-z0-9-]{4,28}[a-z0-9]', project):
        raise ValueError('A valid Firebase projectId is required')
    if (parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password
            or parsed.port not in (None, 443) or parsed.path not in ('', '/') or parsed.query or parsed.fragment
            or parsed.hostname in ('localhost','127.0.0.1','::1')):
        raise ValueError('apiOrigin must be the approved public HTTPS service origin')
    if not re.fullmatch(r'AIza[0-9A-Za-z_-]{35}', api_key):
        raise ValueError('Use the Firebase Auth Web API key from the Firebase web app configuration, not a Gemini key')
    try:
        ipaddress.ip_address(parsed.hostname)
    except ValueError:
        pass
    else:
        raise ValueError('Use the public service hostname, not an IP address')
    origin = 'https://' + parsed.hostname.encode('idna').decode().lower().rstrip('.')
    public = dict(projectId=project, apiOrigin=origin, firebaseApiKey=api_key, authRequired=True)
    output = Path(output).resolve()
    protected = [ROOT/name for name in ('extension','landing','backend','scripts','deployment','docs','.git')]
    if any(output == path or path in output.parents or output in path.parents for path in protected):
        raise ValueError('Choose a separate build output directory outside source folders')
    if output.exists() and any(output.iterdir()):
        raise ValueError('Build output must be empty; use a new output directory')
    extension, hosting = output / 'extension', output / 'hosting'
    extension.mkdir(parents=True)
    hosting.mkdir()
    for source in (ROOT/'extension').rglob('*'):
        relative = source.relative_to(ROOT/'extension')
        root_files = {'manifest.json','config.js','i18n.js','auth.js','background.js','content.js','content.css','popup.html','popup.css','popup.js','README.md'}
        asset = relative.parts[0] in ('icons','assets') and source.suffix.lower() in ('.png','.svg','.jpg','.jpeg','.webp','.ico','.gif')
        if source.is_file() and not source.is_symlink() and (str(relative) in root_files or asset):
            target = extension/source.relative_to(ROOT/'extension')
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
    config_js = 'globalThis.SOURCELENS_CONFIG = Object.freeze(' + json.dumps(public) + ');\n'
    (extension/'config.js').write_text(config_js)
    manifest = json.loads((extension/'manifest.json').read_text())
    manifest['host_permissions'] = [origin+'/*','https://identitytoolkit.googleapis.com/*','https://securetoken.googleapis.com/*']
    (extension/'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False)+'\n')
    (extension/'README.md').write_text('''# Mikata hosted beta

1. Unzip this package and remove/disable any older Mikata extension in this profile.
2. Open chrome://extensions, enable Developer mode, and select Load unpacked.
3. Select this folder (the one containing manifest.json).
4. Open Mikata, create a Mikata account, verify your email, then click Refresh verified session.
5. Refresh an ordinary article page, select a factual sentence, and click Check with mikata.

No local server, CLI, Google Cloud account, or project ID is required.
Each Chrome profile signs in separately. Choose English or 日本語 in the popup or sidebar; the preference is saved for that profile. Switching languages does not start research. New checks request explanations in the selected language; existing results keep their original text. Checks start only when you explicitly submit a claim.
Beta limits: 100 research requests per verified account per UTC day, subject to a shared 100-request daily allowance. Failed reserved research can count.

The factual verdict and source independence are separate. Blocked or inaccessible sources remain unresolved; different domains do not prove independence. This prototype does not guarantee truth or general independence verification.
Selected text/page title are processed by Google Cloud. Avoid confidential content.
This is an unpacked beta, not a Chrome Web Store publication.

Dashboard: ''' + origin + '/\nPrivacy: ' + origin + '/privacy.html\n')
    for source in (ROOT/'landing').iterdir():
        if source.is_file() and source.name in ('index.html','sample-article.html','app.js','style.css','i18n.js'):
            shutil.copyfile(source, hosting/source.name)
    (hosting/'config.js').write_text(config_js)
    shutil.copyfile(ROOT/'extension/auth.js',hosting/'auth.js')
    shutil.copyfile(ROOT/'extension/i18n.js',hosting/'i18n.js')
    index = (hosting/'index.html').read_text().replace('<script src="app.js" defer>', '<script src="config.js" defer></script><script src="auth.js" defer></script><script src="app.js" defer>')
    index = index.replace('<h1>', '<p><a href="install.html">Install the Chrome extension</a></p><h1>', 1)
    index = index.replace('Install the Chrome extension</a>', 'Install the Chrome extension</a> · <a href="privacy.html">Privacy</a>')
    (hosting/'index.html').write_text(index)
    contact = ('<p>Contact: <a href="mailto:' + html.escape(support, quote=True) + '">' + html.escape(support) + '</a></p>') if support else ''
    (hosting/'privacy.html').write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mikata beta privacy</title><link rel="stylesheet" href="style.css"><main><h1>How the beta handles your data</h1><p>When you explicitly check text or upload an image, the selected content is sent to our Google Cloud backend and Gemini for research. The extension also sends the page title, but not the complete page URL or full article. No background article scanning is performed.</p><p>Firebase Authentication manages your email/password account. The extension keeps sign-in tokens and your email in trusted browser-session storage, and keeps endpoint preferences and your interface language in local extension storage. The dashboard saves its language preference in that website’s local storage. Passwords are not stored by this extension or our backend.</p><p>The backend does not persist submitted claims, image bytes or article text. Firestore stores daily usage counts keyed by a hash of your account identifier, plus global counts. Those records are scheduled to expire after 30 days; Firestore TTL deletion can occur later. Quota reservations can count even if research later fails. Google processes account and AI data under its own applicable service terms.</p><p>Research requests retrieve public evidence URLs from third-party publishers where automated access is permitted. Citation links take you to those sites, which have their own data practices. Avoid submitting confidential or sensitive content. AI verdicts may be wrong, and source independence can remain unresolved.</p><p>You can sign out or delete your Mikata account in the extension popup. Account deletion may require signing in again; usage records expire separately as described above.</p>''' + contact + '''<a href="install.html">Extension installation</a></main></html>''')
    downloads = hosting/'downloads'
    downloads.mkdir()
    archive = downloads/'mikata-extension.zip'
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as package:
        for source in sorted(extension.rglob('*')):
            if source.is_file():
                info = zipfile.ZipInfo(source.relative_to(extension).as_posix(), date_time=(2026,1,1,0,0,0))
                info.create_system = 3
                info.external_attr = 0o100644 << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                package.writestr(info, source.read_bytes())
    versioned_archive = downloads / ('mikata-extension-' + manifest['version'] + '.zip')
    shutil.copyfile(archive, versioned_archive)
    (hosting/'install.html').write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Install Mikata beta</title><link rel="stylesheet" href="style.css"><main><h1>Check claims while you read.</h1><p>This is a beta. Research is AI-assisted and source independence can remain unresolved.</p><ol><li><a href="downloads/mikata-extension.zip">Download the beta extension</a> and unzip it.</li><li>In Chrome, open chrome://extensions and turn Developer mode on.</li><li>Click Load unpacked and select the unzipped folder containing manifest.json.</li><li>Open Mikata from the Extensions menu. Create a Mikata account, verify your email, and refresh your session.</li><li>Refresh an ordinary article page, select a sentence and choose Check with mikata.</li></ol><p>No cloud account, CLI, project ID or local server is required for users of the deployed service. Checks start only when you explicitly submit a claim. This package is not a Chrome Web Store listing; store publication requires separate review.</p><p>The initial beta allows 100 research requests per verified account per UTC day, subject to a shared allowance of 100 requests per UTC day across all users. Text or images submitted for research are processed by Google Cloud. Avoid confidential content. Account data is managed by Firebase Authentication; the backend stores quota counters, not submitted claim text.</p><a href="index.html">Open the optional dashboard</a></main></html>''')
    install = (hosting/'install.html').read_text()
    install = install.replace('downloads/mikata-extension.zip', 'downloads/' + versioned_archive.name)
    install = install.replace('Download the beta extension', 'Download Mikata ' + manifest['version'])
    (hosting/'install.html').write_text(install)
    shutil.copyfile(ROOT/'deployment/firestore.rules', output/'firestore.rules')
    firebase = json.loads((ROOT/'firebase.json').read_text())
    firebase['hosting']['public'] = 'hosting'
    firebase['firestore'] = [{'database':'sourcelens','rules':'firestore.rules'}]
    # Mutable entry points must revalidate. Versioned ZIPs also give existing
    # browsers a fresh URL even if they cached the old alias before this policy.
    for source in ('/downloads/mikata-extension.zip', '/', '/index.html', '/install.html', '/app.js', '/i18n.js', '/config.js'):
        firebase['hosting']['headers'].append({'source':source,'headers':[
            {'key':'Cache-Control','value':'no-cache, max-age=0, must-revalidate'}]})
    csp = None
    for group in firebase['hosting'].get('headers', []):
        for header in group.get('headers', []):
            if header['key'] == 'Content-Security-Policy':
                csp = header['value'].replace(' http://localhost:8080', '').replace(' http://127.0.0.1:8080', '').replace("connect-src 'self'", "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com")
        group['headers'] = [h for h in group.get('headers', []) if h['key'] != 'Content-Security-Policy']
    # Do not impose the app CSP on Firebase's reserved email-action handlers.
    if csp:
        for source in ('/', '/index.html', '/install.html', '/privacy.html', '/sample-article.html'):
            firebase['hosting']['headers'].append({'source': source, 'headers':[{'key':'Content-Security-Policy','value':csp}]})
    (output/'firebase.json').write_text(json.dumps(firebase,indent=2)+'\n')
    return {'extension':str(extension), 'hosting':str(hosting), 'archive':str(archive), 'versioned_archive':str(versioned_archive), 'firebase_config':str(output/'firebase.json')}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    try:
        result = build(json.loads(args.config.read_text()), args.output)
    except ValueError as exc:
        parser.error(str(exc))
    print(json.dumps(result,indent=2))
