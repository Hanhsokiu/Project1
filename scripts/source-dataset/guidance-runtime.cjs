"use strict";
const path=require("node:path");
const {dist,req,root}=require("./context.cjs");
const {environment}=require("./preflight.cjs");
function runtime(db){
  const env=environment();
  // Resolve the existing backend-relative storage location exactly as the server does.
  env.STORAGE_LOCAL_PATH=path.resolve(root,"backend",env.STORAGE_LOCAL_PATH||"./uploads");
  const config=new (req("@nestjs/config").ConfigService)(env);
  // ConfigService reads process.env before its internal values. Pin the resolved
  // location in this process so launching from the repo root cannot change it.
  config.set("STORAGE_LOCAL_PATH",env.STORAGE_LOCAL_PATH);
  const make=(file,name,...args)=>new (dist(file+".js",name))(...args);
  const review=make("topic/proposal-reviews/proposal-review.validator","ProposalReviewValidator"),gv=make("guidance/tasks/guidance.validator","GuidanceValidator",review);
  const guidance=make("guidance/tasks/guidance.service","GuidanceService",make("guidance/tasks/guidance.repository","GuidanceRepository",db),gv,review);
  const storage=make("common/storage/file-storage.service","FileStorageService",config);
  const submissions=make("guidance/submissions/submission.service","SubmissionService",make("guidance/submissions/submission.repository","SubmissionRepository",db),guidance,gv,review,make("guidance/submissions/submission.validator","SubmissionValidator"),storage,config);
  const weekly=make("guidance/weekly/weekly.service","WeeklyService",make("guidance/weekly/weekly.repository","WeeklyRepository",db),gv,review,submissions);
  const progress=make("guidance/reviews/progress-review.service","ProgressReviewService",make("guidance/reviews/progress-review.repository","ProgressRepository",db),guidance,gv,review,make("guidance/reviews/progress-review.validator","ProgressReviewValidator"),submissions);
  return {guidance,weekly,submissions,progress,storage,config};
}
module.exports={runtime};
