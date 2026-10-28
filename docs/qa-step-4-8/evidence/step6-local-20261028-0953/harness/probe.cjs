const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../../../..');
const {createRequire}=require('node:module'),req=createRequire(path.join(root,'backend/package.json'));
(async()=>{console.log('loading client');const {PrismaClient}=req('@prisma/client');console.log('client loaded');const rt=JSON.parse(fs.readFileSync(path.join(root,'.cache/step6-local-20261028-0953/runtime.json'),'utf8'));const db=new PrismaClient({datasources:{db:{url:rt.url}}});console.log('querying identity');console.log(await db.$queryRawUnsafe('SELECT current_database() AS db'));console.log('versions',await db.proposalVersion.count());await db.$disconnect()})().catch(e=>{console.error(e.code||e.name);process.exitCode=1});
