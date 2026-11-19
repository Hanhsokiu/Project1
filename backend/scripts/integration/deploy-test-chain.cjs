'use strict';
// Fresh local test databases only. Production roles are an operational prerequisite,
// not something an applied SQL migration may silently invent.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict'), { spawnSync } = require('node:child_process');
const { testTarget } = require('../rehearse-pr2b.cjs');
function stageBaseline(backend) {
  const manifest = require(path.join(backend, 'prisma/uc17-24-chain.json'));
  assert.equal(manifest.baseline.length, 17);
  const dir = path.resolve(backend, '../.cache/uc17-24-deploy/b1-b8/prisma');
  fs.mkdirSync(path.join(dir, 'migrations'), { recursive: true });
  fs.copyFileSync(path.join(backend, 'prisma/schema.prisma'), path.join(dir, 'schema.prisma'));
  fs.copyFileSync(path.join(backend, 'prisma/migrations/migration_lock.toml'), path.join(dir, 'migrations/migration_lock.toml'));
  for (const item of manifest.baseline) {
    const bytes = fs.readFileSync(path.join(backend, 'prisma/migrations', item.name, 'migration.sql'));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase(), item.sha256.toUpperCase());
    fs.mkdirSync(path.join(dir, 'migrations', item.name), { recursive: true });
    fs.writeFileSync(path.join(dir, 'migrations', item.name, 'migration.sql'), bytes);
  }
  return path.join(dir, 'schema.prisma');
}
async function bootstrapRoles(db, rawUrl) {
  const url = testTarget(rawUrl);
  const [identity] = await db.$queryRawUnsafe('SELECT current_database() AS name');
  assert.equal(identity.name, url.pathname.slice(1));
  for (const name of ['ADMIN', 'FACULTY', 'LECTURER', 'STUDENT', 'COMMITTEE'])
    await db.role.upsert({ where: { name }, create: { id: name, name }, update: {} });
}
function deploySchema(backend, schema, url) {
  const r = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', schema], {
    cwd: backend, env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url }, encoding: 'utf8', windowsHide: true,
  });
  assert(!r.error && r.status === 0, 'Isolated migration replay failed; connection details suppressed');
}
async function deploy(db, backend, rawUrl) {
  const url = testTarget(rawUrl).toString();
  const [identity] = await db.$queryRawUnsafe("SELECT current_database() AS name,current_setting('server_version_num')::int/10000 AS major");
  assert.equal(identity.name, new URL(url).pathname.slice(1)); assert.equal(identity.major, 17);
  const [tables] = await db.$queryRawUnsafe("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
  assert.equal(tables.n, 0, 'A NEW empty local database is required; never reset/reuse');
  deploySchema(backend, stageBaseline(backend), url);
  if (process.env.DATN_REHEARSAL_BASELINE !== 'true') {
    await bootstrapRoles(db, url);
    deploySchema(backend, path.join(backend, 'prisma/schema.prisma'), url);
  }
  return { status: 0 };
}
module.exports = { deploy, bootstrapRoles, stageBaseline };
