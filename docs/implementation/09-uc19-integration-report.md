# UC19 — thành lập hội đồng bảo vệ

Bàn giao 2026-11-07 tại `E:\Project-Xaydungdoantotnghiep\DATN_Backup\Project1`, nhánh `feature/b9-b10-implementation`, HEAD `0093f81a6017a8e046a03a8ce9786189cd5b37d8`. Chỉ triển khai UC19. Code, Prisma adapter, migration review và tests cô lập đã có; **chưa nghiệm thu PostgreSQL/Supabase/Render end-to-end**. Không bật ghi production, không apply migration, seed, provision, commit/push hoặc tạo nhánh/worktree/project mới.

## 1. Chức năng đã code

Khoa xem danh sách/chọn đợt/search/filter/paging và chi tiết hội đồng; tạo/sửa mã, tên, bộ môn; quản lý danh sách thành viên và vai trò; xem tải; đọc hồ sơ UC18; phân/chuyển/gỡ sinh viên có lý do; đề xuất phân cân bằng; xem xung đột/history và chốt hội đồng. Commands có permission/scope, revision/hash, lock, Serializable/CAS, audit và idempotency.

Hội đồng chính thức luôn 3–5 giảng viên. Dự thảo có thể chưa đủ người, nhưng không được phân sinh viên/chốt khi cơ cấu chưa đạt. Vai trò/counts/tiêu chuẩn/tải/cửa sổ lấy từ UC19_POLICY đã duyệt. Đề xuất không tự lưu hoặc tự chốt. Hội đồng chốt có nguồn stale giữ nguyên dữ liệu, bị loại khỏi downstream; không âm thầm xóa/chuyển sinh viên.

Đã đọc trực tiếp XML phần UC19 trong `docs/spec/Project_1_06.docx`, các báo cáo UC17/UC18 và policy list, schema/DDL/migration review, official assignment/handover, auth/grants, source defense/grading hiện có. Đặc tả UC19 có phân sinh viên vào hội đồng; không triển khai phản biện UC20 hay phòng/buổi/giờ/sắp tên UC21.

## 2. Files

| Nhóm | File trong phạm vi UC19 |
| --- | --- |
| Backend mới | `backend/src/defense/committees/committee-workflow.controller.ts`, `committee-workflow.service.ts`, `committee.repository.ts`, `committee.validator.ts`, `committee-allocation.ts`, `committee.spec.ts`, `committee.http.spec.ts`, `committee.repository.spec.ts` |
| Fixture/build | `backend/test/committee.fixture.ts`; `backend/scripts/check-committee-build.cjs` |
| Tích hợp backend | `backend/src/defense/defense.module.ts`, `backend/src/config/environment.ts`; controller/service committee legacy để giới hạn quyền/scope và bỏ contact fields |
| Dependency UC18 | `backend/src/defense/eligibility/eligibility.service.ts`: thêm reader `forCommittee` và `committeePolicyReady` nhận session của caller; không đổi UC18 endpoints/decisions |
| Prisma | `backend/prisma/schema.prisma`; `backend/prisma/review/defense-committee/migration.sql`, `README.md` |
| Shared | `shared/src/contracts/defense-committee.ts`; export ở `shared/src/index.ts` |
| Frontend mới | `frontend/src/features/defense/committees/api.ts`, `components.tsx`, `page.tsx`, `api.spec.ts`, `components.spec.tsx`, `page.spec.tsx` |
| Router/menu | `frontend/src/app/router/routes.tsx`, `route-manifest.ts`, `route-manifest.test.ts` |
| Handoff | Báo cáo này; bổ sung UC19 ở `docs/implementation/09-10-policy-approval-list.md` |

Các thay đổi UC17/UC18 chưa commit có trước vẫn được giữ. Không dùng implementation defense DemoDb để quyết định/phân công trong API mode; source UC17 production không bị thay đổi trong lượt UC19.

## 3. Bảng hiện có và khoảng trống metadata live

Schema repository/DDL B1–B8 có DEFENSE_COMMITTEE (id/term/name), COMMITTEE_MEMBER (PK committee + lecturer, role), DEFENSE_SESSION (committee/room/time), COMMITTEE_STUDENT (PK session + proposal, order). Tái sử dụng hai bảng đầu; không sửa PK, không rewrite dữ liệu hai bảng lịch.

Nguồn tái sử dụng: LECTURER/UserAccount/TERM_LECTURER, Student/TermStudent/Proposal/TopicWorkflow, AcademicTermGrant/GrantDepartment, officialAssignmentPlanId/AssignmentPlan FINALIZED/AssignmentPlanWorkflow/AdvisorAssignment/AssignmentChange, ThesisTerm/TermPhase/TermParameter, AuditLog/IdempotencyRecord và toàn bộ evaluator/provenance/PDF UC18→UC17.

**Không khẳng định ba bảng committee đã được xác minh lại trên Supabase live.** JSON metadata UC17 đã lưu không chứa DEFENSE_COMMITTEE, COMMITTEE_MEMBER, COMMITTEE_STUDENT. Lượt này dùng schema/DDL/source và synthetic fixtures, không đọc secrets hoặc kết nối live để lấp khoảng trống đó. Backend capability-check catalog trước khi chọn cột mới; chưa có schema thì trả blocker/legacy projection, không tự tạo bảng hoặc coi package review là đã apply.

## 4. Migration tối thiểu và lý do thêm bảng

[Gói review](../../backend/prisma/review/defense-committee/README.md) ngoài active migration chain, thứ tự B1–B8 → UC17 → UC18 → UC19. SHA-256 SQL tại bàn giao: `62CE6BB10DA26F1B547E6002601C59993ADB48D16BF7427E0AF442AE25F12DF8`.

DEFENSE_COMMITTEE thêm code unique trong term, department scope, revision/state/context, created/updated/finalized actor và time; legacy default revision 0, cột còn lại null. COMMITTEE_MEMBER giữ PK cũ, dùng các vai trò CHAIR/SECRETARY/MEMBER cho UC19 mới; REVIEWER legacy không được tự adopt.

Chỉ thêm **DEFENSE_COMMITTEE_ASSIGNMENT**: phân sinh viên trước khi có lịch, unique TermStudent/Proposal, ACTIVE/REMOVED, revision, actor/time và UC18/advisor binding. COMMITTEE_STUDENT không dùng được cho phân công chưa xếp lịch vì session composite PK và phòng/thời gian bắt buộc. Không tạo session/room giả, không sửa nghĩa dữ liệu legacy để né UC21.

SQL có provenance CHECK, FKs/unique/index, guards revision/owner/legacy/frozen state, all-member conflict trên membership/assignment và deferred final structure. RLS/ACL đề xuất đóng truy cập trực tiếp PUBLIC/anon/authenticated; actor/department references conditional trên CC mới, FK của assignment mới. Backend vẫn chịu trách nhiệm kiểm đủ policy/grants/effective evidence/PDF, không tuyên bố trigger thay thế toàn bộ evaluator. Thực thi SQL/FK/triggers/ACL/isolation/error mapping DB thật vẫn NOT VERIFIED.

## 5. API thực tế

Sau global API_PREFIX của nhóm, thường `/api`:

| API | Nội dung |
| --- | --- |
| GET `/defense-committees/options` | Term trong grants của FACULTY có read |
| GET `/defense-committees/workspace?termId=...` | Committee/candidate/roster/load/policy/blockers và rosterHash trong scope |
| GET `/defense-committees?termId=...&search=...&state=...&page=...&limit=...` | Danh sách scoped, tìm/lọc/paging |
| GET `/defense-committees/:id?termId=...` | Chi tiết, lịch sử đã chiếu an toàn và downstream nếu còn hiệu lực |
| GET `/defense-committees/allocation?termId=...&termStudentIds=...` | Đề xuất readonly; bỏ lựa chọn thì xét hồ sơ hợp lệ chưa phân |
| POST `/defense-committees` | Tạo dự thảo với mã/tên/bộ môn/members |
| POST `/defense-committees/:id/update` | Sửa danh sách thành viên/roles/identity trước chốt |
| POST `/defense-committees/assignments` | Atomic batch phân/chuyển có binding từng hồ sơ, revisions hội đồng nguồn/đích |
| POST `/defense-committees/:id/unassign` | Gỡ explicit, giữ assignment row ở REMOVED và history |
| POST `/defense-committees/:id/finalize` | Kiểm lại nguồn/cơ cấu/tải/locks rồi chốt |

POST bắt buộc Idempotency-Key, reason, expectedRevision (hoặc map revisions cho batch), rosterHash; placement có expectedAssignmentRevision, eligibilityRevision/evidenceHash/advisorHash. Runtime Zod strict không nhận actor/chốt trạng thái từ client. Trả 400/401/403/404/409 ở các trường hợp tương ứng.

Route cũ GET `/committees/term/:termId` được giữ nhưng thêm `defense-committee:read` + FACULTY/grant filtering; query legacy bắt buộc allowedIds và chỉ chọn định danh/tên giảng viên, không contact/grade. Đây là thay đổi quyền có chủ đích cần review khi rollout. Route cũ không phải bằng chứng hội đồng chính thức; consumer dùng EffectiveCommittee.

## 6. Quyền và scope

Năm quyền riêng: `defense-committee:read/create/update/assign/finalize`. Service ràng buộc permission thuộc chính role FACULTY; không ghép quyền ADMIN của role khác để nâng quyền học vụ. Student/Lecturer không tự tạo/chốt. Mọi committee read/write kiểm term và department grants, cả department mới khi đổi identity; batch kiểm các hội đồng nguồn/đích.

Đọc nguồn UC18 cần `defense-eligibility:read` của FACULTY và scope tương ứng. Candidate/placement không nhận grade/comment/rejection text/academic reference hoặc raw audit UC18. Lịch sử UC19 chỉ trả action/reason/revision/actor/time. Workload giảng viên là số tổng hợp trong term để kiểm giới hạn; không trả danh sách sinh viên ngoài scope. Không tạo quyền hoặc account thật trong lượt này; mapping chỉ nằm trong SQL review.

## 7. UC18 → UC19 trong cùng transaction

UC18 reader nhận `CommitteeSession`/`EligibilitySession` của caller, không mở nested repository transaction. Chỉ EffectiveEligibility ELIGIBLE + FINALIZED + QUALIFIED + current audit/policy/evidence và đúng owner/term được dùng. UC17 CONFIRMED hoặc riêng cột status ELIGIBLE không đủ.

UC19 lấy lại official advisor qua B1–B8 pointer/FINALIZED plan/current assignment/effective latest change; advisorHash bind id/assignmentId/revision. Mỗi assignment lưu EffectiveEligibility snapshot, advisor id/hash và UC19 policy hash. Nếu eligibility/advisor đổi sau preview, command từ chối binding cũ; nếu đổi sau chốt, downstream null/STALE và phân công vẫn được giữ.

Policy UC17/UC18 phải hợp lệ ngay cả khi tạo/chốt hội đồng rỗng; schema upstream thiếu là blocker. Việc chốt không có sinh viên cũng phải được khai báo rõ qua `allowEmptyFinalization`, không mặc định thành quy định production.

## 8. Xung đột tất cả thành viên

`advisorConflict` dùng `members.some(member.lecturerId === officialAdvisorId)`, không lọc vai trò. Kiểm ở phân thủ công/batch/chuyển, sửa hoặc xóa/thay membership, preview và chốt. Thêm GVHD của sinh viên đang có làm rollback toàn bộ thay đổi membership. Source handover/UC18 stale không tự gỡ/chuyển hay sửa quyết định cũ.

SQL review cũng kiểm mọi COMMITTEE_MEMBER ở assignment và mọi active student khi thêm member; FK/unique không phải thay thế cho conflict checker. Sau chốt không có endpoint mở lại; đây là policy pending, không cung cấp bypass bằng ADMIN.

## 9. Thuật toán đề xuất và giới hạn

Engine deterministic constraint search: sort SV theo số lựa chọn hợp lệ rồi ID; ưu tiên hội đồng hiện tại còn hợp lệ, sau đó tải SV/hội đồng thấp, tải thành viên thấp và ID. Hard constraints: effective UC18, cùng term/bộ môn được hỗ trợ, cơ cấu/roster/qualification, không trùng bất kỳ GVHD, sức chứa và tải mọi giảng viên theo policy. Existing assignments không được chọn là fixed; finalized/ngoài quyền không tự chuyển. Counts gồm cả tải legacy bảo thủ; legacy session claims cần đối soát trước khi phân lại.

Nếu có phương án, trả FEASIBLE với placements/load để Khoa review. Backtracking có thể sửa lựa chọn heuristic trước đó; không trả partial placements vi phạm khi thất bại. UNSAT chỉ khi chứng minh không có lời giải trong toàn không gian đã xét; chạm budget 100.000 nodes thì SEARCH_LIMIT, không gọi UNSAT. API giới hạn 200 SV/đề xuất (giới hạn kỹ thuật). Soft objectives là heuristic, **không bảo đảm tối ưu toàn cục hoặc chứng minh tối ưu tải**. Thứ tự/weights cần duyệt ở policy list.

Preview là GET, không lưu assignment/audit/idempotency. Apply là POST riêng, recheck tất cả binding và revisions; sửa request browser không vượt được backend constraints.

## 10. Revision, history, transaction và storage

GET RepeatableRead, không tạo ngầm row. Commands Serializable, term lock chung với upstream rồi proposal/phase/assignment locks, reauthorize và CAS; unique/serialization conflicts trả 409. Row/member/assignment changes, audit và idempotency cùng transaction; failure rollback toàn bộ. Replay cùng key/body không ghi thêm, đổi body 409 và scope vẫn được kiểm lại.

Create tạo revision 1 nội bộ rồi CAS bind member snapshot thành revision 2 trong cùng transaction; revision 1 chưa bind không được công bố qua GET. Các lần sửa/chốt tiếp tăng một. Membership dùng parent revision. Assignment giữ một row có revision tăng khi phân/chuyển/gỡ/tái phân; REMOVED không phải xóa lịch sử. Active roster đã chốt không thay đổi khi một row đã gỡ trước đó được tái sử dụng ở hội đồng khác.

Audit provenance bind identity/membership/active assignments. Lecturer facts hiện hành là evidence riêng, không làm mất quyền sửa dự thảo chỉ vì giảng viên inactive; dự thảo có thể thay người explicit. Finalized output còn cần contentHash/qualifications/source hiện hành. Sửa tên hiển thị hoặc thêm roster của kỳ khác không tự làm đổi chứng cứ của kỳ đang xét.

Source reads được memoize **chỉ trong session transaction**, key gồm actor/term/member cho UC18 proof; đọc CC/member/assignment/audit sau mutation vẫn fresh. Không cache chứng cứ qua request/actor. Chỉ scan các membership có proposal và active assignments cần rà soát, tránh đọc mọi hồ sơ rỗng và đọc PDF lặp nhiều lần trong cùng command. Load/latency thực trên Render/Supabase vẫn chưa được benchmark.

PDF/storage dùng nguyên FileStorageService UC17 và kiểm chứng UC18; không tạo storage/bucket/disk mới hoặc sửa config Render. Bền vững/backup/restart/redeploy vẫn là blocker từ handoff UC17.

## 11. Frontend và kiểm thử

Route/menu **`/defense/committees`** trong WorkspaceLayout, FACULTY + read permission. Dùng authenticated HTTP client và React Query keys actor/term; chọn committee/search/state/page bằng query params. Có roster/roles, tải, policy/blockers, candidate UC18, lựa chọn hội đồng hợp lệ, manual transfer/removal, proposal/UNSAT/search-limit, apply riêng, history và finalization. Không DemoDb fallback, không báo success trước POST commit.

| Kiểm tra local | Kết quả |
| --- | --- |
| UC19 backend | 47 tests PASS: 39 service/domain/contracts/engine, 4 JWT/RBAC/Zod HTTP, 4 adapter boundary/cache |
| Backend full suite mặc định | 48 files / 484 tests PASS |
| Frontend UC19 | 19 tests mới (10 component, 6 page/cache, 3 API) + 1 navigation test PASS |
| Frontend full suite | 41 files / 214 tests PASS |
| Shared build, Prisma validate/generate | PASS local, không migrate/kết nối ghi DB |
| Nest build + full TypeScript emit `--incremental false` | PASS |
| Backend/frontend typecheck/lint | PASS |
| Native compiled DI/load UC17/UC18/UC19 | PASS với mock infrastructure, không AppModule/server/DB |
| Vite production build | PASS; còn cảnh báo chunk >500 kB / Vite CJS deprecation |
| git diff --check | PASS; có cảnh báo chuẩn hóa LF/CRLF của Git |

Tests gồm 2/3/5/6 người, duplicate/roster/inactive/title/scope, conflict CHAIR/SECRETARY/MEMBER và đổi người, source handover/stale/legacy/not-finalized/wrong term, chuyển/unique assignment, finalized source stale/re-finalize blocked, legacy session claim, UNSAT, tải lệch/capacity dùng chung/permutation, replay/changed body/scope, concurrent revision/CAS, audit/idempotency rollback, GET readonly, dùng session upstream và downstream reader. Frontend kiểm list/term/roles/preview/disabled/pending/empty/error 401/403/404/409, API success/failure và actor/term cache isolation.

## 12. Regression B1–B8, UC17 và UC18

Full suites giữ PASS auth/session/RBAC, catalog/import, term/quota/phase, đăng ký/phân công, topic/review/version/dossier, guidance/task/submission/weekly/progress, UC17 final-defense/legacy grade guard và UC18 evaluator/review/decision/finalize. Không sửa công thức điểm hoặc rubric grading để phục vụ UC19. Các reader bổ sung UC18 không thay đổi các endpoint/hành vi UC18 đã bàn giao.

Không sửa 17 migration B1–B8, không đổi `.env`, uploads hoặc Word/docx/data local. Không switch/reset/clean/stash, không clone, không worktree/folder dự án mới, không commit/push. Metadata prunable Project1-B9-B10 cũ không được prune/dọn. Thay đổi UC17/UC18 đang có được bảo toàn.

## 13. NOT VERIFIED end-to-end

HTTP harness chỉ mở loopback ephemeral với persistence/storage synthetic, đóng sau test. Component/page tests là SSR/React Query fixtures; có warning useLayoutEffect nếu chạy không silent. Không phải browser click/HTTP end-to-end với PostgreSQL và backend Render thật.

Chưa xác minh live schema/counts/constraints committee, chạy SQL review, FK/deferred triggers/locks/isolation/race/rollback trên PostgreSQL, ACL/RLS/runtime role/error mapping, migration history mới, backups/restore, actual permission/grants/account, policy thật, storage Render hoặc load/latency qua Supabase. Không gọi các phần đó PASS từ mock tests.

## 14. Policy và deployment blockers

Xem [approval list](09-10-policy-approval-list.md): tiêu chuẩn/counts/kiêm nhiệm, caps, empty finalization, soft balancing, quyền/phân tách người tạo-chốt, phase/deadline, phạm vi bộ môn/toàn Khoa, sửa sau chốt/vắng/thay thế, xử lý UC18 stale và legacy/handover. Cross-department student pooling và workflow sửa hội đồng đã chốt chưa có quy định được duyệt; hiện fail closed, không giả lập production thành công.

UC19_WRITES_ENABLED mặc định false; không bật flag trong lượt này. Cần nhóm phê duyệt UC17→UC18→UC19 schema/permissions/policies, cấp rehearsal environment/records và xác minh storage + E2E/load trước vận hành ghi. Policy/config đã có code không đồng nghĩa đã được Khoa phê duyệt.

## 15. Contract cho UC20/UC21

Shared `EffectiveCommittee`: term/committee/code/department/revision, finalized actor/time, policyHash/evidenceHash, members với role, students với proposal/TermStudent, assignment revision, advisor id/hash và EffectiveEligibility snapshot, effectiveStatus CURRENT. Chỉ trả khi finalized/provenance/current evidence đúng; còn lại downstream null.

Backend có `CommitteeWorkflowService.effectiveInSession` exported qua DefenseModule, nhận session của caller cùng expectedRevision/evidenceHash, đọc/kiểm lại thay vì mở nested transaction. Consumer tương lai phải dùng reader trong transaction của chính command, kiểm quyền/grants/window/locks của UC20/UC21 và nguồn còn hiệu lực tại thời điểm thao tác; không coi GET trước đó là giấy phép vĩnh viễn hoặc đọc riêng state/status.

UC21 cần liên kết lịch thật với assignment/version UC19 và kế hoạch xử lý COMMITTEE_STUDENT legacy được duyệt; không tự ghi session claim cũ không binding rồi gọi nó chính thức. Chưa tạo reviewer assignment, notification phản biện, session/time/room, sắp tên, grading hay export UC20–UC25 trong lượt này.
