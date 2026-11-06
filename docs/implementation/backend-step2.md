# Bàn giao Bước 2 — 25/10/2026

Phạm vi: UC01 onboarding và UC09 đăng ký cá nhân xuyên React → NestJS → PostgreSQL. Giữ Bước 1; không mở backend thuật toán phân công, email hoặc đề cương. [Hợp đồng API Bước 2](../api/step2-contracts.md) bổ sung và thay thế thông tin đăng ký mock trong tài liệu Bước 1 cũ.

## Thay đổi chính

- `backend/src/registration`: controller RBAC, DTO Zod, validator, repository, service với transaction Serializable/retry; module được mount trong AppModule. Chính chủ được suy từ userId phiên, không từ body.
- `backend/src/auth/validator/contact.validator.ts`, mapper tài khoản: thêm `profileComplete` từ server. Tái sử dụng guard/password policy và API cập nhật hồ sơ hiện có.
- `backend/prisma/schema.prisma`: hướng và thời điểm nộp, trạng thái mới, FK/unique NV, cờ hướng hoạt động. Giữ dữ liệu và nhãn trạng thái legacy.
- `frontend/src/features/registration`: adapter API, form giữ giao diện hiện có, loading/lỗi/lưu thành công, đồng bộ liên hệ mới nhất, timer dựa trên serverNow và danh sách/thống kê cho Giáo vụ tại `/registration/list`.
- `frontend/src/shared/data/{snapshot-api,store}.ts`, query hooks: đăng ký API thay toàn bộ dữ liệu mock cùng loại, không persist vào localStorage, không fallback khi lỗi; cache gắn token phiên, refresh danh sách định kỳ. Adapter bước sau vẫn ngoài phạm vi; thao tác phân công mock bị chặn trong chế độ đăng ký API để tránh ghi dữ liệu thật vào mock.
- `frontend/.env.local` và `.env.example`: thêm `VITE_REGISTRATION_API=true`, giữ biến khác. Backend `.env` không bị ghi đè. Các cờ AUTH/TERM/CATALOG/IMPORT tiếp tục true cho môi trường chạy thật.
- Shared schema/status và OpenAPI được cập nhật. Test Bước 1 chuyển các phụ thuộc tài khoản demo `giaovu/gv001` sang fixture riêng, không đổi nội dung kiểm tra nghiệp vụ và không reset tài khoản hiện có.

## Migration

Hai migration mới, đã áp dụng thành công lên DB phát triển hiện có `gpms_step1` cổng54339:

1. `202610250001_step2_registration`: thêm enum DRAFT/SUBMITTED, commit trước khi sử dụng.
2. `202610250002_step2_registration_constraints`: thêm cột/FK/unique/CHECK thứ tự1–3, cờ hướng và quyền registration cho role hiện có; toàn bộ phần này trong transaction.

Không sửa ba migration trước đó, không reset/drop DB. Giữ nguyên đăng ký cũ, hướng/thời điểm chưa biết để null. Nếu DB khác có NV cũ trùng GV, orphan hoặc sai thứ tự thì phần constraints sẽ báo lỗi và rollback; không tự xóa/sửa dữ liệu cũ để ép migration qua. Cần xử lý dữ liệu nguồn có truy vết trước khi triển khai trên DB đó.

```powershell
cd backend
npm run db:generate
npm run db:status
npm run db:migrate
npm run build
npm start
```

Giữ PostgreSQL hiện có chạy. Nếu dùng helper của workspace, `node database/scripts/local-postgres.mjs` từ root; helper chỉ quản lý cluster cổng54339, không reset dữ liệu. Frontend `npm run dev -- --host 127.0.0.1` tại frontend. Backend3010, frontend5173.

## Kiểm chứng

Các bộ test dùng dữ liệu giả lập riêng, giữ fixture HTTP/E2E để xem lại. Integration dọn riêng các ID do suite tạo. Không xóa dữ liệu người dùng.

- Backend unit: 60/60.
- Frontend unit: 86/86, gồm 5 ca mới về API ownership, cache, không ghi localStorage, không fallback và chặn cấu hình API/mock trộn sai.
- Integration Bước1: 10/10 PostgreSQL/API.
- HTTP Bước1: 11/11 nhóm.
- HTTP Bước2: 11/11 nhóm trên API/PostgreSQL thật, gồm tạo lần đầu đồng thời và nộp lại đồng thời, liên hệ hợp lệ gửi từ form, rollback contact conflict, FK/unique/CHECK, clock/khóa/công bố, truy cập chéo SV.
- Build/type-check backend/frontend/shared đã chạy thành công. OpenAPI export kiểm tra40 paths,42 schemas,477 references.
- Chrome E2E: 2/2 spec API Bước1–2, lần chạy cuối19,9 giây. Bước2 thực hiện đổi mật khẩu mặc định → bắt buộc hồ sơ → lưu nháp → đổi thứ tự NV → nộp → reload → Giáo vụ ở Chrome context khác xem cùng bản ghi → SV đăng nhập từ Chrome context mới vẫn thấy dữ liệu. Không có pageerror.
- Restart thực tế: ghi snapshot fixture trước khi dừng backend, khởi động lại bản build, so sánh chính xác registration/NV/timestamps; login SV và Giáo vụ mới qua HTTP đều đọc đúng bản ghi. Rerun seed giữ nguyên hash mật khẩu đã đổi, mustChangePassword=false, liên hệ và đăng ký.
- `prisma validate` hợp lệ; `db:status` không có migration pending; `migrate diff --exit-code` trả0, không có khác biệt.
- Ảnh sau reload: [SV đã nộp](step2-evidence/student.png), [Giáo vụ đọc DB](step2-evidence/faculty.png). Report chạy cuối tại `frontend/playwright-report/index.html`.

Lệnh kiểm tra:

```powershell
cd backend
npm test
npm run test:integration
npm run test:http
npm run test:step2
npm run docs:api
# Ghi trước restart; chạy verify sau khi dừng/khởi động lại backend:
node test/step2-persistence.cjs record
node test/step2-persistence.cjs verify
cd ../frontend
npm test
npm run build
$fixture = Get-Content ../.cache/step2-fixture.json -Raw | ConvertFrom-Json
$env:E2E_FACULTY_USER = $fixture.facultyUsername
$env:E2E_FACULTY_PASSWORD = 'StepTwo@2026' # chỉ là mật khẩu fixture giả lập trong test
npm run test:e2e
```

Playwright mặc định chọn hai spec API Bước1–2, Chrome local. Các spec mock cũ không tính là chứng cứ API thật. Test chạy với clock hiện tại25/10/2026; HTTP Bước2 tạo cửa sổ tương đối quanh giờ server, kiểm tra chính xác biên `[start,end)` bằng unit test clock cố định. GPA null/missing được validator từ chối; HTTP cũng xác minh đầu vào tạo SV thiếu GPA bị400; DB hiện tại bắt buộc GPA khác null.

## Demo

Chạy `npm run test:step2` tại backend để tạo fixture mới mà không sửa dữ liệu có sẵn. ID đợt, mã SV và username Giáo vụ nằm trong `.cache/step2-fixture.json` (không chứa token/hash/secret).

1. Với SV vừa import bằng giao diện Bước1: đăng nhập mãSV/mãSV → đổi mật khẩu theo policy → `/profile`, điền Email/SĐT → liên kết đăng ký. Có thể dùng SV trong fixture đã hoàn tất onboarding để demo thẳng đăng ký; mật khẩu giả lập của fixture được định nghĩa trong script test.
2. Chọn đúng đợt có SV trong roster, chọn một hướng và1–3 GV cùng hướng, đổi thứ tự, lưu nháp, reload, nộp. Quota hiển thị tham khảo, không giữ chỗ.
3. Mở Chrome context/profile khác, đăng nhập Giáo vụ fixture → `/registration/list` → chọn cùng đợt. Kiểm tra hướng, NV, trạng thái và thời điểm nộp. Reload vẫn đọc DB; trang refresh định kỳ30 giây.
4. Demo đủ luồng tự động: `npm run test:e2e -- step2-api.spec.ts` tạo thêm một SV riêng, đổi mật khẩu, lưu hồ sơ, đăng ký và xác minh ở trình duyệt Giáo vụ độc lập.

Không triển khai/khẳng định production, ghép nhóm, thuật toán phân công, email, đề cương. Danh sách hướng áp dụng được suy từ roster GV đang hoạt động và cờ ResearchArea.isActive; chưa có cấu hình hướng riêng trên từng đợt. Các module bước sau giữ nguyên phạm vi đã có.

Chưa kiểm chứng triển khai production hoặc migration trên một DB lịch sử khác có NV không hợp lệ; môi trường hiện tại đã hoàn tất kiểm chứng API/DB/Chrome/restart. Build frontend còn cảnh báo kích thước chunk ExcelJS có sẵn; không chặn build. Workspace không có Git metadata nên không tạo commit/PR.
