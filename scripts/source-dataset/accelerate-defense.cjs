"use strict";
// Version the unused downstream policies for the user's revised test-data brief.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {context,dist,read,save,outputDir,safeError}=require("./context.cjs"),{termService}=require("./assignment.cjs");
const request="tôi bảo bạn làm dữ liệu test cơ mà thì phải cho thời gian trôi qua hết thì mới có dữ liệu ở nhữ bước sau chứ với lại với lại mục đề tài đề cương thì đang có quá nhiều người làm đề tài Xây dựng hệ thống quản lý học tập và tiến độ đồ án sửa cho khác nhau đi với lại điều chỉnh thời gian để tất cả các bước đều có dữ liệu để tôi đánh giá";
async function main(){const c=await context();try{
 const {termId}=read("foundation-report.json"),previous=read("policy-approval.private.json"),release=read("policy-release-report.json"),hash=dist("defense/policies/policy-release.js","policyReleaseHash");
 const result=await c.once("accelerated-defense-calendar-v2",{origin:"EXPLICIT_USER_REVISED_TEST_DATA_REQUEST",request,academicDecision:false},async(tx,db)=>{
   assert.equal(previous.contentHash,release.contentHash);
   const term=await tx.thesisTerm.findUnique({where:{id:termId},include:{phases:true}});assert.equal(term.code,"NGUON80-2026");assert.equal(term.status,"IN_PROGRESS");
   assert.equal(await tx.defenseSession.count({where:{committee:{termId}}}),0,"Revise schedule policies before creating defense sessions");
   const proposalIds=(await tx.proposal.findMany({where:{termId},select:{id:true}})).map(r=>r.id);
   assert.equal(await tx.finalResult.count({where:{proposalId:{in:proposalIds}}}),0);
   const stored=await tx.termParameter.findMany({where:{termId,key:{in:Object.keys(previous.policies)}}});assert.equal(stored.length,9);
   for(const r of stored)assert.equal(hash(JSON.parse(r.value)),hash(previous.policies[r.key]));
   const now=new Date(),boundary=new Date(+now-120000),local=new Date(+now+7*3600000),date=local.toISOString().slice(0,10);
   const latest=await tx.reviewerAssignment.findFirst({where:{termId,state:"FINALIZED"},orderBy:{finalizedAt:"desc"},select:{finalizedAt:true}});assert.ok(latest?.finalizedAt<boundary);
   const phases=term.phases.map(p=>({id:p.id,code:p.code,name:p.phaseName,start:p.startDate.toISOString(),end:p.endDate.toISOString(),locked:p.isLocked}));
   const final=phases.find(p=>p.code==="FINAL"),defense=phases.find(p=>p.code==="DEFENSE");assert.ok(Date.parse(final.start)<+boundary);final.end=boundary.toISOString();defense.start=final.end;
   await termService(db).savePhases(termId,phases,c.faculty.userId,"[DỮ LIỆU TEST TỔNG HỢP] Người dùng yêu cầu rút ngắn lịch để có dữ liệu mọi bước ngay; kết thúc FINAL sau thao tác cuối, mở DEFENSE bằng thời gian thật.");
   const next=structuredClone(previous.policies),reference="Người dùng yêu cầu rút lịch dữ liệu test về hiện tại để đánh giá tất cả các bước; không phải quyết định hoặc điểm học vụ thật.";
   const fourth={id:crypto.randomUUID(),code:"NGUON80-PHONG04",name:"Phòng bảo vệ mô phỏng 04 — dữ liệu tổng hợp",capacity:40};
   await tx.room.create({data:fourth});
   Object.assign(next.UC21_POLICY,{allowedDates:[date],periods:{MORNING:{start:"00:00",end:"12:00",breaks:[]},AFTERNOON:{start:"12:00",end:"23:59",breaks:[]}},durationMin:10,bufferMin:5,publishNotBefore:boundary.toISOString(),roomAccess:[...next.UC21_POLICY.roomAccess,{roomId:fourth.id,departmentIds:next.UC21_POLICY.roomAccess[0].departmentIds}]});
   Object.assign(next.UC23_POLICY,{effectiveFrom:boundary.toISOString()});
   Object.assign(next.UC24_POLICY.finalizeWindow,{notBefore:boundary.toISOString()});Object.assign(next.UC24_POLICY.publication,{notBefore:boundary.toISOString()});
   for(const key of ["UC21_POLICY","UC23_POLICY","UC24_POLICY"]){const old=previous.policies[key];Object.assign(next[key],{version:"NGUON80-SYNTHETIC-ACCELERATED-v2",approvedAt:now.toISOString(),approvedBy:c.faculty.userId,reference});
     // Each rubric keeps its own catalog version; academic weights are unchanged.
     const row=stored.find(r=>r.key===key),changed=await tx.termParameter.updateMany({where:{id:row.id,value:row.value},data:{value:JSON.stringify(next[key])}});assert.equal(changed.count,1);
     await tx.auditLog.create({data:{userId:c.faculty.userId,action:"SOURCE_DATASET_POLICY_VERSIONED",resource:"term-policy",resourceId:termId+":"+key,oldValue:old,newValue:{policy:next[key],userRequest:request,origin:"USER_REVISED_TEST_DATA_CALENDAR",academicDecision:false}}});
   }
   dist("defense/policies/policy-release.js","PolicySetSchema").parse(next);
   for(const key of ["UC17_POLICY","UC18_POLICY","UC19_POLICY","UC20_POLICY","UC22_POLICY","UC25_POLICY"])assert.equal(hash(next[key]),hash(previous.policies[key]));
   return {termId,date,phases,policies:next,approvedAt:now.toISOString(),contentHash:hash({termId,policies:next}),previousContentHash:previous.contentHash,room:fourth,request};
 });
 for(const file of ["policy-approval.private.json","policy-release-report.json"]){const archive=path.join(outputDir,file.replace(/\.json$/,".before-accelerated-v2.json"));if(!fs.existsSync(archive))fs.copyFileSync(path.join(outputDir,file),archive,fs.constants.COPYFILE_EXCL);}
 save("policy-approval.private.json",{...previous,contentHash:result.contentHash,policies:result.policies,approvedAt:result.approvedAt,recordedAt:result.approvedAt,confirmationId:"USER_REVISED_TEST_DATA_REQUEST_2026_11_18",confirmedText:request,supersedesContentHash:result.previousContentHash,academicDecision:false});
 save("policy-release-report.json",{...release,contentHash:result.contentHash,rooms:4,versionedCalendar:true,verifiedAt:new Date().toISOString()});
 save("accelerated-defense-report.json",{...result,origin:"USER_REQUESTED_TEST_DATA",academicDecision:false,verifiedAt:new Date().toISOString()});
  console.log(JSON.stringify({termId,date:result.date,defenseStart:result.phases.find(p=>p.code==="DEFENSE").start,rooms:4,slotMinutes:10,bufferMinutes:5,policiesChanged:[21,23,24]}));
}finally{await c.db.$disconnect();}}
if(require.main===module)main().catch(safeError);
