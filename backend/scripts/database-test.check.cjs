'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseConfig, testUrl, redact, assertContainer, readChecks } = require('./database-test.cjs');
const config = { TEST_DB_PASSWORD: 'a'.repeat(48), TEST_DB_INSTANCE_TOKEN: 'b'.repeat(48) };
const text = Object.entries(config).map(([k,v]) => `${k}=${v}`).join('\n');
function info() { return {
  Config: { Image: 'postgres:16-alpine', Labels: {
    'com.docker.compose.project': 'btl-pr2-test', 'com.docker.compose.service': 'postgres-test', 'btl.pr2.instance': config.TEST_DB_INSTANCE_TOKEN,
  } }, HostConfig: { PortBindings: { '5432/tcp': [{ HostIp:'127.0.0.1', HostPort:'55432' }] } },
}; }
test('generated config creates only the fixed dedicated loopback URL', () => {
  assert.deepEqual(parseConfig(text),config);
  const url = new URL(testUrl(config));
  assert.equal(url.hostname,'127.0.0.1'); assert.equal(url.port,'55432');
  assert.equal(url.pathname,'/doan_pr2_test'); assert.equal(url.username,'btl_pr2_test');
});
test('production URL, unknown keys, duplicate keys and incomplete config are refused', () => {
  for (const invalid of ['',text+'\nDATABASE_URL=postgresql://shared/prod',text+'\nTEST_DB_PASSWORD='+'a'.repeat(48),text.replace('a'.repeat(48),'change_me')]) {
    assert.throws(() => parseConfig(invalid));
  }
});
test('unrelated container, owner token or exposed port cannot pass the migration gate', () => {
  assert.doesNotThrow(() => assertContainer(info(),config));
  const unrelated=info(); unrelated.Config.Labels['btl.pr2.instance']='wrong';
  assert.throws(() => assertContainer(unrelated,config));
  const exposed=info(); exposed.HostConfig.PortBindings['5432/tcp'][0].HostIp='0.0.0.0';
  assert.throws(() => assertContainer(exposed,config));
  const otherProject=info(); otherProject.Config.Labels['com.docker.compose.project']='shared';
  assert.throws(() => assertContainer(otherProject,config));
});
test('errors redact both credentials and full connection URLs', () => {
  const result=redact(`${testUrl(config)} password=${config.TEST_DB_PASSWORD} token=${config.TEST_DB_INSTANCE_TOKEN}`,config);
  assert.ok(!result.includes(config.TEST_DB_PASSWORD)); assert.ok(!result.includes(config.TEST_DB_INSTANCE_TOKEN));
  assert.ok(!result.includes('postgresql://'));
});
test('diagnostic suite is nonempty and rejects mutations or multiple statements', () => {
  const checks=readChecks(fs.readFileSync(path.join(__dirname,'sql/pr2-diagnostics.sql'),'utf8'));
  assert.equal(checks.length,12);
  for (const sql of ['DELETE FROM x;','SELECT 1; DROP TABLE x;','UPDATE x SET y=1;']) {
    assert.throws(() => readChecks('-- check: invalid\n'+sql));
  }
});
