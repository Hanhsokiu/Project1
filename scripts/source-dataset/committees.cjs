"use strict";
const assert=require("node:assert/strict");
const {context,dist,req,read,save,safeError}=require("./context.cjs"),{defenseRuntime}=require("./defense-runtime.cjs");
async function main(){const c=await context();try{
  const eligible=read("eligibility-report.json"),{termId}=eligible,plan=read("workflow-plan.json"),shared=req("@doan/shared"),chosen=eligible.results.filter(r=>plan.scenarios.find(s=>s.studentCode===r.studentCode).actionKeys.includes("committee"));assert.equal(chosen.length,24);
  const results=await c.once("committees-batch-v1",{origin:"GENERATED_COMMITTEE",students:24},async(tx,db)=>{
    const Session=dist("defense/committees/committee.repository.js","CommitteeSession"),session=new Session(tx);
    const s=defenseRuntime(db,termId,{committees:session}).committees;
    const w=await s.workspace(c.faculty.userId,termId);assert.deepEqual(w.blockers,[]);
    assert.equal(w.committees.length,0,"Refuse to adopt committees outside this batch marker");
    const candidates=chosen.map(r=>w.candidates.find(x=>x.termStudentId===r.termStudentId));assert.ok(candidates.every(x=>x&&x.eligibility&&!x.blockers.length));
    const loads=new Map(),groups=[];
    for(const dept of [...new Set(candidates.map(r=>r.departmentId))].sort()){
      const students=candidates.filter(r=>r.departmentId===dept).sort((a,b)=>a.studentCode.localeCompare(b.studentCode));
      for(let at=0;at<students.length;at+=8){const batch=students.slice(at,at+8),advisors=new Set(batch.map(r=>r.advisorId)),members=w.lecturers.filter(l=>l.active&&l.inRoster&&!advisors.has(l.id)).sort((a,b)=>(loads.get(a.id)||0)-(loads.get(b.id)||0)||a.id.localeCompare(b.id)).slice(0,4);assert.equal(members.length,4);
        for(const l of members)loads.set(l.id,(loads.get(l.id)||0)+batch.length);
        groups.push({code:`NGUON80-HD${groups.length+1}`,departmentId:dept,students:batch.map(r=>r.termStudentId),members:members.map((l,i)=>({lecturerId:l.id,role:i===0?"CHAIR":i===1?"SECRETARY":"MEMBER"}))});
      }
    }
    const results=[];
    for(const group of groups){
      let w=await s.workspace(c.faculty.userId,termId);
      const created=await s.save(c.faculty.userId,null,shared.CommitteeSaveSchema.parse({termId,expectedRevision:0,rosterHash:w.rosterHash,reason:"[TỔNG HỢP] Tạo hội đồng để kiểm tra quy trình.",code:group.code,name:"Hội đồng tổng hợp — "+group.code,departmentId:group.departmentId,members:group.members}),"source80-create-"+group.code);
      w=await s.workspace(c.faculty.userId,termId);const committee=w.committees.find(r=>r.id===created.id);assert.ok(committee);
      await s.assign(c.faculty.userId,shared.CommitteeAssignSchema.parse({termId,rosterHash:w.rosterHash,reason:"[TỔNG HỢP] Phân sinh viên theo bộ môn và kiểm xung đột GVHD.",committees:[{committeeId:created.id,expectedRevision:committee.revision}],placements:group.students.map(id=>{const r=w.candidates.find(r=>r.termStudentId===id);return {termStudentId:id,committeeId:created.id,expectedAssignmentRevision:r.assignmentRevision,eligibilityRevision:r.eligibility.revision,evidenceHash:r.eligibility.evidenceHash,advisorHash:r.advisorHash};})}),"source80-assign-"+group.code);
      w=await s.workspace(c.faculty.userId,termId);const before=w.committees.find(r=>r.id===created.id);assert.ok(before);
      await s.finalize(c.faculty.userId,created.id,shared.CommitteeFinalizeSchema.parse({termId,expectedRevision:before.revision,rosterHash:w.rosterHash,reason:"[TỔNG HỢP] Chốt hội đồng mô phỏng."}),"source80-finalize-"+group.code);
      const {committee:v}=await s.detail(c.faculty.userId,created.id,termId);assert.equal(v.state,"FINALIZED");assert.ok(v.downstream);assert.deepEqual(v.issues,[]);
      results.push({id:created.id,...group,revision:v.revision,evidenceHash:v.downstream.evidenceHash});console.log(`Committee prepared in transaction: ${results.length}/${groups.length}`);
    }
    const finalWorkspace=await s.workspace(c.faculty.userId,termId);
    for(const row of results){const current=finalWorkspace.committees.find(v=>v.id===row.id);assert.equal(current?.state,"FINALIZED");assert.deepEqual(current.issues,[]);assert.equal(current.downstream?.evidenceHash,row.evidenceHash);}
    // No checkpoints before commit: any failure rolls back the entire batch.
    return results;
  },{timeout:900000});
  save("committees-checkpoint.json",{termId,results});
  const report={termId,datasetId:c.dataset.datasetId,origin:"GENERATED_WORKFLOW",committees:results.length,students:24,results,verifiedAt:new Date().toISOString()};save("committees-report.json",report);console.log(JSON.stringify({...report,results:undefined}));
}finally{await c.db.$disconnect();}}
if(require.main===module)main().catch(safeError);
