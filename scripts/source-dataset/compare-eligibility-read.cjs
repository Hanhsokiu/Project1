"use strict";
// Compare old/new evidence on the same DB snapshot. Never print student data.
const assert=require("node:assert/strict"),path=require("node:path"),Module=require("node:module");
const {execFileSync}=require("node:child_process");
const {root,req,read,save,dist,safeError}=require("./context.cjs");
const {environment,targetInfo}=require("./preflight.cjs"),{defenseRuntime}=require("./defense-runtime.cjs");
async function main(){
 const target=targetInfo(environment());assert.equal(target.projectRef,"zlsygwjskvxgtzdjhvzt");req("reflect-metadata");
 const source=execFileSync("git",["show","HEAD:backend/src/defense/eligibility/eligibility.service.ts"],{cwd:root,encoding:"utf8",windowsHide:true});
 const ts=req("typescript"),output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,emitDecoratorMetadata:true}}).outputText;
 const filename=path.join(root,"backend/dist/defense/eligibility/eligibility.service.original.js");
 const baselineModule=new Module(filename,module);baselineModule.filename=filename;baselineModule.paths=Module._nodeModulePaths(path.dirname(filename));baselineModule._compile(output,filename);
 const index=read("inspection-index.private.json"),registration=read("registration-report.json"),actor=read("faculty-report.json").userId;
 const cases=["Đề cương cần sửa","Hồ sơ đã tiếp nhận","Kế hoạch hướng dẫn, chưa nộp bài","Bài nộp chờ nhận xét","Đã nộp báo cáo cuối","Đã chốt đủ điều kiện bảo vệ","Hội đồng đã chốt điểm","Kết quả đã công bố"].map(state=>{
   const row=index.rows.find(row=>row.current===state);assert.ok(row,"Missing state in inspection snapshot");
   return{state,studentId:registration.results.find(result=>result.studentCode===row.studentCode).studentId};
 });
 const db=new(req("@prisma/client").PrismaClient)({datasources:{db:{url:target.url}},log:[]});
 const started=performance.now();
 try{
  const results=await db.$transaction(async tx=>{
   await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '30000ms'");
   const members=await tx.termStudent.findMany({where:{termId:index.termId,studentId:{in:cases.map(item=>item.studentId)}},select:{id:true,studentId:true}});
   for(const item of cases){item.member=members.find(member=>member.studentId===item.studentId)?.id;assert.ok(item.member,"Term membership required");}
   const runtime=defenseRuntime(db,index.termId),current=runtime.eligibility;
   const original=Object.assign(Object.create(Object.getPrototypeOf(current)),current);original.inspect=baselineModule.exports.EligibilityService.prototype.inspect;
   const Session=dist("defense/eligibility/eligibility.repository.js","EligibilitySession");
   const wrap=dist("defense/read-transaction.js","defenseReadTransaction");
   const plain=new Session(tx),batched=new Session(wrap(tx));
   const before=[];for(const item of cases)before.push(await original.forCommittee(plain,actor,item.member,index.termId));
   const after=await Promise.all(cases.map(item=>current.forCommittee(batched,actor,item.member,index.termId)));
   const hash=dist("topic/proposal-reviews/proposal-review.validator.js","reviewHash");
   return cases.map((item,i)=>{assert.equal(hash(after[i]),hash(before[i]),"Eligibility evidence must match before/after optimization");return{state:item.state,evidenceIdentical:true};});
  },{isolationLevel:"RepeatableRead",timeout:120000,maxWait:10000});
  const report={operation:"READ_ONLY",verifiedAt:new Date().toISOString(),cases:results,elapsedMilliseconds:Math.round(performance.now()-started),sameDatabaseSnapshot:true,baseline:"HEAD eligibility inspector",apiDeadlinesChanged:false,supabaseWrites:0};
  save("eligibility-performance-parity.json",report);console.log(JSON.stringify(report));
 }finally{await db.$disconnect();}
}
if(require.main===module)main().catch(safeError);
