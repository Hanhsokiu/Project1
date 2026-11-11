# UC18 — tích hợp xét điều kiện bảo vệ

Bàn giao ngày 2026-11-07 trong `E:\Project-Xaydungdoantotnghiep\DATN_Backup\Project1`, nhánh `feature/b9-b10-implementation`, HEAD `0093f81a6017a8e046a03a8ce9786189cd5b37d8`. Chỉ bổ sung UC18; không triển khai UC19–UC25. Code chính và các adapter đã có tests cô lập; **chưa nghiệm thu end-to-end trên Supabase/Render**. `UC18_WRITES_ENABLED` mặc định false.

## 1. Phạm vi đã thực hiện

Luồng UC18 có controller/service/Prisma repository/validator/evaluator, shared Zod contracts, trang React dùng HTTP client/JWT/RBAC hiện hữu, kiểm scope và commands review → decide → finalize. GET tách chứng cứ thực tế, preview evaluator và quyết định chính thức của Khoa. GVHD CONFIRMED hoặc preview QUALIFIED không tự tạo quyết định, không tự chốt hồ sơ.

Khoa có thể kiểm tra hồ sơ và ghi chứng cứ học vụ thủ công **chỉ khi source/mode đã được policy duyệt**, lưu quyết định có lý do và chốt atomic nhóm hồ sơ được chọn. Dữ liệu test có policy synthetic; chưa có policy production nào được ghi. Các quy định thiếu được tập hợp ở [danh sách phê duyệt chung](09-10-policy-approval-list.md), không hỏi để dừng lập trình.

Đã đọc đặc tả UC18 trực tiếp từ XML bên trong `docs/spec/Project_1_06.docx` và đối chiếu bản trích xuất, handoff/deployment/schema metadata UC17, Prisma schema, DDL baseline/bridge/workflow/permissions và source producer B1–B8. Tài liệu đặc tả gọi xác nhận học vụ thủ công là **đề xuất cần Khoa xác nhận**; code không tự coi đó là chính sách đã duyệt.

## 2. File mới và sửa trong phạm vi UC18

| Nhóm | File |
| --- | --- |
| Backend mới | `backend/src/defense/eligibility/eligibility.controller.ts`, `.service.ts`, `.repository.ts`, `.validator.ts`, `.spec.ts`, `.http.spec.ts`, `.repository.spec.ts` |
| Backend tích hợp | `backend/src/defense/defense.module.ts`; `backend/src/config/environment.ts` thêm flag false |
| Test fixtures / build check | `backend/test/eligibility.fixture.ts`; `backend/scripts/check-eligibility-build.cjs`; fixture UC17 `backend/test/final-defense.fixture.ts` thêm actor vào audit synthetic để kiểm provenance liên UC |
| Prisma | `backend/prisma/schema.prisma`; `backend/prisma/review/defense-eligibility/migration.sql`, `README.md` |
| Shared | `shared/src/contracts/defense-eligibility.ts`; export ở `shared/src/index.ts` |
| Frontend mới | `frontend/src/features/defense/eligibility/api.ts`, `components.tsx`, `page.tsx`, `api.spec.ts`, `components.spec.tsx`, `page.spec.tsx` |
| Router/menu | `frontend/src/app/router/routes.tsx`, `route-manifest.ts`, `route-manifest.test.ts` |
| Bàn giao | Báo cáo này; `docs/implementation/09-10-policy-approval-list.md` |

Các file UC17 đã sửa/chưa commit từ trước vẫn được giữ. Không thay service/controller/repository production UC17 để dựng UC18; tái sử dụng validators và session methods. Thay fixture UC17 chỉ bổ sung userId cho audit mock; regression UC17 được chạy lại.

## 3. Database và nguồn chứng cứ tái sử dụng

| Chứng cứ | Nguồn / kiểm tra |
| --- | --- |
| Sinh viên đúng đợt | TERM_STUDENT → STUDENT; owner topic và Proposal phải cùng student/term, chỉ một proposal xác định |
| Đề tài / phân công | TOPIC_WORKFLOW, TERM_WORKFLOW.officialAssignmentPlanId, ASSIGNMENT_PLAN FINALIZED có metadata, ADVISOR_ASSIGNMENT/latest ASSIGNMENT_CHANGE, roster giảng viên và xác nhận đề tài hiện hành |
| Dossier chính thức | PROPOSAL APPROVED, PROPOSAL_WORKFLOW, SEALED version, DOSSIER_WORKFLOW/current DOSSIER_FINALIZATION, approvalDecisionId và hash print snapshot; dùng GuidanceValidator.finalized |
| Tiến độ UC14–UC16 | Theo policy: xác nhận tổng kết UC17, hoặc kế hoạch/current assignment/finalization + effective report reviews + PERIOD_REQUIRED_STUDENT/WEEKLY_REPORT_OBLIGATION. Nhánh strict kiểm đúng reviewer/assignment revision/submission snapshot/file metadata và coverage |
| PDF cuối | FINAL_REPORT/FINAL_REPORT_VERSION/FILE_ASSET của UC17; đúng student creator, private REPORT READY, PDF MIME, size/version time; đọc FileStorageService và so SHA-256, không tạo thư mục khi GET |
| GVHD quyết định | DEFENSE_CONFIRMATION + SCORE_ENTRY ADVISOR và audit `ADVISOR_SUMMARY_RECORDED` / `ADVISOR_DEFENSE_DECIDED`, đúng actor/context/current PDF; legacy thiếu provenance không được dùng |
| Học vụ | UC18 attestation có source/reference/outcome/time/actor/policy hash trong context của DEFENSE_ELIGIBILITY. Student.academicEligible/GPA không được dùng làm quyết định học vụ |
| Faculty scope | USER_ACCOUNT/userRoles/rolePermissions và ACADEMIC_TERM_GRANT/GRANT_DEPARTMENT; bộ môn lấy từ ResearchAreaWorkflow của topic |
| Mốc xét | THESIS_TERM/TERM_PHASE qua operationWindow; phase FINAL hoặc DEFENSE phải do UC18_POLICY chọn, không hard-code ngày |
| Lưu và truy vết | DEFENSE_ELIGIBILITY hiện có + AUDIT_LOG + IDEMPOTENCY_RECORD + TERM_PARAMETER UC18_POLICY; không tạo bảng nghiệp vụ mới |

Baseline DEFENSE_ELIGIBILITY có `id`, unique `proposal_id` (DDL có FK tới PROPOSAL), enum PENDING/ELIGIBLE/INELIGIBLE/DEFERRED, `checked_at`, `note`, `created_at`. Chưa có actor/revision/context/chốt. Quan hệ TermStudent/ThesisTerm được xác minh qua proposal/topic owner, không tạo danh sách sinh viên hay tài khoản riêng.

Metadata live UC17 đã lưu không chứa DEFENSE_ELIGIBILITY; lượt UC18 không kết nối lại Supabase hoặc đọc secret để lấp khoảng trống đó. Schema live/row count/constraints thực tế của bảng này là **NOT VERIFIED**. Capability checks kiểm catalog trước khi đọc cột mới; nếu thiếu cả bảng/cột baseline, GET trả chứng cứ schema thiếu thay vì tự tạo row/bảng.

PhaseEvaluation/EvaluationWorkflow hiện có trong schema không được tự nhận là nguồn ngưỡng học vụ hoặc điểm đạt. Nếu Khoa yêu cầu thêm đánh giá mốc/rubric cụ thể ngoài hai progress rules hiện hỗ trợ, cần đặc tả/producer chính thức được duyệt trước khi mở ghi.

## 4. Migration cần thêm

[Package review UC18](../../backend/prisma/review/defense-eligibility/README.md) nằm ngoài chain deploy tự động, phụ thuộc package UC17. Chỉ thêm bảy cột: `revision` default 0, `context` JSONB, `reviewed_by`, `decided_by`, `decided_at`, `finalized_by`, `finalized_at`.

Constraint `eligibility_provenance_valid` giữ legacy revision 0 nguyên nghĩa và yêu cầu provenance/reason cho row mới. Trigger `eligibility_transition_guard` kiểm owner/term/actor tồn tại, revision tăng một, cấm đổi owner, adopt legacy, xóa row UC18 và sửa row đã chốt. Quyền/hiệu lực chứng cứ/deadline được backend kiểm trong Serializable transaction. RLS/ACL đề xuất đóng truy cập trực tiếp PUBLIC/anon/authenticated; không cấp ADMIN quyền học vụ.

SHA-256 file SQL review tại bàn giao: `C83AE23DA15663B0924A113AF10A66F397D24F4F7E065C9BF5856082FDFE4E20`.

Không áp SQL, không chạy migrate/db push/seed/reset, không sửa 17 migration B1–B8, không sửa `_prisma_migrations`. Prisma validate/generate chỉ là kiểm schema/client local; không chứng minh SQL thực thi thành công. Backup/restore, live DDL/ACL/runtime role và rehearsal DB vẫn NOT VERIFIED.

## 5. API thực tế và frontend

API dùng global prefix hiện hữu (thường `/api`), response envelope/exception conventions B1–B8:

| Method / path | Nội dung |
| --- | --- |
| GET `/defense-eligibility/options` | Các đợt trong scope actor |
| GET `/defense-eligibility?termId=...` | Search mã/tên/đề tài, filter preview/official, page/limit; lọc scope trước paging |
| GET `/defense-eligibility/:termStudentId?termId=...` | Chứng cứ/preview/quyết định/lịch sử đã lọc quyền |
| POST `/defense-eligibility/:termStudentId/review` | termId, expectedRevision, evidenceHash, reason, academic attestation tùy chọn |
| POST `/defense-eligibility/:termStudentId/decide` | Cùng binding + ELIGIBLE/INELIGIBLE/DEFERRED và reason |
| POST `/defense-eligibility/finalize` | termId, reason, 1–100 members có termStudentId/revision/evidenceHash |

POST bắt buộc `Idempotency-Key`. Payload hash đổi trên cùng key trả 409; replay không ghi lại, vẫn kiểm principal/quyền/scope. Các command mới kiểm flag/schema/policy/window, lock term/proposal, reauthorize, kiểm revision/hash và CAS; row/audit/idempotency cùng transaction. GET dùng RepeatableRead và không gọi mutators. Capability cache chỉ trong session transaction, không cache migration readiness vĩnh viễn.

Frontend route/menu: **`/defense/eligibility`**, detail qua query `termId` + `termStudentId`. Dùng WorkspaceLayout/router guard, authenticated HTTP client, React Query keys có actor/term/filter/member. Có list/detail/chọn đợt/search/filter/paging, học vụ và lý do, lịch sử Khoa, form review/decision, chốt nhóm được chọn, loading/empty/401/403/404/409/saving/error/success và lý do disabled. Link PDF tái sử dụng trang UC17 với đúng permissions; không có public file URL hay DemoDb fallback.

Chốt hiện là **nhóm hồ sơ được lựa chọn trong grant**, không tuyên bố khóa toàn term hoặc tự thêm sinh viên ngoài nhóm. Việc tổng hợp các nhóm thành danh sách toàn Khoa cần được duyệt như mục policy.

## 6. Permissions

- `defense-eligibility:read`: FACULTY theo term/department grants; STUDENT active chỉ own membership; LECTURER active chỉ official current assignment. ADMIN có permission tên giống vẫn không có academic bypass.
- `defense-eligibility:review`, `:decide`, `:finalize`: FACULTY có quyền thuộc **chính role FACULTY**, cùng scope. Không cộng quyền của role khác để nâng quyền; guidance:read không cho ghi UC18.
- Điểm và nhận xét GVHD: kiểm `defense-confirmation:score-read` và `:comment-read` độc lập, theo role đang có scope. Học vụ chi tiết, lý do Khoa và history chỉ trả FACULTY có scope; history chỉ chiếu status/reason/revision/actor/time, không trả raw audit context/grade.
- Downstream contract chỉ trả cho FACULTY; student/advisor nhận trạng thái hồ sơ trong scope. Generic audit API B1–B8 đã chiếu metadata, không trả raw payloads.

Chỉ có SQL review mapping bốn quyền mới; chưa provisioning, seed hay cấp quyền cho account thật.

## 7. UC17 → UC18 và hiệu lực chứng cứ

Không suy Đồng ý từ điểm. UC18 yêu cầu decision CONFIRMED hiện hành, advisor/report version/context khớp topic + assignment revision + policy UC17; comment/score cùng PDF/context có audit đúng actor. UC17 legacy hoặc chưa có migration được phân loại chưa xác minh/chờ, không được chốt.

Evidence hash UC18 ràng buộc membership, proposal/topic context, assignment, dossier finalization/hash, report revision/version/checksum/readability, decision/score/provenance, progress rule evidence, học vụ và policy hash. Review lưu snapshot; decide/finalize đọc lại trong transaction, chống dùng expectedRevision/hash cũ. Faculty row cũng phải khớp audit snapshot/actor, tránh nhận row thiếu provenance là chính thức.

PDF/assignment/topic/dossier/summary/confirmation/policy/progress thay đổi làm hash stale. Học vụ hết khoảng hiệu lực làm finalized row stale ngay cả khi row DB không đổi. GET chỉ tính hiệu lực, không sửa/xóa quyết định cũ. Row chốt bất biến; khi stale phải có quy trình thu hồi/mở lại được duyệt, không tự “sửa cho xanh”.

## 8. Trạng thái

| Lớp | Giá trị / ý nghĩa |
| --- | --- |
| Chứng cứ từng điều kiện | QUALIFIED, NEGATIVE, PENDING, MISSING, STALE, UNVERIFIED; có lý do riêng |
| Preview tổng | Ưu tiên UNVERIFIED → STALE → NEGATIVE → MISSING → PENDING; tất cả đạt mới QUALIFIED. Preview không phải quyết định Khoa |
| Quyết định lưu DB | PENDING sau review; ELIGIBLE chỉ khi preview QUALIFIED; INELIGIBLE cần chứng cứ phủ định hiện hành; DEFERRED ghi nhận hoãn xét, không là bảo lưu chính thức |
| Hiệu lực quyết định | NONE, REVIEWED, DECIDED, FINALIZED, STALE, LEGACY_UNVERIFIED |
| Downstream | Chỉ FINALIZED + ELIGIBLE + QUALIFIED + current provenance; các trường hợp khác null |

## 9. Chạy được và còn blocked

Code handlers/UI/adapter và synthetic integration đã có; GET có nhánh tương thích schema chưa migration. Chưa chạy app thật hoặc gửi yêu cầu tới production trong lượt này, nên không tuyên bố các GET đã xác minh live bằng tài khoản thật.

Ghi chính thức vẫn **BLOCKED** bởi phê duyệt schema/permissions/policy/source học vụ, đúng phase, rehearsal ghi được nhóm cho phép và storage Render chưa kiểm chứng. Không có adapter nhập học vụ tự động giả lập. Ngoại lệ bảo lưu/quay lại/được phản biện trước/bổ sung điều kiện chưa có định nghĩa và nguồn liên kết được duyệt; không có bypass trong evaluator.

Danh sách hiện kiểm từng hồ sơ trong scope/search và đọc PDF checksum để lọc preview đúng trước paging. Chưa load test latency/quy mô trên Render–Supabase; cần đo trước vận hành đợt lớn, tối ưu batch/caching có kiểm chứng hiệu lực nếu cần. Không dùng cache stale làm bằng chứng chốt.

## 10. Kiểm thử và build

| Kiểm tra local | Kết quả |
| --- | --- |
| UC18 backend | 56 tests: 49 domain/service/contracts, 4 HTTP real JWT/RBAC/Zod, 3 Prisma adapter boundary |
| Backend toàn bộ suite mặc định | 45 files / 437 tests PASS |
| Frontend UC18 | 20 tests component/API/page SSR + 1 regression route permission mới PASS |
| Frontend toàn bộ | 38 files / 194 tests PASS |
| Shared TypeScript build | PASS |
| Prisma validate/generate local | PASS; không kết nối/ghi database |
| Backend Nest build + full compile `--incremental false` | PASS |
| UC17 compiled module loading / UC18 native compiled Nest DI | PASS, mock infrastructure, không start AppModule/server/DB |
| Backend/frontend typecheck + lint | PASS |
| Frontend Vite production build | PASS; còn cảnh báo chunk > 500 kB và Vite CJS deprecation |
| Git diff whitespace check | PASS; Git có cảnh báo chuẩn hóa LF/CRLF |

Tests bao phủ positive review→decision→finalize; thiếu/từ chối/stale/legacy UC17, thiếu audit/context, PDF mất/sai checksum/owner/state; dossier chưa chốt; học vụ thiếu/FAIL/hết hiệu lực; progress coverage, effective review/actor/revision; sai term/student/advisor/department/quyền đa role; replay/changed payload, concurrent CAS, rollback audit/idempotency/finalize; GET không ghi và preview không biến thành official. Frontend kiểm term/filter/detail cache scope, empty/loading/errors, disabled/saving, nội dung theo projection và API write success/failure.

HTTP test chỉ mở listener loopback ephemeral với in-memory adapters, đóng sau test; không dùng AppModule, PrismaClient hoặc accounts production. Component/page tests dùng SSR/React Query cache, không thay thế thao tác click trên browser thật. Có cảnh báo SSR useLayoutEffect nếu chạy không `--silent`.

**NOT VERIFIED:** PostgreSQL execution/constraints/trigger/RLS/isolation thực, DB integration suite cần môi trường được cấp, API/browser E2E Supabase–Render, tài khoản/grants thật, permission provisioning, restore, disk mount và PDF qua restart/redeploy. Mock rollback/concurrency PASS không chứng minh PostgreSQL đã được nghiệm thu.

## 11. Regression và an toàn workspace

Toàn bộ suite mặc định B1–B8/UC17 được chạy lại: auth/session/permissions, catalog/import, term/quota/phase, registration/assignment, topic/reviews/versions/dossier, guidance/tasks/submissions/weekly/progress, final-defense và legacy score guard. Không sửa migration base, legacy services defense demo hoặc grading công thức để làm UC18.

Không tạo branch/worktree/clone/project folder; không switch/reset/clean/stash/commit/push. Worktree list vẫn Project1 HEAD 0093f81 và metadata cũ Project1-B9-B10 prunable HEAD 5091f2c; không prune metadata. Không thay `.env`, uploads/dữ liệu local, Word/docx. Không có thao tác xóa/sửa file khóa Word; đường dẫn lock cũ không tồn tại tại lần kiểm tra cuối, không suy rằng đã được tạo hay xóa trong lượt này.

## 12. Các quyết định chờ nhóm/Khoa

Xem [09-10-policy-approval-list.md](09-10-policy-approval-list.md): UC17 rubric/bước điểm/công bố/thay PDF; UC18 phase, nguồn học vụ và thủ công, progress rule, ngoại lệ/liên kết hồ sơ cũ, trạng thái, phạm vi chốt, mở lại/thu hồi, phân tách người xét/duyệt/chốt, retention, deployment/test/backup/storage. Không có giá trị nào trong fixture được ghi thành policy thật.

## 13. Contract dành cho UC19 sau này

Shared type `EffectiveEligibility` chứa termId, termStudentId, proposalId, ELIGIBLE decision/revision, approvedBy/approvedAt, finalizedBy/finalizedAt, evidenceHash, policyVersion/hash, batchId, effectiveStatus CURRENT. GET detail/list của FACULTY có `downstream` chỉ khi toàn bộ điều kiện hiện hành còn hợp lệ.

UC19 phải kiểm lại hiệu lực/binding **trong transaction khi phân công/chốt**, không lưu một response GET làm giấy phép vĩnh viễn; không đọc riêng DEFENSE_ELIGIBILITY.status hoặc UC17 CONFIRMED để bỏ qua provenance. Batch là nhóm được chọn, không là version danh sách toàn term. Nếu stale sau khi có hội đồng phải xử lý theo chính sách thu hồi/mở lại được duyệt. Lượt này chưa tạo hội đồng, reviewer, lịch, chấm điểm hay export UC19–UC25.

Cửa sổ/locks UC18 chặn commands, không xóa ý nghĩa lịch sử của quyết định khi giai đoạn kết thúc. UC19 còn phải kiểm quyền, scope và cửa sổ/locks của chính thao tác UC19; `downstream` có hiệu lực không tự cấp quyền mở hội đồng ngoài kế hoạch.
