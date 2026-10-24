'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { testTarget } = require('./rehearse-pr2b.cjs');
async function main() {
  const url = testTarget(process.env.PR2B_TEST_URL);
  process.env.DATABASE_URL = url.toString();
  process.env.DIRECT_URL = url.toString();
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const backend = path.resolve(__dirname, '..');
  function deploy() {
    const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',path.join(backend,'prisma/schema.prisma')], { cwd:backend, env:process.env, encoding:'utf8', windowsHide:true });
    if (result.error || result.status !== 0) throw Error('Actual isolated migration chain failed; inspect test history');
  }
  try {
    const [identity] = await db.$queryRawUnsafe("SELECT current_database() AS db,current_setting('server_version_num') AS version");
    assert.equal(identity.db,url.pathname.slice(1));
    assert.equal(Math.floor(Number(identity.version)/10000),17);
    const [tables] = await db.$queryRawUnsafe("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
    assert.equal(tables.n,0,'Create a fresh isolated test database; no reset/reuse');
    deploy(); deploy();
    const rows = await db.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public."_prisma_migrations" ORDER BY migration_name');
    assert.equal(rows.length,fs.readdirSync(path.join(backend,'prisma/migrations')).filter(name=>fs.existsSync(path.join(backend,'prisma/migrations',name,'migration.sql'))).length);
    for (const row of rows) {
      const bytes=fs.readFileSync(path.join(backend,'prisma/migrations',row.migration_name,'migration.sql'));
      assert(row.finished_at&&!row.rolled_back_at);
      assert.equal(row.checksum,crypto.createHash('sha256').update(bytes).digest('hex'));
    }
    const fixture = spawnSync(process.env.PR2B_PSQL||'psql',['-X','-v','ON_ERROR_STOP=1','-f',path.join(backend,'prisma/review/pr2b/fixture.sql')], {
      env:{...process.env,PGHOST:'127.0.0.1',PGPORT:url.port||'5432',PGDATABASE:url.pathname.slice(1),PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password)},encoding:'utf8',windowsHide:true,
    });
    if(fixture.error||fixture.status!==0)throw Error('Isolated synthetic fixture failed');
    // Existing consumers in all three work areas continue using the same client.
    assert.equal((await db.topic.findMany({include:{proposals:true,researchArea:true}})).length,2);
    assert.equal((await db.student.findMany({include:{proposal:true,trainingSystem:true}})).length,2);
    assert.equal((await db.registration.findMany({where:{status:'PENDING'},include:{preferences:true,advisorAssignment:{include:{advisor:true}}}})).length,1);
    assert.equal((await db.taskReview.findUnique({where:{id:'fx-old-review'}})).isPassed,false);
    assert.equal(await db.progressReview.count(),0);
    assert.equal(await db.defenseCommittee.count(),0);
    assert.equal(await db.scoreEntry.count(),0);
    fs.writeFileSync(path.join(backend,'prisma/review/pr2b/active-chain-results.json'),JSON.stringify({result:'PASS',postgresVersion:identity.version,actualRepositoryMigrations:rows.map(r=>({name:r.migration_name,checksum:r.checksum})),canonicalClient:true,legacyFalseUnchanged:true,sharedDatabaseDDL:false},null,2)+'\n');
    console.log('PASS actual repository migration chain, canonical Prisma client and legacy consumers across steps 1–10');
  } finally { await db.$disconnect(); }
}
main().catch(()=>{console.error('Active-chain rehearsal failed on isolated test DB; connection details suppressed');process.exitCode=1;});
