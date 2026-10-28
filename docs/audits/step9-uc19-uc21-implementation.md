# Gói C — UC19, UC20, UC21

Ngày 27/10/2026. Dự án `C:\DATN\Project1`. Đối chiếu working tree thực tế, không coi báo cáo cũ là bằng chứng kiểm thử hiện tại.

## 1. Trạng thái thực tế

| Use case         | Trạng thái  | Đã triển khai, kiểm thử không DB                                                                                                                                                     | Phần còn BLOCKED                                                                                              |
| ---------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| UC19 — Hội đồng  | **PARTIAL** | API đọc theo grant, danh sách/chi tiết bản ghi cũ có nhãn UNVERIFIED; nhập/sửa phương án chưa lưu; preview kiểm tra cơ cấu, trùng thành viên/hồ sơ, xung đột GVHD và phạm vi dữ liệu | Lưu nháp DB, tạo/cập nhật hội đồng có hiệu lực, phân sinh viên trước khi có lịch, chốt và điều chỉnh sau chốt |
| UC20 — Phản biện | **PARTIAL** | API đọc bản ghi cũ; phương án GVPB dùng nguồn GVHD chính thức; kiểm tra xung đột/trùng/ngoài roster, thống kê tải phản biện                                                          | Phân công/chỉnh sửa/chốt chính thức, cấp quyền hồ sơ cho GVPB, gửi thông báo phân công                        |
| UC21 — Lịch      | **PARTIAL** | API đọc lịch cũ chưa xác minh công bố; phương án thời gian/phòng nhập cụ thể; preview xung đột phòng, hội đồng, giảng viên và sinh viên, có đối soát lịch đã lưu kể cả khác đợt      | Lưu/chốt/công bố lịch chính thức, chỉnh sau công bố, thông báo và quyền tra cứu lịch đã công bố cho SV/GV     |

**Không có thao tác ghi chính thức được mở trong gói này.** Đây là phần đọc và lập phương án có backend thật, không phải triển khai hoàn chỉnh UC19–UC21. Phần ghi bị chặn bởi schema workflow, UC18 producer và policy chưa được duyệt; chưa có PostgreSQL hoặc browser E2E làm bằng chứng nghiệm thu.

API mode không dùng DemoDb. POST preview thực hiện SELECT/validation, trả `mode=PREVIEW_ONLY`, `persisted=false`, `officialReady=false`, kể cả khi không phát hiện lỗi. Nó không lưu hội đồng/phản biện/lịch, không tạo quyền GVPB, audit nghiệp vụ hoặc notification giả. Các nút lưu/chốt/công bố chính thức bị tắt và **không có endpoint ghi tương ứng**; request thử các route ghi không tồn tại nhận 404.

## 2. Căn cứ và lý do chặn phần ghi

Đã đọc [đặc tả gốc](../frontend/source-extracts/Project_1_06.md), Table 51–53 (UC19–UC21, khoảng dòng 861–905), [business decisions](../implementation/01-business-decisions-and-contract.md), [đặc tả tổng hợp](../spec/dac-ta-use-case.md), [audit](project-audit-step9-10.md), [gói nền tảng](foundation-stability-h01-h02-h03-m04.md), [gói B](step9-uc17-uc18-implementation.md), Prisma/migration gốc và code backend/frontend hiện hành.

Đặc tả quy định UC19 sau danh sách UC18 đã chốt; hội đồng 3–5 giảng viên, có Chủ tịch/Thư ký/Ủy viên, chặn GVHD chấm SV mình. UC20 sau UC19, cấm GVHD làm GVPB, có bước chốt/thông báo. UC21 sau hội đồng/danh sách đã chốt, có chốt/công bố và kiểm tra trùng; thứ tự alphabet chỉ áp dụng nếu Khoa xác nhận.

| Nguồn hiện có                                          | Thiếu dữ liệu để viết workflow an toàn                                                                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/prisma/schema.prisma:1131` — DefenseCommittee | Chỉ id/termId/name/createdAt; không có DRAFT/FINALIZED, revision, actor/time chốt hoặc sourceFinalizationId UC18                                           |
| `schema.prisma:1145` — CommitteeMember                 | Role là String; chưa có metadata quyết định chính thức/cơ cấu đã khóa                                                                                      |
| `schema.prisma:1175` — CommitteeStudent                | Sinh viên gắn DefenseSession; không có allocation độc lập để hoàn tất UC19 **trước** khi lập lịch UC21. Không tạo session/giờ/phòng giả để lách thiếu bảng |
| `schema.prisma:1104` — ReviewerAssignment              | Chỉ proposal/reviewer/assignedAt, unique cặp; không có trạng thái nháp/chốt, revision, nguồn hội đồng/UC18 hoặc lịch sử thay đổi                           |
| `schema.prisma:1158` — DefenseSession                  | Có scheduledAt/durationMin và danh sách orderIndex; không có lifecycle nháp/chốt/công bố, revision/actor/time công bố hoặc slot riêng từng SV              |
| UC18 reader và immutable DefenseListFinalization       | Có hợp đồng đọc/integrity; producer FINALIZE/REOPEN của UC18 vẫn chưa được duyệt và chưa có API tạo bản chốt chính thức                                    |
| TermParameter / term-configuration.validator.ts        | Chưa có contract đã duyệt cho quy mô cấu hình hội đồng, sức chứa SV/hội đồng, số GVPB, deadline và điều kiện sửa sau chốt                                  |

Không ghi lifecycle vào name, role, audit JSON hoặc outbox để thay cho schema; không dùng createdAt/assignedAt/sự tồn tại của record làm bằng chứng đã chốt/công bố. Không sửa schema/migration hoặc tự hoàn tất UC18 để vượt các thiếu hụt này.

Đối chiếu migration `backend/prisma/migrations/0_init/migration.sql:430`: ROOM có `name NOT NULL`, trong khi model Room hiện không khai báo name. Có các khác biệt legacy về nullability/chính sách cascade giữa SQL và model chưa được kiểm chứng trên PostgreSQL. Đây là rủi ro tương thích có thật từ source, chưa phải lỗi runtime đã tái hiện. Phần đọc mới chỉ chọn id/code/capacity của Room; không sửa migration cũ hoặc tự chọn chính sách xóa. Phải đối chiếu DB test trước khi thiết kế writer.

## 3. Dữ liệu, phân quyền và transaction

### Quyền quản lý toàn đợt

- JWT/permission guard hiện có; controller có permission riêng, service kiểm tra lại actor/id/status ACTIVE/mustChangePassword, role FACULTY và permission.
- `defense-planning:read` cho GET; preview còn cần `defense-planning:preview` **và** read.
- Cần AcademicTermGrant `allDepartments=true` của đúng actor/term. ADMIN/FACULTY không tự bỏ qua grant; COMMITTEE/LECTURER không tự là người lập phương án quản lý.
- Bộ môn chưa được tự cấp quyền xem toàn bộ một hội đồng có thể chứa nhiều bộ môn. Phần quản lý/đọc planning theo bộ môn **BLOCKED**, cần duyệt ownership/routing hội đồng và cách tách dữ liệu trước.
- Định nghĩa permission được thêm bằng helper seed tách biệt, chỉ FACULTY read/preview, không wildcard ADMIN. Không tạo permission manage/publish, grant, tài khoản hoặc cấu hình mặc định; **không chạy seed**. Test helper chỉ dùng client giả.

### Nguồn danh sách

- Nếu UC18 UNKNOWN/DRAFT/OPEN: nguồn `ROSTER_PREVIEW` bắt đầu từ TermStudent, giữ cả dòng chưa có Proposal; `admitted=null`, `admittedCount=null`. Không suy từ DefenseEligibility hoặc cờ academicEligible.
- Nếu reader trả FINALIZED: đọc đúng finalizationId trong transaction caller, kiểm tra term/revision/version/metadata, parse Snapshot V1 và tính lại canonical SHA-256. Không tin hash chỉ vì có 64 ký tự, không chọn bản lịch sử MAX(version).
- Dùng **roster đóng băng trong snapshot** và admitted flag; sinh viên mới thêm vào roster hiện hành không tự được đưa vào danh sách chính thức. Hồ sơ admitted=false bị lỗi `NOT_ADMITTED_BY_UC18` nếu chọn vào phương án.
- Snapshot hash hợp lệ chưa đủ để bỏ qua mâu thuẫn hiển nhiên: nếu admitted=true nhưng snapshot không có quyết định CONFIRMED, trả blocker/issue `UC18_ADMISSION_INCONSISTENT`. Không sửa bản chốt hoặc đổi trạng thái lịch sử thành OPEN.
- GVHD hiện hành lấy từ TermWorkflow.officialAssignmentPlanId + AssignmentPlan FINALIZED + metadata chốt + roster + AssignmentChange mới nhất, qua validator UC17 có sẵn. Không suy từ GuidancePlan hoặc PUBLISHED.
- So sánh assignment/PDF/decision metadata hiện hành với snapshot; PDF cùng checksum nhưng revision mới vẫn STALE. Dữ liệu thiếu trả UNKNOWN; lịch sử FINALIZED vẫn giữ FINALIZED. Preview không đọc byte PDF, không coi metadata trùng là kiểm chứng nội dung file.
- DTO chỉ trả dữ liệu quản lý cần thiết; không trả storageKey, filePath, checksum, nhận xét riêng, JSON snapshot UC18 hoặc dữ liệu sinh viên của đợt khác.

### Transaction và concurrency của preview

- Một Prisma RepeatableRead transaction cho mỗi operation đọc; reader UC18 nhận đúng transaction này, không mở transaction lồng và không ghi dữ liệu.
- GET context cấp `expectedContext` là SHA-256 của các facts server. Preview đọc lại quyền/grant, nguồn UC18, ownership/assignment, PDF metadata, catalog và records; khác hash trả 409. Hash chỉ chống dữ liệu cũ, **không phải quyền truy cập hoặc reservation**.
- Không giữ THESIS_TERM row lock hoặc đọc/hash file trong gói C vì không có writer chính thức. Mọi kết quả preview là quan sát tại transaction đọc, không cam kết tài nguyên lịch chưa thay đổi sau response.
- Kiểm tra lịch đã lưu xuyên đợt chỉ dùng interval, resource IDs và student IDs cần thiết. Chỉ trả conflict code/message chung; không lộ tên/ID hồ sơ, hội đồng hoặc session của đợt khác.
- Các ID giảng viên/hồ sơ không nằm trong nguồn được phép chỉ nhận lỗi scope; không được dùng để thăm dò booking ngoài phạm vi. Mã hội đồng tạm của client không được so như identity hội đồng DB. Khoảng thời gian ngoài đợt bị loại trước truy vấn booking toàn cục.
- Query overlap dùng tham số SQL và interval duration thực tế; không đoán giới hạn duration để cắt mất phiên dài. Cùng SV dưới Proposal khác đợt vẫn được kiểm tra qua Proposal.studentId.
- Khi người lập phương án chọn giả định GVPB tham dự, so sánh cả reviewer IDs của lịch đã lưu. Không tự biến giả định này thành policy xuất bản.

## 4. Những kiểm tra chạy độc lập được

**UC19:** nhập/sửa/xóa hội đồng trong bộ nhớ phương án; chọn roster giảng viên hoạt động, 3–5 người; kiểm tra trùng người, thiếu Chủ tịch/Thư ký, trùng phân bổ SV, hồ sơ ngoài nguồn và GVHD chấm SV mình. Trùng tên hoặc nhiều người cùng chức danh được cảnh báo để đối soát, không tự đặt unique-name/quorum policy. Sức chứa SV người dùng nhập chỉ là giả định preview, có nhãn rõ; không cập nhật TermParameter.

**UC20:** chọn GVPB cho các hồ sơ đã phân hội đồng trong phương án. Kiểm tra trùng, ngoài đợt/tài khoản không hoạt động, không xác minh được GVHD, GVHD làm GVPB. Thống kê tải từng người; không tự đặt một/hai GVPB, reviewer phải thuộc hội đồng, ngưỡng tải hoặc thuật toán phân công tự động. Chưa có GVPB được báo rõ; không gửi notification hoặc cấp quyền UC22 từ preview.

**UC21:** nhập rõ bắt đầu/kết thúc/phòng và hồ sơ thuộc hội đồng đề xuất; kiểm tra khoảng thời gian, trong đợt, trùng room/committee/lecturer/student, reviewer thiếu và chỗ ngồi tối thiểu của người tham dự đã biết. Hai interval sát nhau `[start,end)` không bị coi trùng. Có kiểm tra tương tác với bản ghi lịch cũ, kể cả khác đợt; các record cũ không bị coi đã công bố. Không tự chọn thời lượng default 30 phút hoặc áp alphabet. Việc nhập thời gian theo múi giờ máy được ghi rõ, gửi ISO có offset/UTC tới API.

Giới hạn arrays 200 hội đồng/1.000 dòng trong shared contract là **giới hạn tài nguyên request preview**, không phải quy mô tối đa nghiệp vụ, sức chứa chính thức hoặc số GVPB được Khoa phê duyệt. Cần đo/tinh chỉnh cho đợt lớn trước nghiệm thu.

## 5. API và giao diện

Tất cả API dưới đây có prefix `/api`, JWT, permission và grant đúng đợt:

| Method / route                                              | Hành vi                                                                                                  |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| GET /defense-planning/terms                                 | Chỉ options thuộc grant toàn đợt của actor                                                               |
| GET /terms/:termId/defense-planning/context                 | Nguồn roster/bản chốt đã xác minh, GVHD hiện hành, lecturer/room candidates, expectedContext và blockers |
| GET /terms/:termId/defense-planning/committees              | Records legacy với lifecycle UNVERIFIED, không phải danh sách hội đồng đã chốt                           |
| GET /terms/:termId/defense-planning/committees/:committeeId | Chi tiết trong đúng term/grant; ngoài scope hoặc không tồn tại trả 404                                   |
| GET /terms/:termId/defense-planning/reviewers               | Records legacy theo Proposal của term, UNVERIFIED                                                        |
| GET /terms/:termId/defense-planning/schedule                | Records legacy, không xác nhận công bố; loại tham chiếu Proposal ngoài term khỏi DTO                     |
| POST /terms/:termId/defense-planning/committees/preview     | expectedContext + committees[{key,name,members,proposalIds,maxStudents?}]                                |
| POST /terms/:termId/defense-planning/reviewers/preview      | Như trên + reviewers[{proposalId,reviewerIds}]                                                           |
| POST /terms/:termId/defense-planning/schedule/preview       | Như trên + slots[{key,committeeKey,proposalId,roomId,startsAt,endsAt}] + includeReviewersAsAttendees     |

`key` chỉ là mã dòng trong phương án của client, không có quyền sửa record DB. Query/body không nhận actorId, advisorId, student snapshot hoặc source snapshot làm dữ liệu có thẩm quyền. DTO strict từ chối field ngoài hợp đồng. Preview trả 200 kèm issues nếu phương án có xung đột; cấu trúc sai trả 400 tại HTTP/422 tại service, thiếu quyền 403, chưa đăng nhập 401, stale context 409, storage chưa có 503 khi nhận diện P2021/P2022.

Route frontend:

- `/defense/committees`: danh sách/chi tiết legacy và form phương án hội đồng.
- `/defense/reviewers`: chọn GVPB, cảnh báo xung đột/tải, records legacy.
- `/defense/schedule`: form lịch, sửa/bỏ dòng, giả định attendance và kiểm tra xung đột.

Bật riêng:

```dotenv
VITE_DEFENSE_PLANNING_API=true
VITE_AUTH_API=true
```

Khởi động lại Vite sau cấu hình. Flag mặc định false trong env example/test config; không sửa env cá nhân. API mode chạy trong layout riêng, dùng JWT/shared HTTP client, không hydrate DemoDb. Flag off giữ các prototype demo cũ với nhãn DEMO rõ ràng; không thêm API export UC25.

Ba màn hình dùng chung phương án React state trong layout, giữ khi chuyển tab UC19–UC21. Đổi term/session, reload hoặc rời layout có thể mất phương án chưa lưu; không ghi localStorage/sessionStorage/DB. Người có quyền read nhưng không preview vẫn xem được records cũ.

409 buộc tải lại và khởi tạo lại phương án; không tự rebase input sang source mới. 401/403 cũng làm kiểm tra lại nguồn/quyền. Response preview của phương án đã bị người dùng sửa được ẩn. Có loading/empty/error, nút thử tải lại và giải thích các điều kiện bị chặn. Không fake successful save hoặc fallback mock khi lỗi API.

## 6. File tạo/sửa trong gói C

Working tree đã có nhiều thay đổi của gói trước. Danh sách này chỉ ghi các file do gói C tạo/sửa, không quy toàn bộ git diff cho lượt này.

**Tạo backend:**

- backend/src/defense/planning/defense-planning.controller.ts
- backend/src/defense/planning/defense-planning.service.ts
- backend/src/defense/planning/defense-planning.repository.ts
- backend/src/defense/planning/defense-planning.policy.ts
- backend/src/defense/planning/defense-planning.module.ts
- backend/src/defense/planning/defense-planning.test-fixtures.ts
- backend/src/defense/planning/defense-planning.service.spec.ts
- backend/src/defense/planning/defense-planning.policy.spec.ts
- backend/src/defense/planning/defense-planning.repository.spec.ts
- backend/src/defense/planning/defense-planning.http.spec.ts
- backend/prisma/defense-planning-permissions.cjs

**Sửa backend:** backend/src/defense/defense.module.ts; backend/prisma/seed.cjs (chỉ wiring helper định nghĩa permission, không chạy).

**Shared:** tạo shared/src/contracts/defense-planning.ts; export thêm trong shared/src/index.ts. Build shared theo cơ chế hiện có để backend dùng runtime/declaration; output dist là generated/ignored, không phải thay schema/database.

**Tạo frontend:**

- frontend/src/features/defense/planning/api.ts
- frontend/src/features/defense/planning/layout.tsx
- frontend/src/features/defense/planning/pages.tsx
- frontend/src/features/defense/planning/api.test.ts
- frontend/src/features/defense/planning/pages.spec.tsx
- frontend/src/features/defense/planning/test-fixtures.ts
- frontend/src/features/defense/planning/README.md

**Sửa frontend:** frontend/src/app/router/routes.tsx; frontend/src/app/router/route-manifest.ts; frontend/.env.example; frontend/vitest.config.ts.

**Báo cáo:** docs/audits/step9-uc19-uc21-implementation.md.

Không sửa schema.prisma/migration, workflow UC17/UC18, API upload/download, công thức UC22–24, code UC25 hoặc ba controller legacy C01.

## 7. Kiểm thử thực tế

| Kiểm tra                                                                        | Kết quả                                      |
| ------------------------------------------------------------------------------- | -------------------------------------------- |
| Backend full unit cuối, explicit exclude integration và chặn GPMS_INTEGRATION=1 | **PASS 1.021/1.021 — 70 file**               |
| Frontend full unit                                                              | **PASS 317/317 — 32 file**                   |
| TypeScript backend/frontend/shared, noEmit và incremental=false                 | **PASS**, backend chạy lại sau thay đổi cuối |
| Shared build                                                                    | **PASS**                                     |
| Backend/frontend lint toàn bộ src                                               | **PASS**, backend chạy lại sau thay đổi cuối |
| Prettier các file gói C và git diff --check                                     | **PASS**                                     |
| node --check helper permission và seed.cjs                                      | **PASS**, chỉ parse, không execute seed      |
| PostgreSQL integration / SQL migration / seed / reset / db push / Docker        | **SKIPPED theo giới hạn; không kết nối DB**  |
| Browser E2E / kiểm thử dữ liệu thật / SMTP / frontend production build          | **NOT RUN**                                  |

Full backend cuối gồm **58 test mới** của gói C, frontend thêm **19 test** so với nền 963/298 của gói B. Lượt full 1.021 test chạy sau toàn bộ các sửa đổi cuối: mâu thuẫn admitted/CONFIRMED, chống thăm dò booking ngoài scope và chặn truy vấn khoảng thời gian ngoài đợt. Không cộng test chưa chạy vào kết quả.

Bao phủ backend: role/permission/ACTIVE/password/grant sai term hoặc partial grant, không dùng PUBLISHED, AssignmentChange, stale PDF/context, nguồn FINALIZED/hash hỏng, roster frozen không nhận sinh viên mới, admitted=false, cơ cấu/trùng/ngoài roster/GVHD conflict, trùng lịch giữa tài nguyên, interval sát nhau, cùng SV khác Proposal/đợt, generic foreign-conflict messages, legacy unverified và không có route ghi chính thức.

9 HTTP-level test mới dùng Nest controller, JWT/permission guards, validation pipe và exception filter thật với repository/user/session giả; chỉ mở HTTP localhost cổng ngẫu nhiên, không Prisma connection. Test module wiring override PrismaService, không chạy ứng dụng với datasource thật. Helper permission chỉ được gọi trên mock client.

Frontend: adapter cho GET/3 POST preview, exact context, flag/JWT, lỗi 400/401/403/404/409/422/503 không fallback/retry giả, strict input, source OPEN không giả admission, FINALIZED/STALE, preview không giả save, readonly faculty vẫn thấy records legacy, SSR/config-error screen. Đây là adapter/SSR tests, chưa kiểm thử click/browser thật.

Lượt test đầu có một lỗi do service khai báo Promise nhưng validation throw đồng bộ; đã đổi method thành async để trả rejected Promise nhất quán và chạy lại PASS. Cảnh báo Vite CJS/useLayoutEffect SSR và cleanup giả lập vẫn tồn tại, không phải test FAIL; không tắt lint rule hoặc né kiểm thử.

30 test C01 trong full suite tiếp tục PASS: SCORE_READING_NOT_ENABLED, COMMITTEE_READING_NOT_ENABLED, REPORT_STATS_NOT_ENABLED. Các reader cũ vẫn 403 sau JWT, không mở lại và không được frontend mới gọi.

## 8. Quyết định cần xác nhận và công việc trước nghiệm thu

1. Hoàn tất các quyết định nguồn học vụ, thời hạn và REOPEN của UC18. Chưa có producer chính thức thì không tạo dữ liệu FINALIZED giả để chạy luồng C.
2. Duyệt schema workflow tối thiểu: state/revision/actor-time/sourceFinalization cho hội đồng; allocation SV–hội đồng độc lập session; nguồn phân công GVPB đã chốt; lifecycle lịch/slot/công bố. Cần pointer/FK cùng term tới bản chốt bất biến, không suy nguồn từ record legacy. Đây là đề xuất, chưa tạo bảng/cột/migration.
3. Chốt phạm vi quyền bộ môn so với toàn đợt, quyền chỉnh sau chốt, ownership hội đồng, quyền xem bản chưa công bố. Hiện chỉ Khoa có permission + grant toàn đợt được đọc/preview; chưa cấp quyền SV/GV tra lịch chưa có publication proof.
4. Chốt size cấu hình trong khoảng đặc tả, sức chứa SV/hội đồng/buổi, số lượng chức danh/quorum/tiêu chuẩn Chủ tịch nếu có. Không suy Room.capacity thành số đồ án của hội đồng cả ngày.
5. Chốt số GVPB/hồ sơ, cần thuộc hội đồng hay không, nguồn tiêu chí phù hợp chuyên môn, giới hạn tải và thuật toán gợi ý. Hiện chỉ cho chọn/kiểm tra phương án, không áp quy tắc tự chọn một phản biện.
6. Chốt mốc cho tạo/chốt/công bố/sửa lịch, attendance GVPB/GVHD và quy tắc Tên + Họ đệm nếu áp dụng. Cần quyết định xử lý bằng chứng STALE khi PDF/GVHD đổi sau UC18 mà không tự sửa UC17/UC18.
7. Trước writer: thiết kế CAS/idempotency, lịch sử/audit và notification/outbox cùng transaction; giao thức THESIS_TERM trước tương thích UC17/PDF/UC18. Khóa tài nguyên lịch xuyên đợt theo thứ tự thống nhất, kiểm tra lại xung đột sau khóa; preview hiện tại không thay thế phần này.
8. PostgreSQL cô lập: replay migration, kiểm tra drift/nullability/FK/immutable snapshot, query timestamp/interval, hai kết nối độc lập, race assignment/booking/UC18 và rollback/audit/outbox. **Chưa có API writer để tuyên bố đã kiểm thử FINALIZE/PUBLISH hoặc lock/rollback của nó.**
9. Chuẩn bị permission/grant/roster/official assignment và dữ liệu test trên DB cá nhân đã xác minh; browser test ba màn hình, nguồn đổi/403/409, timezone và scale đợt lớn. Không chạy seed/migration trên DB chung để tạo điều kiện giả cho UI.

**Bước tiếp theo đề xuất:** duyệt một thiết kế schema/lifecycle chung cho UC19–UC21 và nguồn chốt UC18 trước khi viết bất kỳ command có hiệu lực nào. Trong khi chờ, các API đọc/preview hiện tại có thể được kiểm thử bằng repository giả và dữ liệu cá nhân đã xác minh sau này.

**Xác nhận:** không kết nối/thao tác database chung hoặc database thật; không chạy migration, seed, reset, db push hoặc Docker. Không sửa Prisma schema/migration hoặc tạo dữ liệu/tài khoản thật. Toàn bộ record FINALIZED trong test là fixture in-memory, không backfill hoặc tạo bản chốt trong database.
