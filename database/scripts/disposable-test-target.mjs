import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** No .env, DATABASE_URL or DIRECT_URL fallback. Naming is only a preflight;
 * a server-side ownership marker and least-privilege identity are also required.
 * This module never creates a database, account, marker or environment file.
 */
export function disposableTestTarget(env) {
  if (env.GPMS_TEST_ALLOW_DESTRUCTIVE !== "1")
    throw new Error("Destructive legacy tools require explicit disposable-test configuration.");
  const run = env.GPMS_TEST_RUN_ID;
  const token = env.GPMS_TEST_OWNERSHIP_TOKEN;
  if (!/^[a-f0-9]{16}$/.test(run || "") || !/^[a-f0-9]{48}$/.test(token || ""))
    throw new Error("A test-run identity and ownership token are required.");
  let url;
  try { url = new URL(env.GPMS_TEST_DATABASE_URL); }
  catch { throw new Error("Explicit GPMS_TEST_DATABASE_URL is required; no application URL fallback."); }
  const database = `gpms_disposable_${run}`;
  const port = Number(url.port);
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" ||
      !Number.isInteger(port) || port < 1024 || port > 65535 || port === 5432 ||
      url.username !== database || url.pathname !== `/${database}` ||
      !url.password || url.search || url.hash)
    throw new Error("Refused target: only a dedicated loopback disposable-test database/user/port is supported.");
  return Object.freeze({ database, user: database, port, host: "127.0.0.1",
    marker: `project1-disposable-test:${run}:${token}`, connectionString: url.href });
}

export async function verifyDisposableTestIdentity(client, target) {
  const result = await client.query(`SELECT current_database() AS db, current_user AS usr,
    inet_server_addr()::text AS host, inet_server_port()::int AS port,
    pg_get_userbyid(d.datdba) AS owner, shobj_description(d.oid, 'pg_database') AS marker,
    r.rolsuper AS superuser, r.rolcreatedb AS createdb, r.rolcreaterole AS createrole
    FROM pg_database d JOIN pg_roles r ON r.rolname=current_user
    WHERE d.datname=current_database()`);
  const row = result.rows[0];
  if (result.rows.length !== 1 || !row || row.db !== target.database ||
      row.usr !== target.user || row.owner !== target.user || row.host !== target.host ||
      row.port !== target.port || row.marker !== target.marker ||
      row.superuser !== false || row.createdb !== false || row.createrole !== false)
    throw new Error("Disposable-test database ownership/identity was not verified; operation refused.");
}

function defaultClientFactory(connectionString) {
  // Load the existing optional pg driver only AFTER explicit target preflight.
  const require = createRequire(resolve(root, ".cache/postgres-runner/package.json"));
  const { Client } = require("pg");
  return new Client({ connectionString, connectionTimeoutMillis: 5000 });
}

export async function connectDisposableTestClient(env, clientFactory = defaultClientFactory) {
  const target = disposableTestTarget(env);
  let client;
  try {
    client = await clientFactory(target.connectionString);
    await client.connect();
    await verifyDisposableTestIdentity(client, target);
    return { client, target };
  } catch {
    if (client) await client.end().catch(() => {});
    // Never forward a driver error that could contain credentials or SQL.
    throw new Error("Disposable-test connection or ownership verification failed; no destructive operation was authorized.");
  }
}
