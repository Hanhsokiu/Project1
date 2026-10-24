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
    temp = fs.mkdtempSync(path.join(os.tmpdir(), "btl-step8a-upgrade-")),
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
        fs.existsSync(path.join(source, n, "migration.sql")) &&
        n <= "202610220004_guidance_task_management",
    )
    .sort();
  assert.equal(names.length, 8);
  const { PrismaClient } = require("@prisma/client"),
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const checks = [],
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
    assert.equal(empty.n, 0, "New empty test DB required");
    names.slice(0, -1).forEach(copy);
    deploy();
    assert.equal(
      runSql(path.join(backend, "prisma/review/pr2b/fixture.sql")).status,
      0,
      "Synthetic fixture failed",
    );
    for (const name of ["FACULTY", "LECTURER", "STUDENT", "ADMIN"])
      await db.role.create({ data: { id: name, name } });
    await db.$executeRaw`INSERT INTO public."TASK_WORKFLOW"(id,"taskId","planId") VALUES ('step8a-legacy-meta','fx-task1','fx-gp1')`;
    const before = {
      tasks: await db.task.findMany(),
      plans: await db.guidancePlan.findMany(),
      submissions: await db.taskSubmission.findMany(),
      reviews: await db.taskReview.findMany(),
      metadata:
        await db.$queryRaw`SELECT to_jsonb(w) AS value FROM public."TASK_WORKFLOW" w ORDER BY id`,
    };
    const injectedPath = path.join(temp, "injected.sql"),
      sql = fs.readFileSync(
        path.join(source, names[7], "migration.sql"),
        "utf8",
      );
    fs.writeFileSync(
      injectedPath,
      sql.replace("COMMIT;", "SELECT 1/0;\nCOMMIT;"),
    );
    const injected = runSql(injectedPath);
    assert.notEqual(injected.status, 0);
    assert.match(injected.stderr, /division by zero/);
    const [c] =
      await db.$queryRaw`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='TASK_WORKFLOW' AND column_name='startsAt'`;
    assert.equal(c.n, 0);
    assert.equal(
      await db.permission.count({
        where: { resource: { in: ["guidance", "task"] } },
      }),
      0,
    );
    const [triggers] =
      await db.$queryRaw`SELECT count(*)::int AS n FROM pg_trigger WHERE tgname IN ('step8a_task_scope','step8a_task_deadline')`;
    assert.equal(triggers.n, 0);
    pass(
      "injected SQL failure rolls back all nullable fields, indexes, owner/date triggers and permissions",
    );
    copy(names[7]);
    deploy();
    deploy();
    assert.deepEqual(await db.task.findMany(), before.tasks);
    assert.deepEqual(await db.guidancePlan.findMany(), before.plans);
    assert.deepEqual(await db.taskSubmission.findMany(), before.submissions);
    assert.deepEqual(await db.taskReview.findMany(), before.reviews);
    assert.deepEqual(
      await db.$queryRaw`SELECT to_jsonb(w)-'startsAt'-'expectedDeliverables'-'createdByUserId'-'assignedAdvisorId' AS value FROM public."TASK_WORKFLOW" w ORDER BY id`,
      before.metadata,
    );
    const legacy = await db.taskWorkflow.findUnique({
      where: { taskId: "fx-task1" },
    });
    for (const field of [
      "state",
      "startsAt",
      "expectedDeliverables",
      "createdByUserId",
      "assignedAdvisorId",
    ])
      assert.equal(legacy[field], null);
    assert.equal(before.reviews[0].isPassed, false);
    pass(
      "legacy task/plan/submission/review data remains unchanged; metadata stays NULL without guessed authors or status",
    );
    const perms = await db.rolePermission.findMany({
        include: { permission: true },
      }),
      actions = (role) =>
        perms
          .filter((p) => p.roleId === role)
          .map((p) => p.permission.resource + ":" + p.permission.action)
          .sort();
    assert.deepEqual(actions("FACULTY"), ["guidance:read"]);
    assert.deepEqual(actions("LECTURER"), [
      "guidance:manage",
      "guidance:read",
      "task:ensure-weekly",
      "task:manage",
    ]);
    assert.deepEqual(actions("STUDENT"), [
      "guidance:read",
      "task:ensure-weekly",
      "task:progress",
    ]);
    assert.deepEqual(actions("ADMIN"), []);
    pass(
      "only faculty read, official-advisor actions and student progress/weekly permissions added; ADMIN denied",
    );
    const history =
      await db.$queryRaw`SELECT migration_name,checksum,finished_at FROM public."_prisma_migrations" ORDER BY migration_name`;
    assert.equal(history.length, 8);
    for (const row of history) {
      assert(row.finished_at);
      assert.equal(
        row.checksum,
        crypto
          .createHash("sha256")
          .update(
            fs.readFileSync(
              path.join(source, row.migration_name, "migration.sql"),
            ),
          )
          .digest("hex"),
      );
    }
    pass(
      "eight applied migration checksums match; repeat deployment applies nothing twice",
    );
    fs.writeFileSync(
      path.join(backend, "prisma/review/step8a-upgrade-results.json"),
      JSON.stringify(
        {
          result: "PASS",
          postgresVersion: identity.version,
          checks,
          sharedDatabaseDDL: false,
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
    "Step 8A upgrade failed: " +
      String(e.message).replace(
        /postgres(?:ql)?:\/\/[^\s]+/gi,
        "[redacted URL]",
      ),
  );
  process.exitCode = 1;
});
