# Playwright browser tests an toàn

Suite mặc định dùng Chromium đi kèm Playwright, mở React/Vite tại **http://127.0.0.1:5173**. Không cần backend, PostgreSQL hoặc Docker. Không kiểm chứng workflow/authorization backend thực bằng các test mock này.

## Cài và chạy bằng pnpm

Từ `C:\DATN\Project1\frontend`:

```powershell
pnpm test:e2e:install
pnpm test:e2e
```

`@playwright/test` đã được khai báo trong devDependencies và pnpm-lock.yaml. `test:e2e:install` tải Chromium/Headless Shell cùng các thành phần Playwright cần, vào `C:\DATN\Project1\.cache\playwright` (Git ignore); không dùng Chrome cá nhân. Với máy mới, cài dependencies của workspace bằng pnpm trước. Không cần chạy lại installer khi cache đúng phiên bản đã có.

Windows có thể cần dùng `pnpm.cmd` nếu PowerShell chặn shim `pnpm.ps1`. Nếu pnpm báo khác dependency store, dùng đúng store đã cài workspace; không xóa node_modules hoặc đổi cấu hình global chỉ để chạy test.

```powershell
pnpm test:e2e:api         # API flags + HTTP mocks
pnpm test:e2e:demo        # Demo flags + browser-local data
pnpm test:e2e:headed     # API suite, cửa sổ Chromium
pnpm test:e2e:ui         # API suite, Playwright UI
pnpm test:e2e:api --grep "API403"
pnpm test:e2e:type-check
pnpm test:e2e:report     # HTML report của API suite
pnpm exec playwright show-report playwright-report/browser-demo --host 127.0.0.1
```

Từ root có thể dùng `pnpm --dir frontend test:e2e`. `pnpm exec playwright test` trực tiếp ở frontend chỉ chọn profile API an toàn; `pnpm test:e2e` chạy API rồi demo **tuần tự**, mỗi profile có Vite riêng trên cùng cổng. Feature flags là giá trị compile-time nên không đổi mode bằng localStorage.

Không cần tự khởi động Vite. Hãy để cổng 5173 trống: `reuseExistingServer=false` và `strictPort=true` cố ý từ chối server có sẵn, tránh test nhầm env/feature flag. Harness không tự dừng server cá nhân của bạn. Khi bị ngắt đột ngột, chỉ dọn đúng tiến trình test do lượt chạy tạo; không kill mọi Node/Chrome trên máy.

## Phạm vi và cách ly

- `playwright.config.ts` chỉ discover `e2e/browser/smoke.spec.ts` và `api.spec.ts` hoặc `demo.spec.ts`. Các file legacy ở `e2e/` được giữ nguyên và **không được chọn mặc định**. Đặc biệt `step1-api.spec.ts`, `step2-api.spec.ts`, `step3-api.spec.ts` có thao tác ghi API thật: chưa chạy và không thuộc suite an toàn này. Những harness cũ dựa vào cấu hình mặc định cần cấu hình live riêng trong một nhiệm vụ có xác minh môi trường; không chuyển chúng sang mock rồi gọi là integration PASS.
- Không sửa `.env` cá nhân. Launcher override rõ các feature flags hiện có và `VITE_API_URL=/api` trong process của test.
- Vite test server có middleware chặn `/api` **trước proxy**. API không mock không bao giờ chuyển tiếp sang localhost:3000; trả 503 E2E_UNMOCKED_API. Smoke test dùng request trực tiếp tới chính frontend để kiểm guard này.
- Fixture tự động chặn API chưa mock và request/WebSocket ngoài origin test, rồi làm test FAIL. Chỉ module/asset/HMR của Vite cục bộ được tiếp tục. Service worker bị chặn. Không gọi `route.fetch()` hoặc `route.fallback()` tới backend.
- API actors/token là dữ liệu giả chỉ được inject vào sessionStorage của browser context test. Không phải JWT hợp lệ, không tạo tài khoản, không seed database. Test 401/403 kiểm cách UI xử lý response giả, không thay thế kiểm quyền backend.
- Mỗi test có context/storage riêng, không dùng browser profile người dùng. Demo chỉ dùng dữ liệu tạm trong context đó. API mode không fallback DemoDb khi lỗi.
- Vitest chỉ include test trong `src/` và exclude `e2e/`, report, artifacts; Playwright không chọn các test unit.
- Không sửa logic UC17–25, các endpoint C01, schema, migration hoặc seed.

## Các ca kiểm thử

- Smoke cho cả hai mode: login/title, hiện/ẩn mật khẩu, trợ giúp, route cần xác thực, guard chống proxy API.
- API: không có nút đăng nhập demo; required fields; login 401/loading/chống submit lặp; điều hướng giữ term; term required; inbox loading/empty; 401 xóa session; 403/grant; lỗi mạng không fallback.
- Context của người chấm: dữ liệu mock revision; không auto-save; điểm ngoài khoảng chặn PUT; 409 giữ expectedRevision/expectedContext từ lần đọc và bắt xem lại, không tự retry. UC17 inbox rỗng không tự chèn hồ sơ demo.
- Demo: login nội bộ, sai credentials, không dùng API token để đăng nhập demo, mobile navigation và 404 sau đăng nhập.

Thời gian test tối đa 60 giây cho lượt cold-start Vite trên Windows; assertion vẫn giới hạn 8 giây. Không retry tự động, không dùng sleep để tạo loading. Các test loading chủ động giữ/thả response bằng Promise.

## Kết quả và artifact

Kết quả chạy thực tế ngày 28/10/2026, Chromium headless:

| Kiểm tra                 | PASS | FAIL | SKIPPED |
| ------------------------ | ---- | ---- | ------- |
| API mode (58,5 giây)     | 19   | 0    | 0       |
| Demo mode (39,5 giây)    | 10   | 0    | 0       |
| Vitest frontend, 36 file | 383  | 0    | 0       |

TypeScript ứng dụng và E2E PASS; ESLint src/config/browser tests PASS. Vitest không discover test Playwright. Lượt browser đầu có timeout cold-start và kỳ vọng 404 chưa đăng nhập sai; đã sửa harness theo router hiện hành và chạy lại toàn bộ đạt 29/29. Lượt cuối chạy ngoài sandbox Codex để Windows dọn được tiến trình Vite; không cần backend hoặc thay đổi nghiệp vụ để làm test pass.

- API: `test-results/browser-api/results.json`; HTML `playwright-report/browser-api/`.
- Demo: `test-results/browser-demo/results.json`; HTML `playwright-report/browser-demo/`.
- Screenshot và trace chỉ giữ khi lỗi; mở bằng `pnpm exec playwright show-trace <trace.zip>`.
- Các thư mục cache/report/result đã có trong Git ignore. Không lưu dữ liệu thật hoặc bí mật trong fixtures/traces. Suite ghi đè thư mục artifact của chính profile khi chạy lại.

Backend thật, PostgreSQL integration, UC17–25 đầu cuối với nguồn official và các suite legacy: **NOT RUN** trong nhiệm vụ này.

## File cấu hình/test của lượt này

- Sửa `frontend/package.json`, `pnpm-lock.yaml`: Playwright 1.64.1, Node typings trực tiếp, scripts pnpm. Lockfile chỉ đổi dependency entries của frontend; không nâng phiên bản backend.
- Sửa `frontend/playwright.config.ts`, `frontend/vitest.config.ts`: discovery riêng, Chromium cache, web server và profile độc lập.
- Tạo `frontend/tsconfig.e2e.json`.
- Tạo `frontend/scripts/install-playwright.cjs`, `test-browser.cjs`, `start-browser-vite.cjs`.
- Tạo `frontend/e2e/browser/fixtures.ts`, `smoke.spec.ts`, `api.spec.ts`, `demo.spec.ts`.
- Tạo `frontend/e2e/README.md` này. Cache, HTML/JSON report và trace là artifact Git ignore.
