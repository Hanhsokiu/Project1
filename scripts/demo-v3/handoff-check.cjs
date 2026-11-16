"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  cp = require("node:child_process"),
  assert = require("node:assert/strict");
const local = require("./local.cjs"),
  { hash } = require("./definition.cjs");
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? files(path.join(dir, e.name))
        : [path.join(dir, e.name)],
    );
}
const scriptFiles = [
  path.join(local.root, "scripts/demo-v3.cjs"),
  ...files(path.join(local.root, "scripts/demo-v3")),
];
const docFiles = files(path.join(local.root, "docs/demo-data-v3"));
const cfg = local.configuration(),
  secrets = [cfg.password, cfg.accountPassword, cfg.jwt].filter(
    (x) => typeof x === "string" && x.length > 15,
  );
let json = 0,
  links = 0;
for (const file of [...scriptFiles, ...docFiles]) {
  if (!/\.(cjs|md|json)$/.test(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  assert(
    !secrets.some((s) => text.includes(s)),
    "Secret found in handoff file: " + path.relative(local.root, file),
  );
  if (file.endsWith(".json")) {
    JSON.parse(text);
    json++;
  }
  if (file.endsWith(".md"))
    for (const m of text.matchAll(/\]\(([^)]+)\)/g)) {
      const target = m[1].split("#")[0];
      if (!target || /^(https?:|mailto:)/.test(target)) continue;
      assert(
        fs.existsSync(path.resolve(path.dirname(file), target)),
        "Broken link: " + path.relative(local.root, file) + " -> " + target,
      );
      links++;
    }
}
const baseline = JSON.parse(
  fs.readFileSync(
    path.join(local.cache, "protected-current-hashes.json"),
    "utf8",
  ),
);
const changed = Object.entries(baseline)
  .filter(
    ([p, h]) =>
      !fs.existsSync(path.join(local.root, p)) ||
      hash(fs.readFileSync(path.join(local.root, p))) !== h,
  )
  .map(([p]) => p);
assert.equal(
  changed.length,
  0,
  "Protected source changed: " + changed.join(", "),
);
for (const file of scriptFiles.filter((f) => f.endsWith(".cjs"))) {
  const r = cp.spawnSync(process.execPath, ["--check", file], {
    env: local.sanitizedEnvironment(),
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(r.status, 0, "Syntax check failed: " + path.basename(file));
}
const result = {
  status: "PASS",
  generatedAt: new Date().toISOString(),
  syntaxFiles: scriptFiles.length,
  jsonFiles: json,
  localLinks: links,
  protectedFiles: Object.keys(baseline).length,
  protectedChanges: changed,
  secretValuesFound: false,
  limits:
    "Protected fingerprint was captured after seed development began, not an initial repository snapshot. Checks do not prove unexecuted scenarios or backend business flows.",
};
fs.writeFileSync(
  path.join(local.root, "docs/demo-data-v3/evidence/handoff-check.json"),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result));
