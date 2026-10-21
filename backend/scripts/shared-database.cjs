'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const { readChecks } = require('./database-test.cjs');
const backend = path.resolve(__dirname, '..');

function loadEnvironment() {
  const env = {};
  const file = path.join(backend, '.env');
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (match) env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
    }
  }
  return { ...env, ...process.env };
}

function inspectTarget(env) {
  const url = new URL(env.DIRECT_URL || '');
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname === '/') throw new Error('Invalid DIRECT_URL');
  if (url.hostname !== env.DB_INSPECT_HOST) throw new Error('DB_INSPECT_HOST must exactly match DIRECT_URL host before any connection');
  if ((url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.com')) && url.searchParams.get('sslmode') !== 'require') throw new Error('Supabase inspection requires sslmode=require');
  return { url: url.toString(), target: `${url.hostname}${url.pathname}` };
}

async function inspect(env) {
  const { url, target } = inspectTarget(env);
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    return await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '5000ms'");
      const identity = await tx.$queryRawUnsafe("SELECT current_database() AS database, current_user AS role, current_setting('server_version') AS version, current_setting('transaction_read_only') AS read_only");
      if (identity[0]?.read_only !== 'on') throw new Error('Database did not enter READ ONLY mode');
      const tables = await tx.$queryRawUnsafe("SELECT table_schema,table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') AND table_type='BASE TABLE' ORDER BY table_schema,table_name");
      const columns = await tx.$queryRawUnsafe("SELECT table_name,column_name,data_type,udt_name,is_nullable FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position");
      const constraints = await tx.$queryRawUnsafe("SELECT c.relname AS table_name,k.conname,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,k.conname");
      const publicTables = new Set(tables.filter(t => t.table_schema === 'public').map(t => t.table_name));
      const schema = fs.readFileSync(path.join(backend, 'prisma/schema.prisma'), 'utf8');
      const appTables = [...schema.matchAll(/@@map\("([A-Z_]+)"\)/g)].map(m => m[1]);
      const counts = [];
      for (const table of appTables) {
        if (publicTables.has(table)) counts.push({ table, rows: (await tx.$queryRawUnsafe(`SELECT count(*)::bigint AS n FROM public."${table}"`))[0].n });
      }
      const migrations = publicTables.has('_prisma_migrations')
        ? await tx.$queryRawUnsafe('SELECT migration_name,checksum,started_at,finished_at,rolled_back_at,applied_steps_count FROM public."_prisma_migrations" ORDER BY started_at') : null;
      const diagnostics = [];
      for (const check of readChecks(fs.readFileSync(path.join(__dirname, 'sql/pr2-diagnostics.sql'), 'utf8'))) {
        const dependencies = [...check.sql.matchAll(/(?:FROM|JOIN)\s+"([A-Z_]+)"/gi)].map(m => m[1]);
        if (dependencies.every(t => publicTables.has(t))) diagnostics.push({ check: check.name, rows: await tx.$queryRawUnsafe(check.sql) });
        else diagnostics.push({ check: check.name, skipped: 'Required application tables are absent' });
      }
      return { target, identity, tables, columns, constraints, appTableCounts: counts, migrations, diagnostics, operation: 'READ ONLY; no DDL, seed, repair or migration executed' };
    }, { timeout: 60000 });
  } finally { await prisma.$disconnect(); }
}

function assertDeployApproval(env, requested) {
  const { target } = inspectTarget(env);
  if (requested !== target || env.ALLOW_DATABASE_MIGRATION !== target) {
    throw new Error('DDL blocked: require matching --target host/database and ALLOW_DATABASE_MIGRATION for this reviewed operation');
  }
}

function assertMigrationHistory(history) {
  for (const entry of history || []) {
    if (!/^[a-zA-Z0-9_-]+$/.test(entry.migration_name)) throw new Error('Migration deploy failed: invalid history entry');
    const file = path.join(backend, 'prisma/migrations', entry.migration_name, 'migration.sql');
    const hashes = fs.existsSync(file) ? migrationChecksums(fs.readFileSync(file)) : [];
    if (!entry.finished_at || entry.rolled_back_at || !hashes.includes(entry.checksum)) {
      throw new Error('Migration deploy failed: reconcile failed, unknown or checksum-mismatched history first');
    }
  }
}

function migrationChecksums(bytes) {
  // Match only exact SQL content with platform newline variants. This does not
  // normalize whitespace/statements or accept edited migrations.
  const lf = bytes.toString('utf8').replace(/\r\n/g, '\n');
  return [...new Set([bytes, Buffer.from(lf), Buffer.from(lf.replace(/\n/g, '\r\n'))]
    .map(content => crypto.createHash('sha256').update(content).digest('hex')))];
}

async function main() {
  const env = loadEnvironment();
  const action = process.argv[2];
  if (action === 'inspect') {
    console.log(JSON.stringify(await inspect(env), (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  } else if (action === 'deploy') {
    const requested = process.argv[3] === '--target' ? process.argv[4] : '';
    assertDeployApproval(env, requested);
    // Inspection does not grant approval. Caller must explicitly set both gates.
    const before = await inspect(env);
    assertMigrationHistory(before.migrations);
    if (!before.migrations && before.tables.some(t => t.table_schema === 'public')) throw new Error('Existing public tables without Prisma history; baseline reconciliation is required');
    const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', path.join(backend, 'prisma/schema.prisma')], {
      cwd: backend, env, encoding: 'utf8', windowsHide: true,
    });
    // Never echo raw CLI errors or URLs containing credentials.
    if (result.error || result.status !== 0) throw new Error('Migration deploy failed; inspect history before retrying');
    console.log('Reviewed migration deploy completed. Run db:inspect to verify history.');
  } else throw new Error('Usage: shared-database.cjs inspect|deploy --target host/database');
}
module.exports = { inspectTarget, assertDeployApproval, assertMigrationHistory, migrationChecksums };
if (require.main === module) main().catch(error => {
  // Unknown DB errors may contain credentials; only expose safe classification.
  if (error.code || error.errorCode) console.error(`Database operation failed: ${error.code || error.errorCode}. No connection URL or credentials printed.`);
  else if (['Invalid DIRECT_URL'].includes(error.message) || /^(DB_INSPECT_HOST|Supabase inspection|DDL blocked|Existing public tables|Usage:|Migration deploy failed)/.test(error.message)) console.error(error.message);
  else console.error('Database operation failed. Check DIRECT_URL, DNS/network and credentials locally.');
  process.exitCode = 1;
});
