'use strict';
// Rehearse the ACTUAL Prisma migration-history mechanism in a TEMP copy.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {testTarget}=require('./rehearse-pr2b.cjs');
async function main(){
 const u=testTarget(process.env.PR2B_TEST_URL);
 process.env.DATABASE_URL=u.toString();process.env.DIRECT_URL=u.toString();
 const backend=path.resolve(__dirname,'..'),review=path.join(backend,'prisma/review/pr2b');
 const {PrismaClient}=require('../node_modules/.pr2b-client');
 const db=new PrismaClient({datasources:{db:{url:u.toString()}}});
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'btl-pr2b-chain-'));
 const migrations=path.join(temp,'migrations');fs.mkdirSync(migrations);
 fs.writeFileSync(path.join(migrations,'migration_lock.toml'),'provider = "postgresql"\n');
 fs.copyFileSync(path.join(review,'expand.prisma'),path.join(temp,'schema.prisma'));
 const entries=[['0_init',path.join(backend,'prisma/migrations/0_init/migration.sql')],['202610210001_empty_baseline_bridge',path.join(review,'01-empty-baseline-enum-bridge.sql')],['202610210002_expand_workflow',path.join(review,'02-expand.sql')]];
 function copy([name,source]){const dest=path.join(migrations,name);fs.mkdirSync(dest);fs.copyFileSync(source,path.join(dest,'migration.sql'));}
 function deploy(){const r=cp.spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',path.join(temp,'schema.prisma')],{env:process.env,cwd:temp,encoding:'utf8',windowsHide:true});if(r.error||r.status!==0)throw Error('Isolated Prisma migration deploy failed: '+(r.stderr||r.error?.code));}
 try{
  const [identity]=await db.$queryRawUnsafe("SELECT current_database() AS db,current_setting('server_version_num') AS version");
  assert.equal(identity.db,u.pathname.slice(1));assert.equal(Math.floor(Number(identity.version)/10000),17);
  const [tables]=await db.$queryRawUnsafe("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");assert.equal(tables.n,0,'Test DB must be newly created and empty');
  entries.slice(0,2).forEach(copy);deploy();
  const r=cp.spawnSync(process.env.PR2B_PSQL||'psql',['-X','-v','ON_ERROR_STOP=1','-f',path.join(review,'fixture.sql')],{env:{...process.env,PGHOST:'127.0.0.1',PGPORT:u.port||'5432',PGDATABASE:u.pathname.slice(1),PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password)},encoding:'utf8',windowsHide:true});
  if(r.error||r.status!==0)throw Error('Synthetic chain fixture failed');
  const before=await db.topic.findMany({orderBy:{id:'asc'},include:{proposals:true,researchArea:true}});
  copy(entries[2]);deploy();deploy(); // last invocation must have no pending migration
  const rows=await db.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public."_prisma_migrations" ORDER BY migration_name');
  assert.equal(rows.length,3);
  for(const [name,file]of entries){const row=rows.find(r=>r.migration_name===name);assert(row&&row.finished_at&&!row.rolled_back_at);assert.equal(row.checksum,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));}
  assert.deepEqual(await db.topic.findMany({orderBy:{id:'asc'},include:{proposals:true,researchArea:true}}),before);
  assert.equal((await db.taskReview.findUnique({where:{id:'fx-old-review'}})).isPassed,false);
  const [count]=await db.$queryRawUnsafe("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
  assert.equal(count.n,95); // 56 baseline + 38 additive + Prisma history
  fs.writeFileSync(path.join(review,'chain-results.json'),JSON.stringify({result:'PASS',postgresVersion:identity.version,appliedMigrations:rows.map(r=>({name:r.migration_name,checksum:r.checksum,finished:true})),publicBaseTableCount:count.n,repeatedDeploy:'no pending migrations',legacyPayloadUnchanged:true,legacyFalseUnchanged:true,sharedDatabaseDDL:false},null,2)+'\n');
  console.log('PASS isolated Prisma deploy chain, checksums, repeated deploy, 95 tables, legacy API and false preservation');
 }finally{await db.$disconnect();}
}
main().catch(e=>{console.error(String(e.message).replace(/postgres(?:ql)?:\/\/[^\s]+/gi,'[REDACTED_URL]'));process.exitCode=1;});
