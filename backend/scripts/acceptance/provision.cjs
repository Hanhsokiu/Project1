'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {root,cache,localOnly}=require('./local.cjs');
const strong=()=> 'Aa9!'+crypto.randomBytes(24).toString('base64url');
const extra={FACULTY:['defense-result:read','defense-result:components-read','defense-result:history-read','defense-result:finalize','defense-result:publish','dossier:export',...['read','templates-read','statistics','preview','export','history-read','download','grade-statistics','score-statistics','draft-preview','draft-export','list-export','components-export','final-export','comments-export','minutes-export','dossier-export','pii-export'].map(a=>'defense-report:'+a)],LECTURER:['defense-result:read','defense-result:components-read','defense-result:confirm'],STUDENT:['defense-result:read','defense-result:read-own','defense-result:final-read']};
async function provision(r,mode){
 localOnly(process.env.DATABASE_URL);const {db,secret}=r,runId=r.manifest.runId,dir=path.join(cache,runId);
 assert.equal(await db.userAccount.count(),0,'Provisioning refuses existing accounts; never reset');assert.equal(await db.thesisTerm.count(),0,'Provisioning refuses existing terms');
 const catalogue=require(path.join(cache,'rbac-catalog.json'));assert.equal(catalogue.summary.permissions,124);assert.equal(catalogue.summary.roleGrants,166);
 const grantsBefore=await db.rolePermission.findMany({orderBy:[{roleId:'asc'},{permissionId:'asc'}]});
 const roles={};for(const name of ['ADMIN','FACULTY','LECTURER','STUDENT','COMMITTEE'])roles[name]=await db.role.findUniqueOrThrow({where:{name}});
 for(const p of catalogue.definitions)await db.permission.upsert({where:{resource_action:{resource:p.resource,action:p.action}},create:p,update:{}});
 for(const g of [...catalogue.grants,...Object.entries(extra).flatMap(([role,permissions])=>permissions.map(permission=>({role,permission})))]){
  const [resource,action]=g.permission.split(':'),p=await db.permission.findUniqueOrThrow({where:{resource_action:{resource,action}}});await db.rolePermission.upsert({where:{roleId_permissionId:{roleId:roles[g.role].id,permissionId:p.id}},create:{roleId:roles[g.role].id,permissionId:p.id},update:{}});
 }
 const prefix='acpt_'+runId.slice(-14).replaceAll('-','')+'_'+mode;
 const adminPassword=strong(),admin=await db.userAccount.create({data:{username:prefix+'_admin',displayName:'TEST bootstrap admin '+mode,passwordHash:await require('../../node_modules/bcryptjs').hash(adminPassword,12),status:'ACTIVE',mustChangePassword:false,userRoles:{create:{roleId:roles.ADMIN.id}}}});
 await db.auditLog.create({data:{userId:admin.id,action:'ISOLATED_STAGING_BOOTSTRAP',resource:'account',resourceId:admin.id,newValue:{runId,mode,scope:'EMPTY_LOCAL_DATABASE_ONLY'}}});
 const accounts=[{alias:mode+'/admin',username:admin.username,password:adminPassword,role:'ADMIN',id:admin.id}];
 const references=r.service('catalog/service/reference.service','ReferenceService'),auth=r.service('auth/service/auth.service','AuthService'),acct=r.service('auth/service/account.service','AccountService');
 const department=await references.save('departments',undefined,{code:'ACPT-'+mode,name:'Bộ môn TEST '+mode},admin.id),training=await references.save('training-systems',undefined,{code:'ACPT-'+mode,name:'Hệ TEST '+mode},admin.id),area=await references.save('research-areas',undefined,{name:'Hướng TEST '+mode,description:runId,departmentId:department.id},admin.id);
 const actors={};
 for(const [alias,role,label] of [['faculty','FACULTY','Giáo vụ'],['student1','STUDENT','Nguyễn TEST An'],['student2','STUDENT','Trần TEST Bình'],['advisor','LECTURER','GVHD'],['reviewer','LECTURER','GVPB'],['chair','LECTURER','Chủ tịch'],['secretary','LECTURER','Thư ký'],['member','LECTURER','Ủy viên']]){
  const initial=strong(),password=strong(),username=prefix+'_'+alias;
  const input={username,name:'TEST '+label,email:username+'@example.invalid',phone:'0000000000',password:initial,roles:[role],...(role==='STUDENT'?{trainingSystemId:training.id,className:'TEST-'+mode,majorName:'Ngành TEST'}:{}),...(role==='LECTURER'?{departmentId:department.id,researchAreaIds:[area.id],maxStudents:10,academicDegree:'DOCTOR',academicRank:'NONE'}:{})};
  const user=await acct.create(input,admin.id);await auth.changePassword(user.id,initial,password);const login=await auth.login(username,password);assert.equal(login.user.id,user.id);assert(login.accessToken);
  const row=await db.userAccount.findUniqueOrThrow({where:{id:user.id},include:{student:true,lecturer:true}});actors[alias]={userId:user.id,username,studentId:row.student?.id,lecturerId:row.lecturer?.id};accounts.push({alias:mode+'/'+alias,username,password,role,id:user.id});
  if(row.student)await r.service('catalog/service/student.service','StudentService').save(row.student.id,{gpa:3.2,academicEligible:true},actors.faculty?.userId||admin.id);
 }
 const native= require('./runtime.cjs').NativeDate,localDay=new native(native.now()+7*3600000).toISOString().slice(0,10),anchor=native.parse(localDay+'T00:00:00+07:00'),day=86400000;
 const lifecycle=r.service('term/service/term-lifecycle.service','TermLifecycleService');
 const start=new native(anchor).toISOString(),end=new native(anchor+21*day).toISOString();
 const year=new native(anchor).getUTCFullYear();const semester=await lifecycle.createSemester({academicYear:year+'-'+(year+1),semester:1,name:'Học kỳ nghiệm thu TEST '+mode,startDate:start,endDate:end},actors.faculty.userId);
 const term=await lifecycle.create({code:runId+'-'+mode,name:'TEST B1–B10 '+mode+' — KHÔNG DÙNG NGHIỆP VỤ CHÍNH THỨC',semesterId:semester.id,trainingSystemId:training.id,startDate:start,endDate:end,registrationStart:start,registrationEnd:new native(anchor+day).toISOString()},actors.faculty.userId);
 // Dedicated room is configuration, not a synthetic defense/grade/confirmation producer.
 const room=await db.room.create({data:{code:'ACPT-'+mode,name:'Phòng nghiệm thu TEST '+mode,capacity:30,location:runId}});
 const plan=['REGISTRATION','ASSIGNMENT','PROPOSAL','WEEKLY','FINAL','DEFENSE'].map((code,i)=>({code,name:'TEST '+code,start:new native(anchor+i*day).toISOString(),end:new native(anchor+(i+1)*day).toISOString(),locked:false}));
 plan.push({code:'PROPOSAL_REVIEW',name:'TEST PROPOSAL_REVIEW',start:plan[2].start,end:plan[2].end,locked:false});
 const defenseDate=new native(anchor+5*day).toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
 const {AcceptancePolicyService}=require('../../.acceptance-build/acceptance/acceptance-policy.service');
 const bundle=await new AcceptancePolicyService(db).approve({runId,termId:term.id,departmentId:department.id,roomId:room.id,startAt:start,endAt:end,defenseDate},actors.faculty.userId);
 // Identity is the real authenticated TEST faculty account, explicitly marked as staging delegation.
 const allGrants=await db.rolePermission.findMany({orderBy:[{roleId:'asc'},{permissionId:'asc'}]});const beforeKeys=new Set(grantsBefore.map(g=>g.roleId+':'+g.permissionId));
 const data={mode,runId,termId:term.id,termCode:term.code,departmentId:department.id,trainingSystemId:training.id,areaId:area.id,roomId:room.id,semesterId:semester.id,actors,phasePlan:plan,policyHash:bundle.hash,policyApproval:bundle.approval,createdRoleGrants:allGrants.filter(g=>!beforeKeys.has(g.roleId+':'+g.permissionId)),roleGrantsBefore:grantsBefore,stage:'B1_DRAFT_CONFIGURATION',steps:{B1:'DRAFT',B2:'NOT_STARTED',B3:'NOT_STARTED',B4:'NOT_STARTED',B5:'NOT_STARTED',B6:'NOT_STARTED',B7:'NOT_STARTED',B8:'NOT_STARTED',B9:'NOT_STARTED',B10:'NOT_STARTED'},productionConnected:false};
 fs.writeFileSync(path.join(dir,mode+'.json'),JSON.stringify(data,null,2)+'\n');
 const existing=require('./vault.cjs').read(runId);existing.accounts.push(...accounts);require('./vault.cjs').write(runId,existing);
 console.log(JSON.stringify({mode,accountsCreated:accounts.length,termId:term.id,termCode:term.code,policies:9,approvalScope:'ACTUAL_AUTHENTICATED_TEST_FACULTY_STAGING_ONLY',stage:data.stage}));return data;
}
async function main(){const runId=require(path.join(cache,'latest.json')).runId;for(const mode of ['auto','manual']){const r=await require('./runtime.cjs').createRuntime(runId,mode);try{await provision(r,mode);}finally{await r.app.close();}}}
if(require.main===module)main().catch(e=>{const response=e.getResponse?.();console.error(JSON.stringify({status:'STAGING_PROVISION_FAILED',message:response||(e.name?.includes('Prisma')?e.code||e.name:e.message),productionWrites:0}));process.exitCode=1;});
module.exports={provision,extra};
