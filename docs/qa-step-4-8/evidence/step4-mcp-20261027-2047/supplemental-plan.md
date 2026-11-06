# Bổ sung trước khi chạy kiểm tra đọc boundary

Không gửi mutation nghiệp vụ. Dùng token nguyên vẹn của tài khoản đã login bằng UI, chỉ trong bộ nhớ request; không ghi header hoặc token vào evidence.

| ID | Nguồn | Điều kiện/thao tác | Expected |
|---|---|---|---|
| R01 | S2 §5.1/S3 | FACULTY GET list limit=1 page=1/2/3 | Tổng=2; hai trang đầu mỗi trang một nhóm khác ID, trang 3 rỗng; thứ tự ổn định |
| R02 | S3 shared query | GET list page=0/-1/abc, limit=0/101, unknown query, search >255 | Từng query sai trả 400, error envelope không stack/Prisma |
| R03 | S3 search | GET list search='HKT' và ' hkt ' | Cùng nhóm hkt; không phân biệt hoa thường, trim |
| R04 | Yêu cầu UI error | Nhập search 256 ký tự bằng UI, rồi xóa | Error banner 400 rõ ràng; không success giả/trang trắng; xóa thì phục hồi 2 nhóm |
| R05 | Ràng buộc bảo toàn dữ liệu | GET lại list sau lượt test, so với group views đầu lượt | Hai group view giống nhau, revision/timestamps/members không đổi; không suy ra hash toàn DB |
| R06 | S3 pagination UI | Cần >20 nhóm thật và >20 candidate | BLOCKED nếu dataset chỉ 2 nhóm/4 candidate; API limit=1 không thay kiểm UI nhiều trang |
| U01 | S3 nhận diện selected members | Chọn một GV, search không khớp, xóa search | Tên người đã chọn phải còn đọc được, không biến thành UUID; trạng thái chọn giữ nguyên |
| U02 | S3 keyboard/mobile | 390px, mở menu, Escape, Shift+Tab | Không focus phần tử ngoài màn hình trong sidebar đã đóng |

U01/U02 là ca tái hiện bổ sung sau quan sát lỗi trong ca G06/G09; evidence tái hiện được ghi riêng, không coi các lỗi harness timeout là lỗi ứng dụng.
