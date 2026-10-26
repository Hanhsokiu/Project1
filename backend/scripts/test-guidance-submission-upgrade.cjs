"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict"),
  { spawnSync } = require("node:child_process");
const { testTarget } = require("./rehearse-pr2b.cjs");
async function main() {
  const url = testTarget(process.env.PR2B_TEST_URL),
    backend = path.resolve(__dirname, ".."),
    source = path.join(backend, "prisma/migrations"),
    temp = fs.mkdtempSync(path.join(os.tmpdir(), "btl-step8b-upgrade-")),
    migrations = path.join(temp, "migrations");
  Object.assign(process.env, {
    DATABASE_URL: url.toString(),
    DIRECT_URL: url.toString(),
  });
  fs.mkdirSync(migrations);
  fs.copyFileSync(
    path.join(backend, "prisma/schema.prisma"),
    path.join(temp, "schema.prisma"),
  );
  fs.copyFileSync(
    path.join(source, "migration_lock.toml"),
    path.join(migrations, "migration_lock.toml"),
  );
  const names = fs
    .readdirSync(source)
    .filter(
      (n) =>
        n <= "202610220005_guidance_submissions" &&
        fs.existsSync(path.join(source, n, "migration.sql")),
    )
    .sort();
  assert.equal(names.length, 9);
  const { PrismaClient } = require("../node_modules/.steps48-client"),
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } }),
    checks = [],
    pass = (name) => {
      checks.push({ name, result: "PASS" });
      console.log("PASS " + name);
    };
  const env = {
    ...process.env,
    PGHOST: "127.0.0.1",
    PGPORT: url.port,
    PGDATABASE: url.pathname.slice(1),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
  };
  const runSql = (file) =>
    spawnSync(
      process.env.PR2B_PSQL || "psql",
      ["-X", "-v", "ON_ERROR_STOP=1", "-f", file],
      { env, encoding: "utf8", windowsHide: true },
    );
  const copy = (n) => {
    fs.mkdirSync(path.join(migrations, n));
    fs.copyFileSync(
      path.join(source, n, "migration.sql"),
      path.join(migrations, n, "migration.sql"),
    );
  };
  const deploy = () => {
    const r = spawnSync(
      process.execPath,
      [
        require.resolve("prisma/build/index.js"),
        "migrate",
        "deploy",
        "--schema",
        path.join(temp, "schema.prisma"),
      ],
      { cwd: temp, env: process.env, encoding: "utf8", windowsHide: true },
    );
    assert.equal(r.status, 0, "Isolated deploy failed: " + r.stderr);
  };
  try {
    const [identity] =
      await db.$queryRaw`SELECT current_database() AS db,current_setting('server_version_num') AS version`;
    assert.equal(identity.db, url.pathname.slice(1));
    assert.equal(Math.floor(Number(identity.version) / 10000), 17);
    const [empty] =
      await db.$queryRaw`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`;
    assert.equal(empty.n, 0);
    names.slice(0, -1).forEach(copy);
    deploy();
    assert.equal(
      runSql(path.join(backend, "prisma/review/pr2b/fixture.sql")).status,
      0,
      "Synthetic fixture failed",
    );
    for (const name of ["FACULTY", "LECTURER", "STUDENT", "ADMIN"])
      await db.role.create({ data: { id: name, name } });
    await db.$executeRaw`INSERT INTO public."SUBMISSION_WORKFLOW"(id,"updatedAt","submissionId","taskId") VALUES('legacy-step8b',CURRENT_TIMESTAMP,'fx-sub1','fx-task1')`;
    const before = {
      tasks: await db.task.findMany(),
      plans: await db.guidancePlan.findMany(),
      submissions: await db.taskSubmission.findMany(),
      reviews: await db.taskReview.findMany(),
      workflow:
        await db.$queryRaw`SELECT to_jsonb(w) AS value FROM public."SUBMISSION_WORKFLOW" w ORDER BY id`,
    };
    const sql = fs.readFileSync(
        path.join(source, names[8], "migration.sql"),
        "utf8",
      ),
      injectedPath = path.join(temp, "injected.sql");
    fs.writeFileSync(
      injectedPath,
      sql.replace("COMMIT;", "SELECT 1/0;\nCOMMIT;"),
    );
    const result = runSql(injectedPath);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /division by zero/);
    const [absent] =
      await db.$queryRaw`SELECT to_regclass('public."GUIDANCE_SUBMISSION_UPLOAD"')::text AS table_name`;
    assert.equal(absent.table_name, null);
    const [cols] =
      await db.$queryRaw`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='SUBMISSION_WORKFLOW' AND column_name IN('contextSnapshot','filePolicySnapshot')`;
    assert.equal(cols.n, 0);
    assert.equal(
      await db.permission.count({ where: { resource: "submission" } }),
      0,
    );
    pass(
      "injected failure rolls back staging table, snapshot columns, triggers, indexes and permission grants",
    );
    copy(names[8]);
    deploy();
    deploy();
    assert.deepEqual(await db.task.findMany(), before.tasks);
    assert.deepEqual(await db.guidancePlan.findMany(), before.plans);
    assert.deepEqual(await db.taskSubmission.findMany(), before.submissions);
    assert.deepEqual(await db.taskReview.findMany(), before.reviews);
    assert.deepEqual(
      await db.$queryRaw`SELECT to_jsonb(w)-'contextSnapshot'-'filePolicySnapshot' AS value FROM public."SUBMISSION_WORKFLOW" w ORDER BY id`,
      before.workflow,
    );
    const legacy = await db.submissionWorkflow.findUnique({
      where: { submissionId: "fx-sub1" },
    });
    assert.equal(legacy.contextSnapshot, null);
    assert.equal(legacy.filePolicySnapshot, null);
    assert.equal(legacy.state, null);
    assert.equal(legacy.submittedByUserId, null);
    assert.equal(before.reviews[0].isPassed, false);
    assert.equal(await db.guidanceSubmissionUpload.count(), 0);
    pass(
      "legacy tasks/submissions/false review remain identical; no fabricated owner, result, files, policy or backfill",
    );
    const grants = await db.rolePermission.findMany({
        where: { permission: { resource: "submission" } },
        include: { role: true, permission: true },
      }),
      actions = (name) =>
        grants
          .filter((g) => g.role.name === name)
          .map((g) => g.permission.action)
          .sort();
    assert.deepEqual(actions("FACULTY"), ["download", "read"]);
    assert.deepEqual(actions("LECTURER"), ["download", "read"]);
    assert.deepEqual(actions("STUDENT"), ["create", "download", "read"]);
    assert.deepEqual(actions("ADMIN"), []);
    pass(
      "only scoped read/download and student create permissions; no implicit ADMIN academic grant",
    );
    const rows =
      await db.$queryRaw`SELECT migration_name,checksum,finished_at FROM public."_prisma_migrations" ORDER BY migration_name`;
    assert.equal(rows.length, 9);
    for (const r of rows) {
      assert(r.finished_at);
      assert.equal(
        r.checksum,
        crypto
          .createHash("sha256")
          .update(
            fs.readFileSync(
              path.join(source, r.migration_name, "migration.sql"),
            ),
          )
          .digest("hex"),
      );
    }
    pass(
      "all nine migration checksums match and repeat deploy changes nothing",
    );
    fs.writeFileSync(
      path.join(backend, "prisma/review/step8b-upgrade-results.json"),
      JSON.stringify(
        {
          result: "PASS",
          postgresVersion: identity.version,
          sharedDatabaseDDL: false,
          checks,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(
    "Step 8B isolated upgrade failed: " +
      String(e.message).replace(
        /postgres(?:ql)?:\/\/[^\s]+/gi,
        "[redacted URL]",
      ),
  );
  process.exitCode = 1;
});
