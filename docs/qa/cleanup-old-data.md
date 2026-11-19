# Dọn dữ liệu cũ, giữ NGUON80

Người dùng yêu cầu xác định bản ghi và xóa DB/dữ liệu test cũ, giữ NGUON80. Phạm vi đã kiểm kê: 7 đợt ngoài NGUON80 trong Supabase chung; các cụm PostgreSQL local của dự án. Không xóa project Supabase.

## Kế hoạch

1. Kiểm kê FK, trigger, bản ghi phụ thuộc và tham chiếu dùng chung. Lập danh sách ID cần xóa/giữ; không suy ra quyền sở hữu chỉ từ tên.
2. Sao lưu public schema và dữ liệu, sao lưu các DB local và tệp liên quan. Kiểm hash/archive và thử khôi phục trước thao tác phá hủy.
3. Diễn tập dọn trên bản khôi phục riêng; so sánh NGUON80, tài khoản/quyền/danh mục dùng chung, kiểm tra FK và dữ liệu điểm/chứng cứ.
4. Chỉ áp dụng danh sách đã xác minh, trong transaction có kiểm tra đích và snapshot; kiểm chứng sau commit. Dừng đúng các tiến trình test local rồi xóa DB cũ đã sao lưu.

## Bảo vệ

- Giữ đợt `NGUON80-2026` (`57e978c3-8870-4755-a20c-bd898304543a`) và toàn bộ dữ liệu, tác giả, tài khoản, tệp, chứng cứ cần thiết.
- Giữ tài khoản quản trị/điều hành cần thiết, danh mục và cấu hình/quyền hệ thống.
- Không reset DB, không sửa migration đã áp dụng, không xóa mã nguồn/bộ test hay file nguồn Excel/PDF. Backup và bằng chứng không commit.

## Phạm vi đã xác định

Giữ `NGUON80-2026`; xóa đúng 7 đợt: `MD01`, `MAU18-01-DANGKY`, `MAU18-02-DECUONG`, `MAU18-03-BAOCAO`, `DATN`, `DATN-2026`, `DATN-2026-02`.

Danh sách theo PK tại `.cache/cleanup-nguon80/plan.private.json` gồm 2.797 bản ghi trên 66 bảng: 7 đợt, 25 sinh viên, 10 giảng viên và 35 tài khoản tương ứng, cùng hồ sơ/quy trình/thông báo/phiên đăng nhập cũ. Một sinh viên cũ không thuộc đợt nào cũng được kiểm kê riêng; không thuộc 80 sinh viên nguồn. Giữ 117 tài khoản (114 tài khoản nguồn và 3 tài khoản quản trị/giáo vụ), 80 sinh viên và 33 giảng viên. Giữ nguyên toàn bộ danh mục và liên kết quyền.

Ba cụm local được xác định bằng đường dẫn thực, PostgreSQL 17, cổng và tài khoản sở hữu:

- `.cache/demo-v3/pgdata` — 55463, `utc_demo_v3`.
- `.cache/integration-ui/data` — 55451, `btl_ui`.
- `.cache/system-audit/pgdata` — 55472, `audit_owner` (bao gồm bản khôi phục diễn tập).

Không xóa bộ PostgreSQL binaries, mã nguồn test hoặc file nguồn Excel/PDF. Backup lưu ngoài các thư mục dữ liệu sẽ xóa.

## Kiểm chứng trước khi áp dụng

- `node scripts/source-dataset/backup.cjs`: tạo bản sao public schema và data, SHA-256 `813a6a8cb568b7cb4379ab6cf408f4e3b7b097fd1b59a3a6414ac414f214fe0e`, 4.177.381 byte. File chứa hash mật khẩu, được giữ riêng trong `.cache/source-dataset/backups/2026-11-19T13-26-23-396Z/`.
- `node .cache/cleanup-nguon80/local-restore.cjs restore`: khôi phục vào DB local mới, xác nhận 8 đợt/105 sinh viên trước khi dọn. Loại duy nhất mục tạo schema `public` đã có sẵn khỏi TOC; không bỏ qua lỗi restore.
- `node .cache/cleanup-nguon80/cleanup.cjs rehearse`: PASS trên bản khôi phục mới lúc 20:40 ngày 19/11/2026. Xóa 2.797 bản ghi; checksum của **mọi bản ghi giữ lại trên 103 bảng** trùng trước/sau. Kiểm tra toàn bộ FK không có tham chiếu đứt; trạng thái cả 54 trigger người dùng trùng trước/sau. Chỉ còn NGUON80 và 80 sinh viên trong đợt.
- Giao dịch bảo trì giữ nguyên FK, khóa ghi các bảng trong thời gian chạy và kiểm tra từng bản ghi xóa còn khớp snapshot. Chỉ tạm ngắt 15 trigger đã được chứng minh chặn xóa lịch sử trên bản sao; bật lại trước commit. Gỡ hai con trỏ nullable của **bản ghi sẽ xóa** để giải vòng FK. Mọi lỗi đều rollback cả dữ liệu và DDL. Không thay đổi schema/RBAC lâu dài.
- `node .cache/cleanup-nguon80/local-backup.cjs files`: PASS, sao lưu và giải nén so sánh từng byte của 126 tệp kho đang dùng và 6 tệp kho UI cũ.

## Kết quả Supabase

`node .cache/cleanup-nguon80/cleanup.cjs apply`: COMMIT thành công. Xóa 7 đợt và 2.797 bản ghi đã xác định. Không thay đổi project Supabase, migration, danh mục hoặc RBAC.

Kiểm chứng sau commit:

- `node .cache/cleanup-nguon80/verify.cjs`: PASS lúc 20:50 ngày 19/11/2026. Cả **11.987 bản ghi giữ lại** trên 103 bảng đều trùng nguyên bản; mọi ID cần xóa đã mất; cả 54 trigger giữ trạng thái ban đầu. Chỉ còn 1 đợt NGUON80, 80 sinh viên, 33 giảng viên, 117 tài khoản.
- `node scripts/source-dataset/verify-workflow.cjs`: PASS. 68 đề tài/68 tên khác nhau, 112 phiên bản sealed, 48 hồ sơ đã tiếp nhận, 44 kế hoạch, 40 báo cáo tuần/80 tệp, 36 đánh giá tiến độ, 32 báo cáo cuối, 28 xác nhận/đủ điều kiện, 4 hội đồng/24 phân công, 20 phản biện.
- `node scripts/source-dataset/verify-defense.cjs`: PASS. 21 liên kết quyền đã duyệt còn nguyên; 4 lịch công bố/20 sinh viên; 16 phiếu phản biện; 48 phiếu hội đồng/12 sinh viên; 8 kết quả đúng công thức, 4 công bố; 15 biểu mẫu đúng hash/chữ ký tệp.
- HTTP trực tiếp: UI 5183 trả 200; API 3011 trả 401 cho truy cập chưa đăng nhập, đúng yêu cầu xác thực. Đây không phải kiểm chứng đầy đủ giao diện sau cleanup.

## Kết quả local và trạng thái cuối

- `node .cache/cleanup-nguon80/local-backup.cjs old`, `... resume integration --force-rebuild`, `... resume audit`: cả 3 cụm PASS. Demo có 7 DB; integration có 70 DB; audit có 26 DB (các số bao gồm database `postgres` mặc định). Bản sao đã giải nén, so sánh từng byte và khởi động PostgreSQL 17 để đọc danh sách database/đợt. Bản nén dở do timeout không được coi là backup hợp lệ; đã nén lại và kiểm chứng bản hoàn chỉnh.
- `node .cache/system-audit/verify-final-reads.cjs`: PASS sau khi dọn Supabase. Cả 8 kết quả còn đúng trạng thái hiện tại, so sánh 3 trang và một trang lọc công bố với danh sách đầy đủ đều trùng. Tổng 64 hồ sơ trong danh sách kết quả, gồm 52 chưa đủ dữ liệu, 4 sẵn sàng, 4 chốt và 4 công bố; đúng phân bố các giai đoạn của bộ dữ liệu.
- `& .\.cache\cleanup-nguon80\remove-local.ps1`: PASS lúc 21:01 ngày 19/11/2026. Xóa 3 thư mục DB local đã dừng, thư mục bản khôi phục tạm và kho upload của UI cũ. Xóa 14 tệp của dữ liệu cũ trong kho chung sau khi xác nhận không còn tham chiếu và có backup. Kiểm SHA-256 toàn bộ **112 tệp NGUON80** trước/sau đều đạt. 48 PDF hồ sơ NGUON80 lưu trong DB cũng được đối chiếu qua kiểm tra 11.987 bản ghi.
- Script xóa kiểm đường dẫn tuyệt đối/đường dẫn thực, không có reparse point, trạng thái dừng, số tệp và hash backup trước thao tác đầu tiên. Một lần chạy đã dừng trước khi xóa vì cách PowerShell duyệt mảng JSON; đã sửa cách đọc mảng và kiểm chứng lại đầy đủ, không bỏ kiểm tra tham chiếu.

Các bản sao lưu hoàn chỉnh giữ tại `.cache/cleanup-nguon80/backups/`; dump Supabase giữ tại thư mục đã nêu ở trên. Các file private chứa dữ liệu cá nhân/hash mật khẩu, không đưa vào Git hoặc chia sẻ công khai.

Trạng thái: **hoàn tất dọn dữ liệu cũ**. Supabase chỉ còn đợt NGUON80; 3 cụm DB test local đã xóa. Giữ ứng dụng thật tại `http://127.0.0.1:5183` và backend 3011. Không thay đổi code ứng dụng trong nhiệm vụ cleanup; không chạy lại toàn bộ unit test vì chỉ thêm tài liệu và công cụ bảo trì riêng trong `.cache/`. Kiểm chứng tích hợp dữ liệu thật đã chạy như trên; chưa thực hiện lại toàn bộ giao diện từng vai trò.
