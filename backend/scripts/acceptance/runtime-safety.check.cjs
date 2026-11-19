'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {assertStagingTarget}=require('./runtime-safety.cjs');
const target={environment:'test',runId:'DATN-E2E-B1B10-TEST-owned',mode:'manual',
 url:'postgresql://synthetic@127.0.0.1:55368/btl_pr2b_acceptance_owned_manual',
 database:'btl_pr2b_acceptance_owned_manual',label:'DATN-E2E-B1B10-TEST-owned',binding:'127.0.0.1:55368'};
test('only an owned loopback staging target is accepted',()=>assert.doesNotThrow(()=>assertStagingTarget(target)));
for(const [name,patch] of Object.entries({production:{environment:'production'},supabase:{url:'postgresql://synthetic@db.example.supabase.co:5432/postgres'},
 wrongDatabase:{database:'btl_pr2b_acceptance_other_manual'},wrongContainer:{label:'another-run'},wrongPort:{binding:'127.0.0.1:55369'},
 publicBinding:{binding:'0.0.0.0:55368'},wrongMode:{mode:'auto'}})){
 test('refuses '+name+' before a clock can be installed',()=>assert.throws(()=>assertStagingTarget({...target,...patch})));
}
test('production startup refuses before vault, Docker, DB, or Date mutation',async()=>{
 const env=process.env.NODE_ENV,original=Date;
 try{process.env.NODE_ENV='production';await assert.rejects(require('./runtime.cjs').createRuntime('not-read','manual'),/cannot start in production/);assert.equal(Date,original);}
 finally{if(env===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=env;}
});
