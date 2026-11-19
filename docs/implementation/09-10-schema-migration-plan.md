# B9–B10 — kế hoạch schema, migration và rehearsal

**Chỉ kế hoạch review; không được chạy từ tài liệu này trên Supabase chung.** Target vẫn database Supabase của nhóm và backend Render hiện có. Cần nhóm cấp môi trường rehearsal phụ trợ được phê duyệt, không thay kiến trúc/đích nghiệp vụ.

## 1. Thứ tự và dependency

Base là 17 active migrations B1–B8, kiểm replay/checksums trước khi tiếp tục. Không sửa chúng hoặc ghi _prisma_migrations để làm migration có vẻ đã apply.

| Gói review trong backend/prisma/review | Nội dung và dependency |
| --- | --- |
| final-defense (UC17) | FINAL_REPORT_VERSION + staging intent, report/confirmation/score revision/PDF/context, private asset ownership/immutability/FK/guards/RLS package |
| defense-eligibility (UC18) | DEFENSE_ELIGIBILITY review/decision/finalization/context; cần UC17 |
| defense-committee (UC19) | DEFENSE_COMMITTEE provenance/roles, DEFENSE_COMMITTEE_ASSIGNMENT, final structure/transition guards; cần UC18/17 |
| defense-reviewers (UC20) | REVIEWER_ASSIGNMENT term/student/committee/state/selection/revision/proof and group guards; cần UC19 |
| defense-scheduling (UC21) | DEFENSE_SESSION state/interval/context/slot provenance, resource conflicts; cần UC19, UC20 runtime khi policy yêu cầu reviewer attendance |
| defense-reviewer-grading (UC22) | Giữ ADVISOR branch, mở REVIEWER guarded branch, detail/commit guards; cần UC17/20, UC21 conditional runtime |
| defense-committee-grading (UC23) | Giữ ADVISOR/REVIEWER, guarded COMMITTEE_MEMBER branch/detail/commit; cần UC19/21/22, UC20 chuyển tiếp |
| defense-final-results (UC24) | 7 FINAL_RESULT fields, fr_record_valid/fr_transition_guard/fr_commit_guard; cần UC17–23 official readers |
| defense-reporting (UC25) | README audit; **không migration mới** với stream + audit/key hiện tại |

UC20 và UC21 có nhánh dependency độc lập sau UC19; thứ tự tuyến tính thuận review là 17 → 18 → 19 → 20 → 21 → 22 → 23 → 24; không tự thêm FK giữa nguồn không bắt buộc. Fingerprints từng gói nằm ở README/report tương ứng, phải kiểm lại trước rehearsal.

Review UC17 bổ sung 09/11/2026: [live-schema review](09-uc17-live-schema-review.md). Metadata người dùng xác nhận 17 baseline applied, chưa UC17–24; 10 REPORT assets đều weekly, không adopt. Candidate thêm FILE_ASSET whole-row metadata/DELETE guard, claim row UPDATE hai chiều/row-count check, SECURITY INVOKER + row_security=off để không bỏ sót reference bị RLS che; capability kiểm guard/relation/events/settings. Không thêm bảng/cột/enum hoặc thay schema.diff. Hash migration hiện `75CD92D5F97ACF26F3FE6A3EADBBCADFC54F9C81432BEEF4735E8BD8A51E092F`, rollback `7B343F4E5C4BA897FAFF59F9C77E5CA8BD91830EAEA1315065C92CB4A82AEB1F`. Không sửa gói UC18–UC25 hay migrations đã apply.

Runtime role Render vẫn chưa xác nhận; role thiếu SELECT/UPDATE(id) hoặc bị RLS version có thể làm **weekly bị chặn** bởi guards mới. Phải rehearse đúng runtime/worker/SQL roles, existing weekly writers, snapshots trước commit, rollback và tải; không auto-GRANT/BYPASSRLS/REVOKE hoặc sửa RLS legacy để vượt lỗi. Empty-only rollback cần maintenance dừng writers, NOWAIT và ROLLBACK khi lỗi; không rollback dưới downstream đã deploy chưa review dependency. Đây là blocker trước apply/activation, không phải bằng chứng đã chạy triggers.

## 2. Kiểm live metadata được phép

Nhóm trưởng/DB owner xác nhận target/schema/runtime role trước read-only inspect. Không gửi secrets vào chat/log. Đối chiếu columns/types/nullability/defaults, PK/FK/unique/indexes, enums, validated CHECKs, enabled/deferred triggers, functions/search_path, ACL/RLS/Supabase REST và migration history. Source Prisma không chứng minh live schema đã đủ. Không auto-repair nếu metadata lệch.

Đặc biệt SCORE_ENTRY/DETAIL và FINAL_RESULT giữ Decimal(4,1); policy precision >1 chữ số cần review riêng. FILE_ASSET kinds/ownership không dùng lẫn weekly/dossier/final/export. DEFENSE_MINUTES/EXPORT_JOB legacy không phải provenance kết quả hoặc chữ ký.

## 3. Legacy reconciliation

Lập inventory theo owner/kỳ/proposal, không lấy dữ liệu thật vào fixtures không được duyệt. Rows revision0/thiếu context/proof để LEGACY_UNVERIFIED và fail closed; không adopt/upsert/backfill/xóa để đạt test. Kiểm duplicates trước constraints; dừng và báo nguồn nếu schema/data diverge. Đối soát FINAL_REPORT/file paths, SCORE_ENTRY roles, committee claims, reviewer pairs, schedules không có intervals, FINAL_RESULT publication và minutes/export paths theo quy trình nhóm duyệt.

## 4. Quyền và provisioning

Review resource/action mappings từng UC, role-bound FACULTY/LECTURER/STUDENT và term/department grants; không ADMIN academic bypass hoặc ghép quyền giữa roles. UC25 mappings xem README defense-reporting; underlying result/comments/dossier content rights vẫn bắt buộc. Cấp quyền chỉ sau phê duyệt, không seed account thật để chạy test. Kiểm revoked sessions/role/grant, personal release, download/history endpoints và raw Supabase REST.

Internal producer finalizers/updaters được reauthorize khi downstream đọc. Nhóm cần quyết định service identity/bàn giao cán bộ; không giữ source CURRENT bằng cách bỏ kiểm quyền khi người tạo nghỉ hoặc bị thu hồi.

## 5. Backup/restore và rehearsal

Trước mọi rehearsal: target riêng được cấp, dữ liệu synthetic/legacy đại diện, backup database + private source files + configurations trong hệ quản lý bí mật, owner chịu trách nhiệm restore test. Snapshot DB không bao gồm local files Render; phải kiểm hai phần cùng nhau.

Chạy gói review theo thứ tự được DB owner duyệt, đo lock/statement timeout, constraint/trigger/function execution thực. Kiểm B1–B8 producers, SERIALIZABLE/CAS/unique, two-transaction source change races, rollback audit/key, PDF ownership/version immutability, live role/grants/RLS/REST và restore. Không chạy các bước đó ở lượt code này.

## 6. Rollback/forward fix

Giữ write flags false khi chưa nghiệm thu. Nếu có dữ liệu mới, không DROP cột/bảng hoặc xóa audit/key/versions; tắt ghi và dùng forward fix/reconciliation được duyệt. Empty-test-only rollback UC17 chỉ được xem xét với preconditions của gói; không áp dụng lên shared DB có dữ liệu. Schema expand phải tương thích code đang deploy; UC22/23 constraint mở rộng phải giữ branch trước đó, tránh rollback branch khiến dữ liệu mới vi phạm CHECK.

## 7. Nguy cơ B1–B8 và điều kiện activation

Đánh giá constraint/triggers trên SCORE_ENTRY, raw SQL writers cũ, role mappings, ACL/RLS changes trên bảng nền, schedule conflict locks xuyên kỳ và transaction latency. Không REVOKE toàn bảng để che thiếu endpoint checks. API route export alias không thay dữ liệu demo; regression và browser review cần trước release.

Chỉ sau policy approval, metadata match, DB rehearsal + restore, private storage durable, browser/Render E2E và sign-off có chủ sở hữu mới quyết định production rollout/flags. Không tài liệu hoặc unit PASS nào là quyền tự triển khai.
