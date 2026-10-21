# Repository audit — Project 1, bước 4–8

Ngày khảo sát: 21/10/2026 (Asia/Saigon). Phạm vi: đọc repository, đề xuất thiết kế; chưa triển khai nghiệp vụ. Mọi thay đổi dữ liệu và hợp đồng dưới đây là đề xuất để xác nhận, chưa phải quyết định chính thức.

## Current architecture

### Nguồn và giới hạn khảo sát

- Không có `docs/requirements/Project_1_06.docx`. Có tài liệu cùng tên ở `docs/spec/Project_1_06.docx`; đã đọc phần văn bản OOXML, bảng và đặc tả UC12–UC16 trực tiếp từ bản working tree đang sửa, không chỉ dựa vào tài liệu Markdown.
- DOCX có 2.059 đoạn XML và 47 ảnh nhúng. Chưa kiểm chứng trực quan nội dung các ảnh, sơ đồ và mẫu biểu trong ảnh; chưa xác nhận bố cục in, font, vị trí ký và kích thước mẫu PDF. Các mục phỏng vấn Khoa/GV còn để trống và có thời gian `???`, không thể coi là kết quả khảo sát đã xác nhận. Cần bản mẫu đề cương được Khoa duyệt trước khi nghiệm thu xuất PDF.
- Đối chiếu `docs/spec/dac-ta-use-case.md`, `docs/spec/diem-can-xac-nhan.md`, các ADR, `docs/api/openapi.yaml`, README, CLAUDE.md, schema, migration, seed, source, CI và test. Tên `diem-can-xac-nhan.md` hiện chứa công thức điểm, không phải danh mục vấn đề chưa rõ.
- Không tìm thấy AGENTS.md hoặc CODEOWNERS được liệt kê trong repository. CLAUDE.md mô tả quy ước thiết kế nhưng có chỗ khác implementation: decorator thực tế nhận hai đối số `@RequirePermission(resource, action)`; nhiều service gọi Prisma trực tiếp thay vì repository.
- Không truy cập DB đang chạy, không xác nhận migration đã áp dụng hay dữ liệu production; không suy diễn trạng thái DB từ Git.

### Kiến trúc đang có

| Tầng | Thực tế trong repository |
|---|---|
| Workspace | pnpm workspaces: `backend`, `frontend`, `shared`; root yêu cầu Node >=20, pnpm >=9; có pnpm-lock.yaml |
| Backend | NestJS 10 modular monolith: auth, catalog, term, registration, topic, guidance, defense, grading, report, notification; Prisma 5/PostgreSQL |
| Khởi động | `backend/src/main.ts`: prefix mặc định `/api`, CORS theo FRONTEND_URL, ValidationPipe whitelist/transform, Swagger ngoài production |
| Hạ tầng chung | PrismaService, CommonModule global chứa AuditService/FileStorageService; EventEmitterModule và ScheduleModule đã đăng ký, chưa có workflow/scheduler tương ứng bước 4–8 |
| Frontend | React 18, Vite 5, React Router 6 lazy routes, Tailwind; QueryClientProvider đã có ở App; chưa có nghiệp vụ ở các trang topic/guidance |
| Shared | `shared/src/index.ts`: ROLES, TERM_STATUS, LoginSchema, RegistrationPrefSchema; chưa có DTO/schema bước 4–8 |
| Tích hợp shared | Alias TypeScript/Vite trỏ source shared; backend/frontend chưa khai báo dependency workspace cho shared trong package.json; không coi shared là client API đã sinh |
| Hạ tầng chạy | Docker Compose: PostgreSQL 16, backend, frontend, MailHog, Nginx, volume uploads; chưa có adapter S3 thực thi |
| API docs | Swagger sinh từ controller; `docs/api/openapi.yaml` chỉ mô tả sơ bộ login, students, terms, registrations; chưa có contract đầy đủ hay generator client |

### Git và phạm vi người khác

- Nhánh khảo sát: `main`, HEAD `a91e096` (`Fix`). Lịch sử gần nhất tập trung sửa CI, không đủ chứng minh ai sở hữu từng module.
- Trước khảo sát chỉ có ` M docs/spec/Project_1_06.docx`, Git báo binary đổi 14.523.090 → 14.676.792 bytes. Đây là thay đổi có sẵn của người dùng/người khác, giữ nguyên; không checkout, stash, format hay commit.
- Không có bản đồ phân công thành viên đáng tin cậy. Không thể khẳng định file nào thuộc cá nhân nào chỉ từ tác giả commit. Các vùng cần phối hợp: auth/common/security; catalog/term/registration của bước 1–3; schema và cả hai cây migration; shared, router/layout, CI; defense/grading/report của bước 9–10.
- Audit này chỉ thêm chính file báo cáo. Khi triển khai, cần thống nhất người phụ trách các file giao nhau trước khi sửa; không tự refactor module khác theo kế hoạch dưới đây.

## Existing reusable modules

| Nghiệp vụ | Model/enum và code có thể dùng | Mức hoàn thiện / giới hạn |
|---|---|---|
| Đợt, kế hoạch | ThesisTerm, TermPhase, TermParameter, TermStudent, TermLecturer; TermStatus; TermLifecycleService, TermParameterService, TermTransitionValidator; ThesisTermController | GET `/api/terms`, `/api/terms/:id`; chưa có API ghi/khóa phase; validator chuyển trạng thái chưa được dùng cho thao tác ghi |
| Khoa, bộ môn | Department, Lecturer.departmentId; FACULTY trong roles | Không có Faculty model, quan hệ Faculty–Department hoặc phạm vi Khoa trên tài khoản; chưa có DepartmentController; phải xác nhận Department là bộ môn hay khoa |
| Giảng viên, sinh viên | Lecturer, Student, ResearchArea, LecturerArea, TrainingSystem; LecturerService, StudentService, StudentRepository | GET `/api/lecturers`, `/api/students`; import service chỉ trả số dòng, chưa nhập thực; không có API danh mục hướng/bộ môn hoàn chỉnh |
| Phân GVHD | Registration, RegistrationPref, AssignmentPlan, AdvisorAssignment; RegistrationStatus, AssignmentStatus; RegistrationService, AssignmentPlanService, assignment-algorithm | GET `/api/registrations/term/:termId`; executeAutoAssignment chỉ tính kết quả, không lưu/chốt/công bố, chưa expose controller; không coi bước 3 đã hoàn tất |
| Đề tài/đề cương | Topic, TopicHistory, Proposal, ProposalVersion, ReviewGroup, ReviewGroupMember, ProposalReview, ThesisDossier; ProposalStatus | TopicController/TopicService chỉ GET `/api/topics/term/:termId`; chưa có controller/service duyệt, phiên bản, chốt hồ sơ |
| Tiến độ | GuidancePlan, Task, TaskSubmission, SubmissionFile, TaskReview, GuidanceMeeting, PhaseEvaluation; TaskStatus | TaskController/TaskService chỉ GET `/api/tasks/plan/:planId`; chưa có API giao việc/nộp bài/nhận xét/họp |
| Tài liệu, PDF | FileStorageService.save/delete; ProposalVersion.filePath, ThesisDossier.filePath, SubmissionFile; PdfUtil | Lưu local UUID và giới hạn size; PdfUtil chỉ trả HTML header, chưa render PDF/template đề cương; không có Document module dùng chung |
| Thông báo | Notification, NotificationStatus, NotificationService/Controller | GET `/api/notifications/user/:userId`, tối đa 20; chưa có tạo/read-state/email listener/retry; endpoint chưa đối chiếu userId với người đăng nhập |
| Lịch | TermPhase, GuidanceMeeting; DefenseSession cho bước 9 | Không có lịch xét duyệt nhóm; không lấy lịch bảo vệ thay cho lịch duyệt đề cương |
| Hợp đồng chung | ApiResponse, PageResponse, BusinessException, ErrorCode, CurrentUser, RequirePermission, AuditService | Có thể dùng lại sau khi thống nhất shape lỗi và identity; AuditService chưa nhận transaction client |
| UI chung | Button, httpClient, getErrorMessage, useAuth, layout, QueryClientProvider | httpClient gắn Bearer và chuyển login khi 401; upload phải xử lý multipart thay Content-Type JSON mặc định |

DTO nghiệp vụ bước 4–8 chưa tồn tại. Body auth hiện dùng inline TypeScript type, không đủ runtime validation bằng ValidationPipe. Shared RegistrationPrefSchema chỉ min(1), không max(3), chưa bảo đảm không trùng GV; không được coi schema này là đặc tả đầy đủ bước 2.

Test có thể tái sử dụng về cấu trúc: `backend/src/registration/engine/assignment-algorithm.spec.ts` (2 test GPA/quota), `backend/src/grading/service/score-aggregator.service.spec.ts` (3 test tổng hợp điểm), `frontend/src/shared/api/error-message.spec.ts` (3 test lỗi). Chưa có test auth/scope, integration PostgreSQL, upload, workflow hoặc component/e2e bước 4–8. Supertest/Testcontainers được nêu trong hướng dẫn nhưng chưa có dependency tương ứng trong package.json.

## Gap analysis bước 4–8

Phân biệt **bước nghiệp vụ 4–8** với UC04–UC08: phạm vi chính ở đây là UC13, vòng sửa UC12, UC14–UC16 và xuất biểu mẫu UC25; không triển khai bảo vệ/chấm điểm bước 9–10.

| Bước | Căn cứ DOCX | Khoảng trống cần triển khai |
|---|---|---|
| 4 — tạo nhóm duyệt | Quy trình bước 4; UC13: Khoa tạo nhóm theo bộ môn và thiết lập lịch duyệt | CRUD nhóm, thành viên hợp lệ trong đợt, liên kết bộ môn, lịch duyệt, quyền quản lý; ReviewGroup hiện chỉ có termId/name |
| 5 — phân và duyệt | UC13: phân theo hướng/bộ môn, chuyển đang duyệt, Đạt/Yêu cầu sửa; yêu cầu sửa bắt buộc nhận xét; quá hạn cảnh báo/phân lại | Mapping hướng–bộ môn chưa có; thiếu phân công, lịch họp/biên bản, quyền người quyết định, vòng duyệt gắn phiên bản, API và UI; không tự chọn thuật toán hay cơ chế biểu quyết |
| 6 — chỉnh sửa | UC12: SV/GVHD sửa, lưu phiên bản, nộp lại; sửa trong lúc chờ duyệt quay về nháp và phải nộp lại | Schema nội dung, draft/version API, lịch sử tác giả, xử lý quyết định trên phiên bản cũ, xác nhận thống nhất giữa SV/GVHD |
| 7 — chốt và nộp | UC13: Khoa chốt khi đạt/đủ trường, xuất in ký; chỉ Khoa có quyền mở lại và audit | Trạng thái chốt khác duyệt; dossier phải trỏ phiên bản chốt, PDF đúng mẫu, phân biệt đã in/đã nộp giấy/đã tiếp nhận; chưa có logic tương ứng |
| 8 — báo cáo tuần | UC14–16: kế hoạch theo đề cương chốt, nhiệm vụ/deadline, báo cáo và source, nhận xét Đạt/Không đạt/Cần sửa, lưu vết | Thiếu lịch tuần/mốc, yêu cầu sản phẩm, loại file, phiên bản bài nộp, đánh giá 3 mức, lịch sử sửa nhận xét, thông báo, bộ lọc chậm tiến độ và UI |

DOCX UC15 đã nêu: quá hạn vẫn được ghi nhận và thông báo, phase bị khóa thì không được nộp; không tự đặt quy tắc cấm mọi bài nộp muộn. UC14 ghi deadline ngoài giai đoạn là “cảnh báo/chặn”, cần chọn rõ hành vi. UC16 cấm xác nhận hoàn thành khi chưa có bài nộp, yêu cầu lưu lịch sử khi sửa nhận xét.

## Data model impact

### Quan hệ hiện tại và hợp đồng với bước 1–3

```text
UserAccount -> Student / Lecturer -> Department
ThesisTerm -> TermStudent -> Student
ThesisTerm -> TermLecturer -> Lecturer
ThesisTerm -> Registration -> AdvisorAssignment -> AssignmentPlan
                          -> Student             -> Lecturer (advisor)
ThesisTerm -> Topic -> Proposal -> ProposalVersion
                              -> ProposalReview -> ReviewGroup -> ReviewGroupMember
                              -> ThesisDossier
GuidancePlan -> Task -> TaskSubmission -> SubmissionFile / TaskReview
             -> GuidanceMeeting / PhaseEvaluation
```

Mũi tên trên mô tả quan hệ Prisma đã khai báo; **GuidancePlan.proposalId/advisorId chưa có relation Prisma**, không được suy diễn FK từ tên cột. AssignmentPlan.termId, RegistrationPref.lecturerId, ReviewGroup.termId và ReviewGroupMember.lecturerId cũng thiếu relation ở schema dù SQL có REFERENCES.

Đầu vào tối thiểu cần thống nhất với chủ bước 1–3:

| Đầu vào | Hợp đồng cần có | Hiện trạng |
|---|---|---|
| Identity | sub/UserAccount.id → Student.id hoặc Lecturer.id; roles và permissions, không nhận tác giả từ body | JWT dùng sub; CurrentUserPayload lại khai báo userId; chưa có `/auth/me` |
| Phạm vi đợt | termId, termStudentId, termLecturer và quota; trạng thái/phase/lock/timezone | Có model, GET một phần; chưa có API roster và phase đầy đủ |
| GVHD chính thức | registrationId, advisorAssignmentId, advisorId, assignmentPlanId và trạng thái chốt/công bố | Có relation; thiếu write/publish/finalize API, thiếu đảm bảo plan cùng term với registration |
| Hồ sơ đầu vào | topicId, proposalId, chủ sở hữu theo đợt, nội dung đã thống nhất và phiên bản đã nộp | Bước 3 nêu trong tài liệu nhưng chưa có write API và trạng thái thống nhất đề tài |
| Routing duyệt | bộ môn của hồ sơ và mapping hướng–bộ môn, danh sách GV hợp lệ | Lecturer có departmentId; ResearchArea chưa liên kết Department |

Không tạo hồ sơ/nhóm duyệt từ kết quả thuật toán chưa lưu hoặc chưa được chốt. Cần thống nhất `PUBLISHED` hay `FINALIZED` là mốc cho phép các hành động tiếp theo. Khi GVHD đổi, phải có chính sách chuyển quyền và bảo toàn tác giả lịch sử.

### Các điểm cần thiết kế sau xác nhận

1. **Hồ sơ theo đợt:** Proposal.studentId hiện `@unique` toàn hệ thống, Student.proposal là 1–1, Topic không có termStudentId. Không đáp ứng mô tả DOCX phần DB rằng Topic sở hữu bởi TermStudent. Đề xuất chọn một khóa hồ sơ theo TermStudent/registration, bảo đảm một hồ sơ cho một SV trong một đợt; chưa tự chuyển khóa hoặc bỏ unique. Cũng phải chốt cardinality Topic–Proposal: hiện một Topic có nhiều Proposal, chưa bảo đảm đề tài cá nhân.
2. **Nhóm duyệt:** bổ sung departmentId và quan hệ term/member còn thiếu; lịch duyệt có thể là thực thể riêng nếu một nhóm có nhiều phiên. Chỉ thêm vai trò trưởng nhóm, quorum, nhiều nhóm/bộ môn khi nghiệp vụ được xác nhận.
3. **Vòng duyệt:** ProposalReview hiện chỉ trỏ Proposal, decision string và một comment; thiếu proposalVersionId, round, người quyết định, phân công và dấu vết thay đổi. Đề xuất quyết định gắn đúng phiên bản bất biến; phân biệt nhận xét từng người và quyết định tập thể nếu Khoa yêu cầu.
4. **Nội dung đề cương:** ProposalVersion.content JSON chưa có schema; cần các trường DOCX nêu: mục tiêu, phạm vi, nội dung, công cụ, thời gian, kế hoạch giai đoạn/tuần. Thêm tác giả, thời điểm nộp, revision token theo thiết kế được duyệt. Không coi updatedAt của Proposal là lịch sử đầy đủ.
5. **Chốt hồ sơ:** ThesisDossier.status là string DRAFT/SUBMITTED/APPROVED, chưa biểu đạt rõ “Đã chốt”; chưa tham chiếu version chốt, người chốt/mở lại, lý do, templateVersion, receipt. Proposal APPROVED không đồng nghĩa bản giấy đã nộp. Chọn enum và luồng tiếp nhận sau xác nhận.
6. **Tiến độ:** Task chưa có tuần/mốc rõ ràng hoặc yêu cầu file; TaskSubmission thiếu tác giả/version/late flag; SubmissionFile thiếu loại REPORT/SOURCE/EVIDENCE. TaskReview.isPassed boolean không thể biểu diễn đủ Đạt/Không đạt/Cần sửa; cần decision enum riêng sau khi duyệt contract. TaskStatus hiện TODO/IN_PROGRESS/SUBMITTED/REVIEWED/OVERDUE, chưa biểu đạt yêu cầu sửa/hoàn thành. Không dùng OVERDUE thay cho toàn bộ trạng thái nghiệp vụ nếu mất thông tin đã nộp/đã review.
7. **Lịch sử và sự kiện:** TopicHistory chỉ lưu đổi đề tài, không thay thế lịch sử sửa đề cương/nhận xét/nhóm duyệt. Đề xuất audit trong cùng transaction, lịch sử bất biến, sự kiện gửi sau commit; outbox nếu cần bảo đảm gửi/retry không mất hoặc trùng.

### Migration

- Có hai cây: `database/migrations/V001__auth.sql`…`V009__export.sql` và `backend/prisma/migrations/0_init/migration.sql`. CI backend dùng cây Prisma; Makefile `migrate` thực tế chạy `prisma db push`, khác `migrate-deploy`. Không chạy cả hai cây trên cùng DB.
- `0_init` dùng VARCHAR cho status, TIMESTAMP WITH TIME ZONE, ID VARCHAR(36) với uuid-ossp; schema dùng Prisma enum, DateTime không có annotation timestamptz, String với UUID do Prisma default. Khác cả kiểu/nullability/default và onDelete; ví dụ TOPIC.term_id SQL CASCADE, schema không ghi Cascade. Migration deploy thành công chưa chứng minh Prisma Client tương thích với DB.
- SQL có FK mà schema không biểu diễn như ReviewGroup.termId/member lecturerId, GuidancePlan.proposalId/advisorId. Ngược lại phải so diff đầy đủ trước khi sinh migration; không sửa `0_init` hoặc SQL đã chạy.
- Trước PR dữ liệu: chọn nguồn migration duy nhất, kiểm tra schema thực trên bản sao DB, orphan/duplicate/cross-term, map Proposal → term qua Topic/Registration/TermStudent; không backfill bằng suy đoán nếu mapping không duy nhất. Kiểm tra seed dùng ID như `term-utc-k62`, `perm-01`, không áp đặt uuid-validator lên toàn bộ ID hiện hữu mà không kế hoạch tương thích.
- Ưu tiên expand → backfill có kiểm chứng → chuyển ứng dụng → siết constraint. FK/unique mới có thể thất bại hoặc khóa bảng; đổi enum/timestamp có thể cần chuyển dữ liệu và chọn timezone chính thức. Backup, diễn tập nâng cấp và phục hồi trên dữ liệu đại diện là điều kiện merge PR migration, không thực hiện trong audit.

## API contract proposal

Tất cả endpoint mới dưới `/api`; đây là proposal, **không phải API đã có**. Giữ GET hiện tại để không phá bước 1–3; cập nhật OpenAPI và consumer cùng PR khi contract được duyệt. Trả JSON `ApiResponse<T>`, danh sách `ApiResponse<PageResponse<T>>`; file tải về dùng response binary riêng.

| API đề xuất | DTO chính | Mục đích / điều kiện |
|---|---|---|
| GET `/auth/me` | CurrentUserResponse | identity chuẩn sub/id, hồ sơ, permissions và scope được phép; phối hợp auth |
| GET/POST `/terms/:termId/review-groups` | ReviewGroupQuery/CreateReviewGroupRequest | danh sách/tạo nhóm: name, departmentId, lecturerIds; validate đợt/bộ môn/GV |
| PATCH `/review-groups/:id` | UpdateReviewGroupRequest | sửa nhóm với expectedRevision, kiểm tra hồ sơ đang duyệt |
| POST `/review-groups/:id/sessions` | CreateReviewSessionRequest | lịch duyệt: start/end, địa điểm/hình thức; trường cụ thể chờ chốt |
| GET `/terms/:termId/proposals` | ProposalQuery | hàng đợi, lọc status/group/department và phân trang theo scope |
| POST `/proposals/:id/review-assignments` | AssignProposalReviewRequest | groupId, proposalVersionId, expectedRevision; chưa tự gán theo hướng khi mapping chưa rõ |
| GET `/proposals/:id` và `/proposals/:id/versions` | ProposalDetail/VersionResponse | nội dung và lịch sử trong phạm vi được phép |
| POST `/proposals/:id/versions` | CreateProposalVersionRequest | content đã validate, expectedRevision; tác giả lấy từ identity |
| POST `/proposals/:id/submit` | SubmitProposalRequest | versionId, expectedRevision; kiểm phase, nội dung, quan hệ GVHD chính thức |
| POST `/proposal-reviews/:id/decisions` | ReviewDecisionRequest | versionId, decision, comment, expectedRevision; bắt buộc comment khi yêu cầu sửa, không nhận reviewerId từ client |
| POST `/proposals/:id/finalize` và `/proposals/:id/reopen` | FinalizeProposalRequest/ReopenProposalRequest | Khoa chốt version đủ điều kiện; mở lại bắt buộc reason và audit |
| GET `/proposals/:id/dossier.pdf` | query version được phép xuất | PDF snapshot, không dùng bản nháp mới nhất thay phiên bản chốt |
| POST `/proposals/:id/dossier/receipt` | RecordDossierReceiptRequest | chỉ triển khai nếu xác nhận cần ghi nhận nộp giấy/scan |
| GET/POST `/proposals/:id/guidance-plan` | GuidancePlanResponse/CreateGuidancePlanRequest | lấy/tạo kế hoạch từ đề cương chốt |
| POST `/guidance-plans/:id/tasks`; PATCH `/tasks/:id` | CreateTaskRequest/UpdateTaskRequest | title, description, deadline, yêu cầu sản phẩm/mốc; GVHD hiện hành |
| POST `/tasks/:id/submissions` | multipart report/source/evidence và content | SV nộp phiên bản; server xác định submitter/thời gian/late và loại file |
| GET `/tasks/:id/submissions` | SubmissionResponse[] | lịch sử nộp kèm metadata, không lộ đường dẫn hệ thống |
| POST `/submissions/:id/reviews` | CreateTaskReviewRequest | decision 3 mức, comment; chỉ GVHD đúng hồ sơ |
| GET `/files/:id/download` | binary | kiểm scope lại mỗi lần tải, attachment, tên hiển thị an toàn |
| GET/POST `/guidance-plans/:id/meetings` | MeetingQuery/CreateMeetingRequest | nhật ký hướng dẫn; chỉnh sửa phải có history |
| GET `/me/notifications` | NotificationQuery | thay nhu cầu truyền userId tùy ý; quyền mark-read cần contract riêng |

DTO response tối thiểu: ID hồ sơ và term, trạng thái, revision, versionId/versionNumber, actor/time, metadata file, allowedActions để UI hiển thị. Server vẫn kiểm quyền đầy đủ. Các DTO mới cần class/runtime schema hoặc Zod pipe thật sự; TypeScript interface không làm runtime validation. Không trả raw Prisma include có dữ liệu cá nhân ngoài nhu cầu.

Mã lỗi đề xuất: 400 dữ liệu/file không hợp lệ; 401 chưa xác thực; 403 thiếu quyền; 404 tài nguyên không thấy trong scope; 409 revision/trạng thái/phân công xung đột; 413 dung lượng; các business code cụ thể bổ sung sau thống nhất. GlobalExceptionHandler có file nhưng chưa đăng ký trong main/CommonModule/AppModule; phải thống nhất lỗi thực tế trước khi dùng contract chung. Auth login hiện trả object trực tiếp, khác wrapper các GET; không đổi ngầm consumer hiện có.

Concurrency: revision compare-and-swap, transaction cập nhật trạng thái + audit, unique version trong một proposal, idempotency cho submit/finalize/upload retry; trả 409 khi quyết định dựa trên phiên bản cũ. Khóa phase và nộp bài đồng thời cần quy định rõ điểm kiểm tra trong transaction. Không dùng `max(version)+1` không khóa; file system và DB không có chung transaction, cần staging/cleanup khi một phía thất bại.

## Frontend integration

- Tái sử dụng các route đang đăng ký trong `frontend/src/app/router/routes.tsx`: `/topic/my`, `/topic/proposal`, `/topic/reviews`, `/topic/reviews/:id`, `/topic/dossier`; `/guidance/plan`, `/guidance/tasks`, `/guidance/review`, `/guidance/meetings`. Tất cả trang topic/guidance hiện chỉ placeholder, chưa có form/hook dữ liệu. `/guidance/defense-confirm` và `/guidance/final-report` là điểm nối bước 9, chưa mở rộng phạm vi audit thành triển khai chúng.
- Bổ sung màn quản lý nhóm/lịch duyệt và hàng đợi theo đợt; lựa chọn termId/proposalId phải thể hiện trong URL hoặc context xác định, tránh lấy ngầm “đợt mới nhất”. Các route proposal/plan hiện không mang ID, cần chốt cơ chế điều hướng hỗ trợ nhiều đợt.
- Tổ chức `features/topic/api`, `hooks`, `components`, `schemas`; tương tự guidance. API client tách khỏi page, React Query key gồm termId/proposalId/version; invalidate đúng phạm vi sau mutation. Có loading, empty, error, 403/409, dirty-form và upload progress/retry.
- `useAuth` hiện TODO `/auth/me` và không hydrate user từ token; AdminLayout/router chưa có bảo vệ route hay menu theo quyền. Cần phối hợp auth để lấy user/permissions/scope; ẩn nút chỉ là UX, không thay server authorization.
- Tái dùng Button/httpClient/getErrorMessage, nhưng chưa có hệ component bảng/form/dialog/upload hoàn chỉnh để coi là sẵn dùng. React Hook Form/Zod đã có dependency, chưa có schema bước 4–8. PDF tải dạng blob và upload multipart cần cấu hình request riêng.
- UI duyệt hiển thị phiên bản được phân, góp ý, quyết định và lịch sử; UI SV/GVHD hiển thị diff phiên bản nếu cần, lý do trả sửa; dossier phân biệt đã duyệt/đã chốt/đã tiếp nhận. Bảng tiến độ tách trạng thái nhiệm vụ, kết quả đánh giá, đúng/trễ hạn.

## Authorization matrix

### Hiện trạng đã kiểm chứng

JwtAuthGuard và PermissionsGuard đăng ký global. Endpoint không gắn RequirePermission được cho qua RBAC sau đăng nhập. Students và terms có quyền read; registrations/topics/tasks/lecturers/notifications chưa có decorator tương ứng và service chưa lọc scope theo caller. Người đăng nhập có thể yêu cầu termId/planId/userId khác; đây là khoảng trống kiểm quyền dữ liệu cần khắc phục trước mở nghiệp vụ.

JWT ký sub/username/roles; guard chỉ verify token, chưa tra trạng thái account/session nên khóa tài khoản sau đăng nhập không tự thu hồi access token. Refresh chưa thực thi, logout chưa revoke. ThrottlerModule đã cấu hình nhưng chưa thấy ThrottlerGuard global. Seed S001 có 5 role và 23 permission, chỉ gán toàn quyền cho ADMIN; chưa có mapping quyền cho FACULTY/LECTURER/STUDENT/COMMITTEE. Không được mặc định ADMIN bypass scope hoặc mọi LECTURER đều có quyền duyệt.

### Ma trận đề xuất cần xác nhận

| Hành động | Khoa/Giáo vụ | Thành viên nhóm duyệt | GVHD | SV | Admin / Hội đồng bảo vệ |
|---|---|---|---|---|---|
| Quản lý nhóm/lịch/phân duyệt | Theo đợt/bộ môn được giao | Xem nhóm mình | Chỉ khi đồng thời được giao vai trò phù hợp | Không | Không cấp tự động |
| Xem đề cương/file | Trong scope quản lý | Chỉ hồ sơ phân nhóm mình | Chỉ SV mình đang hướng dẫn | Chỉ hồ sơ mình trong đợt | Theo quyền riêng nếu được duyệt |
| Sửa/nộp lại đề cương | Mở lại theo quyền, không tự sửa thay tác giả | Nhận xét, không sửa nội dung SV | Đồng biên tập theo UC12 | Sửa/nộp trong giai đoạn cho phép | Không cấp tự động |
| Ra quyết định duyệt | Điều phối; quyền quyết định cần chốt | Theo cơ chế quyết định nhóm cần xác nhận | Không mặc nhiên được duyệt SV mình | Không | COMMITTEE bảo vệ không đồng nghĩa nhóm duyệt |
| Chốt/mở hồ sơ | Có quyền tương ứng, ghi audit | Không tự chốt thay Khoa | Xem | Xem/xuất theo trạng thái | Theo ủy quyền được xác nhận |
| Tạo nhiệm vụ/nhận xét | Theo dõi, can thiệp cần quy định | Không | Chỉ SV được phân công | Không | Không cấp tự động |
| Nộp báo cáo/source | Theo dõi | Không mặc định | Xem/tải bài SV mình | Chỉ nhiệm vụ của mình | Không cấp tự động |
| Xem nhật ký/thông báo | Theo quyền và scope | Thông tin liên quan | Thông tin liên quan | Thông tin liên quan | Không đọc thông báo người khác chỉ vì biết ID |

Permission mới đề xuất tách review-group manage, review assign, proposal edit/submit/review/finalize/reopen/export, guidance manage, submission create/read, task review, file download. Kiểm quyền kết hợp RBAC + quan hệ hồ sơ + term scope + phase/state; không cấp role mới chỉ để biểu diễn membership nhóm. Phải thống nhất scope Khoa do schema hiện chưa mô hình hóa.

## Risks and assumptions

### Rủi ro ưu tiên

| Mức | Rủi ro | Biện pháp/điều kiện trước triển khai |
|---|---|---|
| Cao | Schema/migration lệch; hai nguồn SQL; db push bỏ qua lịch sử | Chọn nguồn chuẩn, diff DB thật trên bản sao, migration forward có dữ liệu đại diện; không reset DB chính thức |
| Cao | Proposal unique toàn đời SV, thiếu ownership theo đợt | Chốt mô hình cá nhân/theo đợt và mapping backfill trước API ghi |
| Cao | RBAC thiếu và không có object scope; lộ báo cáo/source/PII | Policy server ở mọi read/write/download; test khác SV, khác nhóm, khác đợt, GVHD cũ |
| Cao | Decision không gắn version, nhiều người sửa/duyệt/chốt cùng lúc | Version bất biến, revision và transaction; audit gắn cùng thay đổi |
| Cao | Upload chưa có allowlist/content validation/quyền tải | FileStorage chỉ kiểm file.size sau khi đã nhận buffer; cần limit ở interceptor/proxy, kiểm MIME/chữ ký, tên/path an toàn, không tin subfolder/client path |
| Cao | Source archive lớn, tệp nguy hiểm, lưu local không đồng bộ DB | Chốt định dạng/dung lượng; không thực thi/giải nén mã nguồn; staging, cleanup orphan, retention/backup và quota; cân nhắc kiểm tra malware theo vận hành |
| Trung bình | Chốt khác duyệt và nộp giấy; PDF thay đổi theo bản mới | Snapshot version/template, audit mở lại; xác nhận mẫu và quy trình tiếp nhận |
| Trung bình | Phase tự do phaseName, ngày/giờ SQL khác Prisma | Chuẩn hóa phase key, timezone, biên đóng/mở; test ngay tại deadline/lock |
| Trung bình | Notification/email chưa có producer/retry | Tách sự kiện sau commit, idempotency; không để lỗi mail làm mất nghiệp vụ đã lưu |
| Trung bình | UI placeholder, auth hook chưa hydrate, contract lỗi chưa thống nhất | PR auth integration và contract trước UI, test 401/403/409 |

### Nghiệp vụ cần xác nhận — không tự quyết định

1. **Nguồn ưu tiên:** dùng DOCX working tree đang sửa hay bản đã duyệt? ADR cá nhân ghi “đã quyết định” và DOCX phần DB nói cá nhân, nhưng bước 2/UC11 và Markdown vẫn nói nhóm tối đa 2 SV. Đề xuất bám ADR cá nhân để thảo luận, chưa thực hiện chuyển dữ liệu; cần xác nhận phạm vi chính thức.
2. **Một SV nhiều đợt:** có làm lại/chuyển đợt không, hồ sơ cũ có được dùng lại, mỗi SV một đề tài trong từng đợt hay toàn khóa? Một Topic có thể được nhiều SV chọn không?
3. **Khoa/bộ môn:** Department đại diện cấp nào; một hay nhiều Khoa; Khoa quản lý đợt theo hệ ra sao; phân nhóm theo bộ môn của GVHD, hướng nghiên cứu hay thuộc tính đề tài? Mapping hướng–bộ môn ai quản lý?
4. **Nhóm duyệt:** số thành viên, trưởng nhóm/người được kết luận, có biểu quyết/quorum hay một người quyết định; GVHD được tham gia duyệt hồ sơ mình không; một GV thuộc nhiều nhóm, một hồ sơ qua nhiều nhóm được không?
5. **Lịch duyệt:** ngày/buổi hay slot từng hồ sơ; cần phòng, biên bản, hình thức trực tuyến, kiểm trùng lịch không; quá hạn cảnh báo sau bao lâu, ai được phân lại?
6. **Trạng thái duyệt:** DOCX nêu Đạt/Yêu cầu sửa, enum còn có REJECTED; có từ chối vĩnh viễn không? Trạng thái “Đã sửa–chờ duyệt” có tách enum hay chỉ thông tin vòng? Ai được rút nộp/chuyển nháp và tác động quyết định cũ?
7. **Cộng tác sửa:** GVHD được sửa trực tiếp theo UC12, ai có quyền nộp cuối; cần xác nhận đồng thuận của GVHD như thế nào; có autosave và mỗi lần autosave có phải version nghiệp vụ không?
8. **Chốt/biểu mẫu:** PDF chính thức chỉ sau chốt như UC12/13, bản xem trước ở bước 3 có cần watermark? Mẫu nào chuẩn, 4 chữ ký theo phần biểu mẫu hay chỉ GVHD theo bước 7; chữ ký giấy hay điện tử; ai ghi nhận nộp giấy/scan, có hạn nộp và cho nộp lại không?
9. **Mở lại:** lý do, thẩm quyền, có phải duyệt lại và vô hiệu PDF cũ không; thay GVHD/nhóm/thành viên sau chốt xử lý hồ sơ lịch sử thế nào?
10. **Tuần và deadline:** tuần tính theo ngày đầu đợt hay lịch cố định; mỗi tuần một báo cáo hay theo từng nhiệm vụ; một bài gộp nhiều task không; deadline ngoài phase chặn hay cảnh báo; timezone và thời điểm đóng khóa chính thức?
11. **Bài nộp:** source là ZIP hay định dạng khác, bắt buộc file hay cho repository URL; giới hạn từng tệp/tổng dung lượng/số tệp/loại file; nộp lại bao nhiêu lần; retention và quyền tải mã nguồn sau kết thúc đợt?
12. **Đánh giá:** Đạt/Không đạt/Cần sửa ánh xạ trạng thái nào; trường hợp nào bắt buộc nhận xét, ai được sửa đánh giá, có chốt đánh giá không; chậm tiến độ kéo dài bao nhiêu tuần thì cảnh báo; có hệ quả chính thức với điều kiện bảo vệ không? Không tự tính điểm/quyết định cấm bảo vệ từ báo cáo tuần.
13. **Thông báo và phạm vi:** sự kiện nào gửi trong app/email, người nhận và retry; cần xem tiến độ toàn Khoa hay toàn đợt; Admin có quyền đọc nội dung học thuật hay chỉ vận hành? Membership nhóm duyệt có độc lập role COMMITTEE bảo vệ không?
14. **Tích hợp bước 3:** PUBLISHED hay FINALIZED là nguồn GVHD chính thức; quyền xem kết quả, thay GVHD và sự kiện bàn giao do module nào sở hữu? Không coi output thuật toán hiện tại là kết quả chính thức.

## Ordered implementation plan

Các PR dưới đây được review/merge riêng, theo thứ tự phụ thuộc; mỗi PR có phạm vi cụ thể, contract và kiểm thử đi cùng chức năng. Chỉ bắt đầu sau khi người dùng xác nhận audit và các quyết định liên quan. Không bắt buộc đợi toàn bộ bước 1–3 hoàn thiện để viết unit test, nhưng luồng tích hợp không được thay bằng dữ liệu chính thức giả.

| PR | Phạm vi và sản phẩm | Phụ thuộc / tiêu chí kiểm chứng |
|---|---|---|
| 1 — Quyết định nghiệp vụ và contract | Chốt các câu hỏi ảnh hưởng dữ liệu, nguồn tài liệu, identity/scope, trạng thái, ownership, template; cập nhật ADR/OpenAPI/shared proposal | Chủ bước 1–3 xác nhận contract đầu vào; không migration trước khi chốt |
| 2 — Nền dữ liệu tương thích | Thống nhất pipeline migration, diff/schema drift, model theo đợt, FK/index/version/history cần thiết, backfill có kiểm chứng | PR1; test DB mới và nâng cấp từ baseline có dữ liệu; kiểm orphan/duplicate/cross-term; không sửa migration cũ |
| 3 — Auth/scope và hạ tầng tài liệu | Chuẩn hóa CurrentUser + `/auth/me`, quyền được cấp rõ ràng, policies, download/upload limits, metadata, cleanup và audit transaction | PR1–2; phối hợp chủ auth/catalog; test bypass ID, file unauthorized, lỗi DB/storage; chưa thêm luật duyệt |
| 4 — Bước 4: nhóm/lịch duyệt | ReviewGroup/ReviewSession repository/service/validator/DTO/controller, quản lý nhóm/thành viên và UI theo đợt | PR2–3; test GV/nhóm khác đợt, lịch/nhóm không hợp lệ theo quy tắc được chốt |
| 5 — Bước 5: phân công và quyết định | Phân version vào nhóm, hàng đợi, quyền thành viên, quyết định, góp ý, thông báo và UI | PR4 + contract hồ sơ nộp từ UC12; test quyết định trên bản cũ, đồng thời, trả sửa thiếu comment |
| 6 — Bước 6: vòng sửa/nộp lại | Editor, version history, quyền SV/GVHD, submit/resubmit, transaction/revision; tích hợp giao diện duyệt | PR5; test phiên bản bất biến, phase khóa, sửa lúc chờ duyệt và nộp lại; phối hợp phần đề cương bước 3 |
| 7 — Bước 7: chốt/xuất/nộp | Dossier snapshot, finalize/reopen/audit, PDF mẫu, ghi nhận tiếp nhận nếu được duyệt; UI dossier | PR6; test không chốt khi thiếu/không đạt, PDF đúng version/font/mẫu, quyền mở lại |
| 8 — Bước 8a: giao việc và nộp tuần | GuidancePlan/Task theo hồ sơ chốt, deadline/mốc, bài nộp version/file, UI kế hoạch và task board | PR7; test phase/deadline, báo cáo+source bắt buộc, retry và cleanup upload, không ghi đè bài cũ |
| 9 — Bước 8b: nhận xét và theo dõi | Đánh giá 3 mức, lịch sử sửa, họp/giai đoạn theo scope đã chốt, giao việc tiếp theo, cảnh báo/thông báo, UI review | PR8; test không hoàn thành khi chưa nộp, history, scope GVHD, cảnh báo không trùng; không triển khai xét bảo vệ |
| 10 — Tích hợp và nghiệm thu | Luồng bước 3→4→…→8 trên PostgreSQL, e2e theo vai trò, tài liệu vận hành/khôi phục/file retention, mở rộng CI đúng nhu cầu | PR4–9; kiểm tương thích bước 1–3 và read contract bước 9, không tự đổi công thức điểm |

Cấu trúc backend đề xuất mở rộng module hiện có, không tạo hệ song song: `topic/{controller,dto/request,dto/response,repository,service,validator,event}` cho review-group/proposal/review/dossier; `guidance/...` cho plan/task/submission/review/meeting; common storage/security/audit chỉ chứa kỹ thuật dùng chung. Theo CLAUDE.md, mỗi BR/AC được triển khai cần validator và ít nhất ca đúng/ca vi phạm; thêm integration cho transaction/quyền/concurrency thay vì chỉ mock theo implementation.

## Verification commands

### Lệnh đã xác minh tồn tại trong package.json

Chạy từ root, dùng filter để không hiểu nhầm shared đã có test/lint/type-check script:

```powershell
pnpm --filter @doan/backend type-check
pnpm --filter @doan/frontend type-check
pnpm --filter @doan/backend lint
pnpm --filter @doan/frontend lint
pnpm --filter @doan/backend test
pnpm --filter @doan/frontend test
pnpm --filter @doan/backend test:cov
pnpm --filter @doan/shared build
pnpm --filter @doan/backend build
pnpm --filter @doan/frontend build
```

Root cũng có `pnpm type-check`, `pnpm lint`, `pnpm test`, `pnpm build` gọi `pnpm -r ...`; shared chỉ có build/dev nên không có bằng chứng shared được lint/test/type-check bởi các script tương ứng. Có thể kiểm shared không emit bằng `pnpm --filter @doan/shared exec tsc --noEmit` (lệnh CLI, không phải script riêng).

Backend còn có test:watch, test:cov; frontend có test:watch và `test:e2e` chạy Playwright, nhưng chưa tìm thấy test e2e/config Playwright, nên không coi e2e là bộ kiểm tra đã hoạt động. Không có script `test:integration` hoặc `typecheck` (tên đúng là `type-check`).

### CI đang chạy

- Backend GitHub Actions (push/PR main/develop theo paths backend/shared/root manifest): install frozen lockfile → Prisma generate → type-check → lint → migrate deploy trên PostgreSQL test → test:cov → upload coverage. Job tên “Build & Test” nhưng chưa có bước `pnpm build`.
- Frontend: install → type-check → lint → build → test; chưa e2e. Cả hai dùng Node 20/pnpm 9, trong khi CLI local khảo sát báo pnpm 12.14.0. Cần dùng cùng phiên bản khi tái hiện CI, không tự đổi lockfile trong audit.
- Chưa có test DB integration thực tế dù CI cung cấp PostgreSQL. Có script `infra/ci/test.sh` gọi test hai package, không thay thế các bước CI còn lại.

### Lệnh Prisma có thật, chỉ đề xuất cho lần triển khai

```powershell
pnpm --filter @doan/backend prisma validate
pnpm --filter @doan/backend prisma generate
pnpm --filter @doan/backend prisma migrate status
pnpm --filter @doan/backend prisma migrate deploy
```

`validate` cần DATABASE_URL hợp lệ về cấu hình; `status/deploy` cần kết nối DB. `generate` ghi generated client; `deploy` thay DB, chỉ dùng DB test hoặc môi trường đã được phê duyệt. Không chạy db push/reset/migrate dev hoặc seed trên dữ liệu chính thức để “sửa nhanh” drift. Makefile có seed nhưng backend/package.json không khai báo Prisma seed; seed thực là SQL ở database/seeds, nên `make seed` chưa phải quy trình seed đã được nối đầy đủ.

Trong audit chỉ kiểm tra script/cấu hình và phiên bản pnpm, **chưa chạy type-check/lint/test/build**, không tuyên bố các lệnh đã pass. Không chạy build/coverage/generate vì sẽ sinh thêm artifact ngoài file báo cáo được yêu cầu. Lần triển khai cần ghi kết quả thực chạy, phiên bản công cụ và giới hạn môi trường.

Kiểm tra phạm vi file trước/sau báo cáo:

```powershell
git status --short
git diff --stat
git diff -- docs/implementation/00-repository-audit.md
```

File mới chưa track không hiện trong `git diff`; dùng đọc file và `git status --short --untracked-files=all` để xác nhận chính báo cáo. Kỳ vọng chỉ có DOCX sửa từ trước và báo cáo mới; chưa stage/commit. Chờ xác nhận trước triển khai code/schema/migration/dependencies.
