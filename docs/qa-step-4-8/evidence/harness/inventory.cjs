"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), cp = require("node:child_process");
const root = path.resolve(__dirname, "../../../.."), run = fs.readFileSync(path.join(__dirname, "../latest-run.txt"), "utf8").trim(), dir = path.join(__dirname, "..", run);
function walk(base) { return fs.readdirSync(base, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(base, e.name)) : [path.join(base, e.name)]); }
const bases = ["backend/src/topic", "backend/src/guidance", "backend/src/notification", "shared/src/contracts", ...["review-groups", "proposal-reviews", "proposal-versions", "proposal-dossiers", "guidance-tasks", "guidance-reviews", "task-submissions"].map(n => "frontend/src/features/" + n)];
const files = bases.filter(p => fs.existsSync(path.join(root, p))).flatMap(p => walk(path.join(root, p))).map(file => {
  const text = fs.readFileSync(file, "utf8");
  return { file: path.relative(root, file).replace(/\\/g, "/"), lines: text.split(/\r?\n/).length, sha256: crypto.createHash("sha256").update(text).digest("hex"), exportedClasses: [...text.matchAll(/(?:export )?class (\w+)/g)].map(m => m[1]), operations: [...text.matchAll(/(?:async\s+)?(\w+)\([^\n]*\)\s*\{/g)].map(m => m[1]).filter(m => !["if", "for", "while", "catch", "switch"].includes(m)) };
});
const schema = fs.readFileSync(path.join(root, "backend/prisma/schema.prisma"), "utf8");
fs.writeFileSync(path.join(dir, "source-inventory.json"), JSON.stringify({ generatedAt: new Date().toISOString(), files, enums: [...schema.matchAll(/enum (\w+)\s*\{([^}]+)\}/g)].map(m => ({ name: m[1], values: m[2].trim().split(/\s+/) })), modelCount: [...schema.matchAll(/^model /gm)].length, analysisMethod: "File inventory plus manual review of contracts, routing, modules, critical state/auth/transaction/file paths; dynamic suites exercise services. Inventory alone is not full line-by-line verification." }, null, 2));
const endpoints = JSON.parse(fs.readFileSync(path.join(dir, "live-e2e/endpoint-auth.json"), "utf8")), traffic = JSON.parse(fs.readFileSync(path.join(dir, "live-e2e/live-api-traffic.json"), "utf8"));
const coverage = endpoints.map(e => { const re = new RegExp("^" + e.path.replace(/\{[^}]+\}/g, "[^/]+") + "$"); return { ...e, observedAuthenticatedStatuses: [...new Set(traffic.filter(t => t.method === e.method && re.test(t.path)).map(t => t.status))].sort(), validationAndConcurrencyEvidence: "Feature suite scenarios; not independently traced for every operation" }; });
fs.writeFileSync(path.join(dir, "api-operation-matrix.json"), JSON.stringify(coverage, null, 2));
const matrix = [];
for (const step of ["step4", "step5", "step6", "step7", "step8a", "step8b", "step8c"]) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, step, "generated", step + "-results.json"), "utf8"));
  data.checks.forEach((c, i) => matrix.push({ id: step.toUpperCase() + "-" + String(i + 1).padStart(2, "0"), step, name: c.name, result: c.result, evidence: step + "/generated/" + step + "-results.json", source: "backend/scripts/test-" + ({ step4: "review-groups", step5: "proposal-reviews", step6: "proposal-versions", step7: "proposal-dossiers", step8a: "guidance-tasks", step8b: "guidance-submissions", step8c: "guidance-reviews" })[step] + ".cjs", limitation: "Scenario group may contain multiple assertions; not a complete business requirement count" }));
}
fs.writeFileSync(path.join(dir, "test-case-matrix.json"), JSON.stringify(matrix, null, 2));
fs.writeFileSync(path.join(dir, "git-history.txt"), cp.execFileSync("git", ["log", "-12", "--format=%h %s"], { cwd: root, encoding: "utf8" }));
console.log(JSON.stringify({ sourceFiles: files.length, sourceLines: files.reduce((n, f) => n + f.lines, 0), operations: endpoints.length, authenticatedSuccessObserved: coverage.filter(e => e.observedAuthenticatedStatuses.some(s => s >= 200 && s < 300)).length, scenarioGroups: matrix.length }));
