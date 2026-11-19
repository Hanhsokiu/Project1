"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {root,outputDir}=require("./sources.cjs");
const {clean,sha}=require("./extract.cjs");
const slug=name=>clean(name).normalize("NFD").replace(/\p{M}/gu,"").replace(/[đĐ]/g,"d").toLowerCase().replace(/[^a-z0-9]+/g,".").replace(/^\.|\.$/g,"");
function prepare(dataset,confirmation){
  const assignment=new Map(),sourceKeys=new Set(dataset.lecturers.map(l=>l.fullName));
  for(const department of confirmation.departments)for(const name of department.lecturers){
    assert.ok(sourceKeys.has(name),"Confirmed lecturer not present in sources: "+name);
    assert.ok(!assignment.has(name),"Lecturer mapped to multiple departments: "+name);
    assignment.set(name,{code:department.code,name:department.name});
  }
  assert.equal(assignment.size,33,"Expected the 33 department confirmations supplied by user");
  for(const name of confirmation.unknownDepartments){assert.ok(sourceKeys.has(name));assert.ok(!assignment.has(name));}
  const supplements=new Map();
  for(const supplement of confirmation.supplementalAreas||[]){
    assert.ok(sourceKeys.has(supplement.fullName)&&!supplements.has(supplement.fullName),"Invalid or duplicate supplemental lecturer");
    assert.ok(supplement.origin==="USER_AUTHORIZED_GENERATED_SUPPLEMENT"&&supplement.areas.length>0&&supplement.areas.every(a=>clean(a).length>1),"Supplement must record user authorization and nonempty areas");
    supplements.set(supplement.fullName,supplement);
  }
  const rows=dataset.lecturers.map(l=>{
    const department=assignment.get(l.fullName)||null;
    const supplement=supplements.get(l.fullName),areas=[...new Set([...l.observedAreas,...(supplement?.areas||[])])];
    const base=slug(l.fullName),duplicates=dataset.lecturers.filter(x=>slug(x.fullName)===base).length;
    const username=`gv.${base}${duplicates>1?"."+sha(l.key).slice(0,4):""}`;
    const blockers=[];
    if(!department)blockers.push("DEPARTMENT_NOT_CONFIRMED");
    if(!areas.length)blockers.push("RESEARCH_AREA_NOT_AVAILABLE");
    if(l.degrees.length>1||l.ranks.length>1)blockers.push("ACADEMIC_TITLE_CONFLICT");
    return {key:l.key,fullName:l.fullName,username,usernameOrigin:"GENERATED_NOT_STAFF_CODE",department,
      researchAreas:areas,areaOrigin:supplement?supplement.origin:"OBSERVED_ADVISOR_AREAS_IN_SOURCE",academicDegree:l.degrees[0]||null,academicRank:l.ranks[0]||"NONE",
      maxStudents:5,quotaOrigin:"APPLICATION_DEFAULT_NOT_OFFICIAL_TERM_QUOTA",sources:l.sources,blockers,status:blockers.length?"PENDING_INFORMATION":"READY"};
  });
  assert.equal(new Set(rows.map(r=>r.username)).size,rows.length,"Generated usernames collide");
  return {datasetId:dataset.datasetId,departmentOrigin:confirmation.origin,contentHash:sha(JSON.stringify(rows)),rows,
    summary:{total:rows.length,confirmedDepartments:assignment.size,ready:rows.filter(r=>r.status==="READY").length,pending:rows.filter(r=>r.status!=="READY").length}};
}
async function main(){
  const data=JSON.parse(fs.readFileSync(path.join(outputDir,"dataset.json"),"utf8"));
  const confirmation=JSON.parse(fs.readFileSync(path.join(outputDir,"department-confirmations.json"),"utf8"));
  const plan=prepare(data,confirmation);fs.writeFileSync(path.join(outputDir,"lecturer-import-plan.json"),JSON.stringify(plan,null,2)+"\n");
  const Excel=require(path.join(root,"backend/node_modules/exceljs")),book=new Excel.Workbook(),sheet=book.addWorksheet("Giảng viên đã đối chiếu");
  sheet.columns=[{header:"Họ tên",key:"fullName",width:28},{header:"Username dự kiến",key:"username",width:34},{header:"Bộ môn người dùng xác nhận",key:"department",width:47},
    {header:"Hướng quan sát trong nguồn",key:"areas",width:68},{header:"Trạng thái",key:"status",width:25},{header:"Thông tin thiếu",key:"blockers",width:45}];
  sheet.addRows(plan.rows.map(r=>({...r,department:r.department?.name||"CHƯA XÁC MINH",areas:r.researchAreas.join("; "),blockers:r.blockers.join("; ")})));
  sheet.getRow(1).font={bold:true};sheet.views=[{state:"frozen",ySplit:1}];sheet.eachRow(r=>r.alignment={vertical:"top",wrapText:true});
  await book.xlsx.writeFile(path.join(outputDir,"giang-vien-da-doi-chieu.xlsx"));
  console.log(JSON.stringify({...plan.summary,contentHash:plan.contentHash,pending:plan.rows.filter(r=>r.blockers.length).map(r=>({name:r.fullName,blockers:r.blockers}))},null,2));
}
module.exports={prepare,slug};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
