"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const {context,dist,req,read,save,outputDir,safeError}=require("./context.cjs");
const {RegistrationWriteSchema}=require("../../backend/dist/registration/dto/registration.dto.js");
async function main(){
  const c=await context();
  try{
    const term=read("foundation-report.json"),plan=read("workflow-plan.json"),lecturerPlan=read("lecturer-import-plan.json");
    const Audit=dist("common/audit/audit.service.js","AuditService"),UserRepo=dist("auth/repository/user-account.repository.js","UserAccountRepository"),Auth=dist("auth/service/auth.service.js","AuthService");
    const TermRepo=dist("term/repository/term.repository.js","TermRepository"),Term=dist("term/service/term-lifecycle.service.js","TermLifecycleService"),TV=dist("term/validator/term-transition.validator.js","TermTransitionValidator"),Window=dist("term/service/term-window.service.js","TermWindowService");
    const RegRepo=dist("registration/repository/registration.repository.js","RegistrationRepository"),Registration=dist("registration/service/registration.service.js","RegistrationService");
    await c.once("registration-open",{operation:"TERM_TRANSITION",targetStatus:"OPEN_REGISTRATION"},async(tx,adapter)=>{
      const current=await tx.thesisTerm.findUnique({where:{id:term.termId}});assert.equal(current.status,"DRAFT");
      await new Term(new TermRepo(adapter),new TV(),new Audit(adapter)).transition(term.termId,"OPEN_REGISTRATION",c.faculty.userId);
      return {termId:term.termId,status:"OPEN_REGISTRATION"};
    });
    const sessionFile=path.join(outputDir,"workflow-passwords.private.json");
    const passwords=fs.existsSync(sessionFile)?read("workflow-passwords.private.json"):{datasetId:c.dataset.datasetId,students:[]};assert.equal(passwords.datasetId,c.dataset.datasetId);
    for(const source of c.dataset.selectedStudents)if(!passwords.students.some(p=>p.username===source.studentCode))passwords.students.push({username:source.studentCode,temporaryWorkflowPassword:crypto.randomBytes(18).toString("base64url")+"!aA1",handoffPassword:source.studentCode});
    save("workflow-passwords.private.json",passwords);
    const results=[];
    for(const [index,source] of c.dataset.selectedStudents.entries()){
      const scenario=plan.scenarios.find(s=>s.studentCode===source.studentCode);assert.ok(scenario);
      const student=await c.db.student.findUnique({where:{studentCode:source.studentCode},select:{id:true,userId:true}});assert.ok(student);
      await c.once("onboarding:"+source.studentCode,{origin:"SYNTHETIC_CONTACTS",passwordChange:"EXISTING_AUTH_SERVICE",handoff:"RESET_TO_STUDENT_CODE_AFTER_GENERATION"},async(tx,adapter)=>{
        const service=new Auth(new UserRepo(adapter),new (req("@nestjs/jwt").JwtService)(),new (req("@nestjs/config").ConfigService)(),new Audit(adapter));
        await service.changePassword(student.userId,source.studentCode,passwords.students.find(p=>p.username===source.studentCode).temporaryWorkflowPassword);
        const contact={name:source.fullName,email:`${source.studentCode}@source80.example.invalid`,phone:"000"+String(index+1).padStart(7,"0")};
        await service.updateProfile(student.userId,contact);
        return {userId:student.userId,contactOrigin:"GENERATED_NOT_REAL_CONTACT",emailDomain:"example.invalid"};
      });
      const lecturerSource=lecturerPlan.rows.find(l=>l.key===source.advisorKeys[0]);assert.ok(lecturerSource?.status==="READY");
      let advisor=await c.db.lecturer.findUnique({where:{lecturerCode:lecturerSource.username},include:{researchAreas:{include:{researchArea:true}}}});assert.ok(advisor);
      const originalAdvisorId=advisor.id;
      if(!advisor.academicDegree){
        // The official quota validator requires MASTER/DOCTOR. Do not invent a degree
        // for a source entry marked KS; choose a documented synthetic advisor instead.
        advisor=await c.db.lecturer.findFirst({where:{departmentId:advisor.departmentId,academicDegree:{in:["MASTER","DOCTOR"]},
          lecturerCode:{in:lecturerPlan.rows.filter(l=>l.status==="READY").map(l=>l.username)},
          researchAreas:{some:{researchAreaId:{in:advisor.researchAreas.map(a=>a.researchAreaId)}}}},orderBy:{lecturerCode:"asc"},include:{researchAreas:{include:{researchArea:true}}}});
        assert.ok(advisor,"No eligible synthetic advisor for source lecturer without confirmed academic degree");
      }
      const area=advisor.researchAreas.find(a=>source.areas.includes(a.researchArea.name))||[...advisor.researchAreas].sort((a,b)=>a.researchArea.name.localeCompare(b.researchArea.name,"vi"))[0];assert.ok(area);
      const body=RegistrationWriteSchema.parse({directionId:area.researchAreaId,preferences:[{lecturerId:advisor.id,preferenceOrder:1}],note:originalAdvisorId===advisor.id?"[QUY TRÌNH TỔNG HỢP] Nguyện vọng GVHD theo nguồn; hướng chọn từ chuyên môn đã có.":"[QUY TRÌNH TỔNG HỢP] Chọn GVHD cùng bộ môn/hướng đã có học vị phù hợp; GVHD nguồn mang chức danh KS, chưa có học vị mà policy quota yêu cầu. Giữ nguyên thông tin nguồn trong manifest."});
      const service=adapter=>new Registration(new RegRepo(adapter),new TermRepo(adapter),new Window(new TermRepo(adapter)));
      const draft=await c.once("registration-draft:"+source.studentCode,{student:source.studentCode,origin:"GENERATED_WORKFLOW"},async(tx,adapter)=>service(adapter).save(term.termId,student.userId,body,false));
      let outcome=draft;
      if(scenario.actionKeys.includes("registration-submit"))outcome=await c.once("registration-submit:"+source.studentCode,{student:source.studentCode,origin:"GENERATED_WORKFLOW"},async(tx,adapter)=>service(adapter).save(term.termId,student.userId,body,true));
      results.push({studentCode:source.studentCode,studentId:student.id,userId:student.userId,registrationId:outcome.id,status:outcome.status,advisorId:advisor.id,sourceAdvisorId:originalAdvisorId,advisorOrigin:originalAdvisorId===advisor.id?"SOURCE":"GENERATED_SUBSTITUTE_WITH_VALID_DEGREE",directionId:area.researchAreaId});
      save("registration-checkpoint.json",{termId:term.termId,results});
      if(results.length%10===0)console.log(`Registrations verified: ${results.length}/80`);
    }
    const rows=await c.db.registration.findMany({where:{termId:term.termId},select:{id:true,status:true}});
    assert.equal(rows.length,80);assert.equal(rows.filter(r=>r.status==="DRAFT").length,4);assert.equal(rows.filter(r=>r.status==="SUBMITTED").length,76);
    const report={termId:term.termId,datasetId:c.dataset.datasetId,operation:"APPLIED",origin:"GENERATED_WORKFLOW",draft:4,submitted:76,verifiedAt:new Date().toISOString(),results};
    save("registration-report.json",report);console.log(JSON.stringify({...report,results:undefined}));
  }finally{await c.db.$disconnect();}
}
if(require.main===module)main().catch(safeError);
