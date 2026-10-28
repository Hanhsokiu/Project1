"use strict";
const fs = require("node:fs"), path = require("node:path"), cp = require("node:child_process"), crypto = require("node:crypto"), { createRequire } = require("node:module");
const root = path.resolve(__dirname, "../../../.."), backendReq = createRequire(path.join(root, "backend/package.json")), frontendReq = createRequire(path.join(root, "frontend/package.json"));
const run = fs.readFileSync(path.join(__dirname, "../latest-run.txt"), "utf8").trim(), out = path.join(__dirname, "..", run, "verification"); fs.mkdirSync(out, { recursive: true });
function git(...args) { return cp.execFileSync("git", args, { cwd: root, encoding: "utf8" }); }
const sourceFiles = git("ls-files", "backend/src", "backend/prisma", "backend/scripts", "frontend/src", "frontend/scripts", "shared/src", "package.json", "pnpm-lock.yaml", "README.md").trim().split(/\r?\n/).filter(p => fs.existsSync(path.join(root, p)));
const hashes = () => sourceFiles.map(file => ({ file, sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex") }));
const before = hashes(); fs.writeFileSync(path.join(out, "source-hashes-before.json"), JSON.stringify(before, null, 2));
fs.writeFileSync(path.join(out, "git-status-before.txt"), git("status", "--short"));
const env = { ...process.env, DATABASE_URL: "postgresql://qa:qa@127.0.0.1:55451/btl_pr2b_audit_validation", DIRECT_URL: "postgresql://qa:qa@127.0.0.1:55451/btl_pr2b_audit_validation", QA_RUN_DIR: out };
async function execute(name, args, cwd) {
  const log = fs.openSync(path.join(out, name + ".log"), "w"), begin = Date.now();
  const exitCode = await new Promise((resolve, reject) => { const child = cp.spawn(process.execPath, args, { cwd: path.join(root, cwd), env, windowsHide: true, stdio: ["ignore", log, log] }); child.once("error", reject); child.once("exit", resolve); });
  fs.closeSync(log); return { name, args: args.map(p => p.replaceAll(root, "<repo>")), exitCode, elapsedMs: Date.now() - begin, result: exitCode === 0 ? "PASS" : "FAIL" };
}
async function main() {
  const results = await Promise.all([
    execute("prisma-validate", [backendReq.resolve("prisma/build/index.js"), "validate", "--schema", "prisma/schema.prisma"], "backend"),
    execute("shared-typecheck", [path.join(root, "shared/node_modules/typescript/bin/tsc"), "--noEmit", "--incremental", "false"], "shared"),
    execute("backend-typecheck", [backendReq.resolve("typescript/bin/tsc"), "--noEmit", "--incremental", "false"], "backend"),
    execute("frontend-typecheck", [frontendReq.resolve("typescript/bin/tsc"), "--noEmit", "--incremental", "false"], "frontend"),
    execute("backend-unit", [backendReq.resolve("vitest/vitest.mjs"), "run", "--cache=false", "--reporter=json", "--outputFile=" + path.join(out, "backend-unit.json")], "backend"),
    execute("frontend-unit", [frontendReq.resolve("vitest/vitest.mjs"), "run", "--cache=false", "--reporter=json", "--outputFile=" + path.join(out, "frontend-unit.json")], "frontend"),
  ]);
  // Build outputs stay inside the permitted report folder.
  results.push(await execute("shared-build", [path.join(root, "shared/node_modules/typescript/bin/tsc"), "--outDir", path.join(out, "build/shared")], "shared"));
  results.push(await execute("backend-build", [backendReq.resolve("typescript/bin/tsc"), "-p", "tsconfig.build.json", "--incremental", "false", "--outDir", path.join(out, "build/backend")], "backend"));
  results.push(await execute("frontend-build", [path.join(path.dirname(frontendReq.resolve("vite/package.json")), "bin/vite.js"), "build", "--config", path.join(__dirname, "vite.config.mjs"), "--outDir", path.join(out, "build/frontend"), "--emptyOutDir"], "frontend"));
  const after = hashes(), changed = before.filter((x, i) => x.sha256 !== after[i].sha256);
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify({ finishedAt: new Date().toISOString(), cases: results, sourceFilesHashed: before.length, changedDuringVerification: changed }, null, 2));
  fs.writeFileSync(path.join(out, "git-status-after.txt"), git("status", "--short"));
  console.log(JSON.stringify(results.map(x => ({ name: x.name, result: x.result })), null, 2));
  if (changed.length || results.some(x => x.exitCode !== 0)) process.exitCode = 1;
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
