# BƯỚC 8A — Kế hoạch hướng dẫn và nhiệm vụ

Ngày 22/10/2026, Asia/Ho_Chi_Minh. Đã triển khai backend/frontend, migration additive và kiểm thử trên PostgreSQL test riêng. **Không kết nối/chạy DDL lên Supabase chung; không stage/commit/push.**

## 1. Phạm vi và căn cứ

Đối chiếu baseline PR1 `01-business-decisions-and-contract.md` §3, §4.5–§4.9, §5–§7; audit 00, kế hoạch migration 02, hướng dẫn nhóm 03, test plan 04, báo cáo bước 7, ADR đồ án cá nhân và nội dung UC14/UC15 trong DOCX working tree. Không sửa DOCX hoặc các quyết định nghiệp vụ đã duyệt.

Phạm vi là kế hoạch, nhiệm vụ, tiến độ dạng ghi chú và nghĩa vụ báo cáo tuần độc lập task. Không làm upload, nộp bài, chấm/đánh giá, họp, thông báo/email, final report, điều kiện bảo vệ hoặc điểm. Các trạng thái SUBMITTED/REVISION_REQUESTED/COMPLETED vẫn được đọc nếu có từ producer khác; bước 8A không cung cấp command để tạo bài nộp hoặc tự chuyển COMPLETED.

Yêu cầu “SV/nhóm” được thực hiện theo **baseline cá nhân đã duyệt**: một TermStudent/Proposal/GuidancePlan, không thêm ProjectGroup hoặc chia sẻ ownership giữa nhiều SV.

## 2. Luồng kế hoạch và quyền

- Chỉ LECTURER có action permission và là **GVHD chính thức hiện hành** của SV mới tạo/sửa kế hoạch và giao/sửa/hủy nhiệm vụ. AssignmentPlan phải FINALIZED và đúng official pointer của đợt; roster, assignment history, Topic agreement/revision phải hợp lệ. PUBLISHED, membership nhóm duyệt hoặc claim role trong JWT không tự cấp quyền.
- Tạo plan cần Proposal APPROVED, dossier FINALIZED hoặc RECEIVED với current finalization hợp lệ, approved SEALED version/pointers/hash và snapshot in khớp cùng SV/content/topicRevision. Không đòi RECEIVED trước khi bắt đầu hướng dẫn. Snapshot thiếu/legacy hoặc đề tài đổi sau chốt thì chặn, không tự reconcile.
- Phase GUIDANCE phải được cấu hình, trong khoảng thời gian đợt, đang mở và chưa khóa; term IN_PROGRESS. Thiếu phase/mapping trả INPUT_NOT_READY. Tất cả mutation kiểm phase lại trong transaction, không tự mở hoặc gia hạn.
- Tạo một plan ACTIVE/proposal, lưu finalizationId + assignmentId + assignmentRevision; liên kết các obligation đã được producer cấu hình cho owner, không tự tạo nghĩa vụ/tuần.
- Sửa mô tả có revision/reason/history/audit. Plan PAUSED chỉ được GVHD hiện hành resume sau khi Topic agreement hợp lệ và acknowledgeRebase=true, đúng bản chốt/dossier revision. Cập nhật pointer/revision và giữ mọi task/bài cũ. ARCHIVED chỉ đọc; bước này không có command tự archive theo cron.
- Khi handover/reopen chưa được producer xử lý đủ, mutation fail PLAN_PAUSED/REBASE_REQUIRED/DOSSIER_NOT_FINALIZED/TOPIC_NOT_AGREED. Không triển khai endpoint bàn giao GVHD hoặc mở khóa dossier của bước 1–3/7 trong feature này.

| Chủ thể | Đọc kế hoạch/nhiệm vụ | Tạo/sửa/hủy nhiệm vụ | Ghi tiến độ | Materialize task tuần |
|---|---|---|---|---|
| FACULTY | grant đúng đợt/bộ môn, có tổng hợp theo đợt | không | không | không |
| GVHD hiện hành | phân công chính thức + roster + permission | phase/plan/finalization hợp lệ | không ghi thay SV | được khi cấu hình nghĩa vụ hợp lệ |
| STUDENT | đúng TermStudent owner + permission | không | append note/start trong state cho phép | chỉ nghĩa vụ của mình theo cấu hình đã duyệt |
| Reviewer chỉ có membership | không tự có quyền guidance | không | không | không |
| ADMIN-only | không tự có quyền học thuật, kể cả có action permission | không | không | không |

## 3. Task, tiến độ và thời gian

- AD_HOC mới luôn TODO, gắn plan → Proposal/TermStudent/đợt, periodId cùng đợt, createdByUserId và assignedAdvisorId tại thời điểm giao. GVHD hiện hành tiếp quản quyền sau rebase; tác giả/GVHD lịch sử không bị ghi đè.
- API có title, description, expectedDeliverables, startDate, dueDate, status. `startDate` map TaskWorkflow.startsAt; `dueDate` map Task.deadline hiện hữu; status chuẩn là TaskWorkflow.state.
- Title/sản phẩm bắt buộc; chuỗi ngày giờ ISO có timezone, startDate < dueDate, startDate >= phase.startDate và dueDate < phase.endDate. Dữ liệu là thời điểm tuyệt đối; UI nhập/hiển thị Asia/Ho_Chi_Minh (UTC+7), không phụ thuộc timezone Windows. Không tự tính tuần ISO hoặc đặt deadline mặc định.
- Mốc bắt buộc thuộc cùng đợt. Baseline chỉ bắt buộc deadline trong phase; không tự thêm quy tắc mọi AD_HOC phải nằm hoàn toàn trong khoảng tuần được gắn, hoặc cấm tạo nhiệm vụ có deadline đã qua khi phase còn mở.
- `isOverdue = now > dueDate` và task chưa COMPLETED/CANCELLED, không đổi workflow thành OVERDUE và không tự hoàn thành. Đúng thời điểm dueDate chưa quá hạn. Quá hạn vẫn cho ghi tiến độ nếu phase/state cho phép.
- SV ghi note qua TaskProgressEvent append-only; TODO→IN_PROGRESS, IN_PROGRESS/REVISION_REQUESTED giữ state. Không nhận percentComplete/status/score/actor từ client; không có thao tác tự xác nhận hoàn thành. Note không thay thế báo cáo tuần.
- Sửa nhiệm vụ cần expectedRevision/reason; giữ periodId sau tạo theo contract PR1. Có bài cũ thì phải acknowledgeExistingSubmissions; không sửa bài hoặc deadlineSnapshot/isLate cũ. Task COMPLETED/CANCELLED chỉ đọc trong phạm vi 8A; amendment kết quả thuộc phần đánh giá sau này.
- Hủy cần reason và acknowledge khi có bài; giữ dữ liệu/history. Hủy task tuần không xóa nghĩa vụ và không miễn báo cáo. Các thao tác không có hard-delete.
- Giữ enum TaskStatus legacy nguyên vẹn; task mới mirror TODO/IN_PROGRESS vào field cũ khi tương ứng. CANCELLED/COMPLETED không bị giả map sang REVIEWED. Consumer mới phải dùng TaskWorkflow.state/DTO mới; không dùng legacy Task.status làm nguồn trạng thái học thuật.

## 4. Tuần bắt buộc và đầu vào producer

GET coverage xuất phát từ GuidancePeriod(WEEK) + PeriodRequiredStudent, không đếm riêng Task. Có hàng MISSING/NOT_DUE khi chưa plan/task; thiếu obligation record hoặc lịch/applicability/deadline/config snapshot thì coverageState=NOT_CONFIGURED, không tuyên bố “không thiếu báo cáo”. Read không tạo dữ liệu.

Một obligation đã có cấu hình hợp lệ có thể được SV hoặc GVHD materialize bằng command explicit, có revision/idempotency. Materialization tạo TODO, giữ đúng ngày/sản phẩm của cấu hình; không tạo TaskSubmission hoặc xác nhận SV đã hoàn thành. Một active task/obligation được bảo vệ bởi partial unique PR2B. Cancel làm thiếu current task; materialize bản thay thế mới giữ task cũ CANCELLED.

Contract JSON đầu vào `WeeklyObligationConfigSchema` được chuẩn hóa trong shared, **producer phải cung cấp từ dữ liệu đã xác nhận**, không có endpoint Khoa tự sửa lịch trong 8A:

```typescript
{
  schemaVersion: 1,
  termId, periodId, termStudentId,
  periodRevision,
  startsAt, reportDueAt, // ISO có timezone, khớp đúng GuidancePeriod
  expectedDeliverables // mô tả sản phẩm thực tế đã cấu hình
}
```

WeeklyReportObligation.configRevision phải bằng GuidancePeriod.revision; owner/term/period/dates của configSnapshot phải khớp. Snapshot legacy không đủ schema trả REPORTING_SCOPE_NOT_CONFIGURED, không diễn giải `{fixture:true}` hoặc suy sản phẩm từ task cũ.

Task tuần lưu metadata REPORT+SOURCE bắt buộc theo baseline D10/D11. Không chọn extension/MIME/size/retention. AD_HOC lưu expectedDeliverables dạng mô tả; requirements file chưa cấu hình là NULL, **không đồng nghĩa miễn file hoặc đã có policy upload**. Bước 8B phải chốt contract file trước khi cho nộp. Coverage đọc SubmissionWorkflow hiện hành nếu producer nộp bài sau này có; 8A không tạo/đánh giá bài nộp.

Người phụ trách bước 1–3 tiếp tục cung cấp/duyệt phase GUIDANCE, GuidancePeriod, PeriodRequiredStudent, config snapshot/obligation và các command đổi lịch/khóa phase/handover theo term lock protocol. Không có seed/tuần/ngày học vụ thật được agent tự điền.

## 5. API

Base `/api`; JSON success/error theo module bước 4–7. Strict Zod runtime ở frontend/controller, Swagger cho endpoints/body/header. ID opaque, actor server. Mutation có Idempotency-Key, revision; POST tạo 201, PATCH/command 200.

| Method / endpoint | Contract và quyền |
|---|---|
| GET `/proposals/:id/guidance-context` | quyền guidance:read + scope; plan/readiness/allowedActions, current finalization, dossier revision, phase và periods; không tự tạo plan |
| GET `/proposals/:id/guidance-plan` | PlanView, 404 nếu chưa có; cùng scope |
| POST `/proposals/:id/guidance-plan` | guidance:manage + GVHD; finalizationId, expectedDossierRevision, description? |
| PATCH `/guidance-plans/:id` | guidance:manage + GVHD; expectedRevision, description, reason |
| POST `/guidance-plans/:id/resume` | guidance:manage + GVHD; expectedRevision, finalizationId, expectedDossierRevision, acknowledgeRebase:true |
| GET `/terms/:id/guidance-periods` | guidance:read, scope đợt; chỉ đọc tuần/mốc đã cấu hình |
| GET `/guidance-plans/:id/tasks` | guidance:read + scope; page/limit, periodId, status, isOverdue, search |
| GET `/terms/:id/guidance-tasks` | cùng quyền, tổng hợp trong scope với total/overdueTotal theo bộ lọc; không global theo role |
| POST `/guidance-plans/:id/tasks` | task:manage + GVHD; expectedPlanRevision,title,description?,expectedDeliverables,periodId,startDate,dueDate; chỉ AD_HOC |
| GET `/tasks/:id` | guidance:read + scope cha; task, revision, status/overdue riêng, progress/history metadata, allowedActions |
| PATCH `/tasks/:id` | task:manage + GVHD; expectedRevision,reason và field cần sửa, acknowledgeExistingSubmissions? |
| POST `/tasks/:id/progress` | task:progress + SV owner; expectedRevision,note |
| POST `/tasks/:id/cancel` | task:manage + GVHD; expectedRevision,reason,acknowledgeExistingSubmissions? |
| GET `/terms/:id/weekly-report-coverage` | guidance:read + scope; page/limit,periodId,isOverdue,search; coverageState/readiness, cả thiếu plan/task |
| POST `/weekly-report-obligations/:id/task` | task:ensure-weekly + owner/GVHD; expectedObligationRevision,expectedPlanRevision; không nhận title/kind/owner giả |

Các lỗi: 400 COMMON_003/TASK_DATES_INVALID; 401 AUTH_003; 403 thiếu action hoặc account bị khóa; ngoài scope 404 COMMON_001; 409 REVISION_CONFLICT/IDEMPOTENCY_CONFLICT/PLAN_ALREADY_EXISTS/PLAN_PAUSED/REBASE_REQUIRED/DOSSIER_NOT_FINALIZED/STALE_FINALIZATION/STALE_VERSION/TOPIC_NOT_AGREED/INPUT_NOT_READY/TERM_003/PERIOD_INVALID/DEADLINE_OUTSIDE_PHASE/ACKNOWLEDGEMENT_REQUIRED/WEEKLY_REQUIREMENT_IMMUTABLE/REPORTING_SCOPE_NOT_CONFIGURED/STATE_TRANSITION_INVALID. Không trả raw SQL/path/secrets.

**Legacy endpoint được bảo vệ:** GET `/tasks/plan/:planId` trước đây chỉ kiểm đăng nhập, có thể đọc submissions ngoài scope. Nay có guidance:read, identity chuẩn sub/userId và kiểm quan hệ qua service mới. Giữ `ApiResponse.ok(array)` và các field Task/submissions cũ, không âm thầm đổi thành page DTO; regression kiểm array envelope. TaskService.findByPlan nội bộ giờ nhận userId bắt buộc. Frontend mới dùng endpoints canonical, không dùng raw status legacy để suy completion.

## 6. Transaction và audit

Mutation SERIALIZABLE, đọc REPEATABLE READ. Thứ tự khóa: term → proposal → phase rows/assignment rows (reuse bước 5–7) → plan → obligation → task. Recheck principal/quyền sau khóa; kiểm phase trước và sau work. Retry bounded serialization/deadlock/unique; CAS update kiểm count=1. Idempotency key gồm actor+method+route+key, payload hash; khác payload trả 409, replay kiểm quyền hiện tại.

Task/plan pointers, revisions, progress/history, AuditLog và idempotency cùng transaction. Lỗi audit rollback tất cả. History giữ actor/reason/snapshot; technical AuditLog chỉ action/hash hoặc state/revision, không copy note/mô tả học thuật vào log có thể đọc bằng quyền vận hành. Các append-only trigger PR2B tiếp tục bảo vệ TaskHistory/PlanHistory/TaskProgressEvent.

## 7. Schema và migration

Migration: `backend/prisma/migrations/202610220004_guidance_task_management/migration.sql`.

SHA256: `505b31121767a48d7a33c06b86229f5583717d86c118fa770a78c4f10b47fed8`.

- TaskWorkflow thêm nullable startsAt TIMESTAMPTZ, expectedDeliverables TEXT, createdByUserId/assignedAdvisorId VARCHAR(36) với SQL FK sang UserAccount/Lecturer. Không đoán giá trị cho task legacy.
- Index TaskWorkflow(planId,state,periodId), Task(guidancePlanId,deadline), cũng khai báo trong Prisma.
- Trigger scope kiểm period cùng term của plan, obligation đúng owner/plan; trigger ngày kiểm deadline sau start, gồm deferred check lúc commit khi deadline của Task thay đổi. Giữ composite FKs và unique task tuần PR2B.
- Permission mới: guidance:read/manage, task:manage/progress/ensure-weekly; assign cho role hiện có theo matrix, không gán ADMIN. Không tạo user/roster/assignment/grant mới trong migration.
- Không thêm bảng hoặc enum, không sửa legacy TaskStatus, status REVIEWED/OVERDUE, bool TaskReview.isPassed, ownership/cardinality các module khác hoặc migration đã áp dụng.

Đã replay tám migration từ DB rỗng, và nâng cấp từ cây bảy migration có legacy task/plan/submission/false review. Inject lỗi trước COMMIT xác minh rollback field/index/trigger/permission, sau đó deploy thành công và deploy lại không áp trùng. Metadata legacy mới vẫn NULL; không tự gán TODO/author/GVHD/ngày. BEGIN/COMMIT và lock_timeout 10s.

Supabase chưa deploy. Trước deploy cần inspect history/checksum/data, backup và phê duyệt target/SQL riêng theo quy trình nhóm. Nếu lỗi DDL transaction, kiểm rollback/history trước resolve. Khi tắt/rollback ứng dụng, giữ additive columns/indexes/history và guard đọc legacy; không drop/down/reset, gỡ trigger hoặc trả lại endpoint đọc ngoài scope. Sửa schema bằng forward migration được review.

## 8. Frontend và demo

- `/guidance/plan`: chọn đợt, hồ sơ APPROVED trong scope; APPROVED là ứng viên, context vẫn kiểm finalization/assignment/phase.
- `/guidance/plan/:proposalId`: readiness, create/update/resume plan theo quyền, xem task.
- `/guidance/plan/:proposalId/tasks/new`: form task, sản phẩm/mốc/thời gian UTC+7, revision cố định khi đang nhập; 409 giữ dữ liệu.
- `/guidance/tasks`: tổng hợp theo đợt, lọc tuần/mốc/trạng thái/quá hạn và xem nghĩa vụ tuần độc lập task.
- `/guidance/tasks/:id`: chỉnh sửa/hủy theo quyền, SV ghi tiến độ, lịch sử, readonly khi không đủ điều kiện. Có loading/empty/error/success, responsive 375px. Nút tải lại chủ động đặt lại form với revision mới; refetch nền không tự ghi đè bản đang nhập.

```powershell
# GVHD: tạo kế hoạch và giao nhiệm vụ, mock-only
pnpm --filter @doan/frontend preview:guidance-tasks
# SV: xem task mẫu, ghi tiến độ, materialize nghĩa vụ tuần đã cấu hình
pnpm --filter @doan/frontend preview:guidance-tasks --student
# Khoa: chỉ xem tổng hợp/read-only
pnpm --filter @doan/frontend preview:guidance-tasks --faculty
```

Edge riêng port 50177, nhãn DEMO, dữ liệu trong bộ nhớ. Không Docker/backend/DB; không phải dữ liệu học vụ thật. Các menu ngoài bước 8A chưa giả lập đầy đủ. Chỉ cửa sổ Edge lệnh mở có mock. Đóng Edge/Ctrl+C để dừng; chạy thật cần migration/dữ liệu producer đã duyệt.

## 9. Validation thực tế

| Kiểm tra | Kết quả |
|---|---|
| `pnpm verify` | PASS: Prisma validate/generate, frozen legacy/PR2B compatibility, shared/backend/frontend type-check, lint, unit và build |
| Backend unit cuối | **85 PASS**, gồm 10 bước 8A; sau bổ sung guard snapshot đã chạy lại backend lint/type-check/test/build PASS |
| Frontend unit cuối | **22 PASS**, gồm 4 bước 8A; frontend lint/type-check/test/build PASS |
| Database/tool target guards trong verify | 12 PASS |
| `pnpm --filter @doan/backend test:guidance-tasks:api` | **19 nhóm API/PostgreSQL17 checks PASS**, có producer prelude 19 bước 7 và 27 bước 5 trên cây active 8 migration |
| `pnpm --filter @doan/backend test:guidance-tasks:upgrade` | **4 nhóm PASS**: rollback, data preservation, grants, checksum/repeat deploy |
| `pnpm --filter @doan/frontend test:guidance-tasks:browser` | **11 Edge checks PASS**, API mock |
| Hồi quy browser bước 4/5/6/7 | **9/10/15/8 PASS** |

API coverage: không implicit ADMIN/reviewer; owner/current advisor/grant và cross-term/department; missing phase/finalization, exact version/dossier revision; concurrent/idempotent plan/task creation và edits; timezone/phase exclusive end; SQL owner/date constraints; student progress-only; legacy scope + giữ array response; overdue/filter và progress muộn; acknowledge bài có sẵn; weekly coverage trước plan/task, config validation/materialization/unique/cancel/replacement; race phase lock thật với transaction chờ khóa; dossier bị mở lại; handover pause/new advisor agreement/ack giữ task; audit failure rollback; append-only history và không đổi historical submission. Unit kiểm thêm FINALIZED không cần receipt và topicRevision đổi sau chốt bị chặn.

DB test: PostgreSQL17.11 portable riêng tại TEMP, loopback 127.0.0.1:55441, database mới btl_pr2b_step8a_*, credentials ngoài source. Không reset, drop hoặc dùng database shared. Cluster test được dừng sau kiểm thử, giữ dữ liệu/evidence. Chưa chạy browser với backend/login thật hoặc Supabase; browser kiểm bằng mock, API/PostgreSQL kiểm thật riêng. CI thêm runner nhưng chưa tuyên bố remote CI đã chạy. Coverage tuần hiện phân trang sau khi chiếu scope/cấu hình trong application; chưa benchmark quy mô lớn, không tuyên bố đã kiểm hiệu năng toàn Khoa nhiều đợt.

Evidence: `backend/prisma/review/step8a-results.json`, `step8a-upgrade-results.json`, `step8a-browser-results.json`. Warnings nền tảng Vite CJS, React Router SSR useLayoutEffect, Node DEP0190 vẫn có, không làm check thất bại.

## 10. File thay đổi trong lượt 8A

**Mới:**

- `shared/src/contracts/guidance-tasks.ts`
- `backend/src/guidance/tasks/guidance.controller.ts`
- `backend/src/guidance/tasks/guidance.service.ts`
- `backend/src/guidance/tasks/guidance.repository.ts`
- `backend/src/guidance/tasks/guidance.validator.ts`
- `backend/src/guidance/tasks/guidance.spec.ts`
- `backend/prisma/migrations/202610220004_guidance_task_management/migration.sql`
- `backend/scripts/test-guidance-tasks.cjs`, `test-guidance-task-upgrade.cjs`
- `frontend/src/features/guidance-tasks/api.ts`, `components.tsx`, `pages.tsx`, `components.spec.tsx`
- `frontend/scripts/test-guidance-tasks-browser.cjs`
- Ba evidence JSON 8A và báo cáo này.

**Tích hợp trực tiếp:**

- `backend/prisma/schema.prisma`: bốn field nullable và hai index trong phạm vi task.
- `backend/src/guidance/guidance.module.ts`: providers/controller mới.
- `backend/src/guidance/controller/task.controller.ts`, `service/task.service.ts`: bảo vệ API legacy trong chính module guidance, giữ shape array.
- `backend/package.json`, `frontend/package.json`, `shared/src/index.ts`, `.github/workflows/backend-ci.yml`: script/export/CI.
- `frontend/src/app/router/routes.tsx`, `frontend/src/features/review-groups/workspace.tsx`: route/menu/layout cho guidance, giữ route đánh giá/họp/final report của người khác.
- `backend/scripts/test-proposal-dossiers.cjs`: chỉ đổi log “seven migrations” thành “active migration chain” để producer prelude phản ánh đúng khi có migration 8; không sửa assertions/nghiệp vụ bước 7.
- `docs/implementation/03-team-development-guide.md`: hướng dẫn và contract producer mới.

JSON/PDF evidence bước 5/7 được ghi lại khi chạy producer prelude; browser bước 4–7 cũng ghi lại evidence. Những source modified/untracked khác đã có từ đầu lượt được giữ; Git diff toàn working tree gồm cả công việc trước. Không sửa dependencies/lockfile trong lượt 8A, không sửa DOCX/env/ADR/migration cũ hoặc business logic bước 1–3/9–10. Không stage/commit/push.

## 11. Bàn giao tiếp theo

Người 1 triển khai/cấu hình dữ liệu lịch/roster/assignment/Topic agreement và lock protocol thật; schema hay demo không thay producer. Thiếu input không được “sửa” bằng SQL tạo ownership, approval hoặc receipt giả. Role tạo sau migration cần bootstrap permission đúng manifest.

Người 3 dùng state canonical và đọc scope qua API, không suy PASS/completion từ progress note, isOverdue, Task.status legacy hoặc bool TaskReview.isPassed. Kế hoạch/dossier chốt không tự tạo điều kiện đủ bảo vệ.

Bước 8B còn phải triển khai file staging/ownership/policy, snapshot bài nộp, current submission/review, ba kết quả riêng PASS/FAIL/REVISION_REQUIRED và phép amend có audit. Giao diện/endpoint upload và đánh giá chưa được thêm trong 8A. Mở lại dossier/handover thực phải pause/rebase cùng transaction; 8A đã có guard và resume nhưng không triển khai command của module người 1/7 thay họ.
