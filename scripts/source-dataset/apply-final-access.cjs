"use strict";
// Explicit user approval covers the global role impact documented in the review.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {context,dist,req,read,save,outputDir,safeError}=require("./context.cjs");
const approval="Đồng ý cả quyền dùng chung và làm tròn 1 chữ số";
async function main(){const c=await context();try{
 const approvalFile=path.join(outputDir,"approved-final-access.private.json"),snapshot=fs.existsSync(approvalFile)?read("approved-final-access.private.json").snapshot:read("final-readiness.json"),{termId,datasetId}=read("foundation-report.json");assert.equal(snapshot.datasetId,datasetId);assert.equal(snapshot.termId,termId);assert.equal(snapshot.permissionsChanged,false);
 const pairs=snapshot.roles.flatMap(r=>r.missing.map(permission=>({role:r.role,permission})));assert.equal(pairs.length,21);assert.equal(new Set(pairs.map(p=>p.role+":"+p.permission)).size,21);
 const approved={FACULTY:["defense-result:components-read","defense-result:finalize","defense-result:publish","defense-report:preview","defense-report:export","defense-report:download","defense-report:list-export","defense-report:components-export","defense-report:final-export","defense-report:comments-export","defense-report:minutes-export","defense-report:dossier-export","defense-report:pii-export","defense-confirmation:comment-read","defense-reviewer-grade:comment-read","dossier:export"],LECTURER:["defense-result:read","defense-result:confirm"],STUDENT:["defense-result:read","defense-result:read-own","defense-result:final-read"]};
 assert.deepEqual(pairs.map(p=>p.role+":"+p.permission).sort(),Object.entries(approved).flatMap(([role,permissions])=>permissions.map(p=>role+":"+p)).sort(),"Only the exact 21 approved global links may be added");
 const reviewHash=crypto.createHash("sha256").update(fs.readFileSync(path.join(__dirname,"../../docs/source-dataset/FINAL-STAGES-REVIEW.md"))).digest("hex");
 if(!fs.existsSync(approvalFile))save("approved-final-access.private.json",{approval,reviewHash,snapshot});
 const access=await c.once("approved-final-stage-role-access-v1",{approval,reviewHash,scope:"GLOBAL_BUSINESS_ROLES_WITH_EXISTING_SERVICE_SCOPE_GUARDS",academicDecision:false},async tx=>{
   const operator=await tx.userAccount.findUnique({where:{username:"admin"},select:{id:true,status:true,userRoles:{select:{role:{select:{name:true}}}}}});assert.ok(operator?.status==="ACTIVE"&&operator.userRoles.some(r=>r.role.name==="ADMIN"));
   const created=[];
   for(const p of pairs){const [resource,action]=p.permission.split(":"),role=await tx.role.findUnique({where:{name:p.role}}),permission=await tx.permission.findUnique({where:{resource_action:{resource,action}}});assert.ok(role&&permission);
     assert.equal(await tx.rolePermission.findUnique({where:{roleId_permissionId:{roleId:role.id,permissionId:permission.id}}}),null,"Permission snapshot changed; review before writing");
     await tx.rolePermission.create({data:{roleId:role.id,permissionId:permission.id}});created.push({...p,roleId:role.id,permissionId:permission.id});
   }
   await tx.auditLog.create({data:{userId:operator.id,action:"SOURCE_DATASET_ROLE_ACCESS_APPROVED",resource:"source-dataset",resourceId:datasetId,newValue:{approval,reviewHash,globalRoleImpact:true,affectedAccountsAtReview:snapshot.roles.map(r=>({role:r.role,accounts:r.affectedAccounts})),created}}});return{created,globalRoleImpact:true,approval,reviewHash};
 });
 save("final-access-report.json",{termId,datasetId,...access,verifiedAt:new Date().toISOString()});console.log("Explicitly approved role-permission links added: "+access.created.length);
 const previous=read("policy-approval.private.json"),release=read("policy-release-report.json"),hash=dist("defense/policies/policy-release.js","policyReleaseHash");
 const result=await c.once("approved-final-result-precision-v3",{approval,reviewHash,academicDecision:false},async tx=>{
   assert.equal(previous.contentHash,release.contentHash);const ids=(await tx.proposal.findMany({where:{termId},select:{id:true}})).map(p=>p.id);assert.equal(await tx.finalResult.count({where:{proposalId:{in:ids}}}),0,"Never revise policies under finalized results");
   const stored=await tx.termParameter.findMany({where:{termId,key:{in:Object.keys(previous.policies)}}});assert.equal(stored.length,9);for(const r of stored)assert.equal(hash(JSON.parse(r.value)),hash(previous.policies[r.key]));
   const next=structuredClone(previous.policies),old=next.UC24_POLICY,now=new Date().toISOString();assert.equal(old.finalRounding.decimalPlaces,2);assert.equal(old.finalStep,"0.01");assert.equal(old.storageDecimalPlaces,2);
   next.UC24_POLICY={...old,version:"NGUON80-SYNTHETIC-FINAL-PRECISION-v3",approvedAt:now,approvedBy:c.faculty.userId,reference:"Người dùng duyệt rõ quyền dùng chung và điểm cuối làm tròn một chữ số cho dữ liệu test NGUON80; không phải kết quả học vụ thật.",finalRounding:{...old.finalRounding,decimalPlaces:1},finalStep:"0.1",storageDecimalPlaces:1};
   const shared=req("@doan/shared");shared.validateFinalResultPolicy(next.UC24_POLICY);dist("defense/policies/policy-release.js","PolicySetSchema").parse(next);
   // Verify the proposed rounding against the actual immutable score sets.
   const grades=read("committee-grades-report.json"),plan=read("workflow-plan.json");let verified=0;
   for(const row of grades.results.filter(r=>plan.scenarios.find(s=>s.studentCode===r.studentCode).actionKeys.includes("result-finalized"))){const scores=await tx.scoreEntry.findMany({where:{proposalId:row.proposalId,role:{in:["ADVISOR","REVIEWER","COMMITTEE_MEMBER"]}}});assert.equal(scores.length,6);assert.ok(scores.filter(s=>s.role!=="ADVISOR").every(s=>s.isLocked));
     const sources=scores.map(s=>({source:({ADVISOR:"ADVISOR_UC17",REVIEWER:"REVIEWER",COMMITTEE_MEMBER:"COMMITTEE"})[s.role],lecturerId:s.scorerId,role:s.role,scoreEntryId:s.id,totalScore:s.totalScore.toString()}));const calculated=shared.calculateFinalResult(next.UC24_POLICY,sources);assert.ok(/^\d+(?:\.\d)?$/.test(calculated.finalScore));verified++;
   }assert.equal(verified,8);
   for(const key of Object.keys(next).filter(k=>k!=="UC24_POLICY"))assert.equal(hash(next[key]),hash(previous.policies[key]));
   const row=stored.find(p=>p.key==="UC24_POLICY"),changed=await tx.termParameter.updateMany({where:{id:row.id,value:row.value},data:{value:JSON.stringify(next.UC24_POLICY)}});assert.equal(changed.count,1);
   await tx.auditLog.create({data:{userId:c.faculty.userId,action:"SOURCE_DATASET_POLICY_VERSIONED",resource:"term-policy",resourceId:termId+":UC24_POLICY",oldValue:old,newValue:{policy:next.UC24_POLICY,approval,reviewHash,origin:"USER_APPROVED_TEST_FINAL_PRECISION",academicDecision:false}}});
   return{policies:next,contentHash:hash({termId,policies:next}),previousContentHash:previous.contentHash,approvedAt:now,verifiedScoreSets:verified};
 },{timeout:120000});
 for(const file of ["policy-approval.private.json","policy-release-report.json"]){const archive=path.join(outputDir,file.replace(/\.json$/,".before-final-precision-v3.json"));if(!fs.existsSync(archive))fs.copyFileSync(path.join(outputDir,file),archive,fs.constants.COPYFILE_EXCL);}
 save("policy-approval.private.json",{...previous,policies:result.policies,contentHash:result.contentHash,approvedAt:result.approvedAt,recordedAt:result.approvedAt,confirmationId:"USER_APPROVED_GLOBAL_ROLES_AND_ONE_DECIMAL_2026_11_19",confirmedText:approval,supersedesContentHash:result.previousContentHash,academicDecision:false});
 save("policy-release-report.json",{...release,contentHash:result.contentHash,finalPrecisionVersion:3,verifiedAt:new Date().toISOString()});
 save("final-precision-report.json",{termId,datasetId,...result,approval,reviewHash,verifiedAt:new Date().toISOString()});console.log("UC24 policy versioned; actual score sets compatible with one decimal: "+result.verifiedScoreSets);
}finally{await c.db.$disconnect();}}
if(require.main===module)main().catch(safeError);
