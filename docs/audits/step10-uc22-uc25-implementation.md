# Gói F — UC22–UC25: implementation và ranh giới policy

Ngày 28/10/2026. Dự án `C:\DATN\Project1`.

**SQL NOT EXECUTED. Không kết nối bất kỳ PostgreSQL instance nào.** Không chạy migration, seed, reset, db push, Docker, cleanup hoặc tạo tài khoản/dữ liệu thật. Không giả định migration Gói E đã áp dụng. Prisma validate/generate chỉ dùng biến kiểm tra riêng `127.0.0.1:1`, không dùng URL ứng dụng; đây không phải kiểm thử PostgreSQL.

## 1. Trạng thái thực tế

| UC   | Trạng thái                                                  | Chức năng ở mức code/mock                                                                                                                                                                                  | Phần còn thiếu                                                                                                                                                                                                                                                        |
| ---- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UC22 | **PARTIAL**                                                 | Inbox GVPB chính thức; context, PDF riêng tư đúng identity; rubric phản biện 2+3+1+2+2; lưu draft/chốt phiếu cá nhân; CAS/context, idempotency, lịch sử/audit và thông báo Khoa atomic                     | Chưa mở sửa phiếu đã chốt khi quyền và quy trình đặc biệt chưa được duyệt; chưa kiểm thử dữ liệu thật                                                                                                                                                                 |
| UC23 | **PARTIAL**                                                 | Inbox thành viên theo UC19/UC21; rubric do Khoa cấu hình rõ; nhập/lưu/chốt phiếu cá nhân trong cửa sổ/buổi được kiểm tra; lịch sử và chống chấm sai quan hệ                                                | Quorum/xác nhận kết quả tập thể, biên bản Thư ký/Chủ tịch và sửa sau gửi cần quyết định riêng; không dùng việc thu đủ phiếu làm xác nhận Hội đồng                                                                                                                     |
| UC24 | **PARTIAL — command production còn BLOCKED/NEEDS_APPROVAL** | Typed policy phiên bản, engine Decimal, preview có lý do; transaction chốt/công bố theo từng hồ sơ, immutable versions, audit/idempotency/notification; reader SV chỉ trả bản PUBLISHED của mình           | Adapter điểm GVHD và xác nhận Hội đồng trả UNKNOWN; không có API tự duyệt quorum/làm tròn. Vì vậy runtime hiện tại không thể chốt/công bố thành công. Test nhánh thành công chỉ dùng nguồn đã duyệt **GIẢ LẬP trong repository test**, không phải phê duyệt nghiệp vụ |
| UC25 | **PARTIAL**                                                 | Excel phân công phản biện/lịch công bố/kết quả công bố từ backend; PDF bảng tra cứu kết quả có font tiếng Việt; thống kê bảo vệ theo grant; frontend tải binary riêng tư; audit và chống formula injection | Mẫu biên bản để ký, export phiếu chưa công bố cho thành viên Hội đồng, thống kê toàn bộ học vụ/tiến độ và mẫu hành chính đầy đủ chưa triển khai. Export kết quả thực còn phụ thuộc UC24                                                                               |

Không kết luận hoàn thiện Bước 9–10 hoặc sẵn sàng vận hành. Ba khóa C01 giữ nguyên JWT 401 / authenticated 403; không dùng chúng làm đường tắt cho API mới.

## 2. Căn cứ và những gì không được suy diễn

Đã đọc working tree, báo cáo implementation Gói E, unblock plan, `docs/spec/Project_1_06.docx` (trích XML trực tiếp từ file), `dac-ta-use-case.md`, `diem-can-xac-nhan.md`, ADR-0003, schema và migration grading/report/E. Bản DOCX UC22–25 quy định: đúng người được phân, PDF hoàn chỉnh, mốc phản biện; rubric/ngày-buổi bảo vệ; lưu nháp/gửi; xác nhận tập thể trước chốt/công bố; quyền xuất và mẫu biểu.

Markdown/ADR có căn cứ cho **QT = (GVHD + GVPB)/2**, **KTHP = trung bình Hội đồng**, **HP = 0,4 QT + 0,6 KTHP** và điều kiện từng thành phần đạt. Nhưng legacy aggregator tự mặc định/làm tròn khác nhau, `ScoreEntry.isLocked` và `FinalResult.isPublished` không có provenance của workflow mới. Gói F **không sửa công thức hoặc dữ liệu legacy** và không lấy các flag đó làm chứng cứ công bố.

`UTC_40_60_V1` là tên scheme typed theo tài liệu, không phải quyết định quorum/làm tròn đã được duyệt. Calculation policy lưu rõ quorum, chế độ ROUND_HALF_UP, số chữ số QT/KTHP/HP, dùng giá trị RAW/ROUNDED để xét đạt, ngưỡng từng thành phần và nguồn phê duyệt. Engine dùng Decimal, không dùng float/default của aggregator legacy. HP của scheme tính từ QT/KTHP sau bước làm tròn trung gian được khai báo trong phiên bản; phải chốt profile trước khi cho CONFIRMED.

API cấu hình chỉ nhận calculation **NEEDS_APPROVAL**. JSON đọc hỗ trợ bản CONFIRMED để hợp đồng tương lai/test có thể xác minh, nhưng không có endpoint hay seed tự tạo CONFIRMED. Hai adapter `AdvisorGradeReader` và `CouncilResultConfirmationReader` trả UNKNOWN có chủ ý. Điểm tuần/phase/evaluation hoặc ScoreEntry legacy không được tự chuyển thành điểm hướng dẫn cuối cùng. Không lấy role CHAIR/SECRETARY hay trạng thái SEALED của các phiếu để suy rằng Hội đồng đã xác nhận kết quả tập thể.

## 3. API

Prefix chung `/api/terms/:termId`.

| Method/path                                        | Chức năng / permission                                                                                                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/grading/inbox?kind=REVIEWER\|COMMITTEE`      | Hồ sơ của người chấm theo artifact hiện hành; `grading:read`                                                                                                                  |
| GET `/grading/proposals/:proposalId/:kind`         | Context + phiếu của chính người chấm + rubric/PDF đã xác minh + blockers + expectedRevision/expectedContext; `grading:read`                                                   |
| PUT `/grading/proposals/:proposalId/:kind/draft`   | Lưu draft phiên bản mới; `grading:write`                                                                                                                                      |
| POST `/grading/proposals/:proposalId/:kind/seal`   | Chốt **bản đã lưu**, không nhận lại điểm/snapshot từ client; `grading:seal`, service kiểm cả read/write                                                                       |
| GET `/grading/proposals/:proposalId/:kind/history` | Lịch sử của chính người chấm, revision tăng dần; `afterRevision`, limit mặc định 25/tối đa 100                                                                                |
| GET `/grading/proposals/:proposalId/:kind/report`  | PDF riêng tư, bắt buộc finalReportId/revision/checksum; quyền đọc và phân công, không yêu cầu còn hạn chấm để tải                                                             |
| GET/PUT `/grading/policy`                          | Policy/window/rubric, CAS và audit; `grading:configure` + allDepartments=true                                                                                                 |
| GET `/grading/policy/history`                      | Metadata lịch sử policy; cùng quyền cấu hình, phân trang                                                                                                                      |
| GET `/grading/results/preview`                     | Khoa xem hồ sơ đúng grant, tổng hợp có blockers; `grading:read-results`                                                                                                       |
| POST `/grading/results/:proposalId/seal`           | Chốt kết quả từng hồ sơ nếu mọi nguồn/policy/xác nhận hợp lệ; `grading:seal-results`; hiện fail closed do UNKNOWN                                                             |
| POST `/grading/results/:proposalId/publish`        | Chỉ SEALED → PUBLISHED, không tự tính lại nguồn khác bản chốt; `grading:publish`; hiện fail closed do UNKNOWN                                                                 |
| GET `/grading/results/:proposalId/history`         | Metadata phiên bản kết quả trong phạm vi grant; `grading:read-results`                                                                                                        |
| GET `/grading/results/:proposalId`                 | SV sở hữu chỉ nhận kết quả PUBLISHED; Khoa phải có permission/grant tương ứng. Chưa công bố không trả điểm hoặc nhận xét                                                      |
| GET `/grading/my-results`                          | Danh sách kết quả hồ sơ chính SV trong đợt; không dùng trạng thái công bố toàn đợt                                                                                            |
| GET `/official-reports/export`                     | `kind=RESULTS\|REVIEWERS\|SCHEDULE`, `format=XLSX\|PDF`, lọc committeeKey/className; `official-report:export` + grant; RESULTS cần read-results và chỉ lấy từng bản PUBLISHED |
| GET `/official-reports/summary`                    | Đếm hồ sơ/admitted/hội đồng/phản biện/lịch và kết quả PUBLISHED trong grant; `official-report:read`. Không mở reader stats toàn hệ thống                                      |

Ví dụ PUT draft:

```json
{
  "expectedRevision": 0,
  "expectedContext": "<hash lấy nguyên từ GET>",
  "requestId": "<ID ngẫu nhiên 16–80 ký tự>",
  "draft": {
    "values": {
      "LAYOUT": 2,
      "CONTENT": 3,
      "RELEVANCE": 1,
      "COMPLETENESS": 2,
      "MASTERY": 2
    },
    "comment": "Nhận xét của người phản biện",
    "questions": ["Câu hỏi thứ nhất?", "Câu hỏi thứ hai?"]
  }
}
```

Seal chỉ gửi ba trường command, backend đọc lại saved draft. Reviewer seal cần đủ năm thành phần, nhận xét có nội dung và ít nhất hai câu hỏi theo mẫu; draft được phép thiếu thành phần, total=null. Điểm bằng 0 là dữ liệu hợp lệ. Không cho client gửi actor, nguồn PDF/assignment hoặc trạng thái công bố; DTO strict, precision tối đa hai chữ số cho điểm thành phần.

401 chưa JWT; 403 thiếu permission/ownership/grant/phân công; 404 hồ sơ không tồn tại/phạm vi hoặc export trống; 409 stale/context/window/SEALED/NEEDS_APPROVAL/nguồn chưa chốt; 400 DTO; 422 sai rubric/điểm; 503 schema chưa sẵn sàng. Thiếu bảng không giả persist thành công.

## 4. Nguồn, quyền và transaction

- UC18 phải là bản FINALIZED V2 đã xác minh SHA-256/manifest, current pointer. UC19/20/21 phải đúng pointer, term, stage, revision, hash, dependency và cùng tập admitted; không lấy plan PUBLISHED hay bảng hội đồng/reviewer legacy.
- GVHD hiện hành được resolver UC17 xác định từ officialAssignmentPlanId, FINALIZED, AdvisorAssignment/AssignmentChange. Chặn người chấm là GVHD của chính hồ sơ. Thành viên có thể đồng thời là GVPB theo D4; chống trùng phiếu trong **từng kind**, không tự cấm quan hệ hai vai trò.
- Đọc lại Proposal APPROVED, active student/lecturer, roster đợt, chứng cứ học vụ hiện hành và UC17/PDF. PDF cùng checksum nhưng revision mới vẫn stale. Kiểm bytes, checksum, metadata/ownership bằng hạ tầng private FileStorage và validator UC17; không trả storageKey/filePath.
- Người chấm chỉ thấy/sửa phiếu của chính mình và hồ sơ đúng phân công. Khoa cần permission và AcademicTermGrant đúng department hiện hành; cấu hình toàn đợt cần allDepartments=true. ADMIN không bypass. SV chỉ có reader công bố của chính mình. Chưa mở quyền đọc phiếu cá nhân của người khác cho Hội đồng hay export điểm chưa công bố.
- Writer dùng transaction ReadCommitted, THESIS_TERM trước, rồi lock protocol UC17/E/source rows, policy/sheet/result theo thứ tự cố định; file advisory lock theo key server. Dùng `clock_timestamp()` sau chờ khóa và trước commit. lock_timeout 5 giây, maxWait 10 giây, transaction budget 60 giây; timeout/deadlock/serialization thành conflict có kiểm soát.
- Mỗi command có expectedRevision/context, CAS, IdempotencyRecord theo actor/method/term/proposal/action/requestId và payload hash. Replay chỉ sau kiểm quyền, cửa sổ và nguồn hiện hành, phải khớp context của kết quả đã lưu. Không early success/changed để vượt kiểm tra.
- Insert revision append-only, CAS pointer, audit, notification và idempotency trong cùng transaction. Audit/history/notification lỗi rollback toàn bộ. Không gọi network/mail trong transaction. Thông báo phiếu chỉ tới Khoa có grant/read-results; không gửi điểm chưa công bố cho SV. Khi công bố hợp lệ, thông báo SV qua Notification in-app hiện có.
- Sau chốt phiếu không cho sửa. Không tự cập nhật DefenseEligibility, UC17, UC18–21 hoặc trạng thái đợt. Snapshot kết quả giữ policy lịch sử, danh tính nguồn, điểm đầu vào, quorum/rounding, xác nhận tập thể, metadata và hash; reader tính lại số học và đối chiếu policy history, không tin mỗi hash 64 ký tự. Dữ liệu hiện hành đổi không tự rewrite bản PUBLISHED lịch sử.
- Hiện kiểm trong cửa sổ COMMITTEE đã cấu hình và slot chính thức, status DEFENDING. Việc chấm muộn, nhập sau buổi hoặc mở lại phiếu phải chốt quy trình riêng; không tự tạo hạn mặc định/phase mới.

## 5. Schema/migration

Migration mới duy nhất của Gói F: `backend/prisma/migrations/202610280002_grading_workflows/migration.sql` — **SQL NOT EXECUTED**.

Không tái dùng ScoreEntry/ScoreDetail làm authority vì thiếu history/provenance và precision legacy 1 chữ số. Không đổi kiểu cột hoặc ý nghĩa dữ liệu legacy. Rubric phản biện từ đặc tả; rubric hội đồng được version trong policy thay vì tự nâng RubricCriteria legacy thành approved.

| Model                 | Vai trò/ràng buộc                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| GradingPolicy         | Coordinator một bản/term, revision/pointer hiện hành                                                                            |
| GradingPolicyRevision | Config JSON, actor/time/hash; unique term/revision; bất biến                                                                    |
| GradingSheet          | Coordinator theo term/proposal/scorer/kind; DRAFT/SEALED, revision/pointer                                                      |
| GradingSheetRevision  | Snapshot điểm/rubric/PDF/assignment/source/actor/time; unique sheet/revision; FK source ghép đúng term/stage/revision; bất biến |
| GradingResult         | Coordinator từng proposal/term; SEALED/PUBLISHED và revision/pointer                                                            |
| GradingResultRevision | Snapshot đầu vào/kết quả/policy/xác nhận tập thể/source; FK policy đúng term/revision; bất biến                                 |

Ba enum mới, ba history trigger BEFORE UPDATE/DELETE/TRUNCATE dùng append-only function sẵn có; INSERT được. Pointer ghép bảo đảm revision thuộc đúng coordinator. Thêm unique Proposal(id,termId) để FK sheet/result không ghép nhầm đợt. CHECK revision, hash, JSON object, sourceStage, envelope identity/state/actor/time và pointer nullable chỉ ở revision 0. FK RESTRICT/NO ACTION bảo toàn lịch sử/term/actor; không thêm backfill official hoặc history giả, không dual-write bảng legacy.

Đã khai báo backrelation Prisma trên UserAccount/ThesisTerm/Proposal/DefenseStageArtifact đúng các FK mới. Không tạo trùng FK cũ. Việc xóa vật lý term/user/proposal sau khi có ledger sẽ bị RESTRICT; cần chính sách retention riêng, không dùng cleanup/reset vượt lịch sử. Chưa chứng minh SQL replay, CHECK/cast, trigger hoặc composite FK trên PostgreSQL thực.

## 6. Frontend

Flag riêng `VITE_GRADING_API=true` và `VITE_AUTH_API=true`; chỉ sửa `.env.example`, không sửa env cá nhân. Flag off giữ adapter/demo cũ độc lập; flag on mà auth off trả CONFIG_ERROR, API lỗi không fallback DemoDb.

Routes API: `/grading/reviewer`, `/grading/committee`, `/grading/scores` (alias reviewer), `/grading/policy`, `/grading/results`, `/report/official`. Dùng HTTP client/JWT/sessionStorage hiện có, không thêm nơi lưu JWT/PDF. API routes xác thực độc lập, không hydrate demo workspace làm authority. Chọn đợt bằng ID thật; backend inbox cấp danh sách proposal được phép, không dùng mock roster. Menu cấu hình/báo cáo chỉ hiện khi bật flag; khi tắt không dẫn người dùng demo vào route API chưa đăng ký.

Context cấp expectedRevision/context trực tiếp. Người dùng phải chủ động nạp/xem lại dữ liệu trước lưu/chốt; seal chỉ bản đã lưu không còn thay đổi local. Sau thành công đọc lại context/history/inbox. 409 hủy context đã chấp nhận, tải lại nguồn và yêu cầu xem lại trước thử tiếp. Download dùng ba trường identity, không tự đánh dấu đã đọc. Rubric thay đổi trước chốt phải lưu lại draft theo rubric mới.

Khoa có UI policy/cửa sổ/rubric, preview blockers và capability chốt/công bố. Adapter runtime UNKNOWN làm nút command phụ thuộc bị khóa. SV đọc API my-results, chưa công bố không có điểm. Reports tải blob từ backend, hiện loading/error/empty/phạm vi. PDF biên bản không cấu hình không giả success. Thao tác tải dùng object URL tạm rồi revoke, không lưu PDF/JWT vào localStorage mới.

## 7. File tạo/sửa

Working tree có thay đổi từ các gói trước; danh sách này chỉ cho Gói F.

**Tạo:**

- `shared/src/contracts/grading-workflow.ts`.
- `backend/prisma/migrations/202610280002_grading_workflows/migration.sql`.
- `backend/prisma/grading-workflow-permissions.cjs`.
- `backend/src/grading/workflow/advisor-grade.port.ts`.
- `backend/src/grading/workflow/grading-source.reader.ts`, `grading.policy.ts`, `grading.repository.ts`, `grading.service.ts`, `grading.controller.ts`, `grading-workflow.module.ts`.
- `backend/src/grading/workflow/grading.test-fixtures.ts`, `grading.service.spec.ts`, `grading-source.spec.ts`, `grading.policy.spec.ts`, `grading.repository.spec.ts`, `grading.http.spec.ts`.
- `backend/src/report/official/official-report.service.ts`, `official-report.controller.ts`, `official-report.spec.ts`.
- `frontend/src/features/grading/workflow/api.ts`, `pages.tsx`, `test-fixtures.ts`, `api.test.ts`, `pages.spec.tsx`.
- Báo cáo này.

**Sửa:**

- `shared/src/index.ts`: export contracts.
- `backend/prisma/schema.prisma`: các model/relation/enum trên; `backend/prisma/seed.cjs`: wiring permission helper, **chưa chạy seed**. Helper không cấp ADMIN hoặc grant, không có action approve-calculation.
- `backend/src/grading/grading.module.ts`, `backend/src/report/report.module.ts`: wiring module mới; không mở reader C01.
- `frontend/src/app/router/routes.tsx`, `route-manifest.ts`: các route/menu; vai trò UI không thay permission backend.
- `frontend/.env.example`, `frontend/vitest.config.ts`: flag opt-in và test env mặc định off.

Không sửa migration cũ/Gói E, công thức legacy ScoreAggregator, controller C01, upload PDF, nghiệp vụ UC17–21, Bước 1–8 hoặc script database. Shared dist/Prisma client chỉ generate local.

## 8. Tối đa năm nhóm quyết định cần xác nhận

| Nhóm                               | Cần xác nhận                                                                                                                                                      | Hành vi hiện tại                                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Điểm GVHD cuối cùng             | Ai nhập/chốt, mốc nào, quan hệ UC16 và provenance PDF/assignment; lịch sử/sửa sau chốt                                                                            | Adapter UNKNOWN; tuyệt đối không lấy điểm tuần hoặc ScoreEntry legacy thay thế                                                          |
| 2. Quorum và xác nhận Hội đồng     | Toàn bộ thành viên hay quy tắc khác; vắng mặt/thay người; ai Thư ký/Chủ tịch xác nhận, chứng cứ và version                                                        | Phiếu cá nhân vẫn lưu/chốt; tập thể UNKNOWN. ALL_OFFICIAL_MEMBERS chỉ là profile typed/test chờ duyệt, chưa active                      |
| 3. Công thức phiên bản và làm tròn | Xác nhận scheme UTC đã có trong tài liệu; số chữ số và thứ tự làm tròn QT/KTHP/HP; raw/rounded khi xét ngưỡng; điều kiện sửa sau bảo vệ ảnh hưởng kết quả thế nào | Có engine/config không default; public configure chỉ lưu NEEDS_APPROVAL, chưa có command tự duyệt                                       |
| 4. Thời gian và sửa sau gửi/chốt   | Phạm vi buổi chấm, chấm muộn, quyền mở lại, lý do, thao tác sau khi đã công bố                                                                                    | Dùng mốc explicit + slot chính thức; hết hạn/khóa hoặc đã SEALED bị từ chối, không override                                             |
| 5. Biểu mẫu và phạm vi đọc/xuất    | File mẫu biên bản ký/phiếu điểm, chữ ký, các cột hành chính; thành viên nào được xem/xuất điểm chưa công bố                                                       | Chỉ Khoa có permission + grant xuất nguồn chính thức; điểm chỉ xuất PUBLISHED; PDF bảng tra cứu có nhãn riêng, không giả biên bản chuẩn |

Nhóm 1–3 cần được duyệt và triển khai nguồn/adapter tương ứng trước khi runtime UC24 chốt/công bố được. Không yêu cầu phê duyệt lại D1–D5 của Gói E.

## 9. Kiểm thử thực tế

Kết quả lượt kiểm tra cuối ngày 28/10/2026:

| Kiểm tra                                                                                          | Kết quả thực tế                                                                                        |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Backend `GPMS_INTEGRATION=0 pnpm exec vitest run --exclude '**/*.integration.spec.ts' --no-cache` | **PASS 1.237/1.237**, 80 file, 55,67 giây                                                              |
| Frontend `pnpm exec vitest run --no-cache`                                                        | **PASS 373/373**, 36 file, 8,55 giây                                                                   |
| TypeScript backend/frontend/shared `tsc --noEmit --incremental false`                             | **PASS cả ba package**                                                                                 |
| Backend lint toàn bộ                                                                              | **PASS**                                                                                               |
| Frontend lint toàn bộ                                                                             | **PASS**                                                                                               |
| Shared build; Prisma generate                                                                     | **PASS local**, không thao tác DB                                                                      |
| Prisma validate                                                                                   | **PASS** với URL dummy riêng `127.0.0.1:1`                                                             |
| `node --check` seed và permission helper mới                                                      | **PASS cú pháp**, không execute seed                                                                   |
| Prettier các file tạo/sửa và `git diff --check`                                                   | **PASS**                                                                                               |
| SQL review/static assertions                                                                      | **PASS kiểm tra tĩnh** về additive/trigger/FK/pointer; **SQL NOT EXECUTED**, không phải migration PASS |
| PostgreSQL / browser E2E / SMTP                                                                   | **NOT RUN**                                                                                            |

Gói F bổ sung **121 backend tests** trong sáu file: service 46, HTTP 17, repository/static SQL/wiring 11, policy 19, source 15, export 13; **31 frontend tests** (adapter 19, UI SSR/helpers 12). Các số toàn suite bao gồm test có trước. Ba regression C01 score/committee/stats (mỗi bộ 10 ca) đều PASS trong full suite cuối.

Các lỗi gặp khi phát triển và đã sửa trước lượt PASS cuối: test gọi download kèm originalName bị DTO strict từ chối (đã sửa đúng request identity); hai lỗi type trong fixture; một lint require trong test; lỗi ngoặc ở query summary mới. Full suite đầu có **1.236 PASS/1 FAIL** vì parser pdf-parse cũ báo `bad XRef entry`; test PDF được đổi sang PDF.js 4.10 đã có trong repository và bổ sung kiểm offset XRef thật, font embed, nội dung tiếng Việt/số điểm. Không bỏ kiểm nội dung hoặc sửa công thức để làm test PASS. Lượt chạy lại toàn bộ 1.237 ca đã PASS.

Warnings còn thấy: Vite CJS và React useLayoutEffect khi render SSR của các test hiện có; không làm suite fail. Không tắt lint rule toàn dự án. Prettier/TypeScript thành công không thay thế kiểm thử SQL hay browser.

Test dùng producer UC18/E, resolver UC17 và validator PDF thật với transactional repository giả. Nhánh policy CONFIRMED/advisor/council VERIFIED được cấp **chỉ trong test fixture**, không có dữ liệu thật hoặc seed mặc định. HTTP tests dùng JWT/permission guards/controller/service thật, port và repository giả; Prisma đã override trước module construction. Chạy test không import AppModule/config DB ứng dụng hoặc integration harness.

Phạm vi: đúng/sai người chấm, scope/grant/ADMIN, draft/seal, rubric/zero/precision/thiếu dữ liệu, slot/window, source PDF/assignment/proof/roster stale, CAS/context/idempotency, rollback history/audit/notification, UNKNOWN chặn UC24, từng proposal PUBLISHED và chống đọc chéo SV, file XLSX/PDF có nội dung/empty/formula injection, wiring và SQL static. Hai request trong fixture chỉ chứng minh CAS/serialization harness, **không phải concurrency PostgreSQL thật**.

## 10. Checklist nghiệm thu còn lại

**NOT RUN:** PostgreSQL, migration replay/upgrade, FK/CHECK/trigger thực, lock/deadlock/rollback/concurrency thực, đo latency, browser click E2E và SMTP. In-app Notification không chứng minh đã gửi email.

- [ ] Chốt năm nhóm policy trên; triển khai nguồn điểm GVHD/xác nhận Hội đồng và đường duyệt calculation có authority/audit, không sửa tay JSON để mở công bố.
- [ ] Provision PostgreSQL cô lập đã xác minh trong một nhiệm vụ được phép riêng. Replay chain trống và upgrade legacy, kiểm unique Proposal, vòng FK pointer/history, schema/type drift với init cũ.
- [ ] INSERT các revision được; UPDATE/DELETE/TRUNCATE bị chặn kể cả không match row; rollback INSERT vẫn được. Pointer sai term/revision/stage, JSON envelope NULL/malformed, hash/metadata sai đều fail closed.
- [ ] Ít nhất hai connection với barrier thật: hai draft/seal cùng revision, grade versus UC21 amendment/PDF reupload/proof update/assignment change, request chờ khóa qua deadline, publish versus grade/source change. Kiểm lock_timeout/60s transaction và thứ tự nguồn cũ, không tuyên bố hết deadlock chỉ vì có parent lock.
- [ ] Audit/history/notification/idempotency failure rollback pointer/grade/publication. JSONB canonical hash/Decimal profile round trip; kết quả PUBLISHED giữ policy lịch sử và không bị latest deadline/PDF rewrite.
- [ ] Browser từng vai trò: login → policy → inbox → PDF → save → GET → seal → faculty preview; sau khi policy/source được duyệt mới thử chốt/công bố thật → student own results → export. Thử 401/403/404/409/422/503, nguồn stale, no fallback, private headers và grant đổi.
- [ ] Đo roster/grade lớn và PDF lớn. Hiện xác minh bytes trong transaction, đọc lại nguồn cuối transaction; preview có thể xác minh cùng PDF nhiều lần cho từng scorer. Cần profiling/cache preflight có identity recheck trước vận hành, không bỏ kiểm nội dung để giảm thời gian.
- [ ] Đối chiếu PDF/Excel bảng tra cứu với mẫu Khoa đã duyệt; kiểm phân trang, dấu tiếng Việt và dữ liệu nhiều trang. Mẫu biên bản ký/chức năng export chưa công bố phải có policy riêng.

Những việc còn lại để hoàn thành Bước 9–10: các approval/producer nêu trên, quy trình hiệu chỉnh sau chốt/công bố và biên bản chính thức, dữ liệu/permissions/grants cá nhân được duyệt riêng, PostgreSQL integration và browser E2E của cả chuỗi E → F. Không mở C01 để bù phần thiếu.
