const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../../../..'),previous=path.join(root,'docs/qa-step-4-8/evidence/step5-fixes-20261028-0926/harness');
for(const name of ['protect-main.cjs','private-db.cjs','stop.cjs','browser-common.cjs']){
 let source=fs.readFileSync(path.join(previous,name),'utf8').replaceAll('step5-fixes-20261028-0926','step6-local-20261028-0953').replaceAll('btl_pr2b_step5_','btl_pr2b_step6_');
 fs.writeFileSync(path.join(__dirname,name),source);
}
console.log('Prepared isolated STEP6 QA helpers; application files untouched.');
