"use strict";
const fs=require("node:fs"),path=require("node:path"),{spawnSync}=require("node:child_process");
const {root,outputDir}=require("./sources.cjs");
const {environment,targetInfo,inspect}=require("./preflight.cjs");
const {sha}=require("./extract.cjs");
const allowed=["202611160001_grade_precision_two_decimals","202611160002_audit_resource_history_index"];
function verifiedBackup(projectRef){
  const b=JSON.parse(fs.readFileSync(path.join(outputDir,"backup-manifest.json"),"utf8"));
  const file=path.resolve(root,b.dump);
  if(!file.startsWith(path.resolve(outputDir,"backups")+path.sep)||b.projectRef!==projectRef||!b.archiveListVerified||
    Date.now()-Date.parse(b.createdAt)>86400000||sha(fs.readFileSync(file))!==b.sha256)throw Error("CURRENT_BACKUP_REQUIRED");
  return b;
}
async function main(){
  const env=environment(),target=targetInfo(env),before=await inspect();
  if(!before.migrations.historyValid||before.migrations.pending.some(n=>!allowed.includes(n)))throw Error("UNREVIEWED_MIGRATION_HISTORY");
  verifiedBackup(target.projectRef);
  if(process.argv[2]!=="--apply-project-ref"||process.argv[3]!==target.projectRef){console.log(JSON.stringify({operation:"DRY_RUN",pending:before.migrations.pending}));return;}
  if(before.migrations.pending.length){
    const result=spawnSync(process.execPath,[path.join(root,"backend/scripts/shared-database.cjs"),"deploy","--target",target.target],{
      env:{...env,ALLOW_DATABASE_MIGRATION:target.target},cwd:root,windowsHide:true,encoding:"utf8",timeout:240000,maxBuffer:16*1024*1024});
    if(result.error||result.status!==0)throw Error("MIGRATION_DEPLOY_FAILED");
  }
  const after=await inspect();
  fs.writeFileSync(path.join(outputDir,"database-preflight.json"),JSON.stringify(after,null,2)+"\n");
  if(!after.migrations.historyValid||after.migrations.pending.length)throw Error("MIGRATION_POSTFLIGHT_FAILED");
  const report={projectRef:target.projectRef,applied:before.migrations.pending,history:after.migrations,verifiedAt:new Date().toISOString(),dataReset:false};
  fs.writeFileSync(path.join(outputDir,"migration-report.json"),JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report));
}
module.exports={verifiedBackup};
if(require.main===module)main().catch(e=>{console.error("Migration operation failed; credentials suppressed. Code="+(e.code||e.errorCode||e.message));process.exitCode=1;});
