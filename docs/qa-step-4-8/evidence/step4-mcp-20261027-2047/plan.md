# Kế hoạch kiểm thử live bước 4

Lập trước khi chạy các ca bên dưới, ngày 27/10/2026, Asia/Ho_Chi_Minh. Không sửa source, không ghi nghiệp vụ, không mock. Đăng nhập đang chờ xác nhận vì tạo phiên/audit và cập nhật lastLoginAt. Không có quyền seed hoặc tạo môi trường test mới.

Nguồn: S1 = docs/spec/dac-ta-use-case.md (Bước 4/UC13); S2 = docs/implementation/01-business-decisions-and-contract.md (D03/D04/D05/D13, §3.2, §5.1); S3 = docs/implementation/04-test-plan.md. Báo cáo cũ không phải bằng chứng lần chạy này.

| ID | Quy tắc/nguồn | Vai trò và điều kiện | Thao tác | Expected |
|---|---|---|---|---|
| E01 | MCP thực sự điều khiển browser | Anonymous, Vite chạy | Mở login, click hiện/ẩn mật khẩu | Trang thật mở được; input type đổi và khôi phục |
| A01 | Auth bắt buộc, S2 §5.1 | Anonymous | Mở URL danh sách nhóm trực tiếp | Chuyển login, không lộ nhóm |
| A02 | Auth bắt buộc, S2 §5.1 | Anonymous | GET danh sách đợt/options/list/detail canonical | Từng endpoint trả 401, không có dữ liệu nhóm |
| A03 | Auth bắt buộc, S2 §5.1 | Anonymous | Mở URL tạo nhóm trực tiếp | Không có form quản lý khả dụng |
| A04 | Auth bắt buộc, S2 §5.1 | Anonymous | Mở URL chi tiết trực tiếp | Không lộ chi tiết nhóm |
| G01 | FACULTY+permission+grant, S2 D03/D13 | giaovu được phép login | Vào sidebar nhóm và URL trực tiếp | Cả hai tới cùng trang, đúng scope |
| G02 | Scope đúng term, S2 D03 | giaovu, demo term | Đọc list, detail, options và auth context | UI đối chiếu response đúng term/bộ môn/quyền |
| G03 | Không lẫn term, S2 D03 | giaovu có 2 term | Đổi demo/đợt cũ/đổi lại | Nhóm, filters, thành viên không bị giữ sai term |
| G04 | Filter/pagination, S3 | giaovu, dữ liệu thật | Tìm tên có/không khớp, đổi bộ môn, xóa filter | Query, tổng số, rows, empty nhất quán |
| G05 | Chi tiết/thành viên, S3 | giaovu, nhóm có dữ liệu | Mở detail, đọc bảng và reload | Số lượng/thông tin khớp response |
| G06 | Roster hợp lệ, S3 | giaovu có options | Mở form chưa lưu, tìm thành viên, đọc options | Candidate đúng term và eligibility; không tự cấm khác bộ môn |
| G07 | Chuẩn bị nhóm, S2 §3.2 | giaovu, term hợp lệ | Mở form chưa lưu; đối chiếu status và preconditions | Không tự đòi submitted proposal/FINALIZED/phase đang mở |
| G08 | Hủy không ghi, S3 | giaovu, form | Thay draft trong form rồi hủy | Không phát sinh mutation, dữ liệu giữ nguyên |
| G09 | Accessibility, S3 | giaovu, desktop | Tab/Shift+Tab/Escape, labels và dialog | Focus/nhãn/thao tác rõ ràng, không mắc kẹt |
| G10 | Viewport hẹp, S3 | giaovu, 390px | Mở list/detail/form chưa lưu | Có thể đọc và thao tác điều hướng |
| G11 | D05/S3 | giaovu, detail/form | Đọc deadline/fields | Không role trưởng nhóm/quorum/session; nếu deadline hiện phải từ phase |
| P01 | Lecturer read membership, S2 D04/D13 | lecturer là member | Vào list/detail nhóm mình | Đọc đúng nhóm, không có quyền quản lý tự động |
| P02 | Scope lecturer, S2 D04/D13 | lecturer không là member | GET nhóm ngoài membership đã biết | 404/403 theo scope/action; không xuất nội dung ngoài scope |
| P03 | Student deny, S2 D13 | STUDENT | Mở URL nhóm và GET list | UI deny và server deny riêng, không chỉ ẩn menu |
| P04 | Admin không bypass, S2 D13 | ADMIN-only | Mở URL nhóm và GET list | Không tự có quyền học thuật |
| P05 | COMMITTEE không tự là reviewer, S2 D13 | COMMITTEE-only | Mở URL/GET list | Membership vẫn bắt buộc |
| P06 | Grant giới hạn, S2 D03 | FACULTY thiếu action/ngoài grant | Đọc tài nguyên theo scope test được phép | 403 thiếu action, 404 ngoài scope |
| W01 | Validation, S3 | Môi trường riêng được phép ghi | Tạo với tên trống/space/trùng đúng scope/unknown fields | Reject đúng contract, không ghi dở |
| W02 | Roster, S2 D04/S3 | Môi trường riêng được phép ghi | Tạo với duplicate/unknown/cross-term/inactive member | Reject từng nhánh, không tạo nhóm |
| W03 | Nhiều nhóm/membership, S2 D04 | Môi trường riêng được phép ghi | Tạo nhiều nhóm cùng bộ môn/GV nhiều nhóm | Thành công khi đủ điều kiện; reload xác nhận |
| W04 | Update, S3 | Môi trường riêng được phép ghi | Sửa tên/membership có reason; thử đổi term/department | Revision tăng; trường bất biến bị reject |
| W05 | CAS/idempotency, S2 §5.1/S3 | Môi trường riêng được phép ghi | Hai tab revision cũ; retry cùng/khác payload | Không lost update/trùng history, conflict đúng contract |
| W06 | Review lock, S3 | Môi trường riêng có ASSIGNED/IN_REVIEW/legacy | Thử sửa membership | Bị chặn từng trạng thái |
| W07 | Archive, S3 | Môi trường riêng có/không review | Thử archive, reload hoạt động/lịch sử | Có review bị chặn; soft archive không cascade |
| W08 | Term states, S2 §3.2 | Môi trường riêng đủ trạng thái | Thử mutation ở trạng thái cho phép/cấm | DRAFT/CLOSED_REGISTRATION/IN_PROGRESS theo contract; trạng thái cấm không ghi |
| W09 | Atomicity/audit, S3 | Môi trường riêng và bằng chứng DB read-only | Đối chiếu group/member/history/audit sau success/failure | Cùng transaction, không actor giả hoặc mất lịch sử |
| Q01 | Transport, yêu cầu hiện tại | Mọi ca thực thi | Thu pageerror/console/requestfailed/4xx/5xx | Phân loại lỗi thực tế và response deny kỳ vọng |

Các W* mặc định NOT RUN theo giới hạn ghi hiện tại. Mọi ca còn lại cần Actual/Status/Evidence trong report; không dùng báo cáo lịch sử để lấp phần chưa chạy. Không coi ẩn nút là PASS phân quyền backend.
