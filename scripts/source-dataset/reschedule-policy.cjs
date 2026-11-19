"use strict";
// Preserve the prior approved bundle; prepare only the explicitly requested date change.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {read,save,dist,outputDir,safeError}=require("./context.cjs"),{buildProposal,validateDraft}=require("./policy-proposal.cjs");
function main(){
  const at=process.argv.indexOf("--defense-date");assert.ok(at>=0);const date=process.argv[at+1];assert.match(date,/^\d{4}-\d{2}-\d{2}$/);
  assert.ok(!fs.existsSync(path.join(outputDir,"policy-release-report.json")),"Cannot replace a released policy bundle");
  const old=read("policy-proposal.json"),approval=read("policy-approval.private.json"),hash=dist("defense/policies/policy-release.js","policyReleaseHash");
  const {contentHash,verification,...body}=old;assert.equal(hash(body),contentHash);assert.equal(approval.proposalHash,contentHash);
  const oldDate=body.policies.UC21_POLICY.allowedDates[0],oldStart=body.proposedDefenseStart,newStart=new Date(date+"T00:00:00+07:00").toISOString();assert.notEqual(date,oldDate);assert.ok(Date.parse(newStart)>Date.now());
  const routing=read("routing-report.json"),next=buildProposal({datasetId:read("foundation-report.json").datasetId,termId:body.termId,endAt:body.proposedDefenseEnd,date,departmentIds:[...new Set(routing.results.map(r=>r.departmentId))]});
  const replace=value=>typeof value==="string"?(value===oldDate?date:value===oldStart?newStart:value):Array.isArray(value)?value.map(replace):value&&typeof value==="object"?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,replace(v)])):value;
  assert.deepEqual(next,replace(body),"Only the approved defense date and dependent effective dates may change");
  const checked=validateDraft(next),suffix="superseded-"+oldDate;
  for(const name of ["policy-proposal.json","policy-approval.private.json"]){const source=path.join(outputDir,name),archive=path.join(outputDir,name.replace(/\.json$/,"."+suffix+".json"));assert.ok(!fs.existsSync(archive));fs.renameSync(source,archive);}
  const nextHash=hash(next);save("policy-proposal.json",{...next,contentHash:nextHash,verification:checked});
  console.log(JSON.stringify({operation:"LOCAL_DATE_CHANGE_ONLY",previousDate:oldDate,date,contentHash:nextHash,previousApprovalArchived:true,databaseWrites:0}));
}
if(require.main===module){try{main();}catch(e){safeError(e);}}
