"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {outputDir}=require("./sources.cjs");
const {combine}=require("./extract.cjs");
const {prepare}=require("./prepare-lecturers.cjs");
const {ownership}=require("./import-lecturers.cjs");
test("A lecturer name in a source area cell does not create a bogus research area",()=>{
  const student={studentCode:"001234567",fullName:"Nguyễn Văn A",className:"K63",advisor:"TS. Nguyễn Văn B",area:"TS. Nguyễn Văn C",source:{key:"source"}};
  const d=combine([student],[{raw:student.advisor,area:student.area,source:student.source}],[],1);
  assert.deepEqual(d.lecturers[0].observedAreas,[]);assert.deepEqual(d.selectedStudents[0].areas,[]);
  assert.equal(d.selectedStudents[0].observations[0].area,student.area);
});
test("33 confirmed departments and two authorized area supplements leave only three pending",()=>{
  const d=JSON.parse(fs.readFileSync(path.join(outputDir,"dataset.json"),"utf8"));
  const c=JSON.parse(fs.readFileSync(path.join(outputDir,"department-confirmations.json"),"utf8"));
  const p=prepare(d,c);assert.deepEqual(p.summary,{total:36,confirmedDepartments:33,ready:33,pending:3});
  assert.deepEqual(prepare(d,{...c,supplementalAreas:[]}).summary,{total:36,confirmedDepartments:33,ready:31,pending:5});
  assert.equal(p.rows.find(r=>r.fullName==="Nguyễn Ngọc Hưng").areaOrigin,"USER_AUTHORIZED_GENERATED_SUPPLEMENT");
  const names=["Trình Văn Chung","Trịnh Văn Chung"].map(n=>p.rows.find(r=>r.fullName===n));
  assert.notEqual(names[0].username,names[1].username);assert.equal(names[0].department,null);assert.equal(names[1].department.code,"MANG-HTTT");
  assert.ok(p.rows.find(r=>r.fullName==="Nguyễn Thị Hồng Hoa").department.name==="PTN Điện - Điện tử");
  assert.throws(()=>prepare(d,{...c,departments:[...c.departments,{code:"OTHER",name:"Other",lecturers:["Nguyễn Đức Dư"]}]}),/multiple departments/);
});
test("Lecturer import never adopts another account; owned rerun preserves it",()=>{
  const row={fullName:"Nguyễn Văn A"},existing={id:"a",lecturer:row};
  assert.equal(ownership(null,null,row,"dataset"),"CREATE");
  assert.throws(()=>ownership(existing,null,row,"dataset"),/outside this import/);
  const marker={action:"SOURCE_DATASET_LECTURER_IMPORTED",resourceId:"a",newValue:{datasetId:"dataset"}};
  assert.equal(ownership(existing,marker,row,"dataset"),"KEEP");
  assert.throws(()=>ownership(existing,marker,{fullName:"Other"},"dataset"),/name changed/);
});
