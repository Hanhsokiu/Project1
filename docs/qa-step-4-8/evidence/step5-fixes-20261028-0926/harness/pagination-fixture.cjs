    // Runs only inside the guarded NEW private DB launcher, before baseline hash.
    for(const [resource,action,roles] of [
      ['notification','own',['FACULTY','LECTURER','STUDENT']],
      ['catalog','read',['FACULTY','LECTURER','STUDENT','COMMITTEE']],
      ['term','read',['LECTURER','STUDENT','COMMITTEE']],
      ['lecturer','read',['LECTURER','STUDENT','COMMITTEE']],
      ['assignment','read',['FACULTY','LECTURER','STUDENT']],
    ]){
      const permission=await db.permission.upsert({where:{resource_action:{resource,action}},create:{resource,action},update:{}});
      for(const roleId of roles)await db.rolePermission.upsert({where:{roleId_permissionId:{roleId,permissionId:permission.id}},create:{roleId,permissionId:permission.id},update:{}});
    }
    const sample=await db.proposalVersion.findUniqueOrThrow({where:{id:'v1-student'},include:{pr2bProposalVersionWorkflowVersionId:true}});
    const sampleUser=await db.userAccount.findUniqueOrThrow({where:{id:'student'}});
    for(let n=1;n<=21;n++){
      const tag='page-'+String(n).padStart(2,'0'),studentId='qa-'+tag,topicId='topic-'+tag,proposalId='p-'+tag,versionId='v1-'+tag;
      await db.userAccount.create({data:{id:studentId,username:studentId,email:studentId+'@example.invalid',passwordHash:sampleUser.passwordHash,status:'ACTIVE',mustChangePassword:false,userRoles:{create:{roleId:'STUDENT'}}}});
      await db.student.create({data:{id:studentId,userId:studentId,studentCode:'QA-PAGE-'+String(n).padStart(2,'0'),fullName:'Sinh viên phân trang '+String(n).padStart(2,'0'),trainingSystemId:'qa-training'}});
      await db.termStudent.create({data:{id:'ts-'+tag,studentId,termId:'qa-t1'}});
      await db.registration.create({data:{id:'reg-'+tag,studentId,termId:'qa-t1',advisorAssignments:{create:{advisorId:'advisor',assignmentPlanId:'qa-t1-assign'}}}});
      await db.topic.create({data:{id:topicId,termId:'qa-t1',researchAreaId:'qa-area',title:'Phân trang hồ sơ — '+String(n).padStart(2,'0'),pr2bTopicWorkflowTopicId:{create:{termId:'qa-t1',termStudentId:'ts-'+tag,confirmedTopicRevision:0,confirmedAssignmentRevision:0,confirmedByAdvisorId:'advisor',confirmedAt:new Date()}}}});
      await db.proposal.create({data:{id:proposalId,topicId,termId:'qa-t1',studentId,status:'SUBMITTED'}});
      await db.proposalVersion.create({data:{id:versionId,proposalId,version:1,content:sample.content,pr2bProposalVersionWorkflowVersionId:{create:{state:'SEALED',contentSchemaVersion:1,contentHash:sample.pr2bProposalVersionWorkflowVersionId.contentHash,createdByUserId:studentId,submittedByUserId:studentId,submittedAt:new Date()}}}});
      await db.proposalWorkflow.create({data:{proposalId,workingVersionId:versionId,submittedVersionId:versionId,submissionKind:'INITIAL',nextReviewRound:1,nextVersionNumber:2}});
    }
