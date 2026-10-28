"use strict";
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../../../..'),name='step5-fixes-20261028-0926';
const original=path.join(root,'docs/qa-step-4-8/evidence/step5-mcp-20261027-2153/harness/isolated.cjs');
let source=fs.readFileSync(original,'utf8').replaceAll('.cache/step5-mcp-20261027-2153','.cache/'+name).replace('const out = path.dirname(__dirname);','const out = path.join(root, "docs/qa-step-4-8/evidence/'+name+'");');
const anchor='    const coreHash = hash(await coreSnapshot(db));';assert(source.includes(anchor));
const fixture=fs.readFileSync(path.join(__dirname,'pagination-fixture.cjs'),'utf8');
source=source.replace(anchor,fixture+'\n'+anchor);
const runner=new Module(original,module);runner.filename=original;runner.paths=Module._nodeModulePaths(path.dirname(original));runner._compile(source,original);
