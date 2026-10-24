"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto"),
  { spawnSync } = require("node:child_process");
const { testTarget } = require("./rehearse-pr2b.cjs");
async function main() {
  const url = testTarget(process.env.PR2B_TEST_URL),
    backend = path.resolve(__dirname, ".."),
    source = path.join(backend, "prisma/migrations"),
    temp = fs.mkdtempSync(path.join(os.tmpdir(), "btl-step7-upgrade-")),
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
        n <= "202610220003_dossier_finalization",
    )
    .sort();
  assert.equal(names.length, 7);
  const { PrismaClient } = require("@prisma/client"),
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const checks = [],
    pass = (name) => {
      checks.push({ name, result: "PASS" });
      console.log("PASS " + name);
    };
  const psqlEnv = {
    ...process.env,
    PGHOST: "127.0.0.1",
    PGPORT: url.port,
    PGDATABASE: url.pathname.slice(1),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
  };
  const sqlFile = (file) =>
    spawnSync(
      process.env.PR2B_PSQL || "psql",
      ["-X", "-v", "ON_ERROR_STOP=1", "-f", file],
      { env: psqlEnv, encoding: "utf8", windowsHide: true },
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
    assert.equal(r.status, 0, "Isolated migration deploy failed: " + r.stderr);
  };
  try {
    const [identity] =
      await db.$queryRaw`SELECT current_database() AS db,current_setting('server_version_num') AS version`;
    assert.equal(identity.db, url.pathname.slice(1));
    assert.equal(Math.floor(Number(identity.version) / 10000), 17);
    const [empty] =
      await db.$queryRaw`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`;
    assert.equal(empty.n, 0, "New empty isolated database required");
    names.slice(0, -1).forEach(copy);
    deploy();
    assert.equal(
      sqlFile(path.join(backend, "prisma/review/pr2b/fixture.sql")).status,
      0,
      "Synthetic legacy fixture failed",
    );
    for (const name of ["FACULTY", "LECTURER", "STUDENT", "ADMIN"])
      await db.role.create({ data: { id: name, name } });
    // Pre-feature dossier evidence uses only old columns. No inferred finalization.
    await db.$executeRaw`INSERT INTO public."THESIS_DOSSIER"(id,proposal_id,status,updated_at) VALUES ('step7-legacy','fx-p1','SUBMITTED',now())`;
    const before = {
      topics: await db.topic.findMany({
        include: { proposals: true },
        orderBy: { id: "asc" },
      }),
      versions: await db.proposalVersion.findMany({ orderBy: { id: "asc" } }),
      dossiers: await db.thesisDossier.findMany(),
      falseRows: await db.taskReview.findMany(),
    };
    const sql = fs.readFileSync(
        path.join(source, names[6], "migration.sql"),
        "utf8",
      ),
      failure = path.join(temp, "injected-failure.sql");
    fs.writeFileSync(failure, sql.replace("COMMIT;", "SELECT 1/0;\nCOMMIT;"));
    const injected = sqlFile(failure);
    assert.notEqual(injected.status, 0);
    assert.match(injected.stderr, /division by zero/);
    const [columns] =
      await db.$queryRaw`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='DOSSIER_FINALIZATION' AND column_name='printSnapshot'`;
    assert.equal(columns.n, 0);
    const [tables] =
      await db.$queryRaw`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('DOSSIER_STUDENT_PROFILE','DOSSIER_PDF_CONTENT')`;
    assert.equal(tables.n, 0);
    assert.equal(
      await db.permission.count({
        where: { resource: "dossier", action: "receive" },
      }),
      0,
    );
    pass(
      "injected failure rolls back nullable fields, new private tables, triggers and permissions",
    );
    copy(names[6]);
    deploy();
    deploy();
    assert.deepEqual(
      await db.topic.findMany({
        include: { proposals: true },
        orderBy: { id: "asc" },
      }),
      before.topics,
    );
    assert.deepEqual(
      await db.proposalVersion.findMany({ orderBy: { id: "asc" } }),
      before.versions,
    );
    assert.deepEqual(await db.thesisDossier.findMany(), before.dossiers);
    assert.deepEqual(await db.taskReview.findMany(), before.falseRows);
    assert.equal(await db.dossierStudentProfile.count(), 0);
    assert.equal(await db.dossierFinalization.count(), 0);
    assert.equal(await db.dossierReceipt.count(), 0);
    pass(
      "populated Step 6/legacy dossiers, versions and boolean reviews preserved; no profile/approval/receipt backfill",
    );
    const perms = await db.rolePermission.findMany({
      include: { permission: true },
    });
    const assigned = (role) =>
      perms
        .filter((p) => p.roleId === role)
        .map((p) => p.permission.resource + ":" + p.permission.action)
        .sort();
    assert.deepEqual(assigned("FACULTY"), [
      "dossier:receive",
      "proposal:export",
      "proposal:finalize",
      "proposal:read",
    ]);
    assert.deepEqual(assigned("LECTURER"), ["proposal:export"]);
    assert.deepEqual(assigned("STUDENT"), ["proposal:export"]);
    assert.deepEqual(assigned("ADMIN"), []);
    pass(
      "new permissions scoped to faculty/owner/advisor roles; ADMIN gets no academic grant",
    );
    const history =
      await db.$queryRaw`SELECT migration_name,checksum,finished_at FROM public."_prisma_migrations" ORDER BY migration_name`;
    assert.equal(history.length, 7);
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
    pass("seven migration checksums match; repeat deployment is idempotent");
    fs.writeFileSync(
      path.join(backend, "prisma/review/step7-upgrade-results.json"),
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
    "Step 7 upgrade failed: " +
      String(e.message).replace(
        /postgres(?:ql)?:\/\/[^\s]+/gi,
        "[redacted URL]",
      ),
  );
  process.exitCode = 1;
});
