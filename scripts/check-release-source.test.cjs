'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {check}=require('./check-release-source.cjs');
test('private artifact paths fail without reading or disclosing content',()=>{
  const r=check(['backend/.env','vault/credentials.json','db.dump','key.pem']);
  assert.equal(r.status,'FAIL');assert.equal(r.findings.length,4);
  assert(r.findings.every(f=>Object.keys(f).sort().join(',')==='category,file'));
});
test('environment templates and synthetic TEST producers are source, not credentials',()=>{
  assert.equal(check(['backend/.env.example','backend/scripts/acceptance/provision.cjs']).status,'PASS');
});
test('applied RBAC and UC24 forward SQL stay byte-for-byte pinned',()=>{
  const crypto=require('node:crypto'),root=path.resolve(__dirname,'..');
  for(const [name,hash] of [
    ['20261109150000_uc24_uc25_rbac_permissions','1d309be4a0a43fd782594bacecc31d489ff06e6cff68c2cbacd27f0c0070a082'],
    ['202611110001_uc24_fr_guard_forward_fix','a7e0384e8c821925e8c0b034db38ad793440fe3a907fa7dd23b4598e121ac3e7'],
  ]) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'backend/prisma/migrations',name,'migration.sql'))).digest('hex'),hash);
    assert(fs.readFileSync(path.join(root,'backend/prisma/migrations/.gitattributes'),'utf8').includes(name+'/migration.sql -text'));
  }
});
test('baseline checkout preserves the existing production checksum on every OS',()=>{
  const root=path.resolve(__dirname,'..'),crypto=require('node:crypto');
  const item=require(path.join(root,'backend/prisma/uc17-24-chain.json')).baseline.find(x=>x.name==='0_init');
  const r=require('node:child_process').spawnSync('git',['-c','core.autocrlf=false','cat-file','--filters','--path=backend/prisma/migrations/0_init/migration.sql','origin/main:backend/prisma/migrations/0_init/migration.sql'],{cwd:root,encoding:null,windowsHide:true});
  assert.equal(r.status,0);
  assert.equal(crypto.createHash('sha256').update(r.stdout).digest('hex').toUpperCase(),item.sha256.toUpperCase());
});
