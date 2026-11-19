# UC20 — phân công giảng viên phản biện

Bàn giao 2026-11-07 tại `E:\Project-Xaydungdoantotnghiep\DATN_Backup\Project1`, nhánh `feature/b9-b10-implementation`, HEAD `0093f81a6017a8e046a03a8ce9786189cd5b37d8`. UC20 có code Backend/Frontend/Shared/Prisma adapter và tests cô lập. **Chưa nghiệm thu PostgreSQL/Supabase/Render/browser end-to-end.** Migration chỉ để review, UC20_WRITES_ENABLED mặc định false. Không ghi production, seed, provisioning, thay Render/storage, commit/push hoặc triển khai UC21–UC25.

## 1. Chức năng đã triển khai

Khoa chọn kỳ, xem hồ sơ/UC19 hội đồng/GVHD hiện hành/GVPB/trạng thái, tìm/lọc/phân trang, xem giảng viên đủ quyền/roster/tiêu chuẩn và tải toàn kỳ; đề xuất tự động nhiều sinh viên, xem lý do không khả thi, áp dụng riêng thành dự thảo, phân/thay/gỡ thủ công hợp lệ, nhập lý do, xem lịch sử và chốt một/nhóm hồ sơ được chọn. Số GVPB/caps/kiêm nhiệm/history/khác bộ môn/chuyên môn lấy từ policy được duyệt, không default 1/2 GVPB hoặc ngưỡng học vụ giả.

Đã đối chiếu XML phần UC20 trong `docs/spec/Project_1_06.docx`: FR-34 + FR-31 hỗ trợ; hội đồng phải có trước; loại GVHD, đề xuất cân bằng và Khoa kiểm tra/chốt. Tài liệu không xác nhận rõ số lượng GVPB, kiêm nhiệm, former advisor và caps; các mục đó được cấu hình và đưa vào approval list. Thông báo/công khai phân công chưa được bật hoặc gửi; quy trình đối tượng/kênh/thời điểm/stale còn cần duyệt. Không tự tuyên bố đã thông báo GVPB.

## 2. Files mới và sửa

| Nhóm | Files UC20 |
| --- | --- |
| Backend mới | `backend/src/defense/reviewers/reviewer.controller.ts`, `reviewer.service.ts`, `reviewer.repository.ts`, `reviewer.validator.ts`, `reviewer-allocation.ts`, `reviewer.spec.ts`, `reviewer.http.spec.ts`, `reviewer.repository.spec.ts` |
| Synthetic / compiled check | `backend/test/reviewer.fixture.ts`; `backend/scripts/check-reviewers-build.cjs` |
| Tích hợp backend | `backend/src/defense/defense.module.ts`; `backend/src/config/environment.ts` |
| Dependency trực tiếp UC19 | `backend/src/defense/committees/committee-workflow.service.ts`: thêm reader `workspaceInSession`, không đổi commands/state của UC19 |
| Prisma | `backend/prisma/schema.prisma`; `backend/prisma/review/defense-reviewers/migration.sql`, `README.md` |
| Shared | `shared/src/contracts/defense-reviewers.ts`; `shared/src/index.ts` export |
| Frontend mới | `frontend/src/features/defense/reviewers/api.ts`, `components.tsx`, `page.tsx`, `api.spec.ts`, `components.spec.tsx`, `page.spec.tsx`, `reviewer.fixture.ts` (synthetic test data, không được page/API import) |
| Router/menu | `frontend/src/app/router/routes.tsx`, `route-manifest.ts`, `route-manifest.test.ts` |
| Handoff | Báo cáo này; bổ sung UC20 trong `docs/implementation/09-10-policy-approval-list.md` |

Các thay đổi UC17–UC19 chưa commit có trước được giữ nguyên. Không viết lại producer/validator UC17/UC18; chỉ mở reader UC19 trong transaction của caller. Không sửa scoring, công thức, PDF/storage hoặc legacy DemoDb để làm nguồn phân công API.

## 3. Bảng và source được tái sử dụng

REVIEWER_ASSIGNMENT có trong Prisma schema và baseline DDL `0_init`: id, proposal_id FK PROPOSAL, reviewer_id FK LECTURER, assigned_at và unique(proposal_id,reviewer_id), hỗ trợ nhiều GVPB. Chưa có workflow/state/revision/actors/UC18–UC19 provenance. Không có API backend reviewer hiện hữu trong defense module bị trùng route mới; frontend reviewer demo không phải source production.

Tái sử dụng DEFENSE_COMMITTEE/COMMITTEE_MEMBER/DEFENSE_COMMITTEE_ASSIGNMENT, DEFENSE_ELIGIBILITY, LECTURER/UserAccount/TERM_LECTURER/LECTURER_AREA, Topic/Proposal/TopicWorkflow/ResearchArea, TermStudent/ThesisTerm/TERM_PHASE/TERM_PARAMETER, AcademicTermGrant/GrantDepartment, TERM_WORKFLOW/ASSIGNMENT_PLAN/ASSIGNMENT_PLAN_WORKFLOW/ADVISOR_ASSIGNMENT/ASSIGNMENT_CHANGE, AuditLog và IdempotencyRecord. Không dùng COMMITTEE_MEMBER REVIEWER legacy hoặc SCORE_ENTRY làm phân công mới.

**Không xác minh lại live metadata Supabase trong lượt này.** Schema repository không chứng minh bảng/cột/constraints/data live tồn tại. Capability checks dùng catalog trước khi chọn cột UC20; thiếu schema thì blocker/legacy projection, không tạo row/bảng ngầm. Legacy headers/rows được chiếu đúng cột baseline khi đọc tương thích; schema/records live vẫn NOT VERIFIED.

## 4. Migration bổ sung tối thiểu

[Gói review UC20](../../backend/prisma/review/defense-reviewers/README.md) nằm ngoài active deploy chain, phụ thuộc B1–B8 → UC17 → UC18 → UC19 → UC20. SQL SHA-256: `720800C8F7E1642404B8A9801003220E3E33EC6942B0673C593A6C329388FE17`.

Không thêm bảng. REVIEWER_ASSIGNMENT thêm **12 cột**: term_id, term_student_id, committee_id, revision, state, selected, context, created_by, updated_by, updated_at, finalized_by, finalized_at. Revision default 0; 11 cột còn lại nullable để giữ legacy. Không UPDATE/backfill/adopt dữ liệu cũ. Giữ PK/id, proposal/reviewer FK và unique cũ, thêm index(term_id,term_student_id).

Một proposal là một nhóm phân công. Các dòng UC20 trong nhóm cùng revision/state/context/updated actor/time/finalization; selected=false lưu cặp đã gỡ. Thay/gỡ/tái chọn tăng revision toàn nhóm, giữ row/id và audit; không cần parent table, không tạo reviewer giả khi draft đã gỡ hết. Nhóm có bất kỳ legacy row nào bị chặn để đối soát riêng. Finalized đóng cả nhóm, kể cả dòng deselected, không thể append reviewer hoặc tái chốt.

SQL có provenance CHECK, transition/conditional owner references, official UC19/UC18 binding guard, all-member advisor conflict qua helper UC19, reviewer active roster/current advisor checks; deferred group guard kiểm nhất quán atomic, số GVPB, kiêm nhiệm và recorded former-advisor history. ACL/RLS đề xuất đóng truy cập trực tiếp PUBLIC/anon/authenticated. Full permissions/grants/policy/expertise/load/effective storage/audit còn do backend kiểm, không coi SQL thay thế evaluator. Chưa thực thi SQL trên PostgreSQL.

## 5. API và frontend route

Sau global API_PREFIX hiện hữu (thường `/api`):

| Method / path | Chức năng |
| --- | --- |
| GET `/defense-reviewers/options` | Các kỳ thuộc grants của FACULTY có read |
| GET `/defense-reviewers/workspace?termId=...` | Hồ sơ scoped, candidates/lý do, policy/blockers, toàn bộ tải và rosterHash |
| GET `/defense-reviewers?termId=...&search=...&state=...&page=...&limit=...` | Lọc scope trước tìm/lọc/paging |
| GET `/defense-reviewers/:id?termId=...` | Nhóm phản biện của TermStudent id; history an toàn và downstream hiện hành |
| GET `/defense-reviewers/allocation?termId=...&termStudentIds=...` | Preview readonly; mặc định xét hồ sơ hợp lệ chưa phân |
| POST `/defense-reviewers/assignments` | Lưu atomic 1–200 nhóm dự thảo, có thể thay/gỡ nhóm chưa chốt |
| POST `/defense-reviewers/:id/update` | Sửa đúng một nhóm đã có, id phải khớp payload |
| POST `/defense-reviewers/finalize` | Chốt atomic 1–200 nhóm được chọn; không mặc định khóa toàn kỳ |

POST cần Idempotency-Key, termId, rosterHash, reason; mỗi nhóm có expectedRevision, evidenceHash, UC18 revision/hash, UC19 id/revision/hash và advisorHash. Zod strict chặn extra actor/trạng thái tự chốt, trùng hồ sơ/GVPB. `reviewerIds: []` chỉ dùng để gỡ draft đã tồn tại; nhóm mới rỗng bị từ chối. Draft có thể chưa đủ số GVPB, nhưng không được vượt số hoặc chứa xung đột; chốt yêu cầu đúng số.

Frontend **`/defense/reviewers`** dùng WorkspaceLayout/sidebar/router guard, HTTP client authenticated, React Query keys actor/term, query params chọn kỳ/hồ sơ/search/state/page. Có candidate checkboxes/reasons, tải, policy/schema blocker, đề xuất/UNSAT/SEARCH_LIMIT/apply riêng, draft replacement/removal, history và chốt nhóm. Loading/empty/error/reload/saving/success/401/403/404/409 và disabled reasons. Không DemoDb trong API mode hoặc thành công giả trước POST commit. Không hiển thị form nhận xét/điểm UC22.

## 6. Permissions và scope

Bốn quyền `defense-reviewer:read/assign/update/finalize`, thuộc **chính role FACULTY**. Read và action phải có; sửa nhóm có sẵn cần cả assign và update. Initial save replay không đòi thêm update chỉ vì chính lệnh đó vừa tạo row; replay của lệnh sửa vẫn cần update. JWT/PermissionsGuard trên routes và service kiểm lại principal/role-bound permissions, term/department grants trong transaction. ADMIN không có academic bypass; STUDENT/LECTURER không tự phân/chốt.

Đọc source cần UC19 read và UC18 read của FACULTY/grant tương ứng. CROSS_DEPARTMENT cũng không cho chọn GVPB ngoài grants; cả sinh viên và giảng viên phải trong phạm vi được phép. Tải tính toàn kỳ nhưng response chỉ trả lecturer profiles trong grants và số tổng hợp, không danh sách sinh viên ngoài scope. Không trả grade/comments/academic references/raw audit. History chỉ chiếu action/reason/revision/actor/time.

## 7. UC18–UC19 và official assignment trong cùng transaction

UC20 lấy workspace qua `CommitteeWorkflowService.workspaceInSession`, sau đó gọi **`effectiveInSession`** cho từng hội đồng nguồn. Reader UC19 sử dụng reader/evaluator UC18 trong chính ReviewerSession; không mở nested repository transaction. UC18 phải ELIGIBLE + FINALIZED + QUALIFIED/current provenance, đúng owner/term/proposal. UC19 phải FINALIZED + current audit/policy/evidence/structure/all-member conflicts; sinh viên có active assignment đúng proposal và revision/hash/advisor binding.

Không dùng status ELIGIBLE, UC17 CONFIRMED, committee.state FINALIZED hoặc COMMITTEE_MEMBER REVIEWER riêng lẻ làm bằng chứng. Khi save/finalize, lock và load lại upstream trong transaction, so toàn bộ payload binding/rosterHash/revision. Source đổi sau preview làm từ chối 409. Source đổi sau chốt khiến GET tính STALE/downstream null; không sửa row, chuyển người hoặc xóa lịch sử âm thầm.

Nguồn GVHD vẫn officialAssignmentPlanId → FINALIZED plan + current assignment + effective latest change của B1–B8, đã được UC18/UC19 kiểm. UC20 đọc thêm history của cùng registration trên các plan published/finalized và toàn bộ changes: ghi nhận current/old/new advisors, kiểm sequence revision/chain/effective time và finalized metadata. History thiếu/gãy/future hoặc plan chưa xác minh làm fail closed; không suy không có tiền sử hướng dẫn từ legacy thiếu dữ liệu.

## 8. Xung đột và policy

Current official GVHD luôn bị loại kể cả khi formerAdvisorRule=ALLOW. Người từng hướng dẫn có ALLOW/FORBID/PENDING_APPROVAL; pending chặn người có tiền sử được ghi nhận. Giảng viên đồng thời thuộc hội đồng có ALLOW/FORBID/PENDING_APPROVAL riêng, tests cả các lựa chọn. UC19 reader vẫn kiểm **mọi** thành viên không phải GVHD; UC20 không sửa membership để né xung đột.

Policy version/approval/reference/time bắt buộc; số GVPB/caps/department rule/title list/expertise/total-load semantics phải explicit. Active account/LECTURER/term roster là baseline. REQUIRED_AREA_MATCH dùng LECTURER_AREA và research area của proposal; không giả lập độ phù hợp, bằng cấp, thâm niên hoặc specialization score khi chưa có source/criteria. Null caps/title list cũng phải là giá trị trong policy đã duyệt, không phải default ngầm.

## 9. Thuật toán cân bằng tải và giới hạn

Engine deterministic backtracking: hồ sơ ít lựa chọn trước, rồi ID; ưu tiên giữ GVPB hiện tại còn hợp lệ, tải phản biện thấp, tổng duty thấp rồi ID. Chọn tổ hợp nhiều GVPB khác nhau, có backtracking để sửa lựa chọn ban đầu. Hard constraints gồm current UC18/UC19/advisor/history, roster/scope/qualification/expertise/kiêm nhiệm, reviewer count/unique và caps.

Tải gồm toàn bộ REVIEWER_ASSIGNMENT của kỳ, không chỉ trang/filter: selected draft/finalized, bảo thủ giữ cả stale/legacy chưa đối soát; bỏ contribution của các nhóm đang đề xuất trước khi phân lại. Tổng duty hiện hỗ trợ `ADVISOR_PLUS_COMMITTEE_PLUS_REVIEW`: current official advisor assignments + active UC19/legacy session duties + reviewer duties. Legacy session claims được deduplicate theo proposal trong cùng hội đồng. Không coi dữ liệu chưa xác minh là bằng chứng chốt; reservation chỉ tránh phân vượt tải. Fixed loads vượt approved caps cũng trả UNSAT, không báo một phương án tổng thể hợp lệ khi còn vi phạm cố định.

FEASIBLE là phương án thỏa constraints trong không gian được xét, không tự save/chốt và không bảo đảm tối ưu soft objectives. UNSAT chỉ khi exhaustive hoặc có bất khả thi hiển nhiên; budget 100.000 nodes đạt giới hạn thì SEARCH_LIMIT, không trả partial placements. Giới hạn kỹ thuật: 200 hồ sơ/lệnh, 20 GVPB/hồ sơ; đây không phải số lượng mặc định hoặc quy định Khoa. Cân bằng liên bộ môn/hội đồng và trọng số chuyên môn cần duyệt thêm nếu Khoa yêu cầu objective khác.

## 10. Revision, audit, idempotency, concurrency

GET RepeatableRead, không gọi mutators hoặc tạo assignment/audit/idempotency. Commands Serializable, term lock chung với producer upstream, committee/phase/proposal locks và reviewer rows theo thứ tự ổn định; reauthorize, check binding, CAS từng dòng và atomic toàn nhóm/batch. Unique/serialization conflict Prisma P2002/P2034 trả 409. PostgreSQL thực/SQL-trigger exception mapping vẫn cần rehearsal.

Save/group revision + context + selected rows, audit và idempotency cùng transaction; failure rollback. Existing rows được deselect/reactivate, không delete. Audit snapshot hash bind **toàn nhóm** và actor/revision/action; group metadata phải nhất quán trước khi coi là trusted. Chốt đóng nhóm; không có endpoint mở lại/thay sau chốt. Replay cùng body/key trả ack cũ, không ghi thêm; đổi body 409, vẫn kiểm quyền/scope của request. Ack replay không thay thế EffectiveReviewerAssignment hiện hành.

Evidence hash bind UC18, UC19, assignment revision, advisor/history, policy và semantic roster (không grades). Hiện snapshot roster rộng trong scope: thay qualification/roster của giảng viên có thể làm các nhóm khác STALE một cách bảo thủ; không tự bỏ qua thay đổi để giữ trạng thái xanh. Source memoization upstream chỉ trong transaction của caller, không cache proof qua request/actor. Native DB isolation/race/rollback chưa được suy PASS từ queue in-memory.

## 11. Kết quả kiểm thử local

| Kiểm tra | Kết quả |
| --- | --- |
| UC20 backend | 52 tests: 42 domain/service/contracts/engine, 4 HTTP JWT/RBAC/Zod loopback, 6 adapter boundary |
| Full backend suite mặc định | 51 files / 536 tests PASS |
| UC20 frontend | 25 tests: 11 component, 8 page/cache SSR, 6 API; thêm 1 route/menu permission test |
| Full frontend suite | 44 files / 240 tests PASS |
| Shared build | PASS |
| Prisma validate/generate | PASS local, không migrate hoặc kết nối ghi DB |
| Backend Nest build + full emit `--incremental false` và typecheck | PASS |
| Backend/frontend lint/typecheck | PASS |
| Frontend Vite production build | PASS; còn Vite CJS deprecation và chunk >500 kB |
| Native compiled UC17/UC18/UC19/UC20 DI/load | PASS với mock infrastructure, không AppModule/server/DB |
| git diff --check / UC20 untracked whitespace | PASS; Git có cảnh báo chuẩn hóa LF/CRLF |

Tests kiểm valid/multiple/incomplete/duplicate/current advisor, active/roster/title/area/department/scope, former-advisor/committee rules, UC18 chưa chốt/legacy/stale, UC19 draft/stale/all-member advisor conflict, history/source đổi sau preview và sau finalize, toàn kỳ load/caps/total duties, deterministic/only choice/UNSAT/backtracking/SEARCH_LIMIT, idempotency/changed body/assign-only replay, concurrent synthetic CAS, audit/idempotency rollback, GET readonly và dùng cùng caller session. Không làm đổi UC19 và không tạo SCORE_ENTRY/điểm phản biện.

HTTP tests mở listener loopback ephemeral với real controller/JWT/guards/Zod/service và synthetic persistence/storage, đóng sau mỗi test. Component/page tests dùng SSR + React Query cache; không phải browser click E2E. Có cảnh báo SSR useLayoutEffect khi chạy không silent. Không import PrismaClient hoặc dùng database/storage production trong fixtures.

## 12. Regression B1–B8 và UC17–UC19

Full suites giữ PASS auth/session/RBAC/audit, catalog/import, term/quota/phases, registration/assignment/handover, topic/reviews/versions/dossier, guidance/tasks/submissions/progress/weekly, final PDF/confirmation/legacy score guard, eligibility evaluator/provenance/finalize, committees/conflict/allocation/revision. Không sửa scoring/rubric hoặc 17 migration nền để làm UC20.

Chỉ thêm reader UC19 và đăng ký providers/controller/export ReviewerService. Không đổi UC19 commands hoặc ghi lại committee/member/student state khi phân phản biện. Synthetic tests so nguyên trạng UC19 trước/sau và regression đầy đủ; không tuyên bố đã xác minh legacy production endpoints bằng tài khoản thật.

## 13. Những điểm NOT VERIFIED E2E

Chưa xác minh live REVIEWER_ASSIGNMENT/constraints/rows, áp SQL, conditional references/deferred multi-row guards, locking/isolation/CAS races/rollback, SQL→Prisma→HTTP errors, runtime RLS/ACL, permission/grant provisioning, backup/restore hoặc migration history mới. Chưa có chính sách Khoa production được ghi; fixtures không là phê duyệt.

Chưa chạy API/browser với PostgreSQL/Supabase/Render thật; chưa benchmark nhiều hội đồng/hồ sơ. UC19 effective reader hiện re-evaluate workspace khi kiểm mỗi hội đồng, dù PDF/upstream reads đã memoize trong session; cần đo latency và xem xét batching trước đợt lớn. Kiểm storage/PDF checksum/persistence/backup qua Render restart/redeploy vẫn kế thừa blocker UC17. Không tạo disk/bucket/database riêng để giả lập đã giải quyết.

## 14. Chính sách chờ duyệt và workspace safety

Xem [approval list UC20](09-10-policy-approval-list.md): số GVPB, tiêu chuẩn/chuyên môn, former advisor, kiêm nhiệm hội đồng, phản biện khác bộ môn, caps/tổng duty/weights/cân bằng, phase/deadline, quyền/separation, thay/vắng sau chốt, xử lý stale, UC22 readiness, notification/publication, legacy/DDL/deployment/test environment.

Không switch branch, reset/clean/stash, clone, tạo worktree/project folder mới hoặc commit/push. Không sửa `.env`, uploads, Word/docx/file khóa hoặc dữ liệu local; metadata worktree prunable cũ không dọn. Không migrate/db push/seed/reset, tạo account/dữ liệu test, bật write flags hoặc đổi Render/Supabase production. Chỉ code trong Project1 và chạy checks cô lập.

## 15. Contract cho UC22

Shared `EffectiveReviewerAssignment` chứa termId/termStudentId/proposalId/committeeId/lecturerId, assignmentId thực của cặp + group revision, finalizedBy/At, policyVersion/hash, evidenceHash, full EffectiveEligibility, UC19 revision/evidence/policy hash + committeeAssignmentRevision và official advisor id/hash; effectiveStatus CURRENT.

Chỉ group FINALIZED + current/trusted cả nguồn lẫn policy/qualification/capacity mới có downstream array; STALE/legacy/draft trả null. `ReviewerService.effectiveInSession` được export qua DefenseModule, nhận ReviewerSession của caller + expectedRevision/evidenceHash và kiểm lại; không mở nested read transaction. Consumer UC22 sau này phải bind đúng lecturerId với principal, own permission/scope/window/locks và kiểm reader ngay trong transaction khi ghi nhận xét/điểm. Không coi ack save/finalize hoặc GET trước đó là quyền chấm vĩnh viễn. UC20 không triển khai UC22.

## 16. Lưu ý cho UC21 sau này

UC21 phải lấy hội đồng/active student assignment/version từ UC19 hiện hành và liên kết lịch thật với assignment revision/evidence. Không lấy REVIEWER_ASSIGNMENT hoặc role REVIEWER legacy để tự suy phòng/buổi/giờ hoặc bỏ qua all-member advisor conflict. Policy về thay/vắng/nguồn stale sau khi xếp lịch cần được duyệt; giữ nguyên COMMITTEE_STUDENT/DEFENSE_SESSION legacy đến khi có kế hoạch đối soát. Lượt này không tạo lịch, room/time/session, xếp tên, reviewer grades/comments, kết quả hoặc export UC21–UC25.
