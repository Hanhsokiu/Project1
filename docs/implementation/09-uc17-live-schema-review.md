# UC17 — migration review theo metadata Supabase được cung cấp

09/11/2026. Project1 / feature/b9-b10-implementation, HEAD 0093f81a6017a8e046a03a8ce9786189cd5b37d8. Giữ công việc UC17–UC25 chưa commit. **Không kết nối hoặc query lại database trong lượt này; không apply SQL.**

## 1. Metadata và nguồn bằng chứng

Các kết quả sau do người dùng cung cấp từ SELECT trên Supabase chung, không phải phép đo mới của agent:

| Hạng mục | Kết quả được cung cấp |
| --- | --- |
| Migration | 17/17 B1–B8 APPLIED, không INCOMPLETE/ROLLED_BACK; chưa UC17–UC24 trong Prisma history |
| Bảng baseline | FINAL_REPORT 5 cột, DEFENSE_CONFIRMATION 7, SCORE_ENTRY 8, FILE_ASSET 11; chưa FINAL_REPORT_VERSION |
| Điểm | SCORE_ENTRY.total_score NUMERIC(4,1) |
| Unique/PK | FINAL_REPORT(proposal_id), DEFENSE_CONFIRMATION(proposal_id), SCORE_ENTRY(proposal_id,scorer_id,role), FILE_ASSET(storageKey), PERMISSION(resource,action), ROLE_PERMISSION PK(role_id,permission_id) |
| Roles | STUDENT/LECTURER/FACULTY mỗi loại đúng một record |
| File enums | Kind REPORT/SOURCE/EVIDENCE/DOSSIER_PDF/RECEIPT_SCAN; state READY/QUARANTINED |
| Assets | REPORT 10, READY PDF 9, QUARANTINED 1; SUBMISSION_ASSET tham chiếu 9; GUIDANCE_SUBMISSION_UPLOAD tham chiếu 10; thuộc ít nhất một weekly flow 10; READY PDF không weekly 0 |
| ACL của 10 bảng đã kiểm | anon/authenticated/service_role không direct SELECT/INSERT/UPDATE/DELETE; service_role BYPASSRLS; postgres có đọc/ghi và BYPASSRLS; legacy đã kiểm RLS disabled |

**Không có asset hiện hữu nào để adopt thành PDF cuối.** Không sửa/xóa/relink 10 REPORT assets hoặc dùng record production trong fixtures. Chỉ synthetic bytes/IDs từ source test local. Đã đối chiếu FileStorageService, UC17 upload/finalize/download, SubmissionValidator/weekly staging/commit và migration step8b; không đọc env hoặc nội dung uploads/Word.

## 2. Giả định đã/chưa xác minh

Metadata cung cấp phù hợp baseline names/types/keys/enums của candidate, không cần thêm enum hoặc sửa migration nền. Fingerprint trước review khớp chính xác người dùng cung cấp. Source/Prisma chứng minh mapping và luồng dự kiến, không chứng minh live triggers tồn tại.

Chưa biết server PostgreSQL version, runtime DB role/column grants/role inheritance Render và workers, các bảng ngoài tập đã kiểm, functions/views/Supabase REST, RLS/ACL bảng version sau apply, storage và backup/restore. BYPASSRLS không thay table privileges. RLS disabled với ACL hiện tại không chứng minh toàn API an toàn. Snapshots readiness/schema trước được giữ làm lịch sử; metadata mới do người dùng cung cấp không đảm bảo live state không đổi.

## 3. FILE_ASSET metadata immutability

`final_pdf_immutable` cũ chỉ bảo vệ FINAL_REPORT_VERSION. FK RESTRICT không chặn đổi checksum/key/kind/state/owner/name/size/MIME/timestamps trên FILE_ASSET. `step8b_file_asset_guard` chỉ bảo vệ upload tuần COMMITTED, còn cho state/updatedAt; không bảo vệ final-only asset.

Thêm `final_pdf_asset_immutable` BEFORE UPDATE OR DELETE trên FILE_ASSET. Khi version tham chiếu OLD.id, DELETE và `to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD)` bị từ chối với 23514. Freeze toàn bộ 11 cột, kể cả id/createdAt/updatedAt và metadata bổ sung tương lai. Chỉ SQL no-op chính xác được qua. Chưa có source/policy cho technical update sau final link nên không tự tạo ngoại lệ state/updatedAt hoặc quy trình quarantine final.

Staging chưa link vẫn được QUARANTINED → READY. Thay PDF tạo asset/version mới, không sửa bản cũ. Giữ guards hai chiều final/weekly, append-only version, unique final asset, FK và score/decision owner check.

## 4. Concurrency, SQL và capability

Cả final_pdf_asset_check và final_pdf_no_weekly_reuse nay `UPDATE FILE_ASSET SET id=id` cùng asset trước kiểm tra claim; IF NOT FOUND từ chối nếu không update được row, kể cả trigger khác suppress no-op. No-op không đổi visible metadata/timestamps nhưng tạo row version; snapshot cũ phải conflict/retry thay vì bỏ sót claim đối nghịch sau chờ lock. Thiết kế dựa trên [PostgreSQL consistency/locks](https://www.postgresql.org/docs/16/applevel-consistency.html), [transaction isolation](https://www.postgresql.org/docs/16/transaction-iso.html), [VOLATILE visibility](https://www.postgresql.org/docs/16/xfunc-volatility.html); **chưa thực thi candidate trên PostgreSQL**.

Giữ term/owner locks, Serializable/CAS/idempotency của Nest. Claim UPDATE một FILE_ASSET rồi đọc children không khóa; asset guard không khóa ngược version/weekly/term/proposal. Không thêm table lock vào normal upload. External SQL batch nhiều assets phải sort IDs và rollback toàn transaction khi deadlock/serialization/unique error; không chứng minh deadlock freedom cho arbitrary writers.

Integrity readers giữ SECURITY INVOKER/VOLATILE/fixed search_path, thêm `SET row_security=off`: không bypass RLS, mà báo lỗi khi RLS áp dụng thay vì nhầm references bị che là không có. [PostgreSQL row security](https://www.postgresql.org/docs/16/ddl-rowsecurity.html). Không SECURITY DEFINER, không tạo role/GRANT hoặc thay ACL/RLS bảng legacy. Runtime role chưa biết là blocker: role restricted có thể bị chặn cả weekly/file metadata writes, phải rehearsal đúng identity trước promotion.

Final claims thêm positive size, checksum 64 hex lowercase và key bằng guidance/ + asset id, ngoài regex/REPORT/READY/PDF/owner joins cũ. Empty-only rollback gỡ guard mới trước bảng version, giữ step8b, khóa bảng liên quan NOWAIT trong maintenance đã dừng writers; lỗi phải ROLLBACK. schemaReady yêu cầu đúng public relation/function/events/enabled/invoker/volatility/RLS setting và guard mới. Catalog check không so toàn function body, cần đối chiếu định nghĩa thực khi rehearsal.

## 5. Storage key, ownership và lifecycle

| Hạng mục | Bằng chứng source / giới hạn |
| --- | --- |
| Key | Backend randomUUID → guidance/UUID; SQL regex `^guidance/[0-9a-f-]{36}$` + equality asset id; regex không chứng minh bytes tồn tại |
| Owner | FILE_ASSET.createdByUserId = STUDENT.user_id qua PROPOSAL.student_id / FINAL_REPORT.proposal_id |
| Metadata | REPORT + READY + application/pdf + positive size + SHA256 shape, không asset tuần kể cả READY |
| Bytes | SubmissionValidator kiểm envelope/size/MIME và SHA256; không full AV/PDF-parser claim; download kiểm length/SHA256 thực |
| Private | FileStorageService .private-guidance, validated key, write-once wx; SQL không xác minh filesystem/private routing/durability |
| Staging | Tx1 QUARANTINED + audit/key trước bytes; bytes ngoài DB; tx2 READY/version/revision/audit/key atomic |

Nếu tx2 rollback, READY/final version/audit/key update phải rollback; staged tx1 còn, bytes có thể đã tồn tại để đối soát. Không báo false success, không tự xóa asset/file hoặc retry overwrite. Render disk/mount/redeploy/backup/restore và quyền filesystem vẫn NOT VERIFIED.

## 6. Nguy cơ B1–B8 / SQL writers

Apply candidate không UPDATE/backfill các REPORT assets. Weekly claims thêm row no-op UPDATE + SELECT version, baseline step8b guards không bị sửa/gỡ. Guard mới chỉ freeze final-linked metadata; có thêm lock/WAL/permission cost cần benchmark.

**Nguy cơ vận hành:** thiếu UPDATE(id)/SELECT hoặc runtime role bị RLS version chặn sẽ fail closed cả weekly hoặc FILE_ASSET maintenance dù chưa có final data. Không tự cấp rộng GRANT/BYPASSRLS hay vô hiệu guard để vượt lỗi. Cần đúng Render/worker/SQL identity và representative legacy writers khi rehearsal; memory suite không chứng minh B1–B8 không gián đoạn.

Trigger bảo vệ ordinary DML khi enabled, không ngăn superuser/owner đổi DDL/disable triggers/session_replication_role hay TRUNCATE coordinated tables. Administrative ACL là review riêng, không suy từ 10 table grants đã cung cấp. SQL trigger không thay kiểm bytes trên storage.

## 7. Tests: phân loại chính xác

| Kiểm thử | Phạm vi |
| --- | --- |
| final-defense-migration.spec.ts, 33 tests | 4 static SQL contracts; 28 synthetic reference-model cases; 1 real UC17 service upload với memory adapters |
| final-defense.repository.spec.ts, 3 tests | Mock catalog, từ chối guard set cũ; query shape kiểm table/function/events/settings; không pg_catalog live |
| Final-asset model fixture | TEST_ONLY, không PostgreSQL emulator; generation conflict thể hiện điều kiện thiết kế, không bằng chứng MVCC/locks |
| UC17 workflow/HTTP/private storage có sẵn | Version/score/decision binding, replacement stale, quarantine/storage failure, rollback audit/key, private file integrity |
| Full UC18–UC25 suites | Regression code với isolated adapters, không production/database integration |
| Database-backed trigger/concurrency | **NOT VERIFIED**, chưa có rehearsal được nhóm duyệt, không tạo database mới |

Reference-model cases bao gồm valid source metadata, wrong owner/kind/MIME/state/key/hash/size, 11 metadata field mutations, delete, duplicate final asset, weekly hai chiều, pre-link READY, rollback và deterministic old-snapshot interleavings hai thứ tự commit. Static SQL tests gắn các điều kiện thiết kế với candidate text; không parse/compile/execute PL/pgSQL.

Full Backend **67 files / 868 tests PASS**; Frontend **59 files / 385 tests PASS**. Shared build, backend/frontend typecheck/lint, Prisma validate/generate, Nest/tsc và Vite builds PASS. Không khởi chạy app môi trường thật hoặc kết nối DB; HTTP tests khởi chạy Nest loopback với memory adapters. Prisma CLI chỉ validate schema/generate client, không migrate.

Native compiled DI UC17–UC25 **9/9 PASS**, infrastructure mocked, không server/DB. Sau cập nhật SQL/rollback cuối đã chạy lại 61 tests UC17 (33 migration static/model/service + 3 capability + 25 workflow), đều PASS. `git diff --check` PASS; kiểm whitespace/conflict markers ở files mới không phát hiện lỗi. So 33 fingerprints đầu/cuối của active migrations và review UC18–UC25: không thay đổi/xóa file; đủ 17 SQL migrations nền. Hash candidate/rollback/diff khớp bảng bên dưới.

Git vẫn feature/b9-b10-implementation tại HEAD 0093f81a6017a8e046a03a8ce9786189cd5b37d8. Worktree metadata Project1-B9-B10 cũ còn prunable, không dọn hoặc tạo worktree/thư mục dự án. Không commit/push.

Warnings hiện hữu: Vite CJS deprecated/chunks >500 kB, Git LF→CRLF; SSR useLayoutEffect có thể xuất hiện khi không silent. Không sửa policy/rubric PENDING_APPROVAL để làm tests qua.

## 8. SHA256 trước/sau (workspace bytes)

| File | Trước | Sau |
| --- | --- | --- |
| migration.sql | 93B64606BC47A46C5604B02E572E0743A57561832FA94416E22470A97DD233EA | 75CD92D5F97ACF26F3FE6A3EADBBCADFC54F9C81432BEEF4735E8BD8A51E092F |
| rollback.empty-only.sql | 1FBDDCE26A1C361C6D457DCB84C6C62AC0C16A7305C1D3FB2137221E8375E7B9 | 7B343F4E5C4BA897FAFF59F9C77E5CA8BD91830EAEA1315065C92CB4A82AEB1F |
| schema.diff.sql | EAF5042BD3B93D9F3D3E214F90551592B6B92D1F2EC3935183736128DDCE1353 | Không đổi |

Không đổi schema.prisma ở lượt này vì chỉ custom SQL/capability, không thêm model/cột. Không sửa 17 migrations đã apply hoặc gói UC18–UC25. Recompute sau thay newline/promotion; không sửa checksum migration đã apply.

## 9. PostgreSQL rehearsal bắt buộc

DB owner cấp môi trường cùng server version/schema/ACL/runtime role; duyệt synthetic records, backup/restore DB/private files, policies/grants/writers/owner. Không lấy asset tuần production. Chỉ apply exact reviewed candidate theo quy trình nhóm duyệt, không chạy theo tài liệu này trên Supabase chung.

| Case SQL / hai session | Invariant phải xác minh |
| --- | --- |
| Valid fresh final / duplicate asset | Owner/report/sequence đúng, unique asset chặn hai final claims, không partial provenance |
| Weekly trước final / final trước weekly | Một claim bị chặn trên cả SUBMISSION_ASSET và GUIDANCE_SUBMISSION_UPLOAD, gồm READY/PENDING/EXPIRED refs |
| Attach vs mỗi metadata UPDATE hoặc DELETE | Cả hai thứ tự commit ở READ COMMITTED/REPEATABLE READ/SERIALIZABLE; writer revalidate hoặc conflict, không cả hai commit phá invariant |
| QUARANTINED/READY và metadata | Không link quarantine; READY trước link được, sau link freeze toàn 11 fields; exact no-op được; PK/owner cascade cũng phải thử |
| Fault rollback/staging | Audit/key/version failure rollback tx2 READY/claim/revision/audit/key, staged tx1 còn; không false success |
| Snapshot/race | Cố định snapshot session B trước A commit, không chỉ Promise.all; đo 40001/23505/23514 và retry cả tx |
| Runtime ACL/RLS | Đúng Render/worker/SQL identity; hidden references phải lỗi; weekly không gián đoạn; không auto-grant |
| Locks/performance | Sorted multi-assets, mixed weekly/final/metadata workloads, WAL/timeouts/deadlock handling; rollback maintenance NOWAIT refusal |
| B1–B8/downstream | Weekly upload/commit/download/review, legacy metadata/bytes unchanged; score/decision binding và UC18–UC25 readers/current/stale |

Nhiều guards có thể báo lỗi trước nhau: kiểm invariant cuối và clean rollback, không đòi chỉ một SQLSTATE cố định. Rehearse function definition/config/trigger events/FKs/RLS thực, source bytes/checksum qua restart/redeploy/restore và browser flow.

## 10. Blockers và phạm vi bàn giao

**BLOCKED apply/activation:** chưa có DB rehearsal được duyệt; runtime role/ACL/RLS/REST/SQL writers chưa kiểm; metadata là snapshot cung cấp; policy/grants/storage/backup/restore chưa đủ sign-off. Không tự provision policy/permissions vì unit PASS.

**NOT VERIFIED:** PL/pgSQL compile/execution, real transactions/locks/deadlocks/rollback/RLS, live file bytes/private routing/durability, browser/Render E2E và tải thật. Không production-ready.

Lượt này sửa migration.sql/rollback/README UC17, capability repository/tests, thêm migration static/model tests + TEST_ONLY fixture, báo cáo này và handoff UC17/schema/overall. Không đổi nghiệp vụ UC18–UC25, env/uploads/Word hoặc flags; không apply/migrate/db push/seed/reset, production writes, chạy app môi trường thật, tạo DB/project/worktree/branch, commit/push.
