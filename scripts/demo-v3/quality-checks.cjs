"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  cp = require("node:child_process"),
  { createRequire } = require("node:module");
const local = require("./local.cjs");
const checks = [];
for (const workspace of ["backend", "frontend"]) {
  const cwd = path.join(local.root, workspace),
    req = createRequire(path.join(cwd, "package.json"));
  for (const [name, binary, args] of [
    ["type-check", "typescript/bin/tsc", ["--noEmit"]],
    [
      "lint",
      "eslint/bin/eslint.js",
      ["src", "--ext", workspace === "backend" ? ".ts" : ".ts,.tsx"],
    ],
  ]) {
    const executable = binary.startsWith("eslint/")
      ? path.join(
          path.dirname(req.resolve("eslint/package.json")),
          "bin/eslint.js",
        )
      : req.resolve(binary);
    const command = [executable, ...args];
    const r = cp.spawnSync(process.execPath, command, {
      cwd,
      env: local.sanitizedEnvironment(),
      encoding: "utf8",
      windowsHide: true,
      timeout: 180000,
      maxBuffer: 8 * 1024 * 1024,
    });
    const output =
      String(r.stdout || "") +
      String(r.stderr || "") +
      (r.error ? "\n" + r.error.code : "");
    // Compiler/linter source diagnostics are non-secret; no application/bootstrap or env loading.
    checks.push({
      workspace,
      name,
      command: [
        "node",
        ...command.map((a) =>
          a.startsWith(local.root) ? path.relative(local.root, a) : a,
        ),
      ],
      exitCode: r.status,
      status: !r.error && r.status === 0 ? "PASS" : "FAIL",
      diagnostics: output.slice(-12000),
    });
    console.log(JSON.stringify({ workspace, name, exitCode: r.status }));
  }
}
fs.writeFileSync(
  path.join(local.root, "docs/demo-data-v3/evidence/quality-checks.json"),
  JSON.stringify(
    {
      checks,
      productionConnected: false,
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  ) + "\n",
);
if (checks.some((c) => c.status !== "PASS")) process.exitCode = 1;
