"use strict";
// Export a private inspection index from completed, independently verified stages.
// Planned scenarios and partial checkpoints must never become completion evidence.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {read,save,root,outputDir,safeError}=require("./context.cjs");
const stages=[
  ["topics-report.json","topics",r=>({TOPIC_AWAITING_ADVISOR:"Đề tài chờ GVHD",PROPOSAL_DRAFT:"Đề cương nháp",PROPOSAL_SUBMITTED:"Đề cương đã nộp"})[r.stage]],
  ["reviews-report.json","reviewsVerified",r=>({UNDER_REVIEW:"Đề cương đang duyệt",REVISION_REQUESTED:"Đề cương cần sửa",APPROVED:"Đề cương được duyệt"})[r.status]],
  ["dossiers-report.json","receivedDossiers",()=>"Hồ sơ đã tiếp nhận"],
  ["guidance-report.json","guidancePlans",r=>({GUIDANCE_IN_PROGRESS:"Kế hoạch hướng dẫn, chưa nộp bài",SUBMISSION_PENDING:"Bài nộp chờ nhận xét",PROGRESS_REVIEWED:"Bài nộp đã nhận xét đạt"})[r.stage]],
  ["final-reports-report.json","finalReports",r=>r.stage==="ADVISOR_CONFIRMED"?"GVHD đồng ý bảo vệ":"Đã nộp báo cáo cuối"],
  ["eligibility-report.json","finalizedEligibility",()=>"Đã chốt đủ điều kiện bảo vệ"],
  ["reviewers-report.json","finalizedReviewers",()=>"Đã chốt giảng viên phản biện"],
];
function acceptedReport(report,verification,countKey){
  return !!report&&Number.isInteger(verification[countKey])&&report.termId===verification.termId&&
    report.datasetId===verification.datasetId&&Number.isFinite(Date.parse(report.verifiedAt))&&
    Date.parse(report.verifiedAt)<=Date.parse(verification.verifiedAt)&&report.results.length===verification[countKey];
}
async function main(){
  const dataset=read("dataset.json"),plan=read("workflow-plan.json"),verification=read("workflow-verification.json");
  assert.equal(dataset.datasetId,verification.datasetId);assert.equal(plan.datasetId,dataset.datasetId);
  const optional=name=>fs.existsSync(path.join(outputDir,name))?read(name):null;
  const defense=optional("defense-verification.json"),variety=optional("topic-variety-report.json"),schedule=optional("schedules-report.json");
  const lateStages=[["reviewer-grades-report.json","finalizedReviewerGrades",()=>"Phản biện đã chốt điểm"],["committee-grades-report.json","committeeGradedStudents",()=>"Hội đồng đã chốt điểm"],["final-results-report.json","finalizedResults",r=>r.stage==="PUBLISHED"?"Kết quả đã công bố":"Kết quả đã chốt"]]
    .map(([file,key,label])=>({file,key,label,report:optional(file)})).filter(s=>defense&&acceptedReport(s.report,defense,s.key));
  const registration=read("registration-report.json"),assignment=read("assignment-report.json");
  assert.equal(registration.termId,verification.termId);assert.equal(assignment.termId,verification.termId);
  assert.equal(registration.datasetId,dataset.datasetId);assert.equal(assignment.datasetId,dataset.datasetId);
  assert.equal(assignment.status,"FINALIZED");assert.equal(assignment.assigned,76);
  const accepted=stages.map(([file,key,label])=>({file,key,label,report:optional(file)})).filter(s=>acceptedReport(s.report,verification,s.key));
  const committees=optional("committees-report.json"),committeeVerified=acceptedReport(committees,verification,"finalizedCommittees");
  const rows=dataset.selectedStudents.map(student=>{
    const reg=registration.results.find(r=>r.studentCode===student.studentCode);assert.ok(reg);
    const assigned=assignment.assignments.some(a=>a.studentId===reg.studentId);
    assert.equal(assigned,reg.status==="SUBMITTED");
    let current=assigned?"Đã phân công GVHD":"Đăng ký nháp",evidence=assigned?"assignment-report.json":"registration-report.json",context={...reg};
    for(const s of accepted){
      if(s.key==="finalizedReviewers"&&committeeVerified){
        const group=committees.results.find(g=>g.students.includes(context.termStudentId));
        if(group){current="Đã chốt hội đồng";evidence="committees-report.json";context.committeeCode=group.code;}
      }
      const row=s.report.results.find(r=>r.studentCode===student.studentCode);if(!row)continue;
      const label=s.label(row);assert.ok(label,"Unknown completed stage in "+s.file);
      current=label;evidence=s.file;context={...context,...row};
    }
    if(committeeVerified&&!accepted.some(s=>s.key==="finalizedReviewers"&&s.report.results.some(r=>r.studentCode===student.studentCode))){
      const group=committees.results.find(g=>g.students.includes(context.termStudentId));
      if(group){current="Đã chốt hội đồng";evidence="committees-report.json";context.committeeCode=group.code;}
    }
    if(defense&&acceptedReport(schedule,defense,"publishedSchedules")&&schedule.results.some(s=>s.slots.some(slot=>slot.termStudentId===context.termStudentId))){current="Lịch bảo vệ đã công bố";evidence="schedules-report.json";}
    for(const s of lateStages){const row=s.report.results.find(r=>r.studentCode===student.studentCode);if(row){current=s.label(row);evidence=s.file;context={...context,...row};}}
    const query="?termId="+verification.termId;
    return {studentCode:student.studentCode,fullName:student.fullName,className:student.className,current,
      plannedStop:plan.scenarios.find(s=>s.studentCode===student.studentCode).plannedStop,evidence,
      committee:context.committeeCode||"",proposalId:context.proposalId||"",topicTitle:context.proposalId?(variety?.results.find(r=>r.studentCode===student.studentCode)?.title||plan.scenarios.find(s=>s.studentCode===student.studentCode).topic.text):"",
      proposalUrl:context.proposalId?`http://127.0.0.1:5183/topic/proposal/${context.proposalId}${query}`:"",
      guidanceUrl:context.planId?`http://127.0.0.1:5183/guidance/plan/${context.proposalId}${query}`:"",
      finalReportUrl:context.finalReportVersionId?`http://127.0.0.1:5183/guidance/final-report${query}&proposalId=${context.proposalId}`:"",
      eligibilityUrl:context.termStudentId?`http://127.0.0.1:5183/defense/eligibility${query}&termStudentId=${context.termStudentId}`:"",
      reviewerGradeUrl:context.reviewerId?`http://127.0.0.1:5183/defense/reviewer-grading${query}&termStudentId=${context.termStudentId}&reviewerId=${context.reviewerId}`:"",
      committeeGradeUrl:context.committeeGrades?.length?`http://127.0.0.1:5183/defense/committee-grading${query}&termStudentId=${context.termStudentId}&committeeId=${context.committeeId}&lecturerId=${context.committeeGrades[0].lecturerId}`:"",
      finalResultUrl:context.resultRevision?`http://127.0.0.1:5183/defense/results${query}&termStudentId=${context.termStudentId}`:""};
  });
  assert.equal(rows.length,80);assert.equal(new Set(rows.map(r=>r.studentCode)).size,80);
  assert.equal(rows.filter(r=>r.topicTitle).length,verification.topics);assert.equal(new Set(rows.filter(r=>r.topicTitle).map(r=>r.topicTitle)).size,verification.distinctTopicTitles);
  const counts=Object.fromEntries([...new Set(rows.map(r=>r.current))].map(state=>[state,rows.filter(r=>r.current===state).length]));
  const Excel=require(path.join(root,"backend/node_modules/exceljs")),book=new Excel.Workbook(),sheet=book.addWorksheet("Trạng thái đã xác minh");
  sheet.columns=[{header:"Mã SV / tài khoản",key:"studentCode",width:23},{header:"Họ tên",key:"fullName",width:28},{header:"Lớp nguồn",key:"className",width:24},
    {header:"Mốc đã xác minh",key:"current",width:40},{header:"Mốc dự kiến (chưa chứng minh đã làm)",key:"plannedStop",width:42},{header:"Bằng chứng",key:"evidence",width:30},
    {header:"Hội đồng",key:"committee",width:20},{header:"Đề cương",key:"proposalUrl",width:35},{header:"Hướng dẫn",key:"guidanceUrl",width:35},{header:"Báo cáo cuối",key:"finalReportUrl",width:35},{header:"Xét điều kiện",key:"eligibilityUrl",width:35},{header:"Tên đề tài hiện tại",key:"topicTitle",width:85}];
  sheet.columns=[...sheet.columns.map(c=>({header:c.header,key:c.key,width:c.width})),{header:"Phiếu phản biện",key:"reviewerGradeUrl",width:35},{header:"Phiếu HĐ (đúng GV)",key:"committeeGradeUrl",width:35},{header:"Kết quả cuối",key:"finalResultUrl",width:35}];
  sheet.addRows(rows);sheet.views=[{state:"frozen",ySplit:1}];sheet.autoFilter="A1:O81";sheet.getRow(1).font={bold:true};
  for(let i=2;i<=81;i++)for(const col of [8,9,10,11,13,14,15]){const cell=sheet.getRow(i).getCell(col);if(cell.value){cell.value={text:"Mở màn hình",hyperlink:String(cell.value)};cell.font={color:{argb:"FF0563C1"},underline:true};}}
  const lecturerAccounts=read("lecturer-import-checkpoint.json").result,actors=[];
  for(const stage of lateStages)for(const row of stage.report.results){
    const base=`http://127.0.0.1:5183/defense/`,query=`?termId=${verification.termId}&termStudentId=${row.termStudentId}`;
    if(stage.key==="finalizedReviewerGrades"){const account=lecturerAccounts.find(a=>a.userId===row.reviewerUserId);assert.ok(account);actors.push({studentCode:row.studentCode,role:"Giảng viên phản biện",username:account.username,state:"FINALIZED",url:base+"reviewer-grading"+query+"&reviewerId="+row.reviewerId});}
    if(stage.key==="committeeGradedStudents")for(const grade of row.committeeGrades){const account=lecturerAccounts.find(a=>a.userId===grade.userId);assert.ok(account);actors.push({studentCode:row.studentCode,role:"Hội đồng — "+grade.role,username:account.username,state:"FINALIZED",url:base+"committee-grading"+query+"&committeeId="+row.committeeId+"&lecturerId="+grade.lecturerId});}
    if(stage.key==="finalizedResults"){actors.push({studentCode:row.studentCode,role:"Khoa",username:"khoa.nguon80",state:row.stage,url:base+"results"+query});if(row.stage==="PUBLISHED")actors.push({studentCode:row.studentCode,role:"Sinh viên — điểm đã công bố",username:row.studentCode,state:row.stage,url:base+"results"+query});}
  }
  const actorSheet=book.addWorksheet("Tài khoản bước cuối");actorSheet.columns=[{header:"Mã sinh viên",key:"studentCode",width:22},{header:"Vai trò cần đăng nhập",key:"role",width:32},{header:"Tên đăng nhập",key:"username",width:38},{header:"Trạng thái đã xác minh",key:"state",width:26},{header:"Mở phiếu/kết quả",key:"url",width:40}];actorSheet.addRows(actors);actorSheet.getRow(1).font={bold:true};actorSheet.views=[{state:"frozen",ySplit:1}];if(actors.length)actorSheet.autoFilter=`A1:E${actors.length+1}`;
  for(let i=2;i<=actors.length+1;i++){const cell=actorSheet.getRow(i).getCell(5);cell.value={text:"Đăng nhập đúng tài khoản rồi mở",hyperlink:String(cell.value)};cell.font={color:{argb:"FF0563C1"},underline:true};}
  const reviewerRows=lateStages.find(s=>s.key==="finalizedReviewerGrades")?.report.results||[],committeeRows=lateStages.find(s=>s.key==="committeeGradedStudents")?.report.results||[],resultRows=lateStages.find(s=>s.key==="finalizedResults")?.report.results||[];
  const scoreSheet=book.addWorksheet("Điểm tổng hợp để đối chiếu");scoreSheet.columns=[{header:"Mã sinh viên",key:"studentCode",width:22},{header:"Họ tên",key:"name",width:28},{header:"Điểm phản biện tổng hợp",key:"reviewer",width:28},{header:"4 phiếu hội đồng tổng hợp",key:"committee",width:100},{header:"Điểm GVHD trong kết quả chốt",key:"advisor",width:30},{header:"TB hội đồng trong kết quả chốt",key:"mean",width:30},{header:"Điểm cuối tổng hợp",key:"final",width:24},{header:"Trạng thái kết quả",key:"state",width:26}];
  scoreSheet.addRows(reviewerRows.map(row=>{const committee=committeeRows.find(r=>r.studentCode===row.studentCode),result=resultRows.find(r=>r.studentCode===row.studentCode);return{studentCode:row.studentCode,name:rows.find(r=>r.studentCode===row.studentCode).fullName,reviewer:row.reviewerScore,committee:committee?.committeeGrades.map(g=>`${g.role} (${lecturerAccounts.find(a=>a.userId===g.userId).username}): ${g.score}`).join("\n")||"",advisor:result?.calculation.components.ADVISOR_UC17||"",mean:result?.calculation.committeeScore||"",final:result?.calculation.finalScore||"",state:result?.stage||"Chưa chốt kết quả"};}));scoreSheet.getRow(1).font={bold:true};scoreSheet.views=[{state:"frozen",ySplit:1}];if(reviewerRows.length)scoreSheet.autoFilter=`A1:H${reviewerRows.length+1}`;for(let i=2;i<=reviewerRows.length+1;i++){scoreSheet.getRow(i).getCell(4).alignment={wrapText:true,vertical:"top"};scoreSheet.getRow(i).height=64;}
  const notes=book.addWorksheet("Cách dùng");notes.columns=[{header:"Thông tin",width:110}];
  notes.addRows([["Đợt NGUON80-2026 — danh tính từ nguồn, lịch sử/điểm tổng hợp để kiểm tra giao diện."],["Snapshot kiểm chứng DB: "+verification.verifiedAt],["Đăng nhập đúng tài khoản, chọn đợt NGUON80-2026. Link vẫn kiểm tra quyền theo người đăng nhập."],["Mốc dự kiến không phải trạng thái đã hoàn thành. Bảng chỉ dùng các báo cáo đã được kiểm chứng độc lập."],["Các nhóm dừng sớm vẫn giữ dữ liệu; giai đoạn cũ đã đóng nên có thể xem nhưng không tiếp tục sửa/nộp."],["Lịch test rút gọn ngày 18/11/2026; các bước cuối chỉ được tính khi có kiểm chứng riêng."],["Đã bàn giao mật khẩu khởi tạo sinh viên bằng mã sinh viên, bắt buộc đổi lần đầu. Sau khi bạn đổi, dùng mật khẩu mới của bạn."]]);
  if(defense)notes.addRow(["Snapshot kiểm chứng bước bảo vệ: "+defense.verifiedAt]);
  const access=optional("account-access-status.json");if(access?.role==="FACULTY"&&access.initialPasswordStillMatches===false)notes.addRow(["Khoa khoa.nguon80 đã đổi mật khẩu; dùng mật khẩu hiện tại, mật khẩu Khoa ban đầu trong workbook không còn hiệu lực. Không có thao tác reset trong lần kiểm tra này."]);
  const exports=optional("report-exports-report.json");if(defense&&acceptedReport(exports,defense,"reportExports")){
    const exportSheet=book.addWorksheet("Biểu mẫu đã xuất");exportSheet.columns=[{header:"Mẫu",key:"templateCode",width:34},{header:"Tệp trên máy",key:"filename",width:85},{header:"SHA-256",key:"sha256",width:68},{header:"Chữ ký",key:"signatureStatus",width:18},{header:"Dung lượng (bytes)",key:"sizeBytes",width:24}];exportSheet.addRows(exports.results);exportSheet.getRow(1).font={bold:true};exportSheet.views=[{state:"frozen",ySplit:1}];exportSheet.autoFilter=`A1:E${exports.results.length+1}`;
    for(let i=2;i<=exports.results.length+1;i++){const cell=exportSheet.getRow(i).getCell(2);cell.value={text:String(cell.value),hyperlink:"exports/"+String(cell.value)};cell.font={color:{argb:"FF0563C1"},underline:true};}
    notes.addRow(["Đã kiểm chứng 15 bản xuất mẫu; sheet Biểu mẫu đã xuất mở tệp tương đối trong thư mục exports cạnh workbook. Chỉ số liệu mẫu có lọc, không phải danh sách toàn bộ 80 SV. Tất cả chưa ký."]);
  }
  await book.xlsx.writeFile(path.join(outputDir,"tra-cuu-du-lieu-hien-co.private.xlsx"));
  save("inspection-index.private.json",{datasetId:dataset.datasetId,termId:verification.termId,verifiedAt:verification.verifiedAt,defenseVerifiedAt:defense?.verifiedAt||null,generatedAt:new Date().toISOString(),counts,rows,actors});
  console.log(JSON.stringify({students:80,snapshot:verification.verifiedAt,counts,file:".cache/source-dataset/tra-cuu-du-lieu-hien-co.private.xlsx"}));
}
module.exports={acceptedReport};
if(require.main===module)main().catch(safeError);
