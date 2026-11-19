'use strict';
// Additional real baseline/API regression on fresh databases in THIS rehearsal container.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
exports.tests=async({sql,run,docker,env,container,user,pass,OUT,completed=[]})=>{
 const backend=path.resolve(__dirname,'../..'),nonce=crypto.randomBytes(5).toString('hex');
 const childEnv=name=>{
  const url=new URL(env.DATABASE_URL);url.pathname='/'+name;
  const result={...env,DATABASE_URL:url.toString(),DIRECT_URL:url.toString(),PR2B_TEST_URL:url.toString(),NODE_ENV:'test',DATN_REHEARSAL_PG_MAJOR:'17',DATN_REHEARSAL_BASELINE:'true',EMAIL_WORKER_ENABLED:'false',GUIDANCE_REMINDERS_ENABLED:'false'};
  for(let uc=17;uc<=25;uc++)result[`UC${uc}_WRITES_ENABLED`]='false';
  return result;
 };
 const fresh=suffix=>{
  const name='btl_pr2b_autofix_'+nonce+'_'+suffix;assert(/^[a-z0-9_]+$/.test(name));
  assert.equal(sql(`SELECT count(*) FROM pg_database WHERE datname='${name}'`,'postgres'),'0');
  sql(`CREATE DATABASE "${name}" TEMPLATE template0;`,'postgres');return name;
 };
 function child(name,file){
  const r=run(process.execPath,[path.join(backend,'scripts',file)],{cwd:backend,env:childEnv(name),timeout:480000,maxBuffer:32*1024*1024});
  fs.writeFileSync(path.join(OUT,'regression-'+file+'.txt'),r.stdout+r.stderr);
  assert.equal(r.status,0,file+': '+r.stderr+r.stdout);pass('PG17 baseline real HTTP '+file);
 }
 for(const [suffix,file] of [['groups','test-review-groups.cjs'],['versions','test-proposal-versions.cjs'],['lifecycle','test-proposal-lifecycle.cjs'],['reviews','test-guidance-reviews.cjs']]){
  if(!completed.includes('PG17 baseline real HTTP '+file))child(fresh(suffix),file);
 }
 const baseline=fresh('steps123'),upgraded=fresh('steps123_up');
 const stage=path.resolve(backend,'../.cache/uc17-24-deploy/b1-b8/prisma');
 let r=run(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',path.join(stage,'schema.prisma')],{cwd:stage,env:childEnv(baseline)});
 assert.equal(r.status,0,r.stderr+r.stdout);
 r=run(process.execPath,[path.join(backend,'prisma/seed.cjs')],{cwd:backend,env:childEnv(baseline)});
 assert.equal(r.status,0,r.stderr+r.stdout);pass('B1-B3 synthetic fixture seeded only in new guarded local database');
 const original={...process.env};
 const clean=s=>String(s).replace(/postgres(?:ql)?:\/\/[^\s"']+/gi,'[REDACTED_URL]');
 const smtpContainer=container+'-smtp',smtpLabel='datn.uc1724.smtp-parent';
 const found=run('docker',['container','inspect','--format','{{index .Config.Labels "'+smtpLabel+'"}}',smtpContainer]);
 if(found.status===0)assert.equal(found.stdout.trim(),container,'Refuse unrelated SMTP instance');
 else{
  assert.match(found.stderr,/No such (?:object|container)/i);
  docker(['run','--detach','--name',smtpContainer,'--label',smtpLabel+'='+container,'--publish','127.0.0.1::1025','--publish','127.0.0.1::8025','mailhog/mailhog:v1.0.1']);
 }
 const smtpPorts=JSON.parse(docker(['inspect','--format','{{json .NetworkSettings.Ports}}',smtpContainer]));
 for(const key of ['1025/tcp','8025/tcp']){assert.equal(smtpPorts[key].length,1);assert.equal(smtpPorts[key][0].HostIp,'127.0.0.1');}
 const mailEnv={EMAIL_WORKER_ENABLED:'true',SMTP_HOST:'127.0.0.1',SMTP_PORT:smtpPorts['1025/tcp'][0].HostPort,SMTP_FROM:'rehearsal@example.test',SMTP_USER:'',SMTP_PASS:'',SMTP_SECURE:'false',MAILHOG_API_URL:'http://127.0.0.1:'+smtpPorts['8025/tcp'][0].HostPort};
 assert.equal((await fetch(mailEnv.MAILHOG_API_URL+'/api/v2/messages')).status,200);pass('new isolated local SMTP sink; no external email',{container:smtpContainer});
 async function served(name,phase){
  const previousCwd=process.cwd();process.chdir(backend);
  Object.assign(process.env,childEnv(name),mailEnv,{JWT_SECRET:crypto.randomBytes(32).toString('hex'),JWT_REFRESH_SECRET:crypto.randomBytes(32).toString('hex')});
  const {NestFactory}=require('@nestjs/core'),{ValidationPipe}=require('@nestjs/common'),{AppModule}=require('../../dist/app.module');
  const app=await NestFactory.create(AppModule,{logger:false,abortOnError:false,bodyParser:false});
  try{
   require('../../dist/common/http/body-parsers').configureBodyParsers(app,'api');
   app.setGlobalPrefix('api');app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true}));
   const filter=new (require('../../dist/common/exception/global-exception.handler').GlobalExceptionHandler)();
   const handle=filter.catch.bind(filter);
   filter.catch=(error,host)=>{if(!(error.getStatus)||error.getStatus()>=500)fs.appendFileSync(path.join(OUT,nonce+'-server-errors.txt'),clean(error.stack||error.message)+'\n');return handle(error,host);};
   app.useGlobalFilters(filter);
   await app.listen(0,'127.0.0.1');const base='http://127.0.0.1:'+app.getHttpServer().address().port+'/api';
   const serveEnv={...process.env,TEST_API_URL:base,TERM_TEST_API_URL:base,GPMS_INTEGRATION:'1',RUN_TERM_DB_TESTS:'1',RUN_AUTOMATION_DB_TESTS:'1'};
   for(const file of ['step1-http.cjs','step2-http.cjs','step3-http.cjs','run-integration.cjs']){
    const output=await new Promise((resolve,reject)=>{
     const child=spawn(process.execPath,[path.join(backend,'test',file)],{cwd:backend,env:serveEnv,windowsHide:true,stdio:['ignore','pipe','pipe']});
     let content='';child.stdout.on('data',b=>content+=b);child.stderr.on('data',b=>content+=b);
     const timer=setTimeout(()=>{child.kill();reject(Error(file+' timed out'));},480000);
     child.on('error',reject);child.on('close',code=>{clearTimeout(timer);fs.writeFileSync(path.join(OUT,nonce+'-'+phase+'-'+file+'.txt'),clean(content));if(code!==0)reject(Error(phase+' '+file+': '+clean(content)));else resolve(content);});
    });
    pass(phase+' actual B1-B3 '+file,{log:nonce+'-'+phase+'-'+file+'.txt',outputLines:output.split('\n').length});
   }
  }finally{await app.close();process.chdir(previousCwd);}
 }
 try{
  await served(baseline,'baseline17');
  docker(['exec',container,'pg_dump','-U',user,'-d',baseline,'--format=custom','--file=/tmp/regression-steps123.dump']);
  docker(['exec',container,'pg_restore','-U',user,'--dbname',upgraded,'--exit-on-error','--single-transaction','/tmp/regression-steps123.dump']);
  const manifest=JSON.parse(fs.readFileSync(path.join(backend,'prisma/uc17-24-chain.json')));
  for(const item of manifest.migrations){
   const staged=run('python',[path.join(backend,'scripts/prepare-uc17-24.py'),'stage','--through',String(item.uc)]);assert.equal(staged.status,0);
   const location=staged.stdout.trim();const apply=run(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',path.join(location,'schema.prisma')],{cwd:location,env:childEnv(upgraded)});
   fs.writeFileSync(path.join(OUT,'steps123-upgrade-'+item.uc+'.txt'),apply.stdout+apply.stderr);assert.equal(apply.status,0,apply.stderr+apply.stdout);
  }
  await served(upgraded,'upgraded25');
  assert.equal(sql('SELECT count(*) FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',upgraded),'25');
  pass('B1-B3 real HTTP and integration regression passes before and after all 8 UC migrations');
 }finally{
  for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];Object.assign(process.env,original);
 }
};
