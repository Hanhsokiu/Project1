"use strict";
// Independent read-only verification of completed stages. Never trusts counts in reports.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {req,dist,read,save,outputDir,safeError}=require("./context.cjs");
const {environment,targetInfo}=require("./preflight.cjs");
const {loadDataset}=require("./import-students.cjs");
function verifyProposal(p,expected,hash){
  assert.equal(p.studentId,expected.studentId);assert.equal(p.termId,expected.termId);
  const w=p.pr2bProposalWorkflowProposalId;
  for(const v of p.versions){
    const meta=v.pr2bProposalVersionWorkflowVersionId;
    if(meta?.contentHash)assert.equal(hash(v.content),meta.contentHash,"Proposal content changed");
    if(meta?.state==="SEALED")assert.ok(meta.submittedAt&&meta.submittedByUserId,"Sealed version requires submission provenance");
  }
  if(expected.stage!=="TOPIC_AWAITING_ADVISOR")assert.ok(w,"Prepared proposal must have workflow");
  if(expected.stage==="PROPOSAL_SUBMITTED")assert.ok(w.submittedVersionId);
}
function verifyProgressReview(submission,row){
  if(row.stage!=="PROGRESS_REVIEWED")return false;
  const r=submission.pr2bProgressReviewSubmissionId.find(r=>r.id===(row.progressReviewId||row.reviewId));
  assert.ok(r,"Completed guidance requires the recorded progress review");assert.equal(r.decision,"PASS");assert.equal(r.reviewerUserId,row.advisorUserId);return true;
}
async function main(){
  const target=targetInfo(environment()),{dataset}=loadDataset(),{termId}=read("foundation-report.json");
  const optional=name=>fs.existsSync(path.join(outputDir,name))?read(name):null;
  const topics=optional("topics-report.json"),reviews=optional("reviews-report.json"),dossiers=optional("dossiers-report.json"),guidance=optional("guidance-report.json");
  const release=optional("policy-release-report.json"),final=optional("final-reports-report.json"),eligibility=optional("eligibility-report.json"),committees=optional("committees-report.json"),reviewers=optional("reviewers-report.json");
  assert.ok(topics,"Complete topics before verifying workflow");
  const hash=dist("topic/proposal-reviews/proposal-review.validator.js","reviewHash");
  const db=new (req("@prisma/client").PrismaClient)({datasources:{db:{url:target.url}},log:[]});
  try{
    const result=await db.$transaction(async tx=>{
      await tx.$executeRawUnsafe("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
      const proposals=await tx.proposal.findMany({where:{termId},include:{pr2bProposalWorkflowProposalId:true,versions:{include:{pr2bProposalVersionWorkflowVersionId:true}}}});
      assert.equal(proposals.length,68);assert.equal(new Set(proposals.map(p=>p.studentId)).size,68);
      for(const row of topics.results){const p=proposals.find(p=>p.id===row.proposalId);assert.ok(p);verifyProposal(p,{...row,termId},hash);}
      const counts={topics:proposals.length,sealedVersions:proposals.flatMap(p=>p.versions).filter(v=>v.pr2bProposalVersionWorkflowVersionId?.state==="SEALED").length};
      const variety=optional("topic-variety-report.json");
      if(variety){const rows=await tx.topic.findMany({where:{termId},select:{id:true,title:true}});assert.equal(new Set(rows.map(r=>r.title)).size,68);for(const r of variety.results)assert.equal(rows.find(t=>t.id===proposals.find(p=>p.id===r.proposalId)?.topicId)?.title,r.title);counts.distinctTopicTitles=rows.length;}
      if(reviews){
        const decisions=await tx.proposalReviewDecision.findMany({where:{reviewId:{in:reviews.results.map(r=>r.reviewId)}}});
        for(const row of reviews.results){
          const p=proposals.find(p=>p.id===row.proposalId);assert.equal(p.status,row.status);assert.equal(p.pr2bProposalWorkflowProposalId.submittedVersionId,row.versionId);
          const d=decisions.find(d=>d.reviewId===row.reviewId);
          if(row.status==="UNDER_REVIEW"){assert.equal(d,undefined);continue;}
          assert.ok(d);assert.equal(d.id,row.decisionId);assert.equal(d.versionId,row.versionId);assert.equal(d.decidedByUserId,row.reviewerUserId);assert.notEqual(row.reviewerUserId,row.advisorUserId);
          assert.match(d.comment,/TỔNG HỢP/);
        }
        for(const [status,count] of Object.entries({APPROVED:52,REVISION_REQUESTED:4,UNDER_REVIEW:4,DRAFT:8}))assert.equal(proposals.filter(p=>p.status===status).length,count,"Proposal status count: "+status);
        counts.reviewsVerified=reviews.results.length;
      }
      if(dossiers){
        const rows=await tx.dossierFinalization.findMany({where:{proposalId:{in:dossiers.results.map(r=>r.proposalId)}},include:{refPdfAssetId:true,pr2bDossierReceiptFinalizationId:true,pr2bDossierWorkflowCurrentFinalizationId:true}});
        assert.equal(rows.length,48);
        for(const row of dossiers.results){const d=rows.find(d=>d.id===row.finalizationId);assert.ok(d);assert.equal(d.versionId,row.versionId);assert.equal(d.supersededAt,null);assert.equal(d.refPdfAssetId.checksum,row.pdfChecksum);assert.equal(d.refPdfAssetId.state,"READY");assert.equal(d.pr2bDossierWorkflowCurrentFinalizationId.state,"RECEIVED");assert.match(d.pr2bDossierReceiptFinalizationId.note,/TỔNG HỢP/);}
        counts.receivedDossiers=rows.length;
      }
      if(guidance){
        const plans=await tx.guidancePlan.findMany({where:{proposalId:{in:guidance.results.map(r=>r.proposalId)}},include:{tasks:{include:{pr2bTaskWorkflowTaskId:true,submissions:{include:{pr2bSubmissionAssetSubmissionId:{include:{refFileId:true}},pr2bProgressReviewSubmissionId:true}}}},meetings:true}});
        assert.equal(plans.length,44);let submitted=0,passed=0,files=0;
        for(const row of guidance.results){const p=plans.find(p=>p.id===row.planId);assert.ok(p);assert.equal(p.advisorId,row.advisorId);assert.ok(p.meetings.length);const task=p.tasks.find(t=>t.id===row.taskId);assert.ok(task);
          if(row.submissionId){const s=task.submissions.find(s=>s.id===row.submissionId);assert.ok(s);assert.equal(s.pr2bSubmissionAssetSubmissionId.length,2);for(const a of s.pr2bSubmissionAssetSubmissionId){assert.equal(a.refFileId.state,"READY");assert.match(a.refFileId.checksum,/^[a-f0-9]{64}$/);files++;}submitted++;
            if(verifyProgressReview(s,row))passed++;
          }
        }
        assert.equal(submitted,40);assert.equal(passed,36);assert.equal(files,80);Object.assign(counts,{guidancePlans:44,weeklySubmissions:submitted,progressReviews:passed,submissionFiles:files});
      }
      if(release){
        const approval=read("policy-approval.private.json"),policyHash=dist("defense/policies/policy-release.js","policyReleaseHash");
        const rows=await tx.termParameter.findMany({where:{termId,key:{in:Object.keys(approval.policies)}}});assert.equal(rows.length,9);
        for(const p of rows)assert.equal(policyHash(JSON.parse(p.value)),policyHash(approval.policies[p.key]));
        counts.approvedPolicies=9;
      }
      if(final){
        const ids=final.results.map(r=>r.proposalId);
        const reports=await tx.finalReport.findMany({where:{proposalId:{in:ids}},include:{versions:{include:{fileAsset:true}}}});
        const decisions=await tx.defenseConfirmation.findMany({where:{proposalId:{in:ids}}});
        const scores=await tx.scoreEntry.findMany({where:{proposalId:{in:ids},role:"ADVISOR"}});
        assert.equal(reports.length,32);assert.equal(decisions.length,28);assert.equal(scores.length,28);
        for(const row of final.results){
          const report=reports.find(r=>r.proposalId===row.proposalId);assert.ok(report);assert.equal(report.versions.length,1);
          const version=report.versions[0];assert.equal(version.id,row.finalReportVersionId);assert.equal(version.fileAsset.checksum,row.finalReportChecksum);assert.equal(version.fileAsset.state,"READY");
          assert.ok(version.fileAsset.sizeBytes>0);assert.match(version.fileAsset.originalName,/tong-hop/);
          const decision=decisions.find(r=>r.proposalId===row.proposalId),score=scores.find(r=>r.proposalId===row.proposalId);
          if(row.stage==="ADVISOR_CONFIRMED"){
            assert.ok(decision&&score);assert.equal(decision.status,"CONFIRMED");assert.equal(decision.advisorId,row.advisorId);assert.equal(decision.reportVersionId,version.id);assert.match(decision.note,/TỔNG HỢP/);
            assert.equal(score.scorerId,row.advisorId);assert.equal(score.reportVersionId,version.id);assert.match(score.comment,/TỔNG HỢP/);assert.equal(Number(score.totalScore),7+Number(row.studentCode.slice(-2))%20/10);
          }else{assert.equal(decision,undefined);assert.equal(score,undefined);}
        }
        Object.assign(counts,{finalReports:reports.length,advisorConfirmations:decisions.length});
      }
      if(eligibility){
        const rows=await tx.defenseEligibility.findMany({where:{proposalId:{in:eligibility.results.map(r=>r.proposalId)}}});assert.equal(rows.length,28);
        const facultyId=read("faculty-report.json").userId;
        for(const expected of eligibility.results){const r=rows.find(r=>r.proposalId===expected.proposalId);assert.ok(r);assert.equal(r.status,"ELIGIBLE");assert.equal(r.finalizedBy,facultyId);assert.ok(r.finalizedAt);assert.equal(r.context.termStudentId,expected.termStudentId);assert.equal(r.context.academic.evidence.source,"SOURCE80_ACADEMIC");assert.equal(r.context.academic.evidence.outcome,"PASS");assert.match(r.note,/TỔNG HỢP/);}
        counts.finalizedEligibility=rows.length;
      }
      if(committees){
        const rows=await tx.defenseCommittee.findMany({where:{termId},include:{members:{orderBy:{lecturerId:"asc"}},studentAssignments:{where:{state:"ACTIVE"},orderBy:{termStudentId:"asc"}}}});assert.equal(rows.length,committees.results.length);
        const events=await tx.auditLog.findMany({where:{resource:"defense-committee",resourceId:{in:rows.map(r=>r.id)},action:"COMMITTEE_FINALIZED"}}),facultyId=read("faculty-report.json").userId;
        let assigned=0;const allStudents=new Set();
        for(const expected of committees.results){const r=rows.find(r=>r.id===expected.id);assert.ok(r);assert.equal(r.state,"FINALIZED");assert.ok(r.finalizedAt);assert.equal(r.revision,expected.revision);assert.equal(r.finalizedBy,facultyId);assert.equal(r.context.contentHash,expected.evidenceHash);assert.equal(r.members.length,4);assert.equal(r.members.filter(m=>m.role==="CHAIR").length,1);assert.equal(r.members.filter(m=>m.role==="SECRETARY").length,1);assert.deepEqual(r.studentAssignments.map(a=>a.termStudentId).sort(),[...expected.students].sort());
          const snapshot={...r,members:r.members.map(m=>({committeeId:m.committeeId,lecturerId:m.lecturerId,role:m.role}))};
          assert.ok(events.some(e=>e.resourceId===r.id&&e.userId===facultyId&&hash(e.newValue?.snapshot??null)===hash(snapshot)),"Finalized committee must match its actual audit snapshot");
          for(const a of r.studentAssignments){const owner=eligibility.results.find(e=>e.termStudentId===a.termStudentId);assert.ok(owner);assert.equal(a.proposalId,owner.proposalId);assert.ok(!r.members.some(m=>m.lecturerId===owner.advisorId));assert.ok(!allStudents.has(a.termStudentId));allStudents.add(a.termStudentId);assigned++;}
        }assert.equal(assigned,24);Object.assign(counts,{finalizedCommittees:rows.length,committeeStudents:assigned});
      }
      if(reviewers){
        const rows=await tx.reviewerAssignment.findMany({where:{termId},orderBy:[{proposalId:"asc"},{reviewerId:"asc"}]});assert.equal(rows.length,20);assert.ok(rows.every(r=>r.selected));
        const events=await tx.auditLog.findMany({where:{resource:"defense-reviewer",resourceId:{in:reviewers.results.map(r=>r.termStudentId)},action:"REVIEWERS_FINALIZED"}}),facultyId=read("faculty-report.json").userId;
        for(const expected of reviewers.results){const r=rows.find(r=>r.termStudentId===expected.termStudentId);assert.ok(r);assert.equal(r.state,"FINALIZED");assert.ok(r.finalizedAt);assert.equal(r.finalizedBy,facultyId);assert.equal(r.id,expected.reviewerBinding.assignmentId);assert.equal(r.revision,expected.reviewerBinding.revision);assert.equal(r.reviewerId,expected.reviewerId);assert.notEqual(r.reviewerId,expected.advisorId);assert.equal(r.proposalId,expected.proposalId);assert.equal(r.committeeId,expected.committeeId);
          assert.ok(events.some(e=>e.resourceId===r.termStudentId&&e.userId===facultyId&&e.newValue?.revision===r.revision&&e.newValue?.snapshotHash===hash(rows.filter(x=>x.proposalId===r.proposalId))),"Finalized reviewer must match its actual audit snapshot");
        }
        counts.finalizedReviewers=rows.length;
      }
      return counts;
    },{timeout:120000});
    const report={operation:"READ_ONLY",datasetId:dataset.datasetId,termId,projectRef:target.projectRef,verifiedAt:new Date().toISOString(),...result,httpVerified:false,uiVerified:false,fullWorkflowComplete:false};save("workflow-verification.json",report);console.log(JSON.stringify(report,null,2));
  }finally{await db.$disconnect();}
}
module.exports={verifyProposal,verifyProgressReview};
if(require.main===module)main().catch(safeError);
