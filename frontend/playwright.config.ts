import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";
const { browserOrigin } = require("./scripts/browser-settings.cjs");

const mode = process.env.GPMS_BROWSER_MODE ?? "api";
// Fresh artifacts also avoid Windows locks/ownership from previous test runs.
const artifactName = `browser-${mode}-${process.pid}`;
if (!["api", "demo", "mixed"].includes(mode))
  throw new Error(
    "GPMS_BROWSER_MODE must be api, demo or mixed; live API suites are not selected here.",
  );
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(
  __dirname,
  "../.cache/playwright",
);
export default defineConfig({
  testDir: "./e2e/browser",
  testMatch: ["**/smoke.spec.ts", `**/${mode}.spec.ts`],
  fullyParallel: false,
  forbidOnly: true,
  workers: 1,
  retries: 0,
  // First Vite dependency transform on Windows can exceed 30 seconds.
  timeout: 60_000,
  globalTimeout: 300_000,
  expect: { timeout: 8_000 },
  outputDir: `test-results/${artifactName}`,
  reporter: [
    ["list"],
    [
      "html",
      { open: "never", outputFolder: `playwright-report/${artifactName}` },
    ],
    ["json", { outputFile: `test-results/${artifactName}/results.json` }],
  ],
  use: {
    baseURL: browserOrigin,
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: `chromium-${mode}`,
      use: { ...devices["Desktop Chrome"], browserName: "chromium" },
    },
  ],
  webServer: {
    command: "node scripts/start-browser-vite.cjs",
    url: browserOrigin,
    // Refuse an unknown server with different flags or API URL.
    reuseExistingServer: false,
    timeout: 60000,
    env: { GPMS_BROWSER_MODE: mode },
  },
});
