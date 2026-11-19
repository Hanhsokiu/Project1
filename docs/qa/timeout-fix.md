# Sửa timeout sau audit 19/11/2026

Phạm vi: danh sách xét điều kiện, danh sách kết quả và bộ lọc báo cáo. Người dùng đã yêu cầu sửa; không đổi schema, RBAC, hợp đồng API hoặc dữ liệu Supabase.

1. Gom các lượt đọc độc lập trong transaction RepeatableRead, tái sử dụng bộ gom truy vấn hiện có; lệnh ghi giữ nguyên.
2. Giữ thứ tự dữ liệu, phạm vi, lọc trước phân trang, chứng cứ và hash. Kiểm tra hồi quy cho quyền, điểm và đầu ra báo cáo.
3. Đo lại trên NGUON80; không còn P2028. Giữ nguyên deadline repository; đối chiếu thời hạn frontend với thời gian đọc nguồn điểm thực tế.

## Kết quả

Đo chỉ đọc service trên NGUON80 lúc 16:11 ngày 19/11/2026, giờ Việt Nam:

| Luồng | Trước | Sau | Truy vấn trước → sau |
|---|---|---|---|
| Xét điều kiện — danh sách | P2028 sau 20,7 giây | 12,296 giây, tổng 80 hồ sơ | 235 → 39 |
| Kết quả — trang đầu | P2028 sau 60,5 giây | 17,508 giây, 20/64 hồ sơ | 724 → 89 |
| Báo cáo — options theo đợt | P2028 sau 60,1 giây | 14,067 giây | 767 → 85 |

Ba màn đều trả dữ liệu. Hội đồng/chấm phản biện/chấm hội đồng cũng trả dữ liệu, lần lượt 9,062/18,701/18,064 giây.

## Thay đổi

- Repository read UC18/UC24/UC25 dùng bộ gom truy vấn trong chính transaction RepeatableRead. Write vẫn dùng transaction và cơ chế khóa/kiểm tra cũ. Không cache giữa request.
- Xét điều kiện đọc độc lập theo lô rồi lọc/sắp xếp/phân trang như cũ.
- Danh sách kết quả kiểm tra quyền, phạm vi và tìm kiếm trước phân trang; chỉ dựng nguồn điểm của trang cần xem khi không lọc trạng thái/hội đồng. Nếu có các bộ lọc này, vẫn đánh giá nguồn trước phân trang. Điểm thành phần hội đồng được đọc đồng thời nhưng ghép chứng cứ theo thứ tự cũ.
- Options/statistics báo cáo đọc ứng viên độc lập rồi ghép đúng thứ tự. Xuất theo template vẫn tuần tự, giữ giới hạn và thứ tự xử lý lỗi.
- Riêng GET danh sách kết quả dùng timeout frontend 45 giây. Các lần đo trung gian mất 20,1–20,4 giây dù backend trả thành công; mốc cũ 20 giây có thể vẫn làm giao diện báo timeout. Thời hạn frontend chung và backend không đổi. Đây là khoảng đệm cho DB từ xa, không phải cam kết mọi lần gọi nhanh.
- Sửa ba biểu thức f-string trong `prepare-uc17-24.py` để chạy bằng Python 3.11. Không thay SQL/migration đã áp dụng.

## Kiểm chứng

- Toàn bộ backend: **1.036 test/79 file qua**, `.cache/system-audit/final-tests.json`.
- Frontend: **403 test/64 file qua**, `frontend-tests.json`.
- `corepack pnpm -r type-check`, `-r lint`, `-r build`: qua; production assets frontend/backend qua.
- `python scripts/prepare-uc17-24.check.py`: **23 test qua trên Python 3.11**, gồm kiểm tra nội dung artifact/migration.
- Test mới xác nhận tổng đúng quyền/tìm kiếm trước phân trang, không đọc nguồn điểm ngoài trang, không nhận hồ sơ ngoài phạm vi. Thêm 3 repository vào test chỉ gom read và giữ write không cache.
- Đối chiếu cùng snapshot lúc 20:12: 8 kết quả đã chốt vẫn hiện hành; 3 trang và lọc PUBLISHED khớp danh sách đầy đủ. Tổng 64: 52 INCOMPLETE, 4 READY, 4 FINALIZED, 4 PUBLISHED. Bằng chứng `final-read-parity.json`.
- Đã nạp lại API 3011 và UI 5183. `/api/auth/me` không token trả 401; `/login` trả 200.

## Giới hạn

Số đo trên là service thật, chưa đo lại toàn UI bằng phiên Khoa hiện tại. DB từ xa vẫn có độ trễ; không cam kết tải tức thì. Không ghi dữ liệu nghiệp vụ Supabase, không đổi quyền/mật khẩu, không commit/push. Docker/SMTP/khôi phục backup nằm ngoài bản sửa này.

## Kiểm tra trước push theo yêu cầu người dùng

Chạy lại tối 19/11/2026 trên bản code chuẩn bị đẩy lên `fix/integration-ui`:

- `corepack pnpm -r type-check`, `corepack pnpm -r lint`, `corepack pnpm -r build`: PASS.
- Backend `test` với URL local không kết nối được: 1.036 test/79 file PASS; không dùng Supabase.
- Frontend `test`: 403 test/64 file PASS. Các file `scripts/source-dataset/*.test.cjs`: 18 test PASS.
- `python backend/scripts/prepare-uc17-24.check.py`: 23 test PASS.
- `node --test scripts/check-production-assets.test.cjs` và quét frontend/backend production assets: PASS.
- `node scripts/check-release-source.cjs`: PASS, 1.639 file được quét, không có phát hiện bí mật.

Không tạo lại DB test local đã dọn. Bộ tích hợp database/UI không chạy lại trong lần push; bằng chứng lần audit trước được ghi trong [báo cáo hệ thống](system-audit-2026-11-19.md). Backup đã được thử khôi phục trong [nhiệm vụ dọn dữ liệu](cleanup-old-data.md).
