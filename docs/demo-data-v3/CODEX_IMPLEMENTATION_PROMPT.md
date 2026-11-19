# MASTER PROMPT FOR CODEX — UTC PROJECT1 REALISTIC DEMO DATA V3 (FULL STEP 1–10)

**Vai trò:** Principal Database Architect + Business Analyst + Senior NestJS/Prisma Developer + QA Automation Engineer.

Bạn đang làm trên repository Project1 hiện tại của nhóm. Mục tiêu **không phải viết một báo cáo kế hoạch rồi dừng**, mà xây dựng bộ seed và kiểm chứng thật để có thể sử dụng database PostgreSQL TEST **riêng** làm nguồn dữ liệu demo ổn định, xuyên suốt 10 bước nghiệp vụ và 25 use case. Không dùng database Supabase chung/production.

Đọc bắt buộc trước khi làm:
- `AGENTS.md`, `README.md`, `package.json`, `backend/package.json`.
- `backend/prisma/schema.prisma`, Prisma migrations và tất cả model workflow liên quan.
- `docs/spec/dac-ta-use-case.md`, `docs/frontend/source-extracts/Project_1_06.md`, quyết định ADR mô hình 1 SV/1 đề tài, cấu hình RBAC, controllers/services/DTO hiện có.
- Hai file bàn giao cùng prompt: `DATASET_BLUEPRINT.md` và `demo-manifest.json`.
- Ba file Excel/PDF UTC do tôi cung cấp (nếu bạn được cấp quyền đọc). Đó chỉ là cơ sở tham chiếu về cấu trúc, lịch hội đồng, điểm thành phần; không được copy tên/MSSV/ngày sinh/điểm thật vào demo hoặc public Git.

## A. Mục tiêu dữ liệu **bắt buộc**

Tạo hai đợt:
- `DEMO-2026-03`: 76 lượt SV, trạng thái lịch sử hoàn tất nếu tất cả workflow cho phép; 3 hội đồng, mỗi hội đồng 4 giảng viên; 65 lượt đã từng được xếp lịch, trong đó 60 hoàn tất chấm, 11 hoãn/bảo lưu trước lịch và 5 có lịch sử xếp lịch rồi hoãn/điều chỉnh. Tuyệt đối không để số lượt lịch hiệu lực mâu thuẫn với trạng thái hoãn; nếu schema thiếu lưu lịch sử, giữ 60 lịch hiệu lực và đưa 5 lịch hoãn vào scenario test/ghi blocker.
- `DEMO-2026-10`: 11 lượt SV, trạng thái IN_PROGRESS ở mốc `2026-11-16T09:00:00+07:00`, chưa lập hội đồng/chấm/công bố; dữ liệu tiến độ tuần có đủ PASS, REVISION_REQUIRED, OVERDUE, PENDING_REVIEW.

84 Student **duy nhất**, trong đó 3 người xuất hiện tại cả hai đợt: 87 `TermStudent`, không nhân đôi student profile hay user. 18 Lecturer, 2 giáo vụ/FACULTY, 1 admin, tổng 105 `UserAccount`. Sử dụng giảng viên hiện có để gán cùng lúc các vai trò GVHD/GVPB/nhóm duyệt/HĐ hợp lệ (trong phạm vi đợt và không có conflict).

7 hướng là mục tiêu tham khảo: nếu chính sách danh mục thực tế chỉ có 5 hướng thì giữ 5; không tạo thêm hướng ngoài workflow/đặc tả đã được duyệt. 87 đề tài cá nhân theo lượt tham gia, một hồ sơ/người/đợt. Cấu hình quota sao cho 76 phân công của đợt cũ không vượt quota thực tế; cần kiểm tra `Lecturer.maxStudents` và `TermLecturer.quota` (mặc định có thể là 5).

## B. Quy trình triển khai — phải thực hiện đầy đủ, không chỉ lập kế hoạch

### Phase 0 — Safety gate & snapshot
1. Phát hiện branch, git status, code paths, scripts đang tồn tại; không bỏ/hủy thay đổi của người khác.
2. Kiểm tra target DB bằng cách đọc host/database name an toàn, không in credential. Nếu host thuộc Supabase/shared/staging/production hoặc không nằm trong allowlist test, **STOP** ngay.
3. Mặc định `--dry-run` đọc/validate kế hoạch, tuyệt đối không tự write. Chỉ khi có đích local test riêng và opt-in rõ ràng mới cho phép `--seed`.
4. Không reset, drop, truncate, db push, migrate trên DB thật, force push, commit hoặc tạo outbound email.
5. Lưu before-counts và chạy validate schema trên DB **test**. Nếu cần migrate, chỉ dùng migration hợp lệ được review trên DB test.

### Phase 1 — Catalog, roles, authentication, term configuration (BƯỚC 1)
1. Tạo/đối chiếu Role, Permission, RolePermission, UserRole; các role ADMIN, FACULTY, LECTURER, STUDENT, COMMITTEE hoặc tên thực tế của code. Gán COMMITTEE cho người đã là lecturer, không sinh thêm tài khoản.
2. Tạo department, training system, title config, student profile, lecturer profile, lecturer research areas, grant theo học kỳ/đợt/đơn vị.
3. Tạo hai đợt với kỳ/semester, phase/mốc hợp lệ, time zone, TermStudent/TermLecturer, quy tắc quota, trạng thái và dữ liệu import audit/validation nếu workflow hỗ trợ.
4. Tạo kịch bản import hợp lệ, trùng dòng, thiếu dữ liệu, sai hệ/đợt trong scenario QA riêng, không đưa bản ghi rác vào baseline.
5. Chứng minh 105 users, 84 students, 87 participations, 18 lecturers, 2 faculty, 1 admin, 2 terms; 3 user thực sự dùng chung ở hai đợt.

### Phase 2 — Registration preferences (BƯỚC 2)
1. Tạo Registration và RegistrationPref có thứ tự 1..N, N nằm trong 1–3, không trùng lecturer và phù hợp hướng/hệ/đợt.
2. Tạo ví dụ 1 NV, 2 NV, 3 NV, cạnh tranh NV1, và trường hợp GPA cao/thấp để kiểm tra thuật toán bước 3.
3. Baseline đợt cũ và hiện tại phải đã hoàn thành phân công thì registration cần ở trạng thái nhất quán; các trường hợp DRAFT, chưa mở, hết hạn, invalid email/phone, chưa đổi password, SV chưa eligible, SV thuộc đợt khác phải nằm trong các scenario DB test độc lập.
4. Không tạo bản đăng ký SUBMITTED khi profile/permission/time không thỏa điều kiện service.

### Phase 3 — Semi-automatic assignment & topic agreement (BƯỚC 3)
1. Seed AssignmentPlan và AdvisorAssignment có snapshots/revisions, Workflow PUBLISHED/FINALIZED phù hợp thứ tự thời gian.
2. Tạo trường hợp trúng NV1/NV2/NV3, tự phân công theo hướng, điều chỉnh thủ công có lý do, lịch sử thay đổi/quota, publish/công bố đúng quyền.
3. Seed Topic/TopicWorkflow/TopicHistory, xác nhận đề tài từ hai bên theo workflow, 1 topic cá nhân mỗi lượt tham gia.
4. Không để hồ sơ bước 4+ xuất hiện trước khi có phân công/đề tài hợp lệ. Không giả email đã gửi; chỉ tạo notification/outbox sandbox nếu code hỗ trợ và worker gửi thật bị tắt.

### Phase 4 — Review groups (BƯỚC 4)
1. Seed nhóm GV duyệt đề cương theo department; membership, quyền duyệt, lịch sử thay người có lý do và mốc thời gian hợp lệ.
2. Có nhiều nhóm, mỗi nhóm có tối thiểu số thành viên theo validator; bảo đảm người duyệt thuộc nhóm/đợt hợp lệ.
3. Test nhóm rỗng, trùng thành viên, cross-department, revoked permission trong scenario riêng.

### Phase 5 — Proposal submission & review (BƯỚC 5)
1. Seed Proposal, ProposalVersion, ProposalWorkflow, ProposalVersionWorkflow, ProposalReview, ProposalReviewWorkflow, ProposalReviewDecision, ReviewComment.
2. Có hồ sơ duyệt ngay, hồ sơ yêu cầu sửa, hồ sơ có hai vòng duyệt, hồ sơ với comment theo từng version; có dữ liệu đủ cho UI xem lịch sử.
3. Đảm bảo review đúng version, đúng reviewer, đúng phase; không sửa SEALED/submitted version; supersede đúng chuỗi.
4. Không tạo dữ liệu `APPROVED` nếu thiếu quyết định/phiên bản mà service thực tế yêu cầu.

### Phase 6 — Proposal revisions (BƯỚC 6)
1. Tạo sự kiện yêu cầu sửa → SV/GVHD cập nhật → resubmit → reviewer quyết định, giữ các bản trước và author/timestamp.
2. Phủ các trường hợp revision nhiều vòng, nộp lại sau feedback, bị từ chối, phase locked, người không được phân quyền.
3. Bản baseline đợt cũ có lịch sử APPROVED đầy đủ cho người được đưa vào hướng dẫn; các trạng thái đang sửa dùng scenario riêng hoặc hồ sơ không bắt đầu hướng dẫn.

### Phase 7 — Final dossier / sign and receipt (BƯỚC 7)
1. Seed ThesisDossier, DossierWorkflow, DossierFinalization, DossierReceipt, DossierHistory, DossierStudentProfile, DossierPdfContent và assets tương ứng theo đúng producer.
2. Chỉ finalization từ proposal version đã APPROVED; snapshot hash/template, lịch sử version và người chốt đúng quyền.
3. Có ca đã chốt, đã tiếp nhận, mở lại rồi chốt bản mới, thiếu scan (nếu cho phép), không được final khi chưa duyệt; đúng chính sách.
4. Tạo **file PDF thật** theo fixture template đã có hoặc generator được code cho phép; checksum, storageKey, MIME, size phải khớp bytes. Không tạo đường dẫn rỗng/giả, không giả chữ ký thật.

### Phase 8 — Weekly guidance/reports/source/review/tasks (BƯỚC 8)
1. Seed GuidancePlan, GuidancePlanWorkflow, GuidancePeriod, PeriodRequiredStudent, WeeklyReportObligation, Task, TaskWorkflow, TaskProgressEvent/History, TaskSubmission, SubmissionWorkflow, FileAsset, SubmissionAsset, ProgressReview, GuidanceMeeting, PhaseEvaluation, EvaluationWorkflow/history và producer liên quan.
2. Đợt hoàn tất có kế hoạch 12 tuần nếu timeline thực tế cho phép; mỗi sinh viên có nghĩa vụ đúng khoảng tuần còn tham gia; sinh viên bảo lưu sớm không có nghĩa vụ sau mốc bảo lưu.
3. Đợt hiện tại có ~5 tuần đã tới hạn; **11 trạng thái tuần gần nhất**: 5 PASS, 3 REVISION_REQUIRED, 2 OVERDUE không nộp, 1 submitted chờ review. Không tạo TaskSubmission nếu chưa nộp, không tạo ProgressReview nếu submission không tồn tại.
4. Tạo tình huống upload REPORT/SOURCE/EVIDENCE trên storage test với fixtures thật và manifest/checksum hợp lệ. Nộp lại tạo version mới, old version là SUPERSEDED/immutable theo workflow.
5. Có review PASS/FAIL/REVISION_REQUIRED; feedback, giao nhiệm vụ tiếp, meeting, milestone; nộp đúng hạn và quá hạn; người khác không được đọc/download file sai quyền.
6. Verify các báo cáo xuyên suốt theo đúng snapshot assignmentRevision, plan, week, ownership và term.

### Phase 9 — Final report, eligibility, committee, reviewer, defense, scoring (BƯỚC 9)
1. Seed FinalReport với file thực; DefenseConfirmation, DefenseEligibility, DefermentRequest cho các case theo workflow.
2. Đợt cũ: 76 SV = 60 hoàn tất bảo vệ + 11 hoãn/bảo lưu trước lịch + 5 hoãn/đổi sau khi xếp lịch **nếu model hỗ trợ lịch sử hợp lệ**. 60 bộ điểm; 3 DefenseCommittee × 4 CommitteeMember. Cân bằng 60 lượt chấm theo hội đồng và ca; phân công reviewer hợp lệ; không chấm SV do chính mình hướng dẫn.
3. Bắt buộc xác thực luật không xung đột GVHD–người chấm HĐ; không trùng phòng và cùng giảng viên giữa hai phiên; lịch/thứ tự theo Tên + Họ đệm theo đặc tả. Nếu quy định GVPB/ủy viên có thêm ràng buộc, tuân theo validator.
4. 6 điểm nguồn/sinh viên đầy đủ nếu tài liệu/đợt đòi hỏi: GVHD, GVPB, CHAIR, SECRETARY, MEMBER1, MEMBER2. Lưu ScoreEntry/ScoreDetail đúng rubric và scorer identity, không tái dùng một entry cho hai người.
5. Kiểm tra QT=(GVHD+GVPB)/2, BV=(điểm 4 HĐ)/4, HP=0.4*QT+0.6*BV; decimal precision/làm tròn theo mẫu và service. Chặn thiếu điểm, thừa mức, duplicate scorer, người không thuộc hội đồng.
6. Điểm HP trong PDF tham chiếu hiển thị hai số lẻ; `FinalResult.finalScore Decimal(4,1)` có nguy cơ làm mất độ chính xác. PHẢI ghi blocker và không báo điểm khớp nếu sai. Không sửa schema/migration hoặc tự giảm precision để seed chạy, khi chưa được phê duyệt.
7. Đợt 10/2026 không có điểm bảo vệ/chốt; không cấp quyền xem điểm chưa công bố.

### Phase 10 — Export, sign-off, publish & close (BƯỚC 10)
1. Seed hoặc tạo qua service ExportJob, DefenseMinutes, FinalResult published states, Notification/AuditLog theo luồng producer hợp lệ.
2. Tạo xuất Excel/PDF có bytes thực, số lượng/chỉ tiêu/điểm khớp DB và công thức; không tạo file URL giả; không giả chữ ký thành viên hội đồng.
3. Có điều kiện không công bố khi thiếu điểm, chưa lock/thiếu quyền; bản published chỉ hiển thị cho đúng SV và theo đợt; bảng tổng hợp tách chưa công bố/hoãn/bảo lưu.
4. Nếu DB demo hoàn tất đợt cũ, phải chứng minh các case hoãn và xuất kết quả được xử lý hợp lệ để term có thể COMPLETED; nếu chưa, giữ trạng thái phản ánh đúng producer và báo lý do. Không force trạng thái COMPLETED chỉ để làm đẹp dashboard.

## C. Bao phủ 25 use case bằng dữ liệu và test

Với từng UC01–UC25 trong `docs/spec/dac-ta-use-case.md`, tạo ít nhất:
- 1 dữ liệu hợp lệ có thể thao tác/quan sát (trong baseline hoặc scenario).
- 1 tình huống âm: sai quyền, sai đợt, thiếu điều kiện, quá hạn, dữ liệu trùng, trạng thái đã khóa hoặc incomplete.
- Test ID, actor, input, preconditions, expected API/status, assertion DB after action, screenshot UI khi UI có API thật.

UC01 đăng nhập/đổi password; UC02 role/permission; UC03 audit; UC04 import SV; UC05 GV/quota; UC06 hướng; UC07 term; UC08 phase; UC09 registration; UC10 assignment; UC11 topic; UC12 proposal; UC13 review/dossier; UC14 plan/tasks; UC15 report/source submission; UC16 progress review; UC17 advisor confirmation; UC18 eligibility; UC19 committee; UC20 reviewer; UC21 schedule; UC22 reviewer score; UC23 committee rubric; UC24 aggregate/publish; UC25 exports.

## D. Seed architecture và chất lượng dữ liệu

1. Bắt đầu từ script seed hiện có; KHÔNG ghi đè seed hệ thống. Tạo module/script `demo-v3` và manifest cấu hình; chia theo `catalog`, `terms`, `participants`, `registration`, `assignment`, `proposal`, `review`, `dossier`, `guidance`, `defense`, `grading`, `publish-export`.
2. Seed cố định 20261116, định danh deterministic (UUIDv5 hoặc natural keys hợp lệ), unique constraints và upsert idempotent. Re-run không nhân đôi, không ghi đè dữ liệu thủ công nằm ngoài namespace demo.
3. Derived fields phải xuất phát từ dữ liệu nguồn; không tạo final score rồi tạo điểm thành phần không khớp.
4. Timestamps phải tuần tự theo tiến độ đợt và source timezone. `createdAt`, `submittedAt`, `reviewedAt`, `publishedAt`, history và version đều hợp lý.
5. Mọi file fixture được tạo thật, an toàn, phi nhạy cảm, được quản lý trên test storage; không gửi mạng hoặc dùng dữ liệu cá nhân thực.
6. Không giả AuditLog là hành động thật của người dùng bên ngoài; đánh dấu fixture synthetic và chỉ tạo phù hợp schema/chính sách audit.
7. Đăng nhập test dùng password tạo cục bộ từ env/secret store, không hardcode tài khoản+mật khẩu vào docs/git; tên/email/ID đều là giả.
8. Không xuất mail thật, không kích hoạt cron/notification/outbox trên đích ngoài test.
9. 11 scenario profiles độc lập theo manifest; baseline không có giá trị mâu thuẫn được tạo chỉ để test validation.
10. `--dry-run`, `--seed --target=local-test`, `--validate`, `--report`, `--export-backup` có lỗi rõ ràng, log tổng kết count/checks. Không tạo lệnh phá hủy dữ liệu làm default.

## E. Kiểm thử & kiểm tra giao diện thực tế

- Prisma validate/generate; type-check; lint; build; unit/integration tests, smoke các API auth/term/registration/assignment/proposal/guidance/defense/grading/report.
- Kiểm định 87 participations, 84 distinct students, 3 repeated IDs across terms, quota, 87 assignments/topics khi hợp lệ, 3 committees × 4 members; 60 điểm hoàn chỉnh không trùng người; 11 current statuses consistent; 0 cross-term leaks, 0 missing object FK, 0 dangling asset.
- Lịch bảo vệ: không trùng phòng, hội đồng, giảng viên; thứ tự theo quy định; khoảng thời gian mỗi SV đủ để bảo vệ thật; không gán một GVHD vào HĐ chấm chính SV mình hướng dẫn.
- Cần kiểm thử score 2 chữ số thập phân, điểm ở ranh giới 0/5/10, làm tròn theo quy định, thiếu một trong sáu điểm, công bố chưa khóa.
- Dùng Playwright cho các role khi frontend đã nối API thật. **Không dùng screenshot chạy DemoDb làm bằng chứng kiểm thử PostgreSQL.** Nếu bước 9–10 đang dùng `DemoDb`, ghi BLOCKED và đề xuất riêng danh sách file cần tích hợp API, chờ tôi duyệt thay đổi phạm vi.
- Xuất report `seed-diff.md`, `counts-before.json`, `counts-after.json`, `data-integrity-report.json`, `uc01-uc25-coverage.md`, `blocked-gaps.md`, `demo-users.example.md` (không secret), hướng dẫn seed/restore test.
- Chạy seed qua transaction/batch hợp lý; rollback khi có lỗi; không sửa schema hay code production ngoài phạm vi seed trừ khi tôi phê duyệt.

## F. Cách làm việc & điều kiện hoàn thành

1. **Audit và kế hoạch ngắn trước khi code**, trong cùng nhiệm vụ tiếp tục triển khai seed nếu mọi safety gate rõ ràng và môi trường TEST đã được cấp phép; chỉ dừng nếu thực sự bị chặn an toàn.
2. Triển khai từng bước 1→10, tự động validate dữ liệu sau mỗi bước, ghi lại tiến độ/checkpoint để phiên Codex khác có thể tiếp tục mà không tạo trùng.
3. Không chuyển bước chỉ vì `pnpm build` xanh; phải có **DB assertions** chứng minh producer/consumer workflow liên kết đúng.
4. Nếu thiếu implementation, API, storage, field precision hoặc mô hình lịch sử, không tạo fake data để ngụy trang; báo blocker và đề xuất sửa riêng.
5. Không tự kết luận full 10/10 khi còn test blocked; ghi `PASS`, `FAIL`, `BLOCKED`, `NOT_TESTED` riêng.
6. Không commit/push/merge/reset database khi chưa được yêu cầu. Không đưa thông tin đăng nhập, token, PII nguồn vào báo cáo.

**ĐẦU RA CUỐI:** Một bộ seed **thực thi được trên PostgreSQL test**, dữ liệu có thể sử dụng cho demo UI/API của cả 10 bước khi đã tích hợp, cùng báo cáo xác minh đầy đủ, file fixture và bản export PostgreSQL test có thể khôi phục (chỉ khi có đủ quyền và môi trường an toàn).
