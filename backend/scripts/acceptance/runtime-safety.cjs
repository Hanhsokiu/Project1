'use strict';
const assert=require('node:assert/strict');
// Must pass before installing a virtual Date or touching the owned PG clock file.
function assertStagingTarget({environment,runId,mode,url,database,label,binding}){
 assert.notEqual(environment,'production','Acceptance runtime cannot start in production');
 assert(/^DATN-E2E-B1B10-TEST-[a-z0-9-]+$/i.test(runId));assert(['manual','auto'].includes(mode));
 const target=new URL(url);
 assert(['postgresql:','postgres:'].includes(target.protocol));
 assert(['127.0.0.1','localhost'].includes(target.hostname));
 assert.equal(decodeURIComponent(target.pathname.slice(1)),database);
 assert(database.startsWith('btl_pr2b_acceptance_')&&database.endsWith('_'+mode));
 assert.equal(label,runId);
 assert.equal(binding.trim(),'127.0.0.1:'+target.port);
}
module.exports={assertStagingTarget};
