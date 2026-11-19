"use strict";
// Restore only this dataset's generated, still-owned student credentials.
const assert=require("node:assert/strict");
const {context,req,dist,read,save,safeError}=require("./context.cjs");
const {markerId,validateExisting}=require("./import-students.cjs");
async function main(){const c=await context();try{
  const verification=read("workflow-verification.json");
  assert.equal(verification.termId,read("foundation-report.json").termId);
  assert.equal(verification.guidancePlans,44,"Complete and verify guidance before handoff");
  const actor=await c.db.userAccount.findUnique({where:{username:"admin"},include:{userRoles:{include:{role:true}}}});
  assert.ok(actor?.status==="ACTIVE"&&actor.userRoles.some(r=>r.role.name==="ADMIN"));
  const Account=dist("auth/service/account.service.js","AccountService"),Repo=dist("auth/repository/user-account.repository.js","UserAccountRepository"),bcrypt=req("bcryptjs");
  const temporary=read("workflow-passwords.private.json"),results=[];
  assert.equal(temporary.datasetId,c.dataset.datasetId);
  for(const student of c.dataset.selectedStudents){
    const result=await c.once("handoff-password-v1:"+student.studentCode,{origin:"USER_REQUESTED_STUDENT_CODE_PASSWORD"},async(tx,db)=>{
      const user=await tx.userAccount.findUnique({where:{username:student.studentCode},include:{student:true,userRoles:{include:{role:true}}}}),marker=await tx.auditLog.findUnique({where:{id:markerId(c.dataset.datasetId,student.studentCode)}});
      assert.equal(validateExisting(user,marker,student,c.dataset.datasetId),"KEEP_EXISTING");
      assert.deepEqual(user.userRoles.map(r=>r.role.name),["STUDENT"]);
      const record=temporary.students.find(a=>a.username===student.studentCode);
      const already=await bcrypt.compare(student.studentCode,user.passwordHash);
      assert.ok(already||(record&&await bcrypt.compare(record.temporaryWorkflowPassword,user.passwordHash)),"Student password was changed outside this workflow; stop instead of overwriting");
      if(!already||!user.mustChangePassword)await new Account(new Repo(db)).resetPassword(user.id,actor.id);
      const saved=await tx.userAccount.findUnique({where:{id:user.id}});
      assert.equal(saved.mustChangePassword,true);assert.ok(await bcrypt.compare(student.studentCode,saved.passwordHash));
      return {userId:user.id,studentCode:student.studentCode,mustChangePassword:true,passwordVerified:true};
    });results.push(result);
    if(results.length%10===0){save("handoff-passwords-checkpoint.json",{datasetId:c.dataset.datasetId,results});console.log(`Student handoff credentials verified: ${results.length}/80`);}
  }
  save("handoff-passwords-report.json",{datasetId:c.dataset.datasetId,verifiedAt:new Date().toISOString(),students:results.length,results});console.log("Student handoff passwords verified: "+results.length);
}finally{await c.db.$disconnect();}}
if(require.main===module)main().catch(safeError);
