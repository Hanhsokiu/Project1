"use strict";
// Local inspection server: real AppModule, controllers, JWT and RBAC; no scheduled jobs.
const assert=require("node:assert/strict"),path=require("node:path"),fs=require("node:fs");
const {root,outputDir,req,dist,read,safeError}=require("./context.cjs"),{environment,targetInfo}=require("./preflight.cjs");
async function main(){
  const env=environment(),target=targetInfo(env),index=process.argv.indexOf("--project-ref");assert.ok(index>=0&&process.argv[index+1]===target.projectRef);
  process.chdir(path.join(root,"backend"));Object.assign(process.env,env,{DATABASE_URL:target.url,EMAIL_WORKER_ENABLED:"false"});
  process.env.STORAGE_LOCAL_PATH=path.resolve(root,"backend",env.STORAGE_LOCAL_PATH||"./uploads");
  for(let uc=17;uc<=25;uc++)process.env[`UC${uc}_WRITES_ENABLED`]="false";
  if(fs.existsSync(path.join(outputDir,"policy-release-report.json"))){const release=read("policy-release-report.json"),approval=read("policy-approval.private.json");assert.equal(release.contentHash,approval.contentHash);assert.equal(release.policies,9);for(let uc=17;uc<=25;uc++)process.env[`UC${uc}_WRITES_ENABLED`]="true";}
  req("reflect-metadata");
  const {Test}=req("@nestjs/testing"),App=dist("app.module.js","AppModule"),builder=Test.createTestingModule({imports:[App]});
  for(const [file,name] of [["registration/service/assignment-scheduler.service.js","AssignmentSchedulerService"],["notification/service/email-worker.service.js","EmailWorkerService"],["guidance/weekly/weekly-notification.worker.js","WeeklyNotificationWorker"]])builder.overrideProvider(dist(file,name)).useValue({});
  const module=await builder.compile(),app=module.createNestApplication({logger:false,bodyParser:false});
  // Prevent the shared DB's unrelated upload cleanup from running in this inspection process.
  module.get(dist("guidance/submissions/submission.service.js","SubmissionService")).cleanup=async()=>undefined;
  dist("common/http/deny-acceptance-tools.js","denyAcceptanceTools")(app,"api");
  dist("common/http/body-parsers.js","configureBodyParsers")(app,"api");
  app.setGlobalPrefix("api");app.enableCors({origin:["http://127.0.0.1:5183","http://localhost:5183"],credentials:true});
  app.useGlobalPipes(new (req("@nestjs/common").ValidationPipe)({whitelist:true,transform:true}));
  app.useGlobalFilters(new (dist("common/exception/global-exception.handler.js","GlobalExceptionHandler"))());
  await app.init();const registry=app.get(req("@nestjs/schedule").SchedulerRegistry);
  assert.equal(registry.getIntervals().length,0,"Inspection server must not run background jobs");assert.equal(registry.getCronJobs().size,0);
  await app.listen(3011,"127.0.0.1");console.log(JSON.stringify({api:"http://127.0.0.1:3011/api",projectRef:target.projectRef,scheduledJobs:0,realAuthentication:true}));
  const close=async()=>{await app.close();process.exit(0);};process.on("SIGINT",close);process.on("SIGTERM",close);
}
if(require.main===module)main().catch(safeError);
