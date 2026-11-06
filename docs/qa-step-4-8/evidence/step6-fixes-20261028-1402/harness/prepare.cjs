const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'../../../../..'),old='step6-local-20261028-0953',name='step6-fixes-20261028-1402';
for(const file of ['protect-main.cjs','private-db.cjs','stop.cjs','browser-common.cjs','helpers.cjs']){
 const source=fs.readFileSync(path.join(root,'docs/qa-step-4-8/evidence',old,'harness',file),'utf8').replaceAll(old,name).replaceAll('btl_pr2b_step6_','btl_pr2b_step6fix_');fs.writeFileSync(path.join(__dirname,file),source);
}
let launcher=fs.readFileSync(path.join(root,'docs/qa-step-4-8/evidence',old,'harness/launch.cjs'),'utf8').replaceAll(old,name).replaceAll('btl_pr2b_step6_','btl_pr2b_step6fix_').replace(".replace('scripts/test-proposal-reviews.cjs','scripts/test-proposal-versions.cjs')",".replace('scripts/test-proposal-reviews.cjs',process.env.STEP6_REGRESSION === 'true' ? 'scripts/test-proposal-versions.cjs' : 'scripts/test-proposal-lifecycle.cjs')");
fs.writeFileSync(path.join(__dirname,'launch.cjs'),launcher);
console.log('Prepared fresh isolated targets and read-only main DB checks.');
