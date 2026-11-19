"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const {root,outputDir}=require("./sources.cjs");
const {environment,targetInfo}=require("./preflight.cjs");
const {verifiedBackup}=require("./migrate.cjs");
const {markerId,loadDataset}=require("./import-students.cjs");
const req=name=>require(path.join(root,"backend/node_modules",name));
const username="khoa.nguon80";
async function main(){
  const target=targetInfo(environment()),{dataset}=loadDataset();
  const index=process.argv.indexOf("--apply-project-ref"),apply=index>=0;
  if(apply){assert.equal(process.argv[index+1],target.projectRef);verifiedBackup(target.projectRef);}
  const {PrismaClient}=req("@prisma/client"),db=new PrismaClient({datasources:{db:{url:target.url}},log:[]});
  const auditId=markerId(dataset.datasetId,"faculty:"+username),file=path.join(outputDir,"faculty-credentials.private.json");
  try{
    const before=await db.$transaction(async tx=>{
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      const actor=await tx.userAccount.findUnique({where:{username:"admin"},include:{userRoles:{include:{role:true}}}});
      assert.ok(actor?.status==="ACTIVE"&&actor.userRoles.some(r=>r.role.name==="ADMIN"));
      assert.ok(await tx.role.findUnique({where:{name:"FACULTY"}}),"FACULTY role missing");
      const existing=await tx.userAccount.findUnique({where:{username},select:{id:true,username:true}});
      const marker=await tx.auditLog.findUnique({where:{id:auditId}});
      if(existing)assert.ok(marker?.action==="SOURCE_DATASET_FACULTY_CREATED"&&marker.resourceId===existing.id&&marker.newValue?.datasetId===dataset.datasetId,"Existing faculty username is unrelated; no overwrite");
      else assert.equal(marker,null);
      return {actorId:actor.id,existingId:existing?.id||null};
    },{timeout:30000});
    if(!apply){console.log(JSON.stringify({operation:"DRY_RUN",username,role:"FACULTY",action:before.existingId?"KEEP":"CREATE",globalPermissionsChanged:false}));return;}
    let credentials=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,"utf8")):null;
    if(!credentials){assert.ok(!before.existingId,"Private credentials missing for existing account; do not reset");credentials={datasetId:dataset.datasetId,username,initialPassword:crypto.randomBytes(18).toString("base64url")+"!aA1",mustChangePassword:true};fs.writeFileSync(file,JSON.stringify(credentials,null,2)+"\n",{mode:0o600});}
    assert.equal(credentials.datasetId,dataset.datasetId);assert.equal(credentials.username,username);
    req("reflect-metadata");
    const {AccountService}=require(path.join(root,"backend/dist/auth/service/account.service.js"));
    const {UserAccountRepository}=require(path.join(root,"backend/dist/auth/repository/user-account.repository.js"));
    const account=before.existingId?{id:before.existingId}:await db.$transaction(async tx=>{
      const adapter=new Proxy(tx,{get:(obj,key)=>key==="$transaction"?async cb=>cb(tx):typeof obj[key]==="function"?obj[key].bind(obj):obj[key]});
      const user=await new AccountService(new UserAccountRepository(adapter)).create({username,name:"Khoa — bộ dữ liệu nguồn 80",password:credentials.initialPassword,roles:["FACULTY"]},before.actorId);
      await tx.auditLog.create({data:{id:auditId,userId:before.actorId,action:"SOURCE_DATASET_FACULTY_CREATED",resource:"source-dataset",resourceId:user.id,
        newValue:{datasetId:dataset.datasetId,identityOrigin:"USER_REQUESTED_NEW_DATASET_OPERATOR",role:"FACULTY",termGrants:"CREATED_BY_EXISTING_TERM_SERVICE_WHEN_CREATING_TERM",policyApproval:"NOT_GIVEN"}}});
      return user;
    },{timeout:30000,isolationLevel:"Serializable"});
    const saved=await db.userAccount.findUnique({where:{id:account.id},include:{userRoles:{include:{role:true}}}});
    assert.deepEqual(saved.userRoles.map(r=>r.role.name),["FACULTY"]);assert.ok(saved.mustChangePassword&&saved.status==="ACTIVE");
    assert.ok(await req("bcryptjs").compare(credentials.initialPassword,saved.passwordHash));
    const report={operation:"APPLIED",projectRef:target.projectRef,datasetId:dataset.datasetId,username,userId:saved.id,role:"FACULTY",action:before.existingId?"KEPT":"CREATED_VERIFIED",verifiedAt:new Date().toISOString(),globalPermissionsChanged:false,policyApproval:"NOT_GIVEN"};
    fs.writeFileSync(path.join(outputDir,"faculty-report.json"),JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report,null,2));
  }finally{await db.$disconnect();}
}
if(require.main===module)main().catch(e=>{console.error("Faculty operation stopped; credentials suppressed. Code="+(e.code||e.errorCode||"CHECK_FAILED"));process.exitCode=1;});
