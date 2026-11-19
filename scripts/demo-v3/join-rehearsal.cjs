"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),local=require("./local.cjs"),{id,hash}=require("./definition.cjs");
async function main(){
 const db=local.client(),checks=[];
 const capture={topicWorkflow:{findUnique:a=>a},weeklyReportObligation:{findMany:a=>a},guidancePlan:{findUnique:a=>a}};
 const {GuidanceSession}=local.req('./dist/guidance/tasks/guidance.repository'),{EligibilitySession}=local.req('./dist/defense/eligibility/eligibility.repository');
 const g=new GuidanceSession(capture),e=new EligibilitySession(capture);
 const requests=[['ownerProposal','topicWorkflow','findUnique',g.ownerProposal(id('member/march/1'))],['obligations','weeklyReportObligation','findMany',g.obligations(id('member/march/1'))],['eligibilityProgress','guidancePlan','findUnique',e.eligibilityProgress(id('proposal/march/1'))]];
 try {await local.identity(db);await db.$transaction(async tx=>{for(const [name,model,method,args] of requests){const results={};for(const strategy of ['query','join']){const start=performance.now();const row=await tx[model][method]({...args,relationLoadStrategy:strategy});results[strategy]={ms:performance.now()-start,digest:hash(JSON.parse(JSON.stringify(row)))};}assert.equal(results.query.digest,results.join.digest,name+' changed results');checks.push({name,status:'PASS',...results});}},{isolationLevel:'RepeatableRead',timeout:30000});}finally{await db.$disconnect();}
 fs.writeFileSync(path.join(local.root,'docs/demo-data-v3/evidence/join-rehearsal.json'),JSON.stringify({database:local.database,realPostgreSQL:true,checks,limits:'One source owner sampled in one RepeatableRead snapshot; request arguments captured from repository methods, both strategies queried actual PostgreSQL.'},null,2));console.log(JSON.stringify(checks));
}
main().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
