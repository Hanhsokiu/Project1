'use strict';
// Execute the deployment command itself on Linux CI, including missing/stale
// Preview flags. This does not call Vercel or connect to an application database.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const assert = require('node:assert/strict');
const { buildCommand } = require('../vercel.json');
const { checkFrontend } = require('../../scripts/check-production-assets.cjs');

const frontend = path.resolve(__dirname, '..');
for (const scenario of ['missing-auth-flags', 'stale-demo-flags']) {
  const env = { ...process.env };
  delete env.VITE_AUTH_API;
  delete env.VITE_DEMO_MODE;
  if (scenario === 'stale-demo-flags') {
    env.VITE_AUTH_API = 'false';
    env.VITE_DEMO_MODE = 'true';
  }
  console.log(`Verifying actual Vercel build command: ${scenario}`);
  const result = spawnSync(buildCommand, {
    cwd: frontend,
    env,
    shell: true,
    stdio: 'inherit',
  });
  assert.equal(result.status, 0, `Vercel build failed: ${scenario}`);
  assert.equal(checkFrontend(path.join(frontend, 'dist')).status, 'PASS');
}
console.log('PASS Vercel production builds use real API auth with demo disabled');
