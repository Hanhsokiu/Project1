'use strict';
// Explicit test-only baseline scope for an isolated local rehearsal.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
exports.expectedMajor=()=>{
 const major=Number(process.env.DATN_REHEARSAL_PG_MAJOR||17);
 assert([16,17].includes(major));
 if(major===16)require('../rehearse-pr2b.cjs').testTarget(process.env.PR2B_TEST_URL);
 return major;
};
exports.schema=backend=>{
 if(process.env.DATN_REHEARSAL_BASELINE!=='true')return path.join(backend,'prisma/schema.prisma');
 require('../rehearse-pr2b.cjs').testTarget(process.env.PR2B_TEST_URL);
 require('./deploy-test-chain.cjs').stageBaseline(backend);
 const root=path.resolve(backend,'..'),dir=path.join(root,'.cache/uc17-24-deploy/b1-b8/prisma');
 const manifest=JSON.parse(fs.readFileSync(path.join(backend,'prisma/uc17-24-chain.json')));
 const names=fs.readdirSync(path.join(dir,'migrations')).filter(n=>fs.existsSync(path.join(dir,'migrations',n,'migration.sql'))).sort();
 assert.deepEqual(names,manifest.baseline.map(x=>x.name));assert.equal(names.length,17);
 for(const x of manifest.baseline)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,'migrations',x.name,'migration.sql'))).digest('hex').toUpperCase(),x.sha256);
 assert(fs.readFileSync(path.join(dir,'schema.prisma')).equals(fs.readFileSync(path.join(backend,'prisma/schema.prisma'))));
 return path.join(dir,'schema.prisma');
};
