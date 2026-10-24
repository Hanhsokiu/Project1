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
  const { PrismaClient } = require('@prisma/client'),
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const backend = path.resolve(__dirname, '..'),
    source = path.join(backend, 'prisma/migrations'),
    temp = fs.mkdtempSync(path.join(os.tmpdir(), 'btl-step5-upgrade-')),
    migrations = path.join(temp, 'migrations');
  fs.mkdirSync(migrations);
  fs.copyFileSync(
    path.join(backend, 'prisma/schema.prisma'),
    path.join(temp, 'schema.prisma'),
  );
  fs.copyFileSync(
    path.join(source, 'migration_lock.toml'),
    path.join(migrations, 'migration_lock.toml'),
  );
  const names = fs
    .readdirSync(source)
    .filter((n) => fs.existsSync(path.join(source, n, 'migration.sql')))
    .sort()
    .filter((n) => n <= '202610220001_proposal_review_assignment');
  assert.equal(names.length, 5);
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
    assert.equal(r.status, 0, 'Isolated upgrade failed');
  }
  try {
    const [identity] =
      await db.$queryRaw`SELECT current_database() AS db,current_setting('server_version_num') AS version`;
    assert.equal(identity.db, url.pathname.slice(1));
    assert.equal(Math.floor(Number(identity.version) / 10000), 17);
    const [empty] =
      await db.$queryRaw`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`;
    assert.equal(empty.n, 0, 'Fresh database required');
    names.slice(0, 4).forEach(copy);
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
          PGPORT: url.port,
          PGDATABASE: url.pathname.slice(1),
          PGUSER: decodeURIComponent(url.username),
          PGPASSWORD: decodeURIComponent(url.password),
        },
        encoding: 'utf8',
        windowsHide: true,
      },
    );
    assert.equal(fixture.status, 0, 'Synthetic baseline fixture failed');
    for (const name of ['FACULTY', 'LECTURER', 'STUDENT', 'ADMIN'])
      await db.role.create({ data: { id: name, name } });
    // Old database does not yet have assignedAt/assignedByUserId; use the
    // actual old-column contract instead of the new client's RETURNING *.
    await db.$executeRaw`INSERT INTO public."PROPOSAL_REVIEW_WORKFLOW"
      (id,"reviewId","proposalId","versionId","roundNumber",state)
      VALUES ('step5-legacy-round','fx-r1','fx-p1','fx-v1',1,'ASSIGNED')`;
    await db.permission.create({
      data: { resource: 'proposal', action: 'future-unrelated' },
    });
    const before = {
      topics: await db.topic.findMany({
        orderBy: { id: 'asc' },
        include: { proposals: true },
      }),
      groups: await db.reviewGroup.findMany({
        orderBy: { id: 'asc' },
        include: { members: true },
      }),
      oldTaskReview: await db.taskReview.findMany(),
      audit: await db.auditLog.findMany(),
    };
    copy(names[4]);
    deploy();
    deploy();
    assert.deepEqual(
      await db.topic.findMany({
        orderBy: { id: 'asc' },
        include: { proposals: true },
      }),
      before.topics,
    );
    assert.deepEqual(
      await db.reviewGroup.findMany({
        orderBy: { id: 'asc' },
        include: { members: true },
      }),
      before.groups,
    );
    assert.deepEqual(await db.taskReview.findMany(), before.oldTaskReview);
    assert.deepEqual(await db.auditLog.findMany(), before.audit);
    const round = await db.proposalReviewWorkflow.findUnique({
      where: { reviewId: 'fx-r1' },
    });
    assert.equal(round.assignedAt, null);
    assert.equal(round.assignedByUserId, null);
    assert.equal(await db.proposalReviewDecision.count(), 0);
    const grants = await db.rolePermission.findMany({
      where: { permission: { resource: 'proposal' } },
      include: { role: true, permission: true },
    });
    const actions = (name) =>
      grants
        .filter((r) => r.role.name === name)
        .map((r) => r.permission.action)
        .sort();
    assert.deepEqual(actions('FACULTY'), ['assign', 'read']);
    assert.deepEqual(actions('LECTURER'), ['comment', 'read', 'review']);
    assert.deepEqual(actions('ADMIN'), []);
    assert.deepEqual(actions('STUDENT'), ['read']);
    assert(!grants.some((r) => r.permission.action === 'future-unrelated'));
    const history =
      await db.$queryRaw`SELECT migration_name,checksum,finished_at FROM public."_prisma_migrations" ORDER BY migration_name`;
    assert.equal(history.length, 5);
    for (const r of history) {
      assert(r.finished_at);
      assert.equal(
        r.checksum,
        crypto
          .createHash('sha256')
          .update(
            fs.readFileSync(
              path.join(source, r.migration_name, 'migration.sql'),
            ),
          )
          .digest('hex'),
      );
    }
    fs.writeFileSync(
      path.join(backend, 'prisma/review/step5-upgrade-results.json'),
      JSON.stringify(
        {
          result: 'PASS',
          postgresVersion: identity.version,
          checks: [
            'populated step4 baseline preserved',
            'assignment actor/time remain NULL for old rounds',
            'legacy boolean/ownership/audit not backfilled',
            'only explicit faculty/lecturer actions and student read bound; ADMIN/unrelated actions excluded',
            'five checksums and deploy retry preserved',
          ],
          sharedDatabaseDDL: false,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(
      'PASS Step 5 populated-baseline upgrade, no inferred metadata, scoped permissions and migration replay',
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(
    'Step 5 isolated upgrade failed: ' +
      String(e.message).replace(
        /postgres(?:ql)?:\/\/[^\s]+/gi,
        '[redacted URL]',
      ),
  );
  process.exitCode = 1;
});
