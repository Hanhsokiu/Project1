'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../../..'),old='step7-live-20261028-1426',name='step7-fixes-20261028-1933',cache=path.join(root,'.cache',name);
fs.mkdirSync(cache,{recursive:true});
if(!fs.existsSync(path.join(cache,'mcp-credential.json')))fs.writeFileSync(path.join(cache,'mcp-credential.json'),JSON.stringify({username:'qa-student2',password:'Qa7!'+crypto.randomBytes(18).toString('hex')}),{flag:'wx',mode:0o600});
for(const file of ['protect-main.cjs','private-db.cjs','stop.cjs','browser-common.cjs','helpers.cjs','workflow.cjs','scope-boundaries.cjs','lifecycle.cjs','supplemental.cjs','pdf-visual.cjs']){
 let source=fs.readFileSync(path.join(root,'docs/qa-step-4-8/evidence',old,'harness',file),'utf8').replaceAll(old,name).replaceAll('btl_pr2b_step7_','btl_pr2b_step7fix_').replaceAll('50185','50186');
 if(file==='browser-common.cjs')source=source.replace("for(const p of c.pages()){try{", "for(const p of c.pages()){if(!p.url().startsWith(ready.frontend))continue;try{");
 fs.writeFileSync(path.join(__dirname,file),source);
}
let live=fs.readFileSync(path.join(root,'docs/qa-step-4-8/evidence',old,'harness/launch-default.cjs'),'utf8').replaceAll(old,name).replaceAll('btl_pr2b_step7_','btl_pr2b_step7fix_').replaceAll('50185','50186');
// The application fields are populated only in a freshly guarded synthetic database.
live=live.replace('    const coreHash = hash(await coreSnapshot(db));', `    await db.student.updateMany({data:{cohort:'K63',phone:'0912345678'}});\n    await db.lecturer.updateMany({data:{phone:'0987654321'}});\n    const coreHash = hash(await coreSnapshot(db));`);
fs.writeFileSync(path.join(__dirname,'live.cjs'),live);
console.log('Prepared fresh isolated STEP7 fix harness.');
