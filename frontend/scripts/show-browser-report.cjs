const { existsSync, readdirSync, statSync } = require("node:fs");
const { resolve, join } = require("node:path");
const { spawnSync } = require("node:child_process");
const root = resolve(__dirname, "../playwright-report");
const profile = process.argv[2] || "api";
if (!["api", "demo", "mixed"].includes(profile)) {
  throw new Error("Report profile must be api, demo or mixed.");
}
const reports = existsSync(root)
  ? readdirSync(root)
      .filter(
        (name) =>
          name.startsWith(`browser-${profile}-`) &&
          existsSync(join(root, name, "index.html")),
      )
      .sort(
        (a, b) =>
          statSync(join(root, b, "index.html")).mtimeMs -
          statSync(join(root, a, "index.html")).mtimeMs,
      )
  : [];
if (!reports.length) {
  console.error(`No report for ${profile}. Run the browser suite first.`);
  process.exitCode = 1;
} else {
  const report = join(root, reports[0]);
  console.log(`Opening latest ${profile} report: ${report}`);
  const result = spawnSync(
    process.execPath,
    [
      require.resolve("@playwright/test/cli"),
      "show-report",
      report,
      "--host",
      "127.0.0.1",
    ],
    { stdio: "inherit" },
  );
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
}
