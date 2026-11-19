"use strict";
const assert=require("node:assert/strict");
const {context,req,read,save,safeError}=require("./context.cjs"),{defenseRuntime}=require("./defense-runtime.cjs");
async function main(){const c=await context();try{
  const grades=read("committee-grades-report.json"),{termId}=grades,plan=read("workflow-plan.json"),shared=req("@doan/shared"),results=[];
  for(const row of grades.results.filter(r=>plan.scenarios.find(s=>s.studentCode===r.studentCode).actionKeys.includes("result-finalized"))){
    const scenario=plan.scenarios.find(s=>s.studentCode===row.studentCode);
    const command=async(action,actor,key)=>c.once(`final-result-${key}:${row.studentCode}`,{origin:"GENERATED_RESULT",actorUserId:actor},async(tx,db)=>{const s=defenseRuntime(db,termId).finalResults,v=await s.detail(actor,row.termStudentId,termId);assert.ok(v.calculation);return s.command(actor,row.termStudentId,shared.FinalResultCommandSchema.parse({termId,expectedRevision:v.revision,policyHash:v.policyHash,evidenceHash:v.evidenceHash,reason:"[TỔNG HỢP] "+action+" kết quả mô phỏng để kiểm tra giao diện; không phải điểm học tập thật."}),`source80-result-${key}-${row.studentCode}`,action);});
    for(const role of ["CHAIR","SECRETARY"]){const actor=row.committeeGrades.find(g=>g.role===role)?.userId;assert.ok(actor);await command("confirm",actor,role);}
    await command("finalize",c.faculty.userId,"finalize");
    if(scenario.actionKeys.includes("result-published"))await command("publish",c.faculty.userId,"publish");
    const v=await defenseRuntime(c.db,termId).finalResults.detail(c.faculty.userId,row.termStudentId,termId),expected=scenario.actionKeys.includes("result-published")?"PUBLISHED":"FINALIZED";assert.equal(v.state,expected);
    if(expected==="PUBLISHED"){const student=await defenseRuntime(c.db,termId).finalResults.detail(row.userId,row.termStudentId,termId);assert.equal(student.state,"PUBLISHED");assert.equal(student.savedCalculation.finalScore,v.savedCalculation.finalScore);}
    results.push({...row,stage:expected,resultRevision:v.revision,calculation:v.savedCalculation});save("final-results-checkpoint.json",{termId,results});console.log(`Final results verified: ${results.length}/8`);
  }
  assert.equal(results.length,8);assert.equal(results.filter(r=>r.stage==="PUBLISHED").length,4);const report={termId,datasetId:c.dataset.datasetId,origin:"GENERATED_WORKFLOW",finalized:8,published:4,results,verifiedAt:new Date().toISOString()};save("final-results-report.json",report);console.log(JSON.stringify({...report,results:undefined}));
}finally{await c.db.$disconnect();}}
if(require.main===module)main().catch(safeError);
