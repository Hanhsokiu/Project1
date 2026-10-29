# Audit hiện trạng frontend + backend Bước 9–10 (UC17–UC25)

Ngày: **29/10/2026**, múi giờ Asia/Bangkok. Repository: `E:\Project-Xaydungdoantotnghiep\DATN\Project1`.

## A. Executive summary

**Chưa đủ điều kiện nghiệm thu trọn Bước 9–10.** Có workflow/API thật, validation, kiểm quyền theo đối tượng, revision, lịch sử và giao diện gọi API; không phải toàn bộ là mock. Tuy nhiên UC24 không thể chốt/công bố qua wiring production hiện tại, UC25 chưa có biên bản ký chính thức, và UC19–21 còn thiếu một số yêu cầu của đặc tả. Có nguy cơ hiển thị giao diện chấm điểm demo trong phiên đăng nhập API nếu bật thiếu feature flag.

- **Git:** nhánh `feature/step-9-10`, HEAD `41a074a6c292636d1bec9deea408fb193b6c51ad`, ahead 3 so với tracking ref local. Không fetch nên không khẳng định trạng thái remote thời gian thực.
- **Tích hợp:** `a1031d3` tích hợp UI, parent thứ nhất `0b4f400`; `41a074a` ghi kết quả kiểm tra trước đây; phía UI có `abdbfdd`. Kết quả test của lượt trước không được dùng làm PASS lượt này.
- **Working tree đầu lượt:** chỉ `M scripts/integration-ui.cjs`, thay cổng hằng bằng `Number(process.env.BTL_UI_DB_PORT || 55451)`. Không sửa thay đổi này. SHA-256 đầu/cuối: `AF73B2EE339C53990DF544FCE3AEFFCABC1347203E888812059AA797B8A92C09`.
- **Kiểm tra mới:** backend 83 file / **1.320 test PASS**; frontend 37 file / **386 test PASS**; type-check, lint, build và Prisma validate offline PASS. Đây là unit/HTTP với repository giả, không phải PostgreSQL integration.
- **Browser:** lần chạy mock API bị chặn trước test vì `5173` đã được sử dụng; không tắt hoặc tái sử dụng server không xác định. Demo browser chưa chạy. Không mở website/backend đang chạy để kiểm thử.
- **Database:** không kết nối PostgreSQL, không migration/seed/reset, không chạy `ui:dev`/`ui:prepare`. Không lấy tình trạng database ở lượt xử lý EPERM trước làm bằng chứng của audit này.
- **Thay đổi có chủ đích của audit:** chỉ báo cáo này. Build/test có sinh artifact trong thư mục output/cache được công cụ quản lý; không sửa source/config/schema/test, không chủ động xóa cache hoặc dữ liệu, không thay Git.

### Các vấn đề HIGH và giới hạn kết luận

| ID | Kết luận | Phạm vi ảnh hưởng |
|---|---|---|
| F01 | Nguồn điểm GVHD cuối cùng và xác nhận Hội đồng production luôn UNKNOWN; command cấu hình không phê duyệt calculation policy | UC17 phần điểm cuối, UC24; kéo theo UC25 kết quả mới |
| F02 | Chưa có mẫu biên bản ký/chữ ký chính thức, PDF lịch/phản biện chủ động trả 409 | UC25, phần biên bản UC23 |
| F03 | Quy tắc GVPB cùng Hội đồng với GVHD trong đặc tả Markdown chưa được áp dụng; validator chấp nhận ca này | UC20; cần thống nhất cách hiểu giữa hai tài liệu |
| F04 | Nhánh API chưa có tự sắp Tên + Họ đệm theo buổi Sáng/Chiều | UC21; DOCX ghi cần Khoa xác nhận áp dụng, không tự coi mọi lịch nhập tay là sai |
| F05 | `AUTH_API=true` + `GRADING_API=false` vào trang điểm demo mà nhãn demo toàn shell bị ẩn | Rủi ro nhầm điểm/chốt/công bố local là nghiệp vụ thật |

Không phát hiện CRITICAL có bằng chứng trong phạm vi đã kiểm tra. Không đồng nghĩa không còn lỗi bảo mật. Không phát hiện sai hệ số 40/60 trong engine chính thức; chính sách làm tròn/quorum và nguồn điểm vẫn bị chặn có chủ đích.

### Căn cứ và cách đọc trạng thái

- `docs/spec/dac-ta-use-case.md:26`–`:37`: Bước 9–10, quy tắc xung đột, thứ tự, công thức; `:72`–`:88`: biểu mẫu và thành phần điểm.
- Đọc trực tiếp `word/document.xml` trong `docs/spec/Project_1_06.docx`, không chỉnh tài liệu. Chỉ số đoạn ở đây là **0-based**, XPath `//w:body//w:p`: UC17 1542–1562; UC18 1564–1584; UC19 1586–1606; UC20 1608–1628; UC21 1630–1650; UC22 1652–1672; UC23 1674–1694; UC24 1696–1716; UC25 1718–1738.
- DOCX đoạn 1648 ghi alphabet “nếu Khoa xác nhận áp dụng”; Markdown `:31` mô tả tự động. DOCX đoạn 1626 chỉ nêu loại GVHD; Markdown `:29` nêu rộng hơn cả thành viên Hội đồng chứa GVHD. Không tự chọn bỏ yêu cầu nghiêm ngặt hơn.
- Các báo cáo cũ dùng để tìm dấu vết, không thay cho việc đọc code hoặc chạy test mới.

**IMPLEMENTED** = có implementation và bằng chứng kiểm tra ở phạm vi nêu; **PARTIAL** = chỉ hoàn thành một phần yêu cầu; **MISSING** = chưa có đường thực thi tương ứng trong phạm vi rà soát; **BLOCKED** = có code nhưng điều kiện/policy/producer/môi trường đang chặn; **NOT VERIFIED** = chưa kiểm chứng ở lớp tương ứng. Một UC có thể IMPLEMENTED phần lõi nhưng NOT VERIFIED runtime thật; không dùng một nhãn để che lớp còn thiếu.

## B. Ma trận UC17–UC25

| UC | Frontend | Backend | API integration | Tests hiện chạy | Status | Evidence chính |
|---|---|---|---|---|---|---|
| UC17 | Inbox, context, PDF, đồng ý/từ chối, lý do và history thật; chưa có điểm GVHD cuối chính thức | Kiểm GVHD hiện hành, cửa sổ, PDF/revision, khóa UC18; ghi quyết định/history/audit | Adapter thật cho quyết định/PDF; điểm GVHD không có producer | Command 62; read 39; report 52; final-report service 27 test; cùng validator/repository/UI tests | **PARTIAL** tổng yêu cầu; xác nhận/PDF IMPLEMENTED; điểm cuối MISSING | `backend/src/guidance/defense-confirmations/defense-confirmation-command.service.ts:160`; `frontend/src/features/guidance/defense-confirmations/page.tsx:134`; F01 |
| UC18 | Preview + panel chính thức học vụ, policy, finalize/reopen | Evidence học vụ có nguồn tham chiếu; snapshot V2, CAS, khóa downstream | Có API thật; không suy học vụ từ mock/legacy | Defense-list service 34; workflow service 29, invariants 29, HTTP 13 test dùng chung UC18–21 | **IMPLEMENTED lõi**; trường hợp bảo lưu liên đợt PARTIAL; runtime NOT VERIFIED | `frontend/src/features/defense/workflow/panels.tsx:261`; `backend/src/defense/workflow/defense-workflow.service.ts:926` |
| UC19 | Form thành viên/chức vụ/hồ sơ; preview và lưu/chốt server | 3–5 GV, một Chủ tịch/Thư ký, sức chứa, GVHD không trong HĐ của SV | Có; phân biệt preview với draft/artifact | Planning policy 27; service 23; workflow suites dùng chung | **PARTIAL**: lõi thủ công IMPLEMENTED; chưa có tự tính/chia HĐ cân bằng | `backend/src/defense/planning/defense-planning.policy.ts:61`; `backend/src/defense/workflow/defense-workflow.policy.ts:241`; F06 |
| UC20 | Form phân GVPB, tải/gợi ý, lưu/chốt | Một GVPB/hồ sơ; loại chính GVHD; gợi ý theo tải, thông báo | Có API thật; còn lỗ hổng quy tắc cùng HĐ với GVHD | Planning/workflow suites PASS; probe mới chấp nhận ca xung đột mở rộng | **PARTIAL** | `backend/src/defense/workflow/defense-workflow.service.ts:610`; `backend/src/defense/planning/defense-planning.policy.ts:237`; F03 |
| UC21 | Nhập slot ngày/giờ/phòng, kiểm xung đột, chốt/công bố/amend; trang lịch công bố | Room/people/committee overlap, booking liên đợt, snapshot/history | Có; auto alphabet chỉ có ở demo | Planning/workflow suites PASS; probe lịch đảo alphabet ACCEPTED | **PARTIAL** | `frontend/src/features/defense/planning/pages.tsx:476`; `backend/src/defense/planning/defense-planning.policy.ts:268`; F04 |
| UC22 | Inbox, tải PDF, rubric, nhận xét/câu hỏi, lưu nháp/chốt/history | Đúng phân công, rubric 2/3/1/2/2, >=2 câu hỏi, cửa sổ, snapshot | Luồng chính đầy đủ endpoint/payload ở mức code | Grading service 46; HTTP 22; policy 19; source 19 test dùng chung | **IMPLEMENTED lõi chấm cá nhân**; sửa sau chốt BLOCKED, E2E thật NOT VERIFIED | `shared/src/contracts/grading-workflow.ts:30`; `backend/src/grading/workflow/grading.service.ts:848`; `frontend/src/features/grading/workflow/pages.tsx:215` |
| UC23 | Cùng form theo COMMITTEE; phiếu riêng từng tài khoản | Rubric cấu hình, slot/đợt bảo vệ, điểm độc lập, CAS, khóa SEALED | Có luồng phiếu cá nhân; chưa có tổng quan/xác nhận tập thể và biên bản | Nhóm grading như UC22; provenance/complete 40 test | **PARTIAL** cả UC; chấm cá nhân IMPLEMENTED | `backend/src/grading/workflow/grading-source.reader.ts:185`; `backend/src/grading/workflow/grading.service.ts:503`; F01/F02 |
| UC24 | Preview/blockers, nút chốt/công bố theo capability; SV đọc sau công bố | Engine + evidence verification có; production thiếu producer và approval | Gọi đúng API nhưng không thể hoàn tất publish production hiện tại | Grading completion 40; parameters 18; service/HTTP dùng nguồn TEST ONLY cho nhánh thành công | **BLOCKED** | `backend/src/grading/workflow/grading-workflow.module.ts:28`; `shared/src/contracts/grading-workflow.ts:89`; F01 |
| UC25 | Report summary, filter, tải XLSX/PDF riêng tư | Excel lịch/phản biện; kết quả PUBLISHED đã xác minh; PDF tra cứu; audit xuất | Có một phần; PDF ký chưa mở; kết quả phụ thuộc UC24 | Official-report 17 test, có đọc workbook/PDF thật trong bộ unit | **PARTIAL / BLOCKED** mẫu ký và kết quả mới | `backend/src/report/official/official-report.service.ts:168`; `frontend/src/features/grading/workflow/pages.tsx:685`; F02 |

Không UC nào được nghiệm thu end-to-end thật trong lượt này. Các số test dùng chung **không cộng lại thành coverage riêng từng UC** và không thay cho branch coverage.

## C. Frontend → API → backend

### Router, shell, vai trò và feature flags

`frontend/src/app/router/routes.tsx:315` đặt UC17–25 API trong `WorkflowAccess` + `AcademicWorkflowLayout`. `frontend/src/app/layouts/AcademicWorkflowLayout.tsx:26` dùng `WorkspaceLayout` với `sessionWorkspace(user)` và tắt global term picker; không tự hydrate catalog/demo roster cho workflow thật. Sidebar lấy `routeManifest`, lọc role; `frontend/src/app/layouts/WorkspaceLayout.tsx:146` và `frontend/src/app/router/route-manifest.ts:11`.

API route và demo route được chọn theo nhánh điều kiện đối nhau (`routes.tsx:323`, `:591`, `:651`), nên việc xuất hiện cùng path trong source không tự là trùng route runtime. `/grading/scores` còn redirect ở `:391`; không thấy mất route chính UC17–25 trong diff merge. Backend không dùng danh sách role frontend để thay permission.

| UC | Route / role hiển thị | Component và thao tác | API client → HTTP endpoint (đều có prefix `/api`) | Controller → service/repository |
|---|---|---|---|---|
| 17 PDF | `/guidance/final-report`; manifest STUDENT/LECTURER/FACULTY, trang API chỉ cho STUDENT nộp, GVHD được hướng sang UC17 | `FinalReportUploadPage` → `final-reports/page.tsx:28`; chọn proposal, đọc cửa sổ, upload/download PDF | `guidance/final-reports/api.ts:10`: GET `/proposals/:p/final-report-context`, GET/PUT `/proposals/:p/final-report`, GET `.../download` | `FinalReportController` (`final-report.controller.ts:100`) → `FinalReportService` → `FinalReportRepository` |
| 17 quyết định | `/guidance/defense-confirm`; LECTURER/FACULTY/STUDENT; chỉ GVHD hiện hành ghi | `defense-confirmations/page.tsx:30`, `inbox.tsx`; form quyết định, ghi chú/changeReason, xem history | `defense-confirmations/api.ts:35`: GET `/defense-confirmations/terms`, `/inbox`; GET `/proposals/:p/defense-confirmation-context`, `/defense-confirmation`, `/history`; PUT `/defense-confirmation`; GET `/defense-confirmation/report/download` | `DefenseReviewController:27` cung cấp inbox; read/report/command controllers → các service tương ứng → read/command/report repository |
| 18 | `/defense/eligibility`; ADMIN/FACULTY ở UI; backend cần permission + grant | `defense-lists/page.tsx:135`, `OfficialEligibilityPanel` (`workflow/panels.tsx:261`): tạo/mở, lọc, nhập evidence, cấu hình, chốt/mở lại | `defense-lists/api.ts:61`: GET `/defense-lists/terms`, `/terms/:t/defense-list[/preview]`, POST list, POST `/open`; `workflow/api.ts:49`: GET workflow/history, PUT `/defense-list/workflow-policy`, POST `/academic-evidence`, GET evidence history, POST `/finalize`, `/reopen` | `DefenseListController`, `DefenseReviewController`, `DefenseWorkflowController:62` → `DefenseListService`, `DefenseReviewService`, `DefenseWorkflowService` → repositories |
| 19 | `/defense/committees`; ADMIN/FACULTY | `CommitteePlanningPage` (`planning/pages.tsx:100`): thành viên/chức vụ, chọn hồ sơ/sức chứa; `OfficialStagePanel` lưu/chốt | `planning/api.ts:38`: GET `/defense-planning/terms`, GET `/terms/:t/defense-planning/context`, `/committees[/id]`, POST `/committees/preview`; `workflow/api.ts:102`: PUT `/terms/:t/defense-workflow/COMMITTEES/draft`, POST `/finalize` | `DefensePlanningController:54`, `DefenseWorkflowController:120` → Planning/Workflow services → repositories |
| 20 | `/defense/reviewers`; ADMIN/FACULTY | `ReviewerPlanningPage`; chọn GVPB, xem tải, dùng gợi ý trong panel, preview/lưu/chốt | GET `/terms/:t/defense-planning/reviewers`, POST `/reviewers/preview`; PUT `/defense-workflow/REVIEWERS/draft`, POST `/finalize` | `DefensePlanningController:80/:116`, `DefenseWorkflowController:120/:132` → Planning/Workflow services |
| 21 | `/defense/schedule`; ADMIN/FACULTY; `/defense/published` mọi role trong manifest, dữ liệu backend lọc quan hệ | `SchedulePlanningPage`, `OfficialStagePanel`, `workflow/published.tsx`: slot, preview, lưu/chốt/công bố/amend, lịch đã công bố | GET `/terms/:t/defense-planning/schedule`, POST `/schedule/preview`; PUT `/defense-workflow/SCHEDULE/draft`; POST `/finalize`, `/publish`, `/amend`; GET `/terms/:t/defense-schedule/published` | `DefensePlanningController:90/:133`; `DefenseWorkflowController:144/:161/:173` → `DefenseWorkflowService` |
| 22 | `/grading/reviewer`; LECTURER | `GradingWorkflowPage mode=REVIEWER` → `Scoring`, `ScoreDetail`, `GradeHistory` | `grading/workflow/api.ts:110`: GET `/terms/:t/grading/inbox?kind=REVIEWER`, GET `/grading/proposals/:p/REVIEWER`; PUT `/draft`, POST `/seal`, GET `/history`, GET `/report` có identity PDF | `GradingController:51/:97/:108/:126/:144/:163` → `GradingService` → `GradingSourceReader`, `GradingRepository` |
| 23 | `/grading/committee`; LECTURER/COMMITTEE | Form như UC22, kind COMMITTEE, phiếu độc lập | Như UC22 với `COMMITTEE`; không có endpoint ghi điểm của người khác | Cùng controller/service; owner gồm term/proposal/scorer/kind, `grading.repository.ts:64` |
| 24 | `/grading/results`; FACULTY/STUDENT; `/grading/policy`; FACULTY | `Results` (`pages.tsx:634`), `PolicyForm:455`: blockers, preview, chốt/công bố; rubric/windows | GET `/terms/:t/grading/results/preview`, `/grading/my-results`; POST `/grading/results/:p/seal`, `/publish`; GET/PUT `/grading/policy` | `GradingController:189/:198/:207/:225`, `:61/:87` → `GradingService` + evidence/parameter readers |
| 25 | `/report/official`; FACULTY | `Reports` (`pages.tsx:685`): loại báo cáo, format, committeeKey/className, tải Blob | `api.ts:95/:220`: GET `/terms/:t/official-reports/summary`, `/export?kind=...&format=...` | `OfficialReportController:29/:46` → `OfficialReportService` → `GradingRepository`, verified published results |

Các adapter dùng shared Zod schema cho payload lệnh và encode ID; `frontend/src/shared/api/http-client.ts:9` gắn baseURL và JWT. Không thấy adapter API chính của UC17–25 gọi ba endpoint legacy bị khóa. Tìm `scores/proposal|committees/term|reports/stats` trong frontend chỉ thấy assertion không gọi legacy trong `defense/workflow/api.test.ts:141`.

**Backend đã có nhưng UI chưa dùng:** policy history (`grading.controller.ts:70`) và result history (`:243`) không có method tương ứng trong `frontend/src/features/grading/workflow/api.ts` hoặc màn history trong `Policy`/`Results`; history phiếu cá nhân có ở `api.ts:150` và `pages.tsx:170`. Đây là F07, không phải mất audit dữ liệu backend.

### Kiểm tra chi tiết từng UC

#### UC17 — PDF và xác nhận của GVHD

- **Dữ liệu/validation:** `FinalReport`/`FileAsset` (`backend/prisma/schema.prisma:997`, `:2130`), `DefenseConfirmation` và `DefenseConfirmationHistory` (`:1014`, `:1041`). PDF phải hợp lệ, đúng checksum/revision; `final-report.service.ts:167`–`:214` kiểm lại sau filesystem work; download kiểm bytes/hash ở `:279`. Không đọc tùy ý filePath legacy.
- **Quyền:** `defense-confirmation.validator.ts:182` yêu cầu GVHD chính thức hiện hành; command validator `:31` yêu cầu permission `defense-confirmation:decide`; read validator `:46/:77` tách SV sở hữu/GVHD/Khoa trong phạm vi. Khoa không tự thay quyết định của GVHD chỉ vì role.
- **Trạng thái:** ABSENT/PENDING và quyết định CONFIRMED/REJECTED; CONFIRMED cần PDF hợp lệ (`validator.ts:617`), REJECTED cần lý do; thay quyết định cần changeReason (`command.validator.ts:101`). UC18 FINALIZED chặn ghi (`validator.ts:504`). Progress chưa xong tạo cảnh báo, không tự biến thành điều kiện học vụ mới.
- **Concurrency/lịch sử:** transaction + lock nguồn/PDF, recheck, expectedRevision/context, CAS, append history/audit/notify cùng transaction (`command.service.ts:160/:225/:241/:266/:283`). Notification ở đây là in-app, không chứng minh email đã được gửi.
- **UI:** loading/error/empty, chọn lại context, vô hiệu hóa gửi khi stale/fetch/error, PDF revision, history phân trang (`page.tsx:134/:174/:213/:285`; `actions.ts`, `validation.ts`). Ghi chú quyết định không phải phiếu điểm GVHD cuối.
- **Chưa kiểm chứng:** upload/download browser thật, SQL race khi thay PDF/assignment và finalize UC18 đồng thời, file permission runtime. Unit mocks không chứng minh PostgreSQL lock. Điểm GVHD chính thức còn MISSING (F01).

#### UC18 — nguồn học vụ và chốt/mở lại danh sách

- **Dữ liệu:** `DefenseList`, `DefenseListFinalization`, `DefenseAcademicEvidence` (`schema.prisma:1069/:1098/:1122`). Preview đọc nguồn hiện hành; chốt snapshot V2 chứa PDF/phân công/quyết định và học vụ, không chỉ cờ trạng thái.
- **Validation/quyền:** command workflow cần permission và grant allDepartments đúng đợt (`defense-workflow.service.ts:111/:132`); học vụ có sourceReference, verdict, note và revision (`shared/src/contracts/defense-workflow.ts:59`). Không tự coi thiếu evidence là đạt.
- **Trạng thái:** tạo DRAFT → mở → FINALIZED; reopen có reason và bị chặn khi downstream đã chốt (`defense-list.service.ts:59/:91`, `defense-workflow.service.ts:926/:1045/:1067`). Snapshot cũ được giữ; đổi policy cơ cấu sau seal bị chặn.
- **Lịch sử/đồng thời:** command wrapper recheck, requestId/idempotency, revision/context và audit (`defense-workflow.service.ts:671`); academic append-only; SQL constraints/triggers xem phần bảo mật bên dưới.
- **UI:** panel học vụ, policy, finalize/reopen, capabilities, busy/error và history (`panels.tsx:261/:295/:348/:465/:482`). Preview và số admitted được gắn nguồn, không gọi preview là danh sách official.
- **Giới hạn:** verdict SPECIAL chỉ là evidence/phân loại; chưa thấy luồng chuyên biệt nối hồ sơ bảo lưu cũ sang đợt mới trong các command UC18 nêu trên. Không kết luận đầy đủ mọi ngoại lệ UC18; cần testcase và quyết định nghiệp vụ cho bảo lưu/được phản biện chưa bảo vệ/bổ sung. Runtime DB, FK/trigger và finalize/reopen cạnh tranh NOT VERIFIED.

#### UC19 — Hội đồng

- **Implementation:** check 3–5, lecturer hợp lệ, không trùng, không chứa GVHD của hồ sơ, không phân hồ sơ hai lần (`defense-planning.policy.ts:43/:61/:134`). Official validation siết đúng size policy, một CHAIR và một SECRETARY, sức chứa và bao phủ đủ admitted (`defense-workflow.policy.ts:241`). Warning preview về nhiều chức danh không có nghĩa official cho qua.
- **Dữ liệu/state:** nguồn UC18 V2; `DefenseStageWorkflow` DRAFT → FINALIZED; `DefenseStageArtifact` bất biến (`schema.prisma:1142/:1169`). Các bảng `DefenseCommittee`/`CommitteeMember` legacy không tự trở thành nguồn official.
- **Quyền/transaction:** Planning permission read/preview khác Workflow manage/finalize; grant đúng term, kiểm lại nguồn ở thời điểm chốt. Lưu/chốt dùng CAS, audit/idempotency và thông báo trong transaction (`workflow.service.ts:1370/:1532/:1554`).
- **UI:** form có thành viên, vai trò, hồ sơ, sức chứa; nút preview và panel official riêng. Tải lại draft có bước người dùng chọn; lỗi conflict chặn bản local cũ (`planning/layout.tsx:181`; `workflow/panels.tsx:536`).
- **Thiếu:** tự tính số HĐ/chia cân bằng/cảnh báo lệch tải HĐ chưa thấy trong nhánh official (F06); form thủ công vẫn dùng được. SQL race, browser chốt thật, workload lớn NOT VERIFIED.

#### UC20 — phản biện

- **Implementation:** admitted coverage đúng một GVPB, không duplicate và không chính GVHD; gợi ý chọn tải thấp nhất, tie-break theo ID, cảnh báo reviewerWarningLoad (`workflow.service.ts:610`–`:639`; `workflow.policy.ts:303`). Không có hard quota mặc định.
- **Thiếu quy tắc:** candidate filter chỉ `id !== advisorId`; validator không loại thành viên cùng HĐ với GVHD (F03, có probe chạy mới). Gợi ý cân tải theo cá nhân chưa chứng minh cân bằng theo Hội đồng.
- **API/UI/state:** reviewer preview → lưu draft → finalize artifact; frontend có chọn tay và panel áp gợi ý (`planning/pages.tsx`, `workflow/panels.tsx:685`). Snapshot reviewer là nguồn quyền UC22, không dùng `ReviewerAssignment` legacy như bằng chứng đã chốt.
- **Audit/quyền/lỗi:** như UC19; permission riêng, grant, context hash và expectedRevision. In-app notification khi chốt, không có bằng chứng email delivery.
- **Tests thiếu:** peer-of-advisor conflict không được existing suite bắt; cấp quyền trên DB thật và assignment đổi trong lúc chấm chưa E2E. Kiểm này PARTIAL, không gắn nhãn PASS cả quy tắc khách quan.

#### UC21 — lịch

- **Implementation:** slot start/end/phòng/proposal/committee; kiểm time range, room capacity, trùng SV/GV/HĐ/phòng trong phương án và booking khác (`defense-planning.policy.ts:268`–`:443`). Official kiểm đủ hồ sơ, luôn tính GVPB tham dự; lock tài nguyên theo thứ tự (`workflow.repository.ts:79/:92`).
- **State:** DRAFT → FINALIZED → PUBLISHED; amendment cần reason và artifact mới, giữ bản cũ (`workflow.controller.ts:144/:161`; `workflow.service.ts:1370`). Trang published chỉ lấy API được kiểm quyền/quan hệ, không lấy bản preview.
- **Thiếu:** nhập từng datetime, không mô hình hóa buổi Sáng/Chiều và không có lệnh sắp Tên + Họ đệm ở nhánh API; demo có `sortDefenseOrder` (`defense/services/defense-service.ts:578`). Probe chứng minh validator không tự sắp/ép thứ tự, **không chứng minh mọi override thủ công là sai**. F04.
- **UI/lỗi/history:** `SchedulePlanningPage` dùng form slot, remove/edit, preview; official panel báo busy/conflict/history; published có empty/error. Chưa kiểm DST/timezone giữa máy client và lịch Khoa; UI hiện dùng múi giờ máy (`planning/pages.tsx:479`).
- **Tests thiếu:** alphabet tiếng Việt, trùng tên, buổi sáng/chiều, override thứ tự có audit; lock cross-term trên PostgreSQL và browser publish/amend thật NOT VERIFIED.

#### UC22 — phiếu phản biện

- **Validation/model:** `gradingKindSchema` chỉ REVIEWER/COMMITTEE; rubric phản biện cố định 2/3/1/2/2, score hữu hạn/đúng rubric, complete + comment khi seal và >=2 câu hỏi (`shared/src/contracts/grading-workflow.ts:30/:97`; `grading.policy.ts:160`; `grading.service.ts:848`). `GradingSheet` unique owner và `GradingSheetRevision` giữ source/policy/history (`schema.prisma:1428/:1448`).
- **Quyền:** actor permission, lecturer hoạt động, đúng reviewer của immutable artifact; GVHD không tự chấm phản biện của mình (`grading.service.ts:503`; `grading-source.reader.ts:185/:318`). Tải PDF đúng identity, không là endpoint xuất phiếu chấm.
- **State/transaction:** DRAFT → SEALED; không sửa SEALED qua save; revision/context CAS, lock nguồn, audit/history/idempotency, đọc lại nguồn trước commit. History chỉ phiếu của mình (`grading.service.ts:848/:999`).
- **UI:** đọc context → chủ động chấp nhận → lưu → tải/xem lại → seal bản server đã lưu; score/comment/questions, PDF, empty/error/loading, conflict không tự retry (`pages.tsx:215/:249/:418`).
- **Giới hạn:** amendment/sửa muộn sau chốt chưa có quy trình; không có xuất PDF phiếu cá nhân. Chưa có browser/happy-path API thật của toàn chuỗi, không coi mock success là điểm production.

#### UC23 — phiếu thành viên Hội đồng

- **Implementation:** dùng cùng pipeline UC22 với kind COMMITTEE; đọc đúng membership/slot từ artifact, rubric do Khoa cấu hình tổng 10, phiếu theo từng user, không ghi hộ (`grading.service.ts:503`, `grading-source.reader.ts:185`, `grading.repository.ts:64`).
- **Mốc/trạng thái:** kiểm cửa sổ chấm và trạng thái/slot bảo vệ, SEALED khóa phiếu; policy rubric sau seal không được thay tùy ý (`grading.service.ts:754/:878`; `grading.policy.ts:193`).
- **UI/audit:** form từng rubric, nhận xét, PDF, revision/history giống UC22, permission read/write/seal ở backend chứ không chỉ ẩn nút.
- **Phần còn thiếu cả UC:** màn Thư ký ghi biên bản và producer xác nhận Hội đồng/Chủ tịch chưa có trong workflow chính thức; phiếu cá nhân đầy đủ không tự thay attestation. Màn inbox không chứng minh đã đáp ứng thứ tự bảo vệ UC21. F01/F02/F04.
- **Kiểm thử:** unit HTTP/CAS/provenance/role PASS; truy cập hai thành viên độc lập, slot thực, refresh quyền giữa phiên, lock PostgreSQL và chữ ký tập thể runtime NOT VERIFIED.

#### UC24 — tổng hợp/chốt/công bố

- **Nguồn:** reviewer/committee từ SEALED revisions được xác minh theo historical policy/artifact/PDF/assignment; GVHD và council qua ports. Production bind `UnknownAdvisorGradeReader`/`UnknownCouncilResultConfirmationReader` (`grading-workflow.module.ts:28`); cả hai trả UNKNOWN (`advisor-grade.port.ts:18/:37`).
- **Công thức:** QT=(GVHD+GVPB)/2; KTHP=trung bình thành viên; HP=0.4×QT+0.6×KTHP, dùng Prisma.Decimal và rounding explicit (`grading.policy.ts:211`–`:253`). Test `grading.policy.spec.ts:19` xác minh 9,7,[7.5,8,8.5,9] → QT=8, KTHP=8.25, HP=8.15; tests kiểm ngưỡng cả ba và RAW/ROUNDED.
- **Policy:** engine hỗ trợ `UTC_40_60_V1`, `ALL_OFFICIAL_MEMBERS`, HALF_UP và mức decimals explicit; TermParameter phải đủ/hợp lệ/khớp profile, không fallback defaults (`grading-parameters.ts`; tests 18 ca). Đây là khả năng code, không phải Khoa đã phê duyệt. Input configure chỉ nhận NEEDS_APPROVAL (`shared/src/contracts/grading-workflow.ts:89`).
- **State/gates:** aggregate có blocker thì total null, canSeal/canPublish false (`grading.service.ts:1068/:1185/:1227`); result seal và publish tách riêng, source phải fresh, attest đúng tập phiếu/revision/hash; không dựa cờ published cả đợt (`:1319/:1513`).
- **Bảo mật/provenance:** student chỉ own PUBLISHED đã verified; Khoa đúng grant; không lộ raw unsealed result (`:1513/:1615`). Hash được tính lại, cross-check immutable source/actor/envelope, không chỉ tin hash do client gửi (`:255/:354`; `grading-evidence.ts`).
- **UI/history:** preview, blocker, configure windows/rubric, seal/publish/MyResults; chưa nối history policy/result (F07). Backend có history/audit, notification/idempotency transaction; producer/approval thiếu khiến happy path production BLOCKED (F01).
- **Tests:** 40 completion, 18 parameters, cùng service/HTTP/policy/source tests PASS; successful seal/publish dựa TEST ONLY ports/policy. Không dùng test fixtures làm căn cứ phê duyệt nghiệp vụ hay seed production.

#### UC25 — xuất dữ liệu và biên bản

- **Nguồn:** summary/Excel lịch và phản biện lấy official chain; RESULTS chỉ xuất PUBLISHED verified, theo artifact Hội đồng lúc công bố, không relabel bằng roster mới (`official-report.service.ts:168/:194/:216`). Mã SV/lớp/scope vẫn lấy catalog hiện hành; tên/đề tài/điểm lấy snapshot. Không khẳng định đây là bản lưu trữ hành chính hoàn chỉnh.
- **Quyền:** `official-report:read/export` và academic scope; RESULTS còn yêu cầu grading:read-results; kiểm quyền trước lỗi mẫu. Frontend chỉ FACULTY, backend permission là authority thực (`official-report.controller.ts:37/:47`, service `:176`).
- **Định dạng:** ExcelJS sinh workbook, neutralize formula-leading text, giữ number; PDFKit font tiếng Việt và nhãn “bản tra cứu” (`service.ts:30/:48/:72`). PDF khác RESULTS trả REPORT_TEMPLATE_NOT_CONFIGURED (`:180`); không giả lập biên bản có chữ ký.
- **UI:** summary, filter, download Blob; decode JSON error 403/409/422/503, giữ cơ chế refresh 401, không tải JSON thành PDF (`frontend/.../grading/workflow/api.ts:37`; `pages.tsx:685/:760`). Disable PDF lịch/phản biện, thông báo mẫu chưa mở.
- **Audit/tests:** export audit trong transaction; unit 17 ca kiểm nội dung XLSX/PDF, scope/no-data, provenance, dữ liệu riêng tư. Chưa E2E download với JWT thật, layout/print/chữ ký mẫu Khoa, export dataset lớn. Kết quả mới còn phụ thuộc F01; toàn bộ mẫu ký BLOCKED bởi F02.

### Backend và bảo mật xuyên suốt

| Kiểm tra | Kết luận theo code/test mới | Evidence |
|---|---|---|
| JWT / password-change / session | Có global guard, xác minh JWT rồi user/session/revocation; không chỉ tin role client | `backend/src/app.module.ts:50`; `common/security/jwt-auth.guard.ts:27` |
| Permission | Global PermissionsGuard + service recheck; role ADMIN không thay quyền nghiệp vụ | `common/security/permissions.guard.ts:38`; `grading.service.ts:215`; `defense-workflow.service.ts:111` |
| Term/object scope | AcademicTermGrant ở lệnh Khoa, ownership SV, advisor hiện hành, reviewer/member chính thức | `grading.service.ts:236/:503/:1513`; `defense-confirmation-read.validator.ts:46/:77` |
| DTO | Class validation ở global pipeline, Zod strict ở command contracts, query/path validation | `backend/src/main.ts:30`; `shared/src/contracts/defense-workflow.ts:49`; `shared/src/contracts/grading-workflow.ts:89` |
| Transaction/concurrency | Parent/row/advisory locks, revision CAS, context hash, idempotency; read RepeatableRead, write ReadCommitted có lock, không gọi nhầm là mọi transaction Serializable | `defense-workflow.repository.ts:35/:79/:210`; `grading.repository.ts:34/:98`; `defense-workflow.service.ts:671` |
| SQL integrity | Composite FK/pointer, unique owner/revision, envelope CHECK và trigger append-only có trong migration; **SQL NOT EXECUTED** | `backend/prisma/migrations/202610280002_grading_workflows/migration.sql:39/:59/:99/:109`; `202610280001_official_defense_workflows/migration.sql:55/:92/:98` |
| Private PDF/export | Quan hệ đúng, identity/checksum, không expose storage path, private/no-store và CSP cho binary; test forbidden/out-of-scope | `final-report.controller.ts:158`; `grading.controller.ts:163`; `official-report.controller.ts:46`; `official-report.spec.ts` |
| Audit / history | Command ghi cùng transaction và giữ immutable revisions; frontend chưa hiển thị hết history | `defense-confirmation-command.service.ts:241/:266`; `grading.service.ts:947/:965/:1449/:1467`; F07 |
| Publish / template | Không có bypass đủ phiếu ⇒ tự publish; thiếu advisor/council/policy chặn; không sinh biên bản ký giả | `grading.service.ts:1351`; `official-report.service.ts:180` |

**Ba endpoint legacy:** các suite `grading/controller/score.controller.spec.ts`, `defense/controller/committee.controller.spec.ts`, `report/controller/export.controller.spec.ts` đều **10 test PASS mỗi suite** trong lần chạy 1.320 test. Thực hiện HTTP qua controller/guard thật với repository auth và business giả; anonymous/invalid JWT 401, valid active authenticated STUDENT/LECTURER/COMMITTEE/FACULTY/ADMIN 403, không gọi business reader/delegate. Controller tương ứng luôn throw Forbidden (`score.controller.ts:7`, `committee.controller.ts:7`, `export.controller.ts:7`) và không inject service đọc dữ liệu.

**Lưu ý chính xác cho yêu cầu “không gọi database”:** lượt audit không kết nối DB. Handler legacy không query **dữ liệu nghiệp vụ**. Nhưng ở production, valid JWT vẫn khiến global guard đọc user/session (`jwt-auth.guard.ts:39`), nên không thể tuyên bố toàn bộ request authenticated có **zero database calls**. Nếu tiêu chí được hiểu theo nghĩa tuyệt đối, hiện trạng **không đáp ứng**; cần thống nhất tiêu chí, không bỏ kiểm session để đạt một assertion hình thức.

## D. Phát hiện và đề xuất (không triển khai)

### F01 — HIGH — UC24 BLOCKED bởi producer/approval còn thiếu

- **Bằng chứng:** `grading-workflow.module.ts:28`, `advisor-grade.port.ts:18/:37`, `shared/src/contracts/grading-workflow.ts:89`, `grading.service.ts:1147/:1167/:1351`.
- **Ảnh hưởng:** không có đường ghi/đọc điểm GVHD cuối và xác nhận Hội đồng authoritative để mở chốt/công bố. Nhận xét/điểm phase UC16 hoặc ScoreEntry legacy không thay thế. UI có nút không có nghĩa happy path dùng được.
- **Đề xuất:** duyệt nguồn điểm, thẩm quyền attestation và calculation policy; thiết kế producer có revision/hash/actor/time/ràng buộc PDF/phân công; nối ports sau khi kiểm chứng. Không hard-code VERIFIED hay lấy fixture làm official.
- **Chặn nghiệm thu:** có, UC24; phần điểm GVHD cuối UC17, xác nhận tập thể UC23, kết quả mới UC25.

### F02 — HIGH — UC25 chưa có biên bản ký/chữ ký theo mẫu chuẩn

- **Bằng chứng:** `official-report.service.ts:72/:180`; query kinds `:14`; `frontend/src/features/grading/workflow/pages.tsx:760`. DOCX đoạn 1692 và 1736.
- **Ảnh hưởng:** PDF RESULTS là tra cứu, không phải bảng điểm/biên bản để thành viên đồng ký; PDF lịch/phản biện chủ động bị chặn. Không có producer biên bản chính thức/chữ ký trong API được rà soát.
- **Đề xuất:** Khoa cung cấp template/version, thành phần ký, thẩm quyền và nguồn dữ liệu; thiết kế luồng biên bản/attestation gắn artifact và tests nội dung/PII/print.
- **Chặn nghiệm thu:** có, đầu ra Bước 10; không chặn demo Excel phân công/lịch nếu có official data.

### F03 — HIGH — Chưa áp dụng quy tắc loại GVPB cùng Hội đồng với GVHD

- **Bằng chứng:** Markdown spec `:29`; `defense-planning.policy.ts:237` chỉ so sánh chính GVHD; `defense-workflow.service.ts:631` gợi ý cũng chỉ loại người đó; `defense-workflow.policy.ts:259/:303` official gọi cùng validator và chỉ bổ sung cardinality/coverage. Probe P1 ở C1, GVHD A ở C2, phản biện E cũng ở C2 trả `issues: []`, official ACCEPTED (phụ lục F).
- **Ảnh hưởng:** phương án không đáp ứng quy tắc khách quan rộng trong Markdown vẫn có thể vượt kiểm tra official. Đây là thiếu business constraint, không bằng chứng bypass JWT.
- **Đề xuất:** thống nhất Markdown với DOCX đoạn 1626. Nếu giữ quy tắc rộng, lập tập thành viên tất cả HĐ có GVHD và loại khi gợi ý, preview, finalize, read nguồn grading; thêm ca nhiều HĐ/không còn candidate. Không tự nới đặc tả.
- **Chặn nghiệm thu:** có đối với quy tắc Markdown được yêu cầu; cần quyết định nguồn đặc tả ưu tiên nếu nhóm định áp dụng phạm vi hẹp.

### F04 — HIGH — Thiếu auto alphabet theo buổi trong workflow lịch thật

- **Bằng chứng:** `planning/pages.tsx:479`, `defense-planning.policy.ts:472` ghi không tự áp dụng alphabet; slot contract trong `shared/src/contracts/defense-planning.ts`; auto chỉ ở demo `defense-service.ts:578`. Probe official nhận Bảo trước An cùng buổi. DOCX đoạn 1648 cho phép điều chỉnh tay và ghi cần xác nhận alphabet.
- **Ảnh hưởng:** không có chức năng tự lập thứ tự được nêu trong yêu cầu; không được demo auto ở local rồi nói backend đã hỗ trợ.
- **Đề xuất:** chốt quy tắc tên Việt/trùng tên/buổi/timezone/override; thêm auto-order API và UI preview rõ, revision/audit khi áp dụng. Không biến mọi chỉnh tay khác alphabet thành lỗi khi quy chế chưa yêu cầu.
- **Chặn nghiệm thu:** có với yêu cầu auto-order hiện tại; nếu Khoa chưa duyệt áp dụng thì đánh dấu BLOCKED policy, không IMPLEMENTED.

### F05 — HIGH — Cấu hình mixed mode có thể trình bày điểm demo như dữ liệu thật

- **Bằng chứng:** `frontend/.env.example:3/:20` mặc định auth true, grading false; `grading/workflow/api.ts:19` trả DEMO chỉ vì grading flag khác true; `routes.tsx:651` render DemoScoreEntry/Result; `WorkspaceLayout.tsx:164` chỉ hiện demo controls khi **không** AUTH_API. `ScoreEntryPage.tsx:222` và `ResultPage.tsx:100` không có cảnh báo DEMO tương ứng UC19–21. `frontend/src/shared/data/store.ts:25/:38/:97` trộn session API vào snapshot local rồi persist demo; `grading/services/grading-service.ts:90` chỉ mutate local.
- **Ảnh hưởng:** người dùng đăng nhập thật có thể vào một trang điểm/chốt/export local và hiểu nhầm đã ghi backend; tùy snapshot/grant có thể không có dữ liệu để thao tác. Không có bằng chứng ghi demo vào PostgreSQL hoặc backend tự fallback mock.
- **Đề xuất:** chế độ auth thật + feature chưa bật nên đóng chức năng/hiện banner bắt buộc; chỉ cho demo khi bật demo rõ ràng. Test matrix flag thiếu/false/true, auth true/false, cache cũ và token thật. Không sửa flags trong audit.
- **Chặn nghiệm thu:** có cho môi trường có mixed flags; full API mode của UC17–25 không tự mắc nhánh này. Browser reproduction mixed mode **NOT VERIFIED**, kết luận dựa đường đi code.

### F06 — MEDIUM — UC19 chưa tự tính số Hội đồng/cân tải theo Hội đồng

- **Bằng chứng:** DOCX đoạn 1604; `planning/pages.tsx:100` form nhập tay, `workflow.policy.ts:279` kiểm size/capacity nhưng không tính phân bổ; workload/suggestions trong `workflow.service.ts:610` là theo GVPB, không theo HĐ.
- **Ảnh hưởng:** cần thao tác thủ công; lệch tải HĐ không có bộ đề xuất/đo cân bằng tương ứng. Manual allocation được DOCX cho phép nên không gọi mọi phương án lệch tải là invalid.
- **Đề xuất:** duyệt metric/tolerance, bổ sung đề xuất cân tải và số HĐ; kiểm quyền, conflict, preview và audit như workflow hiện có.
- **Chặn nghiệm thu:** phần tự động/cân tải; không chặn luồng tạo/chốt HĐ thủ công hợp lệ.

### F07 — MEDIUM — UI chưa tích hợp history policy và kết quả

- **Bằng chứng:** `grading.controller.ts:70/:243`, `grading.service.ts:1570/:1665`; frontend adapter chỉ history phiếu ở `api.ts:150`; `pages.tsx:613/:634` không gọi history policy/result.
- **Ảnh hưởng:** Khoa không xem qua UI ai/thời điểm/revision của thay đổi chính sách hoặc kết quả, dù backend có dữ liệu.
- **Đề xuất:** thêm adapter và màn history read-only có pagination/integrity, giữ permission/scope; không dùng audit demo thay lịch sử official.
- **Chặn nghiệm thu:** phần truy vết bằng UI; không phải backend mất audit.

### F08 — MEDIUM — Tiêu chí legacy “zero DB” cần phân biệt auth và dữ liệu nghiệp vụ

- **Bằng chứng:** `jwt-auth.guard.ts:39` đọc account/session; legacy controllers throw trước business service; ba test suite dùng auth mocks.
- **Ảnh hưởng:** 401/403 và zero **business** reads đã kiểm chứng; zero toàn bộ database calls của request valid JWT không đúng hiện trạng.
- **Đề xuất:** làm rõ acceptance contract “không truy vấn điểm/hội đồng/thống kê”. Nếu thực sự đòi zero auth DB, cần thiết kế bảo mật riêng được phê duyệt; không bỏ revocation/session checks trong bản vá nhỏ.
- **Chặn nghiệm thu:** chỉ khi yêu cầu zero DB được áp dụng tuyệt đối; không phải phát hiện rò rỉ dữ liệu.

### F09 — MEDIUM — Ngoại lệ UC18 liên đợt chưa có bằng chứng hoàn thiện

- **Bằng chứng:** DOCX đoạn 1584 yêu cầu liên kết hồ sơ bảo lưu cũ/kiểm điều kiện mới. `academicEvidenceCommandSchema` (`shared/src/contracts/defense-workflow.ts:59`) có verdict SPECIAL/sourceReference/note, không có command liên kết hồ sơ trước; controller workflow `:72` chỉ ghi evidence, service `:851` append evidence.
- **Ảnh hưởng:** chưa thể nghiệm thu ngoại lệ bảo lưu quay lại/phản biện chưa bảo vệ chỉ từ panel nhập evidence.
- **Đề xuất:** xác định hồ sơ nguồn và quyền chuyển/đối chiếu, mapping trạng thái và test acceptance riêng. Không tự chuyển SPECIAL thành đạt hoặc tự thêm policy.
- **Chặn nghiệm thu:** các ngoại lệ này; lõi xét điều kiện/chốt đúng evidence đã có code.

### F10 — NOT VERIFIED — Thiếu kiểm chứng browser/SQL thực của lượt audit

- **Bằng chứng:** Playwright khởi động exit 1 với thông báo cổng 5173 bận, chưa có test chạy; PostgreSQL integration/E2E thật bị loại theo yêu cầu. Vitest backend config `backend/vitest.config.ts:5` tách integration specs.
- **Ảnh hưởng:** chưa có bằng chứng constraint/trigger thực thi, lock/deadlock, round-trip JSONB, file storage/DB atomicity, RBAC grants thật hoặc quy trình nhập→chốt→công bố→download qua browser thật.
- **Đề xuất:** chạy mock browser khi có cổng dành riêng; sau đó một nhiệm vụ riêng được phép dùng DB cô lập, có kiểm tra identity/backup và dữ liệu thử. Không chạy bước này trong audit.
- **Chặn nghiệm thu:** có cho tuyên bố production/end-to-end; không phủ nhận các unit/type/build PASS hiện tại.

## E. Quyết định nghiệp vụ cần nhóm/Khoa xác nhận

1. **Nguồn GVHD cuối:** ledger riêng hay tái sử dụng đánh giá UC16; ràng buộc PDF/phân công, ai chốt, thời điểm có hiệu lực. Không lấy điểm phase/legacy làm nguồn mặc định (F01).
2. **Calculation/quorum:** số thành viên thực chấm/vắng/phiếu trắng; HALF_UP hay cách khác, precision trung gian/cuối, RAW/ROUNDED khi xét đạt; trọng số/ngưỡng theo đợt. Profile trong test chỉ là ứng viên, không là quy chế đã duyệt (`shared/.../grading-workflow.ts:44`).
3. **Attestation/amendment:** một hay nhiều người ký, Chủ tịch/Thư ký và delegation, sửa sau seal/publish, lý do/deadline/thông báo/republication. Phiếu SEALED không tự chứng minh Hội đồng đã xác nhận.
4. **UC19–21:** phạm vi xung đột theo GVHD hay cả HĐ chứa GVHD; cân tải HĐ/GVPB; cách tách tên, dấu tiếng Việt/tie-break, sáng/chiều/timezone và quyền điều chỉnh thứ tự. Giải quyết mâu thuẫn/điều kiện trong Markdown và DOCX trước khi coi code là compliant.
5. **UC18/UC25:** hồ sơ bảo lưu liên đợt và ngoại lệ; mẫu biên bản/bảng điểm/phiếu nhận xét, trường PII/chữ ký/dấu, dữ liệu lịch sử hay catalog hiện hành, quyền đọc chéo phiếu và quyền xuất trước công bố.

Không cần một quyết định nghiệp vụ mới để sửa nhãn demo (F05) hoặc nối history read-only đã có quyền (F07); đây là thiếu sót tích hợp/kỹ thuật.

## F. Kết quả kiểm thử mới

Tất cả lệnh chạy tại repository hiện tại; không chạy AppModule với PostgreSQL. Các test HTTP khởi tạo Nest test application với fake repositories và cổng ngẫu nhiên. Không gọi server 3000/5173 có sẵn để đo chức năng.

| Nhóm | Lệnh (cwd nếu khác root) | Kết quả mới | Phạm vi/giới hạn |
|---|---|---|---|
| Type-check | `pnpm -r type-check` | **PASS**, exit 0 | Frontend tsc --noEmit; backend build shared rồi tsc --noEmit |
| Shared type-check | `pnpm --filter @doan/shared exec tsc --noEmit` | **PASS**, exit 0 | Shared không có script type-check riêng nên gọi tsc rõ ràng |
| Lint | `pnpm -r lint` | **PASS**, exit 0 | Backend/frontend; shared không có lint script |
| Backend unit/HTTP mock | `$env:GPMS_INTEGRATION='0'; pnpm --filter @doan/backend test` | **PASS**, 83 file / 1.320 test, 79.48 s | Integration specs bị exclude; không có PostgreSQL client thật trong các test chọn |
| Frontend unit | `pnpm --filter @doan/frontend test` | **PASS**, 37 file / 386 test, 29.54 s | Vitest node + SSR/mocks; không phải browser rendering/click đầy đủ |
| Build | `pnpm build` | **PASS**, exit 0 | Shared tsc, backend nest build, frontend tsc + Vite (2.206 modules) |
| Prisma schema | Tại backend: `$env:DATABASE_URL='postgresql://audit:unused@127.0.0.1:1/audit_offline'; $env:DIRECT_URL=$env:DATABASE_URL; pnpm exec prisma validate --schema prisma/schema.prisma` | **PASS**, schema valid | Chỉ validate schema offline; URL dummy ghi đè process env; không migrate/introspect/connect |
| Browser test type-check | `pnpm --filter @doan/frontend test:e2e:type-check` | **PASS**, exit 0 | Chỉ TypeScript |
| Playwright API mock | Tại frontend: `node scripts/test-browser.cjs api --reporter=list --output=test-results/audit-20261029-api` | **BLOCKED**, runner exit 1, **0 test chạy** | `http://127.0.0.1:5173 is already used`; giữ `reuseExistingServer:false` |
| Playwright demo | Không chạy sau lỗi cổng cùng config | **SKIPPED/BLOCKED** | Không reuse server, không sửa config/cổng hoặc dừng process người dùng |
| PostgreSQL integration | Không chạy | **SKIPPED theo yêu cầu** | FK/CHECK/trigger/replay/concurrency thật NOT VERIFIED |
| E2E thật | Không chạy | **SKIPPED theo yêu cầu** | Không login thật/upload/chốt/publish/export qua DB |
| Probe chính sách thuần hàm | `node` đọc module `backend/dist/defense/...` vừa build; đoạn tái hiện dưới đây | **2 khoảng trống tái hiện được** | Không bootstrap Nest/Prisma; chỉ gọi validators, không kết nối DB |

Warning không làm fail: Vite CJS API deprecated; useLayoutEffect trong frontend SSR tests; một warning cleanup cố ý ở service test; frontend bundle lớn hơn 500 kB (index khoảng 591 kB, exceljs khoảng 939 kB). Build PASS không chứng minh bundle đã tối ưu hiệu năng.

### Browser isolation đã đọc trước khi chạy

`frontend/scripts/start-browser-vite.cjs:24` thêm middleware trả 503 cho `/api` trước Vite proxy. `frontend/e2e/browser/fixtures.ts:33` chặn external origin, mock từng API, fail nếu unmocked; `frontend/playwright.config.ts:6` chỉ api/demo và `:52` không reuse unknown server. Vì port busy, các test isolation assertion chưa được thực thi trong lần này.

### Probe tái hiện F03/F04 (không phải test mới ghi vào source)

Chạy từ `backend` sau build. Có thể truyền đoạn này cho `node` bằng stdin; không gọi backend HTTP/DB:

```js
const { checkReviewers } = require('./dist/defense/planning/defense-planning.policy');
const { validateOfficialPlan } = require('./dist/defense/workflow/defense-workflow.policy');
const members = ids => ids.map((lecturerId, i) => ({
  lecturerId, role: ['CHAIR', 'SECRETARY', 'MEMBER'][i],
}));
const committees = [
  { key: 'C1', name: 'Council 1', members: members(['B','C','D']), proposalIds: ['P1'], maxStudents: 10 },
  { key: 'C2', name: 'Council 2', members: members(['A','E','F']), proposalIds: ['P2'], maxStudents: 10 },
];
const facts = {
  term: { startsAt: '2026-01-01T00:00:00.000Z', endsAt: '2027-01-01T00:00:00.000Z' },
  source: { kind: 'UC18_FINALIZED' },
  students: [
    { proposalId: 'P1', studentId: 'S1', name: 'Tran Bao', admitted: true, advisor: { id: 'A' }, evidence: 'VERIFIED' },
    { proposalId: 'P2', studentId: 'S2', name: 'Le An', admitted: true, advisor: { id: 'B' }, evidence: 'VERIFIED' },
  ],
  lecturers: ['A','B','C','D','E','F'].map(id => ({ id })),
  rooms: [{ id: 'R1', capacity: 20 }],
};
const policy = { committeeSize: 3, committeeCapacity: 10 };
const reviewers = [
  { proposalId: 'P1', reviewerIds: ['E'] },
  { proposalId: 'P2', reviewerIds: ['C'] },
];
console.log(checkReviewers(facts, committees, reviewers).issues); // thực tế: []
validateOfficialPlan('REVIEWERS', facts, policy, committees, reviewers, []);
// thực tế: không throw; P1 có GVHD A và GVPB E cùng C2.
const sameCouncil = [{ key: 'C1', name: 'Council', members: members(['C','D','E']), proposalIds: ['P1','P2'], maxStudents: 10 }];
const slots = [
  { key:'T1', committeeKey:'C1', proposalId:'P1', roomId:'R1', startsAt:'2026-10-29T01:00:00.000Z', endsAt:'2026-10-29T01:30:00.000Z' },
  { key:'T2', committeeKey:'C1', proposalId:'P2', roomId:'R1', startsAt:'2026-10-29T01:30:00.000Z', endsAt:'2026-10-29T02:00:00.000Z' },
];
validateOfficialPlan('SCHEDULE', facts, policy, sameCouncil,
  [{proposalId:'P1',reviewerIds:['F']},{proposalId:'P2',reviewerIds:['F']}], slots);
// thực tế: không throw; cùng buổi sáng +07, Bao trước An, không tự sắp.
```

Probe gọi validator sau bước parse nên object facts/policy chỉ chứa field hàm này dùng; đây không phải payload gửi thẳng API hay bằng chứng đã ghi một record invalid vào DB. Ý nghĩa là thiếu kiểm tra/khả năng trong validator chính thức, đối chiếu thêm source của command gọi nó.

## G. Kế hoạch xử lý theo phụ thuộc — chưa triển khai

| Ưu tiên | Công việc | Phụ thuộc / tiêu chí hoàn tất |
|---|---|---|
| 1 | Loại nhầm demo trong auth API (F05); giữ nhãn rõ, test matrix flags | Không cần DB; mock browser khi có cổng riêng; không làm thay đổi contract nghiệp vụ |
| 2 | Chốt quy tắc xung đột UC20 rồi sửa candidate/validator/source checks (F03) | Khoa xác nhận tài liệu ưu tiên; test peer-of-advisor, nhiều HĐ, hết candidate, không bypass finalize |
| 3 | Duyệt và làm producer điểm GVHD + attestation + approval policy (F01) | Quyết định E1–E3, model/permission/migration nếu cần phải được yêu cầu ở nhiệm vụ triển khai riêng; test provenance và publication |
| 4 | Hoàn thiện scheduling/balance/ngoại lệ UC18 (F04/F06/F09) | Chốt policy E4–E5; API preview + apply/CAS/history; test tiếng Việt/slots/bảo lưu |
| 5 | Mẫu ký/biên bản và history UI (F02/F07) | Template/authority được duyệt; API export chỉ dữ liệu hợp lệ; tests nội dung/font/PII và phân quyền |
| 6 | Xác nhận acceptance legacy (F08), rồi kiểm chứng SQL/E2E (F10) | Nhiệm vụ riêng cho phép DB cô lập; chạy migrations/constraint/rollback/lock/race có kiểm soát; không thực hiện ở audit này |

### Kết luận trả lời bảy câu hỏi

1. **UC nào có thể demo?** Ở mức code: PDF/xác nhận UC17, xét/chốt UC18, lập/chốt thủ công UC19–21, phiếu cá nhân UC22–23 và export phân công/lịch UC25 có luồng API để chuẩn bị demo sau khi có database/permission/evidence hợp lệ. UC24 hiện chỉ có thể demo blocker hoặc fixture test, không demo publish production hoàn chỉnh. Trong lượt này **không xác nhận một demo browser thật nào**, vì cổng bận và DB bị cấm. Demo local có thêm chức năng không đồng nghĩa API thật có (F04/F05).
2. **UC nào hoàn thiện ở mức code?** Phần lõi quyết định/PDF UC17, xét/chốt thường UC18 và phiếu cá nhân UC22/23 có implementation và unit bằng chứng tốt. UC22 gần đầy đủ nhất trong phạm vi nhập/chốt phiếu; chưa khẳng định mọi ngoại lệ/sửa muộn. Không có căn cứ gắn “hoàn thiện toàn bộ” cho UC17–25 theo đầy đủ yêu cầu người dùng.
3. **UC nào chưa thể nghiệm thu?** Toàn chuỗi chưa nghiệm thu runtime. Riêng UC24 bị chặn chắc chắn ở production; UC25 mẫu ký thiếu; UC20/21 còn khoảng trống đặc tả; UC17 điểm GVHD cuối, UC23 attestation/biên bản, UC18 ngoại lệ, UC19 phần tự động còn thiếu/phụ thuộc quyết định.
4. **Frontend đã tích hợp đầy đủ backend chưa?** Chưa. Các command chính có API adapter và UI thật; còn history policy/result chưa nối, producer/approval/biên bản chưa có, và mixed-mode demo cần xử lý. Không phát hiện endpoint/payload sai trong các đường chính đã đối chiếu; giới hạn này không thay browser E2E.
5. **Có mất chức năng sau merge không?** Không thấy xóa workflow/API UC17–25 trong diff `a1031d3^1..a1031d3` ở backend defense/grading/report/confirmation/final-report; frontend các feature trên chủ yếu đổi wrapper shell/role nav. Route canonical còn, legacy scores redirect. Những thiếu sót backend F01–F04 không do merge UI tạo ra vì các file đó không đổi. Không thể khẳng định không có mọi regression runtime khi browser chưa chạy.
6. **Có lỗi bảo mật hoặc sai công thức?** Không thấy sai hệ số QT/HP ở engine chính thức, test mẫu 8.15 PASS; không thấy bypass JWT/scope/publish được chứng minh. Có thiếu business conflict F03, nguy cơ nhầm dữ liệu F05, và khác biệt tiêu chí zero-DB F08. Rounding/quorum/authority chưa được phê duyệt, không tự coi fixture là quy chế.
7. **Năm việc quan trọng nhất tiếp theo:** (i) F05 phân biệt demo/API; (ii) F03 quy tắc phản biện; (iii) F01 nguồn GVHD/attestation/approval; (iv) F04 lập thứ tự lịch theo quy tắc được duyệt; (v) F02 biên bản ký chính thức. Kiểm chứng DB/E2E sau đó là điều kiện bắt buộc để nghiệm thu, không phải một PASS suy ra từ unit.

**Phạm vi bàn giao:** báo cáo audit, không bản sửa triển khai. Không commit/push/merge/switch/reset, không sửa source/schema/config/seed, không kết nối hoặc tác động PostgreSQL trong lượt này.
