"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict"),
  cp = require("node:child_process");
const root = path.resolve(__dirname, "../.."),
  backend = path.join(root, "backend"),
  cache = path.join(root, ".cache/demo-v3"),
  port = 55463;
const profiles = ["baseline_v3", "baseline_v4", "registration_open", "preferences_over_quota", "assignment_revision", "proposal_revision", "dossier_reopen", "guidance_overdue", "defense_conflict", "partial_grading", "publication_locked", "rbac_cross_term"];
const profile = process.env.BTL_DEMO_PROFILE || "baseline_v4";
assert(profiles.includes(profile), "Unknown isolated TEST profile");
const database = "btl_pr2b_acceptance_utc_demo_v3_" + profile,
  user = "utc_demo_v3";
const { id, hash } = require("./definition.cjs");
const req = require("node:module").createRequire(
  path.join(backend, "package.json"),
);
function safeTarget(raw) {
  const u = new URL(raw);
  assert.equal(u.protocol, "postgresql:", "PostgreSQL required");
  assert.equal(u.hostname, "127.0.0.1", "Loopback only");
  assert.equal(u.port, String(port), "Dedicated TEST port required");
  assert.equal(u.pathname, "/" + database, "Dedicated TEST database required");
  assert.equal(decodeURIComponent(u.username), user);
  assert(!u.search && !u.hash, "Connection overrides forbidden");
  return u;
}
function sanitizedEnvironment(extra = {}) {
  const env = {};
  for (const k of [
    "PATH",
    "Path",
    "SystemRoot",
    "SYSTEMROOT",
    "WINDIR",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "COMSPEC",
    "PATHEXT",
    "NUMBER_OF_PROCESSORS",
    "PROCESSOR_ARCHITECTURE",
  ])
    if (process.env[k]) env[k] = process.env[k];
  return { ...env, ...extra };
}
function configuration(create = false) {
  const file = path.join(cache, profile === "baseline_v3" ? "private-v3.json" : "private-" + profile + ".json");
  if (
    !fs.existsSync(file) &&
    fs.existsSync(path.join(cache, "private.json")) &&
    create
  ) {
    const prior = JSON.parse(
      fs.readFileSync(path.join(cache, "private.json"), "utf8"),
    );
    assert.equal(prior.owner, "UTC_PROJECT1_DEMO_V3");
    fs.writeFileSync(file, JSON.stringify({ ...prior, database }, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
  }
  if (!fs.existsSync(file)) {
    assert(create, "Run --prepare --target=local-test first");
    fs.mkdirSync(cache, { recursive: true });
    const bin =
      process.env.BTL_POSTGRES_BIN ||
      path.join(process.env.LOCALAPPDATA || "", "Temp/btl-pr2b-pg17/pgsql/bin");
    assert(
      fs.existsSync(path.join(bin, "pg_ctl.exe")),
      "PostgreSQL17 binaries unavailable",
    );
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          owner: "UTC_PROJECT1_DEMO_V3",
          database,
          user,
          port,
          bin,
          password: crypto.randomBytes(32).toString("hex"),
          accountPassword:
            "Aa9!" + crypto.randomBytes(24).toString("base64url"),
          jwt: crypto.randomBytes(40).toString("hex"),
        },
        null,
        2,
      ),
      { flag: "wx", mode: 0o600 },
    );
  }
  const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(cfg.owner, "UTC_PROJECT1_DEMO_V3");
  assert.equal(cfg.database, database);
  assert.equal(cfg.user, user);
  assert.equal(cfg.port, port);
  return cfg;
}
function connection(cfg) {
  const raw = `postgresql://${user}:${cfg.password}@127.0.0.1:${port}/${database}`;
  safeTarget(raw);
  return raw;
}
function run(exe, args, env, input, detachedOutput = false) {
  const result = cp.spawnSync(exe, args, {
    cwd: cache,
    env: sanitizedEnvironment(env),
    input,
    encoding: "utf8",
    windowsHide: true,
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024,
    ...(detachedOutput ? { stdio: "ignore" } : {}),
  });
  if (result.error || result.status !== 0) {
    const error = String(
      result.stderr || result.stdout || result.error?.code || "command failed",
    ).replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[CONNECTION_REDACTED]");
    throw Error(path.basename(exe) + ": " + error.slice(-1600));
  }
  return result.stdout;
}
function pg(cfg, name, args, input) {
  return run(
    path.join(cfg.bin, name + ".exe"),
    args,
    {
      PGHOST: "127.0.0.1",
      PGPORT: String(port),
      PGUSER: user,
      PGPASSWORD: cfg.password,
      PGDATABASE: database,
    },
    input,
    name === "pg_ctl",
  );
}
async function prepare() {
  const cfg = configuration(true),
    data = path.join(cache, "pgdata");
  if (!fs.existsSync(path.join(data, "PG_VERSION"))) {
    const file = path.join(cache, "init-password");
    fs.writeFileSync(file, cfg.password, { flag: "wx", mode: 0o600 });
    try {
      pg(cfg, "initdb", [
        "-D",
        data,
        "-U",
        user,
        "--auth=scram-sha-256",
        "--pwfile=" + file,
        "--encoding=UTF8",
        "--locale=C",
      ]);
    } finally {
      fs.unlinkSync(file);
    }
  }
  const status = cp.spawnSync(
    path.join(cfg.bin, "pg_ctl.exe"),
    ["-D", data, "status"],
    { windowsHide: true, stdio: "ignore" },
  );
  if (status.status !== 0)
    pg(cfg, "pg_ctl", [
      "-D",
      data,
      "-l",
      path.join(cache, "postgres.log"),
      "-o",
      `-p ${port} -h 127.0.0.1`,
      "-w",
      "start",
    ]);
  const exists = pg(cfg, "psql", [
    "-X",
    "-At",
    "-d",
    "postgres",
    "-c",
    `SELECT 1 FROM pg_database WHERE datname='${database}'`,
  ]).trim();
  if (exists !== "1") pg(cfg, "createdb", [database]);
  const db = client(cfg);
  try {
    await identity(db);
    const [{ n }] = await db.$queryRawUnsafe(
      "SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
    );
    const staging = path.join(cache, "schema-" + database);
    fs.mkdirSync(path.join(staging, "migrations"), { recursive: true });
    // Copy reviewed migration bytes unchanged. CWD/schema have no .env, so Prisma cannot load repository secrets.
    fs.copyFileSync(
      path.join(backend, "prisma/schema.prisma"),
      path.join(staging, "schema.prisma"),
    );
    fs.copyFileSync(
      path.join(backend, "prisma/migrations/migration_lock.toml"),
      path.join(staging, "migrations/migration_lock.toml"),
    );
    const chain = require(path.join(backend, "prisma/uc17-24-chain.json"));
    const all = fs
      .readdirSync(path.join(backend, "prisma/migrations"))
      .filter((m) =>
        fs.existsSync(
          path.join(backend, "prisma/migrations", m, "migration.sql"),
        ),
      )
      .sort();
    const stage = (names) => {
      for (const name of names) {
        const dir = path.join(staging, "migrations", name);
        fs.mkdirSync(dir, { recursive: true });
        fs.copyFileSync(
          path.join(backend, "prisma/migrations", name, "migration.sql"),
          path.join(dir, "migration.sql"),
        );
      }
    };
    const migrate = () =>
      run(
        process.execPath,
        [
          req.resolve("prisma/build/index.js"),
          "migrate",
          "deploy",
          "--schema",
          path.join(staging, "schema.prisma"),
        ],
        { DATABASE_URL: connection(cfg), DIRECT_URL: connection(cfg) },
      );
    if (n === 0) {
      stage(
        chain.baseline.map((m) => {
          assert.equal(
            hash(
              fs.readFileSync(
                path.join(
                  backend,
                  "prisma/migrations",
                  m.name,
                  "migration.sql",
                ),
              ),
            ).toUpperCase(),
            m.sha256.toUpperCase(),
          );
          return m.name;
        }),
      );
      migrate();
      for (const name of [
        "ADMIN",
        "FACULTY",
        "LECTURER",
        "STUDENT",
        "COMMITTEE",
      ])
        await db.role.create({
          data: {
            id: id("role/" + name),
            name,
            description: "Synthetic TEST " + name,
          },
        });
      stage(all);
      migrate();
    }
    const history = await db.$queryRawUnsafe(
      'SELECT migration_name,checksum,finished_at,rolled_back_at FROM public."_prisma_migrations" WHERE rolled_back_at IS NULL ORDER BY migration_name',
    );
    assert.equal(
      history.length,
      all.length,
      "Schema migration history incomplete; do not repair populated DB automatically",
    );
    for (const m of history) {
      assert(m.finished_at && !m.rolled_back_at);
      assert.equal(
        m.checksum,
        hash(
          fs.readFileSync(
            path.join(
              backend,
              "prisma/migrations",
              m.migration_name,
              "migration.sql",
            ),
          ),
        ),
      );
    }
    fs.writeFileSync(
      path.join(cache, "target.json"),
      JSON.stringify(
        {
          kind: "LOCAL_DEDICATED_TEST",
          host: "127.0.0.1",
          port,
          database,
          user,
          migrations: history.length,
          productionConnected: false,
        },
        null,
        2,
      ),
    );
    return { database, port, migrations: history.length };
  } finally {
    await db.$disconnect();
  }
}
function client(cfg = configuration()) {
  return new (req("@prisma/client").PrismaClient)({
    datasources: { db: { url: connection(cfg) } },
  });
}
async function identity(db) {
  const [row] = await db.$queryRawUnsafe(
    "SELECT current_database() name,current_user AS owner,current_setting('server_version_num')::int/10000 major,host(inet_server_addr()) AS host,inet_server_port() port",
  );
  assert.equal(row.name, database);
  assert.equal(row.owner, user);
  assert.equal(row.major, 17);
  assert.equal(row.host, "127.0.0.1");
  assert.equal(row.port, port);
  return row;
}
const storageRoot = path.join(cache, database, "storage");
module.exports = {
  root,
  backend,
  cache,
  storageRoot,
  profile,
  req,
  port,
  database,
  user,
  safeTarget,
  sanitizedEnvironment,
  configuration,
  connection,
  pg,
  prepare,
  client,
  identity,
};
