# Gói ổn định nền tảng H01/H02/H03/M04

Ngày: 27/10/2026. Workspace: `C:\DATN\Project1`.

## Kết quả và phạm vi

| Mục audit | Trạng thái | Kết quả |
|---|---|---|
| H01 Topic legacy | **DONE** | Permission/principal ở service; quản lý theo AcademicTermGrant; giữ chuẩn bị Bước 3 trước bàn giao; sau FINALIZED/bàn giao chỉ dùng official pointer, metadata chốt và AssignmentChange hiện hành. |
| H02 Outbox | **DONE trong phạm vi bảo vệ reader/retry toàn đợt** | Actor từ JWT, permission assignment:manage và grant đúng đợt; payload tổng hợp cần allDepartments=true; retry lấy term từ server, lock/CAS và audit trong transaction. |
| H03 Script database | **DONE ở mức guard + mock/static test** | Cleanup/reset cũ fail closed, không fallback URL ứng dụng; explicit disposable-test URL và xác minh identity/ownership trước DML/DDL; không chạy thật. |
| M04 Backend lint | **DONE** | Sửa 6 lỗi trong đúng 5 file test, không tắt rule; lint toàn bộ backend PASS. |

Không có phần bắt buộc của gói đang BLOCKED. Không mở quyền outbox từng bộ môn khi chưa có hợp đồng tách payload. Không triển khai hoặc tuyên bố hoàn thiện UC19–25/Bước 9–10.

Ba khóa C01 (score/committee/stats) giữ nguyên source, không mở lại; 30 regression test của ba reader tiếp tục PASS trong unit suite đầy đủ.

Working tree đã có thay đổi/untracked từ trước ở schema, migration, seed, package và UC17/PDF. Không stage/revert các thay đổi đó; không quy chúng cho gói này.

## H01: policy và tương thích

- TopicController và các route không thay đổi; thêm kiểm tra lại ACTIVE/mustChangePassword, đúng userId và topic:read/write trong TopicService.
- Tái sử dụng ProposalReviewSession/ProposalReviewValidator.principal và semantics grant hiện hành; helper thuần academicTermScope chỉ nhận grant của đúng actor/term. ADMIN/FACULTY không tạo quyền bằng role.
- Quản lý có grant bộ môn chỉ thấy proposal có routing ResearchAreaWorkflow khớp bộ môn; thiếu routing không tự cấp quyền. allDepartments=true bao phủ đợt. Ownership/GVHD là đường quyền độc lập, không yêu cầu grant quản lý cho chính hồ sơ được phân công.
- Trước bàn giao, plan PUBLISHED vẫn dùng để SV/GVHD chuẩn bị đề tài/nháp như Bước 3, không gọi đó là bằng chứng chính thức cho workflow sau.
- Khi đã FINALIZED hoặc proposal đã bàn giao: phải có officialAssignmentPlanId trỏ đúng plan cùng đợt, status FINALIZED, metadata người/thời điểm chốt hợp lệ, advisor hoạt động/thuộc roster; AssignmentChange mới nhất phải có revision/thời điểm và advisor hiện hành khớp. Thiếu hoặc mâu thuẫn trả conflict; không fallback PUBLISHED.
- GVHD cũ mất đường đọc/ghi theo phân công. Proposal đã bàn giao tiếp tục bị writer legacy từ chối; không đổi nội dung/version workflow Bước 4–8.
- Facts phân công/roster/routing được lấy theo lô trong cùng transaction cho API list, tránh vài truy vấn remote cho mỗi sinh viên.
- Không sửa TermWindowService, công thức điểm, schema hoặc migration.

Nguồn chính: `backend/src/topic/service/topic.service.ts`, `topic/repository/topic.repository.ts`, `common/security/academic-term-scope.policy.ts`. Consumer thật đã đọc: `frontend/src/features/topic/services/topic-api.ts` và `shared/data/snapshot-api.ts`.

17 test H01 bao phủ: chuẩn bị/nháp PUBLISHED; ownership sinh viên trước/sau bàn giao; không ghi legacy sau handover; ngoài grant/đợt/bộ môn; ADMIN không bypass; version/PDF ngoài scope; official pointer và FINALIZED; GVHD thay đổi; change mâu thuẫn/tương lai; thiếu permission/khóa tài khoản; proposal sai đợt. Bốn test helper grant dùng chung.

## H02: outbox

- GET /api/notifications/outbox/term/:termId và POST /api/notifications/outbox/:id/retry giữ nguyên method/path/permission decorator.
- Controller truyền actor xác thực; service kiểm tra lại actor, trạng thái tài khoản, password-change gate, assignment:manage và AcademicTermGrant.
- Outbox legacy có thể tổng hợp SV nhiều bộ môn trong một email. Để tránh cấp quyền chéo, hai thao tác tổng hợp yêu cầu **allDepartments=true** trên đúng đợt. Grant bộ môn không tự đủ thẩm quyền đọc/retry cả email.
- GET chỉ trả status metadata phục vụ frontend Bước 3: id/termId/userId/subject/status/attempts/lastError/availableAt/sentAt/messageId/createdAt. Không trả payload sinh viên, recipient hoặc leaseToken.
- Retry lấy termId từ outbox trên server, khóa THESIS_TERM trước EMAIL_OUTBOX, đọc lại, kiểm scope trong transaction; CAS chỉ FAILED → PENDING cho đúng id/term. Audit RETRY_EMAIL_OUTBOX cùng transaction, chỉ metadata cần thiết. Audit lỗi rollback; mất tranh chấp trạng thái trả 409.
- Không đổi worker claim/lease/backoff/template/delivery hoặc own-notification policy.
- Một fixture test Bước 8C được cập nhật thêm audit dependency mới; không đổi assertion/logic notification Bước 8.

12 unit test bao phủ permission, account, sai actor/đợt/grant, ADMIN/FACULTY, partial grant, projection không payload/lease, server-owned term, lock order, audit và rollback mô phỏng, CAS thất bại, không tồn tại, controller actor forwarding và principal mâu thuẫn.

## Consumer frontend và tránh regression Bước 1–8

Snapshot Bước 3 đang tải topic/outbox cùng các resource khác bằng Promise.all. Sau khi bỏ bypass, một 403 scope có thể làm lỗi toàn workspace.

Sửa tối thiểu consumer này:

- Chỉ bắt đúng HTTP 403 với mã TOPIC_SCOPE_FORBIDDEN hoặc OUTBOX_SCOPE_FORBIDDEN.
- Dữ liệu bị từ chối không được tải và không lấy lại từ demo; thêm academicAccessWarnings để layout hiển thị rõ phần chưa tải.
- Giữ các resource được phép và own notifications; không tự tạo notification/dữ liệu backend.
- 401, 403 khác, 500 và lỗi mạng vẫn propagate; không che lỗi xác thực/máy chủ.
- Không sửa API command, màn hình UC17/PDF hoặc workflow export Bước 1–8.

Bốn test frontend mới kiểm chứng snapshot còn dữ liệu được phép, cảnh báo phần không tải, không fallback demo và không nuốt lỗi 401/403 khác/500.

## H03: guard công cụ phá hủy

Chỉ hai entrypoint dọn/reset cũ được thay đổi: clean-data.mjs và reset-dev.sh. db-client.mjs/các công cụ chỉ đọc và các harness cô lập khác giữ nguyên.

- Không lấy DATABASE_URL, DIRECT_URL hoặc backend .env làm fallback.
- Bắt buộc GPMS_TEST_ALLOW_DESTRUCTIVE=1, run ID 16 hex, ownership token 48 hex và GPMS_TEST_DATABASE_URL riêng.
- Chỉ chấp nhận literal 127.0.0.1, cổng riêng khác 5432; database và user đều đúng gpms_disposable_<runId>; không arbitrary URL options.
- Tên/localhost không đủ: query chỉ đọc phải khớp current_database/current_user, database owner, server address/port, database ownership comment và role không SUPERUSER/CREATEDB/CREATEROLE.
- Guard không tạo DB/user/marker/env. Cần một provisioner disposable-test đã được xác minh riêng; chưa tạo provisioner hoặc cấu hình này trong lượt.
- Cleanup kiểm chứng trước BEGIN và kiểm chứng lại trước DELETE; reset kiểm chứng trước khi gọi Prisma CLI. Cả hai Prisma URL chỉ được truyền cho child process trỏ target test đã xác minh, không thay file connection string.
- Lỗi kết nối và output child không in credentials/connection string. Reset shell không còn gọi migrate reset trực tiếp từ môi trường dev.
- Không thực thi cleanup/reset thật. Test import helper/runner không có side effect, inject client và process launcher giả; entrypoint cleanup chỉ được đọc như text và kiểm tra syntax bằng node --check.

Tám node:test PASS gồm: thiếu config/no fallback; remote/default/wrong target; tên giả có marker sai; owner/role/port sai; inherited shared URLs bị bỏ qua; không spawn trước verify; child URL/argv an toàn; che lỗi chứa secret và thứ tự guard trong entrypoint.

Đây là bằng chứng guard ở mức mô phỏng/static. Chưa chứng minh cleanup/reset chạy thành công trên PostgreSQL, chưa kiểm tra tương thích SQL cũ với append-only/FK. Không dùng cleanup làm cách chuẩn bị dữ liệu chung.

## M04

- Hai permissions.spec dùng createRequire cho helper CJS không side effect, không import seed.cjs.
- Callback Function được thay bằng chữ ký có session/transaction.
- Bỏ import ReportRequest không dùng.
- Hai any trong final-report fixture được thay bằng ReportPrincipal/ReportProposal; bổ sung metadata timestamp fixture đúng type và assertion nullable khi fixture đã biết có window.
- Không sửa production logic để chữa lint, không sửa ESLint configuration.

## Kiểm tra thực sự đã chạy

| Kiểm tra | Kết quả |
|---|---|
| Backend full unit: vitest run, explicit exclude integration, xác nhận không ở GPMS_INTEGRATION=1 | **PASS 927/927, 61 file** |
| Frontend full unit | **PASS 280/280, 27 file** |
| Frontend scope tests sau sửa khai báo helper do lint | **PASS 11/11** |
| H03 node --test disposable-test-target.check.mjs | **PASS 8/8**, chỉ client/process giả + static |
| Backend tsc --noEmit --incremental false | **PASS** |
| Frontend tsc --noEmit --incremental false (chạy lại sau fix cuối) | **PASS** |
| Shared tsc --noEmit --incremental false | **PASS** |
| Backend lint toàn bộ src | **PASS**, sáu lỗi cũ đã hết |
| Frontend lint toàn bộ src (chạy lại sau fix cuối) | **PASS** |
| node --check database/scripts/clean-data.mjs | **PASS**, chỉ parse, không execute |
| git diff --check | **PASS** |
| PostgreSQL integration / migration / seed / reset / Docker | **SKIPPED theo ràng buộc**, không kết nối DB |
| Browser E2E / SMTP thật / fresh build | **NOT RUN**, không được suy PASS từ unit/typecheck |

Lượt kiểm tra đầu có ba lỗi TypeScript do fixture/dependency mới, đã sửa và chạy lại PASS. Frontend lint có một lỗi no-inner-declarations tại helper trong block, đã chuyển thành const callback và chạy lại lint/typecheck/test liên quan PASS. Không còn lỗi kiểm tra đang FAIL ở kết quả cuối.

Warning Vite CJS/useLayoutEffect SSR và cảnh báo cleanup cố ý trong unit test không làm test fail. Typecheck gọi trực tiếp để không tự build shared hoặc sinh output.

## File tạo/sửa trong gói

Danh sách chỉ gồm file của lượt này, không bao gồm thay đổi/untracked có trước.

| File | Thao tác |
|---|---|
| [backend/src/common/security/academic-term-scope.policy.ts](../../backend/src/common/security/academic-term-scope.policy.ts) | Tạo |
| [backend/src/common/security/academic-term-scope.policy.spec.ts](../../backend/src/common/security/academic-term-scope.policy.spec.ts) | Tạo |
| [backend/src/topic/service/topic.service.ts](../../backend/src/topic/service/topic.service.ts) | Sửa file hiện có trong working tree |
| [backend/src/topic/service/topic-access.spec.ts](../../backend/src/topic/service/topic-access.spec.ts) | Tạo |
| [backend/src/notification/controller/notification.controller.ts](../../backend/src/notification/controller/notification.controller.ts) | Sửa file hiện có trong working tree |
| [backend/src/notification/repository/notification.repository.ts](../../backend/src/notification/repository/notification.repository.ts) | Sửa file hiện có trong working tree |
| [backend/src/notification/service/notification.service.ts](../../backend/src/notification/service/notification.service.ts) | Sửa file hiện có trong working tree |
| [backend/src/notification/service/notification-outbox.spec.ts](../../backend/src/notification/service/notification-outbox.spec.ts) | Tạo |
| [backend/src/guidance/defense-confirmations/defense-confirmation-permissions.spec.ts](../../backend/src/guidance/defense-confirmations/defense-confirmation-permissions.spec.ts) | Sửa file hiện có trong working tree |
| [backend/src/defense/defense-lists/defense-list-permissions.spec.ts](../../backend/src/defense/defense-lists/defense-list-permissions.spec.ts) | Sửa file hiện có trong working tree |
| [backend/src/guidance/defense-confirmations/defense-confirmation-context.service.spec.ts](../../backend/src/guidance/defense-confirmations/defense-confirmation-context.service.spec.ts) | Sửa file hiện có trong working tree |
| [backend/src/guidance/final-reports/final-report.service.spec.ts](../../backend/src/guidance/final-reports/final-report.service.spec.ts) | Sửa file hiện có trong working tree |
| [backend/src/guidance/final-reports/final-report.controller.spec.ts](../../backend/src/guidance/final-reports/final-report.controller.spec.ts) | Sửa file hiện có trong working tree |
| [backend/src/topic/repository/topic.repository.ts](../../backend/src/topic/repository/topic.repository.ts) | Sửa file hiện có trong working tree |
| [backend/src/guidance/reviews/progress-review.spec.ts](../../backend/src/guidance/reviews/progress-review.spec.ts) | Sửa file hiện có trong working tree |
| [database/scripts/clean-data.mjs](../../database/scripts/clean-data.mjs) | Sửa file hiện có trong working tree |
| [database/scripts/reset-dev.sh](../../database/scripts/reset-dev.sh) | Sửa file hiện có trong working tree |
| [database/scripts/disposable-test-target.mjs](../../database/scripts/disposable-test-target.mjs) | Tạo |
| [database/scripts/reset-disposable-test.mjs](../../database/scripts/reset-disposable-test.mjs) | Tạo |
| [database/scripts/disposable-test-target.check.mjs](../../database/scripts/disposable-test-target.check.mjs) | Tạo |
| [database/scripts/DESTRUCTIVE-TOOLS.md](../../database/scripts/DESTRUCTIVE-TOOLS.md) | Tạo |
| [frontend/src/shared/data/types.ts](../../frontend/src/shared/data/types.ts) | Sửa file hiện có trong working tree |
| [frontend/src/shared/data/snapshot-api.ts](../../frontend/src/shared/data/snapshot-api.ts) | Sửa file hiện có trong working tree |
| [frontend/src/shared/data/registration-api.test.ts](../../frontend/src/shared/data/registration-api.test.ts) | Sửa file hiện có trong working tree |
| [frontend/src/app/layouts/WorkspaceLayout.tsx](../../frontend/src/app/layouts/WorkspaceLayout.tsx) | Sửa file hiện có trong working tree |
| [docs/audits/foundation-stability-h01-h02-h03-m04.md](foundation-stability-h01-h02-h03-m04.md) | Tạo báo cáo này |

## Chính sách/điều kiện còn cần quyết định và rủi ro

1. Muốn cấp đọc/retry outbox theo bộ môn cần duyệt cách tách/routing payload nhiều bộ môn. Hiện không tự cấp quyền này; chỉ người có permission + grant toàn đợt dùng được.
2. Trước test thật, nhóm phải cấu hình grant/routing/official assignment đúng dữ liệu. Không tự tạo grant, quyền mới hoặc dữ liệu mặc định. Tài khoản cũ dựa vào role bypass sẽ bị từ chối đúng chủ đích; frontend báo phần dữ liệu không được tải.
3. Chưa chạy PostgreSQL thật: isolation/row lock/CAS/audit rollback của H01/H02, FK và concurrency cần integration test cô lập. Unit transaction rollback là mô phỏng.
4. Guard destructive chưa có provisioner/DB test được xác minh hoặc runtime test thật; script SQL cũ có thể bị FK/append-only chặn ngay cả trên test DB. Không sửa SQL/schema để vượt constraint và không dùng DB chung thay thế.
5. Ba C01 vẫn fail closed, không phải hoàn thiện chính sách đọc chính thức. Các phát hiện khác của audit và UC18 FINALIZE/REOPEN, UC19–25 không được giải quyết bởi gói này.
6. Không có bằng chứng browser/SMTP/load/deployment thật; unit xanh không chứng minh toàn bộ Bước 1–8 đã được nghiệm thu lại trên PostgreSQL.

Có thể bắt đầu gói phát triển kế tiếp trên nền code này. Trước nghiệm thu/vận hành bằng dữ liệu thật, cần target PostgreSQL cá nhân/test đã xác minh và integration test cho quyền, bàn giao, retry/audit/lock. Không mở lại C01 để phục vụ test.

**Xác nhận:** không kết nối/thao tác database thật hoặc chung; không chạy migration/seed/db push/reset thật, không Docker; không thay schema/migration/seed/connection string hoặc ba endpoint C01.
