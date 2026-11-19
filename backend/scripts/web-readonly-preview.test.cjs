const test=require('node:test'),assert=require('node:assert/strict');
const {allowed}=require('./web-readonly-preview.cjs');
test('blocks every business mutation including UC24/25 preview POST',()=>{
 for(const m of ['POST','PUT','PATCH','DELETE'])for(const p of ['/api/defense-results/x/finalize','/api/defense-results/x/publish','/api/defense-reports/exports/preview','/api/proposals/x/final-report','/api/admin/roles'])assert.equal(allowed(m,p),false);
});
test('permits metadata reads and authentication only',()=>{
 for(const p of ['/api/health','/api/defense-results?termId=approved','/api/defense-reports/statistics','/api/catalog/students'])assert(allowed('GET',p));
 for(const p of ['/api/auth/login','/api/auth/refresh','/api/auth/logout'])assert(allowed('POST',p));
 assert(!allowed('POST','/api/auth/change-password'));
});
test('blocks file delivery and export even when requested through GET or encoded route',()=>{
 for(const p of ['/api/defense-reports/exports','/api/proposals/x/versions/y/pdf','/api/submissions/x/assets/y','/api/x/%64ownload','/api/x/%70df','/api/x/%ZZ','/api/x/export-pdf']){assert(!allowed('GET',p));assert(!allowed('HEAD',p));}
});
