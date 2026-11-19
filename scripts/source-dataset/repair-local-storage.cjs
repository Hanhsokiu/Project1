"use strict";
// Copy only dataset-owned, checksum-verified assets. Never move/delete or overwrite.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {root,req,read,save,safeError}=require("./context.cjs"),{environment,targetInfo}=require("./preflight.cjs");
const digest=bytes=>crypto.createHash("sha256").update(bytes).digest("hex");
async function main(){
  const env=environment(),target=targetInfo(env),report=read("guidance-report.json");
  assert.equal(env.STORAGE_GUIDANCE_DRIVER||"local","local");
  const from=path.resolve(root,"uploads/.private-guidance"),to=path.resolve(root,"backend",env.STORAGE_LOCAL_PATH||"./uploads",".private-guidance");
  const within=p=>p.toLowerCase().startsWith(root.toLowerCase()+path.sep);assert.ok(within(from)&&within(to));assert.notEqual(from,to);
  const db=new (req("@prisma/client").PrismaClient)({datasources:{db:{url:target.url}},log:[]});
  try{
    const assets=await db.$transaction(async tx=>{
      await tx.$executeRawUnsafe("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
      const selected=report.results.filter(r=>r.submissionId);
      assert.equal(await tx.proposal.count({where:{termId:report.termId,id:{in:selected.map(r=>r.proposalId)}}}),40);
      return tx.submissionAsset.findMany({where:{submissionId:{in:selected.map(r=>r.submissionId)}},include:{refFileId:true,refSubmissionId:{include:{task:{include:{guidancePlan:true}}}}}});
    },{timeout:60000});assert.equal(assets.length,80);
    fs.mkdirSync(to,{recursive:true});
    for(const dir of [from,to]){assert.equal(fs.realpathSync(dir).toLowerCase(),dir.toLowerCase());assert.ok(!fs.lstatSync(dir).isSymbolicLink());}
    const results=[];
    for(const entry of assets){
      const owner=report.results.find(r=>r.submissionId===entry.submissionId);assert.ok(owner);
      assert.equal(entry.refSubmissionId.task.guidancePlan.proposalId,owner.proposalId);assert.equal(entry.refSubmissionId.taskId,owner.taskId);
      const file=entry.refFileId;assert.equal(file.state,"READY");assert.match(file.storageKey,/^guidance\/[a-f0-9-]{36}$/);
      const name=file.storageKey.slice(9),source=path.join(from,name),destination=path.join(to,name);assert.equal(path.dirname(source),from);assert.equal(path.dirname(destination),to);
      const check=filePath=>{const stat=fs.lstatSync(filePath);assert.ok(stat.isFile()&&!stat.isSymbolicLink());const bytes=fs.readFileSync(filePath);assert.equal(bytes.length,file.sizeBytes);assert.equal(digest(bytes),file.checksum);};
      check(source);const exists=fs.existsSync(destination);if(exists)check(destination);else{fs.copyFileSync(source,destination,fs.constants.COPYFILE_EXCL);check(destination);}
      results.push({assetId:file.id,checksum:file.checksum,copied:!exists});
    }
    const result={verifiedAt:new Date().toISOString(),termId:report.termId,operation:"LOCAL_COPY_ONLY",databaseWrites:0,sourcePreserved:true,verified:results.length,copied:results.filter(r=>r.copied).length,results};save("storage-repair-report.json",result);console.log(JSON.stringify({...result,results:undefined}));
  }finally{await db.$disconnect();}
}
if(require.main===module)main().catch(safeError);
