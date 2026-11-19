"use strict";
const fs=require("node:fs"),path=require("node:path");
const {req,read,save,outputDir,safeError}=require("./context.cjs"),{environment,targetInfo}=require("./preflight.cjs");
function verificationEvidence(){
  const optional=name=>fs.existsSync(path.join(outputDir,name))?read(name):null;
  const http=optional("http-verification.json"),guidanceHttp=optional("http-guidance-verification.json"),ui=optional("ui-verification.json"),workflow=optional("workflow-verification.json"),defense=optional("defense-verification.json");
  return {
    http:http?{verifiedAt:http.verifiedAt,report:"http-verification.json",scope:"Login/me/terms/logout for three roles; see report for individual statuses"}:null,
    guidanceHttp:guidanceHttp?{...guidanceHttp,report:"http-guidance-verification.json"}:null,
    ui:ui?{verifiedAt:ui.verifiedAt,passed:ui.passed!==false&&ui.guidancePlanRendered===true&&(!ui.eligibility||ui.eligibility.fullScreenVerified===true),loginUi:ui.loginUi===true,guidancePlanRendered:ui.guidancePlanRendered===true,finalReport:ui.finalReport||null,eligibility:ui.eligibility||null,fullWorkflowUiVerified:false,report:"ui-verification.json"}:null,
    workflow:workflow?{verifiedAt:workflow.verifiedAt,topics:workflow.topics,receivedDossiers:workflow.receivedDossiers,guidancePlans:workflow.guidancePlans,finalReports:workflow.finalReports,finalizedEligibility:workflow.finalizedEligibility,finalizedCommittees:workflow.finalizedCommittees,finalizedReviewers:workflow.finalizedReviewers,report:"workflow-verification.json"}:null,
    defense:defense?{...defense,report:"defense-verification.json"}:null,
    allPlannedDataStagesComplete:!!(workflow&&defense&&workflow.datasetId===defense.datasetId&&workflow.termId===defense.termId&&defense.allPlannedDefenseStagesComplete&&workflow.finalizedReviewers===20),
    fullWorkflowVerified:false,
  };
}
async function main(){const env=environment(),target=targetInfo(env),{termId}=read("foundation-report.json"),db=new (req("@prisma/client").PrismaClient)({datasources:{db:{url:target.url}},log:[]});try{
  const status=await db.$transaction(async tx=>{
    await tx.$executeRawUnsafe("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
    const term=await tx.thesisTerm.findUnique({where:{id:termId},select:{code:true,status:true,phases:{select:{code:true,startDate:true,endDate:true,isLocked:true}}}});
    const registrations=await tx.registration.groupBy({by:["status"],where:{termId},_count:true});
    const proposals=await tx.proposal.groupBy({by:["status"],where:{termId},_count:true});
    const plans=await tx.assignmentPlan.findMany({where:{termId},select:{status:true,revision:true,_count:{select:{advisorAssignments:true}}}});
    const parameters=await tx.termParameter.findMany({where:{termId,key:{in:Array.from({length:9},(_,i)=>`UC${17+i}_POLICY`)}},select:{key:true}});
    const actions=await tx.auditLog.count({where:{resource:"source-dataset",resourceId:read("foundation-report.json").datasetId,action:"SOURCE_DATASET_OPERATION"}});
    const dossierCount=await tx.thesisDossier.count({where:{proposal:{termId}}});
    const proposalIds=(await tx.proposal.findMany({where:{termId},select:{id:true}})).map(p=>p.id);
    const finalReports=await tx.finalReport.count({where:{proposalId:{in:proposalIds},versions:{some:{}}}});
    const confirmations=await tx.defenseConfirmation.groupBy({by:["status"],where:{proposalId:{in:proposalIds}},_count:true});
    const eligibility=await tx.defenseEligibility.groupBy({by:["status"],where:{proposalId:{in:proposalIds},finalizedAt:{not:null}},_count:true});
    const committees=await tx.defenseCommittee.groupBy({by:["state"],where:{termId},_count:true});
    const reviewers=await tx.reviewerAssignment.count({where:{termId,state:"FINALIZED",selected:true}});
    return {term,registrations,assignmentPlans:plans,proposals,dossiers:dossierCount,policyKeys:parameters.map(p=>p.key),finalReports,advisorConfirmations:confirmations,finalizedEligibility:eligibility,committees,finalizedReviewers:reviewers,completedOperationMarkers:actions};
  },{timeout:120000});
  const result={operation:"READ_ONLY",termId,projectRef:target.projectRef,verifiedAt:new Date().toISOString(),...status,
    environment:{storageDriver:env.STORAGE_GUIDANCE_DRIVER||"local",guidanceUploadEnabled:env.GUIDANCE_UPLOAD_ENABLED!=="false",configuredWriteFlagNames:Object.keys(env).filter(k=>/WRITE.*ENABLED|ENABLED.*WRITE/.test(k)).map(k=>({key:k,enabled:env[k]==="true"}))},verification:verificationEvidence()};
  save("workflow-status.json",result);console.log(JSON.stringify(result,null,2));
}finally{await db.$disconnect();}}
if(require.main===module)main().catch(safeError);
