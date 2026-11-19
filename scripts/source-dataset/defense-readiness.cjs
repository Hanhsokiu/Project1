"use strict";
// Read-only service evaluation; optionally inspect the full committee workspace.
const assert=require("node:assert/strict");
const {req,read,save,safeError}=require("./context.cjs"),{environment,targetInfo}=require("./preflight.cjs"),{defenseRuntime}=require("./defense-runtime.cjs");
async function main(){
  req("reflect-metadata");const target=targetInfo(environment()),db=new (req("@prisma/client").PrismaClient)({datasources:{db:{url:target.url}},log:[]});
  try{
    const {termId,results}=read("final-reports-checkpoint.json"),row=results.find(r=>r.stage==="ADVISOR_CONFIRMED");assert.ok(row);
    const started=Date.now(),result=await db.$transaction(async tx=>{
      await tx.$executeRawUnsafe("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
      const member=await tx.termStudent.findUnique({where:{termId_studentId:{termId,studentId:row.studentId}}});assert.ok(member);
      // Service read uses this transaction via a nested repository adapter.
      const dbAdapter=new Proxy(tx,{get:(obj,key)=>key==="$transaction"?async fn=>fn(tx):typeof obj[key]==="function"?obj[key].bind(obj):obj[key]});
      if(process.argv.includes("--committees")){
        const view=await defenseRuntime(dbAdapter,termId).committees.workspace(read("faculty-report.json").userId,termId);
        return {termId,scope:"COMMITTEE_WORKSPACE",blockers:view.blockers,candidates:view.candidates.length,eligible:view.candidates.filter(r=>r.eligibility&&!r.blockers.length).length,lecturers:view.lecturers.length,committees:view.committees.length};
      }
      const view=await defenseRuntime(dbAdapter,termId).eligibility.detail(read("faculty-report.json").userId,member.id,termId);
      return {termId,preview:view.preview,checks:view.checks.map(c=>({key:c.key,state:c.state})),actionBlockers:view.actionBlockers};
    },{timeout:process.argv.includes("--committees")?600000:120000});
    const report={operation:"READ_ONLY",verifiedAt:new Date().toISOString(),durationMs:Date.now()-started,...result};
    save(process.argv.includes("--committees")?"committee-readiness.json":"defense-readiness.json",report);console.log(JSON.stringify(report));
  }finally{await db.$disconnect();}
}
if(require.main===module)main().catch(safeError);
