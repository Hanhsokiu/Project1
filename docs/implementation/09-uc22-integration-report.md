# UC22 — nhận xét và chấm điểm phản biện

Ngày 08/11/2026. Project1, nhánh `feature/b9-b10-implementation`, HEAD `0093f81a6017a8e046a03a8ce9786189cd5b37d8`. Giữ các thay đổi chưa commit UC17–UC21. Không đổi/tạo nhánh, worktree, clone hoặc thư mục dự án; không commit/push. Không ghi Supabase, apply migration, seed, tạo tài khoản, bật flag hoặc đổi Render. `.env`, uploads và Word được giữ nguyên.

## 1. Chức năng và căn cứ đặc tả

Đối chiếu Project_1_06.docx, UC22/FR-36: GVPB được phân công, có PDF cuối và trong mốc phản biện mới được nhập/lưu/gửi nhận xét và điểm; Khoa theo dõi. Tài liệu chưa chốt bước điểm, rubric, cách làm tròn hoặc ngưỡng đạt. Code UC22 cung cấp danh sách theo đợt/tìm kiếm/trạng thái/phân trang, đề cương đã chốt được phép xem, PDF private, nhận xét/ưu điểm/nhược điểm/câu hỏi, điểm tổng hoặc rubric, nháp có điều kiện, chốt, lịch sử, hiệu lực và theo dõi có redaction. Không triển khai UC23–UC25, tổng hợp điểm, xuất/in/ký hoặc thông báo tự động.

## 2. Files mới và tích hợp

- Shared: `shared/src/contracts/defense-reviewer-grading.ts`, export `shared/src/index.ts`.
- Backend: `backend/src/defense/reviewer-grading/reviewer-grade.{controller,service,repository,validator,context}.ts`; ba suites `reviewer-grade.spec.ts`, `reviewer-grade.http.spec.ts`, `reviewer-grade.repository.spec.ts`.
- Fixture: `backend/test/reviewer-grade.fixture.ts` dựng chuỗi producer UC17–UC21 bằng service thật với adapter/storage synthetic; không PrismaClient/env/network production.
- Native DI: `backend/scripts/check-reviewer-grading-build.cjs`.
- Frontend: `frontend/src/features/defense/reviewer-grading/{api.ts,components.tsx,page.tsx}` và fixture/ba test suites cùng thư mục.
- Tích hợp: DefenseModule, config/environment.ts (flag mặc định false), grading score service/test (lọc role), routes/route-manifest/route-manifest.test. Không viết lại UC17–UC21.
- SQL review và README trong `backend/prisma/review/defense-reviewer-grading/`; báo cáo và danh sách chờ phê duyệt này.

## 3. Database tái sử dụng

SCORE_ENTRY role REVIEWER theo `(proposalId,scorerId,role)`, revision/reportVersionId/comment/context/isLocked có từ schema UC17. SCORE_DETAIL lưu tiêu chí bằng rubricCriteriaId thật; RUBRIC_CRITERIA khớp term/id/name/weight/maxScore của rubric UC22 được duyệt. Không dùng rubric GVHD mặc định. Mỗi GVPB có phiếu riêng. Không ghi ADVISOR, weekly, COMMITTEE_* hoặc FINAL_RESULT. Đối chiếu baseline `0_init`, chain B1–B8, các gói review trước và Prisma schema; **không coi schema repository là metadata live đã triển khai**.

FINAL_REPORT/FINAL_REPORT_VERSION/FILE_ASSET giữ PDF cuối; REVIEWER_ASSIGNMENT nguồn UC20; TERM_PARAMETER key UC22_POLICY; TERM_PHASE/THESIS_TERM kiểm mốc; AUDIT_LOG/IDEMPOTENCY_RECORD dùng chung. DEFENSE_CONFIRMATION/UC18/UC19 được reader upstream revalidate. DEFENSE_SESSION chỉ được đọc như dependency nghiệp vụ nếu policy yêu cầu.

## 4. Migration

Không cần thêm bảng/cột Prisma. SQL review sửa constraint UC17 ADVISOR-only để cho REVIEWER gắn PDF, giữ nguyên nhánh ADVISOR; thêm CHECK và guards reviewer/chi tiết/commit deferred, khai báo permissions/mapping đề xuất. Giữ unique và Decimal(4,1), không sửa migrations/base hoặc gói review cũ, không backfill/adopt/xóa legacy. [Gói review](../../backend/prisma/review/defense-reviewer-grading/README.md) giải thích dependencies thực, rehearsal và rollback.

## 5. API và route

Các API dưới đây nằm sau API_PREFIX hiện hữu, không tự hard-code `/api` trong ứng dụng:

| API | Mục đích / permission trên resource defense-reviewer-grade |
| --- | --- |
| GET /defense-reviewer-grades/options | Đợt trong quan hệ/grants; read |
| GET /defense-reviewer-grades?termId=... | Danh sách scope trước paging; read |
| GET /defense-reviewer-grades/:termStudentId?termId=... | Phiếu của mình; Khoa có thể chỉ định reviewerId trong grant; read |
| GET /defense-reviewer-grades/:termStudentId/versions/:versionId/pdf?termId=... | PDF hiện hành qua API private; download |
| POST /defense-reviewer-grades/:termStudentId/save | Nháp khi policy cho phép; save |
| POST /defense-reviewer-grades/:termStudentId/finalize | Chốt nội dung đầy đủ; finalize |

Frontend `/defense/reviewer-grading` dùng WorkspaceLayout/sidebar, guard, authenticated httpClient, React Query và terms của hệ thống. GET không tạo score/audit/key. Response/PDF private `no-store`; không public storage URL. Có loading/empty/401/403/404/409, missing policy/PDF/stale, disabled reasons, retry/reload; chỉ thông báo thành công sau backend POST trả kết quả, sau đó invalidate list/detail. Form reset theo actor/term/member/reviewer/revision/source; cache và late-response guard ngăn dữ liệu tài khoản trước xuất hiện sau chuyển tài khoản. Không DemoDb fallback.

## 6. Permissions và privacy

Service xác minh tài khoản ACTIVE, profile lecturer active, permission thuộc đúng vai trò LECTURER và đúng reviewer của UC20. Flat permission/ADMIN/FACULTY không cấp quyền chấm thay. Sinh viên bị từ chối cả khi vô tình có flat read; không có release endpoint. Faculty chỉ trong term/department grants, mặc định tiến độ; score-read/comment-read/history-read độc lập, không trả raw audit/context. GVPB không yêu cầu được phiếu người khác qua reviewerId. History là projection revision/action/time/actor; nội dung cũ vẫn được lưu trong audit có bảo vệ.

## 7. EffectiveReviewerAssignment UC20

Trong chính ReviewerGradeSession của GET/command, dùng persisted finalizer của nhóm UC20 như internal source reader, kiểm lại live account/role/permissions/grants. Không nhận actor source từ client. Gọi ReviewerService.workspaceInSession rồi **ReviewerService.effectiveInSession** cùng session, so đúng assignmentId/lecturerId/member/term/proposal. Reader kiểm finalized/current, UC18, UC19, advisor/history/all-member conflicts, policy/roster/provenance. Row reviewer_id/legacy role REVIEWER đơn thuần không cấp quyền.

POST so expected assignment revision/evidenceHash và đọc lại sau lock. Nguồn đổi trả 409. Reader Khoa bị thu hồi quyền thì fail closed; service-reader identity lâu dài và bàn giao cán bộ vẫn PENDING_APPROVAL, không âm thầm nâng quyền giảng viên.

## 8. PDF UC17

Đọc phiên bản cuối theo sequence của đúng report/proposal; so owner sinh viên, report/version/asset IDs, submittedAt, private storage key, REPORT/application/pdf/READY, size và SHA-256 bytes từ FileStorageService. Asset không đọc được/sai checksum không được chấm. Bảo vệ loại trừ weekly và bất biến phiên bản kế thừa guards UC17, capability phải sẵn sàng. API download lặp lại scope và chỉ trả version hiện hành. Form yêu cầu tải PDF trước lưu/chốt; server ràng buộc versionId/checksum chính xác, không coi thao tác download là bằng chứng con người đã đọc. Thay PDF làm grade STALE, giữ score/audit cũ; không chuyển điểm sang bản mới.

## 9. Quan hệ UC21

`schedule.required=false`: không đọc schema/đòi lịch UC21. Nếu required, chọn duy nhất session chứa đúng member/proposal/committee/term và gọi ScheduleService.effectiveInSession trong cùng transaction bằng actor đã lưu của lịch. Cần finalized/current; requirePublished và cửa sổ phút trước/sau slot chỉ áp dụng khi policy explicit. Lịch stale/legacy/thiếu/không duy nhất bị chặn. Binding giữ nguồn học vụ của lịch; công bố lịch không tự làm stale điểm khi UC22 không yêu cầu publication. Không viết lại hoặc ghi dữ liệu UC21.

## 10. Rubric và độ chính xác

Thang tổng 0–10 theo yêu cầu. Score truyền dưới dạng decimal string, không đi qua float. Policy version/approvedBy/approvedAt/reference bắt buộc. Bước điểm, rubric/version/criteria/weight/step và trường feedback bắt buộc đều explicit. Tổng weight bằng 1; dữ liệu rubric khớp rows thật cùng đợt; chốt đủ toàn bộ tiêu chí, cấm tiêu chí lạ. Công thức duy nhất hiện hỗ trợ là WEIGHTED_NORMALIZED_10_EXACT, phải được duyệt; không tự coi là công thức chính thức khi thiếu policy.

Tổng quy đổi dùng phân số BigInt chính xác; so bằng tích chéo, không rounding kể cả số tuần hoàn. Tổng trực tiếp được dùng nếu rubric=null được duyệt. Policy bước điểm/tiêu chí vượt Decimal(4,1) hoặc CHECK range baseline bị chặn với lý do; không ALTER precision hoặc tạo ngưỡng đạt. Policy muốn precision/công thức khác cần review bổ sung. Không tự tạo rubric rows.

## 11. Draft/finalize

draftAllowed explicit: nháp có thể thiếu tổng/feedback, tiêu chí đã nhập vẫn phải hợp lệ. Finalize có thể gửi trực tiếp hoặc từ nháp; bắt buộc điểm/tiêu chí và các trường policy yêu cầu. Khóa phiếu, lưu actor/time và snapshot nguồn. DRAFT không có downstream. FINALIZED thường không sửa; legacy và stale không tự rebind/adopt. Sửa sau chốt/đánh giá lại/phúc khảo/thay reviewer hoặc PDF phải có quy trình được duyệt, hiện BLOCK/IMMUTABLE.

## 12. Revision, audit, idempotency, transaction

Write Serializable cùng repository Prisma hiện hữu, term/source locks của UC20 và CAS score revision. First write create thay vì upsert để không adopt legacy; unique conflict/serialization →409. Draft details thay atomically trong parent chưa khóa, rồi khóa parent nếu finalize. Audit snapshot trước/sau + hash và remember cùng transaction; lỗi audit/key rollback cả score/details. Idempotency actor/method/route/key/body hash, replay không chấm hai lần, body khác→409. Replay vẫn kiểm current identity/source/policy/phase/flag; không trả thành công sau mất quyền hoặc nguồn stale. Không tự retry một body mới bằng key cũ.

## 13. Đường đọc legacy

`ScoreService.getScoresByProposal` loại cả ADVISOR và REVIEWER, giữ projection baseline các role khác. UC22 HTTP regression gọi URL legacy bằng tài khoản sinh viên sau chốt và xác minh không có nội dung reviewer. Unit regression kiểm filter/projection; các suites B1–B8/UC17 vẫn chạy. Tìm các reader scoreEntry trong source: UC17 chỉ ADVISOR, UC22 chỉ REVIEWER, đường legacy là nơi cần mở rộng filter. Không dùng đường legacy làm reader điểm phản biện.

## 14. Kiểm thử

UC22 có 54 workflow/policy/privacy tests, 4 Nest HTTP JWT/session/RBAC/Zod/private-PDF tests, 3 Prisma adapter boundary tests; frontend 25 API/SSR component/page tests và 1 route guard regression. Bao phủ assignment draft/stale/legacy/upstream, current official identity, nhiều reviewer, PDF/checksum/thay phiên bản, schema/policy/step/precision/rubric phân số, draft/finalization/immutability, lịch optional/required/publication/window, phase/deadline/locks, scope/paging/redaction, replay/concurrent/CAS và rollback. Hết cửa sổ chấm chỉ chặn ghi, không làm phiếu finalized hợp lệ mất hiệu lực. HTTP dùng loopback cô lập, prefix thật trong harness; DB/storage adapter synthetic. Không báo là PostgreSQL E2E.

Kết quả kiểm tra tại bàn giao:

| Kiểm tra | Kết quả |
| --- | --- |
| Full backend Vitest | **57 files / 643 tests PASS**, gồm 61 tests UC22 mới |
| Full frontend Vitest | **50 files / 296 tests PASS**, gồm 25 tests UC22 và route guard mới |
| Shared TypeScript build | PASS |
| Prisma validate/generate | PASS; chỉ validate/sinh client local, không migrate/db push |
| Backend typecheck / Nest build / full nonincremental emit | PASS |
| Frontend typecheck / Vite production build | PASS |
| Backend/frontend ESLint | PASS |
| Native compiled Nest DI UC22, mocked infrastructure | PASS; không AppModule/env/server/database |
| Git diff check | PASS; kiểm thêm whitespace/conflict markers cho files UC22 untracked |

Không có tests thất bại ở trạng thái bàn giao. Các checks thất bại trong quá trình phát triển đã được sửa và chạy lại; con số trên là kết quả cuối, không gồm kiểm thử PostgreSQL được bỏ qua theo cấu hình test mặc định.

## 15. Hồi quy

Chạy toàn bộ backend/frontend suites, shared build, Prisma validate/generate, backend/frontend typecheck/build/lint, native compiled DI và diff check. Giữ các chức năng B1–B8/UC17–UC21, không thay meaning hoặc xóa data source upstream. Cảnh báo Vite CJS/chunk size và SSR useLayoutEffect hiện có không tương đương test failure.

## 16. NOT VERIFIED

Chưa có database/private storage test riêng được nhóm phê duyệt. Chưa apply SQL, chưa kiểm Prisma/PostgreSQL transaction thật, triggers/deferred guards/FK/unique/ACL/RLS/REST, migration rehearsal/rollback với legacy, concurrent SQL writers, load/performance toàn kỳ, Render disk/mount/backup/restore/redeploy, storage production hoặc browser click-through E2E. Prisma validate/generate không kết nối để chứng minh schema/luồng ghi đã hoạt động. Test frontend SSR không kiểm chứng thao tác trình duyệt tải file/nhấn nút thật.

## 17. Policy chờ phê duyệt

Toàn bộ quyết định còn thiếu được gom ở [09-10-policy-approval-list.md](09-10-policy-approval-list.md), phần UC22. Fixtures TEST_ONLY có trạng thái APPROVED chỉ để đi qua nhánh parser trong tests, không là phê duyệt production; không tạo TermParameter/rubric/account thật. UC22_WRITES_ENABLED mặc định false, không bật trong lượt này.

## 18. Contract UC24

`EffectiveReviewerGrade` và ReviewerGradeService.effectiveInSession chỉ trả phiếu finalized/CURRENT sau revalidation trong session consumer: term/member/proposal/reviewer, full EffectiveReviewerAssignment (id/revision/hash/provenance), score id/revision, report version/checksum, exact total/criterion scores, rubric version/hash, policy version/hash, finalized actor/time, evidenceHash, locked=true và releaseStatus=WITHHELD. Draft/stale/legacy trả conflict, không âm thầm chuyển thành điểm 0. Faculty consumer cần score-read + grants; GVPB chỉ phiếu của mình. UC24 phải gọi lại lúc tính/chốt, không dùng GET cũ như nguồn vĩnh viễn; chưa tổng hợp nhiều GVPB, áp công thức hoặc ghi FINAL_RESULT.

## 19. Blocker activation và bàn giao

Code tích hợp UC22 phục vụ review và tests cô lập; production/E2E chưa nghiệm thu. Chặn activation bởi: chính sách học vụ thật, provisioning RBAC/grants/rubric hợp lệ, review/triển khai dependency + SQL UC22 trên môi trường test được phép, kiểm ACL/RLS các bảng cũ không lộ điểm qua Supabase REST, storage Render bền vững/backup, browser E2E và PostgreSQL rehearsal/concurrency. Workflow điều chỉnh sau chốt, source change và công bố điểm vẫn fail closed. Không có ADMIN bypass hoặc giả lập thành công khi thiếu điều kiện.
