# Final code review — Project 1, bước 4–8

> Cập nhật 26/10/2026: đây là báo cáo lịch sử trước khi tích hợp develop. Kết quả xử lý conflict, tương thích bước 1–8 và kiểm thử mới được ghi riêng tại [merge-develop-2026-10-26.md](merge-develop-2026-10-26.md). Nội dung và bằng chứng của lần review cũ bên dưới được giữ để đối chiếu.

Ngày 23/10/2026, Asia/Ho_Chi_Minh. **NOT READY FOR MERGE.** Hai finding HIGH về legacy authorization vẫn mở và có bằng chứng HTTP thực tế. Một lỗi MEDIUM ở editor đã sửa, có browser regression RED → GREEN. Còn các vấn đề MEDIUM về contract HTTP, hiệu năng và CI cần xử lý/đánh giá theo phần dưới.

Review working tree, bao gồm các file untracked của bước 4–8; không chỉ xem `git diff` của file đã track. Working tree đã chứa nhiều công việc chưa commit từ trước. Không stage/commit/push, không sửa DOCX, schema/migration, dependency/lockfile, env hoặc business logic bước 1–3/9–10. Không kết nối database chung/production hoặc chạy DDL trong lượt review này.

## 1. Căn cứ và phạm vi

Đối chiếu `docs/spec/Project_1_06.docx` trực tiếp qua OOXML, phần UC12–UC16; [baseline PR1](01-business-decisions-and-contract.md) D01–D14, §3–§7; ADR cá nhân, monorepo/NestJS-Prisma; audit/migration plan/team guide/test plan; code/controller/DTO/service/repository, Prisma schema, active SQL migrations, frontend routes/pages và CI. Đọc lại [integration report](05-integration-test-report.md) và evidence, không suy PASS từ tên script.

PR1 có câu chờ phê duyệt mang tính lịch sử; người dùng đã phê duyệt trong chỉ dẫn PR2 và các lượt sau. Không lấy câu cũ đó làm blocker mới. Những nhánh DOCX được PR1 thay thế gồm nhóm SV → cá nhân, phiên duyệt vật lý → deadline phase, nhiều nhận xét → một kết luận chung/vòng, ký giấy → finalize/PDF/receipt riêng. Không đề xuất đưa các nhánh đã loại trở lại.

Phạm vi kiểm trực tiếp: nhóm duyệt, assignment/decision, immutable versions, finalization/PDF/receipt, guidance/task, upload/submission, progress review/meeting/dashboard/notification và điểm nối legacy. Không thêm chức năng, không triển khai lại reopen producer, FR25 criteria/điểm giai đoạn, email worker, bảo vệ/chấm điểm tốt nghiệp.

Mức đánh giá:

- **CRITICAL:** mất dữ liệu/nguy cơ chiếm quyền diện rộng đã chứng minh; chưa có finding đạt mức này trong phạm vi review. Không đồng nghĩa hệ thống đã an toàn tuyệt đối.
- **HIGH:** lộ dữ liệu ngoài quyền; chặn merge an toàn toàn hệ thống.
- **MEDIUM:** lỗi luồng/contract hoặc rủi ro hiệu năng/coverage có căn cứ, cần remediation hoặc quyết định chấp nhận rõ ràng.
- **LOW:** maintainability/observability, không tự refactor ngoài phạm vi.

## 2. Findings — theo mức độ

### H01 — HIGH — Legacy topic list vượt ownership/term scope — OPEN

**Vị trí:** `backend/src/topic/controller/topic.controller.ts:11`, `backend/src/topic/service/topic.service.ts:8–11`.

GET `/api/topics/term/:termId` chuyển thẳng termId vào `findMany`, include `proposals`, không chuyển principal hoặc kiểm grant/owner/assignment. Account ACTIVE không role và SV chỉ thuộc đợt 2 đều đọc được hai rows của đợt 1. Metadata bao gồm Proposal.studentId/status. Trong cùng fixture, canonical `/proposals/:id` từ chối principal đó.

**Tác động:** có đường đọc vòng qua scope của các API mới, lộ metadata hồ sơ/ownership. Chưa có bằng chứng đường này cho tải file private hoặc trả nội dung ProposalVersion; không nâng mức kết luận vượt evidence.

**Bằng chứng:** [legacy-security.json](evidence/steps4-8/legacy-security.json), findings 1/3; [live-e2e.json](evidence/steps4-8/live-e2e.json), aggregate FAIL.

**Hướng sửa:** phối hợp người 1 xác định endpoint là catalog công khai có projection riêng hay danh sách học thuật có principal scope; intersect term/grant/owner/current official advisor/assigned reviewer theo contract, giữ array envelope và ID cũ. Không chỉ thêm decorator rồi vẫn trả toàn đợt cho mọi người có read permission.

**Chưa sửa:** cần thay contract đọc của module khác; yêu cầu hiện tại chỉ cho sửa khi đủ căn cứ và không phá module khác. Chưa có contract visibility/projection legacy đủ rõ để áp chính sách mới một cách âm thầm.

### H02 — HIGH — Legacy registration list lộ SV/đăng ký chéo đợt — OPEN

**Vị trí:** `backend/src/registration/controller/registration.controller.ts:11–14`, `backend/src/registration/service/registration.service.ts:8–15`.

GET `/api/registrations/term/:termId` chỉ cần JWT, chưa yêu cầu action permission hoặc parent scope. `findMany` include student/preferences/advisor. Hai principal ở H01 đều nhận HTTP 200, hai đăng ký của đợt không được cấp.

**Tác động:** lộ dữ liệu SV/đăng ký/nguyện vọng/phân công ngoài quyền; không phải regression do editor mới nhưng vẫn tồn tại trong hệ thống tích hợp.

**Bằng chứng:** legacy-security.json findings 2/4, bốn probe tổng đều FAIL, không bị đổi thành PASS vì các API mới an toàn hơn.

**Hướng sửa:** chủ bước 1–3 chốt permission/projection và scope cho Khoa/SV/GVHD/ADMIN. Thêm negative tests account không role, SV khác, đợt/bộ môn khác; tái kiểm read shape của consumer. Không tạo dependency `registration → topic` để tái sử dụng service một cách vòng vèo.

**Chưa sửa:** cùng giới hạn contract/module ở H01. Hai HIGH này phải được xử lý trước kết luận READY.

### M01 — MEDIUM — Editor bước 6 giữ trạng thái cũ khi quay lại qua SPA — FIXED

**Vị trí trước sửa:** `frontend/src/features/proposal-versions/pages.tsx:507` (editing-context query), `frontend/src/app/App.tsx:6` (staleTime mặc định 5 phút). Regression tại `frontend/scripts/test-proposal-versions-browser.cjs:530`.

**Tái hiện:** SV gửi v2, context cache là SUBMITTED; reviewer ở phiên khác trả sửa; SV bấm link về danh sách rồi mở editor trong cùng SPA. Query còn fresh nên không đọc lại, không hiện “Lưu nháp mới”. Các E2E cũ dùng `page.goto` khởi tạo lại QueryClient nên bỏ sót.

**Tác động:** SV không tiếp tục được vòng sửa nếu không reload hoặc chờ cache hết hạn; backend vẫn giữ đúng state, không chứng minh mất dữ liệu hay vượt quyền.

**Fix applied:** context query dùng `staleTime: 0`, tắt focus refetch để bảo toàn form đang nhập; chờ fetch đầu tiên của lần mount hoàn tất trước khi dựng Editor từ cache, để revision local không khởi tạo từ bản cũ. Background invalidation không remount form đang nhập. Không đổi global QueryClient hoặc API/state machine.

**Bằng chứng:** [before](evidence/final-review/spa-cache-before.log) thất bại tại nút lưu sau SPA navigation; [after](evidence/final-review/spa-cache-after.log) **16 checks PASS**, bao gồm CAS/revision của lần lưu tiếp theo và conflict giữ input. [JSON sau sửa](evidence/final-review/step6-browser-after.json). `pnpm verify` sau sửa PASS.

**Phạm vi còn lại:** các query detail khác như `proposal-dossier`/`proposal-review` vẫn cần kiểm chính sách freshness khi trạng thái thay đổi từ phiên khác. Chưa tuyên bố đã sửa mọi cache scenario của toàn frontend.

### M02 — MEDIUM — Dashboard/inbox load toàn đợt rồi phân trang; N+1 — OPEN

**Vị trí:** `backend/src/guidance/reviews/progress-review.service.ts:305`, `:338`, `:374`, `:588`; `progress-review.repository.ts:73–100`. Coverage có pattern tương tự ở `backend/src/guidance/tasks/guidance.service.ts:1133` trở đi.

`termPlanIds` lấy mọi plan; vòng lặp đọc riêng plan/proposal/official assignment/tasks cho từng plan, sau đó filter và `rows.slice` để trả một trang. Faculty scope đã được kiểm trước trả response, nhưng các plan ngoài bộ môn có thể vẫn bị tải từ DB trước khi lọc. Query count và memory phụ thuộc toàn đợt, không chỉ page limit; một read transaction giữ snapshot tới 30 giây.

**Tác động:** latency/query count tăng theo số SV/task; page size 20 không giới hạn lượng dữ liệu trung gian. Đây là xác nhận từ source, **chưa đo throughput hoặc khẳng định ngưỡng timeout production**.

**Hướng sửa:** batch projection theo grant/current assignment; đẩy filter/pagination/aggregate xuống DB; coverage vẫn bắt đầu từ period/applicability, không đổi sang lấy task làm gốc. Chạy EXPLAIN/query-count regression trên dữ liệu đại diện trước khi thay read model. Không refactor hàng loạt trong final review.

### M03 — MEDIUM — Critical section khóa toàn đợt, chứa IO/PDF — OPEN

**Vị trí:** `backend/src/topic/proposal-reviews/proposal-review.repository.ts:244–257`; `backend/src/guidance/submissions/submission.service.ts:385` trở đi; `backend/src/topic/proposal-dossiers/dossier.service.ts:425–448`.

Lock protocol lấy THESIS_TERM FOR UPDATE, toàn bộ phase và advisor assignments của đợt. Mutations của hai SV khác nhau cùng đợt do đó tranh cùng khóa. Submit đọc/checksum file dưới locks; generate render PDF bên trong command transaction có cùng term lock.

**Tác động:** correctness tốt trong race phase/handover nhưng throughput cả đợt bị serialize; IO/PDF chậm làm lệnh không liên quan chờ, timeout/retry khuếch đại tải. Unit/integration đã chứng minh correctness, chưa chứng minh đáp ứng tải nhiều người.

**Hướng sửa:** đánh giá shared read lock/revision protocol cho term/phase và khóa exclusive theo aggregate; tách phần render/checksum có thể chuẩn bị trước, rồi revalidate/CAS trước commit. **Không tự nới/bỏ khóa hiện tại**, vì producer bước 1–3 và phase/handover phải phối hợp cùng protocol.

### M04 — MEDIUM — Thiếu index theo task cho lịch sử submissions — OPEN

**Vị trí:** `backend/src/guidance/submissions/submission.repository.ts:69–88`; `backend/prisma/schema.prisma:732`; SQL composite key `backend/prisma/migrations/202610210002_expand_workflow/migration.sql:1084`.

Page/count lọc TaskSubmission.taskId và sort createdAt/id. Active SQL có PK(id) và unique `(id, task_id)` nhưng không có index bắt đầu bằng task_id cho query này. Unique đảo thứ tự không thay thế index tra lịch sử theo task. Không kết luận planner luôn chọn Seq Scan khi chưa EXPLAIN dữ liệu thật.

**Tác động:** lịch sử/count/check legacy submissions có thể phải scan nhiều dữ liệu toàn hệ thống dù trả ít rows.

**Hướng sửa:** đo EXPLAIN trên test data đại diện; cân nhắc additive index `(task_id, created_at DESC, id DESC)` và biểu diễn tương ứng trong schema. Tạo migration mới, kiểm replay/upgrade/lock; không sửa migration cũ hoặc chạy DDL shared trong lượt review.

### M05 — MEDIUM — ZIP validation đồng bộ trên request thread, trước quota — OPEN

**Vị trí:** `backend/src/guidance/submissions/submission.validator.ts:283`; `submission.service.ts:174`, `:197`; upload `memoryStorage` tại `submission.controller.ts:67`.

ZIP được inflate/CRC đồng bộ; policy đã duyệt cho tổng giải nén tới 200 MiB. Validation chạy trước transaction kiểm pending quota; nhiều request hợp lệ đã qua preflight có thể tiêu CPU/buffer trước khi quota từ chối. Các giới hạn byte/entries/maxOutputLength đã có, nên **không gọi đây là ZIP bomb không giới hạn hoặc thực thi source code**.

**Tác động:** event loop bị giữ bởi nén/CRC, có rủi ro availability khi nhiều upload đồng thời. Chưa chạy stress/heap benchmark, không nêu số request gây nghẽn như một kết quả đo.

**Hướng sửa:** đo event-loop lag/memory; áp giới hạn concurrent validation theo principal/process, cân nhắc validation ngoài request thread với trạng thái quarantine. Giữ authorization trước buffer, byte cap và cleanup/commit guards. Không tự đổi policy học vụ/file đã duyệt hoặc thêm storage service.

### M06 — MEDIUM — Shared text DTO lớn hơn JSON parser mặc định — OPEN, REPRODUCED

**Vị trí:** `backend/src/main.ts:8` dùng NestFactory mặc định; `shared/src/contracts/proposal-versions.ts:10–37` cho nhiều field 20.000 ký tự và 100 mốc. Không có `useBodyParser`/JSON limit riêng trong bootstrap hiện tại.

Payload tiếng Việt 110.308 byte hợp lệ với SubmittedProposalContentSchema bị parser mặc định trả **413 trước controller**; control 408 byte trả 201. UI/DTO cho phép nhập nhưng transport không nhận. Multipart limit của 8B không giải quyết JSON request của editor.

**Bằng chứng:** [http-body-contract.json](evidence/final-review/http-body-contract.json), [log](evidence/final-review/http-body-contract.log), repro `backend/scripts/integration/review-http-body-contract.cjs`. Probe dùng NestFactory/Express default giống main trên loopback và shared schema thật; **chỉ là transport probe, không phải ca lưu đề cương có auth/DB**. Exit 1 giữ contract mismatch hiển thị, không báo PASS cho ca lớn.

**Hướng sửa:** thống nhất byte budget cho JSON/UTF-8 và parser trên route nghiệp vụ, giữ hard cap và error envelope; thử boundary payload/negative oversize qua backend authenticated thật. Không nâng limit toàn backend hoặc tự giảm giới hạn nội dung chính thức trong final review, vì ảnh hưởng cả các module khác và resource budget.

### M07 — MEDIUM — CI chưa gate browser/live integration mới — OPEN

**Vị trí:** `.github/workflows/backend-ci.yml:95–144`, `.github/workflows/frontend-ci.yml:43–59`; script entries `backend/package.json` nhóm `test:integration:steps4-8:*`.

Backend CI đã gọi API/upgrade từng bước; frontend CI gọi Vitest/build. Hai workflow chưa gọi browser regressions hoặc live E2E mới có legacy-security probes. Vì vậy các check CI hiện có có thể xanh dù H01/H02 còn tồn tại; regression SPA vừa thêm cũng chưa thuộc test CI được gọi.

**Hướng sửa:** thêm gate cho negative ownership legacy và browser SPA regression; cấu hình browser phù hợp runner trước khi nối live E2E. Không bỏ probe FAIL để CI xanh, không coi phiên local Node 24/pnpm 12 là bằng chứng remote Node 20/pnpm 9 đã chạy. Không thêm workflow mới chưa được kiểm chỉ để đánh dấu coverage hoàn tất.

### M08 — MEDIUM — Chưa có thông báo giao task/nộp bài theo UC14–15 — OPEN, SCOPE GAP

**Vị trí:** `backend/src/guidance/tasks/guidance.service.ts:842–859`; `backend/src/guidance/submissions/submission.service.ts:480–506`; DOCX UC14 đoạn OOXML 1492/1494, UC15 đoạn 1514–1518.

Luồng tạo task và commit submission ghi history/audit nhưng không tạo Notification/Outbox hoặc emit event cho SV nhận nhiệm vụ/GVHD nhận bài nộp. Không tìm thấy listener cho hai action này. 8C đã tạo notification khi GVHD đánh giá báo cáo, đó là sự kiện khác. Báo cáo 8A đã ghi rõ hoãn thông báo; phần hoãn chưa được bù đầy đủ khi đánh giá toàn luồng theo DOCX.

**Tác động:** dữ liệu task/bài nộp vẫn đúng và người dùng có thể mở inbox/list, nhưng không được khẳng định toàn bộ notification UC14/15 đã có. Đây là gap so với nguồn đầy đủ, không phải lỗi mới phát sinh từ fix editor.

**Hướng sửa:** PR chức năng riêng theo phạm vi được duyệt: notification/event tối thiểu cùng commit, recipient từ owner/current assignment, payload ID/link được scope lại, idempotency/rollback tests. Không cần tự thêm email worker hoặc gửi mail thật để lấp gap. **Chưa implement**, theo yêu cầu không thêm chức năng mới trong final review; đây là kiểm source, chưa có ca acceptance HTTP riêng đo số notifications cho hai action.

### L01 — LOW — Repository session inheritance tạo coupling xuyên feature — OPEN

**Vị trí:** `backend/src/topic/proposal-versions/proposal-version.repository.ts:14`, `backend/src/topic/proposal-dossiers/dossier.repository.ts:21`, `backend/src/guidance/tasks/guidance.repository.ts:47`, `backend/src/guidance/reviews/progress-review.repository.ts:23`; `backend/src/notification/repository/notification.repository.ts:3–8`.

Chuỗi kế thừa Review → Version → Dossier → Guidance → Submission → Progress cho phép một session dùng toàn bộ query của upstream. Notification chỉ cần principal nhưng import ProposalReviewSession. Dễ có method-name collision, change ripple và khó audit quyền theo feature; các repository transaction/retry/idempotency policy cũng lặp.

**Hướng sửa:** đợt refactor riêng dùng composition/read adapters và transaction context có API nhỏ; tách principal reader dùng chung. Giữ dependency DAG và typed DTO, không sửa nghiệp vụ/module khác hoặc đổi tên hàng loạt trong review này.

### L02 — LOW — Unexpected errors bị chuẩn hóa mà không có log chẩn đoán — OPEN

**Vị trí:** `backend/src/topic/review-groups/review-group.errors.ts:26–49`.

Filter catch-all trả INTERNAL_ERROR an toàn nhưng không ghi thông tin chẩn đoán/correlation cho nhánh non-HttpException. Khi lỗi Prisma/IO chưa được xử lý xuất hiện, operator chỉ thấy 500 chung, khó tìm nguyên nhân. Không đề nghị trả raw stack/SQL cho client.

**Hướng sửa:** structured logging có correlation ID và error class/code được redaction; không log raw Prisma payload, comment, snapshot học thuật, credential hoặc source file. Tách đợt observability có kiểm privacy; chưa thêm logging dễ gây lộ dữ liệu trong review này.

## 3. Kết quả đánh giá theo 13 tiêu chí

| Tiêu chí | Kết luận có căn cứ / giới hạn |
|---|---|
| Business correctness | Theo baseline cá nhân; chỉ SV submit; một common decision/vòng; Khoa finalize; report FAIL và REVISION_REQUIRED lưu riêng. Không quy PASS task thành điểm/đủ bảo vệ. Nhánh FR25/email/reopen producer ngoài phạm vi đã ghi, chưa được coi là feature hoàn tất |
| Data integrity | Composite ownership FKs, unique active review, unique decision/review, effective progress review, immutable version/history và completion evidence guards có trong SQL; legacy nullable được giữ fail-closed, không backfill suy đoán |
| RBAC/IDOR | Canonical endpoints có principal/action + grant/roster/owner/current official assignment; ADMIN không bypass. H01/H02 khiến kết luận toàn hệ thống vẫn FAIL |
| State machines | Proposal REVISION_REQUESTED là trạng thái; REVISION_REQUIRED là decision. Sealed snapshots không unseal; review/finalization/submission pointers gắn exact version; stale/cross-version rejected |
| Transaction/concurrency | Bounded retry + CAS + lock/recheck, audit/outbox/idempotency cùng transaction; correctness races đã kiểm. M03 là đánh đổi availability chưa được load-test |
| API/error consistency | Shared Zod strict input, envelope/page/revision/Idempotency-Key; không client actor/status injection. M06 transport cap lệch DTO và L02 diagnostics còn mở |
| Upload/download | Kiểm owner trước multipart, extension/MIME/content/size/name/ZIP, private UUID key, checksum và parent scope lúc tải; staging/cleanup không coi là bài nộp. Không AV/full PDF interpreter; M05 cần kiểm resource |
| Official PDF | Snapshot+hash+approvedVersionId/finalizedAt tách approval/receipt; bytes private, đủ Unicode/A4/bảng dài có evidence. Không ký giả/tự nhận giấy; vẫn cần nghiệm thu trực quan mẫu trang 12 bởi người dùng |
| Frontend UX | Có loading/empty/error/success, controls theo allowedActions, responsive; M01 đã sửa và giữ draft khi conflict. Chưa vét cạn trạng thái thay đổi từ phiên khác trên mọi màn |
| Performance/indexes | Có các index task workflow/progress review/meeting/notification; không đủ kết luận tối ưu. M02–M05 có vị trí cụ thể; chưa benchmark DB shared |
| Tests/regression 1–3 | Baseline integration có 154 API checks, 7 upgrade suites, 73 mock checks, 15 checkpoints live; core producer rows/read envelopes giữ nguyên. H01/H02 là bốn probes FAIL. Chưa nghiệm thu các màn ghi producer 1–3 hoặc toàn bộ 9–10 |
| Maintainability/boundaries | Controller mỏng, validators/repositories rõ, shared DTO không lộ tên pr2b lên contract mới; L01 còn coupling/duplication, không refactor rộng |
| Workspace/CI | `pnpm verify` sau fix chạy được shared build, canonical/frozen Prisma clients, typecheck/lint/unit/build. Lockfile v9 được giữ; remote CI Node20/pnpm9 NOT RUN trong lượt này; M07 là thiếu gate cụ thể |

Không tự chạy migrate dev/db push/reset hoặc tự sinh diff toàn schema; legacy SQL/native type/onDelete/unique được giữ theo rollout expand-only đã phê duyệt. `Proposal.studentId` unique tạm thời và Topic.proposals[]/Student.proposal tương thích là ngoại lệ rollout đã chấp thuận, không âm thầm tháo trong review. Trước deploy shared vẫn cần inspect/checksum/backup và phê duyệt riêng.

## 4. Verification sau sửa và evidence

| Kiểm tra | Kết quả thực tế |
|---|---|
| Regression SPA **trước** fix | FAIL đúng tại nút “Lưu nháp mới” sau điều hướng SPA; [log](evidence/final-review/spa-cache-before.log) |
| Browser step 6 **sau** fix | **16 checks PASS**, exit 0; [log](evidence/final-review/spa-cache-after.log), [JSON](evidence/final-review/step6-browser-after.json) |
| `pnpm verify` **sau** fix | **PASS**, gồm Prisma validate/generate, frozen compatibility, lint/type-check, backend **107**, frontend **27**, tooling guards **12**, build workspace; [verify-after.log](evidence/final-review/verify-after.log) |
| HTTP transport repro | Control 201; valid 110.308-byte payload 413; contract case **FAIL**, command exit 1; không auth/DB |
| Full DB/API/upgrade/live E2E sau frontend-only fix | **NOT RUN lại trong lượt review**; baseline gần nhất là [integration report](05-integration-test-report.md). Không sửa backend/schema/migration, không tái gọi DB chỉ để đổi nhãn baseline thành kết quả mới |
| Shared/production deploy, production EXPLAIN/load test, remote CI | **NOT RUN**, không có target/ủy quyền triển khai trong lượt này |

Baseline integration evidence là snapshot của lượt QA trước; không thay file/hash snapshot đó để che việc source editor đã sửa sau đó. Evidence final review nằm thư mục riêng. HTTP probe là reproducer cho bootstrap mặc định hiện tại; khi sửa parser phải có test authenticated dùng bootstrap/config thật, không dùng probe tách rời để chứng nhận toàn endpoint đã được sửa.

Các lệnh đã dùng để kiểm sau sửa, chạy tại repository root:

```powershell
pnpm --filter @doan/frontend test:proposal-versions:browser
pnpm verify
node backend/scripts/integration/review-http-body-contract.cjs
```

Hai lệnh đầu exit 0; transport probe exit 1 vì contract mismatch đã tái hiện. Không sửa expectation để biến ca chưa khắc phục thành PASS.

## 5. Thay đổi thực tế trong lượt review

- Sửa `frontend/src/features/proposal-versions/pages.tsx`: freshness và initial-fetch gate cho editor; không thay contract/state machine.
- Sửa `frontend/scripts/test-proposal-versions-browser.cjs`: thêm SPA regression có external revision/CAS; không bỏ assertion cũ hoặc mock backend đổi sai revision thành thành công.
- Thêm `backend/scripts/integration/review-http-body-contract.cjs`: transport-only reproducer, không DB hoặc chức năng sản phẩm mới.
- Thêm báo cáo này và `docs/implementation/evidence/final-review/`: log RED/GREEN, JSON và hash evidence.
- Runner step 6 tái tạo `backend/prisma/review/step6-browser-results.json` (16 checks).

Các modified/untracked khác đã có trước lượt review, giữ nguyên. Không sửa hai legacy API, bootstrap parser, CI, database hoặc dependencies. `git diff --check`, status và staged-file check được thực hiện cuối lượt; không stage/commit.

## 6. Kết luận merge

**NOT READY FOR MERGE.** Điều kiện bắt buộc là xử lý H01/H02 theo contract bước 1–3 đã được chủ module xác nhận, thêm regression bảo vệ các legacy entrypoint và chạy lại full E2E đến khi cả workflow lẫn security PASS. Không chấp nhận lập luận “lỗi cũ nên bỏ qua” khi entrypoint còn chạy trong hệ thống tích hợp.

M01 đã đóng bằng fix nhỏ và RED → GREEN. M06 có reproducer rõ, cần thống nhất cap JSON/UTF-8 trước nghiệm thu nội dung dài. Các MEDIUM hiệu năng/CI phải có remediation hoặc chấp nhận giới hạn rõ theo quy mô triển khai, không ghi đã tối ưu khi chưa đo. LOW có thể theo dõi riêng; không dùng một đợt refactor lớn để trì hoãn hai security blockers hoặc làm mất compatibility.
