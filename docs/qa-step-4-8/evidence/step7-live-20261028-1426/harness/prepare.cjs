const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../../..'),old='step6-local-20261028-0953',name='step7-live-20261028-1426',cache=path.join(root,'.cache',name);fs.mkdirSync(cache,{recursive:true});
if(!fs.existsSync(path.join(cache,'mcp-credential.json')))fs.writeFileSync(path.join(cache,'mcp-credential.json'),JSON.stringify({username:'qa-student2',password:'Qa7!'+crypto.randomBytes(18).toString('hex')}),{flag:'wx',mode:0o600});
for(const file of ['protect-main.cjs','private-db.cjs','stop.cjs','browser-common.cjs','helpers.cjs']){
 let source=fs.readFileSync(path.join(root,'docs/qa-step-4-8/evidence',old,'harness',file),'utf8').replaceAll(old,name).replaceAll('btl_pr2b_step6_','btl_pr2b_step7_');
 if(file==='browser-common.cjs')source=source.replace("const clean = v =>",`const mcpPassword=JSON.parse(fs.readFileSync(path.join(root,'.cache/${name}/mcp-credential.json'),'utf8')).password;\nconst clean = v =>`).replace("String(v).replaceAll(password,'[REDACTED]')","String(v).replaceAll(password,'[REDACTED]').replaceAll(mcpPassword,'[REDACTED QA CREDENTIAL]')").replace('.fill(password);','.fill(user===\'student2\'?mcpPassword:password);');
 fs.writeFileSync(path.join(__dirname,file),source);
}
const original=path.join(root,'docs/qa-step-4-8/evidence/step5-mcp-20261027-2153/harness/isolated.cjs');
let source=fs.readFileSync(original,'utf8').replaceAll('.cache/step5-mcp-20261027-2153','.cache/'+name).replaceAll('btl_pr2b_step5_','btl_pr2b_step7_').replace('const out = path.dirname(__dirname);','const out = path.join(root,"docs/qa-step-4-8/evidence/'+name+'");').replace('scripts/test-proposal-reviews.cjs',"scripts/"+(process.env.STEP7_UPGRADE==='true'?'test-proposal-dossier-upgrade.cjs':'test-proposal-dossiers.cjs')).replace('suite: "step5-api"','suite: "step7-api"').replace('["proposal", "proposalWorkflow", "proposalReview",','["proposal", "proposalWorkflow", "proposalVersion", "proposalVersionWorkflow", "proposalReview",');
// Choose script at execution time while keeping original assertions intact.
source=source.replace('const dir = path.join(out, "api");','const dir = path.join(out, process.env.STEP7_UPGRADE === "true" ? "upgrade" : "api");').replace('save("api-suite-summary.json",','save(process.env.STEP7_UPGRADE === "true" ? "upgrade-summary.json" : "api-suite-summary.json",').replace('save(kind + "-target.json",','save((kind === "api" && process.env.STEP7_UPGRADE === "true" ? "upgrade" : kind) + "-target.json",');
const anchor='    const coreHash = hash(await coreSnapshot(db));';
source=source.replace(anchor,fs.readFileSync(path.join(root,'docs/qa-step-4-8/evidence/step5-fixes-20261028-0926/harness/pagination-fixture.cjs'),'utf8')+`\n const qaMcp=JSON.parse(fs.readFileSync(path.join(cache,'mcp-credential.json'),'utf8'));await db.userAccount.update({where:{id:'student2'},data:{passwordHash:await req('bcryptjs').hash(qaMcp.password,10)}});\n`+anchor);
fs.writeFileSync(path.join(__dirname,'launch-'+(process.env.STEP7_UPGRADE==='true'?'upgrade':'default')+'.cjs'),source);
console.log('Prepared guarded STEP7 helpers and launcher; application unchanged.');
