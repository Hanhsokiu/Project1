'use strict';
// Local-only branch preview; mutating business APIs and every registered background interval are disabled.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawn,spawnSync}=require('node:child_process'),net=require('node:net');
const root=path.resolve(__dirname,'../..'),backend=path.join(root,'backend'),out=path.join(root,'.cache/web-readiness');
function allowed(method,raw){
 let p;try{p=decodeURIComponent(new URL(raw,'http://preview.invalid').pathname);}catch{return false;}
 if(method==='OPTIONS')return true;
 if(method==='POST')return ['/api/auth/login','/api/auth/refresh','/api/auth/logout'].includes(p);
 return ['GET','HEAD'].includes(method)&&!/(?:^|\/)(?:pdf|download|export|exports|files|assets|print)(?:[\/_.-]|$)/i.test(p);
}
function free(port){return new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(port,'127.0.0.1',()=>s.close(resolve));});}
async function serve(){
 const branch=spawnSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8',windowsHide:true});assert.equal(branch.stdout.trim(),'feature/b9-b10-implementation');
 await free(3000);await free(5173);
 const cfg={},backendFileKeys=[];for(const line of fs.readFileSync(path.join(backend,'.env'),'utf8').split(/\r?\n/)){const m=/^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());if(m){cfg[m[1]]=m[2].replace(/^(["'])(.*)\1$/,'$2');backendFileKeys.push(m[1]);}}Object.assign(cfg,process.env);
 for(let n=17;n<=25;n++)assert.notEqual(cfg['UC'+n+'_WRITES_ENABLED'],'true','Do not start preview with a write flag enabled');
 const target=require(path.join(root,'.cache/uc17-24-rehearsal/uc1724-1794215028918-cc0b4a29/supabase-preflight.json')).target;
 const checkTarget=value=>{const u=new URL(value);assert.equal(u.hostname,target.host);assert.equal(u.pathname,'/postgres');assert.equal(decodeURIComponent(u.username),target.connectionUser);assert(['5432','6543'].includes(u.port));return u.port==='6543'?'Supavisor Transaction 6543':'Supavisor Session 5432';};
 const endpoint=checkTarget(cfg.DATABASE_URL);checkTarget(cfg.DIRECT_URL);
 const compiled=path.join(backend,'dist/report/defense-reporting/report.reader.js');assert(fs.existsSync(compiled));assert(fs.readFileSync(compiled,'utf8').includes('committeeAllowed'),'Rebuild backend with department-scoped report options first');
 // Capture a frontend environment before Nest ConfigModule loads backend secrets into process.env.
 const frontendEnv={...process.env};for(const key of Object.keys(frontendEnv))if(backendFileKeys.includes(key)||/DATABASE_URL|DIRECT_URL|JWT_SECRET|SMTP_PASSWORD|SERVICE_ROLE/i.test(key))delete frontendEnv[key];frontendEnv.VITE_API_URL='/api';
 require('reflect-metadata');
 const {Test}=require('../node_modules/@nestjs/testing');
 const {ConfigService}=require('../node_modules/@nestjs/config');
 const {ValidationPipe}=require('../node_modules/@nestjs/common');
 const {SchedulerRegistry}=require('../node_modules/@nestjs/schedule');
 const {AppModule}=require('../dist/app.module');
 const {AssignmentSchedulerService}=require('../dist/registration/service/assignment-scheduler.service');
 const {EmailWorkerService}=require('../dist/notification/service/email-worker.service');
 const {WeeklyNotificationWorker}=require('../dist/guidance/weekly/weekly-notification.worker');
 const {SubmissionService}=require('../dist/guidance/submissions/submission.service');
 const {PrismaService}=require('../dist/prisma/prisma.service');
 const {configureBodyParsers}=require('../dist/common/http/body-parsers');
 const {GlobalExceptionHandler}=require('../dist/common/exception/global-exception.handler');
 const module=await Test.createTestingModule({imports:[AppModule]})
  .overrideProvider(AssignmentSchedulerService).useValue({})
  .overrideProvider(EmailWorkerService).useValue({})
  .overrideProvider(WeeklyNotificationWorker).useValue({})
  .compile();
 // Replace the cleanup method BEFORE bootstrap, removing @Interval metadata from the runtime function.
 module.get(SubmissionService).cleanup=async()=>undefined;
 const config=module.get(ConfigService);assert.equal(config.get('API_PREFIX','api'),'api');checkTarget(config.get('DATABASE_URL'));
 const app=module.createNestApplication({bodyParser:false,logger:false});
 app.use((req,res,next)=>{if(!allowed(req.method,req.originalUrl||req.url))return res.status(403).json({success:false,error:{code:'PREVIEW_READ_ONLY',message:'Preview allows GET metadata and login/refresh/logout only.'}});next();});
 configureBodyParsers(app,'api');app.setGlobalPrefix('api');app.enableCors({origin:['http://127.0.0.1:5173','http://localhost:5173'],credentials:true});
 app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true}));app.useGlobalFilters(new GlobalExceptionHandler());
 let previewStatus;
 app.getHttpAdapter().get('/api/preview/status',(_req,res)=>previewStatus?res.json(previewStatus):res.status(503).json({status:'INITIALIZING'}));
 await app.init();assert.equal(module.get(SchedulerRegistry).getIntervals().length,0,'Unexpected background interval');
 const db=module.get(PrismaService);await db.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');const [v]=await tx.$queryRawUnsafe('SELECT current_database() database');assert.equal(v.database,'postgres');});
 const storageRoot=path.resolve(backend,config.get('STORAGE_LOCAL_PATH','./uploads'));
 const status={status:'READY_READ_ONLY_PREVIEW',branch:branch.stdout.trim(),pid:process.pid,frontend:'http://127.0.0.1:5173',backend:'http://127.0.0.1:3000/api',databaseTargetMatched:true,endpoint,backgroundIntervals:0,businessWritesBlocked:true,authenticationWrites:'Login/refresh/logout only, when a human uses approved account',writeFlagsEnabled:false,storage:{provider:'local filesystem',rootExists:fs.existsSync(storageRoot),rootInsideProject:storageRoot.toLowerCase().startsWith(root.toLowerCase()+path.sep),renderPersistence:'NOT_VERIFIED',productionFileBytes:'NOT_VERIFIED_ON_THIS_MACHINE'},compiledReportReaderSha256:crypto.createHash('sha256').update(fs.readFileSync(compiled)).digest('hex')};
 previewStatus=status;
 await app.listen(3000,'127.0.0.1');
 const frontend=spawn(process.execPath,[path.join(root,'frontend/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5173','--strictPort'],{cwd:path.join(root,'frontend'),env:frontendEnv,windowsHide:true,stdio:'ignore'});
 frontend.on('exit',()=>app.close().finally(()=>process.exit(1)));
 let ready=false;for(let i=0;i<40;i++){try{const r=await fetch('http://127.0.0.1:5173',{signal:AbortSignal.timeout(1000)});await r.body?.cancel();if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert(ready,'Frontend did not start');
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'running.json'),JSON.stringify({...status,frontendPid:frontend.pid,startedAt:new Date().toISOString()},null,2)+'\n');console.log(JSON.stringify(status));
 const stop=async()=>{frontend.kill();await app.close();process.exit(0);};process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
async function main(){
 if(process.argv.includes('--serve'))return serve();
 if(!process.argv.includes('--start')){console.log('Build backend first, then: node backend/scripts/web-readonly-preview.cjs --start');return;}
 await free(3000);await free(5173);fs.mkdirSync(out,{recursive:true});
 const child=spawn(process.execPath,[__filename,'--serve'],{cwd:backend,detached:true,windowsHide:true,stdio:'ignore'});child.unref();
 console.log(JSON.stringify({status:'START_REQUESTED',pid:child.pid,evidence:'.cache/web-readiness/running.json',url:'http://127.0.0.1:5173'}));
}
if(require.main===module)main().catch(()=>{console.error('PREVIEW_BLOCKED: check build, free ports and approved configuration; secrets suppressed');process.exitCode=1;});
module.exports={allowed};
