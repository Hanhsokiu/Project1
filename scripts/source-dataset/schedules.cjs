"use strict";
const assert=require("node:assert/strict");
const {context,req,read,save,safeError}=require("./context.cjs"),{defenseRuntime}=require("./defense-runtime.cjs"),{termService}=require("./assignment.cjs");
async function main(){const c=await context();try{
  const reviewers=read("reviewers-report.json"),{termId}=reviewers,shared=req("@doan/shared"),selected=new Set(reviewers.results.map(r=>r.termStudentId));
  await c.once("term-defending-v1",{origin:"GENERATED_WORKFLOW"},async(tx,db)=>{
    const term=await tx.thesisTerm.findUnique({where:{id:termId},include:{phases:true}}),phase=term.phases.find(p=>p.code==="DEFENSE"),now=new Date();assert.ok(phase&&now>=phase.startDate&&now<phase.endDate,"Wait for approved DEFENSE phase; do not alter clock");
    if(term.status!=="DEFENDING")await termService(db).transition(termId,"DEFENDING",c.faculty.userId);return {status:"DEFENDING"};
  });
  const planned=await c.once("schedule-proposal-v1",{origin:"GENERATED_SCHEDULE"},async(tx,db)=>{
    const s=defenseRuntime(db,termId).schedule,p=await s.propose(c.faculty.userId,termId,[...new Set(reviewers.results.map(r=>r.committeeId))].join(","));assert.equal(p.status,"FEASIBLE","Schedule proposal: "+p.reasons.join(","));
    const sessions=p.sessions.map(body=>({...body,termStudentIds:body.termStudentIds.filter(id=>selected.has(id)),reason:"[TỔNG HỢP] Lịch mô phỏng theo ngày và khung giờ đã được người dùng duyệt."})).filter(body=>body.termStudentIds.length);
    assert.equal(sessions.reduce((n,s)=>n+s.termStudentIds.length,0),20);return {sessions};
  });
  const results=[];
  for(const [index,body] of planned.sessions.entries()){
    const step=(key,fn)=>c.once(key+":"+index,{origin:"GENERATED_SCHEDULE"},fn);
    const created=await step("schedule-create",async(tx,db)=>{const s=defenseRuntime(db,termId).schedule,w=await s.workspace(c.faculty.userId,termId);return s.save(c.faculty.userId,null,shared.ScheduleSaveSchema.parse({...body,rosterHash:w.rosterHash}),"source80-schedule-create-"+index);});
    const id=created.sessions[0].id;
    for(const action of ["finalize","publish"])await step("schedule-"+action,async(tx,db)=>{const s=defenseRuntime(db,termId).schedule,w=await s.workspace(c.faculty.userId,termId),v=w.schedules.find(r=>r.id===id);assert.ok(v);return s.transition(c.faculty.userId,shared.ScheduleCommandSchema.parse({termId,rosterHash:w.rosterHash,reason:"[TỔNG HỢP] "+action+" lịch bảo vệ mô phỏng.",members:[{id,expectedRevision:v.revision,evidenceHash:v.evidenceHash}]}),"source80-schedule-"+action+"-"+index,action);});
    const v=await defenseRuntime(c.db,termId).schedule.detail(c.faculty.userId,id,termId);assert.ok(v.downstream?.publishedAt);assert.deepEqual(v.issues,[]);
    results.push(v.downstream);save("schedules-checkpoint.json",{termId,results});console.log(`Schedules verified: ${results.length}/${planned.sessions.length}`);
  }
  const report={termId,datasetId:c.dataset.datasetId,origin:"GENERATED_WORKFLOW",sessions:results.length,students:20,results,verifiedAt:new Date().toISOString()};save("schedules-report.json",report);console.log(JSON.stringify({...report,results:undefined}));
}finally{await c.db.$disconnect();}}
if(require.main===module)main().catch(safeError);
