# ADR-0001: Monorepo TypeScript Full-Stack

## Trạng thái
Đã quyết định

## Bối cảnh
Cần chọn kiến trúc tổ chức code cho dự án QLĐATN. Hai lựa chọn chính:
- Multi-repo: backend riêng, frontend riêng
- Monorepo: tất cả trong một repo

## Quyết định
Dùng **pnpm workspaces monorepo** với TypeScript toàn bộ.

Cấu trúc:
- `backend/` – NestJS API
- `frontend/` – React + Vite
- `shared/` – Types, schemas Zod dùng chung

## Lý do
1. **Chia sẻ kiểu dữ liệu**: `shared/` package cho phép dùng cùng Zod schema ở cả form frontend và DTO backend → không bao giờ lệch nhau
2. **Một ngôn ngữ**: AI viết TypeScript đồng nhất, không lệch ngữ cảnh Java ↔ TypeScript
3. **CI đơn giản**: GitHub Actions theo path, chỉ chạy CI phần thay đổi
4. **Atomic commit**: Thay đổi API và frontend cùng một commit, dễ review

## Hệ quả
- Cần pnpm >= 9
- Mỗi workspace có `tsconfig.json` riêng, extends từ root config
- `shared` không được import từ `backend` hoặc `frontend` (chỉ chiều ngược lại)
