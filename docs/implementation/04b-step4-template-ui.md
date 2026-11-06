# Step 4 — Giao diện theo template Stitch

## Phạm vi

Áp dụng bố cục từ ZIP `stitch_university_thesis_management_system (1).zip` cho trang danh sách, tạo/sửa và chi tiết nhóm duyệt. ZIP không có màn hình nhóm duyệt riêng; lấy trang phân công GVHD và bàn làm việc giảng viên làm tham chiếu. Khi DESIGN.md và HTML khác nhau, dùng hình chụp đi kèm làm tham chiếu thị giác.

Sidebar trắng, mục đang chọn màu navy, thanh tìm kiếm, nền xanh nhạt, thẻ thống kê, bộ lọc và bảng được điều chỉnh cho nghiệp vụ bước 4. CSS được giới hạn trong `.rg-workspace`; các trang của thành viên khác giữ giao diện hiện tại. Liên kết sidebar dẫn đến route hiện hữu, không bổ sung chức năng bước khác.

Không thực thi script từ ZIP, không chép số liệu thống kê, danh tính người dùng hoặc dữ liệu nghiệp vụ của mẫu. Không thêm dependency hay tải font từ CDN; dùng Inter nếu máy có, tiếp theo là font hệ thống. Không thay đổi API, JWT/RBAC, Prisma hoặc database.

Các thẻ số liệu ghi rõ phạm vi: tổng nhóm theo bộ lọc; giảng viên duy nhất và vòng đang hoạt động chỉ tính trên trang hiện tại. Quyền quản lý lấy từ API. Không suy diễn số liệu toàn đợt từ một trang phân trang.

## Xem thử không cần dữ liệu bước 1–3

Tại thư mục gốc:

```powershell
pnpm --filter @doan/frontend preview:review-groups
```

Lệnh mở Microsoft Edge với API giả lập và nhãn **BẢN DEMO**, có sẵn hai nhóm và hai giảng viên mẫu. Có thể tạo, sửa, chọn thành viên và xóa nhóm. Dữ liệu nằm trong bộ nhớ của trình xem thử, mất khi đóng; không ghi vào backend/Supabase. API giả lập chỉ hoạt động trong cửa sổ Edge được lệnh mở. Đóng cửa sổ hoặc Ctrl+C để dừng. Nếu đang chạy bản preview cũ, dừng rồi chạy lại lệnh.

Không cần Docker. Chế độ chạy ứng dụng thật vẫn cần backend, đăng nhập, quyền Khoa và dữ liệu đợt/bộ môn/giảng viên hợp lệ.

## Kiểm tra thực tế

- Frontend type-check: PASS.
- Frontend lint: PASS.
- Frontend unit test: PASS, 7 tests. Có cảnh báo SSR `useLayoutEffect` của React Router trong test render server; không làm test thất bại.
- Frontend build: PASS. Có cảnh báo Vite CJS API deprecated.
- Browser smoke với API giả lập: PASS, 9 checks (tạo/sửa, validation, giữ thành viên qua tìm kiếm, revision conflict, quyền chỉ xem, xóa và lỗi scope).
- Chụp và xem desktop 1280px/mobile 375px; kiểm tra không tràn ngang toàn trang khi bảng có dữ liệu; menu mobile mở và đóng bằng Escape: PASS. Bảng cuộn ngang bên trong khung trên màn hình nhỏ.

Lệnh chụp ảnh kiểm tra (ảnh nằm trong thư mục TEMP `btl-step4-template`, không đưa vào source):

```powershell
node frontend/scripts/test-review-groups-browser.cjs --screenshot
```

Các kiểm tra này xác minh giao diện với API giả lập, không thay thế integration test backend hoặc kiểm tra dữ liệu thật. Không chạy migration hay DDL trong lần chỉnh giao diện này.

## File thay đổi trong lần chỉnh template

- `frontend/src/features/review-groups/pages.tsx`: bố cục danh sách, thống kê, bảng và tìm kiếm.
- `frontend/src/features/review-groups/workspace.tsx`: layout bước 4, sidebar, topbar và menu mobile.
- `frontend/src/features/review-groups/workspace.css`: kiểu giao diện được giới hạn trong bước 4.
- `frontend/scripts/test-review-groups-browser.cjs`: dữ liệu preview mẫu, nhãn demo và chế độ chụp ảnh/kiểm tra mobile.
- `backend/prisma/review/step4-browser-results.json`: kết quả chạy lại smoke test giao diện; chỉ là artifact test.
- Tài liệu này.

Các thay đổi chưa commit có từ trước của Step 4 được giữ nguyên. Không stage, commit hoặc push.
