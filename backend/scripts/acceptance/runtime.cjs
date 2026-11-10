'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn,spawnSync}=require('node:child_process');
const {root,backend,cache,localOnly,docker}=require('./local.cjs');
const NativeDate=Date;
let virtual=null,pgClockContainer=null,activeClockFile=null;
function clock(iso){const target=iso===null?null:Math.ceil(NativeDate.parse(iso)/1000)*1000;assert(target===null||Number.isFinite(target));const normalized=target===null?null:new NativeDate(target).toISOString();if(pgClockContainer)require('./clocked-staging.cjs').setClock(pgClockContainer,normalized);virtual=target;if(activeClockFile)fs.writeFileSync(activeClockFile,JSON.stringify({iso:normalized,scope:'APPLICATION_AND_OWNED_PG17_ONLY',realStoredAt:new NativeDate().toISOString()}));}
function installClock(){
 // Test clock exists ONLY in the isolated app; the owned PG17 container uses the same timestamp file.
 global.Date=class AcceptanceDate extends NativeDate{
  constructor(...args){super(...(args.length?args:[virtual===null?NativeDate.now():virtual]));}
  static now(){return virtual===null?NativeDate.now():virtual;}
 };
}
async function createRuntime(runId,mode,port=0){
 assert.notEqual(process.env.NODE_ENV,'production','Acceptance runtime cannot start in production');
 const branch=spawnSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8',windowsHide:true}).stdout.trim();
 if(branch!=='feature/b9-b10-implementation'){
  const expected=process.env.DATN_ACCEPTANCE_REVIEW_MAIN;
  assert(branch===''&&/^[a-f0-9]{40}$/.test(expected||'')&&fs.statSync(path.join(root,'.git')).isFile(),'Explicit isolated review worktree required');
  assert.equal(spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).stdout.trim(),expected);
 }
 assert(['auto','manual'].includes(mode));const secret=require('./vault.cjs').read(runId),url=secret.urls[mode];localOnly(url);
 const manifest=require(path.join(cache,runId,'manifest.json')),container=manifest.containers?.[mode]?.container||manifest.container;assert.equal(docker(['inspect','--format','{{index .Config.Labels "datn.acceptance"}}',container]),runId);pgClockContainer=manifest.containers?.[mode]?.container||null;
 require('./runtime-safety.cjs').assertStagingTarget({environment:process.env.NODE_ENV,runId,mode,url,database:manifest.databases[mode],label:runId,binding:docker(['port',container,'5432'])});
 Object.assign(process.env,{DATABASE_URL:url,DIRECT_URL:url,NODE_ENV:'test',JWT_SECRET:secret.jwt,JWT_REFRESH_SECRET:secret.refresh,API_PREFIX:'api',STORAGE_LOCAL_PATH:path.join(cache,runId,'storage-'+mode),GUIDANCE_UPLOAD_ENABLED:'true',MAIL_HOST:'127.0.0.1',MAIL_PORT:'9',SMTP_HOST:'127.0.0.1',SMTP_PORT:'9'});
 delete process.env.GUIDANCE_UPLOAD_POLICY_JSON;
 for(let i=17;i<=25;i++)process.env['UC'+i+'_WRITES_ENABLED']='true';
 installClock();const clockFile=path.join(cache,runId,'clock-'+mode+'.json');activeClockFile=clockFile;if(fs.existsSync(clockFile))clock(JSON.parse(fs.readFileSync(clockFile)).iso);require('reflect-metadata');
 const {Test}=require('../../node_modules/@nestjs/testing'),{ValidationPipe}=require('../../node_modules/@nestjs/common'),{SchedulerRegistry}=require('../../node_modules/@nestjs/schedule');
 const {AppModule}=require('../../dist/app.module'),{AssignmentSchedulerService}=require('../../dist/registration/service/assignment-scheduler.service'),{EmailWorkerService}=require('../../dist/notification/service/email-worker.service'),{WeeklyNotificationWorker}=require('../../dist/guidance/weekly/weekly-notification.worker'),{SubmissionService}=require('../../dist/guidance/submissions/submission.service'),{PrismaService}=require('../../dist/prisma/prisma.service');
 const module=await Test.createTestingModule({imports:[AppModule]}).overrideProvider(AssignmentSchedulerService).useValue({}).overrideProvider(EmailWorkerService).useValue({}).overrideProvider(WeeklyNotificationWorker).useValue({}).compile();module.get(SubmissionService).cleanup=async()=>undefined;
 const app=module.createNestApplication({logger:false,bodyParser:false});require('../../dist/common/http/body-parsers').configureBodyParsers(app,'api');app.setGlobalPrefix('api');app.enableCors({origin:['http://127.0.0.1:5180','http://localhost:5180'],credentials:true});app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true}));
 const {GlobalExceptionHandler}=require('../../dist/common/exception/global-exception.handler');
 class StagingExceptionHandler extends GlobalExceptionHandler {catch(error,host){if(error?.code?.startsWith('P')){let reason=String(error.meta?.database_error||error.meta?.message||'').match(/(?:ERROR:|message: ")([^\n"]{1,250})/)?.[1]||'';if(/password|token|secret|postgres(?:ql)?:\/\//i.test(reason))reason='REDACTED';fs.writeFileSync(path.join(cache,runId,'last-db-error-'+mode+'.json'),JSON.stringify({code:error.code,model:error.meta?.modelName,databaseCode:error.meta?.code,reason,productionConnected:false}));}return super.catch(error,host);}}
 app.useGlobalFilters(new StagingExceptionHandler());
 const status=()=>({kind:'ISOLATED_STAGING_TEST',runId,mode,productionConnected:false,realTime:new NativeDate().toISOString(),testClock:new Date().toISOString(),businessWrites:'TEST_DATABASE_ONLY',backgroundWorkers:0,storage:'private local filesystem retained across restart'});
 app.getHttpAdapter().get('/api/acceptance/status',(_req,res)=>res.json(status()));
 // Clock advancement is a local staging operation. Never present in AppModule/Render/shared-db preview.
 const jwt=module.get(require('../../node_modules/@nestjs/jwt').JwtService);
 const db=module.get(PrismaService);
 app.getHttpAdapter().post('/api/acceptance/clock',async(req,res)=>{
  try{
   if(!['http://127.0.0.1:5180','http://localhost:5180'].includes(req.headers.origin))return res.sendStatus(403);
   const token=String(req.headers.authorization||'').replace(/^Bearer /,'');const p=await jwt.verifyAsync(token),session=await db.loginSession.findUnique({where:{id:p.sid}}),actor=await db.userAccount.findUnique({where:{id:p.sub},include:{userRoles:{include:{role:true}}}});
   assert(session?.userId===p.sub&&!session.revokedAt&&session.expiresAt>new Date());assert(actor?.status==='ACTIVE'&&actor.username.startsWith('acpt_')&&actor.userRoles.some(r=>r.role.name==='FACULTY'));
   const term=await db.thesisTerm.findUnique({where:{id:req.body?.termId},include:{phases:true}});assert(term?.code.startsWith(runId.toUpperCase()));const phase=term.phases.find(p=>p.code===req.body?.phase);assert(phase);
   if(['PROPOSAL','PROPOSAL_REVIEW'].includes(phase.code)){
    const workflow=await db.termWorkflow.findUnique({where:{termId:term.id}}),plan=workflow?.officialAssignmentPlanId?await db.assignmentPlan.findUnique({where:{id:workflow.officialAssignmentPlanId},include:{pr2bAssignmentPlanWorkflowPlanId:true}}):null;
    if(plan?.status!=='FINALIZED'||!plan.pr2bAssignmentPlanWorkflowPlanId?.finalizedAt||!plan.pr2bAssignmentPlanWorkflowPlanId?.finalizedByUserId)return res.status(409).json({error:'STAGING_ASSIGNMENT_NOT_FINALIZED',message:'Cần hoàn tất và chốt phân công GVHD B3 trước khi chuyển đồng hồ TEST sang PROPOSAL.'});
   }
   assert(phase.endDate.getTime()>Date.now(),'Cannot rewind a completed staging phase');const desired=Math.max(Date.now(),phase.startDate.getTime()+(phase.code==='DEFENSE'?8*3600000:0)+60000);clock(new NativeDate(desired).toISOString());fs.writeFileSync(clockFile,JSON.stringify({iso:new Date().toISOString(),termId:term.id,phase:phase.code,changedBy:actor.id,realChangedAt:new NativeDate().toISOString()}));await db.auditLog.create({data:{userId:actor.id,action:'ACCEPTANCE_CLOCK_ADVANCED',resource:'term',resourceId:term.id,newValue:{runId,phase:phase.code,testClock:new Date().toISOString(),realTime:new NativeDate().toISOString(),stagingOnly:true}}});res.json(status());
  }catch{res.status(403).json({error:'STAGING_CLOCK_CHANGE_DENIED'});}
 });
 await app.init();assert.equal(module.get(SchedulerRegistry).getIntervals().length,0);const [identity]=await db.$queryRawUnsafe('SELECT current_database() AS name');assert.equal(identity.name,manifest.databases[mode]);if(pgClockContainer){const [time]=await db.$queryRawUnsafe('SELECT extract(epoch FROM now())::double precision AS seconds');assert(Math.abs(time.seconds-Date.now()/1000)<2,'PG17/application test clocks diverged');}
 await app.listen(port,'127.0.0.1');
 return {app,module,db,secret,manifest,status,clock,service:(file,name)=>module.get(require('../../dist/'+file)[name]),api:'http://127.0.0.1:'+app.getHttpServer().address().port+'/api'};
}
async function serve(){const runId=require(path.join(cache,'latest.json')).runId,r=await createRuntime(runId,'manual',3080);
 const frontendEnv={};for(const k of ['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','COMSPEC','PATHEXT','NUMBER_OF_PROCESSORS','PROCESSOR_ARCHITECTURE'])if(process.env[k])frontendEnv[k]=process.env[k];Object.assign(frontendEnv,{VITE_API_URL:'/api',VITE_AUTH_API:'true',VITE_ACCEPTANCE_STAGING:'true',DATN_PREVIEW_API_TARGET:'http://127.0.0.1:3080'});
 const frontend=spawn(process.execPath,[path.join(root,'frontend/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5180','--strictPort'],{cwd:path.join(root,'frontend'),env:frontendEnv,windowsHide:true,stdio:'ignore'});frontend.on('exit',()=>r.app.close().finally(()=>process.exit(1)));
 fs.writeFileSync(path.join(cache,runId,'running.json'),JSON.stringify({pid:process.pid,frontendPid:frontend.pid,url:'http://127.0.0.1:5180/login',backend:r.api,...r.status()},null,2)+'\n');console.log(JSON.stringify(r.status()));
 const stop=async()=>{frontend.kill();await r.app.close();process.exit(0);};process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
async function main(){
 if(process.argv.includes('--start')){const child=spawn(process.execPath,[__filename,'--serve'],{cwd:backend,detached:true,windowsHide:true,stdio:'ignore'});child.unref();console.log(JSON.stringify({status:'STAGING_START_REQUESTED',pid:child.pid,url:'http://127.0.0.1:5180/login'}));return;}
 return serve();
}
if(require.main===module)main().catch(()=>{console.error('STAGING_PREVIEW_FAILED_NO_SHARED_DATABASE_WRITES');process.exitCode=1;});
module.exports={createRuntime,clock,NativeDate};
