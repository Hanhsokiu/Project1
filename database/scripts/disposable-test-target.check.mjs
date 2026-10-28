import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { disposableTestTarget, connectDisposableTestClient, verifyDisposableTestIdentity } from "./disposable-test-target.mjs";
import { resetDisposableTestDatabase } from "./reset-disposable-test.mjs";

// Every connection and process below is a fake. Never execute either legacy
// destructive entrypoint, start PostgreSQL/Docker, or read application .env.
const run = "1234567890abcdef", token = "a".repeat(48);
const name = `gpms_disposable_${run}`;
const env = {
  GPMS_TEST_ALLOW_DESTRUCTIVE: "1", GPMS_TEST_RUN_ID: run,
  GPMS_TEST_OWNERSHIP_TOKEN: token,
  GPMS_TEST_DATABASE_URL: `postgresql://${name}:synthetic-test-password@127.0.0.1:55490/${name}`,
};
function fakeClient(changes = {}) {
  const calls = [];
  return { calls, connect: async () => { calls.push("connect"); }, end: async () => { calls.push("end"); },
    query: async (sql) => {
      calls.push(sql);
      return { rows: [{ db: name, usr: name, owner: name, host: "127.0.0.1", port: 55490,
        marker: `project1-disposable-test:${run}:${token}`, superuser: false, createdb: false, createrole: false, ...changes }] };
    } };
}
test("no fallback to DATABASE_URL, DIRECT_URL or unconfigured environments", async () => {
  let factories = 0;
  for (const input of [{}, { DATABASE_URL: env.GPMS_TEST_DATABASE_URL, DIRECT_URL: env.GPMS_TEST_DATABASE_URL }, { ...env, GPMS_TEST_ALLOW_DESTRUCTIVE: "0" }]) {
    await assert.rejects(connectDisposableTestClient(input, () => { factories++; return fakeClient(); }));
  }
  assert.equal(factories, 0);
});
test("reject remote/default database names, default port, wrong users and URL options before connecting", async () => {
  let factories = 0;
  for (const url of [
    env.GPMS_TEST_DATABASE_URL.replace("127.0.0.1", "db.example.supabase.co"),
    env.GPMS_TEST_DATABASE_URL.replace("127.0.0.1", "localhost"),
    env.GPMS_TEST_DATABASE_URL.replace("55490", "5432"),
    env.GPMS_TEST_DATABASE_URL.replace(`/${name}`, "/postgres"),
    env.GPMS_TEST_DATABASE_URL.replace(`${name}:`, "postgres:"),
    env.GPMS_TEST_DATABASE_URL + "?options=-csearch_path=public",
  ]) await assert.rejects(connectDisposableTestClient({ ...env, GPMS_TEST_DATABASE_URL: url }, () => { factories++; return fakeClient(); }));
  assert.equal(factories, 0);
});
test("a matching name/local address alone is not proof of ownership", async () => {
  for (const wrong of [{ marker: null }, { marker: "wrong-run" }, { db: "other" }, { usr: "other" },
    { owner: "other" }, { port: 55491 }, { host: "10.0.0.1" }, { superuser: true }, { createdb: true }, { createrole: true }]) {
    const client = fakeClient(wrong);
    await assert.rejects(connectDisposableTestClient(env, () => client));
    assert(client.calls.includes("end"));
    assert(client.calls.every((sql) => !/\b(DELETE|TRUNCATE|DROP|ALTER|CREATE|INSERT|UPDATE)\b/.test(sql)));
  }
});
test("verified clients use only explicit test credentials, even when shared URLs are inherited", async () => {
  const client = fakeClient(); let selected;
  const result = await connectDisposableTestClient({ ...env, DATABASE_URL: "shared-secret", DIRECT_URL: "shared-secret" }, (url) => { selected = url; return client; });
  assert.equal(selected, env.GPMS_TEST_DATABASE_URL);
  assert.equal(result.client, client);
  await verifyDisposableTestIdentity(client, disposableTestTarget(env));
});
test("reset simulation cannot spawn before ownership is verified", async () => {
  let spawned = 0;
  await assert.rejects(resetDisposableTestDatabase({ env, clientFactory: () => fakeClient({ marker: null }), spawnCommand: () => { spawned++; return { status: 0 }; } }));
  assert.equal(spawned, 0);
});
test("reset simulation overrides both datasource URLs and never puts credentials in argv", async () => {
  const client = fakeClient(); let spawned = 0;
  await resetDisposableTestDatabase({ env: { ...env, DATABASE_URL: "shared", DIRECT_URL: "shared" }, clientFactory: () => client,
    spawnCommand: (_command, args, options) => {
      spawned++;
      assert(!args.join(" ").includes("synthetic-test-password"));
      assert.equal(options.env.DATABASE_URL, env.GPMS_TEST_DATABASE_URL);
      assert.equal(options.env.DIRECT_URL, env.GPMS_TEST_DATABASE_URL);
      assert.equal(client.calls.filter((sql) => sql.startsWith("SELECT")).length, 2);
      return { status: 0 };
    } });
  assert.equal(spawned, 1); assert(client.calls.includes("end"));
});
test("connection errors suppress credentials and SQL", async () => {
  const secret = "never-print-this-password";
  await assert.rejects(connectDisposableTestClient(env, () => ({ connect: async () => { throw new Error(secret); }, end: async () => {} })), (error) => !error.message.includes(secret));
});
test("static legacy entrypoints require the guard before destructive statements", () => {
  const clean = readFileSync(new URL("./clean-data.mjs", import.meta.url), "utf8");
  assert(!clean.includes('from "./db-client.mjs"'));
  assert(clean.indexOf("await connectDisposableTestClient") < clean.indexOf('pg.query("BEGIN")'));
  assert(clean.indexOf("await verifyDisposableTestIdentity") < clean.indexOf('pg.query(`DELETE'));
  const reset = readFileSync(new URL("./reset-dev.sh", import.meta.url), "utf8");
  assert(reset.includes("reset-disposable-test.mjs"));
  assert(!reset.includes("prisma migrate reset"));
});
