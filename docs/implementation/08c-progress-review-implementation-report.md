# BƯỚC 8C — Nhận xét báo cáo và theo dõi tiến độ

Ngày 23/10/2026, Asia/Ho_Chi_Minh. Đã triển khai backend/frontend, kiểm thử toàn luồng 8A → 8B → 8C trên PostgreSQL/filesystem riêng và kiểm thử browser bằng API mock. **Không kết nối/chạy DDL lên Supabase chung; không stage/commit/push.**

## 1. Phạm vi và nguồn

Căn cứ PR1 D10–D13, §4.6–4.9, DTO/API/authorization §5–7; audit 00, migration plan 02, hướng dẫn nhóm 03, ADR đồ án cá nhân, đặc tả use case và UC16 trong DOCX. Đối chiếu các báo cáo/contract 8A–8B. Không sửa DOCX, ADR hoặc các quyết định đã duyệt.

UC16 xác nhận nhận xét ba mức, giữ lịch sử sửa và nhật ký buổi hướng dẫn. Baseline đã chốt MeetingCreate/MeetingAmend và các model liên quan, nên nhật ký được triển khai trong 8C. Phạm vi hiện tại là **đánh giá từng bài báo cáo**, họp hướng dẫn, dashboard và thông báo in-app. Phần FR25 nhập điểm/tiêu chí giai đoạn, nhận xét tổng kết/điểm hướng dẫn có điều kiện, cảnh báo chậm kéo dài theo ngưỡng và email là các phần mở rộng riêng; không tự tạo criteria/weights/ngưỡng/retry chưa được duyệt. Không tuyên bố đã hoàn thành toàn bộ mọi nhánh UC16. Không tính điểm tốt nghiệp, xét điều kiện bảo vệ hoặc triển khai bước 9–10.

## 2. Quyết định và state machine thực thi

| Quyết định | TaskWorkflow.state | SubmissionWorkflow.state | Điều kiện |
|---|---|---|---|
| PASS — Đạt | COMPLETED | REVIEWED | Bài hiện hành có evidence/metadata hợp lệ; chỉ GVHD chính thức hiện hành |
| FAIL — Không đạt | REVISION_REQUESTED | REVIEWED | Bắt buộc nhận xét; giữ decision FAIL riêng |
| REVISION_REQUIRED — Cần sửa | REVISION_REQUESTED | REVIEWED | Bắt buộc nhận xét; không gộp dữ liệu với FAIL |

- Chỉ task SUBMITTED có current submission SUBMITTED, chưa effective review mới nhận đánh giá đầu tiên. Không tự hoàn thành khi chưa nộp, chỉ có ghi chú tiến độ hoặc file staging.
- Review gắn submissionId/versionNumber cụ thể, reviewerUserId, assignmentRevision hiện hành, recordedAt do server, comment, revision. Không nhận reviewer/actor/điểm từ client.
- Một effective review/submission. Sửa đánh giá cần expectedTaskRevision/expectedSubmissionRevision/expectedReviewRevision và reason; bản cũ RECORDED → SUPERSEDED, tạo hàng mới RECORDED với supersedesReviewId, cập nhật pointer và tính lại task cùng transaction. Không overwrite comment/result/time cũ.
- PASS → FAIL/Cần sửa trên bài vẫn hiện hành mở lại yêu cầu nộp, không mất bài cũ. FAIL/Cần sửa → PASS hoàn thành lại theo chứng cứ. SV có thể nộp lại theo 8B khi task chưa COMPLETED/CANCELLED và phase mở.
- Khi SV đã nộp v2, quyết định của v1 vẫn đọc được nhưng đánh giá/amend v1 trả STALE_SUBMISSION. Không chuyển nhận xét hoặc kết quả v1 sang v2.
- Term IN_PROGRESS, GUIDANCE mở/chưa khóa, plan ACTIVE, bản chốt/agreement/assignment đúng revision là precondition ghi. Không cấp quyền từ membership nhóm duyệt, JWT role claim hoặc ADMIN-only. Handover/reopen chưa rebase thì chặn ghi theo 8A.
- Legacy TaskReview.isPassed và Task.status được giữ nguyên, không mirror ba kết quả vào boolean hoặc suy COMPLETED từ REVIEWED legacy. Consumer dùng TaskWorkflow và ProgressReview canonical.

## 3. API, DTO và quyền

Base `/api`; JSON success/error envelope hiện có. POST tạo/amend review và tạo meeting trả 201; PATCH/GET/mark-read trả 200. Academic mutation cần Idempotency-Key và revision. Actor từ current principal server.

| Endpoint | DTO / kết quả | Quyền và scope |
|---|---|---|
| GET `/guidance-review-options/terms` | terms, canReview, canMonitor | guidance:read; trả đúng roster/grant có liên quan, không lấy danh sách toàn hệ thống chỉ từ role |
| GET `/terms/:termId/progress-review-inbox` | page/limit, pending?,decision?,studentId?,advisorId?,periodId?,status?,search? → page task/current submission | task:review + LECTURER là GVHD chính thức hiện hành của từng hồ sơ trong đợt |
| GET `/task-submissions/:id/review-context` | exact SubmissionView, currentSubmissionId, taskRevision/status, effective review, lịch sử, allowedActions/readiness | submission:read + owner/current advisor/FACULTY grant |
| POST `/task-submissions/:id/reviews` | expectedTaskRevision, expectedSubmissionRevision, decision, comment? → ProgressReviewView | task:review + GVHD; exact current version, SUBMITTED; FAIL/Cần sửa cần comment |
| POST `/task-reviews/:id/amendments` | các field trên + expectedReviewRevision, reason → review mới | cùng quyền; review còn hiệu lực và submission còn current |
| GET `/terms/:termId/guidance-dashboard` | bộ lọc và page/limit → metrics, weekly coverage, task page, advisor/student options | guidance:monitor + FACULTY grant đúng đợt/bộ môn; không mở cho ADMIN hoặc GVHD chỉ vì có permission khác |
| GET `/guidance-plans/:id/meetings` | page/limit → meeting/history, planRevision/canCreate | guidance:read + scope plan F/O/A |
| POST `/guidance-plans/:id/meetings` | expectedPlanRevision, occurredAt ISO có timezone, mode IN_PERSON/ONLINE, location?, discussion, conclusion | guidance:manage + GVHD hiện hành, ACTIVE/Q |
| PATCH `/guidance-meetings/:id` | expectedRevision, reason, ít nhất một occurredAt?/mode?/location?/discussion?/conclusion? | guidance:manage + GVHD hiện hành; không suy nội dung legacy |
| GET `/me/notifications` | page/limit → notification page của principal | authenticated self, không nhận userId từ query/body |
| POST `/me/notifications/:id/read` | không DTO học thuật; UNREAD → READ, readAt ổn định khi retry | authenticated recipient; update có điều kiện, tự idempotent |
| GET `/notifications/user/:userId` (cũ) | giữ ApiResponse.ok(array), tối đa 20 như cũ | nay bắt buộc userId = principal; biết ID không được đọc thông báo người khác |

Tải file dùng endpoint private 8B đã có, không thêm public URL/storage adapter: `/task-submissions/:id/files/:fileId/download`. ReviewContext chỉ trả file metadata, không nhận file ID thay thế phiên bản đang xét.

| Vai trò | Xem kết quả/file/history | Đánh giá/amend | Dashboard Khoa | Nhật ký |
|---|---|---|---|---|
| STUDENT | owner | không | không | đọc plan mình |
| LECTURER | GVHD chính thức hiện hành | khi đầy đủ phase/plan/version/permission | không theo role GVHD | tạo/sửa đúng plan, có history |
| FACULTY | grant đúng đợt/bộ môn | không chấm thay GVHD | đúng grant | đọc đúng scope |
| Reviewer chỉ có review-group membership | không tự có quyền source/báo cáo tuần | không | không | không tự có quyền |
| ADMIN-only | không academic bypass, kể cả seed cho action permission | không | không | không academic bypass |

Thông báo cá nhân chỉ chứa nội dung chung và link; link vẫn kiểm quyền tài nguyên cha. Không có endpoint đọc nội dung review toàn hệ thống cho vận hành.

Lỗi 400 COMMON_003/REVIEW_COMMENT_REQUIRED/REASON_REQUIRED, 401 AUTH_003, 403 thiếu permission/account inactive, ngoài scope 404 COMMON_001. Conflict 409 gồm STALE_SUBMISSION, STALE_REVIEW, REVIEW_ALREADY_RECORDED, REVISION_CONFLICT, IDEMPOTENCY_CONFLICT, STATE_TRANSITION_INVALID, FILE_NOT_READY, INPUT_NOT_READY, TERM_003, PLAN_PAUSED, REBASE_REQUIRED, DOSSIER_NOT_FINALIZED/TOPIC_NOT_AGREED. Không trả raw SQL hoặc path private.

## 4. Dashboard từ dữ liệu thật

Danh sách task, current submission và effective RECORDED review được đọc trong REPEATABLE READ. Mốc `asOf` duy nhất dùng tính quá hạn cho toàn response. Theo dõi current advisor từ phân công chính thức đã FINALIZED và history/roster; không lấy assignedAdvisorId lịch sử của task làm quyền của GVHD cũ.

- totalTasks: task thuộc phạm vi và bộ lọc.
- completed: trạng thái COMPLETED và effective current decision PASS.
- notSubmitted: task chưa hủy, metadata đã xác định, chưa có current submission hợp lệ; không tự coi legacy thiếu metadata là chưa từng nộp. Nếu đã có TaskSubmission nhưng thiếu currentSubmissionId, đánh dấu legacyUnknown để đối soát, loại khỏi notSubmitted/overdue thay vì đoán version hiện hành.
- overdue: derived theo deadline, chưa COMPLETED/CANCELLED; có thể bao gồm bài đã nộp nhưng task chưa hoàn thành theo baseline 8A. Không đồng nghĩa “chưa nộp”.
- needsResubmission: trạng thái REVISION_REQUESTED; failed/revisionRequired là các decision hiện hành riêng, không gộp dữ liệu. Các nhóm thống kê có thể giao nhau.
- pendingReview, cancelled và legacyUnknown được hiển thị riêng. Không quy phần trăm thành điểm học vụ hoặc xác nhận đủ điều kiện bảo vệ.

Weekly coverage xuất phát từ GuidancePeriod(WEEK) + PeriodRequiredStudent, kể cả khi thiếu plan/task. Kiểm obligation config/scope/current task/plan; thiếu cấu hình hoặc chưa xác định routing trả NOT_CONFIGURED/cảnh báo thay vì khẳng định “không thiếu”. Báo cáo FAIL/Cần sửa vẫn là đã nộp. Shared/coverage API 8A được bổ sung reviewResult tùy chọn, giữ ba giá trị riêng/null.

Bộ lọc chung Khoa: đợt, GVHD hiện hành, SV; API hỗ trợ thêm period. Các filter task status/decision/pending/search trên API áp dụng cho task page/metrics, không biến nghĩa vụ tuần thành tập task. UI Khoa chỉ đưa các filter chung GVHD/SV/đợt. Dropdown names cũng lấy từ scope, không gọi catalog toàn hệ thống của thành viên khác.

Truy vấn mới phân trang sau khi chiếu scope/filters trong application theo pattern coverage hiện tại. Đã kiểm tính đúng trên fixture và SQL/Prisma thực, **chưa benchmark quy mô lớn**; không tuyên bố đã tối ưu mọi truy vấn toàn Khoa nhiều đợt.

## 5. Nhật ký và thông báo

Meeting dùng GuidanceMeeting + MeetingWorkflow + MeetingHistory đã thống nhất: occurredAt map meetingDate, mode/discussion/conclusion/author/revision canonical trong sidecar. Không tự tách summary legacy thành hai nội dung, không backfill author. PATCH từng field giữ các field không gửi, history lưu đầy đủ before/after, actor/reason/time. Bản ghi mới có history tạo; không hard-delete hoặc overwrite history. Không thêm slot/phòng/attendance hoặc biến log thành lịch xét duyệt đề cương đã loại khỏi baseline.

Frontend lấy thời gian nhập theo UTC+7 và gửi ISO có offset; không tự tạo buổi “đã diễn ra” khi mở form. Không thêm quy tắc khóa lịch theo tuần/phòng hoặc hạn ghi lùi ngày chưa được baseline quyết định. Writes vẫn phải qua phase/plan guard hiện hành.

Khi review/amend commit, Notification cho SV owner được tạo trong cùng transaction với OutboxEvent `TASK_SUBMISSION_REVIEWED`, eventId `progress-review:<reviewId>`. Payload outbox chỉ ID liên quan và notificationId; body thông báo chung, không copy comment/source hoặc kết quả học thuật vào notification/log vận hành. Idempotency/revision bảo đảm không tạo thông báo trùng do retry.

Notification in-app đã có thực; outbox được giữ PENDING cho consumer tương lai, **không coi là email đã gửi**. Không thêm email worker/retry/cron cảnh báo hoặc tiêu thụ hàng loạt các outbox cũ của bước 5–6. Consumer sau này phải sử dụng notificationId/eventId để tránh tạo lại notification đã có. GET legacy được bổ sung owner guard vì đường đọc cũ có thể bypass cơ chế mới; giữ shape array, thêm repository chỉ cho các thao tác notification này.

## 6. Concurrency, audit và database

Mutations SERIALIZABLE, retry bounded cho serialization/deadlock/unique conflict. Reuse lock order term → proposal/phase/assignment → plan → obligation → task; meeting thêm lock meeting sau plan. Quyền hiện hành được kiểm lại sau khóa. Kiểm phase/active plan và version trước commit; request bắt đầu trước khóa phase không được tự coi hợp lệ sau khóa.

Review CAS tác động task/submission/review. Unique effective review/submission và supersedes chain PR2B vẫn dùng. Review result, pointer, task state, history, audit, notification, outbox và idempotency cùng transaction; audit lỗi rollback tất cả. Hai review/amend cùng revision chỉ một commit; review/amend và SV nộp lại tranh chấp trên cùng task, không kết luận trên version cũ.

Review content đã có immutable trigger PR2B. Migration mới thêm deferred guards kiểm final graph cho canonical submission có contextSnapshot: effective review phải RECORDED của đúng current REVIEWED submission; PASS tương ứng COMPLETED và hai kết quả còn lại tương ứng REVISION_REQUESTED (task đã CANCELLED giữ lịch sử). Các check chạy ở commit để cho phép thay chain/pointer/state cùng transaction. Không quét/sửa hay áp suy diễn lên legacy context null.

Audit kỹ thuật chỉ ID/hash; decision và nhận xét nằm trong ProgressReview, nội dung buổi hướng dẫn trong sidecar/history được kiểm scope. Không đưa raw decision/comment/source vào API audit cho ADMIN.

Migration `backend/prisma/migrations/202610230001_guidance_reviews/migration.sql`.

SHA256: `684722701D412F58E6DD2C824344BD74EB98F5E284AC2D97945EEDC24D179B9E`.

- Schema chỉ thêm 3 index: ProgressReview(reviewerUserId,recordedAt), GuidanceMeeting(guidancePlanId,meetingDate), Notification(userId,createdAt,id).
- Không thêm/sửa model scalar, enum, timestamp native type, ownership/cardinality/unique cũ. Reuse ProgressReview, SubmissionWorkflow, TaskWorkflow, MeetingWorkflow/History, Notification, OutboxEvent.
- Permission mới: task:review cho LECTURER, guidance:monitor cho FACULTY; không gán ADMIN. Quan hệ vẫn bắt buộc, permission không tự cấp toàn đợt.
- SQL BEGIN/COMMIT + lock_timeout 10s; index thường nằm trong transaction. Deploy cần đánh giá thời gian lock trên kích thước dữ liệu thực; chưa kiểm hiệu năng/lock trên Supabase.

Đã kiểm upgrade từ chín migration với dữ liệu legacy, inject lỗi trước COMMIT xác nhận index/triggers/grants rollback, giữ nguyên task/submission/boolean false/meeting summary/notification; deploy lại không áp trùng, đủ mười checksum khớp. Không sửa 0_init hoặc migration đã tồn tại, không db push/reset/migrate dev.

Supabase chung chưa deploy. Cần inspect dữ liệu/history/checksum mới nhất và review SQL/backup/target theo quy trình trước khi được phép deploy riêng. Kiểm các canonical current pointer/effective review sai nếu có dữ liệu do module ngoài 8B ghi; không auto-repair hoặc suy FAIL từ boolean false. Nếu DDL lỗi kiểm rollback/history trước resolve. Rollback ứng dụng giữ các dữ liệu additive/history/notification; sửa schema qua forward migration đã review, không drop/xóa để phục hồi.

## 7. Frontend và tích hợp nhóm

Routes mới:

- `/guidance/review?termId=...`: inbox GVHD, lọc chờ đánh giá/kết quả/search, mở đúng version.
- `/guidance/review/:submissionId`: nội dung/file, kết quả/nhận xét, form review/amend theo allowedActions, lịch sử version đó; bản cũ chỉ đọc. Nhận xét FAIL/Cần sửa có panel yêu cầu rõ ràng.
- `/guidance/progress?termId=...`: dashboard Khoa trong grant, bộ lọc GVHD/SV, task metrics và nghĩa vụ tuần độc lập task.
- `/guidance/meetings?planId=...`: form nhật ký, chỉnh sửa có lý do, before/after hiển thị bằng nhãn nội dung, đọc history theo scope. Link từ kế hoạch 8A và màn review.
- `/guidance/notifications`: notification self, link được giới hạn `/guidance/`, mark-read.

8B history có nút “Xem nhận xét và đánh giá” cho từng submission. Nộp lại invalidates review/inbox/dashboard; review success invalidates task/list/submission/coverage/notification; meeting success invalidates plan context. Khắc phục việc cache mặc định 5 phút làm các màn giữ dữ liệu cũ sau mutation liên luồng. Queries đọc lại khi vào trang; form review/meeting không tự refetch theo window focus để ghi đè nội dung đang sửa. 409 giữ input, có nút reload chủ động; không tự ghi kết luận trên phiên bản mới thay version đang xem.

Dùng design system/workspace hiện tại, menu/route/lazy chunk riêng cho 8C; loading/empty/error/success và responsive 375px. Không refactor giao diện bước 1–3/9–10. Các trang điểm/bảo vệ và business logic module khác giữ nguyên.

Người 1 tiếp tục cung cấp roster/officialPlan/assignment/history/agreement, phase GUIDANCE, routing/grant/period/obligation đã duyệt và thực hiện handover/reopen theo lock protocol. Không tạo dữ liệu chính thức giả khi thiếu producer. Người 3 tiêu thụ canonical current submission/review/task state; Đạt một task hoặc nhiều task không tự xác nhận đủ bảo vệ/điểm tốt nghiệp. Criteria/milestone cho FR25 phải được cấu hình và chốt trước PR tương ứng.

## 8. Validation thực tế

| Kiểm tra | Kết quả |
|---|---|
| `pnpm verify` | PASS: Prisma validate/generate, frozen legacy/PR2B compatibility, typecheck/lint/unit/build toàn workspace |
| Backend unit cuối | **107 PASS**, gồm 11 test 8C; backend lint/typecheck/test/build chạy lại sau guard dashboard cuối |
| Frontend unit cuối | **27 PASS**, gồm 3 test 8C; frontend lint/typecheck/test/build chạy lại sau cache integration cuối |
| Database target/tool guards trong verify | **12 PASS** |
| `test:guidance-reviews:api` | **17 nhóm PASS**, Nest HTTP + PG17 + private files thật; gồm full create task/upload/submit/review/resubmit/amend |
| API producer prelude | 8A **19**, 8B **17**, bước 7 **19**, bước 5 **27** checks PASS trên active chain mười migration |
| `test:guidance-reviews:upgrade` | **4 nhóm PASS**, rollback/preserve/grants/checksums |
| `test:guidance-reviews:browser` | **10 checks PASS**, Edge mock API, gồm nộp v2 qua giao diện 8B |
| Hồi quy browser 8A/8B | **11/10 checks PASS** |

API kiểm exact version và secure download; quyền GVHD hiện hành/owner/FACULTY/ADMIN/reviewer/cross-term/department; ba quyết định/comment/revision; v1 giữ nguyên sau v2; PASS completion; amendment history; concurrent amendments và review vs resubmit; audit failure rollback notification/outbox/history; legacy notification IDOR/self mark-read; meeting CAS/history/partial PATCH giữ field; dashboard đối soát dữ liệu thật và tuần chưa có task; khóa phase/reopen và tranh chấp row lock thực; không đổi legacy boolean/FinalResult/DefenseEligibility.

Lượt kiểm tra cuối bổ sung fixture submission legacy không có current pointer và kiểm whitelist ID/hash của technical audit. Backend dùng script đúng tên `pnpm --filter @doan/backend type-check` (có dấu gạch nối), cùng `lint`, `test`, `build`; không có script `typecheck` trong package này.

Database test mới riêng `btl_pr2b_step8c_*`, PostgreSQL portable 17.11 loopback 127.0.0.1:55441; credentials và file fixtures ở TEMP ngoài source. Prelude dùng cùng private test root có guard để kiểm cả download thật. Không reset/drop database; cluster dừng sau kiểm thử, giữ dữ liệu/evidence. Browser là mock, không tuyên bố đã kiểm login + browser + backend thật trong cùng runner hoặc triển khai Supabase/GitHub CI. Job CI API/upgrade đã được thêm, chưa chạy remote trong phiên này.

Evidence: `backend/prisma/review/step8c-results.json`, `step8c-upgrade-results.json`, `step8c-browser-results.json`. Warnings nền tảng Vite CJS, React Router SSR và Node DEP0190 còn hiện nhưng không làm check thất bại. Chunk 8C được lazy-load; build cuối không còn cảnh báo chunk vượt 500 kB do bổ sung feature này.

## 9. File thay đổi trong lượt 8C

**Mới:**

- `shared/src/contracts/guidance-reviews.ts`.
- `backend/src/guidance/reviews/progress-review.controller.ts`, `progress-review.service.ts`, `progress-review.repository.ts`, `progress-review.validator.ts`, `progress-review.spec.ts`.
- `backend/src/notification/repository/notification.repository.ts`.
- `backend/prisma/migrations/202610230001_guidance_reviews/migration.sql`.
- `backend/scripts/test-guidance-reviews.cjs`, `test-guidance-review-upgrade.cjs`.
- `frontend/src/features/guidance-reviews/api.ts`, `components.tsx`, `pages.tsx`, `components.spec.tsx`.
- `frontend/scripts/test-guidance-reviews-browser.cjs`.
- Ba JSON evidence 8C và báo cáo này.

**Tích hợp trực tiếp:**

- Prisma schema: chỉ ba index nêu trên.
- GuidanceModule: providers/controller mới; GuidanceService thêm access helper tái sử dụng chính sách cha; repository/coverage/shared guidance-tasks thêm reviewResult tùy chọn.
- SubmissionService: mapper view công khai nội bộ để dùng chung DTO, không đổi endpoint hoặc storage 8B.
- NotificationService/Controller/Module: self list/read + owner guard legacy, chuyển truy vấn qua repository trong phạm vi này.
- Shared index, backend/frontend package.json và backend-ci.yml: export/scripts/job/artifacts; không dependency/lockfile mới.
- Frontend router/workspace: route và menu 8C, chỉ thay registration của hai placeholder review/meeting; không xóa source placeholder hoặc sửa trang 9–10.
- Frontend guidance-tasks/pages và task-submissions/pages: link nhật ký/nhận xét và cache invalidation liên luồng.
- `backend/scripts/test-guidance-submissions.cjs`: đổi assertion từ chín migration cố định sang số active migration thật; cho phép test root chung chỉ trong TEMP prefix `btl-step8c-private-*` có guard. Không sửa assertions hoặc business logic 8B để bỏ qua kiểm tra cũ.
- `docs/implementation/03-team-development-guide.md`: bàn giao và demo 8C.

Producer prelude ghi lại JSON/PDF evidence bước 5/7/8A/8B; browser hồi quy ghi lại JSON 8A/8B. Các modified/untracked khác đã có từ đầu lượt được giữ. Git diff toàn working tree gồm công việc trước và không hiện đầy đủ file untracked; không coi toàn bộ diff là thay đổi 8C. Không sửa backend/.env, DOCX, ADR, dependencies/lockfile, migration cũ hoặc business logic bước 1–3/9–10. Không stage/commit/push.

## 10. Xem thử giao diện

```powershell
# GVHD: inbox, review/amend, xem history, nhật ký
pnpm --filter @doan/frontend preview:guidance-reviews
# SV: nhận xét yêu cầu sửa → nộp lại bằng UI 8B → thông báo
pnpm --filter @doan/frontend preview:guidance-reviews --student
# Khoa: dashboard có dữ liệu mô phỏng và bộ lọc
pnpm --filter @doan/frontend preview:guidance-reviews --faculty
```

Edge port 50179, dữ liệu bộ nhớ/API mock, không Docker/backend/DB. Chỉ cửa sổ Edge do lệnh mở có mock; các menu ngoài 8C/luồng nộp lại 8B chưa được giả lập đầy đủ. Đóng Edge/Ctrl+C để dừng. Bản thật cần migration và đầu vào producer được phê duyệt; demo không tạo hồ sơ chính thức.
