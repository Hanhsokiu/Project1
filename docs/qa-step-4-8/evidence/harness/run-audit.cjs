"use strict";
const fs = require("node:fs"), path = require("node:path"), cp = require("node:child_process"), crypto = require("node:crypto");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "../../../..");
const req = createRequire(path.join(root, "backend/package.json"));
const evidence = path.join(root, "docs/qa-step-4-8/evidence");
const { PrismaClient } = req("@prisma/client");
async function main() {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, ".cache/integration-ui/config.json"), "utf8"));
  const url = new URL(`postgresql://btl_ui:${cfg.password}@127.0.0.1:55451/postgres`);
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const runId = new Date().toISOString().replace(/\D/g, "").slice(0, 14) + "_" + crypto.randomBytes(3).toString("hex");
  const dir = path.join(evidence, runId); fs.mkdirSync(dir, { recursive: true });
  const summary = { runId, startedAt: new Date().toISOString(), branch: "fix/integration-ui", sourceCommit: cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), syntheticDataOnly: true, resetOrDrop: false, cases: [] };
  fs.writeFileSync(path.join(evidence, "latest-run.txt"), runId);
  function save() { fs.writeFileSync(path.join(dir, "run-summary.json"), JSON.stringify(summary, null, 2)); }
  save();
  try {
    const [identity] = await db.$queryRawUnsafe("SELECT current_database() AS db,current_setting('server_version_num') AS version");
    if (identity.db !== "postgres" || Math.floor(Number(identity.version) / 10000) !== 17) throw Error("Unexpected test cluster identity");
    const suites = [
      ["live-e2e", "test-steps4-8-e2e.cjs"], ["step4", "test-review-groups.cjs"],
      ["step5", "test-proposal-reviews.cjs"], ["step6", "test-proposal-versions.cjs"],
      ["step7", "test-proposal-dossiers.cjs"], ["step8a", "test-guidance-tasks.cjs"],
      ["step8b", "test-guidance-submissions.cjs"], ["step8c", "test-guidance-reviews.cjs"],
    ];
    for (const [name, script] of suites) {
      const database = `btl_pr2b_audit_${runId}_${name.replace(/-/g, "_")}`;
      if (!/^btl_pr2b_audit_[a-z0-9_]+$/.test(database)) throw Error("Unsafe test DB name");
      await db.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
      const target = new URL(url); target.pathname = "/" + database;
      const out = path.join(dir, name); fs.mkdirSync(path.join(out, "tmp"), { recursive: true });
      const env = { ...process.env, DATABASE_URL: target.toString(), DIRECT_URL: target.toString(), PR2B_TEST_URL: target.toString(), PR2B_PSQL: path.join(cfg.bin, "psql.exe"), EMAIL_WORKER_ENABLED: "false", QA_RUN_DIR: out, TEMP: path.join(out, "tmp"), TMP: path.join(out, "tmp"), NODE_OPTIONS: `--require="${path.join(__dirname, "preload.cjs").replace(/\\/g, "/")}"` };
      const startedAt = new Date().toISOString();
      const log = fs.openSync(path.join(out, "console.log"), "w");
      console.log("RUN " + name);
      const exitCode = await new Promise((resolve, reject) => {
        const child = cp.spawn(process.execPath, [path.join(root, "backend/scripts", script)], { cwd: path.join(root, "backend"), env, stdio: ["ignore", log, log], windowsHide: true });
        child.once("error", reject); child.once("exit", resolve);
      });
      fs.closeSync(log);
      summary.cases.push({ name, database, startedAt, finishedAt: new Date().toISOString(), exitCode, result: exitCode === 0 ? "PASS" : "FAIL", log: name + "/console.log" }); save();
      console.log((exitCode === 0 ? "PASS " : "FAIL ") + name);
    }
  } finally {
    await db.$disconnect(); summary.finishedAt = new Date().toISOString(); save();
  }
}
main().catch(e => { console.error(String(e.message).replace(/postgres(?:ql)?:\/\/\S+/g, "[REDACTED]")); process.exitCode = 1; });
