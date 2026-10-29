# Hệ Thống Quản Lý Đồ Án Tốt Nghiệp

## Giới thiệu
Hệ thống quản lý đồ án tốt nghiệp dành cho khoa/bộ môn đại học, hỗ trợ toàn bộ quy trình từ đăng ký đến bảo vệ.

B?n t?ch h?p b??c 1?3 g?m API auth, danh m?c, k?/??t, import, ??ng k?, ph?n c?ng v? ?? c??ng/PDF. N?n workflow PR2B ???c gi? l?i. Xem [ghi ch? t?ch h?p v? ki?m ch?ng](docs/implementation/cherry-pick-step1-3.md).

## Môi trường nhóm và hướng dẫn người dùng

- [Hướng dẫn kết nối Supabase và tạo database bước 1–8](docs/implementation/supabase-steps1-8-setup.md)
- [Đề xuất mới: Windows + Supabase DB/Storage + truy cập riêng cho nhóm](docs/implementation/windows-supabase-shared-proposal.md)
- [Thiết lập một backend, database và kho file chung](docs/implementation/team-shared-environment.md)
- [Hướng dẫn thao tác và tìm lỗi bước 4–8 theo từng vai trò](docs/implementation/user-guide-steps4-8.md)

## Stack
- **Backend**: NestJS + Prisma + PostgreSQL
- **Frontend**: React + Vite + TypeScript + shadcn/ui + Tailwind
- **Monorepo**: pnpm workspaces
- **Infrastructure**: Docker Compose

## Yêu cầu
- Node.js >= 20
- pnpm >= 9
- Docker Desktop (chỉ cần khi chạy bằng Docker)
- Python >= 3.10 chỉ cần khi người tích hợp tái sinh artifact PR2B (`pr2b:prepare`); code/check hằng ngày dùng artifact đã có.

## Bắt đầu cho nhóm ba người

Xem [hướng dẫn chia việc, contract và môi trường local](docs/implementation/03-team-development-guide.md).

Để xem bản giao diện đã merge với database riêng và tài khoản mẫu trên máy Windows, xem [hướng dẫn UI local](docs/implementation/integration-ui-local.md) (`pnpm ui:prepare`, `pnpm ui:dev`, `pnpm ui:sample`).
Để có hồ sơ và nhiệm vụ thao tác bước 4–8 trên cùng UI, chạy `pnpm ui:workflow`; xem [tài khoản, đợt demo và link kiểm tra](docs/implementation/integration-ui-workflow-demo.md).
Phân công: người 1 bước 1–3, người 2 bước 4–8, người 3 bước 9–10; schema/migration dùng chung một cây.

```powershell
pnpm install --frozen-lockfile
pnpm setup:dev
pnpm verify
# Khi Docker Desktop hoạt động, dùng DB riêng trên máy:
pnpm db:local:init
pnpm db:local:up
pnpm db:local:migrate
pnpm dev:local
```

Setup giữ nguyên env đang có; verify không thực hiện DDL. `dev:local` và migrate local
chỉ dùng container PostgreSQL17 đã xác minh ở 127.0.0.1:55440, không dùng URL Supabase trong env.
Schema expand và migration đã có trong repository; chưa deploy lên Supabase chung.

## Cấu hình Supabase và chạy dev

Kiến trúc giữ React → NestJS (JWT/RBAC) → Prisma → Supabase PostgreSQL.
Không cần Supabase Auth/SDK keys để dùng Prisma.

Copy `backend/.env.example` thành `backend/.env`, điền DATABASE_URL/DIRECT_URL từ
Dashboard → Connect và sinh JWT secrets riêng. Copy `frontend/.env.example` thành
`frontend/.env.local`. Các file thật được Git bỏ qua; không đưa credentials vào VITE_*.
Root `.env` chỉ dùng Docker interpolation, không phải env ứng dụng.

```powershell
pnpm --filter @doan/backend prisma validate
pnpm --filter @doan/backend prisma generate
pnpm dev
```

Docker mặc định dùng database đã cấu hình trong backend/.env, không chạy Postgres local:

```powershell
docker compose up -d --build
```

Database local chỉ bật bằng profile và override riêng; xem
[hướng dẫn cấu hình và kiểm tra Supabase](docs/implementation/02b-supabase-configuration.md).
CI vẫn dùng database PostgreSQL test riêng, không database nhóm.

## Kiểm tra trước migration

```powershell
pnpm --filter @doan/backend db:inspect
```

Đặt DB_INSPECT_HOST khớp host trong DIRECT_URL. Lệnh chỉ đọc catalog/count/history,
không thay schema hay dữ liệu. `make migrate` chỉ hướng dẫn kiểm tra và phê duyệt;
không còn gọi db push. Deploy chỉ qua gate đích được duyệt, xem tài liệu trên.
Chưa chạy migration/seed lên DB chung khi chưa kiểm history và backup.

Frontend: http://localhost:5173; API: http://localhost:3000/api;
Swagger ngoài production: http://localhost:3000/api/docs.

## Lệnh thường dùng

| Lệnh | Mô tả |
|---|---|
| `make up` | Khởi động toàn bộ Docker services |
| `make down` | Dừng Docker services |
| `make test` | Chạy toàn bộ test |
| `make migrate` | Hướng dẫn kiểm tra/review; không thực hiện DDL |
| `make seed` | Chỉ hiển thị hướng dẫn; không có seed tự động |
| `make logs` | Xem logs |
| `make studio` | Mở Prisma Studio |

## Cấu trúc thư mục

```
do-an-tot-nghiep/
├── backend/          # NestJS API server
├── frontend/         # React + Vite client
├── database/         # SQL lịch sử và seed tham chiếu
├── docs/             # Tài liệu dự án
├── infra/            # Nginx, CI scripts
└── docker-compose.yml
```

Migration chuẩn ở `backend/prisma/migrations/`, không chạy lại cây SQL lịch sử song song.

## Đóng góp
1. Tạo nhánh từ `main`: `git checkout -b feat/UC01-auth`
2. Commit theo convention: `feat: UC01 đăng nhập JWT`
3. Tạo Pull Request, CI phải xanh trước khi merge

## Tài liệu
- [Đặc tả Use Case](docs/spec/)
- [ERD](docs/erd/)
- [API Docs](http://localhost:3000/api/docs)
- [ADR](docs/adr/)
