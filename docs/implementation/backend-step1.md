# Bàn giao backend Bước 1 và frontend kết nối API

Ngày kiểm tra: 23/10/2026. Repository: `D:\TLProject1\BTL`.

Phạm vi thực hiện: auth cần thiết, danh mục đào tạo/GV/SV, kỳ học, đợt theo hệ, kế hoạch toàn quy trình, roster/quota và import sinh viên đủ điều kiện. NestJS → service → repository → Prisma/PostgreSQL; validation Zod, RBAC và audit. Không triển khai nghiệp vụ đăng ký/phân công, hướng dẫn tuần, bảo vệ hoặc chấm điểm. Những module sau vẫn dùng service mock frontend và không được mount vào AppModule backend.

## Chạy với PostgreSQL có sẵn

1. Cài dependencies theo monorepo (`pnpm install`). Nếu không có pnpm, có thể cài từng package bằng `npm install --prefix backend`, `npm install --prefix frontend`, `npm install --prefix shared`.
2. Copy `backend/.env.example` thành `backend/.env`, đặt `DATABASE_URL`, hai JWT secret riêng và `PORT=3010`. Copy `frontend/.env.example` thành `frontend/.env.local`.
3. Tại `backend`, chạy:

```powershell
npm run db:generate
npm run db:status
npm run db:migrate
npm run db:seed
npm run build
npm start
```

4. Terminal khác tại `frontend`: `npm run dev -- --host 127.0.0.1 --port 5173`.

Frontend: `http://127.0.0.1:5173`. Backend: `http://127.0.0.1:3010/api`. Swagger: `http://127.0.0.1:3010/api/docs`. Đổi `VITE_API_URL` nếu backend dùng cổng khác; restart Vite sau khi đổi env.

## PostgreSQL demo riêng không cần Docker

Trong môi trường đã kiểm tra, cổng3000/54329 thuộc ứng dụng khác. Bản này dùng backend3010 và PostgreSQL54339; không thay đổi hoặc dừng ứng dụng ở `D:\AppProject1`.

Khi chưa có `backend/.env`, chạy từ root:

```powershell
npm install --prefix .cache/postgres-runner embedded-postgres@18.4.0-beta.17
node database/scripts/local-postgres.mjs
```

Helper dùng PostgreSQL18.4 thật, tạo cluster trong `.cache/postgres-data`, database `gpms_step1`, mật khẩu/JWT secret ngẫu nhiên trong `backend/.env` không được track. Giữ terminal này chạy, rồi thực hiện các lệnh migration/seed/backend ở trên trong terminal khác. Dữ liệu được giữ khi dừng. Helper chỉ nhận đúng URL database do nó quản lý; nếu đã có `.env` trỏ DB khác, dùng PostgreSQL đó thay vì helper. Nguồn công cụ: [embedded-postgres](https://github.com/leinelissen/embedded-postgres).

## Tài khoản dữ liệu giả lập

| Vai trò         | Username                              | Mật khẩu ban đầu |
| --------------- | ------------------------------------- | ---------------- |
| Admin           | `admin`                               | `Demo@2026`      |
| Giáo vụ Khoa    | `giaovu`                              | `Demo@2026`      |
| Giảng viên      | `gv001`, `gv002`, `gv003`             | `Demo@2026`      |
| Sinh viên ba hệ | `001230001`, `001230002`, `001230003` | Chính mã SV      |

SV bắt buộc đổi mật khẩu, rồi cập nhật Email/SĐT ở Hồ sơ. Email lúc import/seed có thể null. Seed chạy lại dùng upsert/create-only đối với tài khoản và dữ liệu đã chỉnh; không reset mật khẩu hoặc khóa đợt của người dùng. Seed có một kỳ2026–2027, ba đợt tương ứng ba hệ, năm hướng, ba GV và sáu giai đoạn/đợt.

## Màn hình sử dụng API thật

| Route / service                           | Nguồn                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| `/login`, `/change-password`, `/profile`  | Auth API, phiên JWT lưu trong sessionStorage; server kiểm lại trạng thái/roles/quyền |
| `/catalog/reference`                      | Hệ đào tạo, bộ môn, hướng và kỳ học thật                                             |
| `/catalog/students`, `/catalog/lecturers` | Danh mục PostgreSQL, tìm kiếm/lọc và form CRUD qua adapter                           |
| `/terms`, `/terms/:id`                    | Đợt thật, tạo/sửa/chi tiết/trạng thái/khóa                                           |
| `/terms/:id/phases`                       | Sáu giai đoạn thật, giờ Việt Nam, khóa/mở                                            |
| `/terms/:id/parameters`                   | Tham số thật phục vụ điều kiện và cấu hình đợt                                       |
| `/terms/:id/roster`                       | Sinh viên đủ điều kiện, GV tham gia và quota thật                                    |
| `/catalog/import` chọn SV                 | Mẫu CSV/XLSX thật, multipart upload, preview/job/confirm/result trong DB             |
| Dashboard/header                          | Các danh mục/đợt được tải từ API, dữ liệu phân hệ sau vẫn mock                       |

Các cờ độc lập `VITE_AUTH_API`, `VITE_TERM_API`, `VITE_CATALOG_API`, `VITE_IMPORT_API` chọn adapter cho từng phần. Không có cờ nguồn dữ liệu toàn hệ thống. API-owned lists là nguồn chuẩn; mock đăng ký/phân công/đề cương giữ riêng và dùng UUID thật qua bridge. Lỗi API được hiển thị và cho thử lại, không âm thầm quay về dữ liệu demo. Admin account/role/audit UI, thông báo email, phân công, đề cương và import GV chưa chuyển sang backend trong phạm vi này. Audit thao tác Step1 vẫn được ghi thật trong bảng `AUDIT_LOG`.

## Thời gian, quota và import

- API yêu cầu ISO8601 có offset/Z; database `timestamptz`, frontend đổi sang `Asia/Ho_Chi_Minh`. Cửa sổ `[start,end)` xét clock server, trạng thái đợt, khóa đợt và khóa giai đoạn. Sáu mã `REGISTRATION/ASSIGNMENT/PROPOSAL/WEEKLY/FINAL/DEFENSE` chỉ là kế hoạch; không có nghiệp vụ tuần/bảo vệ/chấm điểm được triển khai.
- `TermLecturer.quota` là chỉ tiêu thực tế của từng đợt; không giảm dưới số phân công PUBLISHED/FINALIZED. `Lecturer.maxStudents` được dùng làm quota mặc định khi thêm GV; tài liệu chưa chốt trần tổng xuyên các đợt nên không tự áp một giới hạn tổng mới. Hướng dẫn/quyền chuyên môn và quota được kiểm lại phía server.
- Mẫu import dùng `studentCode,fullName,className,cohort,trainingSystemCode,gpa,email,phone,academicEligible`. Mã SV là text; Excel numeric code bị báo lỗi để tránh mất số0. GPA bắt buộc0–4 và đạt ngưỡng đợt; ô trống không thành0. Hệ có thể bỏ trống để dùng hệ của đợt đích; giá trị khác hệ bị lỗi. Email/SĐT được để trống, không sinh email giả.
- Preview lưu job và lỗi từng dòng, chưa tạo tài khoản/SV. `STRICT` có lỗi thì không ghi dòng nào. `VALID_ONLY` là lựa chọn rõ ràng để nhập riêng dòng hợp lệ trong transaction; dòng lỗi giữ nguyên trong kết quả PARTIAL.
- SV mới: hash mật khẩu mãSV, role STUDENT, mustChangePassword. SV cũ chưa thuộc đợt: reuse tài khoản, cập nhật hồ sơ không ghi đè contact bằng ô trống. Đã thuộc đợt: SKIP, không tạo trùng và không reset mật khẩu. Xác nhận lại cùng job trả kết quả đã có. Confirm kiểm lại điều kiện/khóa và xử lý tranh chấp bằng transaction Serializable/retry.

## Migration và trạng thái DB đã kiểm tra

- Migration gốc `0_init` giữ nguyên SHA256 `533FFB3D89181A690EE6AFBB15B9673D4F34DD5C75ECF542C596571CD1687504`.
- `202610230001_step1` đối chiếu baseline SQL viết tay với Prisma, chuẩn hóa schema bằng thay kiểu/cast trạng thái giữ dữ liệu, thêm email nullable/hồ sơ/kỳ học/hệ đợt/khóa/code giai đoạn/import metadata. Không DROP COLUMN/TABLE; transaction bảo đảm dữ liệu không bị xóa nếu dữ liệu cũ không thể cast.
- `202610230002_step1_backfill_checks` backfill liên kết kỳ và hệ nếu suy ra duy nhất từ roster; thêm CHECK GPA/quota/ngày. Hệ cũ mơ hồ giữ NULL để Khoa chọn lại trước khi mở đợt.
- Đã chạy `migrate status`, `migrate deploy`, `migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` trên DBdemo. Không có migration pending hoặc schema drift.
- DB demo ban đầu gặp encoding WIN1252. Đã xác minh chỉ có metadata migration lỗi, chưa có bảng ứng dụng, rồi tạo lại riêng DBdemo rỗng bằng UTF8. Không reset database có dữ liệu người dùng. Helper mới tạo DB bằng UTF8.

## Kiểm thử

Tại `backend`: `npm test` cho unit; `npm run test:integration` cho PostgreSQL/API thực (DB và API cần chạy); `npm run test:http` cho luồng HTTP xuyên module. Tại `frontend`: `npm test`, `npm run build`, `npm run test:e2e` (Chrome local, backend và DB cần chạy). Playwright mặc định chọn `step1-api.spec.ts`; các spec demo mock cũ được giữ riêng và không được tính là kiểm chứng API.

Kết quả và giới hạn cuối được ghi trong [verification.md](verification.md). Chi tiết hợp đồng: [toàn bộ API Bước 1](../api/step1-contracts.md), [term-step1.md](../api/term-step1.md), [OpenAPI](../api/openapi.yaml), [shared types/schemas](../../shared/src/step1.ts), [hybrid frontend](../frontend/step1-api-integration.md). Có thể tái tạo OpenAPI từ backend đang chạy bằng `npm run docs:api`.

Chưa kiểm thử nâng cấp một database cũ có dữ liệu thực hoặc triển khai production. Các liên kết hồ sơ/điểm của bước sau được giữ trong schema, không được triển khai nghiệp vụ ở lần này. Không có Git metadata trong workspace được cung cấp nên không tạo commit/PR.
