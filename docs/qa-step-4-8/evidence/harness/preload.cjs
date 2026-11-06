"use strict";
// Evidence adapter only: preserve repository test assertions and production code.
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module"), cp = require("node:child_process");
const root = path.resolve(__dirname, "../../../..");
const out = process.env.QA_RUN_DIR;
if (out) {
  const originalWrite = fs.writeFileSync;
  fs.writeFileSync = function(file, ...args) {
    const absolute = typeof file === "string" ? path.resolve(file) : "";
    if (absolute.startsWith(path.join(root, "backend/prisma/review") + path.sep) && /step\d+[a-z]?-(?:results\.json|.*\.pdf)$/.test(path.basename(absolute))) {
      file = path.join(out, "generated", path.basename(absolute));
      fs.mkdirSync(path.dirname(file), { recursive: true });
    }
    return originalWrite.call(fs, file, ...args);
  };
  const compile = Module.prototype._compile;
  Module.prototype._compile = function(source, filename) {
    if (filename === path.join(root, "backend/scripts/test-steps4-8-e2e.cjs"))
      source = source.replace('const evidence = path.resolve(__dirname, "../../docs/implementation/evidence/steps4-8");', 'const evidence = process.env.QA_RUN_DIR;');
    return compile.call(this, source, filename);
  };
  const spawn = cp.spawn;
  cp.spawn = function(exe, args, options) {
    if (args?.[0]?.replace(/\\/g, "/").endsWith("/vite/bin/vite.js"))
      args = [...args, "--config", path.join(__dirname, "vite.config.mjs")];
    return spawn.call(cp, exe, args, options);
  };
}
