"use strict";
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../../../..'), out = path.dirname(__dirname);
const {chromium, expect} = require(path.join(root,'node_modules/@playwright/test'));
const AxeBuilder = require(path.join(root,'node_modules/@axe-core/playwright')).default;
const ready = JSON.parse(fs.readFileSync(path.join(out,'live-ready.json'),'utf8'));
assert(ready.syntheticOnly && /^btl_pr2b_step5_.*_live$/.test(ready.database));
assert.equal(new URL(ready.frontend).hostname,'127.0.0.1');
const password = fs.readFileSync(path.join(root,'docs/implementation/integration-ui-workflow-demo.md'),'utf8').match(/Mật khẩu chung: \*\*([^*]+)\*\*/)[1];
const clean = v => String(v).replaceAll(password,'[REDACTED]').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED JWT]').replace(/postgres(?:ql)?:\/\/[^\s]+/gi,'[REDACTED DATABASE URL]');
const save = (name,data) => fs.writeFileSync(path.join(out,name),clean(JSON.stringify(data,null,2))+'\n');
const brief = r => ({id:r.id,proposalId:r.proposalId,state:r.state,proposalStatus:r.proposalStatus,revision:r.revision,proposalRevision:r.proposalRevision,roundNumber:r.roundNumber,versionId:r.versionId,contentHash:r.version?.contentHash,groupId:r.groupId,allowedActions:r.allowedActions,comments:r.comments,decision:r.decision,supersededByReviewId:r.supersededByReviewId});
async function session(suite) {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const checkpoints=[], events=[], contexts=[]; let phase='initial';
  const persist=()=>{save(suite+'-checkpoints.json',checkpoints);save(suite+'-browser-log.json',events);};
  const mark=(id,detail)=>{checkpoints.push({id,result:'PASS',at:new Date().toISOString(),detail});persist();console.log('PASS '+id);};
  const fail=(id,e)=>{checkpoints.push({id,result:'FAIL',at:new Date().toISOString(),error:clean(e.stack||e)});persist();console.log('FAIL '+id+': '+clean(e.message));};
  async function check(id,fn){phase=id;try{mark(id,await fn());}catch(e){fail(id,e);}}
  async function actor(user,target='/topic/reviews?termId=qa-t1') {
    phase='login-'+user;
    const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh'});contexts.push(context);
    const page=await context.newPage();page.setDefaultTimeout(12000);
    page.on('pageerror',e=>{events.push({user,phase,kind:'pageerror',message:clean(e.message)});persist();});
    page.on('console',m=>{if(['error','warning'].includes(m.type())){events.push({user,phase,kind:'console-'+m.type(),message:clean(m.text())});persist();}});
    page.on('requestfailed',r=>{events.push({user,phase,kind:'requestfailed',method:r.method(),url:r.url(),error:r.failure()?.errorText});persist();});
    page.on('response',r=>{if(r.status()>=400){events.push({user,phase,kind:'http-error',method:r.request().method(),url:r.url(),status:r.status()});persist();}});
    await page.goto(ready.frontend+target);
    await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
    if(contexts.length===1){await page.screenshot({path:path.join(out,suite+'-login.png'),fullPage:true});await page.getByRole('button',{name:'Hiện mật khẩu',exact:true}).click();await expect(page.locator('input[autocomplete="current-password"]')).toHaveAttribute('type','text');await page.getByRole('button',{name:'Ẩn mật khẩu',exact:true}).click();mark('browser-control',{browser:browser.version(),method:'local Playwright + real Edge',opened:page.url(),passwordToggle:true});}
    await page.locator('input[autocomplete="username"]').fill('qa-'+user);
    await page.locator('input[autocomplete="current-password"]').fill(password);
    await page.getByRole('button',{name:'Đăng nhập hệ thống',exact:true}).click();
    await page.waitForFunction(()=>sessionStorage.getItem('utc-api-access')!==null);
    await expect(page.locator('input[autocomplete="username"]')).toHaveCount(0);
    const token=await page.evaluate(()=>sessionStorage.getItem('utc-api-access'));
    async function api(endpoint,{method='GET',body,key=true}={}) {
      const headers={Authorization:'Bearer '+token};if(method!=='GET'&&key)headers['Idempotency-Key']=typeof key==='string'?key:crypto.randomUUID();
      const response=await context.request.fetch(ready.api+endpoint,{method,headers,...(body===undefined?{}:{data:body})});
      let payload;try{payload=await response.json();}catch{payload={nonJson:true};}
      return {status:response.status(),...payload};
    }
    async function data(endpoint){const r=await api(endpoint);assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.success,true);return r.data;}
    async function go(route,heading){await page.goto(ready.frontend+route);if(heading)await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();}
    async function detail(id){await go('/topic/reviews/'+id,'Kết luận chung của vòng');return data('/proposal-reviews/'+id);}
    return {user,page,context,api,data,go,detail};
  }
  async function shot(actor,name){await actor.page.screenshot({path:path.join(out,name+'.png'),fullPage:true});}
  async function axe(actor,name){const r=await new AxeBuilder({page:actor.page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();save(name+'-axe.json',{url:r.url,timestamp:r.timestamp,violations:r.violations,incomplete:r.incomplete,passes:r.passes.map(x=>x.id)});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}));}
  async function close(){for(const c of contexts){for(const p of c.pages()){try{await p.setViewportSize({width:1440,height:1000});const b=p.getByRole('button',{name:'Đăng xuất',exact:true});if(await b.isVisible()){await b.click();await expect(p.locator('input[autocomplete="username"]')).toBeVisible();}}catch(e){events.push({phase:'cleanup',kind:'logout-error',message:clean(e.message)});}}await c.close();}await browser.close();persist();save(suite+'-summary.json',{finishedAt:new Date().toISOString(),method:'local Playwright + real Edge',frontend:ready.frontend,database:ready.database,passed:checkpoints.filter(x=>x.result==='PASS').length,failed:checkpoints.filter(x=>x.result==='FAIL').length,consoleErrors:events.filter(x=>x.kind==='console-error').length,pageErrors:events.filter(x=>x.kind==='pageerror').length,failedRequests:events.filter(x=>x.kind==='requestfailed').length});}
  return {actor,mark,fail,check,shot,axe,close,setPhase:v=>{phase=v;}};
}
module.exports={session,save,brief,root,out,ready,assert,expect,clean};
