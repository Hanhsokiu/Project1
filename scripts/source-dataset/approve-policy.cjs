"use strict";
// Records an explicit chat confirmation for the exact reviewed local proposal.
// This does not insert policy rows, enable writes, or claim school approval.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {read,save,dist,outputDir,safeError}=require("./context.cjs");
const {validateDraft}=require("./policy-proposal.cjs");
function main(){
  const arg=name=>process.argv[process.argv.indexOf(name)+1];
  assert.ok(process.argv.includes("--proposal-hash")&&process.argv.includes("--confirmation-id"));
  const proposal=read("policy-proposal.json"),hash=dist("defense/policies/policy-release.js","policyReleaseHash");
  const {contentHash,verification,...body}=proposal;
  assert.equal(hash(body),contentHash);assert.equal(arg("--proposal-hash"),contentHash);validateDraft(body);
  const file=path.join(outputDir,"policy-approval.private.json");
  if(fs.existsSync(file)){const old=read("policy-approval.private.json");assert.equal(old.proposalHash,contentHash);assert.equal(old.confirmationId,arg("--confirmation-id"));console.log("Existing exact policy approval preserved.");return;}
  const faculty=read("faculty-report.json"),at=new Date().toISOString(),reference="Người dùng đồng ý cấu hình và lịch đề xuất cho dữ liệu tổng hợp; docs/source-dataset/POLICY-PROPOSAL.md. Không phải quyết định học vụ thật.";
  const policies=structuredClone(body.policies);
  for(const policy of Object.values(policies))Object.assign(policy,{status:"APPROVED",approvedBy:faculty.userId,approvedAt:at});
  for(const template of policies.UC25_POLICY.templates)Object.assign(template,{status:"APPROVED",approval:{by:faculty.userId,at,reference}});
  const parsed=dist("defense/policies/policy-release.js","PolicySetSchema").parse(policies);assert.equal(hash(parsed),hash(policies));
  const approvedHash=hash({termId:body.termId,policies});
  const record={proposalHash:contentHash,confirmationId:arg("--confirmation-id"),confirmedText:process.argv.includes("--confirmed-text")?arg("--confirmed-text"):"Đồng ý cấu hình và lịch đề xuất",origin:"EXPLICIT_USER_APPROVAL_FOR_SYNTHETIC_DATA",recordedAt:at,academicDecision:false,
    // OFFICIAL is the deployment path for this non-TEST shared DB term, not a claim of real academic history.
    releasePurpose:"OFFICIAL",termId:body.termId,actorId:faculty.userId,approvedAt:at,reference,contentHash:approvedHash,policies};
  save("policy-approval.private.json",record);console.log(JSON.stringify({operation:"LOCAL_APPROVAL_RECORD",proposalHash:contentHash,approvedBundleHash:approvedHash,recordedAt:at,databaseWrites:0}));
}
if(require.main===module){try{main();}catch(error){safeError(error);}}
