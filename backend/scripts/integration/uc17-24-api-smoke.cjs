'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
exports.tests=async({sql,docker,env,container,database,user,pass,OUT})=>{
 const {testTarget}=require('../rehearse-pr2b.cjs');testTarget(env.PR2B_TEST_URL);
 const saved={...process.env};Object.assign(process.env,env,{NODE_ENV:'test',JWT_SECRET:crypto.randomBytes(32).toString('hex'),JWT_REFRESH_SECRET:crypto.randomBytes(32).toString('hex'),EMAIL_WORKER_ENABLED:'false',GUIDANCE_REMINDERS_ENABLED:'false'});
 for(let uc=17;uc<=25;uc++)process.env[`UC${uc}_WRITES_ENABLED`]='false';
 const {PrismaClient}=require('@prisma/client'),db=new PrismaClient({datasources:{db:{url:env.DATABASE_URL}}});let app;
 try{
  const nobody=crypto.randomUUID();
  await db.userAccount.create({data:{id:nobody,username:'smoke-'+nobody,passwordHash:'synthetic-not-for-login',status:'ACTIVE',mustChangePassword:false}});
  // UC24/UC25 mappings are intentionally absent from the reviewed SQL. These
  // explicit READ-only grants are synthetic fixtures, never production approval.
  const localReadFixtures=[];
  for(const resource of ['defense-result','defense-report']){
   const existed=await db.permission.findUnique({where:{resource_action:{resource,action:'read'}}});
   const p=existed||await db.permission.create({data:{resource,action:'read'}});
   await db.rolePermission.upsert({where:{roleId_permissionId:{roleId:'FACULTY',permissionId:p.id}},create:{roleId:'FACULTY',permissionId:p.id},update:{}});
   localReadFixtures.push({resource,existedBeforeFixture:!!existed});
  }
  await require('./auth-fixture.cjs').prepareFixtureSessions(db);
  const {NestFactory}=require('@nestjs/core'),{ValidationPipe}=require('@nestjs/common'),{SwaggerModule,DocumentBuilder}=require('@nestjs/swagger'),{JwtService}=require('@nestjs/jwt'),{ConfigService}=require('@nestjs/config');
  app=await NestFactory.create(require('../../dist/app.module').AppModule,{logger:false,abortOnError:false,bodyParser:false});
  require('../../dist/common/http/body-parsers').configureBodyParsers(app,'api');app.setGlobalPrefix('api');app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true}));
  app.useGlobalFilters(new (require('../../dist/common/exception/global-exception.handler').GlobalExceptionHandler)());await app.listen(0,'127.0.0.1');
  const base='http://127.0.0.1:'+app.getHttpServer().address().port,jwt=new JwtService({secret:app.get(ConfigService).get('JWT_SECRET')});
  const token=id=>jwt.sign({sub:id,sid:id}),paths=SwaggerModule.createDocument(app,new DocumentBuilder().addBearerAuth().build()).paths;
  const snapshot=()=>sql(`SELECT json_build_array((SELECT count(*) FROM public."AUDIT_LOG"),(SELECT count(*) FROM public."IDEMPOTENCY_RECORD"),(SELECT count(*) FROM public."SCORE_ENTRY"),(SELECT count(*) FROM public."FINAL_REPORT_VERSION"),(SELECT count(*) FROM public."FINAL_RESULT"))::text`);
  const before=snapshot(),operations=[];
  for(const [route,methods] of Object.entries(paths)){
   if(!/^\/api\/(?:final-defense(?:\/|$)|defense-(?:eligibility|committees|reviewers|schedules|reviewer-grades|committee-grades|results|reports)(?:\/|$)|proposals\/[^/]+\/final-report(?:\/|$))/.test(route))continue;
   for(const method of Object.keys(methods)){
    if(!['get','post','patch','put','delete'].includes(method))continue;
    const url=base+route.replace(/\{[^}]+\}/g,'00000000-0000-4000-8000-000000000000');
    for(const [actor,expected] of [[null,401],[nobody,403]]){
     const response=await fetch(url,{method:method.toUpperCase(),headers:{'Content-Type':'application/json',...(actor?{Authorization:'Bearer '+token(actor)}:{})},...(!['get','head'].includes(method)?{body:'{}'}:{}),signal:AbortSignal.timeout(15000)});
     assert.equal(response.status,expected,method+' '+route+' '+await response.text());
    }
    operations.push({method,route,anonymous:401,noPermission:403});
   }
  }
  assert(operations.length>=60,'Non-vacuous UC17-UC25 API coverage required');pass('UC17-UC25 real HTTP authentication and RBAC deny checks',{operations:operations.length});
  for(const route of ['final-defense','defense-eligibility','defense-committees','defense-reviewers','defense-schedules','defense-reviewer-grades','defense-committee-grades','defense-results','defense-reports']){
   const response=await fetch(base+'/api/'+route+'/options',{headers:{Authorization:'Bearer '+token('faculty')},signal:AbortSignal.timeout(15000)});
   const body=await response.text();assert.equal(response.status,200,route+' '+body);assert(!body.includes('passwordHash'));pass('real authenticated GET '+route+'/options');
  }
  assert.equal(snapshot(),before);pass('UC17-UC25 read/denial smoke changes no audit, idempotency, grade, PDF or result rows; all write flags disabled');
  fs.writeFileSync(path.join(OUT,'uc17-25-api-smoke.json'),JSON.stringify({status:'PASS',operations,localReadFixtures,productionPermissionMappings:'NOT VERIFIED; synthetic local fixtures only',writeFlagsEnabled:false},null,2)+'\n');
  docker(['exec',container,'pg_dump','-U',user,'-d',database,'--format=custom','--file=/tmp/upgraded25.dump']);
  const restore=database+'_fullrestore';assert.equal(sql(`SELECT count(*) FROM pg_database WHERE datname='${restore}'`,'postgres'),'0');sql(`CREATE DATABASE "${restore}" TEMPLATE template0;`,'postgres');
  docker(['exec',container,'pg_restore','-U',user,'--dbname',restore,'--exit-on-error','--single-transaction','/tmp/upgraded25.dump']);
  assert.equal(sql('SELECT count(*) FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',restore),'25');
  assert.equal(sql('SELECT count(*) FROM public."FINAL_REPORT_VERSION"',restore),sql('SELECT count(*) FROM public."FINAL_REPORT_VERSION"'));
  const check=docker(['exec','-i',container,'psql','-X','-U',user,'-d',restore,'--set=ON_ERROR_STOP=1','--set=expected_database='+restore,'--set=expected_role='+user,'--set=expected_pg_major=17'],{input:fs.readFileSync(path.resolve(__dirname,'../../prisma/deployment/uc17-24/uc24-postflight.sql'),'utf8')});
  fs.writeFileSync(path.join(OUT,'restored25-postflight.txt'),check);pass('actual full 25-migration database backup restored with data and UC24 catalog/checksum postflight');
 }finally{
  if(app)await app.close();await db.$disconnect();for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);
 }
};
