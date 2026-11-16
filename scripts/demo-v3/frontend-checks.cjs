"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  { createRequire } = require("node:module"),
  { pathToFileURL } = require("node:url"),
  local = require("./local.cjs");
async function main() {
  const frontend = path.join(local.root, "frontend"),
    req = createRequire(path.join(frontend, "package.json")),
    keep = local.sanitizedEnvironment();
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, keep, { NODE_ENV: "test" });
  process.chdir(frontend);
  const { startVitest } = await import(
    pathToFileURL(req.resolve("vitest/node")).href
  );
  const ctx = await startVitest(
    "test",
    [],
    {
      root: frontend,
      config: false,
      watch: false,
      include: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
      env: {
        VITE_AUTH_API: "false",
        VITE_TERM_API: "false",
        VITE_CATALOG_API: "false",
        VITE_IMPORT_API: "false",
        VITE_REGISTRATION_API: "false",
      },
      pool: "forks",
      poolOptions: { forks: { singleFork: true } },
    },
    {
      envDir: false,
      resolve: {
        alias: {
          "@": path.join(frontend, "src"),
          "@doan/shared": path.join(local.root, "shared/src"),
        },
      },
    },
  );
  if (!ctx) throw Error("Vitest did not start");
  const files = ctx.state.getFiles();
  function count(t) {
    return t.type === "test"
      ? 1
      : (t.tasks || []).reduce((n, v) => n + count(v), 0);
  }
  const report = {
    status: process.exitCode ? "FAIL" : "PASS",
    files: files.length,
    tests: files.reduce((n, f) => n + count(f), 0),
    failed: ctx.state.getCountOfFailedTests(),
    realPostgreSQLIntegration: false,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(local.root, "docs/demo-data-v3/evidence/frontend-checks.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  await ctx.close();
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
