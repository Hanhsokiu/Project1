'use strict';
const fs = require('node:fs');
const path = require('node:path');

function checkFrontend(directory) {
  const root = path.resolve(directory), assets = path.join(root, 'assets');
  if (!fs.existsSync(path.join(root, 'index.html')) || !fs.existsSync(assets))
    throw new Error('Frontend production artifact is missing');
  const forbidden = [
    ['acceptance-clock-api', /\/api\/acceptance\/clock|\/acceptance\/clock/],
    ['test-clock-ui', /Chuyển đồng hồ TEST|Chuyển giai đoạn nghiệm thu/],
    ['test-login-ui', /acceptance-login-badge|STAGING — Tài khoản và dữ liệu TEST/],
    ['demo-credential', /Demo@2026|\bacpt_\d{8,}_(?:manual|auto)_/],
  ];
  const findings = []; let checked = 0;
  for (const file of fs.readdirSync(assets).filter(x => x.endsWith('.js'))) {
    const full = path.join(assets, file);
    if (fs.lstatSync(full).isSymbolicLink()) throw new Error('Artifact symlink refused');
    const content = fs.readFileSync(full, 'utf8'); checked++;
    for (const [category, pattern] of forbidden)
      if (pattern.test(content)) findings.push({ file, category });
  }
  if (!checked) throw new Error('No frontend JavaScript artifact was inspected');
  return { kind: 'frontend', checked, findings, status: findings.length ? 'FAIL' : 'PASS' };
}

function checkBackend(directory) {
  const root = path.resolve(directory);
  if (!fs.existsSync(path.join(root, 'main.js'))) throw new Error('Backend production artifact is missing');
  const findings = fs.existsSync(path.join(root, 'acceptance'))
    ? [{ file: 'acceptance/', category: 'test-producer-in-production-build' }] : [];
  return { kind: 'backend', findings, status: findings.length ? 'FAIL' : 'PASS' };
}

if (require.main === module) {
  try {
    const [kind, directory] = process.argv.slice(2);
    if (!['--frontend', '--backend'].includes(kind) || !directory) throw new Error('Usage: --frontend|--backend build-directory');
    const result = kind === '--frontend' ? checkFrontend(directory) : checkBackend(directory);
    console.log(JSON.stringify(result)); if (result.status !== 'PASS') process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { checkFrontend, checkBackend };
