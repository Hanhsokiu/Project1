"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {root,outputDir}=require("./sources.cjs");
const {environment,targetInfo}=require("./preflight.cjs");
const {loadDataset,markerId}=require("./import-students.cjs");
const {prepare}=require("./prepare-lecturers.cjs");
const req=name=>require(path.join(root,"backend/node_modules",name));
const read=file=>JSON.parse(fs.readFileSync(path.join(outputDir,file),"utf8"));
async function main(){
  const target=targetInfo(environment()),{dataset}=loadDataset(),plan=prepare(dataset,read("department-confirmations.json"));
  const faculty=read("faculty-report.json"),facultyPassword=read("faculty-credentials.private.json");
  const lecturerPasswords=read("lecturer-credentials.private.json").accounts;
  const expected=[...dataset.selectedStudents.map(s=>({username:s.studentCode,password:s.studentCode,role:"STUDENT",name:s.fullName,className:s.className,marker:markerId(dataset.datasetId,s.studentCode)})),
    ...plan.rows.filter(r=>r.status==="READY").map(r=>({username:r.username,password:lecturerPasswords.find(a=>a.username===r.username)?.initialPassword,role:"LECTURER",name:r.fullName,department:r.department.name,areas:r.researchAreas,marker:markerId(dataset.datasetId,"lecturer:"+r.key)})),
    {username:faculty.username,password:facultyPassword.initialPassword,role:"FACULTY",marker:markerId(dataset.datasetId,"faculty:"+faculty.username)}];
  const {PrismaClient}=req("@prisma/client"),db=new PrismaClient({datasources:{db:{url:target.url}},log:[]});
  try{
    const snapshot=await db.$transaction(async tx=>{
      await tx.$executeRawUnsafe("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
      const accounts=await tx.userAccount.findMany({where:{username:{in:expected.map(e=>e.username)}},include:{student:true,lecturer:{include:{department:true,researchAreas:{include:{researchArea:true}}}},userRoles:{include:{role:true}}}});
      const markers=await tx.auditLog.findMany({where:{id:{in:expected.map(e=>e.marker)}}});
      const pending=await tx.userAccount.count({where:{username:{in:plan.rows.filter(r=>r.status!=="READY").map(r=>r.username)}}});
      return {accounts,markers,pending};
    },{timeout:60000});
    assert.equal(snapshot.accounts.length,expected.length);assert.equal(snapshot.markers.length,expected.length);assert.equal(snapshot.pending,0);
    const bcrypt=req("bcryptjs");
    for(const entry of expected){
      const user=snapshot.accounts.find(a=>a.username===entry.username),marker=snapshot.markers.find(m=>m.id===entry.marker);
      assert.equal(user.status,"ACTIVE");assert.equal(user.mustChangePassword,true);assert.deepEqual(user.userRoles.map(r=>r.role.name),[entry.role]);
      assert.ok(entry.password&&await bcrypt.compare(entry.password,user.passwordHash),"Initial password mismatch");
      assert.equal(marker.resourceId,user.id);assert.equal(marker.newValue.datasetId,dataset.datasetId);
      if(entry.role==="STUDENT"){assert.equal(user.student.studentCode,entry.username);assert.equal(user.student.fullName,entry.name);assert.equal(user.student.className,entry.className);}
      if(entry.role==="LECTURER"){assert.equal(user.lecturer.fullName,entry.name);assert.equal(user.lecturer.department.name,entry.department);assert.deepEqual(user.lecturer.researchAreas.map(r=>r.researchArea.name).sort(),[...entry.areas].sort());}
    }
    const report={operation:"READ_ONLY",verifiedAt:new Date().toISOString(),projectRef:target.projectRef,students:80,lecturers:33,faculty:1,accounts:expected.length,
      initialPasswordsVerified:expected.length,rolesAndProvenanceVerified:expected.length,mustChangePassword:true,pendingLecturers:3,workflowVerified:false,httpLoginVerified:false};
    fs.writeFileSync(path.join(outputDir,"accounts-verification.json"),JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report,null,2));
    const book=new (req("exceljs").Workbook)(),sheet=book.addWorksheet("Tài khoản đã xác minh");
    sheet.columns=[{header:"Vai trò",key:"role",width:16},{header:"Họ tên",key:"name",width:28},{header:"Tên đăng nhập",key:"username",width:36},{header:"Mật khẩu ban đầu",key:"password",width:38},{header:"Phải đổi mật khẩu",key:"change",width:24}];
    sheet.addRows(expected.map(e=>({role:e.role,name:e.name||"Khoa — bộ dữ liệu nguồn 80",username:e.username,password:e.password,change:"Có"})));sheet.getRow(1).font={bold:true};sheet.views=[{state:"frozen",ySplit:1}];
    await book.xlsx.writeFile(path.join(outputDir,"tai-khoan-he-thong.private.xlsx"));
  }finally{await db.$disconnect();}
}
if(require.main===module)main().catch(e=>{console.error("Account verification failed; credentials suppressed. Code="+(e.code||e.errorCode||"CHECK_FAILED"));process.exitCode=1;});
