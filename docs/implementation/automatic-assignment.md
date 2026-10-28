# Tự tạo phương án phân công

Backend kiểm tra các đợt mỗi 10 giây và kiểm tra ngay khi khởi động. Một đợt
được tự tạo phương án nháp khi đã đóng đăng ký, đợt và giai đoạn phân công
không bị khóa, giờ máy chủ thuộc khoảng `[bắt đầu, kết thúc)` của cả đợt
và giai đoạn phân công, đồng thời chưa có phương án nào.

Thuật toán hiện có tiếp tục xét NV1 → NV2 → NV3 → cùng hướng, GPA và quota.
Những sinh viên chưa nộp hoặc không đủ điều kiện được liệt kê riêng. Nếu
không đủ quota, bản nháp vẫn lưu lý do chưa phân để Giáo vụ xử lý.

Tác vụ chỉ tạo bản nháp đầu tiên. Nó không ghi đè bản nháp Giáo vụ đã lưu,
không thay điều chỉnh thủ công, không tự công bố hoặc gửi email. Giáo vụ
kiểm tra tại **Phương án phân công**, điều chỉnh nếu cần rồi chọn
**Chốt & công bố**. Các lần chạy sau bỏ qua đợt đã có phương án.

Điều kiện thời gian và sự tồn tại của phương án được kiểm tra lại trong
transaction serializable. Retry cùng unique index phương án của đợt bảo
vệ khi nhiều worker hoặc thao tác thủ công chạy đồng thời. Audit dùng
`ASSIGNMENT_AUTO_DRAFT_SAVED` với actor hệ thống (`userId = NULL`). Lỗi
ở một đợt không ngăn xử lý các đợt khác; lần kiểm tra sau sẽ thử lại.

`ASSIGNMENT_WORKER_ENABLED=false` tắt worker. Mặc định worker bật trong
development/production và tắt với `NODE_ENV=test`; kiểm thử tích hợp có
thể bật rõ ràng bằng `ASSIGNMENT_WORKER_ENABLED=true`. Không cần migration
hay dependency mới. Nếu backend dừng khi đến giờ, nó xử lý khi khởi động
lại và giai đoạn phân công vẫn còn hiệu lực.

Màn hình phân công và điều chỉnh thủ công đọc `operation-window` từ máy
chủ mỗi 10 giây, hiển thị mốc bắt đầu/kết thúc theo giờ Việt Nam và lý do
chưa được thao tác. Cần chỉnh đúng giai đoạn **Phân công**, không chỉ thời
gian đăng ký. Điều chỉnh thủ công yêu cầu đã lưu phương án nháp; kết quả
đã công bố không được sửa trực tiếp. Danh sách phân công tự tải lại mỗi
30 giây nên có thể tải lại trang để thấy nháp mới sớm hơn.

Kiểm thử tích hợp: build backend, đặt `ASSIGNMENT_TEST_URL` trỏ tới một
database local mới, rỗng, tên bắt đầu bằng `btl_assignment_worker_`, rồi chạy
`pnpm --filter @doan/backend test:assignment-worker`. Runner từ chối database
khác, không reset dữ liệu và kiểm tra interval thật, quota, khóa/thời gian,
giữ điều chỉnh thủ công, chạy đồng thời và không tự công bố/gửi email.
