'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {cache}=require('./local.cjs');
async function main(){
 const runId=require(path.join(cache,'latest.json')).runId,dir=path.join(cache,runId),secret=require('./vault.cjs').read(runId),scope=require(path.join(dir,'manual.json'));
 const base='http://127.0.0.1:5180',status=await fetch(base+'/api/acceptance/status').then(r=>r.json());assert.equal(status.productionConnected,false);assert.equal(status.runId,runId);
 const {chromium}=require('../../node_modules/playwright-core'),browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
 try{for(const alias of ['faculty','student1','student2','advisor','reviewer','chair','secretary','member']){
  const account=secret.accounts.find(a=>a.alias==='manual/'+alias),context=await browser.newContext(),page=await context.newPage();
  await page.goto(base+'/login');await page.locator('input').filter({visible:true}).first().fill(account.username);await page.locator('input[type="password"]').fill(account.password);
  await page.locator('button[type="submit"]').click();await page.waitForURL(u=>!u.pathname.includes('login'),{timeout:30000});
  try { await page.getByText('STAGING — DỮ LIỆU TEST.',{exact:false}).waitFor(); } catch {
   fs.writeFileSync(path.join(dir,'browser-diagnostic.json'),JSON.stringify({alias,path:new URL(page.url()).pathname,text:(await page.locator('body').innerText()).slice(0,1600),status:await page.request.get(base+'/api/acceptance/status').then(r=>r.status())},null,2));
   throw Error('Staging banner missing for '+alias+'; diagnostic saved');
  }
  const route=alias==='faculty'?'/terms/'+scope.termId+'/phases':alias.startsWith('student')?'/registration':'/guidance/tasks';
  await page.goto(base+route);await page.waitForLoadState('networkidle');assert(!page.url().includes('/login'));
  if(alias==='faculty')await page.screenshot({path:path.join(dir,'manual-faculty.png'),fullPage:false});
  results.push({alias,role:account.role,login:'PASS',readRoute:route,status:'PASS'});await context.close();
 }
 }finally{await browser.close();}
 const r=await require('./runtime.cjs').createRuntime(runId,'manual');
 try{const db=r.db,counts={termStatus:(await db.thesisTerm.findUniqueOrThrow({where:{id:scope.termId}})).status,roster:await db.termStudent.count(),proposals:await db.proposal.count(),scores:await db.scoreEntry.count(),results:await db.finalResult.count(),accounts:await db.userAccount.count()};assert.equal(counts.termStatus,'DRAFT');assert.equal(counts.roster,0);assert.equal(counts.proposals,0);assert.equal(counts.scores,0);assert.equal(counts.results,0);assert.equal(counts.accounts,9);
  fs.writeFileSync(path.join(dir,'browser-smoke.json'),JSON.stringify({runId,status:'PASS',productionConnected:false,url:base+'/login',checks:results,manualState:counts},null,2));console.log(JSON.stringify({status:'PASS',logins:results.length,manualState:counts}));
 }finally{await r.app.close();}
}
if(require.main===module)main().catch(e=>{console.error('TEST_BROWSER_SMOKE_FAILED: '+e.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[REDACTED]'));process.exitCode=1;});
