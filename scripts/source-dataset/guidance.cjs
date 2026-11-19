"use strict";
const assert=require("node:assert/strict");
const {context,req,read,save,safeError}=require("./context.cjs"),{advance}=require("./assignment.cjs"),{runtime}=require("./guidance-runtime.cjs"),{sourceZip,reportPdf}=require("./workflow-assets.cjs");
async function main(){const c=await context();try{
  const dossiers=read("dossiers-report.json"),{termId}=dossiers,plan=read("workflow-plan.json"),shared=req("@doan/shared");
  await advance(c,termId,"WEEKLY");
  const period=await c.once("weekly-period-v1",{origin:"GENERATED_WEEKLY_PLAN"},async(tx,db)=>{
    const phase=await tx.termPhase.findFirst({where:{termId,code:"WEEKLY"}});assert.ok(phase);
    const startsAt=phase.startDate.toISOString(),endsAt=new Date(+phase.startDate+7*86400000).toISOString(),reportDueAt=new Date(+phase.startDate+6*86400000).toISOString();
    const s=runtime(db).weekly,created=await s.command(c.faculty.userId,termId,shared.WeeklyPlanCreateSchema.parse({ordinal:1,label:"Tuần 1 — dữ liệu tổng hợp",description:"[TỔNG HỢP] Tuần hướng dẫn để kiểm tra báo cáo, nộp file và nhận xét.",startsAt,endsAt,reportDueAt,expectedDeliverables:"Báo cáo PDF và gói ZIP minh họa, có nguồn tổng hợp rõ ràng.",allowLate:false}),"source80-week-create");
    return s.command(c.faculty.userId,termId,shared.WeeklyPlanStateSchema.parse({expectedRevision:created.revision,state:"OPEN",reason:"[TỔNG HỢP] Mở tuần để thực thi quy trình hướng dẫn."}),"source80-week-open",created.id,true);
  });
  const results=[];
  for(const row of dossiers.results.filter(r=>plan.scenarios.find(s=>s.studentCode===r.studentCode).actionKeys.includes("guidance-active"))){
    const scenario=plan.scenarios.find(s=>s.studentCode===row.studentCode),step=(key,fn)=>c.once(key+":"+row.studentCode,{origin:"GENERATED_WORKFLOW",studentCode:row.studentCode},fn);
    const guidancePlan=await step("guidance-plan",async(tx,db)=>runtime(db).guidance.createPlan(row.advisorUserId,row.proposalId,shared.GuidancePlanCreateSchema.parse({finalizationId:row.finalizationId,expectedDossierRevision:row.dossierRevision,description:"[KẾ HOẠCH TỔNG HỢP] Khảo sát, thiết kế, triển khai, kiểm thử và hoàn thiện báo cáo."}),"source80-guidance-plan-"+row.studentCode));
    const weekly=await step("weekly-task",async(tx,db)=>{
      const ts=await tx.termStudent.findUnique({where:{termId_studentId:{termId,studentId:row.studentId}}}),o=await tx.weeklyReportObligation.findUnique({where:{periodId_termStudentId:{periodId:period.id,termStudentId:ts.id}}});assert.ok(o);
      const s=runtime(db).guidance,p=await s.planByProposal(row.advisorUserId,row.proposalId);
      return s.ensureWeekly(row.advisorUserId,o.id,shared.WeeklyTaskEnsureSchema.parse({expectedObligationRevision:o.revision,expectedPlanRevision:p.revision}),"source80-weekly-task-"+row.studentCode);
    });
    await step("guidance-meeting",async(tx,db)=>{const s=runtime(db),p=await s.guidance.planByProposal(row.advisorUserId,row.proposalId);return s.progress.meetingCommand(row.advisorUserId,p.id,shared.GuidanceMeetingCreateSchema.parse({expectedPlanRevision:p.revision,occurredAt:new Date().toISOString(),mode:"ONLINE",location:"Buổi hướng dẫn mô phỏng trong bộ dữ liệu nguồn 80",discussion:"[TỔNG HỢP] Trao đổi phạm vi đề tài, dữ liệu đầu vào và kế hoạch kiểm thử.",conclusion:"[TỔNG HỢP] Hoàn thiện báo cáo tuần và bổ sung minh chứng kiểm thử."}),"source80-meeting-"+row.studentCode);});
    let task=await step("task-progress",async(tx,db)=>{const s=runtime(db).guidance,t=await s.detailTask(row.userId,weekly.id);return s.progressTask(row.userId,t.id,shared.GuidanceTaskProgressSchema.parse({expectedRevision:t.revision,note:"[TIẾN ĐỘ TỔNG HỢP] Đã khảo sát yêu cầu và phác thảo mô hình dữ liệu; đang hoàn thiện báo cáo tuần."}),"source80-progress-"+row.studentCode);});
    let outcome={...row,planId:guidancePlan.id,taskId:task.id,stage:"GUIDANCE_IN_PROGRESS"};
    if(scenario.actionKeys.includes("submission-pending")){
      const report=shared.WeeklyReportSubmitSchema.parse({assignedWork:"[TỔNG HỢP] Phân tích yêu cầu và thiết kế dữ liệu.",completedWork:"Đã mô tả luồng chính và các tình huống kiểm thử minh họa.",results:"Báo cáo PDF và gói tài liệu ZIP sinh cho kiểm tra giao diện.",unfinishedWork:"",unfinishedReason:"",difficulties:"Cần rà soát mức độ đầy đủ của yêu cầu.",solutions:"Đối chiếu từng luồng với tiêu chí nghiệm thu.",nextWork:"Hoàn thiện chức năng và bổ sung minh chứng kiểm thử.",notes:"Không phải báo cáo về công việc thực tế của sinh viên."});
      await step("weekly-draft",async(tx,db)=>{const s=runtime(db).submissions,ctx=await s.context(row.userId,task.id);return s.saveDraft(row.userId,task.id,shared.WeeklyReportDraftSchema.parse({expectedDraftRevision:ctx.draftRevision||0,report,content:"[TỔNG HỢP] Báo cáo tuần đầu tiên."}),"source80-draft-"+row.studentCode);});
      const uploads=[];
      for(const kind of ["REPORT","SOURCE"]){
        const bytes=kind==="REPORT"?await reportPdf(row.studentCode):sourceZip(row.studentCode),ext=kind==="REPORT"?"pdf":"zip";
        uploads.push(await step("upload-"+kind,async(tx,db)=>runtime(db).submissions.stage(row.userId,task.id,kind,{originalname:`tong-hop-${row.studentCode}.${ext}`,mimetype:kind==="REPORT"?"application/pdf":"application/zip",size:bytes.length,buffer:bytes},"source80-upload-"+kind+"-"+row.studentCode)));
      }
      const submission=await step("weekly-submit",async(tx,db)=>{const s=runtime(db).submissions,ctx=await s.context(row.userId,task.id);return s.submit(row.userId,task.id,shared.TaskSubmissionCreateSchema.parse({expectedTaskRevision:ctx.taskRevision,uploadIds:uploads.map(u=>u.id),report,content:"[BÁO CÁO TỔNG HỢP] Nộp báo cáo cùng PDF/ZIP thực có checksum."}),"source80-weekly-submit-"+row.studentCode);});
      outcome={...outcome,submissionId:submission.id,stage:"SUBMISSION_PENDING"};
      if(scenario.actionKeys.includes("progress-reviewed")){
        const result=await step("progress-review",async(tx,db)=>{const s=runtime(db).progress,ctx=await s.context(row.advisorUserId,submission.id);return s.record(row.advisorUserId,submission.id,shared.ProgressReviewCreateSchema.parse({expectedTaskRevision:ctx.taskRevision,expectedSubmissionRevision:ctx.submission.revision,decision:"PASS",comment:"[NHẬN XÉT TỔNG HỢP] Báo cáo đủ các mục minh họa; tiếp tục triển khai và ghi lại minh chứng kiểm thử."}),"source80-review-progress-"+row.studentCode);});
        assert.equal(result.decision,"PASS");outcome={...outcome,progressReviewId:result.id,stage:"PROGRESS_REVIEWED"};
      }
      for(const file of submission.files){const actual=await runtime(c.db).submissions.download(row.userId,submission.id,file.id);assert.ok(actual,"Download must remain available through owner scope");}
    }
    results.push(outcome);save("guidance-checkpoint.json",{termId,results});console.log(`Guidance verified: ${results.length}/44`);
  }
  assert.equal(results.length,44);const report={termId,datasetId:c.dataset.datasetId,origin:"GENERATED_WORKFLOW",periodId:period.id,plans:44,inProgress:4,pending:4,reviewed:36,results,verifiedAt:new Date().toISOString()};save("guidance-report.json",report);console.log(JSON.stringify({...report,results:undefined}));
}finally{await c.db.$disconnect();}}
if(require.main===module)main().catch(safeError);
