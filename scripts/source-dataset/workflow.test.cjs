"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {phasePlan}=require("./assignment.cjs"),{contentFor}=require("./topics.cjs");
const {validatePhasePlan}=require("../../backend/dist/term/validator/term-configuration.validator.js");
const {req}=require("./context.cjs");
const codes=["REGISTRATION","ASSIGNMENT","PROPOSAL","WEEKLY","FINAL","DEFENSE"];
function fixture(){const start=Date.parse("2026-11-01T00:00:00Z"),day=86400000;return {startDate:new Date(start),endDate:new Date(start+120*day),phases:codes.map((code,i)=>({id:code,code,phaseName:code,startDate:new Date(start+i*20*day),endDate:new Date(start+(i+1)*20*day),isLocked:false}))};}
test("advancing preserves completed stages and opens exactly the next base stage",()=>{
  const term=fixture(),now=new Date("2026-11-17T00:00:00Z");
  for(const code of codes.slice(1)){
    const before=structuredClone(term.phases),next=phasePlan(term,code,now),index=codes.indexOf(code);
    validatePhasePlan(next,term.startDate,term.endDate);
    for(const old of before.filter(p=>codes.indexOf(p.code)<index-1&&codes.includes(p.code))){const p=next.find(p=>p.code===old.code);assert.equal(p.start,old.startDate.toISOString());assert.equal(p.end,old.endDate.toISOString());}
    assert.deepEqual(next.filter(p=>p.code!=="PROPOSAL_REVIEW"&&Date.parse(p.start)<=+now&&Date.parse(p.end)>+now).map(p=>p.code),[code]);
    term.phases=next.map(p=>({id:p.id,code:p.code,phaseName:p.name,startDate:new Date(p.start),endDate:new Date(p.end),isLocked:p.locked}));now.setMinutes(now.getMinutes()+10);
  }
});
test("generated proposal validates with dated milestones and explicit synthetic source",()=>{
  const content=contentFor({studentCode:"12345678",topic:{text:"Hệ thống quản lý đồ án"}},fixture());
  assert.ok(req("@doan/shared").SubmittedProposalContentSchema.safeParse(content).success);
  assert.match(content.objectives,/TỔNG HỢP/);assert.equal(content.schedule.length,4);
});
test("generated PDF and ZIP pass the actual submission file validator",async()=>{
  const {sourceZip,reportPdf}=require("./workflow-assets.cjs");
  const {SubmissionValidator}=require("../../backend/dist/guidance/submissions/submission.validator.js");
  const {approvedSubmissionPolicy}=require("../../backend/dist/guidance/submissions/submission-policy.js");
  const validator=new SubmissionValidator();
  for(const kind of ["REPORT","SOURCE"]){
    const bytes=kind==="REPORT"?await reportPdf("artifact-validation"):sourceZip("artifact-validation");
    const result=validator.file(kind,{originalname:kind==="REPORT"?"tong-hop.pdf":"tong-hop.zip",mimetype:kind==="REPORT"?"application/pdf":"application/zip",size:bytes.length,buffer:bytes},approvedSubmissionPolicy);
    assert.equal(result.sizeBytes,bytes.length);assert.match(result.checksum,/^[a-f0-9]{64}$/);
  }
});
test("unapproved policy proposal validates content but stays rejected at runtime",()=>{
  const {buildProposal,validateDraft}=require("./policy-proposal.cjs");
  const draft=buildProposal({datasetId:"fixture",termId:"fixture-term",endAt:"2027-02-15T00:00:00Z",date:"2026-11-18",departmentIds:["dept"]});
  assert.deepEqual(validateDraft(draft),{runtimeAccepted:false,contentContractValid:true,approvalMissing:true});
  assert.equal(draft.approval,null);assert.equal(Object.keys(draft.policies).length,9);
  draft.policies.UC24_POLICY.storageDecimalPlaces=3;
  assert.throws(()=>validateDraft(draft));
});
test("independent proposal verification rejects altered sealed content and wrong owner",()=>{
  const {verifyProposal}=require("./verify-workflow.cjs"),{reviewHash}=require("../../backend/dist/topic/proposal-reviews/proposal-review.validator.js");
  const content={title:"Tổng hợp"},meta={state:"SEALED",contentHash:reviewHash(content),submittedAt:"2026-11-17T00:00:00Z",submittedByUserId:"student-user"};
  const p={studentId:"student",termId:"term",pr2bProposalWorkflowProposalId:{submittedVersionId:"v1"},versions:[{content,pr2bProposalVersionWorkflowVersionId:meta}]};
  const expected={studentId:"student",termId:"term",stage:"PROPOSAL_SUBMITTED"};
  verifyProposal(p,expected,reviewHash);
  assert.throws(()=>verifyProposal(p,{...expected,studentId:"foreign"},reviewHash));
  const unsubmitted=structuredClone(p);unsubmitted.versions[0].pr2bProposalVersionWorkflowVersionId.submittedAt=null;
  assert.throws(()=>verifyProposal(unsubmitted,expected,reviewHash));
  p.versions[0].content.title="changed";assert.throws(()=>verifyProposal(p,expected,reviewHash));
});
test("proposal review IDs do not count as progress reviews; completed guidance requires its own actor",()=>{
  const {verifyProgressReview}=require("./verify-workflow.cjs");
  const pending={stage:"SUBMISSION_PENDING",reviewId:"proposal-decision",advisorUserId:"advisor"};
  assert.equal(verifyProgressReview({pr2bProgressReviewSubmissionId:[]},pending),false);
  const complete={...pending,stage:"PROGRESS_REVIEWED",progressReviewId:"weekly-review"};
  assert.throws(()=>verifyProgressReview({pr2bProgressReviewSubmissionId:[]},complete));
  const submission={pr2bProgressReviewSubmissionId:[{id:"weekly-review",decision:"PASS",reviewerUserId:"advisor"}]};
  assert.equal(verifyProgressReview(submission,complete),true);
  assert.throws(()=>verifyProgressReview(submission,{...complete,advisorUserId:"different-advisor"}));
  assert.equal(verifyProgressReview(submission,{...complete,progressReviewId:undefined,reviewId:"weekly-review"}),true);
});
