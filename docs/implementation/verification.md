# Kiểm chứng backend Bước 1 và frontend API

Kiểm tra thực tế ngày 23/10/2026 tại `D:\TLProject1\BTL`, Windows/PowerShell, PostgreSQL thật 18.4 tại `127.0.0.1:54339/gpms_step1`, NestJS tại cổng 3010 và Vite tại cổng 5173. Đây là database demo riêng; không dùng `.env`, database hoặc server của `D:\AppProject1`.

## Kết quả cuối

| Thư mục    | Lệnh                                                                                                                       | Kết quả thực tế                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `backend`  | `npm run build`                                                                                                            | PASS, Nest/TypeScript compile                                  |
| `frontend` | `npm run build`                                                                                                            | PASS, TypeScript và Vite production bundle                     |
| `shared`   | `npm run build`                                                                                                            | PASS, public contracts compile                                 |
| `backend`  | `npm test`                                                                                                                 | **41/41 PASS**, 6 file                                         |
| `frontend` | `npm test`                                                                                                                 | **81/81 PASS**, 10 file                                        |
| `backend`  | `npm run test:integration`                                                                                                 | **10/10 PASS** trên PostgreSQL: 4 term + 6 catalog/import      |
| `backend`  | `npm run test:http`                                                                                                        | **11/11 nhóm PASS** qua HTTP thực                              |
| `frontend` | `npm run test:e2e -- --output=test-results-api-ui`                                                                         | **1/1 luồng Chrome PASS**, desktop và390px, 21giây             |
| `backend`  | `npm run db:status`                                                                                                        | Cả3 migration đã áp dụng, không pending                        |
| `backend`  | `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` | Exit0, **No difference detected**                              |
| `backend`  | `npm run db:migrate`, `npm run db:seed`                                                                                    | Deploy thành công; seed đã chạy lại2 lần thành công            |
| `backend`  | `npm run docs:api`                                                                                                         | Export31 path,41 schema; kiểm396 tham chiếu schema đều tồn tại |
| Root       | `pnpm install --lockfile-only --offline --frozen-lockfile --ignore-scripts`                                                | PASS, lockfile khớp các package; không cài lại dependency      |

Trong 41 test backend có 36 test auth/catalog/term/common và 5 test engine cũ của registration/grading. Các test engine cũ không có nghĩa backend các bước sau đã được triển khai. Tương tự, 81 test frontend gồm cả service mock giữ lại của các phân hệ sau.

Migration `0_init` giữ nguyên SHA256 `533FFB3D89181A690EE6AFBB15B9673D4F34DD5C75ECF542C596571CD1687504`. Hai migration mới đã deploy trên database demo. Chi tiết thay đổi schema, encoding UTF8 và backfill xem [bàn giao](backend-step1.md).

## Những hành vi đã xác nhận

- Giáo vụ đăng nhập thật, tạo kỳ và ba loại đợt CQ/LT/TX, tra cứu/lọc/phân trang; truy vấn latest bắt buộc đúng kỳ và hệ.
- Ngày không hợp lệ, mã đợt trùng, hệ không tồn tại hoặc không khớp bị chặn. Các giai đoạn nằm trong đợt, đúng thứ tự; lưu sáu mốc và reload giữ giờ Việt Nam.
- Roster lưu SV, GV và quota. Quota âm/phân số, quota dưới số phân công chính thức và hồ sơ không đủ điều kiện bị chặn. Khóa đợt/giai đoạn ngăn thao tác tương ứng.
- Cửa sổ dùng clock server, vòng đời, khoảng thời gian và khóa; response có lý do không cho phép thao tác.
- CSV/XLSX được parse phía server. Test có workbook thật, mã SV numeric bị từ chối; dòng trống/ô CSV nhiều dòng vẫn giữ số dòng lỗi gốc. GPA thiếu không thành0; GPA ngoài0–4/sai hệ/trùng mã bị báo lỗi.
- Preview chưa tạo SV/tài khoản; STRICT có lỗi không ghi dòng nào. VALID_ONLY ghi dòng hợp lệ trong transaction và lưu lỗi còn lại. Đồng thời xác nhận và import lại không tạo trùng.
- SV mới có username/mật khẩu ban đầu bằng mã SV, hash mật khẩu, STUDENT và bắt buộc đổi mật khẩu. Không sinh email giả. Import lại giữ mật khẩu đã đổi và liên hệ khi ô nguồn trống.
- SV và GV gọi trực tiếp API tạo đợt, sửa roster/quota hoặc import bị403. Anonymous/token sai bị401; chưa đổi mật khẩu bị chặn nghiệp vụ. Response tài khoản không chứa passwordHash.
- Refresh trả access token dùng được; access token không thể dùng thay refresh token. Logout vô hiệu hóa cả access và refresh của phiên đó. Lỗi nhập liệu trả field cụ thể; lỗi STRICT có `details.invalidRows`; lỗi500 không lộ nội dung nội bộ.
- GPA nullable được giữ xuyên mapper/snapshot/UI; hiển thị “—” và không đủ điều kiện kể cả khi ngưỡng đợt bằng0.
- Chrome đã thao tác từ UI: tạo kỳ → tạo đợt → kế hoạch → SV/GV/quota → preview1 dòng đúng/1 dòng sai → VALID_ONLY → F5 phục hồi job → nhập lại → reload danh mục/roster. Không có console error hoặc page error ở lượt cuối.
- Màn hình roster và kế hoạch đã kiểm ở390px: bảng hiển thị, form truy cập được và không tràn ngang toàn trang.

## Bằng chứng và chạy lại

Test HTTP giữ fixture riêng có prefix `HTTP-1792761976116` của lượt cuối để xem trong DB. Test UI tạo prefix `E2E-<timestamp>`, mã SV bắt đầu `00`, lưu ID kỳ/đợt/SV/job trong attachment `step1-api-records.json`. Không xóa hồ sơ có sẵn để chạy test.

Ảnh từ lượt cuối nằm trong:

```text
frontend/test-results-api-ui/
  step1-api-Step-1-persists--441af-udents-through-the-real-API-chrome/
    actual-term-roster.png
    actual-student-import.png
    actual-mobile-plan.png
```

Root đã xem ảnh import desktop và kế hoạch mobile. Artifacts và báo cáo Playwright được ignore; chạy lại lệnh E2E để tái tạo. Chrome local, PostgreSQL, backend và frontend phải sẵn sàng. Xem [hướng dẫn chạy và tài khoản](backend-step1.md).

Đã khởi động lại database persistent và API, rồi chạy lại E2E thành công với Vite do Playwright tự mở và dừng. Vite bỏ qua thư mục trace/report để HTML kiểm thử không gây reload ứng dụng; bind `127.0.0.1:5173` với strictPort và proxy API mặc định tới3010. Khi bàn giao, các tiến trình kiểm thử thuộc workspace đã dừng; dữ liệu demo còn nguyên. Frontend `::1:5173` và backend/database của AppProject1 được giữ nguyên.

## Các nhóm file chính

| Nhóm                            | Nguồn triển khai                                                                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema, migration, seed         | `backend/prisma/schema.prisma`, `backend/prisma/migrations/202610230001_step1`, `202610230002_step1_backfill_checks`, `backend/prisma/seed.cjs`                                          |
| Auth và quyền                   | `backend/src/auth/{controller,service,repository,dto,mapper,validator}`, `backend/src/common/security`                                                                                   |
| Kỳ/đợt/kế hoạch/quota           | `backend/src/term/{controller,service,repository,dto,validator}`                                                                                                                         |
| Danh mục/import                 | `backend/src/catalog/{controller,service,repository,dto,mapper,validator}`                                                                                                               |
| Audit, validation, lỗi, Swagger | `backend/src/common/{audit,validation,exception,swagger}`, `backend/src/app.module.ts`, `backend/src/main.ts`, `backend/src/health.controller.ts`                                        |
| Frontend API/session            | `frontend/src/shared/api/{api-session,http-client}.ts`, `shared/data/snapshot-api.ts`, `shared/data/store.ts`, `shared/hooks/use-workspace.tsx`, `shared/utils/gpa.ts`                   |
| Adapter và màn hình API         | `frontend/src/features/auth`, `features/term`, `features/catalog`; các file `term-api.ts`, `catalog-api.ts`, `import-api.ts`, `StudentApiImport.tsx`                                     |
| Kiểm thử                        | `backend/test/{step1-http,run-integration,export-openapi}.cjs`, các `*.spec.ts` auth/catalog/term/common, `frontend/e2e/step1-api.spec.ts`, snapshot/hybrid/http-client unit tests       |
| Hợp đồng/cấu hình               | `shared/src/step1.ts`, `docs/api/openapi.{json,yaml}`, `docs/api/step1-contracts.md`, `backend/.env.example`, `frontend/.env.example`, `pnpm-workspace.yaml`, cấu hình Vitest/Playwright |
| PostgreSQL demo                 | `database/scripts/{local-postgres,db-client,inspect-db}.mjs`                                                                                                                             |

## Giới hạn thực tế

- Chưa kiểm thử nâng cấp một DB cũ có dữ liệu người dùng thực hoặc triển khai production. Không tuyên bố migration đã được chứng minh với mọi biến thể dữ liệu legacy.
- Bước2–3 và các nghiệp vụ sau vẫn dùng frontend mock; không có backend phân công, đề cương, tuần, final, hội đồng, điểm hoặc email được triển khai ở lần này. Mốc kế hoạch cho chúng đã được quản lý thật ở Bước1.
- Chưa chạy lại toàn bộ ma trận route UI mock cũ. E2E lần này xác nhận các màn hình API Bước1; unit xác nhận service mock còn hoạt động.
- Vite còn cảnh báo chunk ExcelJS khoảng939kB và cảnh báo CJS API từ công cụ test/build. Build exit0; chưa tối ưu kích thước thư viện xuất Excel.
- Không chạy lint vì repo chưa có bộ cấu hình ESLint hoàn chỉnh. TypeScript, build và các test nêu trên đã chạy thật.
- Workspace không có Git metadata nên không có diff/commit/PR để bàn giao; bảng trên chỉ rõ nhóm nguồn đã triển khai. Cơ chế cho phép build dependency của pnpm đã thay các giá trị hướng dẫn bằng boolean, theo [tài liệu pnpm](https://pnpm.io/cli/approve-builds).
