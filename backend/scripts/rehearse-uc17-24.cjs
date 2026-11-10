'use strict';
// Actual PostgreSQL17 rehearsal ONLY on a newly-created labelled Docker instance.
// No production connector, .env writes, old Docker resource reuse or cleanup.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..'),BACKEND=path.join(ROOT,'backend');
const resumeMode=['--weekly-only','--regression-only','--api-smoke'].includes(process.argv[2])?process.argv[2]:null;
const resumeId=resumeMode?process.argv[3]:null;
if(resumeId)assert(/^uc1724-\d+-[a-f0-9]{8}$/.test(resumeId));
const id=resumeId||'uc1724-'+Date.now()+'-'+crypto.randomBytes(4).toString('hex');
const container='datn-'+id,volume=container+'-data',user='uc_rehearsal',database='btl_pr2b_'+id.replaceAll('-','_');
let password=crypto.randomBytes(32).toString('hex');
const OUT=path.join(ROOT,'.cache/uc17-24-rehearsal',id);fs.mkdirSync(OUT,{recursive:true});
const evidence=resumeId?JSON.parse(fs.readFileSync(path.join(OUT,'result.json'))):{runId:id,container,volume,database,postgresMajor:17,productionConnected:false,checks:[],status:'RUNNING'};
assert.equal(evidence.postgresMajor,17,'This runner requires PostgreSQL17 evidence');
let env={...process.env};
function clean(s){return String(s||'').split(password).join('[REDACTED]').replace(/postgres(?:ql)?:\/\/[^\s"']+/gi,'[REDACTED_URL]');}
function save(){fs.writeFileSync(path.join(OUT,'result.json'),JSON.stringify(evidence,null,2)+'\n');}
function pass(name,details={}){evidence.checks.push({name,status:'PASS',...details});save();console.log('PASS '+name);}
function run(cmd,args,options={}){
 const r=spawnSync(cmd,args,{cwd:ROOT,env,windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024,...options});
 if(r.error)throw Error('Process failed: '+r.error.code);
 return {...r,stdout:clean(r.stdout),stderr:clean(r.stderr)};
}
function must(cmd,args,options={}){const r=run(cmd,args,options);if(r.status!==0)throw Error(clean(r.stderr||r.stdout));return r.stdout;}
function docker(args,options={}){return must('docker',args,options);}
function sql(text,db=database,expectError){
 const r=run('docker',['exec','-i',container,'psql','-X','-U',user,'-d',db,'--set=ON_ERROR_STOP=1','--quiet','--tuples-only','--no-align'],{input:text});
 if(expectError){assert.notEqual(r.status,0,'Expected PostgreSQL rejection');assert.match(r.stderr,expectError);return r.stderr;}
 if(r.status!==0)throw Error(r.stderr||r.stdout);return r.stdout.trim();
}
function schemaDigest(){return crypto.createHash('sha256').update(docker(['exec',container,'pg_dump','-U',user,'-d',database,'--schema-only']).split('\n').filter(l=>!/^\\(?:un)?restrict /.test(l)).join('\n')).digest('hex');}
function deploy(uc){const stage=must('python',[path.join(__dirname,'prepare-uc17-24.py'),'stage','--through',String(uc)]).trim();const r=run(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',path.join(stage,'schema.prisma')],{cwd:stage});fs.writeFileSync(path.join(OUT,'deploy-'+uc+'.txt'),r.stdout+r.stderr);if(r.status!==0)throw Error('Prisma deploy '+uc+' failed: '+r.stderr+r.stdout);}
function checkpoint(uc,phase){const file=path.join(BACKEND,'prisma/deployment/uc17-24',`uc${uc}-${phase}.sql`);const r=run('docker',['exec','-i',container,'psql','-X','-U',user,'-d',database,'--set=ON_ERROR_STOP=1','--set=expected_database='+database,'--set=expected_role='+user,'--set=expected_pg_major=17'],{input:fs.readFileSync(file,'utf8')});fs.writeFileSync(path.join(OUT,`checkpoint-${uc}-${phase}.txt`),r.stdout+r.stderr);if(r.status!==0)throw Error('Checkpoint '+uc+' '+phase+' failed: '+r.stderr);}
async function main(){
 if(resumeId){
  assert.equal(docker(['inspect','--format','{{index .Config.Labels "datn.uc1724.run"}}',container]).trim(),id);
  assert.equal(docker(['inspect','--format','{{.Config.Image}}',container]).trim(),'postgres:17-alpine');
  const credentials=JSON.parse(docker(['inspect','--format','{{json .Config.Env}}',container]));
  password=credentials.find(v=>v.startsWith('POSTGRES_PASSWORD=')).slice('POSTGRES_PASSWORD='.length);
  const ports=JSON.parse(docker(['inspect','--format','{{json .NetworkSettings.Ports}}',container]))['5432/tcp'];
  assert.equal(ports.length,1);assert.equal(ports[0].HostIp,'127.0.0.1');
  const url=`postgresql://${user}:${password}@127.0.0.1:${ports[0].HostPort}/${database}?schema=public`;
  env={...env,DATABASE_URL:url,DIRECT_URL:url,PR2B_TEST_URL:url,DATN_REHEARSAL_PG_MAJOR:'17'};
  assert.equal(Number(sql("SELECT current_setting('server_version_num')::integer/10000")),17);
  if(resumeMode==='--api-smoke'){
   assert.equal(evidence.status,'PASS_SCHEMA_BOUNDARIES_WEEKLY_AND_REGRESSION');
   evidence.status='RUNNING_API_SMOKE';save();
   await require('./integration/uc17-24-api-smoke.cjs').tests({sql,run,docker,env,container,database,user,pass,OUT});
   evidence.status='PASS';
  }else if(resumeMode==='--regression-only'){
   assert(evidence.checks.some(x=>x.name==='actual weekly HTTP regression before and after UC17-UC24'&&x.status==='PASS'));
   if(evidence.error){(evidence.previousAttempts??=[]).push({status:evidence.status,error:evidence.error});delete evidence.error;}
   evidence.status='RUNNING_REGRESSION';save();
   await require('./integration/uc17-24-regression.cjs').tests({sql,run,docker,env,container,database,user,pass,OUT,completed:evidence.checks.filter(x=>x.status==='PASS').map(x=>x.name)});
   evidence.status='PASS_SCHEMA_BOUNDARIES_WEEKLY_AND_REGRESSION';
  }else{
   evidence.status='RUNNING_WEEKLY';save();
   await require('./integration/uc17-24-weekly.cjs').tests({sql,run,docker,env,container,database,user,pass,OUT});
   evidence.status='PASS_SCHEMA_BOUNDARIES_AND_WEEKLY';
  }
  save();console.log('PASS actual regression: '+OUT);return;
 }
 save();
 const endpoint=docker(['context','inspect','--format','{{json .Endpoints.docker.Host}}']).trim();
 assert(/^"(?:npipe:|unix:)/.test(endpoint),'Only a local Docker engine is allowed');
 for(const [kind,name] of [['container',container],['volume',volume]]){
  const check=run('docker',[kind,'inspect',name]);assert.notEqual(check.status,0,'Refusing existing Docker resource');assert.match(check.stderr,/No such (?:object|container|volume)/i);
 }
 docker(['volume','create','--label','datn.uc1724.run='+id,volume]);
 docker(['run','--detach','--name',container,'--label','datn.uc1724.run='+id,'--publish','127.0.0.1::5432','--mount',`type=volume,source=${volume},target=/var/lib/postgresql/data`,'--env','POSTGRES_PASSWORD','--env','POSTGRES_USER='+user,'--env','POSTGRES_DB='+database,'postgres:17-alpine'],{env:{...env,POSTGRES_PASSWORD:password}});
 const details=JSON.parse(docker(['inspect','--format','{{json .NetworkSettings.Ports}}',container]));
 const binding=details['5432/tcp'];assert.equal(binding.length,1);assert.equal(binding[0].HostIp,'127.0.0.1');
 assert.equal(docker(['inspect','--format','{{index .Config.Labels "datn.uc1724.run"}}',container]).trim(),id);
 const url=`postgresql://${user}:${password}@127.0.0.1:${binding[0].HostPort}/${database}?schema=public`;
 env={...env,DATABASE_URL:url,DIRECT_URL:url,PR2B_TEST_URL:url,DATN_REHEARSAL_PG_MAJOR:'17'};
 for(let i=0;i<45;i++){if(run('docker',['exec',container,'pg_isready','-U',user,'-d',database]).status===0)break;await new Promise(r=>setTimeout(r,1000));}
 assert.equal(Number(sql("SELECT current_setting('server_version_num')::integer/10000")),17);pass('new isolated PostgreSQL17 container and volume',{hostPort:binding[0].HostPort,serverVersion:sql('SHOW server_version')});
 assert.equal(sql("SELECT EXISTS(SELECT 1 FROM pg_collation WHERE oid=to_regcollation('pg_catalog.pg_c_utf8'))"),'t');
 assert.equal(sql("SELECT lower('NGUYỄN ÁNH' COLLATE pg_catalog.pg_c_utf8)"),'nguyễn ánh');pass('PG17 pg_c_utf8 Unicode case conversion');
 deploy(16);assert.equal(Number(sql('SELECT count(*) FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL')),17);pass('17 unchanged B1-B8 migrations applied by Prisma');
 const {PrismaClient}=require('@prisma/client');const db=new PrismaClient({datasources:{db:{url}}});
 try{await require('./integration/seed-steps4-8.cjs').seedSteps48(db,url);}finally{await db.$disconnect();}
 sql(`INSERT INTO public."DEFENSE_ELIGIBILITY"(id,proposal_id,status) VALUES ('legacy-e','p-student',NULL);
 INSERT INTO public."DEFENSE_COMMITTEE"(id,term_id,name) VALUES ('legacy-c','qa-t1','Synthetic legacy');
 INSERT INTO public."COMMITTEE_MEMBER"(committee_id,lecturer_id,role) VALUES ('legacy-c','advisor','MEMBER');
 INSERT INTO public."REVIEWER_ASSIGNMENT"(id,proposal_id,reviewer_id) VALUES ('legacy-r','p-student','reviewer');
 INSERT INTO public."RUBRIC_CRITERIA"(id,term_id,name,weight,max_score) VALUES ('legacy-rubric','qa-t1','Synthetic',100,10);
 INSERT INTO public."SCORE_ENTRY"(id,proposal_id,scorer_id,role,total_score) VALUES ('legacy-score','p-student','reviewer','REVIEWER',6);
 INSERT INTO public."SCORE_DETAIL"(id,score_entry_id,rubric_criteria_id,score) VALUES ('legacy-detail','legacy-score','legacy-rubric',6);
 INSERT INTO public."FINAL_RESULT"(id,proposal_id,final_score) VALUES ('legacy-result','p-student',6);`);
 pass('real B1-B8 producer fixture and nullable/grade/committee legacy records');
 docker(['exec',container,'pg_dump','-U',user,'-d',database,'--format=custom','--file=/tmp/baseline.dump']);
 const before=schemaDigest();const restoreDb=database+'_restore';sql(`CREATE DATABASE "${restoreDb}" TEMPLATE template0;`,'postgres');
 docker(['exec',container,'pg_restore','-U',user,'--dbname',restoreDb,'--exit-on-error','--single-transaction','/tmp/baseline.dump']);
 assert.equal(sql('SELECT count(*) FROM public."_prisma_migrations"',restoreDb),'17');assert.equal(sql('SELECT count(*) FROM public."SCORE_DETAIL"',restoreDb),'1');
 pass('actual baseline pg_dump/pg_restore into separate new local database');
 const manifest=JSON.parse(fs.readFileSync(path.join(BACKEND,'prisma/uc17-24-chain.json')));
 for(const item of manifest.migrations){
  checkpoint(item.uc,'preflight');const beforeFault=schemaDigest();
  const source=fs.readFileSync(path.join(BACKEND,'prisma/migrations',item.name,'migration.sql'),'utf8');
  assert(/COMMIT;\s*$/.test(source));sql(source.replace(/COMMIT;\s*$/,'SELECT 1/0;\nCOMMIT;\n'),database,/division by zero/);
  assert.equal(schemaDigest(),beforeFault,'DDL rollback changed schema');pass('UC'+item.uc+' actual pre-COMMIT fault rolls back DDL');
  deploy(item.uc);checkpoint(item.uc,'postflight');pass('UC'+item.uc+' Prisma deploy and real preflight/postflight');
 }
 assert.equal(sql('SELECT count(*) FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL'),'25');
 assert.notEqual(schemaDigest(),before);pass('25 migrations APPLIED on isolated PostgreSQL17');
 await require('./integration/uc17-24-postgres.cjs').tests({sql,run,docker,env,container,database,user,pass,OUT,password});
 evidence.status='RUNNING_WEEKLY';save();
 await require('./integration/uc17-24-weekly.cjs').tests({sql,run,docker,env,container,database,user,pass,OUT});
 evidence.status='RUNNING_REGRESSION';save();
 await require('./integration/uc17-24-regression.cjs').tests({sql,run,docker,env,container,database,user,pass,OUT});
 evidence.status='RUNNING_API_SMOKE';save();
 await require('./integration/uc17-24-api-smoke.cjs').tests({sql,run,docker,env,container,database,user,pass,OUT});
 evidence.status='PASS';save();console.log('PASS rehearsal: '+OUT);
}
main().catch(e=>{evidence.status='FAIL';evidence.error=clean(e.message);save();console.error('FAIL '+clean(e.message));console.error('Evidence: '+OUT);process.exitCode=1;});
