"use strict";
const { spawnSync } = require("node:child_process");
const path = require("node:path");
// Each script owns an isolated API fixture and closes its server/browser.
for (const script of [
  "test-workflow-term-sync-browser.cjs",
  "test-guidance-tasks-browser.cjs",
  "test-guidance-submissions-browser.cjs",
  "test-guidance-reviews-browser.cjs",
]) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    process.exitCode = result.status || 1;
    break;
  }
}
