# Hệ Thống Quản Lý Đồ Án Tốt Nghiệp

## Giới thiệu
Hệ thống quản lý đồ án tốt nghiệp dành cho khoa/bộ môn đại học, hỗ trợ toàn bộ quy trình từ đăng ký đến bảo vệ.

## Stack
- **Backend**: NestJS + Prisma + PostgreSQL
- **Frontend**: React + Vite + TypeScript + shadcn/ui + Tailwind
- **Monorepo**: pnpm workspaces
- **Infrastructure**: Docker Compose

## Yêu cầu
- Node.js >= 20
- pnpm >= 9
- Docker Desktop

## Cách chạy nhanh

```bash
# 1. Copy biến môi trường
cp .env.example .env

# 2. Khởi động toàn bộ hệ thống
make up

# 3. Chạy migration và seed
make migrate
make seed

# 4. Truy cập
# Frontend: http://localhost:5173
# Backend API: http://localhost:3000/api
# Swagger: http://localhost:3000/api/docs
# MailHog: http://localhost:8025
```

## Lệnh thường dùng

| Lệnh | Mô tả |
|---|---|
| `make up` | Khởi động toàn bộ Docker services |
| `make down` | Dừng Docker services |
| `make test` | Chạy toàn bộ test |
| `make migrate` | Chạy database migration |
| `make seed` | Chạy seed dữ liệu mẫu |
| `make logs` | Xem logs |
| `make studio` | Mở Prisma Studio |

## Cấu trúc thư mục

```
do-an-tot-nghiep/
├── backend/          # NestJS API server
├── frontend/         # React + Vite client
├── database/         # Migrations & seeds (Prisma)
├── docs/             # Tài liệu dự án
├── infra/            # Nginx, CI scripts
└── docker-compose.yml
```

## Đóng góp
1. Tạo nhánh từ `main`: `git checkout -b feat/UC01-auth`
2. Commit theo convention: `feat: UC01 đăng nhập JWT`
3. Tạo Pull Request, CI phải xanh trước khi merge

## Tài liệu
- [Đặc tả Use Case](docs/spec/)
- [ERD](docs/erd/)
- [API Docs](http://localhost:3000/api/docs)
- [ADR](docs/adr/)
