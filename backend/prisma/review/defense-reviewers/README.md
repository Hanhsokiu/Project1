# UC20 database review candidate v2

REVIEW ONLY — chưa áp dụng database, chưa bật writes. Candidate cho rehearsal được phê duyệt; deployment BLOCKED / NOT_VERIFIED_ON_POSTGRESQL. Không chạy trong startup hoặc prisma/migrations tự động.

Dependency: UC19 v2, cc_check_student; UC18/17 transitively. Không chạy lại trên v1 đã apply; cần forward-fix riêng theo history/catalog. BEGIN/COMMIT; lock_timeout=5s, statement_timeout=60s. SQL không idempotent; nếu sai metadata thì dừng, không tự sửa dữ liệu/quyền.

Thay đổi v2: state NULL bị chặn ở CHECK và INSERT DRAFT; append group DRAFT revision>1 vẫn được; deferred group không bỏ qua missing official row.

Mọi integrity function dùng SECURITY INVOKER, VOLATILE, search_path=pg_catalog,public và row_security=off. Đây là full-visibility requirement, không bypass RLS. Thiếu quyền hoặc RLS áp dụng sẽ lỗi; runtime role/ACL/REST vẫn cần nhóm phê duyệt. Security DDL legacy đã tách khỏi candidate, không thay trạng thái hiện hữu. UC19 assignment mới vẫn RLS default-deny/revoke public-client, chưa có runtime policy/grant được duyệt.

Preflight kiểm tra sự hiện diện cột baseline, role/key RBAC và upstream identity/config; không chứng minh toàn bộ kiểu/default/FK/ACL/function body live. Đối chiếu đầy đủ bằng metadata/rehearsal và hash package trước khi apply. Không tự approve academic policy hoặc mapping ứng dụng có trong candidate.

`schema.diff.sql` được tạo OFFLINE bằng Prisma datamodel→datamodel, không kết nối DB; chỉ diagnostic cấu trúc, không dùng thay migration.sql. UC22/23 structural diff rỗng là đúng: custom CHECK/functions/triggers vẫn phải review theo SQL. Snapshot provenance trong OFFLINE-DIFF-EVIDENCE.json. Schema hiện tại giữ nguyên; known legacy nullable status vs Prisma required được ghi trong MIGRATION-DEPENDENCIES.md.

Không cung cấp rollback.empty-only.sql vì chưa chứng minh an toàn trên catalog/history/ACL thực tế. Xem ROLLBACK-DECISIONS.md, gói UC20; không xóa legacy/audit/permissions cho đủ file. Ưu tiên forward-fix được review, kiểm chứng restore trước deploy.

Testcase liên quan: PG02/03/07; unit evaluator chỉ thực thi subset predicate bằng JavaScript, không chạy PL/pgSQL/RLS/trigger/MVCC. Regression/check results và PostgreSQL rehearsal matrix ở docs/implementation/uc18-uc25-database-review-v2. Kết quả thực tế chưa đủ để tuyên bố E2E DB.

V1 SQL/README được bảo toàn nguyên byte trong original-v1/defense-reviewers của ZIP. Xem FIXES-APPLIED.md và changes/defense-reviewers.patch cho line trước/sau; không dùng cả v1 lẫn v2 làm chain triển khai.

| File | SHA-256 bytes hiện tại |
| --- | --- |
| migration.sql | `0B2908058248EE8C3E066D57871E03050A98D84E2AA382284F55B585EAB91C53` |
| schema.diff.sql | `ED28871AFF771A6887734DA1ED21D5838EE04205A59D29E1C27F0D6EBF7C5268` |

README.md không tự ghi hash chính nó; toàn bộ hash có trong PACKAGE-MANIFEST.json.
