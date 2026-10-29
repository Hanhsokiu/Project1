# Kết quả sửa F05, F07 và Playwright

Nhánh giữ nguyên: `feature/step-9-10`. Không commit/push. Không kết nối PostgreSQL, chạy backend, migration, seed database hoặc sửa schema/shared contract. Không mở khóa UC24.

## File thay đổi

Các đường dẫn sau tính từ `frontend/`:

| File | Thay đổi |
| --- | --- |
| `src/features/grading/workflow/api.ts` | Demo phải bật tường minh; AUTH API thật tuyệt đối không fallback demo. Thêm hai adapter history với shared query schema, cursor và endpoint thực tế. |
| `src/features/grading/workflow/mode-boundary.tsx` (mới) | Thông báo chức năng chính thức chưa bật; banner dữ liệu demo ngay tại trang. |
| `src/app/router/routes.tsx` | Bọc các trang reviewer, committee, results, rubric demo bằng boundary; giữ route/quyền API hiện hữu. |
| `src/features/grading/workflow/history.tsx` (mới) | History chỉ đọc, tải khi mở, loading/empty/error/retry, trang tiếp/về đầu; scope theo user/token/term/proposal/revision. Ẩn dữ liệu cũ khi history trả lỗi; không mở history cho session có vai trò STUDENT. |
| `src/features/grading/workflow/pages.tsx` | Gắn history vào chính sách và từng hồ sơ tổng hợp; giữ nguyên nhánh kết quả đã công bố cho sinh viên và khả năng chốt/công bố do backend trả về. |
| `.env.example` | Giải thích cấu hình demo/API chấm điểm. |
| `src/features/grading/workflow/api.test.ts` | Kiểm tra endpoint, cursor, ID, lỗi 403/409/503 và trạng thái disabled. |
| `src/features/grading/workflow/mode-history.spec.tsx` (mới) | 27 tổ hợp true/false/undefined và kiểm tra boundary/metadata/empty/read-only. |
| `scripts/browser-settings.cjs` (mới) | Cổng riêng mặc định 5187, cho override GPMS_BROWSER_PORT; từ chối 5173 và cổng không hợp lệ. |
| `playwright.config.ts` | Origin dùng chung, profile mixed, thư mục artifact riêng mỗi tiến trình; giữ reuseExistingServer=false. |
| `scripts/start-browser-vite.cjs` | Cổng/cache riêng theo profile; override flags; giữ middleware chặn API trước proxy. |
| `scripts/test-browser.cjs` | Chạy api/demo/mixed, in origin; mã thoát phản ánh mọi profile. |
| `e2e/browser/fixtures.ts` | Network guard dùng cùng origin cấu hình; tiếp tục chặn API không mock và kết nối ngoài. |
| `e2e/browser/api.spec.ts` | History lazy/loading/pagination/403/empty; metadata kết quả; sinh viên không request history; giữ regression hiện hữu. |
| `e2e/browser/demo.spec.ts` | Kiểm tra banner bằng fixture demo đầy đủ chỉ trong localStorage của browser test. Không seed database. |
| `e2e/browser/mixed.spec.ts` (mới) | Session/điểm local cũ không lấn sang API; session demo không thay thế đăng nhập API. |
| `scripts/show-browser-report.cjs` (mới) | Mở HTML report mới nhất theo profile api/demo/mixed, phù hợp thư mục artifact riêng. |
| `package.json` | Cập nhật test:e2e:report gọi script chọn report mới nhất. |

Không cần sửa WorkspaceLayout hoặc store: boundary và chọn route ngăn mount trang demo trong cấu hình API thật.

## Kiểm chứng thực tế

| Kiểm tra | Kết quả |
| --- | --- |
| Frontend type-check | PASS |
| Frontend lint | PASS |
| Unit tests | PASS: 38 file, 422 test (tăng 36 test) |
| Frontend build | PASS |
| Playwright TypeScript | PASS, chạy lại sau sửa fixture cuối |
| Playwright API mock | PASS: 28/28, gồm regression UC17–UC25 hiện hữu |
| Playwright demo | PASS: 11/11 ở lần chạy cuối với fixture hoàn chỉnh |
| Playwright mixed-mode | PASS: 7/7 |
| Tổng browser theo lần chạy cuối từng profile | 46/46 |
| Cú pháp script mở report | node --check PASS; không mở GUI report trong phiên agent |
| git diff --check | PASS; Git chỉ cảnh báo chuyển LF/CRLF |

API/mixed đạt ở lượt `all`; sau đó chỉ chạy lại demo do sửa fixture demo. Không tuyên bố lượt `all` ban đầu đạt: lượt đầu lỗi EPERM với artifact cũ; lượt kế tiếp API/mixed đạt nhưng demo thiếu dữ liệu kỳ học. Cấu hình artifact riêng giải quyết EPERM mà không xóa artifact cũ hay thay quyền Windows.

## Giới hạn và phát hiện còn lại

- History backend không cung cấp tên hiển thị, lý do hay trường hành động riêng. Giao diện hiển thị ID người thực hiện, thời gian, revision, integrity; policy có contentHash, result có SEALED/PUBLISHED. Không suy diễn thêm dữ liệu.
- Backend vẫn quyết định permission và phạm vi truy cập; lỗi 403 được hiển thị. Đây là kiểm thử mock, không thay cho nghiệm thu quyền trên backend thật.
- UC24 vẫn bị chặn bởi các nguồn/policy chưa xác nhận như trước; không sửa nghiệp vụ ngoài F05/F07.
- Phát hiện lỗi có sẵn của trang kết quả demo khi fixture không có kỳ học: đọc `studentIds` từ undefined. Chưa sửa vì ngoài phạm vi; test banner sử dụng fixture demo đầy đủ, chỉ trong browser cô lập.
- Còn cảnh báo hiện hữu về SSR useLayoutEffect, Vite CJS và bundle lớn; không làm thất bại lint/build/tests.
- Không chạy lại backend tests vì không sửa backend/shared; không kiểm thử với database thật theo yêu cầu.

## Git

Phần triển khai gồm 12 file frontend đã theo dõi được sửa, 6 file frontend mới và báo cáo này. Diff tracked frontend: +335/-33; git diff --stat không tính file mới chưa tracked.

Giữ nguyên hai thay đổi có sẵn: `scripts/integration-ui.cjs` và `docs/audits/step9-10-frontend-backend-current-audit.md`. SHA256 integration-ui.cjs trước/sau: `AF73B2EE339C53990DF544FCE3AEFFCABC1347203E888812059AA797B8A92C09`.

## Lệnh chạy

Frontend/backend sử dụng cấu hình local đã có (người dùng tự chạy, agent không khởi động database):

```powershell
Set-Location 'E:\Project-Xaydungdoantotnghiep\DATN\Project1'
$env:BTL_POSTGRES_BIN = 'C:\Program Files\PostgreSQL\17\bin'
$env:BTL_UI_DB_PORT = '55452'
$env:VITE_AUTH_API = 'true'
$env:VITE_GRADING_API = 'true'
$env:VITE_DEMO_MODE = 'false'
pnpm ui:dev
```

Kiểm thử browser cô lập, không cần backend/database:

```powershell
Set-Location 'E:\Project-Xaydungdoantotnghiep\DATN\Project1\frontend'
$env:GPMS_BROWSER_PORT = '5187'
pnpm test:e2e
pnpm test:e2e:report
# Hoặc xem report demo / mixed:
node scripts/show-browser-report.cjs demo
node scripts/show-browser-report.cjs mixed
```
