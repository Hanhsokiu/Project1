"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto");
const {read,save,safeError}=require("./context.cjs");
async function main(){
  const checkpoint=read("guidance-checkpoint.json"),row=checkpoint.results.find(r=>r.stage==="PROGRESS_REVIEWED"),other=checkpoint.results.find(r=>r.studentCode!==row?.studentCode);
  assert.ok(row&&other,"Need completed guidance evidence and a different owned student");
  const account=read("workflow-passwords.private.json").students.find(r=>r.username===row.studentCode);assert.ok(account);
  const base="http://127.0.0.1:3011/api",request=(route,init={})=>fetch(base+route,{...init,signal:AbortSignal.timeout(60000)});
  const login=await request("/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username:account.username,password:account.temporaryWorkflowPassword})});assert.equal(login.status,201);
  const token=(await login.json()).data.accessToken;assert.ok(token);const headers={authorization:"Bearer "+token};
  try{
    const get=async route=>{const response=await request(route,{headers});assert.equal(response.status,200,"Expected authorized guidance read");return (await response.json()).data;};
    const context=await get(`/proposals/${row.proposalId}/guidance-context`);assert.equal(context.studentCode,row.studentCode);assert.equal(context.plan.id,row.planId);
    const task=await get(`/tasks/${row.taskId}`);assert.equal(task.status,"COMPLETED");
    const submission=await get(`/task-submissions/${row.submissionId}`);assert.equal(submission.id,row.submissionId);assert.equal(submission.files.length,2);
    for(const file of submission.files){const response=await request(`/task-submissions/${row.submissionId}/files/${file.id}/download`,{headers});if(response.status!==200){const body=await response.json();throw new Error("Download failed: HTTP "+response.status+" code="+(body.error?.code||body.code||"UNKNOWN"));}const bytes=Buffer.from(await response.arrayBuffer());assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),file.checksum,"HTTP download checksum mismatch");}
    const denied=[];
    for(const route of [`/proposals/${other.proposalId}/guidance-context`,`/tasks/${other.taskId}`]){const response=await request(route,{headers});assert.ok([403,404].includes(response.status),"Another student's evidence must stay inaccessible");denied.push(response.status);}
    const report={verifiedAt:new Date().toISOString(),termId:checkpoint.termId,realHttp:true,ownPlan:true,completedTask:true,ownSubmission:true,downloadedFilesWithMatchingChecksum:2,foreignStudentDenied:denied,fullWorkflowHttpVerified:false};save("http-guidance-verification.json",report);console.log(JSON.stringify(report));
  }finally{const logout=await request("/auth/logout",{method:"POST",headers});assert.ok(logout.ok,"Inspection session logout required");}
}
if(require.main===module)main().catch(e=>{if(/^Download failed: HTTP \d+ code=[A-Z_0-9]+$/.test(e.message))console.error(e.message);safeError(e);});
