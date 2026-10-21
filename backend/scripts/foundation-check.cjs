'use strict';
// Offline compatibility and reviewed migration integrity checks.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Prisma: legacy } = require('../node_modules/.pr2b-legacy');
const { Prisma: current } = require('@prisma/client');
const root = path.resolve(__dirname, '..');
for (const old of legacy.dmmf.datamodel.models) {
  const now = current.dmmf.datamodel.models.find(m => m.name === old.name);
  assert(now, `Missing legacy model ${old.name}`);
  assert.equal(now.dbName, old.dbName);
  for (const field of old.fields) {
    const value = now.fields.find(f => f.name === field.name);
    assert.deepEqual(value, field, `Legacy contract changed: ${old.name}.${field.name}`);
  }
  assert.deepEqual(now.primaryKey, old.primaryKey);
  assert.deepEqual(now.uniqueFields, old.uniqueFields);
}
for (const old of legacy.dmmf.datamodel.enums) {
  assert.deepEqual(current.dmmf.datamodel.enums.find(e => e.name === old.name), old);
}
const review = path.join(root, 'prisma/review/pr2b');
for (const [name, file] of [['202610210001_empty_baseline_bridge','01-empty-baseline-enum-bridge.sql'], ['202610210002_expand_workflow','02-expand.sql']]) {
  assert(fs.readFileSync(path.join(root, 'prisma/migrations', name, 'migration.sql')).equals(fs.readFileSync(path.join(review, file))), `Reviewed SQL differs: ${name}`);
}
const baseline = fs.readFileSync(path.join(root, 'prisma/migrations/0_init/migration.sql'));
// Existing 0_init is checked out as CRLF on Windows and LF on Linux. Verify
// source content without changing the already-existing migration bytes.
assert.equal(crypto.createHash('sha256').update(baseline.toString('utf8').replace(/\r\n/g, '\n')).digest('hex'), '5782fc7a04d884514644c59bf05a81d53970230c45a0e12713588cc8b6916563');
const source = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8').replace(/\r\n/g, '\n');
const candidate = fs.readFileSync(path.join(review, 'expand.prisma'), 'utf8').replace(/\r\n/g, '\n').replace('  output = "../../../node_modules/.pr2b-client"\n', '');
assert(source === candidate, 'Active schema differs from tested expansion');
console.log('PASS 56 legacy model contracts, existing enums, 0_init hash and active/review migration/schema agreement');
