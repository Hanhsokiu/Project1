"use strict";
const assert=require("node:assert/strict");
const {context,req,read,save,safeError}=require("./context.cjs"),{defenseRuntime}=require("./defense-runtime.cjs");
async function main(){const c=await context();try{
  const reviewers=read("reviewer-grades-report.json"),{termId}=reviewers,plan=read("workflow-plan.json"),shared=req("@doan/shared"),committees=read("committees-report.json"),schedule=read("schedules-report.json"),results=[];
  const chosen=reviewers.results.filter(r=>plan.scenarios.find(s=>s.studentCode===r.studentCode).actionKeys.includes("committee-grade"));
  for(const row of chosen){
    const committee=committees.results.find(g=>g.id===row.committeeId),session=schedule.results.find(s=>s.slots.some(slot=>slot.termStudentId===row.termStudentId));assert.ok(committee&&session);
    const grades=[];
    for(const [index,member] of committee.members.entries()){
      const user=await c.db.lecturer.findUnique({where:{id:member.lecturerId},select:{userId:true}});assert.ok(user);
      for(const action of ["save","finalize"])await c.once(`committee-grade-${action}:${row.studentCode}:${member.lecturerId}`,{origin:"GENERATED_GRADE",studentCode:row.studentCode,actorUserId:user.userId},async(tx,db)=>{
        // Replaying committed markers is read-only; every new write still needs
        // the real session window, including a resume between save and finalize.
        const now=new Date();assert.ok(now>=new Date(session.startAt)&&now<new Date(session.endAt),"Committee grading requires the actual published session window: "+session.startAt+" to "+session.endAt);
        const s=defenseRuntime(db,termId).committeeGrades,v=await s.detail(user.userId,row.termStudentId,termId,row.committeeId);assert.ok(v.report&&v.schedule&&v.policy);
        const body=shared.CommitteeGradeCommandSchema.parse({termId,committeeId:row.committeeId,expectedRevision:v.revision,committeeRevision:v.committeeRevision,committeeEvidenceHash:v.committeeEvidenceHash,assignmentRevision:v.assignmentRevision,membershipHash:v.membershipHash,reportVersionId:v.report.id,reportChecksum:v.report.checksum,policyHash:v.policyHash,rubricHash:v.rubricHash,scheduleHash:v.schedule.hash,criterionScores:v.policy.rubric.criteria.map((criterion,i)=>({criterionId:criterion.id,score:(7+(Number(row.studentCode.slice(-2))+index+i)%20/10).toFixed(1)})),comment:"[ĐIỂM VÀ NHẬN XÉT TỔNG HỢP] Phiếu được sinh theo vai trò thành viên để kiểm tra giao diện; không phải phiếu đánh giá thật."});
        return s.command(user.userId,row.termStudentId,body,`source80-cg-${action}-${row.studentCode}-${index}`,action);
      });
      const v=await defenseRuntime(c.db,termId).committeeGrades.detail(user.userId,row.termStudentId,termId,row.committeeId);assert.equal(v.state,"FINALIZED");grades.push({lecturerId:member.lecturerId,userId:user.userId,role:member.role,revision:v.revision,score:v.score.totalScore});
    }
    results.push({...row,stage:"COMMITTEE_GRADES_FINALIZED",committeeGrades:grades});save("committee-grades-checkpoint.json",{termId,results});console.log(`Committee grade sets verified: ${results.length}/12`);
  }
  assert.equal(results.length,12);const report={termId,datasetId:c.dataset.datasetId,origin:"GENERATED_WORKFLOW",students:12,gradeSheets:results.reduce((n,r)=>n+r.committeeGrades.length,0),results,verifiedAt:new Date().toISOString()};save("committee-grades-report.json",report);console.log(JSON.stringify({...report,results:undefined}));
}finally{await c.db.$disconnect();}}
if(require.main===module)main().catch(safeError);
