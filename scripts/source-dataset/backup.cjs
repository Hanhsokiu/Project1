"use strict";
const fs=require("node:fs"),path=require("node:path"),{spawnSync}=require("node:child_process");
const {root,outputDir}=require("./sources.cjs");
const {environment,targetInfo}=require("./preflight.cjs");
const {sha}=require("./extract.cjs");
function main(){
  const target=targetInfo(environment()),url=new URL(target.url);
  const bin=path.join(root,".cache/demo-v3/postgresql/pgsql/bin");
  for(const name of ["pg_dump.exe","pg_restore.exe"]) if(!fs.existsSync(path.join(bin,name)))throw Error("PG17_TOOLS_NOT_FOUND");
  const dir=path.join(outputDir,"backups",new Date().toISOString().replace(/[:.]/g,"-"));fs.mkdirSync(dir,{recursive:true});
  const dump=path.join(dir,"public.dump");
  // Connection secrets travel only through the child environment, never command arguments/logs.
  const env={...process.env,PGHOST:url.hostname,PGPORT:url.port||"5432",PGDATABASE:decodeURIComponent(url.pathname.slice(1)),
    PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGSSLMODE:"require",PGCONNECT_TIMEOUT:"20",PGOPTIONS:"-c default_transaction_read_only=on"};
  const run=(name,args)=>{
    const result=spawnSync(path.join(bin,name),args,{env,windowsHide:true,encoding:"utf8",timeout:180000,maxBuffer:16*1024*1024});
    if(result.error||result.status!==0){const e=Error("BACKUP_COMMAND_FAILED:"+name);e.code=result.error?.code;e.stderrClass=/permission denied/i.test(result.stderr||"")?"PERMISSION_DENIED":/timeout/i.test(result.stderr||"")?"TIMEOUT":"SUPPRESSED";throw e;}
    return result.stdout;
  };
  run("pg_dump.exe",["--format=custom","--schema=public","--no-owner","--no-privileges","--lock-wait-timeout=15s","--file",dump]);
  const list=run("pg_restore.exe",["--list",dump]);
  for(const table of ["USER_ACCOUNT","STUDENT","LECTURER","_prisma_migrations"]) if(!list.includes(table))throw Error("BACKUP_MISSING_TABLE");
  fs.writeFileSync(path.join(dir,"contents.txt"),list);
  const manifest={projectRef:target.projectRef,createdAt:new Date().toISOString(),scope:"public schema and data; no storage bytes/auth schema",
    dump:path.relative(root,dump).replaceAll("\\","/"),sha256:sha(fs.readFileSync(dump)),bytes:fs.statSync(dump).size,
    archiveListVerified:true,restoreActuallyTested:false,containsPasswordHashes:true,commitAllowed:false,supabaseWrites:0};
  fs.writeFileSync(path.join(dir,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
  fs.writeFileSync(path.join(outputDir,"backup-manifest.json"),JSON.stringify(manifest,null,2)+"\n");
  console.log(JSON.stringify({projectRef:manifest.projectRef,bytes:manifest.bytes,archiveListVerified:true,restoreActuallyTested:false,supabaseWrites:0}));
}
if(require.main===module)try{main();}catch(e){console.error("Backup failed; credentials suppressed. Code="+(e.code||e.stderrClass||e.message));process.exitCode=1;}
