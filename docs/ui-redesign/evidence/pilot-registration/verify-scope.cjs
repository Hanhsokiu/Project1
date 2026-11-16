// Run from repository root. Read-only checks; no environment files or API calls.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const ts = require('../../../../frontend/node_modules/typescript');
const postcss = require('../../../../frontend/node_modules/postcss');
const file = 'frontend/src/features/registration/pages/StudentRegistrationPage.tsx';
const before = execFileSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8' });
const after = fs.readFileSync(file, 'utf8');
const parse = text => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const printer = ts.createPrinter({ removeComments: true });
const normalize = (node, source) => printer.printNode(ts.EmitHint.Unspecified, node, source);
const old = parse(before), current = parse(after);
const form = source => source.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'RegistrationForm');
const setup = source => form(source).body.statements.filter(n => !ts.isReturnStatement(n) && !(ts.isFunctionDeclaration(n) && n.name.text === 'move')).map(n => normalize(n, source));
const move = source => form(source).body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'move').body.statements;
const props = source => {
  const found = [];
  const visit = node => {
    if (ts.isJsxAttribute(node) && /^(onChange|onClick|onClose|onConfirm|disabled|loading|pending|value|required)$/.test(node.name.text)) found.push(normalize(node, source));
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found.sort();
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(JSON.stringify(setup(old)) === JSON.stringify(setup(current)), 'Business setup/save/filter changed');
assert(JSON.stringify(props(old)) === JSON.stringify(props(current)), 'Business callbacks/control conditions changed');
assert(move(old).every((n, i) => normalize(n, old) === normalize(move(current)[i], current)), 'Reorder algorithm changed');
assert(move(current).length === move(old).length + 1, 'Unexpected extra reorder code');
const css = postcss.parse(fs.readFileSync('frontend/src/features/registration/pages/student-registration.css', 'utf8'));
let ruleCount = 0;
css.walkRules(rule => {
  assert(rule.selectors.every(s => s.startsWith('.registration-pilot')), `Unscoped CSS: ${rule.selector}`);
  ruleCount++;
});
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'preexisting-hashes.json'), 'utf8'));
for (const item of baseline) {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(item.Path)).digest('hex').toUpperCase();
  assert(hash === item.Hash, `Pre-existing file changed: ${item.Path}`);
}
let links = 0;
for (const doc of ['docs/ui-redesign/05-design-spec.md', path.join(__dirname, 'README.md')]) {
  const text = fs.readFileSync(doc, 'utf8');
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || /^https?:/.test(target)) continue;
    assert(fs.existsSync(path.resolve(path.dirname(doc), target)), `Broken link: ${target}`);
    links++;
  }
}
console.log(JSON.stringify({ businessSetupAndSaveUnchanged: true, businessPropsCompared: props(old).length, reorderAlgorithmUnchanged: true, reorderAddition: 'focus moved preference group', scopedCssRules: ruleCount, preexistingFilesUnchanged: baseline.length, validLocalLinks: links }, null, 2));
