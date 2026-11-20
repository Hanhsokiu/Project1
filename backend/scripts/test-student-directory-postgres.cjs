"use strict";
// Disposable loopback PostgreSQL. Does not load .env or connect to shared DBs.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawnSync } = require("node:child_process");
const backend = path.resolve(__dirname, "..");
const bin = process.env.PG_TEST_BIN || "C:\\Program Files\\PostgreSQL\\17\\bin";
function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, { windowsHide: true, encoding: "utf8", ...options });
  if (result.error || result.status !== 0) throw new Error(result.stderr || result.stdout || result.error?.message || "Test process failed");
  return result;
}
async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "btl-student-directory-"));
  const data = path.join(temp, "data");
  if (!path.resolve(data).startsWith(path.resolve(temp) + path.sep)) throw new Error("Invalid owned test path");
  const port = await new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.on("error", reject);
    listener.listen(0, "127.0.0.1", () => {
      const value = listener.address().port;
      listener.close(() => resolve(value));
    });
  });
  const exe = name => path.join(bin, name + (process.platform === "win32" ? ".exe" : ""));
  let started = false;
  try {
    run(exe("initdb"), ["-D", data, "-U", "postgres", "--auth-local=trust", "--auth-host=trust", "--no-locale", "--encoding=UTF8"]);
    run(exe("pg_ctl"), ["-D", data, "-l", path.join(temp, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port} -F`, "-w", "start"], { stdio: "ignore" });
    started = true;
    const url = `postgresql://postgres@127.0.0.1:${port}/postgres`;
    const result = spawnSync(process.execPath, [require.resolve("vitest/vitest.mjs"), "run", "src/catalog/repository/student-directory.postgres.integration.spec.ts"], {
      cwd: backend, windowsHide: true, stdio: "inherit",
      env: { ...process.env, GPMS_INTEGRATION: "1", DIRECTORY_TEST_DATABASE_URL: url, DATABASE_URL: url, DIRECT_URL: url },
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } finally {
    if (started) run(exe("pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"]);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
