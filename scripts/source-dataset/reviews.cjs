"use strict";
const assert=require("node:assert/strict");
const {context,dist,req,read,save,safeError}=require("./context.cjs");
async function main(){const c=await context();try{
  const topics=read("topics-report.json"),{termId}=topics,plan=read("workflow-plan.json"),routing=read("routing-report.json").results;
  const shared=req("@doan/shared"),GR=dist("topic/review-groups/review-group.repository.js","ReviewGroupRepository"),GS=dist("topic/review-groups/review-group.service.js","ReviewGroupService"),GV=dist("topic/review-groups/review-group.validator.js","ReviewGroupValidator");
  const RR=dist("topic/proposal-reviews/proposal-review.repository.js","ProposalReviewRepository"),RS=dist("topic/proposal-reviews/proposal-review.service.js","ProposalReviewService"),RV=dist("topic/proposal-reviews/proposal-review.validator.js","ProposalReviewValidator");
  const VR=dist("topic/proposal-versions/proposal-version.repository.js","ProposalVersionRepository"),VS=dist("topic/proposal-versions/proposal-version.service.js","ProposalVersionService"),VV=dist("topic/proposal-versions/proposal-version.validator.js","ProposalVersionValidator");
  const review=db=>new RS(new RR(db),new RV()),versions=db=>new VS(new VR(db),new VV(new RV()),new RV());
  const lecturers=await c.db.lecturer.findMany({where:{termLecturers:{some:{termId}}},select:{id:true,userId:true,departmentId:true,lecturerCode:true},orderBy:{lecturerCode:"asc"}}),groups=[];
  for(const departmentId of [...new Set(routing.map(r=>r.departmentId))]){
    const members=lecturers.filter(l=>l.departmentId===departmentId).slice(0,3);assert.ok(members.length>=2);
    const code=routing.find(r=>r.departmentId===departmentId).departmentCode;
    const group=await c.once("review-group:"+code,{origin:"GENERATED_REVIEW_GROUP",departmentId},async(tx,db)=>{
      const body=shared.GroupCreateSchema.parse({name:`Nhóm duyệt nguồn 80 — ${code}`,departmentId,memberLecturerIds:members.map(m=>m.id)});
      return new GS(new GR(db),new GV()).mutate(c.faculty.userId,{termId},"create",body,"source80-group-"+code,`/terms/${termId}/review-groups`,"POST");
    });groups.push(group);
  }
  save("review-groups-report.json",{termId,groups});
  const results=[];
  for(const row of topics.results.filter(r=>r.stage==="PROPOSAL_SUBMITTED")){
    const scenario=plan.scenarios.find(s=>s.studentCode===row.studentCode),registration=read("registration-report.json").results.find(r=>r.studentCode===row.studentCode),departmentId=routing.find(r=>r.researchAreaId===registration.directionId).departmentId;
    const group=groups.find(g=>g.departmentId===departmentId),reviewer=lecturers.find(l=>group.members.some(m=>m.lecturerId===l.id)&&l.id!==row.advisorId);assert.ok(reviewer);
    const step=async(key,fn)=>c.once(key+":"+row.studentCode,{origin:"GENERATED_WORKFLOW",studentCode:row.studentCode,reviewerUserId:reviewer.userId},fn);
    const assignRound=async(n)=>step("review-assign-"+n,async(tx,db)=>{const w=await tx.proposalWorkflow.findUnique({where:{proposalId:row.proposalId}});return review(db).assign(c.faculty.userId,row.proposalId,shared.AssignReviewSchema.parse({groupId:group.id,proposalVersionId:w.submittedVersionId,expectedProposalRevision:w.revision}),`source80-assign-${n}-${row.studentCode}`);});
    const command=async(n,kind,record,extra={})=>step(`review-${kind}-${n}`,async(tx,db)=>{
      const current=await review(db).detail(reviewer.userId,record.id),body={expectedReviewRevision:current.revision,...(kind!=="comment"?{expectedProposalRevision:current.proposalRevision}:{}),...(kind!=="start"?{versionId:current.versionId}:{}),...extra};
      const schema=kind==="start"?shared.ReviewStartSchema:kind==="comment"?shared.ReviewCommentSchema:shared.ReviewDecisionSchema;
      return review(db).reviewCommand(reviewer.userId,record.id,kind,schema.parse(body),`source80-${kind}-${n}-${row.studentCode}`);
    });
    let current=await assignRound(1);current=await command(1,"start",current);
    current=await command(1,"comment",current,{text:"[NHẬN XÉT TỔNG HỢP] Cần làm rõ tiêu chí đánh giá kết quả và minh chứng kiểm thử trong kế hoạch. Nhận xét được sinh để kiểm tra giao diện và lịch sử phiên bản."});
    if(scenario.actionKeys.includes("proposal-revision")){
      current=await command(1,"decision",current,{decision:"REVISION_REQUIRED",comment:"[QUYẾT ĐỊNH TỔNG HỢP] Bổ sung tiêu chí đánh giá, sản phẩm bàn giao và minh chứng kiểm thử trước khi gửi lại."});
      if(scenario.actionKeys.includes("proposal-approved")){
        const saved=await step("proposal-revision-save",async(tx,db)=>{
          const w=await tx.proposalWorkflow.findUnique({where:{proposalId:row.proposalId}}),v=await tx.proposalVersion.findUnique({where:{id:w.submittedVersionId}});
          const content={...v.content,expectedResults:v.content.expectedResults+" Bản sửa tổng hợp bổ sung tiêu chí: hoàn tất các luồng chính, kiểm thử tình huống lỗi, ghi lại minh chứng từng kết quả."};
          const responses=[...current.comments.map(comment=>({targetType:"COMMENT",targetId:comment.id,text:"[PHẢN HỒI TỔNG HỢP] Đã bổ sung tiêu chí đánh giá và minh chứng kiểm thử vào kết quả dự kiến."})),{targetType:"DECISION",targetId:current.decision.id,text:"[PHẢN HỒI TỔNG HỢP] Đã cập nhật bản sửa và gửi lại để duyệt."}];
          return versions(db).save(row.userId,row.proposalId,shared.ProposalVersionSaveSchema.parse({expectedRevision:w.revision,basedOnVersionId:v.id,content,changeSummary:"[TỔNG HỢP] Sửa theo góp ý vòng 1.",responses}),"source80-revision-"+row.studentCode);
        });
        await step("proposal-resubmit",async(tx,db)=>versions(db).submit(row.userId,row.proposalId,shared.ProposalVersionSubmitSchema.parse({expectedRevision:saved.proposalRevision,versionId:saved.id}),"source80-resubmit-"+row.studentCode));
        current=await assignRound(2);current=await command(2,"start",current);
        current=await command(2,"decision",current,{decision:"APPROVED",comment:"[QUYẾT ĐỊNH TỔNG HỢP] Phiên bản đã bổ sung các nội dung theo góp ý. Phê duyệt mô phỏng phục vụ kiểm tra giao diện, không thay thế phê duyệt học vụ thật."});
      }
    }
    results.push({...row,reviewId:current.id,reviewerUserId:reviewer.userId,status:current.proposalStatus,versionId:current.versionId,proposalRevision:current.proposalRevision,decisionId:current.decision?.id||null});save("reviews-checkpoint.json",{termId,results});
    console.log(`Reviewed workflow: ${results.length}/60 (${current.proposalStatus})`);
  }
  assert.equal(results.filter(r=>r.status==="APPROVED").length,52);assert.equal(results.filter(r=>r.status==="REVISION_REQUESTED").length,4);assert.equal(results.filter(r=>r.status==="UNDER_REVIEW").length,4);
  const report={termId,datasetId:c.dataset.datasetId,origin:"GENERATED_WORKFLOW",underReview:4,revisionRequested:4,approved:52,results,verifiedAt:new Date().toISOString()};save("reviews-report.json",report);console.log(JSON.stringify({...report,results:undefined}));
}finally{await c.db.$disconnect();}}
if(require.main===module)main().catch(safeError);
