const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");
const { browserOrigin } = require("./browser-settings.cjs");
const [mode = "all", ...args] = process.argv.slice(2);
if (!["all", "api", "demo", "mixed"].includes(mode)) {
  console.error(
    "Usage: node scripts/test-browser.cjs all|api|demo|mixed [Playwright options]",
  );
  process.exitCode = 1;
} else {
  // VITE_* flags are compile-time: each profile needs its own Vite process.
  const results = [];
  for (const profile of mode === "all" ? ["api", "demo", "mixed"] : [mode]) {
    console.log(`\nSafe browser suite: ${profile} — ${browserOrigin}`);
    const result = spawnSync(
      process.execPath,
      [require.resolve("@playwright/test/cli"), "test", ...args],
      {
        cwd: resolve(__dirname, ".."),
        stdio: "inherit",
        env: { ...process.env, GPMS_BROWSER_MODE: profile },
      },
    );
    if (result.error) console.error(result.error.message);
    results.push({ profile, code: result.status ?? 1 });
    if (result.signal) break;
  }
  console.log("\nBrowser suite exits:", JSON.stringify(results));
  process.exitCode = results.some((r) => r.code !== 0) ? 1 : 0;
}
