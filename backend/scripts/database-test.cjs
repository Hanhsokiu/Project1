'use strict';

// Dedicated local Docker test instance only. Never consumes DATABASE_URL.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '../..');
const BACKEND = path.join(ROOT, 'backend');
const CONFIG = path.join(ROOT, '.env.pr2-test.local');
const CONTAINER = 'btl-pr2-postgres-test';
const PROJECT = 'btl-pr2-test';

function parseConfig(text) {
  const config = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = /^(TEST_DB_PASSWORD|TEST_DB_INSTANCE_TOKEN)=([a-f0-9]{48})$/.exec(line);
    if (!match || config[match[1]]) throw new Error('Invalid local test config; expected two generated hex values.');
    config[match[1]] = match[2];
  }
  if (Object.keys(config).length !== 2) throw new Error('Incomplete local test config. Run db:test:init.');
  return config;
}

function testUrl(config) {
  // Validate even when called outside main; there is no arbitrary URL argument.
  parseConfig(`TEST_DB_PASSWORD=${config.TEST_DB_PASSWORD}\nTEST_DB_INSTANCE_TOKEN=${config.TEST_DB_INSTANCE_TOKEN}`);
  return `postgresql://btl_pr2_test:${config.TEST_DB_PASSWORD}@127.0.0.1:55432/doan_pr2_test?schema=public`;
}

function redact(text, config) {
  let result = String(text || '');
  for (const secret of Object.values(config)) result = result.split(secret).join('[REDACTED]');
  return result.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[REDACTED_DATABASE_URL]');
}

function assertContainer(info, config) {
  const labels = info.Config?.Labels || {};
  const bindings = info.HostConfig?.PortBindings?.['5432/tcp'] || [];
  if (labels['com.docker.compose.project'] !== PROJECT ||
      labels['com.docker.compose.service'] !== 'postgres-test' ||
      labels['btl.pr2.instance'] !== config.TEST_DB_INSTANCE_TOKEN ||
      info.Config?.Image !== 'postgres:16-alpine' ||
      bindings.length !== 1 || bindings[0].HostIp !== '127.0.0.1' || bindings[0].HostPort !== '55432') {
    throw new Error('Test container ownership/image/loopback port does not match; refusing to use or modify it.');
  }
}

function readChecks(text) {
  const checks = text.split(/^-- check: /m).slice(1).map(block => {
    const newline = block.indexOf('\n');
    const name = block.slice(0, newline).trim();
    const sql = block.slice(newline + 1).trim();
    if (!/^[a-z0-9_]+$/.test(name) || !/^SELECT\s/i.test(sql) ||
        !sql.endsWith(';') || sql.slice(0, -1).includes(';') ||
        /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|COPY|CALL)\b/i.test(sql)) {
      throw new Error('Diagnostics must contain named single SELECT statements only.');
    }
    return { name, sql };
  });
  if (!checks.length) throw new Error('No diagnostic SELECT checks found.');
  return checks;
}

async function main(action) {
  if (action === 'init') {
    const values = { TEST_DB_PASSWORD: crypto.randomBytes(24).toString('hex'), TEST_DB_INSTANCE_TOKEN: crypto.randomBytes(24).toString('hex') };
    fs.writeFileSync(CONFIG, Object.entries(values).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
    console.log('Created ignored .env.pr2-test.local; values were not printed. Existing config is never overwritten.');
    return;
  }
  if (!['up', 'status', 'replay', 'diagnose'].includes(action)) throw new Error('Usage: database-test.cjs init|up|status|replay|diagnose');
  const config = parseConfig(fs.readFileSync(CONFIG, 'utf8'));
  const env = { ...process.env, ...config };
  function run(executable, args, allowFailure = false) {
    const result = spawnSync(executable, args, { cwd: ROOT, env, encoding: 'utf8', windowsHide: true, timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
    if (result.error) throw new Error(`Cannot run ${path.basename(executable)}: ${result.error.code}. Check installation and child-process permissions.`);
    if (result.status !== 0 && !allowFailure) throw new Error(redact(result.stderr || result.stdout || 'Command failed', config));
    return result;
  }
  // Do not silently provision containers on a remote Docker host/context.
  const context = run('docker', ['context', 'show']).stdout.trim();
  const contextInfo = JSON.parse(run('docker', ['context', 'inspect', context]).stdout)[0];
  const endpoint = process.env.DOCKER_HOST || contextInfo.Endpoints?.docker?.Host || '';
  if (!/^(npipe:\/\/|unix:\/\/)/.test(endpoint)) throw new Error('Only a local Docker socket is allowed; remote Docker targets are refused.');
  function inspect(allowMissing = false) {
    const result = run('docker', ['inspect', CONTAINER], allowMissing);
    if (result.status !== 0) {
      if (allowMissing && /No such (object|container)/i.test(result.stderr)) return null;
      throw new Error(redact(result.stderr || 'Cannot inspect dedicated test container.', config));
    }
    const info = JSON.parse(result.stdout)[0];
    assertContainer(info, config);
    return info;
  }
  if (action === 'up') {
    inspect(true); // Never take over an existing unrelated container with this name.
    const output = run('docker', ['compose', '--env-file', CONFIG, '-f', path.join(ROOT, 'compose.pr2-test.yml'), '-p', PROJECT, 'up', '-d', '--wait', 'postgres-test']);
    inspect();
    console.log(redact(output.stdout + output.stderr, config));
    console.log('Dedicated test container is healthy; run status, then replay. No migrations were run by up.');
    return;
  }
  const info = inspect();
  if (!info.State?.Running) throw new Error('Dedicated test container is not running.');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: testUrl(config) } } });
  try {
    const [identity] = await prisma.$queryRawUnsafe('SELECT current_database() AS db, current_user AS usr, current_setting(\'server_version_num\') AS version');
    if (identity.db !== 'doan_pr2_test' || identity.usr !== 'btl_pr2_test' || Math.floor(Number(identity.version) / 10000) !== 16) {
      throw new Error('Connected database identity is not the dedicated PostgreSQL 16 test target.');
    }
    const [exists] = await prisma.$queryRawUnsafe("SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present");
    let history = [];
    if (exists.present) history = await prisma.$queryRawUnsafe('SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at');
    console.log(JSON.stringify({ target: 'dedicated loopback PostgreSQL test', identity, migrations: history }, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    if (action === 'status') return;
    const migrationsDir = path.join(BACKEND, 'prisma/migrations');
    for (const entry of history) {
      const file = path.resolve(migrationsDir, entry.migration_name, 'migration.sql');
      if (!/^[a-zA-Z0-9_-]+$/.test(entry.migration_name) || !file.startsWith(migrationsDir + path.sep) ||
          !fs.existsSync(file) || !entry.finished_at || entry.rolled_back_at ||
          crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== entry.checksum) {
        throw new Error('Unknown, failed, rolled-back, or checksum-mismatched migration. Stop for reconciliation.');
      }
    }
    if (action === 'replay') {
      if (!exists.present) {
        const [tables] = await prisma.$queryRawUnsafe("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
        if (tables.n !== 0) throw new Error('Nonempty database without Prisma history; refusing to replay.');
      }
      // URL is child environment only, never a command-line argument or log entry.
      const prior = env.DATABASE_URL;
      env.DATABASE_URL = testUrl(config);
      env.DIRECT_URL = testUrl(config);
      try {
        const result = run(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', path.join(BACKEND, 'prisma/schema.prisma')]);
        console.log(redact(result.stdout + result.stderr, config));
      } finally { if (prior === undefined) delete env.DATABASE_URL; else env.DATABASE_URL = prior; }
      return;
    }
    if (!history.length) throw new Error('No verified migration history. Run replay on the dedicated empty test instance first.');
    const checks = readChecks(fs.readFileSync(path.join(__dirname, 'sql/pr2-diagnostics.sql'), 'utf8'));
    const results = await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const values = [];
      for (const check of checks) values.push({ check: check.name, rows: await tx.$queryRawUnsafe(check.sql) });
      return values;
    }, { timeout: 30000 });
    console.log(JSON.stringify({ dataset: 'test only; empty counts do not validate legacy data', results }, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    if (results.some(r => r.rows.some(row => Object.prototype.hasOwnProperty.call(row, 'violations') && Number(row.violations) > 0))) process.exitCode = 2;
  } finally { await prisma.$disconnect(); }
}

module.exports = { parseConfig, testUrl, redact, assertContainer, readChecks };
if (require.main === module) main(process.argv[2]).catch(error => {
  // Do not print Prisma error stacks: they can contain connection URLs.
  let config = {};
  try { config = parseConfig(fs.readFileSync(CONFIG, 'utf8')); } catch { /* no secrets loaded */ }
  console.error(redact(error.message, config));
  process.exitCode = 1;
});
