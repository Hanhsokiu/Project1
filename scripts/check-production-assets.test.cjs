'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkFrontend, checkBackend } = require('./check-production-assets.cjs');
const base = path.resolve(__dirname, '../.cache/production-asset-tests');
fs.mkdirSync(base, { recursive: true });
function artifact() {
  const dir = fs.mkdtempSync(path.join(base, 'artifact-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<html></html>');
  fs.writeFileSync(path.join(dir, 'main.js'), '// ordinary production bootstrap');
  fs.writeFileSync(path.join(dir, 'assets/main.js'), 'const api="/api/health";');
  return dir;
}
test('real production API assets pass without accepting an empty/missing build', () => {
  const dir = artifact();
  assert.equal(checkFrontend(dir).status, 'PASS');
  assert.equal(checkBackend(dir).status, 'PASS');
  assert.throws(() => checkFrontend(path.join(dir, 'absent')), /missing/);
  assert.throws(() => checkBackend(path.join(dir, 'absent')), /missing/);
});
test('accidental test login and clock controls fail the artifact gate', () => {
  const dir = artifact();
  fs.writeFileSync(path.join(dir, 'assets/main.js'), 'fetch("/api/acceptance/clock"); const badge="acceptance-login-badge";');
  assert.deepEqual(checkFrontend(dir).findings.map(x => x.category), ['acceptance-clock-api', 'test-login-ui']);
});
test('a compiled acceptance producer fails the backend gate', () => {
  const dir = artifact(); fs.mkdirSync(path.join(dir, 'acceptance'));
  assert.equal(checkBackend(dir).status, 'FAIL');
});
