'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../..'),backend=path.join(root,'backend'),cache=path.join(root,'.cache/b9-b10-acceptance');
function command(exe,args,opts={}){const r=spawnSync(exe,args,{windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024,...opts});assert(!r.error,'Local subprocess unavailable');if(r.status!==0){const safe=String(r.stderr||r.stdout||'').replace(/postgres(?:ql)?:\/\/[^\s"']+/gi,'[REDACTED_CONNECTION]').replace(/(?:password|token|secret)\s*[:=]\s*\S+/gi,'[REDACTED_SECRET]');throw Error('Local '+path.basename(exe)+' operation failed: '+safe.slice(-2500));}return r.stdout.trim();}
function docker(args,opts){return command('docker',args,opts);}
function localOnly(value){const u=new URL(value);assert.equal(u.hostname,'127.0.0.1');assert(/^\/btl_pr2b_acceptance_[a-z0-9_]+$/.test(u.pathname));assert.equal(u.protocol,'postgresql:');return u;}
async function create(){
 const runId='DATN-E2E-B1B10-TEST-'+Date.now()+'-'+crypto.randomBytes(3).toString('hex'),short=runId.replace('DATN-E2E-B1B10-TEST-','').replaceAll('-','_');
 const container='datn-acceptance-'+short.replaceAll('_','-'),volume=container+'-data',password=crypto.randomBytes(32).toString('hex');
 const endpoint=docker(['context','inspect','--format','{{json .Endpoints.docker.Host}}']);assert(/^"(?:npipe:|unix:)/.test(endpoint));
 docker(['volume','create','--label','datn.acceptance='+runId,volume]);
 docker(['run','--detach','--name',container,'--label','datn.acceptance='+runId,'--publish','127.0.0.1::5432','--mount',`type=volume,source=${volume},target=/var/lib/postgresql/data`,'--env','POSTGRES_PASSWORD','postgres:17-alpine'],{env:{...process.env,POSTGRES_PASSWORD:password}});
 let ready=false;for(let i=0;i<60;i++){const r=spawnSync('docker',['exec',container,'psql','-X','-U','postgres','-d','postgres','-Atc',"SELECT current_setting('listen_addresses')='*'"],{encoding:'utf8',windowsHide:true,timeout:5000});if(r.status===0&&r.stdout.trim()==='t'){ready=true;break;}await new Promise(r=>setTimeout(r,500));}assert(ready,'New PG17 container unavailable');
 const binding=docker(['port',container,'5432']);assert(/^127\.0\.0\.1:\d+$/.test(binding));const port=Number(binding.split(':')[1]);
 const sql=q=>docker(['exec','-i',container,'psql','-X','-U','postgres','-d','postgres','-Atq','-v','ON_ERROR_STOP=1'],{input:q});assert.equal(sql("SELECT current_setting('server_version_num')::int/10000"),'17');
 const state={runId,container,volume,hostPort:port,createdAt:new Date().toISOString(),mode:'ISOLATED_STAGING',productionWrites:0,databases:{},checks:[]};
 const secrets={runId,container,password,jwt:crypto.randomBytes(32).toString('hex'),refresh:crypto.randomBytes(32).toString('hex'),accounts:[],manualUrl:'http://127.0.0.1:5180/login',urls:{}};
 const dir=path.join(cache,runId);fs.mkdirSync(dir,{recursive:true});
 const baseline=path.join(dir,'baseline');fs.mkdirSync(path.join(baseline,'migrations'),{recursive:true});fs.copyFileSync(path.join(backend,'prisma/schema.prisma'),path.join(baseline,'schema.prisma'));fs.copyFileSync(path.join(backend,'prisma/migrations/migration_lock.toml'),path.join(baseline,'migrations/migration_lock.toml'));
 const chain=require(path.join(backend,'prisma/uc17-24-chain.json'));assert.equal(chain.baseline.length,17);
 for(const m of chain.baseline){const bytes=fs.readFileSync(path.join(backend,'prisma/migrations',m.name,'migration.sql'));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase(),m.sha256.toUpperCase());fs.mkdirSync(path.join(baseline,'migrations',m.name));fs.writeFileSync(path.join(baseline,'migrations',m.name,'migration.sql'),bytes);}
 // Checkpoint before the first test account or business record; the database is new and empty.
 for(const mode of ['auto','manual']){
  const database='btl_pr2b_acceptance_'+short+'_'+mode;assert(/^[a-z0-9_]+$/.test(database));sql(`CREATE DATABASE "${database}" TEMPLATE template0;`);
  const url=`postgresql://postgres:${password}@127.0.0.1:${port}/${database}?schema=public`;localOnly(url);secrets.urls[mode]=url;state.databases[mode]=database;
  const env={...process.env,DATABASE_URL:url,DIRECT_URL:url};
  command(process.execPath,[path.join(backend,'node_modules/prisma/build/index.js'),'migrate','deploy','--schema',path.join(baseline,'schema.prisma')],{cwd:backend,env});
  // B9 migrations require academic roles. Bootstrap configuration ONLY in the fresh test DB.
  const {PrismaClient}=require('../../node_modules/@prisma/client'),db=new PrismaClient({datasources:{db:{url}}});
  try{const catalog=require(path.join(cache,'rbac-catalog.json')),extra=new Set(Object.values(require('./provision.cjs').extra).flat());assert.equal(extra.size,27);const roles={};
   for(const name of ['ADMIN','FACULTY','LECTURER','STUDENT','COMMITTEE'])roles[name]=await db.role.create({data:{name,description:'ISOLATED STAGING TEST '+name}});
   for(const p of catalog.definitions.filter(p=>!extra.has(p.resource+':'+p.action)))await db.permission.upsert({where:{resource_action:{resource:p.resource,action:p.action}},create:p,update:{}});
   for(const g of catalog.grants.filter(g=>!extra.has(g.permission))){const [resource,action]=g.permission.split(':'),p=await db.permission.findUniqueOrThrow({where:{resource_action:{resource,action}}});await db.rolePermission.upsert({where:{roleId_permissionId:{roleId:roles[g.role].id,permissionId:p.id}},create:{roleId:roles[g.role].id,permissionId:p.id},update:{}});}
  }finally{await db.$disconnect();}
  command(process.execPath,[path.join(backend,'node_modules/prisma/build/index.js'),'migrate','deploy','--schema',path.join(backend,'prisma/schema.prisma')],{cwd:backend,env});
  const history=docker(['exec',container,'psql','-X','-U','postgres','-d',database,'-Atc','SELECT count(*) FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL']);assert.equal(history,'27');
  docker(['exec',container,'pg_dump','-U','postgres','-d',database,'--format=custom','--file=/tmp/'+mode+'-before-accounts.dump']);
  state.checks.push({name:mode+' fresh database schema + 27 APPLIED + pre-account backup',status:'PASS'});
 }
 require('./vault.cjs').write(runId,secrets);fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(state,null,2)+'\n');fs.writeFileSync(path.join(cache,'latest.json'),JSON.stringify({runId},null,2)+'\n');console.log(JSON.stringify({runId,container,mode:state.mode,checks:state.checks,vault:'E:\\DATN-Acceptance-Vault\\'+runId}));
}
if(require.main===module)create().catch(e=>{console.error('ISOLATED_STAGING_SETUP_FAILED_NO_PRODUCTION_WRITE: '+e.message);process.exitCode=1;});
module.exports={root,backend,cache,command,docker,localOnly,create};
