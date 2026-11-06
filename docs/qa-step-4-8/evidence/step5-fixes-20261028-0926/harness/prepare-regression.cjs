const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const original=path.resolve(__dirname,'../../step5-local-20261028-0906/harness');
let workflow=fs.readFileSync(path.join(original,'workflow.cjs'),'utf8');
assert(workflow.includes('assert.equal(before.total,2)'));
workflow=workflow.replace('assert.equal(before.total,2)','assert.equal(before.total,23)');
fs.writeFileSync(path.join(__dirname,'workflow.cjs'),workflow);
// Preserve historical evidence; helpers now resolve their out directory here.
for(const name of ['stop.cjs','private-db.cjs'])fs.writeFileSync(path.join(__dirname,name),fs.readFileSync(path.join(original,name),'utf8').replaceAll('step5-local-20261028-0906','step5-fixes-20261028-0926'));
console.log('Prepared real workflow regression for 23 synthetic records.');
