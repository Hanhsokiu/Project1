# PR2B review artifacts — reference copies

**Cập nhật sau yêu cầu hoàn thiện nền tảng cho nhóm:** schema mở rộng và hai
migration đã được kích hoạt trong repository, đã kiểm thử trên local. Các file
trong thư mục review là bản tham chiếu, không phải đường deploy thứ hai.
Chưa chạy DDL lên Supabase chung. Xem
[hướng dẫn nhóm](../../../../docs/implementation/03-team-development-guide.md).

Approval record, test results, compatibility, drift and recovery:
[02c-pr2b-sql-review.md](../../../../docs/implementation/02c-pr2b-sql-review.md).

Proposed order: unchanged `prisma/migrations/0_init/migration.sql` →
`01-empty-baseline-enum-bridge.sql` (all application tables MUST be empty) →
`02-expand.sql` (atomic additive workflow extension plus application ACL isolation).

`02-expand.sql` already embeds `02-expand.generated.sql`, `03-integrity.sql`
and `04-data-api-isolation.sql`; do not apply the fragments separately.
`fixture.sql` is synthetic test data ONLY. `residual-drift.DO-NOT-APPLY.sql`
is diagnostic output containing destructive operations; NEVER apply it.

The active deploy chain contains 0_init, 202610210001_empty_baseline_bridge and
202610210002_expand_workflow. Only use that chain; do not apply review SQL manually.
The frozen baseline.prisma is retained for compatibility checks, not application generation.

The scripts in `backend/package.json` prepare offline SQL and rehearse only on
explicit, newly-created PostgreSQL 17 databases named `btl_pr2b_*` at 127.0.0.1.
The SQL files themselves do NOT enforce a hostname: never run them manually on
the shared Supabase project. Approval of SQL is separate from approval to deploy.
