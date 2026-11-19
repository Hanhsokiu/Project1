"use strict";
const assert=require("node:assert/strict");
const {context,dist,read,save,safeError}=require("./context.cjs");
const {sha}=require("./extract.cjs");
function academicFacts(code){return {gpa:(250+parseInt(sha(code).slice(0,4),16)%131)/100,academicEligible:true};}
async function main(){
  const c=await context();
  try{
    const Audit=dist("common/audit/audit.service.js","AuditService"),Catalog=dist("catalog/repository/catalog.repository.js","CatalogRepository"),Student=dist("catalog/service/student.service.js","StudentService");
    const Repo=dist("term/repository/term.repository.js","TermRepository"),Validator=dist("term/validator/term-transition.validator.js","TermTransitionValidator"),Term=dist("term/service/term-lifecycle.service.js","TermLifecycleService");
    const termService=adapter=>new Term(new Repo(adapter),new Validator(),new Audit(adapter));
    const profiles=[];
    const imported=read("student-import-report.json");
    for(const source of c.dataset.selectedStudents){
      const student=await c.db.student.findUnique({where:{studentCode:source.studentCode},select:{id:true,userId:true}});
      assert.ok(student&&imported.result.some(r=>r.studentCode===source.studentCode&&r.userId===student.userId),"Only dataset-owned students may receive generated facts");
      const result=await c.once("academic:"+source.studentCode,{fields:academicFacts(source.studentCode),source:"USER_AUTHORIZED_SYNTHETIC_ACADEMIC_DATA",notOfficialTranscript:true},async(tx,adapter)=>{
        await new Student(new Catalog(adapter,new Audit(adapter))).save(student.id,academicFacts(source.studentCode),c.faculty.userId);
        return {studentCode:source.studentCode,studentId:student.id,userId:student.userId,...academicFacts(source.studentCode)};
      });profiles.push(result);
      if(profiles.length%20===0)console.log(`Academic profiles: ${profiles.length}/80`);
    }
    save("academic-profile-report.json",{origin:"USER_AUTHORIZED_SYNTHETIC_ACADEMIC_DATA",officialTranscript:false,profiles});
    const calendar=await c.once("calendar-v1",{origin:"GENERATED_TERM_CALENDAR"},async(tx,adapter)=>{
      const now=new Date(),startYear=now.getUTCMonth()>=7?now.getUTCFullYear():now.getUTCFullYear()-1,year=`${startYear}-${startYear+1}`;
      const startDate=new Date(now.getTime()-86400000),endDate=new Date(now.getTime()+90*86400000);
      const semesters=await tx.academicSemester.findMany({where:{academicYear:year}});
      let semester=semesters.find(s=>s.startDate<=startDate&&s.endDate>=endDate);
      if(!semester){
        const number=[1,2,3].find(n=>!semesters.some(s=>s.semester===n));assert.ok(number,"No unused semester slot covers the generated term");
        semester=await termService(adapter).createSemester({academicYear:year,semester:number,name:`Kỳ dữ liệu nguồn 80 — ${year}`,startDate:new Date(`${startYear}-08-01T00:00:00+07:00`).toISOString(),endDate:new Date(`${startYear+1}-08-01T00:00:00+07:00`).toISOString()},c.faculty.userId);
      }
      const system=await tx.trainingSystem.findUnique({where:{code:"CQ"}});assert.ok(system);
      return {semesterId:semester.id,trainingSystemId:system.id,startDate:startDate.toISOString(),endDate:endDate.toISOString(),registrationStart:startDate.toISOString(),registrationEnd:new Date(now.getTime()+7*86400000).toISOString()};
    });
    const term=await c.once("term-v1",{label:"SOURCE IDENTITIES / SYNTHETIC WORKFLOW"},async(tx,adapter)=>{
      const code="NGUON80-2026";assert.equal(await tx.thesisTerm.findUnique({where:{code}}),null,"Term code exists outside checkpoint");
      const created=await termService(adapter).create({...calendar,code,name:"Dữ liệu nguồn 80 — quy trình tổng hợp"},c.faculty.userId);
      return {id:created.id,code};
    });
    const lecturers=read("lecturer-import-report.json");
    await c.once("roster-v1",{students:80,lecturers:33,quotaOrigin:"GENERATED_CAPACITY_FROM_SOURCE_ADVISOR_LOAD"},async(tx,adapter)=>{
      const people=await tx.lecturer.findMany({where:{userId:{in:lecturers.result.map(r=>r.userId)}},select:{id:true,fullName:true}});
      assert.equal(people.length,33);
      const load=c.dataset.selectedStudents.reduce((m,s)=>(m[s.advisorKeys[0]]=(m[s.advisorKeys[0]]||0)+1,m),{});
      const members=people.map(p=>({lecturerId:p.id,quota:Math.max(5,load[p.fullName.toLocaleLowerCase("vi")]||0)}));
      await termService(adapter).saveRoster(term.id,{studentIds:profiles.map(s=>s.studentId),lecturers:members},c.faculty.userId);
      return {studentCount:80,lecturerCount:33};
    });
    const verified=await c.db.thesisTerm.findUnique({where:{id:term.id},include:{_count:{select:{termStudents:true,termLecturers:true}},pr2bAcademicTermGrantTermId:true}});
    assert.equal(verified._count.termStudents,80);assert.equal(verified._count.termLecturers,33);
    assert.ok(verified.pr2bAcademicTermGrantTermId.some(g=>g.userId===c.faculty.userId&&g.isActive!==false));
    const report={operation:"APPLIED",projectRef:c.target.projectRef,datasetId:c.dataset.datasetId,termId:term.id,code:term.code,status:verified.status,academicProfiles:80,students:80,lecturers:33,faculty:c.faculty.username,
      gradeOrigin:"GENERATED_NOT_OFFICIAL_TRANSCRIPT",workflowHistory:"NOT_YET_EXECUTED",verifiedAt:new Date().toISOString()};
    save("foundation-report.json",report);console.log(JSON.stringify(report,null,2));
  }finally{await c.db.$disconnect();}
}
module.exports={academicFacts};
if(require.main===module)main().catch(safeError);
