"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto");
const {context,req,read,save,safeError}=require("./context.cjs"),{defenseRuntime}=require("./defense-runtime.cjs"),{reportPdf}=require("./workflow-assets.cjs");
async function main(){const c=await context();try{
  const guidance=read("guidance-report.json"),{termId}=guidance,plan=read("workflow-plan.json"),shared=req("@doan/shared"),results=[];
  assert.equal(read("final-calendar-report.json").termId,termId);
  for(const row of guidance.results.filter(r=>plan.scenarios.find(s=>s.studentCode===r.studentCode).actionKeys.includes("final-report"))){
    assert.equal(row.stage,"PROGRESS_REVIEWED");const scenario=plan.scenarios.find(s=>s.studentCode===row.studentCode),step=(key,fn)=>c.once(key+":"+row.studentCode,{origin:"GENERATED_FINAL_WORKFLOW",studentCode:row.studentCode},fn);
    const bytes=await reportPdf(row.studentCode,"final");
    await step("final-report-upload",async(tx,db)=>{const s=defenseRuntime(db,termId).final,v=await s.detail(row.userId,row.proposalId);return s.upload(row.userId,row.proposalId,v.revision,{originalname:`bao-cao-cuoi-tong-hop-${row.studentCode}.pdf`,mimetype:"application/pdf",size:bytes.length,buffer:bytes},"source80-final-pdf-"+row.studentCode);});
    let stage="FINAL_REPORT_UPLOADED";
    if(scenario.actionKeys.includes("eligibility")){
      await step("advisor-final-summary",async(tx,db)=>{const s=defenseRuntime(db,termId).final,v=await s.detail(row.advisorUserId,row.proposalId);const score=7+Number(row.studentCode.slice(-2))%20/10;return s.summarize(row.advisorUserId,row.proposalId,shared.AdvisorSummarySchema.parse({expectedRevision:v.revision,reportVersionId:v.versions[0].id,score,criterionScores:{},comment:"[NHẬN XÉT VÀ ĐIỂM TỔNG HỢP] Báo cáo minh họa đủ nội dung; điểm sinh để kiểm tra quy trình, không phải kết quả học tập thật."}),"source80-final-summary-"+row.studentCode);});
      await step("advisor-final-confirm",async(tx,db)=>{const s=defenseRuntime(db,termId).final,v=await s.detail(row.advisorUserId,row.proposalId);return s.confirm(row.advisorUserId,row.proposalId,shared.AdvisorConfirmationSchema.parse({expectedRevision:v.revision,reportVersionId:v.versions[0].id,status:"CONFIRMED",reason:"[TỔNG HỢP] Mô phỏng GVHD đồng ý bảo vệ, không thay quyết định học vụ thật."}),"source80-final-confirm-"+row.studentCode);});stage="ADVISOR_CONFIRMED";
    }
    const s=defenseRuntime(c.db,termId).final,v=await s.detail(row.userId,row.proposalId),version=v.versions[0],file=await s.download(row.userId,row.proposalId,version.id);
    assert.equal(crypto.createHash("sha256").update(file.bytes).digest("hex"),version.checksum);
    results.push({...row,stage,finalReportVersionId:version.id,finalReportChecksum:version.checksum});save("final-reports-checkpoint.json",{termId,results});console.log(`Final reports verified: ${results.length}/32`);
  }
  assert.equal(results.length,32);assert.equal(results.filter(r=>r.stage==="ADVISOR_CONFIRMED").length,28);
  const report={termId,datasetId:c.dataset.datasetId,origin:"GENERATED_WORKFLOW",uploaded:32,advisorConfirmed:28,results,verifiedAt:new Date().toISOString()};save("final-reports-report.json",report);console.log(JSON.stringify({...report,results:undefined}));
}finally{await c.db.$disconnect();}}
if(require.main===module)main().catch(safeError);
