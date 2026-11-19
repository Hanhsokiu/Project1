'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
exports.tests=async({sql,run,docker,env,container,database,user,pass,OUT})=>{
 const root=path.resolve(__dirname,'../../..'),backend=path.join(root,'backend');
 const nonce=crypto.randomBytes(5).toString('hex'),baseline='btl_pr2b_weekly_'+nonce,upgraded=baseline+'_up';
 for(const name of [baseline,upgraded]){assert.equal(sql(`SELECT count(*) FROM pg_database WHERE datname='${name}'`,'postgres'),'0');sql(`CREATE DATABASE "${name}" TEMPLATE template0;`,'postgres');}
 const childEnv=name=>{
  const url=new URL(env.DATABASE_URL);url.pathname='/'+name;
  const e={...env,DATABASE_URL:url.toString(),DIRECT_URL:url.toString(),PR2B_TEST_URL:url.toString(),NODE_ENV:'test',DATN_REHEARSAL_PG_MAJOR:'17',DATN_REHEARSAL_BASELINE:'true',EMAIL_WORKER_ENABLED:'false',GUIDANCE_REMINDERS_ENABLED:'false'};
  for(let uc=17;uc<=25;uc++)e[`UC${uc}_WRITES_ENABLED`]='false';
  return e;
 };
 function child(name,file,extra={}){
  const r=run(process.execPath,[path.join(backend,'scripts',file)],{cwd:backend,env:{...childEnv(name),...extra},timeout:240000,maxBuffer:32*1024*1024});
  fs.writeFileSync(path.join(OUT,file+'-'+name+'.txt'),r.stdout+r.stderr);
  if(r.status!==0)throw Error(file+' failed: '+r.stderr+r.stdout);
  return r.stdout;
 }
 child(baseline,'test-guidance-tasks.cjs');pass('real HTTP producer regression: proposal reviews, dossiers and guidance tasks on PostgreSQL17 baseline');
 docker(['exec',container,'pg_dump','-U',user,'-d',baseline,'--format=custom','--file=/tmp/weekly-producer.dump']);
 docker(['exec',container,'pg_restore','-U',user,'--dbname',upgraded,'--exit-on-error','--single-transaction','/tmp/weekly-producer.dump']);pass('actual populated weekly producer backup restored to independent upgrade database');
 const manifest=JSON.parse(fs.readFileSync(path.join(backend,'prisma/uc17-24-chain.json')));
 for(const item of manifest.migrations){
  const staged=run('python',[path.join(backend,'scripts/prepare-uc17-24.py'),'stage','--through',String(item.uc)]);assert.equal(staged.status,0);
  const stage=staged.stdout.trim();const r=run(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',path.join(stage,'schema.prisma')],{cwd:stage,env:childEnv(upgraded)});
  fs.writeFileSync(path.join(OUT,'weekly-upgrade-'+item.uc+'.txt'),r.stdout+r.stderr);if(r.status!==0)throw Error('Populated weekly upgrade failed UC'+item.uc+': '+r.stderr+r.stdout);
  const check=run('docker',['exec','-i',container,'psql','-X','-U',user,'-d',upgraded,'--set=ON_ERROR_STOP=1','--set=expected_database='+upgraded,'--set=expected_role='+user,'--set=expected_pg_major=17'],{input:fs.readFileSync(path.join(backend,`prisma/deployment/uc17-24/uc${item.uc}-postflight.sql`),'utf8')});
  if(check.status!==0)throw Error('Populated weekly postflight failed UC'+item.uc+': '+check.stderr);
 }
 pass('UC17-UC24 applied over populated real B1-B8 HTTP workflow with checkpoints');
 const before=child(baseline,'test-weekly-progress.cjs',{WEEKLY_USE_PREPARED:'true'});
 const after=child(upgraded,'test-weekly-progress.cjs',{WEEKLY_USE_PREPARED:'true'});
 const count=s=>{const m=s.match(/(\d+) weekly integration checks passed/);assert(m);return Number(m[1]);};
 assert.equal(count(before),count(after));assert(count(after)>0);pass('actual weekly HTTP regression before and after UC17-UC24',{checksBefore:count(before),checksAfter:count(after)});
 assert.equal(sql('SELECT count(*) FROM public."_prisma_migrations"',upgraded),'25');
 pass('weekly upgraded database retains 25 APPLIED migrations and disabled UC17-UC25 write flags');
};
