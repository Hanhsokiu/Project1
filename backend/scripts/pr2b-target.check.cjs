const {test}=require('node:test');
const assert=require('node:assert/strict');
const {testTarget}=require('./rehearse-pr2b.cjs');
test('rehearsal refuses shared/remote/default databases and never falls back to application env',()=>{
  for(const url of [undefined,'postgresql://u:p@db.example.supabase.co:5432/postgres','postgresql://u:p@127.0.0.1:5432/postgres','postgresql://u:p@127.0.0.1:5432/doan_db']) assert.throws(()=>testTarget(url));
  assert.equal(testTarget('postgresql://u:p@127.0.0.1:55439/btl_pr2b_test').hostname,'127.0.0.1');
});
