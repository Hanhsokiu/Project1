# Độ bao phủ giao diện UTC theo router thực thi

59 route trong manifest + login, forbidden và fallback = 62 đích route.
Không đổi permission/menu/data scope. Bảng này xác nhận lớp trình bày nhận được và bằng chứng kiểm thử, không chứng nhận tích hợp mọi trạng thái nghiệp vụ.

| Route | Màn hình | Vai trò / permission của manifest | Lớp giao diện | Kiểm chứng vòng này |
|---|---|---|---|---|
| `/` | Tổng quan | ADMIN, FACULTY, LECTURER, STUDENT, COMMITTEE | UTC shell + kit | API thật SV/GV/Khoa × 5 viewport; ADMIN/COMMITTEE bằng fixture |
| `/notifications` | Thông báo | ADMIN, FACULTY, LECTURER, STUDENT, COMMITTEE | UTC shell + kit | Browser fixture 5 chiều rộng |
| `/admin/accounts` | Tài khoản | ADMIN | UTC shell + kit | Browser fixture 5 chiều rộng |
| `/admin/roles` | Vai trò & quyền | ADMIN | UTC shell + kit | Browser fixture 5 chiều rộng |
| `/admin/audit-logs` | Nhật ký hoạt động | ADMIN, FACULTY / `audit:read` | UTC shell + kit | Browser fixture 5 chiều rộng |
| `/catalog/students` | Sinh viên | ADMIN, FACULTY | UTC shell + kit | Browser fixture 5 chiều rộng |
| `/catalog/lecturers` | Giảng viên | ADMIN, FACULTY, LECTURER | UTC shell + kit | Browser fixture 5 chiều rộng |
| `/catalog/reference` | Danh mục đào tạo | ADMIN, FACULTY | UTC shell + kit | Browser fixture 5 chiều rộng |
| `/catalog/import` | Import dữ liệu | ADMIN, FACULTY | UTC shell + kit | Browser fixture 5 chiều rộng |
| `/terms` | Kỳ học & đợt đồ án | ADMIN, FACULTY | UTC shell + kit | API thật + ảnh 5 viewport |
| `/terms/:id` | Chi tiết đợt | ADMIN, FACULTY | UTC shell + kit | Browser fixture 5 chiều rộng |
| `/terms/:id/phases` | Kế hoạch giai đoạn | ADMIN, FACULTY | UTC shell + kit | Browser fixture 5 chiều rộng |
| `/terms/:id/parameters` | Tham số đợt | ADMIN, FACULTY | UTC shell + kit | Browser fixture 5 chiều rộng |
| `/terms/:id/roster` | Danh sách tham gia | ADMIN, FACULTY | UTC shell + kit | Browser fixture 5 chiều rộng |
| `/registration` | Đăng ký nguyện vọng | STUDENT | UTC shell + kit | API thật + ảnh 5 viewport |
| `/registration/assignment` | Phân công GVHD | ADMIN, FACULTY | UTC shell + kit | Browser fixture 5 chiều rộng |
| `/registration/list` | Danh sách đăng ký | ADMIN, FACULTY | UTC shell + kit | Browser fixture 5 chiều rộng |
| `/registration/manual` | Điều chỉnh phân công | ADMIN, FACULTY | UTC shell + kit | Browser fixture 5 chiều rộng |
| `/registration/result` | Kết quả phân công | ADMIN, FACULTY, LECTURER, STUDENT | UTC shell + kit | Browser fixture 5 chiều rộng |
| `/topic/my` | Thống nhất đề tài | ADMIN, FACULTY, LECTURER, STUDENT | UTC shell + kit | Browser fixture 5 chiều rộng |
| `/topic/draft` | Soạn đề cương | STUDENT, LECTURER | UTC shell + kit | Browser fixture 5 chiều rộng |
| `/topic/overview` | Hồ sơ đề tài | ADMIN, FACULTY, LECTURER, STUDENT, COMMITTEE | UTC shell + kit | Browser fixture 5 chiều rộng |
| `/report/export` | Biểu mẫu & xuất dữ liệu | ADMIN, FACULTY, LECTURER, STUDENT, COMMITTEE | UTC shell + kit | Browser fixture 5 chiều rộng |
| `/profile` | Thông tin cá nhân | ADMIN, FACULTY, LECTURER, STUDENT, COMMITTEE | UTC shell + kit | Browser fixture 5 chiều rộng |
| `/change-password` | Đổi mật khẩu | ADMIN, FACULTY, LECTURER, STUDENT, COMMITTEE | UTC shell + kit | Token/kit/shell từ code; nội dung API chưa nghiệm thu đầy đủ |
| `/topic/review-groups` | Nhóm duyệt đề cương | FACULTY, LECTURER / `review-group:read` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/topic/review-groups/new` | Tạo nhóm duyệt | FACULTY / `review-group:manage` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/topic/review-groups/:id/edit` | Sửa nhóm duyệt | FACULTY / `review-group:manage` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/topic/review-groups/:id` | Chi tiết nhóm duyệt | FACULTY, LECTURER / `review-group:read` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/topic/reviews` | Xét duyệt đề cương | FACULTY, LECTURER, STUDENT / `proposal:read` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/topic/reviews/:id` | Chi tiết xét duyệt | FACULTY, LECTURER, STUDENT / `proposal:read` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/topic/review-assignments/:proposalId` | Phân công xét duyệt | FACULTY / `proposal:assign` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/topic/proposal` | Đề cương & phiên bản | FACULTY, LECTURER, STUDENT / `proposal:read` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/topic/proposal/:proposalId` | Phiên bản đề cương | FACULTY, LECTURER, STUDENT / `proposal:read` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/topic/proposal/:proposalId/versions/:versionId` | Lịch sử đề cương | FACULTY, LECTURER, STUDENT / `proposal:read` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/topic/dossier` | Chốt đề cương & bản giấy | FACULTY, LECTURER, STUDENT / `proposal:read` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/topic/dossier/:proposalId` | Chi tiết hồ sơ | FACULTY, LECTURER, STUDENT / `proposal:read` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/guidance/plan` | Kế hoạch hướng dẫn | FACULTY, LECTURER, STUDENT / `guidance:read` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/guidance/plan/:proposalId` | Chi tiết kế hoạch | FACULTY, LECTURER, STUDENT / `guidance:read` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/guidance/plan/:proposalId/tasks/new` | Giao nhiệm vụ | LECTURER / `task:manage` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/guidance/tasks` | Nhiệm vụ & tiến độ | FACULTY, LECTURER, STUDENT / `guidance:read` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/guidance/tasks/:id` | Chi tiết nhiệm vụ | FACULTY, LECTURER, STUDENT / `guidance:read` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/guidance/tasks/:id/submissions` | Nộp báo cáo | FACULTY, LECTURER, STUDENT / `submission:read` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/guidance/weeks` | Kế hoạch và báo cáo tuần | FACULTY, LECTURER, STUDENT / `guidance:read` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/guidance/review` | Nhận xét báo cáo | LECTURER / `task:review` | UTC shell + workflow/kit | API thật + ảnh 5 viewport |
| `/guidance/review/:submissionId` | Chi tiết nhận xét | FACULTY, LECTURER, STUDENT / `submission:read` | UTC shell + workflow/kit | API thật + ảnh 5 viewport |
| `/guidance/progress` | Theo dõi tiến độ | FACULTY / `guidance:monitor` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/guidance/meetings` | Nhật ký hướng dẫn | FACULTY, LECTURER, STUDENT / `guidance:read` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/guidance/notifications` | Thông báo hướng dẫn | FACULTY, LECTURER, STUDENT / `guidance:read` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/guidance/defense-confirm` | Xác nhận bảo vệ | FACULTY, LECTURER, STUDENT / `defense-confirmation:read` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/guidance/final-report` | Báo cáo cuối kỳ | FACULTY, LECTURER, STUDENT / `final-report:read` | UTC shell + workflow/kit | Browser workflow fixture theo nhóm; chi tiết trong logs |
| `/defense/eligibility` | Xét điều kiện bảo vệ | FACULTY, LECTURER, STUDENT / `defense-eligibility:read` | UTC shell + kit | API thật bị chặn bởi timeout snapshot; chưa nghiệm thu nội dung nghiệp vụ |
| `/defense/committees` | Hội đồng bảo vệ | FACULTY / `defense-committee:read` | UTC shell + kit | Token/kit/shell từ code; nội dung API chưa nghiệm thu đầy đủ |
| `/defense/reviewers` | Phân công phản biện | FACULTY / `defense-reviewer:read` | UTC shell + kit | Token/kit/shell từ code; nội dung API chưa nghiệm thu đầy đủ |
| `/defense/schedule` | Lịch bảo vệ | FACULTY, STUDENT, LECTURER / `defense-schedule:read` | UTC shell + kit | Token/kit/shell từ code; nội dung API chưa nghiệm thu đầy đủ |
| `/defense/reviewer-grading` | Chấm điểm phản biện | LECTURER, FACULTY / `defense-reviewer-grade:read` | UTC shell + kit | Token/kit/shell từ code; nội dung API chưa nghiệm thu đầy đủ |
| `/defense/committee-grading` | Chấm điểm hội đồng | LECTURER, FACULTY / `defense-committee-grade:read` | UTC shell + kit | Token/kit/shell từ code; nội dung API chưa nghiệm thu đầy đủ |
| `/defense/results` | Kết quả bảo vệ | FACULTY, LECTURER, STUDENT / `defense-result:read` | UTC shell + kit | Token/kit/shell từ code; nội dung API chưa nghiệm thu đầy đủ |
| `/defense/reports` | Báo cáo & biểu mẫu bảo vệ | FACULTY, LECTURER / `defense-report:read` | UTC shell + kit | Token/kit/shell từ code; nội dung API chưa nghiệm thu đầy đủ |
| `/login` | Đăng nhập | Ẩn danh / redirect phiên theo code cũ | UTC auth + token/kit | API thật + ảnh 5 viewport |
| `/forbidden` | Không đủ quyền | Guard hiện có | UTC shell + Empty | Code; không thay guard |
| `*` | Không tìm thấy | Fallback router | UTC shell + Empty | Code; không thay routing |
