# PR1 — Baseline nghiệp vụ và API/Data Contract bước 4–8

Phiên bản hợp nhất ngày 21/10/2026. **Quyết định nghiệp vụ đã xác nhận; bản baseline cuối đang chờ người dùng phê duyệt. Chưa được bắt đầu PR2.**

Tài liệu này là baseline duy nhất cho PR1. Thay thế toàn bộ các bảng proposal B01–B12/C01–C10 và phần ghi đè theo thứ tự ở bản trước; không còn yêu cầu người triển khai ghép các phương án lịch sử để đoán contract. Chưa thay Prisma, migration, code nghiệp vụ, DTO thực thi, dependencies hoặc OpenAPI hiện có.

## 1. Căn cứ, trạng thái và phạm vi

| Mã | Nguồn / locator |
|---|---|
| D | [Project_1_06.docx](../spec/Project_1_06.docx): quy trình bước 1–8; Giai đoạn 3/4; UC10–UC16; thiết kế CSDL §2.4.2 |
| M | [dac-ta-use-case.md](../spec/dac-ta-use-case.md): quy trình 10 bước, UC11–UC16, biểu mẫu đề cương |
| A | [ADR cá nhân](../adr/0002-do-an-ca-nhan.md): thay thế ghép nhóm, mỗi SV hồ sơ riêng |
| P | [ADR NestJS/Prisma](../adr/0002-nestjs-prisma.md): schema/repository/migration; [ADR monorepo](../adr/0001-monorepo-typescript.md): shared types/Zod |
| G | [ADR công thức điểm](../adr/0003-cong-thuc-diem-cau-hinh.md): cấu hình điểm, không biến đánh giá task thành điểm học phần |
| R | [00-repository-audit.md](00-repository-audit.md): kiến trúc, API/model hiện có, drift và 14 nhóm cần quyết định |
| U1 | Phản hồi B01–B12 trong văn bản người dùng đính kèm: cá nhân, một Khoa, member review không cần đủ vote, không phiên duyệt vật lý phức tạp, chữ ký giấy, phân loại file và lịch sử |
| U2 | Chỉ dẫn tiếp theo của người dùng: đồng ý phương án đề xuất C01–C10; bổ sung một quyết định chung hiệu lực/vòng, nhận biết tuần thiếu báo cáo dù chưa có task thủ công, lưu riêng PASS/FAIL/REVISION_REQUIRED |
| C | Prisma schema và code hiện tại: bằng chứng hiện trạng, không phải căn cứ tự quyết nghiệp vụ |

**CONFIRMED** trong tài liệu là quy tắc có căn cứ D/M/A hoặc được U1/U2 chốt. Thiết kế field/DTO/index/cơ chế transaction là contract kỹ thuật hợp nhất để người dùng phê duyệt, chưa có nghĩa implementation tồn tại. Khi nguồn cũ mâu thuẫn, quyết định U1/U2 dưới đây giải quyết cho phạm vi bước 4–8, không sửa ngược DOCX/ADR.

DOCX thực ở `docs/spec/Project_1_06.docx`, không ở docs/requirements. Đã đọc OOXML văn bản/bảng; chưa kiểm chứng trực quan các ảnh nhúng và bố cục mẫu PDF. File DOCX đang có sửa từ trước, không ghi đè. Không lấy các nhận định “Schema đã chặn” trong U1 làm bằng chứng migration đã được thực hiện.

Phạm vi chức năng: UC12/13, UC14–16, biểu mẫu đề cương liên quan UC25. Bước 1–3 là producer phải phối hợp; bước 9–10 chỉ là consumer của proposalId/lịch sử, không triển khai bảo vệ hoặc tính điểm trong PR1/PR2 này.

## 2. Quyết định hợp nhất — 14 nhóm, không còn câu hỏi B/C mở

Tất cả dòng dưới có trạng thái **CONFIRMED** về nghiệp vụ; DB/API/FE mô tả tác động thiết kế sau khi baseline được duyệt.

| ID / ánh xạ cũ | Căn cứ | Quyết định duy nhất | Ảnh hưởng DB / API / frontend |
|---|---|---|---|
| D01 / B01 | A: “Thay thế phương án ghép nhóm”; D: “1 Sinh viên thực hiện 1 Đề tài”; U1/U2 | Cá nhân, không ProjectGroup; quyết định này thay nhánh ghép nhóm trong D/M cho phạm vi hiện tại | Ownership cá nhân; API và UI không nhóm SV, nhóm duyệt GV vẫn có |
| D02 / B02/C01 | D: snapshot qua nhiều đợt và `term_student_id`; U2 | Một Topic và một Proposal cho mỗi TermStudent; cùng SV qua đợt khác có hồ sơ mới, không chia sẻ Topic giữa SV/đợt | Topic.termStudentId unique, Proposal.topicId unique; bỏ unique Proposal.studentId toàn đời sau đối soát; UI chọn đợt |
| D03 / B03/C02 | D UC13 phân theo hướng/bộ môn; U1 một Khoa, Department=bộ môn; U2 | Một Khoa CNTT; mỗi ResearchArea thuộc một Department; routing theo hướng Topic. FACULTY cấp grant từng đợt, có thể giới hạn bộ môn | Mapping FK và grant scope; nhóm phải đúng đợt/bộ môn; UI không toàn hệ thống theo role |
| D04 / B04/C03 | D: thành viên nhóm review, Khoa chốt; U2 bổ sung 1 | Member thuộc TermLecturer cùng đợt; GVHD không review hồ sơ mình. Nhiều nhóm/bộ môn, GV nhiều nhóm, một nhóm/vòng. Mọi member hợp lệ được nhận xét; một member hợp lệ có thể ghi **một quyết định chung duy nhất** bằng revision, không thu vote; Khoa chốt dossier sau APPROVED | Tách comments và final decision; unique review decision/vòng, CAS; UI không nhiều kết luận cuối hoặc vai trò người kết luận bắt buộc |
| D05 / B05/C04 | D UC13 “thiết lập lịch duyệt”; U1/U2 | Không ReviewSession; hạn chung từ phase PROPOSAL_REVIEW. Phân lại tạo vòng mới, giữ vòng cũ | phase snapshot/review rounds; không sessionId/phòng/slot; UI hiển thị hạn phase |
| D06 / B06/C05 | D UC12 quay nháp để sửa, UC13 Đạt/Yêu cầu sửa; U2 | Không tạo REJECTED mới. Nộp lại SUBMITTED + RESUBMISSION. SV rút khi SUBMITTED; UNDER_REVIEW do Khoa trả nháp có lý do | State guards, submissionKind, review supersede; legacy REJECTED giữ đối soát |
| D07 / B07/C05 | D UC12 SV/GVHD sửa, SV gửi; U2 | Chỉ SV submit; cả SV/GVHD save snapshot bất biến. GVHD xác nhận Topic UC11, không sign-off mỗi version. Sửa Topic/đổi assignment làm agreement cần xác nhận lại | Version/author/agreement revision; edit đồng thời có 409; chưa autosave server |
| D08 / B08/C06 | D/M mẫu bốn chữ ký, UC13 chốt; U1/U2 | Bốn chữ ký giấy, không ký số; finalize và receipt tách riêng, scan không bắt buộc. Plan tạo sau FINALIZED, không chờ RECEIVED | Snapshot version/template, receipt history; PDF preview khác bản chốt; không suy receipt từ export |
| D09 / B09/C07 | D UC13 Khoa mở lại có audit; U2 | Reopen/handover pause plan, giữ mọi task/bài/review; chốt lại hoặc GVHD mới acknowledge/rebase mới resume. GVHD cũ mất quyền qua assignment cũ; actor lịch sử không đổi | Plan state/history, audit, assignment revision; UI pause/rebase |
| D10 / B10/C08 | D báo cáo hàng tuần, phase khóa cấm nộp; U2 bổ sung 2 | Tuần/mốc cấu hình theo đợt; mỗi tuần bắt buộc có một báo cáo/plan, AD_HOC riêng. **Nghĩa vụ tuần tồn tại độc lập task thủ công**; thiếu task vẫn thấy chưa nộp. Chặn deadline ngoài phase; UTC lưu, Asia/Ho_Chi_Minh hiển thị, phase `[start,end)`, nộp <=deadline đúng hạn; phase khóa chặn upload chưa commit | GuidancePeriod + WeeklyReportObligation; task tuần materialize idempotent, không auto-complete; API/UI coverage từ nghĩa vụ, không đếm riêng Task |
| D11 / B11/C09 | D report/source/evidence và version bài; U1/U2 | File phân loại REPORT/SOURCE/EVIDENCE; extension/MIME theo policy cấu hình, không mặc định ZIP/PDF. Nộp lại append-only khi task chưa COMPLETED/CANCELLED, không giới hạn số lần nghiệp vụ; không sửa/xóa bài cũ | Typed metadata/version/currentSubmission; multipart; limits cụ thể duyệt trước upload |
| D12 / B12/C10 | D UC16 ba mức và history; U2 bổ sung 3 | **Lưu riêng PASS, FAIL, REVISION_REQUIRED**. PASS→COMPLETED khi có bài; FAIL và REVISION_REQUIRED đều cần nộp lại, workflow task có thể cùng REVISION_REQUESTED nhưng decision không gộp. Comment bắt buộc cho hai kết quả này. GVHD amend append history; có họp/evaluation giai đoạn, criteria cấu hình, không quy điểm học phần | Enum 3 mức, review chain, task transition atomic, criteria/history; UI phân biệt Không đạt/Cần sửa |
| D13 / nhóm 13 audit | D UC13–16 người nhận/theo dõi; yêu cầu user về ADMIN | Khoa theo dõi trong grant; membership duyệt là quan hệ, không role COMMITTEE. ADMIN không có quyền học thuật tự động; nhận thông báo cá nhân không cấp quyền tài nguyên | Policies action+relationship+phase; auth/me; notifications/outbox, audit không leak content |
| D14 / B09/C07 | D UC10 chốt kết quả chính thức; U2 | Chỉ FINALIZED là chính thức, một official plan/đợt; PUBLISHED chưa đủ. Assignment hiện hành + append history/audit khi đổi, chỉ GVHD mới có quyền quan hệ | official plan pointer và assignmentRevision; không dùng output thuật toán chưa lưu; UI phân nháp/công bố/chốt |

### 2.1 Phương án đã superseded

| Phương án cũ | Xử lý trong baseline này |
|---|---|
| Nguồn chỉ dẫn lồng nhiều bảng ghi đè, B/C còn chờ | Hợp nhất vào §2–§9; B/C chỉ còn ID truy vết |
| decisionMakerLecturerId/canDecide/K, trưởng nhóm kết luận bắt buộc, vote/quorum | Loại khỏi DTO/model/permission; mọi member hợp lệ có thể quyết định chung, một quyết định hiệu lực/vòng |
| ReviewSession/sessionId/lịch phòng-buổi và sessions API | Loại hoàn toàn; dùng phase chung |
| Topic nhiều Proposal, Proposal unique toàn đời SV | Thay bằng 1–1 theo TermStudent; dữ liệu hiện hữu vẫn cần đối soát |
| Submit cả SV và GVHD, sign-off mỗi version | SV submit, cả hai save, agreement UC11 |
| ZIP source/PDF report là định dạng bắt buộc mặc định | File role bắt buộc; format/limits là policy được duyệt trước PR upload |
| FAIL gộp vào Cần sửa hoặc isPassed boolean làm dữ liệu chuẩn mới | Ba enum decision độc lập, dù cùng chuyển workflow về cần nộp lại |
| Chỉ tính tuần chưa nộp từ Task hiện có | Tính từ nghĩa vụ bắt buộc của tuần và roster; task chưa tạo vẫn hiện thiếu |
| ADMIN wildcard đọc học thuật, COMMITTEE tự là reviewer | Loại; grant nghiệp vụ và quan hệ là bắt buộc |

## 3. Contract đầu vào và dependency bước 1–3

### 3.1 Identity/current user

JWT hiện ký `{sub,username,roles}` nhưng CurrentUserPayload khai báo userId. Contract adapter thống nhất principal.userId=claims.sub sau verify và kiểm trạng thái account/quyền hiện hành; không đổi ngầm response login cũ. Actor, advisor, owner dùng dữ liệu server, không tin ID tác giả từ body.

```ts
type Id = string; // opaque non-empty, không ép UUID vì seed hiện có ID khác UUID
type Instant = string; // ISO-8601 có offset; output UTC Z
type Revision = number; // integer >= 0
type CurrentUserResponse = {
  userId: Id; username: string; roles: string[]; permissions: string[];
  studentId: Id | null; lecturerId: Id | null;
  termGrants: Array<{termId: Id; departmentIds: Id[] | null}>;
  reviewMemberships: Array<{groupId: Id; termId: Id}>;
};
// departmentIds=null: toàn bộ bộ môn trong đợt được cấp; []: không có bộ môn
```

REVIEW_GROUP_MEMBER là membership, không JWT role mới. ADMIN chỉ có quyền kỹ thuật; người đồng thời là FACULTY/LECTURER/STUDENT có thể đi qua đường cấp quyền nghiệp vụ đầy đủ tương ứng. Không ghép action của role này với scope không liên quan của role khác để mở rộng truy cập. `/auth/me` hỗ trợ UI, server resolve lại mỗi request.

### 3.2 Term scope, roster và thời gian

```ts
type TermContext = {
  termId: Id; status: string; revision: Revision;
  timeZone: 'Asia/Ho_Chi_Minh';
  phases: Array<{id:Id; key:'PROPOSAL_EDIT'|'PROPOSAL_REVIEW'|'GUIDANCE';
    startsAt:Instant; endsAt:Instant; isLocked:boolean; revision:Revision}>;
};
type TermStudentRef = {id:Id; termId:Id; studentId:Id};
type TermLecturerRef = {termId:Id; lecturerId:Id; quota:number};
```

TermStudent unique(termId,studentId), TermLecturer PK(termId,lecturerId). GVHD/reviewer phải tham gia đúng đợt; role toàn cục không thay roster. Phase key là contract mới, chưa có API ghi đầy đủ trong repo.

Guard chung Q: thiếu cấu hình hoặc phase khóa/ngoài khoảng thì không ghi; CANCELLED/COMPLETED read-only. Proposal edit/submit dùng PROPOSAL_EDIT khi term CLOSED_REGISTRATION hoặc IN_PROGRESS; review/assign/finalize/receipt dùng PROPOSAL_REVIEW trong hai status đó; guidance mutations dùng GUIDANCE và term IN_PROGRESS. Chuẩn bị nhóm được ở DRAFT/CLOSED_REGISTRATION/IN_PROGRESS. Reopen Khoa là ngoại lệ phase khi term chưa kết thúc, nhưng không tự mở phase cho SV ghi. Không cho ghi ở DEFENDING theo contract này. Read lịch sử vẫn cần quyền, không cần phase mở.

Tuần báo cáo có startsAt/endsAt/reportDueAt được cấu hình, reportDueAt phải trong phase GUIDANCE, không tự đoán từ ISO week. Phase `[start,end)`, bài đúng hạn khi submittedAt<=deadlineSnapshot. Bài tuần muộn được nhận nếu phase còn mở; đề cương quá hạn không được submit. Chốt khóa phase phải serialize với submission commit, không tính thời điểm bắt đầu upload là đã nộp.

### 3.3 Assignment chính thức và bàn giao

```ts
type OfficialAdvisorContext = {
  termId:Id; termStudentId:Id; registrationId:Id;
  assignmentPlanId:Id; planStatus:'FINALIZED'; planRevision:Revision;
  advisorAssignmentId:Id; advisorId:Id; revision:Revision;
  finalizedAt:Instant; effectiveAt:Instant;
};
```

Plan phải bằng ThesisTerm.officialAssignmentPlanId; registration/roster/plan cùng term và student, advisor trong TermLecturer. Không dùng PUBLISHED, plan nháp hay `executeAutoAssignment()` chưa lưu làm nguồn quyền. Không thêm điều kiện RegistrationStatus=APPROVED ngoài contract này khi chưa có semantics tương ứng từ producer.

Giữ assignment ID hiện hành ổn định, tăng revision khi bàn giao; lưu old/new advisor, actor, reason, thời điểm hiệu lực và revision trong history/AuditLog. Không cấp quyền GVHD cho advisor cũ từ actor history. Đổi GVHD làm agreement UC11 cần xác nhận lại, pause plan trong cùng command bàn giao; advisor mới acknowledge/resume trên bản chốt hiện hành. Sửa đề tài sau bàn giao phải qua reopen/chốt lại nếu đã chốt. Không âm thầm đổi actor của review cũ.

### 3.4 Ownership, agreement và version nộp

Chuỗi ownership chuẩn: Student→TermStudent→Topic→Proposal→Versions. Topic.termStudentId unique, Proposal.topicId unique; term/student lấy qua ownership, không giữ hai nguồn độc lập. Giữ proposalId cho consumer defense/grading. Đổi đợt tạo hồ sơ mới.

```ts
type TopicAgreement = {
  topicRevision:Revision; confirmedByAdvisorId:Id;
  advisorAssignmentRevision:Revision; confirmedAt:Instant;
};
type SubmittedProposalContext = {
  termId:Id; termStudentId:Id; topicId:Id; proposalId:Id;
  proposalRevision:Revision; status:'SUBMITTED';
  submittedVersionId:Id; versionNumber:number; submittedAt:Instant;
  submittedByUserId:Id; submissionKind:'INITIAL'|'RESUBMISSION';
  contentSchemaVersion:1; contentHash:string; agreement:TopicAgreement;
  officialAdvisor:OfficialAdvisorContext;
};
```

UC11 producer phải cung cấp agreement đúng topicRevision/assignmentRevision. Sửa tên/phạm vi/nội dung/hướng hoặc đổi GVHD làm agreement cũ không còn đủ điều kiện submit. Không suy agreement từ Topic.isActive hay có Proposal. Thiếu dữ liệu → INPUT_NOT_READY/TOPIC_NOT_AGREED, không giả lập xác nhận.

Bước 4 tạo nhóm chỉ cần term/roster/routing; bước 5 mới cần SubmittedProposalContext. Chỉ phân submittedVersionId hiện hành đã SEALED, không “latest version” chưa nộp. Hash content do server tính canonical JSON. Mỗi vòng review trỏ đúng version; rút/phân lại không chuyển quyết định cũ sang version mới.

### 3.5 Routing và nghĩa vụ báo cáo từ kế hoạch đợt

Routing: Topic.researchAreaId→ResearchArea.departmentId→ReviewGroup.departmentId trong cùng term. Khoa chọn nhóm trong danh sách đúng mapping; không chọn ngẫu nhiên khi nhiều nhóm, không lấy bộ môn GVHD thay mapping. Review lưu routing snapshot/revision; đổi mapping không tự chuyển vòng đang duyệt, phải phân lại có reason.

Contract cấu hình tuần cần từ producer kế hoạch/roster:

```ts
type GuidancePeriodContext = {
  periodId:Id; termId:Id; ordinal:number; label:string;
  startsAt:Instant; endsAt:Instant; reportDueAt:Instant; revision:Revision;
  requiredTermStudentIds:Id[]; // danh sách áp dụng do Khoa cấu hình, không tự đoán
};
```

Không tự đặt ngày hoặc miễn/bổ sung nghĩa vụ cho SV vào muộn/chuyển đợt. Danh sách áp dụng và deadline phải được Khoa xác lập từ roster/kế hoạch; thiếu cấu hình trả coverageState=NOT_CONFIGURED, không trả “0 báo cáo thiếu” như thể đã hoàn tất.

Với mỗi cặp period–TermStudent trong danh sách áp dụng, có WeeklyReportObligation unique, **không phụ thuộc GuidancePlan hoặc Task đã được tạo**. Theo dõi bằng phép lấy tập nghĩa vụ dự kiến trừ bài nộp hợp lệ; nếu materialization hàng obligation bị trễ, truy vấn coverage vẫn lấy roster-period làm gốc và hiện `missingObligationRecord=true`, không làm mất tuần thiếu.

Task WEEKLY_REPORT được liên kết/materialize idempotent từ obligation khi plan đã hợp lệ (lúc mở kế hoạch hoặc nộp báo cáo), dùng reportDueAt và yêu cầu REPORT+SOURCE từ kế hoạch. Không cần GVHD tạo thủ công; không tạo task COMPLETED hoặc bài/review giả. Nếu chưa có plan/dossier chốt, vẫn hiện nghĩa vụ chưa có báo cáo và missingPlan, còn command nộp phải thỏa precondition plan. Không tự coi việc thiếu task là miễn báo cáo.

### 3.6 Dependency cần phối hợp, không refactor ngoài phạm vi

| Chủ producer / vùng code | Bàn giao bắt buộc | Consumer và tiêu chí chấp nhận |
|---|---|---|
| Auth/common security — bước 1–3 | sub→userId, account status, me, permission/grant theo đợt | Policies mới và GET cũ cùng kiểm scope; không đổi login shape ngầm |
| Catalog | Department=bộ môn, ResearchArea mapping/revision, identity hồ sơ SV/GV | Nhóm/routing/ownership; không suy mapping từ tên danh mục |
| Term/roster | TermContext, TermStudent/TermLecturer, phase lock revision, periods + danh sách SV bắt buộc | Group, submit, coverage tuần; giữ ID, cùng term, không thay bằng đợt mới nhất |
| Registration/assignment | official plan FINALIZED duy nhất, assignment hiệu lực/history, handover event/transaction integration | GVHD hiện hành, agreement invalidation và pause plan; không dùng output thuật toán |
| Topic UC11/UC12 ở điểm nối bước 3 | Topic owner/agreement và draft/submitted version rõ ràng | Review nhận SEALED submitted version, không tạo bản nộp giả |
| Người phụ trách DB/CI | Cây migration chuẩn, bản sao DB, lịch sử áp dụng, dữ liệu đại diện | PR2 expand/backfill/validate; không reset/drift sửa toàn DB |
| Consumer bước 9–10 | Giữ proposalId và read contract history | Không đổi công thức điểm, không thêm điều kiện bảo vệ từ task decisions |

Read adapter giữa module trong modular monolith được phép, không buộc HTTP nội bộ. API context/roster mới phải cùng PR producer hoặc adapter đã review; mock chỉ trong test, không thay dữ liệu chính thức. Phần period/criteria cấu hình phối hợp term/UC14, không tự dùng string TermParameter để đoán semantics.

## 4. State machines thống nhất

Mọi transition là command có quyền + revision + phase, không PATCH status tùy ý, không đổi state bởi GET. Các bảng này là trạng thái mới dự kiến; dữ liệu legacy không tự map theo tên gần giống.

### 4.1 Proposal

States: DRAFT, SUBMITTED, UNDER_REVIEW, REVISION_REQUESTED, APPROVED. REJECTED cũ read-only để đối soát; không phát sinh mới. SUBMITTED + submissionKind RESUBMISSION hiển thị Đã sửa–chờ duyệt. Đã chốt nằm ở Dossier.

| Transition | Command / actor | Guard / tác động cùng transaction |
|---|---|---|
| chưa có→DRAFT | khởi tạo UC11 | owner theo TermStudent, không tạo duplicate |
| DRAFT→SUBMITTED | submit / SV | Q, agreement/assignment đúng, content đủ; seal working version, gắn submittedVersionId |
| SUBMITTED→UNDER_REVIEW | start / member hợp lệ | vòng active đúng version; explicit POST, không GET |
| UNDER_REVIEW→APPROVED | quyết định chung APPROVED / member | một decision/vòng, compare revisions, không tự finalize |
| UNDER_REVIEW→REVISION_REQUESTED | quyết định chung REVISION_REQUIRED / member | comment bắt buộc, thông báo SV/GVHD |
| REVISION_REQUESTED→DRAFT | save sửa / SV hoặc GVHD | bản DRAFT mới dựa version bị trả sửa |
| SUBMITTED→DRAFT | withdraw / SV | supersede vòng ASSIGNED nếu có, giữ bản SEALED cũ |
| UNDER_REVIEW→DRAFT | return-to-draft / Khoa | reason, vòng SUPERSEDED, không sửa quyết định cũ |
| UNDER_REVIEW→SUBMITTED | reassign / Khoa | supersede vòng active, tạo ASSIGNED mới cùng submitted version |
| APPROVED→DRAFT | reopen / Khoa | reason, dossier REOPENED nếu có, pause plan; edit chỉ khi phase mở |

Submit lại từ DRAFT sau lịch sử submit được gắn RESUBMISSION. Trong SUBMITTED/UNDER_REVIEW không sửa content trực tiếp. APPROVED muốn sửa phải reopen; FINALIZED/RECEIVED chặn mọi edit ngoài reopen.

### 4.2 ProposalVersion

States: DRAFT, SEALED. Mỗi save tạo hàng immutable mới, versionNumber tăng atomic; Proposal.workingVersionId trỏ bản soạn hiện hành. Save không UPDATE content bản cũ. Draft được thiếu nội dung, submit phải đủ schema.

| Transition | Điều kiện |
|---|---|
| tạo→DRAFT | SV/GVHD, proposal DRAFT, basedOnVersionId đúng hồ sơ |
| DRAFT→SEALED | submit đúng workingVersion; server lưu submittedAt/by và hash |
| SEALED→bản DRAFT mới | sau rút/trả sửa/reopen; không unseal bản cũ |

Review/finalization tham chiếu SEALED bất biến; decision không ghi vào version. Legacy thiếu actor/time giữ provenance/null để đối soát, không tạo actor giả.

### 4.3 ProposalReview

States: ASSIGNED, IN_REVIEW, DECIDED, SUPERSEDED. Mỗi hàng là một vòng được giao một nhóm và một version; roundNumber tăng atomic/proposal. Comments nhiều, **ProposalReviewDecision tối đa một hàng/review**, không vote và không overwrite kết luận chung.

| Transition | Actor / guard | Tác động |
|---|---|---|
| tạo→ASSIGNED | Khoa, SUBMITTED, mapping/roster/Q hợp lệ | snapshot phase deadline/routing; một active review/proposal |
| ASSIGNED→IN_REVIEW | member start | Proposal UNDER_REVIEW |
| IN_REVIEW→DECIDED | member hợp lệ, revision và version đúng | insert unique decision APPROVED hoặc REVISION_REQUIRED; đổi Proposal cùng transaction |
| ASSIGNED/IN_REVIEW→SUPERSEDED | Khoa phân lại/trả nháp hoặc SV withdraw khi ASSIGNED | reason, giữ comments; vòng mới nếu phân lại |

Khi hai member quyết định cùng lúc, chỉ một transaction thành công; bên còn lại nhận 409 REVIEW_ALREADY_DECIDED/REVISION_CONFLICT, không có hai kết luận hiệu lực. Retry cùng idempotency key trả kết quả cũ; key khác không tạo quyết định thứ hai dù cùng nội dung. Sau DECIDED read-only; đổi kết quả phải Khoa mở lại/tạo vòng mới, không amend decision trong cùng vòng. Comments được ghi khi ASSIGNED/IN_REVIEW; sau kết luận vẫn đọc lịch sử, không chèn kết luận cá nhân ngược như kết quả cuối. Quá hạn chỉ cảnh báo theo phase, không tự reject/approve.

### 4.4 ThesisDossier

States: DRAFT, FINALIZED, RECEIVED, REOPENED; finalization snapshot riêng, receipt riêng. Không coi trạng thái string APPROVED/SUBMITTED cũ là bằng chứng nhận giấy.

| Transition | Actor / điều kiện | Tác động |
|---|---|---|
| DRAFT/REOPENED→FINALIZED | Khoa, Proposal APPROVED, version SEALED đủ trường | tạo DossierFinalization/version/template/actor/time; pointer current |
| FINALIZED→RECEIVED | Khoa xác nhận nhận giấy | receipt server time/actor, scan tùy chọn, không suy từ export |
| FINALIZED/RECEIVED→REOPENED | Khoa, reason | finalization cũ không còn current, Proposal DRAFT, pause plan, giữ mọi history/file |

Export không đổi state. Preview watermark không là bản chốt. Bản chốt cũ còn đọc theo quyền lịch sử và nhãn đã thay thế; không xuất nhầm draft hiện hành thành hồ sơ chính thức.

### 4.5 GuidancePlan

States: ACTIVE, PAUSED, ARCHIVED; một plan/proposal. Tạo ACTIVE trực tiếp khi dossier FINALIZED/RECEIVED, GVHD hiện hành, phase GUIDANCE mở; không thêm approval plan hoặc chờ receipt.

| Transition | Điều kiện |
|---|---|
| tạo→ACTIVE | GVHD, snapshot finalization và assignment revision hợp lệ |
| ACTIVE→PAUSED | trong transaction reopen hoặc handover; chặn guidance mutation, giữ chứng cứ |
| PAUSED→ACTIVE | GVHD mới/hiện hành acknowledge, bản chốt hiện hành hợp lệ, agreement lại đúng, rebase nếu finalization đổi; Q mở |
| ACTIVE/PAUSED→ARCHIVED | term COMPLETED/CANCELLED; lịch sử chỉ đọc |

Phase tạm khóa chỉ chặn ghi, không tự archive. Nghĩa vụ tuần vẫn được hiển thị khi plan chưa tạo/đang pause; không tự miễn hoặc đánh dấu SV hoàn thành.

### 4.6 Task

States: TODO, IN_PROGRESS, SUBMITTED, REVISION_REQUESTED, COMPLETED, CANCELLED. Không dùng OVERDUE đè workflow; isOverdue dẫn xuất khi now>deadline và chưa COMPLETED/CANCELLED, isLate là snapshot trên bài nộp.

| Transition | Actor / guard |
|---|---|
| tạo→TODO | GVHD tạo AD_HOC hoặc hệ thống materialize task tuần từ obligation; plan ACTIVE và Q hợp lệ; không auto-complete |
| TODO→IN_PROGRESS | SV start/progress |
| TODO/IN_PROGRESS/REVISION_REQUESTED→SUBMITTED | SV nộp đủ file, Q/V hợp lệ; late vẫn nhận |
| SUBMITTED→SUBMITTED | SV nộp bản mới, supersede bản trước, chưa hoàn thành/cancel |
| SUBMITTED→COMPLETED | GVHD ghi PASS trên current submission hợp lệ |
| SUBMITTED→REVISION_REQUESTED | GVHD ghi FAIL hoặc REVISION_REQUIRED riêng biệt, comment bắt buộc |
| COMPLETED→REVISION_REQUESTED | amend PASS thành FAIL/cần sửa trên bài còn current, history/reason |
| REVISION_REQUESTED→COMPLETED | amend review còn current thành PASS, đủ chứng cứ; không bỏ qua bài nộp |
| bất kỳ chưa cancel→CANCELLED | GVHD, reason; có bài cần xác nhận và history |

Task tuần bị cancel không xóa/miễn WeeklyReportObligation, không làm coverage báo đã hoàn thành. Có thể materialize task thay thế liên kết cùng obligation; task mới current, bài cũ vẫn lịch sử. Sửa title/deadline/requirements có revision/reason, có bài cần acknowledge; không retroactively đổi deadlineSnapshot/isLate của bài cũ. COVERAGE không suy từ task status đơn thuần.

### 4.7 TaskSubmission

States: SUBMITTED, REVIEWED, SUPERSEDED. Mỗi hàng là một lần nộp bất biến; staging file chưa phải bài nộp. Unique(taskId,versionNumber), Task.currentSubmissionId cùng task.

| Transition | Điều kiện |
|---|---|
| tạo→SUBMITTED | file READY đủ yêu cầu, server actor/time/late snapshot, task revision đúng |
| SUBMITTED→REVIEWED | GVHD quyết định bài current, task đổi cùng transaction |
| SUBMITTED/REVIEWED→SUPERSEDED | bài mới commit khi task chưa COMPLETED/CANCELLED; giữ file/review cũ |

Không có withdraw/delete bài chính thức. FAIL/cần sửa dẫn tới bản mới, không sửa file cũ. Hai upload cùng task revision chỉ một commit; retry idempotent không tạo thêm version.

### 4.8 TaskReview

States: RECORDED, SUPERSEDED. **TaskReviewDecision=PASS | FAIL | REVISION_REQUIRED**, không boolean, không gom thành hai giá trị. Một effective review/submission; amend tạo hàng mới supersedesReviewId và đánh dấu hàng trước SUPERSEDED trong transaction.

| Transition | Điều kiện |
|---|---|
| tạo→RECORDED | GVHD hiện hành, current submission, task SUBMITTED; PASS hoàn thành, hai kết quả còn lại yêu cầu nộp lại |
| RECORDED→SUPERSEDED + hàng RECORDED mới | amend đúng revision, reason; bài vẫn current, tính lại task theo decision riêng |

Nếu đã có bài mới thì amend bài cũ bị STALE_SUBMISSION, không thay kết quả hiện hành. Dữ liệu giữ cả FAIL lẫn REVISION_REQUIRED trong history, API/filter/export cũng không gộp hai mức. Không tự cho điểm hoặc quyết định điều kiện bảo vệ.

### 4.9 Coverage báo cáo tuần độc lập task

Coverage là read model từ nghĩa vụ, file/bài nộp và review hiện hành, không thêm trạng thái tự hoàn thành học vụ:

| Field | Contract |
|---|---|
| submissionState | NOT_DUE nếu chưa tới startsAt và chưa có bài; MISSING nếu đã tới startsAt nhưng chưa có bài hợp lệ; SUBMITTED khi có bài; không lấy task tồn tại làm bằng chứng |
| isOverdue | now>reportDueAt và chưa có báo cáo hợp lệ; deadline của nghĩa vụ là căn cứ dù task chưa tạo |
| reviewResult | null/PASS/FAIL/REVISION_REQUIRED của bài hiện hành; riêng với submissionState |
| readiness | missingPlan, missingTask, missingObligationRecord; task cancel vẫn có nghĩa vụ |
| coverageState | READY khi cấu hình áp dụng đầy đủ; NOT_CONFIGURED khi thiếu period/roster applicability/deadline, không báo “không thiếu” giả |

Có bài FAIL nghĩa là đã nộp nhưng không đạt, không là “chưa từng nộp”. Completion của task phải PASS; coverage tuần không tự xác nhận hoàn thành SV hoặc đủ điều kiện bảo vệ. Thay scope tuần/deadline sau có bài phải có audit và đối soát, không tự xóa nghĩa vụ hay chứng cứ. Lịch cụ thể/SV áp dụng do Khoa cấu hình, không tự đặt quy tắc cho vào muộn, nghỉ hoặc chuyển đợt.

## 5. API contract

### 5.1 Quy ước và DTO chung

Base `/api`; endpoint dưới đây là contract mới, chưa tồn tại. JSON success `{success:true,data:T,timestamp:Instant}`; list `data:{data:T[],total,page,limit,totalPages}`. POST tạo trả 201, command/PATCH/GET 200, file binary riêng. PageQuery={page?:number,limit?:number}, defaults 1/20, limit 1..100, sort ổn định thời gian+ID; filter luôn intersect scope.

Error `{success:false,error:{code,message,details?},timestamp}`; không raw Prisma/path/source. Chưa đăng ký handler/enum mới trong PR1. Unauthenticated 401, ngoài scope tài nguyên 404, trong scope thiếu action 403. ID opaque, reject unknown input fields cho API mới. Thời gian submit/review/receipt và actor do server xác định.

Mutation bắt buộc expectedRevision của aggregate được tác động; multi-aggregate command dùng expectedProposalRevision/expectedReviewRevision hoặc expectedTaskRevision/expectedSubmissionRevision. POST tạo và command có `Idempotency-Key`; unique actor+method+route+key, hash payload/file manifest. Retry cùng payload trả kết quả cũ; khác payload trả 409, không ghi thêm history nghiệp vụ. `Versioned` response gồm id/revision/createdAt/updatedAt; snapshot immutable có createdAt và actor metadata tương ứng.

| Request DTO | Fields (không có dấu ? là bắt buộc) |
|---|---|
| GroupCreate | name, departmentId, memberLecturerIds:Id[] unique, không decisionMaker |
| GroupUpdate | expectedRevision, name?, memberLecturerIds?, reason; không đổi department/term của nhóm đã giao vòng |
| AssignReview | groupId, proposalVersionId, expectedProposalRevision; phân lại thêm replacesReviewId, expectedReviewRevision, reason |
| ProposalContentV1 | schemaVersion:1, objectives, scope, mainContents, tools, expectedResults:string; startsAt,endsAt; schedule:[{label,startsAt,endsAt,deliverables}]; draft có thể trống, submit không trống và date/lịch hợp lệ |
| VersionSave | expectedRevision của Proposal, basedOnVersionId?:Id, content:ProposalContentV1 |
| ProposalSubmit | expectedRevision, versionId |
| ProposalWithdraw | expectedProposalRevision, expectedReviewRevision? (có vòng thì bắt buộc), reason |
| ReviewStart | expectedReviewRevision, expectedProposalRevision |
| ReviewCommentCreate | expectedReviewRevision, versionId, text non-empty |
| ReviewDecide | expectedReviewRevision, expectedProposalRevision, versionId, decision:APPROVED/REVISION_REQUIRED, comment? (trả sửa bắt buộc) |
| ReturnToDraft | expectedReviewRevision, expectedProposalRevision, reason |
| Finalize | expectedProposalRevision, expectedDossierRevision? (nếu có dossier), approvedVersionId, templateVersion |
| Reopen | expectedProposalRevision, expectedDossierRevision? (nếu có dossier), reason; plan revision kiểm trong transaction |
| ReceiptCreate | expectedRevision của dossier, finalizationId, note?, scanFileId?; scan phải staged hợp lệ của caller |
| PlanCreate | finalizationId, expectedDossierRevision, description?; không nhận advisorId |
| PlanResume | expectedRevision, finalizationId, expectedDossierRevision, acknowledgeRebase:true |
| TaskCreate | expectedPlanRevision, title, description?, periodId, deadline, requirements:[{kind:REPORT/SOURCE/EVIDENCE,required:boolean}]; chỉ tạo AD_HOC, không client giả WEEKLY_REPORT |
| TaskUpdate | expectedRevision, title?, description?, deadline?, requirements?, reason, acknowledgeExistingSubmissions?; task tuần không sửa deadline/requirements lệch obligation, phải sửa qua cấu hình kế hoạch có audit |
| TaskCancel | expectedRevision, reason, acknowledgeExistingSubmissions? |
| TaskProgress | expectedRevision, note; start TODO hoặc thêm progress event |
| WeeklyTaskEnsure | expectedObligationRevision, expectedPlanRevision; tạo/liên kết current task từ cấu hình tuần idempotent |
| SubmissionCreate | multipart metadata={expectedTaskRevision,content?}, parts report/source/evidence[]; tuần bắt buộc REPORT+SOURCE; type/size theo policy được duyệt |
| TaskReviewCreate | expectedTaskRevision, expectedSubmissionRevision, decision:PASS/FAIL/REVISION_REQUIRED, comment? (FAIL/cần sửa bắt buộc) |
| TaskReviewAmend | các field TaskReviewCreate + expectedReviewRevision, reason |
| MeetingCreate | expectedPlanRevision, occurredAt, mode:IN_PERSON/ONLINE, location?, discussion, conclusion |
| MeetingAmend | expectedRevision, reason, occurredAt?,mode?,location?,discussion?,conclusion? |
| EvaluationCreate | expectedPlanRevision, milestoneId, criterionScores:[{criterionId,score}], comment?, evidenceFileIds?; range/criteria từ cấu hình, không hard-code học phần |
| EvaluationAmend | expectedRevision, reason, criterionScores?,comment?,evidenceFileIds? |
| CoverageQuery | PageQuery + periodId?,termStudentId?,submissionState?,isOverdue?,reviewResult?; không yêu cầu taskId |

| Response DTO | Fields nghiệp vụ ngoài Versioned |
|---|---|
| GroupView | termId,departmentId,name,members:[{lecturerId,fullName}],activeReviewCount |
| ProposalView | termId,termStudentId,topicId,ownerStudentId,officialAdvisor context,status,submissionKind?,workingVersionId?,submittedVersionId?,activeReviewId?,dossierId?,allowedActions[] |
| VersionView | proposalId,versionNumber,state,basedOnVersionId?,content,contentHash,createdBy,submittedAt?,submittedBy?,provenance; actor legacy có thể null |
| ReviewView | proposalId,versionId,roundNumber,groupId,state,routingSnapshot,phaseSnapshot,comments:CommentView[],decision:ReviewDecisionView|null,supersededByReviewId? |
| CommentView / ReviewDecisionView | id,reviewId,versionId,authorUserId,createdAt; comment=text; decision=APPROVED/REVISION_REQUIRED + comment?; **decision là object/null, không mảng nhiều final decisions** |
| DossierView | proposalId,state,currentFinalization?:{id,versionId,templateVersion,finalizedAt,finalizedBy,pdfFileId?},receipt?,history[] |
| PlanView | proposalId,finalizationId,advisorAssignmentId,advisorAssignmentRevision,state,description?,allowedActions[] |
| TaskView | planId,periodId,kind:WEEKLY_REPORT/AD_HOC,obligationId?,title,description?,deadline,status,isOverdue,requirements,currentSubmissionId?,progressEvents[],allowedActions[] |
| FileView | id,kind,originalName,sizeBytes,mimeType,checksum,createdAt; không storageKey/local path |
| SubmissionView | taskId,versionNumber,state,submittedBy,submittedAt,deadlineSnapshot,isLate,content?,files:FileView[],effectiveReview:TaskReviewView|null |
| TaskReviewView | submissionId,decision:PASS/FAIL/REVISION_REQUIRED,comment?,state,reviewerUserId,advisorAssignmentRevision,recordedAt,supersedesReviewId?,amendmentReason? |
| CoverageView | termId,periodId,termStudentId,obligationId?,planId?,taskId?,reportDueAt,submissionState,isOverdue,reviewResult,missingPlan,missingTask,missingObligationRecord,coverageState; chỉ aggregate đủ cấu hình mới trả số thiếu xác định |
| MeetingView | planId,occurredAt,mode,location?,discussion,conclusion,authorUserId,history[] |
| EvaluationView | planId,milestoneId,criteriaSnapshot,criterionScores,comment?,evidence:FileView[],evaluatorUserId,history[] |
| NotificationView | id,title,body,link?,status:UNREAD/READ,createdAt,readAt? |

### 5.2 Endpoint, quyền, scope, state và lỗi

F=FACULTY đúng grant; O=STUDENT sở hữu TermStudent; A=LECTURER là GVHD chính thức hiện hành; R=member đang được phân đúng vòng, cùng đợt và không GVHD của hồ sơ. Scope R chỉ version đã phân, không draft hoặc file tuần. V=revision/version đúng; Q=phase/term guard §3.2. Tất cả cần permission và scope, ADMIN không shortcut.

Mọi dòng có lỗi chung E0: 401 AUTH_003, 403 AUTH_004, 404 COMMON_001, 400 COMMON_003. Mutation có thêm 409 REVISION_CONFLICT/IDEMPOTENCY_CONFLICT; Q sai →409 TERM_003; transition sai →409 STATE_TRANSITION_INVALID. Cột lỗi chỉ phần thêm ngoài E0. Một dòng có nhiều method được tách nghĩa request/response rõ ràng, không coi GET có mutation.

| Method / endpoint sau /api | Request→response | Permission / scope | Precondition / transition | Lỗi thêm |
|---|---|---|---|---|
| GET /auth/me | —→CurrentUserResponse | authenticated self | identity hiện hành | AUTH_002 |
| GET /terms/:termId/academic-context | —→TermContext + roster/routing/period refs theo scope | term:read / F,O,A,R | SV/member không nhận roster toàn đợt | INPUT_NOT_READY |
| GET /terms/:termId/review-groups | PageQuery→Page<GroupView> | review-group:read / F hoặc membership | chỉ nhóm trong scope | — |
| POST /terms/:termId/review-groups | GroupCreate→GroupView | review-group:manage / F | term chuẩn bị hợp lệ, members đúng roster | MEMBER_INELIGIBLE |
| PATCH /review-groups/:id | GroupUpdate→GroupView | review-group:manage / F | V, có vòng active không sửa members; phân lại trước | ACTIVE_REVIEW_EXISTS |
| GET /terms/:termId/proposals | PageQuery+status?,groupId?,departmentId?→Page<ProposalView> | proposal:read / F,O,A,R | intersect scope | — |
| GET /proposals/:id | —→ProposalView | proposal:read / F,O,A,R | R không draft | — |
| GET /proposals/:id/versions | PageQuery→Page<VersionView> | proposal:read / F,O,A,R | R chỉ versions được phân | — |
| POST /proposals/:id/versions | VersionSave→VersionView | proposal:edit / O,A | Q,V; DRAFT hoặc bắt đầu sửa từ REVISION_REQUESTED | DOSSIER_LOCKED,INPUT_NOT_READY |
| POST /proposals/:id/submit | ProposalSubmit→ProposalView | proposal:submit / O | Q,V,agreement; DRAFT→SUBMITTED, version seal | TOPIC_001,TOPIC_NOT_AGREED,STALE_VERSION |
| POST /proposals/:id/withdraw | ProposalWithdraw→ProposalView | proposal:submit / O | Q,V; SUBMITTED→DRAFT, review ASSIGNED→SUPERSEDED | STALE_VERSION |
| POST /proposals/:id/return-to-draft | ReturnToDraft→ProposalView | proposal:assign / F | review Q,V; UNDER_REVIEW→DRAFT, active review SUPERSEDED | REASON_REQUIRED |
| POST /proposals/:id/review-assignments | AssignReview→ReviewView | proposal:assign / F | Q,V,SEALED; create ASSIGNED; thay active vòng cần reason/revision; proposal về SUBMITTED | ROUTING_NOT_CONFIGURED,ROUTING_MISMATCH,ACTIVE_REVIEW_EXISTS |
| GET /proposal-reviews/:id | —→ReviewView | proposal:read / F,O,A,R | version trong scope | — |
| POST /proposal-reviews/:id/start | ReviewStart→ReviewView | proposal:review / R | Q,V; ASSIGNED→IN_REVIEW, proposal UNDER_REVIEW | REVIEWER_CONFLICT,STALE_VERSION |
| POST /proposal-reviews/:id/comments | ReviewCommentCreate→ReviewView | proposal:comment / R | Q,V; ASSIGNED/IN_REVIEW append comment | REVIEW_ALREADY_DECIDED,STALE_VERSION |
| POST /proposal-reviews/:id/decision | ReviewDecide→ReviewView | proposal:review / R | Q,V; IN_REVIEW→DECIDED, insert duy nhất decision, update Proposal | REVIEW_ALREADY_DECIDED,TOPIC_002,REVIEWER_CONFLICT,STALE_VERSION |
| POST /proposals/:id/finalize | Finalize→DossierView | proposal:finalize / F | review Q,V; APPROVED+SEALED đủ trường→FINALIZED | TOPIC_001,STALE_VERSION,DOSSIER_LOCKED |
| POST /proposals/:id/reopen | Reopen→ProposalView | proposal:reopen / F | V,reason,term chưa kết thúc; APPROVED→DRAFT,dossier REOPENED,plan PAUSED | REASON_REQUIRED |
| GET /proposals/:id/dossier | —→DossierView | proposal:read / F,O,A | read history | — |
| GET /proposals/:id/dossier.pdf | finalizationId?→application/pdf | proposal:export / F,O,A | dùng finalization current nếu omitted; không draft | DOSSIER_NOT_FINALIZED,TEMPLATE_NOT_READY |
| GET /proposals/:id/preview.pdf | versionId→application/pdf watermark | proposal:read / F,O,A | version visibility | TEMPLATE_NOT_READY |
| POST /proposals/:id/dossier/receipt | ReceiptCreate→DossierView | dossier:receive / F | review Q,V; FINALIZED→RECEIVED | DOSSIER_NOT_FINALIZED,FILE_NOT_READY |
| GET /proposals/:id/guidance-plan | —→PlanView | guidance:read / F,O,A | 404 nếu chưa có | — |
| POST /proposals/:id/guidance-plan | PlanCreate→PlanView | guidance:manage / A | Q,V; dossier chốt; tạo ACTIVE, liên kết obligations | DOSSIER_NOT_FINALIZED,COMMON_002 |
| POST /guidance-plans/:id/resume | PlanResume→PlanView | guidance:manage / A | Q,V; PAUSED→ACTIVE,agreement/rebase hợp lệ | REBASE_REQUIRED,TOPIC_NOT_AGREED |
| GET /terms/:termId/weekly-report-coverage | CoverageQuery→Page<CoverageView> + coverageState tổng | guidance:read / F,O,A | **gốc là roster/period, không Task**; có hàng thiếu plan/task | REPORTING_SCOPE_NOT_CONFIGURED |
| POST /weekly-report-obligations/:id/task | WeeklyTaskEnsure→TaskView | task:ensure-weekly / O,A | Q,V; plan ACTIVE; ensure TODO từ nghĩa vụ; không COMPLETE | DOSSIER_NOT_FINALIZED,PLAN_PAUSED,REPORTING_SCOPE_NOT_CONFIGURED |
| GET /guidance-plans/:id/tasks | PageQuery+status?,periodId?,isOverdue?→Page<TaskView> | guidance:read / F,O,A | read | — |
| POST /guidance-plans/:id/tasks | TaskCreate→TaskView | task:manage / A | Q,V,ACTIVE; tạo AD_HOC TODO | DEADLINE_OUTSIDE_PHASE,PERIOD_INVALID |
| PATCH /tasks/:id | TaskUpdate→TaskView | task:manage / A | Q,V; history/ack nếu có bài; tuần không lệch obligation | ACKNOWLEDGEMENT_REQUIRED,WEEKLY_REQUIREMENT_IMMUTABLE |
| POST /tasks/:id/cancel | TaskCancel→TaskView | task:manage / A | Q,V,reason/ack; →CANCELLED, nghĩa vụ tuần vẫn có | ACKNOWLEDGEMENT_REQUIRED,REASON_REQUIRED |
| POST /tasks/:id/progress | TaskProgress→TaskView | task:progress / O | Q,V; TODO→IN_PROGRESS hoặc append note | — |
| GET /tasks/:id/submissions | PageQuery→Page<SubmissionView> | submission:read / F,O,A | scope cha | — |
| POST /tasks/:id/submissions | SubmissionCreate→SubmissionView | submission:create / O | Q,V,files READY; task chưa COMPLETED/CANCELLED; late nhận | FILE_TYPE_INVALID,FILE_TOO_LARGE,REQUIRED_FILE_MISSING,PLAN_PAUSED |
| POST /submissions/:id/reviews | TaskReviewCreate→TaskReviewView | task:review / A | Q,V,current bài; ghi 1 effective review, update task atomic | STALE_SUBMISSION,REVIEW_COMMENT_REQUIRED |
| POST /task-reviews/:id/amendments | TaskReviewAmend→TaskReviewView | task:review / A | Q,V,current bài,reason; review mới supersedes cũ | STALE_SUBMISSION,REASON_REQUIRED,REVIEW_COMMENT_REQUIRED |
| GET /guidance-plans/:id/meetings | PageQuery→Page<MeetingView> | guidance:read / F,O,A | read | — |
| POST /guidance-plans/:id/meetings | MeetingCreate→MeetingView | guidance:manage / A | Q,V,ACTIVE | PLAN_PAUSED |
| PATCH /guidance-meetings/:id | MeetingAmend→MeetingView | guidance:manage / A | Q,V,reason,history | REASON_REQUIRED |
| GET /guidance-plans/:id/evaluations | PageQuery→Page<EvaluationView> | guidance:read / F,O,A | read | — |
| POST /guidance-plans/:id/evaluations | EvaluationCreate→EvaluationView | guidance:evaluate / A | Q,V,criteria cấu hình | EVALUATION_NOT_CONFIGURED,GRADE_001 |
| PATCH /phase-evaluations/:id | EvaluationAmend→EvaluationView | guidance:evaluate / A | Q,V,reason,history | EVALUATION_NOT_CONFIGURED,REASON_REQUIRED,GRADE_001 |
| GET /files/:id/download | —→binary attachment | file:download + quyền read cha / F,O,A,R | R chỉ file version đề cương được phân; không source tuần | FILE_NOT_READY |
| GET /me/notifications | PageQuery→Page<NotificationView> | authenticated self | userId server | — |
| POST /me/notifications/:id/read | —→NotificationView | authenticated self | UNREAD→READ idempotent | — |

Coverage thiếu cấu hình có thể trả response read 200 với coverageState=NOT_CONFIGURED và cảnh báo REPORTING_SCOPE_NOT_CONFIGURED; command materialize/nộp cần dữ liệu đó trả 409. Không trả aggregate thiếu=0 khi configuration chưa đầy đủ. Coverage GET không tự tạo task/obligation; materialization do explicit command hoặc xử lý cấu hình với idempotency, không bởi read.

Scan/evidence staging dùng storage contract chung có ownership, READY và policy; không nhận fileId bất kỳ. Endpoint staging chỉ được triển khai sau khi hoàn tất contract file ở PR chức năng, không tạo receipt scan giả. Milestone/criteria cấu hình do term/UC14 phối hợp; Evaluation chỉ nhận criteria đã cấu hình/snapshot, không tự áp GRADE weights học phần.

### 5.3 Lỗi và compatibility

Wire cũ giữ AUTH_002/003/004, TERM_003, COMMON_001/002/003, TOPIC_001/002, GRADE_001. Mã mới nêu trong bảng là literal wire dự kiến, phải bổ sung enum/handler/OpenAPI khi triển khai; không giả là đang có.

- 400: content/required field, TOPIC_001/002, ROUTING_MISMATCH, MEMBER_INELIGIBLE lúc giao, PERIOD_INVALID, DEADLINE_OUTSIDE_PHASE, REASON_REQUIRED, REVIEW_COMMENT_REQUIRED, ACKNOWLEDGEMENT_REQUIRED, FILE_TYPE_INVALID, REQUIRED_FILE_MISSING, GRADE_001, WEEKLY_REQUIREMENT_IMMUTABLE.
- 403: AUTH_002 account không hoạt động, AUTH_004 thiếu action, REVIEWER_CONFLICT. 401: AUTH_003 token không hợp lệ/hết hạn. Ngoài scope: 404 COMMON_001.
- 409: REVISION_CONFLICT, IDEMPOTENCY_CONFLICT, STATE_TRANSITION_INVALID, INPUT_NOT_READY, TOPIC_NOT_AGREED, STALE_VERSION, STALE_SUBMISSION, REVIEW_ALREADY_DECIDED, ACTIVE_REVIEW_EXISTS, ROUTING_NOT_CONFIGURED, DOSSIER_LOCKED, DOSSIER_NOT_FINALIZED, TEMPLATE_NOT_READY, PLAN_PAUSED, REBASE_REQUIRED, FILE_NOT_READY, EVALUATION_NOT_CONFIGURED, REPORTING_SCOPE_NOT_CONFIGURED, TERM_003, COMMON_002. 413: FILE_TOO_LARGE.

GET cũ `/topics/term/:termId`, `/tasks/plan/:planId`, `/notifications/user/:userId` phải được scope-aware trước mở nghiệp vụ, không để bypass endpoint mới. Không xóa/đổi shape consumer cũ trong PR1; kế hoạch compatibility do producer/consumer review trước implementation. `decision` endpoint mới là singular để phản ánh một kết luận; `/decisions` trong proposal cũ superseded, chưa phải breaking change API đang tồn tại.

## 6. Authorization matrix chính thức của baseline

Mọi grant dưới đây cần permission + quan hệ + scope + state/phase. F grant department phải khớp routing của hồ sơ, không từ role suy ra toàn Khoa. Reviewer member cũ sau bị gỡ mất quyền qua membership; lịch sử actor vẫn giữ. GVHD cũ mất quyền qua assignment cũ, nhưng nếu có một đường nghiệp vụ khác hợp lệ vẫn được kiểm độc lập. Actor history/notification link/file ID không là access token.

| Hành động | FACULTY | LECTURER | STUDENT | REVIEW_GROUP_MEMBER | ADMIN chỉ role Admin |
|---|---|---|---|---|---|
| Nhóm/phân công review | Quản lý trong grant | Không mặc nhiên | Không | Xem nhóm được giao | Không |
| Xem proposal/version | Trong grant | GVHD hiện hành đúng hồ sơ | Owner theo đợt | Chỉ version được phân, không draft | Không |
| Sửa draft | Không sửa thay tác giả | GVHD hiện hành | Owner | Không qua tư cách reviewer | Không |
| Submit/withdraw | Không nộp thay SV; trả nháp khi đang duyệt | Không submit | Owner, state guard | Không | Không |
| Comment/start/decision review | Chỉ nếu đồng thời là member hợp lệ | Chỉ nếu member hợp lệ, không hồ sơ mình hướng dẫn | Không | Member hợp lệ; 1 quyết định chung/vòng | Không |
| Finalize/reopen/receipt | Trong grant, audit/reason | Không | Không | Không mặc nhiên | Không |
| Export dossier | Trong grant | GVHD hồ sơ | Owner | Chỉ tải file review được phân, không export dossier mặc định | Không |
| Tạo plan/task AD_HOC | Theo dõi, không giao thay GVHD | GVHD hiện hành | Không | Không | Không |
| Ensure task tuần | Không thay nghiệp vụ GVHD | GVHD ensure theo obligation | Owner ensure theo obligation | Không | Không |
| Coverage tuần kể cả thiếu task/plan | Trong grant | Theo official assignment, không đòi plan tồn tại | Owner | Không | Không |
| Nộp/progress | Xem trong scope | Xem SV hướng dẫn | Owner, phase/state guard | Không | Không |
| Review/amend bài tuần | Xem, không chấm thay | GVHD hiện hành | Xem kết quả của mình | Không | Không |
| Họp/evaluation | Xem theo grant | Ghi/sửa có history | Xem của mình | Không | Không |
| Download files | Quyền cha trong grant | Quyền cha đúng hồ sơ | Quyền cha owner | Chỉ proposal version được phân | Không |
| Thông báo | Self | Self | Self | Self | Self, không người khác |
| Tài khoản/RBAC/audit kỹ thuật | Theo quyền riêng | Theo quyền riêng | Không mặc nhiên | Không mặc nhiên | Quản trị kỹ thuật, không tự đọc báo cáo/source/content qua audit |

Không tạo role REVIEW_GROUP_MEMBER hoặc ADMIN bypass. Seed hiện gán mọi permission cho ADMIN chưa đủ để đáp ứng policy này; PR auth phải xử lý đường kiểm quan hệ cả endpoint cũ, không tự refactor/thu hồi toàn bộ quyền quản trị ngoài phạm vi. Audit cho ADMIN chỉ metadata/ID/hash/field name cần thiết, không trả snapshot nội dung học thuật hoặc file source. Break-glass không thuộc baseline này.

## 7. Data-model proposal đồng bộ

Đây là kế hoạch field/relation/constraint cho PR2 sau phê duyệt, **không là Prisma đã sửa**. Tất cả aggregate mutable có revision Int>=0, audit actor/time; immutable snapshot không UPDATE content. Foreign key lịch sử ưu tiên Restrict trên chứng cứ chính thức; không cascade xóa hồ sơ theo tài khoản/đợt. Join kỹ thuật có thể cascade khi không xóa chứng cứ, cần kiểm drift thực trước viết DDL.

| Model | Field/relation dự kiến | Unique/index/enum/history |
|---|---|---|
| AcademicTermGrant + GrantDepartment | userId→UserAccount,termId→ThesisTerm,allDepartments flag, department join | unique(userId,termId), unique(grantId,departmentId); null/list semantics chuyển thành flag+join, không grant mọi term |
| ResearchArea / Department | ResearchArea.departmentId FK, routing revision | index departmentId; nhiều hướng/một bộ môn, không unique departmentId |
| ThesisTerm / TermPhase | officialAssignmentPlanId?, revision; phase.key/revision/timezone context | unique official pointer; unique(termId,key); plan phải cùng term qua composite consistency |
| TermStudent / TermLecturer | Giữ ID và PK/unique hiện tại, relations ngược | TermStudent unique(termId,studentId); TermLecturer PK(termId,lecturerId) |
| AssignmentPlan / AdvisorAssignment | term relation, finalizedAt/by,revision; assignment hiệu lực ổn định ID | index(termId,status), registrationId unique current; official pointer một plan/term, không unique termId trên tất cả drafts |
| AssignmentChange | assignmentId,old/new advisorId,actor/reason,effectiveAt,assignmentRevision | unique(assignmentId,assignmentRevision), index time; audit cùng transaction, không ghi đè lịch sử |
| Topic | termStudentId unique FK,revision,researchAreaId; agreement topicRevision/advisor/assignmentRevision/time | một Topic/TermStudent; giữ termId cũ tạm đối soát, không lâu dài hai source; TopicHistory giữ actor/change |
| Proposal | topicId unique,workingVersionId?,submittedVersionId?,submissionKind?,nextVersionNumber,nextReviewRound,revision | bỏ unique studentId toàn đời sau map; ProposalStatus §4.1, index(status,updatedAt,id); pointers phải cùng proposal |
| ProposalVersion | versionNumber,content,contentSchemaVersion,contentHash,state,basedOnVersionId?,createdBy,submittedAt/by,provenance | unique(proposalId,versionNumber), unique(id,proposalId) hỗ trợ composite ref; DRAFT/SEALED; legacy actor nullable rõ provenance |
| ReviewGroup / ReviewGroupMember | term/department FK,revision; members relation Lecturer/TermLecturer + membership history | member unique(groupId,lecturerId), index(termId,departmentId); không decisionMaker/vote/session |
| ProposalReview | versionId,groupId,roundNumber,state,assigned/started actor/time,routingSnapshot,phaseSnapshot,supersededByReviewId?,revision | unique(proposalId,roundNumber), index(groupId,state); partial unique một ASSIGNED/IN_REVIEW/proposal hoặc active pointer có constraint |
| ProposalReviewDecision | reviewId FK **unique**,versionId,decision,comment?,decidedByUserId,decidedAt | enum APPROVED/REVISION_REQUIRED; unique reviewId chặn nhiều quyết định cuối/vòng; immutable, đổi kết quả bằng vòng mới |
| ReviewComment | reviewId,versionId,authorUserId,text,createdAt | nhiều comments, index(reviewId,createdAt,id), append-only, không final decision riêng từng member |
| ThesisDossier | proposalId unique,state,currentFinalizationId?,revision | DRAFT/FINALIZED/RECEIVED/REOPENED; current finalization thuộc cùng dossier |
| DossierFinalization / Receipt | dossier/version/template/hash/pdf asset,actor/time,sequence; receipt finalization/actor/time/note/scan? | unique(dossierId,sequence), một receipt hiệu lực/finalization, history amendment; không lưu ký số |
| GuidancePlan | proposal FK unique,finalizationId,assignmentId/assignmentRevision,state,revision,description | ACTIVE/PAUSED/ARCHIVED; PlanHistory rebase/handover; advisorId cũ cache/derived không source thứ hai |
| GuidancePeriod + PeriodRequiredStudent | termId,ordinal,label,startsAt,endsAt,reportDueAt,type WEEK/MILESTONE,revision; applicability join→TermStudent | unique(termId,ordinal), unique(periodId,termStudentId); same-term FK/service constraint; tuần không overlap, deadline trong phase; applicability explicit có audit |
| WeeklyReportObligation | periodId,termStudentId,planId?,currentTaskId?,revision,configRevision/snapshot | **unique(periodId,termStudentId)**, plan/task nullable để hiện thiếu khi chưa tạo; index(termStudentId,periodId); không stored completed=true, trạng thái coverage dẫn xuất |
| Task | planId,periodId,kind,obligationId?,requirements JSON schema,revision,currentSubmissionId?,nextSubmissionNumber,cancel reason | WEEKLY_REPORT/AD_HOC; partial unique một task tuần chưa CANCELLED/obligation, index(planId,status,deadline); currentTask pointer phải cùng obligation/owner |
| TaskProgressEvent / TaskHistory | taskId,actor,time,note hoặc change/reason | append-only,index(taskId,time,id); sửa/cancel không xóa WeeklyReportObligation |
| TaskSubmission | taskId,versionNumber,state,actor/time,deadlineSnapshot,isLate,revision,content immutable | unique(taskId,versionNumber),index(taskId,submittedAt,id),current pointer cùng task; SUBMITTED/REVIEWED/SUPERSEDED |
| FileAsset / SubmissionFile | metadata kind/storageKey/name/size/MIME/hash,state READY/QUARANTINED,actor/time; submission asset link | unique storageKey,unique(submissionId,fileId); kind REPORT/SOURCE/EVIDENCE/DOSSIER_PDF/RECEIPT_SCAN; không enum ZIP/PDF extension; index reference, không xóa asset còn dùng |
| TaskReview | submissionId,decision,state,reviewer/assignmentRevision,time,supersedesReviewId?,reason,revision | **PASS/FAIL/REVISION_REQUIRED**, RECORDED/SUPERSEDED; một effective review/submission qua pointer/partial unique; supersedesReviewId unique tránh nhánh lịch sử |
| GuidanceMeeting / MeetingHistory | occurredAt,mode,discussion,conclusion,author,revision | index(planId,occurredAt); history sửa, không overwrite nhận xét |
| PhaseEvaluation / EvaluationHistory | milestone/periodId,criteriaSnapshot JSON có schema,criterionScores,evidence refs,actor,revision | unique(planId,milestoneId) bản hiệu lực; snapshot criteria id/name/range/weight; lịch sử, không sửa RubricCriteria/ScoreEntry bước 9–10 |
| AuditLog / OutboxEvent / IdempotencyRecord | transaction-aware audit; outbox event/type/aggregate/payload/delivery; idempotency actor/method/route/key/hash/result | index resource/id/time,unique eventId,unique actor+method+route+key; payload tối thiểu không copy source vào log |

Plan/proposal/obligation/task đều phải cùng TermStudent/term. Sự dư thừa planId/currentTaskId chỉ để liên kết hiệu lực, phải kiểm parent chain; không cho một task “thỏa” hai nghĩa vụ khác tuần/SV. Applicability không bị mất khi chưa có task hoặc plan. Task cũ cancel/replacement giữ history; coverage bài hiện hành của obligation qua current task, không chọn bài bất kỳ làm hoàn tất.

### 7.1 Bất biến, concurrency và audit bắt buộc

| Bất biến | Cơ chế bắt buộc | Ca kiểm tra trước merge PR chức năng |
|---|---|---|
| Ownership duy nhất theo đợt | unique Topic.termStudent/Proposal.topic + parent-chain consistency | cùng SV khác đợt độc lập, không cross-term FK hoặc IDOR |
| Quyền theo dữ liệu hiện hành | action+grant/membership/assignment; serialize handover/member changes với command | GVHD cũ/member bị gỡ không ghi/tải; Admin không đọc học thuật |
| Version đúng hồ sơ và đã nộp | composite refs/pointers, SEALED immutable, expected revisions | quyết định bản cũ bị 409, không lấy draft mới nhất |
| Một kết luận chung/vòng | unique ProposalReviewDecision.reviewId + CAS review/Proposal cùng transaction | hai member quyết định trái ngược đồng thời chỉ một thành công; retry không tạo bản thứ hai |
| Một active vòng/proposal | partial unique hoặc pointer constraint + atomic replacement | phân lại/rút/start đồng thời không có hai nhóm active |
| Một finalization current | snapshot immutable + pointer + revision | finalize/reopen đồng thời không vừa cho edit vừa còn bản chốt current |
| Tuần thiếu không biến mất do thiếu task | tập PeriodRequiredStudent làm gốc; obligation unique và ensure idempotent | chưa plan/chưa task vẫn hiện MISSING/isOverdue khi tới hạn; không hoàn thành giả; thiếu config không báo số 0 |
| Quyết định tuần không gộp | enum 3 mức và immutable review chain | FAIL và REVISION_REQUIRED cùng cần nộp lại nhưng API/DB/history/filter còn phân biệt |
| Chỉ PASS hợp lệ hoàn thành | review/task/submission đổi atomic, current submission guard | chưa nộp không hoàn thành; amend cũ không ghi đè bài mới |
| Phase/assignment/state không TOCTOU | khóa hàng cha có thứ tự thống nhất hoặc CAS/serialization; kiểm lại trước commit | upload chưa commit khi khóa phase bị từ chối; bàn giao cùng review không cấp quyền cũ sau hiệu lực |
| Version/round không trùng | counter atomic + unique, không MAX+1 không khóa | save/upload/start concurrent không duplicate number |
| Lịch sử không mất khi sửa | audit và domain history cùng transaction, actor/time/reason server | rollback không có business change lẻ/audit lẻ; không rewrite actor |
| File và DB nhất quán | staging READY, checksum/ownership, DB reference atomic, cleanup orphan | DB thất bại không tạo bài giả; cleanup không xóa file đã reference |
| Thông báo không mất/trùng nghiệp vụ | outbox cùng commit + idempotent delivery | mail lỗi không rollback nghiệp vụ, retry không duplicate submission/decision |

Coverage/snapshot không tự đồng bộ điểm hoặc eligibility. Nghĩa vụ không tự miễn do plan pause/task cancel; thay lịch/đối tượng phải qua cấu hình có audit được Khoa duyệt. Mọi transaction liên quan phase/handover cần lock order cố định để giảm deadlock; retry conflict kỹ thuật không được bỏ kiểm quyền/revision. Điểm tuyến tính hóa là transaction hợp lệ dưới cùng khóa/kiểm revision, không thời điểm client bấm/upload bắt đầu.

## 8. Tích hợp frontend và khoảng cách implementation

Giữ route `/topic/*`, `/guidance/*`, thêm explicit term/proposal context; không lấy đợt mới nhất hoặc Student.proposal duy nhất. React Query key có term/owner/proposal/version/period; invalidate đúng aggregate sau mutation, hiển thị conflict 409 và yêu cầu reload thay overwrite.

Review detail tách comments nhiều người và **một decision chung**; sau DECIDED khóa nút quyết định, server vẫn unique/CAS. Không hiển thị decisionMaker/quorum/session. Khoa thấy nút finalize sau APPROVED, không finalize thay duyệt. Submit chỉ SV; cả hai edit. PDF phân biệt preview, current finalization, bản cũ và receipt.

Dashboard tuần dùng `/weekly-report-coverage` làm nguồn chính, không TaskBoard đơn thuần. Hiển thị từng SV/tuần có MISSING, quá hạn, chưa plan/chưa task, NOT_CONFIGURED; có nút ensure task theo nghĩa vụ khi đủ điều kiện, không auto-complete. Hiển thị riêng đã nộp, đúng/trễ, PASS/FAIL/Cần sửa. Tải báo cáo/source chỉ theo quyền cha.

Khoảng cách repo hiện tại phải giữ rõ:

- Topic chưa có termStudentId; Proposal.studentId unique toàn hệ thống; không tuyên bố ownership mới đã có.
- ProposalReview chưa có actor reviewer/final decision unique; SubmissionFile chưa có kind; TaskReview vẫn isPassed boolean. Phát biểu ERD trong U1 không thay thế kiểm tra Prisma.
- API topic/guidance hiện chủ yếu GET, UI placeholder; `/auth/me`, grant, phase/roster/period/official assignment write còn dependency producer. Không giả lập production-ready từ model tồn tại.
- Enum legacy REJECTED, isPassed=false, dossier status cũ không tự chuyển sang decision/receipt mới khi thiếu chứng cứ. Schema implementation thay đổi chỉ ở PR được phép tiếp theo.

## 9. Điều kiện kỹ thuật trước PR2

1. **Người dùng phê duyệt baseline cuối này**, sau đó mới được bắt đầu công việc PR2 trong phạm vi phê duyệt; đồng ý nguyên tắc C01–C10 không thay yêu cầu duyệt bản hợp nhất.
2. Chốt bàn giao với chủ bước 1–3 theo §3.6: identity/grant, roster/phase/period applicability, official assignment/handover, Topic agreement/submitted version. Nếu producer chưa implement, PR2 có thể chuẩn bị cấu trúc theo contract sau khi được phép, nhưng không tuyên bố luồng tích hợp chạy hoàn chỉnh.
3. Dùng Prisma/schema theo ADR và migration mới trong backend/prisma/migrations; SQL database/migrations là lịch sử/tham chiếu, không chạy hai cây. Kiểm history và drift trên bản sao DB trước viết/áp migration. Không sửa 0_init, không db push/reset/migrate dev theo giới hạn phiên làm việc.
4. Kiểm dữ liệu thật/đại diện: orphan, duplicate, cross-term; mapping Proposal→Topic→TermStudent, timestamps/timezone, enum/string, nullable/default/onDelete. Trường hợp không map duy nhất phải báo đối soát, không chọn ngẫu nhiên owner/decision/receipt.
5. Kế hoạch expand→backfill có kiểm chứng→validate→siết constraints; migration không tự convert isPassed=false thành FAIL/Cần sửa hoặc APPROVED dossier thành đã nhận giấy. Giữ ID legacy không UUID. Không refactor toàn DB để giải quyết drift ngoài phạm vi.
6. Chọn cách biểu diễn partial unique/composite refs/active pointers và transaction lock order; Prisma chưa biểu diễn được constraint nào thì migration SQL mới phải có tài liệu/test PostgreSQL thật. Review lock/index/backfill tác động và phương án phục hồi trước áp DB.
7. Chuẩn bị baseline checks sẵn có trong audit (type-check, lint, test, build), cùng kế hoạch integration cho constraints/transaction/coverage/IDOR. PR1 chỉ kiểm tài liệu, chưa chạy hay tuyên bố test nghiệp vụ pass.
8. Không đổi consumer cũ ngầm; phối hợp shared DTO/OpenAPI/auth UI và CI theo module owner. Chưa stage/commit/triển khai schema chỉ vì tài liệu đã được viết.

Không còn câu hỏi nghiệp vụ B/C mở để chọn schema. Các giá trị vận hành **chưa tự quyết**: ngày tuần/SV áp dụng, danh mục/mapping/grant thực, criteria/range/weights giai đoạn, allowlist/size/retention file, ngưỡng/tần suất cảnh báo và retry, template PDF/font/bố cục. Chúng là cấu hình/nội dung cần Khoa hoặc người dùng duyệt trước PR chức năng tương ứng, không tự điền giá trị chính thức và không hỏi lại mô hình đã chốt. Nếu dữ liệu legacy phát sinh trường hợp không xác định thì dừng phần backfill liên quan và xin đối soát dữ liệu cụ thể.

## 10. Phạm vi thay đổi và kiểm tra PR1

Lượt hợp nhất chỉ sửa `docs/implementation/01-business-decisions-and-contract.md`. Không sửa audit 00, DOCX, Prisma schema, migration, dependencies, code hoặc file của thành viên khác; không stage/commit. `git diff --stat` không hiện tài liệu untracked, cần kèm `git status --short --untracked-files=all`.

Đầu lượt Git: DOCX modified; audit 00 và tài liệu 01 untracked. SHA256 để đối chiếu bảo toàn:

| File | SHA256 đầu lượt |
|---|---|
| docs/implementation/00-repository-audit.md | 643d78c9ac1c9236ae53f7f1d885a65515f0492e9a3c9c2f25b5b2e40daf647c |
| docs/spec/Project_1_06.docx | 2afea1a8d2cc74c50a690f4fb91874c1c83bb3d2ad1fbdb2fadc1db49b808f1a |
| backend/prisma/schema.prisma | 4ba94074b865c127f839e9651bae844da056b945a4aec2400560c47e6ed90368 |

Kiểm tra tài liệu cần có: 14 quyết định, 8 state machines chính + coverage model, endpoint/DTO/permission khớp nhau, không sessions/decisionMaker trong contract hoạt động, một review decision unique, weekly obligation nullable task/plan, ba task decision riêng, không blocker B/C đã đóng còn đánh dấu chờ. Đây là kiểm consistency tài liệu, không thay unit/integration test thực thi ở PR chức năng.

Kết quả đã chạy: kiểm cấu trúc và local links PASS (14 nhóm, 8 state machines chính, 46 endpoint); không còn NEED_CONFIRMATION hoặc field sessions/decisionMaker trong các phần contract hoạt động §3–§7. Đối chiếu SHA256 sau ghi: audit 00, DOCX và schema trùng đầu lượt. Đã chạy `git status --short`, `git diff --stat` và status chi tiết untracked; chỉ tài liệu 01 được agent sửa trong lượt này. Chưa chạy typecheck/lint/test/build và không tuyên bố kiểm thử nghiệp vụ đã pass.

## BLOCKERS BEFORE PR2

**Không còn blocker nghiệp vụ B01–B12/C01–C10 chưa được trả lời.**

Điểm chặn hiện tại: **chờ người dùng phê duyệt baseline hợp nhất cuối này**. Chưa bắt đầu PR2 cho đến khi có phê duyệt. Sau phê duyệt, thực hiện các điều kiện kỹ thuật §9; thiếu môi trường/dữ liệu/mapping backfill thì báo đúng dependency bị thiếu, không tự suy nghiệp vụ hoặc áp migration lên dữ liệu chính thức.
