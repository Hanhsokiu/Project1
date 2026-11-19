"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {clean,lecturerIdentity,parsePdfLine,combine,extract}=require("./extract.cjs");
test("Unicode, whitespace, title aliases preserve distinct lecturer identities",()=>{
  assert.equal(clean("  Nguyễn \n  Văn A "),"Nguyễn Văn A");
  assert.equal(lecturerIdentity("TS.Lương Thái Lê ").key,lecturerIdentity("TS. Lương Thái Lê").key);
  assert.notEqual(lecturerIdentity("ThS. Trình Văn Chung").key,lecturerIdentity("ThS. Trịnh Văn Chung").key);
  assert.equal(lecturerIdentity("KS. Bùi Minh Thảo").name,"Bùi Minh Thảo");
  assert.equal(lecturerIdentity("KS. Bùi Minh Thảo").academicDegree,null);
  assert.equal(lecturerIdentity("PGS.TS Nguyễn Văn Long").academicRank,"ASSOCIATE_PROFESSOR");
});
test("PDF preserves codes with or without class, flags missing code",()=>{
  const parse=text=>parsePdfLine({items:[{text}]},{key:"pdf",page:1,line:1});
  assert.deepEqual(parse("1 CNCNTT 1 62 211200553 Đoàn Việt Anh 7.9 8.2 8.08").sourceScores,{process:7.9,defense:8.2,final:8.08});
  assert.equal(parse("281 201200094 Phạm Tiến Đức 9.3 8.6 8.85").studentCode,"201200094");
  assert.equal(parse("281 201200094 Phạm Tiến Đức 9.3 8.6 8.85").className,"");
  assert.equal(parse("206 CNCNTT 5 62 ` Nguyễn Tiến Đạt 8.5 8.5 8.50").issue,"PDF_ROW_WITHOUT_VALID_CODE");
});
test("Never merge by name; conflicting student records cannot enter the selected set",()=>{
  const record=(code,name,source)=>({studentCode:code,fullName:name,className:"K63",advisor:"TS. Nguyễn Văn A",source:{key:source}});
  const rows=[record("001234567","Nguyễn Văn Bình","a"),record("001234567","Nguyễn Văn Bính","b"),record("001234568","Nguyễn Văn Bình","a")];
  const data=combine(rows,[],[],1);
  assert.equal(data.allStudents.length,2);assert.equal(data.selectedStudents[0].studentCode,"001234568");
  assert.throws(()=>combine(rows,[],[],2),/Only 1/);
});
test("Actual three sources: deterministic 80 complete identities and all distinct lecturers",async()=>{
  const a=await extract(80),b=await extract(80);
  assert.deepEqual(a,b);assert.equal(a.selectedStudents.length,80);assert.equal(a.lecturers.length,36);
  assert.equal(new Set(a.selectedStudents.map(s=>s.studentCode)).size,80);
  assert.equal(a.manifest.length,3);assert.equal(a.pdfPages.length,7);
  assert.equal(a.allStudents.flatMap(s=>s.observations).filter(o=>o.source.key==="course-results").length,283);
  assert.equal(a.issues.filter(i=>i.issue==="PDF_ROW_WITHOUT_VALID_CODE").length,1);
  for(const s of a.selectedStudents){assert.equal(s.conflicts.length,0);assert.ok(s.fullName);assert.ok(s.className);assert.equal(s.advisorKeys.length,1);assert.ok(a.lecturers.some(l=>l.key===s.advisorKeys[0]));}
});
