# Tổng kết code Bước 9–10 — UC17–UC25

08/11/2026. Project1, feature/b9-b10-implementation, HEAD 0093f81a6017a8e046a03a8ce9786189cd5b37d8; chưa commit/push. Báo cáo này tổng hợp trạng thái hiện tại, thay các câu “chưa làm UC sau” trong báo cáo lịch sử.

CODE COMPLETE ở đây là các luồng kỹ thuật/configuration được mô tả đã code và kiểm thử cô lập. BLOCKED là không được kích hoạt khi thiếu quyết định/source/schema. NOT VERIFIED là chưa chạy môi trường thật. Không có UC nào đã được nghiệm thu production end-to-end.

| UC | Code trong phạm vi hiện có | Dependency / extension còn chặn | Kiểm chứng hệ thống thật |
| --- | --- | --- | --- |
| UC17 | CODE COMPLETE: PDF cuối version/private download, summary/score, agree/reject/reason, audit/CAS/idempotency | BLOCKED policy/DDL/RBAC/storage; replacement/score step/release chưa duyệt | NOT VERIFIED DB/storage/Render/browser |
| UC18 | CODE COMPLETE: review/checks/attestation/decide/finalize/current eligibility | BLOCKED academic/progress authority và policy thật; không fake academic data | NOT VERIFIED DB/browser |
| UC19 | CODE COMPLETE: 3–5 member/roles, assignment, all-member advisor conflicts, finalize/current | BLOCKED quotas/qualifications/policy/DDL/grants | NOT VERIFIED DB/concurrency/load |
| UC20 | CODE COMPLETE: independent reviewer assignments, conflict/caps/provenance/current | BLOCKED former advisor/dual duty/rules/schema permissions | NOT VERIFIED DB/concurrency/browser |
| UC21 | CODE COMPLETE: morning/afternoon schedule, Vietnamese ordering, room/time/resources, finalize/publish/current | BLOCKED room/calendar/window/attendance/visibility policies; reschedule after finalize outside approved core | NOT VERIFIED cross-term SQL concurrency/Render/browser/load |
| UC22 | CODE COMPLETE: reviewer feedback/draft/finalize/rubric/current/private PDF | BLOCKED scoring/rubric/policy/provisioning; no reopen workflow approved | NOT VERIFIED DB/storage/browser |
| UC23 | CODE COMPLETE: member independent rubric/draft/finalize/progress/current | BLOCKED approved rubric/window; PARTIAL nếu cần actual-defense evidence producer (chưa có), finalize bị chặn | NOT VERIFIED DB/storage/browser |
| UC24 | CODE COMPLETE: exact configurable aggregate, confirmation/finalize/lock/publish, own student release/current reader | BLOCKED formula/source approval; PARTIAL cho PROCESS_UC16 mapping, arbitrary formulas/quorum, post-final corrections chưa có producer/policy | NOT VERIFIED SQL/Render/browser |
| UC25 | CODE COMPLETE: 15 registry layouts, XLSX/PDF thật, scoped statistics/preview/export/download/audit | BLOCKED approved templates/release/RBAC; PARTIAL cho full remarks/signed/archive producer, DOB/mẫu ngoài registry chưa có nguồn | NOT VERIFIED DB/Render/browser/large cohort |

## Routes và readers

API bên dưới còn global prefix cấu hình; xem controller/report UC cụ thể cho commands và permission đầy đủ.

| UC | Frontend | Backend chính | Output tin cậy |
| --- | --- | --- | --- |
| 17 | /guidance/final-report, /guidance/defense-confirm | /final-defense, /proposals/:id/final-report, pdf/review/decide/version download | UC17 binding/PDF/decision; AdvisorGradeReader tối thiểu bổ sung UC24 |
| 18 | /defense/eligibility | /defense-eligibility | EligibilityService.forCommittee / EffectiveEligibility |
| 19 | /defense/committees | /defense-committees | EffectiveCommittee |
| 20 | /defense/reviewers | /defense-reviewers | EffectiveReviewerAssignment |
| 21 | /defense/schedule | /defense-schedules | EffectiveDefenseSchedule |
| 22 | /defense/reviewer-grading | /defense-reviewer-grades | EffectiveReviewerGrade |
| 23 | /defense/committee-grading | /defense-committee-grades | EffectiveCommitteeGrade |
| 24 | /defense/results | /defense-results | EffectiveFinalResult |
| 25 | /defense/reports, alias API /report/export | /defense-reports | Versioned scoped report snapshot + artifact SHA256; luôn UNSIGNED |

Các readers chính thức dùng caller session và live revalidation, không raw status/lock/score legacy hoặc demo fallback.

## Schema và tương thích

Chung Prisma/Supabase: FINAL_REPORT/VERSION/FILE_ASSET, DEFENSE_CONFIRMATION/ELIGIBILITY, DEFENSE_COMMITTEE/MEMBER/ASSIGNMENT, REVIEWER_ASSIGNMENT, DEFENSE_SESSION, SCORE_ENTRY/DETAIL/RUBRIC, FINAL_RESULT, TERM/PHASE/PARAMETER, AUDIT_LOG/IDEMPOTENCY_RECORD và ownership B1–B8. UC17 thêm version/staging; UC18/19/20/21/24 thêm provenance/revision/context/transition fields, UC22/23 guards không thêm bảng/cột. UC25 không cần migration cho stream/audit. [Kế hoạch schema](09-10-schema-migration-plan.md).

Giữ 17 migrations nền; tất cả SQL mới chỉ review, chưa deploy. API /scores loại academic private grades đã có từ UC17–23; UC24 không dùng ScoreAggregatorService float/default cũ. UC25 không sửa điểm, tự công bố hay ký thay. Legacy giữ nguyên, không adopt/backfill/delete hoặc reset workspace. API export alias là thay đổi navigation có chủ đích; demo/report services cũ giữ nguyên.

## Kiểm chứng, warnings và giới hạn

Review UC17 09/11/2026: [metadata/immutability/concurrency review](09-uc17-live-schema-review.md). Chỉ sửa candidate/capability/tests UC17; thêm final FILE_ASSET metadata/DELETE guard, claim UPDATE hai chiều và báo lỗi nếu RLS che references. 17 migrations nền/gói UC18–UC25 giữ nguyên. Không adopt 10 REPORT assets weekly. Runtime role chưa biết có thể khiến weekly bị chặn sau apply, phải rehearsal đúng identity; không kết luận B1–B8 production-compatible chỉ từ tests.

Kết quả thực chạy cuối nằm ở báo cáo UC25 mục Xác minh cuối; bao gồm full backend/frontend suites, shared/Prisma/build/typecheck/lint/native DI/git checks. PASS chỉ chứng minh phạm vi source/synthetic adapters/real artifact parsing; không chứng minh PostgreSQL trigger/CAS/RLS/concurrency hoặc production deploy.

| Kiểm chứng source/cô lập toàn B9–B10 và nền | Kết quả |
| --- | --- |
| Backend full suite | PASS — 67 files / 868 tests (review UC17 09/11/2026; thêm 33 static/model/service tests và 1 capability test) |
| Frontend full suite | PASS — 59 files / 385 tests |
| Shared build, backend/frontend typecheck và lint | PASS |
| Prisma validate/generate, Nest/tsc và Vite build | PASS; không apply/DB connection/deploy |
| Native compiled DI UC17–UC25 | PASS — 9 scripts, hạ tầng mocked |
| Source Git/SQL checks | PASS diff --check, 17 migrations nền không sửa, UC24 review SQL checksum giữ nguyên |

Đã sửa lỗi wiring thiếu export CommitteeGradeValidator do kiểm native ReportModule phát hiện; kiểm lại thành công. Sau sửa cuối, HTTP UC25 4 tests và frontend UC25 26 tests được chạy lại, typecheck/lint/build lại. Files XLSX/PDF được sinh/đọc lại thật trong memory; chưa mở Excel/print/browser/Render thật. [Chi tiết UC25 và các file](09-uc25-integration-report.md).

Warnings đã có: Vite CJS deprecated, chunks >500 kB, SSR useLayoutEffect khi chạy không silent, Git LF→CRLF. Không được ghi là đã xử lý các warnings đó.

Các blocker chung: chưa có chính sách/mẫu/quyền/grants/phòng/dữ liệu thật được duyệt, chưa có DB/private storage test được cấp, SQL review chưa rehearsal, ACL/RLS/REST chưa kiểm, Render persistence/backup/restore chưa xác minh, actual-defense/minutes/signature/archive producers còn thiếu khi policy đòi. Source effective workspace/checksum reads có thể tốn chi phí toàn kỳ; cần benchmark thay vì claim production-scale.

Tất cả UC17–UC25 write flags vẫn default false. Không production writes/app start/migration/seed/account/disk/bucket/worktree/project/commit/PR/merge/push. [E2E plan](09-10-e2e-test-plan.md) và [nội dung hỏi nhóm một lượt](09-10-team-approval-summary.md) là các bước bàn giao, không là authorization triển khai.
