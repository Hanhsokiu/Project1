# UC24 — tích hợp tổng hợp, chốt và công bố kết quả bảo vệ

Ngày 08/11/2026. Workspace `E:\Project-Xaydungdoantotnghiep\DATN_Backup\Project1`, nhánh `feature/b9-b10-implementation`, HEAD `0093f81a6017a8e046a03a8ce9786189cd5b37d8`. Chỉ UC24, giữ công việc UC17–UC23 chưa commit. **Code tích hợp và kiểm thử cô lập; chưa nghiệm thu PostgreSQL/Render/browser E2E, chưa được phép bật production writes.**

## 1. Chức năng đã triển khai

FR-38/39/40/41: thu thập phiếu hiện hành → kiểm đầy đủ → tính thử → xác nhận hội đồng → Khoa chốt/khóa → công bố riêng → sinh viên xem kết quả của mình đã công bố. GET/POST preview không tạo FINAL_RESULT/audit/key. Không notification, export Excel/PDF/biên bản/in/ký UC25.

Đã đối chiếu UC24/UC16 và FR-38–41 trong `Project_1_06.docx`: công thức theo cấu hình/quy định, hội đồng xác nhận rồi Khoa chốt; ví dụ 40/60 không đủ là approval. Không lấy comment “công thức chuẩn UTC” trong ScoreAggregatorService cũ làm chính sách đã duyệt.

## 2. Files Backend / Frontend / Shared

- `backend/src/defense/final-results/`: controller, service/effective evaluator, repository/session, sources/completeness checker, advisor-grade.reader, context Zod và unit/HTTP/adapter tests.
- `backend/test/final-result.fixture.ts`, `backend/scripts/check-final-results-build.cjs`.
- `shared/src/contracts/defense-final-results.ts`, `final-result-calculation.ts`; exports index. Engine gọi arithmetic BigInt dùng chung `rubric-arithmetic.ts`, không viết công thức float mới.
- `frontend/src/features/defense/final-results/`: API, page, components, TEST_ONLY fixture và tests. Router/manifest/menu/access tests tích hợp route mới.
- Tích hợp `DefenseModule`, environment/default-flag test, Prisma FinalResult. Chỉ mở rộng tham số test fixtures UC20–23 để kiểm hội đồng 5 người/nhiều GVPB, giữ defaults và runtime producer cũ.
- Gói SQL `backend/prisma/review/defense-final-results/`, báo cáo này và policy approval list. Không sửa migrations nền hoặc nghiệp vụ UC17–UC23.

## 3. Database tái sử dụng và audit schema

FINAL_RESULT baseline: PK/FK proposal_id và unique một kết quả/proposal, advisor/reviewer/final_score Decimal(4,1), is_passed, is_published/published_at, timestamps. Không đủ revision/state/lock/provenance. Các bảng SCORE_ENTRY/DETAIL/RUBRIC_CRITERIA, DEFENSE_CONFIRMATION/ELIGIBILITY, DEFENSE_COMMITTEE/MEMBER/ASSIGNMENT, REVIEWER_ASSIGNMENT, DEFENSE_SESSION, TERM_PARAMETER/PHASE, AUDIT_LOG/IDEMPOTENCY_RECORD dùng chung Prisma/session.

Schema source/SQL review không chứng minh schema Supabase live đã có. Lượt này không kết nối DB hoặc đọc secrets để kiểm live. `frLegacy` chỉ projection baseline khi thiếu cột mới, không query cột UC24 trước readiness.

## 4. Migration review

Bổ sung tối thiểu 7 cột FINAL_RESULT: revision/state/context/is_locked/finalized_by/finalized_at/published_by. Không thêm bảng, không đổi enum hoặc precision. JSON context lưu đầy đủ policy, công thức, phiếu nguồn và proof upstream, calculation và confirmations; audit giữ snapshot theo revision. Điểm thành phần dùng JSON string Decimal; các cột advisor_score/reviewer_score baseline không được dùng thay thế/cắt precision của aggregate.

`fr_record_valid`, `fr_transition_guard`, `fr_commit_guard` đề xuất invariants, owner/source revision/PDF, transition/immutability và audit/key deferred. Legacy revision 0 không adopt/backfill/delete. SQL ngoài active chain, **chưa apply/rehearse**. [README gói SQL](../../backend/prisma/review/defense-final-results/README.md) ghi dependencies B1–B8 → UC17–UC23, scope, ACL và kế hoạch kiểm chứng.

## 5. APIs và route

Prefix API của hệ thống được giữ nguyên:

| Method | Path | Hành vi |
| --- | --- | --- |
| GET | /defense-results/options | Các đợt/hội đồng trong scope |
| GET | /defense-results?termId=... | Lọc hội đồng/search/state, phân trang sau scope |
| GET | /defense-results/:termStudentId?termId=... | Detail/projection theo quyền |
| POST | /defense-results/:termStudentId/preview | Body termId; read-only, không idempotency row |
| POST | /defense-results/:termStudentId/confirm | Xác nhận một vai trò chính thức |
| POST | /defense-results/:termStudentId/finalize | Khoa chốt/khóa |
| POST | /defense-results/:termStudentId/publish | Công bố snapshot đã chốt |

Frontend `/defense/results`: workspace/sidebar hiện hữu, chọn đợt/hội đồng/tìm/lọc/paging, danh sách và chi tiết, nguồn/phiếu thiếu/công thức/weights/preview, trạng thái xác nhận/chốt/công bố, lịch sử theo quyền và lý do disabled. Không DemoDb trong API mode. Actor/term/student query keys và live scope bảo vệ response đến muộn; POST thành công mới báo đã lưu, invalidate/refetch cache. Preview được ghi rõ chưa phải chốt. Snapshot policy/phiếu/điểm cũ hiển thị cùng nhau khi stale, không gắn công thức mới vào kết quả cũ.

## 6. Permissions

Resource `defense-result`, JWT/session + ingress guard, sau đó live role-bound permissions và grant. FACULTY `read/finalize/publish`, nội dung `components-read/history-read` độc lập; term/department phải đúng. LECTURER `read/confirm` với actual current UC19 membership, role nằm trong policy; không chốt thay Khoa. STUDENT `read/read-own/final-read`, đúng chủ hồ sơ; component release thêm `components-read` **và** policy `studentComponents`. ADMIN không bypass, không ghép read của role này với finalize của role khác. Mapping đề xuất trong README, chưa provisioning thật.

Không trả raw audit/context/comments/score source ids cho sinh viên. Chưa có policy/producer công bố nhận xét: UC24 không mở quyền nhận xét, không coi component release là comment release.

## 7. Nguồn UC16 / UC17 / UC22 / UC23

UC16 có PHASE_EVALUATION (phaseName/score/plan) và EVALUATION_WORKFLOW (milestone/revision/evaluator/criteriaSnapshot/criterionScores), evidence/history; reviews tuần có quyết định PASS/FAIL/REVISION_REQUIRED. Đây là các đánh giá giai đoạn độc lập, chưa có mapping được duyệt sang điểm học phần UC24. **Không cộng trùng hoặc coi là điểm UC17.** Nếu policy yêu cầu PROCESS_UC16: `UC16_OFFICIAL_GRADE_READER_REQUIRED`, không chốt.

UC17 ADVISOR là tổng kết GVHD gắn final PDF. Reader tối thiểu mới chỉ CURRENT khi official assignment/topic agreement, policy/binding/saved policy, current PDF/checksum bytes, score/rubric/step, CONFIRMED decision và audit summary/decision khớp. Xác minh actor GVHD active/còn role-bound read/review/decide. UC17 chưa khóa phiếu theo decision nên **không giả định isLocked**; tính hiện hành theo decision/proof/revision và đọc lại lúc chốt. Việc cho UC17 vào công thức phải được UC24_POLICY xác nhận `advisorSource=UC17_OFFICIAL_SUMMARY`.

UC22 sử dụng chính `ReviewerGradeService.effectiveInSession` với finalized actor lưu trong context, reauthorize live. Phân công bắt buộc lấy từ `ReviewerService.effectiveInSession` UC20. UC23 gọi chính `CommitteeGradeService.effectiveInSession` cho từng member bắt buộc; UC19 EffectiveCommittee CURRENT xác minh UC18/advisor/conflict/assignment và membership. UC21 official reader kiểm lịch finalized/CURRENT. Tất cả cùng session consumer, không cấp quyền source bằng quyền người xem UC24.

## 8. Điểm hội đồng

Danh sách thực tế từ UC19, roles phải chấm từ UC23_POLICY đã duyệt. Engine hỗ trợ MEAN hoặc ROLE_WEIGHTED explicit. Với ROLE_WEIGHTED, weight của role được chia đều cho các thành viên thật của role đó; tổng weights 1 và đúng roles có mặt. Không mặc định Chủ tịch cao hơn, không mặc định 3 phiếu hoặc bỏ Chủ tịch/Thư ký. Rounding của aggregate explicit, không fallback.

## 9. Điểm cuối

UC24_POLICY version/status APPROVED/approvedBy/At/reference bắt buộc. Hỗ trợ WEIGHTED_SUM trên các component được chọn, weights dương tổng 1. Reviewer aggregate MEAN/WEIGHTED với danh sách lecturerId phải khớp đúng phân công. Committee aggregate riêng; aggregate rounding rồi final rounding đều explicit. Phân số BigInt, kiểm duplicate/unexpected/missing components, step, precision và deterministic arithmetic. Không eval hoặc công thức client.

Thang nguồn 0–10; lưu FINAL_RESULT Decimal(4,1). finalStep phải biểu diễn được với storageDecimalPlaces 0/1, không tự cắt precision. EXACT gặp số không biểu diễn được chặn ROUNDING_REQUIRED. Ngưỡng đạt/điểm liệt/xếp loại chỉ áp dụng khi cấu hình: so trên aggregate/final đã rounding theo policy, không default 5.0 hoặc tên xếp loại. Classifications chọn ngưỡng cao nhất đạt. Mặc định policy không tồn tại → chặn, không tự tạo policy mẫu. Formula/scope/precision ngoài hỗ trợ → UNSUPPORTED_POLICY hoặc blocker cụ thể, cần review bổ sung.

## 10. Completeness

Required committee sheets bằng members CURRENT thuộc gradingRoles UC23; required reviewer sheets bằng toàn bộ current UC20 assignments nếu component REVIEWER được dùng; ADVISOR_UC17 thêm một nguồn khi được chọn. Policy/source chưa xác minh thì requiredCount/missingCount có thể unknown, không suy thành 0. Kiểm phiếu FINALIZED/CURRENT, đúng owner/role/proposal/term/student, không duplicate, không legacy/draft/stale; tất cả cùng PDF version/checksum. Thiếu bất kỳ nguồn bắt buộc không có calculation/chốt. Test actual producer chain với 3/5 members và nhiều reviewers; 4/5 phiếu không đạt completeness.

## 11. Xác nhận / chốt / khóa / công bố

Read states: INCOMPLETE, READY, AWAITING_CONFIRMATION, CONFIRMED, FINALIZED, PUBLISHED, STALE, LEGACY_UNVERIFIED. Preview là kết quả đọc, không persisted state. Persisted state mới CONFIRMING chỉ chứa snapshot và confirmations, final_score=NULL; không phải điểm chính thức. Roles xác nhận explicit, `scope=STUDENT`, `rule=ONE_PER_ROLE`, mỗi role một actor thật; distinctActors/reasonRequired/separation flags explicit. Không hỗ trợ batch/toàn phiên hoặc quorum từng member nếu policy đòi dạng khác.

Chốt chỉ FACULTY đủ quyền/grant, đầy đủ confirmations hoặc policy explicit roles=[], sources CURRENT, trong TERM/DEFENSE phase unlocked và policy finalizeWindow. Tính lại trong transaction, kiểm revision/hashes rồi ghi final_score/snapshot/actor/time, khóa. Chốt không publish. Publish cần permission riêng, finalized CURRENT, confirmation còn hiệu lực và publication window; **dùng nguyên snapshot đã chốt**, không đổi source/weights/score. Publish một lần. Không reopen/rebind/override/admin sửa sau chốt; ngoại lệ chờ policy/workflow duyệt.

## 12. Stale và concurrent updates

Read RepeatableRead, write Serializable. Term-first lock theo CC/producer, proposal/phase/advisor/source score/result locks, CAS revision và unique proposal. Sau lock reauthorize/revalidate toàn bộ upstream, so policy/evidenceHash. Serializable/unique conflict trả 409, không retry âm thầm đổi điểm. Mock race/concurrency/rollback không chứng minh lock PostgreSQL thật.

Nguồn/policy/PDF/assignment/membership/eligibility/schedule/permission confirmation đổi → STALE; giữ nguyên result/audit/publication snapshot. Sinh viên không nhận điểm stale. Không auto-recompute/overwrite/xóa lịch sử. Hết cửa sổ ghi đơn thuần không làm kết quả nguồn đã chốt hợp lệ mất hiệu lực; approval/content/source thay đổi thì có. Consumer phải đọc lại tại thời điểm dùng.

## 13. API legacy và bảo mật

`/scores/proposal/:proposalId` hiện đã loại ADVISOR/REVIEWER/COMMITTEE_MEMBER/COMMITTEE_CHAIR từ UC17–23; không biến thành đường công bố mới. Audit source không tìm thấy API legacy FINAL_RESULT trả điểm; ScoreAggregatorService cũ vẫn giữ nguyên cho regression nhưng UC24 **không gọi** công thức float/default 40/60/5.0 đó. API UC24 chỉ projection scope/permission; không raw context. Trực tiếp Supabase REST/ACL/RLS trên bảng cũ **NOT VERIFIED**, phải kiểm trước activation.

## 14. Revision / audit / idempotency

Commands strict Zod chỉ nhận termId/expectedRevision/policyHash/evidenceHash/reason, cấm actorId/finalScore/state client. Key theo actor/method/route, body hash khác 409. Replay vẫn kiểm scope/source/window/flag/quyền, không bypass nguồn stale. Result/audit/key trong một transaction; audit/key failure rollback toàn bộ. Audit gồm confirmation actor/actual role/time/reason, full context và result snapshot hash, finalized/published actors/time theo revision. Context runtime Zod validation + audit fingerprint + recomputation snapshot trước khi công nhận; không tin boolean publication/lock đơn lẻ.

## 15. Kiểm tra đã chạy

| Kiểm tra | Kết quả |
| --- | --- |
| Full backend Vitest B1–B8/UC17–24 | PASS: 63 files, 789 tests |
| UC24 backend mới | PASS: 51 workflow/policy/privacy/calculation + 4 HTTP + 4 adapter/static review |
| Full frontend Vitest | PASS: 56 files, 358 tests |
| UC24 frontend mới | PASS: 15 SSR component + 9 SSR page + 6 API, thêm 1 router guard regression |
| Shared TypeScript build | PASS |
| Backend / frontend typecheck và lint | PASS; đã kiểm lại sau thay đổi cuối |
| Nest build / Vite production build | PASS; backend full nonincremental emit PASS |
| Native compiled module/DI UC17–UC24 | PASS: 8 checks, mocked infrastructure, không AppModule/server/DB |
| UC24 suites sau thay đổi cuối | PASS: backend 59, frontend 30 tests |
| git diff --check / kiểm tĩnh files UC24 mới | PASS; 23 files không conflict markers/trailing whitespace/runtime fixture imports |
| Prisma validate / generate local | PASS; không migration/DB connection |
| PostgreSQL SQL execution / triggers / ACL / DB concurrency | NOT VERIFIED |
| Browser interaction / Render / production storage E2E | NOT VERIFIED |

Vite có cảnh báo CJS API deprecated/chunk >500 kB và SSR suite có thể cảnh báo useLayoutEffect; không coi các warning baseline là đã được khắc phục. HTTP harness thật JWT/session/RBAC/Zod chạy loopback với repository/storage in-memory, không AppModule/production app.

## 16. Regression

Full suites giữ nguyên B1–B8/UC17–UC23 PASS. Runtime producer endpoints/semantics không đổi; chỉ fixture options thêm để exercise 5-member/multi-reviewer dependencies, defaults cũ giữ nguyên. Prisma schema thêm đúng FinalResult fields; 17 migrations và 7 review packages cũ không sửa. Native compiled DefenseModule và các dependency readers phải giải quyết DI, không import AppModule/đọc env/kết nối DB.

## 17. Chưa nghiệm thu E2E

Chưa có database/private storage test được phê duyệt. SQL execution/parse/constraints/FK/trigger/deferred commit/CAS/locks/rollback trên PostgreSQL, migration rehearsal/legacy/ACL/RLS/Supabase REST, account/permissions/grants thật, Render disk/mount/backup/restore/redeploy và browser clicks/cache/printing đều NOT VERIFIED. Chưa benchmark scan/effective workspace của cả đợt; đọc nhiều grade có thể tốn thời gian và vượt transaction timeout ở quy mô thật. Không tuyên bố full end-to-end hoặc production ready.

## 18. Chính sách cần phê duyệt

[Policy approval list](09-10-policy-approval-list.md) có phần UC24: nguồn UC16/17 chính thức, reviewer/member required/aggregate/weights/formula, 40/60 có áp dụng không, rounding/precision/step/ngưỡng/điểm liệt/xếp loại, quorum/actors/separation/scope, mốc chốt/công bố trong DEFENSE, visibility/release, stale/reopen/phúc khảo/legacy/retention/notification và thời hạn đóng đợt. **Không đánh dấu APPROVED**, không ghi policy TEST_ONLY vào database chung.

## 19. Contract cho UC25

`EffectiveFinalResult` / `FinalResultService.effectiveInSession`: term/student/proposal/committee, finalResultId/revision, full EffectiveCommittee binding, source score ids/revisions/hashes/PDF, approved policy/formula/weights, committee/reviewer aggregate/final/isPassed/classification, snapshot evidenceHash, confirmations, faculty finalized actor/time, publication actor/time/status, effectiveStatus CURRENT. Chỉ trả FINALIZED/PUBLISHED + locked + provenance/current/confirmations và scoped FACULTY components-read. UC25 phải gọi trong transaction nhất quán rồi dùng snapshot; không đọc raw FINAL_RESULT.status/boolean, preview/draft/stale/legacy. Lượt này chưa triển khai UC25.

## 20. Blockers và bảo toàn workspace

Activation còn chờ policy/grant/permission/rubric thật, SQL review + PostgreSQL rehearsal, direct ACL/RLS/REST, Render storage bền vững và browser/database E2E. PROCESS_UC16 chưa có approved mapping/reader học phần; yêu cầu công thức khác WEIGHTED_SUM, quorum khác ONE_PER_ROLE/student, publish sau DEFENSE hoặc precision >1 chữ số cần mở rộng/review. UC23 defenseEvidence=REQUIRED vẫn chặn producer nếu chưa có chứng cứ bảo vệ thật; UC24 không tạo bằng chứng thay.

UC24_WRITES_ENABLED mặc định false, các flag cũ không bật. Không ghi Supabase, apply SQL/migrate/db push/seed/reset/account, sửa Render, đọc/in secrets, sửa `.env`/uploads/Word; không chạy app production. Chỉ build/client local và isolated HTTP tests. Không switch branch/clone/worktree/project folder/reset/clean/stash/commit/push. Metadata worktree cũ giữ nguyên. Kiểm Git và fingerprint SQL được bổ sung ở xác minh cuối bên dưới.

Xác minh cuối: vẫn `feature/b9-b10-implementation` tại `0093f81a6017a8e046a03a8ce9786189cd5b37d8`. `git worktree list` giữ Project1 hiện tại và metadata cũ Project1-B9-B10 prunable tại 5091f2c; folder Project1-B9-B10 không tồn tại, không tạo/dọn metadata đó. `git diff --check` chỉ cảnh báo LF→CRLF có sẵn, không lỗi whitespace. Test và build artifacts local được ignore, không commit/push.

SHA256 `backend/prisma/review/defense-final-results/migration.sql`: `AE99FD15270F0CDBF229A25E14D04D67B963CA5FE6AA388A6445767EC9B7F3FF`. SQL chỉ qua kiểm tĩnh/adapter assertion, **không phải PostgreSQL execution/parse PASS**. Prisma validate/generate do CLI local đọc cấu hình nội bộ, không in giá trị secrets và không kết nối database.
