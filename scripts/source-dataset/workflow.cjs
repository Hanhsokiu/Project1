"use strict";
// Preparation only: this file never claims API execution or writes workflow rows.
const fs=require("node:fs"),path=require("node:path");
const {root,outputDir}=require("./sources.cjs");
const {sha}=require("./extract.cjs");
const {generatedTitle}=require("./topic-variety.cjs");
const Excel=require(path.join(root,"backend/node_modules/exceljs"));
const steps=[
  ["registration-draft","Nháp đăng ký","STUDENT","PUT","registrations/term/:termId/me/draft","Lưu hướng và nguyện vọng hợp lệ; đúng cửa sổ đăng ký"],
  ["registration-submit","Đã gửi đăng ký","STUDENT","POST","registrations/term/:termId/me/submit","Chốt bản nháp; chỉ một đăng ký hiệu lực mỗi sinh viên/đợt"],
  ["assignment","Đã phân công hướng dẫn","FACULTY","POST","assignments/term/:termId/finalize","Preview → lưu nháp → công bố → chốt; kiểm quota, hướng, roster; không tự đổi GVHD nguồn"],
  ["topic-submit","Đề tài chờ đồng ý","STUDENT","POST","topics/term/:termId/student/:studentId/submit","Lưu nháp đề tài trước; có phân công GVHD hiệu lực"],
  ["proposal-draft","Đề cương nháp","STUDENT","POST","proposals/:proposalId/versions","GVHD đồng ý đề tài → prepare-workflow → tạo phiên bản đề cương; không sửa phiên bản đã niêm phong"],
  ["proposal-review","Đề cương đang duyệt","LECTURER","POST","proposal-reviews/:id/start","SV gửi phiên bản; Khoa tạo nhóm, thêm thành viên, phân người duyệt; người được phân bắt đầu duyệt"],
  ["proposal-revision","Đề cương cần sửa","LECTURER","POST","proposal-reviews/:id/decision","Nhận xét gắn phiên bản; quyết định REVISION_REQUIRED; giữ lịch sử và phản hồi SV"],
  ["proposal-approved","Đề cương được duyệt","LECTURER","POST","proposal-reviews/:id/decision","SV tạo v2, trả lời nhận xét và nộp lại; người duyệt quyết định APPROVED trên phiên bản hiện tại"],
  ["dossier-received","Hồ sơ đã tiếp nhận","FACULTY","POST","proposals/:proposalId/dossier/receipt","SV điền hồ sơ; chốt phiên bản, xuất PDF thật có checksum; Khoa tiếp nhận đúng bản chốt"],
  ["guidance-active","Đang làm nhiệm vụ","STUDENT","POST","tasks/:id/progress","GVHD tạo kế hoạch, nhiệm vụ, lịch gặp; SV cập nhật tiến độ trong phạm vi và deadline"],
  ["submission-pending","Báo cáo chờ nhận xét","STUDENT","POST","tasks/:taskId/submissions","Lưu nháp → upload PDF thật → gửi với uploadId/checksum; có kế hoạch tuần và nghĩa vụ nộp"],
  ["progress-reviewed","Báo cáo đã nhận xét","LECTURER","POST","task-submissions/:id/reviews","GVHD nhận xét PASS/REVISION_REQUIRED; có nhánh nộp lại và bản sửa nhận xét đúng revision"],
  ["final-report","Đã nộp báo cáo cuối","STUDENT","POST","proposals/:proposalId/final-report/pdf","UC17_POLICY hợp lệ, write flag, đúng giai đoạn FINAL, quyền sở hữu và file PDF thật"],
  ["eligibility","Đủ điều kiện bảo vệ","FACULTY","POST","defense-eligibility/finalize","GVHD review/decide báo cáo cuối; Khoa kiểm điều kiện học vụ, quyết định và chốt eligibility đúng revision"],
  ["committee","Đã chốt hội đồng","FACULTY","POST","defense-committees/:id/finalize","Có hội đồng, thành viên đủ học vị/vai trò; phân SV đủ điều kiện; kiểm xung đột với GVHD"],
  ["schedule","Lịch bảo vệ đã công bố","FACULTY","POST","defense-schedules/publish","Phân/chốt GVPB → preview lịch → tạo phiên → phân slot → chốt → công bố; không trùng phòng/người"],
  ["reviewer-grade","Phản biện đã chốt điểm","LECTURER","POST","defense-reviewer-grades/:id/finalize","GVPB hiện tại lưu phiếu đúng rubric/step, câu hỏi/nhận xét rồi chốt; giữ snapshot nguồn"],
  ["committee-grade","Hội đồng đã chốt điểm","COMMITTEE_MEMBER","POST","defense-committee-grades/:id/finalize","Mỗi thành viên hiện tại tự lưu/chốt phiếu; đúng lịch, attendance, rubric; không chấm hộ"],
  ["result-finalized","Kết quả đã chốt","FACULTY","POST","defense-results/:id/finalize","Preview nguồn đầy đủ → thành viên xác nhận theo quorum → Khoa chốt/khóa; đúng precision và công thức đã duyệt"],
  ["result-published","Kết quả đã công bố","FACULTY","POST","defense-results/:id/publish","Công bố đúng cửa sổ/quyền; SV chỉ xem phần được phép; xuất biểu mẫu UC25 qua preview/job/download, không giả chữ ký"],
];
function routesInSource(){
  const result=[];
  function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(entry.name.endsWith("controller.ts")){
    const text=fs.readFileSync(file,"utf8"),prefix=/@Controller\(\s*(?:["']([^"']*)["'])?\s*\)/.exec(text)?.[1]||"";
    for(const match of text.matchAll(/@(Get|Post|Put|Patch|Delete)\(\s*(?:["']([^"']*)["'])?\s*\)/g))result.push({method:match[1].toUpperCase(),path:[prefix,match[2]].filter(Boolean).join("/"),file:path.relative(root,file).replaceAll("\\","/")});
  }}}
  walk(path.join(root,"backend/src"));return result;
}
function workflow(dataset){
  const routes=routesInSource();
  const actions=steps.map(([key,label,actor,method,url,conditions],i)=>{
    const route=routes.find(r=>r.method===method&&r.path===url);if(!route)throw Error(`Missing real route: ${method} ${url}`);
    return {order:i+1,key,label,actorSelector:actor,method,url:"/api/"+url,controller:route.file,conditions,
      dependsOn:i?[steps[i-1][0]]:[],executionStatus:"NOT_EXECUTED",requiredPolicyKeys:i>=12?Array.from({length:({12:17,13:18,14:19,15:21,16:22,17:23,18:24,19:25})[i]-16},(_,j)=>`UC${17+j}_POLICY`):[]};
  });
  const scenarios=dataset.selectedStudents.map((student,i)=>{
    const end=Math.floor(i/4),stop=actions[end];
    return {studentCode:student.studentCode,fullName:student.fullName,className:student.className,advisorSourceKey:student.advisorKeys[0],
      topic:{text:student.topic||generatedTitle(i),origin:student.topic?"SOURCE_DOCUMENT":"GENERATED_SCENARIO"},
      group:stop.key,plannedStop:stop.label,actionKeys:actions.slice(0,end+1).map(a=>a.key),
      origin:"GENERATED_WORKFLOW_SCENARIO",executionStatus:"NOT_EXECUTED",events:[],
      expectedEvidence:["API responses with actual IDs/revisions","actor and real execution timestamp","audit rows","real file bytes and hashes when applicable","role-scoped UI screenshots"]};
  });
  return {datasetId:dataset.datasetId,kind:"WORKFLOW_PREPARATION_NOT_DATABASE_HISTORY",actions,scenarios,
    totals:{students:scenarios.length,groups:actions.length,studentsPerGroup:4},
    setup:["Import source accounts and verified lecturer departments/areas","Create a visibly labeled synthetic-workflow term on the existing DB; preserve official records",
      "Configure term roster, phases, quotas and scoped permissions through existing authorized operations","Approve exact UC17–25 configuration before enabling its writes",
      "Prepare private file storage and suppress external email delivery for generated workflow actions"],
    gates:["Department/area mappings are required before lecturer import","No artificial audit timestamps or fabricated human approval",
      "No direct status writes to skip validators, locks, phases or version checks","Initial password change/profile completeness must follow existing authentication rules",
      "Use actual server time; a scenario stopped earlier does not imply an earlier term is still open","Data displayed in the UI is verified only after API execution and browser checks"]};
}
async function main(){
  const dataset=JSON.parse(fs.readFileSync(path.join(outputDir,"dataset.json"),"utf8"));
  const plan=workflow(dataset);
  fs.writeFileSync(path.join(outputDir,"workflow-plan.json"),JSON.stringify(plan,null,2)+"\n");
  const mappingFile=path.join(outputDir,"lecturer-mapping.json");
  if(!fs.existsSync(mappingFile))fs.writeFileSync(mappingFile,JSON.stringify({datasetId:dataset.datasetId,confirmedDistinctNames:["Trình Văn Chung","Trịnh Văn Chung"],
    rows:dataset.lecturers.map(l=>({key:l.key,fullName:l.fullName,suggestedUsername:`gv.${sha(l.key).slice(0,10)}`,usernameOrigin:"GENERATED_NOT_STAFF_CODE",departmentCode:null,
      observedResearchAreas:l.observedAreas,confirmedResearchAreaIds:[],maxStudents:null}))},null,2)+"\n");
  const book=new Excel.Workbook();
  const sheet=book.addWorksheet("Bộ môn giảng viên");sheet.columns=[{header:"Họ tên",key:"fullName",width:28},{header:"Bộ môn (bạn điền)",key:"departmentCode",width:27},{header:"Hướng quan sát từ file",key:"areas",width:70},{header:"Chuyên môn xác nhận (bạn điền)",key:"confirmedAreas",width:40},{header:"Chỉ tiêu (bạn điền)",key:"quota",width:23}];
  sheet.addRows(dataset.lecturers.map(l=>({fullName:l.fullName,areas:l.observedAreas.join("; ")})));
  sheet.getRow(1).font={bold:true};sheet.views=[{state:"frozen",ySplit:1}];
  const mappingXlsx=path.join(outputDir,"bo-mon-giang-vien.xlsx");if(!fs.existsSync(mappingXlsx))await book.xlsx.writeFile(mappingXlsx);
  const guide=["# Kịch bản dữ liệu cho 80 sinh viên","","Trạng thái: CHƯA THỰC THI workflow. Đây là danh sách thao tác dự kiến, không phải lịch sử DB.","",
    "Mỗi nhóm có 4 sinh viên dừng ở một mốc. Nhóm phía sau đi qua các bước phía trước. Các nhánh sửa/nộp lại phải có phiên bản và người thao tác thực tế.","",
    "| Mốc | Nhóm | Người thao tác | API chính | Điều kiện / thao tác bổ sung |","|---|---|---|---|---|",
    ...plan.actions.map(a=>`| ${a.order} | ${a.label} | ${a.actorSelector} | ${a.method} ${a.url} | ${a.conditions} |`),"",
    "## Danh sách theo nhóm","",...plan.actions.flatMap(a=>[`### ${a.order}. ${a.label}`,"",...plan.scenarios.filter(s=>s.group===a.key).map(s=>`- ${s.studentCode} — ${s.fullName} — ${s.className}`),""]),
    "## Điều kiện còn thiếu","",...plan.gates.map(g=>`- ${g}`),""];
  fs.writeFileSync(path.join(outputDir,"quy-trinh-80-sinh-vien.md"),guide.join("\n"));
  const lecturerPlanFile=path.join(outputDir,"lecturer-import-plan.json");
  const pending=fs.existsSync(lecturerPlanFile)?JSON.parse(fs.readFileSync(lecturerPlanFile,"utf8")).summary.pending:dataset.lecturers.length;
  console.log(JSON.stringify({...plan.totals,realControllerRoutesVerified:plan.actions.length,workflowExecuted:false,lecturerMappingsPending:pending}));
}
module.exports={workflow,routesInSource};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
