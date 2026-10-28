import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
export const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(
  resolve(root, ".cache/postgres-runner/package.json"),
);
export const { Client } = require("pg");
const file = readFileSync(resolve(root, "backend/.env"), "utf8");
export const values = Object.fromEntries(
  file
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
export function client(database) {
  const url = new URL(process.env.DATABASE_URL || values.DATABASE_URL);
  if (database) url.pathname = "/" + database;
  return new Client({ connectionString: url.toString() });
}
