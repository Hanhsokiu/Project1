# Bộ dữ liệu mẫu bước 1–8

Bộ mẫu cộng thêm vào đúng PostgreSQL mà backend đang dùng, qua `backend/.env` (hoặc `DATABASE_URL` được truyền rõ ràng). Không reset/migrate, xóa dữ liệu, đổi mật khẩu người dùng hiện có hay sửa quyền vai trò toàn cục. Không sử dụng database local riêng của các script `ui:*` cũ.

## Tạo và kiểm tra

Backend phải được build theo code hiện tại: `pnpm --filter @doan/backend build`.

1. `pnpm sample:test`: kiểm tra lịch bằng validator thật của ứng dụng và kiểm tra định danh/phân bổ.
2. `pnpm sample:plan`: đọc cấu hình, kiểm tra vai trò, xung đột và in fingerprint của database (không lộ thông tin kết nối).
3. `pnpm sample:create --target-fingerprint <fingerprint-vừa-in>`: tạo dữ liệu trên database đã chọn.
4. `pnpm sample:verify`: kiểm tra quan hệ, lịch, số lượng và viết hướng dẫn sử dụng.
5. `pnpm sample:browser`: mở backend tạm và frontend trên cổng loopback trống, đăng nhập thật các vai trò mẫu, kiểm tra màn hình và tải PDF; không mock API. Bằng chứng lưu trong thư mục `browser` bên cạnh manifest. Cả hai server tạm tự đóng khi kết thúc.

Các lệnh tạo cần quyền kết nối database. Định danh ổn định và manifest cục bộ giúp chạy tiếp sau lỗi; khi hoàn thành, chạy lại chỉ kiểm tra, không đặt lại dữ liệu đã thử. Không xóa manifest rồi cố tạo đè. Không chạy đồng thời hai lệnh tạo trên cùng database.

## Phạm vi

- `MAU18-01-DANGKY`: 12 sinh viên, 4 giảng viên; 4 chưa đăng ký, 4 nháp, 4 đã nộp.
- `MAU18-02-DECUONG`: phân công chính thức cho 12 SV; đề cương ở các trạng thái nháp, đã nộp, đã giao nhóm, đang xét, cần sửa và được duyệt; hai nhóm xét, không có GV tự duyệt sinh viên của mình. SV11 sẵn sàng chốt hồ sơ, SV12 đã chốt để thử tiếp nhận trong giai đoạn đang mở.
- `MAU18-03-BAOCAO`: 12 hồ sơ đã chốt, 5 đã tiếp nhận và có kế hoạch hướng dẫn; bốn tuần mở/khóa/nháp, 36 nghĩa vụ báo cáo; báo cáo chờ đánh giá/cần sửa/đạt/không đạt, nộp muộn và lịch sử v1 → v2; PDF, ZIP và biên bản gặp.

Tài khoản mới: `mau18_giaovu`, `mau18_gv01`–`mau18_gv04`, `mau18_sv01`–`mau18_sv12`. Mật khẩu ngẫu nhiên lưu riêng cùng bảng tài khoản và hướng dẫn tại `.cache/sample-data-steps1-8/<fingerprint>/HUONG-DAN.md`, được Git bỏ qua. Dùng địa chỉ `example.invalid`, không gửi thư thật. Giáo vụ đang hoạt động lúc tạo cũng được cấp quyền **chỉ trong các đợt mẫu mới**.

Danh mục và đầu vào đăng ký/phân công nháp được tạo trong một transaction. Các bước chốt chỉ tiêu, công bố/chốt phân công, thống nhất đề tài, bàn giao, phiên bản, xét duyệt, chốt/tiếp nhận hồ sơ và báo cáo dùng API thật qua một backend nội bộ tạm thời trên loopback. Backend tạm dừng scheduler toàn cục và worker thư/nhắc hạn, đóng sau khi tạo xong. Thông báo trong ứng dụng chỉ được chuyển từ outbox của các tài khoản/đợt mẫu.

Để sinh chuỗi lịch sử có thể thao tác bằng API thật, lịch riêng của đợt mẫu được chuyển lần lượt qua phân công → đề cương → hướng dẫn bằng API quản lý lịch. Mỗi bản lịch đều qua validator chuẩn, sáu giai đoạn chính không chồng lấn. Ngày khởi tạo được cố định trong manifest để chạy tiếp không đổi hạn; dữ liệu không tự gia hạn khi thời gian trôi qua. Cùng 12 SV được dùng trong ba đợt nhằm kiểm tra đổi phạm vi, không giả làm lịch sử học vụ thật.

`verification.json` chỉ chứa kết quả đếm/kiểm tra, không chứa mật khẩu. Script đối chiếu hash các bản ghi nghiệp vụ có sẵn trước/sau khi tạo để phát hiện thay đổi đồng thời. Tệp tải lên được lưu riêng tư dưới thư mục uploads của backend hiện tại; khi đưa lên host phải chuyển cả tệp hoặc đổi sang storage bền vững.

Bộ mẫu phục vụ kiểm tra thủ công các màn hình bước 1–8. Việc seed không thay thế kiểm thử nghiệp vụ hoặc xác nhận mọi màn hình đã hoàn thiện.

## Vấn đề phát hiện bằng dữ liệu thật

Trang báo cáo nhiều tuần từng đọc lại phân công, nghĩa vụ và kế hoạch của cùng sinh viên cho từng tuần, làm kéo dài transaction trên database từ xa. API hiện chỉ đọc mỗi ngữ cảnh một lần trong cùng yêu cầu; các yêu cầu sau vẫn đọc lại để nhận dữ liệu mới. Quyền sinh viên/giảng viên và thống kê từng tuần được kiểm thử riêng.

Trang bài nộp mở đồng thời ngữ cảnh, nhiệm vụ và lịch sử. Với pool phiên Supabase nhỏ, thời gian chờ transaction mặc định 2 giây có thể gây `P2028` trước khi lấy được kết nối. Các repository hướng dẫn/bài nộp/nhận xét/tuần dùng `maxWait: 10000`, giữ nguyên mức cô lập và thời hạn chạy transaction. Không tăng số kết nối lên để né giới hạn pool.

Kết quả kiểm tra dữ liệu của lần tạo trên môi trường hiện tại: 17 tài khoản mới, 3 đợt, 24 đề cương, 5 kế hoạch hướng dẫn, 4 tuần, 36 nghĩa vụ, 10 nhiệm vụ, 7 phiên bản bài nộp, 6 nhận xét tiến độ, 2 biên bản gặp và 14 tệp riêng tư đã kiểm tra checksum. Các bản ghi nghiệp vụ có trước khi seed được đối chiếu hash và giữ nguyên. Chi tiết chạy thực tế nằm trong manifest và `verification.json` cục bộ.

Xác nhận ngày 05/11/2026: 51 kiểm thử hướng dẫn/báo cáo đạt; backend build và lint đạt; 12 kiểm tra trình duyệt với API và database thật đạt, không có lỗi JavaScript/API trong lượt cuối. Đã kiểm tra thống kê tuần, v2/nộp muộn, tải PDF, bản nháp trong phiên đăng nhập mới, phạm vi 3 sinh viên của GVHD, 12 đề cương, roster, đăng ký, phân trang kết quả phân công, nhóm duyệt, trình soạn đề cương và hai hồ sơ sẵn sàng chốt/tiếp nhận. Kết quả và ảnh chụp: `.cache/sample-data-steps1-8/<fingerprint>/browser/`.
