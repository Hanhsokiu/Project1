# Chỉnh lại visual direction theo phản hồi — /registration

Ngày 15/11/2026. Người dùng nhận xét bản trước còn xa ảnh tham chiếu. Vòng này sửa phần trình bày
và thêm khả năng thu gọn form trên mobile, chỉ trong `/registration`.

## Thay đổi nhìn thấy được

- Banner có ảnh khuôn viên thật, nền xanh nhạt và dải cong xanh–vàng. Sidebar thêm ảnh khuôn viên,
  giữ logo UTC chính thức; các dải cong là SVG trang trí, không phải logo vẽ lại.
- Card chuyển từ phẳng sang nền trắng–xanh rất nhẹ, border và shadow rõ hơn; số thứ tự và nút nộp
  có sắc độ xanh sâu. Typography giữ Be Vietnam Pro, tăng trọng lượng phần nội dung quan trọng.
- Giảm padding/gap của form, header và danh sách GV. Chiều cao nội dung desktop từ khoảng 1316px
  của vòng trước xuống khoảng 1132px ở 1440px, vẫn giữ đủ trường và control 44px.
- Bảng hồ sơ bên phải có badge cùng hàng tiêu đề. Dữ liệu/status lấy từ nguồn cũ.
- Mobile có nút thu gọn từng phần, hỗ trợ Enter/Space và aria-expanded/aria-controls;
  các input vẫn mounted nên không mất giá trị. Validation lỗi mở lại các phần để sửa.
  Mặc định mở các phần, không tự coi trường đã hoàn tất. Ảnh thu gọn là trạng thái người dùng đã bấm nút.

## Ảnh ứng dụng thật

| Kích thước | Toàn trang | Đúng viewport |
|---|---|---|
| 1440×900 | [Desktop](after-1440.png) | [Viewport](viewport-1440.png) |
| 1024×768 | [Desktop nhỏ](after-1024.png) | [Viewport](viewport-1024.png) |
| 768×1024 | [Tablet](after-768.png) | [Viewport](viewport-768.png) |
| 390×844 | [Mobile mở đủ](after-390.png) | [Viewport](viewport-390.png) |
| 320×700 | [Mobile nhỏ](after-320.png) | [Viewport](viewport-320.png) |

[Bản trước vòng chỉnh](before.png) · [Mobile thu gọn hai phần](mobile-collapsed.png) ·
[Mobile thu gọn trong viewport](mobile-collapsed-viewport.png).

Tài khoản/đợt mẫu hiện có; API thật tại `127.0.0.1:5173`. Không thay API bằng fixture để chụp các ảnh trên.
Chưa sao chép chính xác từng pixel: ảnh trường thực tế khác công trình minh họa; control lớn hơn để thao tác;
giữ trường ghi chú và các nhãn nghiệp vụ. Không đưa khung điện thoại, các ô quảng bá, tìm kiếm giả,
tick xác nhận giả hay autosave không tồn tại vào ứng dụng.

## Kiểm chứng

- [Playwright MCP](browser-checks.json): năm kích thước không tràn ngang; axe WCAG2 A/AA + WCAG2.1 AA
  không phát hiện violation ở cả năm kích thước. Không thay thế kiểm toán accessibility thủ công toàn diện.
- 10 kiểm tra tương tác thật đạt: thu gọn bằng bàn phím, giữ giá trị, mở lại khi validation lỗi,
  chọn GV thật, đổi thứ tự giữ focus, Confirm/Escape, focus drawer, reduced motion. Không có API write.
- Không ghi nhận HTTP >=400/pageerror trong lượt này. `/profile` không có class UTC hoặc ảnh khuôn viên.
- Type-check và lint: PASS bằng executable trong `frontend/node_modules`, đúng nội dung scripts package.
- [Unit tests](unit-tests.log): **64 file, 403 test đạt**.
- [Build](build.log): PASS; vẫn có cảnh báo CJS/chunk lớn của hệ thống.
- [Browser fixture](isolated-write-checks.json): **5 nhóm đạt**, gồm disclosure/validation và pending/success/error/
  khóa cổng của draft/submit. Lệnh: `node frontend/scripts/test-utc-registration-browser.cjs`.
  Đây là kiểm thử cô lập, không phải xác nhận ghi qua API/database thật.

API, backend, schema, routing, RBAC, payload và các điều kiện đăng ký không sửa.
Không lưu/nộp lại hồ sơ thật, không commit/push/merge. Chưa mở rộng module khác.

## Asset và phạm vi

Ảnh lấy từ [asset trên website UTC](https://www.utc.edu.vn/Upload/2026/03/20/utc-15-tang.jpg),
được liệt kê trên [trang chính thức UTC](https://www.utc.edu.vn/). Bản gốc lưu ở
`references/utc-ui-reference/official-utc-campus.jpg`; bản phục vụ giao diện
`frontend/public/brand/utc-campus-banner.jpg` được giảm kích thước xuống 1200px và mã hóa JPEG 85,
khoảng 178 KB. Không thay đổi nội dung ảnh hay tạo ảnh AI.

Các file sửa: StudentRegistrationPage.tsx, student-registration.css, WorkspaceLayout.tsx,
utc-registration-shell.css, block UTC trong design-system.css, test-utc-registration-browser.cjs.
Thêm hai asset: utc-campus-banner.jpg, utc-ribbon.svg. Logo gốc được giữ nguyên.

Ảnh audit và before/after của vòng trước vẫn giữ. Hai artifact fixture trong thư mục vòng trước
đã được cập nhật khi chạy lại script; kết quả 5 nhóm hiện tại cũng được lưu tại đây.
Script hiện trỏ output vào thư mục v2 cho những lần chạy tiếp theo.
