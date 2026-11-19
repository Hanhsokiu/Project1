# Sau triển khai function UC24

**Database repair DEPLOYED VERIFIED:** 27 APPLIED / 0 FAILED. Không đồng nghĩa B9–B10 đã được phát hành hoặc bật ghi trên Render.

## Điều kiện còn thiếu

1. **Backend release:** main GitHub hiện được đối chiếu ở commit `05131282a686eacfe4ff23a24f26a5ac02feb3b9`. Các module defense/grading/report ở main vẫn có service đọc cơ bản; không phải bộ controller/service UC17–UC25 của feature branch. Cần phát hành code đã duyệt theo một yêu cầu riêng. Revision Render đang chạy chưa xác minh được qua dashboard/API.
2. **Chín policy production:** vẫn 0 hàng. Mỗi policy cần termId thật, version/contract, người phê duyệt thật, thời điểm/phạm vi hiệu lực và giá trị được xác nhận. Không lấy approvedBy/approvedAt hoặc giá trị TEST làm cấu hình chính thức.
3. **RBAC/scope:** 124 definitions/166 grants giữ nguyên. Bốn quyền đọc FACULTY trước đây vẫn giữ. Chưa tự mở quyền confirm/finalize/publish/export/download hoặc xem điểm cho toàn bộ role. Cần người dùng thật, term/bộ môn và phân công GVHD/GVPB/hội đồng cụ thể trước khi mở các capability nhạy cảm.
4. **Storage:** xác minh Render persistent disk/mount/backup hoặc adapter lưu trữ bền vững, quyền tải PDF và export. 22 FILE_ASSET có trong backup metadata/data nhưng byte file ngoài PostgreSQL không nằm trong pg_dump. Không coi DB backup là backup PDF.
5. **Flags và smoke:** không thay đổi flag nào. Backend `.env` không khai báo UC17–UC25_WRITES_ENABLED; source feature branch mặc định false. Trạng thái env trên Render chưa xác minh. Chỉ bật sau khi policy/RBAC/storage và scope vận hành sẵn sàng. Cần URL backend, quyền xem log và phiên nghiệp vụ được phép để smoke HTTP; chưa có các đầu vào này nên HTTP/log Render NOT VERIFIED.
6. **Advisory lock:** postflight ghi nhận PID 2061694 giữ 72707369, idle/không transaction. Không ngắt hoặc tự unlock. Kiểm tra lại và xử lý bởi đúng người có quyền trước rollout tiếp theo.

## Đầu vào cấu hình production riêng

Không có gói SQL tự tạo APPROVED hoặc cấp quyền trong thư mục này. Giá trị cần điền tách khỏi TEST:

| Policy | Giá trị cần chốt cho đợt thật |
|---|---|
| UC17 | Bước điểm/rubric GVHD, giới hạn PDF, thay PDF sau quyết định, quyền xem từng loại nội dung |
| UC18 | Phase, quy tắc tiến độ và nguồn minh chứng học vụ/người chứng thực |
| UC19 | Thành phần 3–5, vai trò, phạm vi/chức danh thành viên và sức chứa |
| UC20 | Số phản biện, tải, phạm vi bộ môn, vai trò kép; không bỏ kiểm tra xung đột GVHD |
| UC21 | Ngày/khung sáng chiều/phòng, thời lượng và lịch công bố, quyền xem lịch |
| UC22 | Rubric/bước điểm GVPB, nhận xét bắt buộc, nháp và cửa sổ theo phiên |
| UC23 | Rubric/rounding, vai trò chấm, hiệu lực và chứng cứ bảo vệ |
| UC24 | Công thức/trọng số, nguồn GVHD, ngưỡng, vai trò xác nhận, separation, cửa sổ chốt/công bố và quyền SV |
| UC25 | Mẫu/version/hiệu lực được duyệt, nội dung được xuất, chữ ký UNSIGNED, retention và thống kê |

Contracts hiện hành ở `shared/src/contracts/`; danh sách trường cụ thể tại `../uc24-25-rbac/POLICY-DECISIONS.md`. Những quyết định chưa có dữ liệu thật tiếp tục BLOCKED, không tự suy ra từ bộ nghiệm thu.

## Phục hồi nếu có sự cố

Không chạy rollback hoặc restore production tự động. Dừng riêng luồng ghi UC24 nếu cần, xác minh phiên migration/điểm phát sinh, chọn sửa forward hoặc phục hồi function từ bản trước với phê duyệt sự cố riêng. `rollback.sql` khôi phục lỗi cũ, không phải phương án vận hành bình thường. Full logical backup mã hóa đã restore thành công ở PG17; full database restore cần cửa sổ dừng ghi, đối soát các thay đổi sau backup và xử lý thành phần Supabase-managed qua quy trình riêng. Không dùng restore toàn DB để sửa một function khi chưa đánh giá mất dữ liệu mới. Không có số phút downtime được cam kết cho production vì chưa diễn tập một cửa sổ dừng dịch vụ production.
