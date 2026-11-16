# /registration — nâng cấp theo tham chiếu UTC

> Có vòng chỉnh visual tiếp theo theo phản hồi người dùng: [bản v2](../utc-registration-v2/README.md).
> Hai artifact fixture lưu/nộp đã được chạy lại cho v2 (5 nhóm kiểm tra); ảnh baseline/after của vòng này giữ nguyên.

Bàn giao ngày **15/11/2026**. Chỉ triển khai trang đăng ký và biến thể shell cần thiết cho route này.
Không mở rộng module khác; không commit/push/merge. Đây là vòng nâng cấp tiếp theo của
[mẫu trước](../pilot-registration/README.md), giữ nguyên bằng chứng audit và mẫu cũ.

## Phạm vi và nguồn

Đã đối chiếu AGENTS.md, kiến trúc React/Vite, router/WorkspaceLayout, component kit, service đăng ký,
schema validation hiện có, audit 01–04, đặc tả 05 và bốn tệp ZIP tham chiếu.
[Ảnh mục tiêu](../../references/utc-ui-reference/utc-registration-reference.png) là ảnh trình bày tổng hợp;
các khung điện thoại không phải thành phần được đưa vào ứng dụng.
[Nguồn logo chính thức](../../references/utc-ui-reference/ASSET-SOURCES.md) được ghi riêng.

Các file triển khai của vòng này:

- `frontend/src/features/registration/pages/StudentRegistrationPage.tsx`: bố cục và JSX hiển thị.
- `frontend/src/features/registration/pages/student-registration.css`: style scoped của form.
- `frontend/src/app/layouts/WorkspaceLayout.tsx`: chọn biến thể UTC đúng `/registration`, logo, drawer/focus.
- `frontend/src/app/layouts/utc-registration-shell.css`: shell UTC scoped.
- `frontend/src/design-system.css`: thêm block token `.utc-registration-shell`.
- `frontend/public/brand/utc-seal.png`: logo gốc từ asset của UTC.
- `frontend/scripts/test-utc-registration-browser.cjs`: kiểm thử HTTP fixture cô lập, không kết nối database.

Không sửa service/API contracts, backend, schema, routing hoặc RBAC. Giữ nguyên save(false),
Confirm → save(true), server window/polling, validation, reset nguyện vọng khi đổi hướng,
lọc GV theo đợt/chuyên môn/active và giới hạn `Math.min(3, max_preferences)`.

## Đối chiếu thiết kế

| Hạng mục | Đã triển khai | Điều chỉnh có chủ đích |
|---|---|---|
| Nhận diện | Logo UTC gốc; Sidebar navy, nền trắng/xanh nhạt, active blue + vạch vàng | Không dùng logo tái tạo từ mockup hoặc hình tòa nhà không có asset nguồn |
| Typography | Be Vietnam Pro; H1 28px desktop, body/control dễ đọc | Không nén chữ để ép toàn bộ form vào một viewport |
| Sidebar/Topbar | Sidebar 248px/thu gọn 80px; breadcrumb, chọn đợt, thông báo, hồ sơ hiện có | Giữ nguyên menu/quyền; không thêm tìm kiếm chức năng, lịch hay dropdown giả |
| Card | Ba phần 01–03; radius 14px, border xanh nhẹ, shadow nhỏ | Không sao chép glass, gradient đậm hoặc trang trí quảng bá |
| Form | Identity strip, icon email/điện thoại, chọn hướng, hàng GV có rank/avatar/nút nâng–hạ–xóa | Giữ ghi chú và native select; thêm dòng đọc đầy đủ tên hướng dài |
| Hồ sơ | Dữ liệu đã lưu, trạng thái, ngày cập nhật/nộp, thứ tự đã lưu, thẻ nguyên tắc vàng nhạt | Không ghi autosave, tick validation, đếm ngày hoặc trạng thái tiến trình không tồn tại |
| Responsive | Rail phải ở desktop rộng; rail xuống dưới ở 1024/768; một cột mobile, drawer dưới 1024 | Mobile giữ mở đủ ba phần; không thêm accordion hoặc footer cố định che trường nhập |
| Interaction | Hover màu, focus rõ, button ≥44px, drawer transition 220ms, reduced motion | Không dùng drag-only; không đổi thứ tự/nghiệp vụ để khớp ảnh |

Viền input dùng `#7b91ad` thay `#b9cde4` của tham chiếu: tương phản trên trắng **3,23:1**.
Chữ metadata **4,86:1**, chữ nút primary **8,11:1**, badge đã nộp **6,28:1**.
Các màu tham chiếu không được coi là bộ mã màu thương hiệu chính thức của trường.

## Ảnh trước/sau trên ứng dụng thật

Playwright MCP, Chromium, `http://127.0.0.1:5173/registration`, vai trò STUDENT,
hồ sơ mẫu hiện có, đợt MAU18-01-DANGKY. Trạng thái thật **SUBMITTED**, cổng cho phép sửa.
Không seed, không tạo dữ liệu thay API. Ảnh before chụp 14:58 UTC; thời điểm từng ảnh after
và viewport chính xác trong [browser-checks.json](browser-checks.json).

| Viewport | Trước | Sau toàn trang | Sau đúng viewport |
|---|---|---|---|
| 1440×900 | [before](before-1440.png) | [after](after-1440.png) | [viewport](viewport-1440.png) |
| 1024×768 | [before](before-1024.png) | [after](after-1024.png) | [viewport](viewport-1024.png) |
| 768×1024 | [before](before-768.png) | [after](after-768.png) | [viewport](viewport-768.png) |
| 390×844 | [before](before-390.png) | [after](after-390.png) | [viewport](viewport-390.png) |
| 320×700 | [before](before-320.png) | [after](after-320.png) | [viewport](viewport-320.png) |

Ảnh toàn trang có chiều cao nội dung thực tế, không phải chiều cao viewport. Ảnh cuối chụp khi
animation ổn định, không thay CSS hay nội dung để tạo bằng chứng. Đã xem ảnh đối chiếu desktop,
tablet và mobile; giữ chiều cao control và khả năng đọc thay vì sao chép mật độ ảnh minh họa.

Ảnh bổ sung: [drawer mobile](mobile-drawer.png), [validation thật](validation.png),
[xác nhận nộp, chưa xác nhận ghi](submit-confirmation.png).
`iteration-1-1440.png` và `desktop-viewport.png` là ảnh trung gian, không dùng làm ảnh nghiệm thu cuối.

## Kiểm tra đã chạy

### Playwright MCP với API thật

- Cả năm kích thước không có tràn ngang; Be Vietnam Pro được tải; control có thể thao tác cao ≥44px.
- Chọn GV từ danh sách thật, thêm đến giới hạn ba, không cho thêm quá giới hạn, nâng thứ tự bằng Enter,
  focus đi theo hàng vừa đổi, xóa và khôi phục danh sách cũ.
- Đổi hướng xóa lựa chọn theo hành vi cũ; không thể thêm GV khi chưa chọn hướng.
- Email và điện thoại sai bị chặn trước HTTP, có alert. Thay đổi cục bộ không làm thay đổi badge hồ sơ đã lưu.
- Mở xác nhận nộp, focus vào dialog, Escape đóng và trả focus về nút nộp; không bấm xác nhận ghi thật.
- Drawer mở bằng Enter, focus trong drawer, Tab/Shift+Tab tuần hoàn, Escape trả focus;
  nền inert khi mở và được giải phóng khi đóng/resize sang desktop. Đã sửa lỗi focus do transition visibility.
- Sidebar thu gọn/mở rộng đúng 80/248px. Reduced motion tắt chuyển động không cần thiết.
- 26 assertion tương tác đạt. Theo listener của phiên kiểm tra: không có API write, HTTP ≥400 hay pageerror;
  không có console error trong lượt kiểm tra cuối. Không thu token, header hay mật khẩu.
- Axe WCAG 2 A/AA + 2.1 AA: không phát hiện violation tại năm chiều rộng. Có một mục contrast chưa tự kết luận
  do pseudo-element số thứ tự; đã đối chiếu riêng màu chữ/nền tiêu đề và số. Không coi axe là chứng nhận toàn bộ WCAG.
- Sang `/profile`: không còn class/token UTC, Sidebar vẫn trắng. Sau đó trở lại `/registration` hoạt động bình thường.

### Kiểm thử ghi cô lập — không phải chứng cứ tích hợp API thật

`node frontend/scripts/test-utc-registration-browser.cjs`: **4 nhóm đạt**.
[Kết quả](isolated-write-checks.json), [ảnh pending có fixture](isolated-draft-pending.png).

1. PUT draft giữ thứ tự preference trong payload; khóa trường/nút khi pending, báo thành công khi trả về.
2. POST submit qua Confirm; hiển thị pending, đóng dialog và làm mới badge sau thành công.
3. HTTP 409 hiển thị lỗi, mở lại control, giữ trạng thái đã nộp đã lưu.
4. Server window khóa làm vô hiệu hóa cả lưu/nộp.

Fixture chỉ tồn tại trong browser context/server test riêng tại port 50189; mọi API được chặn/đáp ứng trong bộ test.
Không bật demo, không đưa fixture vào ứng dụng thật, không sửa dữ liệu thật để chụp trạng thái.

### Kiểm tra kỹ thuật và phạm vi

| Lệnh | Kết quả |
|---|---|
| `cd frontend; node node_modules/typescript/bin/tsc --noEmit` | PASS, exit 0; đúng nội dung script type-check |
| `cd frontend; node node_modules/eslint/bin/eslint.js src --ext .ts,.tsx` | PASS, exit 0; đúng nội dung script lint |
| `pnpm.cmd --filter @doan/frontend test` | PASS, **64 file / 403 test**, gồm registration API/service/ownership |
| `pnpm.cmd --filter @doan/frontend build` | PASS sau chỉnh sửa cuối, 2232 module |
| `node frontend/scripts/test-utc-registration-browser.cjs` | PASS, 4 nhóm trạng thái ghi cô lập |

Một lần chạy wrapper `run-pnpm.cjs` trực tiếp thiếu npm_execpath nên không thực thi test; đã chạy lại bằng pnpm.
Sandbox không cho pnpm mở store lock khi chạy type-check/lint, nên dùng executable đã cài trong workspace;
không hạ tiêu chí kiểm tra. Build có cảnh báo chunk >500kB/CJS Vite; unit test có cảnh báo useLayoutEffect SSR
từ các màn khác. Không sửa cấu hình hay bỏ test để giấu cảnh báo.

[scope-verification.json](scope-verification.json) xác nhận 13 file dirty ngoài phạm vi không đổi so với
[baseline-hashes.json](baseline-hashes.json). Nội dung design-system ngoài block token UTC mới khớp hoàn toàn
bản trước. Các thay đổi lớn có sẵn trong git diff không phải toàn bộ do vòng nâng cấp này tạo ra.

## Giới hạn và việc còn lại

- **Chưa chạy lưu/nộp ghi qua API thật**: hồ sơ mẫu đang SUBMITTED; ghi lại sẽ đổi thời điểm/lịch sử.
  Chỉ có read API thật và kiểm thử write cô lập. Cần phiên kiểm thử được phép ghi trước khi xác nhận hồi quy tích hợp ghi.
- Khi nối lại công việc, từng gặp màn tải/lỗi dữ liệu chung và timeout chờ form; tải lại đã khôi phục.
  Không tuyên bố sửa vấn đề snapshot F02 hoặc quy nguyên nhân về backend chỉ từ triệu chứng đó.
- Validation service vẫn trả thông báo tổng hợp; chưa phân loại lỗi từng trường. Giữ schema/quy tắc hiện có.
- Logo gốc 1,31 MB được giữ nguyên chất lượng; có thể tối ưu phân phối ở nhiệm vụ hiệu năng riêng.
- Không có ảnh công trình UTC độc lập được xác minh trong ZIP, nên không cắt/ghép công trình từ mockup.
  Chưa thêm accordion, drag/drop hay các chức năng mới chỉ để giống ảnh.

Dừng tại `/registration`; đánh giá mẫu này trước khi nhân rộng.
