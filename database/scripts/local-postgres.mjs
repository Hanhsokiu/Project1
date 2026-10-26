import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const runner = resolve(
  root,
  ".cache/postgres-runner/node_modules/embedded-postgres/dist/index.js",
);
if (!existsSync(runner))
  throw new Error(
    "Install the isolated runner first: npm install --prefix .cache/postgres-runner embedded-postgres@18.4.0-beta.17",
  );
const { default: EmbeddedPostgres } = await import(pathToFileURL(runner).href);
const envPath = resolve(root, "backend/.env");
if (!existsSync(envPath)) {
  const password = randomBytes(24).toString("hex");
  writeFileSync(
    envPath,
    `DATABASE_URL=postgresql://gpms_demo:${password}@127.0.0.1:54339/gpms_step1\nJWT_SECRET=${randomBytes(40).toString("hex")}\nJWT_REFRESH_SECRET=${randomBytes(40).toString("hex")}\nJWT_EXPIRES_IN=1h\nJWT_REFRESH_EXPIRES_IN=7d\nPORT=3010\nFRONTEND_URL=http://localhost:5173,http://127.0.0.1:5173\nNODE_ENV=development\n`,
  );
}
const values = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const url = new URL(values.DATABASE_URL);
if (
  url.hostname !== "127.0.0.1" ||
  url.port !== "54339" ||
  url.pathname !== "/gpms_step1"
)
  throw new Error(
    "The local helper only owns 127.0.0.1:54339/gpms_step1. Use your existing PostgreSQL server for this DATABASE_URL.",
  );
const databaseDir = resolve(root, ".cache/postgres-data");
mkdirSync(dirname(databaseDir), { recursive: true });
const pg = new EmbeddedPostgres({
  databaseDir,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  port: 54339,
  persistent: true,
  createPostgresUser: false,
  authMethod: "scram-sha-256",
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: (message) => console.log(String(message).trim()),
  onError: (message) => console.error(String(message)),
});
if (!existsSync(resolve(databaseDir, "PG_VERSION"))) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
try {
  const result = await client.query(
    "SELECT datname FROM pg_database WHERE datname=$1",
    ["gpms_step1"],
  );
  if (!result.rows.length)
    await client.query(
      "CREATE DATABASE gpms_step1 ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'",
    );
} finally {
  await client.end();
}
console.log(
  "PostgreSQL ready at 127.0.0.1:54339/gpms_step1 (persistent isolated development database).",
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await new Promise(() => {});
