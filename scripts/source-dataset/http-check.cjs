"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {read,save,outputDir,safeError}=require("./context.cjs");
async function main(){
  const base="http://127.0.0.1:3011/api",student=read("workflow-passwords.private.json").students[0],faculty=read("faculty-report.json"),lecturer=read("lecturer-credentials.private.json").accounts[0];
  const handedOff=fs.existsSync(path.join(outputDir,"handoff-passwords-report.json"));
  if(handedOff){const handoff=read("handoff-passwords-report.json");assert.equal(handoff.datasetId,read("foundation-report.json").datasetId);assert.equal(handoff.students,80);}
  const accounts=[{username:student.username,password:handedOff?student.username:student.temporaryWorkflowPassword,role:"STUDENT",mustChange:handedOff},{username:faculty.username,password:read("faculty-credentials.private.json").initialPassword,role:"FACULTY",mustChange:true},{username:lecturer.username,password:lecturer.initialPassword,role:"LECTURER",mustChange:true}],results=[];
  for(const account of accounts){
    const login=await fetch(base+"/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username:account.username,password:account.password})});
    if(login.status!==201){const failure={role:account.role,login:false,httpStatus:login.status};const report={verifiedAt:new Date().toISOString(),realHttp:true,realAuthentication:true,results:[...results,failure],passed:false,fullWorkflowHttpVerified:false};save("http-verification.json",report);assert.fail("HTTP login failed for "+account.role+"; status="+login.status);}
    const data=(await login.json()).data;assert.ok(data.accessToken);
    const headers={authorization:"Bearer "+data.accessToken};
    try{
      const me=await fetch(base+"/auth/me",{headers});assert.equal(me.status,200);const user=(await me.json()).data;assert.equal(user.username,account.username);assert.equal(user.mustChangePassword,account.mustChange);
      const business=await fetch(base+"/terms",{headers});assert.equal(business.status,account.mustChange?403:200,"Business access must match first-password guard");
      results.push({role:account.role,login:true,me:true,mustChangePassword:user.mustChangePassword,businessStatus:business.status});
    }finally{const logout=await fetch(base+"/auth/logout",{method:"POST",headers});assert.ok(logout.ok);}
  }
  const report={verifiedAt:new Date().toISOString(),realHttp:true,realAuthentication:true,results,fullWorkflowHttpVerified:false};save("http-verification.json",report);console.log(JSON.stringify(report,null,2));
}
if(require.main===module)main().catch(safeError);
