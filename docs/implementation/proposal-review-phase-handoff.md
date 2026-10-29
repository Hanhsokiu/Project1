# Lịch xét duyệt và bàn giao đề cương — 29/10/2026

## Hành vi của code

- Giữ sáu giai đoạn chính và lịch mặc định cũ. API chấp nhận thêm một giai đoạn `PROPOSAL_REVIEW`; giao diện Kế hoạch giai đoạn có nút **Thêm xét duyệt đề cương** nếu chưa có.
- Lịch xét duyệt độc lập với lịch soạn đề cương. Có thể xét các hồ sơ đã nộp trong khi sinh viên khác vẫn soạn; xét duyệt bắt đầu không sớm hơn giai đoạn đề cương và kết thúc không muộn hơn lúc bắt đầu hướng dẫn.
- Khi lưu lịch, liên kết `PROPOSAL` → `PROPOSAL_EDIT`, `PROPOSAL_REVIEW` → `PROPOSAL_REVIEW` trong cùng transaction. Từ chối nếu giai đoạn đã được liên kết sang workflow khác. Không đổi schema database.
- Client cũ gửi sáu giai đoạn vẫn được hỗ trợ. Nếu đợt đã có lịch xét duyệt thì giữ lại lịch đó và kiểm tra tính hợp lệ với kế hoạch mới. Mapper không đổi mã WEEKLY/FINAL/DEFENSE khi chèn lịch xét duyệt, kể cả dữ liệu cũ chưa có code.

## Cập nhật Supabase đã thực hiện

Đợt `a18db323-3a67-46ce-812b-e2baf495c128` — **Đồ án tốt nghiệp 2026**:

- Thêm giai đoạn **Xét duyệt đề cương**, trùng khoảng thời gian `PROPOSAL` theo lựa chọn của người dùng: **10:32 ngày 29/10/2026 đến 01:23 ngày 11/11/2026**, giờ Việt Nam. Không khóa; thời điểm kết thúc là mốc ngừng nhận thao tác.
- Thêm hai liên kết phase cho soạn và xét duyệt. Không chỉnh giờ, mã, tên hay khóa của sáu giai đoạn cũ.
- Ánh xạ đúng hướng nghiên cứu đang được đề cương sử dụng sang bộ môn **Công nghệ phần mềm (CNPM)**; đối chiếu với hướng đăng ký và bộ môn GVHD của phân công FINALIZED. Không ánh xạ hàng loạt các hướng khác.
- Bàn giao đề cương `ada961f2-7afb-4a30-a2a9-720257abc2ff` — **Kiểm thử hệ thống đồ án**, sinh viên `221000009`, qua API `POST /topics/:id/prepare-workflow` bằng phiên sinh viên hiện có. Giữ nguyên phiên bản v1/v2, tạo bản nháp v3 và ownership. Trạng thái hiện hành chuyển từ SUBMITTED của bước 3 sang DRAFT của luồng phiên bản theo đúng service có sẵn; audit ghi trạng thái trước bàn giao.
- Không tạo phiên đăng nhập, không tự nộp bản nháp, không tạo vòng duyệt hoặc phân công thử. Quyền phạm vi khoa và nhóm đã tạo được giữ nguyên.

## Kết quả kiểm tra

- Backend build và frontend build/type-check thành công.
- 85 unit tests backend về lịch đợt, nhóm, xét duyệt, phiên bản; 25 unit tests frontend về payload lịch và tương thích bước 1–3: PASS.
- Đối chiếu chỉ đọc trước/sau: sáu giai đoạn gốc, đợt, roster, đăng ký, kế hoạch/phân công GVHD, đề tài, nhóm và nội dung hai phiên bản gốc không thay đổi.
- API khoa trả 200, có lịch xét duyệt, cửa sổ xét duyệt đang mở và thấy đề cương. Giao diện quản lý lịch hiển thị bảy giai đoạn.
- API sinh viên trả 200, mở được bản nháp v3 để chỉnh sửa. Hai giao diện không có lỗi JavaScript hoặc request API thất bại trong lượt kiểm tra.
- Snapshot và bằng chứng nằm trong `.cache/shared-dev/proposal-review-*` và `.cache/shared-dev/proposal-handoff-*`, được Git bỏ qua; đây là bản chụp phạm vi dữ liệu liên quan, không phải backup toàn bộ database.

## Thao tác tiếp theo

1. Sinh viên `221000009` mở **Đề cương & phiên bản** → **Kiểm thử hệ thống đồ án**. Bổ sung **Nội dung chính**, ngày bắt đầu/kết thúc thực hiện và các mốc kế hoạch kèm sản phẩm; kiểm tra các nội dung đã chuyển từ bản cũ. Không tự suy các thông tin học thuật còn thiếu.
2. Lưu nháp và **Gửi xét duyệt**. Nếu hệ thống yêu cầu xác nhận lại đề tài thì GVHD thực hiện xác nhận theo luồng hiện có.
3. Khoa `giaovu` mở **Phân công xét duyệt**, chọn hồ sơ đã gửi và nhóm đã tạo, rồi xác nhận phân công. Chỉ phiên bản đã nộp và niêm phong (`SEALED`) được giao duyệt.

Hiện hồ sơ còn `SUBMITTED_VERSION_NOT_READY` vì v3 chưa được sinh viên hoàn thiện và gửi. Đây là điều kiện nghiệp vụ còn lại; cấu hình phase, ownership và hướng nghiên cứu → bộ môn đã sẵn sàng. Không chạy seed hoặc gán trạng thái SEALED/APPROVED bằng SQL để bỏ qua điều kiện này.
