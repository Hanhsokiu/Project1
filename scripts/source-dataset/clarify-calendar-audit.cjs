"use strict";
// Append a clarification for an obsolete date label; preserve the original event.
const assert=require("node:assert/strict");
const {context,dist,read,save,safeError}=require("./context.cjs");
async function main(){const c=await context();try{
  const proposal=read("policy-proposal.json"),{termId}=proposal;
  const result=await c.once("calendar-audit-clarification-v1",{origin:"SYNTHETIC_DATA_CORRECTION",proposalHash:proposal.contentHash},async(tx)=>{
    const event=await tx.auditLog.findFirst({where:{resource:"term",resourceId:termId,action:"SAVE_TERM_PHASES"},orderBy:{createdAt:"desc"}});
    assert.ok(event);const phase=await tx.termPhase.findFirst({where:{termId,code:"DEFENSE"}});assert.equal(phase.startDate.toISOString(),proposal.proposedDefenseStart);
    if(!String(event.newValue?.changeReason).includes("lịch 18/11"))return {needed:false};
    const note={correctedEventId:event.id,field:"changeReason",obsoleteLabel:"18/11",approvedDefenseDate:proposal.policies.UC21_POLICY.allowedDates[0],actualDefenseStart:phase.startDate.toISOString(),reason:"Runner đã nạp nhãn lịch cũ trước khi sửa mã; mốc giai đoạn thực tế và cấu hình đã dùng đúng lịch 19/11 được người dùng duyệt. Giữ nguyên sự kiện gốc và bổ sung đính chính này."};
    const Audit=dist("common/audit/audit.service.js","AuditService");await new Audit(tx).log({userId:c.faculty.userId,action:"SOURCE_DATASET_CALENDAR_LABEL_CLARIFIED",resource:"term",resourceId:termId,newValue:note},tx);
    return {needed:true,...note};
  });save("calendar-audit-clarification.json",result);console.log(JSON.stringify({clarified:result.needed,originalEventPreserved:true,phaseDatesChanged:false}));
}finally{await c.db.$disconnect();}}
if(require.main===module)main().catch(safeError);
