'use strict';
// Offline compatibility and reviewed migration integrity checks.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Prisma: legacy } = require('../node_modules/.pr2b-legacy');
const { Prisma: current } = require('../node_modules/.pr2b-client');
const { Prisma: integrated } = require('@prisma/client');
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
// The reviewed expansion remains immutable. Explicitly check the runtime changes
// introduced by steps 1-3 while preserving every workflow model and relation.
const fieldChanges = {
  'UserAccount.email': { isRequired: false },
  'Student.proposal': { isList: true, isRequired: true },
  'Registration.status': { default: 'DRAFT' },
  'Registration.advisorAssignment': { name: 'advisorAssignments', isList: true, isRequired: true },
  'RegistrationPref.lecturerId': { isReadOnly: true },
  'AssignmentPlan.termId': { isReadOnly: true },
  'AdvisorAssignment.registrationId': { isUnique: false },
  'Proposal.studentId': { isUnique: false },
};
const uniqueChanges = {
  TermPhase: [['termId', 'code']],
  RegistrationPref: [['registrationId', 'preferenceOrder'], ['registrationId', 'lecturerId']],
  AdvisorAssignment: [['assignmentPlanId', 'registrationId']],
  Proposal: [['termId', 'studentId']],
};
for (const model of current.dmmf.datamodel.models) {
  const now = integrated.dmmf.datamodel.models.find(m => m.name === model.name);
  assert(now, 'Missing workflow/legacy model ' + model.name);
  assert.equal(now.dbName, model.dbName);
  assert.deepEqual(now.primaryKey, model.primaryKey);
  assert.deepEqual(now.uniqueFields, uniqueChanges[model.name] || model.uniqueFields);
  for (const field of model.fields) {
    const expected = { ...field, ...fieldChanges[model.name + '.' + field.name] };
    assert.deepEqual(now.fields.find(f => f.name === expected.name), expected, 'Unexpected contract change: ' + model.name + '.' + field.name);
  }
}
const enumAdditions = { RegistrationStatus: ['DRAFT', 'SUBMITTED'], ImportJobStatus: ['VALIDATED', 'PARTIAL'] };
for (const old of current.dmmf.datamodel.enums) {
  const now = integrated.dmmf.datamodel.enums.find(e => e.name === old.name);
  assert(now, 'Missing enum ' + old.name);
  assert.equal(now.dbName, old.dbName);
  assert.deepEqual([...now.values].sort((a,b) => a.name.localeCompare(b.name)), [...old.values, ...(enumAdditions[old.name] || []).map(name => ({ name, dbName: null }))].sort((a,b) => a.name.localeCompare(b.name)));
}
console.log('PASS immutable PR2B contracts/migrations, baseline hash and explicit step 1-3 runtime compatibility');
