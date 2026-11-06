"use strict";
const fs = require("node:fs"), path = require("node:path"), cp = require("node:child_process"), assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../../../..");
const cfg = JSON.parse(fs.readFileSync(path.join(root, ".cache/integration-ui/config.json"), "utf8"));
const data = path.resolve(root, ".cache/integration-ui/data");
assert(data.startsWith(path.resolve(root, ".cache") + path.sep));
assert.equal(fs.readFileSync(path.join(data, "PG_VERSION"), "utf8").trim(), "17");
const exe = path.join(cfg.bin, "pg_ctl.exe");
const status = cp.spawnSync(exe, ["-D", data, "status"], { windowsHide: true, stdio: "ignore" });
if (status.status === 0) console.log("PostgreSQL cluster already running; no changes.");
else {
  const cache = path.join(root, ".cache/step5-local-20261028-0906"); fs.mkdirSync(cache, { recursive: true });
  const result = cp.spawnSync(exe, ["-D", data, "-l", path.join(cache, "postgres.log"), "-o", "-p 55451 -h 127.0.0.1", "-w", "-t", "20", "start"], { windowsHide: true, encoding: "utf8" });
  assert.equal(result.status, 0, "Local PostgreSQL did not start; check private log");
  console.log("PostgreSQL 17 started on loopback 55451; no migration/seed/reset performed.");
}
