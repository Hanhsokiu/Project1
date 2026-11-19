"use strict";
const assert=require("node:assert/strict");
const {context,dist,read,save,safeError}=require("./context.cjs");
const {markerId}=require("./import-students.cjs");
async function main(){const c=await context();try{
  const draft=read("policy-proposal.json"),approved=read("policy-approval.private.json"),{termId}=read("foundation-report.json");
  const hash=dist("defense/policies/policy-release.js","policyReleaseHash"),prepare=dist("defense/policies/policy-release.js","preparePolicyRelease");
  const {contentHash,verification,...body}=draft;
  assert.equal(hash(body),contentHash);assert.equal(contentHash,approved.proposalHash);assert.equal(approved.termId,termId);assert.equal(approved.actorId,c.faculty.userId);
  assert.equal(approved.origin,"EXPLICIT_USER_APPROVAL_FOR_SYNTHETIC_DATA");assert.equal(approved.academicDecision,false);
  assert.equal(hash({termId,policies:approved.policies}),approved.contentHash);
  const expected=structuredClone(draft.policies);
  for(const p of Object.values(expected))Object.assign(p,{status:"APPROVED",approvedBy:approved.actorId,approvedAt:approved.approvedAt});
  for(const t of expected.UC25_POLICY.templates)Object.assign(t,{status:"APPROVED",approval:{by:approved.actorId,at:approved.approvedAt,reference:approved.reference}});
  assert.equal(hash(expected),hash(approved.policies),"Approval must change metadata only");
  await c.once("policy-approval-v1",{origin:approved.origin,confirmationId:approved.confirmationId},async()=>({status:"APPROVED",id:approved.confirmationId,actorId:approved.actorId,approvedAt:approved.approvedAt,reference:approved.reference,termId,contentHash:approved.contentHash,purpose:approved.releasePurpose,proposalHash:contentHash,academicDecision:false}));
  const report=await c.once("policy-release-v1",{origin:"USER_APPROVED_SYNTHETIC_POLICY",approvedBundleHash:approved.contentHash},async(tx)=>{
    const term=await tx.thesisTerm.findUnique({where:{id:termId},include:{phases:true}});assert.equal(term.code,"NGUON80-2026");
    const grants=await tx.academicTermGrant.findUnique({where:{userId_termId:{userId:c.faculty.userId,termId}},include:{pr2bGrantDepartmentGrantId:true}});
    const user=await tx.userAccount.findUnique({where:{id:c.faculty.userId},include:{userRoles:{include:{role:true}}}});
    const areas=await tx.researchAreaWorkflow.findMany({where:{researchAreaId:{in:read("routing-report.json").results.map(r=>r.researchAreaId)}}});
    const departmentIds=[...new Set(areas.map(a=>a.departmentId))];assert.ok(departmentIds.length===3&&departmentIds.every(Boolean));
    for(const room of draft.rooms){assert.equal(await tx.room.findFirst({where:{OR:[{id:room.id},{code:room.code}]}}),null,"Catalog room already exists outside this release");await tx.room.create({data:room});}
    for(const criterion of draft.rubricCatalog){assert.equal(await tx.rubricCriteria.findUnique({where:{id:criterion.id}}),null,"Rubric already exists outside this release");await tx.rubricCriteria.create({data:criterion});}
    const approvalMarker=await tx.auditLog.findUnique({where:{id:markerId(c.dataset.datasetId,"operation:policy-approval-v1")}});assert.equal(approvalMarker?.newValue?.datasetId,c.dataset.datasetId);
    const facts={term:{id:termId,code:term.code,status:term.status,departmentIds,purpose:approved.releasePurpose,phases:term.phases.map(p=>({code:p.code,startAt:p.startDate.toISOString(),endAt:p.endDate.toISOString()}))},
      actor:{id:user.id,active:user.status==="ACTIVE",faculty:user.userRoles.some(r=>r.role.name==="FACULTY"),termGrant:!!grants,departmentIds:grants?.allDepartments?departmentIds:grants?.pr2bGrantDepartmentGrantId.map(d=>d.departmentId)||[]},
      approval:approvalMarker.newValue.result,existing:await tx.termParameter.findMany({where:{termId},select:{key:true,value:true}}),
      rubric:(await tx.rubricCriteria.findMany({where:{termId}})).map(r=>({...r,maxScore:String(r.maxScore),weight:String(r.weight)})),rooms:await tx.room.findMany({where:{id:{in:draft.rooms.map(r=>r.id)}},select:{id:true,capacity:true}}),isolation:null};
    const plan=prepare(approved.policies,facts);save("policy-release-preflight.json",plan);assert.ok(plan.ready,"Policy release blocked: "+plan.blockers.join(", "));assert.equal(plan.action,"INSERT_ONLY");
    await tx.termParameter.createMany({data:plan.rows.map(r=>({...r,description:"Người dùng duyệt cấu hình cho dữ liệu tổng hợp NGUON80; không phải quyết định học vụ thật."}))});
    return {termId,contentHash:plan.contentHash,policies:plan.rows.length,rooms:draft.rooms.length,rubricCriteria:draft.rubricCatalog.length,source:"EXPLICIT_USER_APPROVAL",academicDecision:false};
  });
  const rows=await c.db.termParameter.findMany({where:{termId,key:{in:Object.keys(approved.policies)}}});assert.equal(rows.length,9);
  for(const row of rows)assert.equal(hash(JSON.parse(row.value)),hash(approved.policies[row.key]));
  save("policy-release-report.json",{...report,verifiedAt:new Date().toISOString()});console.log(JSON.stringify(report));
}finally{await c.db.$disconnect();}}
if(require.main===module)main().catch(safeError);
