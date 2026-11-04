# Import Excel và cấp tài khoản

Cập nhật ngày 04/11/2026.

Khi xác nhận import, mã sinh viên hoặc mã giảng viên mới được dùng làm tên đăng nhập và mật khẩu ban đầu. Mật khẩu được băm bằng bcrypt, tài khoản được kích hoạt và gán vai trò STUDENT hoặc LECTURER. Người dùng phải đổi mật khẩu ở lần đăng nhập đầu tiên. Bước xem trước chưa tạo tài khoản.

Hồ sơ đã tồn tại được tái sử dụng; import không đặt lại mật khẩu, mở khóa tài khoản hoặc xóa thông tin liên hệ khi ô Excel để trống. Mã/email đã thuộc tài khoản khác và các mã/email trùng trong tệp được báo lỗi. Chế độ STRICT không ghi dữ liệu nếu còn lỗi; VALID_ONLY chỉ nhập dòng hợp lệ.

## Hai file mẫu

- [Danh sách sinh viên](../../frontend/public/samples/danh-sach-sinh-vien.xlsx): 3 sinh viên, mã `0026001001` đến `0026001003`.
- [Danh sách giảng viên](../../frontend/public/samples/danh-sach-giang-vien.xlsx): 3 giảng viên, mã `GV_MAU_26001` đến `GV_MAU_26003`.

Mỗi file có sheet dữ liệu đầu tiên và sheet Hướng dẫn. Mã được lưu dưới dạng văn bản để giữ số 0 ở đầu. Có thể tái tạo file bằng `node backend/scripts/generate-import-samples.cjs`.

Khi Vite đang chạy, tải trực tiếp tại `/samples/danh-sach-sinh-vien.xlsx` và `/samples/danh-sach-giang-vien.xlsx`.

## Cách thử

1. Đăng nhập bằng tài khoản có quyền import, mở **Import dữ liệu** và chọn loại danh sách.
2. Với sinh viên, chọn đợt Nháp/Mở đăng ký, chưa khóa và đã cấu hình hệ đào tạo. Cột `trainingSystemCode` để trống sẽ lấy hệ của đợt. GPA phải đạt ngưỡng của đợt.
3. Với giảng viên, dùng mã bộ môn hiện có và tên hướng chuyên môn đang hoạt động. Mẫu dùng `CNPM` và `Phần mềm`. Nhiều hướng phân cách bằng dấu `;`.
4. Chọn file Excel, bấm **Kiểm tra tệp**, xem các dòng lỗi rồi **Xác nhận nhập**.
5. Đăng xuất, đăng nhập bằng mã vừa nhập và mật khẩu bằng chính mã đó; hệ thống chuyển đến trang đổi mật khẩu lần đầu.

Import giảng viên lưu vào danh mục chung; việc thêm giảng viên vào một đợt và phân công hướng dẫn vẫn thực hiện theo quy trình riêng.

## Kiểm chứng

- TypeScript frontend và backend: đạt.
- 20 kiểm thử validator/parser: đạt.
- 9 kiểm thử với PostgreSQL: đạt, bao gồm tạo tài khoản, vai trò, mật khẩu ban đầu, nhập lại, giữ mật khẩu đã đổi, STRICT/VALID_ONLY, xác nhận lặp và đợt khóa.
- Edge headless với API đang chạy: upload Excel qua giao diện, xác nhận 3 sinh viên và 3 giảng viên, đăng nhập bằng mã cho cả hai vai trò và xác minh chuyển đến đổi mật khẩu lần đầu; không có lỗi JavaScript hoặc HTTP 500. Dữ liệu kiểm thử dùng mã riêng và đã dọn, không dùng các mã trong file mẫu bàn giao.

Chạy lại kiểm thử backend:

```powershell
pnpm --filter @doan/backend exec vitest run src/catalog/validator/catalog-import.spec.ts src/catalog/validator/lecturer-import.spec.ts
# Chỉ chạy với database kiểm thử đã chuẩn bị:
$env:GPMS_INTEGRATION = '1'
pnpm --filter @doan/backend exec vitest run src/catalog/service/import.integration.spec.ts
```

Không cần thay schema hoặc chạy migration cho sửa đổi này.
