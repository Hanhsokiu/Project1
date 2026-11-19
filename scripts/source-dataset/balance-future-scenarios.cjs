"use strict";
// Move an unexecuted future scenario off a very short defense session. Preserve
// the 4-student scenario counts and every already completed action.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {read,save,outputDir,safeError}=require("./context.cjs");
function main(){
 const plan=read("workflow-plan.json"),reviewers=read("reviewers-report.json"),schedule=read("schedules-report.json");
 assert.ok(!fs.existsSync(path.join(outputDir,"reviewer-grades-report.json")),"Balance only before grading is executed");
 const old=structuredClone(plan),changes=[];
 for(const session of schedule.results.filter(r=>Date.parse(r.endAt)-Date.parse(r.startAt)<3600000))for(const slot of session.slots){
   const row=reviewers.results.find(r=>r.termStudentId===slot.termStudentId),scenario=plan.scenarios.find(r=>r.studentCode===row.studentCode);if(!scenario.actionKeys.includes("committee-grade"))continue;
   const alternative=plan.scenarios.find(s=>s.group==="reviewer-grade"&&schedule.results.some(session=>Date.parse(session.endAt)-Date.parse(session.startAt)>=3600000&&session.slots.some(slot=>reviewers.results.find(r=>r.termStudentId===slot.termStudentId)?.studentCode===s.studentCode)));
   assert.ok(alternative,"Need a longer published session for the complete grading scenario");
   const fields=["group","plannedStop","actionKeys","expectedEvidence"];for(const key of fields)[scenario[key],alternative[key]]=[alternative[key],scenario[key]];
   changes.push({studentCode:scenario.studentCode,swapWith:alternative.studentCode,reason:"Place future committee-grading scenario in a longer published session; earlier completed actions unchanged."});
 }
 for(const action of plan.actions)assert.equal(plan.scenarios.filter(s=>s.group===action.key).length,4);
 if(changes.length){const archive=path.join(outputDir,"workflow-plan.before-future-balance.json");assert.ok(!fs.existsSync(archive));fs.writeFileSync(archive,JSON.stringify(old,null,2)+"\n",{flag:"wx"});plan.revisedFutureScenarios={origin:"USER_REQUESTED_ALL_STEPS_TEST_DATA",at:new Date().toISOString(),changes};save("workflow-plan.json",plan);}
 console.log(JSON.stringify({futureScenariosSwapped:changes.length,preservedEarlierActions:true}));
}
if(require.main===module)try{main();}catch(e){safeError(e);}
