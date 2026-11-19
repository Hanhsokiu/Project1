"use strict";

// Reuse the package manager that started the current script. A bare `pnpm`
// can resolve to another globally installed version in nested Windows scripts.
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const executable = process.env.npm_execpath;
const javascript = executable && /pnpm\.(?:c?js|mjs)$/i.test(executable);
const standalone =
  executable && /^pnpm(?:\.exe)?$/i.test(path.basename(executable));
if (!executable || !fs.existsSync(executable) || (!javascript && !standalone)) {
  console.error(
    "Run this command through pnpm (or corepack pnpm) using the version in package.json.",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const child = spawn(
  javascript ? process.execPath : executable,
  javascript ? [executable, ...args] : args,
  {
    stdio: "inherit",
    windowsHide: true,
  },
);
child.on("error", (error) => {
  console.error(`Unable to start pnpm: ${error.code || error.name}`);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
