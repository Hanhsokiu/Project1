# Bằng chứng kiểm chứng dữ liệu NGUON80

## Phạm vi

Đích Supabase `zlsygwjskvxgtzdjhvzt`, đợt `NGUON80-2026`. Danh tính từ ba tài liệu nguồn; lịch sử, GPA/điều kiện và điểm là dữ liệu tổng hợp được người dùng cho phép. Các báo cáo có dữ liệu cá nhân chỉ lưu tại `.cache/source-dataset/`, được Git bỏ qua.

## Các lệnh đã chạy ngày 19/11/2026

| Lệnh | Kết quả |
|---|---|
| `node --test scripts/source-dataset/*.test.cjs` | 18/18 đạt khi chạy ngoài sandbox; lần chạy trong sandbox bị chặn tạo tiến trình `spawn EPERM` |
| `node --check` cho các công cụ `.cjs` | Đạt; các file sửa sau đó được kiểm tra cú pháp riêng và thực thi theo phạm vi |
| `node scripts/source-dataset/verify-workflow.cjs` | 68 đề cương/tên khác nhau; 112 phiên bản niêm phong; 60 hồ sơ duyệt; 48 hồ sơ nhận; 44 kế hoạch; 40 bài/80 tệp; 36 nhận xét; 32 báo cáo cuối; 28 xác nhận/đủ điều kiện; 4 hội đồng/24 sinh viên; 20 phản biện |
| `node scripts/source-dataset/final-readiness.cjs` sau áp dụng | Không thiếu quyền trong danh sách đã duyệt; không thay quyền trong công cụ chỉ đọc |
| `node scripts/source-dataset/verify-defense.cjs` | Lúc 11:39 ngày 19/11: 21 liên kết quyền đúng audit; 4 lịch/20 sinh viên; 16 phiếu phản biện; 48 phiếu hội đồng/12 sinh viên trong giờ phiên thật; 8 kết quả chốt, 4 công bố; cả 8 công thức tính lại độc lập đạt; 15 biểu mẫu đúng metadata/hash/header PDF hoặc ZIP |
| `node scripts/source-dataset/inspection-guide.cjs` | Tạo lại Excel/JSON đủ 80 sinh viên; 76 dòng tài khoản bước cuối; điểm đối chiếu lấy từ báo cáo đã được kiểm chứng |
| Đọc lại Excel bàn giao và đối chiếu file local | Đạt: 5 sheet, 80 sinh viên, 76 dòng tài khoản bước cuối, 16 dòng điểm, 15 link xuất đúng SHA-256/dung lượng; workbook tài khoản đủ 114 dòng và ghi chú mật khẩu Khoa hiện tại |
| Kiểm tra liên kết Markdown và `git diff --check` | Đạt; không sửa file tracked của backend/frontend/schema/contracts |

Đã hoàn tất 15 bản xuất: 8 XLSX và 7 PDF, gồm danh sách, phân công, bảng điểm, phiếu nhận xét, biên bản và đề cương. `report-exports-report.json` đã có đủ 15 bản, kiểm chứng độc lập mới hơn báo cáo xác nhận `allPlannedDefenseStagesComplete: true`. Bốn tệp của lần thử chưa commit được giữ riêng trong `exports/previous-uncommitted-v2`; không tính vào 15 bản đã xác minh.

## Cách kiểm tra lại

Chỉ đọc DB và tạo bảng tra cứu, không chạy lại generator, mở giai đoạn hoặc reset mật khẩu:

```powershell
node scripts/source-dataset/verify-workflow.cjs
node scripts/source-dataset/verify-defense.cjs
node scripts/source-dataset/inspection-guide.cjs
node scripts/source-dataset/status.cjs
```

`workflow-status.json.verification.allPlannedDataStagesComplete` chỉ đúng khi cả các bước cơ sở và tất cả bước bảo vệ có bằng chứng. `fullWorkflowUiVerified` vẫn là false: kiểm chứng dữ liệu không thay thế kiểm tra toàn bộ giao diện.

## Giới hạn

Đã kiểm tra trước bàn giao: HTTP ba vai trò, quyền hướng dẫn, tải PDF/ZIP và một số màn sinh viên. Lần kiểm tra lại bằng mật khẩu Khoa ban đầu dừng vì tài khoản đã đổi mật khẩu; đã xác nhận chỉ đọc tài khoản ACTIVE và không reset mật khẩu hiện tại. Chưa kiểm tra đầy đủ HTTP/UI UC19–25, responsive hoặc accessibility. Xem [KNOWN-ISSUES.md](KNOWN-ISSUES.md).

Các bản xuất UC25 là mẫu có lọc: một sinh viên đã công bố điểm và hội đồng của sinh viên đó cho hai mẫu hội đồng; không tuyên bố đây là báo cáo toàn bộ 80 sinh viên. Chữ ký là UNSIGNED. PDF/phiên bản đề cương đã chốt giữ nội dung và hash lịch sử trước khi sửa 40 nhãn đề tài.

Backup mới lúc 20:27 ngày 19/11 có 4.177.381 bytes, đã kiểm SHA-256, khôi phục và diễn tập dọn dữ liệu thành công. Kho tệp được sao lưu riêng và đối chiếu từng byte. Sau dọn, 11.987 bản ghi NGUON80/dùng chung và 112 tệp tuần/báo cáo cuối đều nguyên vẹn; 7 đợt cũ và 3 cụm PostgreSQL local đã xóa. Xem [báo cáo dọn dữ liệu](../qa/cleanup-old-data.md). Không backup Supabase Auth; kho tệp đang dùng vẫn nằm trên backend máy này.
