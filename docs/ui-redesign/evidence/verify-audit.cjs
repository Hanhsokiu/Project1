const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "../../..");
const ts = require(path.join(root, "frontend/node_modules/typescript"));
const base = path.join(root, "docs/ui-redesign");
const read = file => fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
const inventory = JSON.parse(read(path.join(__dirname, "route-source.json")));
const evidence = JSON.parse(read(path.join(__dirname, "browser-audit.json")));
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const source = ts.createSourceFile("routes.tsx", read(path.join(root, "frontend/src/app/router/routes.tsx")), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let router;
function find(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === "createBrowserRouter") router = node.arguments[0];
  ts.forEachChild(node, find);
}
find(source);
const prop = (node, key) => node.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(source).replace(/['"]/g, "") === key)?.initializer;
const leafPaths = [];
function walk(array, parent = "") {
  check(!!array && ts.isArrayLiteralExpression(array), "Route array is not static");
  if (!array || !ts.isArrayLiteralExpression(array)) return;
  for (const node of array.elements) {
    if (!ts.isObjectLiteralExpression(node)) { errors.push("Non-static route entry"); continue; }
    const pathNode = prop(node, "path");
    const segment = pathNode && ts.isStringLiteral(pathNode) ? pathNode.text : "";
    const current = segment.startsWith("/") ? segment : [parent.replace(/\/$/, ""), segment].filter(Boolean).join("/");
    const children = prop(node, "children");
    if (children) walk(children, current);
    else if (prop(node, "element")) leafPaths.push(current ? (current.startsWith("/") ? current : "/" + current) : "/");
  }
}
walk(router);
const manifestFile = read(path.join(root, "frontend/src/app/router/route-manifest.ts"));
const compiled = ts.transpileModule(manifestFile, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const sandbox = { exports: {} };
vm.runInNewContext(compiled, sandbox, { timeout: 2000 });
const manifest = sandbox.exports.routeManifest;
check(leafPaths.length === 62, "Expected 62 leaf routes");
check(manifest.length === 59, "Expected 59 manifest entries");
check(new Set(leafPaths).size === 62, "Duplicate leaf route");
check(JSON.stringify([...leafPaths].sort()) === JSON.stringify(inventory.map(r => r.path).sort()), "Inventory differs from runtime router AST");
for (const route of inventory) {
  check(fs.existsSync(path.join(root, route.source)), "Missing route source: " + route.source);
  const entry = manifest.find(m => m.path === route.path);
  if (!entry) { check(["/login", "/forbidden", "/*"].includes(route.path), "Unexpected route outside manifest"); continue; }
  for (const field of ["roles", "permission", "menu", "menuRoles", "menuMode", "roleTitles"]) {
    check(JSON.stringify(route[field]) === JSON.stringify(entry[field]), "Manifest mismatch " + route.id + "." + field);
  }
}
const inventorySourceMatches = errors.length === 0;
const markdownFiles = [
  "01-ui-audit.md", "02-route-inventory.md", "03-redesign-plan.md",
  "04-acceptance-criteria.md", "evidence/README.md"
];
let localLinks = 0;
let findings = [];
const inventoryDoc = read(path.join(base, "02-route-inventory.md"));
const auditDoc = read(path.join(base, "01-ui-audit.md"));
const acceptance = read(path.join(base, "04-acceptance-criteria.md"));
for (const file of markdownFiles) {
  const abs = path.join(base, file), text = read(abs);
  check(!text.split(/\r?\n/).some(line => /[ \t]+$/.test(line)), "Trailing whitespace: " + file);
  check(!text.includes("\uFFFD"), "Replacement character: " + file);
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].replace(/^<|>$/g, "");
    if (/^https?:/.test(target)) continue;
    const [relative, anchor] = target.split("#");
    const dest = relative ? path.resolve(path.dirname(abs), relative) : abs;
    localLinks++;
    check(fs.existsSync(dest), "Missing link: " + file + " -> " + target);
    if (anchor && fs.existsSync(dest) && /\.md$/i.test(dest)) {
      const content = read(dest);
      check(content.includes('id="' + anchor + '"'), "Missing explicit anchor: " + file + " -> " + target);
    }
  }
  for (const token of new Set(text.match(/\bR\d{2}\b/g) || [])) check(inventory.some(r => r.id === token), "Unknown route reference " + token);
  for (const token of new Set(text.match(/\bF\d{2}\b/g) || [])) check(auditDoc.includes('id="' + token.toLowerCase() + '"'), "Unknown finding " + token);
  for (const token of new Set(text.match(/\bAC\d{2}\b/g) || [])) check(acceptance.includes('id="' + token.toLowerCase() + '"'), "Unknown acceptance criterion " + token);
}
for (const route of inventory) {
  check(inventoryDoc.includes('id="' + route.id.toLowerCase() + '"'), "Missing route section " + route.id);
}
findings = [...auditDoc.matchAll(/### (F\d{2}) · (P[012])/g)].map(m => ({ id: m[1], priority: m[2] }));
check(findings.length === 15, "Expected 15 findings");
const ids = new Set();
for (const visit of evidence.visits) {
  check(!ids.has(visit.evidenceId), "Duplicate evidence id");
  ids.add(visit.evidenceId);
  check(inventory.some(r => r.id === visit.routeId), "Unknown evidence route");
  check(!!visit.at && !!visit.viewport && !!visit.state, "Incomplete evidence metadata");
  if (visit.screenshot) check(fs.existsSync(path.join(__dirname, visit.screenshot)), "Missing screenshot " + visit.screenshot);
}
for (const item of evidence.interactions) if (item.screenshot) check(fs.existsSync(path.join(__dirname, item.screenshot)), "Missing interaction screenshot");
const coverage = { observed: 0, blocked: 0, codeOnly: 0 };
for (const route of inventory) {
  const rows = evidence.visits.filter(v => v.routeId === route.id);
  coverage[rows.some(v => v.state === "đã quan sát") ? "observed" : rows.length ? "blocked" : "codeOnly"]++;
}
check(coverage.observed === 48 && coverage.blocked === 12 && coverage.codeOnly === 2, "Coverage differs from summary");
const allText = markdownFiles.map(f => read(path.join(base, f))).join("\n") + JSON.stringify(evidence);
check(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer\s+[A-Za-z0-9_.-]{12,}|eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(allText), "Potential credential pattern");
check(!/"(?:password|accessToken|refreshToken|authorization)"\s*:/.test(JSON.stringify(evidence)), "Credential field in evidence");
const old = JSON.parse(read(path.join(__dirname, "verification.json")));
const result = {
  ...old,
  checkedAt: new Date().toISOString(),
  command: "node docs/ui-redesign/evidence/verify-audit.cjs",
  routerLeafCount: leafPaths.length, manifestCount: manifest.length,
  inventorySourceMatches,
  localLinksChecked: localLinks, routeSections: inventory.length,
  coverage, evidenceRecords: evidence.visits.length,
  screenshotFiles: fs.readdirSync(__dirname).filter(f => f.endsWith(".png")).length,
  findings: findings.reduce((a, f) => { a[f.priority] = (a[f.priority] || 0) + 1; return a; }, { P0: 0, P1: 0, P2: 0 }),
  errors, result: errors.length ? "FAIL" : "PASS"
};
fs.writeFileSync(path.join(__dirname, "verification.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
