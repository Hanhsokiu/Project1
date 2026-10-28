const fs=require('node:fs'),path=require('node:path');
const old='step6-local-20261028-0953',name='step7-live-20261028-1426';
const root=path.resolve(__dirname,'../../../../..');
const source=fs.readFileSync(path.join(root,'docs/qa-step-4-8/evidence',old,'harness/resume.cjs'),'utf8')
 .replaceAll(old,name).replaceAll('btl_pr2b_step6_','btl_pr2b_step7_')
 .replace('assert(count>=53,','assert(count>=24,');
fs.writeFileSync(path.join(__dirname,'resume.cjs'),source);
console.log('Prepared resume of existing isolated STEP7 database; no seed/migration.');
