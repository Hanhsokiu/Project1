const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parse, localUrl, assertContainer } = require('./team-local.cjs');
const config={TEAM_DB_PASSWORD:'a'.repeat(48),TEAM_DB_TOKEN:'b'.repeat(48)};
test('local config cannot inject shared URLs or override fixed database identity',()=>{
  const text=Object.entries(config).map(([k,v])=>`${k}=${v}`).join('\n');
  assert.deepEqual(parse(text),config);
  for (const bad of ['',text+'\nDATABASE_URL=postgresql://shared/postgres',text+'\nTEAM_DB_TOKEN='+'b'.repeat(48)]) assert.throws(()=>parse(bad));
  const url=new URL(localUrl(config));
  assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55440');assert.equal(url.pathname,'/btl_pr2b_dev');
});
test('migration and dev require owned healthy loopback container',()=>{
  const info={Config:{Image:'postgres:17-alpine',Labels:{'com.docker.compose.project':'btl-team-local','btl.team.instance':config.TEAM_DB_TOKEN}},State:{Health:{Status:'healthy'}},HostConfig:{PortBindings:{'5432/tcp':[{HostIp:'127.0.0.1',HostPort:'55440'}]}}};
  assert.doesNotThrow(()=>assertContainer(info,config));
  for (const mutate of [x=>x.Config.Labels['btl.team.instance']='other',x=>x.State.Health.Status='unhealthy',x=>x.HostConfig.PortBindings['5432/tcp'][0].HostIp='0.0.0.0']) {
    const other=structuredClone(info);mutate(other);assert.throws(()=>assertContainer(other,config));
  }
});
