"use strict";
// Reuse the unchanged assertions from the audit runner; isolate all new evidence.
const fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module");
const root = path.resolve(__dirname, "../..");
const filename = path.join(
  root,
  "docs/qa-step-4-8/evidence/harness/run-audit.cjs",
);
let source = fs
  .readFileSync(filename, "utf8")
  .replace(
    'const evidence = path.join(root, "docs/qa-step-4-8/evidence");',
    'const evidence = path.join(root, "docs/implementation/evidence/integration-ui-fixes-2026-10-27");',
  );
if (process.argv.includes("--live-only"))
  source = source.replace(
    "for (const [name, script] of suites) {",
    'for (const [name, script] of suites.filter(([name]) => name === "live-e2e")) {',
  );
const runner = new Module(filename, module);
runner.filename = filename;
runner.paths = Module._nodeModulePaths(path.dirname(filename));
runner._compile(source, filename);
