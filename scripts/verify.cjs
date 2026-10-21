'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const steps = [
  ['--filter', '@doan/shared', 'build'],
  ['--filter', '@doan/backend', 'prisma', 'validate'],
  ['--filter', '@doan/backend', 'prisma', 'generate'],
  ['--filter', '@doan/backend', 'pr2b:generate'],
  ['--filter', '@doan/backend', 'foundation:check'],
  ['--filter', '@doan/backend', 'type-check:pr2b'],
  ['-r', '--if-present', 'type-check'],
  ['-r', '--if-present', 'lint'],
  ['--filter', '@doan/backend', 'test:database-tools'],
  ['--filter', '@doan/backend', 'pr2b:target-test'],
  ['--filter', '@doan/backend', 'test:local-tools'],
  ['-r', '--if-present', 'test'],
  ['-r', '--if-present', 'build'],
];
for (const args of steps) {
  console.log(`\n> pnpm ${args.join(' ')}`);
  const result = spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, {
    cwd: path.resolve(__dirname, '..'), stdio: 'inherit', shell: process.platform === 'win32', windowsHide: true,
  });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
console.log('PASS repository verification (no database DDL or connection tests).');
