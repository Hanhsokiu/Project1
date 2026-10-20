# ADR-0002: NestJS + Prisma ORM

## Trạng thái
Đã quyết định

## Bối cảnh
Chọn framework backend và ORM.

## Quyết định
**NestJS** làm framework, **Prisma** làm ORM.

## Lý do NestJS
- Cấu trúc module/controller/service khớp với thiết kế đã có
- Dependency Injection tích hợp sẵn, dễ test
- Decorator-based → code sạch, dễ đọc
- Hỗ trợ tốt JWT, Guards, Interceptors

## Lý do Prisma
- `schema.prisma` là nguồn sự thật duy nhất về schema DB
- Sinh TypeScript types tự động → AI khó viết sai tên cột
- Prisma Studio để xem data khi dev
- Migration workflow rõ ràng

## Hệ quả
- Mỗi module có `repository/` gọi Prisma, service không gọi Prisma trực tiếp
- `schema.prisma` nằm trong `backend/prisma/`
- Cần chạy `prisma generate` sau mỗi thay đổi schema
