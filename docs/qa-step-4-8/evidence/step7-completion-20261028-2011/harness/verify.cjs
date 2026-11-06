'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../../../../..'),out=path.dirname(__dirname),prior=path.join(out,'../step7-fixes-20261028-1933');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const original=fs.readFileSync(path.join(prior,'student-official.pdf'));
for(const file of ['mcp-historical.pdf','recovered-historical.pdf'])assert.deepEqual(fs.readFileSync(path.join(out,file)),original);
assert(JSON.parse(fs.readFileSync(path.join(out,'no-business-changes.json'),'utf8')).identical);
const main=JSON.parse(fs.readFileSync(path.join(out,'main-after.json'),'utf8'));assert(main.unchanged);assert.equal(main.tables.length,100);
const api=JSON.parse(fs.readFileSync(path.join(out,'dossiers-api/generated/step7-results.json'),'utf8'));assert.equal(api.result,'PASS');
const summary=JSON.parse(fs.readFileSync(path.join(out,'verification-summary.json'),'utf8'));summary.dossierApi={groups:api.checks.length,result:api.result,includesProducerPrelude:true};summary.historicalPdfChecksum=hash(original);fs.writeFileSync(path.join(out,'verification-summary.json'),JSON.stringify(summary,null,2)+'\n');
const old=JSON.parse(fs.readFileSync(path.join(prior,'source-changes.json'),'utf8')).changed;
const paths=new Set([...old.map(x=>x.file),'backend/src/topic/proposal-dossiers/dossier.spec.ts','frontend/src/shared/api/http-client.ts','frontend/src/shared/api/http-client.spec.ts']);
const changed=[...paths].map(file=>({file,sha256:hash(fs.readFileSync(path.join(root,file)))}));
fs.writeFileSync(path.join(out,'source-fingerprints.json'),JSON.stringify(changed,null,2));
fs.writeFileSync(path.join(out,'git-status-final.txt'),cp.execFileSync('git',['status','--short'],{cwd:root,encoding:'utf8',windowsHide:true}));
const cache=path.join(root,'.cache/step7-fixes-20261028-1933'),secrets=[JSON.parse(fs.readFileSync(path.join(cache,'mcp-credential.json'),'utf8')).password,JSON.parse(fs.readFileSync(path.join(root,'.cache/integration-ui/config.json'),'utf8')).password,fs.readFileSync(path.join(root,'docs/implementation/integration-ui-workflow-demo.md'),'utf8').match(/Mật khẩu chung: \*\*([^*]+)\*\*/)[1]];
const files=[],findings=[],textExtensions=new Set(['.json','.txt','.md','.cjs','.log','.yml']);function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else files.push(p)}}walk(out);
for(const p of files){if(!textExtensions.has(path.extname(p)))continue;const b=fs.readFileSync(p),t=b[0]===255&&b[1]===254?b.toString('utf16le'):b.toString('utf8');if(secrets.some(s=>t.includes(s))||/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(t)||/postgres(?:ql)?:\/\/[^\s/'"`]+:[^\s/'"`]+@/i.test(t))findings.push(path.relative(out,p));}
const broken=[];for(const m of fs.readFileSync(path.join(out,'report.md'),'utf8').matchAll(/\]\(([^)]+)\)/g)){if(!/^[a-z]+:\/\//i.test(m[1])&&!fs.existsSync(path.resolve(out,m[1].split('#')[0])))broken.push(m[1])}
assert.deepEqual(findings,[]);assert.deepEqual(broken,[]);const validation={checkedAt:new Date().toISOString(),filesChecked:files.length,sensitiveFindings:findings,brokenLinks:broken,historicalPdfExact:true,mainTablesUnchanged:100,privateBusinessRowsUnchanged:true};
fs.writeFileSync(path.join(out,'artifact-validation.json'),JSON.stringify(validation,null,2));
fs.writeFileSync(path.join(out,'manifest-sha256.json'),JSON.stringify(files.filter(p=>!['manifest-sha256.json','artifact-validation.json'].includes(path.basename(p))).map(p=>({file:path.relative(out,p).replaceAll('\\','/'),sha256:hash(fs.readFileSync(p))})),null,2));console.log(JSON.stringify(validation));
