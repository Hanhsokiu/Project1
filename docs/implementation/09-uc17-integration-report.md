# UC17 trên hệ thống B1–B8 của nhóm

**Bổ sung review 09/11/2026:** [09-uc17-live-schema-review.md](09-uc17-live-schema-review.md) ghi metadata Supabase mới do người dùng cung cấp và hardening candidate SQL, không query/apply database. Thêm FILE_ASSET metadata/DELETE guard, claim row UPDATE hai chiều, fail khi RLS che references và capability checks chặt hơn; schema.diff/Prisma model không đổi trong lượt review. Tất cả 10 REPORT assets hiện có thuộc weekly, không adopt. Full regression mới Backend 868 / Frontend 385 tests PASS; trigger/transaction/ACL runtime thật vẫn NOT VERIFIED. Số liệu/tests phía dưới là ghi nhận lịch sử trước review này; trạng thái toàn UC17–UC25 ở overall report.

Ngày: 07/11/2026. Phạm vi: PDF đồ án cuối, đánh giá tổng kết GVHD và xác nhận bảo vệ. Không triển khai UC18–UC25.

## Git và giới hạn thao tác

- Workspace: `E:\Project-Xaydungdoantotnghiep\DATN_Backup\Project1`.
- Nhánh tạo bằng `git switch -c`: `feature/b9-b10-implementation`.
- Base: `0093f81a6017a8e046a03a8ce9786189cd5b37d8`, giống `fix/integration-ui` và remote-tracking ở thời điểm bắt đầu.
- Không sửa ref `fix/integration-ui`, không commit/push, reset/clean/stash, clone hoặc tạo worktree/thư mục dự án mới.
- Không lấy lại implementation UC17 đã xóa. Không thay `.env`, uploads, dữ liệu local hoặc file Word tạm.
- Chỉ chạy build, kiểm tra tĩnh, test synthetic trong tiến trình HTTP loopback cô lập và đọc metadata Supabase. Không khởi chạy AppModule kết nối database chung để test.

## Database thực tế và các bảng tận dụng

Đã đọc trực tiếp metadata Supabase trong transaction `READ ONLY` có timeout và TLS. Script chỉ xuất tables/columns/constraints/enums, không xuất URL, credentials, JWT hoặc application rows. Bằng chứng: [09-uc17-supabase-schema.json](09-uc17-supabase-schema.json). Script: `backend/scripts/inspect-final-defense.cjs`.

| Bảng hiện có                                                                                                   | Cách sử dụng                                                                                              |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| USER_ACCOUNT, USER_ROLE, ROLE_PERMISSION                                                                       | Tài khoản ACTIVE, vai trò thực tế và permission thuộc đúng vai trò; dùng JWT/session guard hiện có        |
| STUDENT, LECTURER                                                                                              | Chủ hồ sơ và GVHD đang hoạt động                                                                          |
| TERM_STUDENT, TOPIC, TOPIC_WORKFLOW, PROPOSAL                                                                  | Kiểm tra đúng sinh viên, đề tài, đợt và revision xác nhận đề tài của B1–B8                                |
| THESIS_TERM, TERM_PHASE                                                                                        | Dùng `operationWindow(term, 'FINAL')`; không dùng lịch tuần và không hard-code ngày                       |
| TERM_PARAMETER                                                                                                 | Đọc policy theo đợt, key `UC17_POLICY`; không tạo policy bằng GET                                         |
| TERM_WORKFLOW, ADVISOR_ASSIGNMENT, ASSIGNMENT_PLAN, ASSIGNMENT_PLAN_WORKFLOW, ASSIGNMENT_CHANGE, TERM_LECTURER | Dùng validator phân công chính thức hiện có; kiểm tra official plan FINALIZED, roster và lịch sử bàn giao |
| ACADEMIC_TERM_GRANT, GRANT_DEPARTMENT, RESEARCH_AREA_WORKFLOW                                                  | Phạm vi đọc của Khoa theo đợt/bộ môn                                                                      |
| FINAL_REPORT                                                                                                   | Hồ sơ PDF cuối hiện có; thêm revision cho aggregate                                                       |
| DEFENSE_CONFIRMATION                                                                                           | Lưu PENDING / CONFIRMED / REJECTED; gắn quyết định với PDF và context hiện hành                           |
| SCORE_ENTRY                                                                                                    | Tái sử dụng bản ghi role ADVISOR, không lưu điểm tổng kết vào đánh giá tuần                               |
| FILE_ASSET                                                                                                     | Metadata, checksum, người nộp, trạng thái quarantine/ready của file private                               |
| AUDIT_LOG                                                                                                      | Snapshot cũ/mới và lịch sử thao tác trong cùng transaction ghi                                            |
| IDEMPOTENCY_RECORD                                                                                             | Actor + method + route + key + hash nội dung và kết quả replay                                            |

UC14–UC16 và các bảng đánh giá tuần không bị đổi ý nghĩa. Giao diện có liên kết tới kế hoạch/nhiệm vụ và báo cáo tuần để GVHD xem minh chứng. Không dùng việc hoàn thành nhiệm vụ hoặc điểm số làm kết luận học vụ tự động.

Metadata kiểm tra trực tiếp có 16 bảng trong tập mục tiêu hiện hữu; các quan hệ upstream còn lại được đối chiếu từ Prisma schema và source B1–B8. Không tuyên bố đã đọc application rows hoặc kiểm chứng mọi bảng upstream trên server.

## Phần schema cần bổ sung

Prisma schema được mở rộng ngay tại `backend/prisma/schema.prisma`, dùng cùng datasource/client của hệ thống. SQL để review: [migration.sql](../../backend/prisma/review/final-defense/migration.sql). **Chưa áp dụng**; file nằm ngoài active deploy chain để tránh tự động bị chạy bởi `migrate deploy` hiện tại.

Chỉ thêm một bảng `FINAL_REPORT_VERSION`: FK về FINAL_REPORT và FILE_ASSET, số phiên bản, ngày nộp, unique theo hồ sơ/số phiên bản và file asset. Không tạo nhóm bảng UC17_* hay database nghiệp vụ thứ hai.

Mở rộng bảng hiện có:

- FINAL_REPORT: `revision` mặc định 0.
- DEFENSE_CONFIRMATION: `revision`, `report_version_id` nullable, `context` nullable.
- SCORE_ENTRY: `revision`, `report_version_id` nullable, `comment` nullable, `context` nullable.

SQL có FK phiên bản, trigger kiểm tra phiên bản thuộc đúng proposal, file là private ready PDF và không phải asset của bài nộp tuần; phiên bản PDF append-only; RLS cho bảng mới và không cấp quyền trực tiếp cho anon/authenticated. Migration cũng thêm permission UC17 và mapping vai trò cần thiết. Đây là thay đổi quyền phải được review cùng schema.

Không backfill hoặc tự chuyển file legacy thành phiên bản PDF hợp lệ. Quyết định cũ chưa có binding hiển thị `LEGACY_UNVERIFIED`. Hồ sơ report đã tồn tại nhưng chưa có phiên bản cần đối soát trước khi nộp tiếp. Việc xóa hồ sơ đã có phiên bản sẽ bị FK/append-only chặn; nhóm cần chấp nhận điều này trong quy trình lưu trữ.

## Backend, API và permission

Files mới:

- `backend/src/guidance/final-defense/final-defense.controller.ts`
- `backend/src/guidance/final-defense/final-defense.repository.ts`
- `backend/src/guidance/final-defense/final-defense.service.ts`
- `backend/src/guidance/final-defense/final-defense.validator.ts`
- Hai file test `final-defense.spec.ts`, `final-defense.http.spec.ts` cùng thư mục.
- `backend/test/final-defense.fixture.ts`: transaction/storage synthetic, không tạo PrismaClient hoặc đọc `.env`.
- `backend/scripts/inspect-final-defense.cjs`: metadata-only inspection.
- `backend/src/grading/service/score.service.spec.ts`: bảo vệ đường đọc điểm legacy.

Files sửa: `guidance.module.ts` để đăng ký trong module hiện có; `config/environment.ts` để có flag ghi mặc định false; `grading/service/score.service.ts` để API điểm legacy không làm lộ điểm GVHD; Prisma schema.

| API (sau API_PREFIX của hệ thống)                               | Permission                  |
| --------------------------------------------------------------- | --------------------------- |
| GET /final-defense/options                                      | defense-confirmation:read   |
| GET /final-defense?termId=...&page=...&limit=...                | defense-confirmation:read   |
| GET /proposals/:proposalId/final-report                         | defense-confirmation:read   |
| POST /proposals/:proposalId/final-report/pdf                    | final-report:create         |
| GET /proposals/:proposalId/final-report/versions/:versionId/pdf | final-report:download       |
| POST /proposals/:proposalId/final-report/review                 | defense-confirmation:review |
| POST /proposals/:proposalId/final-report/decide                 | defense-confirmation:decide |

Các POST yêu cầu Idempotency-Key. Review/decide và upload đều yêu cầu expectedRevision; review/decide yêu cầu đúng reportVersionId hiện hành. API hỗ trợ imported VARCHAR IDs của B1–B8, không bắt buộc mọi ID cũ là UUID.

Ngoài permission ở guard, service đọc principal và kiểm tra quan hệ tại backend. STUDENT chỉ nộp hồ sơ của mình; LECTURER chỉ review/decide cho phân công chính thức; FACULTY chỉ đọc trong grant. ADMIN không được tự coi là vai trò học vụ. Kiểm lại quyền sau lock; ghi theo Serializable và CAS revision, audit/idempotency cùng transaction. Lỗi validation/auth/scope/not-found/conflict trả 400/401/403/404/409; quá dung lượng trả 413.

Quyền đọc tách riêng: `final-report:read`, `defense-confirmation:score-read`, `comment-read`, `rejection-read`, `status-read`. Mapping mặc định không cấp điểm, nhận xét, lý do hoặc audit snapshot cho sinh viên/Khoa. Khoa được xem trạng thái. Audit có nội dung nhạy cảm chỉ trả cho GVHD chính thức có đủ ba quyền đọc điểm/nhận xét/lý do.

API legacy `/scores/proposal/:proposalId` trước đây thiếu kiểm tra scope. Trong phạm vi dependency UC17, query legacy loại role ADVISOR và chọn rõ các cột cũ để tránh lộ điểm UC17 hoặc tham chiếu cột migration chưa có. Điểm GVHD đi qua API UC17 có scope. Đây là thay đổi hành vi cần nhóm lưu ý khi tích hợp; không bổ sung nghiệp vụ chấm phản biện/hội đồng.

## Policy và hiệu lực quyết định

Shared Zod contract mới: `shared/src/contracts/final-defense.ts`, export qua `shared/src/index.ts`.

Policy cần có version, APPROVED, người/ngày duyệt, bước điểm, dung lượng PDF, quy định thay file sau quyết định và rubric (hoặc null). Không có policy mẫu nào được ghi vào database chung. Policy synthetic trong test chỉ phục vụ test.

- Điểm nằm trong thang 0–10 theo yêu cầu; bước điểm lấy từ policy, không tự đặt 0,1 hoặc 0,5 trong runtime.
- SCORE_ENTRY hiện là Decimal(4,1). Policy yêu cầu độ chính xác khác khả năng bảng hiện tại bị từ chối; không âm thầm làm tròn.
- Nếu có rubric, bắt buộc đủ tiêu chí hợp lệ, tổng trọng số 1 và điểm tổng đúng phép quy đổi đã cấu hình. Không tự đặt ngưỡng đạt.
- Nhận xét tổng kết bắt buộc. Không đồng ý bắt buộc lý do. Có thể đồng ý độc lập với ngưỡng điểm; phần mềm không thay GVHD hoặc Khoa quyết định học vụ.
- Đánh giá và quyết định gắn với assignment ID/revision, topic revision, policy hash và phiên bản PDF. Handover/đề tài/policy/PDF đổi làm dữ liệu cũ mất tính hiện hành.
- Policy BLOCK chặn thay PDF sau quyết định. INVALIDATE cho nộp phiên bản mới, đưa quyết định về PENDING và giữ snapshot cũ trong audit. Sửa đánh giá cũng yêu cầu GVHD xác nhận lại.
- Khi dùng dữ liệu cho UC18 sau này phải đọc trạng thái hiệu lực, không chỉ đọc cột CONFIRMED legacy. UC18 chưa triển khai.

## Upload/storage

Dùng lại SubmissionValidator và FileStorageService của UC15, không viết hệ thống storage thứ hai. File được lưu qua private guidance storage với key UUID write-once; API chỉ download qua phiên bản gắn đúng FINAL_REPORT, kiểm tra scope, trạng thái và checksum; không trả public URL.

Trước khi lưu bytes, transaction đầu lưu FILE_ASSET QUARANTINED, idempotency pending và audit ownership. Transaction sau kiểm lại quyền/policy/revision, tạo phiên bản, chuyển asset READY và lưu kết quả. Các bản cũ không bị ghi đè.

Nếu storage/tiến trình/final transaction lỗi, metadata quarantine và audit vẫn nhận diện đúng file; retry pending trả 409, không ghi đè hoặc tuyên bố nộp thành công. Chưa có thao tác tự xóa/khôi phục staging production. Nhóm cần đối soát các lần nộp dang dở và kiểm chứng quy trình xử lý vận hành trước khi bật ghi. Không tự xóa file khi trạng thái commit không rõ.

Giới hạn được kế thừa: validator UC15 kiểm envelope và một số active-action PDF, không phải full PDF parser/antivirus. Storage hiện có là filesystem private; nhóm cần xác minh STORAGE_LOCAL_PATH nằm trên volume bền vững và được backup ở môi trường triển khai chung. Không tuyên bố đã kiểm chứng Supabase Storage hoặc storage production.

## Frontend

Files mới trong `frontend/src/features/guidance/final-defense/`: `api.ts`, `components.tsx`, `page.tsx`, `api.spec.ts`, `components.spec.tsx`.

Files sửa: `app/router/routes.tsx`, `route-manifest.ts`, `route-manifest.test.ts`. Dùng lại layout/sidebar/router và httpClient có JWT/refresh của nhóm. Hai route hiện có `/guidance/final-report` và `/guidance/defense-confirm` trỏ vào giao diện API thật; không gọi DemoDb. API mode không fallback demo khi backend lỗi. Demo mode thông báo cần kết nối API.

Có chọn đợt/phân trang/chọn sinh viên theo danh sách scope API, trạng thái loading/empty/error/retry/success, upload PDF, lịch sử phiên bản và tải lại, form nhận xét/rubric/điểm, form Đồng ý/Không đồng ý, lý do, lịch sử thao tác và các liên kết UC14–UC16. Chỉ báo lưu thành công sau khi POST trả về; giữ idempotency key cho retry cùng nội dung. UI tôn trọng permissions/blockers do backend tính.

## Kiểm thử và mức xác minh

Baseline trước sửa: backend build/typecheck/lint PASS, 344 test PASS; frontend typecheck/lint PASS, 162 test PASS.

Kết quả sau triển khai:

| Kiểm tra                                  | Kết quả                                             |
| ----------------------------------------- | --------------------------------------------------- |
| Shared TypeScript build                   | PASS                                                |
| Backend Nest build / TypeScript / ESLint  | PASS                                                |
| Frontend Vite build / TypeScript / ESLint | PASS                                                |
| Prisma validate / generate                | PASS; chỉ kiểm schema và sinh client, không migrate |
| Backend Vitest                            | 42 files, 381 tests PASS                            |
| Frontend Vitest                           | 35 files, 173 tests PASS                            |
| git diff --check                          | PASS                                                |

Các test mới gồm 25 workflow/policy tests, 5 HTTP integration tests, 2 capability checks, 4 private-filesystem tests, 1 kiểm tra bảo vệ API điểm legacy, 10 API/component tests frontend và 1 kiểm tra navigation mới. HTTP tests dùng Nest, JWT/session guard, RBAC guard, Zod và multipart thật; repository/transaction/storage adapters vẫn synthetic in-memory, không thay thế kiểm thử PostgreSQL. Toàn bộ test base B1–B8 vẫn qua. Vite có cảnh báo chunk lớn; bộ SSR test cũ có cảnh báo useLayoutEffect, không có test thất bại vì các cảnh báo này.

**NOT VERIFIED:** áp dụng SQL trên database test được nhóm phê duyệt, Prisma transaction/lock/FK/trigger/RLS thật, rollback/replay migration với dữ liệu legacy đại diện, storage production và browser end-to-end với môi trường tích hợp có schema UC17. Không dùng Supabase chung làm DB test ghi. Metadata READ ONLY không chứng minh migration hoặc luồng ghi đã hoạt động.

## Việc nhóm trưởng/Khoa cần xác nhận

1. Review migration và permission mapping; bổ sung draft vào deploy chain theo quy trình sau khi được duyệt. Chưa có lệnh apply nào được chạy.
2. Cấp môi trường test phụ trợ được phê duyệt để rehearsal cùng schema/migrations của nhóm, dữ liệu synthetic. Đây không phải database đích hay kiến trúc UC17 riêng.
3. Xác nhận policy theo đợt: version/người duyệt, bước điểm/rubric/thang quy đổi, quy định thay PDF sau quyết định, thời gian FINAL và xử lý gia hạn/nộp muộn. Code hiện chỉ chấp nhận cửa sổ FINAL đang mở.
4. Xác nhận quyền/thời điểm sinh viên xem từng loại điểm/nhận xét/lý do; hiện mặc định không cấp các quyền này.
5. Kiểm chứng storage bền vững/backup, đối soát legacy và staging dang dở. Xác định yêu cầu PDF parser/AV nếu Khoa cần.
6. Sau rehearsal migration, kiểm tra bảo toàn B1–B8 và chạy browser/HTTP end-to-end trên môi trường tích hợp được cho phép. Chỉ khi đạt mới cấu hình `UC17_WRITES_ENABLED=true` và policy đã duyệt theo đợt. Không bật trong lượt này.

UC17 đã có code tích hợp và kiểm thử cô lập; **chưa nghiệm thu end-to-end trên hệ thống Supabase chung**. Các thao tác ghi chính thức vẫn bị chặn rõ ràng, không giả lập thành công.

## Bổ sung: readiness và deployment review ngày 07/11/2026

Đã tiếp tục từ chính implementation trên, không viết lại. Kế hoạch A–J, bảng policy đề xuất, checklist Render và tiêu chí dừng: [09-uc17-deployment-plan.md](09-uc17-deployment-plan.md). Bằng chứng runtime datasource READ ONLY: [09-uc17-readiness.json](09-uc17-readiness.json). Gói SQL review: [README](../../backend/prisma/review/final-defense/README.md).

Các sửa lỗi/tăng độ đầy đủ trong lượt review:

- Chuyển GET `/final-defense/options` từ interceptor về controller; thêm HTTP regression test đúng URL frontend sử dụng. URL này trước sửa có thể 404.
- Trả `actionBlockers` theo từng thao tác và window FINAL từ server; review không được bật khi chưa có PDF hoặc điểm đã khóa. UI hiển thị nguyên nhân thực, không gán mọi disabled decision cho “chưa có nhận xét”. Không bỏ authorization để mở nút.
- Nạp lại điểm từng tiêu chí rubric, lựa chọn từ chối và lý do đã lưu; giữ permission đọc điểm/nhận xét/lý do độc lập. Không gán giả status IN_PROGRESS cho term-options nữa.
- Bổ sung tóm tắt kế hoạch/nhiệm vụ/đánh giá hiện hành từ UC14–UC16, kiểm quyền guidance:read/monitor; cảnh báo nhiệm vụ chưa hoàn thành và context cũ. Không dùng các số liệu này để tự quyết định học vụ hoặc chặn thay GVHD.
- GET download không tạo private storage directory khi file/root chưa tồn tại. Tái sử dụng nguyên FileStorageService; bốn test filesystem trên thư mục tạm synthetic kiểm tra read-only, key an toàn, write-once và khả năng đọc lại từ instance service khác trên cùng filesystem. Đây không phải bằng chứng disk Render bền vững.
- Migration thêm preflight, timeout, CHECK áp dụng có điều kiện cho bound UC17 rows, FK ON UPDATE đúng Prisma, xác minh asset thuộc chủ hồ sơ và chống dùng lẫn weekly/final cả hai chiều. Tên hai FK mới map rõ trong Prisma. Chỉ một bảng mới, không thay enum hoặc sửa legacy values.
- Thêm rollback.empty-only từ chối nếu có data/staging, offline schema.diff và fingerprints; chưa thực thi các file migration/rollback trên database nào trong lượt review.
- Kiểm tra build thực tế phát hiện cache incremental cũ để thiếu JS nền dù Nest build exit 0. Đã biên dịch đầy đủ bằng `tsc --project tsconfig.build.json --incremental false`, rồi chạy `backend/scripts/check-final-defense-build.cjs` để require các module thật mà không tạo AppModule/PrismaClient hoặc mở kết nối. Module loading PASS. Docker build mới từ checkout sạch vẫn cần smoke tương tự.

SELECT trên DATABASE_URL đọc được 7 term, 26 proposal/82 TermStudent, 29 assignment tổng cộng; 4 term có pointer plan chính thức FINALIZED và metadata chốt. Không có mismatch trong phép join owner/term/student/topic đã kiểm. 17 migration đã áp dụng đều có checksum khớp source local (chấp nhận biến thể CRLF/LF), không có migration failed/rolled-back trong snapshot.

**Blocker thực tế:** cả 7 FINAL tồn tại nhưng chưa tới lịch; không có UC17_POLICY; cả 10 permission UC17 chưa có; FINAL_REPORT_VERSION và 8 cột mở rộng chưa áp dụng. Storage Render được người dùng xác nhận là filesystem backend trên Render nhưng disk/mount/backup chưa được xác nhận. Source không có Render blueprint chứng minh disk; Compose volume không chứng minh cấu hình Render.

Các projection legacy report/decision/score và progress đã được gọi bằng Prisma trong READ ONLY với identifier cố ý không thể là proposal VARCHAR(36), không lấy thông tin cá nhân/điểm. Các probe PASS, capability UC17 false như mong đợi. Đây là kiểm chứng SQL/projection và sự thiếu schema, không chứng minh một user đã đăng nhập dùng được UC17 hiện tại. Khi permissions còn thiếu, guard thật sẽ 403/menu bị ẩn. Upload, review, decision, version download chưa thể chạy end-to-end trên schema Supabase chung hiện tại.

Nguồn Render/Supabase chính thức và các thao tác tương lai đều được dẫn trong deployment plan. Không tự tạo disk, bucket, account, proposal; không thay production config; không apply/seed/reset; không commit/push. Chưa có môi trường rehearsal PostgreSQL và storage được nhóm phê duyệt để ghi: SQL execution, FK/trigger/RLS thực tế, rollback/restore và browser E2E vẫn **NOT VERIFIED**.
