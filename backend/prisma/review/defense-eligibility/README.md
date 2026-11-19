# UC18 database review candidate v2

REVIEW ONLY — chưa áp dụng database, chưa bật writes. Candidate cho rehearsal được phê duyệt; deployment BLOCKED / NOT_VERIFIED_ON_POSTGRESQL. Không chạy trong startup hoặc prisma/migrations tự động.

Dependency: B1–B8 → UC17 hardened. Không chạy lại trên v1 đã apply; cần forward-fix riêng theo history/catalog. BEGIN/COMMIT; lock_timeout=5s, statement_timeout=60s. SQL không idempotent; nếu sai metadata thì dừng, không tự sửa dữ liệu/quyền.

Thay đổi v2: status NULL revision>0 bị từ chối bằng explicit nonnull và IS TRUE; revision=0 giữ nullable legacy.

Mọi integrity function dùng SECURITY INVOKER, VOLATILE, search_path=pg_catalog,public và row_security=off. Đây là full-visibility requirement, không bypass RLS. Thiếu quyền hoặc RLS áp dụng sẽ lỗi; runtime role/ACL/REST vẫn cần nhóm phê duyệt. Security DDL legacy đã tách khỏi candidate, không thay trạng thái hiện hữu. UC19 assignment mới vẫn RLS default-deny/revoke public-client, chưa có runtime policy/grant được duyệt.

Preflight kiểm tra sự hiện diện cột baseline, role/key RBAC và upstream identity/config; không chứng minh toàn bộ kiểu/default/FK/ACL/function body live. Đối chiếu đầy đủ bằng metadata/rehearsal và hash package trước khi apply. Không tự approve academic policy hoặc mapping ứng dụng có trong candidate.

`schema.diff.sql` được tạo OFFLINE bằng Prisma datamodel→datamodel, không kết nối DB; chỉ diagnostic cấu trúc, không dùng thay migration.sql. UC22/23 structural diff rỗng là đúng: custom CHECK/functions/triggers vẫn phải review theo SQL. Snapshot provenance trong OFFLINE-DIFF-EVIDENCE.json. Schema hiện tại giữ nguyên; known legacy nullable status vs Prisma required được ghi trong MIGRATION-DEPENDENCIES.md.

Không cung cấp rollback.empty-only.sql vì chưa chứng minh an toàn trên catalog/history/ACL thực tế. Xem ROLLBACK-DECISIONS.md, gói UC18; không xóa legacy/audit/permissions cho đủ file. Ưu tiên forward-fix được review, kiểm chứng restore trước deploy.

Testcase liên quan: PG02/03/04/18; unit evaluator chỉ thực thi subset predicate bằng JavaScript, không chạy PL/pgSQL/RLS/trigger/MVCC. Regression/check results và PostgreSQL rehearsal matrix ở docs/implementation/uc18-uc25-database-review-v2. Kết quả thực tế chưa đủ để tuyên bố E2E DB.

V1 SQL/README được bảo toàn nguyên byte trong original-v1/defense-eligibility của ZIP. Xem FIXES-APPLIED.md và changes/defense-eligibility.patch cho line trước/sau; không dùng cả v1 lẫn v2 làm chain triển khai.

| File | SHA-256 bytes hiện tại |
| --- | --- |
| migration.sql | `5D6165CBD16902D64619E871D42D85519FA4C8CBB0DB3BE4A33F8C9C737DF389` |
| schema.diff.sql | `27AFC12BB8BED7795CE74BAE3C97BAC326E25B4DFB2D245D71A2653102F6CD57` |

README.md không tự ghi hash chính nó; toàn bộ hash có trong PACKAGE-MANIFEST.json.
