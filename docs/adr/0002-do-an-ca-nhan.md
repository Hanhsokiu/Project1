# ADR-0002: Đồ Án Tốt Nghiệp Thực Hiện Cá Nhân (1 Sinh Viên / 1 Đề Tài)

## Trạng thái
Đã quyết định (Thay thế phương án ghép nhóm)

## Bối cảnh
Theo quy định thực tế tại Khoa Công nghệ Thông tin - Trường ĐH Giao thông vận tải, mỗi sinh viên làm một đề tài đồ án tốt nghiệp độc lập, có mã sinh viên, đề cương, quá trình hướng dẫn và điểm bảo vệ riêng biệt.

## Quyết định
1. Không ghép nhóm làm đồ án tốt nghiệp: mỗi sinh viên là một thực thể độc lập (`1 Sinh viên <-> 1 Đề cương/Đề tài`).
2. Loại bỏ bảng `PROJECT_GROUP` khỏi mô hình CSDL và luồng nghiệp vụ.
3. Trong biểu mẫu đề cương, báo cáo tuần, và bảng điểm bảo vệ, mỗi sinh viên có một hồ sơ riêng với đầy đủ điểm quá trình (GVHD, GVPB) và điểm hội đồng.

## Hệ quả
- Sinh viên không cần qua bước ghép nhóm.
- Đơn giản hóa mô hình quan hệ CSDL và luồng duyệt đề cương.
- Phân công GVHD và Hội đồng bảo vệ đánh giá chính xác từng cá nhân.
