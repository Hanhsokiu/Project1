const { spawnSync } = require("node:child_process");
const cli = require.resolve("vitest/vitest.mjs");
const result = spawnSync(process.execPath, [cli, "run"], {
  stdio: "inherit",
  env: { ...process.env, GPMS_INTEGRATION: "1", RUN_TERM_DB_TESTS: "1" },
});
process.exitCode = result.status ?? 1;
