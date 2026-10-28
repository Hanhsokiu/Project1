"use strict";
// The only supported producer of UC17_TEST_DATABASE_URL is this ephemeral Docker
// runner. No external DB option, reset/drop command, seed or shared .env import.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const crypto = require("node:crypto"),
  assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const {
  SUITE,
  IMAGE,
  localDockerEndpoint,
  target,
  assertContainer,
  verifyDatabase,
  childEnv,
  redact,
} = require("../test/uc17/target.cjs");
const backend = path.resolve(__dirname, "..");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  assert.equal(
    process.env.UC17_TEST_DOCKER,
    "1",
    "Set UC17_TEST_DOCKER=1; no database fallback is permitted",
  );
  const run = crypto.randomBytes(8).toString("hex");
  const password = crypto.randomBytes(24).toString("hex"),
    token = crypto.randomBytes(24).toString("hex");
  const name = `project1-uc17-${run}`,
    dbName = `uc17_it_${run}`;
  const secrets = [password, token];
  let dockerEndpoint;
  function command(exe, args, env = process.env, timeout = 30000) {
    if (exe === "docker" && dockerEndpoint) {
      args = ["--host", dockerEndpoint, ...args];
      env = { ...env };
      delete env.DOCKER_CONTEXT;
      delete env.DOCKER_HOST;
    }
    const r = spawnSync(exe, args, {
      cwd: backend,
      env,
      encoding: "utf8",
      windowsHide: true,
      timeout,
      maxBuffer: 8 * 1024 * 1024,
    });
    if (r.error || r.status !== 0)
      throw new Error(
        redact(
          r.stderr || r.stdout || r.error?.code || "Command failed",
          secrets,
        ),
      );
    return r.stdout;
  }
  function inspect(id) {
    return JSON.parse(command("docker", ["inspect", id]))[0];
  }
  let containerId, root, db, t;
  try {
    // Probe BEFORE creating credentials/config files or touching any database.
    const context = command("docker", ["context", "show"]).trim();
    const contextInfo = JSON.parse(
      command("docker", ["context", "inspect", context]),
    )[0];
    // DOCKER_CONTEXT takes precedence in the Docker CLI. Pin every subsequent
    // command to the verified socket so inherited environment cannot redirect it.
    dockerEndpoint = localDockerEndpoint(
      process.env.DOCKER_CONTEXT
        ? contextInfo.Endpoints?.docker?.Host
        : process.env.DOCKER_HOST || contextInfo.Endpoints?.docker?.Host,
    );
    command("docker", ["version", "--format", "{{.Server.Version}}"]);
    const env = {
      ...process.env,
      POSTGRES_DB: dbName,
      POSTGRES_USER: dbName,
      POSTGRES_PASSWORD: password,
    };
    containerId = command(
      "docker",
      [
        "create",
        "--name",
        name,
        "--label",
        `project1.test.suite=${SUITE}`,
        "--label",
        `project1.test.run=${run}`,
        "--publish",
        "127.0.0.1::5432",
        "--env",
        "POSTGRES_DB",
        "--env",
        "POSTGRES_USER",
        "--env",
        "POSTGRES_PASSWORD",
        "--tmpfs",
        "/var/lib/postgresql/data:rw,noexec,nosuid,size=512m",
        IMAGE,
      ],
      env,
      180000,
    ).trim();
    assert.match(containerId, /^[a-f0-9]{64}$/);
    command("docker", ["start", containerId]);
    const info = inspect(containerId),
      binding = info.NetworkSettings?.Ports?.["5432/tcp"]?.[0];
    const testEnv = {
      ...process.env,
      UC17_TEST_RUN_ID: run,
      UC17_TEST_DOCKER_ENDPOINT: dockerEndpoint,
      UC17_TEST_TOKEN: token,
      UC17_TEST_CONTAINER_ID: containerId,
      UC17_TEST_DATABASE_URL: `postgresql://${dbName}:${password}@127.0.0.1:${binding?.HostPort}/${dbName}`,
    };
    t = target(testEnv);
    assertContainer(info, t);
    const deadline = Date.now() + 45000;
    while (true) {
      try {
        command("docker", [
          "exec",
          containerId,
          "pg_isready",
          "-U",
          dbName,
          "-d",
          dbName,
        ]);
        break;
      } catch {
        if (Date.now() >= deadline)
          throw new Error("Owned PostgreSQL container readiness timeout");
        await delay(200);
      }
    }
    const { PrismaClient } = require("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: t.url.toString() } } });
    const identity = await verifyDatabase(db, t, false);
    console.log("Verified isolated target: " + JSON.stringify(identity));
    const [empty] = await db.$queryRawUnsafe(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
    );
    assert.equal(
      empty.n,
      0,
      "Fresh empty database required; refusing to reuse data",
    );
    // Identifier/token consist of generated hex and a fixed prefix; no user SQL.
    await db.$executeRawUnsafe(
      `COMMENT ON DATABASE "${t.db}" IS '${SUITE}:${run}:${token}'`,
    );
    await verifyDatabase(db, t);
    root = fs.mkdtempSync(path.join(os.tmpdir(), `project1-uc17-${run}-`));
    const envChild = { ...childEnv(testEnv, t), UC17_TEST_PRIVATE_ROOT: root };
    // Compile the actual implementation, including decorator metadata. No old dist.
    command(
      process.execPath,
      [require.resolve("typescript/bin/tsc"), "-p", "../shared/tsconfig.json"],
      envChild,
      120000,
    );
    command(
      process.execPath,
      [
        require.resolve("typescript/bin/tsc"),
        "-p",
        "tsconfig.build.json",
        "--incremental",
        "false",
      ],
      envChild,
      120000,
    );
    const migrations = path.join(backend, "prisma/migrations");
    const names = fs
      .readdirSync(migrations)
      .filter((n) => fs.existsSync(path.join(migrations, n, "migration.sql")))
      .sort();
    const stage = path.join(root, "legacy-stage");
    fs.mkdirSync(path.join(stage, "migrations"), { recursive: true });
    fs.copyFileSync(
      path.join(backend, "prisma/schema.prisma"),
      path.join(stage, "schema.prisma"),
    );
    fs.copyFileSync(
      path.join(migrations, "migration_lock.toml"),
      path.join(stage, "migrations/migration_lock.toml"),
    );
    for (const n of names.filter(
      (n) => n < "202610260005_defense_confirmation_decisions",
    )) {
      fs.mkdirSync(path.join(stage, "migrations", n));
      fs.copyFileSync(
        path.join(migrations, n, "migration.sql"),
        path.join(stage, "migrations", n, "migration.sql"),
      );
    }
    async function deploy(schema) {
      assertContainer(inspect(containerId), t);
      await verifyDatabase(db, t);
      command(
        process.execPath,
        [
          require.resolve("prisma/build/index.js"),
          "migrate",
          "deploy",
          "--schema",
          schema,
        ],
        envChild,
        180000,
      );
    }
    // Upgrade rehearsal as well as fresh replay: legacy rows exist BEFORE UC17 DDL.
    await deploy(path.join(stage, "schema.prisma"));
    const { makeFixture } = require("../test/uc17/fixture.cjs");
    const legacy = await makeFixture(db, { legacy: true });
    envChild.UC17_TEST_LEGACY = JSON.stringify(legacy);
    await deploy(path.join(backend, "prisma/schema.prisma"));
    const history = await db.$queryRawUnsafe(
      'SELECT migration_name,checksum,finished_at,rolled_back_at FROM public."_prisma_migrations" ORDER BY migration_name',
    );
    assert.deepEqual(
      history.map((r) => r.migration_name),
      names,
    );
    for (const row of history) {
      assert(row.finished_at && !row.rolled_back_at);
      assert.equal(
        row.checksum,
        crypto
          .createHash("sha256")
          .update(
            fs.readFileSync(
              path.join(migrations, row.migration_name, "migration.sql"),
            ),
          )
          .digest("hex"),
      );
    }
    console.log(
      "PASS migration replay and source checksums (including pre-UC17 legacy fixture)",
    );
    const result = spawnSync(
      process.execPath,
      [
        "--test",
        "--test-concurrency=1",
        "--test-reporter=spec",
        "test/uc17/postgres.test.cjs",
      ],
      {
        cwd: backend,
        env: envChild,
        encoding: "utf8",
        windowsHide: true,
        timeout: 240000,
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    console.log(redact((result.stdout || "") + (result.stderr || ""), secrets));
    if (result.error || result.status !== 0)
      throw new Error(
        "UC17 PostgreSQL integration suite FAILED (see redacted output)",
      );
  } catch (error) {
    if (!containerId) {
      console.log(
        "TEST WRITTEN — NOT RUN: isolated Docker PostgreSQL unavailable or explicit opt-in missing.",
      );
      console.log(redact(error.message, secrets));
      process.exitCode = 2;
    } else {
      console.error(redact(error.message, secrets));
      process.exitCode = 1;
    }
  } finally {
    await db?.$disconnect();
    if (containerId) {
      // Cleanup is bounded to the exact ID CREATED by this invocation. Never prune,
      // drop another DB, use a shared container name, or remove unrelated volumes.
      try {
        const owned = inspect(containerId);
        assert.equal(owned.Id, containerId);
        assert.equal(owned.Config?.Labels?.["project1.test.run"], run);
        assert.equal(owned.Config?.Labels?.["project1.test.suite"], SUITE);
        command("docker", ["rm", "--force", containerId]);
      } catch {
        console.error(
          "Owned test container cleanup could not be verified/completed; no other resource was removed.",
        );
        process.exitCode = 1;
      }
    }
    if (root) {
      const resolved = path.resolve(root),
        parent = path.resolve(os.tmpdir());
      assert.equal(path.dirname(resolved), parent);
      assert(path.basename(resolved).startsWith(`project1-uc17-${run}-`));
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
}
if (require.main === module)
  main().catch(() => {
    console.error("UC17 runner failed closed.");
    process.exitCode = 1;
  });
