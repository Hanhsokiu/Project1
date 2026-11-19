"use strict";
const assert=require("node:assert/strict");
const {context,req,read,save,safeError}=require("./context.cjs"),{defenseRuntime}=require("./defense-runtime.cjs");
async function main(){const c=await context();try{
  const final=read("final-reports-report.json"),{termId}=final,shared=req("@doan/shared"),results=[];
  for(const row of final.results.filter(r=>r.stage==="ADVISOR_CONFIRMED")){
    const member=await c.db.termStudent.findUnique({where:{termId_studentId:{termId,studentId:row.studentId}}});assert.ok(member);
    const step=(key,fn)=>c.once(key+":"+row.studentCode,{origin:"GENERATED_ELIGIBILITY",studentCode:row.studentCode},fn);
    await step("eligibility-review",async(tx,db)=>{const s=defenseRuntime(db,termId).eligibility,v=await s.detail(c.faculty.userId,member.id,termId),term=await tx.thesisTerm.findUnique({where:{id:termId}});return s.reviewDossier(c.faculty.userId,member.id,shared.EligibilityReviewSchema.parse({termId,expectedRevision:v.revision,evidenceHash:v.evidenceHash,reason:"[TỔNG HỢP] Xét hồ sơ để kiểm tra luồng dữ liệu; không phải xác minh học vụ thật.",academic:{source:"SOURCE80_ACADEMIC",reference:"Người dùng cho phép sinh GPA và điều kiện học vụ; nguồn là dữ liệu tổng hợp.",outcome:"PASS",effectiveFrom:new Date().toISOString(),validUntil:term.endDate.toISOString()}}),"source80-eligibility-review-"+row.studentCode);});
    await step("eligibility-decide",async(tx,db)=>{const s=defenseRuntime(db,termId).eligibility,v=await s.detail(c.faculty.userId,member.id,termId);assert.equal(v.preview,"QUALIFIED","Eligibility blockers: "+v.checks.filter(x=>x.state!=="QUALIFIED").map(x=>x.key+":"+x.state).join(","));return s.decide(c.faculty.userId,member.id,shared.EligibilityDecisionSchema.parse({termId,expectedRevision:v.revision,evidenceHash:v.evidenceHash,status:"ELIGIBLE",reason:"[TỔNG HỢP] Mô phỏng quyết định đủ điều kiện bảo vệ."}),"source80-eligibility-decide-"+row.studentCode);});
    await step("eligibility-finalize",async(tx,db)=>{const s=defenseRuntime(db,termId).eligibility,v=await s.detail(c.faculty.userId,member.id,termId);return s.finalize(c.faculty.userId,shared.EligibilityFinalizeSchema.parse({termId,reason:"[TỔNG HỢP] Chốt hồ sơ tổng hợp để kiểm tra phân hội đồng.",members:[{termStudentId:member.id,expectedRevision:v.revision,evidenceHash:v.evidenceHash}]}),"source80-eligibility-finalize-"+row.studentCode);});
    const v=await defenseRuntime(c.db,termId).eligibility.detail(c.faculty.userId,member.id,termId);assert.equal(v.official.state,"FINALIZED");assert.equal(v.downstream?.decision,"ELIGIBLE");
    results.push({...row,termStudentId:member.id,stage:"ELIGIBILITY_FINALIZED",eligibilityRevision:v.revision,eligibilityEvidenceHash:v.evidenceHash});save("eligibility-checkpoint.json",{termId,results});console.log(`Eligibility verified: ${results.length}/28`);
  }
  assert.equal(results.length,28);const report={termId,datasetId:c.dataset.datasetId,origin:"GENERATED_WORKFLOW",eligible:28,results,verifiedAt:new Date().toISOString()};save("eligibility-report.json",report);console.log(JSON.stringify({...report,results:undefined}));
}finally{await c.db.$disconnect();}}
if(require.main===module)main().catch(safeError);
