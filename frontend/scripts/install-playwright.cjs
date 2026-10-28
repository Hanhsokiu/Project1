const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");
const frontend = resolve(__dirname, "..");
const result = spawnSync(
  process.execPath,
  [require.resolve("@playwright/test/cli"), "install", "chromium"],
  {
    cwd: frontend,
    stdio: "inherit",
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: resolve(frontend, "../.cache/playwright"),
    },
  },
);
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
