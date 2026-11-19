# Thay đổi cần duyệt để hoàn tất kết quả và biểu mẫu

Đối chiếu Supabase lúc 09:26 ngày 19/11/2026 (giờ Việt Nam). Đây là đề xuất, chưa cấp quyền hoặc thay cấu hình làm tròn. Đích: `zlsygwjskvxgtzdjhvzt`; dữ liệu thao tác tiếp theo chỉ thuộc đợt `NGUON80-2026`.

## 1. Quyền còn thiếu

`ROLE_PERMISSION` hiện áp dụng toàn role. Cấp các quyền dưới đây sẽ mở thêm khả năng cho **4 tài khoản Khoa, 43 giảng viên và 105 sinh viên** đang mang role tương ứng, gồm tài khoản ngoài NGUON80 và tài khoản được gán role này về sau. Các điều kiện sở hữu, phân công hội đồng, grant đợt/bộ môn và cửa sổ thao tác vẫn do service kiểm tra. Không thể giới hạn riêng action mới cho NGUON80 bằng schema hiện có.

| Role | Resource | Action cần thêm |
|---|---|---|
| FACULTY | defense-result | components-read, finalize, publish |
| FACULTY | defense-report | preview, export, download, list-export, components-export, final-export, comments-export, minutes-export, dossier-export, pii-export |
| FACULTY | defense-confirmation | comment-read |
| FACULTY | defense-reviewer-grade | comment-read |
| FACULTY | dossier | export |
| LECTURER | defense-result | read, confirm |
| STUDENT | defense-result | read, read-own, final-read |

Tổng cộng **21 liên kết role–permission** còn thiếu. Tất cả permission đã tồn tại. Không thêm role, không cấp quyền admin, không cấp quyền chấm thay người khác. Quyền xuất bao gồm danh tính, điểm và nhận xét trong phạm vi mà service cho phép; không chỉ là quyền nhìn thấy nút.

Trước khi thực thi phải đối chiếu lại snapshot, backup hiện hành, lưu danh sách liên kết mới và audit; chỉ thêm đúng các liên kết được duyệt. Không tự thu hồi quyền sau khi nhập vì sẽ làm người dùng không xem/tải được phần đã tạo. Nếu không duyệt tác động toàn role, cần một nhiệm vụ riêng triển khai quyền theo user/action/đợt; không giả quyền trong runner.

## 2. Độ chính xác điểm cuối

`shared/src/contracts/final-result-calculation.ts` hiện kiểm tra điểm cuối lưu được với **một chữ số thập phân**, dù schema và policy đã hỗ trợ hai chữ số. Với một số bộ điểm hiện có, service trả `UNSUPPORTED_STORAGE_PRECISION`; chưa tạo kết quả nào.

Đề xuất cấu hình riêng UC24 của NGUON80: đổi `finalRounding.decimalPlaces` từ 2 thành **1**, `finalStep` từ `0.01` thành **0.1**, `storageDecimalPlaces` từ 2 thành **1**. Giữ HALF_UP, trọng số 20% GVHD + 20% phản biện + 60% hội đồng, ngưỡng đạt 5 và rubric 30/30/20/20. Trung bình thành phần vẫn làm tròn hai chữ số như trước. Không sửa điểm nguồn hoặc code tính điểm.

Phiên bản policy mới phải có audit trước/sau và cập nhật hash bộ policy; các policy khác giữ nguyên. Ví dụ điểm cuối trước làm tròn 7.84 sẽ hiển thị 7.8. Không giả thời gian hoặc sửa lịch đã công bố.

## 3. Kết quả dự kiến sau khi được duyệt

Qua service thật: chủ tịch/thư ký xác nhận 8 hồ sơ, Khoa chốt 8 kết quả và công bố 4 kết quả; tạo/tải/kiểm hash 15 biểu mẫu PDF/XLSX có dấu UNSIGNED. Kiểm chứng độc lập quan hệ, audit và công thức trước khi cập nhật bảng tra cứu. Đây là dữ liệu tổng hợp phục vụ test, không phải kết quả học vụ thật.

Giới hạn quyền tự động sửa đến từ [AGENTS.md](../../AGENTS.md): “Không tự ý sửa backend, Prisma schema/migrations, API contracts ... hoặc RBAC”. Việc người dùng yêu cầu nhập dữ liệu chưa phải phê duyệt tác động toàn role nêu trên.
