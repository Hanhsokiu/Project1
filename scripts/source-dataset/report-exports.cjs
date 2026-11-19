"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {context,req,read,save,outputDir,safeError}=require("./context.cjs"),{defenseRuntime}=require("./defense-runtime.cjs");
async function main(){const c=await context();try{
  const result=read("final-results-report.json"),{termId}=result,policies=read("policy-approval.private.json").policies,shared=req("@doan/shared"),results=[];
  const sample=result.results.find(r=>r.stage==="PUBLISHED");assert.ok(sample);
  const dir=path.join(outputDir,"exports");fs.mkdirSync(dir,{recursive:true});
  for(const template of policies.UC25_POLICY.templates){
    const isCommittee=["XLSX_COMMITTEES","PDF_COMMITTEE"].includes(template.code),filters={termId,...(isCommittee?{committeeId:sample.committeeId}:{termStudentId:sample.termStudentId})};
    const request=shared.ReportPreviewSchema.parse({filters,templateCode:template.code,templateVersion:template.version,mode:"OFFICIAL"});
    const metadata=await c.once("report-export:"+template.code,{origin:"GENERATED_REPORT",templateCode:template.code},async(tx,db)=>{const s=defenseRuntime(db,termId).reports,preview=await s.preview(c.faculty.userId,request);assert.ok(preview.canExport,"Report blockers: "+preview.blockers.join(","));return s.export(c.faculty.userId,shared.ReportExportSchema.parse({...request,expectedSnapshotHash:preview.snapshotHash}),"source80-export-"+template.code);});
    const download=await defenseRuntime(c.db,termId).reports.download(c.faculty.userId,metadata.id,"source80-download-"+template.code),hash=crypto.createHash("sha256").update(download.bytes).digest("hex");assert.equal(hash,metadata.fileHash);assert.equal(metadata.signatureStatus,"UNSIGNED");assert.equal(metadata.status,"GENERATED");
    fs.writeFileSync(path.join(dir,download.filename),download.bytes);results.push({templateCode:template.code,exportId:metadata.id,filename:download.filename,sha256:hash,sizeBytes:download.bytes.length,signatureStatus:metadata.signatureStatus});save("report-exports-checkpoint.json",{termId,results});console.log(`Report exports verified: ${results.length}/15`);
  }
  assert.equal(results.length,15);const report={termId,datasetId:c.dataset.datasetId,origin:"GENERATED_WORKFLOW",exports:15,results,verifiedAt:new Date().toISOString()};save("report-exports-report.json",report);console.log(JSON.stringify({...report,results:undefined}));
}finally{await c.db.$disconnect();}}
if(require.main===module)main().catch(safeError);
