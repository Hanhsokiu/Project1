'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const {root,cache,docker}=require('./local.cjs');
const image='datn-acceptance-pg17-clock:v3';
function setClock(container,iso){const text=iso===null?'+0\n':new Date(iso).toISOString().slice(0,19).replace('T',' ')+'\n';docker(['exec','--user','postgres','-i',container,'sh','-c','umask 077; cat > /var/lib/postgresql/data/acceptance.clock'],{input:text});}
async function main(){
 const runId=require(path.join(cache,'latest.json')).runId,dir=path.join(cache,runId),manifest=require(path.join(dir,'manifest.json')),vault=require('./vault.cjs'),secret=vault.read(runId);
 assert(!manifest.containers,'Clocked staging already exists');assert.equal(docker(['inspect','--format','{{index .Config.Labels "datn.acceptance"}}',manifest.container]),runId);
 const old=manifest.container,short=runId.replace('DATN-E2E-B1B10-TEST-','');manifest.containers={};manifest.clockImage=image;manifest.retainedOriginalContainer=old;
 for(const mode of ['auto','manual']){
  const source=manifest.databases[mode],container='datn-acceptance-clock-v3-'+short+'-'+mode,volume=container+'-data';
  docker(['volume','create','--label','datn.acceptance='+runId,volume]);docker(['run','--detach','--name',container,'--label','datn.acceptance='+runId,'--label','datn.acceptance.mode='+mode,'--publish','127.0.0.1::5432','--mount',`type=volume,source=${volume},target=/var/lib/postgresql/data`,'--env','POSTGRES_PASSWORD',image],{env:{...process.env,POSTGRES_PASSWORD:secret.password}});
  let ready=false;for(let i=0;i<100;i++){const p=spawnSync('docker',['exec',container,'psql','-X','-U','postgres','-d','postgres','-Atc',"SELECT current_setting('listen_addresses')='*'"],{encoding:'utf8',windowsHide:true,timeout:5000});if(p.status===0&&p.stdout.trim()==='t'){ready=true;break;}await new Promise(r=>setTimeout(r,500));}assert(ready,'Clocked PG17 unavailable');
  const clockIso=mode==='auto'?JSON.parse(fs.readFileSync(path.join(dir,'auto.json'))).phasePlan.find(p=>p.code==='REGISTRATION').start:new Date().toISOString();const iso=mode==='auto'?new Date(Math.max(Date.now(),Date.parse(clockIso))+60000).toISOString():clockIso;setClock(container,iso);
  docker(['exec','-i',container,'psql','-X','-U','postgres','-d','postgres','-q','-v','ON_ERROR_STOP=1'],{input:`CREATE DATABASE "${source}" TEMPLATE template0;`});
  const dump=spawnSync('docker',['exec',old,'pg_dump','-U','postgres','-d',source,'--format=custom'],{windowsHide:true,encoding:null,timeout:120000,maxBuffer:64*1024*1024});assert.equal(dump.status,0,'Owned staging backup failed');
  const restored=spawnSync('docker',['exec','-i',container,'pg_restore','-U','postgres','--dbname',source,'--no-owner','--exit-on-error','--single-transaction'],{input:dump.stdout,windowsHide:true,encoding:null,timeout:120000,maxBuffer:64*1024*1024});assert.equal(restored.status,0,'Owned staging restore failed');
  const actual=docker(['exec',container,'psql','-X','-U','postgres','-d',source,'-Atc',"SELECT extract(epoch FROM now())::bigint"]);assert(Math.abs(Number(actual)-Date.parse(iso)/1000)<2,'PG17 time did not match test clock');
  const binding=docker(['port',container,'5432']);assert(/^127\.0\.0\.1:\d+$/.test(binding));const url=new URL(secret.urls[mode]);url.port=binding.split(':')[1];secret.urls[mode]=url.toString();manifest.containers[mode]={container,volume,hostPort:Number(url.port),image,clock:iso,restoredFromOwnedStaging:true};
  fs.writeFileSync(path.join(dir,'clock-'+mode+'.json'),JSON.stringify({iso,scope:'APPLICATION_AND_OWNED_PG17_PROCESS_ONLY'}));
 }
 vault.write(runId,secret);fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({status:'PASS',runId,containers:manifest.containers,retainedOriginalContainer:old,productionWrites:0}));
}
if(require.main===module)main().catch(e=>{console.error('CLOCKED_STAGING_FAILED: '+e.message);process.exitCode=1;});module.exports={setClock};
