// Real popup DOM with mocked Chrome account messages; no credentials/network.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('../extension/popup.html',import.meta.url),'utf8');
const code=readFileSync(new URL('../extension/popup.js',import.meta.url),'utf8');
async function until(fn) { for(let i=0;i<100;i++){if(fn())return;await delay(5);} throw new Error('Popup fixture timed out'); }
test('fresh public profile gets sign-in UI and pinned service, not endpoint configuration',async t=>{
  const dom=new JSDOM(html,{url:'https://fixture-extension.example/popup.html',runScripts:'outside-only'});
  t.after(()=>dom.window.close()); const w=dom.window; const calls=[];
  w.SOURCELENS_CONFIG={authRequired:true,apiOrigin:'https://fixture-project.web.app'};
  w.chrome={storage:{local:{get:async()=>({}),set:async()=>{},remove:async()=>{}}},tabs:{query:async()=>[{id:1,url:'https://article.example/'}]},runtime:{sendMessage:async message=>{
    calls.push(message);
    return message.type==='MIKATA_AUTH_SIGN_UP' ? {signedIn:true,email:'user@example.test',emailVerified:false,verificationSent:true} : {signedIn:false};
  }}};
  w.eval(code);const get=id=>w.document.getElementById(id);
  await until(()=>get('settings').hidden && /Create|create/.test(get('account-status').textContent));
  assert.equal(get('account-panel').hidden,false);
  assert.equal(get('api-url').value,'https://fixture-project.web.app');
  assert.equal('password' in calls[0],false);
  get('account-email').value='user@example.test';get('account-password').value='fixture-password';get('account-create').click();
  await until(()=>get('account-form').hidden);
  assert.match(get('account-status').textContent,/Verify the email/);
  assert.equal(get('account-password').value,'');
  assert.equal(calls[1].type,'MIKATA_AUTH_SIGN_UP');
});
