# Mở bộ dữ liệu NGUON80 để kiểm tra giao diện

Đây là dữ liệu đã ghi vào Supabase nhóm: danh tính lấy từ tài liệu nguồn; GPA, điều kiện học vụ, lịch sử thao tác và điểm mô phỏng được đánh dấu tổng hợp. Chọn đợt **NGUON80-2026 — Dữ liệu nguồn 80 — quy trình tổng hợp** trong ứng dụng.

## 1. Chạy trên máy này

Mở hai terminal ở `D:\Project1\BTL` nếu API/UI chưa hoạt động:

```powershell
node scripts/source-dataset/serve.cjs --project-ref zlsygwjskvxgtzdjhvzt
```

```powershell
node scripts/source-dataset/serve-ui.cjs
```

Vào **http://127.0.0.1:5183**. Trình duyệt chỉ cần một cổng này; API chạy nội bộ ở 3011, database ở Supabase. Hai tiến trình phải còn chạy. Kho tệp báo cáo tuần/cuối đang ở máy này; xem [giới hạn hiện tại](KNOWN-ISSUES.md).

Ngày 19/11 đã sửa nguyên nhân timeout ở ba màn hội đồng/phản biện và khởi động lại API/UI. Tải lại trang để dùng bản đang chạy. Các lần đo service cuối mất khoảng 11–17 giây, chưa phải tải tức thì; xem [bằng chứng hiệu năng](PERFORMANCE-REVIEW.md).

## 2. Chọn tài khoản và hồ sơ

- Mở `.cache/source-dataset/tra-cuu-du-lieu-hien-co.private.xlsx`: đủ 80 sinh viên, mốc đã xác minh, mốc dự kiến và link mở hồ sơ. Cột “mốc dự kiến” không phải trạng thái đã thực hiện.
- Sheet **Tài khoản bước cuối** có 76 dòng tài khoản/link cho các phiếu chấm và kết quả; **Điểm tổng hợp để đối chiếu** có số liệu đã xác minh; **Biểu mẫu đã xuất** mở được 15 bản mẫu PDF/XLSX cạnh workbook.
- Tài khoản nằm trong `.cache/source-dataset/tai-khoan-he-thong.private.xlsx`, đã cập nhật và kiểm chứng đủ **114 tài khoản** lúc **20:25 ngày 18/11/2026** (80 sinh viên, 33 giảng viên, 1 Khoa).
- Đã bàn giao: username và mật khẩu khởi tạo sinh viên đều là mã sinh viên, bắt buộc đổi ở lần đăng nhập đầu. Sau khi đổi, dùng mật khẩu mới của bạn.
- Khoa dùng `khoa.nguon80`; tài khoản này đã đổi mật khẩu trước lần kiểm tra sáng 19/11, nên dùng mật khẩu hiện tại của bạn. Mật khẩu Khoa ban đầu trong workbook không còn hiệu lực. Giảng viên dùng username trong workbook và đổi mật khẩu lần đầu nếu hệ thống yêu cầu.
- Đăng nhập đúng người rồi mở link hồ sơ. Quyền truy cập vẫn được kiểm tra, không thể dùng một sinh viên để mở hồ sơ của sinh viên khác.
- Sau khi thay quyền ngày 19/11, đăng xuất rồi đăng nhập lại để giao diện nhận đủ quyền mới.

## 3. Những màn nên kiểm tra

| Vai trò | Màn hình | Nội dung cần đối chiếu |
|---|---|---|
| Sinh viên | Đăng ký, kết quả phân công | Đúng mã/tên, hướng, GVHD của đợt |
| Sinh viên | Đề cương, hồ sơ và bản in | Nháp/đang duyệt/cần sửa/đã duyệt; phiên bản, nhận xét, PDF |
| Sinh viên, GVHD | Kế hoạch, nhiệm vụ, bài nộp | Tiến độ, trạng thái nhận xét; tải PDF/ZIP |
| Sinh viên, GVHD | Báo cáo cuối, xác nhận bảo vệ | PDF đúng sinh viên, trạng thái đồng ý của GVHD |
| Sinh viên, GVHD, Khoa | Xét điều kiện bảo vệ | Chứng cứ, quyết định; mỗi vai trò chỉ thấy phần được phép |
| Khoa | Hội đồng, phản biện | Thành viên, phân sinh viên, trạng thái chốt và lý do chặn nếu có |
| Khoa, thành viên hội đồng | Lịch, chấm phản biện và hội đồng | 4 phiên/20 sinh viên, 16 phiếu phản biện và 48 phiếu hội đồng của 12 sinh viên |
| Khoa, sinh viên có điểm công bố | Kết quả bảo vệ | 8 kết quả đã chốt, 4 đã công bố; 4 kết quả còn lại chưa công bố cho sinh viên |
| Khoa | Báo cáo, biểu mẫu | 15 bản xuất mẫu đã kiểm hash; lọc theo sinh viên/hội đồng tương ứng, chữ ký UNSIGNED |

Các nhóm dừng sớm được giữ để xem nhiều trạng thái. Giai đoạn cũ đã đóng nên một số thao tác sửa/nộp bị khóa đúng nghiệp vụ. Không mở lại giai đoạn hoặc reset DB chỉ để làm nút thao tác khả dụng.

Đã hoàn tất dữ liệu các bước theo kế hoạch: 32 báo cáo cuối, 28 hồ sơ đủ điều kiện, 4 hội đồng/24 sinh viên, 20 phân công phản biện, 4 lịch/20 sinh viên, 16 phiếu phản biện, 48 phiếu hội đồng cho 12 sinh viên, 8 kết quả chốt/4 công bố và 15 biểu mẫu. Kiểm chứng độc lập ngày 19/11 đã đạt, gồm công thức điểm, audit và hash file. Danh sách/chi tiết xét điều kiện đã hiển thị qua API thật bằng tài khoản sinh viên; UI UC19–25 chưa được kiểm chứng đầy đủ. Xem [bằng chứng](VERIFICATION.md) và [giới hạn](KNOWN-ISSUES.md).

## 4. Lịch test để có dữ liệu các bước cuối

Theo yêu cầu mới, lịch test đã rút về **18/11/2026**. Đã công bố 4 phiên lúc **21:00** (giờ Việt Nam), có 20 sinh viên; thời lượng theo số sinh viên và slot 10 phút + 5 phút đệm. Giai đoạn bảo vệ đã mở, chấm hội đồng vẫn diễn ra trong giờ phiên qua service thật. Không cần đợi đến 19/11.

Chấm phản biện/hội đồng đã thực hiện trong giờ phiên tối 18/11 và kiểm chứng lại ngày 19/11. Các bước kết quả và xuất biểu mẫu cũng đã xong; không cần chạy lại runner hoặc chấm lại. Người dùng đã duyệt [quyền dùng chung và cách làm tròn một chữ số](FINAL-STAGES-REVIEW.md), đã áp dụng và đối chiếu đủ 8 bộ điểm nguồn. Báo cáo từng bước và `defense-verification.json` xác nhận hoàn tất dữ liệu; `workflow-status.json.verification.allPlannedDataStagesComplete` là true. Điều này không thay cho kiểm chứng UI toàn hệ thống.

Đã đổi 40 nhãn đề tài tổng hợp bị lặp, kiểm chứng 68 tên đề tài hiện tại khác nhau. Tên nguồn giữ nguyên; các bản PDF/đề cương đã chốt trước khi đổi tên vẫn giữ nội dung lịch sử và hash cũ.

Không xóa các DB test cũ trong công việc này. Ba giảng viên chưa rõ bộ môn vẫn giữ trong bộ nguồn, chưa kích hoạt tài khoản.
