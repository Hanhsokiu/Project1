"use strict";
const assert=require("node:assert/strict");
const {dist,read}=require("./context.cjs"),{runtime}=require("./guidance-runtime.cjs");
function defenseRuntime(db,termId,boundSessions={}){
  const release=read("policy-release-report.json"),approval=read("policy-approval.private.json");
  assert.equal(termId,release.termId);assert.equal(release.contentHash,approval.contentHash);assert.equal(release.policies,9);
  const base=runtime(db),{config,storage}=base;
  // Explicitly approved flags are limited to this runner process. No .env edit.
  for(let uc=17;uc<=25;uc++)config.set(`UC${uc}_WRITES_ENABLED`,"true");
  const make=(file,name,...args)=>new (dist(file+".js",name))(...args);
  // Used only inside the runner's outer Serializable transaction. These are
  // actual backend Session classes, retaining their transaction-local producer
  // caches; committee/reviewer writes, locks and audits still execute normally.
  const bind=(repository,session)=>{if(session){repository.read=fn=>fn(session);repository.write=fn=>fn(session);}return repository;};
  const review=make("topic/proposal-reviews/proposal-review.validator","ProposalReviewValidator"),gv=make("guidance/tasks/guidance.validator","GuidanceValidator",review),fv=make("guidance/final-defense/final-defense.validator","FinalDefenseValidator");
  const final=make("guidance/final-defense/final-defense.service","FinalDefenseService",make("guidance/final-defense/final-defense.repository","FinalDefenseRepository",db),review,fv,make("guidance/submissions/submission.validator","SubmissionValidator"),storage,config,gv);
  const eligibility=make("defense/eligibility/eligibility.service","EligibilityService",make("defense/eligibility/eligibility.repository","EligibilityRepository",db),review,gv,fv,make("defense/eligibility/eligibility.validator","EligibilityValidator"),storage,config);
  const keys=make("defense/committees/committee.validator","CommitteeValidator");
  const committees=make("defense/committees/committee-workflow.service","CommitteeWorkflowService",bind(make("defense/committees/committee.repository","CommitteeRepository",db),boundSessions.committees),eligibility,review,gv,keys,config);
  const reviewers=make("defense/reviewers/reviewer.service","ReviewerService",bind(make("defense/reviewers/reviewer.repository","ReviewerRepository",db),boundSessions.reviewers),committees,review,gv,make("defense/reviewers/reviewer.validator","ReviewerValidator"),keys,config);
  const schedule=make("defense/scheduling/schedule.service","ScheduleService",bind(make("defense/scheduling/schedule.repository","ScheduleRepository",db),boundSessions.schedule),committees,reviewers,review,gv,make("defense/scheduling/schedule.validator","ScheduleValidator"),keys,config);
  const reviewerGrades=make("defense/reviewer-grading/reviewer-grade.service","ReviewerGradeService",bind(make("defense/reviewer-grading/reviewer-grade.repository","ReviewerGradeRepository",db),boundSessions.reviewerGrades),reviewers,schedule,review,gv,make("defense/reviewer-grading/reviewer-grade.validator","ReviewerGradeValidator"),storage,config);
  const committeeGrades=make("defense/committee-grading/committee-grade.service","CommitteeGradeService",bind(make("defense/committee-grading/committee-grade.repository","CommitteeGradeRepository",db),boundSessions.committeeGrades),committees,schedule,reviewers,review,gv,make("defense/committee-grading/committee-grade.validator","CommitteeGradeValidator"),storage,config);
  const advisorGrades=make("defense/final-results/advisor-grade.reader","AdvisorGradeReader",review,gv,fv,storage);
  const sources=make("defense/final-results/final-result.sources","FinalResultSources",committees,reviewers,reviewerGrades,committeeGrades,make("defense/committee-grading/committee-grade.validator","CommitteeGradeValidator"),schedule,advisorGrades);
  const finalResults=make("defense/final-results/final-result.service","FinalResultService",bind(make("defense/final-results/final-result.repository","FinalResultRepository",db),boundSessions.finalResults),sources,review,gv,config);
  const reader=make("report/defense-reporting/report.reader","ReportReader",committees,reviewers,reviewerGrades,committeeGrades,make("defense/committee-grading/committee-grade.validator","CommitteeGradeValidator"),finalResults,advisorGrades,eligibility,schedule,review,gv,make("topic/proposal-dossiers/dossier.validator","DossierValidator",review),config);
  const reports=make("report/defense-reporting/report.service","ReportService",bind(make("report/defense-reporting/report.repository","ReportRepository",db),boundSessions.reports),reader,make("report/defense-reporting/report-templates","ReportTemplates"),make("report/defense-reporting/report-renderer","ReportRenderer",make("topic/proposal-dossiers/dossier-pdf.service","DossierPdfService")),config);
  return {...base,review,gv,final,eligibility,committees,reviewers,schedule,reviewerGrades,committeeGrades,advisorGrades,finalResults,reports};
}
module.exports={defenseRuntime};
