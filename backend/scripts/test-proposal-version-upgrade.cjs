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
  const backend = path.resolve(__dirname, '..'),
    source = path.join(backend, 'prisma/migrations'),
    temp = fs.mkdtempSync(path.join(os.tmpdir(), 'btl-step6-upgrade-')),
    migrations = path.join(temp, 'migrations');
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
    .filter(
      (n) =>
        fs.existsSync(path.join(source, n, 'migration.sql')) &&
        n <= '202610220002_proposal_version_snapshots',
    )
    .sort();
  assert.equal(names.length, 6);
  const { PrismaClient } = require('../node_modules/.steps48-client'),
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  function copy(n) {
    fs.mkdirSync(path.join(migrations, n));
    fs.copyFileSync(
      path.join(source, n, 'migration.sql'),
      path.join(migrations, n, 'migration.sql'),
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
    assert.equal(r.status, 0, 'Local migration deploy failed');
  }
  try {
    const [identity] =
      await db.$queryRaw`SELECT current_database() AS db,current_setting('server_version_num') AS version`;
    assert.equal(identity.db, url.pathname.slice(1));
    assert.equal(Math.floor(Number(identity.version) / 10000), 17);
    const [empty] =
      await db.$queryRaw`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`;
    assert.equal(empty.n, 0, 'New empty isolated DB required');
    names.slice(0, 5).forEach(copy);
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
    assert.equal(fixture.status, 0, 'Synthetic baseline failed');
    for (const name of ['FACULTY', 'LECTURER', 'STUDENT', 'ADMIN'])
      await db.role.create({ data: { id: name, name } });
    for (const [roleId, actions] of [
      ['FACULTY', ['read', 'assign']],
      ['LECTURER', ['read', 'comment', 'review']],
      ['STUDENT', ['read']],
    ])
      for (const action of actions) {
        const p = await db.permission.findUnique({
          where: { resource_action: { resource: 'proposal', action } },
        });
        await db.rolePermission.create({
          data: { roleId, permissionId: p.id },
        });
      }
    // Represent a genuine pre-Step-6 structured snapshot using OLD columns;
    // new client RETURNING must not assume the additive columns already exist.
    await db.$executeRaw`INSERT INTO public."PROPOSAL_VERSION_WORKFLOW"
      (id,"versionId",state,"contentSchemaVersion","contentHash","createdByUserId","submittedAt","submittedByUserId")
      VALUES ('step6-before-metadata','fx-v1','SEALED',1,'synthetic-legacy-hash','fx-us1',now(),'fx-us1')`;
    const before = {
      topics: await db.topic.findMany({
        orderBy: { id: 'asc' },
        include: { proposals: true },
      }),
      versions: await db.proposalVersion.findMany({ orderBy: { id: 'asc' } }),
      reviews: await db.proposalReview.findMany({ orderBy: { id: 'asc' } }),
      falseRows: await db.taskReview.findMany(),
      permissions: await db.rolePermission.findMany(),
    };
    // Rehearse transaction rollback with an injected failure before COMMIT.
    const failure = path.join(temp, 'injected.sql'),
      sql = fs.readFileSync(
        path.join(source, names[5], 'migration.sql'),
        'utf8',
      );
    fs.writeFileSync(failure, sql.replace('COMMIT;', 'SELECT 1/0;\nCOMMIT;'));
    const injected = spawnSync(
      process.env.PR2B_PSQL || 'psql',
      ['-X', '-v', 'ON_ERROR_STOP=1', '-f', failure],
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
    assert.notEqual(injected.status, 0);
    assert.match(injected.stderr, /division by zero/);
    const [columns] =
      await db.$queryRaw`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='PROPOSAL_VERSION_WORKFLOW' AND column_name='revisionResponses'`;
    assert.equal(columns.n, 0);
    copy(names[5]);
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
      await db.proposalVersion.findMany({ orderBy: { id: 'asc' } }),
      before.versions,
    );
    assert.deepEqual(
      await db.proposalReview.findMany({ orderBy: { id: 'asc' } }),
      before.reviews,
    );
    assert.deepEqual(await db.taskReview.findMany(), before.falseRows);
    const meta = await db.proposalVersionWorkflow.findUnique({
      where: { versionId: 'fx-v1' },
    });
    assert.equal(meta.changeSummary, null);
    assert.equal(meta.revisionResponses, null);
    assert.equal(meta.createdByUserId, 'fx-us1');
    assert.equal(meta.contentHash, 'synthetic-legacy-hash');
    const permissions = await db.rolePermission.findMany({
        include: { permission: true, role: true },
      }),
      actions = (role) =>
        permissions
          .filter(
            (r) => r.role.name === role && r.permission.resource === 'proposal',
          )
          .map((r) => r.permission.action)
          .sort();
    assert.deepEqual(actions('FACULTY'), ['assign', 'read']);
    assert.deepEqual(actions('LECTURER'), [
      'comment',
      'edit',
      'read',
      'review',
    ]);
    assert.deepEqual(actions('STUDENT'), ['edit', 'read', 'submit']);
    assert.deepEqual(actions('ADMIN'), []);
    for (const previous of before.permissions)
      assert(
        permissions.some(
          (r) =>
            r.roleId === previous.roleId &&
            r.permissionId === previous.permissionId,
        ),
      );
    const rows =
      await db.$queryRaw`SELECT migration_name,checksum,finished_at FROM public."_prisma_migrations" ORDER BY migration_name`;
    assert.equal(rows.length, 6);
    for (const r of rows) {
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
      path.join(backend, 'prisma/review/step6-upgrade-results.json'),
      JSON.stringify(
        {
          result: 'PASS',
          postgresVersion: identity.version,
          checks: [
            'injected migration failure rolls back additive DDL and permission/trigger changes',
            'populated Step 5 versions and reviews preserved byte-for-byte',
            'new summary/responses NULL without guessed backfill',
            'only STUDENT edit/submit and LECTURER edit added; old actions retained; no ADMIN rights',
            'six applied checksums and repeat deploy match',
          ],
          sharedDatabaseDDL: false,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(
      'PASS Step 6 populated-baseline upgrade and injected rollback; no legacy data or permissions lost',
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(
    'Step 6 upgrade failed: ' +
      String(e.message).replace(
        /postgres(?:ql)?:\/\/[^\s]+/gi,
        '[redacted URL]',
      ),
  );
  process.exitCode = 1;
});
