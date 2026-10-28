"use strict";
const assert = require("node:assert/strict");
const SUITE = "project1-uc17-postgres-v1";
const IMAGE = "postgres:16-alpine";
const verifiedClients = new WeakSet();

function localDockerEndpoint(value) {
  assert(
    typeof value === "string" && /^(npipe:\/\/|unix:\/\/)/.test(value),
    "An explicit local Docker socket is required; remote Docker is refused",
  );
  return value;
}

function target(env) {
  // Deliberately never consult DATABASE_URL, DIRECT_URL, .env or PR2B_TEST_URL.
  assert.equal(env.UC17_TEST_DOCKER, "1", "UC17_TEST_DOCKER=1 is required");
  const endpoint = localDockerEndpoint(env.UC17_TEST_DOCKER_ENDPOINT);
  const run = env.UC17_TEST_RUN_ID;
  assert.match(run || "", /^[a-f0-9]{16}$/, "Suite-generated run ID required");
  assert.match(
    env.UC17_TEST_TOKEN || "",
    /^[a-f0-9]{48}$/,
    "Ownership token required",
  );
  assert.match(
    env.UC17_TEST_CONTAINER_ID || "",
    /^[a-f0-9]{64}$/,
    "Owned container ID required",
  );
  let url;
  try {
    url = new URL(env.UC17_TEST_DATABASE_URL);
  } catch {
    throw new Error("Explicit UC17_TEST_DATABASE_URL required; no fallback");
  }
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.username, `uc17_it_${run}`);
  assert.equal(url.pathname, `/uc17_it_${run}`);
  assert.match(url.password, /^[a-f0-9]{48}$/);
  assert(Number(url.port) >= 1024 && Number(url.port) <= 65535);
  assert.equal(url.search, "", "Arbitrary URL options are refused");
  assert.equal(url.hash, "");
  return {
    run,
    endpoint,
    url,
    name: `project1-uc17-${run}`,
    db: url.pathname.slice(1),
    user: url.username,
    token: env.UC17_TEST_TOKEN,
    containerId: env.UC17_TEST_CONTAINER_ID,
  };
}

function assertContainer(info, t) {
  assert.equal(info.Id, t.containerId);
  assert.equal(info.Name, `/${t.name}`);
  assert.equal(info.Config?.Image, IMAGE);
  assert.equal(info.Config?.Labels?.["project1.test.suite"], SUITE);
  assert.equal(info.Config?.Labels?.["project1.test.run"], t.run);
  const env = info.Config?.Env || [];
  assert(env.includes(`POSTGRES_DB=${t.db}`));
  assert(env.includes(`POSTGRES_USER=${t.user}`));
  assert(env.includes(`POSTGRES_PASSWORD=${t.url.password}`));
  const bindings = info.NetworkSettings?.Ports?.["5432/tcp"];
  assert.equal(bindings?.length, 1);
  assert.equal(bindings[0].HostIp, "127.0.0.1");
  assert.equal(bindings[0].HostPort, t.url.port);
  assert.equal(info.State?.Running, true);
  assert(
    info.Mounts?.some(
      (m) => m.Type === "tmpfs" && m.Destination === "/var/lib/postgresql/data",
    ),
  );
  assert(!info.Mounts.some((m) => m.Type === "bind" || m.Type === "volume"));
}

async function verifyDatabase(db, t, requireMarker = true) {
  const [identity] = await db.$queryRawUnsafe(`SELECT current_database() AS db,
    current_user AS usr, inet_server_port()::int AS port,
    current_setting('server_version_num')::int AS version,
    shobj_description(oid, 'pg_database') AS marker
    FROM pg_database WHERE datname=current_database()`);
  assert.equal(identity.db, t.db);
  assert.equal(identity.usr, t.user);
  assert.equal(identity.port, 5432);
  assert.equal(Math.floor(identity.version / 10000), 16);
  if (requireMarker) {
    assert.equal(identity.marker, `${SUITE}:${t.run}:${t.token}`);
    verifiedClients.add(db);
  }
  return {
    host: "127.0.0.1",
    port: Number(t.url.port),
    database: identity.db,
    user: identity.usr,
  };
}

function childEnv(env, t) {
  const result = { ...env };
  for (const key of Object.keys(result))
    if (
      /^(PG|DATABASE_URL$|DIRECT_URL$|SHADOW_DATABASE_URL$|PR2B_TEST_URL$)/i.test(
        key,
      )
    )
      delete result[key];
  return {
    ...result,
    DATABASE_URL: t.url.toString(),
    DIRECT_URL: t.url.toString(),
    NODE_ENV: "test",
    GPMS_INTEGRATION: "0",
  };
}

function redact(value, secrets = []) {
  let result = String(value);
  for (const secret of secrets)
    if (secret) result = result.split(secret).join("[REDACTED]");
  return result.replace(
    /postgres(?:ql)?:\/\/[^\s"'`]+/gi,
    "[REDACTED_DATABASE_URL]",
  );
}
function assertVerifiedClient(db) {
  assert(
    verifiedClients.has(db),
    "Fixture client must pass isolated DB ownership verification first",
  );
}
module.exports = {
  SUITE,
  IMAGE,
  localDockerEndpoint,
  target,
  assertContainer,
  verifyDatabase,
  assertVerifiedClient,
  childEnv,
  redact,
};
