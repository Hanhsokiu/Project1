# Hoàn thiện luồng 10 bước

Yêu cầu tiếp theo của người dùng ngày 16/11/2026 là hoàn thiện các phần bị chặn, gồm sửa implementation cần thiết và kiểm chứng trên TEST riêng. Không triển khai migration lên database dùng chung; không đổi quy tắc nghiệp vụ/RBAC; giữ thay đổi UI có sẵn.

1. Sửa đọc lặp của producer UC19–21 bằng cache snapshot trong transaction, khóa theo producer/actor/term. Command tự thay dữ liệu vẫn đọc fresh. Nghiệm thu: regression quyền/provenance và 60 hồ sơ xếp lịch không timeout.
2. Migration mới mở rộng precision, đồng bộ Prisma/capability checks/validator/contracts; không sửa migration đã chạy. Nghiệm thu: round-trip 8.25/biên 0/5/10, từ chối precision ngoài policy và giữ công thức 40/60.
3. Tiếp tục producer thật tới đủ lịch, 360 phiếu điểm, 60 kết quả, biên bản và export bytes. Đảm bảo ca hoãn có lịch sử thật, không rewind baseline. Có thể dựng baseline mới nếu cần thứ tự lịch sử đúng, giữ nguyên database V3.
4. Chạy assertions DB, API và browser ba vai trò, scenario độc lập, backup/restore; cập nhật mọi báo cáo theo kết quả cuối. Không tuyên bố đủ 10 bước khi còn lỗi.
