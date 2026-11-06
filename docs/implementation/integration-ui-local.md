# Xem giao diện bản merge trên máy

> **Cập nhật 27/10/2026:** đã có đợt **DEMO 4–8 · Hồ sơ, xét duyệt và hướng dẫn** trên cùng DB UI. Sv001 sửa đề cương, gv003 duyệt, giaovu chốt, gv001/sv004 thử hướng dẫn/nộp bài. Xem [tài khoản, link thao tác và bằng chứng](integration-ui-workflow-demo.md). Đợt đăng ký cũ được giữ nguyên.

Ngày chuẩn bị: 26/10/2026. Nhánh `fix/integration-ui` được tạo đúng từ `origin/develop` tại `0c36170`.

Hai phần còn thiếu khi kiểm tra là frontend chưa bật API thật và Supabase đang cấu hình chưa có lịch sử migration của dự án. Không chạy migration/seed lên Supabase trong lần chuẩn bị này.

## Môi trường đã chuẩn bị

- Giao diện: http://127.0.0.1:5173
- API: http://127.0.0.1:3000/api
- Swagger: http://127.0.0.1:3000/api/docs
- PostgreSQL 17 riêng: `127.0.0.1:55451/btl_integration_ui`.
- Có đủ 12 migration. Database, cấu hình bí mật, file upload và log nằm trong `.cache/integration-ui/`, được Git bỏ qua.
- `backend/.env` và database Supabase được giữ nguyên. Script local truyền URL database riêng qua environment khi chạy.
- `frontend/.env.local` đã bật toàn bộ cờ API thật và trỏ về API cục bộ.
- SMTP worker tắt trong môi trường này để việc thử giao diện không gửi email ra ngoài.
- Đã kiểm tra bằng Edge với đăng nhập thật: admin/tài khoản, giáo vụ/đợt, sinh viên/đăng ký, giảng viên/kết quả phân công. Cả bốn tải được trang, không có lỗi React hoặc HTTP 500. Scope giáo vụ đã đọc được đợt mẫu ở API nhóm duyệt.

## Đăng nhập

Mật khẩu mẫu cho tất cả tài khoản dưới đây: `Demo@2026`.

| Tên đăng nhập | Vai trò |
| --- | --- |
| `admin` | Quản trị tài khoản/danh mục |
| `giaovu` | Giáo vụ, đợt và phân công |
| `sv001` đến `sv004` | Sinh viên trong đợt mẫu |
| `gv001` đến `gv004` | Giảng viên trong đợt mẫu |

Đây là dữ liệu giả lập trong database riêng. Đợt mẫu bắt đầu ở giai đoạn đăng ký, chưa tạo phân công chính thức, phê duyệt hay biên nhận. Dùng các vai trò để thực hiện quy trình thật trên giao diện. Các giai đoạn được đặt theo thứ tự; muốn thử bước sau cần điều chỉnh thời gian/trạng thái theo quy trình và bổ sung các cấu hình workflow đã nêu trong báo cáo merge.

## Chạy lại sau này

Từ thư mục gốc dự án:

```powershell
pnpm ui:dev
```

Lệnh này khởi động PostgreSQL riêng nếu cần, chạy frontend Vite và backend NestJS ở chế độ watch. Không chạy thêm `pnpm dev` song song vì sẽ trùng cổng và có thể dùng database trong `.env`.

Nếu phiên UI đã chạy, `ui:dev` báo `Local UI is already running` và địa chỉ truy cập, rồi kết thúc thành công mà không mở thêm server. Nếu cổng 3000 hoặc 5173 bị chiếm nhưng không nhận diện được phiên UI, lệnh báo cổng đang bận trước khi chạy các tiến trình watch. Dừng phiên dev cũ bằng Ctrl+C ở terminal tương ứng rồi chạy lại; không cần tắt các tiến trình Node khác.

Khi thiết lập lại trên máy mới:

```powershell
# Chỉ cần đặt nếu PostgreSQL binaries không ở vị trí đã phát hiện trên máy hiện tại:
$env:BTL_POSTGRES_BIN = 'C:\duong-dan\postgresql\bin'
pnpm ui:prepare
pnpm ui:dev
# Terminal thứ hai, sau khi API sẵn sàng:
pnpm ui:sample
# Thêm một đợt riêng có hồ sơ và nhiệm vụ bước 4–8:
pnpm ui:workflow
```

`ui:sample` giữ nguyên dữ liệu nếu đã tạo trước đó. `ui:prepare` chỉ migrate/seed database UI riêng.

Sau khi dừng dev bằng Ctrl+C, có thể dừng PostgreSQL mà vẫn giữ dữ liệu:

```powershell
pnpm ui:stop
```

Phiên dev khởi động sẵn trong lần chuẩn bị này chạy nền; PID và log nằm tại `.cache/integration-ui/dev.pid`, `dev.log`, `dev-error.log`. Không xóa thư mục `data` nếu muốn giữ các thao tác đã thử.
