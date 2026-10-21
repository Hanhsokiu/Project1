const { test } = require('node:test');
const assert = require('node:assert/strict');
const { inspectTarget, assertDeployApproval, assertMigrationHistory, migrationChecksums } = require('./shared-database.cjs');

test('checksum handling accepts only newline variants, never edited SQL content', () => {
  const lf = Buffer.from('SELECT 1;\nSELECT 2;\n');
  const crlf = Buffer.from('SELECT 1;\r\nSELECT 2;\r\n');
  assert.deepEqual(new Set(migrationChecksums(lf)),new Set(migrationChecksums(crlf)));
  const edited = migrationChecksums(Buffer.from('SELECT 1;\nSELECT 3;\n'));
  assert(edited.every(hash=>!migrationChecksums(lf).includes(hash)));
});
test('shared inspection requires an explicitly pinned host and TLS for Supabase', () => {
  const env = { DIRECT_URL: 'postgresql://user:example@db.example.supabase.co:5432/postgres?sslmode=require', DB_INSPECT_HOST: 'db.example.supabase.co' };
  assert.equal(inspectTarget(env).target, 'db.example.supabase.co/postgres');
  assert.throws(() => inspectTarget({ ...env, DB_INSPECT_HOST: 'another.example' }));
  assert.throws(() => inspectTarget({ ...env, DIRECT_URL: env.DIRECT_URL.split('?')[0] }));
});
test('deployment is blocked before any connection unless both explicit target gates match', () => {
  const env = { DIRECT_URL: 'postgresql://user:example@db.example.supabase.co:5432/postgres?sslmode=require', DB_INSPECT_HOST: 'db.example.supabase.co' };
  const target = 'db.example.supabase.co/postgres';
  assert.throws(() => assertDeployApproval(env, target), /DDL blocked/);
  assert.throws(() => assertDeployApproval({ ...env, ALLOW_DATABASE_MIGRATION: target }, 'another/database'), /DDL blocked/);
  assert.doesNotThrow(() => assertDeployApproval({ ...env, ALLOW_DATABASE_MIGRATION: target }, target));
});
test('deployment refuses unknown, failed and mismatched history', () => {
  assert.doesNotThrow(() => assertMigrationHistory([]));
  assert.throws(() => assertMigrationHistory([{ migration_name: '../elsewhere' }]));
  assert.throws(() => assertMigrationHistory([{ migration_name: '0_init', finished_at: null }]));
  assert.throws(() => assertMigrationHistory([{ migration_name: '0_init', finished_at: new Date(), checksum: 'wrong' }]));
});
