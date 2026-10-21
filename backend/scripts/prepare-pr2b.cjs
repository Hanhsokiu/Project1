'use strict';
// Local datamodel diff only; never reads DATABASE_URL to connect or apply DDL.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const dir=path.join(root,'prisma/review/pr2b');
const prepare=cp.spawnSync(process.platform==='win32'?'python':'python3',[path.join(__dirname,'prepare-pr2b.py')],{cwd:root,encoding:'utf8',windowsHide:true});
if(prepare.error||prepare.status!==0) throw Error('Review schema preparation failed');
const args=[require.resolve('prisma/build/index.js'),'migrate','diff','--from-schema-datamodel',path.join(dir,'baseline.prisma'),'--to-schema-datamodel',path.join(dir,'expand.prisma'),'--script'];
const result=cp.spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',windowsHide:true});
if(result.error||result.status!==0) throw Error('Offline Prisma diff failed');
if(/\bDROP\s+(TABLE|COLUMN|CONSTRAINT|INDEX|TYPE)\b/i.test(result.stdout)) throw Error('Expand diff is not additive');
fs.writeFileSync(path.join(dir,'02-expand.generated.sql'),result.stdout);
fs.writeFileSync(path.join(dir,'02-expand.sql'),'-- REVIEW CANDIDATE, NOT IN DEPLOYABLE MIGRATION CHAIN\nBEGIN;\n'+result.stdout+'\n'+fs.readFileSync(path.join(dir,'03-integrity.sql'),'utf8')+'\n'+fs.readFileSync(path.join(dir,'04-data-api-isolation.sql'),'utf8')+'\nCOMMIT;\n');
console.log('Generated additive review SQL; no database was contacted.');
