"use strict";
// Read-only target discovery. Never select passwords, tokens, policy bodies or env values into artifacts.
const fs=require("node:fs"),path=require("node:path");
const {root,outputDir}=require("./sources.cjs");
const {inspectTarget,assertMigrationHistory}=require(path.join(root,"backend/scripts/shared-database.cjs"));
function environment() {
  const values={};
  for(const line of fs.readFileSync(path.join(root,"backend/.env"),"utf8").split(/\r?\n/)) {
    const match=/^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if(match) values[match[1]]=match[2].replace(/^(["'])(.*)\1$/,"$2");
  }
  return {...values,...process.env};
}
function targetInfo(env) {
  const direct=inspectTarget(env);const u=new URL(direct.url),runtime=new URL(env.DATABASE_URL);
  const projectRef=url=>url.hostname.endsWith(".pooler.supabase.com")?decodeURIComponent(url.username).replace(/^postgres\./,""):url.hostname.replace(/^db\./,"").replace(/\.supabase\.co$/,"");
  const ref=projectRef(u);
  if(!/^[a-z]{20}$/.test(ref)||projectRef(runtime)!==ref||runtime.pathname!==u.pathname) throw Error("TARGET_MISMATCH");
  return {url:direct.url,projectRef:ref,target:direct.target};
}
async function inspect() {
  const env=environment(),target=targetInfo(env);
  const {PrismaClient}=require(path.join(root,"backend/node_modules/@prisma/client"));
  const db=new PrismaClient({datasources:{db:{url:target.url}},log:[]});
  const dataset=JSON.parse(fs.readFileSync(path.join(outputDir,"dataset.json"),"utf8"));
  try {
    return await db.$transaction(async tx=>{
      await tx.$executeRawUnsafe("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '15000ms'");
      const identity=await tx.$queryRawUnsafe("SELECT current_database() AS database,current_setting('transaction_read_only') AS read_only");
      if(identity[0]?.read_only!=="on")throw Error("READ_ONLY_REQUIRED");
      const history=await tx.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public."_prisma_migrations" ORDER BY migration_name');
      const expected=fs.readdirSync(path.join(root,"backend/prisma/migrations")).filter(n=>fs.existsSync(path.join(root,"backend/prisma/migrations",n,"migration.sql")));
      let historyValid=true;try{assertMigrationHistory(history);}catch{historyValid=false;}
      const pending=expected.filter(n=>!history.some(h=>h.migration_name===n&&h.finished_at&&!h.rolled_back_at));
      const tables=(await tx.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).map(t=>t.tablename).filter(t=>/^[A-Z_]+$/.test(t));
      const counts=await tx.$queryRawUnsafe(tables.map(t=>`SELECT '${t}' AS table, count(*)::int AS rows FROM public."${t}"`).join(" UNION ALL "));
      const students=await tx.student.findMany({where:{studentCode:{in:dataset.selectedStudents.map(s=>s.studentCode)}},select:{id:true,userId:true,studentCode:true,fullName:true,className:true,trainingSystemId:true}});
      const lecturers=await tx.lecturer.findMany({select:{id:true,userId:true,lecturerCode:true,fullName:true,departmentId:true,academicDegree:true,academicRank:true,researchAreas:{select:{researchAreaId:true}}}});
      const usernameCollisions=await tx.userAccount.findMany({where:{username:{in:dataset.selectedStudents.map(s=>s.studentCode)}},select:{id:true,username:true,displayName:true,status:true}});
      const operators=await tx.userAccount.findMany({where:{userRoles:{some:{role:{name:{in:["ADMIN","FACULTY"]}}}}},select:{id:true,username:true,status:true,userRoles:{select:{role:{select:{name:true}}}}}});
      const catalogs={departments:await tx.department.findMany(),trainingSystems:await tx.trainingSystem.findMany(),researchAreas:await tx.researchArea.findMany()};
      const terms=await tx.thesisTerm.findMany({select:{id:true,code:true,name:true,status:true,trainingSystemId:true,phases:{select:{code:true,startDate:true,endDate:true}}}});
      const policies=await tx.termParameter.findMany({where:{key:{in:Array.from({length:9},(_,i)=>`UC${i+17}_POLICY`)}},select:{termId:true,key:true,value:true}});
      const policyStatus=policies.map(p=>{let parsed;try{parsed=JSON.parse(p.value);}catch{}return {termId:p.termId,key:p.key,status:parsed?.status||"UNPARSEABLE",approvedByPresent:Boolean(parsed?.approvedBy),testMarker:/PROJECT_ACCEPTANCE|TEST_ONLY|DATN-E2E-B1B10-TEST/.test(p.value)};});
      return {operation:"READ_ONLY",observedAt:new Date().toISOString(),projectRef:target.projectRef,target:target.target,
        migrations:{historyValid,applied:history.length,expected:expected.length,pending},counts,students,lecturers,usernameCollisions,operators,catalogs,terms,policies:policyStatus,
        writeFlags:Object.fromEntries(Array.from({length:9},(_,i)=>[`UC${i+17}_WRITES_ENABLED`,env[`UC${i+17}_WRITES_ENABLED`]==="true"])),
        backupVerified:false,supabaseWrites:0};
    },{timeout:120000,maxWait:10000});
  } finally {await db.$disconnect();}
}
async function main(){
  const report=await inspect();fs.mkdirSync(outputDir,{recursive:true});
  fs.writeFileSync(path.join(outputDir,"database-preflight.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({operation:report.operation,projectRef:report.projectRef,migrations:report.migrations,
    matchingStudents:report.students.length,usernameCollisions:report.usernameCollisions.length,existingLecturers:report.lecturers.length,
    departments:report.catalogs.departments.map(d=>({id:d.id,code:d.code,name:d.name})),trainingSystems:report.catalogs.trainingSystems,
    terms:report.terms.map(t=>({id:t.id,code:t.code,status:t.status})),policies:report.policies,writeFlags:report.writeFlags,backupVerified:report.backupVerified},null,2));
}
module.exports={environment,targetInfo,inspect};
if(require.main===module)main().catch(e=>{console.error("Read-only inspection failed; credentials suppressed. Code="+(e.code||e.errorCode||"UNKNOWN"));process.exitCode=1;});
