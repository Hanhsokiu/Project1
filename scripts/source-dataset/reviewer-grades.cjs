"use strict";
const assert=require("node:assert/strict");
const {context,req,read,save,safeError}=require("./context.cjs"),{defenseRuntime}=require("./defense-runtime.cjs");
async function main(){const c=await context();try{
  const reviewers=read("reviewers-report.json"),{termId}=reviewers,plan=read("workflow-plan.json"),shared=req("@doan/shared"),results=[];assert.equal(read("schedules-report.json").students,20);
  for(const row of reviewers.results.filter(r=>plan.scenarios.find(s=>s.studentCode===r.studentCode).actionKeys.includes("reviewer-grade"))){
    for(const action of ["save","finalize"])await c.once("reviewer-grade-"+action+":"+row.studentCode,{origin:"GENERATED_GRADE",studentCode:row.studentCode},async(tx,db)=>{
      const s=defenseRuntime(db,termId).reviewerGrades,v=await s.detail(row.reviewerUserId,row.termStudentId,termId);assert.ok(v.assignment&&v.report);
      const body=shared.ReviewerGradeCommandSchema.parse({termId,expectedRevision:v.revision,assignmentId:v.assignment.assignmentId,assignmentRevision:v.assignment.revision,assignmentEvidenceHash:v.assignment.evidenceHash,reportVersionId:v.report.id,reportChecksum:v.report.checksum,policyHash:v.policyHash,rubricHash:v.rubricHash,scheduleHash:v.schedule?.hash||null,totalScore:(7+Number(row.studentCode.slice(-2))%20/10).toFixed(1),criterionScores:{},comment:"[TỔNG HỢP] Phiếu phản biện sinh để kiểm tra giao diện, không phải đánh giá thật.",strengths:"[TỔNG HỢP] Nội dung trình bày các luồng chính rõ ràng.",weaknesses:"[TỔNG HỢP] Cần mở rộng minh chứng kiểm thử.",questions:"1. Tiêu chí kiểm thử được chọn như thế nào?\n2. Hệ thống xử lý các tình huống lỗi ra sao?"});
      return s.command(row.reviewerUserId,row.termStudentId,body,`source80-reviewer-grade-${action}-${row.studentCode}`,action);
    });
    const v=await defenseRuntime(c.db,termId).reviewerGrades.detail(row.reviewerUserId,row.termStudentId,termId);assert.equal(v.state,"FINALIZED");
    results.push({...row,stage:"REVIEWER_GRADE_FINALIZED",reviewerGradeRevision:v.revision,reviewerScore:v.score.totalScore});save("reviewer-grades-checkpoint.json",{termId,results});console.log(`Reviewer grades verified: ${results.length}/16`);
  }
  assert.equal(results.length,16);const report={termId,datasetId:c.dataset.datasetId,origin:"GENERATED_WORKFLOW",finalized:16,results,verifiedAt:new Date().toISOString()};save("reviewer-grades-report.json",report);console.log(JSON.stringify({...report,results:undefined}));
}finally{await c.db.$disconnect();}}
if(require.main===module)main().catch(safeError);
