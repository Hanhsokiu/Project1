'use strict';
// Executes DDL ONLY on a separately created, empty, loopback btl_pr2b_* DB.
// No fallback to backend/.env, DATABASE_URL or DIRECT_URL is permitted.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const backend=path.resolve(__dirname,'..'),dir=path.join(backend,'prisma/review/pr2b');
function testTarget(raw) {
  const u=new URL(raw||'');
  if(!['postgres:','postgresql:'].includes(u.protocol)||u.hostname!=='127.0.0.1'||!/^\/btl_pr2b_[a-z0-9_]+$/.test(u.pathname)||!u.username||!u.password) throw Error('Only explicit isolated loopback btl_pr2b_* test URLs are allowed');
  return u;
}
async function main() {
  const u=testTarget(process.env.PR2B_TEST_URL);
  process.env.DATABASE_URL=u.toString(); process.env.DIRECT_URL=u.toString();
  const {PrismaClient}=require('../node_modules/.pr2b-client');
  const db=new PrismaClient({datasources:{db:{url:u.toString()}}});
  const checks=[];
  const ok=name=>{checks.push({name,result:'PASS'});console.log('PASS '+name);};
  function sqlFile(file,expectFailure=false) {
    const r=cp.spawnSync(process.env.PR2B_PSQL||'psql',['-X','-v','ON_ERROR_STOP=1','-f',file],{
      env:{...process.env,PGHOST:'127.0.0.1',PGPORT:u.port||'5432',PGDATABASE:u.pathname.slice(1),PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password)},encoding:'utf8',windowsHide:true,
    });
    if(r.error) throw Error('Cannot execute isolated psql: '+r.error.code);
    if(expectFailure){assert.notEqual(r.status,0);assert.match(r.stderr,/requires empty application tables/);return;}
    if(r.status!==0) throw Error('Rehearsal SQL failed: '+r.stderr);
  }
  async function rejected(name,fn) {
    let rejected=false;
    try {await fn();} catch(e){if(['P2002','P2003','P2004','P2010'].includes(e.code)||/constraint|check|foreign key|append-only|Completion requires|rewriting/i.test(e.message)) rejected=true;else throw e;}
    assert(rejected,'Expected integrity rejection: '+name);ok(name);
  }
  try {
    const [identity]=await db.$queryRawUnsafe("SELECT current_database() AS db,current_setting('server_version_num') AS version");
    assert.equal(identity.db,u.pathname.slice(1));assert.equal(Math.floor(Number(identity.version)/10000),17);
    const [tables]=await db.$queryRawUnsafe("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
    assert.equal(tables.n,0,'Refusing to reuse a populated test database; create another isolated DB instead');ok('dedicated empty PostgreSQL17 identity');
    sqlFile(path.join(backend,'prisma/migrations/0_init/migration.sql'));ok('unchanged 0_init replay');
    sqlFile(path.join(dir,'01-empty-baseline-enum-bridge.sql'));ok('empty baseline enum bridge');
    sqlFile(path.join(dir,'fixture.sql'));ok('synthetic legacy fixture loaded');
    const before=await db.topic.findMany({orderBy:{id:'asc'},include:{proposals:true,researchArea:true}});
    const beforeStudent=await db.student.findMany({orderBy:{id:'asc'},include:{proposal:true,trainingSystem:true}});
    assert.equal((await db.registration.findMany({where:{status:'PENDING'}})).length,1);ok('Prisma enum filters match bridged SQL');
    sqlFile(path.join(dir,'01-empty-baseline-enum-bridge.sql'),true);ok('baseline bridge refuses nonempty data without rewriting it');
    // Inject a failure immediately before COMMIT to prove all expand DDL,
    // integrity objects and grants roll back together. Never target shared DBs.
    const interrupted=cp.spawnSync(process.env.PR2B_PSQL||'psql',['-X','-v','ON_ERROR_STOP=1'],{
      env:{...process.env,PGHOST:'127.0.0.1',PGPORT:u.port||'5432',PGDATABASE:u.pathname.slice(1),PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password)},
      input:fs.readFileSync(path.join(dir,'02-expand.sql'),'utf8').replace(/COMMIT;\s*$/,'SELECT 1/0;\nCOMMIT;\n'),encoding:'utf8',windowsHide:true,
    });
    assert(!interrupted.error);assert.notEqual(interrupted.status,0);assert.match(interrupted.stderr,/division by zero/);
    const [rolledBack]=await db.$queryRawUnsafe("SELECT to_regclass('public.\"TASK_WORKFLOW\"')::text AS object");
    assert.equal(rolledBack.object,null);
    assert.deepEqual(await db.topic.findMany({orderBy:{id:'asc'},include:{proposals:true,researchArea:true}}),before);
    ok('injected expand failure rolls back DDL and preserves legacy fixture');
    sqlFile(path.join(dir,'02-expand.sql'));ok('atomic expand replay over populated legacy fixture');
    const [exposure]=await db.$queryRawUnsafe("SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE n.nspname='public' AND c.relname='TOPIC' AND a.grantee=0 AND a.privilege_type='SELECT'");
    assert.equal(exposure.n,0);ok('application data no longer granted to PUBLIC by fixture defaults');
    assert.deepEqual(await db.topic.findMany({orderBy:{id:'asc'},include:{proposals:true,researchArea:true}}),before);
    assert.deepEqual(await db.student.findMany({orderBy:{id:'asc'},include:{proposal:true,trainingSystem:true}}),beforeStudent);ok('legacy Topic.proposals and Student.proposal JSON unchanged');
    assert.equal((await db.taskReview.findUnique({where:{id:'fx-old-review'}})).isPassed,false);
    assert.equal(await db.progressReview.count(),0);assert.equal(await db.topicWorkflow.count(),0);ok('legacy false and ownership not guessed or auto-backfilled');
    await rejected('cross-term Topic ownership rejected',()=>db.topicWorkflow.create({data:{topicId:'fx-topic1',termStudentId:'fx-ts2',termId:'fx-t1'}}));
    await db.topicWorkflow.create({data:{topicId:'fx-topic1',termStudentId:'fx-ts1',termId:'fx-t1'}});
    await rejected('proposal cannot point at another proposal version',()=>db.proposalWorkflow.create({data:{proposalId:'fx-p1',workingVersionId:'fx-v2'}}));
    await db.proposalWorkflow.create({data:{proposalId:'fx-p1',workingVersionId:'fx-v1'}});
    await db.proposalReviewWorkflow.create({data:{reviewId:'fx-r1',proposalId:'fx-p1',versionId:'fx-v1',roundNumber:1,state:'IN_REVIEW'}});
    await rejected('only one active round per proposal',()=>db.proposalReviewWorkflow.create({data:{reviewId:'fx-r2',proposalId:'fx-p1',versionId:'fx-v1',roundNumber:2,state:'ASSIGNED'}}));
    const decisions=await Promise.allSettled(['APPROVED','REVISION_REQUIRED'].map(decision=>db.proposalReviewDecision.create({data:{reviewId:'fx-r1',versionId:'fx-v1',decidedByUserId:'fx-ur',decidedAt:new Date(),decision,comment:'Synthetic decision'}})));
    assert.equal(decisions.filter(x=>x.status==='fulfilled').length,1);assert.equal(await db.proposalReviewDecision.count({where:{reviewId:'fx-r1'}}),1);ok('concurrent opposing decisions produce one final decision');
    await rejected('final review decision immutable',()=>db.proposalReviewDecision.update({where:{reviewId:'fx-r1'},data:{comment:'rewrite'}}));
    const period=await db.guidancePeriod.create({data:{termId:'fx-t1',ordinal:1,label:'Synthetic week',type:'WEEK',startsAt:new Date('2020-01-01Z'),endsAt:new Date('2020-01-08Z'),reportDueAt:new Date('2020-01-07Z')}});
    await rejected('required student must belong to period term',()=>db.periodRequiredStudent.create({data:{periodId:period.id,termStudentId:'fx-ts2',termId:'fx-t1'}}));
    await db.periodRequiredStudent.create({data:{periodId:period.id,termStudentId:'fx-ts1',termId:'fx-t1'}});
    let [coverage]=await db.$queryRawUnsafe('SELECT * FROM public.pr2b_weekly_coverage');
    assert(coverage.missingObligationRecord&&coverage.missingPlan&&coverage.missingTask&&coverage.isOverdue&&!coverage.hasSubmission);ok('missing week visible before obligation, plan or manual task');
    const obligation=await db.weeklyReportObligation.create({data:{periodId:period.id,termStudentId:'fx-ts1',configRevision:0,configSnapshot:{fixture:true}}});
    await db.taskWorkflow.create({data:{taskId:'fx-task1',planId:'fx-gp1',periodId:period.id,obligationId:obligation.id,kind:'WEEKLY_REPORT',state:'TODO'}});
    await db.weeklyReportObligation.update({where:{id:obligation.id},data:{planId:'fx-gp1',currentTaskId:'fx-task1'}});
    [coverage]=await db.$queryRawUnsafe('SELECT * FROM public.pr2b_weekly_coverage');assert(!coverage.hasSubmission&&coverage.isOverdue);ok('creating task does not submit or complete required week');
    await rejected('completion without current PASS evidence rejected',()=>db.taskWorkflow.update({where:{taskId:'fx-task1'},data:{state:'COMPLETED'}}));
    await db.submissionWorkflow.create({data:{submissionId:'fx-sub1',taskId:'fx-task1',versionNumber:1,state:'SUBMITTED',submittedByUserId:'fx-us1',submittedAt:new Date(),deadlineSnapshot:new Date('2020-01-07Z'),isLate:true}});
    await db.taskWorkflow.update({where:{taskId:'fx-task1'},data:{currentSubmissionId:'fx-sub1',state:'SUBMITTED'}});
    const reviews=[];
    for(const [i,decision] of ['PASS','FAIL','REVISION_REQUIRED'].entries()) {
      const sub=i===0?'fx-sub1':`fx-sub-${i+1}`;
      if(i){await db.taskSubmission.create({data:{id:sub,taskId:'fx-task1',content:'Synthetic review test'}});await db.submissionWorkflow.create({data:{submissionId:sub,taskId:'fx-task1',versionNumber:i+1,state:'SUBMITTED',submittedByUserId:'fx-us1',submittedAt:new Date(),deadlineSnapshot:new Date('2020-01-07Z'),isLate:true}});}
      reviews.push(await db.progressReview.create({data:{submissionId:sub,decision,state:'RECORDED',comment:'Synthetic review',reviewerUserId:'fx-ua',assignmentRevision:0,recordedAt:new Date()}}));
    }
    assert.deepEqual((await db.progressReview.findMany({orderBy:{decision:'asc'}})).map(r=>r.decision).sort(),['FAIL','PASS','REVISION_REQUIRED']);ok('PASS FAIL REVISION_REQUIRED stored distinctly');
    assert.equal((await db.taskWorkflow.findUnique({where:{taskId:'fx-task1'}})).state,'SUBMITTED');ok('PASS record does not automatically complete task or student');
    await rejected('progress review result cannot be rewritten',()=>db.progressReview.update({where:{id:reviews[1].id},data:{decision:'REVISION_REQUIRED'}}));
    await db.submissionWorkflow.update({where:{submissionId:'fx-sub1'},data:{effectiveReviewId:reviews[0].id}});
    await db.taskWorkflow.update({where:{taskId:'fx-task1'},data:{state:'COMPLETED'}});ok('explicit completion requires current PASS review');
    await rejected('effective review cannot point at another submission',()=>db.submissionWorkflow.update({where:{submissionId:'fx-sub1'},data:{effectiveReviewId:reviews[1].id}}));
    const beforeRevision=(await db.proposalWorkflow.findUnique({where:{proposalId:'fx-p1'}})).revision;
    const cas=await Promise.all([0,1].map(()=>db.proposalWorkflow.updateMany({where:{proposalId:'fx-p1',revision:beforeRevision},data:{revision:{increment:1}}})));
    assert.equal(cas.reduce((n,r)=>n+r.count,0),1);ok('concurrent compare-and-swap has exactly one winner');
    const history=await db.taskHistory.create({data:{taskId:'fx-task1',actorId:'fx-ua',reason:'Synthetic event',snapshot:{fixture:true}}});
    await rejected('audit event content is append-only',()=>db.taskHistory.update({where:{id:history.id},data:{reason:'rewrite'}}));
    const after=await db.topic.findMany({orderBy:{id:'asc'},include:{proposals:true,researchArea:true}});assert.deepEqual(after,before);ok('old API payload remains stable after new workflow writes');
    const {readChecks}=require('./database-test.cjs');
    const diagnostics=await db.$transaction(async tx=>{
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const rows=[];
      for(const check of readChecks(fs.readFileSync(path.join(__dirname,'sql/pr2-diagnostics.sql'),'utf8'))) {
        const values=await tx.$queryRawUnsafe(check.sql);
        for(const value of values) if('violations' in value) assert.equal(Number(value.violations),0,check.name);
        rows.push({check:check.name,rows:values});
      }
      return rows;
    });ok('12 diagnostic SELECTs run on populated synthetic fixture, no counted violations');
    const payloadHash=crypto.createHash('sha256').update(JSON.stringify(before)).digest('hex');
    fs.writeFileSync(path.join(dir,'test-results.json'),JSON.stringify({database:'isolated loopback rehearsal',postgresMajor:17,checks,diagnostics,legacyPayloadHash:payloadHash,sharedDatabaseDDL:false,limitations:['Synthetic fixture is not a legacy production snapshot','Application authorization and workflow services are not implemented or tested here']},(_,v)=>typeof v==='bigint'?v.toString():v,2)+'\n');
    console.log(`${checks.length} integration checks passed; shared database was not contacted.`);
  } finally {await db.$disconnect();}
}
module.exports={testTarget};
if(require.main===module)main().catch(e=>{console.error(String(e.message).replace(/postgres(?:ql)?:\/\/[^\s]+/gi,'[REDACTED_URL]'));process.exitCode=1;});
