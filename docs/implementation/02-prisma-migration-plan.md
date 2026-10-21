# PR2 — Pre-migration check và kế hoạch Prisma/Database Migration

Ngày 21/10/2026. **Giai đoạn 1 hoàn tất khảo sát source/offline; giai đoạn 2 chưa được mở vì còn blocker kỹ thuật và nguy cơ phá hợp đồng bước 1–3. Chưa đủ điều kiện PR3.**

Người dùng đã phê duyệt baseline [PR1](01-business-decisions-and-contract.md) trong lượt yêu cầu PR2; câu “chờ phê duyệt” trong bản PR1 là trạng thái lịch sử đã được chỉ dẫn mới thay thế. Không hỏi lại B01–B12/C01–C10, không sửa baseline hoặc DOCX trong lượt này. Nguồn đối chiếu: [audit](00-repository-audit.md), PR1 §2–§9, [DOCX](../spec/Project_1_06.docx) quy trình 4–8/thiết kế DB, các ADR cá nhân/NestJS-Prisma/monorepo/công thức điểm, schema và toàn bộ SQL migration/seed hiện có.

## 1. Kết luận và phạm vi đã làm

- Chỉ tạo file kế hoạch này. Chưa thêm/sửa model, field, enum, constraint hoặc migration thực thi.
- Đã đọc schema 56 model/11 enum, một migration Prisma `0_init`, đủ mười file SQL V001–V010, ba seed SQL, các truy vấn auth/catalog/term/registration và điểm nối topic/guidance.
- Xác minh SQL hai cây **khớp nhau sau chuẩn hóa khoảng trắng**, gồm cả V010 indexes/checks. Không kết luận hai cây SQL drift. Drift thấy bằng source là **SQL migration so với Prisma datamodel**, chưa phải phép so sánh DB live.
- Môi trường không có DATABASE_URL, không có root/backend/prisma `.env`, không tìm thấy docker/psql trên PATH. Không có target DB test được nhận diện; không thử kết nối tới URL ví dụ hoặc DB chính thức.
- Chạy validate schema baseline: thiếu env ban đầu → P1012; dùng URL placeholder chỉ để parse offline → PASS. Generate → `spawn EPERM`. Type-check backend với `--incremental false` → PASS. Không có bằng chứng schema/migration mới chạy được vì chưa tạo chúng.
- Điểm dừng theo chỉ dẫn người dùng: cardinality/unique thay đổi ảnh hưởng Topic API và Student relation, yêu cầu backfill chưa kiểm trên DB; chưa được sửa business logic bước 1–3 để thích nghi. Chỉ có thể đề xuất rollout tương thích, chưa áp dụng thay đổi rủi ro.

## 2. Migration history: source và giới hạn trạng thái áp dụng

### 2.1 Inventory đã kiểm tra

| Cây | File | Nội dung |
|---|---|---|
| Prisma | `backend/prisma/migrations/0_init/migration.sql` | 550 dòng, 56 CREATE TABLE, 71 REFERENCES, 9 CREATE INDEX, 2 ALTER TABLE ADD CHECK; extension uuid-ossp; không CREATE TYPE hay TRIGGER |
| SQL | V001__auth.sql | 8 bảng, 79 dòng |
| SQL | V002__catalog.sql | 8 bảng, 77 dòng |
| SQL | V003__term.sql | 5 bảng, 50 dòng |
| SQL | V004__registration.sql | 4 bảng, 38 dòng |
| SQL | V005__topic.sql | 8 bảng, 73 dòng |
| SQL | V006__guidance.sql | 9 bảng, 84 dòng |
| SQL | V007__defense.sql | 9 bảng, 75 dòng |
| SQL | V008__grading.sql | 4 bảng, 46 dòng |
| SQL | V009__export.sql | 1 bảng, 12 dòng |
| SQL | V010__indexes_constraints.sql | 9 index; CHECK SCORE_DETAIL.score và FINAL_RESULT.final_score trong 0..10 |

Từng block V001–V010 xuất hiện nguyên văn trong 0_init. Nối mười file rồi chuẩn hóa whitespace cho kết quả bằng 0_init. SHA256 0_init theo nội dung UTF-8 đã chuẩn hóa line ending khi đọc: `5782fc7a04d884514644c59bf05a81d53970230c45a0e12713588cc8b6916563`; không dùng hash này thay checksum bytes của `_prisma_migrations`.

Trong thư mục migrations Prisma chỉ thấy 0_init/migration.sql; không có migration tiếp theo hoặc migration_lock.toml. Đây là inventory Git/filesystem, **không chứng minh 0_init đã áp vào DB**. Chưa đọc được `_prisma_migrations`, installed extension, catalog/index thật, migration fail/rolled-back hoặc checksum drift trên một DB cụ thể.

Seed SQL: S001 roles/permissions chỉ grant toàn bộ permission hiện có cho ADMIN; S002 danh mục bộ môn/hướng không có mapping hướng→bộ môn; S003 term mẫu/parameters không cung cấp roster/topic/proposal/assignment history. ID như `dept-cnpm`, `area-se`, `term-utc-k62`, `perm-01` không UUID, phải giữ nguyên.

CI backend dùng `prisma migrate deploy`; Makefile `migrate` lại là db push, `migrate-dev/reset-db` có lệnh bị cấm và **không chạy**. ADR chọn Prisma là nguồn chuẩn; chỉ tạo migration mới trong cây Prisma sau khi gỡ blockers, không chạy SQL song song, không sửa 0_init hoặc dùng migrate resolve tùy ý để che drift.

### 2.2 Drift SQL ↔ datamodel đã chứng minh bằng source

| Loại | SQL 0_init và V001–V010 | Prisma hiện tại | Rủi ro / cách xử lý |
|---|---|---|---|
| Status | VARCHAR, không enum PostgreSQL | 11 Prisma enum | SQL legacy có thể chứa giá trị ngoài enum/null; generate không kiểm DB. Phải kiểm từng tập giá trị; không tự cast toàn DB |
| ID/text | VARCHAR(36), nhiều VARCHAR giới hạn; DB uuid_generate_v4() | String mặc định PostgreSQL text, uuid() do Prisma | Không đổi ID/ép UUID; xác minh native type để FK mới không gây rebuild/cast ngoài phạm vi |
| Thời gian | TIMESTAMP WITH TIME ZONE | DateTime không @db.Timestamptz, mặc định Prisma timestamp không timezone | Thay type theo default diff có thể đổi semantics. Giữ thời điểm gốc, thống nhất timezone/mapping trước DDL |
| Nullable | Nhiều cột default nhưng không NOT NULL: ví dụ status/created_at/updated_at, is_manual | Nhiều field bắt buộc | Default không đồng nghĩa non-null. Kiểm null trước NOT NULL, không invent actor/time/status |
| Default | updated_at DEFAULT CURRENT_TIMESTAMP ở SQL | @updatedAt tại client | Không đồng nhất cơ chế update; không giả DB có trigger tự tăng updated_at/revision |
| FK chỉ có trong SQL | AssignmentPlan.term_id, RegistrationPref.lecturer_id, ReviewGroup.term_id, ReviewGroupMember.lecturer_id, GuidancePlan.proposal_id/advisor_id; các bảng phase/task/defense cũng cần diff từng relation | Một số chỉ scalar, chưa relation | Không “ADD FK mới” trùng FK đang tồn tại; phải đọc catalog/tên FK thật và thống nhất constraint |
| onDelete | Ví dụ TOPIC.term_id, PROPOSAL.topic_id, ADVISOR_ASSIGNMENT.assignment_plan_id CASCADE | Required relation mặc định không Cascade ở các chỗ này | Đổi hành vi xóa ảnh hưởng bước 1–3; không tự rewrite toàn bộ onDelete từ schema diff |
| Index/CHECK | V010 đã có index và 2 CHECK; có unique tên `uq_*`, inline unique/PK | Nhiều index/CHECK chưa thể hiện, tên default có thể khác | Không tạo index trùng hoặc DROP CHECK ngoài bước 4–8. Partial unique/CHECK cần SQL mới có kiểm chứng |
| Cross-term/semantic | FK rời không bảo đảm advisor thuộc TermLecturer hoặc plan.term=registration.term | Cũng chưa ràng buộc đủ | Dữ liệu có thể hợp lệ FK nhưng sai nghiệp vụ; cần diagnostic trước composite constraints |

Không gọi migrate diff tới DB/shadow khi chưa có target test. So sánh source ở trên không thay thế diff introspection/migration replay. Một migration sinh thẳng “schema hiện tại→PR1” có thể bỏ qua drift baseline; sinh “DB→Prisma” mù quáng có thể kéo theo sửa auth/defense/grading ngoài phạm vi. Cả hai đều chưa đủ an toàn để phát hành.

## 3. Model/quan hệ bước 1–3 đang dùng và hợp đồng bị ảnh hưởng

| Code consumer | Model/field/relation đang dùng | Điều cần giữ trong expand |
|---|---|---|
| auth/repository/user-account.repository.ts | UserAccount unique username/email/id; userRoles→Role; create username/email/passwordHash; update status/counters/password | Không thêm field bắt buộc không default vào UserAccount làm create hiện tại fail; không đổi account enum cũ hoặc grant Admin tự động |
| auth/service/rbac.service.ts | UserRole→Role→RolePermission→Permission | Không thay PK/permission resource/action; grant học thuật mới additive, policy mới là PR sau |
| catalog/repository/student.repository.ts | Student.fullName/studentCode search, trainingSystem include | Giữ field/shape, GPA/ID nguyên; Student.proposal relation đổi cần rà caller cả external |
| catalog/service/lecturer.service.ts | Lecturer→Department/TitleConfig, list/count | Không thêm department routing required vào write cũ; enum/account changes không lan ra catalog |
| catalog/service/import.service.ts | Stub đếm rows, chưa import thật | Không coi là đường backfill hoặc producer dữ liệu đã hoàn thiện |
| term/service/term-lifecycle.service.ts | ThesisTerm list/detail include phases, parameters, termLecturers | Không rename phaseName/startDate/endDate, không thay shape phases; thêm scalar có thể lọt ra JSON raw |
| term/service/term-parameter.service.ts | TermParameter where termId | Không diễn giải tham số điểm thành lịch tuần/criteria chưa được duyệt |
| term/validator/term-transition.validator.ts | TermStatus | Giữ giá trị cũ; không đổi lifecycle để lách phase guard |
| registration/service/registration.service.ts | Registration.student/preferences/advisorAssignment.advisor | Giữ relation names/PK và shape; không thay assignments thành mảng nếu code đang optional 1–1 |
| registration/service/assignment-plan.service.ts | pending registrations/preferences/student.gpa, TermLecturer.lecturer/quota, groupBy AdvisorAssignment.advisorId filter assignmentPlan.termId | Giữ scalar và relation đang dùng. Query đếm mọi plan chưa lọc FINALIZED: thêm official pointer không tự làm service đúng semantics mới; cần producer phối hợp sau, không sửa tại PR2 |
| topic/service/topic.service.ts — điểm nối bước 3 | Topic.termId, include researchArea và **proposals:true** | Đổi relation `proposals`→`proposal` để đúng 1–1 sẽ làm compile/query/API shape cũ vỡ; đây là điểm phải dừng xin duyệt |
| guidance/service/task.service.ts | Task.guidancePlanId, submissions include, deadline sort | Không rename/drop guidancePlanId/deadline; không thay enum legacy REVIEWED/OVERDUE bằng xóa ngay |
| report/defense/grading consumers | proposal counts/IDs, committee/score read | Giữ proposalId, không đổi công thức/score; V010 CHECK điểm không thuộc đợt refactor này |

Các controller trả raw Prisma result/ApiResponse không có mapper ổn định ở nhiều chỗ. Thêm scalar nullable/default tuy compile thường vẫn được nhưng **có thể mở rộng JSON response** (đặc biệt snapshot/audit fields nhạy cảm); không khẳng định expand tuyệt đối không ảnh hưởng API. Cần chủ producer review shape/response projection trước bật dữ liệu mới. Không sửa controller/service để che vấn đề trong lượt này.

## 4. Mapping current → PR1 và kế hoạch giữ tương thích

Chưa có dòng nào dưới đây được implement. “Nullable expand” là trạng thái chuyển tiếp có chủ đích, không thay đổi nghiệp vụ baseline: API mới phải fail closed khi thiếu dữ liệu, không dùng null để giả là đã thống nhất/chốt/hoàn thành.

| Hiện tại | Đích PR1 / field/model | Expand đề xuất và backfill/constraint gate |
|---|---|---|
| Không grant theo đợt | AcademicTermGrant(userId,termId,allDepartments,revision), GrantDepartment | Bảng mới unique user+term/grant+department; chỉ cấp từ danh sách được phê duyệt, không copy tất cả ADMIN permissions |
| ResearchArea không department | departmentId→Department, routingRevision | Thêm nullable; Khoa cung cấp mapping 1 bộ môn/hướng, không đoán từ tên hoặc lecturer đầu tiên; NOT NULL sau coverage/mapping validate |
| ThesisTerm không official pointer/revision | officialAssignmentPlanId?,revision | Pointer nullable, FK cùng term; chỉ backfill khi có chứng cứ FINALIZED duy nhất và người có quyền xác nhận; không tự promote PUBLISHED |
| TermPhase.phaseName tự do | key,revision; giữ startDate/endDate/isLocked | key nullable mới; mapping phaseName→key do chủ term xác nhận; unique(termId,key) khi không có xung đột, không thay phaseName để giữ API |
| AssignmentPlan.termId scalar; publishedAt | term relation,finalizedAt/by,revision | Giữ publishedAt/status; finalized actor/time không suy từ createdAt/publishedAt; index(termId,status); không unique termId cho mọi draft |
| AdvisorAssignment hiện hành registrationId unique | revision + AssignmentChange | Giữ ID/registration relation; history mới không bịa quá khứ; write handover producer sau này phải audit/pause trong transaction |
| Topic.termId, nhiều Proposal | termStudentId unique,revision,agreement fields | Nullable ownership/agreement trước; candidate từ proposal.studentId + topic.termId. Topic không Proposal hoặc nhiều owner là không thể tự backfill. Giữ termId cũ trong expand và kiểm consistency |
| Proposal.studentId unique, Student.proposal? | Proposal.topicId unique, ownership theo Topic, Student nhiều hồ sơ theo đợt | Giữ studentId và unique cũ tạm thời; chưa cho SV tạo hồ sơ đợt 2 đến contract cutover. Bỏ unique làm Prisma Student.proposal 1–1 không còn hợp lệ, cần phối hợp relation/API trước |
| Topic.proposals[] | Topic.proposal? 1–1 | Không đổi relation ngay trong expand; thêm unique topicId cuối có thể vẫn buộc sửa relation client để Prisma phản ánh 1–1. Chưa tạo DDL có nguy cơ break khi chưa duyệt compatibility |
| Proposal chưa counters/pointers | workingVersionId?,submittedVersionId?,submissionKind?,revision,nextVersionNumber,nextReviewRound | Pointer nullable; counters có thể tính từ version/round xác thực, nhưng không chọn MAX(createdAt) là bản được nộp; unique/composite ref bảo đảm cùng proposal |
| ProposalVersion.version/content/filePath | versionNumber mapped cột version, state,author/time,hash,schemaVersion,basedOnVersionId | Giữ Prisma `version` và cột version trong expand; đổi tên client chỉ sau consumer review; state mới nullable cho legacy chưa rõ DRAFT/SEALED, không default SEALED giả; filePath giữ |
| ReviewGroup.termId; member thiếu lecturer relation Prisma | departmentId,term/member relations,revision + membership history | Department nullable; mapping do Khoa; member đúng TermLecturer kiểm diagnostic. Không thêm decisionMaker/vote/ReviewSession |
| ProposalReview.decision/comment/reviewedAt, chưa version/round/actor | versionId,roundNumber,state,phase/routing snapshot,revision + ProposalReviewDecision + ReviewComment | Giữ cột cũ; mới nullable trước; không tạo decision actor giả hoặc gắn version “mới nhất”. Decision mới unique reviewId, enum 2 giá trị APPROVED/REVISION_REQUIRED |
| ThesisDossier.status string/filePath | state,currentFinalizationId?,revision + DossierFinalization/Receipt/history | state mới nullable riêng để không cast status ngay; bản chốt chỉ tạo khi có đúng version/template/actor/time/chứng cứ; không suy receipt từ submittedAt |
| GuidancePlan.proposalId/advisorId scalar | FK Proposal/assignment/finalization,state,revision + PlanHistory | Giữ advisorId, map assignment nếu đúng cùng SV/đợt và lịch sử xác thực; nullable references/state trước; không auto ACTIVE mọi legacy plan |
| Chưa period/applicability | GuidancePeriod(term,ordinal,dates,due,type,revision), PeriodRequiredStudent | Bảng mới unique term+ordinal và period+termStudent; lịch/SV áp dụng do Khoa cấu hình, không generate ISO weeks từ startDate |
| Không obligation độc lập task | WeeklyReportObligation(periodId,termStudentId,planId?,currentTaskId?,revision,snapshot) | unique(periodId,termStudentId); không bắt buộc plan/task, không completed bool; coverage gốc applicability, missing row vẫn hiển thị chưa nộp |
| Task.title/deadline/guidancePlanId/status | periodId?,kind?,obligationId?,requirements,revision,currentSubmissionId?,counter,cancel reason + TaskHistory/ProgressEvent | Giữ fields/status legacy; add enum mới theo chiến lược tương thích DB đã chọn. Không gán task cũ vào tuần suy từ deadline. partial unique task tuần chưa cancel/obligation |
| TaskSubmission chưa version/actor/late | versionNumber?,state?,actor/time,deadlineSnapshot,isLate?,revision | Không giả submittedBy/time từ owner/task.createdAt; version có thể cấp thứ tự kỹ thuật có ghi provenance nếu được duyệt, không giả lịch nộp; unique(taskId,versionNumber) sau đối soát |
| SubmissionFile chỉ path/name/size/MIME | kind?,assetId? + FileAsset READY/QUARANTINED metadata/hash | Không phân loại SOURCE/REPORT chỉ theo extension hoặc coi path là READY. Inventory file thực/checksum/access/backup trước link; giữ metadata/file cũ |
| TaskReview.isPassed boolean NOT NULL | decision? enum PASS/FAIL/REVISION_REQUIRED,state?,actor/assignmentRevision,supersedes,reason,revision | Giữ isPassed. false không thể phân biệt FAIL/cần sửa; true cũng không đủ actor/version semantics để coi là review hiện hành mới. Quyết định mới chỉ khi có chứng cứ; audit/history riêng |
| GuidanceMeeting.meetingDate/location/summary | mode/discussion/conclusion/author,revision + history | Giữ tên/cột cũ; không tách summary thành discussion/conclusion bằng suy đoán |
| PhaseEvaluation.phaseName/score/comment | period/milestone FK,criteriaSnapshot,criterionScores,evidence,actor,revision + history | Không suy criteria/weights từ score tổng; lịch sử legacy giữ; unique plan+milestone chỉ sau map đúng |
| AuditLog hiện độc lập transaction | transaction-aware history; OutboxEvent, IdempotencyRecord | Thêm bảng/index/unique; schema không tự tạo atomicity, immutable write policy hay kiểm quyền — dependency PR service sau; không chép source/content vào audit Admin |

### 4.1 Enum và invariant không được làm mất dữ liệu

- Giữ ProposalStatus.REJECTED và TaskStatus.REVIEWED/OVERDUE để đọc legacy trong expand; cấm phát sinh mới ở code chức năng sau, không xóa enum để ép migrate. State mới/cột song song cần native type tương thích DB thật đã xác minh.
- TaskReviewDecision mới có **PASS/FAIL/REVISION_REQUIRED độc lập**; không dùng boolean/two-valued enum làm chuẩn. FAIL và cần sửa cùng chuyển workflow Task về REVISION_REQUESTED không làm hai decision thành một.
- ProposalReviewDecision.reviewId unique, content/actor/time immutable; CAS review+Proposal cùng transaction, hai member quyết định chỉ một thành công. Không đủ dữ liệu actor/version thì không tạo hàng final decision giả từ comment cũ.
- Partial unique active review/proposal và active WEEKLY_REPORT/obligation; composite FK/pointer cùng owner/term; check nonnegative revision, dates đúng thứ tự, kind/references nhất quán; chọn DDL cụ thể khi đã kiểm catalog/type.
- Snapshot/review/file chính thức không cascade delete; thay onDelete hiện tại là contract change cần chủ module duyệt. Foreign key `NOT VALID` có thể thêm ở bước phù hợp để chặn ghi mới và validate dữ liệu cũ sau; unique/NOT NULL không được xem là có cùng semantics NOT VALID.

## 5. Kiểm tra dữ liệu: nguy cơ đã biết và phần chưa thể kiểm

**Chưa thực hiện bất kỳ SELECT data/catalog nào trên PostgreSQL.** Không gọi “không có duplicate/orphan” khi chỉ đọc schema. SQL constraints cho thấy khả năng, không chứng minh dữ liệu DB đang tuân theo đúng migration này (DB có thể được tạo bằng db push hoặc SQL khác).

| Kiểm tra cần chạy trên bản sao test | Vì sao cần / ngưỡng thông qua | Hiện trạng |
|---|---|---|
| `_prisma_migrations`/checksum/provider/catalog/extensions | Xác nhận baseline đã áp, failed migration và drift; replay khớp | Chưa có DB |
| Topic nhiều Proposal, khác student, Topic không Proposal | unique topicId có thể fail; ownership không thể suy khi nhiều/không candidate | Chưa có counts |
| Nhiều Topic cùng (termId,studentId) | unique Topic.termStudentId có thể fail dù Proposal.studentId global unique thường che bớt trường hợp | Chưa có counts |
| Proposal→Topic/Student, Topic→Term, version→Proposal | orphan FK và owner chain | Chưa có counts |
| Topic.term + Proposal.student không có TermStudent | không được tự thêm roster/đổi term để map | Chưa có counts |
| plan.term != registration.term; advisor không TermLecturer | FK hợp lệ vẫn cross-term | Chưa có counts |
| review.group.term != proposal.topic.term; member ngoài term roster | cross-term/scope leak, không thể siết membership ngay | Chưa có counts |
| nhiều FINALIZED plans/term hoặc không có mốc finalizedAt/by | không tự chọn bản mới nhất làm official | Chưa có counts/chứng cứ |
| GuidancePlan.proposal/advisor mismatch assignment | thiếu historical handover, không cấp sai quyền | Chưa có counts |
| null/unknown statuses, REJECTED, REVIEWED/OVERDUE, isPassed=false | enum/native type chuyển đổi có thể fail/mất nghĩa | Chưa có distribution |
| đề cương version/actor/submission timestamp thiếu, duplicate version | không tự seal/chọn submittedVersion/decision mapping | Chưa có counts/chứng cứ |
| paths thiếu file, path ngoài storage root, size/MIME/hash lệch | không coi legacy files READY và không xóa file không rõ owner | Chưa có inventory storage |
| periods/phase key/mapping researchArea/grant/criteria chưa có | cần cấu hình chính thức, không backfill bằng tên gần giống | Source xác nhận chưa có field, chưa có mapping được bàn giao |

### 5.1 Diagnostic SQL dự kiến (chỉ SELECT, chưa chạy)

Các câu này dùng tên bảng/cột 0_init, dành cho DB test được xác định sau. Chỉ trả ID/count khi đối soát, không dump password/token/content. Ngoài SQL bên dưới cần check toàn FK catalog và distributions/null đầy đủ.

```sql
-- Hai hướng history/schema phải được xác nhận từ DB, không từ status Git.
SELECT migration_name, started_at, finished_at, rolled_back_at,
       applied_steps_count, checksum
FROM "_prisma_migrations" ORDER BY started_at;

-- Proposal.topicId unique chưa được bảo đảm hiện tại.
SELECT topic_id, COUNT(*) AS proposal_count,
       COUNT(DISTINCT student_id) AS owner_count
FROM "PROPOSAL" GROUP BY topic_id HAVING COUNT(*) > 1;

-- Owner không map được TermStudent hoặc không tồn tại parent.
SELECT p.id AS proposal_id, p.topic_id, p.student_id,
       t.term_id, ts.id AS term_student_id
FROM "PROPOSAL" p
LEFT JOIN "TOPIC" t ON t.id = p.topic_id
LEFT JOIN "STUDENT" s ON s.id = p.student_id
LEFT JOIN "TERM_STUDENT" ts
  ON ts.term_id = t.term_id AND ts.student_id = p.student_id
WHERE t.id IS NULL OR s.id IS NULL OR ts.id IS NULL;

SELECT t.id AS topic_without_proposal
FROM "TOPIC" t LEFT JOIN "PROPOSAL" p ON p.topic_id = t.id
WHERE p.id IS NULL;

SELECT t.term_id, p.student_id, COUNT(DISTINCT t.id) AS topics
FROM "TOPIC" t JOIN "PROPOSAL" p ON p.topic_id = t.id
GROUP BY t.term_id, p.student_id HAVING COUNT(DISTINCT t.id) > 1;

-- Assignment khác đợt hoặc ngoài roster của đợt.
SELECT a.id
FROM "ADVISOR_ASSIGNMENT" a
LEFT JOIN "ASSIGNMENT_PLAN" ap ON ap.id = a.assignment_plan_id
LEFT JOIN "REGISTRATION" r ON r.id = a.registration_id
LEFT JOIN "TERM_LECTURER" tl
  ON tl.term_id = ap.term_id AND tl.lecturer_id = a.advisor_id
LEFT JOIN "TERM_STUDENT" ts
  ON ts.term_id = r.term_id AND ts.student_id = r.student_id
WHERE ap.id IS NULL OR r.id IS NULL OR ap.term_id <> r.term_id
   OR tl.lecturer_id IS NULL OR ts.id IS NULL;

SELECT term_id, COUNT(*) FROM "ASSIGNMENT_PLAN"
WHERE status = 'FINALIZED' GROUP BY term_id HAVING COUNT(*) > 1;

-- Review/group cross-term, hoặc member không tham gia đúng đợt.
SELECT rv.id
FROM "PROPOSAL_REVIEW" rv
LEFT JOIN "REVIEW_GROUP" g ON g.id = rv.review_group_id
LEFT JOIN "PROPOSAL" p ON p.id = rv.proposal_id
LEFT JOIN "TOPIC" t ON t.id = p.topic_id
WHERE g.id IS NULL OR p.id IS NULL OR t.id IS NULL
   OR g.term_id <> t.term_id;

SELECT gm.review_group_id, gm.lecturer_id
FROM "REVIEW_GROUP_MEMBER" gm
LEFT JOIN "REVIEW_GROUP" g ON g.id = gm.review_group_id
LEFT JOIN "TERM_LECTURER" tl
  ON tl.term_id = g.term_id AND tl.lecturer_id = gm.lecturer_id
WHERE g.id IS NULL OR tl.lecturer_id IS NULL;

SELECT proposal_id, version, COUNT(*) FROM "PROPOSAL_VERSION"
GROUP BY proposal_id, version HAVING COUNT(*) > 1;
SELECT is_passed, COUNT(*) FROM "TASK_REVIEW" GROUP BY is_passed;
SELECT status, COUNT(*) FROM "PROPOSAL" GROUP BY status;
SELECT status, COUNT(*) FROM "THESIS_DOSSIER" GROUP BY status;
```

Nếu `_prisma_migrations` không tồn tại thì ghi rõ DB không được quản lý bởi history kỳ vọng; không tạo bảng/mark applied để làm kết quả trông đúng. Kiểm bất biến thời gian, orphan mọi bảng và nguồn dữ liệu mapping phải thực hiện trước khi đánh giá diagnostic pass.

## 6. Expand → backfill → validate → constraint

### E — Expand có kiểm soát

Sau khi gỡ blockers và được phép tiếp tục: chỉ thêm bảng mới, scalar nullable, revision/counter default kỹ thuật nơi an toàn; giữ fields/relation/enum/ID đang dùng. New workflow không được mở trên hồ sơ chưa migrate. Giữ Proposal.studentId unique và Topic.proposals[] tạm thời nếu chưa cutover, ghi rõ chưa hỗ trợ multi-term write mới; không tự tuyên bố đã đạt full PR1.

Chốt native type/FK/constraint names từ baseline thật trước DDL. Bảng mới rỗng có thể đặt enum/unique/FK ngay nếu không vướng dữ liệu; FK sang bảng cũ phải đúng type. Không áp các thay đổi enum/timestamp/default/onDelete toàn auth/defense/grading để “làm sạch diff”. Nếu expand mới làm raw API trả field nhạy cảm, phải dừng phần đó để phối hợp response contract.

### B — Backfill có bằng chứng

Chỉ map Topic khi có đúng một owner và đúng TermStudent; thiếu/đa trị đưa vào bảng báo cáo đối soát, không INSERT roster giả. Routing/grant/phase key/applicability/criteria lấy mapping được Khoa và chủ producer phê duyệt. Finalization/decision/actor/submittedVersion lấy chứng cứ lịch sử; không chọn latest làm đại diện. Không đoán FAIL/Cần sửa từ false, receipt từ status string, SOURCE từ extension, tuần từ task deadline.

Backfill chia batch, idempotent, có dry-run/count/reconciliation trước-sau và audit provenance; không sửa bảng source/xóa bản ghi khó map. Chạy trên bản sao test trước; dữ liệu thật chỉ theo phê duyệt riêng về target/mapping. Giữ legacy unresolved read-only hoặc trạng thái migration riêng cho tới xử lý, không bypass new workflow guard.

### V — Validate

Counts/PK/foreign keys cũ không giảm; map owner/term đầy đủ với phần chuẩn bị cutover; không duplicate/cross-term; file inventory khớp; absence đúng semantics weekly coverage, chưa plan/task vẫn thấy thiếu; final decision unique/counter/current pointers nhất quán. Chạy validate constraints trên DB test sau replay từ 0_init lẫn từ snapshot legacy đại diện. Prisma validate/generate/typecheck không thay thế test DB.

### C — Constraint và contract cutover

Chỉ siết NOT NULL/unique/composite FK/partial unique trên phần dữ liệu đã đủ bằng chứng. Bỏ Proposal.studentId unique và đổi Prisma inverse relation chỉ sau chủ consumer duyệt; giữ cột studentId/termId cũ trong giai đoạn chuyển tiếp, không DROP để đạt schema đẹp. Rename client `version`, `meetingDate`, `summary`, relation proposals[] phải có compatibility plan, chưa được tự sửa logic tại PR2.

Constraint mạnh và code cũ có thể xung đột: producer cũ không ghi field mới thì fail. Cần đồng bộ rollout writer/adapter/feature gate ở PR chức năng được phép; không giữ null vĩnh viễn rồi tuyên bố đã enforce baseline. Không hard-delete/cascade chứng cứ khi rollback; ưu tiên disable feature/corrective forward migration, restore theo backup đã diễn tập, không chạy reset.

## 7. Blockers kỹ thuật và điểm xin phê duyệt

| ID | Bằng chứng / vấn đề | Cách gỡ / phạm vi cần phê duyệt |
|---|---|---|
| T01 — chưa có DB test | DATABASE_URL unset; không env/test target; docker/psql không có trên PATH | Cung cấp DB test riêng hoặc môi trường chạy PostgreSQL có snapshot/fixture đại diện và quyền SELECT/catalog/replay trên test. Không dùng DB chính thức. Không thể khẳng định dữ liệu an toàn trước constraint |
| T02 — native schema drift chưa định vị live | SQL dùng VARCHAR/timestamptz, Prisma enum/default types/nullability/FK khác; hai cây SQL bằng nhau | Diff DB/catalog và baseline 0_init trên test; review DDL reconciliation giới hạn. Không tự sửa history/đổi timestamp/enum toàn hệ thống |
| T03 — cardinality/unique phá hợp đồng hiện có | TopicService include `proposals:true`; Student.proposal optional 1–1 dựa unique studentId; PR1 muốn unique topicId và bỏ unique toàn đời SV | **Cần người dùng duyệt rollout expand-only giữ tên/unique cũ tạm, sau đó cutover có phối hợp chủ bước 1–3/Topic consumer.** Hoặc cấp phạm vi riêng cho adapter/consumer compatibility ở PR khác. Chưa sửa logic bước 1–3 trong PR2 |
| T04 — dữ liệu không đủ chứng cứ backfill | Không có routing/grant/phase keys/period/receipt/review actor/ba mức từ boolean | Chuẩn bị mapping/đối soát được phê duyệt từ producer; nullable expand không tự mở workflow mới; không giả dữ liệu để hết blocker |
| T05 — generate môi trường | `prisma generate` thất bại `spawn EPERM` | Khôi phục quyền spawn/engine ở môi trường dev/test hoặc chạy trong môi trường cho phép, giữ deps/version; không sửa dependency/ép generator khác để né lỗi. Không xác nhận client mới type-safe trước generate thành công |

Việc PR1 đã được phê duyệt giải quyết nghiệp vụ, không giải quyết các bằng chứng DB/compatibility trên. Theo yêu cầu “nếu có nguy cơ ... phá vỡ module bước 1–3, DỪNG”, **dừng trước chỉnh schema và tạo migration**. Giai đoạn 2 chỉ mở lại khi các điểm trên có phương án được kiểm chứng/được phê duyệt trong phạm vi tương ứng; không hỏi lại mô hình cá nhân, one decision/vòng hay ba kết quả đã chốt.

## 8. Validation thực tế và những kiểm tra chưa chạy

| Lệnh / phép kiểm | Kết quả thực tế | Giới hạn |
|---|---|---|
| `pnpm --filter @doan/backend prisma validate` | FAIL exit 1, P1012: Environment variable not found DATABASE_URL | Cấu hình môi trường, không phải syntax relation error |
| Cùng lệnh với DATABASE_URL placeholder chỉ trong subprocess | PASS exit 0, schema valid; URL `postgresql://offline:offline@127.0.0.1:1/pr2_offline_placeholder` | Chỉ parse/validate schema cũ, **không kết nối DB**, không chứng minh migration đúng |
| `pnpm --filter @doan/backend prisma generate` | FAIL exit 1, `Error: spawn EPERM` | Không claim generated client cập nhật thành công; không dùng lỗi này để sửa deps ngoài phạm vi |
| `pnpm --filter @doan/backend type-check --incremental false` | PASS exit 0: `tsc --noEmit --incremental false` | Baseline code/schema cũ, không validation schema PR1 chưa implement; tắt incremental để không tạo tsbuildinfo mới |
| So block và normalize SQL V001–V010 ↔ 0_init | PASS, 56 tables, 9 explicit indexes, 2 CHECK constraints | Source comparison, không live drift |
| Đọc DOCX OOXML | PASS, 2.059 paragraph, kiểm lại bước 4–8 và term_student ownership | Không render mẫu ảnh/PDF, không chỉnh file |
| `prisma migrate status`, introspection, live diff | NOT RUN: chưa có target test | Chưa đọc được DB applied history/checksum/type/catalog |
| Migration deploy/replay, diagnostic SELECT, concurrent integrity/upload/history tests | NOT RUN | Không có migration mới hoặc DB test; không tuyên bố dữ liệu không trùng/orphan |

Prisma CLI thực tế 5.22.0, Node v24.13.1, pnpm 12.14.0; manifest Prisma ^5.18.0; CI Node 20/pnpm 9. Không install/update dependencies hay lockfile. Chưa chạy build/lint/test rộng vì không thay code và không có vấn đề code mới cần kiểm; giữ kết quả đúng phạm vi.

Lệnh generate có thể chạm generated/cache artifacts bị gitignore; Git không báo source/dependency thay đổi. Không tự xóa node_modules/cache để dọn lỗi hoặc khẳng định không có artifact nội bộ nào chỉ từ git status.

## 9. Kết quả bàn giao, file và điều kiện PR3

1. Kế hoạch: chính file `docs/implementation/02-prisma-migration-plan.md`.
2. Model/field/constraint **thực sự thêm/sửa: không có**. Danh sách dự kiến và gate ở §4; không nhầm proposal với implementation.
3. Migration mới: **không tạo**, giai đoạn 2 bị chặn T01–T05; 0_init và toàn bộ SQL lịch sử được giữ nguyên.
4. Validation: kết quả thực tế §8, có validate offline/type-check pass nhưng generate fail, chưa có DB verification.
5. Dependency bước 1–3: §3 và PR1 §3.6; cần DB/mapping/roster/routing/phase/official assignment và consumer rollout, không sửa business logic để tự gỡ.
6. Lượt này chỉ thêm file 02. DOCX modified và file 00/01 untracked đã có trước, không ghi đè. Không stage/commit/push.
7. **Chưa đủ điều kiện chuyển PR3, không bắt đầu PR3.** Cần gỡ blockers, phê duyệt rollout tương thích, implement/schema+migration theo scope được phép, generate/typecheck và rehearsal data/invariants trên PostgreSQL test thành công trước đánh giá lại.

Các lệnh Git kiểm cuối lượt: `git status --short`, `git diff --stat`, `git status --short --untracked-files=all`. File kế hoạch mới untracked không có trong diff stat; dùng status chi tiết để kiểm phạm vi.
