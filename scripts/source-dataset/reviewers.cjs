"use strict";
const assert=require("node:assert/strict");
const {context,dist,req,read,save,safeError}=require("./context.cjs"),{defenseRuntime}=require("./defense-runtime.cjs");
async function main(){const c=await context();try{
  const eligible=read("eligibility-report.json"),{termId}=eligible,plan=read("workflow-plan.json"),shared=req("@doan/shared"),chosen=eligible.results.filter(r=>plan.scenarios.find(s=>s.studentCode===r.studentCode).actionKeys.includes("schedule"));assert.equal(chosen.length,20);
  // Use the existing batch API to evaluate all capacity demands together.
  // This also avoids twenty repeated full-term scans.
  const results=await c.once("reviewers-batch-v1",{origin:"GENERATED_REVIEWER_ASSIGNMENT",students:20},async(tx,db)=>{
    const Session=dist("defense/reviewers/reviewer.repository.js","ReviewerSession"),session=new Session(tx);
    const s=defenseRuntime(db,termId,{reviewers:session}).reviewers,p=await s.propose(c.faculty.userId,termId,chosen.map(r=>r.termStudentId).join(","));
    assert.equal(p.status,"FEASIBLE","Reviewer allocation: "+p.reasons.join(","));
    assert.deepEqual(p.placements.map(r=>r.termStudentId).sort(),chosen.map(r=>r.termStudentId).sort());
    await s.assign(c.faculty.userId,shared.ReviewerAssignSchema.parse({termId,rosterHash:p.rosterHash,reason:"[TỔNG HỢP] Phân phản biện đúng chuyên môn và kiểm tra tải/xung đột cho 20 hồ sơ.",placements:p.placements}),"source80-reviewer-assign-batch-v1");
    const w=await s.workspace(c.faculty.userId,termId);
    const members=chosen.map(r=>{const v=w.students.find(s=>s.id===r.termStudentId);assert.ok(v?.binding);return v.binding;});
    await s.finalize(c.faculty.userId,shared.ReviewerFinalizeSchema.parse({termId,rosterHash:w.rosterHash,reason:"[TỔNG HỢP] Chốt phản biện mô phỏng.",members}),"source80-reviewer-finalize-batch-v1");
    const verified=await s.workspace(c.faculty.userId,termId),results=[];
  for(const row of chosen){
    const v=verified.students.find(r=>r.id===row.termStudentId);assert.ok(v);assert.equal(v.state,"FINALIZED");assert.equal(v.downstream?.length,1);
    const lecturer=await tx.lecturer.findUnique({where:{id:v.reviewerIds[0]},select:{userId:true}});assert.ok(lecturer);
    results.push({...row,stage:"REVIEWER_FINALIZED",committeeId:v.committeeId,reviewerId:v.reviewerIds[0],reviewerUserId:lecturer.userId,reviewerBinding:v.downstream[0]});
  }
    return results;
  },{timeout:900000});
  save("reviewers-checkpoint.json",{termId,results});
  const report={termId,datasetId:c.dataset.datasetId,origin:"GENERATED_WORKFLOW",assigned:20,results,verifiedAt:new Date().toISOString()};save("reviewers-report.json",report);console.log(JSON.stringify({...report,results:undefined}));
}finally{await c.db.$disconnect();}}
if(require.main===module)main().catch(safeError);
