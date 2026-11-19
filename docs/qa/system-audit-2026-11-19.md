# Kiểm tra hệ thống ngày 19/11/2026

Trạng thái tại thời điểm audit: phát hiện 3 lỗi timeout. Xem [bản sửa và kết quả kiểm tra tiếp theo](timeout-fix.md); số liệu dưới đây giữ làm baseline.

## Kế hoạch và tiêu chí

1. Kiểm tra toàn bộ TypeScript, lint, build và unit test của backend/frontend; ghi rõ số bài đạt, lỗi và cảnh báo.
2. Chạy kiểm tra công cụ/migration và các bộ browser regression cô lập hiện có; giữ nguyên assertion, không đổi cấu hình để che lỗi.
3. Kiểm tra server đang chạy và dữ liệu NGUON80 bằng thao tác chỉ đọc; đo lại các luồng tải chậm khi có thể.
4. Đối chiếu lỗi với implementation, lưu bằng chứng trong `.cache/system-audit/`, tổng hợp mức độ ảnh hưởng và phần chưa được kiểm chứng.

Không reset database, không thay dữ liệu nghiệp vụ trên Supabase và không tự commit/push. Bộ browser dùng fixture không thay thế bằng chứng tích hợp API thật. Test tích hợp ghi dữ liệu chỉ chạy nếu xác minh được database kiểm thử riêng.

## Kết quả

Đã tìm thấy **3 lỗi hiệu năng còn tồn tại** trên NGUON80. Các kiểm tra compile/lint/build, unit, tích hợp và luồng trình duyệt bên dưới đã qua; chưa thể kết luận toàn hệ thống không có lỗi.

### Lỗi cần sửa

Đo lúc 15:30–15:33 ngày 19/11/2026, giờ Việt Nam, bằng service/repository thực tế và tài khoản Khoa của đợt. Mỗi transaction bị ép `READ ONLY`; giữ nguyên isolation và timeout repository. Đây là đo service, chưa phải thời gian HTTP/UI.

| Mã | Ưu tiên | Luồng | Kết quả | Ảnh hưởng |
|---|---|---|---|---|
| PERF-01 | Cao | Xét điều kiện bảo vệ — danh sách | 20.716 ms, 235 truy vấn, `P2028` | Không trả danh sách trong lần đo |
| PERF-02 | Cao | Kết quả bảo vệ — danh sách | 60.540 ms, 724 truy vấn, `P2028` | Không trả danh sách kết quả trong lần đo |
| PERF-03 | Cao | Báo cáo bảo vệ — options sau khi chọn đợt | 60.076 ms, 767 truy vấn, `P2028` | Không tải được dữ liệu bộ lọc trong lần đo |

Tái hiện bằng `.cache/system-audit/profile-shared.cjs`, chạy trong đúng môi trường dự án. Không thử chỉnh timeout để làm test đạt. Frontend dùng timeout 20.000 ms tại `frontend/src/shared/api/http-client.ts:12`; vì vậy hai transaction 60 giây cũng vượt ngân sách frontend.

Đối chiếu code:

- `backend/src/defense/eligibility/eligibility.service.ts:171`: đọc/kiểm tra từng thành viên trước phân trang; repository giới hạn 20 giây.
- `backend/src/defense/final-results/final-result.service.ts:517`: gọi `inspect` tuần tự từng thành viên, thu thập nguồn điểm rồi mới lọc/phân trang; repository giới hạn 60 giây.
- `backend/src/report/defense-reporting/report.service.ts:154`: options gọi `reader.collect`; `report.reader.ts:277` duyệt từng ứng viên và đọc nhiều nguồn. Repository giới hạn 60 giây.

Đây là bằng chứng về truy vấn lặp và chi phí dựng dữ liệu trước phân trang; chưa có bản sửa trong lần audit này. Ưu tiên giảm số lần đọc và gom truy vấn theo lô, đồng thời giữ quyền, phạm vi, tính nhất quán và kiểm tra chứng cứ.

Ba luồng đã tối ưu trước đó trả được dữ liệu: workspace hội đồng 9.455 ms; chấm phản biện 14.552 ms/20 bản ghi; chấm hội đồng 14.234 ms/20 bản ghi trang đầu, tổng 96. Chưa bảo đảm mọi lần gọi đều dưới 20 giây.

### Kiểm tra đã chạy

| Kiểm tra | Kết quả |
|---|---|
| `corepack pnpm -r type-check`, `-r lint`, `-r build` | Qua cả frontend/backend/shared theo scripts hiện có |
| Backend `test:cov` | Qua 79 file unit test; URL local giả, không kết nối Supabase |
| Frontend `test` | 403 test/64 file qua |
| HTTP bước 1 và 2 | 11 + 11 kiểm tra qua |
| Opt-in integration | 25 test/4 file qua: import, đợt, phân công tự động, bàn giao workflow |
| Bước 4–8 API và upgrade | 14 lượt đều qua, mỗi lượt dùng database mới |
| Trình duyệt → API → PostgreSQL | Luồng 4→5→6→7→8A→8B→8C qua 15 checkpoint; PDF/ZIP thật, nhiều vai trò, không mock API |
| Quyền endpoint bước 4–8 | 78 operation từ chối anonymous; kiểm tra user thiếu quyền và phạm vi cũng qua |
| UI fixture | 22 nhóm kiểm tra qua, 5 độ rộng 320/390/768/1024/1440; menu/dialog bằng bàn phím; Axe trang tài khoản |
| Data consistency browser | Chuyển đợt, nhiệm vụ, nộp bài, đánh giá qua; API fixture cô lập |
| Review SQL và active migration chain | Qua trên PostgreSQL 17 riêng |
| `foundation-check.cjs` | Qua |
| Python 3.13 migration checker | 23 test qua |
| Release source/assets | 1.637 file được quét; frontend và backend assets qua |
| NGUON80 chỉ đọc | Điểm/quyền/lịch sử đối chiếu qua; 68 tên đề tài khác nhau, 80 tệp nộp bài, 8 kết quả/4 công bố, 15 biểu mẫu |

Coverage backend: statements/lines **38,8%**, branches **83,92%**, functions **61,28%** trong báo cáo coverage của unit test. Kết quả này không chứng minh toàn bộ nghiệp vụ đã được bao phủ.

### Lệnh đã chạy

```powershell
corepack pnpm -r type-check
corepack pnpm -r lint
corepack pnpm -r build
# Unit: NODE_ENV=test, DATABASE_URL/DIRECT_URL trỏ local không dùng được.
corepack pnpm --filter @doan/backend test:cov
corepack pnpm --filter @doan/frontend test
node .cache/system-audit/run.cjs review-sql
node .cache/system-audit/run.cjs active-chain
node .cache/system-audit/run.cjs suite
node .cache/system-audit/run.cjs e2e
node .cache/system-audit/run.cjs step123
node frontend/scripts/test-ui-redesign-browser.cjs
node frontend/scripts/test-data-consistency-browser.cjs
node backend/scripts/foundation-check.cjs
# Chạy ở backend:
py -3.13 scripts/prepare-uc17-24.check.py
# Chạy ở root:
node scripts/check-release-source.cjs
node scripts/check-production-assets.cjs --frontend frontend/dist
node scripts/check-production-assets.cjs --backend backend/dist
node .cache/system-audit/profile-shared.cjs
node scripts/source-dataset/verify-workflow.cjs
node scripts/source-dataset/verify-defense.cjs
```

Các lệnh trên cần cấu hình và dependencies local; không sao chép credential vào lệnh. Công cụ audit tạo mỗi database mới và không có thao tác drop/reset. Lần thử đầu lỗi do sandbox hoặc thiếu bootstrap được phân biệt với kết quả cuối; không bỏ assertion.

### Giới hạn

- Bộ công cụ Node: 79/80 test qua; 1 test SQL RBAC dừng vì yêu cầu Docker riêng. Không hạ gate hoặc chạy nó lên Supabase. Các SQL rehearsal khác dùng PostgreSQL 17 portable.
- Python 3.11 lỗi cú pháp f-string; Python 3.13 qua. README hiện ghi tối thiểu 3.10, chưa phù hợp với script này. Không phải lỗi chạy ứng dụng.
- Chưa kiểm SMTP/email thật, S3/Supabase Storage từ backend máy khác, tải đồng thời, khôi phục backup, hoặc trình duyệt Firefox/Safari.
- Chưa chạy chính lệnh Vercel dùng cú pháp shell Linux trên Windows; build thường và kiểm assets đã qua. Chưa chạy lại GitHub CI.
- Chưa kiểm lại UI có xác thực UC18–25 bằng phiên Khoa hiện tại; không reset mật khẩu. Các ca service/DB và fixture không thay thế kiểm tra đó. Trang đăng nhập thật 5183 mở được, không tràn ở 375 px.
- Không ghi dữ liệu nghiệp vụ Supabase. Test ghi dùng cluster riêng ở loopback 55472; đã dừng, giữ database để tra cứu. Không commit/push. Các artifact cũ được giữ nguyên.

### Bằng chứng

Trong `.cache/system-audit/`: `shared-read-profiles.json`, `integration-vitest.json`, `step123.log`, `database-suite.log`, `live-e2e.log`, `review-sql.log`, `ui-browser/result.json`. Bản mới của artifact lưu trong `evidence-after/`; file cũ đã được khôi phục. Không commit thư mục cache.
