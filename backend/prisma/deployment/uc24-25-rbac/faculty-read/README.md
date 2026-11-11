> Current release: production is 27 APPLIED / 0 FAILED, 124 permission definitions, 166 role grants and zero UC17-UC25 policies. Counts, PIDs and commands below document historical stages. Do not repeat applied SQL or migrate resolve. See [current main release handoff](../../../../../docs/implementation/B9-B10-MAIN-RELEASE.md). Live JSON evidence is retained locally outside the release commit.

# Đúng bốn quyền đọc FACULTY

**Đã áp production một lượt theo phê duyệt trực tiếp:** `production-result.json` ghi PASS, grants 162 → 166, FACULTY 63 → 67, role khác/permission/history không đổi. History hiện 26 APPLIED/0 FAILED. Khóa sau resolve đã tự hết; không terminate session. Gói grant này có provenance riêng và chưa là migration Prisma thứ 27. Không chạy lại gói, không chạy rollback production; script có intent guard chống retry mù.

Các cặp được phép xem xét cấp: `defense-result:read`, `defense-report:read`, `defense-report:templates-read`, `defense-report:statistics`. Không gán quyền xem điểm thành phần, nhận xét, lịch sử, preview, confirm/finalize/publish/export/download hoặc quyền role khác.

`preflight.sql`, `migration.sql`, `postflight.sql`, `rollback.sql` và `SHA256.json` được tạo bởi `prepare-faculty-read-grants.cjs`. Migration là transaction idempotent; lưu grants có trước và đúng các cặp nó tạo trong schema provenance `datn_rbac_faculty_read`, thu hồi ACL PUBLIC. Postflight so sánh toàn bộ grant với snapshot + cặp mới. Rollback chỉ xóa cặp do gói tạo, bảo toàn cặp có trước, từ chối nếu có sửa grant đồng thời hoặc đổi identity role/permission; không cascade. Rollback production cần phê duyệt xử lý sự cố riêng.

`pg17-result.json`: kiểm thử thực tế cấp bốn quyền, chạy lặp, rollback đầy đủ, chặn rollback khi role khác được sửa và bảo toàn quyền có trước. Chỉ chạy container local có label datn.rbac26, không dùng production.

`../faculty-read-service-tests.json` chứa kết quả service test; kiểm tra đúng bộ quyền, giấu điểm chưa công bố/nhận xét/history, scope term/bộ môn, không ghép quyền ADMIN. ReportReader đã bổ sung kiểm tra committeeId theo bộ môn cho options/templates/statistics. Source/build này chưa được đưa lên Render.

Trước khi cấp production: phải có 26 APPLIED/0 FAILED và checksum chính xác, đủ 124 định nghĩa/162 grants/27 provenance, không có Prisma advisory lock hoặc RBAC writer, backup hợp lệ, test service và SQL PASS, đúng bốn cặp còn thiếu cho FACULTY. Nếu còn khóa mới sau resolve, dừng trước mọi grant; không terminate, không tắt locking. Sau khi cấp hợp lệ kỳ vọng 166 grants, bốn cặp mới đều FACULTY; mọi permission/role/history và grant khác giữ nguyên. Các policy vẫn chưa được phép tự tạo.
