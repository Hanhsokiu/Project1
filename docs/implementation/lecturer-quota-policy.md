# Chỉ tiêu hướng dẫn theo hệ số — 04/11/2026

Khoa lập và duyệt chỉ tiêu trước khi chạy phân công bán tự động. Chốt chỉ tiêu không công bố kết quả phân công. Phần import sinh viên giữ nguyên.

## Quy tắc

- Hồ sơ GV lưu học vị (`MASTER`, `DOCTOR`, có thể chưa cập nhật) riêng với học hàm (`NONE`, `ASSOCIATE_PROFESSOR`, `PROFESSOR`). Không suy dữ liệu từ họ tên hay tự quy đổi `titleId` cũ.
- Hệ số mặc định theo yêu cầu: ThS 0,75; TS/PGS/GS 1. Học hàm được ưu tiên, mỗi người dùng một hệ số. Khoa sửa bảng hệ số cho từng đợt, tối đa bốn chữ số thập phân; đây là cấu hình nghiệp vụ, không phải khẳng định định mức pháp lý.
- Tính theo số SV trong roster, hoặc đăng ký đã nộp sau khi đóng đăng ký. Hệ số là trọng số chia tổng SV, không phải số SV hay định mức cố định.
- Đề xuất liên tục: `N × hệ số / tổng hệ số`. Xét giới hạn trên và tải đã phân là giới hạn dưới, phân phối lại các chỗ còn lại theo tỷ lệ. Làm tròn bằng phần dư lớn nhất; đồng hạng theo mã GV rồi ID để kết quả ổn định.
- Trần chung khởi tạo trên form là 10 để Khoa lựa chọn/chỉnh; không phải định mức của trường. Trần riêng 0 nghĩa là không nhận SV. Giới hạn kỹ thuật thống nhất 0–500, tách với quota mặc định của hồ sơ.
- Chỉ tiêu chốt là số nguyên, không vượt trần, không thấp hơn tải của phương án nháp đang giữ. Điều chỉnh khác đề xuất cần lý do ít nhất 5 ký tự. Cho phép tổng quota lớn hơn nhu cầu nếu Khoa chủ động dành sức chứa dự phòng.
- Tổng quota phải đủ nhu cầu. Kiểm tra luồng cực đại giữa hướng đã đăng ký và các GV để không đếm trùng sức chứa của GV có nhiều hướng. Không thể kiểm chứng hướng của SV chưa nộp; UI ghi rõ giới hạn này.
- `TermLecturer.quota` tiếp tục là quota hiệu lực mà thuật toán phân công sử dụng. Quota là giới hạn, không bảo đảm mỗi người nhận đủ SV. Thuật toán NV/GPA/hướng hiện có giữ nguyên.

## Dữ liệu, giao dịch và lịch sử

Migration mới chỉ thêm `LECTURER.academic_degree`, `LECTURER.academic_rank` và `THESIS_TERM.quota_policy`. Không sửa migration cũ hoặc gán lại quota lịch sử.

`quota_policy` là snapshot JSON có hợp đồng Zod dùng chung, phiên bản cấu trúc, revision, trạng thái, bảng hệ số, học hàm/học vị áp dụng, giới hạn, đề xuất, quota chốt, lý do, người và thời điểm chốt. Audit lưu cả snapshot trước/sau. Dữ liệu học thuật cập nhật sau đó không tự viết lại snapshot đã duyệt.

`POST /terms/:id/quotas/preview` kiểm tra revision, tính và lưu DRAFT, chưa đổi quota hiệu lực. Việc này ngăn scheduler/phân công dùng quota cũ trong khi Khoa đang duyệt. `POST /terms/:id/quotas/approve` kiểm tra dữ liệu nguồn chưa đổi, kiểm tra toàn bộ thành viên, giới hạn, lý do và sức chứa, rồi lưu quota + snapshot + audit trong một giao dịch Serializable. Hai người chốt cùng phiên bản chỉ một người thành công.

Mã băm bản đề xuất xét roster, hồ sơ GV, chuyên môn, học vụ, đăng ký và tải nháp. Đổi dữ liệu sau khi xem đề xuất buộc tính lại trước khi chốt. Sau chốt, thay roster/quota làm `quotaReady=false`; với cơ sở SUBMITTED, đổi tập đăng ký đã nộp cũng làm hết hiệu lực. Chạy thuật toán, sửa phân công và công bố đều kiểm lại phía server. Sau công bố, không đổi chính sách hoặc roster/quota của đợt dùng hệ số. Không xóa nháp hay tự công bố khi chốt quota.

Đợt cũ có snapshot NULL tiếp tục dùng quota thủ công. Khi Khoa bấm tính đề xuất sẽ chuyển sang quy trình duyệt mới. Đợt mới tạo qua API bắt đầu ở trạng thái cần chốt chỉ tiêu. Hồ sơ cũ thiếu học vị được yêu cầu bổ sung khi tham gia tính quota có trần lớn hơn 0.

## Sử dụng

1. Trong Tài khoản hoặc Đội ngũ giảng viên, cập nhật học vị và học hàm.
2. Mở đợt → Danh sách tham gia → Giảng viên; lưu danh sách SV/GV trước.
3. Chọn cơ sở tính, kiểm tra hệ số, chọn trần chung hoặc trần riêng. Nút Áp dụng cho tất cả xóa trần riêng đang nhập.
4. Tính chỉ tiêu đề xuất; xem tổng/trung bình hệ số, nhu cầu, tải, cảnh báo.
5. Điều chỉnh quota và lý do nếu cần; chốt chỉ tiêu. Sau đó chạy và duyệt phương án phân công riêng.

## Kiểm chứng và triển khai

- Unit tests kiểm tra hai ví dụ 60/63 SV với 10 ThS; 70 SV với 5 ThS và 5 TS; làm tròn, trần, tải đang giữ, thiếu chỗ, chuyên môn chồng lấn, stale revision, thiếu học vị, khóa và audit. Kiểm tra nhiều tổ hợp để bảo đảm tổng nguyên và giới hạn.
- `node backend/scripts/test-quota-policy.cjs` tạo DB mới tên `btl_pr2b_quota_*` trên instance local đã quản lý tại 127.0.0.1:55451. Không dùng URL Supabase trong `.env`. Chạy chuỗi migration trước/sau trên dữ liệu legacy, kiểm tra API quyền, chốt cạnh tranh, rollback khi audit lỗi, phân 60 SV, chặn công bố trong lúc duyệt quota và khóa thay đổi sau công bố. Cần build backend trước, PostgreSQL local đang chạy, và `.cache/integration-ui/config.json` đã được tạo bởi công cụ local của repo. Báo cáo lưu tại `.cache/quota-verification/result.json`.
- Thêm `--browser` để chạy Chrome headless với Vite riêng ở cổng 50882, thao tác tính/chốt trên giao diện và chụp desktop/mobile. Tất cả API được chuyển sang server kiểm thử local, không gửi request tới Supabase. Ảnh nằm trong `.cache/quota-verification/desktop.png` và `mobile.png`.
- Migration cần được triển khai trước khi khởi động backend mới. Với DB chung, kiểm tra lịch sử migration và backup theo quy trình `backend/scripts/shared-database.cjs`, chỉ triển khai migration đã review. Không dùng `db push`, reset hoặc seed lại dữ liệu thật.
- Windows: Prisma engine DLL có thể đang bị backend giữ. Dừng đúng backend của workspace trước khi chạy `pnpm --filter @doan/backend exec prisma generate`, rồi khởi động lại sau khi migration hoàn tất.

## Kết quả nghiệm thu ngày 04/11/2026

- Build monorepo thành công; **314 kiểm thử backend và 153 kiểm thử frontend PASS**.
- Kiểm thử API/PostgreSQL và Chrome desktop/mobile PASS, có thao tác tính và chốt thật trên DB riêng. Hai yêu cầu chốt đồng thời chỉ tạo một kết quả; lỗi audit rollback; dữ liệu đổi sau xem đề xuất bị từ chối; phân 60 SV và chặn công bố khi quota chưa chốt.
- Đã triển khai duy nhất `202611040001_lecturer_quota_policy` lên database đang cấu hình sau khi xác nhận đúng đích. Lịch sử migration trước/sau: 15 → 16, checksum hợp lệ.
- Do bộ PostgreSQL local thiếu pg_dump, bản sao lưu logic chứa dữ liệu nguyên gốc dưới dạng chuỗi JSON từng dòng, metadata schema và bản sao chuỗi migration. Đã khôi phục 100 bảng public (lịch sử migration được kiểm riêng) vào DB local mới và so sánh checksum dữ liệu trước khi áp dụng DDL. Bản sao lưu nằm trong `.cache/quota-verification/public-before-quota-2026-11-04T13-55-29-081Z.json`; chứa dữ liệu riêng, không đưa vào Git.
- Quota hiện có trong TERM_LECTURER được đối chiếu trước/sau và giữ nguyên. Hậu kiểm READ ONLY bằng repository/mapper mới đọc được cả 4 đợt và 6 giảng viên; hai endpoint quota có trên backend đang chạy.
- Cả 6 hồ sơ GV hiện chưa có học hàm/học vị được chuẩn hóa. Cần Khoa cập nhật trong Đội ngũ giảng viên hoặc Tài khoản trước khi tính mới; hệ thống không tự suy từ tiền tố trong họ tên. Quota lịch sử vẫn sử dụng như trước.
- Bằng chứng local: `.cache/quota-verification/result.json`, `desktop.png`, `mobile.png`, `shared-deploy-result.json`, `live-read-result.json`.
