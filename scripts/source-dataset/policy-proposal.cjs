"use strict";
// Local preparation only. No database connection, approval record or write flag.
const path=require("node:path"),assert=require("node:assert/strict");
const {req,dist,root,read,save,safeError}=require("./context.cjs");
const {markerId}=require("./import-students.cjs");
function buildProposal({datasetId,termId,endAt,date,departmentIds}){
  const version="NGUON80-SYNTHETIC-v1",reference="Cấu hình đề xuất cho lịch sử tổng hợp NGUON80; không phải quyết định học vụ hoặc điểm thật.";
  const meta={version,status:"DRAFT",approvedBy:null,approvedAt:null},ref={...meta,reference};
  const start=new Date(date+"T00:00:00+07:00").toISOString(),rounding={mode:"HALF_UP",decimalPlaces:2};
  assert.ok(Date.parse(start)<Date.parse(endAt));
  const rooms=Array.from({length:3},(_,i)=>({id:markerId(datasetId,"room:"+(i+1)),code:`NGUON80-P${i+1}`,name:`Phòng tổng hợp nguồn 80 — ${i+1}`,capacity:40,location:"Phòng mô phỏng, không xác nhận địa điểm thật"}));
  const criteria=[['Nội dung và phân tích','0.30'],['Thiết kế và triển khai','0.30'],['Kiểm thử và kết quả','0.20'],['Trình bày và trả lời','0.20']].map(([name,weight],i)=>({id:markerId(datasetId,"rubric:"+i),name,description:"Tiêu chí đề xuất cho dữ liệu tổng hợp; chưa có quyết định học vụ.",minScore:"0",maxScore:"10",step:"0.1",weight,required:true}));
  const {reportNames,defaultColumns,resultReport}=require(path.join(root,"backend/dist/report/defense-reporting/report-templates.js"));
  const shared=req("@doan/shared");
  const templates=shared.ReportCodeSchema.options.map(code=>({code,version,name:"[TỔNG HỢP] "+reportNames[code],format:code.startsWith("XLSX_")?"XLSX":"PDF",engineVersion:"UC25_V1",owner:"Khoa — bộ dữ liệu nguồn 80",status:"DRAFT",approval:null,effectiveFrom:start,effectiveUntil:endAt,roles:["FACULTY","LECTURER"],columns:defaultColumns(code),draftAllowed:true,requirePublished:resultReport(code),allowMissing:code==="PDF_MINUTES"?["CONCLUSION","DEFENSE_REMARKS","REVISION_REQUESTS"]:[],signatureRoles:[],institution:{school:"BỘ DỮ LIỆU NGUỒN 80 — LỊCH SỬ TỔNG HỢP",faculty:"Khoa quản lý bộ dữ liệu nguồn 80"},dossierTemplateVersion:code==="PDF_DOSSIER"?shared.DOSSIER_TEMPLATE_VERSION:null}));
  const policies={
    UC17_POLICY:{...meta,scoreStep:0.1,maxPdfBytes:20*1024*1024,replacementAfterDecision:"BLOCK",rubric:null},
    UC18_POLICY:{...meta,phaseCode:"FINAL",progressRule:"ALL_ACTIVE_TASKS_PASSED",academicSources:[{key:"SOURCE80_ACADEMIC",label:"Điều kiện học vụ tổng hợp theo xác nhận của người dùng",mode:"FACULTY_ATTESTATION"}]},
    UC19_POLICY:{...ref,phaseCode:"FINAL",chairCount:1,secretaryCount:1,distinctOfficers:true,allowEmptyFinalization:false,memberScope:"TERM_ROSTER",studentScope:"SAME_DEPARTMENT",allowedTitleIds:null,maxCommitteesPerLecturer:3,maxStudentsPerCommittee:12,maxStudentsPerLecturer:24},
    UC20_POLICY:{...ref,phaseCode:"FINAL",reviewersPerStudent:1,maxReviewsPerLecturer:10,maxTotalStudentDuties:40,totalLoadRule:"ADVISOR_PLUS_COMMITTEE_PLUS_REVIEW",departmentRule:"CROSS_DEPARTMENT",allowedTitleIds:null,expertiseRule:"REQUIRED_AREA_MATCH",committeeMembership:"ALLOW",formerAdvisorRule:"FORBID"},
    UC21_POLICY:{...ref,phaseCode:"DEFENSE",timezone:"Asia/Ho_Chi_Minh",allowedDates:[date],periods:{MORNING:{start:"07:30",end:"11:30",breaks:[]},AFTERNOON:{start:"13:30",end:"17:30",breaks:[]}},durationMin:25,bufferMin:5,sessionBufferMin:15,startStepMin:5,maxStudentsPerSession:8,minRoomCapacity:30,roomAccess:rooms.map(r=>({roomId:r.id,departmentIds})),reviewerAttendance:"NOT_REQUIRED",nameRule:"LAST_TOKEN_MIDDLE_THEN_FAMILY",compoundFamilyNames:[],manualOrderAllowed:false,studentVisibility:true,lecturerVisibility:true,advisorCanView:true,publishNotBefore:start,crossTermConflicts:"ALL_TERMS",legacyRule:"BLOCK_SHARED_RESOURCES_UNTIL_RECONCILED"},
    UC22_POLICY:{...ref,phaseCode:"DEFENSE",scoreStep:"0.1",draftAllowed:true,requiredFeedback:["comment","strengths","weaknesses","questions"],minimumQuestions:2,sourceChange:"BLOCK",afterFinalize:"IMMUTABLE",studentRelease:"WITHHELD",schedule:{required:true,requirePublished:true,window:null},rubric:null},
    UC23_POLICY:{...ref,effectiveFrom:start,effectiveUntil:endAt,effectiveScope:"GRADING_WINDOW",phaseCode:"DEFENSE",gradingRoles:["CHAIR","SECRETARY","MEMBER"],draftAllowed:true,commentRequired:true,sourceChange:"BLOCK",afterFinalize:"IMMUTABLE",studentRelease:"WITHHELD",schedule:{required:true,requirePublished:true,anchor:"SESSION"},defenseEvidence:"NOT_REQUIRED",rubric:{version,calculation:"WEIGHTED_NORMALIZED_10",missingOptional:"BLOCK",rounding,totalStep:"0.01",criteria}},
    UC24_POLICY:{...ref,formula:"WEIGHTED_SUM",advisorSource:"UC17_OFFICIAL_SUMMARY",components:[{source:"ADVISOR_UC17",weight:"0.20"},{source:"REVIEWER",weight:"0.20"},{source:"COMMITTEE",weight:"0.60"}],reviewerAggregate:{mode:"MEAN",rounding},committeeAggregate:{mode:"MEAN",rounding},finalRounding:rounding,finalStep:"0.01",storageDecimalPlaces:2,passRule:{minimumFinal:"5",minimumComponents:[]},classifications:[],confirmation:{scope:"STUDENT",rule:"ONE_PER_ROLE",roles:["CHAIR","SECRETARY"],distinctActors:true,reasonRequired:true},separation:{finalizerNotConfirmer:true,publisherNotFinalizer:false},finalizeWindow:{phaseCode:"DEFENSE",notBefore:start,before:endAt},publication:{phaseCode:"DEFENSE",notBefore:start,before:endAt,studentFinal:true,studentComponents:true},sourceChange:"BLOCK",afterFinalize:"IMMUTABLE",sourceLock:"PRESERVE_PRODUCER_LOCKS"},
    UC25_POLICY:{...ref,memberResults:"EXPLICIT_RESULT_PERMISSION",statisticsRelease:"PUBLISHED_ONLY",incompleteDraft:true,retentionDays:365,distribution:[],templates,signature:"UNSIGNED_ONLY"},
  };
  return {kind:"SOURCE80_POLICY_PROPOSAL_NOT_APPROVED",datasetId,termId,purpose:"SYNTHETIC_WORKFLOW_ON_SHARED_DATABASE",approval:null,proposedDefenseStart:start,proposedDefenseEnd:endAt,rooms,rubricCatalog:criteria.map(({id,name,description,maxScore,weight})=>({id,termId,name,description,maxScore,weight})),policies};
}
function validateDraft(draft){
  const PolicySetSchema=dist("defense/policies/policy-release.js","PolicySetSchema");
  const result=PolicySetSchema.safeParse(draft.policies);
  assert.equal(result.success,false,"Unapproved draft must not pass runtime contract");
  // Only missing approval metadata is permitted. Content errors remain blockers.
  const errors=result.error.issues.filter(i=>!(["status","approvedBy","approvedAt"].includes(i.path[1])||i.path[0]==="UC25_POLICY"&&i.message==="Template approval/format missing"));
  assert.deepEqual(errors.map(i=>({path:i.path,message:i.message})),[]);
  return {runtimeAccepted:false,contentContractValid:true,approvalMissing:true};
}
function main(){
  const foundation=read("foundation-report.json"),status=read("workflow-status.json"),routing=read("routing-report.json");
  const index=process.argv.indexOf("--defense-date");assert.ok(index>=0,"Specify proposed local defense date YYYY-MM-DD");const date=process.argv[index+1];assert.ok(req("@doan/shared").DefenseDateSchema.safeParse(date).success);
  const endAt=status.term.phases.find(p=>p.code==="DEFENSE").endDate;
  const proposal=buildProposal({datasetId:foundation.datasetId,termId:foundation.termId,endAt,date,departmentIds:[...new Set(routing.results.map(r=>r.departmentId))]});
  const verification=validateDraft(proposal),hash=dist("defense/policies/policy-release.js","policyReleaseHash")(proposal);
  save("policy-proposal.json",{...proposal,contentHash:hash,verification});console.log(JSON.stringify({operation:"LOCAL_PREPARATION_ONLY",termId:proposal.termId,contentHash:hash,date,policies:9,rooms:3,criteria:4,templates:15,...verification}));
}
module.exports={buildProposal,validateDraft};
if(require.main===module){try{main();}catch(error){safeError(error);}}
