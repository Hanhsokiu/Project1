"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const {context,dist,req,read,save,outputDir,safeError}=require("./context.cjs");
async function main(){const c=await context();try{
  const reviews=read("reviews-report.json"),{termId}=reviews,plan=read("workflow-plan.json"),shared=req("@doan/shared");
  const Repo=dist("topic/proposal-dossiers/dossier.repository.js","DossierRepository"),Service=dist("topic/proposal-dossiers/dossier.service.js","DossierService"),V=dist("topic/proposal-dossiers/dossier.validator.js","DossierValidator"),RV=dist("topic/proposal-reviews/proposal-review.validator.js","ProposalReviewValidator"),Pdf=dist("topic/proposal-dossiers/dossier-pdf.service.js","DossierPdfService");
  const service=db=>new Service(new Repo(db),new V(new RV()),new RV(),new Pdf()),results=[];
  fs.mkdirSync(path.join(outputDir,"dossier-pdfs"),{recursive:true});
  for(const row of reviews.results.filter(r=>plan.scenarios.find(s=>s.studentCode===r.studentCode).actionKeys.includes("dossier-received"))){
    assert.equal(row.status,"APPROVED");const source=c.dataset.selectedStudents.find(s=>s.studentCode===row.studentCode);
    const step=(key,fn)=>c.once(key+":"+row.studentCode,{origin:"GENERATED_WORKFLOW",studentCode:row.studentCode},fn);
    await step("dossier-profile",async(tx,db)=>{
      const v=await service(db).detail(c.faculty.userId,row.proposalId);
      return service(db).saveStudentProfile(c.faculty.userId,row.proposalId,shared.DossierStudentProfileSchema.parse({className:source.className,majorName:"Công nghệ thông tin",expectedRevision:v.studentProfile.revision}));
    });
    await step("dossier-finalize",async(tx,db)=>{const v=await service(db).detail(c.faculty.userId,row.proposalId);return service(db).finalize(c.faculty.userId,row.proposalId,shared.DossierFinalizeSchema.parse({expectedProposalRevision:v.proposalRevision,expectedDossierRevision:v.revision,approvedVersionId:v.submittedVersionId,templateVersion:shared.DOSSIER_TEMPLATE_VERSION}),"source80-finalize-"+row.studentCode);});
    await step("dossier-pdf",async(tx,db)=>{const v=await service(db).detail(c.faculty.userId,row.proposalId);return service(db).generate(c.faculty.userId,row.proposalId,shared.DossierPdfGenerateSchema.parse({finalizationId:v.currentFinalization.id,expectedRevision:v.revision}),"source80-pdf-"+row.studentCode);});
    const received=await step("dossier-receive",async(tx,db)=>{const v=await service(db).detail(c.faculty.userId,row.proposalId);return service(db).receive(c.faculty.userId,row.proposalId,shared.DossierReceiptSchema.parse({expectedRevision:v.revision,finalizationId:v.currentFinalization.id,note:"[TIẾP NHẬN TỔNG HỢP] Mô phỏng thao tác Khoa để kiểm tra giao diện. Không xác nhận đã nhận bản giấy thật."}),"source80-receive-"+row.studentCode);});
    assert.equal(received.state,"RECEIVED");assert.ok(received.currentFinalization.pdfChecksum);
    const download=await service(c.db).download(row.userId,row.proposalId,received.currentFinalization.id);
    const bytes=download.bytes;assert.ok(Buffer.isBuffer(bytes)||bytes instanceof Uint8Array,"Real PDF bytes required");assert.equal(Buffer.from(bytes).subarray(0,5).toString(),"%PDF-");
    const checksum=crypto.createHash("sha256").update(bytes).digest("hex");assert.equal(checksum,received.currentFinalization.pdfChecksum);
    const filename=row.studentCode+".pdf";fs.writeFileSync(path.join(outputDir,"dossier-pdfs",filename),bytes);
    results.push({...row,dossierRevision:received.revision,finalizationId:received.currentFinalization.id,pdfChecksum:checksum,pdfBytes:bytes.length,pdfFile:"dossier-pdfs/"+filename,state:received.state});save("dossiers-checkpoint.json",{termId,results});
    console.log(`Dossiers verified: ${results.length}/48`);
  }
  assert.equal(results.length,48);const report={termId,datasetId:c.dataset.datasetId,origin:"GENERATED_WORKFLOW",received:48,pdfChecksumsVerified:48,results,verifiedAt:new Date().toISOString()};save("dossiers-report.json",report);console.log(JSON.stringify({...report,results:undefined}));
}finally{await c.db.$disconnect();}}
if(require.main===module)main().catch(safeError);
