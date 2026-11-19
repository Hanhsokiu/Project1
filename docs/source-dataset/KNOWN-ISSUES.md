# Giới hạn kiểm chứng trên Supabase nhóm

## Cập nhật sau audit 19/11: sửa UC18/UC24/UC25 timeout

Danh sách xét điều kiện, danh sách kết quả và options báo cáo đã được gom truy vấn. Lần đo sau sửa trả dữ liệu trong 12,296/17,508/14,067 giây, không còn P2028 trong lần kiểm tra đó. Riêng danh sách kết quả có thời hạn frontend 45 giây cho DB từ xa. Đối chiếu cùng snapshot xác nhận 8 kết quả chính thức vẫn hiện hành, phân trang/lọc giữ đúng dữ liệu. API/UI đã nạp lại; chưa đo lại UI theo phiên Khoa hiện tại. Xem [bản sửa, test và giới hạn](../qa/timeout-fix.md). Các đoạn sau là lịch sử trước bản sửa này.

## Cập nhật 19/11: đã tái hiện timeout các màn hội đồng và phản biện

Đo chỉ đọc trên DB hiện tại, giữ nguyên deadline repository: danh sách chấm phản biện 225 truy vấn/30.742 ms; workspace hội đồng 277 truy vấn/30.799 ms; danh sách chấm hội đồng 353 truy vấn/30.666 ms. Cả ba dừng với Prisma P2028 trước khi trả danh sách. Điểm nghẽn đầu tiên là kiểm tra điều kiện từng ứng viên bằng nhiều truy vấn tuần tự; phân trang hiện diễn ra sau khi dựng dữ liệu. Frontend timeout 20 giây và retry một lần có thể kéo dài trạng thái chờ.

Người dùng đã duyệt sửa backend. Bản cuối đã gom truy vấn và loại phần đọc roster không cần cho cửa sổ thời gian; giữ quyền, dữ liệu và timeout. Lần đo cuối: workspace hội đồng 11,195 giây/49 truy vấn; phản biện 16,903 giây/100 truy vấn; chấm hội đồng 17,124 giây/90 truy vấn. Cả ba trả dữ liệu, không còn P2028 trong các lần đo đó. Đây là đo service thực tế, chưa đo HTTP/UI của phiên Khoa đang đăng nhập; thời gian vẫn phụ thuộc DB từ xa. Xem [bằng chứng, bản sửa và 701 test đã đạt](PERFORMANCE-REVIEW.md).

## UC18: danh sách có thể timeout dù chi tiết hiển thị đúng

Quan sát ngày 18/11/2026 qua trình duyệt thật, tài khoản sinh viên của đợt `NGUON80-2026`: trang `/defense/eligibility?termId=…&termStudentId=…` hiển thị chi tiết “Chứng cứ đầy đủ / Khoa đã chốt”, nhưng yêu cầu tải danh sách hiển thị `timeout of 20000ms exceeded`. Ảnh có dữ liệu cá nhân chỉ lưu tại `.cache/source-dataset/ui-check-failure.png` và `ui-student-eligibility.png`.

Đối chiếu implementation: `EligibilityService.list` đọc từng thành viên của đợt rồi kiểm quyền, lọc tìm kiếm và đánh giá chứng cứ trước phân trang. `EligibilityRepository.read` giới hạn transaction 20 giây; HTTP client cũng có thời hạn. Đây là nhận định nguyên nhân cần đo thêm, không phải bằng chứng rằng mọi lần gọi đều lỗi hoặc rằng chỉ tăng timeout sẽ sửa được hiệu năng.

Kết quả kiểm tra chi tiết, quyền và tải PDF không chứng minh toàn màn danh sách đã đạt. `browser-check.cjs --eligibility` ghi riêng `listRendered`, `listTimeoutVisible`, `fullScreenVerified`; báo cáo cũ chưa có các trường này không được suy ra là danh sách đạt. Chưa sửa backend/frontend trong nhiệm vụ nhập dữ liệu.

Lần kiểm tra lại lúc 19:56 ngày 18/11 (giờ Việt Nam) tải được cả danh sách 1 hồ sơ đúng quyền sinh viên và chi tiết đã chốt, không hiện timeout; 0 lỗi JavaScript chưa xử lý. Đây là kết quả của lần chạy lại, không phải bằng chứng lỗi hiệu năng trước đó đã được sửa. Ảnh hiện tại ở `ui-student-eligibility.png`; ảnh lỗi trước đó vẫn giữ tại `ui-check-failure.png`.

Ở viewport 1440 px, ảnh cho thấy đầu tiêu đề/nội dung bên trái bị thanh điều hướng che một phần. Chưa chỉnh bố cục hoặc kiểm tra responsive/accessibility toàn màn trong nhiệm vụ dữ liệu này.

## UC19: đối chiếu toàn đợt chậm

Lần đọc workspace hội đồng chỉ đọc ngày 18/11/2026 mất 199.346 giây cho 64 ứng viên/33 giảng viên, không có blocker cấu hình; lần trước bị lỗi Prisma `P2028` với giới hạn 120 giây. Báo cáo riêng: `.cache/source-dataset/committee-readiness.json`. Số hồ sơ đủ điều kiện trong báo cáo đó là snapshot khi UC18 còn chạy, không phải tổng cuối cùng.

Công cụ nhập dùng Session thật của backend trong transaction của từng lô, tái sử dụng các nguồn không đổi trong chính transaction đó; dữ liệu đang thay đổi, audit và kiểm tra phiên bản vẫn đọc/ghi qua service. Lô hội đồng/phản biện tối đa 15 phút, chấm hội đồng và kết quả tối đa 60 phút; xuất biểu mẫu chia nhóm tối đa 4 bản/transaction, giới hạn 15 phút/nhóm và 5 phút/bước; rollback cả lô khi lỗi, báo cáo chỉ ghi sau commit. Lịch dùng đúng ReadCommitted và mutex của ScheduleRepository/SQL trigger, các lô điểm dùng Serializable. Điều này giúp nhập dữ liệu, chưa sửa thời gian đáp ứng của API/UI phục vụ người dùng.

## UC24: bộ tính điểm cuối chỉ nhận một chữ số thập phân

Ngày 19/11, đọc nguồn điểm trả `UNSUPPORTED_STORAGE_PRECISION`. Implementation hiện có kiểm tra cứng điểm cuối biểu diễn được với một chữ số ở `shared/src/contracts/final-result-calculation.ts`, dù schema hỗ trợ hai chữ số. Người dùng đã duyệt [đề xuất](FINAL-STAGES-REVIEW.md): UC24 riêng NGUON80 đổi làm tròn cuối thành HALF_UP một chữ số, bước 0.1; giữ trung bình thành phần hai chữ số, trọng số 20/20/60 và ngưỡng đạt 5. Không sửa code tính điểm hoặc điểm nguồn. Các đợt khác không được thay policy.

Đã thêm đúng 21 liên kết quyền theo phê duyệt tác động toàn role. Snapshot trước khi cấp gồm 4 tài khoản Khoa, 43 giảng viên và 105 sinh viên; quyền cũng áp dụng cho tài khoản mang role đó về sau. Các giới hạn sở hữu/phân công/grant đợt vẫn được kiểm tra. Cần đăng nhập lại nếu phiên cũ chưa nhận danh sách quyền mới.

Kiểm tra đăng nhập lại bằng mật khẩu Khoa ban đầu không thành công. Đối chiếu chỉ đọc lúc 09:42 ngày 19/11 xác nhận tài khoản vẫn ACTIVE, đã đổi mật khẩu và không còn cờ bắt buộc đổi lần đầu; mật khẩu ban đầu không khớp. Không reset mật khẩu hoặc thử lặp lại thông tin cũ. Chưa kiểm tra HTTP/UI các bước cuối bằng mật khẩu Khoa hiện tại; các kiểm chứng dữ liệu qua service/DB không thay thế kiểm tra đó.

## Các giới hạn còn lại

- Đã chấm 48 phiếu hội đồng trong các phiên tối 18/11/2026 và kiểm chứng lại sáng 19/11. Các phiên đã qua; không mở lại hoặc sửa giờ chấm. Chưa xác minh toàn bộ UI UC19–25, responsive hay accessibility.
- Ba giảng viên thiếu bộ môn vẫn chưa kích hoạt; nguồn danh tính được giữ nguyên.
- Kho tệp tuần/báo cáo cuối nằm tại backend local. Dùng chung DB Supabase chưa làm kho tệp này truy cập được từ backend ở máy khác.
- Backup public và kho tệp đã được sao lưu, thử khôi phục và đối chiếu trong lần dọn dữ liệu cũ tối 19/11. Backup public không bao gồm Supabase Auth. Xem [báo cáo dọn dữ liệu](../qa/cleanup-old-data.md).
