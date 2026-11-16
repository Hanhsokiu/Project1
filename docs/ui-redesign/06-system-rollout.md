# Triển khai giao diện UTC toàn hệ thống

Ngày 15/11/2026. Người dùng đã yêu cầu mở rộng phong cách mẫu UTC mới sang toàn hệ thống.
Yêu cầu này cho phép mở rộng phạm vi pilot đã giới hạn trong các kế hoạch cũ.

Kết quả triển khai, ảnh thật và giới hạn kiểm chứng: [báo cáo bàn giao](evidence/system-rollout/README.md).

## Các phần nghiệm thu

1. **Nền tảng**: đưa palette UTC thành token chung, đồng bộ Tailwind; dùng logo/shell UTC cho mọi
   route thực thi qua WorkspaceLayout. Giữ nguyên router, menu, RBAC và nguồn dữ liệu.
2. **Component kit**: header, card, button, input, badge, table, filter, modal, toast, loading/empty/error;
   giữ callback/validation/action/state. Kiểm keyboard, focus, reduced motion và responsive.
3. **Các nhóm màn**: dashboard, đăng nhập/hồ sơ, danh mục/import, kỳ học, đăng ký/phân công,
   đề cương/xét duyệt, hướng dẫn/báo cáo và bảo vệ/chấm điểm. Đồng bộ stylesheet riêng của workflow/import;
   không thêm chức năng hoặc trạng thái chỉ để giống ảnh.
4. **Kiểm chứng**: type-check, lint, toàn bộ frontend unit tests, build; browser fixture hồi quy và
   Playwright MCP với tài khoản/API thật khả dụng. Kiểm 1440/1024/768/390/320px, ảnh đại diện,
   inventory route và ghi rõ các màn API/dữ liệu chặn, không khẳng định đã quan sát nội dung chưa tải.

## Giới hạn

- Các route đều nhận thiết kế từ shell/token/kit hoặc stylesheet feature hiện có. Giữ layout phù hợp
  từng tác vụ; không chuyển bảng/hồ sơ thành bản sao form đăng ký.
- Chỉ sửa frontend trình bày và test/doc liên quan. Không sửa backend, database, API contracts,
  RBAC, thuật toán, schema validation hay luồng trạng thái.
- Không ghi dữ liệu thật để tạo screenshot. Fixture chỉ ở test cô lập và ghi rõ nguồn bằng chứng.
- Giữ mọi thay đổi có sẵn. Hash baseline trước triển khai nằm trong `evidence/system-rollout/`.
- Không commit/push/merge. Kết quả và giới hạn nghiệm thu bổ sung ở báo cáo cùng thư mục bằng chứng.
