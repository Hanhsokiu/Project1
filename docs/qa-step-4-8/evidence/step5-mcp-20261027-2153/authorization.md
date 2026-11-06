# Phạm vi được cấp bổ sung

Người dùng đã xác nhận: “Cho phép ghi trên database test local mới; giữ nguyên dữ liệu hiện tại”.

Cho phép tạo DB test local mới, dữ liệu tổng hợp và thao tác ghi bước 5 trong DB đó. Không thay dữ liệu DB giao diện hiện có, không reset/drop DB hiện có, không sửa code ứng dụng/config/dependencies/migration. Chỉ lưu harness/evidence mới của QA. Môi trường live 5173/3000 tiếp tục chỉ đọc ngoài login/logout. Không chạy nghiệp vụ bước 6–8 trên môi trường hiện tại.
