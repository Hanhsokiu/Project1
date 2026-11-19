"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {context,dist,req,read,save,outputDir,safeError}=require("./context.cjs"),{defenseRuntime}=require("./defense-runtime.cjs"),{termService}=require("./assignment.cjs");
async function bounded(promise,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error(label),{code:"REPORT_STEP_TIMEOUT"})),300000);})]);}finally{clearTimeout(timer);}}
function runtime(db,tx,termId,key){
 const classes={schedule:["defense/scheduling/schedule.repository.js","ScheduleSession"],reviewerGrades:["defense/reviewer-grading/reviewer-grade.repository.js","ReviewerGradeSession"],committeeGrades:["defense/committee-grading/committee-grade.repository.js","CommitteeGradeSession"],finalResults:["defense/final-results/final-result.repository.js","FinalResultSession"]};
 classes.reports=["report/defense-reporting/report.repository.js","ReportSession"];
 const [file,name]=classes[key],Session=dist(file,name),session=new Session(tx);
 if(key!=="schedule"){
   // These producers are immutable during a grade/result/export batch. Own
   // scores, confirmations, results, events and replay rows always stay fresh.
   const stable=["rgReady","cgReady","frReady","schemaReady","scReady","ccReady","rwReady","eligibilitySchemaReady","rgPolicy","cgPolicy","frPolicy","rpPolicy","rgRubric","cgRubric","rgAssignments","ccList","scRecords","report","version"];
   if(["committeeGrades","finalResults","reports"].includes(key))stable.push("rgScore","rgEvents");
   if(["finalResults","reports"].includes(key))stable.push("cgScores","cgEvents","member","memberProposal","proposal","ccEvents","rwEvents","ccLecturers","events","advisorScore","finalDecision");
   if(key==="reports")stable.push("frRow","frEvents","rpCandidates");
   for(const method of stable){
     if(typeof session[method]!=="function")continue;const original=session[method].bind(session),cache=new Map();
     session[method]=(...args)=>{const cacheKey=JSON.stringify(args);if(!cache.has(cacheKey))cache.set(cacheKey,Promise.resolve(original(...args)));return cache.get(cacheKey);};
   }
 }
 const bundle=defenseRuntime(db,termId,{[key]:session});
 if(key==="reports"){
   // Reports only write their own export metadata. Validate each immutable
   // upstream producer once per actual actor/scope/revision in this same DB
   // transaction; do not cache ReportService commands, metadata or replays.
   for(const [service,methods] of [[bundle.committees,["workspaceInSession","effectiveInSession"]],[bundle.reviewers,["workspaceInSession","effectiveInSession"]],[bundle.schedule,["effectiveInSession"]],[bundle.reviewerGrades,["effectiveInSession"]],[bundle.committeeGrades,["effectiveInSession"]],[bundle.advisorGrades,["effectiveInSession"]],[bundle.finalResults,["effectiveInSession"]]]){
     for(const name of methods){const original=service[name].bind(service),cache=new Map();service[name]=(...args)=>{if(args[0]!==session)return original(...args);const cacheKey=JSON.stringify(args.slice(1));if(!cache.has(cacheKey))cache.set(cacheKey,Promise.resolve(original(...args)));return cache.get(cacheKey);};}
   }
 }
 return bundle[key];
}
async function main(){const c=await context();try{
 const reviewers=read("reviewers-report.json"),{termId}=reviewers,plan=read("workflow-plan.json"),shared=req("@doan/shared"),has=(row,action)=>plan.scenarios.find(s=>s.studentCode===row.studentCode).actionKeys.includes(action);
 const stage=process.argv[process.argv.indexOf("--stage")+1];assert.ok(["schedules","reviewer-grades","committee-grades","final-results","reports"].includes(stage));
 if(stage==="schedules"){
   const results=await c.once("schedules-accelerated-batch-v2",{origin:"USER_REQUESTED_TEST_DATA"},async(tx,db)=>{
     // Match the production ScheduleRepository protocol, including the SQL
     // trigger's required isolation and global cross-term booking mutex.
     await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(2117,21)");
     await termService(db).transition(termId,"DEFENDING",c.faculty.userId);
     const s=runtime(db,tx,termId,"schedule"),w=await s.workspace(c.faculty.userId,termId);assert.deepEqual(w.blockers,[]);assert.equal(w.schedules.length,0);
     const selected=new Set(reviewers.results.map(r=>r.termStudentId)),sources=w.sources.filter(r=>r.students.some(x=>selected.has(x.termStudentId))),date=read("accelerated-defense-report.json").date;
     const phase=read("accelerated-defense-report.json").phases.find(p=>p.code==="DEFENSE");
     const start=new Date(Math.ceil((Date.parse(phase.start)+60000)/300000)*300000+7*3600000).toISOString().slice(11,16);
     const bodies=sources.map((source,i)=>shared.ScheduleSaveSchema.parse({termId,rosterHash:w.rosterHash,expectedRevision:0,reason:"[DỮ LIỆU TEST TỔNG HỢP] Lịch rút gọn theo yêu cầu để đánh giá ngay mọi bước.",committeeId:source.committeeId,committeeRevision:source.committeeRevision,committeeEvidenceHash:source.committeeEvidenceHash,sourceHash:source.sourceHash,roomId:w.policy.roomAccess[i].roomId,date,period:"AFTERNOON",startTime:start,termStudentIds:source.students.filter(x=>selected.has(x.termStudentId)).map(x=>x.termStudentId)}));
     assert.equal(bodies.reduce((n,b)=>n+b.termStudentIds.length,0),20);
     const created=await s.saveBatch(c.faculty.userId,shared.ScheduleBatchSchema.parse({termId,rosterHash:w.rosterHash,reason:"[TỔNG HỢP] Tạo lịch để đánh giá UI.",sessions:bodies.map(body=>({id:null,body}))}),"source80-schedules-accelerated-v2");
     const ids=created.sessions.map(r=>r.id);
     for(const action of ["finalize","publish"]){const fresh=await s.workspace(c.faculty.userId,termId);await s.transition(c.faculty.userId,shared.ScheduleCommandSchema.parse({termId,rosterHash:fresh.rosterHash,reason:"[DỮ LIỆU TEST TỔNG HỢP] "+action+" lịch rút gọn.",members:ids.map(id=>{const v=fresh.schedules.find(r=>r.id===id);assert.ok(v);return{id,expectedRevision:v.revision,evidenceHash:v.evidenceHash};})}),"source80-schedules-"+action+"-v2",action);}
     const fresh=await s.workspace(c.faculty.userId,termId);return ids.map(id=>{const v=fresh.schedules.find(r=>r.id===id);assert.ok(v.downstream?.publishedAt);assert.deepEqual(v.issues,[]);return v.downstream;});
   },{timeout:900000,isolationLevel:"ReadCommitted"});
   save("schedules-report.json",{termId,datasetId:c.dataset.datasetId,origin:"GENERATED_WORKFLOW",sessions:results.length,students:20,results,verifiedAt:new Date().toISOString()});console.log("Published schedules verified: "+results.length);return;
 }
 if(stage==="reviewer-grades"){
   assert.equal(read("schedules-report.json").students,20);
   const results=await c.once("reviewer-grades-accelerated-batch-v2",{origin:"GENERATED_GRADE"},async(tx,db)=>{
     const s=runtime(db,tx,termId,"reviewerGrades"),results=[];
     for(const row of reviewers.results.filter(r=>has(r,"reviewer-grade"))){
       for(const action of ["save","finalize"]){const v=await s.detail(row.reviewerUserId,row.termStudentId,termId);assert.ok(v.assignment&&v.report);
         const body=shared.ReviewerGradeCommandSchema.parse({termId,expectedRevision:v.revision,assignmentId:v.assignment.assignmentId,assignmentRevision:v.assignment.revision,assignmentEvidenceHash:v.assignment.evidenceHash,reportVersionId:v.report.id,reportChecksum:v.report.checksum,policyHash:v.policyHash,rubricHash:v.rubricHash,scheduleHash:v.schedule?.hash||null,totalScore:(7+Number(row.studentCode.slice(-2))%20/10).toFixed(1),criterionScores:{},comment:"[TỔNG HỢP] Phiếu phản biện để đánh giá giao diện.",strengths:"[TỔNG HỢP] Trình bày rõ yêu cầu và giải pháp.",weaknesses:"[TỔNG HỢP] Cần bổ sung kiểm thử tình huống biên.",questions:"1. Lý do chọn giải pháp này?\n2. Cách kiểm chứng độ tin cậy của hệ thống?"});
         await s.command(row.reviewerUserId,row.termStudentId,body,`source80-rg-v2-${action}-${row.studentCode}`,action);
       }
       const v=await s.detail(row.reviewerUserId,row.termStudentId,termId);assert.equal(v.state,"FINALIZED");results.push({...row,stage:"REVIEWER_GRADE_FINALIZED",reviewerGradeRevision:v.revision,reviewerScore:v.score.totalScore});console.log("Reviewer grades in transaction: "+results.length+"/16");
     }assert.equal(results.length,16);return results;
   },{timeout:1800000});save("reviewer-grades-report.json",{termId,datasetId:c.dataset.datasetId,origin:"GENERATED_WORKFLOW",finalized:16,results,verifiedAt:new Date().toISOString()});return;
 }
 if(stage==="committee-grades"){
   const source=read("reviewer-grades-report.json"),committees=read("committees-report.json"),schedules=read("schedules-report.json");
   const results=await c.once("committee-grades-accelerated-batch-v2",{origin:"GENERATED_GRADE"},async(tx,db)=>{
     const s=runtime(db,tx,termId,"committeeGrades"),results=[];
     for(const row of source.results.filter(r=>has(r,"committee-grade")).sort((a,b)=>Date.parse(schedules.results.find(s=>s.slots.some(slot=>slot.termStudentId===a.termStudentId)).endAt)-Date.parse(schedules.results.find(s=>s.slots.some(slot=>slot.termStudentId===b.termStudentId)).endAt))){
       const committee=committees.results.find(g=>g.id===row.committeeId),schedule=schedules.results.find(g=>g.slots.some(slot=>slot.termStudentId===row.termStudentId));assert.ok(committee&&schedule);
       const grades=[];
       for(const [index,member] of committee.members.entries()){
         const user=await tx.lecturer.findUnique({where:{id:member.lecturerId},select:{userId:true}});assert.ok(user);
         let current=await s.detail(user.userId,row.termStudentId,termId,row.committeeId);
         for(const action of ["save","finalize"]){assert.ok(Date.now()>=Date.parse(schedule.startAt)&&Date.now()<Date.parse(schedule.endAt),"Actual grading session must be open");
           const v=current;assert.ok(v.report&&v.schedule&&v.policy);
           const body=shared.CommitteeGradeCommandSchema.parse({termId,committeeId:row.committeeId,expectedRevision:v.revision,committeeRevision:v.committeeRevision,committeeEvidenceHash:v.committeeEvidenceHash,assignmentRevision:v.assignmentRevision,membershipHash:v.membershipHash,reportVersionId:v.report.id,reportChecksum:v.report.checksum,policyHash:v.policyHash,rubricHash:v.rubricHash,scheduleHash:v.schedule.hash,criterionScores:v.policy.rubric.criteria.map((criterion,i)=>({criterionId:criterion.id,score:(7+(Number(row.studentCode.slice(-2))+index+i)%20/10).toFixed(1)})),comment:"[ĐIỂM TỔNG HỢP] Phiếu hội đồng để đánh giá giao diện, không phải điểm học vụ thật."});
           const saved=await s.command(user.userId,row.termStudentId,body,`source80-cg-v2-${action}-${row.studentCode}-${index}`,action);current={...current,revision:saved.revision};
         }
         const v=await s.detail(user.userId,row.termStudentId,termId,row.committeeId);assert.equal(v.state,"FINALIZED");grades.push({lecturerId:member.lecturerId,userId:user.userId,role:member.role,revision:v.revision,score:v.score.totalScore});
       }
       results.push({...row,stage:"COMMITTEE_GRADES_FINALIZED",committeeGrades:grades});console.log("Committee grade sets in transaction: "+results.length+"/12");
     }assert.equal(results.length,12);return results;
   },{timeout:3600000});save("committee-grades-report.json",{termId,datasetId:c.dataset.datasetId,origin:"GENERATED_WORKFLOW",students:12,gradeSheets:48,results,verifiedAt:new Date().toISOString()});return;
 }
 if(stage==="final-results"){
   const source=read("committee-grades-report.json");
   const results=await c.once("final-results-accelerated-batch-v2",{origin:"GENERATED_RESULT"},async(tx,db)=>{
     const s=runtime(db,tx,termId,"finalResults"),results=[];
     for(const row of source.results.filter(r=>has(r,"result-finalized"))){
       let current=await s.detail(c.faculty.userId,row.termStudentId,termId);assert.ok(current.calculation,"Result source blockers: "+JSON.stringify(current.blockers));
       const command=async(action,actor,key)=>{const saved=await s.command(actor,row.termStudentId,shared.FinalResultCommandSchema.parse({termId,expectedRevision:current.revision,policyHash:current.policyHash,evidenceHash:current.evidenceHash,reason:"[KẾT QUẢ TỔNG HỢP] "+action+" để kiểm tra giao diện."}),`source80-fr-v2-${key}-${row.studentCode}`,action);current={...current,revision:saved.revision};return saved;};
       for(const role of ["CHAIR","SECRETARY"]){const actor=row.committeeGrades.find(g=>g.role===role)?.userId;assert.ok(actor);await command("confirm",actor,role);}
       await command("finalize",c.faculty.userId,"finalize");if(has(row,"result-published"))await command("publish",c.faculty.userId,"publish");
       const v=await s.detail(c.faculty.userId,row.termStudentId,termId),expected=has(row,"result-published")?"PUBLISHED":"FINALIZED";assert.equal(v.state,expected);
       if(expected==="PUBLISHED"){const student=await s.detail(row.userId,row.termStudentId,termId);assert.equal(student.state,"PUBLISHED");assert.equal(student.calculation.finalScore,v.savedCalculation.finalScore);assert.equal(student.savedCalculation,null);}
       results.push({...row,stage:expected,resultRevision:v.revision,calculation:v.savedCalculation});console.log("Final results in transaction: "+results.length+"/8");
     }assert.equal(results.length,8);return results;
   },{timeout:3600000});save("final-results-report.json",{termId,datasetId:c.dataset.datasetId,origin:"GENERATED_WORKFLOW",finalized:8,published:4,results,verifiedAt:new Date().toISOString()});
 }
 if(stage==="reports"){
   const source=read("final-results-report.json"),sample=source.results.find(r=>r.stage==="PUBLISHED");assert.ok(sample);
   const templates=read("policy-approval.private.json").policies.UC25_POLICY.templates;
   const dir=path.join(outputDir,"exports");fs.mkdirSync(dir,{recursive:true});
   const results=[];
   for(let offset=0;offset<templates.length;offset+=4){const group=templates.slice(offset,offset+4);
    const committed=await c.once("reports-accelerated-group-v3-"+offset,{origin:"GENERATED_REPORT",templates:group.map(t=>t.code)},async(tx,db)=>{
     const s=runtime(db,tx,termId,"reports"),batch=[];
     for(const t of group){
       const isCommittee=["XLSX_COMMITTEES","PDF_COMMITTEE"].includes(t.code),request=shared.ReportPreviewSchema.parse({filters:{termId,...(isCommittee?{committeeId:sample.committeeId}:{termStudentId:sample.termStudentId})},templateCode:t.code,templateVersion:t.version,mode:"OFFICIAL"});
       console.log("Report preview: "+t.code);const preview=await bounded(s.preview(c.faculty.userId,request),t.code+":preview");assert.ok(preview.canExport,"Report blockers: "+preview.blockers.join(","));
       console.log("Report export: "+t.code);const metadata=await bounded(s.export(c.faculty.userId,shared.ReportExportSchema.parse({...request,expectedSnapshotHash:preview.snapshotHash}),"source80-report-v3-"+t.code),t.code+":export");
       console.log("Report download: "+t.code);const download=await bounded(s.download(c.faculty.userId,metadata.id,"source80-report-download-v3-"+t.code),t.code+":download"),hash=crypto.createHash("sha256").update(download.bytes).digest("hex");assert.equal(hash,metadata.fileHash);assert.equal(metadata.signatureStatus,"UNSIGNED");assert.equal(metadata.status,"GENERATED");
       // Files are evidence only; the committed DB marker determines completion.
       fs.writeFileSync(path.join(dir,download.filename),download.bytes);batch.push({templateCode:t.code,exportId:metadata.id,filename:download.filename,sha256:hash,sizeBytes:download.bytes.length,signatureStatus:metadata.signatureStatus});
     }assert.equal(batch.length,group.length);return batch;
    },{timeout:900000});results.push(...committed);save("report-exports-checkpoint.json",{termId,datasetId:c.dataset.datasetId,results,verifiedAt:new Date().toISOString()});console.log("Committed reports: "+results.length+"/15");
   }assert.equal(results.length,15);save("report-exports-report.json",{termId,datasetId:c.dataset.datasetId,origin:"GENERATED_WORKFLOW",exports:15,results,verifiedAt:new Date().toISOString()});
 }
}finally{await c.db.$disconnect();}}
if(require.main===module)main().catch(safeError);
