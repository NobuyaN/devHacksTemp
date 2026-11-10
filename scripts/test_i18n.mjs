// Local dictionary/DOM fixtures only. No Google calls, browser profile or claims of live accuracy.
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const code=readFileSync(new URL('../extension/i18n.js',import.meta.url),'utf8');
function fixture(saved='en', shared=null){
  const dom=new JSDOM('<html lang="en"><body><div id="switch"></div><button id="signin"><span aria-hidden="true">✿</span> Sign in</button><input placeholder="Password"><p id="evidence" data-no-i18n>Sign in</p></body></html>',{url:'https://fixture.example',runScripts:'outside-only'});
  const state=shared || {value:saved,listeners:[]};
  dom.window.chrome={storage:{local:{get:async()=>({mikataLanguage:state.value}),set:async values=>{state.value=values.mikataLanguage;state.listeners.forEach(fn=>fn({mikataLanguage:{newValue:state.value}},'local'));}},onChanged:{addListener:fn=>state.listeners.push(fn)}}};
  dom.window.eval(code);const api=dom.window.MikataI18n;
  api.mountSwitch(dom.window.document.querySelector('#switch'));api.bind(dom.window.document.documentElement);
  return {dom,api,state,document:dom.window.document};
}
test('switch saves Japanese and English, preserves markup/input/evidence, and restores the preference',async t=>{
  const p=fixture();t.after(()=>p.dom.window.close());await p.api.ready;
  p.document.querySelector('input').value='Untouched user input';
  await p.api.setLanguage('ja');
  assert.equal(p.state.value,'ja');assert.equal(p.document.documentElement.lang,'ja');
  assert.match(p.document.querySelector('#signin').textContent,/ログイン/);
  assert.equal(p.document.querySelector('#signin span').textContent,'✿');
  assert.equal(p.document.querySelector('input').placeholder,'パスワード');
  assert.equal(p.document.querySelector('input').value,'Untouched user input');
  assert.equal(p.document.querySelector('#evidence').textContent,'Sign in');
  assert.equal(p.document.querySelector('[lang="ja"][aria-pressed="true"]').textContent,'日本語');
  const reopened=fixture('ja');t.after(()=>reopened.dom.window.close());await reopened.api.ready;
  assert.match(reopened.document.querySelector('#signin').textContent,/ログイン/);
  await p.api.setLanguage('en');assert.equal(p.document.documentElement.lang,'en');
  assert.match(p.document.querySelector('#signin').textContent,/Sign in/);
  assert.equal(p.document.querySelector('input').placeholder,'Password');
});
test('extension preference changes synchronize between contexts without touching account storage',async t=>{
  const shared={value:'en',listeners:[]};const popup=fixture('en',shared),sidebar=fixture('en',shared);
  t.after(()=>{popup.dom.window.close();sidebar.dom.window.close();});
  await Promise.all([popup.api.ready,sidebar.api.ready]);await popup.api.setLanguage('ja');
  assert.equal(sidebar.api.language,'ja');assert.equal(shared.value,'ja');
  await sidebar.api.setLanguage('en');assert.equal(popup.api.language,'en');
  await assert.rejects(popup.api.setLanguage('arbitrary instruction'));
});
test('Japanese error labels preserve the distinction between auth, quota and provider errors',async t=>{
  const p=fixture('ja');t.after(()=>p.dom.window.close());await p.api.ready;
  assert.match(p.api.error({code:'AUTH_REQUIRED',error:'Fixture'}),/ログイン/);
  assert.match(p.api.error({code:'DAILY_QUOTA_EXCEEDED',error:'Fixture'}),/本日の利用上限/);
  assert.match(p.api.error({code:'PROVIDER_UNAVAILABLE',error:'Fixture'}),/Google/);
  assert.match(p.api.inspection({inspection_error_code:'ROBOTS_DISALLOWED'}),/robots/);
  assert.equal(p.api.t('{count} checks left today',{count:99}),'本日の残り 99 回');
});
test('dashboard and extension share exactly the same translation implementation',()=>{
  assert.equal(code,readFileSync(new URL('../landing/i18n.js',import.meta.url),'utf8'));
});

test('dashboard switch localizes controls and requests Japanese without translating citations or repeating checks',async t=>{
  const html=readFileSync(new URL('../landing/index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../landing/app.js',import.meta.url),'utf8');
  const dom=new JSDOM(html,{url:'https://fixture-project.web.app/',runScripts:'outside-only'});t.after(()=>dom.window.close());
  const w=dom.window;const calls=[];
  w.SOURCELENS_CONFIG={authRequired:true,apiOrigin:'https://fixture-project.web.app'};
  w.SourceLensAuth={token:async()=>'fixture-token',status:async()=>({signedIn:true,email:'user@example.test',emailVerified:true})};
  w.fetch=async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>({language:'ja',results:[{claim:{text:'地球は太陽の周りを公転しています。'},assessment:'SUPPORTED',evidence_summary:'根拠による支持があります。',explanation:'これはテスト用の説明です。',sources:[{title:'Privacy',url:'https://source.example/report',inspection_status:'unverified'}],independence:{total_articles_inspected:0,documented_origin_count:0,confirmed_dependent_articles:0,sources_with_unresolved_independence:['fixture'],confirmed_distinct_evidence_origins:0,dependencies:[]},grounding:{},limitations:[]}]})};};
  w.eval(code);w.eval(app);await w.MikataI18n.ready;await w.MikataI18n.setLanguage('ja');
  assert.equal(w.document.documentElement.lang,'ja');assert.match(w.document.querySelector('h1').textContent,/情報の出典/);
  assert.equal(w.document.querySelector('label[for="claim"]').textContent,'選択した文章、または確認したい主張');
  w.document.querySelector('#claim').value='地球は太陽の周りを公転しています。';
  w.document.querySelector('#check').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  for(let n=0;n<100 && !w.document.querySelector('#results article');n++) await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(calls.length,1);assert.equal(calls[0].language,'ja');
  assert.equal(w.document.querySelector('#results a').textContent,'Privacy');
  assert.match(w.document.querySelector('#results strong').textContent,/支持/);
  await w.MikataI18n.setLanguage('en');
  assert.equal(w.document.querySelector('h1').textContent,'Look closer at the source.');
  assert.equal(calls.length,1);assert.match(w.document.querySelector('#results').textContent,/テスト用の説明/);
  assert.equal(w.document.querySelector('#results a').textContent,'Privacy');
});
