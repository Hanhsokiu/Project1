"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), cp = require("node:child_process");
const root = path.resolve(__dirname, "../../../.."), qa = path.join(root, "docs/qa-step-4-8"), evidence = path.join(qa, "evidence");
const run = fs.readFileSync(path.join(evidence, "latest-run.txt"), "utf8").trim();
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const expectedReports = ["00-executive-summary.md", "01-scope-and-requirements.md", "02-step-4-audit.md", "03-step-5-audit.md", "04-step-6-audit.md", "05-step-7-audit.md", "06-step-8-audit.md", "07-ui-ux-report.md", "08-api-test-report.md", "09-database-audit.md", "10-rbac-security-report.md", "11-integration-e2e-report.md", "12-confirmed-bugs.md", "13-missing-features.md", "14-improvement-roadmap.md", "15-final-qa-verdict.md"];
const missingReports = expectedReports.filter(file => !fs.existsSync(path.join(qa, file)));
const before = JSON.parse(fs.readFileSync(path.join(evidence, run, "verification/source-hashes-before.json"), "utf8"));
const changedSourceFiles = before.filter(x => hash(path.join(root, x.file)) !== x.sha256).map(x => x.file);
const secret = JSON.parse(fs.readFileSync(path.join(root, ".cache/integration-ui/config.json"), "utf8")).password;
const sensitiveFiles = [];
for (const file of walk(qa)) {
  const bytes = fs.readFileSync(file);
  if (bytes.includes(Buffer.from(secret))) sensitiveFiles.push(path.relative(qa, file));
  else if (/\.(json|log|txt|md)$/.test(file) && /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/.test(bytes.toString("utf8"))) sensitiveFiles.push(path.relative(qa, file));
}
// Create manifest before checking links pointing to it; exclude self hash below.
const manifest = path.join(evidence, "manifest-sha256.json");
if (!fs.existsSync(manifest)) fs.writeFileSync(manifest, "[]\n");
const brokenLinks = [];
for (const file of walk(qa).filter(file => file.endsWith(".md"))) {
  const text = fs.readFileSync(file, "utf8");
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    let target = match[1]; if (/^(?:https?:|#)/.test(target)) continue;
    target = target.replace(/#.*$/, "").replace(/:\d+$/, "");
    if (!fs.existsSync(path.resolve(path.dirname(file), target))) brokenLinks.push({ file: path.relative(qa, file), target });
  }
}
const summary = { checkedAt: new Date().toISOString(), reportsPresent: expectedReports.length - missingReports.length, missingReports, sourceFilesCompared: before.length, changedSourceFiles, brokenLinks, sensitiveFiles, sensitiveScanScope: "Exact local test DB password and JWT-shaped tokens; not a claim of exhaustive secret scanning", sourceModifiedByAudit: changedSourceFiles.length > 0, result: missingReports.length || changedSourceFiles.length || brokenLinks.length || sensitiveFiles.length ? "FAIL" : "PASS" };
fs.writeFileSync(path.join(evidence, "final-validation.json"), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(evidence, "git-status-final.txt"), cp.execFileSync("git", ["status", "--short"], { cwd: root, encoding: "utf8" }));
fs.writeFileSync(manifest, JSON.stringify(walk(qa).filter(file => file !== manifest).map(file => ({ file: path.relative(qa, file).replace(/\\/g,"/"), bytes: fs.statSync(file).size, sha256: hash(file) })), null, 2));
console.log(JSON.stringify(summary, null, 2));
if (summary.result !== "PASS") process.exitCode = 1;
