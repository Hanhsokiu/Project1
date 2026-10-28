# Phân công theo lịch và hệ đào tạo của tài khoản sinh viên

Ngày sửa: 28/10/2026.

## Nguyên nhân và hành vi mới

Trước đây, thuật toán phân công chỉ chạy qua API xem trước/lưu nháp; không có scheduler xử lý mốc thời gian. `AssignmentSchedulerService` nay kiểm tra mỗi 30 giây và chạy bù khi backend khởi động:

- Đợt đang mở đăng ký được chuyển sang `CLOSED_REGISTRATION` sau hạn đăng ký.
- Trong giai đoạn `ASSIGNMENT`, nếu có đăng ký `SUBMITTED` và chưa có phương án, hệ thống tạo nháp bằng thuật toán hiện có.
- Đợt hoặc giai đoạn phân công đã khóa, hay ngoài thời gian phân công, không được tạo nháp. Khóa giai đoạn đăng ký đã kết thúc không cản trở bước phân công. Phương án đã lưu được giữ nguyên; Giáo vụ tiếp tục xem trước/lưu bổ sung hoặc điều chỉnh thủ công.
- Giao dịch Serializable và kiểm tra lại phương án ngăn tạo trùng khi nhiều worker chạy. Nhật ký tự động có actor null. Hệ thống chỉ gửi thông báo sau khi Giáo vụ công bố theo quy trình hiện có.

Chỉ sinh viên đã nộp đăng ký, đủ điều kiện học vụ và đúng hệ của đợt mới được xét. Giảng viên cần hoạt động, tham gia đợt, đúng hướng và có quota còn trống. Danh sách chưa nộp và lý do chưa phân được trả về trang phương án.

Khi kiểm tra đợt local “Đồ án”, 14 sinh viên có trong roster nhưng chỉ 2 đã nộp. Một đăng ký thuộc hướng kiểm thử mà tất cả giảng viên đúng hướng có quota 0; do đó nháp có 1 phân công và 1 đăng ký chưa phân. Giáo vụ cần cập nhật quota phù hợp rồi chạy “Xem trước phân bổ bổ sung” và lưu nháp; 12 sinh viên chưa nộp không được tự gán hướng.

## Tài khoản sinh viên

Trang Tài khoản hiển thị trường Hệ đào tạo khi chọn vai trò Sinh viên, lấy danh sách từ danh mục thực tế. Backend yêu cầu hệ tồn tại và tạo hồ sơ Student trong cùng giao dịch với tài khoản. Khi bổ sung vai trò Sinh viên cho tài khoản cũ cũng áp dụng quy tắc này. Tài khoản hiện có giữ nguyên hệ nếu request không thay đổi.

Hồ sơ mới chưa có dữ liệu học vụ nên mặc định GPA 0 và chưa đủ điều kiện. Bổ sung lớp, GPA và điều kiện học vụ trong Danh sách sinh viên trước khi đưa vào đợt. Không cho đổi sang hệ khác với đợt sinh viên đang tham gia.

## Kiểm chứng

- Unit test scheduler: chạy bù lúc khởi động, phục hồi sau lỗi và chống tick chồng nhau.
- Integration test `assignment-automation.integration.spec.ts`, bật bằng `GPMS_INTEGRATION=1 RUN_AUTOMATION_DB_TESTS=1`; bắt buộc database riêng tại `127.0.0.1/btl_pr2b_autofix_*` đã chạy migrations. Kiểm tra mốc giờ, nhiều worker, quota, khóa, bảo toàn chỉnh tay và lưu/đổi hệ trong database thật.
- Frontend test `account-program.test.ts` kiểm tra lựa chọn hệ và đồng bộ hồ sơ trong chế độ demo.
