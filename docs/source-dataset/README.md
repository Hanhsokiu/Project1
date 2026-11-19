# Bộ dữ liệu NGUON80 trên Supabase nhóm

**Đã hoàn tất ngày 19/11/2026:** dữ liệu có ở tất cả các bước trong kế hoạch, từ đăng ký đến công bố kết quả và xuất biểu mẫu. Đây là dữ liệu để đánh giá giao diện: danh tính lấy từ tài liệu nguồn; GPA, điều kiện học vụ, lịch sử thao tác và điểm được sinh tổng hợp, có dấu nguồn trong audit.

Mở [START-HERE.md](START-HERE.md) để chạy ứng dụng, chọn tài khoản và hồ sơ. Địa chỉ trên máy này là **http://127.0.0.1:5183**, chọn đợt **NGUON80-2026**. Không cần chạy lại generator hoặc chờ ngày bảo vệ.

## Kết quả đã kiểm chứng độc lập

| Phần | Dữ liệu |
|---|---|
| Tài khoản | 80 sinh viên, 33 giảng viên, 1 Khoa riêng |
| Đăng ký và phân công | 4 nháp, 76 đã nộp; 76 phân công GVHD đã chốt/công bố |
| Đề tài, đề cương | 68 tên hiện tại khác nhau; 112 phiên bản niêm phong, 60 hồ sơ duyệt |
| Tiếp nhận và hướng dẫn | 48 hồ sơ nhận, 44 kế hoạch, 40 bài nộp/80 tệp, 36 nhận xét đạt |
| Báo cáo cuối và điều kiện | 32 báo cáo, 28 xác nhận GVHD, 28 hồ sơ đủ điều kiện đã chốt |
| Hội đồng và lịch | 4 hội đồng/24 sinh viên; 20 phân công phản biện; 4 phiên đã công bố/20 sinh viên |
| Chấm điểm | 16 phiếu phản biện; 48 phiếu hội đồng cho 12 sinh viên |
| Kết quả | 8 kết quả chốt, trong đó 4 đã công bố; cả 8 công thức tính lại độc lập đạt |
| Biểu mẫu | 15 bản xuất hoàn tất: 8 XLSX, 7 PDF; metadata, audit, header và SHA-256 đúng |

Giữ các nhóm dừng ở những bước khác nhau để có trạng thái nháp, chờ duyệt, cần sửa, đã chốt và đã công bố. Không phải cả 80 sinh viên đều hoàn thành toàn bộ quy trình.

## Tài liệu và file bàn giao

- [Hướng dẫn mở dữ liệu](START-HERE.md): tài khoản, màn hình, lịch test và cách khởi động.
- [Bằng chứng kiểm chứng](VERIFICATION.md): lệnh, kết quả và phạm vi đã xác minh.
- [Giới hạn hiện tại](KNOWN-ISSUES.md): hiệu năng API, phạm vi UI và kho tệp local.
- [Kế hoạch và nguồn](PLAN.md), [lịch sử cấu hình](POLICY-PROPOSAL.md), [đề xuất quyền/làm tròn đã duyệt](FINAL-STAGES-REVIEW.md).

Thư mục `.cache/source-dataset/` được Git bỏ qua:

| File | Công dụng |
|---|---|
| `tra-cuu-du-lieu-hien-co.private.xlsx` | 80 sinh viên và trạng thái đã xác minh; 76 dòng tài khoản/link bước cuối; điểm đối chiếu; 15 link biểu mẫu |
| `tai-khoan-he-thong.private.xlsx` | 114 tài khoản; mật khẩu khởi tạo, lưu ý mật khẩu Khoa đã đổi |
| `bo-du-lieu-goc.xlsx`, `dataset.json` | Danh tính, dữ liệu nguồn, vị trí sheet/hàng/trang và hash ba tài liệu |
| `workflow-verification.json`, `defense-verification.json` | Kiểm chứng độc lập các bước cơ sở và bảo vệ/kết quả/biểu mẫu |
| `workflow-status.json` | Trạng thái tổng hợp; `verification.allPlannedDataStagesComplete` là true |
| `exports/` | 15 bản xuất đã kiểm chứng; tệp của lần thử chưa commit nằm riêng trong `previous-uncommitted-v2/` |
| `backup-manifest.json`, `backups/` | Backup public schema/data và checksum; chứa password hash, không đưa lên Git |

Sinh viên dùng mã sinh viên làm username và mật khẩu khởi tạo, đổi ở lần đầu. Sau khi đổi, dùng mật khẩu mới. Khoa `khoa.nguon80` đã đổi mật khẩu; workbook đã thay ô mật khẩu ban đầu bằng ghi chú dùng mật khẩu hiện tại của bạn. Đăng xuất/đăng nhập lại để nhận quyền cập nhật.

## Nguồn và các thay đổi đã được duyệt

Đọc đúng ba tài liệu do người dùng chỉ định; đối chiếu theo mã sinh viên, giữ biến thể và dấu nguồn. Có 539 mã duy nhất; chọn 80 hồ sơ không thuộc 12 hồ sơ xung đột. Giữ 36 giảng viên nguồn, kích hoạt 33 người đã rõ bộ môn. Nguyễn Thị Nga, Trình Văn Chung và Vũ Văn Huân vẫn chờ thông tin, chưa tạo tài khoản. Trình Văn Chung và Trịnh Văn Chung được giữ là hai người khác nhau.

Đã sửa 40 nhãn đề tài tổng hợp bị lặp, đạt 68 tên hiện tại khác nhau; 28 tên nguồn giữ nguyên. PDF và phiên bản đề cương đã chốt giữ nội dung lịch sử và hash cũ.

Theo yêu cầu có dữ liệu bước cuối ngay, lịch test đã chuyển từ 19/11 về tối 18/11, gồm 4 phiên lúc 21:00 giờ Việt Nam. Chấm hội đồng diễn ra trong giờ thật của phiên qua service hiện có. Không giả timestamp audit. Đợt đang DEFENDING; các giai đoạn trước đã đóng, một số thao tác sửa/nộp bị khóa đúng nghiệp vụ.

Người dùng đã duyệt riêng 21 liên kết quyền cho các role dùng chung và UC24 của NGUON80 làm tròn cuối HALF_UP một chữ số; giữ trọng số 20/20/60, ngưỡng đạt 5 và rubric 30/30/20/20. Các giới hạn sở hữu/phân công/phạm vi vẫn được kiểm tra. Không sửa code RBAC, backend/frontend, schema hoặc contracts trong phần hoàn tất này.

## Kiểm tra lại

Các lệnh sau chỉ đọc DB và tạo lại báo cáo/bảng tra cứu local:

```powershell
node scripts/source-dataset/verify-workflow.cjs
node scripts/source-dataset/verify-defense.cjs
node scripts/source-dataset/inspection-guide.cjs
node scripts/source-dataset/status.cjs
```

Không chạy lại `extract`, `workflow`, các runner nhập, phát hành policy cũ hoặc bàn giao mật khẩu khi chỉ muốn xem giao diện. Báo cáo kế hoạch và checkpoint không thay thế bằng chứng kiểm chứng độc lập.

Backup sau hoàn tất lúc 11:40 ngày 19/11 có 4.177.104 bytes, đã kiểm SHA-256 và danh sách archive; chưa thử restore, không gồm Supabase Auth hay bytes kho tệp. File tuần/báo cáo cuối vẫn nằm tại backend trên máy này. UI toàn hệ thống chưa được kiểm chứng đầy đủ; xem giới hạn ở trên. Không xóa DB cũ và không commit/push trong nhiệm vụ dữ liệu này.
