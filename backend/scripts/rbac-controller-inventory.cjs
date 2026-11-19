"use strict";
// Offline controller inventory. Permissions are endpoint gates, never grant approvals.
const { readdirSync, readFileSync, writeFileSync } = require("node:fs");
const { resolve, relative } = require("node:path");
const root = resolve(__dirname, "..");
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((f) => f.isDirectory()
    ? files(resolve(dir, f.name)) : f.name.endsWith(".controller.ts") ? [resolve(dir, f.name)] : []);
}
function inventory() {
  const result = [];
  for (const file of files(resolve(root, "src"))) {
    const source = readFileSync(file, "utf8");
    const prefix = source.match(/@Controller\("([^\"]*)"\)/)?.[1] ?? "";
    for (const m of source.matchAll(/@RequirePermission\("([^\"]+)",\s*"([^\"]+)"\)/g)) {
      const start = Math.max(source.lastIndexOf("@Get(", m.index), source.lastIndexOf("@Post(", m.index),
        source.lastIndexOf("@Put(", m.index), source.lastIndexOf("@Patch(", m.index), source.lastIndexOf("@Delete(", m.index));
      const endpoint = source.slice(start, m.index).match(/@(Get|Post|Put|Patch|Delete)\((?:"([^\"]*)")?\)/);
      if (!endpoint) throw new Error(`Unparsed route in ${relative(root, file)} at ${m.index}`);
      const path = relative(root, file).replaceAll("\\", "/");
      const phase = path.includes("final-defense") ? "UC17" : path.includes("defense/eligibility") ? "UC18"
        : path.includes("defense/committees") ? "UC19" : path.includes("defense/reviewers") ? "UC20"
        : path.includes("defense/scheduling") ? "UC21" : path.includes("defense/reviewer-grading") ? "UC22"
        : path.includes("defense/committee-grading") ? "UC23" : path.includes("defense/final-results") ? "UC24"
        : path.includes("defense-reporting") ? "UC25" : path.includes("acceptance/") ? "STAGING_ONLY"
        : /\/(term|catalog|registration|topic|guidance)\//.test(path) ? "B1-B8_SHARED" : "AUTH_SYSTEM";
      result.push({ phase, controller: path, method: endpoint[1].toUpperCase(),
        path: "/" + [prefix, endpoint[2]].filter(Boolean).join("/"), permission: `${m[1]}:${m[2]}` });
    }
  }
  return result.sort((a, b) => `${a.controller}|${a.method}|${a.path}`.localeCompare(`${b.controller}|${b.method}|${b.path}`));
}
module.exports = { inventory };
if (require.main === module) {
  const data = { version: 1, meaning: "Static endpoint gates; service workflow/scope checks remain mandatory; no grant authorization.", entries: inventory() };
  const output = resolve(root, "prisma/deployment/integration-rbac/CONTROLLER-PERMISSIONS.json");
  writeFileSync(output, JSON.stringify(data, null, 2) + "\n");
  process.stdout.write(JSON.stringify({ endpoints: data.entries.length, permissionCount: new Set(data.entries.map((e) => e.permission)).size }) + "\n");
}
