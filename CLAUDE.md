# CLAUDE.md – Hướng dẫn AI (Claude Code / Antigravity)

## Mục tiêu dự án
Hệ thống quản lý đồ án tốt nghiệp (QLĐATN) cho khoa đại học:
- Quản lý đăng ký, phân công, đề tài, hướng dẫn và bảo vệ tốt nghiệp
- Hỗ trợ 5 vai trò: Admin, Khoa, Giảng viên, Sinh viên, Hội đồng
- ~25 Use Case, 57 bảng trong PostgreSQL

## Stack
- **Backend**: NestJS (TypeScript), Prisma ORM, PostgreSQL
- **Frontend**: React 18, Vite, TypeScript, TanStack Query, shadcn/ui, Tailwind CSS
- **Monorepo**: pnpm workspaces (`backend/`, `frontend/`, `shared/`)
- **Auth**: JWT (access + refresh token), RBAC với Permission
- **Email**: Nodemailer + MailHog (dev)
- **File**: Local storage (dev), cấu hình S3 (prod)
- **Testing**: Vitest, Supertest, Testcontainers

## Cấu trúc module backend (NestJS)
Mỗi module theo khuôn:
```
<module>/
├── controller/   # Nhận request, kiểm quyền @RequirePermission, gọi service
├── dto/request/  # Zod schemas + NestJS DTOs
├── dto/response/ # Response DTOs
├── service/      # Nghiệp vụ, mỗi Use Case một method
├── domain/       # Prisma types + enums
├── repository/   # Prisma queries
├── mapper/       # entity <-> DTO
├── validator/    # Business rules (BR-xx, AC-xx)
└── event/        # Domain events (nếu cần)
```

## Quy tắc bắt buộc
1. **Mỗi ràng buộc nghiệp vụ (BR/AC) có một Validator class và ít nhất 2 test** (ca đúng + ca vi phạm)
2. **Controller không chứa nghiệp vụ** – chỉ validate request, kiểm quyền, gọi service
3. **Service không gọi thẳng Prisma** – gọi qua Repository
4. **Dùng `@RequirePermission('permission:action')`** cho mọi endpoint cần phân quyền
5. **Luôn trả về `ApiResponse<T>`** từ controller
6. **Dùng Zod** để validate input ở cả frontend form lẫn backend DTO
7. **Không sửa migration đã chạy** – chỉ thêm file migration mới

## Quy ước đặt tên
- File: `kebab-case.ts`
- Class: `PascalCase`
- Biến/hàm: `camelCase`
- Constant: `UPPER_SNAKE_CASE`
- Enum value: `UPPER_SNAKE_CASE`
- Database table: `UPPER_SNAKE_CASE`
- Database column: `snake_case`

## Quy tắc phụ thuộc module
- `auth` ← không phụ thuộc module nào
- `catalog` ← `auth`
- `term` ← `auth`, `catalog`
- `registration` ← `term`
- `topic` ← `registration`
- `guidance` ← `topic`
- `defense` ← `guidance`
- `grading` ← `defense`
- `report` ← tất cả
- `notification` ← tất cả (listen events)

## Cách làm theo Use Case
Khi được yêu cầu làm một UC, làm theo thứ tự:
1. Migration Prisma (nếu cần bảng mới)
2. Repository + Service
3. Validator (mỗi BR/AC)
4. DTO (request + response)
5. Controller + endpoint
6. Test (unit + integration)
7. Frontend page + API hook

## Thứ tự ưu tiên
UC01 (Auth) → UC04-06 (Catalog) → UC07-08 (Term) → UC09-10 (Registration) → UC11-13 (Topic) → UC14-17 (Guidance) → UC18-21 (Defense) → UC22-24 (Grading) → UC25 (Report)
