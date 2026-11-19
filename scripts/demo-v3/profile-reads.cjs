"use strict";
const fs=require("node:fs"),path=require("node:path"),local=require("./local.cjs"),{id,terms}=require("./definition.cjs");
async function main(){
 const classes=["guidance/final-defense/final-defense.repository","defense/eligibility/eligibility.repository","defense/committees/committee.repository","defense/reviewers/reviewer.repository","topic/proposal-reviews/proposal-review.repository","guidance/tasks/guidance.repository"];
 const r=await require("./runtime.cjs").runtime(),stats={},restore=[];
 for(const file of classes)for(const [name,value]of Object.entries(local.req('./dist/'+file))){if(!name.endsWith('Session')||typeof value!=='function')continue;for(const key of Object.getOwnPropertyNames(value.prototype)){if(key==='constructor')continue;const fn=value.prototype[key];if(typeof fn!=='function')continue;value.prototype[key]=function(...args){const start=performance.now(),finish=()=>{const s=stats[name+'.'+key]||={calls:0,ms:0};s.calls++;s.ms+=performance.now()-start;};try{const v=fn.apply(this,args);if(v?.then)return v.finally(finish);finish();return v;}catch(e){finish();throw e;}};restore.push(()=>value.prototype[key]=fn);}}
 try{await r.service("report/defense-reporting/report.service","ReportService").statistics(id("user/faculty/1"),{termId:terms[0].id});}finally{restore.forEach(f=>f());await r.app.close();}
 const data=Object.entries(stats).map(([method,s])=>({method,...s})).sort((a,b)=>b.ms-a.ms);
 fs.writeFileSync(path.join(local.root,'docs/demo-data-v3/evidence/profile-reads.json'),JSON.stringify({database:local.database,rows:data},null,2));console.log(JSON.stringify(data.slice(0,18)));
}
main().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
