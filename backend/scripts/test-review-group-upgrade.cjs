'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os'),
  assert = require('node:assert/strict'),
  crypto = require('node:crypto'),
  { spawnSync } = require('node:child_process');
const { testTarget } = require('./rehearse-pr2b.cjs');
async function main() {
  const url = testTarget(process.env.PR2B_TEST_URL);
  Object.assign(process.env, {
    DATABASE_URL: url.toString(),
    DIRECT_URL: url.toString(),
  });
  const { PrismaClient } = require('../node_modules/.steps48-client');
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const backend = path.resolve(__dirname, '..'),
    source = path.join(backend, 'prisma/migrations'),
    temp = fs.mkdtempSync(path.join(os.tmpdir(), 'btl-step4-upgrade-'));
  const migrations = path.join(temp, 'migrations');
  fs.mkdirSync(migrations);
  fs.copyFileSync(
    path.join(source, 'migration_lock.toml'),
    path.join(migrations, 'migration_lock.toml'),
  );
  fs.copyFileSync(
    path.join(backend, 'prisma/schema.prisma'),
    path.join(temp, 'schema.prisma'),
  );
  const names = fs
    .readdirSync(source)
    .filter((n) => fs.existsSync(path.join(source, n, 'migration.sql')))
    .sort().filter(n=>n<='202610210003_review_group_management');
  assert.equal(names.length, 4);
  function copy(name) {
    fs.mkdirSync(path.join(migrations, name));
    fs.copyFileSync(
      path.join(source, name, 'migration.sql'),
      path.join(migrations, name, 'migration.sql'),
    );
  }
  function deploy() {
    const r = spawnSync(
      process.execPath,
      [
        require.resolve('prisma/build/index.js'),
        'migrate',
        'deploy',
        '--schema',
        path.join(temp, 'schema.prisma'),
      ],
      { cwd: temp, env: process.env, encoding: 'utf8', windowsHide: true },
    );
    if (r.error || r.status !== 0)
      throw Error('Isolated upgrade deploy failed');
  }
  try {
    const [identity] = await db.$queryRawUnsafe(
      "SELECT current_database() AS db,current_setting('server_version_num') AS version",
    );
    assert.equal(identity.db, url.pathname.slice(1));
    assert.equal(Math.floor(Number(identity.version) / 10000), 17);
    const [count] = await db.$queryRawUnsafe(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
    );
    assert.equal(count.n, 0, 'New empty isolated database required');
    names.slice(0, 3).forEach(copy);
    deploy();
    const fixture = spawnSync(
      process.env.PR2B_PSQL || 'psql',
      [
        '-X',
        '-v',
        'ON_ERROR_STOP=1',
        '-f',
        path.join(backend, 'prisma/review/pr2b/fixture.sql'),
      ],
      {
        env: {
          ...process.env,
          PGHOST: '127.0.0.1',
          PGPORT: url.port || '5432',
          PGDATABASE: url.pathname.slice(1),
          PGUSER: decodeURIComponent(url.username),
          PGPASSWORD: decodeURIComponent(url.password),
        },
        encoding: 'utf8',
        windowsHide: true,
      },
    );
    if (fixture.error || fixture.status !== 0)
      throw Error('Synthetic upgrade fixture failed');
    for (const name of ['FACULTY', 'LECTURER', 'ADMIN'])
      await db.role.create({ data: { id: name, name } });
    await db.permission.create({
      data: {
        id: 'unrelated-review-action',
        resource: 'review-group',
        action: 'future-unrelated',
      },
    });
    const before = await db.topic.findMany({
      orderBy: { id: 'asc' },
      include: { proposals: true, researchArea: true },
    });
    const members = await db.reviewGroupMember.findMany({
      orderBy: [{ reviewGroupId: 'asc' }, { lecturerId: 'asc' }],
    });
    const groups = await db.$queryRawUnsafe(
      'SELECT * FROM public."REVIEW_GROUP" ORDER BY id',
    );
    copy(names[3]);
    deploy();
    deploy();
    assert.deepEqual(
      await db.topic.findMany({
        orderBy: { id: 'asc' },
        include: { proposals: true, researchArea: true },
      }),
      before,
    );
    assert.deepEqual(
      await db.reviewGroupMember.findMany({
        orderBy: [{ reviewGroupId: 'asc' }, { lecturerId: 'asc' }],
      }),
      members,
    );
    assert.deepEqual(
      await db.$queryRawUnsafe(
        'SELECT * FROM public."REVIEW_GROUP" ORDER BY id',
      ),
      groups,
    );
    assert.equal(
      (await db.taskReview.findUnique({ where: { id: 'fx-old-review' } }))
        .isPassed,
      false,
    );
    assert.equal(
      await db.reviewGroupWorkflow.count(),
      0,
      'No inferred department/ownership backfill',
    );
    const permissionRows = await db.rolePermission.findMany({
      include: { role: true, permission: true },
    });
    const actions = (name) =>
      permissionRows
        .filter((r) => r.role.name === name)
        .map((r) => r.permission.action)
        .sort();
    assert.deepEqual(actions('FACULTY'), ['manage', 'read']);
    assert.deepEqual(actions('LECTURER'), ['read']);
    assert.deepEqual(actions('ADMIN'), []);
    assert(
      !permissionRows.some((r) => r.permission.action === 'future-unrelated'),
    );
    const history = await db.$queryRawUnsafe(
      'SELECT migration_name,checksum,finished_at FROM public."_prisma_migrations" ORDER BY migration_name',
    );
    assert.equal(history.length, 4);
    for (const row of history) {
      assert(row.finished_at);
      assert.equal(
        row.checksum,
        crypto
          .createHash('sha256')
          .update(
            fs.readFileSync(
              path.join(source, row.migration_name, 'migration.sql'),
            ),
          )
          .digest('hex'),
      );
    }
    fs.writeFileSync(
      path.join(backend, 'prisma/review/step4-upgrade-results.json'),
      JSON.stringify(
        {
          result: 'PASS',
          postgresVersion: identity.version,
          existingSyntheticDataPreserved: true,
          legacyFalsePreserved: true,
          noInferredBackfill: true,
          facultyActions: actions('FACULTY'),
          lecturerActions: actions('LECTURER'),
          adminActions: actions('ADMIN'),
          unrelatedActionNotGranted: true,
          repeatedDeploy: 'no pending migrations',
          migrationCount: history.length,
          step4Checksum: history[3].checksum,
          sharedDatabaseDDL: false,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(
      'PASS populated baseline upgrade: legacy rows/members/false preserved; no backfill; exact faculty/lecturer permissions, no ADMIN/unrelated action grant; four checksums and repeated deploy',
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(
    String(e.message).replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_URL]'),
  );
  process.exitCode = 1;
});
