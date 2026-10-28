"use strict";
// Safety tests only. No PrismaClient, Docker execution or DB connection.
const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  target,
  assertContainer,
  verifyDatabase,
  assertVerifiedClient,
  childEnv,
  redact,
  SUITE,
  IMAGE,
  localDockerEndpoint,
} = require("./target.cjs");
function config() {
  return {
    UC17_TEST_DOCKER: "1",
    UC17_TEST_DOCKER_ENDPOINT: "npipe:////./pipe/docker_engine",
    UC17_TEST_RUN_ID: "a".repeat(16),
    UC17_TEST_TOKEN: "b".repeat(48),
    UC17_TEST_CONTAINER_ID: "c".repeat(64),
    UC17_TEST_DATABASE_URL: `postgresql://uc17_it_${"a".repeat(16)}:${"d".repeat(48)}@127.0.0.1:55439/uc17_it_${"a".repeat(16)}`,
  };
}
function info(t) {
  return {
    Id: t.containerId,
    Name: `/${t.name}`,
    Config: {
      Image: IMAGE,
      Labels: { "project1.test.suite": SUITE, "project1.test.run": t.run },
      Env: [
        `POSTGRES_DB=${t.db}`,
        `POSTGRES_USER=${t.user}`,
        `POSTGRES_PASSWORD=${t.url.password}`,
      ],
    },
    NetworkSettings: {
      Ports: { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: t.url.port }] },
    },
    Mounts: [{ Type: "tmpfs", Destination: "/var/lib/postgresql/data" }],
    State: { Running: true },
  };
}
test("explicit suite config is accepted; shared DATABASE_URL never selects a target", () => {
  const env = {
    ...config(),
    DATABASE_URL: "postgresql://shared:secret@shared.invalid/shared",
    DIRECT_URL: "bad",
  };
  assert.equal(target(env).url.hostname, "127.0.0.1");
});
for (const key of Object.keys(config()))
  test(`fails closed when ${key} is missing`, () => {
    const env = config();
    delete env[key];
    assert.throws(() => target(env));
  });
for (const [label, replace] of [
  [
    "remote host",
    (u) => {
      u.hostname = "shared.invalid";
    },
  ],
  [
    "localhost alias",
    (u) => {
      u.hostname = "localhost";
    },
  ],
  [
    "wrong database",
    (u) => {
      u.pathname = "/postgres";
    },
  ],
  [
    "wrong user",
    (u) => {
      u.username = "postgres";
    },
  ],
  [
    "missing password",
    (u) => {
      u.password = "";
    },
  ],
  [
    "privileged port",
    (u) => {
      u.port = "22";
    },
  ],
  [
    "URL query override",
    (u) => {
      u.search = "?host=shared.invalid";
    },
  ],
])
  test(`refuses ${label} before any DB client exists`, () => {
    const env = config(),
      url = new URL(env.UC17_TEST_DATABASE_URL);
    replace(url);
    env.UC17_TEST_DATABASE_URL = url.toString();
    assert.throws(() => target(env));
  });
test("owned local tmpfs container is accepted", () => {
  const t = target(config());
  assert.doesNotThrow(() => assertContainer(info(t), t));
});
test("remote Docker endpoints are refused; local socket is explicitly pinned", () => {
  assert.throws(() => localDockerEndpoint("tcp://remote.invalid:2375"));
  assert.equal(
    localDockerEndpoint("unix:///var/run/docker.sock"),
    "unix:///var/run/docker.sock",
  );
});
for (const [label, mutate] of [
  [
    "ID",
    (i) => {
      i.Id = "e".repeat(64);
    },
  ],
  [
    "label",
    (i) => {
      i.Config.Labels["project1.test.run"] = "other";
    },
  ],
  [
    "image",
    (i) => {
      i.Config.Image = "postgres:latest";
    },
  ],
  [
    "public binding",
    (i) => {
      i.NetworkSettings.Ports["5432/tcp"][0].HostIp = "0.0.0.0";
    },
  ],
  [
    "host bind",
    (i) => {
      i.Mounts.push({ Type: "bind", Destination: "/shared" });
    },
  ],
  [
    "named volume",
    (i) => {
      i.Mounts[0].Type = "volume";
    },
  ],
  [
    "credentials",
    (i) => {
      i.Config.Env = [];
    },
  ],
])
  test(`container ownership proof rejects mismatched ${label}`, () => {
    const t = target(config()),
      container = info(t);
    mutate(container);
    assert.throws(() => assertContainer(container, t));
  });
test("fixture helpers refuse an unverified DB client", () => {
  assert.throws(() => assertVerifiedClient({}));
});
test("database name/user/version/marker must all match before client can mutate fixtures", async () => {
  const t = target(config());
  const identity = {
    db: t.db,
    usr: t.user,
    port: 5432,
    version: 160000,
    marker: `${SUITE}:${t.run}:${t.token}`,
  };
  for (const field of ["db", "usr", "port", "version", "marker"]) {
    const db = {
      $queryRawUnsafe: async () => [{ ...identity, [field]: "wrong" }],
    };
    await assert.rejects(() => verifyDatabase(db, t));
    assert.throws(() => assertVerifiedClient(db));
  }
  const db = { $queryRawUnsafe: async () => [identity] };
  await verifyDatabase(db, t);
  assert.doesNotThrow(() => assertVerifiedClient(db));
});
test("child environment removes inherited PostgreSQL targets and overrides both Prisma URLs", () => {
  const t = target(config()),
    env = childEnv(
      {
        DATABASE_URL: "shared",
        DIRECT_URL: "shared",
        PGSERVICE: "shared",
        PGHOST: "shared",
        PR2B_TEST_URL: "shared",
        SHADOW_DATABASE_URL: "shared",
      },
      t,
    );
  assert.equal(env.DATABASE_URL, t.url.toString());
  assert.equal(env.DIRECT_URL, t.url.toString());
  for (const key of [
    "PGHOST",
    "PGSERVICE",
    "PR2B_TEST_URL",
    "SHADOW_DATABASE_URL",
  ])
    assert.equal(env[key], undefined);
});
test("runner output redacts passwords, ownership tokens and complete database URLs", () => {
  const t = target(config());
  const output = redact(`${t.url} ${t.url.password} ${t.token}`, [
    t.url.password,
    t.token,
  ]);
  assert(!output.includes(t.url.password));
  assert(!output.includes(t.token));
  assert(!output.includes("postgresql://"));
});
