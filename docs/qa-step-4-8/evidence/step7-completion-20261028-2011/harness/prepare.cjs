'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../../../..'),out=path.dirname(__dirname),previous=path.join(root,'docs/qa-step-4-8/evidence/step7-fixes-20261028-1933'),cache=path.join(root,'.cache/step7-fixes-20261028-1933');
for(const file of ['private-db.cjs','browser-common.cjs','helpers.cjs','protect-main.cjs','api.cjs','stop.cjs']) {
  let source=fs.readFileSync(path.join(previous,'harness',file),'utf8');
  if(file==='stop.cjs')source=source.replaceAll('50186','50187');
  fs.writeFileSync(path.join(__dirname,file),source);
}
const ready=JSON.parse(fs.readFileSync(path.join(previous,'live-ready.json'),'utf8'));
assert(/^btl_pr2b_step7fix_.*_live$/.test(ready.database));
fs.writeFileSync(path.join(out,'live-ready.json'),JSON.stringify({...ready,frontend:'http://127.0.0.1:50187'},null,2));
const stop=path.join(cache,'stop');if(fs.existsSync(stop))fs.unlinkSync(stop);
let resume=fs.readFileSync(path.join(root,'docs/qa-step-4-8/evidence/step7-live-20261028-1426/harness/resume.cjs'),'utf8').replaceAll('.cache/step7-live-20261028-1426','.cache/step7-fixes-20261028-1933').replaceAll('btl_pr2b_step7_','btl_pr2b_step7fix_').replaceAll('50185','50187');
fs.writeFileSync(path.join(__dirname,'resume.cjs'),resume);
console.log('Prepared continuation on existing private test DB; no seeding/migration.');
