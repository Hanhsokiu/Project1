# Tối ưu truy cập Supabase chung — 29/10/2026

## Kết quả đã đo

Trên Windows hiện tại, Vite dev + NestJS + Supabase Project1 transaction pooler, dashboard admin trong browser context mới:

| Giai đoạn | Thời gian tải dashboard |
| --- | --- |
| Sau xử lý đầy session pool, trước tối ưu tải trang | 31,9 giây |
| Chỉ chạy song song request và bỏ truy vấn me lặp | 33,3 / 23,2 giây |
| Thêm Prisma JOIN relations và dùng lại snapshot ngắn hạn | 11,6 / 8,8 giây |

Đây là phép đo chức năng trên mạng thật, không phải benchmark tải ba người đồng thời; kết quả phụ thuộc mạng, tải Supabase và dev server. Các request dashboard trong hai lượt cuối trả 200, không có page error. Không tăng timeout để che lỗi. Bằng chứng local: `.cache/shared-dev/performance-joins-verification.json` (không chứa token, không commit).

## Thay đổi

- Prisma 5.22 bật `relationJoins` trong generator: mặc định tải relations bằng JOIN thay vì nhiều truy vấn đi qua Internet. Đây là tính năng Preview của Prisma 5.22; không đổi phiên bản, không đổi bảng/migration. Nếu một truy vấn cụ thể gặp vấn đề, có thể chọn `relationLoadStrategy: 'query'` cho truy vấn đó. Nguồn: [Prisma JOIN strategies](https://www.prisma.io/blog/prisma-orm-now-lets-you-choose-the-best-join-strategy-preview).
- `/auth/me` trả DTO mà guard vừa tải và kiểm tra cho cùng request, loại trường nội bộ `sub`, `userId`, `sid`; không truy vấn lại hồ sơ lần thứ hai.
- Gộp các lần đọc user/session đang diễn ra; xóa promise khi hoàn tất/thất bại. Không lưu kết quả quyền/khóa tài khoản/thu hồi phiên cho request sau.
- Tải đăng ký song song với workflow; trong mỗi đợt, phân công/đề tài/outbox chạy song song; thông báo cá nhân không phải chờ các đợt hoàn tất. Giữ nguyên lọc role, điều kiện công bố và API lỗi, không fallback dữ liệu giả.
- Snapshot frontend có staleTime 15 giây, key theo access token; mutation vẫn invalidate ngay, polling 30 giây vẫn giữ. Giảm tải lại khi các component mount/chuyển trang. Backend vẫn kiểm quyền từng request.
- Backend session pooler mặc định giới hạn 3 kết nối nếu URL chưa đặt. Runtime local dùng transaction pooler 6543, `pgbouncer=true`, giới hạn 5; DIRECT_URL giữ session pooler cho migration.

## Thành viên cập nhật

Sau khi nhận code mới, dừng backend đang chạy trước khi sinh Prisma Client để tránh DLL bị khóa:

Nếu máy đã đang chạy bản mới thì chỉ mở http://localhost:5173, không chạy thêm phiên dev. Máy người phụ trách có thể đang chạy server nền từ phiên kiểm tra; Ctrl+C ở một terminal khác không dừng được server nền đó. Cần xác minh PID của đúng backend/watcher và Vite trước khi dừng, không tắt toàn bộ Node. `EPERM ... query_engine-windows.dll.node` nghĩa là cần giải phóng DLL trước khi generate; `Port 5173 is already in use` nghĩa là frontend đang chiếm cổng. Không chạy tiếp dev sau khi generate thất bại.

```powershell
pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw 'Install failed; stop here.' }
pnpm --filter @doan/backend prisma generate
if ($LASTEXITCODE -ne 0) { throw 'Generate failed; stop old backend before retrying.' }
pnpm dev
```

Không chạy migration hoặc seed. Tự cấu hình DATABASE_URL theo transaction URL Dashboard, thêm `sslmode=require&pgbouncer=true&connection_limit=3` (hoặc 5 sau khi đo). DIRECT_URL giữ kết nối migration thích hợp. Không copy credential vào Git/chat; mỗi máy chỉ chạy một backend. File `.env` không đi theo git pull.

## Kiểm chứng và giới hạn

- Backend: 208 unit tests PASS; build PASS.
- Frontend: 129 tests PASS, gồm test chặn request đăng ký chậm; build PASS.
- SELECT trong transaction READ ONLY đối chiếu identity include bằng `join` và `query` trên 3 tài khoản (bỏ khác biệt thứ tự collection): khớp toàn bộ trường, gồm user roles/permissions/profile.
- Browser: dashboard admin hai context mới, tất cả API tải trang trả 200, không page error; dùng phiên hiện có, không tạo login session mới, không ghi dữ liệu.
- Chưa chạy lại toàn bộ thao tác ghi E2E bước 1–8 trên Supabase chung. Chưa đo ba người đồng thời, chưa khẳng định mọi trang nhanh dưới một giây. Trang tổng quan vẫn tải nhiều module; tối ưu thêm cần tách dữ liệu theo từng màn thay vì snapshot toàn ứng dụng và có thể đặt backend gần DB.
- Không chạy migration, reset, seed hoặc đổi chính sách Supabase trong lượt tối ưu này. Prisma relationJoins là đổi client, không cần thay schema database.
