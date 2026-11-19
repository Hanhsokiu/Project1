"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {root,outputDir,sourceDir}=require("./sources.cjs");
const {environment,targetInfo}=require("./preflight.cjs");
const {verifiedBackup}=require("./migrate.cjs");
const {sha}=require("./extract.cjs");
const {assertMigrationHistory}=require(path.join(root,"backend/scripts/shared-database.cjs"));
const req=name=>require(path.join(root,"backend/node_modules",name));
const markerId=(datasetId,code)=>{
  const hex=sha(`${datasetId}:student:${code}`);
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
};
function loadDataset(){
  const dataset=JSON.parse(fs.readFileSync(path.join(outputDir,"dataset.json"),"utf8"));
  assert.equal(dataset.selectedStudents.length,80,"Expected exactly 80 source students");
  assert.equal(new Set(dataset.selectedStudents.map(s=>s.studentCode)).size,80,"Duplicate student codes");
  for(const source of dataset.manifest)assert.equal(sha(fs.readFileSync(path.join(sourceDir,source.file))),source.sha256,"Source changed; extract and review again");
  for(const s of dataset.selectedStudents){assert.equal(s.conflicts.length,0,"Unresolved identity conflict");assert.ok(s.fullName&&s.className);}
  return {dataset,contentHash:sha(JSON.stringify(dataset.selectedStudents))};
}
function validateExisting(existing,marker,student,datasetId){
  if(!existing){assert.equal(marker,null,"Marker without account");return "CREATE";}
  assert.ok(marker?.action==="SOURCE_DATASET_ACCOUNT_IMPORTED"&&marker.resourceId===existing.id&&marker.newValue?.datasetId===datasetId,"Existing account is not owned by this import; no overwrite");
  assert.equal(existing.student?.studentCode,student.studentCode,"Student code changed");
  assert.equal(existing.student?.fullName,student.fullName,"Student name changed");
  return "KEEP_EXISTING";
}
async function main(){
  const target=targetInfo(environment()),{dataset,contentHash}=loadDataset();
  const arg=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:undefined;};
  const apply=arg("--apply-project-ref")!==undefined;
  if(apply){assert.equal(arg("--apply-project-ref"),target.projectRef,"Wrong project ref");assert.equal(arg("--dataset-hash"),contentHash,"Dataset must match reviewed content hash");verifiedBackup(target.projectRef);}
  const actorName=arg("--actor")||"admin",trainingCode=arg("--training-system")||"CQ";
  const {PrismaClient}=req("@prisma/client"),db=new PrismaClient({datasources:{db:{url:target.url}},log:[]});
  try{
    const before=await db.$transaction(async tx=>{
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      const history=await tx.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public."_prisma_migrations"');
      assertMigrationHistory(history);
      const expected=fs.readdirSync(path.join(root,"backend/prisma/migrations")).filter(n=>fs.existsSync(path.join(root,"backend/prisma/migrations",n,"migration.sql")));
      assert.equal(history.length,expected.length,"All current migrations required");
      const actor=await tx.userAccount.findUnique({where:{username:actorName},select:{id:true,status:true,userRoles:{select:{role:{select:{name:true}}}}}});
      assert.ok(actor?.status==="ACTIVE"&&actor.userRoles.some(r=>r.role.name==="ADMIN"),"Active ADMIN operator required");
      const system=await tx.trainingSystem.findUnique({where:{code:trainingCode}});assert.ok(system,"Training system missing");
      assert.ok(await tx.role.findUnique({where:{name:"STUDENT"}}),"STUDENT role missing");
      const accounts=await tx.userAccount.findMany({where:{username:{in:dataset.selectedStudents.map(s=>s.studentCode)}},select:{id:true,username:true,student:{select:{studentCode:true,fullName:true}}}});
      const profiles=await tx.student.findMany({where:{studentCode:{in:dataset.selectedStudents.map(s=>s.studentCode)}},select:{userId:true,studentCode:true}});
      const markers=await tx.auditLog.findMany({where:{id:{in:dataset.selectedStudents.map(s=>markerId(dataset.datasetId,s.studentCode))}}});
      const actions=dataset.selectedStudents.map(s=>{
        const existing=accounts.find(a=>a.username===s.studentCode)||null;
        const profile=profiles.find(p=>p.studentCode===s.studentCode);
        assert.ok(!profile||profile.userId===existing?.id,"Student code belongs to another username");
        return {studentCode:s.studentCode,action:validateExisting(existing,markers.find(m=>m.id===markerId(dataset.datasetId,s.studentCode))||null,s,dataset.datasetId)};
      });
      return {actorId:actor.id,systemId:system.id,actions};
    },{timeout:60000});
    const plan={projectRef:target.projectRef,datasetId:dataset.datasetId,contentHash,operator:actorName,trainingSystem:trainingCode,
      ready:true,creates:before.actions.filter(a=>a.action==="CREATE").length,keeps:before.actions.filter(a=>a.action==="KEEP_EXISTING").length,
      sourceFields:["studentCode","fullName","className"],initialPassword:"STUDENT_CODE",mustChangePassword:true,
      academicEligibility:"FALSE_UNTIL_VERIFIED",gpa:"SCHEMA_DEFAULT_0_NOT_SOURCE_GPA",email:null,phone:null,workflowExecuted:false};
    fs.writeFileSync(path.join(outputDir,"student-import-plan.json"),JSON.stringify(plan,null,2)+"\n");
    if(!apply){console.log(JSON.stringify({...plan,operation:"DRY_RUN"},null,2));return;}
    req("reflect-metadata");
    const {AccountService}=require(path.join(root,"backend/dist/auth/service/account.service.js"));
    const {UserAccountRepository}=require(path.join(root,"backend/dist/auth/repository/user-account.repository.js"));
    const bcrypt=req("bcryptjs");const result=[];
    for(const student of dataset.selectedStudents){
      const id=markerId(dataset.datasetId,student.studentCode);
      const item=await db.$transaction(async tx=>{
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
        const existing=await tx.userAccount.findUnique({where:{username:student.studentCode},include:{student:true}});
        const marker=await tx.auditLog.findUnique({where:{id}});
        const action=validateExisting(existing,marker,student,dataset.datasetId);
        if(action==="KEEP_EXISTING")return {studentCode:student.studentCode,userId:existing.id,action};
        // The real repository requests an inner transaction. Reuse this transaction so
        // account creation + its ordinary audit + provenance marker commit atomically.
        const adapter=new Proxy(tx,{get:(obj,key)=>key==="$transaction"?async callback=>callback(tx):typeof obj[key]==="function"?obj[key].bind(obj):obj[key]});
        const service=new AccountService(new UserAccountRepository(adapter));
        const account=await service.create({username:student.studentCode,password:student.studentCode,name:student.fullName,
          className:student.className,roles:["STUDENT"],trainingSystemId:before.systemId},before.actorId);
        const saved=await tx.userAccount.findUnique({where:{id:account.id},include:{student:true,userRoles:{include:{role:true}}}});
        assert.ok(saved?.mustChangePassword&&saved.status==="ACTIVE"&&saved.student?.academicEligible===false);
        assert.equal(saved.student.fullName,student.fullName);assert.equal(saved.student.className,student.className);
        assert.deepEqual(saved.userRoles.map(r=>r.role.name),["STUDENT"]);
        assert.ok(await bcrypt.compare(student.studentCode,saved.passwordHash),"Initial password verification failed");
        await tx.auditLog.create({data:{id,userId:before.actorId,action:"SOURCE_DATASET_ACCOUNT_IMPORTED",resource:"source-dataset",resourceId:account.id,
          newValue:{datasetId:dataset.datasetId,contentHash,studentCode:student.studentCode,identityOrigin:"SOURCE_DOCUMENTS",
            sources:student.observations.map(o=>o.source),workflowOrigin:"NOT_EXECUTED",unverifiedFields:["GPA","academicEligibility","email","phone"],trainingSystemAssignment:trainingCode}}});
        return {studentCode:student.studentCode,userId:account.id,action:"CREATED_VERIFIED"};
      },{timeout:30000,isolationLevel:"Serializable"});
      result.push(item);
      fs.writeFileSync(path.join(outputDir,"student-import-checkpoint.json"),JSON.stringify({datasetId:dataset.datasetId,contentHash,result},null,2)+"\n");
      if(result.length%10===0)console.log(`Students verified: ${result.length}/80`);
    }
    const verifiedCount=await db.auditLog.count({where:{id:{in:dataset.selectedStudents.map(s=>markerId(dataset.datasetId,s.studentCode))},action:"SOURCE_DATASET_ACCOUNT_IMPORTED"}});
    assert.equal(verifiedCount,80,"Postflight marker count mismatch");
    const report={...plan,operation:"APPLIED",verifiedAt:new Date().toISOString(),created:result.filter(i=>i.action==="CREATED_VERIFIED").length,
      kept:result.filter(i=>i.action==="KEEP_EXISTING").length,verifiedCount,existingAccountsOverwritten:0,lecturersCreated:0,result};
    fs.writeFileSync(path.join(outputDir,"student-import-report.json"),JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({...report,result:undefined},null,2));
  }finally{await db.$disconnect();}
}
module.exports={markerId,loadDataset,validateExisting};
if(require.main===module)main().catch(e=>{console.error("Student import stopped; credentials suppressed. Code="+(e.code||e.errorCode||"CHECK_FAILED"));if(e.code==="ERR_ASSERTION")console.error(String(e.message).split("\n")[0]);process.exitCode=1;});
