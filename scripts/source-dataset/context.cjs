"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {root,outputDir}=require("./sources.cjs");
const {environment,targetInfo}=require("./preflight.cjs");
const {verifiedBackup}=require("./migrate.cjs");
const {markerId,loadDataset}=require("./import-students.cjs");
const req=name=>require(path.join(root,"backend/node_modules",name));
const read=file=>JSON.parse(fs.readFileSync(path.join(outputDir,file),"utf8"));
const save=(file,data)=>fs.writeFileSync(path.join(outputDir,file),JSON.stringify(data,null,2)+"\n",{mode:0o600});
const dist=(file,name)=>require(path.join(root,"backend/dist",file))[name];
const adapter=tx=>new Proxy(tx,{get:(obj,key)=>key==="$transaction"?async cb=>cb(tx):typeof obj[key]==="function"?obj[key].bind(obj):obj[key]});
async function context(){
  const target=targetInfo(environment()),index=process.argv.indexOf("--apply-project-ref");
  assert.ok(index>=0&&process.argv[index+1]===target.projectRef,"Explicit verified project ref required");verifiedBackup(target.projectRef);
  const dataset=loadDataset().dataset;req("reflect-metadata");
  const db=new (req("@prisma/client").PrismaClient)({datasources:{db:{url:target.url}},log:[]});
  const faculty=read("faculty-report.json"),operator=await db.userAccount.findUnique({where:{id:faculty.userId},select:{id:true,status:true,userRoles:{select:{role:{select:{name:true}}}}}});
  assert.ok(operator?.status==="ACTIVE"&&operator.userRoles.some(r=>r.role.name==="FACULTY"),"Dataset faculty must be active");
  async function once(key,details,operation,options={}){
    const timeout=options.timeout??120000;assert.ok(Number.isInteger(timeout)&&timeout>=120000&&timeout<=3600000,"Bounded dataset transaction timeout required");
    const isolationLevel=options.isolationLevel??"Serializable";assert.ok(["Serializable","ReadCommitted"].includes(isolationLevel));
    const id=markerId(dataset.datasetId,"operation:"+key);
    return db.$transaction(async tx=>{
      const found=await tx.auditLog.findUnique({where:{id}});
      if(found){assert.equal(found.newValue?.datasetId,dataset.datasetId);return found.newValue.result;}
      const result=await operation(tx,adapter(tx));
      const json=JSON.parse(JSON.stringify(result));
      await tx.auditLog.create({data:{id,userId:faculty.userId,action:"SOURCE_DATASET_OPERATION",resource:"source-dataset",resourceId:dataset.datasetId,
        newValue:{datasetId:dataset.datasetId,key,origin:"USER_AUTHORIZED_SYNTHETIC_WORKFLOW",details,result:json}}});
      return json;
    },{timeout,isolationLevel,maxWait:10000});
  }
  return {db,faculty,dataset,target,once};
}
function safeError(error){
  console.error("Dataset operation stopped. Credentials suppressed. Code="+(error.code||error.errorCode||"CHECK_FAILED"));
  console.error("Type="+(error.name||"Error"));
  const frame=String(error.stack||"").split("\n").find(line=>line.trim().startsWith("at ")&&line.includes("source-dataset"));
  if(frame)console.error(frame.trim());
  if(error.code==="ERR_ASSERTION")console.error(String(error.message).split("\n")[0]);
  if(typeof error.getResponse==="function")console.error(JSON.stringify(error.getResponse()));
  process.exitCode=1;
}
module.exports={root,outputDir,req,read,save,dist,adapter,context,safeError};
