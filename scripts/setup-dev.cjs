'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
for (const [example, target] of [['backend/.env.example', 'backend/.env'], ['frontend/.env.example', 'frontend/.env.local']]) {
  const dest = path.join(root, target);
  if (fs.existsSync(dest)) { console.log(`Keep existing ${target}`); continue; }
  let text = fs.readFileSync(path.join(root, example), 'utf8');
  text = text.replace('REPLACE_WITH_RANDOM_ACCESS_SECRET', crypto.randomBytes(32).toString('hex'))
    .replace('REPLACE_WITH_RANDOM_REFRESH_SECRET', crypto.randomBytes(32).toString('hex'));
  fs.writeFileSync(dest, text, { flag: 'wx', mode: 0o600 });
  console.log(`Created ignored ${target}; credentials were not printed`);
}
console.log('No database connection or migration. For isolated local development: pnpm db:local:init, pnpm db:local:up, pnpm db:local:migrate, pnpm dev:local.');
