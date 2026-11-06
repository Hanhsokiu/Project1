# Hướng dẫn phát triển cho nhóm ba người

Trạng thái: nền tảng code đã kích hoạt schema additive trong repository. Migration đã replay local; **chưa deploy lên Supabase nhóm**. Tài liệu nghiệp vụ chuẩn vẫn là `01-business-decisions-and-contract.md`; hướng dẫn này chia việc và cách chạy, không bổ sung quy tắc học thuật.

## 1. Mỗi người chạy dự án

Dùng Node 20 theo `.nvmrc` để khớp CI, pnpm 9 theo CI/Docker; phiên kiểm thử Windows hiện tại dùng Node 24/pnpm 12 cũng đã build và test thành công. Không cần Make trên Windows.

```powershell
pnpm install --frozen-lockfile
pnpm setup:dev
pnpm verify
```

`setup:dev` chỉ tạo env còn thiếu, sinh JWT secrets ngẫu nhiên và giữ nguyên file đã tồn tại. Không kết nối database; placeholder trong env không có nghĩa DB đã hoạt động. `verify` generate client, kiểm compatibility/type-check/lint/tests/build; không migrate hoặc seed.

Để phát triển độc lập Supabase, cài/chạy Docker Desktop rồi:

```powershell
pnpm db:local:init
pnpm db:local:up
pnpm db:local:status
pnpm db:local:migrate
pnpm dev:local
```

Database riêng của mỗi máy: PostgreSQL17, `127.0.0.1:55440`, tên `btl_pr2b_dev`. Password/token do init sinh trong `.env.team.local` đã ignore. Không copy file đó giữa các máy. Script migrate/dev kiểm container đúng project/token/image/health/bind loopback và tự đặt DATABASE_URL/DIRECT_URL local trong process; không dùng URL Supabase đang có trong backend/.env. Không sửa backend/.env khi chuyển local/shared. Dev vẫn cần JWT/config hợp lệ từ setup.

`db:local:migrate` chỉ dùng cho DB mới: bridge đòi tất cả bảng ứng dụng rỗng. Nếu có dữ liệu hoặc lịch sử migration khác, lệnh fail thì kiểm tra history, **không reset/xóa volume**. DB local không tự seed học thuật/tài khoản/permission. Người 1 triển khai bootstrap tài khoản theo module auth; không dùng SQL seed cũ cấp toàn bộ quyền học thuật cho ADMIN như chính sách chuẩn.

Frontend `http://localhost:5173`; Nest API `http://localhost:3000/api`; Swagger dev `/api/docs`. `dev:local` không tự migrate. Dừng dev bằng Ctrl+C; dừng DB bằng `pnpm db:local:stop`, giữ volume. MailHog là tùy chọn qua compose cũ, không nằm trong compose DB riêng.

Máy hiện tại chưa có Docker khả dụng nên đường Docker mới đã kiểm bằng unit guard nhưng **chưa chạy end-to-end**. PostgreSQL portable local đã được dùng để xác minh migration và Nest boot thật. Nếu chưa cài Docker, vẫn code/type-check/test/build được; không gọi DB chung thay cho bài test.

`pnpm dev` thông thường dùng env ứng dụng đang cấu hình; khi backend/.env trỏ Supabase, nó sẽ kết nối shared. Dùng `dev:local` khi làm nghiệp vụ có ghi dữ liệu thử.

## 2. Phân chia phạm vi

| Người | Phạm vi | Backend | Frontend | Đầu ra tích hợp |
|---|---|---|---|---|
| 1 | Bước 1–3: auth/catalog/đợt/roster/đăng ký/phân công chính thức, đề tài UC11 | `auth/`, `catalog/`, `term/`, `registration/`; `topic/service/topic.service.ts`, `topic/controller/topic.controller.ts` hiện có cho Topic | `features/auth`, `catalog`, `term`, `registration`; `topic/pages/MyTopicPage.tsx` | Current user, roster, phase/routing, official assignment, Topic agreement, dữ liệu đầu vào proposal |
| 2 | Bước 4–8: nhóm/vòng duyệt, đề cương, chốt hồ sơ, hướng dẫn, task/bài/đánh giá/họp | File proposal/review/dossier mới trong `topic/`; `guidance/` cho hướng dẫn; `notification/` và storage chỉ sửa phần trực tiếp cần dùng | `features/topic` trừ MyTopicPage; `features/guidance` theo ranh giới hàng dưới | Approved version/dossier, nghĩa vụ tuần, progress review ba kết quả, minh chứng/handoff cho bước sau |
| 3 | Bước 9–10: báo cáo cuối, xác nhận/điều kiện/bảo vệ, chấm điểm/kết quả/xuất | `defense/`, `grading/`, `report/`; file riêng cho final-report/defense-confirm trong `guidance/` nếu thuộc use case mình phụ trách | `features/defense`, `grading`, `report`; `guidance/pages/FinalReportUploadPage.tsx`, `DefenseConfirmPage.tsx` | Bảo vệ/kết quả/điểm; đọc proposalId/planId ổn định và hồ sơ chốt, không suy quyết định từ boolean cũ |

Module folder không đồng nghĩa một người được sửa mọi chức năng trong folder. Final-report/defense-confirm nằm dưới guidance ở code hiện tại nhưng giao diện bàn giao thuộc người 3; người 2 giữ task/hướng dẫn. UC11 trong topic thuộc người 1, proposal/review/dossier thuộc người 2. Nếu tài liệu nghiệp vụ thực tế phân bước 9–10 khác, điều chỉnh **ownership file** cùng nhóm, không đổi quy tắc học thuật từ cách phân công này.

Các file dùng chung phải có một người tích hợp sau review: `backend/prisma/schema.prisma`, toàn bộ migrations, `shared/src/contracts/`, `app.module.ts`, `topic.module.ts`, `guidance.module.ts`, router/layout/menu, common auth/error/storage, package/lockfile, CI/env/Docker. Mỗi người đề nghị thay đổi qua PR của mình; người tích hợp gom từng thay đổi nhỏ. Không tạo ba bản schema hoặc ba cây migration.

Gợi ý nhánh: `feat/steps-1-3-*`, `feat/steps-4-8-*`, `feat/steps-9-10-*`; nhánh foundation được review/merge trước, rồi cả ba rebase lên cùng mốc. Chưa tạo nhánh/commit/stage tự động trong phiên chuẩn bị này.

## 3. Contract bàn giao bắt buộc

Các type đã thêm vào `shared/src/contracts/academic-context.ts` và export từ `@doan/shared`; chỉ là type, chưa có producer/endpoint runtime. Đọc đầy đủ PR1 §3/§5/§6 thay vì suy policy từ type.

| Producer → Consumer | Contract/dữ liệu | Điều kiện nghiệm thu |
|---|---|---|
| Người 1 → Người 2/3 | CurrentUserResponse; UserAccount/Student/Lecturer identities | principal.userId từ JWT sub sau verify, trạng thái account/quyền hiện hành; không lấy actor trong body. REVIEW_GROUP_MEMBER là membership, không thêm JWT role mới |
| Người 1 → Người 2 | ThesisTerm, TermStudent, TermLecturer, phase mapping/revision, ResearchAreaWorkflow.departmentId, grants | Cùng term; phase `[start,end)`; thiếu mapping trả INPUT_NOT_READY, không lấy đợt mới nhất hoặc bộ môn GVHD thay routing |
| Người 1 → Người 2 | OfficialAdvisorContext; TermWorkflow.officialAssignmentPlanId, AssignmentPlanWorkflow, AssignmentChange | Chỉ FINALIZED và pointer chính thức; PUBLISHED/thuật toán chưa lưu không đủ. Không suy finalizedAt/effectiveAt; producer phải cung cấp bằng chứng |
| Người 1 ↔ Người 2 | TopicAgreement, ownership TopicWorkflow; SubmittedProposalContext | UC11 xác nhận đúng topic/assignmentRevision; version nộp SEALED đúng Proposal. Người 2 lưu/submit version; không suy “latest” là bản đã nộp |
| Người 1 ↔ Người 2 | GuidancePeriodContext, PeriodRequiredStudent | Khoa cấu hình tuần/hạn/danh sách áp dụng; coverage không phụ thuộc task. Chốt trách nhiệm materialize tại một command, có idempotency và transaction |
| Người 1 ↔ Người 2 | Command khóa phase/handover | Cùng transaction/lock protocol với submit/pause/history; phát event bất đồng bộ đơn thuần không đủ bảo đảm phase tại commit |
| Người 2 → Người 3 | proposalId, planId, dossier current finalization + version/hash, nhiệm vụ/bài/review hiện hành, final-report file sau khi có chức năng | Người 3 đọc hợp đồng rõ ràng, không tự sửa ProposalVersion hoặc bỏ qua scope; điều kiện đủ bảo vệ/công thức điểm theo nguồn bước 9–10, không tự suy từ PASS của task |

Mapping vật lý quan trọng: PR1 logical Topic.termStudentId → TopicWorkflow.termStudentId; ThesisTerm officialPlan → TermWorkflow; submittedVersionId → ProposalWorkflow; review decision mới → ProposalReviewDecision; TaskReview ba kết quả → **ProgressReview**, không phải bool legacy TaskReview.isPassed.

Hiện JWT guard vẫn đưa claims sub vào request.user; CurrentUserPayload cũ khai báo userId chưa đồng bộ. Đây là công việc auth của người 1, cần test giữ response login cũ. Không được xem type mới là adapter đã chạy. Tương tự `docs/api/openapi.yaml`/Swagger chỉ phản ánh code hiện có, endpoint PR1 là contract cần triển khai, chưa tồn tại chỉ vì đã có schema.

## 4. Những quy tắc cả ba phải giữ

- Một nguồn migration: `backend/prisma/migrations`. `database/migrations`/seed SQL cũ chỉ tham chiếu. Không chỉnh 0_init hoặc migration đã áp dụng; không db push/reset/migrate dev lên shared.
- Active schema có 94 model và 27 enum; 56 model/11 enum cũ giữ nguyên contract, thêm 38 model/16 enum. Topic.proposals[], Student.proposal và unique Proposal.studentId vẫn giữ ở expand. Multi-term đầy đủ cần migration contract riêng, chưa bỏ unique này trong feature PR.
- Không backfill ownership/approval/receipt/assignment/file hoặc đổi false thành FAIL/REVISION_REQUIRED. Missing input trả lỗi contract, không dựng dữ liệu giả để chạy tiếp.
- Không tự coi ADMIN có quyền học thuật. Nest JWT/RBAC giữ nguyên; authorization mới cần role + scope + quan hệ + trạng thái, không chỉ decorator permission. Frontend không dùng Supabase SDK để đi vòng Nest.
- Không tự sửa response cũ thành envelope mới. `frontend/src/shared/types/api.ts` có wrapper nhưng backend hiện còn nhiều response raw; từng endpoint cần adapter và regression test rõ ràng, không giả rằng wrapper đã được áp dụng toàn cục.
- ID là opaque string; không áp validator UUID mới lên seed ID cũ. Shared RegistrationPrefSchema cũ có uuid() cần người 1 đối chiếu lúc triển khai input đó, không tái dùng cho toàn bộ contract mới.
- Transaction có CAS revision, unique business keys và AuditLog/history cùng commit. Retry không được gửi email trùng; dùng outbox. Thay review phải supersede + cập nhật current pointer/tính lại task trong cùng transaction; schema không tự làm toàn bộ workflow.
- File thật phải kiểm scope/type/size/trạng thái trước gắn metadata; không lộ secret trong VITE_*, log hoặc commit. Password/secret đã từng gửi qua chat cần được thay trước khi dùng môi trường nhóm lâu dài.

## 5. Test và tiêu chí merge

Mỗi PR chạy `pnpm verify`; thay DB chạy thêm rehearsal trên **DB mới riêng** và test transaction/concurrency liên quan. `verify` không kết nối DB, không thay thế integration test. CI có PG16 job hiện tại và PG17 rehearsal/smoke riêng, không URL Supabase.

Các script integration chỉ nhận `PR2B_TEST_URL` loopback, database rỗng tên `btl_pr2b_*`, PG17; cần psql trong PATH hoặc PR2B_PSQL. Dùng database rỗng **khác nhau** cho từng runner:

```powershell
pnpm --filter @doan/backend pr2b:rehearse
pnpm --filter @doan/backend pr2b:replay-chain
pnpm --filter @doan/backend db:test:active-chain
# Dùng lại DB active-chain vừa kiểm thử cho smoke, sau khi build:
pnpm --filter @doan/backend test:smoke:local
```

Rehearsal 29 checks bao gồm legacy payload, false giữ nguyên, cross-term, một quyết định chung, CAS, weekly coverage, audit và rollback. Active-chain kiểm migration **thật trong repository** với canonical @prisma/client. Smoke khởi động toàn bộ Nest modules, kiểm GET students không token trả 401; không phải test đầy đủ nghiệp vụ.

PR nhỏ theo use case; ghi rõ producer/consumer, file chung cần phối hợp, lỗi/precondition và test đã chạy. Không sửa schema riêng để chữa lỗi thiếu producer. Người 2 có thể viết policy/DTO/service/test theo PR1 ngay, người 3 phát triển trên proposalId/planId hiện hữu và mock typed contract khi đầu ra người 2 chưa có.

## 6. Deploy Supabase là thao tác riêng

Nền tảng local sẵn sàng để code. Supabase chung **chưa có migration mới từ phiên này**. Không cần deploy để ba người bắt đầu làm độc lập.

Trước deploy: read-only catalog/data/history mới nhất, xác nhận baseline rỗng cho bridge, backup/recovery và backend DB role; thống nhất quyền Data API (SQL thu hồi PUBLIC/anon/authenticated/service_role trên allowlist bảng ứng dụng), lịch triển khai và approval riêng. Nếu có client nhóm dùng Data API trực tiếp, dừng phần thu hồi quyền để thống nhất, không sửa API âm thầm.

Vẫn còn drift legacy native type/nullability/default/FK/onDelete và SQL-only constraints đã nêu trong PR2B. Không chạy residual-drift.DO-NOT-APPLY.sql, không tự reconcile bằng Prisma diff. Giữ baseline compatibility là chủ ý của expand; mọi thay đổi contract/nullability/onDelete cần PR phối hợp. Replay/deploy thành công không có nghĩa zero drift hay production-ready.

## 7. Bàn giao đầu vào in hồ sơ bước 7

Bước 7 đã có route `/topic/dossier` và API dossier/finalize/pdf/receipt; chi tiết ở [báo cáo bước 7](07-step7-implementation-report.md). Migration additive mới `202610220003_dossier_finalization` chưa triển khai lên Supabase chung. Không đổi cardinality/field/unique legacy.

Theo quyết định người dùng, **người 1 cung cấp lớp/ngành thật; thiếu thì chặn chốt**, người 2 không thêm form nhập thay. Contract producer mới: `DossierStudentProfile` (`DOSSIER_STUDENT_PROFILE`) có termStudentId PK/FK, className, majorName và revision. Producer phải xác nhận dữ liệu, ghi audit, tăng revision và dùng chung term lock khi sửa. Bước 7 chỉ đọc; không tạo profile/seed/backfill chính thức. Khi producer chọn nguồn dữ liệu khác cần thống nhất adapter rõ ràng trước sửa contract, không đoán mapping.

Người 3 đọc mốc chốt từ DossierWorkflow.currentFinalizationId → DossierFinalization.versionId/finalizedAt và printSnapshot/hash. DTO gọi versionId là approvedVersionId. Receipt là chứng cứ nhận giấy riêng; không suy từ Proposal.APPROVED, legacy ThesisDossier.status hoặc tải PDF. PDF private lưu qua FileAsset + DossierPdfContent; chỉ dùng secure endpoint có JWT/scope, không dùng Supabase Data API/public bucket URL để bỏ qua quyền.

```powershell
# Xem thử bước 7 bằng Edge + dữ liệu/PDF mẫu; không Docker/backend/DB
pnpm --filter @doan/frontend preview:proposal-dossiers
pnpm --filter @doan/frontend preview:proposal-dossiers --student
```

Hai command API/upgrade `test:proposal-dossiers:api` và `test:proposal-dossiers:upgrade` ở backend chỉ chạy trên database test mới riêng có PR2B_TEST_URL theo guard hiện hữu. `test:proposal-dossiers:browser` ở frontend dùng API giả lập. Bước 8/reopen chưa được triển khai trong bước 7; không tự mở khóa Proposal/Dossier bằng SQL.

## 8. Bàn giao bước 8A — kế hoạch và nhiệm vụ

Bước 8A hiện có `/guidance/plan`, `/guidance/tasks`, API kế hoạch/task/tiến độ và coverage nghĩa vụ tuần. Xem [báo cáo 8A](08a-guidance-task-implementation-report.md). Migration `202610220004_guidance_task_management` thêm bốn field nullable vào TaskWorkflow cùng index/owner/date guards; chưa deploy Supabase. Legacy TaskStatus và API array `/tasks/plan/:planId` giữ shape, nhưng đường legacy đã được bổ sung permission/scope để chặn đọc submissions của SV khác.

Người 1 cung cấp phase GUIDANCE trong term IN_PROGRESS, GuidancePeriod, PeriodRequiredStudent và WeeklyReportObligation/configSnapshot đúng `WeeklyObligationConfigSchema` trong shared. Schema snapshot có schemaVersion, termId/periodId/termStudentId, periodRevision, startsAt/reportDueAt, expectedDeliverables; configRevision khớp period revision. Không tự đặt lịch/đối tượng áp dụng, không lấy task tồn tại làm bằng chứng đã có báo cáo tuần. Producer khóa phase/handover dùng cùng lock order; bàn giao hoặc mở lại phải pause plan, giữ mọi bài và task. GVHD hiện hành resume bằng acknowledgeRebase sau khi agreement/bản chốt đã hợp lệ.

SV chỉ start/append note, không tự COMPLETED. Quá hạn là derived flag. Khoa đọc tổng hợp theo grant; reviewer membership/ADMIN không tự có quyền guidance. Consumer bước 9–10 dùng TaskWorkflow.state hoặc DTO canonical, không dựa raw Task.status/TaskReview.isPassed. Upload/policy file đã triển khai ở 8B; đánh giá từng báo cáo, nhật ký và dashboard ở 8C bên dưới.

```powershell
pnpm --filter @doan/frontend preview:guidance-tasks
pnpm --filter @doan/frontend preview:guidance-tasks --student
pnpm --filter @doan/frontend preview:guidance-tasks --faculty
```

Các demo mở Edge port 50177, API mock và dữ liệu bộ nhớ, không backend/DB/Docker. Backend có `test:guidance-tasks:api` / `test:guidance-tasks:upgrade` cho DB test mới riêng; frontend có `test:guidance-tasks:browser`. Không dùng database nhóm để chạy các fixture.

## 9. Bàn giao bước 8B — báo cáo tuần và source

Chi tiết tại [báo cáo 8B](08b-weekly-submissions-implementation-report.md). Route `/guidance/tasks/:id/submissions`, link **Báo cáo tuần và source** trong chi tiết nhiệm vụ. Chỉ SV owner nộp; GVHD hiện hành/Khoa có scope được xem và tải. File qua staging private → xác nhận nộp atomic, giữ các version cũ và audit; không auto-complete hoặc đánh giá.

Policy người dùng đã duyệt: 1 PDF báo cáo + 1 ZIP source, tối đa 3 minh chứng PDF/PNG/JPEG, 20 MiB/file, 50 MiB/bài; ZIP tối đa 1.000 entries/200 MiB giải nén, không mã hóa/path nguy hiểm; staging 24 giờ, bài đã nộp không tự xóa. `GUIDANCE_UPLOAD_ENABLED` mặc định true; JSON override `GUIDANCE_UPLOAD_POLICY_JSON` phải qua shared schema và phê duyệt, restart backend sau sửa env. Không ghi credentials vào frontend.

Migration additive `202610220005_guidance_submissions` thêm intent staging và snapshot nullable, chưa deploy Supabase. Storage dùng FileStorageService hiện có với thư mục private trên volume uploads; không mount thư mục đó public. Backup cả DB và volume. Consumer dùng SubmissionWorkflow/currentSubmissionId + SubmissionAsset + secure download, không lấy raw SubmissionFile.filePath làm URL và không suy completion từ SUBMITTED.

```powershell
# Demo 8B không cần Docker/DB; port 50178, chỉ Edge được mở có API mock
pnpm --filter @doan/frontend preview:guidance-submissions
pnpm --filter @doan/frontend preview:guidance-submissions --advisor
pnpm --filter @doan/frontend preview:guidance-submissions --faculty
# Kiểm thử browser mock
pnpm --filter @doan/frontend test:guidance-submissions:browser
```

Backend `test:guidance-submissions:api` và `test:guidance-submissions:upgrade` chỉ dùng database mới riêng PG17 loopback `btl_pr2b_*` với PR2B_TEST_URL đã guard. Không dùng DB nhóm. Nộp muộn vẫn nhận khi phase mở; khóa/handover phải phối hợp lock order từ 8A, không coi lúc bắt đầu upload là đã nộp. 8B không chấm bài; phần đánh giá PASS/FAIL/REVISION_REQUIRED được bàn giao tại 8C dưới đây.

## 10. Bàn giao bước 8C — đánh giá báo cáo và theo dõi

Chi tiết ở [báo cáo 8C](08c-progress-review-implementation-report.md). GVHD có `/guidance/review` để lọc bài đã nộp/chờ đánh giá, mở đúng submission version, tải file private và ghi một kết quả hiệu lực. FAIL và REVISION_REQUIRED giữ dữ liệu riêng dù đều yêu cầu nộp lại; nhận xét bắt buộc cho hai mức này. PASS hoàn thành task, không tính điểm/điều kiện bảo vệ. Sửa đánh giá phải có lý do/revision và tạo bản mới; khi có v2 không được amend v1.

SV mở **Báo cáo tuần và source → Xem nhận xét và đánh giá** hoặc thông báo cá nhân. Khoa dùng `/guidance/progress` theo grant đợt/bộ môn, lọc GVHD/SV; task stats tách khỏi nghĩa vụ tuần chưa có task. Dữ liệu legacy/chưa cấu hình được cảnh báo, không đếm giả thành đã hoàn thành hoặc không thiếu báo cáo.

Nhật ký đã có `/guidance/meetings?planId=...`, link từ kế hoạch 8A; create/amend theo contract đã duyệt, giữ before/after/actor/reason. `/guidance/notifications` chỉ đọc thông báo của principal và mark-read; đường legacy `/notifications/user/:userId` đã có owner guard, giữ shape array. Review và thông báo/outbox/audit commit cùng transaction; chưa có worker email hoặc ngưỡng cảnh báo chậm tự động.

Migration `202610230001_guidance_reviews` chỉ thêm ba index, quyền task:review/guidance:monitor và deferred review guards trên model đã có, chưa deploy Supabase. Không gán academic bypass cho ADMIN. Người 1 giữ contract official assignment/roster/agreement/phase/grant/period và lock protocol; người 3 dùng current canonical PASS/task state làm dữ liệu tham khảo, không tự suy đủ bảo vệ/điểm tốt nghiệp. FR25 criteria/điểm giai đoạn vẫn là phạm vi riêng cần cấu hình đã duyệt.

```powershell
# Edge demo 8C port 50179, API mock; không Docker/backend/database
pnpm --filter @doan/frontend preview:guidance-reviews
pnpm --filter @doan/frontend preview:guidance-reviews --student
pnpm --filter @doan/frontend preview:guidance-reviews --faculty
pnpm --filter @doan/frontend test:guidance-reviews:browser
# API/upgrade chỉ DB test mới riêng PR2B_TEST_URL theo guard PG17 loopback
pnpm --filter @doan/backend test:guidance-reviews:api
pnpm --filter @doan/backend test:guidance-reviews:upgrade
```

Không dùng Supabase nhóm để chạy fixture. Kết quả thực tế và các giới hạn kiểm thử được ghi riêng trong báo cáo; Supabase deploy vẫn là thao tác phê duyệt riêng, không đi kèm command demo hay chạy dev.

## 11. Kiểm thử tích hợp toàn bộ bước 4–8

Xem [báo cáo integration](05-integration-test-report.md) và evidence đi kèm. Đã có E2E thật Edge → Vite → Nest → PostgreSQL/private storage, từ đăng nhập và tạo nhóm tới sửa v2/chốt/PDF/giao việc/nộp lại/Đạt/dashboard. Seed tổng hợp tự chạy trên DB test mới; không dùng DB nhóm hoặc reset dữ liệu cũ.

```powershell
pnpm verify
# PR2B_TEST_URL: DB test riêng PG17, host 127.0.0.1, tên btl_pr2b_*, coordinator rỗng
pnpm --filter @doan/backend test:integration:steps4-8:suite
pnpm --filter @doan/backend test:integration:steps4-8:browser
# E2E cần PR2B_TEST_URL là một DB test RỖNG mới, runner tự replay + seed
pnpm --filter @doan/backend test:integration:steps4-8:e2e
```

**Chưa kết luận sẵn sàng merge toàn hệ thống:** core 4–8 đã PASS nhưng probe bảo mật phát hiện legacy `/topics/term/:termId` và `/registrations/term/:termId` vẫn trả dữ liệu cho account không role/SV khác đợt. E2E command hiện exit 1 để giữ blocker này hiển thị. Cần phối hợp người 1 chốt/sửa contract đọc legacy rồi chạy lại; không bỏ negative probes hoặc coi demo mock là kiểm thử backend thật.
