"use strict";
const assert=require("node:assert/strict");
const {context,req,read,save,safeError}=require("./context.cjs");
const {termService}=require("./assignment.cjs"),{runtime}=require("./guidance-runtime.cjs");
async function main(){const c=await context();try{
  const guidance=read("guidance-report.json"),{termId}=guidance,proposal=read("policy-proposal.json"),approval=read("policy-approval.private.json");
  assert.equal(proposal.contentHash,approval.proposalHash);assert.equal(guidance.reviewed,36);
  // Finish the accelerated instructional period through the ordinary weekly service.
  const closed=await c.once("weekly-calendar-close-v1",{origin:"GENERATED_ACCELERATED_CALENDAR"},async(tx,db)=>{
    const period=await tx.guidancePeriod.findUnique({where:{id:guidance.periodId}});assert.ok(period);
    const now=new Date(),due=new Date(+now-2000),ends=new Date(+now-1000);assert.ok(due>period.startsAt);
    const last=await tx.taskSubmission.findFirst({where:{task:{pr2bTaskWorkflowTaskId:{periodId:period.id}}},orderBy:{createdAt:"desc"},select:{createdAt:true}});
    assert.ok(last&&last.createdAt<due,"Finish submissions before closing the accelerated week");
    const body=req("@doan/shared").WeeklyPlanUpdateSchema.parse({ordinal:period.ordinal,label:period.label,description:period.description,startsAt:period.startsAt.toISOString(),endsAt:ends.toISOString(),reportDueAt:due.toISOString(),expectedDeliverables:period.expectedDeliverables,allowLate:period.allowLate,expectedRevision:period.revision,reason:"[TỔNG HỢP] Kết thúc kỳ hướng dẫn rút gọn sau các lần nộp; giữ nguyên lịch sử và kết quả nhận xét."});
    return runtime(db).weekly.command(c.faculty.userId,termId,body,"source80-week-close-calendar",period.id);
  });
  const calendar=await c.once("phase:FINAL-approved-calendar-v1",{origin:"USER_APPROVED_SYNTHETIC_CALENDAR",proposalHash:approval.proposalHash},async(tx,db)=>{
    const term=await tx.thesisTerm.findUnique({where:{id:termId},include:{phases:true}}),now=new Date(),boundary=new Date(+now-1000),defense=new Date(proposal.proposedDefenseStart);
    assert.ok(boundary<defense,"Approved FINAL window has elapsed; do not backdate execution");assert.ok(new Date(closed.endsAt)<boundary);
    const phases=term.phases.map(p=>({id:p.id,code:p.code,name:p.phaseName,start:p.startDate.toISOString(),end:p.endDate.toISOString(),locked:p.isLocked}));
    const weekly=phases.find(p=>p.code==="WEEKLY"),final=phases.find(p=>p.code==="FINAL"),d=phases.find(p=>p.code==="DEFENSE");
    weekly.end=boundary.toISOString();final.start=weekly.end;final.end=defense.toISOString();d.start=final.end;d.end=proposal.proposedDefenseEnd;
    await termService(db).savePhases(termId,phases,c.faculty.userId,"[TỔNG HỢP] Mở nộp cuối và bố trí giai đoạn bảo vệ theo lịch "+proposal.policies.UC21_POLICY.allowedDates.join(", ")+" người dùng đã chốt.");return {termId,phases};
  });save("final-calendar-report.json",{...calendar,verifiedAt:new Date().toISOString()});console.log(JSON.stringify({termId,finalWindow:calendar.phases.find(p=>p.code==="FINAL"),defenseWindow:calendar.phases.find(p=>p.code==="DEFENSE")}));
}finally{await c.db.$disconnect();}}
if(require.main===module)main().catch(safeError);
