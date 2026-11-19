"use strict";
const assert=require("node:assert/strict");
const {context,dist,req,read,save,safeError}=require("./context.cjs");
const {advance,termService}=require("./assignment.cjs");
function contentFor(scenario,term){
  const start=+new Date(term.startDate),end=+new Date(term.endDate),at=n=>new Date(start+(end-start)*n/4).toISOString();
  return {schemaVersion:1,
    objectives:`[NỘI DUNG TỔNG HỢP] Phân tích yêu cầu, thiết kế, triển khai và kiểm chứng: ${scenario.topic.text}`,
    scope:"[NỘI DUNG TỔNG HỢP] Hồ sơ dùng kiểm tra giao diện hệ thống; khảo sát luồng người dùng, quản lý dữ liệu, phân quyền và báo cáo. Không phải đề cương đã được sinh viên thực tế viết.",
    mainContents:"Khảo sát bài toán; xác định yêu cầu chức năng và phi chức năng; mô hình hóa dữ liệu; thiết kế giao diện; xây dựng các chức năng; kiểm thử luồng nghiệp vụ và đánh giá kết quả.",
    tools:"Công nghệ, công cụ và dữ liệu được chọn khi triển khai; Git quản lý phiên bản, sơ đồ thiết kế và bộ kiểm thử cho từng chức năng. Nội dung mô phỏng phục vụ đối chiếu UI.",
    expectedResults:"Sản phẩm phần mềm minh họa, tài liệu phân tích thiết kế, bộ kiểm thử và báo cáo tổng kết. Tất cả nội dung mô tả này được sinh cho kịch bản kiểm tra.",
    startsAt:at(0),endsAt:at(4),schedule:["Khảo sát và phân tích","Thiết kế hệ thống","Triển khai chức năng","Kiểm thử và báo cáo"].map((label,i)=>({label,startsAt:at(i),endsAt:at(i+1),deliverables:`[TỔNG HỢP] Minh chứng ${label.toLowerCase()} cho hồ sơ ${scenario.studentCode}`}))};
}
async function main(){const c=await context();try{
  const {termId}=read("assignment-report.json"),plan=read("workflow-plan.json"),registrations=read("registration-report.json"),assignments=read("assignment-report.json");
  assert.equal(read("routing-report.json").results.length,7);
  await c.once("term-in-progress",{targetStatus:"IN_PROGRESS"},async(tx,db)=>{
    const current=await tx.thesisTerm.findUnique({where:{id:termId},select:{status:true}});assert.ok(current);
    // Publishing assignments already advances the term in the existing service.
    if(current.status!=="IN_PROGRESS")await termService(db).transition(termId,"IN_PROGRESS",c.faculty.userId);
    return {status:"IN_PROGRESS",alreadyAdvancedByPublication:current.status==="IN_PROGRESS"};
  });
  await advance(c,termId,"PROPOSAL");
  const term=await c.db.thesisTerm.findUnique({where:{id:termId}});
  const AR=dist("registration/repository/assignment.repository.js","AssignmentRepository"),TR=dist("term/repository/term.repository.js","TermRepository"),Window=dist("term/service/term-window.service.js","TermWindowService"),Repo=dist("topic/repository/topic.repository.js","TopicRepository"),Topic=dist("topic/service/topic.service.js","TopicService");
  const VR=dist("topic/proposal-versions/proposal-version.repository.js","ProposalVersionRepository"),VS=dist("topic/proposal-versions/proposal-version.service.js","ProposalVersionService"),VV=dist("topic/proposal-versions/proposal-version.validator.js","ProposalVersionValidator"),RV=dist("topic/proposal-reviews/proposal-review.validator.js","ProposalReviewValidator");
  const topic=db=>new Topic(new AR(db),new Repo(db),new Window(new TR(db))),version=db=>new VS(new VR(db),new VV(new RV()),new RV());
  const shared=req("@doan/shared"),legacySchema=require("../../backend/dist/topic/dto/proposal.dto.js").proposalContent;
  const results=[];
  for(const scenario of plan.scenarios.filter(s=>s.actionKeys.includes("topic-submit"))){
    const student=registrations.results.find(r=>r.studentCode===scenario.studentCode),assignment=assignments.assignments.find(a=>a.studentId===student.studentId);assert.ok(assignment);
    const advisor=await c.db.lecturer.findUnique({where:{id:assignment.lecturerId},select:{userId:true}});assert.ok(advisor);
    const content=shared.SubmittedProposalContentSchema.parse(contentFor(scenario,term));
    const legacy=legacySchema.parse({title:scenario.topic.text,objectives:content.objectives,scope:content.scope,technology:content.tools,expected:content.expectedResults,plan:content.schedule.map((s,i)=>({week:`Giai đoạn ${i+1}`,content:s.label}))});
    const draft=await c.once("topic-draft:"+scenario.studentCode,{origin:scenario.topic.origin,contentOrigin:"GENERATED_WORKFLOW"},async(tx,db)=>topic(db).save(termId,student.studentId,student.userId,{content:legacy,expectedVersion:0},false));
    let outcome={studentCode:scenario.studentCode,studentId:student.studentId,userId:student.userId,advisorId:assignment.lecturerId,advisorUserId:advisor.userId,proposalId:draft.id,stage:"TOPIC_AWAITING_ADVISOR",group:scenario.group};
    if(scenario.actionKeys.includes("proposal-draft")){
      await c.once("topic-agree:"+scenario.studentCode,{origin:"GENERATED_ADVISOR_ACTION"},async(tx,db)=>topic(db).agree(draft.id,advisor.userId,true,draft.versions.at(-1).version));
      await c.once("topic-handoff:"+scenario.studentCode,{origin:"GENERATED_WORKFLOW"},async(tx,db)=>topic(db).prepareWorkflow(draft.id,student.userId));
      const saved=await c.once("proposal-version:"+scenario.studentCode,{origin:"GENERATED_PROPOSAL_CONTENT"},async(tx,db)=>{
        const w=await tx.proposalWorkflow.findUnique({where:{proposalId:draft.id}});assert.ok(w);
        const input=shared.ProposalVersionSaveSchema.parse({expectedRevision:w.revision,basedOnVersionId:w.workingVersionId,content,changeSummary:"[TỔNG HỢP] Hoàn thiện đề cương phục vụ kiểm tra giao diện.",responses:[]});
        return version(db).save(student.userId,draft.id,input,"source80-version-"+scenario.studentCode);
      });
      outcome={...outcome,stage:"PROPOSAL_DRAFT",versionId:saved.id,proposalRevision:saved.proposalRevision};
      if(scenario.actionKeys.includes("proposal-review")){
        const submitted=await c.once("proposal-submit:"+scenario.studentCode,{origin:"GENERATED_STUDENT_ACTION"},async(tx,db)=>version(db).submit(student.userId,draft.id,shared.ProposalVersionSubmitSchema.parse({expectedRevision:saved.proposalRevision,versionId:saved.id}),"source80-submit-"+scenario.studentCode));
        outcome={...outcome,stage:"PROPOSAL_SUBMITTED",proposalRevision:submitted.proposalRevision};
      }
    }
    results.push(outcome);save("topics-checkpoint.json",{termId,results});
    if(results.length%4===0)console.log(`Topics verified: ${results.length}/68`);
  }
  const count=await c.db.proposal.count({where:{termId}});assert.equal(count,68);
  const report={termId,datasetId:c.dataset.datasetId,origin:"GENERATED_WORKFLOW",topics:68,awaitingAdvisor:4,versionDrafts:4,submitted:60,results,verifiedAt:new Date().toISOString()};
  save("topics-report.json",report);console.log(JSON.stringify({...report,results:undefined}));
}finally{await c.db.$disconnect();}}
module.exports={contentFor};
if(require.main===module)main().catch(safeError);
