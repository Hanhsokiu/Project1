# Gói B — UC17 và UC18, backend đến frontend

Ngày 27/10/2026. Workspace `C:\DATN\Project1`. Đọc working tree thực tế, không dùng số test hoặc tình trạng triển khai cũ làm bằng chứng kiểm thử mới.

## 1. Kết quả và giới hạn nghiệm thu

| Phần                                          | Trạng thái                                                        | Chức năng hiện chạy được ở mức code và test không DB                                                                                                                                                                                                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| UC17                                          | **PARTIAL về nghiệm thu; các phần bổ sung của gói đã triển khai** | Inbox từ phân công chính thức hiện hành, lọc/phân trang, tóm tắt tiến độ; frontend inbox → context → PDF đúng identity → CONFIRMED/REJECTED → quyết định/lịch sử; thông báo Khoa cùng transaction; view sinh viên và Khoa chỉ đọc theo scope. Chưa chứng minh end-to-end bằng dữ liệu/PostgreSQL thật. |
| UC18                                          | **PARTIAL**                                                       | Đọc trạng thái đã xác minh, tạo DRAFT, mở OPEN; API và frontend preview toàn roster/phần thuộc grant, kể cả sinh viên thiếu hồ sơ; giải thích chứng cứ thiếu/lỗi thời và trạng thái đối soát.                                                                                                          |
| UC18 eligibility chính thức, FINALIZE, REOPEN | **BLOCKED bởi policy/nguồn dữ liệu**                              | Không có xác nhận nguồn học vụ/nợ học phần cho UC18; chưa chốt nguồn thời hạn UC18 và quy tắc mở lại. Không tạo producer snapshot hay endpoint chốt giả để vượt các khoảng trống này.                                                                                                                  |

**Không tuyên bố UC17/UC18 hoặc Bước 9–10 đã hoàn thiện.** Preview không phải quyết định eligibility chính thức, không ghi DefenseEligibility và không sinh danh sách sinh viên được phép bảo vệ.

Ba khóa C01 giữ nguyên, không sửa hoặc mở lại. 30 regression test score/committee/stats tiếp tục PASS trong full backend suite.

## 2. Căn cứ và các quyết định chưa đủ

Đã đối chiếu:

- [Audit tổng thể](project-audit-step9-10.md), đặc biệt M01/M05 (inbox/view UC17), H04 (workflow UC18 còn thiếu), M03 (PostgreSQL và thời gian giữ khóa PDF).
- [Gói nền tảng H01/H02/H03/M04](foundation-stability-h01-h02-h03-m04.md): policy official assignment và grant đã có, không quay lại role bypass hoặc plan PUBLISHED sau bàn giao.
- [Đặc tả UC17–UC18](../frontend/source-extracts/Project_1_06.md), Table 49–50, khoảng dòng 831–858. UC17 yêu cầu danh sách do GVHD hướng dẫn, cảnh báo tiến độ, lý do từ chối, lịch sử và thông báo cho Khoa. UC18 yêu cầu nguồn học vụ/nợ học phần **được xác nhận**; phương án nhập/xác nhận thủ công trong ngoại lệ được ghi rõ là đề xuất cần Khoa xác nhận.
- [Business decisions](../implementation/01-business-decisions-and-contract.md), [use case](../spec/dac-ta-use-case.md), [điểm cần xác nhận](../spec/diem-can-xac-nhan.md), Prisma và service/validator/read contract hiện hành.

Các điểm cần nhóm chốt, không tự chọn thay nhóm:

1. **Nguồn học vụ UC18:** `Student.academicEligible` mặc định true phục vụ catalog/luồng trước; không có metadata xác minh học vụ/nợ học phần theo đợt tại UC18. `DefenseEligibility` hiện chỉ có status/checkedAt/note, không có actor, source hay evidence revision. Không suy ELIGIBLE, checkedAt hoặc cờ mặc định thành chứng nhận học vụ/chốt danh sách.
2. **Xác nhận thủ công:** ai được xác nhận, phạm vi, bằng chứng phải lưu, nội dung/chính sách kiểm tra và khả năng thu hồi. Nếu cần model provenance mới, phải duyệt thiết kế/schema trước; gói này không sửa schema.
3. **Thời hạn UC18:** đặc tả nói đến mốc xét nhưng chưa có nguồn cấu hình chính thức cho xét/chốt/mở lại. Không dùng phase FINAL, mốc nộp PDF hay cửa sổ UC17 thay thế.
4. **REOPEN:** điều kiện cho phép sau chốt, permission riêng hay reuse manage, lý do bắt buộc, tác động khi các nghiệp vụ sau đã bắt đầu. Việc lifecycle có OPEN sau FINALIZED chưa đủ để tự lựa chọn toàn bộ policy mở lại.
5. **Trường hợp đặc biệt:** bảo lưu quay lại, phản biện nhưng chưa bảo vệ, đủ sau bổ sung; chưa có mapping dữ liệu/bằng chứng và quy tắc duyệt đầy đủ để tự ghi các trạng thái chính thức này.
6. **Thông báo:** gói đã làm thông báo trong ứng dụng cho Khoa có grant/quyền đọc; không tự chọn SMTP, nhắc hạn theo lịch hoặc chuyển Khoa xử lý quá hạn. Các phương án tự động này cần policy/template/lịch được duyệt nếu triển khai sau.

## 3. UC17 đã bổ sung

### Inbox và quyền đọc

- Dùng JWT actor, kiểm tra lại ACTIVE/mustChangePassword và permission tại service.
- ADVISOR cần quyền đọc UC17, policy đọc guidance hiện có, tài khoản lecturer hoạt động và GVHD chính thức. Danh sách kiểm tra TermWorkflow.officialAssignmentPlanId, plan FINALIZED cùng term, metadata chốt, roster lecturer, ownership TermStudent và AssignmentChange hiện hành qua validator đã có.
- Không dùng GuidancePlan hoặc role LECTURER để tự cấp quyền. GVHD cũ, sai term/official pointer, PUBLISHED/DRAFT hoặc change trong tương lai không được vào inbox GVHD.
- Lọc ALL/PENDING/CONFIRMED/REJECTED/UNKNOWN; UNKNOWN tách legacy/không xác minh khỏi CONFIRMED. Quyết định CONFIRMED vẫn giữ đúng ý nghĩa hiện hành khi PDF/phân công thay đổi; cờ stale đi kèm, không tự đổi status.
- STUDENT chỉ lấy roster/hồ sơ của student gắn JWT. Frontend chỉ tải quyết định hiện hành, không tải context nội bộ hoặc history.
- FACULTY/ADMIN cần permission đọc và grant đúng term/department. Không có role bypass. Chỉ trả trường được phép; không trả storageKey, filePath, checksum, snapshot quyết định hoặc snapshot toàn đợt trong inbox.
- Tài khoản đồng thời FACULTY và GVHD được nhận viewer ADVISOR khi thực sự có phân công chính thức cho hồ sơ đó, giúp frontend không bị khóa nhầm ở chế độ chỉ đọc. Ngoài phân công vẫn phải đi qua grant của Khoa.
- Inbox đọc một RepeatableRead transaction. Facts roster/proposal/assignment lấy theo lô; progress chỉ đọc cho trang GVHD đang xem. Không đọc file PDF trong inbox. PDF state UNVERIFIED/legacy và cờ null không bị tự đổi thành READY/false.

### Quyết định, PDF và thông báo

- Tái sử dụng API context/PDF/PUT/history hiện có, không thay hợp đồng expectedRevision/expectedContext hay upload PDF.
- Frontend lấy quyết định để xác định viewer trước khi tải phần riêng của GVHD; Khoa có history theo policy hiện hành.
- expectedContext/PDF identity vẫn do backend tạo. 409 làm tải lại và yêu cầu xem/xác nhận lại; không tự retry PUT/download hay cập nhật DemoDb.
- Việc nộp lại PDF, kể cả cùng checksum nhưng revision mới, không đổi UC17, điểm, eligibility hoặc bản chốt lịch sử.
- Khi quyết định thực sự đổi, ghi Notification vào hạ tầng trong ứng dụng sẵn có **cùng transaction** với decision/history/audit. Recipient là FACULTY hoạt động, không bị yêu cầu đổi mật khẩu, có defense-confirmation:read và grant toàn đợt hoặc department đúng routing hồ sơ.
- Không đưa tên sinh viên, nhận xét riêng, PDF identity hay đường dẫn storage vào notification. Link mở lại quyết định theo quyền hiện hành. Không có recipient hợp lệ thì không tự tạo người nhận/grant.
- changed=false không tạo notification; concurrency/revision kiểm tra đầy đủ trước nhánh này. Notification insert lỗi rollback toàn transaction; mock unit đã kiểm chứng hành vi rollback mô phỏng.
- Không tái sử dụng sai template/worker EmailOutbox của phân công; không tạo cơ chế gửi ngoài hệ thống hiện có.

## 4. UC18 preview và frontend thực

- Bắt đầu từ **TermStudent**, không bắt đầu từ tập hồ sơ đã có PDF hoặc đã CONFIRMED. Toàn đợt giữ các dòng thiếu Proposal/PDF/quyết định. Bộ môn chỉ thấy routing thuộc grant và nhận `rosterCompleteForTerm=false`; không tự mở quyền cho dòng chưa xác minh routing.
- Full-term grant trả `scope=TERM`, `rosterCompleteForTerm=true`; `rosterCount` luôn là số dòng trong phạm vi trước lọc. `total` là số dòng sau lọc, phân trang ổn định theo studentCode/id. Missing/corrupt proposal vẫn có dòng roster, không được bỏ đi để danh sách có vẻ hoàn chỉnh.
- Đọc official assignment và decision/snapshot qua validator UC17. Phát hiện đổi GVHD hoặc PDF revision khác snapshot, kể cả checksum giống nhau. Preview PDF chỉ xác minh metadata, không đọc byte/hash hàng loạt hoặc tuyên bố READY. Context/download của GVHD giữ cơ chế xác minh byte riêng.
- Hàm thuần phân loại đối soát: NOT_APPROVED, WAITING_ADVISOR, REVIEW_REQUIRED, ACADEMIC_UNVERIFIED; có reason code. Progress chưa hoàn thành tiếp tục là cảnh báo UC17, không được thêm làm điều kiện cấm CONFIRMED.
- `officialEligibility=UNKNOWN`, `admitted=false`, `admittedCount=0` khi chưa có nguồn xác minh học vụ. Đây là fail closed của một preview chưa đủ bằng chứng, **không ghi INELIGIBLE cho tất cả sinh viên**. Không coi CONFIRMED là đủ điều kiện.
- Reader UC18 vẫn được gọi với transaction hiện tại. Bản chốt lịch sử hợp lệ vẫn FINALIZED khi dữ liệu hiện hành đổi; không chỉnh snapshot hay đổi thành OPEN. Không trả snapshot toàn đợt qua preview.
- Frontend thật đọc state/preview, lọc và phân trang; có loading/empty/error và thông báo quyền. Người có manage + grant toàn đợt có thể tạo DRAFT, mở DRAFT → OPEN bằng expectedRevision và API hiện có. Không yêu cầu đủ PDF/UC17 mới được mở OPEN.
- Duplicate create và revision conflict trả 409, frontend tải lại để người dùng kiểm tra, không retry ghi tự động. Backend DRAFT/OPEN giữ term lock trước, validation trạng thái đợt/CAS/audit trong cùng transaction.
- FINALIZE/REOPEN chưa có endpoint; frontend tắt thao tác và hiển thị rõ những căn cứ còn thiếu. `capabilities.canFinalize/canReopen=false` là khả năng triển khai hiện có, không phải verdict giả về dữ liệu đã chốt.

## 5. API, frontend và cấu hình

Các endpoint trong bảng có prefix `/api` khi chạy backend.

| API                                                             | Quyền và dữ liệu                                                                                                                                           |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mới** GET /defense-confirmations/terms                        | defense-confirmation:read; options từ grant/own roster/official assignment của actor                                                                       |
| **Mới** GET /defense-confirmations/inbox                        | defense-confirmation:read; query termId, view ADVISOR/STUDENT/FACULTY, status, page, limit ≤100; scope service kiểm tra độc lập                            |
| GET /proposals/:proposalId/defense-confirmation-context         | GVHD chính thức; context và PUT expectations từ backend                                                                                                    |
| GET /proposals/:proposalId/defense-confirmation                 | Own student/current advisor/scoped faculty                                                                                                                 |
| GET /proposals/:proposalId/defense-confirmation/history         | Current advisor/scoped faculty; cursor history sẵn có                                                                                                      |
| GET /proposals/:proposalId/defense-confirmation/report/download | Current advisor; finalReportId, revision, checksum của context                                                                                             |
| PUT /proposals/:proposalId/defense-confirmation                 | defense-confirmation:decide, official advisor, UC17 window, UC18 OPEN, CAS/context; CONFIRMED cần PDF hợp lệ, REJECTED cần note, thay đổi cần changeReason |
| **Mới** GET /defense-lists/terms                                | defense-list:read; chỉ đợt thuộc grant                                                                                                                     |
| **Mới** GET /terms/:termId/defense-list/preview                 | defense-list:read + grant; query page, limit ≤100, result; không ghi dữ liệu                                                                               |
| GET /terms/:termId/defense-list                                 | Metadata và UC18 verified state, không tạo dữ liệu                                                                                                         |
| POST /terms/:termId/defense-list                                | Body {}; defense-list:manage + allDepartments=true; chỉ tạo DRAFT                                                                                          |
| POST /terms/:termId/defense-list/open                           | Body {expectedRevision}; quyền quản lý toàn đợt; DRAFT → OPEN                                                                                              |

Ví dụ API mới:

```http
GET /api/defense-confirmations/inbox?termId=<term>&view=ADVISOR&status=PENDING&page=1&limit=25
GET /api/terms/<term>/defense-list/preview?result=WAITING_ADVISOR&page=1&limit=25
```

Các response dùng envelope ApiResponse hiện có. Client không được gửi actor/student/assignment/PDF snapshot để quyết định quyền. Query strict từ chối field ngoài hợp đồng. Không thêm permission/seed/grant trong gói; tái sử dụng defense-confirmation:read/decide và defense-list:read/manage đã có.

| Route frontend            | Cấu hình                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| /guidance/defense-confirm | VITE_DEFENSE_CONFIRMATION_API=true + VITE_AUTH_API=true; inbox, chi tiết GVHD, own student/scoped faculty read-only |
| /defense/eligibility      | **Mới:** VITE_DEFENSE_LIST_API=true + VITE_AUTH_API=true; state/preview/DRAFT/OPEN thật                             |
| /guidance/final-report    | Giữ nguyên flag riêng VITE_FINAL_REPORT_API và cơ chế nộp lại                                                       |

Flag UC18 mặc định false trong env example và test config. Tắt flag giữ demo có nhãn; bật flag thiếu auth thật báo cấu hình lỗi. Route API chạy độc lập DemoDb/workspace snapshot; mọi lỗi API không fallback mock. Không đổi file env cá nhân hoặc tự bật chế độ thật cho người dùng.

## 6. File tạo/sửa trong gói này

Working tree đã có nhiều thay đổi/untracked từ trước, gồm schema/migration/seed và UC17/PDF/C01. Danh sách sau chỉ ghi thao tác của gói B, không quy toàn bộ git diff cho lượt này.

Backend — tạo:

- backend/src/defense/reviews/defense-review.repository.ts
- backend/src/defense/reviews/defense-review.repository.spec.ts
- backend/src/defense/reviews/defense-review.service.ts
- backend/src/defense/reviews/defense-review.service.spec.ts
- backend/src/defense/reviews/defense-review.controller.ts
- backend/src/defense/reviews/defense-review.http.spec.ts
- backend/src/defense/reviews/defense-review.dto.ts
- backend/src/defense/reviews/defense-review.module.ts
- backend/src/defense/reviews/defense-review.test-fixtures.ts
- backend/src/defense/reviews/defense-eligibility.policy.ts
- backend/src/defense/reviews/defense-eligibility.policy.spec.ts
- backend/src/guidance/defense-confirmations/defense-confirmation-notification.spec.ts

Backend — sửa file hiện có trong working tree:

- backend/src/defense/defense.module.ts
- backend/src/guidance/defense-confirmations/defense-confirmation-command.repository.ts
- backend/src/guidance/defense-confirmations/defense-confirmation-command.service.ts
- backend/src/guidance/defense-confirmations/defense-confirmation-command.test-fixtures.ts
- backend/src/guidance/defense-confirmations/defense-confirmation-read.service.ts
- backend/src/guidance/defense-confirmations/defense-confirmation-read.service.spec.ts

Frontend — tạo:

- frontend/src/features/guidance/defense-confirmations/inbox.tsx
- frontend/src/features/guidance/defense-confirmations/inbox.spec.tsx
- frontend/src/features/defense/defense-lists/api.ts
- frontend/src/features/defense/defense-lists/api.test.ts
- frontend/src/features/defense/defense-lists/page.tsx
- frontend/src/features/defense/defense-lists/page.spec.tsx
- frontend/src/features/defense/defense-lists/README.md

Frontend — sửa:

- frontend/src/features/guidance/defense-confirmations/api.ts
- frontend/src/features/guidance/defense-confirmations/api.test.ts
- frontend/src/features/guidance/defense-confirmations/types.ts
- frontend/src/features/guidance/defense-confirmations/page.tsx
- frontend/src/features/guidance/defense-confirmations/components.spec.tsx
- frontend/src/features/guidance/defense-confirmations/README.md
- frontend/src/app/router/routes.tsx
- frontend/src/app/router/route-manifest.ts
- frontend/.env.example
- frontend/vitest.config.ts

Báo cáo: docs/audits/step9-uc17-uc18-implementation.md (tạo).

Không sửa schema/migration, seed, API upload PDF, TermWindowService, công thức điểm hoặc workflow Bước 1–8. Module mới tái sử dụng validator UC17 và reader UC18 trung lập; không tạo phụ thuộc vòng guidance/defense.

## 7. Kiểm thử thực tế

| Kiểm tra                                                                             | Kết quả                    |
| ------------------------------------------------------------------------------------ | -------------------------- |
| Backend full unit, explicit exclude integration, GPMS_INTEGRATION không phải 1       | **PASS 963/963 — 66 file** |
| Frontend full unit                                                                   | **PASS 298/298 — 30 file** |
| Backend regression sau tối ưu tái sử dụng facts trong cùng snapshot và hoàn tất diff | **PASS 74/74 — 6 file**    |
| Frontend UC17/UC18 regression sau chỉnh thông báo lỗi cuối                           | **PASS 81/81 — 7 file**    |
| Backend/frontend/shared TypeScript `tsc --noEmit --incremental false`                | **PASS**                   |
| Backend lint toàn bộ src                                                             | **PASS**                   |
| Frontend lint toàn bộ src                                                            | **PASS**                   |
| git diff --check                                                                     | **PASS**                   |
| PostgreSQL integration/migration/seed/Docker                                         | **NOT RUN theo giới hạn**  |
| Browser E2E/SMTP/dữ liệu thật/production build                                       | **NOT RUN**                |

Các test mới bổ sung 36 backend và 18 frontend so với nền 927/280. Backend gồm: official advisor inbox, PUBLISHED/DRAFT không chính thức, sai term/pointer, đổi GVHD/future change, permission/account, own student, grant toàn đợt/bộ môn, missing roster evidence, stale PDF revision cùng checksum, legacy, classification thuần, notification no-op/rollback/scope query, dual-role viewer, repository transaction và Nest wiring.

7 HTTP test mới chạy controller/DTO/JWT/permission guard thật với repository và user/session giả, chỉ mở HTTP localhost cổng ngẫu nhiên; không khởi tạo database. Bao phủ 401, 403 permission, 403 grant, 400 query giả mạo/invalid, inbox hợp lệ, preview thiếu Proposal, term options theo actor. Đây là HTTP-level unit, không phải PostgreSQL integration.

Frontend test adapter và SSR: flag/auth, no fallback khi lỗi 400/401/403/404/409/422/503, create/open exact DTO, inbox/status/filter/pagination, preview thiếu dữ liệu/partial scope, cờ stale, own-student/faculty không có form/context GVHD. Test GET-context → PUT, PDF identity, changeReason và conflict đã có vẫn chạy lại trong full suite.

Lần đầu test frontend sau thêm inbox có một lỗi harness thiếu QueryClientProvider; đã sửa harness và chạy lại PASS. Cảnh báo Vite CJS, useLayoutEffect trong SSR và cleanup giả lập trong unit không làm suite fail. Không tắt lint rule hoặc sửa logic nghiệp vụ để né test.

## 8. Những phần cần PostgreSQL và dữ liệu thật

1. Replay migration lên PostgreSQL **cô lập đã chứng minh quyền sở hữu**, kiểm tra CHECK/FK composite pointer cùng term/revision, trigger immutable history/finalization, JSONB/canonical SHA-256 round-trip và dữ liệu legacy không có history giả.
2. UC17 thực sự có hai kết nối: expectedRevision/context cạnh tranh; audit/history/notification lỗi rollback cả decision; permission/grant bị thu hồi; recipient query phải chỉ khớp actor/grant/routing đã chỉ định.
3. PDF reupload cạnh tranh PUT/download; cùng checksum khác revision; cleanup không xóa file còn tham chiếu; không tự đổi quyết định hay eligibility.
4. Đo term lock/transaction timeout khi đọc PDF. Code hiện vẫn giữ term lock trong I/O ở command/download; không có số đo load/lock/deadlock PostgreSQL trong gói này.
5. Request chờ khóa qua hạn UC17 dùng database clock phải bị từ chối. Kiểm tra giao thức THESIS_TERM trước giữa PUT/PDF/DRAFT/OPEN; FINALIZE tương lai phải tham gia cùng giao thức. Không tuyên bố đã test API FINALIZE chưa tồn tại.
6. Xác minh dữ liệu cá nhân test: active accounts, permissions, grants/routing, TermStudent, Proposal APPROVED, official plan FINALIZED/AssignmentChange, private PDF và hai cửa sổ riêng, DefenseList OPEN. Không dùng seed/migration/shared DB chỉ để làm UI trông có dữ liệu.
7. Browser end-to-end từ inbox đến download/decision/history, Khoa nhận thông báo và read-only views. Unit SSR không thay thế thao tác browser.
8. Preview hiện đọc metadata toàn roster trước phân trang để không làm thiếu danh sách; progress là truy vấn theo hồ sơ trong trang tối đa 100. Chưa kiểm chứng hiệu năng trên đợt lớn/độ trễ DB thật; cần đo trước vận hành.

## 9. Bước tiếp theo

Chốt **hợp đồng chứng cứ học vụ UC18** với Khoa: nguồn, người xác nhận, dữ liệu/provenance theo term/student, các điều kiện học vụ và xử lý ngoại lệ. Cùng biên bản xác định nguồn thời hạn UC18 và policy REOPEN. Sau duyệt mới thiết kế phần schema còn thiếu (nếu cần), producer snapshot và FINALIZE/REOPEN có CAS, audit, expected preview/context và lock THESIS_TERM trước.

Trong lúc chờ quyết định này có thể chuẩn bị kiểm thử UC17 bằng PostgreSQL cá nhân/cô lập được xác minh, nhưng không tự cấp quyền hoặc dùng database chung. Không mở C01, không bắt đầu UC19–25 trong gói này.

**Xác nhận an toàn:** không kết nối hoặc thao tác database thật/chung; không chạy migration, seed, reset, db push hay Docker; không sửa schema/migration/connection string. Không tạo dữ liệu/tài khoản thật. Tất cả dữ liệu mới trong test chỉ nằm trong mock/in-memory fixture.
