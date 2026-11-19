"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const {root,outputDir}=require("./sources.cjs");
const {environment,targetInfo}=require("./preflight.cjs");
const {verifiedBackup}=require("./migrate.cjs");
const {prepare}=require("./prepare-lecturers.cjs");
const {sha,lecturerIdentity}=require("./extract.cjs");
const {markerId,loadDataset}=require("./import-students.cjs");
const {assertMigrationHistory}=require(path.join(root,"backend/scripts/shared-database.cjs"));
const req=name=>require(path.join(root,"backend/node_modules",name));
const read=file=>JSON.parse(fs.readFileSync(path.join(outputDir,file),"utf8"));
const save=(file,data)=>fs.writeFileSync(path.join(outputDir,file),JSON.stringify(data,null,2)+"\n",{mode:0o600});
function ownership(existing,marker,row,datasetId){
  if(!existing){assert.equal(marker,null,"Marker has no account");return "CREATE";}
  assert.ok(marker?.action==="SOURCE_DATASET_LECTURER_IMPORTED"&&marker.resourceId===existing.id&&marker.newValue?.datasetId===datasetId,"Account already exists outside this import");
  assert.equal(existing.lecturer?.fullName,row.fullName,"Existing lecturer name changed");
  return "KEEP";
}
async function main(){
  const arg=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:undefined;};
  const target=targetInfo(environment()),plan=prepare(loadDataset().dataset,read("department-confirmations.json"));
  const approved=read("lecturer-import-plan.json");assert.equal(plan.contentHash,approved.contentHash,"Regenerate lecturer plan after changing input");
  const rows=plan.rows.filter(r=>r.status==="READY"),apply=arg("--apply-project-ref")!==undefined;
  if(apply){assert.equal(arg("--apply-project-ref"),target.projectRef);assert.equal(arg("--plan-hash"),plan.contentHash);verifiedBackup(target.projectRef);}
  const {PrismaClient}=req("@prisma/client"),db=new PrismaClient({datasources:{db:{url:target.url}},log:[]});
  const auditId=row=>markerId(plan.datasetId,"lecturer:"+row.key);
  try{
    const before=await db.$transaction(async tx=>{
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      const history=await tx.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public."_prisma_migrations"');assertMigrationHistory(history);
      const expected=fs.readdirSync(path.join(root,"backend/prisma/migrations")).filter(n=>fs.existsSync(path.join(root,"backend/prisma/migrations",n,"migration.sql")));
      assert.equal(history.length,expected.length,"All migrations required");
      const actor=await tx.userAccount.findUnique({where:{username:arg("--actor")||"admin"},select:{id:true,status:true,userRoles:{select:{role:{select:{name:true}}}}}});
      assert.ok(actor?.status==="ACTIVE"&&actor.userRoles.some(r=>r.role.name==="ADMIN"),"Active ADMIN required");
      assert.ok(await tx.role.findUnique({where:{name:"LECTURER"}}),"LECTURER role required");
      const departments=await tx.department.findMany(),areas=await tx.researchArea.findMany();
      const people=await tx.lecturer.findMany({select:{id:true,userId:true,lecturerCode:true,fullName:true}});
      const accounts=await tx.userAccount.findMany({where:{username:{in:rows.map(r=>r.username)}},select:{id:true,username:true,lecturer:{select:{fullName:true}}}});
      const markers=await tx.auditLog.findMany({where:{id:{in:rows.map(auditId)}}});
      const actions=rows.map(row=>{
        const existing=accounts.find(a=>a.username===row.username)||null;
        assert.ok(!people.some(p=>lecturerIdentity(p.fullName).key===row.key&&p.userId!==existing?.id),"Lecturer identity already exists under another account");
        const department=departments.find(d=>d.code===row.department.code||d.name===row.department.name);
        if(department)assert.equal(department.name,row.department.name,"Department code is bound to another name");
        for(const name of row.researchAreas){const area=areas.find(a=>a.name===name);if(area)assert.ok(area.isActive,"Existing research area is inactive");}
        return {username:row.username,action:ownership(existing,markers.find(m=>m.id===auditId(row))||null,row,plan.datasetId)};
      });
      return {actorId:actor.id,actions,newDepartments:[...new Map(rows.map(r=>[r.department.code,r.department])).values()].filter(d=>!departments.some(e=>e.name===d.name)),newAreas:[...new Set(rows.flatMap(r=>r.researchAreas))].filter(n=>!areas.some(a=>a.name===n))};
    },{timeout:60000});
    const summary={projectRef:target.projectRef,contentHash:plan.contentHash,ready:rows.length,pending:plan.summary.pending,
      create:before.actions.filter(a=>a.action==="CREATE").length,keep:before.actions.filter(a=>a.action==="KEEP").length,
      newDepartments:before.newDepartments,newResearchAreas:before.newAreas,operation:apply?"APPLY_REQUESTED":"DRY_RUN"};
    save("lecturer-preflight.json",summary);
    if(!apply){console.log(JSON.stringify(summary,null,2));return;}
    const credentialsFile=path.join(outputDir,"lecturer-credentials.private.json");
    const credentials=fs.existsSync(credentialsFile)?read("lecturer-credentials.private.json"):{datasetId:plan.datasetId,accounts:[]};
    assert.equal(credentials.datasetId,plan.datasetId);
    for(const row of rows)if(!credentials.accounts.some(a=>a.username===row.username))credentials.accounts.push({username:row.username,fullName:row.fullName,initialPassword:crypto.randomBytes(18).toString("base64url")+"!aA1",mustChangePassword:true});
    save("lecturer-credentials.private.json",credentials);
    req("reflect-metadata");
    const {AccountService}=require(path.join(root,"backend/dist/auth/service/account.service.js"));
    const {UserAccountRepository}=require(path.join(root,"backend/dist/auth/repository/user-account.repository.js"));
    const {CatalogRepository}=require(path.join(root,"backend/dist/catalog/repository/catalog.repository.js"));
    const {ReferenceService}=require(path.join(root,"backend/dist/catalog/service/reference.service.js"));
    const {AuditService}=require(path.join(root,"backend/dist/common/audit/audit.service.js"));
    const bcrypt=req("bcryptjs"),result=[];
    for(const row of rows){
      const item=await db.$transaction(async tx=>{
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
        const existing=await tx.userAccount.findUnique({where:{username:row.username},include:{lecturer:true}}),marker=await tx.auditLog.findUnique({where:{id:auditId(row)}});
        if(ownership(existing,marker,row,plan.datasetId)==="KEEP")return {username:row.username,userId:existing.id,action:"KEPT"};
        const adapter=new Proxy(tx,{get:(obj,key)=>key==="$transaction"?async cb=>cb(tx):typeof obj[key]==="function"?obj[key].bind(obj):obj[key]});
        const reference=new ReferenceService(new CatalogRepository(adapter,new AuditService(adapter)));
        let department=await tx.department.findFirst({where:{OR:[{code:row.department.code},{name:row.department.name}]}});
        if(department)assert.equal(department.name,row.department.name);else department=await reference.save("departments",undefined,row.department,before.actorId);
        const areaIds=[];
        for(const name of row.researchAreas){
          let area=await tx.researchArea.findUnique({where:{name}});
          if(area)assert.ok(area.isActive);else area=await reference.save("research-areas",undefined,{name,description:"Hướng được ghi trong danh sách sinh viên của nguồn nhập; chưa xác lập bộ môn quản lý hướng.",isActive:true},before.actorId);
          areaIds.push(area.id);
        }
        const password=credentials.accounts.find(a=>a.username===row.username).initialPassword;
        const account=await new AccountService(new UserAccountRepository(adapter)).create({username:row.username,password,name:row.fullName,roles:["LECTURER"],departmentId:department.id,researchAreaIds:areaIds,
          maxStudents:row.maxStudents,academicDegree:row.academicDegree,academicRank:row.academicRank},before.actorId);
        const saved=await tx.userAccount.findUnique({where:{id:account.id},include:{lecturer:{include:{researchAreas:true}},userRoles:{include:{role:true}}}});
        assert.ok(saved?.mustChangePassword&&saved.status==="ACTIVE");assert.equal(saved.lecturer.fullName,row.fullName);assert.equal(saved.lecturer.departmentId,department.id);
        assert.deepEqual(saved.userRoles.map(r=>r.role.name),["LECTURER"]);assert.equal(saved.lecturer.researchAreas.length,areaIds.length);
        assert.ok(await bcrypt.compare(password,saved.passwordHash));
        await tx.auditLog.create({data:{id:auditId(row),userId:before.actorId,action:"SOURCE_DATASET_LECTURER_IMPORTED",resource:"source-dataset",resourceId:account.id,
          newValue:{datasetId:plan.datasetId,contentHash:plan.contentHash,departmentOrigin:"USER_CONFIRMED_IN_CONVERSATION",departmentName:row.department.name,
            identityOrigin:"SOURCE_DOCUMENTS",sources:row.sources,areaOrigin:row.areaOrigin,quotaOrigin:row.quotaOrigin,workflowOrigin:"NOT_EXECUTED"}}});
        return {username:row.username,userId:account.id,lecturerId:saved.lecturer.id,departmentId:department.id,action:"CREATED_VERIFIED"};
      },{timeout:45000,isolationLevel:"Serializable"});
      result.push(item);save("lecturer-import-checkpoint.json",{datasetId:plan.datasetId,contentHash:plan.contentHash,result});
      if(result.length%5===0)console.log(`Lecturers verified: ${result.length}/${rows.length}`);
    }
    const count=await db.auditLog.count({where:{id:{in:rows.map(auditId)},action:"SOURCE_DATASET_LECTURER_IMPORTED"}});assert.equal(count,rows.length);
    const report={...summary,operation:"APPLIED",verifiedAt:new Date().toISOString(),verified:count,created:result.filter(r=>r.action==="CREATED_VERIFIED").length,
      pendingRows:plan.rows.filter(r=>r.blockers.length).map(r=>({fullName:r.fullName,blockers:r.blockers})),workflowExecuted:false,result};
    save("lecturer-import-report.json",report);
    const Excel=req("exceljs"),book=new Excel.Workbook(),sheet=book.addWorksheet("Tài khoản giảng viên");
    sheet.columns=[{header:"Họ tên",key:"fullName",width:28},{header:"Tên đăng nhập",key:"username",width:35},{header:"Mật khẩu ban đầu",key:"initialPassword",width:38},{header:"Phải đổi mật khẩu",key:"mustChangePassword",width:25}];
    sheet.addRows(credentials.accounts.filter(a=>rows.some(r=>r.username===a.username)));sheet.getRow(1).font={bold:true};
    await book.xlsx.writeFile(path.join(outputDir,"tai-khoan-giang-vien.private.xlsx"));
    console.log(JSON.stringify({...report,result:undefined,newResearchAreas:undefined,newDepartments:undefined},null,2));
  }finally{await db.$disconnect();}
}
module.exports={ownership};
if(require.main===module)main().catch(e=>{console.error("Lecturer import stopped; credentials suppressed. Code="+(e.code||e.errorCode||"CHECK_FAILED"));if(e.code==="ERR_ASSERTION")console.error(String(e.message).split("\n")[0]);process.exitCode=1;});
