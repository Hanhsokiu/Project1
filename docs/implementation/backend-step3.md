# Bàn giao Bước 3 — 25/10/2026

Phạm vi: UC10 phân công/công bố, UC11 thống nhất đề tài, UC12 phiên bản đề cương, PDF liên quan UC25. Giữ NestJS + Prisma + PostgreSQL và React + TypeScript; mỗi SV một đề tài trong một đợt. UC13, nhóm duyệt, hướng dẫn tuần, bảo vệ và chấm điểm không được triển khai trong API này.

Đã đọc hai Word qua trích xuất XML; xem ảnh mẫu đề cương `word/media/image3.png` trong `Project_1_06.docx`, ADR cá nhân, workflow và hợp đồng/bàn giao Bước 1–2. Trước sửa, PostgreSQL có 6 đăng ký SUBMITTED với hướng, thời điểm nộp và nguyện vọng thật. Không tạo đăng ký mock để thay đầu vào. Fixture Bước 3 tiếp tục gọi chính API nộp đăng ký Bước 2.

## Thay đổi chính và file

| Phần | File/nhóm file | Hành vi |
|---|---|---|
| Thuật toán | `backend/src/registration/engine/assignment-algorithm.ts` | Vòng NV1 toàn đợt → NV2 → NV3 → fallback đúng hướng |
| Lưu/phân quyền | `registration/{repository/assignment.repository,validator/assignment.validator,service/assignment-plan.service,controller/assignment.controller}.ts` | Preview, nháp, revision/hash, manual reason, kiểm tra hiện tại khi công bố, audit, scoped results |
| Đề tài/đề cương | `backend/src/topic/**` | Ownership GVHD/SV, PROPOSAL, xác nhận, lịch sử, phiên bản bất biến, PDF DB |
| Email/thông báo | `backend/src/notification/**`, template email | Transactional outbox, worker SMTP, retry/lease, thông báo đã đọc chính chủ |
| Mount/API | `app.module.ts`, `registration.module.ts`, `main.ts`, `common/swagger/step3-document.ts` | Mount sau khi bảo vệ endpoint, cập nhật OpenAPI |
| Schema | `backend/prisma/schema.prisma`, migration `202610250003_step3`, `202610250004_step3_notification_term`, `seed.cjs` | Hai migration mới; seed thêm quyền và tiếp tục giữ tài khoản hiện có |
| Frontend | `registration/services/assignment-api.ts`, `pages/ApiAssignmentPlanPage.tsx`, ManualAdjust, AssignmentResult/Table | Gọi API, preview trước lưu, xác nhận tính lại toàn bộ, xem lý do/chưa nộp/quota/outbox |
| Frontend dữ liệu | `shared/data/{snapshot-api,store,types}.ts`, topic/notification API services | API là nguồn chuẩn, cách ly cache theo token, không fallback/persist đăng ký/phân công/đề cương vào localStorage |
| PDF/giao diện | `topic/pages/{MyTopic,ProposalEditor,Dossier}Page.tsx`, `shared/services/export-service.ts`, `report-service.ts`, template PDF | SV/GV tạo/sửa/thống nhất; API xuất đúng phiên bản đã lưu, kể cả từ Trung tâm biểu mẫu |
| Kiểm thử | `backend/test/step3-{http,mail,persistence}.cjs`, unit engine/validator, `frontend/e2e/step3-api.spec.ts` | PostgreSQL/HTTP, SMTP/MailHog, restart, ba phiên Chrome |

`.env` backend và `.env.local` frontend hiện có không bị ghi đè. Chỉ cập nhật các file example và dùng env trong tiến trình chạy. Workspace không có Git metadata nên không có commit/diff Git.

## Thuật toán và vòng đời

GPA và đăng ký SUBMITTED lấy từ DB, còn đủ điều kiện/đúng roster/hệ/hướng hoạt động. Chỉ GV hoạt động trong TermLecturer, có chuyên môn phù hợp; quota lấy đúng TermLecturer.quota. Không áp maxStudents thành trần tổng xuyên đợt. NV1 của mọi SV được xét trước NV2, sau đó NV3. Trong từng vòng tranh chỗ, GPA giảm dần. Thiếu/không hợp lệ GPA vào danh sách xử lý, không đổi thành 0. Hết quota đúng hướng giữ chưa phân với lý do.

Quy tắc phụ của **bản triển khai**, không coi là nội dung bắt buộc của Word: GPA bằng nhau → thời điểm nộp hợp lệ sớm hơn → mã SV; fallback → tỷ lệ tải/quota thấp hơn → mã GV. Không thêm ưu tiên cộng tác/nghiên cứu chưa có dữ liệu xác minh. Đầu vào và phép tính được lưu snapshot; thứ tự đầu vào ổn định, các lý do gồm NV1/NV2/NV3/Theo hướng/Thủ công/Chưa phân.

Preview không ghi DB. Lưu nháp kiểm lại revision/hash/đầu vào trong transaction Serializable. `remaining` giữ tất cả phân công hiện tại, đếm tải đúng một lần và chỉ bổ sung chưa phân. `all` phải xác nhận trên UI, xem trước và chỉ thay nháp khi lưu. Manual yêu cầu quyền Giáo vụ, lý do, roster, đăng ký hợp lệ, chuyên môn và quota; không sửa phương án chính thức. Mọi ghi dùng revision để tránh mất điều chỉnh.

Chốt/công bố đọc lại DB và kiểm tất cả đăng ký SUBMITTED, hướng, GV/quota, term/phase/time trước khi ghi. Còn đăng ký đã nộp chưa phân hoặc vi phạm thì bị chặn. SV chưa nộp hiển thị riêng, không tự đoán hướng và không thêm vào phương án. Công bố nguyên tử chuyển plan PUBLISHED, term IN_PROGRESS, thêm thông báo trong ứng dụng và outbox theo GV; lặp request trả cùng kết quả. Partial unique + transaction/retry bảo vệ công bố đồng thời. SV/GV không đọc draft qua API; sau công bố chỉ đọc đúng ownership.

## Đề tài, phiên bản, bàn giao UC13

SV hoặc đúng GVHD chính thức được tạo/cập nhật; giao diện GV có liên kết tạo/sửa theo SV được giao. Tất cả ghi kiểm PROPOSAL theo TermWindowService/giờ server trong transaction. Thay bất kỳ trường nội dung nào (`title/objectives/scope/technology/expected/plan`) đều bỏ xác nhận GVHD cũ; bên sửa xác nhận nội dung của mình. SV nộp là xác nhận của SV, phải có xác nhận GVHD đúng nội dung và đủ trường bắt buộc.

Mỗi lưu/nộp thêm ProposalVersion, metadata biểu mẫu và lịch sử. Sửa SUBMITTED tạo DRAFT mới, giữ bản đã nộp. `expectedVersion` gắn với bản form đang chỉnh sửa, tránh polling nâng version rồi âm thầm ghi đè nội dung người khác. UNDER_REVIEW/APPROVED/dossier APPROVED bị chặn sửa. Hồ sơ unique theo term/student, SV có thể có lịch sử đợt khác. Điểm bàn giao UC13 là SUBMITTED cùng ID/phiên bản/content/snapshot/actor/timestamps; không tạo tự duyệt/chốt. Test negative dùng dossier fixture APPROVED chỉ để chứng minh không sửa được, không phải đầu ra hoàn thành Bước 3.

PDF từ phiên bản DB chỉ định, giữ nội dung kể cả form có thay đổi chưa lưu. Hai mẫu cử nhân/kỹ sư có quốc hiệu, thông tin SV/GV, nội dung/phạm vi, công nghệ, kết quả, bảng kế hoạch và bốn vị trí ký. Chrome in Times New Roman Unicode. Bước 3 xuất nhãn BẢN NHÁP/CHỜ DUYỆT; không giả chữ ký/phê duyệt. Phiên bản lịch sử thiếu snapshot bị báo 422 để xử lý nguồn có truy vết.

## Chạy MailHog, worker và demo

PostgreSQL hiện có cổng54339 tiếp tục được dùng. Không reset/drop DB, không sửa migration đã áp dụng, không xóa dữ liệu người dùng. Migrations mới đã deploy; `prisma validate`, `migrate status`, `migrate diff --exit-code` đã xác nhận hợp lệ/up to date/no difference.

Từ root, chạy MailHog local; Chrome cần cài sẵn:

```powershell
./infra/mailhog/start-local.ps1
cd backend
npm run db:generate
npm run db:migrate
npm run build
$env:SMTP_HOST='127.0.0.1'
$env:SMTP_PORT='1025'
$env:SMTP_FROM='gpms@example.test'
$env:EMAIL_WORKER_ENABLED='true'
# Nếu Chrome không ở vị trí mặc định:
# $env:PDF_CHROME_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe'
npm start
```

Frontend: `npm run dev -- --host 127.0.0.1` trong `frontend`. Các cờ AUTH/TERM/CATALOG/IMPORT/REGISTRATION hiện có phải true; REGISTRATION_API cũng bật luồng API Bước 3. Backend3010, frontend5173, MailHog inbox [localhost8025](http://127.0.0.1:8025). Không dùng dịch vụ gửi email bên ngoài để thử.

Worker chạy trong NestJS mỗi2 giây, sau commit. `PENDING → PROCESSING → SENT` chỉ sau SMTP accepted; lỗi hoặc thiếu cấu hình thành FAILED, lưu error/attempts/availableAt. Tự thử tối đa5 lần với backoff, hỗ trợ gửi lại FAILED từ UI. SKIP LOCKED/lease token cho nhiều worker; lease hết hạn5 phút được khôi phục. Outbox unique theo plan/GV chống sự kiện công bố trùng. Giới hạn: SMTP nhận rồi worker crash trước khi ghi SENT có thể gửi lặp; Message-ID cố định hỗ trợ đối chiếu, không đảm bảo exactly-once SMTP. SMTP lỗi không rollback phương án đã công bố. Thư MailHog mặc định trong bộ nhớ, bằng chứng đã lưu thành artifact.

Demo qua test để tạo fixture riêng và giữ dữ liệu có sẵn:

```powershell
cd backend
npm run test:step3
npm run fixture:step3-browser
cd ../frontend
npm run test:e2e -- step3-api.spec.ts
```

Fixture HTTP tại `.cache/step3-fixture.json`; fixture Chrome tại `.cache/step3-browser-fixture.json`, không chứa token/hash. Mật khẩu **chỉ tài khoản fixture giả lập**: `StepThree@2026`. Khi xem lại Chrome fixture sau test: Giáo vụ `facultyUsername`, SV `studentCodes[0]`, GV `lecturerCodes[1]`, chọn `termId`. Kết quả: một SV đăng ký, Giáo vụ chuyển từ X sang Y có lý do rồi công bố; ba SV chưa nộp được hiển thị riêng. SV có đề cương SUBMITTED phiên2, GVY đã thống nhất, outbox SENT. Mọi fixture giữ lại để kiểm tra.

## Kiểm chứng thực tế

| Kiểm tra | Kết quả |
|---|---|
| Backend unit | 72/72, gồm regression NV1/NV2/NV3, GPA hòa, thiếu GPA, quota0/tải sẵn/sai hướng/inactive và validator ownership/phiên bản |
| Frontend unit | 88/88, gồm trạng thái công bố từ DB, không fallback/persist API khi lỗi |
| Integration PostgreSQL Bước1 | 10/10 |
| HTTP Bước1 | 11/11 nhóm |
| HTTP Bước2 | 11/11 nhóm |
| HTTP PostgreSQL Bước3 | 17/17 nhóm, gồm tranh chấp manual/publish, stale preview, audit, thiếu phân công, scope, đề cương/version/PDF và MailHog |
| Worker SMTP thật | 5 nhóm: thiếu config; connection refused; retry+claim đồng thời; lease recovery+SMTP accepted; không mất published plan |
| Chrome API Bước1–3 | 3/3 spec, lần chạy cuối 1,2 phút; Step3 ba context độc lập 27,4 giây, pageErrors rỗng |
| Build/type-check | Backend/frontend pass; build frontend còn cảnh báo chunk ExcelJS có sẵn |
| Restart | Snapshot chính xác plan/assignments/proposal versions/outbox không đổi; phiên login mới Giáo vụ/SV/GV đọc DB; Bước2 giữ đăng ký/NV/timestamps và seed không reset mật khẩu/liên hệ |
| OpenAPI | 56 paths,44 schemas,542 references hợp lệ |

Bằng chứng mới, không dùng kết quả test cũ:

- [Giao diện Giáo vụ đã công bố](step3-evidence/faculty-published.png), [nháp](step3-evidence/faculty-draft.png), [SV đã nộp](step3-evidence/student-submitted.png).
- [MailHog screenshot](step3-evidence/mailhog.png), [thư SMTP và outbox](step3-evidence/mailhog.json), [thiếu SMTP/lỗi/retry/lease](step3-evidence/smtp-retry.json).
- [PDF cử nhân tải từ Chrome, phiên2](step3-evidence/browser-de-cuong-v2.pdf), [văn bản Unicode đã trích](step3-evidence/browser-de-cuong-v2.txt).
- [PDF kỹ sư phiên3 từ HTTP](step3-evidence/de-cuong-v3.pdf), [văn bản khớp phiên bản đã lưu](step3-evidence/de-cuong-v3.txt).
- [Kết quả ba browser, outboxId, title, pageErrors](step3-evidence/browser-result.json); report Playwright hiện tại `frontend/playwright-report/index.html`.

Lệnh tái kiểm chứng:

```powershell
cd backend
npm test
npm run test:integration
npm run test:http
npm run test:step2
npm run test:step3
npm run docs:api
# SMTP fault test: khởi động backend với EMAIL_WORKER_ENABLED=false để lịch tự động
# không tranh fixture; script chạy worker thật riêng, scope đúng term fixture.
npm run test:step3-mail
# Sau đó bật lại EMAIL_WORKER_ENABLED=true và restart backend.
node test/step3-persistence.cjs record
# Dừng/khởi động lại backend, sau đó:
node test/step3-persistence.cjs verify
cd ../frontend
npm test
npm run build
# Tạo fixture mới trước mỗi lần chạy E2E Bước3 vì test kết thúc bằng công bố.
```

## Giới hạn còn lại

Chưa kiểm chứng production, Docker/Linux/Chrome/font khác Windows hiện tại, hoặc migration trên DB lịch sử có dữ liệu xung đột. SMTP accepted không bảo đảm người dùng cuối đã đọc/nhận vào inbox; giới hạn crash ở trên vẫn tồn tại. Bản chính thức/chữ ký sau UC13 chưa được nghiệm thu vì ngoài phạm vi, không tự nâng trạng thái để làm test qua. Không triển khai thay đổi phân công chính thức hậu công bố; cần quy trình riêng. Cache frontend refresh30 giây và sau thao tác; request ghi luôn kiểm lại DB. Không có Git metadata để tạo commit/PR.
