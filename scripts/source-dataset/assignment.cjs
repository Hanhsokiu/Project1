"use strict";
const assert=require("node:assert/strict");
const {context,dist,read,save,safeError}=require("./context.cjs");
function phasePlan(term,active,now=new Date()){
  const codes=["REGISTRATION","ASSIGNMENT","PROPOSAL","WEEKLY","FINAL","DEFENSE"],index=codes.indexOf(active);
  assert.ok(index>0);const start=+new Date(term.startDate),end=+new Date(term.endDate),boundary=+now-1000;
  assert.ok(start<boundary&&boundary<end);
  const result=codes.map((code,i)=>{const old=term.phases.find(p=>p.code===code);assert.ok(old);
    // Keep completed windows intact; shorten only the stage we are leaving.
    const a=i<index?+new Date(old.startDate):boundary+(end-boundary)*(i-index)/(6-index);
    const b=i<index-1?+new Date(old.endDate):i===index-1?boundary:boundary+(end-boundary)*(i+1-index)/(6-index);
    assert.ok(a<b,"Cannot advance a phase before it has started");
    return {id:old.id,code,name:old.phaseName,start:new Date(a).toISOString(),end:new Date(b).toISOString(),locked:old.isLocked};});
  if(index>=2){const p=result[2],old=term.phases.find(p=>p.code==="PROPOSAL_REVIEW");result.push({...(old?{id:old.id}:{}),code:"PROPOSAL_REVIEW",name:"Xét duyệt đề cương",start:p.start,end:p.end,locked:false});}
  return result;
}
function termService(db){const Repo=dist("term/repository/term.repository.js","TermRepository"),Service=dist("term/service/term-lifecycle.service.js","TermLifecycleService"),V=dist("term/validator/term-transition.validator.js","TermTransitionValidator"),Audit=dist("common/audit/audit.service.js","AuditService");return new Service(new Repo(db),new V(),new Audit(db));}
async function advance(c,termId,active){return c.once("phase:"+active,{origin:"GENERATED_ACCELERATED_CALENDAR",active},async(tx,db)=>{const term=await tx.thesisTerm.findUnique({where:{id:termId},include:{phases:true}});const phases=phasePlan(term,active);await termService(db).savePhases(termId,phases,c.faculty.userId,"[DỮ LIỆU TỔNG HỢP] Chuyển giai đoạn để thực thi kịch bản kiểm tra giao diện; không phải lịch học vụ thật.");return {active,phases};});}
async function main(){const c=await context();try{
  const {termId}=read("foundation-report.json"),regs=read("registration-report.json");assert.equal(regs.termId,termId);assert.equal(regs.submitted,76);
  await c.once("registration-close",{targetStatus:"CLOSED_REGISTRATION"},async(tx,db)=>{await termService(db).transition(termId,"CLOSED_REGISTRATION",c.faculty.userId);return {status:"CLOSED_REGISTRATION"};});
  await advance(c,termId,"ASSIGNMENT");
  const Repo=dist("term/repository/term.repository.js","TermRepository"),Audit=dist("common/audit/audit.service.js","AuditService"),Quota=dist("term/service/quota.service.js","QuotaService");
  await c.once("quota-approved",{origin:"GENERATED_QUOTA_FROM_SUBMITTED_PREFERENCES"},async(tx,db)=>{
    const t=await tx.thesisTerm.findUnique({where:{id:termId},include:{termLecturers:{include:{lecturer:true}}}}),service=new Quota(new Repo(db),new Audit(db));
    const counts=new Map();for(const r of regs.results.filter(r=>r.status==="SUBMITTED"))counts.set(r.advisorId,(counts.get(r.advisorId)||0)+1);
    const preview=await service.preview(termId,{revision:t.quotaPolicy?.revision||0,settings:{basis:"SUBMITTED",defaultLimit:10,factors:{MASTER:0.75,DOCTOR:1,ASSOCIATE_PROFESSOR:1,PROFESSOR:1}},limits:t.termLecturers.map(m=>({lecturerId:m.lecturerId,maxQuota:m.lecturer.academicDegree?Math.max(10,counts.get(m.lecturerId)||0):0}))},c.faculty.userId);
    const approved=await service.approve(termId,{revision:preview.revision,members:preview.members.map(m=>({lecturerId:m.lecturerId,quota:counts.get(m.lecturerId)||0,reason:"[TỔNG HỢP] Phân chỉ tiêu theo nguyện vọng đã nộp của bộ dữ liệu nguồn 80."}))},c.faculty.userId);
    return {revision:approved.revision,status:approved.status,demandCount:approved.demandCount};
  });
  const AR=dist("registration/repository/assignment.repository.js","AssignmentRepository"),AS=dist("registration/service/assignment-plan.service.js","AssignmentPlanService"),Window=dist("term/service/term-window.service.js","TermWindowService");
  const service=db=>new AS(new AR(db),new Window(new Repo(db)));
  await c.once("assignment-draft",{origin:"GENERATED_WORKFLOW"},async(tx,db)=>{
    const s=service(db),current=await s.view(termId,c.faculty.userId,true),options={mode:"all",confirmed:true,revision:current.plan?.revision||0};
    const preview=await s.preview(termId,options);assert.equal(preview.results.filter(r=>r.assignedLecturerId).length,76);
    const result=await s.save(termId,{...options,inputHash:preview.inputHash},c.faculty.userId);return {plan:result.plan,assigned:result.assignments.length};
  });
  await c.once("assignment-publish",{origin:"GENERATED_WORKFLOW"},async(tx,db)=>{const s=service(db),v=await s.view(termId,c.faculty.userId,true);const r=await s.publish(termId,v.plan.revision,c.faculty.userId);return {plan:r.plan};});
  await c.once("assignment-finalize",{origin:"GENERATED_WORKFLOW"},async(tx,db)=>{const s=service(db),v=await s.view(termId,c.faculty.userId,true);const r=await s.finalize(termId,v.plan.revision,c.faculty.userId);return {plan:r.plan};});
  const result=await service(c.db).view(termId,c.faculty.userId,true);assert.equal(result.plan.status,"FINALIZED");assert.equal(result.assignments.length,76);assert.equal(result.violations.length,0);
  const report={termId,datasetId:c.dataset.datasetId,origin:"GENERATED_WORKFLOW",status:result.plan.status,assigned:76,registrationDrafts:4,violations:result.violations,assignments:result.assignments,verifiedAt:new Date().toISOString(),planDeviation:"All 76 submitted registrations must be assigned before publication; original submitted-only group is also assigned."};
  save("assignment-report.json",report);console.log(JSON.stringify({...report,assignments:undefined}));
}finally{await c.db.$disconnect();}}
module.exports={phasePlan,termService,advance};
if(require.main===module)main().catch(safeError);
