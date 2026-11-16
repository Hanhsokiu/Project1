"use strict";
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),assert=require("node:assert/strict"),local=require("./local.cjs"),{hash}=require("./definition.cjs");
async function main(){
 assert(process.argv.includes("--target=local-test"),"Explicit TEST target required");
 const cfg=local.configuration(),db=local.client(cfg),source=path.join(local.backend,"prisma"),staging=path.join(local.cache,"schema-"+local.database);
 try{
  await local.identity(db);
  const history=await db.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public."_prisma_migrations" WHERE rolled_back_at IS NULL ORDER BY migration_name');
  for(const row of history){assert(row.finished_at);assert.equal(hash(fs.readFileSync(path.join(source,'migrations',row.migration_name,'migration.sql'))),row.checksum,"Never replace an applied migration");}
  fs.mkdirSync(path.join(staging,'migrations'),{recursive:true});
  for(const name of fs.readdirSync(path.join(source,'migrations'))){const sql=path.join(source,'migrations',name,'migration.sql');if(!fs.existsSync(sql))continue;fs.mkdirSync(path.join(staging,'migrations',name),{recursive:true});fs.copyFileSync(sql,path.join(staging,'migrations',name,'migration.sql'));}
  fs.copyFileSync(path.join(source,'schema.prisma'),path.join(staging,'schema.prisma'));
  const r=cp.spawnSync(process.execPath,[local.req.resolve('prisma/build/index.js'),'migrate','deploy','--schema',path.join(staging,'schema.prisma')],{cwd:local.cache,env:local.sanitizedEnvironment({DATABASE_URL:local.connection(cfg),DIRECT_URL:local.connection(cfg)}),encoding:'utf8',windowsHide:true,timeout:180000});
  assert.equal(r.status,0,"TEST migration deploy failed; review applied history without reset");
  console.log(JSON.stringify(await local.prepare()));
 }finally{await db.$disconnect();}
}
main().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
