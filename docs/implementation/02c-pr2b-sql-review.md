# PR2B — Baseline và migration expand-only: SQL chờ duyệt

> Cập nhật sau yêu cầu hoàn thiện nền tảng cho ba người: trạng thái “chưa kích hoạt schema/cây deploy” bên dưới là lịch sử của lần review PR2B. Schema và hai migration đã được kích hoạt **trong repository và kiểm thử local**, chưa deploy Supabase. Trạng thái hiện tại xem `03-team-development-guide.md` và `03a-foundation-completion-report.md`. Hash bên dưới ghi lần review cũ; hai SQL mới đã được chuẩn hóa LF cho Windows/Linux, hash bytes mới và kết quả replay lại nằm trong báo cáo 03a. Không thay câu lệnh SQL hoặc 0_init.

Ngày kiểm thử: 2026-10-21, máy Windows của workspace. Đây là bản review, **chưa cho phép deploy lên Supabase chung** và chưa bắt đầu PR3.

## 1. Kết luận và phạm vi

Đã chuẩn bị schema/SQL ứng viên và kiểm thử thực tế trên PostgreSQL **17.11 riêng tại loopback**. 29 integration checks, replay bằng Prisma migration history và các kiểm tra tương thích nêu dưới đều đạt. Không có DDL chạy lên Supabase chung trong PR2B này.

Chưa thay model trong `backend/prisma/schema.prisma`, chưa đưa migration mới vào `backend/prisma/migrations`, chưa thay client đang dùng bởi ứng dụng. Thay đổi `directUrl` trong active schema đã có từ công việc chuẩn hóa cấu hình trước PR2B. `0_init` giữ nguyên. Chưa stage/commit/push.

Nguồn nghiệp vụ: `00-repository-audit.md`, baseline duy nhất `01-business-decisions-and-contract.md`, kế hoạch `02-prisma-migration-plan.md`, DOCX hiện có và ADR. PR2B không thay các quyết định đã duyệt; thay đổi vật lý được đề nghị là **bảng mở rộng 1–1**, thay cho thêm scalar vào bảng cũ, để tránh scalar mới lọt vào JSON của những service đang trả nguyên Prisma object.

Đây chưa phải kết luận toàn hệ thống hết drift hoặc đủ điều kiện triển khai nghiệp vụ. Phần drift cũ và các điều kiện kích hoạt được nêu rõ tại §7–9.

## 2. SQL cần duyệt và thứ tự áp dụng dự kiến

| Thứ tự | Artifact | Tác động và giới hạn |
|---|---|---|
| 0 | `backend/prisma/migrations/0_init/migration.sql` | 56 bảng ứng dụng, nguyên bản; không sửa và không `migrate resolve` để giả lập đã chạy |
| 1 | `backend/prisma/review/pr2b/01-empty-baseline-enum-bridge.sql` | Transaction riêng; tạo 11 enum đã có trong Prisma hiện tại, chuyển 11 cột VARCHAR tương ứng sang enum, giữ default cùng giá trị. Guard kiểm tra **tất cả 56 bảng ứng dụng rỗng** trước mọi DDL. Có bất kỳ dữ liệu nào thì từ chối; không phải script nâng cấp DB legacy có dữ liệu |
| 2 | `backend/prisma/review/pr2b/02-expand.sql` | Transaction riêng; 38 bảng mới, 16 enum mới, FK/index/CHECK/trigger/view mới và thu hồi quyền Data API trên danh sách object ứng dụng cụ thể |

`02-expand.sql` đã chứa cả `02-expand.generated.sql`, `03-integrity.sql` và `04-data-api-isolation.sql`. **Không chạy các fragment thêm lần nữa.** `fixture.sql` chỉ cho database test, tuyệt đối không đưa vào migration triển khai.

Bridge enum ở bước 1 **không phải expand-only thuần túy**: đó là bước hòa giải baseline rỗng được tách riêng để duyệt, vì SQL cũ dùng VARCHAR trong khi client đã dùng enum. Không sửa enum labels, timestamp, nullability hay onDelete cũ. Nó tác động các cột status thuộc cả bước 1–3 và 9–10, nên cần chủ module xem xét trước khi phát hành. Phần expand bước 2 không DROP bảng/cột/index/constraint/enum cũ.

Hash SHA256 theo bytes đã kiểm thử:

| File | SHA256 |
|---|---|
| `0_init/migration.sql` | `533ffb3d89181a690ee6afbb15b9673d4f34dd5c75ecf542c596571cd1687504` |
| `01-empty-baseline-enum-bridge.sql` | `d42add8140bcda397eda9427e44848bfbe69d6047f62141ef2872243523360d4` |
| `02-expand.sql` | `8f276b4f44cab6cbc7a3724cf8327aaf9e98983fd7ee6d20fac9bb80d612e62a` |

Đổi SQL sau review phải tạo lại hash và replay lại; checksum migration phải khớp bytes, không dùng hash chuẩn hóa newline của tài liệu PR2 thay thế.

## 3. Mapping mô hình và compatibility

Toàn bộ field, enum, cardinality, PK/unique của 56 model hiện tại được giữ trong schema review. Các relation ngược mới chỉ được đưa vào payload nếu caller chủ động include chúng. Giữ `Topic.proposals[]`, `Student.proposal`, unique `Proposal.studentId`, các bảng task/review/defense/grading và `TaskReview.isPassed` cũ.

| Model/bảng cũ | Model mở rộng và field chính | Mục đích |
|---|---|---|
| UserAccount, Department, ThesisTerm | AcademicTermGrant(userId, termId, allDepartments, revision), GrantDepartment(grantId, departmentId) | Grant học thuật theo đợt/bộ môn; không tự cấp quyền ADMIN |
| ResearchArea, TermPhase | ResearchAreaWorkflow(departmentId), TermPhaseWorkflow(termId, key, revision) | Mapping routing và phase; không tự suy ra mapping từ tên cũ |
| ThesisTerm, AssignmentPlan, AdvisorAssignment | TermWorkflow(officialAssignmentPlanId, revision), AssignmentPlanWorkflow(finalizedAt, finalizedByUserId), AssignmentChange(assignmentRevision, oldAdvisorId, newAdvisorId, actorId, reason) | Pointer kết quả chính thức, revision và lịch sử; không tự đánh dấu plan chính thức |
| Topic | TopicWorkflow(termStudentId, termId, revision, confirmedTopicRevision, confirmedAssignmentRevision, confirmedAt, confirmedByAdvisorId) | Ownership một TermStudent và agreement GVHD; nullable trước đối soát |
| Proposal | ProposalWorkflow(workingVersionId, submittedVersionId, nextVersionNumber, nextReviewRound, submissionKind, revision) | Tách version làm việc/nộp, metadata CAS; không chọn latest thay submitted |
| ProposalVersion | ProposalVersionWorkflow(state, contentSchemaVersion, contentHash, createdByUserId, submittedByUserId, submittedAt, basedOnVersionId, provenance) | DRAFT/SEALED và provenance; không tự seal version cũ |
| ReviewGroup, ReviewGroupMember | ReviewGroupWorkflow(departmentId), ReviewMembershipHistory | Routing/history; không ReviewSession hoặc decider bắt buộc |
| ProposalReview | ProposalReviewWorkflow(proposalId, versionId, roundNumber, state, phaseSnapshot, routingSnapshot, revision), ProposalReviewDecision(reviewId unique, versionId, decision, decidedByUserId, decidedAt), ReviewComment | Một kết luận chung/vòng, nhiều nhận xét, giữ lịch sử phân lại |
| ThesisDossier | DossierWorkflow(state, currentFinalizationId, revision), DossierFinalization(sequence, proposalId, versionId, templateVersion, contentHash, finalizedByUserId, pdfAssetId), DossierReceipt, DossierHistory | Khoa chốt, snapshot, tiếp nhận giấy riêng, scan tùy chọn |
| GuidancePlan | GuidancePlanWorkflow(proposalId, finalizationId, assignmentId, assignmentRevision, state, revision), PlanHistory | Pause/rebase/handover; không dựng assignment hoặc receipt giả |
| ThesisTerm, TermStudent | GuidancePeriod(termId, ordinal, type, startsAt, endsAt, reportDueAt), PeriodRequiredStudent(periodId, termStudentId, termId), WeeklyReportObligation(periodId, termStudentId, planId, currentTaskId, configRevision, configSnapshot) | Danh sách tuần áp dụng độc lập task/plan. Khoa phải cấu hình; thiếu danh sách không được suy ra hoàn thành |
| Task | TaskWorkflow(planId, periodId, obligationId, kind, state, requirements, currentSubmissionId, nextSubmissionNumber, revision), TaskProgressEvent, TaskHistory | WEEKLY_REPORT/AD_HOC, CAS và lịch sử |
| TaskSubmission, TaskReview | SubmissionWorkflow(taskId, versionNumber, state, submittedAt, submittedByUserId, deadlineSnapshot, isLate, effectiveReviewId, revision), ProgressReview(decision, state, reviewerUserId, assignmentRevision, supersedesReviewId, recordedAt, amendmentReason) | Giữ PASS/FAIL/REVISION_REQUIRED riêng. Không chuyển `isPassed=false` thành kết quả mới |
| SubmissionFile | FileAsset(kind, state, storageKey unique, originalName, sizeBytes, mimeType, checksum, createdByUserId), SubmissionAsset | Metadata phân loại; không tạo file/READY giả; không ấn định ZIP/PDF hay giới hạn MB chưa duyệt |
| GuidanceMeeting | MeetingWorkflow(mode, discussion, conclusion, authorUserId, revision), MeetingHistory | Dữ liệu họp và audit |
| PhaseEvaluation | EvaluationWorkflow(planId, milestoneId, evaluatorUserId, criteriaSnapshot, criterionScores, revision), EvaluationEvidence, EvaluationHistory | Tiêu chí snapshot theo mốc; không sửa công thức điểm học phần |
| Hạ tầng mới | OutboxEvent(eventId unique, payload, state, attempts, nextAttemptAt), IdempotencyRecord(actorId, method, route, key, payloadHash, result, expiresAt) | Dedupe thông báo/request; unique idempotency theo actor/method/route/key |

Chi tiết đầy đủ field/relation/index nằm trong `expand.prisma`; 38 model này là proposal vật lý chờ duyệt. ID mới VARCHAR(36), không ép UUID lên ID seed cũ. Timestamp mới là timestamptz(6); không chuyển timestamp cũ. Revision kỹ thuật mặc định 0, state/ownership chưa xác minh nullable; không có backfill tự động.

16 enum mới: WorkflowPhaseKey, ProposalVersionState, ProposalSubmissionKind, ProposalReviewState, ProposalReviewResult, DossierState, GuidancePlanState, GuidancePeriodType, TaskWorkflowState, GuidanceTaskKind, SubmissionState, ProgressReviewResult, ProgressReviewState, FileAssetKind, FileAssetState, OutboxDeliveryState. Enum cũ không bị xóa/đổi giá trị.

## 4. Invariants đã có trong SQL ứng viên

- Composite FK: ownership Topic/TermStudent cùng đợt; official plan cùng đợt; version thuộc Proposal; review/decision/comment cùng version; dossier/finalization/plan cùng Proposal; student áp dụng tuần cùng đợt; task/submission/current review trỏ đúng aggregate.
- Unique: một kết luận cuối/vòng, một active round/Proposal, một task tuần active/nghĩa vụ, một effective progress review/submission, số version/round trong aggregate.
- CHECK: revision không âm; ngày bắt đầu trước ngày kết thúc; tuần có hạn báo cáo; comment bắt buộc khi trả sửa đề cương và FAIL/REVISION_REQUIRED của bài; metadata bài nộp mới đủ khi có state.
- Trigger: quyết định duyệt, nhận xét và tám bảng history/event mới append-only; progress review không được sửa nội dung, chỉ có chuyển RECORDED → SUPERSEDED để tạo review thay thế. Trigger TaskWorkflow chặn ghi COMPLETED khi current submission chưa có effective PASS.
- View `pr2b_weekly_coverage` bắt đầu từ PeriodRequiredStudent, không từ Task; thấy thiếu obligation/plan/task/bài. Không tự hoàn thành task/SV. Nếu PeriodRequiredStudent chưa cấu hình, API tương lai phải trả NOT_CONFIGURED, không diễn giải view rỗng là đủ báo cáo.

Các CHECK/FK/partial index/trigger/view viết tay không được Prisma biểu diễn đầy đủ. Migration SQL là một phần của contract; không dùng diff tiếp theo để xóa các object này.

**Chưa thực thi nghiệp vụ:** xác thực/current-user, grant FACULTY, thành viên đúng đợt, loại GVHD khỏi reviewer, kiểm tra FINALIZED, phase lock tại commit, sealed-version immutability qua luồng cũ, file đã upload/quét thật và tính lại task khi amend review. Những guard/transaction này thuộc PR chức năng; schema mở rộng không đồng nghĩa quyền truy cập hoặc workflow đã được thực thi. Trigger completion hiện bảo vệ lần ghi TaskWorkflow, không tự tính lại task khi bảng review thay đổi; luồng amend tương lai phải cập nhật review/current pointer/task/history cùng transaction và có concurrency test.

## 5. Data API và quyền truy cập

Giữ Nest JWT/RBAC; không dùng Supabase Auth/JWKS để thay identity hiện tại. Backend truy cập PostgreSQL, frontend gọi Nest API. `04-data-api-isolation.sql` thu hồi table/view privileges từ PUBLIC và các role `anon`, `authenticated`, `service_role` nếu tồn tại, trên đúng 56 bảng cũ + 38 bảng mới + view coverage. Không đụng auth/storage/realtime/vault hoặc bảng public không thuộc allowlist; không sửa quyền sở hữu hoặc default privileges toàn schema.

Đây là thay đổi quyền cần duyệt rõ. Nó không tạo academic bypass cho ADMIN, cũng không triển khai RLS cho truy cập trực tiếp từ Supabase SDK. Nếu nhóm có consumer dùng Data API trực tiếp, phải dừng phần thu hồi quyền đó và thống nhất contract trước. Role kết nối backend phải được xác minh riêng khi deploy; test local dùng owner role.

Đã kiểm thử thu hồi grant PUBLIC cố ý thêm vào fixture. **Chưa kiểm thử ACL/RLS thực tế của các role Supabase** trên project chung; không tuyên bố test local mô phỏng toàn bộ Supabase.

## 6. Kết quả kiểm thử thực tế

Không dùng Docker vì máy chưa có runtime khả dụng. Dùng bộ PostgreSQL portable 17.11 EDB trong `%TEMP%/btl-pr2b-pg17`, không cài Windows service/PATH. Server chỉ bind 127.0.0.1:55439; cluster và mật khẩu ngẫu nhiên nằm ngoài source. Dữ liệu hoàn toàn synthetic, database mới có prefix `btl_pr2b_`; script từ chối host remote, database mặc định và thiếu PR2B_TEST_URL, không fallback sang env ứng dụng.

Đã dừng server portable sau kiểm thử bằng pg_ctl fast stop; giữ cluster trong TEMP, không xóa dữ liệu. Không thay đổi service PostgreSQL khác.

| Kiểm tra | Kết quả thực tế |
|---|---|
| Prisma validate active schema | PASS |
| Prepare offline datamodel diff | PASS; không kết nối database |
| Prisma validate/generate review schema | PASS, Prisma 5.22.0; client riêng `backend/node_modules/.pr2b-client` |
| Backend type-check | PASS |
| Type-check compatibility client review ↔ client cũ | PASS cho payload Topic, Student, Registration, Term, Task và input tạo account thực tế của repository |
| Integration SQL trên PostgreSQL 17.11 | **29/29 PASS**, xem `test-results.json` |
| Diagnostic SELECT read-only | 12 truy vấn trên fixture đã có dữ liệu; các count violations đều 0, distribution giữ nguyên. Không phải chứng nhận cho dữ liệu thật |
| Actual `prisma migrate deploy` trên cây migration TEMP | PASS: 0_init → bridge → expand; 3 history rows finished, checksums đúng; 95 base tables gồm history; deploy lại không pending, xem `chain-results.json` |
| Failure injection trước COMMIT expand | PASS: transaction rollback DDL, fixture cũ giữ nguyên |
| Guard từ chối bridge trên bảng có dữ liệu | PASS, không sửa dữ liệu |
| Hai quyết định đối nghịch đồng thời | PASS, chỉ một record thành công |
| CAS revision đồng thời | PASS, chỉ một writer thắng |
| Target guard mới | 1/1 PASS |
| Tooling database guards hiện có | 8/8 PASS |
| Backend Vitest | 3 files, 8/8 tests PASS (assignment, config, grading) |
| Backend lint | PASS |
| CI PostgreSQL 17 job | Đã bổ sung cấu hình, **chưa chạy trên GitHub Actions**; job PostgreSQL 16 cũ vẫn giữ |
| Shared Supabase DDL / fixture / migration | **Không chạy** |

Local Node 24.13.1, pnpm 12.14; CI vẫn Node 20/pnpm 9. Chưa chạy ma trận Node20 trên máy này. Không sửa dependency/lockfile. Prisma generate không gặp EPERM khi chạy ngoài giới hạn child-process của sandbox; đây không phải bằng chứng cần nâng Prisma hoặc reinstall dependencies.

Các kiểm tra compatibility có phạm vi cụ thể; không khẳng định mọi nested-write type tùy ý giữa hai client tương đương. Chưa có HTTP end-to-end hay test nghiệp vụ bước 4–8 vì chưa implement chức năng.

## 7. Drift còn lại — tuyệt đối không apply diff tự động

Đã introspect database **local rehearsal** sau expand và so sánh với schema review. Lưu nguyên output tại `residual-drift.DO-NOT-APPLY.sql` để review, **không phải migration**. Có 95 DropForeignKey, 56 AlterTable, 18 DropIndex, 53 AddForeignKey, 9 RenameIndex do:

- Native VARCHAR/TEXT và timestamptz/timestamp khác nhau từ 0_init; không được đổi timezone semantics tự động.
- Nullability/default/client @updatedAt khác SQL cũ.
- FK/onDelete cũ hoặc tên unique/index chưa được mô tả đúng trong datamodel.
- Các composite FK/partial index viết tay mới là object ngoài khả năng biểu diễn hiện tại của Prisma.

Không chạy output này; nó có DROP và thay đổi ngoài phạm vi. Replay migration thành công và `migrate deploy` không pending **không chứng minh zero drift**, vì deploy không reconcile schema. Sau duyệt cần tách mapping baseline native types/tên constraints khỏi thay đổi dữ liệu thật; thay đổi nullability/onDelete phải được chủ module xem xét, không gộp âm thầm. Không dùng `db push`, `migrate dev`, reset hay resolve để che drift.

## 8. Expand → backfill → validate → constraint và phục hồi

1. **Trước deploy:** duyệt SQL/hash và sidecar mapping; đọc lại catalog/history/data trên shared ở chế độ read-only vì trạng thái có thể thay đổi. Kết quả kiểm tra trống ở lần trước không thay thế gate tại thời điểm deploy. Xác nhận backup/khả năng phục hồi và account owner/grants. Nếu bảng đã có dữ liệu, bridge rỗng bị chặn: cần kế hoạch khác, không đoán dữ liệu/cast bỏ qua guard.
2. **Expand:** sau phê duyệt mới đưa đúng SQL đã review vào migration chain chuẩn và kích hoạt schema/client tương ứng. 0_init trước, bridge chỉ khi rỗng, expand sau. Không seed fixture. Review SQL chưa nằm trong deploy chain để lệnh deploy hiện tại không vô tình áp dụng.
3. **Backfill riêng:** chỉ từ mapping được đối soát và producer chính thức bước 1–3. Chưa tạo ownership/official pointer/approval/review/receipt/file hoặc quyết định từ boolean cũ. Nếu không có bằng chứng, giữ null hoặc chưa có sidecar, báo unresolved cho UI/API tương lai.
4. **Validate:** duplicate/orphan/cross-term/null/enum và semantic ownership; đối soát số lượng/snapshot/history, kế hoạch tuần áp dụng, current assignment/FINALIZED; thử actual old API với client đã activate. Các CHECK scope mới trong candidate chưa chứng nhận dữ liệu legacy không có sidecar.
5. **Constraint/contract về sau:** giữ unique Proposal.studentId và Topic.proposals[] ở expand. Việc bỏ unique toàn đời, chuyển cardinality và non-null bắt buộc chỉ ở migration contract riêng sau chuyển consumer và được duyệt; không phải PR2B này.

Phục hồi: đã thử rollback lỗi trong transaction expand trên test. Nếu transaction lỗi thì không có expand một phần; Prisma history thất bại phải được điều tra, không tự resolve. Nếu migration đã commit, **không có down script DROP**: giữ client/app tương thích cũ, cô lập writer mới; giữ toàn bộ sidecar/history và sửa bằng forward migration được duyệt hoặc phục hồi backup vào database tách biệt. Bridge đã commit thì việc rollback enum phải có review riêng; không tự cast ngược. Nếu 0_init đã commit nhưng migration sau fail, không xóa baseline để thử lại. Chưa diễn tập restore backup Supabase hoặc PITR.

## 9. Dependency và điểm cần phê duyệt trước bước tiếp theo

Không còn hỏi lại quy tắc B/C đã chốt. Cần duyệt các **quyết định rollout kỹ thuật cụ thể**:

1. Chấp thuận bridge enum **chỉ cho baseline ứng dụng rỗng**, với ảnh hưởng storage của status ở module 1–3/9–10; tuyệt đối không biến nó thành backfill DB có dữ liệu.
2. Chấp thuận mapping sidecar 38 model + SQL integrity và thu hồi Data API grant trong `02-expand.sql`; xác nhận không có consumer hợp lệ dùng Supabase SDK đọc bảng ứng dụng trực tiếp.
3. Chấp thuận kế hoạch xử lý drift baseline riêng trước khi coi hệ thống đồng nhất; không duyệt hoặc chạy file residual diff. Chưa đủ điều kiện kết luận production-ready/PR3.

Phối hợp chủ bước 1–3: contract current-user giữ UserAccount; roster TermStudent/TermLecturer và mapping Department/ResearchArea; producer FINALIZED + official pointer + assignmentRevision/history; bootstrap Topic/Proposal và submitted sealed version; cấu hình phase/tuần/danh sách áp dụng, grant FACULTY. Đây là dependency cung cấp dữ liệu/transaction, không yêu cầu thay API của họ trong PR2B. Chưa sửa business logic của các producer.

Phối hợp chủ bước 9–10: giữ Proposal/GuidancePlan/TaskReview scalar cũ; xác nhận cầu nối trạng thái/version khi chức năng mới dùng sidecar; không suy `false` là FAIL, không sửa score/rubric/onDelete.

Sau duyệt SQL vẫn cần kiểm tra shared read-only mới nhất, xác nhận lịch deploy riêng và đóng gate drift/compatibility cần thiết trước khi chạy DDL. **Phê duyệt báo cáo này không tự động chạy DDL lên shared.**

## 10. Lệnh tái lập an toàn

Lệnh dưới dùng artifact review. `PR2B_TEST_URL` phải là URL riêng `127.0.0.1` với database **mới, rỗng**, tên `btl_pr2b_*`; truyền password qua env ngoài source. Không dùng backend/.env làm target. `PR2B_PSQL` là đường dẫn psql nếu chưa có PATH. Mỗi runner dùng database rỗng khác nhau; không reset database đã test.

```powershell
pnpm --filter @doan/backend pr2b:prepare
pnpm --filter @doan/backend exec prisma validate
pnpm --filter @doan/backend pr2b:validate
pnpm --filter @doan/backend pr2b:generate
pnpm --filter @doan/backend type-check
pnpm --filter @doan/backend type-check:pr2b
pnpm --filter @doan/backend pr2b:target-test
pnpm --filter @doan/backend test:database-tools
pnpm --filter @doan/backend lint
pnpm --filter @doan/backend test
# Thiết lập PR2B_TEST_URL riêng trước từng lệnh sau:
pnpm --filter @doan/backend pr2b:rehearse
pnpm --filter @doan/backend pr2b:replay-chain
```

Prepare cần Python 3; không thêm Python package. Generate review không thay canonical @prisma/client; type-check cần canonical client đã generate theo active schema. CI job mới làm cả hai. Các runner chỉ chấp nhận PG major 17, kiểm tra public trống trước khi chạy; không hỗ trợ remote/shared.

## 11. File thay đổi trong PR2B này

- Sửa `.github/workflows/backend-ci.yml`: thêm job review riêng PG17, không đưa candidate vào migration deploy job cũ.
- Sửa `backend/package.json`: scripts prepare/validate/generate/rehearse/replay-chain/target-test/type-check:pr2b, không sửa dependencies.
- Tạo `backend/scripts/prepare-pr2b.py`, `prepare-pr2b.cjs`, `rehearse-pr2b.cjs`, `replay-pr2b-chain.cjs`, `pr2b-target.check.cjs`.
- Tạo `backend/prisma/review/pr2b/`: baseline.prisma, expand.prisma, SQL 01/02/03/04 và generated fragment, fixture.sql, compatibility.ts, test-results.json, chain-results.json, residual-drift.DO-NOT-APPLY.sql, README.md.
- Tạo báo cáo này. Client review nằm trong node_modules đã ignore; cluster/archive/password portable ở TEMP, không đưa source.

Working tree còn nhiều thay đổi có từ trước PR2B, bao gồm DOCX, env/config/Docker/Makefile và các báo cáo trước. Không ghi đè các thay đổi đó. DOCX vẫn có SHA256 `2afea1a8d2cc74c50a690f4fb91874c1c83bb3d2ad1fbdb2fadc1db49b808f1a`; active schema có cùng nội dung với bản snapshot baseline sau chuẩn hóa newline. Chi tiết trạng thái cuối xem `git status --short`; `git diff --stat` không đếm file untracked.
