# UC23 — từng thành viên hội đồng chấm rubric độc lập

Ngày 08/11/2026. Workspace `E:\Project-Xaydungdoantotnghiep\DATN_Backup\Project1`, nhánh `feature/b9-b10-implementation`, HEAD giữ nguyên `0093f81a6017a8e046a03a8ce9786189cd5b37d8`. Chỉ UC23; giữ thay đổi chưa commit B1–B8/UC17–UC22. Không chuyển/tạo branch, worktree, clone, project folder, reset/clean/stash, commit/push. Không apply migration, seed/provision, ghi Supabase, bật flag, đổi Render hoặc sửa `.env`, uploads/Word/secrets.

## 1. Chức năng và căn cứ

Đã đối chiếu XML Project_1_06.docx, UC23/FR-37: từng Chủ tịch, Thư ký, Ủy viên nhập điểm/nhận xét riêng; lịch và danh sách hội đồng đã chốt; đợt DEFENDING, trong ngày/buổi bảo vệ. Đây là khác biệt với UC22: lịch UC23 bắt buộc, phase DEFENSE, không mặc định cho chấm trước/sau bảo vệ. Chấm theo SESSION hoặc SLOT là lựa chọn explicit trong policy. Công bố lịch và bằng chứng đã bảo vệ không được tự suy ra; requirePublished/defenseEvidence phải có policy.

Đã code options hội đồng/vai trò của mình, danh sách sinh viên và phiếu riêng, tìm/lọc/paging, lịch/thứ tự, tải PDF private, rubric/version/description/min/max/step/weight, tính tổng, nháp có điều kiện, chốt, lịch sử, stale evaluation và Khoa theo dõi số phiếu. Không làm biên bản, xác nhận kết quả hội đồng, công bố/tổng hợp điểm hoặc xuất/in/ký UC24–UC25.

## 2. Files Backend/Frontend/Shared

| Nhóm | Files mới/sửa trong lượt UC23 |
| --- | --- |
| Backend mới | `backend/src/defense/committee-grading/committee-grade.controller.ts`, `.service.ts`, `.repository.ts`, `.validator.ts`, `.context.ts`; ba suites `.spec.ts`, `.http.spec.ts`, `.repository.spec.ts` |
| Dùng chung | `backend/src/defense/grading/grade-evidence.ts`, `write-grade.ts`; UC22 service/repository/validator chỉ chuyển primitive tương ứng sang helper chung, giữ endpoints/workflow/permissions/contract |
| Fixture/DI | `backend/test/committee-grade.fixture.ts`, `backend/scripts/check-committee-grading-build.cjs`; fixture UC22 thêm lựa chọn TEST_ONLY cho phép dual role, mặc định cũ không đổi |
| Shared | `shared/src/contracts/defense-committee-grading.ts`, `rubric-arithmetic.ts`; export qua `shared/src/index.ts` |
| Frontend | `frontend/src/features/defense/committee-grading/api.ts`, `components.tsx`, `page.tsx`, test fixture và ba suites cùng thư mục |
| Tích hợp | DefenseModule; config/environment.ts + test flag default; legacy grading score service/test; routes/route-manifest/route guard test |
| Review/handoff | `backend/prisma/review/defense-committee-grading/{migration.sql,README.md}`; báo cáo này; append UC23 trong policy approval list |

Không viết lại UC17–UC22 hoặc tạo backend/frontend/database/service triển khai riêng. UC22 giữ hành vi cũ qua full regression; chỉ phép tính phân số, evidence reader và primitive ghi phiếu được tái sử dụng.

## 3. Database tái sử dụng

Audit từ Prisma/DDL `0_init`, chain B1–B8 và các gói review UC17–UC22: SCORE_ENTRY có compound unique proposal/scorer/role, revision, is_locked, report_version_id, comment/context; SCORE_DETAIL unique score/criterion và FK rubric; RUBRIC_CRITERIA theo term, Decimal precision và CHECK range. UC19 cung cấp DEFENSE_COMMITTEE/COMMITTEE_MEMBER/DEFENSE_COMMITTEE_ASSIGNMENT; UC21 cung cấp DEFENSE_SESSION context slots. UC17 giữ FINAL_REPORT/VERSION/FILE_ASSET; UC18 quyết định eligibility qua reader UC19. TERM_PARAMETER/TERM_PHASE/AUDIT_LOG/IDEMPOTENCY_RECORD dùng chung. Không coi schema repository hoặc SQL review là đã apply trên Supabase live; không đọc data/secrets production để chạy tests.

## 4. Migration tối thiểu

Không cần thêm bảng/cột Prisma cho UC23. Mở rộng constraint `final_advisor_score_valid` giữ nguyên ADVISOR/REVIEWER, thêm COMMITTEE_MEMBER/UC23; thêm committee score/detail/deferred commit guards và permission mapping đề xuất. Không thay 17 migration nền hoặc SQL review cũ. [README SQL](../../backend/prisma/review/defense-committee-grading/README.md) mô tả dependencies thực UC17/18/19, UC22 (UC20 chuyển tiếp), UC21 do kiểm binding session; không FK giả. Chưa apply. SHA-256 SQL `619DAC1FE50464A9984C16B54668037FC5AE8C7281185EA1987A4F2FBD5545EA`.

## 5. APIs và frontend route

Tất cả API dưới đây ở sau API_PREFIX hiện có; HTTP harness đã kiểm với `/api`.

| API | Mục đích |
| --- | --- |
| GET /defense-committee-grades/options | Terms và hội đồng CURRENT trong quan hệ/grants, vai trò chính thức của mình |
| GET /defense-committee-grades?termId=... | scope trước search/state/paging; optional committeeId/lecturerId cho Khoa |
| GET /defense-committee-grades/progress?termId=... | Khoa theo dõi số phiếu theo committee/student |
| GET /defense-committee-grades/:termStudentId?termId=...&committeeId=... | Phiếu của mình; Khoa có thể chỉ định lecturerId trong grant |
| GET /defense-committee-grades/:termStudentId/versions/:versionId/pdf?termId=...&committeeId=... | PDF private hiện hành của hồ sơ được phép |
| POST /defense-committee-grades/:termStudentId/save | Lưu nháp nếu policy cho phép |
| POST /defense-committee-grades/:termStudentId/finalize | Chốt phiếu đủ dữ liệu |

Frontend `/defense/committee-grading` dùng WorkspaceLayout/sidebar/router guard, authenticated httpClient, React Query và term selection của nhóm. Có committee/role selector, rows theo thứ tự lịch, trạng thái, rubric preview, comment, save/finalize/history, Khoa progress counts, loading/empty/error/retry/reload/disabled reasons và 401/403/404/409. Cache/late-response guard theo actor/term/committee/student/lecturer. Thành công chỉ sau POST trả về và invalidate list/detail/progress. API mode không DemoDb fallback. Bản STALE/FINALIZED hiển thị score và rubric snapshot đã lưu, không tính lại bằng rubric mới.

## 6. Permissions

Resource `defense-committee-grade`. `read` là ingress, không tự cấp quyền nội dung. LECTURER cần role-bound read + read-own và active profile; save-own/finalize-own/download-own độc lập cho đúng actor. FACULTY cần role-bound read + progress-read cùng grants term/department; score-read/comment-read/history-read riêng để xem nội dung. Không ghép quyền ADMIN/FACULTY vào role LECTURER để chấm thay; CHAIR không sửa phiếu SECRETARY/MEMBER. STUDENT/ADMIN không có mapping mặc định UC23, không release endpoint cho sinh viên. GET không tạo score, audit hoặc idempotency; response/PDF no-store, không raw audit/context/storage URL.

## 7. UC19 membership/assignment

Trong caller CommitteeGradeSession, gọi CommitteeWorkflowService.workspaceInSession và **effectiveInSession**, không mở nested transaction. Internal source reader dùng persisted UC19 finalizer, revalidate live permissions/grants; không nhận actor Khoa từ browser và không cấp quyền Khoa cho member. Cần committee finalized/CURRENT, đúng term/proposal/TermStudent, active student assignment/revision, actual lecturer và CHAIR/SECRETARY/MEMBER, UC18 current, provenance/policy/roster và all-member advisor conflict. Raw COMMITTEE_MEMBER row không đủ.

Body committeeId dùng định danh hồ sơ, không dùng làm bằng chứng quyền; scorer/member role lấy từ authenticated principal và effective membership. So committee revision/evidenceHash, assignmentRevision và membershipHash khi ghi. Hội đồng/roster/role/student/source đổi → conflict hoặc STALE, giữ score/history. Nếu mất membership hiện tại, không tiếp tục chấm hoặc dùng quyền từ hội đồng cũ. Source reader bị thu hồi quyền fail closed; identity/bàn giao cán bộ dài hạn còn cần phê duyệt.

## 8. UC21 và bằng chứng bảo vệ

Lịch UC23 bắt buộc theo đặc tả. Helper chung tìm duy nhất phiên của đúng term/committee/member/proposal, gọi **ScheduleService.effectiveInSession** trong cùng session bằng actor đã lưu của lịch. Không dùng personal schedule/frontend để cấp quyền. Need finalized/CURRENT, slot membership hợp lệ; publication chỉ khi requirePublished explicit. Cửa sổ ghi SESSION hoặc SLOT theo policy và `operationWindow(term,'DEFENSE')`, trạng thái DEFENDING/phase/term locks. Không tự mở trước/sau buổi hoặc fake attendance.

Contract DefensePerformanceEvidenceSchema chuẩn bị cho producer được phê duyệt sau này. `defenseEvidence=REQUIRED` hiện chặn finalize bằng DEFENSE_PERFORMANCE_PRODUCER_REQUIRED; nháp có thể lưu khi các điều kiện khác đạt và policy cho phép. Không tạo record xác nhận sinh viên đã bảo vệ từ lịch, nút download, thời gian hiện tại hoặc score. Hết cửa sổ ghi không tự làm phiếu finalized hợp lệ mất hiệu lực cho UC24. Publication đơn thuần không thay nguồn học vụ nếu policy không yêu cầu publication.

## 9. PDF UC17

Dùng reader/storage primitive chung với UC22, không viết hệ thống file khác. Kiểm FinalReport/Version đúng proposal/student/owner, current sequence, asset private REPORT/application/pdf/READY, key, timestamp, size và SHA-256 bytes. Capability/guards UC17 bảo vệ version append-only và không tái dùng weekly assets; không dùng weekly submission làm report. Download lặp quyền và version hiện hành, no-store/nosniff, không public URL. Score/context/audit bind version/checksum; thay PDF → grade STALE, không chuyển điểm hoặc mở khóa.

## 10. Rubric/scoring engine

UC23_POLICY có approval/version/reference, effectiveFrom/Until, effectiveScope=GRADING_WINDOW, role list, draft/comment/window/evidence rules và rubric riêng. Rubric có version, calculation WEIGHTED_NORMALIZED_10, criterion ID/name/description/min/max/step/weight/required, missingOptional ZERO hoặc BLOCK và totalStep/rounding explicit. Phải khớp rows RUBRIC_CRITERIA thật cùng term; không lấy rubric UC22/GVHD mặc định, không tạo criterion production.

Engine dùng chung BigInt rational arithmetic với UC22. Tổng từng score/max × weight ×10, weight sum 1; không float. Step tiêu chí tính từ minScore cấu hình. Final đủ tiêu chí bắt buộc, cấm unknown/duplicate IDs; optional bỏ trống chỉ ZERO khi được policy duyệt, min phải cho phép 0, normalized values/snapshot giữ rõ. Rounding EXACT/HALF_UP/HALF_EVEN/DOWN chỉ khi policy chọn; số chữ số và bước tổng explicit. Giữ Decimal(4,1)/CHECK detail 0–10, không mất precision hoặc ngầm mở rộng schema. EXACT không biểu diễn được → blocker, không rounding fallback. Không ngưỡng đạt hoặc công thức UC24.

effectiveScope=GRADING_WINDOW là lựa chọn policy cần duyệt: giới hạn lúc ghi/chốt; grade finalized phải được chốt trong khoảng này và không tự hết hiệu lực chỉ vì khoảng ghi kết thúc. Policy/rubric **thay đổi nội dung/version** vẫn làm binding cũ stale. Scope/công thức/rounding khác chưa hỗ trợ phải review, không tự đoán.

## 11. Phiếu độc lập từng thành viên

Storage canonical role COMMITTEE_MEMBER cho CHAIR/SECRETARY/MEMBER; role thực nằm trong snapshot UC19. Unique proposal + scorer + type giữ một sheet và ngăn thay role để tạo sheet thứ hai. Không overwrite, copy hoặc lấy trung bình phiếu của người khác. Legacy COMMITTEE_CHAIR/MEMBER không provenance không adopt/delete. Member có thể đồng thời GVPB chỉ khi UC20_POLICY ALLOW và EffectiveReviewerAssignment CURRENT; khi có duty đó, source được revalidate cùng transaction. Hai nhiệm vụ có record riêng REVIEWER/COMMITTEE_MEMBER, không đổi ADVISOR, không weekly/FINAL_RESULT.

## 12. Draft/finalize

draftAllowed explicit; draft thiếu tiêu chí có total=null, không downstream. Final có thể trực tiếp nếu đủ điều kiện hoặc từ nháp; server tự tính tổng, browser không gửi tổng/scorer/role để quyết định. Chốt lưu actor/time, full approved rubric/policy snapshot, evaluation, committee/membership/assignment, lịch, PDF và hashes; khóa sửa thường. STALE/legacy không tự rebind, finalized immutable, không ADMIN bypass. Xử lý vắng/thay thế/sửa sau chốt/phúc khảo/đánh giá lại phải có quy trình được duyệt.

## 13. Revision/audit/idempotency

GET RepeatableRead. POST Serializable cùng source term/committee/proposal/phase locks, reauthorize/revalidate trong transaction và CAS score revision. First create không upsert/adopt; existing duplicate/serialization conflict trả 409. Shared writer chỉ chọn role và owner do service xác minh, thay draft details trước khóa parent. Score/details/audit snapshot/hash/idempotency cùng commit; audit/key lỗi rollback toàn bộ. Same actor/method/route/key/body replay không chấm hai lần; đổi body→409. Replay vẫn qua quyền/source/policy/phase/flag gates, không trả thành công sau source stale. Không xóa data cũ hoặc silently sửa score vì source đổi.

## 14. Bảo vệ API legacy

Legacy `/scores/proposal/:proposalId` chưa có scope thích hợp nên query loại ADVISOR, REVIEWER, COMMITTEE_MEMBER và COMMITTEE_CHAIR; projection baseline còn lại giữ nguyên. Phiếu mới đọc qua UC23 scoped endpoint. Unit/HTTP regression kiểm cả canonical và legacy chair role không lộ cho sinh viên. Không thay toàn bộ grading module hoặc biến API legacy thành đường tổng hợp UC24. ACL/RLS/Supabase REST trực tiếp trên bảng cũ vẫn phải kiểm chứng trước activation.

## 15. Tests PASS/FAIL

| Check | Kết quả |
| --- | --- |
| Full backend Vitest | **60 files / 730 tests PASS** |
| UC23 backend | **78 workflow/policy tests + 4 HTTP + 5 adapter/static SQL review tests = 87 PASS** |
| Full frontend Vitest | **53 files / 327 tests PASS** |
| UC23 frontend | **30 API/SSR component/page tests + route guard regression PASS** |
| Shared TypeScript build | PASS |
| Prisma validate/generate | PASS; sinh client local, không apply/query database |
| Backend typecheck / Nest build / full nonincremental emit / ESLint | PASS |
| Frontend typecheck / Vite build / ESLint | PASS |
| Native compiled Nest DI UC23 | PASS, mocked infrastructure, không AppModule/env/server/DB |
| Native compiled DI regression UC17–UC22 | PASS, không khởi chạy ứng dụng hoặc kết nối DB |
| Git diff --check và files UC23 untracked | PASS; kiểm whitespace, conflict markers và hash SQL trong handoff |

Bao phủ cả ba roles, outsider/admin/cross-owner/role union, source draft/legacy/stale/UC18/advisor/role/membership/assignment, SC finalized/current/publish/window, PDF/checksum/version, policy/period/precision/weights/required/duplicate/min/max/step/rounding, independent/dual duty, privacy/progress/grants, replay/body conflict/concurrent CAS, rollback và GET read-only. Không có test FAIL tại bàn giao. Cảnh báo Vite CJS/chunk >500KB và SSR useLayoutEffect không được coi là lỗi test; không tuyên bố đã xử lý các cảnh báo bundle cũ.

## 16. Regression B1–B8/UC17–UC22

Full suites gồm tests base và UC17–UC22 đều PASS, UC22 có 61 tests vẫn qua sau khi chuyển primitive sang helper chung. SQL UC22 giữ nguyên hash `61ABE9F9D6F07312C2FF3DE5FBC1220EB9C2CCA65664A4EDF9D2999C5A892707`; các review packages trước không bị sửa. Không sửa schema/migrations baseline trong lượt UC23. Các thay đổi UC17–UC22 đã có trước vẫn giữ nguyên; refactor chỉ nhằm tái sử dụng primitive cần cho UC23.

## 17. NOT VERIFIED

Không có database/private storage test được nhóm phê duyệt. Chưa apply SQL, kiểm FK/CHECK/unique/guards/deferred trigger/isolation/rollback/SQL writers/concurrency thật, live metadata/ACL/RLS/REST hoặc migration rehearsal với legacy đại diện. Static SQL/Prisma adapter tests không chứng minh constraint PostgreSQL thực thi. HTTP tests là Nest + JWT/session/RBAC/Zod thật trên loopback nhưng repository/storage synthetic. Frontend SSR không kiểm chứng browser click/download/cache thật. Render disk/mount/backup/restore/restart/redeploy, storage production, load/performance toàn kỳ và browser/Render/PostgreSQL E2E đều NOT VERIFIED.

## 18. Policy cần duyệt

Đã append riêng UC23 trong [policy approval list](09-10-policy-approval-list.md): roles bắt buộc, rubric/weights/range/step/formula/rounding, comment/draft, thời gian/lịch/publication/evidence, own/Faculty content rights, re-open/phúc khảo/vắng/thay thế/source stale, required sheet completeness, release/retention/notifications và service-reader identity. Toàn bộ chưa có quyết định thật là PENDING_APPROVAL; fixtures TEST_ONLY không là phê duyệt của Khoa. Không dừng để hỏi từng policy hoặc ghi config vào Supabase.

## 19. Contract UC24

EffectiveCommitteeGrade và CommitteeGradeService.effectiveInSession chỉ trả finalized/CURRENT sau revalidation trong session consumer: term/student/proposal, committee id/revision/evidence, assignment revision, membership hash/lecturer/role, score id/revision, rubric version/hash/criterion values/exact stored total, report version/checksum, schedule id/hash, policy version/hash, finalizer/time, evidenceHash, locked=true và releaseStatus=WITHHELD. Draft/stale/legacy conflict, không thành điểm 0. Faculty consumer cần score-read + grants; member chỉ phiếu riêng.

UC24 phải đọc lại EffectiveCommittee để biết đủ những member bắt buộc theo UC23_POLICY và revalidate mọi grade trong transaction khi tính/chốt. UC23 chỉ đếm tiến độ số phiếu, không tính trung bình/chọn phiếu/thay trọng số thành viên, không gộp UC22 hoặc ghi FINAL_RESULT. Source rộng của UC19/UC21 có thể conservatively stale nhiều phiếu khi một phần hội đồng thay đổi; không bỏ kiểm chứng để giữ trạng thái xanh.

## 20. Blockers activation còn lại

Code UC23 đã tích hợp và kiểm thử cô lập; **chưa nghiệm thu end-to-end trên hệ thống chung**. Cần policy/rubric/permissions/grants thật được duyệt, gói SQL/dependencies được review và rehearsal ở môi trường cho phép, bảo vệ ACL/RLS/REST điểm/audit/key, storage Render bền vững và browser/database E2E. Nếu policy đòi bằng chứng đã bảo vệ, còn thiếu producer chính thức: finalize bị chặn. Workflow sửa sau chốt/reassignment/phúc khảo/công bố chưa duyệt tiếp tục fail closed. UC23_WRITES_ENABLED mặc định false, không mở production writes. Dừng phạm vi sau UC23; không UC24–UC25.
