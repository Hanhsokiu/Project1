"use strict";
// Each database suite gets a new PG database. Retain databases; never drop/reset.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { testTarget } = require("./rehearse-pr2b.cjs");
const evidence = path.resolve(__dirname, "../../docs/implementation/evidence/steps4-8");
const suites = [
  ["step4", "review-groups", "review-group"],
  ["step5", "proposal-reviews", "proposal-review"],
  ["step6", "proposal-versions", "proposal-version"],
  ["step7", "proposal-dossiers", "proposal-dossier"],
  ["step8a", "guidance-tasks", "guidance-task"],
  ["step8b", "guidance-submissions", "guidance-submission"],
  ["step8c", "guidance-reviews", "guidance-review"],
];
async function main() {
  const base = testTarget(process.env.PR2B_TEST_URL), backend = path.resolve(__dirname, "..");
  const { PrismaClient } = require("@prisma/client"), db = new PrismaClient({ datasources: { db: { url: base.toString() } } });
  fs.mkdirSync(evidence, { recursive: true });
  const startedAt = new Date().toISOString(), cases = [];
  const runId = crypto.randomBytes(6).toString("hex");
  try {
    const [identity] = await db.$queryRaw`SELECT current_database() AS name,current_setting('server_version_num') AS version`;
    assert.equal(identity.name, base.pathname.slice(1)); assert.equal(Math.floor(Number(identity.version) / 10000), 17);
    const [tables] = await db.$queryRaw`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`;
    assert.equal(tables.n, 0, "Suite coordinator must be an empty dedicated test DB");
    const browserOnly = process.argv.includes("--browser-only");
    for (const [step, apiName, upgradeName] of suites) {
      for (const kind of browserOnly ? ["browser"] : ["api", "upgrade"]) {
        const database = "btl_pr2b_qa_" + runId + "_" + step + "_" + kind;
        const target = new URL(base);
        if (kind !== "browser") {
          assert(/^btl_pr2b_[a-z0-9_]+$/.test(database));
          await db.$executeRawUnsafe('CREATE DATABASE "' + database + '"');
          target.pathname = "/" + database;
        }
        const script = kind === "browser" ? path.resolve(backend, "../frontend/scripts/test-" + apiName + "-browser.cjs") : path.join(backend, "scripts/test-" + (kind === "api" ? apiName : upgradeName + "-upgrade") + ".cjs");
        const logPath = path.join(evidence, step + "-" + kind + ".log");
        const stream = fs.createWriteStream(logPath);
        const begin = Date.now();
        const exit = await new Promise((resolve, reject) => {
          const child = spawn(process.execPath, [script], { cwd: backend, env: { ...process.env, PR2B_TEST_URL: target.toString() }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
          child.stdout.pipe(stream, { end: false }); child.stderr.pipe(stream, { end: false });
          child.on("error", reject); child.on("exit", resolve);
        });
        await new Promise(resolve => stream.end(resolve));
        const source = path.join(backend, "prisma/review/" + step + (kind === "api" ? "" : "-" + kind) + "-results.json");
        const snapshot = path.join(evidence, step + "-" + kind + ".json");
        let count = null;
        if (exit === 0) {
          assert(fs.existsSync(source), "Successful script must produce its evidence: " + source);
          assert(fs.statSync(source).mtimeMs >= begin - 2000, "Refuse stale evidence: " + source);
          fs.copyFileSync(source, snapshot);
          const data = JSON.parse(fs.readFileSync(snapshot, "utf8"));
          count = data.checks?.length ?? null;
          assert.equal(data.result, "PASS", "Exit zero but evidence not PASS");
        }
        const item = { name: step + ":" + kind, result: exit === 0 ? "PASS" : "FAIL", exitCode: exit, checks: count, elapsedMs: Date.now() - begin, log: path.basename(logPath), ...(kind !== "browser" ? { database } : { mockedApi: true }) };
        cases.push(item); console.log(item.result + " " + item.name + " checks=" + count);
        const complete = cases.length === suites.length * (browserOnly ? 1 : 2);
        fs.writeFileSync(path.join(evidence, browserOnly ? "browser-suite.json" : "database-suite.json"), JSON.stringify({ result: cases.some(c => c.result !== "PASS") ? "FAIL" : complete ? "PASS" : "RUNNING", complete, startedAt, updatedAt: new Date().toISOString(), sharedDatabaseAccess: false, cases }, null, 2) + "\n");
      }
    }
    if (cases.some(c => c.result !== "PASS")) process.exitCode = 1;
  } finally { await db.$disconnect(); }
}
main().catch(e => { console.error("FAIL guarded integration suite: " + e.message.replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted target]")); process.exitCode = 1; });
