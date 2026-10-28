# Bước 8 — Hướng dẫn, bài nộp, nhận xét và theo dõi

## 1. Nguồn và mục tiêu

Quản lý hướng dẫn theo dossier chốt và GVHD hiện hành; ghi tiến độ/ báo cáo bất biến; chỉ kết luận hoàn thành khi current submission có effective PASS; Khoa theo dõi đúng nghĩa vụ tuần và phạm vi. Phạm vi được xác minh tại [scope](01-scope-and-requirements.md), không suy từ tên module. Module liên quan: `backend/src/guidance/tasks, submissions, reviews; frontend/src/features/guidance-tasks, task-submissions, guidance-reviews; shared/src/contracts/guidance-tasks.ts, task-submissions.ts, guidance-reviews.ts`.

## 2. Chức năng và nghiệp vụ

| Chức năng | Vai trò | Điều kiện trước | Đầu vào | Quy tắc / từ chối | Đầu ra / trạng thái | Chứng cứ / triển khai |
| --- | --- | --- | --- | --- | --- | --- |
| 8A plan/create/resume | Current advisor; owner/Khoa đọc | Dossier finalized, agreement/official assignment hợp lệ, GUIDANCE mở | Finalization/assignment revision, plan revision, acknowledgeRebase/key | Một plan; handover pause, không tự resume | ACTIVE/PAUSED plan có history | 19 nhóm8A + live create |
| 8A task/create/edit/cancel | Current advisor | Plan active; period cùng term; deadline trong phase; acknowledge nếu có bài | Title, dates timezone, deliverables, expected revisions/key | CAS; không sửa nghĩa vụ tuần riêng task; cancel giữ evidence | TODO/CANCELLED và history | API race/bounds/rollback; browser giao task |
| 8A progress/weekly | Owner progress; actor ensure-weekly đúng quyền | Scope, plan/phase, cấu hình nghĩa vụ | Progress note hoặc obligationId/revision/key | Nghĩa vụ tồn tại không phụ thuộc task; materialize idempotent | IN_PROGRESS/coverage; không tự COMPLETE | Missing-plan/task/week cases PASS |
| 8B upload/commit/resubmit | Chỉ owner nộp; owner/GVHD/Khoa scoped đọc | Policy enabled, task open, phase mở lúc upload và commit | Multipart REPORT/SOURCE/EVIDENCE; READY asset IDs, revision/key | Validate bytes/MIME/ZIP/size/name; commit atomic append-only | Submission version + private links; late flag | 17 nhóm8B + actual PDF/ZIP upload |
| 8C review/amend | Current advisor | Exact current submission, phase/plan, CAS; comment cho FAIL/REVISION | PASS/FAIL/REVISION_REQUIRED, reason amendment/key | Một effective review; append superseding chain; recompute task | PASS→COMPLETED; FAIL/REVISION→REVISION_REQUESTED | 17 nhóm8C + live revision→v2→PASS |
| 8C meeting create/amend | Advisor ghi; owner/Khoa đọc | Scope, current assignment, plan/phase, revision | Discussion/conclusion/time, reason khi sửa | Append history, audit atomic | Meeting nhật ký, không phải phiên duyệt vật lý | API PASS; mọi modal UI chưa vét cạn |
| 8C dashboard/notification | Khoa theo grant; notification self | Reporting config; current advisor/term/department | Student/advisor/period/state filters, paging/read ID | Current canonical evidence, không dùng bool legacy; không đếm thiếu =0 khi config thiếu | Counts/missing weeks và read state | Live dashboard/notification PASS; QA-007 task/submission notice gap |

## 3. Trạng thái triển khai và state machine

**IMPLEMENTED / PARTIALLY VERIFIED**, không gắn PASS cho toàn tính năng khi còn nhánh acceptance thiếu bằng chứng. Task TODO/IN_PROGRESS/SUBMITTED/REVISION_REQUESTED/COMPLETED/CANCELLED; overdue derived. Submission SUBMITTED/REVIEWED/SUPERSEDED. Review RECORDED/SUPERSEDED và ba decision tách riêng. Amend PASS→FAIL→REVISION_REQUIRED recalculates task, không ghi đè review cũ. Weekly obligation không tự biến thành reported/completed khi tạo task.

## 4. Test cases và kết quả mới

**53 nhóm kịch bản PASS**. Đây là scenario groups, có nested producer prelude; không cộng lặp các assertion của bước trước. Tên dưới đây chính là điều kiện /assertions trong test nguồn, không phải kết quả giả lập.

| ID / bằng chứng | Kịch bản | Kết quả |
| --- | --- | --- |
| [STEP8A-01](evidence/20261026144939_2663ec/step8a/generated/step8a-results.json) | active migration chain and all Step 7/Step 5 API checks supply a real finalized dossier | PASS |
| [STEP8A-02](evidence/20261026144939_2663ec/step8a/generated/step8a-results.json) | no implicit ADMIN/reviewer/cross-term/department access; missing GUIDANCE phase blocks plan creation | PASS |
| [STEP8A-03](evidence/20261026144939_2663ec/step8a/generated/step8a-results.json) | weekly coverage detects overdue/missing obligations without plan or task; GET never creates data or false completion | PASS |
| [STEP8A-04](evidence/20261026144939_2663ec/step8a/generated/step8a-results.json) | only current official advisor creates a plan for the current finalized dossier, exact revision and finalization ID | PASS |
| [STEP8A-05](evidence/20261026144939_2663ec/step8a/generated/step8a-results.json) | concurrent/idempotent plan creation commits one ACTIVE plan with finalization/assignment revision and audit | PASS |
| [STEP8A-06](evidence/20261026144939_2663ec/step8a/generated/step8a-results.json) | task DTO rejects timezone-less input/forged status; foreign period and exclusive phase deadline are blocked | PASS |
| [STEP8A-07](evidence/20261026144939_2663ec/step8a/generated/step8a-results.json) | concurrent task creation uses plan CAS; DB scope/date constraints reject cross-term and inverted ranges | PASS |
| [STEP8A-08](evidence/20261026144939_2663ec/step8a/generated/step8a-results.json) | owner student starts/appends progress with idempotency; no self-completion or advisor impersonation | PASS |
| [STEP8A-09](evidence/20261026144939_2663ec/step8a/generated/step8a-results.json) | canonical and legacy task read routes both enforce owner/advisor/faculty scope; legacy array envelope remains compatible | PASS |
| [STEP8A-10](evidence/20261026144939_2663ec/step8a/generated/step8a-results.json) | concurrent task amendments preserve history; overdue derives from deadline without replacing workflow; scoped filters work | PASS |
| [STEP8A-11](evidence/20261026144939_2663ec/step8a/generated/step8a-results.json) | overdue alone never blocks progress while GUIDANCE remains open | PASS |
| [STEP8A-12](evidence/20261026144939_2663ec/step8a/generated/step8a-results.json) | editing a task with existing evidence requires explicit acknowledgement and never changes the old submission | PASS |
| [STEP8A-13](evidence/20261026144939_2663ec/step8a/generated/step8a-results.json) | explicit weekly materialization is unique/idempotent, uses configured dates/deliverables and never counts as a report | PASS |
| [STEP8A-14](evidence/20261026144939_2663ec/step8a/generated/step8a-results.json) | cancelling weekly work preserves obligation/history and allows one replacement, without exempting missing report | PASS |
| [STEP8A-15](evidence/20261026144939_2663ec/step8a/generated/step8a-results.json) | concurrent phase lock serializes with progress commit and leaves no late audit/progress write | PASS |
| [STEP8A-16](evidence/20261026144939_2663ec/step8a/generated/step8a-results.json) | invalid/reopened dossier blocks new task mutation even when plan metadata still claims ACTIVE | PASS |
| [STEP8A-17](evidence/20261026144939_2663ec/step8a/generated/step8a-results.json) | handover revokes old advisor, pauses writes and requires new advisor agreement/acknowledgement without losing tasks | PASS |
| [STEP8A-18](evidence/20261026144939_2663ec/step8a/generated/step8a-results.json) | audit failure rolls back task metadata, history and plan revision in the same transaction | PASS |
| [STEP8A-19](evidence/20261026144939_2663ec/step8a/generated/step8a-results.json) | cancel guards preserve historical submissions; task/plan history is append-only and technical audit avoids academic text | PASS |
| [STEP8B-01](evidence/20261026144939_2663ec/step8b/generated/step8b-results.json) | active migration chain replays with all Step 8A/7/5 real producer checks; only private loopback DB | PASS |
| [STEP8B-02](evidence/20261026144939_2663ec/step8b/generated/step8b-results.json) | unauthorized/non-owner/ADMIN/advisor/faculty upload rejected before staging metadata or IO | PASS |
| [STEP8B-03](evidence/20261026144939_2663ec/step8b/generated/step8b-results.json) | extension, MIME, content, unsafe ZIP paths/filename and oversized multipart rejected without orphan intent | PASS |
| [STEP8B-04](evidence/20261026144939_2663ec/step8b/generated/step8b-results.json) | READY private staging is idempotent, has no public URL/path and does not create a submission | PASS |
| [STEP8B-05](evidence/20261026144939_2663ec/step8b/generated/step8b-results.json) | owner commits report+source atomically with version, actor/time, official advisor/term and policy snapshot; idempotent replay | PASS |
| [STEP8B-06](evidence/20261026144939_2663ec/step8b/generated/step8b-results.json) | student/current advisor/scoped faculty can download attachments; cross-student/term/department/reviewer/old advisor/ADMIN denied | PASS |
| [STEP8B-07](evidence/20261026144939_2663ec/step8b/generated/step8b-results.json) | concurrent resubmission commits one v2; v1 bytes/content/links preserved, old state SUPERSEDED and DB immutability guards hold | PASS |
| [STEP8B-08](evidence/20261026144939_2663ec/step8b/generated/step8b-results.json) | staged/committed assets cannot be replayed onto a different task or student | PASS |
| [STEP8B-09](evidence/20261026144939_2663ec/step8b/generated/step8b-results.json) | deadline passed does not lock submission while phase open; server captures isLate/deadline snapshot | PASS |
| [STEP8B-10](evidence/20261026144939_2663ec/step8b/generated/step8b-results.json) | audit/metadata failure rolls back submission, current pointer, version counter, links and file claims together | PASS |
| [STEP8B-11](evidence/20261026144939_2663ec/step8b/generated/step8b-results.json) | locked GUIDANCE phase rejects both upload and uncommitted READY staging; no partial submission | PASS |
| [STEP8B-12](evidence/20261026144939_2663ec/step8b/generated/step8b-results.json) | real concurrent phase closure serializes against submission commit and rejects upload started before lock | PASS |
| [STEP8B-13](evidence/20261026144939_2663ec/step8b/generated/step8b-results.json) | storage failure leaves no READY metadata/submission and retains recoverable expired intent | PASS |
| [STEP8B-14](evidence/20261026144939_2663ec/step8b/generated/step8b-results.json) | metadata failure after writing bytes rolls back FileAsset and removes private orphan while retaining cleanup intent | PASS |
| [STEP8B-15](evidence/20261026144939_2663ec/step8b/generated/step8b-results.json) | expired unclaimed staging is quarantined/cleaned; committed files survive sweeps and expired references cannot submit | PASS |
| [STEP8B-16](evidence/20261026144939_2663ec/step8b/generated/step8b-results.json) | weekly obligation coverage consumes real submission pointer; no PASS/completion/evaluation is fabricated | PASS |
| [STEP8B-17](evidence/20261026144939_2663ec/step8b/generated/step8b-results.json) | explicit disabled policy and invalid/reopened dossier block upload without inventing missing ownership/finalization | PASS |
| [STEP8C-01](evidence/20261026144939_2663ec/step8c/generated/step8c-results.json) | complete active migration replay and all 8A→8B producer checks with real HTTP/private files; no shared database | PASS |
| [STEP8C-02](evidence/20261026144939_2663ec/step8c/generated/step8c-results.json) | inbox/options use current advisor roster and term scope; JWT role claims/ADMIN cannot bypass | PASS |
| [STEP8C-03](evidence/20261026144939_2663ec/step8c/generated/step8c-results.json) | 8A task→8B PDF/source→8C exact-version review/download; owner/faculty read, no unauthorized reviewer or IDOR | PASS |
| [STEP8C-04](evidence/20261026144939_2663ec/step8c/generated/step8c-results.json) | strict three-way DTO, required failure/revision comment and CAS reject invalid or stale writes | PASS |
| [STEP8C-05](evidence/20261026144939_2663ec/step8c/generated/step8c-results.json) | revision result stores immutable reviewer/version/time/comment; one notification/outbox/audit and idempotent effective decision | PASS |
| [STEP8C-06](evidence/20261026144939_2663ec/step8c/generated/step8c-results.json) | student sees revision requirement and submits v2; v1/comment/files remain and stale v1 review/amend is blocked | PASS |
| [STEP8C-07](evidence/20261026144939_2663ec/step8c/generated/step8c-results.json) | PASS of current v2 atomically completes task; student cannot submit on completed task | PASS |
| [STEP8C-08](evidence/20261026144939_2663ec/step8c/generated/step8c-results.json) | amend PASS→FAIL→REVISION_REQUIRED appends distinct decisions/reasons and recalculates task without overwriting history | PASS |
| [STEP8C-09](evidence/20261026144939_2663ec/step8c/generated/step8c-results.json) | concurrent amendments create one effective record, bounded retry/optimistic conflict and replay no duplicate | PASS |
| [STEP8C-10](evidence/20261026144939_2663ec/step8c/generated/step8c-results.json) | review amendment versus student resubmission serializes on same task and never concludes a superseded version | PASS |
| [STEP8C-11](evidence/20261026144939_2663ec/step8c/generated/step8c-results.json) | audit failure rolls back review, completion, pointers, history, notifications and outbox together | PASS |
| [STEP8C-12](evidence/20261026144939_2663ec/step8c/generated/step8c-results.json) | transactional in-app notices are self-only, generic and idempotently read; legacy notification IDOR closed with array shape preserved | PASS |
| [STEP8C-13](evidence/20261026144939_2663ec/step8c/generated/step8c-results.json) | confirmed meeting create/amend is scoped, versioned and audited; concurrent edits preserve original discussion/conclusion history | PASS |
| [STEP8C-14](evidence/20261026144939_2663ec/step8c/generated/step8c-results.json) | faculty metrics use real canonical task/review data with current advisor/student/department filters; weekly missing exists without manual task | PASS |
| [STEP8C-15](evidence/20261026144939_2663ec/step8c/generated/step8c-results.json) | no completion without effective current PASS; locked phase or reopened dossier blocks review mutation | PASS |
| [STEP8C-16](evidence/20261026144939_2663ec/step8c/generated/step8c-results.json) | real concurrent phase closure serializes with review commit and leaves no late conclusion/notification | PASS |
| [STEP8C-17](evidence/20261026144939_2663ec/step8c/generated/step8c-results.json) | legacy boolean review, graduation score and defense eligibility untouched; technical audit stores IDs/hashes rather than academic text | PASS |

## 5. Hành vi trình duyệt thực

Live advisor tạo plan/task; SV upload PDF+ZIP và commitv1; advisor REVISION_REQUIRED; SV nộp v2; advisor PASS; dashboard1completed nhưng 1weekly missing-task; notification và negative cross-owner view. 3 viewport mobile390px không overflow ngang trong màn tasks đã thử. Menu/session/contrast còn QA-002/003/004/006. Các màn upload/review mobile, mọi filepicker-error/modal/pagination UI chưa vét cạn. [Live E2E](evidence/20261026144939_2663ec/live-e2e/live-browser.json), [UI local](evidence/20261026144939_2663ec/ui-local/ui-results.json), [UI bổ sung](evidence/20261026144939_2663ec/ui-boundaries-final/results.json).

## 6. Lỗi đã xác nhận

QA-007: task creation và submission commit có audit/history nhưng không notice/outbox cho người nhận; E2E chỉ có 2notices cho2progress reviews. QA-008 về proposal event liên quan đầu vào. Không có corruption/IDOR canonical mới được tái hiện trong suite. Chi tiết [bug register](12-confirmed-bugs.md), không tự sửa trong audit.

## 7. Chức năng còn thiếu / chưa xác minh

Thông báo UC14/15 thiếu; evaluation theo criteria/điểm giai đoạn FR25 và cảnh báo theo ngưỡng/email là scope riêng chưa hoàn tất. Không tự áp weights/criteria hoặc triển khai bảo vệ9–10. Các giới hạn chung ở [scope](01-scope-and-requirements.md) và [missing features](13-missing-features.md).

## 8. UI/UX

Không có React pageerror trong lượt mở 29 route desktop/3 mobile. Điều đó không chứng nhận tất cảinteractions. [UI/UX report](07-ui-ux-report.md) phân biệt lỗi, empty/readiness và harness capture chưa ổn định.

## 9. API

53 nhóm scenario (19+17+17) gồm unauthorized-before-IO, unsafe ZIP, multipart oversized, idempotency, resubmit race, phase-lock race, audit/storage/metadata failures và cleanup staging. 8C kiểm review vs resubmit, amendments, notification IDOR/read, meetings và scoped metrics. Stress ZIP/event-loop và mọi MIME edge case NOT VERIFIED. [71-operation matrix](evidence/20261026144939_2663ec/api-operation-matrix.json) ghi riêng auth và authenticated statuses thực sự quan sát.

## 10. Database

Plan/task/submission/history/file claims/review/current pointers/audit/notice cùng transaction theo suite. 211 FK audit không orphan trong E2E. Task COMPLETED có effective RECORDED/PASS của current submission. TASK_SUBMISSION hiện chỉ index(id)/(id,task_id), thiếu index đầu task_id: catalog xác nhận, tác động tải lớn chưa đo. [DB audit](09-database-audit.md). Không migration/schema change trong audit.

## 11. Phân quyền

Current advisor review/manage; student progress/submit own; Khoa read dashboard trong grant; reviewer proposal không tự có quyền file tuần, ADMIN không bypass. Handover thu hồi GVHD cũ; scope được kiểm lại khi download/replay. [RBAC report](10-rbac-security-report.md).

## 12. Tích hợp

Phụ thuộc official assignment/grant/phase/profile/period/obligation của producer1–3. E2E giữ nguyên các rowproducer và không sinh FinalResult/DefenseEligibility. Consumer9–10 thật chưa nghiệm thu; không coi taskPASS là đủ bảo vệ hoặc điểm tốt nghiệp. [Integration report](11-integration-e2e-report.md).

## 13. Đề xuất và thứ tự ưu tiên

P2: notice transactional+idempotent đúng recipient; chốt owner criteria/reopen. P3/P4: UX menu/session/a11y. Đo N+1/locks/index/ZIP resource trước tối ưu; không nới guard vì performance chưa đo.

## 14. Điều kiện nghiệm thu

53 nhóm tiếp tục PASS, notice có recipient/link/count/rollback, signed-off producer config, cross-owner denied, mobile upload/review verified. Muốn tuyên bố full UC16 cần nghiệm thu FR25 theo cấu hình đã duyệt, không chỉ PASS report review. Mỗi nhánh chưa chạy tiếp tục NOT VERIFIED; không suy phần trăm hoàn thiện từ số test xanh.
