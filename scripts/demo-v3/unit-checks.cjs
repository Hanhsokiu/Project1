"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const local = require("./local.cjs");
async function main() {
  process.chdir(local.backend);
  const cfg = local.configuration();
  const safe = local.sanitizedEnvironment();
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, safe, {
    NODE_ENV: "test",
    DATABASE_URL: local.connection(cfg),
    DIRECT_URL: local.connection(cfg),
    EMAIL_WORKER_ENABLED: "false",
  });
  const { startVitest } = await import(
    pathToFileURL(local.req.resolve("vitest/node")).href
  );
  const ctx = await startVitest(
    "test",
    [],
    {
      root: local.backend,
      config: false,
      envDir: false,
      watch: false,
      include: [
        "src/defense/**/*.spec.ts",
        "src/guidance/**/*.spec.ts",
        "src/topic/**/*.spec.ts",
        "src/term/**/*.spec.ts",
        "src/grading/**/*.spec.ts",
        "src/report/**/*.spec.ts",
      ],
      exclude: ["src/**/*.integration.spec.ts"],
      pool: "forks",
      poolOptions: { forks: { singleFork: true } },
      testTimeout: 30000,
      hookTimeout: 30000,
    },
    { envDir: false },
  );
  if (!ctx) throw Error("Vitest did not start");
  const files = ctx.state.getFiles();
  const report = {
    kind: "EXISTING_UNIT_HTTP_FIXTURE_TESTS",
    realDatabaseIntegration: false,
    files: files.length,
    failed: ctx.state.getCountOfFailedTests(),
    status: process.exitCode ? "FAIL" : "PASS",
  };
  fs.writeFileSync(
    path.join(local.root, "docs/demo-data-v3/evidence/unit-checks.json"),
    JSON.stringify(report, null, 2),
  );
  await ctx.close();
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
