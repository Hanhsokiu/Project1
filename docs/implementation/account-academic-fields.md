# Hồ sơ theo vai trò khi tạo tài khoản — 29/10/2026

## Vấn đề và thay đổi

Form cũ đặt Hệ đào tạo cuối phần thông tin chung, chưa có lớp sinh viên, bộ môn hoặc hướng chuyên môn của giảng viên. API tạo tài khoản mới chỉ tạo hồ sơ sinh viên khi có hệ đào tạo; chọn vai trò giảng viên chưa tạo hồ sơ giảng viên.

Form mới có thứ tự:

1. **Vai trò được cấp**: chọn trước để hiển thị đúng phần hồ sơ; hỗ trợ tài khoản có nhiều vai trò.
2. **Thông tin chung**: tên đăng nhập, họ tên, email, điện thoại.
3. **Hồ sơ theo vai trò**:
   - Sinh viên: Hệ đào tạo → Ngành học → Lớp.
   - Giảng viên: Bộ môn → Số sinh viên hướng dẫn tối đa → Hướng chuyên môn có thể hướng dẫn (chọn nhiều, ít nhất một).
4. **Mật khẩu**, hướng dẫn và nút lưu.

Lớp là ô chọn có gợi ý từ dữ liệu sinh viên cùng `trainingSystemId`; dữ liệu demo cũ dùng tên hệ để tương thích. Có thể nhập lớp mới. Đổi hệ sẽ xóa lựa chọn lớp đang nhập để tránh giữ nhầm lớp. Không tạo thêm bảng danh mục lớp trong database.

## Lưu và kiểm tra đầu vào

- API tài khoản nhận thêm `className`, `departmentId`, `researchAreaIds`, `maxStudents`.
- Tài khoản giảng viên mới được tạo cùng `Lecturer` và `LecturerArea` trong một transaction. Tên đăng nhập dùng làm mã giảng viên, tên và điện thoại lấy từ thông tin chung. Quota mặc định 5 nếu chưa đặt.
- Backend xác minh bộ môn và hướng chuyên môn tồn tại; từ chối hướng trùng/rỗng và quota ngoài số nguyên 0–100. Khi sửa tài khoản, nạp lại hồ sơ đã có; trường không gửi không xóa dữ liệu hiện tại.
- Sinh viên lưu lớp cùng hồ sơ, giữ kiểm tra hệ đào tạo hiện có. Không cho chuyển hệ nếu sinh viên đang thuộc đợt của hệ khác. Client cũ không gửi lớp vẫn được hỗ trợ; form mới yêu cầu nhập lớp.
- Trường theo vai trò chỉ gửi khi vai trò tương ứng được chọn. Bỏ vai trò không xóa hồ sơ lịch sử hoặc phân công đang tham chiếu.
- Không thay schema, chạy migration, seed hay sửa hồ sơ/tài khoản thật trong lượt này.

## Kiểm chứng

- Backend/frontend TypeScript và build thành công; toàn bộ unit tests: **263 backend, 139 frontend PASS**.
- Kiểm tra service với database thật trong một transaction bắt buộc rollback: tạo giảng viên kèm bộ môn/hướng chuyên môn, sửa hướng/quota, tạo sinh viên kèm hệ/lớp. Các giá trị được lưu và đọc lại đúng trong transaction; rollback xong số bản ghi ở 12 bảng được đối chiếu không đổi.
- Browser bằng phiên admin hiện có: thứ tự Hệ → Ngành → Lớp đúng; gợi ý lớp từ dữ liệu thật; chọn được hướng chuyên môn; mở sửa `gv000002` hiển thị lại các hướng đã có; không có lỗi API hoặc JavaScript. Không bấm lưu trên giao diện.
- Bằng chứng local (Git bỏ qua): `.cache/shared-dev/account-academic-rollback.json`, `.cache/shared-dev/account-academic-ui.json`, `.cache/shared-dev/account-academic-form.png`.
