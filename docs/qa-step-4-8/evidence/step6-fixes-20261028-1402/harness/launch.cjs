"use strict";
// Guarded fresh DB launcher; reuse QA plumbing, never modify application modules.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../../../..'),name='step6-fixes-20261028-1402';
const original=path.join(root,'docs/qa-step-4-8/evidence/step5-mcp-20261027-2153/harness/isolated.cjs');
let source=fs.readFileSync(original,'utf8')
 .replaceAll('.cache/step5-mcp-20261027-2153','.cache/'+name)
 .replaceAll('btl_pr2b_step5_','btl_pr2b_step6fix_')
 .replace('const out = path.dirname(__dirname);','const out = path.join(root, "docs/qa-step-4-8/evidence/'+name+'");')
 .replace('scripts/test-proposal-reviews.cjs',process.env.STEP6_REGRESSION === 'true' ? 'scripts/test-proposal-versions.cjs' : 'scripts/test-proposal-lifecycle.cjs')
 .replace('const dir = path.join(out, "api");','const dir = path.join(out, process.env.STEP6_REGRESSION === "true" ? "regression-api" : "api");')
 .replace('save("api-suite-summary.json",','save(process.env.STEP6_REGRESSION === "true" ? "regression-api-summary.json" : "api-suite-summary.json",')
 .replace('save(kind + "-target.json",','save((kind === "api" && process.env.STEP6_REGRESSION === "true" ? "regression-api" : kind) + "-target.json",')
 .replace('suite: "step5-api"','suite: "step6-api"')
 .replace('["proposal", "proposalWorkflow", "proposalReview",','["proposal", "proposalWorkflow", "proposalVersion", "proposalVersionWorkflow", "proposalReview",');
const anchor='    const coreHash = hash(await coreSnapshot(db));';assert(source.includes(anchor));
source=source.replace(anchor,fs.readFileSync(path.join(root,'docs/qa-step-4-8/evidence/step5-fixes-20261028-0926/harness/pagination-fixture.cjs'),'utf8')+'\n'+anchor);
const runner=new Module(original,module);runner.filename=original;runner.paths=Module._nodeModulePaths(path.dirname(original));runner._compile(source,original);
