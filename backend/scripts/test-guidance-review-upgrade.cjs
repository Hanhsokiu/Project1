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
    temp = fs.mkdtempSync(path.join(os.tmpdir(), "btl-step8c-upgrade-")),
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
        n <= "202610230001_guidance_reviews" &&
        fs.existsSync(path.join(source, n, "migration.sql")),
    )
    .sort();
  assert.equal(names.length, 10);
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
      ),
    copy = (n) => {
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
    );
    for (const name of ["FACULTY", "LECTURER", "STUDENT", "ADMIN"])
      await db.role.create({ data: { id: name, name } });
    await db.guidanceMeeting.create({
      data: {
        id: "8c-legacy-meeting",
        guidancePlanId: "fx-gp1",
        meetingDate: new Date("2026-10-22T02:00:00Z"),
        summary: "Legacy combined discussion; do not split",
      },
    });
    await db.notification.create({
      data: {
        id: "8c-legacy-notification",
        userId: "fx-us1",
        title: "Existing notification",
        body: "Existing body",
      },
    });
    const before = {
      tasks: await db.task.findMany(),
      submissions: await db.taskSubmission.findMany(),
      reviews: await db.taskReview.findMany(),
      meetings: await db.guidanceMeeting.findMany(),
      notifications: await db.notification.findMany(),
    };
    const sql = fs.readFileSync(
        path.join(source, names[9], "migration.sql"),
        "utf8",
      ),
      injected = path.join(temp, "injected.sql");
    fs.writeFileSync(injected, sql.replace("COMMIT;", "SELECT 1/0;\nCOMMIT;"));
    const failed = runSql(injected);
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /division by zero/);
    const [index] =
      await db.$queryRaw`SELECT to_regclass('public."PROGRESS_REVIEW_reviewerUserId_recordedAt_idx"')::text AS name`;
    assert.equal(index.name, null);
    assert.equal(
      await db.permission.count({
        where: {
          OR: [
            { resource: "task", action: "review" },
            { resource: "guidance", action: "monitor" },
          ],
        },
      }),
      0,
    );
    const [trigger] =
      await db.$queryRaw`SELECT count(*)::int AS n FROM pg_trigger WHERE tgname LIKE 'step8c_review_%'`;
    assert.equal(trigger.n, 0);
    pass(
      "injected DDL failure atomically rolls back review consistency guards, indexes and permissions",
    );
    copy(names[9]);
    deploy();
    deploy();
    assert.deepEqual(await db.task.findMany(), before.tasks);
    assert.deepEqual(await db.taskSubmission.findMany(), before.submissions);
    assert.deepEqual(await db.taskReview.findMany(), before.reviews);
    assert.deepEqual(await db.guidanceMeeting.findMany(), before.meetings);
    assert.deepEqual(await db.notification.findMany(), before.notifications);
    assert.equal(await db.progressReview.count(), 0);
    assert.equal(await db.meetingWorkflow.count(), 0);
    assert.equal(before.reviews[0].isPassed, false);
    pass(
      "legacy bool result, task/submission, meeting summary and notification remain byte-for-byte data equivalent; no guessed split/backfill",
    );
    const grants = await db.rolePermission.findMany({
      where: {
        permission: {
          OR: [
            { resource: "task", action: "review" },
            { resource: "guidance", action: "monitor" },
          ],
        },
      },
      include: { role: true, permission: true },
    });
    assert.deepEqual(
      grants
        .map(
          (g) =>
            g.role.name +
            ":" +
            g.permission.resource +
            ":" +
            g.permission.action,
        )
        .sort(),
      ["FACULTY:guidance:monitor", "LECTURER:task:review"],
    );
    pass(
      "review/monitor grants are separated by role and never assigned to ADMIN",
    );
    const history =
      await db.$queryRaw`SELECT migration_name,checksum,finished_at FROM public."_prisma_migrations" ORDER BY migration_name`;
    assert.equal(history.length, 10);
    for (const r of history) {
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
      "ten applied checksums match original SQL and repeat deploy applies nothing twice",
    );
    fs.writeFileSync(
      path.join(backend, "prisma/review/step8c-upgrade-results.json"),
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
    "Step 8C isolated upgrade failed: " +
      String(e.message).replace(
        /postgres(?:ql)?:\/\/[^\s]+/gi,
        "[redacted URL]",
      ),
  );
  process.exitCode = 1;
});
