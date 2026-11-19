# Bộ dữ liệu nguồn và lịch sử tổng hợp

## Phạm vi

Nguồn được người dùng chỉ định: `3. Chấm điểm- HD6.xlsx`, `Điểm HP Đồ án TN.pdf`, `Thứ tự bảo vệ tại các Hội đồng chấm đồ án  Cử nhân CNTT - K63 -62 Kỹ sư Khóa cũ.xlsx` trong `D:/Project1`.

Chọn 80 sinh viên, giữ toàn bộ 36 giảng viên theo trả lời của người dùng. Lấy danh tính sinh viên, mã sinh viên, lớp và giảng viên từ nguồn. Người dùng cho phép sinh lịch sử nghiệp vụ để kiểm tra giao diện trên Supabase nhóm. Lịch sử/điểm tổng hợp không phải chứng nhận hành vi, phê duyệt hoặc kết quả học tập thật. Username và mật khẩu khởi tạo sinh viên theo yêu cầu là mã sinh viên; mật khẩu lưu băm và yêu cầu đổi lần đầu. Không ghi đè tài khoản đang tồn tại. Bộ môn giảng viên chờ người dùng cung cấp, không tự gán.

## Các phần và tiêu chí nghiệm thu

1. **Chuẩn hóa nguồn**: đọc đúng ba file, checksum SHA-256, vị trí sheet/hàng/trang; mã sinh viên dạng chuỗi; tên tiếng Việt NFC; giữ mọi biến thể và báo mâu thuẫn. File dữ liệu cá nhân chỉ ở `.cache/source-dataset`, không commit.
2. **Thiết kế dữ liệu**: danh tính không trùng, liên kết lớp/giảng viên/đề tài có nguồn; dữ liệu tự sinh được đánh dấu. Ma trận từ đăng ký đến kết quả phải nêu trạng thái và bằng chứng cần thiết, không coi mọi sinh viên đồng thời ở mọi trạng thái.
3. **Kiểm tra đích**: chỉ đọc Supabase đã cấu hình, đối chiếu toàn bộ migration/checksum, tài khoản, danh mục và cấu hình quyền/chính sách. Xác nhận backup trước ghi. Không sử dụng policy TEST trên DB chung hoặc sửa trạng thái để bỏ qua validator.
4. **Nhập và thực thi**: chạy lại không trùng; lưu checkpoint; thao tác qua service/API hiện có khi có đủ đầu vào. Mỗi thao tác ghi actor, thời gian thực thi, tham chiếu nguồn và kết quả. Lịch sử mô phỏng phải có dấu nhận diện; không giả ngày ký, người duyệt hoặc văn bản phê duyệt thật.
5. **Kiểm chứng**: đếm bản ghi và đối chiếu quan hệ, trạng thái/phiên bản, hash file PDF/source, quyền theo vai trò; mở màn hình qua API thật. Phần chưa chạy phải ghi rõ, không đổi thành PASS.

## Trạng thái

Đã chuẩn hóa nguồn, chọn đủ 80 sinh viên, giữ 36 giảng viên, xuất Excel/JSON riêng tại `.cache/source-dataset`. Đã backup public schema/data (chưa thử restore), áp dụng hai migration không xóa dữ liệu và xác nhận history đủ 29/29. Đã nhập 80 sinh viên, 33 giảng viên và tài khoản Khoa riêng; 3 giảng viên thiếu bộ môn còn chờ đối chiếu. Người dùng đã cho phép sinh GPA/điều kiện học vụ và xác nhận 7 ánh xạ hướng chuyên môn → bộ môn phụ trách cho workflow tổng hợp.

Đợt `NGUON80-2026` đã có roster 80/33, 4 đăng ký nháp, 76 đăng ký đã nộp; 76 phân công đã công bố/chốt, không có vi phạm. Đã kiểm chứng độc lập 68 đề cương, 112 phiên bản niêm phong, 60 hồ sơ duyệt, 48 hồ sơ đã nhận, 44 kế hoạch hướng dẫn, 40 bài nộp/80 tệp và 36 nhận xét đạt. Ban đầu đã phát hành 9 policy UC17–25, 3 phòng và 4 tiêu chí; lịch này đã được thay bằng lịch test tối 18/11 và bổ sung phòng thứ tư theo yêu cầu mới ở dưới. Đã kiểm chứng 32 báo cáo cuối và 28 xác nhận của GVHD; 28 hồ sơ đã được Khoa chốt đủ điều kiện và kiểm chứng độc lập. Đã commit và kiểm chứng 4 hội đồng cho 24 sinh viên; 20 phân công phản biện cũng đã chốt và kiểm chứng cùng audit. Đăng nhập HTTP ba vai trò, quyền đọc hướng dẫn và tải PDF/ZIP đã được kiểm tra; UI/API toàn bộ quy trình chưa được xác minh. Xem [trạng thái và cách chạy](README.md). Không xóa database cũ, không tự động commit/push.

Đã bàn giao mật khẩu 80 sinh viên về mã sinh viên qua AccountService và kiểm chứng đủ 114 tài khoản tại thời điểm bàn giao 18/11; HTTP đăng nhập ba vai trò khi đó đạt với guard đổi mật khẩu lần đầu. Khoa đã đổi mật khẩu sau bàn giao, mật khẩu Khoa ban đầu không còn hiệu lực; không reset mật khẩu hiện tại.

Yêu cầu mới của người dùng đã thay lịch 19/11 bằng lịch test tối 18/11: đã kiểm chứng 4 phiên/20 sinh viên, 16 phiếu phản biện và 48 phiếu hội đồng cho 12 sinh viên, được chấm trong giờ thật của phiên. Đã sửa 40 nhãn mặc định, 68 tên đề tài hiện tại khác nhau; PDF/phiên bản chốt giữ lịch sử cũ. Ngày 19/11 người dùng duyệt rõ tác động quyền cho toàn role và làm tròn cuối một chữ số; đã thêm đúng 21 liên kết quyền và cập nhật riêng UC24. Đã hoàn tất và kiểm chứng độc lập 8 kết quả chốt, 4 công bố, 15 biểu mẫu; cả 8 công thức điểm được tính lại độc lập. Dữ liệu đã có từ đăng ký tới báo cáo cuối quy trình; kiểm chứng UI toàn hệ thống còn ngoài phạm vi hoàn tất dữ liệu. Hướng dẫn mở dữ liệu: [START-HERE.md](START-HERE.md), bằng chứng: [VERIFICATION.md](VERIFICATION.md).
