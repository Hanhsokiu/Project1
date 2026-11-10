'use strict';
// Serve the production artifact locally; no database, auth credentials, or shared API connection.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {root}=require('./local.cjs');
async function main(){
 const build=path.join(root,'.cache/real-time-production-build');assert(fs.existsSync(path.join(build,'index.html')));
 for (const file of fs.readdirSync(path.join(build,'assets')).filter(f=>f.endsWith('.js'))) {
  const bytes=fs.readFileSync(path.join(build,'assets',file),'utf8');
  assert(!/\/acceptance\/clock|Chuyển đồng hồ TEST|Demo@2026|acpt_\d{8,}/.test(bytes),'Production asset contains test controls or demo credentials');
 }
 let clockRequests=0,browser;
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  if(pathname.startsWith('/api/')){
   if(pathname.startsWith('/api/acceptance/'))clockRequests++;
   res.writeHead(404,{'Content-Type':'application/json'});res.end('{}');return;
  }
  let file=path.resolve(build,'.'+decodeURIComponent(pathname));
  if(!file.startsWith(build+path.sep)){file=path.join(build,'index.html');}
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(build,'index.html');
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
 });
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const {chromium}=require('../../node_modules/playwright-core');browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/login');
  await page.locator('input[type="password"]').waitFor();
  assert.equal(await page.getByText('Chuyển đồng hồ TEST',{exact:true}).count(),0);
  assert.equal(await page.getByText('Chuyển giai đoạn nghiệm thu (FACULTY TEST)',{exact:true}).count(),0);
  assert.equal(clockRequests,0);
  const result={status:'PASS',productionBuild:true,acceptanceFlagDeliberatelySetAtBuild:true,
   testClockControlsVisible:false,acceptanceApiRequests:0,productionConnected:false};
  fs.writeFileSync(path.join(root,'.cache/real-time-production-ui.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
if(require.main===module)main().catch(()=>{console.error('PRODUCTION_CLOCK_UI_CHECK_FAILED');process.exitCode=1;});
