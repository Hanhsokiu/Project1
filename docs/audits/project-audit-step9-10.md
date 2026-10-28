# Audit toàn bộ dự án — chuẩn bị Bước 9–10

Ngày khảo sát: **27/10/2026**, workspace `C:\DATN\Project1`. Đối tượng là **working tree hiện tại**, gồm cả thay đổi và file chưa commit từ các lượt triển khai trước; không đồng nghĩa với code đã merge hoặc đã triển khai.

## 1. Executive summary

- **17 Nest module**, tất cả tìm thấy đường đăng ký tới AppModule; **154 HTTP handler** trong controller. Trong đó có 10 miền nghiệp vụ cấp cao: auth, catalog, term, registration, topic, guidance, defense, grading, report, notification; các module còn lại là app/hạ tầng/module con.
- **53 route trang React duy nhất**: 50 route nghiệp vụ/authenticated và 3 route hệ thống (`/login`, `/forbidden`, wildcard). Không cộng layout và không cộng hai lần các nhánh feature flag.
- Trong **50 route nghiệp vụ**, phân loại theo nguồn dữ liệu của trang: **23 API thật**, **2 mock/static**, **25 hỗn hợp hoặc phụ thuộc flag**. Đây là kiểm kê khả năng trong code, không phải khẳng định máy hiện đang bật các flag hay có backend/database hoạt động.
- Prisma có **104 model, 28 enum**, **16 migration active**. Có baseline SQL và schema review lịch sử khác; không được chạy đồng thời các chuỗi như một hướng dẫn cài mới.
- Nộp PDF cuối cùng và lõi quyết định UC17 đã có controller/service/repository/validator, phân quyền, revision, private storage, history/audit, unit test; frontend đã có adapter thật opt-in. UC18 mới có nguồn dữ liệu, reader và DRAFT → OPEN; **chưa có xét điều kiện đầy đủ, FINALIZE/REOPEN**.
- Theo tiêu chí **hoàn thiện toàn bộ use case trong đặc tả**, UC17–UC25: **0 hoàn thiện / 2 đang làm / 7 chưa có luồng nghiệp vụ backend hoàn chỉnh**. UC17 thiếu inbox chuyên dụng và thông báo nghiệp vụ cho Khoa; không phủ nhận lõi quyết định đã được triển khai. UC19–24 có model/helper/prototype, nhưng chưa có API ghi tương ứng; UC25 chưa có xuất kết quả/biên bản Bước 10.
- Phát hiện: **1 CRITICAL / 4 HIGH / 7 MEDIUM / 2 LOW**. CRITICAL là thiếu authorization dữ liệu trên ba reader legacy đã đăng ký, nổi bật API đọc điểm theo proposal bất kỳ. Kết luận từ đường gọi code, **không phải thông báo đã khai thác hoặc dữ liệu thật đã bị lộ**.
- Kiểm tra vừa chạy: TypeScript backend/frontend/shared **PASS**; backend **864/864** và frontend **276/276** unit test **PASS**; frontend lint **PASS**, backend lint **FAIL (6 lỗi trong test)**. Prisma validate **SKIPPED/BLOCKED** ở bước cấu hình do thiếu DIRECT_URL (lệnh exit 1, P1012), chưa kết luận schema sai. PostgreSQL integration/browser/build không chạy trong audit.
- **Chưa sẵn sàng coi Bước 9–10 hoàn chỉnh hoặc triển khai thật.** Có thể tiếp tục phát triển trên nền UC17 hiện có sau khi xử lý authorization và kiểm chứng PostgreSQL cô lập; không cần viết lại lõi UC17.

### Phạm vi và cách kiểm kê

Đã đọc workspace/configuration, toàn bộ khai báo Nest module/controller và route React, Prisma schema/migration active, các service/repository/validator/adapter cốt lõi, unit test và đặc tả. Endpoint inventory ở phụ lục được trích từ decorator controller; route inventory từ router + route manifest, có xét nhánh flag. Đây là **static audit + kiểm tra không database**, không phải pentest, chứng minh coverage toàn dòng hoặc xác minh dữ liệu triển khai.

Không sửa code, schema, migration, seed hoặc môi trường; không kết nối database, không Docker, không chạy script có DDL/DML. File duy nhất tạo trong lượt này là báo cáo này.

Nguồn yêu cầu nghiệp vụ: `docs/spec/dac-ta-use-case.md:56–64`, `docs/frontend/source-extracts/Project_1_06.md:831–965`, `docs/spec/diem-can-xac-nhan.md`, ADR 0003 và `docs/implementation/01-business-decisions-and-contract.md`. Phần quyết định UC17/UC18 mới được đối chiếu thêm với code/migration/README hiện hành; không mặc định mô tả Bước 1–8 bao phủ hết quyết định Bước 9.

## 2. Workspace và cây thư mục

### 2.1. Workspace/build/runtime

| Thành phần | Cấu hình và vai trò |
|---|---|
| Root | `pnpm-workspace.yaml`: backend/frontend/shared. `package.json`: Node >=20, pnpm >=9; dev chạy song song các package, build/test/lint chạy đệ quy. |
| Backend | NestJS 10, Prisma 5, PostgreSQL; `backend/package.json`: dev = build shared rồi `nest start --watch`; build = build shared rồi `nest build`; start = `node dist/main`. Không chạy các lệnh này trong audit. |
| Frontend | React 18, Vite 5, React Router, TanStack Query, Axios, Zod, Tailwind; dev = `pnpm --filter @doan/frontend dev`; build = `tsc && vite build`. |
| Shared | `shared/src/contracts/` và enum/type chung; backend dùng bản build shared, frontend alias tới source. Typecheck hiện tại không chứng minh build sạch từ checkout mới. |
| HTTP | `backend/src/main.ts:14`: prefix cấu hình API_PREFIX, mặc định `api`; CORS theo FRONTEND_URL, ValidationPipe, filter lỗi; Swagger ngoài production. Prefix trong báo cáo dùng mặc định. |
| Vite | `frontend/vite.config.ts`: 127.0.0.1:5173, proxy /api → localhost:3000, kiểm tra VITE_API_URL và ngăn đưa secret server vào VITE_*. |
| Script vận hành | Root setup/verify, db:local:* và backend db:*, pr2b:*, test:integration:* có thể tạo file/build/process/DDL/DML. Chỉ kiểm tra nội dung; **không chạy tự động**. |

### 2.2. Cây nguồn có tổ chức

Cây dưới đây gom theo trách nhiệm; các thư mục sâu giữ trong nhánh cha, chỉ liệt kê file nguồn tiêu biểu. Không liệt kê dependency, output build, file client sinh tự động hoặc các artifact ảnh/PDF/JSON kết quả test.
```text
Project1/
  package.json · pnpm-workspace.yaml · pnpm-lock.yaml
backend/src/
    auth/
      controller/
      dto/
      mapper/
      repository/
      service/
      validator/
    catalog/
      controller/
      dto/
      mapper/
      repository/
      service/
      validator/
    common/
      audit/
      contracts/
      dto/
      exception/
      security/
      storage/
      swagger/
      uc18-finalization/
      util/
      validation/
    config/
    defense/
      controller/
      defense-lists/
      service/
    grading/
      controller/
      service/
    guidance/
      controller/
      defense-confirmations/
      final-reports/
      reviews/
      service/
      submissions/
      tasks/
    notification/
      controller/
      repository/
      service/
    prisma/
    registration/
      controller/
      dto/
      engine/
      repository/
      service/
      validator/
    report/
      controller/
      service/
    term/
      controller/
      defense-confirmation-window/
      dto/
      final-report-submission/
      repository/
      service/
      validator/
    topic/
      controller/
      dto/
      proposal-dossiers/
      proposal-reviews/
      proposal-versions/
      repository/
      review-groups/
      service/
      validator/
backend/prisma/
    migrations/
    review/
backend/test/
    uc17/
backend/scripts/
    integration/
    sql/
frontend/src/
    app/
      layouts/
      router/
    features/
      auth/
      catalog/
      defense/
      grading/
      guidance/
      guidance-reviews/
      guidance-tasks/
      proposal-dossiers/
      proposal-reviews/
      proposal-versions/
      registration/
      report/
      review-groups/
      task-submissions/
      term/
      topic/
    shared/
      api/
      components/
      constants/
      data/
      hooks/
      services/
      types/
      utils/
docs/
    adr/
    api/
    diagrams/
      activity/
      usecase/
    erd/
    frontend/
      source-extracts/
    implementation/
      step2-evidence/
      step3-evidence/
    spec/
    workflows/
database/
    migrations/
    scripts/
    seeds/
scripts/

shared/src/
    contracts/
```

| Khu vực | File/nhánh nguồn chính và trách nhiệm |
|---|---|
| backend/src/auth | Controller/service/repository/mapper/validator cho login/session, tài khoản, role binding, đổi/reset mật khẩu; guard ở common/security. |
| backend/src/catalog | Sinh viên/GV/danh mục, import sinh viên preview → confirm; DTO Zod, mapper, kiểm tra tham chiếu và trùng dữ liệu. |
| backend/src/term | Đợt, học kỳ, roster, sáu phase, tham số; hai nhánh final-report-submission và defense-confirmation-window độc lập. |
| backend/src/registration | Đăng ký/nguyện vọng, engine phân công, plan publish/finalize và điều chỉnh; không đồng nhất PUBLISHED với FINALIZED. |
| backend/src/topic | Adapter Bước 3 cũ cùng review-groups, proposal-reviews, proposal-versions, proposal-dossiers Bước 4–7. |
| backend/src/guidance | tasks/submissions/reviews Bước 8; final-reports và defense-confirmations Bước 9; giữ các controller legacy để tương thích. |
| backend/src/defense, grading, report | DefenseList DRAFT/OPEN; ba reader council/score/stats cũ; helper tính điểm. Chưa phải toàn bộ UC18–25. |
| backend/src/common | Audit, exception/error envelope, JWT/permission, private storage, validation, contracts và reader UC18 trung lập; tránh vòng guidance ↔ defense. |
| backend/prisma | schema.prisma; seed.cjs; defense-confirmation-permissions.cjs; defense-list-permissions.cjs; migrations/ active; review/ chứa bản frozen, compatibility và SQL review. |
| backend/test | step1-http.cjs, step2-http.cjs, step3-http.cjs, persistence/mail tests, run-integration.cjs, export-openapi.cjs; uc17/{README.md,target.cjs,fixture.cjs,concurrency.cjs,postgres.test.cjs,harness.check.cjs}. |
| backend/scripts | team-local/database-test/shared-database, replay/rehearsal/foundation; test-*-api/upgrade/E2E; test-uc17.cjs; integration/ fixture/hợp đồng; sql/ diagnostics. Không coi mọi script là an toàn chỉ vì tên chứa “test”. |
| frontend/src/app | Router, manifest, workspace layout và bộ kiểm tra role hiển thị. |
| frontend/src/features | Màn hình auth/catalog/term/registration/topic/report; feature API Bước 4–8 tách riêng; guidance chứa demo cũ và hai adapter UC17/PDF mới; defense/grading là prototype chưa được router sử dụng. |
| frontend/src/shared | API/session/http-client/error handling; kit UI; data/types/store/demo/snapshot hydration; hooks, export services, utils. |
| shared/src | index.ts, step1.ts, step2.ts và contracts academic-context/review-groups/proposal-reviews/proposal-versions/proposal-dossiers/guidance-tasks/task-submissions/guidance-reviews. |
| docs | spec/ bản tóm tắt; frontend/source-extracts/ bản trích đầy đủ; adr/ quyết định; api/ hợp đồng Bước 1–3; implementation/ báo cáo Bước 1–8, hướng dẫn và evidence lịch sử; workflows/; diagrams/, erd/. Báo cáo này bổ sung audits/. |
| database | migrations/V001__auth.sql → V010__indexes_constraints.sql là SQL nền lịch sử; seeds/ role/catalog/demo/CSV; scripts/ công cụ PostgreSQL cũ, có script phá hủy dữ liệu. |
| scripts | setup-dev.cjs, verify.cjs điều phối workspace; phải đọc trước khi chạy do có tác dụng phụ. |

### 2.3. Migrations, model và vùng legacy

Chuỗi active trong `backend/prisma/migrations/`, theo thứ tự:

1. 0_init
2. 202610210001_empty_baseline_bridge
3. 202610210002_expand_workflow
4. 202610210003_review_group_management
5. 202610220001_proposal_review_assignment
6. 202610220002_proposal_version_snapshots
7. 202610220003_dossier_finalization
8. 202610220004_guidance_task_management
9. 202610220005_guidance_submissions
10. 202610230001_guidance_reviews
11. 202610260001_step1_3_enum_values
12. 202610260002_integrate_step1_3
13. 202610260003_final_report_submission
14. 202610260004_defense_confirmation_window
15. 202610260005_defense_confirmation_decisions
16. 202610270001_defense_list_finalization

Model Bước 9–10 có FinalReport/FileAsset, hai Window, DefenseConfirmation/History, DefenseList/Finalization, DefenseEligibility/DefermentRequest, DefenseCommittee/CommitteeMember/ReviewerAssignment/DefenseSession/CommitteeStudent/DefenseMinutes, RubricCriteria/ScoreEntry/ScoreDetail/FinalResult và ExportJob. **Có model không chứng minh có API hoặc workflow hoàn chỉnh**; danh sách model chính xác nằm trong schema, các tên lịch sử phải đối chiếu mapping bảng khi triển khai tiếp.

Hai hệ model legacy và workflow mở rộng cùng tồn tại có chủ đích để bàn giao: Proposal + ProposalWorkflow/version/snapshot; GuidancePlan/Task/Submission/Evaluation cũ và các Workflow tương ứng. Không đề nghị gộp/xóa trong audit vì vẫn có adapter, FK, compatibility test và consumer.

UC17 history bảo toàn quyết định cũ bằng FK RESTRICT và trigger append-only; revision=0 legacy không tự được tạo history. Snapshot không FK tới PDF cũ. UC18 finalization có unique (termId,version), (termId,listRevision), pointer FK ghép **(id,termId,listRevision)** và trigger chặn UPDATE/DELETE/TRUNCATE. Schema lưu DRAFT/OPEN/FINALIZED; UNKNOWN là kết quả reader. SQL CHECK xác minh hình thức/metadata, còn schema snapshot/hash do application xác minh; không khẳng định SQL đã chạy thành công trên PostgreSQL.

Bằng chứng: `backend/prisma/schema.prisma:510,525,964,981,1008,1036,1059`; hai migration `202610260005_defense_confirmation_decisions/migration.sql` và `202610270001_defense_list_finalization/migration.sql:24,57,74,85`.

## 3. Backend

### 3.1. Module và mức độ hoàn thiện

Các API dưới đây dùng prefix /api; phụ lục A liệt kê **đủ 154 handler**, HTTP method, permission decorator và vị trí nguồn. “Có” ở đây là code đã đăng ký; không thay thế kiểm thử database/runtime.

| Module | Chức năng | API hiện có | Mức độ hoàn thiện | Vấn đề | Ưu tiên |
|---|---|---|---|---|---|
| AppModule | Bootstrap và health | GET /health | Có code; toàn bộ 17 module reachable | Không khẳng định health chứng minh migration mới đã áp dụng | P2 |
| AuthModule | JWT/session, tài khoản/role binding/password | 11: /auth/*, /accounts* | Có DTO/guard/repository; test và evidence Bước 1–3 | Mật khẩu tạo/reset dễ dự đoán (M06); không có permission-admin CRUD UI/API đầy đủ | P1 |
| CatalogModule | Student/lecturer/reference/import | 21: /students*, /lecturers*, /departments*, /training-systems*, /research-areas*, /imports* | Có validation, tham chiếu, preview/confirm sinh viên, audit; test | Import giảng viên frontend vẫn demo, có cảnh báo; không gọi đây là import DB thật | P2 |
| TermModule | Học kỳ, đợt, phase/parameter/roster, hai cửa sổ riêng | 17: /terms*, /semesters* | Có validation/phân quyền, revision/audit cho cửa sổ | Không có UI quản trị hai cửa sổ mới; DB chưa xác minh | P1 |
| RegistrationModule | Đăng ký, phân công, publish/finalize/change | 12: /registrations*, /assignments/term/:termId/* | Có engine/transaction/role scope và bàn giao workflow | Topic legacy chưa dùng cùng nguồn official/grant (H01); không viết lại engine | P1 |
| TopicModule | Bước 3 và review group/review/version/dossier Bước 4–7 | 38 handler; xem phụ lục | Module mới có policy/repository/DTO/validator, revision/snapshot/finalization/idempotency | Hai thế hệ API cần phân biệt; legacy list/access dùng role và plan chưa FINALIZED (H01) | P0 |
| GuidanceModule | Bước 8 kế hoạch/nhiệm vụ/nộp bài/đánh giá/meeting/progress | 40 handler **gồm hai module con UC17/PDF** | Bước 8 có controller/service/repository/validator, test, evidence E2E cũ | Không coi ProgressReview là chấm điểm GVPB UC22; tránh UI demo cũ | P2 |
| FinalReportModule | Context/metadata/upload/download PDF hiện hành | 4 /proposals/:proposalId/final-report* | Ownership + private storage + checksum/revision/CAS/audit/cleanup; unit + FE adapter | PostgreSQL race/cleanup chưa chạy; dung lượng tạm 20 MiB cần Khoa chốt | P1 |
| DefenseConfirmationModule | Context/current/history/PUT/download GVHD | 5 /proposals/:proposalId/defense-confirmation* | Lõi UC17 đầy đủ code/validation/permission/history/audit/test | Inbox + thông báo Khoa chưa có; chưa có PG/E2E thật cho phần mới | P1 |
| DefenseModule | Council reader và import DefenseListModule | 1 GET /committees/term/:termId, cộng 3 handler con | Council chỉ reader; không có tạo/sửa/thành lập/phân bổ | Reader thiếu authorization (C01); UC19–21 chưa triển khai | P0 |
| DefenseListModule | UC18 create DRAFT, read, open | GET/POST /terms/:termId/defense-list; POST .../open | Có grant toàn đợt, term lock, CAS, transaction/audit/tests | Chưa có producer xét điều kiện, snapshot/finalize/reopen (H04) | P1 |
| GradingModule | Đọc ScoreEntry, helper số học | GET /scores/proposal/:proposalId | Chỉ reader + helper/test; không có ghi/khóa/công bố điểm | Reader thiếu authorization (C01); helper lệch contract (M02); UC22–24 thiếu | P0 |
| ReportModule | Đếm thống kê toàn hệ thống | GET /reports/stats | Chỉ scaffold đọc count; **không có HTTP export Bước 10** | Thiếu scope (C01), thiếu xuất Excel/PDF/biên bản/việc xuất server | P0/P1 |
| NotificationModule | Own notifications, outbox worker/read/retry | 8 /notifications*, /me/notifications | Ownership own routes; delivery claim/lease/retry code | Outbox admin endpoint thiếu grant đợt (H02); chưa nối quyết định UC17 tới thông báo Khoa | P0 |
| CommonModule | Audit/file/guards/filter/validator | Không endpoint riêng | Dùng chung và được import/đăng ký | PermissionGuard mặc định cho qua nếu thiếu metadata; từng endpoint phải tự policy (C01) | P0 |
| Uc18FinalizationModule | Adapter trung lập read(termId,tx) | Không HTTP | Prisma reader, snapshot V1, canonical SHA-256, fail closed, tests | Có consumer UC17 nhưng chưa có producer chốt; không tự OPEN | P1 |
| PrismaModule | PrismaService lifecycle/injection | Không HTTP | Hạ tầng dùng chung | Không xác minh server/schema thực trong audit | P1 |

Số handler theo miền để kiểm tra không đếm trùng: auth 11, catalog 21, term 17, registration 12, topic 38, guidance 40, defense 4, grading 1, report 1, notification 8, health 1 = **154**. Không cộng thêm endpoint của module con lần thứ hai.

### 3.2. Những điểm backend đã có bằng chứng từ code

- JWT guard xác minh token + LoginSession + tài khoản ACTIVE và yêu cầu đổi mật khẩu; không tin role gửi từ client. `backend/src/common/security/jwt-auth.guard.ts:29–92`. RbacService tra resource/action; role không mặc nhiên bypass permission.
- Bước 4–8 dùng principal, AcademicTermGrant/ownership, official assignment, DTO shared/Zod, revision/history/snapshot, idempotency ở các command phù hợp; không đồng nghĩa các API legacy được hưởng policy này tự động.
- TermWindowService vẫn sáu phase; FinalReportSubmissionWindow và DefenseConfirmationWindow tách riêng, permission term:read/plan và grant theo đợt. Chưa cấu hình không suy FINAL.
- UC17 chính thức dùng TermWorkflow + officialAssignmentPlanId, AssignmentPlan FINALIZED, AdvisorAssignment và AssignmentChange hiện hành; không lấy GuidancePlan hoặc role LECTURER làm bằng chứng GVHD.
- PUT UC17 dùng permission defense-confirmation:decide; GET/download dùng :read cùng service policy. Chỉ GVHD hiện hành ghi/context/download. Sinh viên chỉ đọc current của mình; history/context không cấp tự động. Khoa đọc current/history theo grant, không bypass ADMIN/FACULTY.
- CONFIRMED cần PDF READY đã kiểm tra bytes/checksum; REJECTED có thể thiếu PDF nhưng phải có note. Quyết định đổi thực sự cần changeReason; history append-only và audit trong cùng transaction. confirmedAt null khi REJECTED; không cập nhật DefenseEligibility/điểm.
- `DefenseConfirmationCommandValidator.validate:74` kiểm tra điều kiện ghi/context/revision trước khi xác định unchanged; `CommandService.put:196` chỉ trả changed=false sau validate. **Không tìm thấy đường no-op bỏ qua quyền, cửa sổ, UC18 hoặc concurrency** trong luồng này.
- PDF nộp lại không tự sửa UC17; expectedContext chứa identity/revision PDF và assignment; cùng checksum nhưng revision mới vẫn thay đổi context. Legacy/PENDING/ABSENT/INVALID tách riêng; không suy snapshot legacy hợp lệ.
- FileStorageService lưu private theo key UUID server, hạn chế đường dẫn/symlink, kiểm tra định dạng/nội dung PDF, size/hash; main.ts không đăng ký static route private. Upload một file + expectedRevision, không nhận actor/storageKey có thẩm quyền từ client; file cũ chỉ dọn sau commit và kiểm tra reference dưới advisory lock.
- Default PDF là **20 MiB tạm thời**, cấu hình FINAL_REPORT_MAX_FILE_BYTES (`final-report-policy.ts:10`, `config/environment.ts:30`); khác STORAGE_MAX_SIZE_MB chung, không coi mức tạm là nghiệp vụ đã duyệt.
- UC18 reader dùng transaction caller, xác minh pointer term/revision, metadata mở/chốt, snapshot version/roster không trùng/không thiếu so với manifest lưu, canonical hash; FINALIZED lịch sử hợp lệ không đổi chỉ vì PDF hiện hành khác. Không có dữ liệu/cấu hình/hỏng xác minh → UNKNOWN; UNKNOWN chặn UC17 ghi.
- Không tìm thấy controller được khai báo mà không reachable từ AppModule. Có **provider không có consumer nghiệp vụ**, điển hình ScoreAggregatorService; được đăng ký không đồng nghĩa đã có tổng hợp điểm UC24.

### 3.3. Transaction/file concurrency

| Luồng | Khóa và kiểm tra | Kết luận static |
|---|---|---|
| UC17 PUT | THESIS_TERM → DEFENSE_CONFIRMATION_WINDOW → DEFENSE_LIST → PROPOSAL → DEFENSE_CONFIRMATION → advisory PDF key; reload/recheck sau file I/O; clock_timestamp; CAS revision; history + audit trong transaction | Có giao thức chống overwrite; chưa đo PostgreSQL thực. Nguồn command.repository.ts:25–59 và command.service.ts:166–290. |
| Upload PDF | THESIS_TERM → FINAL_REPORT_SUBMISSION_WINDOW → PROPOSAL → key; stage bytes; transaction recheck; SQL CAS và clock_timestamp khi ghi; cleanup sau commit | Giữ file hiện hành khi upload/transaction lỗi; orphan reconciliation có code. Nguồn final-report.repository.ts:94–149; service.ts:159–245,289–336. |
| GVHD download | Term/proposal locks theo luồng PDF → key; identity finalReportId/revision/checksum bắt buộc; kiểm tra lại ownership/assignment/metadata sau đọc bytes | Từ chối tải nhầm revision; trả buffer sau khi transaction thành công. Không ghi decision/audit nghiệp vụ. report.service.ts:68–164. |
| UC18 DRAFT/OPEN | Khóa THESIS_TERM trước, check actor/grant/term, CAS DRAFT + expectedRevision; metadata mở xét; audit cùng tx | Không cần mọi hồ sơ có PDF để OPEN; không cập nhật eligibility/UC17. defense-list.service.ts:56–147. |
| Cleanup PDF | Advisory key; kiểm tra lại reference trong tx; không lấy term lock sau key | Không thấy vòng khóa ngược trong các nhánh đã đọc. Không khẳng định không thể deadlock với writer tương lai hoặc SQL ngoài giao thức. |

ReadCommitted được dùng để có dữ liệu mới sau chờ khóa; UC17/PDF maxWait 10s, interactive transaction timeout 15s. **Đọc/hash PDF giữ khóa term toàn đợt**, có thể làm chậm request của hồ sơ khác (M03); chưa có số đo. clock_timestamp sau wait tránh dùng transaction-start timestamp để chấp nhận request đã hết hạn. FINALIZE tương lai phải khóa cùng parent trước snapshot/decision/PDF; hiện **chưa có API này để kiểm thử**.


## 4. Frontend

### 4.1. Routes, layout và nguồn dữ liệu

Nguồn bảng: `frontend/src/app/router/routes.tsx` (dòng ghi ở từng route), `route-manifest.ts` (role/title), các service trong feature tương ứng. A=ADMIN, F=FACULTY, L=LECTURER, S=STUDENT, C=COMMITTEE. Role trong bảng là **quyền hiển thị route**, không thay thế permission/ownership/grant của backend.

“API thật” nghĩa trang có adapter HTTP trực tiếp, không có nhánh demo cho nghiệp vụ chính. “Hỗn hợp/flag” nghĩa cùng route có mode API/demo hoặc lấy snapshot nhiều nguồn và vẫn có thao tác local. “Mock/static” không có backend adapter nghiệp vụ tương ứng. Không cộng 9 prototype defense/grading chưa đăng ký vào tổng route.

| Route (dòng router) | Vai trò manifest | Chức năng | Nguồn dữ liệu | Backend tương ứng (bỏ /api) | Vấn đề/giới hạn |
|---|---|---|---|---|---|
| `/guidance/final-report` (:464) | F, L, S | PDF hiện hành; context/upload/download riêng tư | Hỗn hợp/flag | /proposals/:id/final-report* | Flag riêng; nhập proposalId thật; không phải inbox; không lịch sử PDF thật. |
| `/guidance/defense-confirm` (:456) | F, L, S | Quyết định bảo vệ UC17 | Hỗn hợp/flag | /proposals/:id/defense-confirmation* | Flag riêng; chi tiết GVHD; chưa inbox và view student/faculty riêng (M01/M05). |
| `/guidance/review` (:278) | L | Inbox/đánh giá bài nộp Bước 8C | API thật | /terms/:id/progress-review-inbox; /task-submissions/:id/review-context; /task-reviews* | Có API + unit; không phải UC22. |
| `/guidance/review/:submissionId` (:279) | F, L, S | Inbox/đánh giá bài nộp Bước 8C | API thật | /terms/:id/progress-review-inbox; /task-submissions/:id/review-context; /task-reviews* | Có API + unit; không phải UC22. |
| `/guidance/progress` (:290) | F | Dashboard tiến độ | API thật | /terms/:id/guidance-dashboard | Có API; không suy eligibility. |
| `/guidance/meetings` (:300) | F, L, S | Lịch/họp hướng dẫn | API thật | /guidance-plans/:id/meetings; /guidance-meetings/:id | Có API; khác lịch bảo vệ UC21. |
| `/guidance/notifications` (:309) | F, L, S | Thông báo workflow | API thật | /me/notifications | Có API; không đồng nghĩa UC17 đã phát thông báo. |
| `/guidance/plan` (:319) | F, L, S | Kế hoạch và tạo nhiệm vụ | API thật | /proposals/:id/guidance-*; /guidance-plans/:id/tasks | Bước 8A; ownership/grant do backend quyết định. |
| `/guidance/plan/:proposalId` (:320) | F, L, S | Kế hoạch và tạo nhiệm vụ | API thật | /proposals/:id/guidance-*; /guidance-plans/:id/tasks | Bước 8A; ownership/grant do backend quyết định. |
| `/guidance/plan/:proposalId/tasks/new` (:321) | L | Kế hoạch và tạo nhiệm vụ | API thật | /proposals/:id/guidance-*; /guidance-plans/:id/tasks | Bước 8A; ownership/grant do backend quyết định. |
| `/guidance/tasks` (:332) | F, L, S | Nhiệm vụ/tiến độ/nộp bài | API thật | /tasks*; /task-submissions* | Bước 8A/B; không dùng URL demo cho download thật. |
| `/guidance/tasks/:id` (:333) | F, L, S | Nhiệm vụ/tiến độ/nộp bài | API thật | /tasks*; /task-submissions* | Bước 8A/B; không dùng URL demo cho download thật. |
| `/guidance/tasks/:id/submissions` (:334) | F, L, S | Nhiệm vụ/tiến độ/nộp bài | API thật | /tasks*; /task-submissions* | Bước 8A/B; không dùng URL demo cho download thật. |
| `/topic/dossier` (:345) | F, L, S | Hồ sơ chính thức/PDF đề cương | API thật | /proposals/:id/dossier*; /proposals/:id/finalize | Có API Bước 7; finalize hồ sơ khác finalize UC18. |
| `/topic/dossier/:proposalId` (:346) | F, L, S | Hồ sơ chính thức/PDF đề cương | API thật | /proposals/:id/dossier*; /proposals/:id/finalize | Có API Bước 7; finalize hồ sơ khác finalize UC18. |
| `/topic/proposal` (:357) | F, L, S | Soạn/so sánh phiên bản | API thật | /proposals/:id/editing-context; /proposals/:id/versions*; .../submit | Có API Bước 6; giữ identity phiên bản. |
| `/topic/proposal/:proposalId` (:358) | F, L, S | Soạn/so sánh phiên bản | API thật | /proposals/:id/editing-context; /proposals/:id/versions*; .../submit | Có API Bước 6; giữ identity phiên bản. |
| `/topic/proposal/:proposalId/versions/:versionId` (:359) | F, L, S | Soạn/so sánh phiên bản | API thật | /proposals/:id/editing-context; /proposals/:id/versions*; .../submit | Có API Bước 6; giữ identity phiên bản. |
| `/topic/reviews` (:373) | F, L, S | Duyệt đề cương | API thật | /terms/:id/proposals; /proposal-reviews* | Bước 5; không phải duyệt bảo vệ UC17. |
| `/topic/reviews/:id` (:374) | F, L, S | Duyệt đề cương | API thật | /terms/:id/proposals; /proposal-reviews* | Bước 5; không phải duyệt bảo vệ UC17. |
| `/topic/review-assignments/:proposalId` (:384) | F | Phân công duyệt đề cương | API thật | /proposals/:id/review-candidates; .../review-assignments | Bước 5; khác phân công GVPB UC20. |
| `/topic/review-groups` (:394) | F, L | Nhóm duyệt/membership | API thật | /terms/:id/review-groups; /review-groups* | Bước 4; không phải hội đồng bảo vệ UC19. |
| `/topic/review-groups/new` (:395) | F | Nhóm duyệt/membership | API thật | /terms/:id/review-groups; /review-groups* | Bước 4; không phải hội đồng bảo vệ UC19. |
| `/topic/review-groups/:id/edit` (:396) | F | Nhóm duyệt/membership | API thật | /terms/:id/review-groups; /review-groups* | Bước 4; không phải hội đồng bảo vệ UC19. |
| `/topic/review-groups/:id` (:397) | F, L | Nhóm duyệt/membership | API thật | /terms/:id/review-groups; /review-groups* | Bước 4; không phải hội đồng bảo vệ UC19. |
| `/login` (:401) | Public/hệ thống | Đăng nhập thật hoặc demo | Hệ thống | /auth/login (khi VITE_AUTH_API=true) | Route hệ thống; demo login theo DEV/VITE_DEMO_MODE. |
| `/` (:414) | A, F, L, S, C | Tổng quan workspace | Hỗn hợp/flag | Snapshot hydrate từ nhiều API; không gọi /reports/stats làm nguồn chính | Hỗn hợp; số liệu theo phần được hydrate, không chứng minh dữ liệu toàn đợt. |
| `/admin/accounts` (:415) | A | Tài khoản/vai trò/khóa/reset | Hỗn hợp/flag | /accounts* | Theo VITE_AUTH_API; mật khẩu reset xem M06. |
| `/admin/roles` (:416) | A | Ma trận role → route | Mock/static | Không có permission-management API được UI gọi | Static routeManifest; không phản ánh permission/grant database. |
| `/admin/audit-logs` (:417) | A, F | Tra cứu nhật ký trình duyệt | Mock/static | Không có audit-log HTTP reader | db.audits cục bộ; không đọc audit UC17 server (M07). |
| `/catalog/students` (:419) | A, F | Danh mục sinh viên/GV | Hỗn hợp/flag | /students*; /lecturers* | Theo VITE_CATALOG_API; không khẳng định dữ liệu thật hiện có. |
| `/catalog/lecturers` (:420) | A, F, L | Danh mục sinh viên/GV | Hỗn hợp/flag | /students*; /lecturers* | Theo VITE_CATALOG_API; không khẳng định dữ liệu thật hiện có. |
| `/catalog/import` (:421) | A, F | Import danh mục | Hỗn hợp/flag | /imports* (sinh viên) | Student theo flag; lecturer vẫn demo, đã có cảnh báo. |
| `/catalog/reference` (:422) | A, F | Danh mục tham chiếu | Hỗn hợp/flag | /departments*; /training-systems*; /research-areas* | Theo VITE_CATALOG_API; kiểm tra enum/domain ở backend. |
| `/terms` (:427) | A, F | Đợt/phase/parameter/roster | Hỗn hợp/flag | /terms*; /semesters | Theo VITE_TERM_API; không có editor hai window mới. |
| `/terms/:id` (:428) | A, F | Đợt/phase/parameter/roster | Hỗn hợp/flag | /terms*; /semesters | Theo VITE_TERM_API; không có editor hai window mới. |
| `/terms/:id/phases` (:429) | A, F | Đợt/phase/parameter/roster | Hỗn hợp/flag | /terms*; /semesters | Theo VITE_TERM_API; không có editor hai window mới. |
| `/terms/:id/parameters` (:430) | A, F | Đợt/phase/parameter/roster | Hỗn hợp/flag | /terms*; /semesters | Theo VITE_TERM_API; không có editor hai window mới. |
| `/terms/:id/roster` (:434) | A, F | Đợt/phase/parameter/roster | Hỗn hợp/flag | /terms*; /semesters | Theo VITE_TERM_API; không có editor hai window mới. |
| `/registration` (:436) | S | Đăng ký/phân công/bàn giao | Hỗn hợp/flag | /registrations*; /assignments/term/:termId/* | Theo VITE_REGISTRATION_API; cần flags catalog + term đồng bộ. |
| `/registration/list` (:437) | A, F | Đăng ký/phân công/bàn giao | Hỗn hợp/flag | /registrations*; /assignments/term/:termId/* | Theo VITE_REGISTRATION_API; cần flags catalog + term đồng bộ. |
| `/registration/assignment` (:441) | A, F | Đăng ký/phân công/bàn giao | Hỗn hợp/flag | /registrations*; /assignments/term/:termId/* | Theo VITE_REGISTRATION_API; cần flags catalog + term đồng bộ. |
| `/registration/result` (:445) | A, F, L, S | Đăng ký/phân công/bàn giao | Hỗn hợp/flag | /registrations*; /assignments/term/:termId/* | Theo VITE_REGISTRATION_API; cần flags catalog + term đồng bộ. |
| `/registration/manual` (:449) | A, F | Đăng ký/phân công/bàn giao | Hỗn hợp/flag | /registrations*; /assignments/term/:termId/* | Theo VITE_REGISTRATION_API; cần flags catalog + term đồng bộ. |
| `/topic/my` (:451) | A, F, L, S | Đề tài/đề cương Bước 3 | Hỗn hợp/flag | /topics* | Theo VITE_REGISTRATION_API; legacy scope/source advisor (H01). |
| `/topic/draft` (:452) | S, L | Đề tài/đề cương Bước 3 | Hỗn hợp/flag | /topics* | Theo VITE_REGISTRATION_API; legacy scope/source advisor (H01). |
| `/topic/overview` (:453) | A, F, L, S, C | Đề tài/đề cương Bước 3 | Hỗn hợp/flag | /topics* | Theo VITE_REGISTRATION_API; legacy scope/source advisor (H01). |
| `/report/export` (:471) | A, F, L, S, C | Xuất Bước 1–3 | Hỗn hợp/flag | Client export; PDF đề cương qua /topics/:id/versions/:version/pdf | Có thể dữ liệu hydrate API; job/audit vẫn local; không phải Bước 10. |
| `/profile` (:472) | A, F, L, S, C | Hồ sơ/đổi mật khẩu | Hỗn hợp/flag | /auth/me; /auth/profile; /auth/change-password | Theo VITE_AUTH_API; JWT sessionStorage. |
| `/change-password` (:473) | A, F, L, S, C | Hồ sơ/đổi mật khẩu | Hỗn hợp/flag | /auth/me; /auth/profile; /auth/change-password | Theo VITE_AUTH_API; JWT sessionStorage. |
| `/notifications` (:474) | A, F, L, S, C | Thông báo Bước 1–3 | Hỗn hợp/flag | /notifications/me; /notifications/:id/read; /notifications/me/read | Theo VITE_REGISTRATION_API; khác /guidance/notifications. |
| `/forbidden` (:477) | Public/hệ thống | Thông báo cấm truy cập | Hệ thống | Không gọi nghiệp vụ | Route hệ thống. |
| `/*` (:478) | Public/hệ thống | Trang không tìm thấy | Hệ thống | Không gọi nghiệp vụ | Route hệ thống. |


### 4.2. Auth, flags, state và lỗi

- `frontend/src/shared/api/api-session.ts:2–44`: auth thật opt-in VITE_AUTH_API=true; token/user ở **sessionStorage**, không có JWT localStorage mới do UC17/PDF. HTTP client thêm Bearer, single-flight refresh, một lần retry khi 401, xóa session khi không refresh được; `frontend/src/shared/api/http-client.ts:9–88`.
- VITE_TERM_API, VITE_CATALOG_API, VITE_IMPORT_API điều khiển Bước 1; VITE_REGISTRATION_API điều khiển Bước 2–3 và snapshot. Bật registration thật nhưng thiếu term/catalog có guard cấu hình trong `frontend/src/shared/data/snapshot-api.ts:232`.
- UC17: `guidance/defense-confirmations/config.ts:2`, **VITE_DEFENSE_CONFIRMATION_API=true + VITE_AUTH_API=true**. PDF: `guidance/final-reports/config.ts:2`, **VITE_FINAL_REPORT_API=true + VITE_AUTH_API=true**. Flag riêng, không bật chéo; thiếu auth là CONFIGURATION_ERROR, API lỗi không fallback demo.
- Workspace cũ dùng useWorkspace/useDemo, store/snapshot hydrate và mutate local; workflow mới dùng TanStack Query, invalidate/refetch theo scope. UC17/PDF query key có user/session/proposal, tránh dùng dữ liệu cache của hồ sơ khác; `defense-confirmations/page.tsx:88,109`, `final-reports/page.tsx:93,114`.
- UC17 actions validate note/changeReason, gửi nguyên expectedRevision/expectedContext từ GET, 409 hủy dữ liệu kỳ vọng và yêu cầu xem lại, sau PUT refetch context/decision/history; history có hasMore/nextAfterRevision. Tiến độ chỉ cảnh báo; không coi tải file là bằng chứng đã đọc.
- PDF gửi FormData file + expectedRevision, để browser tạo multipart boundary; context chứa window và maxFileBytes nên không cần cấp permission term:read cho sinh viên để GET admin window. Có xử lý 400/401/403/404/409/413/422/network; lỗi upload không xác định kết quả buộc reload thay vì giả vờ file cũ còn hoặc tự retry.
- Không có bằng chứng fake-success trong **hai adapter thật UC17/PDF** đã đọc. Có thành công local đúng nghĩa demo ở service cũ; đặc biệt import lecturer đã có Notice minh bạch (`ImportPage.tsx:103–118`).
- Static frontend role gate chỉ giúp UX. Các điểm policy không đồng nhất (M05), audit local (M07), và lỗ hổng backend legacy (C01/H01/H02) không được chữa bằng cách ẩn menu.

### 4.3. Prototype và trách nhiệm trùng

- 6 file `features/defense/pages/{EligibilityPage,DefermentPage,CommitteePage,ReviewerAssignPage,SchedulePage,MinutesPage}.tsx` và 3 file `features/grading/pages/{RubricPage,ScoreEntryPage,ResultPage}.tsx` **không được import/đăng ký trong router hiện tại**. Service và unit test của chúng vẫn tồn tại, chủ yếu mutate DemoDb; không có route bảo vệ/chấm điểm sử dụng thật.
- GuidancePlanPage/TaskBoardPage/TaskReviewPage/MeetingLogPage legacy còn ở `features/guidance/pages/`; router sử dụng feature mới guidance-tasks/task-submissions/guidance-reviews. Đây là dấu hiệu prototype cũ, không phải bằng chứng có thể xóa toàn bộ nhánh guidance.
- Hai trang notification dùng hai adapter/giai đoạn khác nhau; topic Bước 3 và proposal-version/dossier mới cùng tồn tại với cơ chế bàn giao. Không gộp “review group” với “defense committee” hoặc “progress review” với “reviewer score”.
- Không đề xuất xóa file nào. Cần có dependency check/test và quyết định lưu prototype trước mọi dọn dẹp.


## 5. Đối chiếu frontend ↔ backend và mức bằng chứng

### 5.1. Ma trận hợp đồng

| Chức năng/adapter | Endpoint thực sự tồn tại | Hợp đồng và quyền | Mức bằng chứng | Khoảng trống |
|---|---|---|---|---|
| Auth/account | /auth/login, me, refresh, logout, change-password, profile; /accounts* | ApiResponse.data, Bearer/session; account permission; frontend sessionStorage | Code + unit; evidence Bước 1–3 lịch sử | Chưa chạy login/browser/backend thực trong audit; không có tài khoản test được xác minh. |
| Catalog/import | /students*, /lecturers*, /departments*, /training-systems*, /research-areas*, /imports/students/* | DTO Zod; GPA/IDs, preview/confirm; lecturer import không có adapter thật | Shared contracts + unit, API/upgrade evidence cũ | Import lecturer local được ghi nhãn; không suy tất cả import thật từ một flag. |
| Term/roster | /terms*, /semesters | Mapper DTO + flags; terms/phase/parameter/roster riêng | Unit + evidence Bước 1–3 | Không có UI cấu hình cửa sổ PDF/UC17; không suy FINAL là cửa sổ. |
| Registration/assignment | /registrations/term/:id/*; /assignments/term/:id/* | Draft/submit/preview/manual/publish/finalize; workflowReady/handover | Unit + evidence Bước 1–3/handoff | UI/B3 legacy phải xử lý đúng FINALIZED và AssignmentChange; xem H01. |
| Review groups/proposal review | /review-groups*, /proposal-reviews*, /proposals/:id/review-* | Shared contracts + actor/grant, revision/idempotency nơi quy định | Unit hiện tại; API/upgrade/browser và live E2E Bước 4–8 lịch sử | Không phải hội đồng/phản biện Bước 9. |
| Proposal versions/dossier | /proposals/:id/versions*, submit, dossier*, finalize | Snapshot/version/revision; PDF đề cương server | Shared contracts + unit, bằng chứng E2E lịch sử | Không phải PDF đồ án cuối cùng hoặc UC18 finalization. |
| Guidance tasks/submissions/reviews | /guidance-plans*, /tasks*, /task-submissions*, /task-reviews*, /guidance-meetings* | File private và review PASS/FAIL/REVISION_REQUIRED; không đồng nhất score UC22 | Shared contracts + unit; API/browser/E2E Bước 8 lịch sử | Production filesystem/SMTP/concurrency hiện tại chưa xác minh. |
| FinalReport API mode | GET context, GET metadata, PUT report, GET download trong FinalReportController:103–158 | FormData đúng một file + expectedRevision; ownership; size từ context; window riêng; Zod response kiểm tra proposal/revision | Backend + frontend unit hiện chạy PASS | Chưa PG/E2E UC17/PDF thật; nhập proposalId; không có lịch sử PDF trong API mode. |
| UC17 API mode | GET context/current/history, PUT, GET report/download trong ba controller | DTO status/note/expectedRevision/expectedContext/changeReason; download identity; service policy, cursor history; error 400/401/403/404/409/422 | Backend + frontend unit PASS, adapter/actions/SSR test | Chưa PG/browser thật; frontend context trang GVHD không phục vụ student/faculty readonly (M05). |
| PDF cửa sổ / UC17 cửa sổ | GET/PUT /terms/:termId/{final-report-submission-window,defense-confirmation-window} | term:read/plan + grant; opensAt/closesAt/locked/expectedRevision; audit tx | Unit backend | Không thấy frontend admin adapter/route cho hai API; student đọc window qua final-report-context là đúng policy. |
| UC18 DRAFT/OPEN | GET/POST /terms/:termId/defense-list, POST .../open | defense-list:read/manage; toàn đợt cần allDepartments; expectedRevision | Unit backend + reader/hash tests | Chưa FE; chưa xét điều kiện/finalize/reopen API; không có default OPEN. |
| Council/score/stats reader cũ | GET /committees/term/:termId; /scores/proposal/:proposalId; /reports/stats | Thiếu permission và scope trong code thực (C01) | Code đã đăng ký; không thấy regression authorization riêng cho ba reader | Không được coi là backend đầy đủ của prototype defense/grading/report. |
| Defense/grading prototype | Không có backend command tương ứng | mutate DemoDb, enum/quy tắc riêng, không có authoritative server permission | Unit của demo service PASS | 9 page không có route; không có E2E Bước 9–10. |
| Export Bước 1–3 | Client Excel/PDF; PDF đề cương riêng | buildReport filter/visibility; job/audit local | Unit report-service và evidence PDF đề cương Bước 7 | Backend ReportModule chỉ /reports/stats; chưa Bước 10 server export/audit. |
| Nhật ký/vai trò | /admin/audit-logs và /admin/roles không gọi backend reader/permission editor | Browser audit + static route roles | Code UI | Không dùng hai màn hình này để nghiệm thu audit/permission UC17. |

Không phát hiện sai method/path trong hai adapter mới final-reports và defense-confirmations khi đối chiếu controller; expectedRevision/expectedContext có test đồng bộ GET→PUT. Các nhóm Bước 4–8 dùng shared contracts và có evidence lịch sử. **Không tuyên bố đã kiểm chứng toàn bộ response thực của 154 endpoint chỉ bằng TypeScript**: type interface không tự xác minh HTTP runtime, và không chạy server trong lượt này.

### 5.2. Code, unit, integration và browser là bốn mức khác nhau

| Mức | Bằng chứng kiểm tra được | Điều không được suy ra |
|---|---|---|
| Code | Module/controller/repository/DTO/validator, route + adapter đã tồn tại trong working tree | Code chưa commit không chứng minh code trên máy nhóm/production giống nhau. |
| Unit hiện tại | Backend 55 file/864 test; frontend 27 file/276 test; kiểm tra không database | Mock repository/HTTP và SSR không chứng minh FK, trigger, row lock hoặc click-through browser thật. |
| PostgreSQL/Bước 1–8 lịch sử | `docs/implementation/evidence/merge-develop-2026-10-26/validation-summary.json`: 154 API checks Bước 4–8, 7 upgrade suites, active-chain PASS; các report/review JSON tương ứng | Không phải lượt chạy mới; không phủ bốn migration PDF/UC17/UC18 thêm sau đó. |
| Browser lịch sử | `.../live-e2e.json`: PG17, mockedApi=false, 15 checkpoint luồng 4→8, PDF tải thật; `live-browser.json` và `live-finalized.pdf` là artifact | Một số browser suite riêng dùng mock API; không gộp toàn bộ “browser PASS” thành E2E thật. |
| PostgreSQL UC17 | `backend/test/uc17/README.md:3–9`: **31 case TEST WRITTEN — NOT RUN**; có runner/harness/fixture/concurrency | Không có bằng chứng FK/trigger/timeouts/lock measurement thực cho UC17 mới; không tự nâng thành PASS từ unit. |
| Trình duyệt UC17/PDF hiện tại | Có adapter/action/validation/component SSR unit test | Không có bằng chứng browser với backend và PostgreSQL thật cho hai feature mới. |

## 6. Bước 9–10: UC17–UC25

### 6.1. Ma trận theo đặc tả

“Hết use case” ở bảng này yêu cầu luồng chính trong đặc tả có backend thực và UI sử dụng được, không tính model/prototype như triển khai. Vì vậy 0 hoàn thiện không có nghĩa UC17 chưa có code. Test được ghi đúng tầng; không gán 864 test cho từng UC.

| Use case | Backend | Frontend | Test/bằng chứng | Thiếu gì | Phụ thuộc | Ưu tiên |
|---|---|---|---|---|---|---|
| Hỗ trợ B9: nộp PDF cuối cùng | Context/metadata/upload/thay thế/download; private/key server/hash/revision/audit/cleanup | /guidance/final-report có API mode + demo tách riêng | Unit BE/FE; PG 31 case chưa chạy | E2E thật, xác nhận dung lượng tạm, chọn hồ sơ thuận tiện | Approved Proposal, assignment chính thức, roster, hai permission submission và window riêng | P1 |
| **UC17 — đang làm** | GET context/current/history, PUT CONFIRMED/REJECTED, download identity; history/audit/UC18 gating | /guidance/defense-confirm API mode chi tiết GVHD | Unit BE/FE PASS; PG integration chưa chạy | Inbox GVHD + summary theo danh sách; thông báo Khoa sau quyết định; UX đọc student/faculty; nghiệm thu thật | PDF READY cho CONFIRMED, DEFENSE_CONFIRMATION mở, official advisor, UC18 OPEN | P1 |
| **UC18 — đang làm** | DefenseList/Finalization + reader; create DRAFT/open; snapshot V1/hash | Chưa route API; EligibilityPage prototype không được mount | Reader/DRAFT/OPEN unit; fixture PG chưa chạy | Producer xét điều kiện học vụ, thu thập đầy đủ TermStudent; preview/đối soát; finalize/reopen; snapshot/audit/version | UC17 + PDF identity, dữ liệu học vụ đủ căn cứ; toàn đợt/allDepartments | P1 |
| **UC19 — chưa có luồng thực** | Model council/member, GET council; chưa command thành lập/phân bổ/chốt | CommitteePage demo chưa route | Defense demo service unit; chưa API/E2E | 3–5 thành viên, vai trò, phân bổ đều/giới hạn, tránh GVHD của SV, audit/revision | UC18 danh sách chốt và grant | P1 sau UC18 |
| **UC20 — chưa có luồng thực** | Model ReviewerAssignment; không API phân công phản biện bảo vệ | ReviewerAssignPage demo chưa route | Demo unit; chưa backend workflow | Phân công không trùng GVHD, workload, thông báo, thay đổi có kiểm soát | UC18/19; khác ProposalReviewAssignment Bước 5 | P1 |
| **UC21 — chưa có luồng thực** | Room/DefenseSession/CommitteeStudent; chưa command lập lịch/công bố | SchedulePage demo chưa route | Demo unit | Xung đột phòng/giảng viên/buổi, xếp Alphabet, publish/re-notify, revision | Council/reviewer và danh sách được bảo vệ | P1 |
| **UC22 — chưa có luồng thực** | Chưa API nhận xét/chấm/submit GVPB; ScoreEntry không đủ | ScoreEntryPage demo chưa route | Grading demo/helper unit; không HTTP grading workflow | Phiếu/rubric/nhận xét, phạm vi reviewer, cửa sổ, draft/submit/amendment, audit | UC20, PDF cuối, quy tắc rubric và thời hạn | P1 |
| **UC23 — chưa có luồng thực** | Chưa API điểm hội đồng, biên bản và duyệt biên bản | ScoreEntryPage/MinutesPage demo chưa route | Demo unit | Chỉ member được chấm, rubric/range, thư ký biên bản/chủ tịch duyệt theo quyền, audit | UC19/21, UC18 snapshot | P1 |
| **UC24 — chưa có luồng thực** | Helper ScoreAggregator, FinalResult model; chưa tổng hợp/lock/publish/amend API | ResultPage demo chưa route | 3 helper unit; grading demo unit | Một công thức cấu hình thống nhất; completeness; aggregate tx; lock/publish; student sau publish; sửa có lý do | UC22/23 + điểm GVHD, thống nhất rounding/passing | P1 |
| **UC25/Bước 10 — chưa có luồng thực** | ExportJob model; ReportModule chỉ count | /report/export làm Bước 1–3; prototype MinutesPage | Report demo/client export unit; PDF đề cương đã có evidence khác nghiệp vụ | Excel điểm QT/KTHP/HP, danh sách lớp/hội đồng/GVPB; PDF biên bản bảo vệ; job/audit server và grant | Kết quả chốt/biên bản/council/snapshot chính thức | P1 sau dữ liệu nguồn |

Nguồn: UC17 `Project_1_06.md:831–844`; UC18 :847–858; UC19 :862–875; UC20 :878–889; UC21 :893–905; UC22 :910–920; UC23 :923–935; UC24 :938–949; UC25 :953–965. Các rule chi tiết chưa có nguồn rõ phải được nhóm chốt, không biến heuristic demo thành yêu cầu server.

### 6.2. Công thức điểm và xung đột contract

Đặc tả/ADR quy định mặc định:

- QT = GVHD × 0.5 + GVPB × 0.5.
- KTHP = tổng điểm thành viên hội đồng **tham gia chấm** / số thành viên tham gia chấm.
- HP = QT × 0.4 + KTHP × 0.6.
- ADR `docs/adr/0003-cong-thuc-diem-cau-hinh.md` yêu cầu trọng số cấu hình theo đợt; `docs/spec/diem-can-xac-nhan.md:40–44` ghi điều kiện điểm thành phần QT/KTHP và HP đạt ngưỡng 5. Không chỉ xét HP.
- Ví dụ trong tài liệu/helper test: GVHD=9, GVPB=7 → QT=8; hội đồng 7.5/8/8.5/9 → KTHP=8.25; HP=8.15. Giá trị mặc định này đúng ở helper, không chứng minh rule thiếu điểm/rounding đã thống nhất.

| Code | Đã làm | Khác biệt cần xử lý trước UC24 |
|---|---|---|
| `backend/src/grading/service/score-aggregator.service.ts:18–57` | QT hardcode 0.5/0.5; KTHP mean; HP có trọng số mặc định 0.4/0.6 | QT round 2 chữ số, KTHP round 3, HP round 2; isPassed chỉ xét HP; không kiểm completeness hội đồng/điểm/weight. Provider chưa có production consumer. |
| `frontend/src/features/grading/services/grading-service.ts:155–250` | Demo dùng 4 tham số trọng số, kiểm tổng weight=1, hội đồng 3–5, đủ mọi thành viên; QT/KTHP/HP cùng đạt ngưỡng | Bắt đủ mọi member có thể khác “tham gia chấm”; không cùng chiến lược làm tròn trung gian với helper; không phải engine server. |
| `backend/src/guidance/reviews/` | PASS/FAIL/REVISION_REQUIRED cho bài nộp/tiến độ Bước 8C | Không tự biến thành điểm GVHD hoặc thay điểm GVPB. Cần nguồn điểm GVHD chính thức riêng trong thiết kế scoring. |

Cần xác nhận: quy tắc vắng thành viên/quorum, trọng số có được thay sau nhập/chốt không, rounding và thời điểm round, điểm GVHD lấy từ phiếu nào, quy trình phúc tra/sửa sau công bố, rubric theo đợt và tiêu chí bắt buộc. Không tự thêm trạng thái hoặc tự suy đủ điều kiện từ PDF/CONFIRMED.

### 6.3. Phần mới không được làm thay trách nhiệm cũ

Nộp lại PDF trước hạn riêng vẫn hợp lệ sau UC17 CONFIRMED; mỗi hồ sơ chỉ PDF hiện hành. UC17 giữ snapshot cũ, trả pdfChangedSinceDecision, không tự thu hồi. UC18 reader FINALIZED kiểm tính toàn vẹn **bản lịch sử**; PDF mới chỉ là STALE ở lớp so sánh, không mở lại danh sách. Hiện chưa có producer FINALIZE/REOPEN; không được coi list OPEN hoặc DefenseEligibility.ELIGIBLE là Khoa đã chốt.

## 7. Kiểm tra kỹ thuật thực sự chạy trong audit

| Kiểm tra | Lệnh/phạm vi | Kết quả vừa quan sát |
|---|---|---|
| Backend TypeScript | backend: `pnpm.cmd exec tsc --noEmit --incremental false` | **PASS**, exit 0 |
| Frontend TypeScript | frontend: cùng lệnh | **PASS**, exit 0 |
| Shared TypeScript | shared: cùng lệnh | **PASS**, exit 0 |
| Backend lint | backend: `pnpm.cmd run lint` | **FAIL**, exit 1; 6 lỗi ở test, xem M04 |
| Frontend lint | frontend: `pnpm.cmd run lint` | **PASS**, exit 0 |
| Backend unit | Đảm bảo GPMS_INTEGRATION không bằng 1; `pnpm.cmd exec vitest run --exclude '**/*.integration.spec.ts' --no-cache` | **PASS 55/55 file; 864/864 test**, khoảng 145.34s |
| Frontend unit | frontend: `pnpm.cmd exec vitest run --no-cache` | **PASS 27/27 file; 276/276 test**, khoảng 73.76s |
| Prisma validate | backend: `pnpm.cmd exec prisma validate --schema prisma/schema.prisma` | **SKIPPED/BLOCKED kết luận schema**: CLI 5.22.0 dừng get-config, P1012 thiếu DIRECT_URL ở schema:10, exit 1. Không thay env để ép PASS, không kết nối DB. |
| git diff --check | Root trước/sau báo cáo | **PASS**, không lỗi whitespace |
| Build/dev/server/browser | Chỉ đọc scripts, không chạy build/server/browser | **SKIPPED**: chỉ được tạo báo cáo; build/dev có output/process, không cần để thực hiện audit |
| PostgreSQL integration/migration/seed | Không chạy bất kỳ suite DB/DDL/DML, không Docker | **SKIPPED theo phạm vi**, không phải FAIL và không phải PASS |
| Dependency vulnerability/license scan | Không cài/fetch/audit registry | **SKIPPED**; không kết luận package an toàn chỉ từ version/typecheck |
| Coverage | Không chạy coverage | **SKIPPED**; không quy số unit test thành phần trăm coverage |

Lệnh TypeScript gọi trực tiếp để tránh package script backend tự build shared. Chúng dùng dependency/shared build đã có trong workspace; đây không phải chứng minh fresh install/build. Test frontend có warning SSR useLayoutEffect/React Router và Vite CJS; không đổi thành FAIL khi exit 0. Không chạy formatter --write hoặc sửa lint.

Backend lint lỗi chính xác:

| File | Dòng | Rule |
|---|---|---|
| backend/src/defense/defense-lists/defense-list-permissions.spec.ts | 6:5 | @typescript-eslint/no-var-requires |
| backend/src/guidance/defense-confirmations/defense-confirmation-context.service.spec.ts | 37:22 | @typescript-eslint/ban-types (Function) |
| backend/src/guidance/defense-confirmations/defense-confirmation-permissions.spec.ts | 7:5 | @typescript-eslint/no-var-requires |
| backend/src/guidance/final-reports/final-report.controller.spec.ts | 10:3 | @typescript-eslint/no-unused-vars (ReportRequest) |
| backend/src/guidance/final-reports/final-report.service.spec.ts | 39:16, 40:15 | @typescript-eslint/no-explicit-any (2 lỗi) |


## 8. Phát hiện và mức ưu tiên

Thống kê **14 phát hiện: 1 CRITICAL, 4 HIGH, 7 MEDIUM, 2 LOW**. Tách rõ lỗi/thiếu sót xác nhận từ source và rủi ro chưa có quan sát runtime. Các mục thiếu tính năng là **gap so với mục tiêu**, không mô tả như regression đã xảy ra. P0 là việc cần xử lý trước khi dùng dữ liệu thật; không triển khai sửa trong audit.

### C01 — CRITICAL — Ba reader legacy không có authorization dữ liệu

**Loại:** lỗi kiểm soát truy cập xác nhận từ đường gọi code; chưa chạy khai thác DB thật.

**Vị trí/bằng chứng:**

- `backend/src/common/security/permissions.guard.ts:39`: thiếu @RequirePermission thì return true sau authentication.
- `backend/src/grading/controller/score.controller.ts:11–14` nhận proposalId, không permission, không truyền principal; `backend/src/grading/service/score.service.ts:8–12` findMany ScoreEntry theo proposalId, include ScoreDetail, không ownership/grant hoặc kiểm tra đã công bố.
- `backend/src/defense/controller/committee.controller.ts:11–13`; `backend/src/defense/service/committee.service.ts:8–17` đọc council + lecturer/session/room theo termId không scope actor.
- `backend/src/report/controller/export.controller.ts:11`; `backend/src/report/service/export.service.ts:8–16` count dữ liệu toàn hệ thống, không actor/grant.

**Tình huống:** một tài khoản ACTIVE đã đăng nhập, đã đổi mật khẩu nhưng không có quyền grading có thể gọi GET /scores/proposal/:proposalId của hồ sơ khác nếu biết ID. Không có gate publication nên code cũng trả phiếu chưa công bố nếu tồn tại. Hai reader kia có cùng đường bỏ kiểm tra phạm vi.

**Ảnh hưởng:** quyền riêng tư điểm/nhận xét và dữ liệu học vụ chéo hồ sơ/đợt; ẩn route frontend không bảo vệ endpoint. Xếp CRITICAL vì đường truy cập trực tiếp vượt quyền dữ liệu học vụ; không khẳng định hệ thống triển khai đã có bản ghi bị đọc trái phép.

**Hướng xử lý:** permission decorator + service principal/ownership/assignment/grant + chính sách công bố; DTO trả tối thiểu, param validation và regression tests của request có đăng nhập nhưng ngoài phạm vi. Không bật ADMIN bypass. Không chữa bằng cách đổi global guard fail-closed ngay mà chưa kiểm kê endpoint own/auth có chủ đích không decorator.

**Chặn:** có, trước thử với dữ liệu thật hoặc đưa reader grading/council/stats vào UI.

### H01 — HIGH — Topic legacy dùng phạm vi role và nguồn phân công khác workflow mới

**Loại:** nhánh code không nhất quán đã xác nhận; chính sách cho phép quản lý toàn cục trên API Bước 3 cần nhóm xác nhận.

**Vị trí:** `backend/src/topic/service/topic.service.ts:30–48,91–112`: chọn plan đầu tiên có status !== DRAFT; ADMIN/FACULTY qua nhánh manager không đọc AcademicTermGrant. `backend/src/topic/controller/topic.controller.ts` vẫn đăng ký /topics/term/:termId; frontend topic Bước 3 còn gọi. Đối chiếu official assignment ở `guidance/defense-confirmations/defense-confirmation.validator.ts` và quyết định D13–D14 trong `docs/implementation/01-business-decisions-and-contract.md`.

**Tình huống:** actor có role quản lý + topic permission nhưng không có grant đợt vẫn được service list dữ liệu đợt; plan PUBLISHED có thể được dùng trong access thay cho officialAssignmentPlanId + FINALIZED/AssignmentChange. Không khẳng định GVHD cũ sửa được UC17: UC17 có validator riêng đúng nguồn. Với proposal đã handover, `topic/validator/proposal.validator.ts:9–20` chặn sửa trực tiếp, giảm phạm vi write rủi ro.

**Ảnh hưởng:** view Bước 3 có thể hiện advisor/phạm vi khác Bước 4–9; không nên tái sử dụng list này như inbox UC17 authoritative.

**Hướng xử lý:** chốt rõ hợp đồng legacy trước handover; scope quản lý bằng grant, dùng official resolver sau handover; trả trạng thái chưa chính thức thay vì gán tên “chính thức” cho PUBLISHED; test thay advisor và faculty ngoài grant. Không làm mất khả năng chuẩn bị đề tài Bước 3 khi chưa FINALIZED nếu đó là nghiệp vụ đã duyệt.

**Chặn:** có trước tái sử dụng API legacy cho UC17/UC18 hoặc nghiệm thu scope toàn hệ thống.

### H02 — HIGH — Outbox read/retry kiểm permission nhưng không kiểm grant đợt

**Loại:** thiếu kiểm soát phạm vi xác nhận từ code; không chạy gửi mail/retry.

**Vị trí:** `backend/src/notification/controller/notification.controller.ts:83–91` yêu cầu assignment:manage nhưng không lấy actor; `service/notification.service.ts:31–35` chỉ delegate; `repository/notification.repository.ts:29–52` outbox(termId) trả toàn row, retry(id) chuyển FAILED → PENDING không grant.

**Tình huống:** quản lý có assignment:manage được cấp cho công việc tại đợt A biết termId/outboxId của đợt B, đọc payload hoặc yêu cầu gửi lại mà service không xác minh AcademicTermGrant.

**Ảnh hưởng:** dữ liệu thông báo chéo phạm vi và gửi mail ngoài thẩm quyền; không áp dụng kết luận này cho own notifications (đã kiểm userId/ownership).

**Hướng xử lý:** lấy actor ở controller, service xác minh ACTIVE + permission + grant đúng term của outbox, projection payload/lỗi phù hợp; retry/audit trong transaction và negative tests.

**Chặn:** có trước bật chức năng quản trị outbox với nhiều phạm vi dữ liệu.

### H03 — HIGH — Công cụ dọn/reset cũ dùng DATABASE_URL mà không chứng minh DB test riêng

**Loại:** rủi ro vận hành xác nhận từ nội dung script; không chạy, không chứng minh đã mất dữ liệu.

**Vị trí:** `database/scripts/db-client.mjs:11–22` đọc backend environment và chọn DATABASE_URL; `database/scripts/clean-data.mjs:10–16,69,77,112–128` kết nối rồi DELETE nhiều bảng kể cả user/audit; `database/scripts/reset-dev.sh:5` migrate reset --force.

**Tình huống:** người mới chạy script cũ trong workspace đang trỏ development/shared DB, không có ownership marker/URL test riêng hoặc xác nhận danh tính DB.

**Ảnh hưởng:** khả năng xóa dữ liệu ngoài ý muốn hoặc lỗi FK/append-only gây rollback. Trigger hiện có có thể chặn một số delete, nhưng không phải biện pháp bảo vệ nguồn DB và không đảm bảo mọi script an toàn.

**Hướng xử lý:** quy trình test chỉ dùng harness có fail-closed/ownership guard; với script cũ cần guard target rõ ràng, hiển thị host/port/db/user đã che bí mật và kiểm chứng DB được tạo cho suite trước mọi DML/DDL. Không chạy reset để “sửa test”.

**Chặn:** có trước hướng dẫn nhóm tạo/dọn dữ liệu cá nhân bằng các script này; không cản đọc mã hoặc unit test không DB.

### H04 — HIGH — Chưa có chuỗi nghiệp vụ chính UC18 chốt → UC19–24 → xuất Bước 10

**Loại:** gap chức năng xác nhận bằng toàn bộ controller/module inventory; không phải lỗi regression UC17.

**Vị trí:** `backend/src/defense/defense-lists/defense-list.controller.ts:53,67,87` chỉ GET/create/open; `defense/controller/committee.controller.ts:11`, `grading/controller/score.controller.ts:11`, `report/controller/export.controller.ts:11` chỉ reader; `frontend/src/app/router/routes.tsx:272–478` không route defense/grading. Đặc tả `Project_1_06.md:847–965`.

**Tình huống:** nhóm thao tác xong UC17 rồi tìm chức năng chốt danh sách, hội đồng, phân công phản biện, lịch, điểm, công bố, biên bản/kết quả Excel/PDF. Model và prototype không cung cấp các HTTP command hoặc UI chạy thật.

**Ảnh hưởng:** chưa thể nghiệm thu end-to-end Bước 9–10; reader FINALIZED hiện chỉ có thể đọc nguồn chốt được tạo ngoài API/fixture, không có đường vận hành chính thức.

**Hướng xử lý:** theo dependency roadmap mục 10; dùng schema/reader/snapshot đã có, bổ sung producer xét điều kiện và finalization có scope/audit/locks trước downstream. Không suy OPEN/FINALIZED từ ELIGIBLE, PDF hoặc trạng thái phase.

**Chặn:** có đối với tuyên bố hoàn thiện Bước 9–10; không yêu cầu viết lại UC17.

### M01 — MEDIUM — UC17 thiếu inbox chuyên dụng và thông báo Khoa theo use case

**Loại:** gap chức năng xác nhận.

**Vị trí:** `frontend/src/features/guidance/defense-confirmations/page.tsx:31,82–95` dùng proposalId nhập tay và nêu chưa có inbox; `backend/src/guidance/defense-confirmations/defense-confirmation-command.service.ts:241–290` ghi history/audit rồi trả, không gọi notification/outbox. `docs/frontend/source-extracts/Project_1_06.md:843–844` mô tả danh sách SV/summary và thông báo Khoa, nhắc trước hạn là luồng cần chính sách bổ sung.

**Tình huống/ảnh hưởng:** GVHD có thể quyết định khi được cung cấp ID nhưng không có màn hình chọn hồ sơ UC17 hoàn chỉnh; Khoa không nhận sự kiện quyết định từ luồng này. Không dùng “unit PASS” để gọi full UC17 xong.

**Hướng xử lý:** sau khi thống nhất policy, inbox theo official assignment và outbox sự kiện quyết định cùng transaction; reminder có lịch/thẩm quyền chống gửi trùng. Không dùng list mock hoặc /topics legacy làm dữ liệu authoritative.

**Chặn:** không chặn test chi tiết UC17 có ID; có chặn nghiệm thu đầy đủ use case.

### M02 — MEDIUM — Hai engine điểm demo/helper chưa thống nhất nghiệp vụ

**Loại:** khác biệt code xác nhận; chưa có bằng chứng điểm thực bị tính sai vì helper chưa được luồng grading sử dụng.

**Vị trí:** `backend/src/grading/service/score-aggregator.service.ts:18–57`; `backend/src/grading/grading.module.ts:6`; `frontend/src/features/grading/services/grading-service.ts:190–233`; ADR 0003 và `docs/spec/diem-can-xac-nhan.md:40–44`.

**Tình huống:** UC24 mới tái sử dụng isPassed chỉ xét HP; ví dụ QT=4, KTHP=8 tạo HP=6.4 sẽ được helper coi đạt dù điều kiện QT không đạt. Cấu hình QT khác 0.5/0.5, rounding hoặc thành viên vắng cũng cho kết quả khác demo.

**Ảnh hưởng:** hợp đồng điểm không sẵn sàng tái sử dụng nguyên trạng; chưa phải lỗi API tính điểm đang chạy.

**Hướng xử lý:** duyệt contract grading duy nhất ở server/shared: weight, range, completeness/quorum, rounding, điều kiện đạt và publish; test ví dụ tài liệu + biên/missing/weight/điểm thành phần. UI chỉ hiển thị authoritative result.

**Chặn:** có trước triển khai UC24 hoặc bất cứ API ghi/tổng hợp điểm thực.

### M03 — MEDIUM — Chưa có chứng cứ PostgreSQL UC17; I/O PDF nằm trong khóa toàn đợt

**Loại:** thiếu xác minh thực + rủi ro hiệu năng/concurrency cần thử; không kết luận deadlock hoặc timeout đã xảy ra.

**Vị trí:** `backend/test/uc17/README.md:3–9,39–69`; `defense-confirmation-command.repository.ts:25–59,90–100`; `defense-confirmation-command.service.ts:175–190`; `defense-confirmation-report.service.ts:68–164`; `guidance/final-reports/final-report.service.ts:250–286`.

**Tình huống:** storage chậm/PDF lớn khiến download/verify giữ THESIS_TERM FOR UPDATE; request upload/decision khác trong cùng đợt phải chờ, có timeout 15s. FK/trigger append-only, JSONB hash round-trip và rollback trên fault mới chỉ có test viết sẵn, chưa chạy PG.

**Ảnh hưởng:** chưa có bằng chứng các constraint/lock/runtime error mapping tương thích; chưa đo throughput hoặc hold-time, không có số millisecond để báo cáo.

**Hướng xử lý:** chạy đúng suite cô lập sau xác minh target; ghi lock wait/hold, DB deadline sau wait, history/audit rollback, cùng checksum revision mới, pointer/append-only. Chỉ tối ưu I/O/khóa sau kết quả và vẫn bảo toàn identity/ownership; không sửa schema vì suy đoán.

**Chặn:** có trước triển khai với dữ liệu thật; không chặn unit/frontend contract demo.

### M04 — MEDIUM — Backend lint hiện FAIL 6 lỗi test

**Loại:** lỗi quality gate đã chạy thấy thật.

**Vị trí:** 5 file và 6 vị trí ở bảng mục 7 (permissions.spec require, context Function, ReportRequest unused, hai any).

**Tình huống/ảnh hưởng:** CI/chạy pnpm lint fail dù tsc và unit PASS; không có bằng chứng ảnh hưởng runtime nghiệp vụ.

**Hướng xử lý:** chỉ sửa kiểu/import test và bỏ import thừa, chạy lại lint + test liên quan trong một task được duyệt. Không tắt rule toàn dự án để làm xanh.

**Chặn:** có nếu lint là merge gate; không phải lỗi schema hoặc database.

### M05 — MEDIUM — Route UC17/PDF mở cho nhiều role nhưng API detail là giao diện GVHD/sinh viên riêng

**Loại:** UX/policy mismatch xác nhận từ route và service; backend không bị mở rộng quyền.

**Vị trí:** `frontend/src/app/router/route-manifest.ts` entries /guidance/defense-confirm và /guidance/final-report; `defense-confirmations/page.tsx:115–130` tải context/current/history; `final-reports/page.tsx:48` chỉ STUDENT; `backend/src/guidance/defense-confirmations/defense-confirmation-read.service.ts:40–62,70–118`.

**Tình huống:** sinh viên/Khoa có thể thấy route theo manifest nhưng trang thật UC17 tải context GVHD (bị từ chối đúng); sinh viên chỉ được current, không có view tách phù hợp. PDF thật từ chối role không STUDENT dù manifest có giảng viên/Khoa.

**Ảnh hưởng:** điều hướng gây lỗi quyền hoặc trang không dùng được cho nhóm được liệt kê; không được chữa bằng cách cấp quyền context nội bộ cho mọi role.

**Hướng xử lý:** menu và route policy theo mode + viewer; xây view current-only sinh viên, read-only có grant cho Khoa khi được duyệt; link GVHD download qua endpoint UC17, không endpoint sinh viên.

**Chặn:** không chặn GVHD dùng chi tiết hoặc sinh viên upload đúng role; có chặn nghiệm thu UX nhiều vai trò.

### M06 — MEDIUM — Mật khẩu tạo/reset có giá trị dễ dự đoán

**Loại:** rủi ro xác nhận từ chính sách code; không kiểm thử đoán mật khẩu và không in giá trị mật khẩu trong báo cáo.

**Vị trí:** `backend/src/auth/service/account.service.ts:103–110` reset về studentCode hoặc hằng mặc định; `backend/src/catalog/service/lecturer.service.ts:56–63` hash hằng cho tài khoản mới. `common/security/jwt-auth.guard.ts:62–83` có mustChangePassword gate.

**Tình huống/ảnh hưởng:** người biết mã SV hoặc quy ước mặc định có thể là người đăng nhập đầu tiên sau tạo/reset; gate đổi mật khẩu bảo vệ thao tác sau login nhưng không xác định đúng chủ tài khoản tại login đầu. Không khẳng định đã có account bị chiếm.

**Hướng xử lý:** nhóm duyệt cơ chế mật khẩu ngẫu nhiên dùng một lần hoặc activation/reset token có hạn, giao an toàn cho đúng người; vẫn bắt đổi, revoke session/audit và rate-limit. Tách rõ dữ liệu demo với production.

**Chặn:** cần xử lý trước cấp tài khoản thật diện rộng; không thay quy tắc trong lượt audit.

### M07 — MEDIUM — Audit UI và export job trên frontend không phải audit/job authoritative

**Loại:** khoảng trống tích hợp xác nhận, không phải sai dữ liệu audit backend.

**Vị trí:** `frontend/src/features/auth/pages/AuditLogPage.tsx:18–29` đọc db.audits; `features/report/services/report-service.ts:326–398` mutate local tạo/hoàn tất job; `features/auth/pages/RolesPermissionsPage.tsx:22–35` dùng routeManifest. Không có audit-log reader controller trong inventory 154.

**Tình huống/ảnh hưởng:** sau PUT UC17, người quản lý xem /admin/audit-logs không thấy audit transaction trên server; export “hoàn tất” local không có ExportJob/audit server Bước 10. Ma trận route role không xác minh permission/grant database. Không báo hai trang này là công cụ kiểm toán server.

**Hướng xử lý:** nhãn rõ browser/demo/scope Bước 1–3; bổ sung API đọc audit có grant/redaction và server export workflow khi được duyệt, không expose snapshot/file path. Không nối UI trực tiếp database.

**Chặn:** có cho nghiệm thu audit/export Bước 10; không chặn UC17 backend audit đã ghi trong transaction.

### L01 — LOW — Prototype/màn hình guidance legacy chưa được router sử dụng

**Loại:** tổ chức mã/khả năng gây nhầm lẫn xác nhận từ import graph router, không khẳng định toàn bộ file dead code.

**Vị trí:** `frontend/src/features/defense/pages/` (6 file), `features/grading/pages/` (3 file), `features/guidance/pages/{GuidancePlanPage,TaskBoardPage,TaskReviewPage,MeetingLogPage}.tsx`; đối chiếu `app/router/routes.tsx`. `backend/src/grading/grading.module.ts` đăng ký helper nhưng không có consumer tính điểm trong service/controller.

**Tình huống/ảnh hưởng:** đọc tên file tưởng UC19–24/UI đã chạy, hoặc sửa prototype trong khi router dùng feature mới. Services/tests của prototype vẫn có tham chiếu nên không được xóa từ kết luận này.

**Hướng xử lý:** đánh dấu trạng thái/ràng buộc trong tài liệu feature, index route → component → service; chỉ đề xuất archive/gộp sau dependency audit riêng và quyết định nhóm.

**Chặn:** không.

### L02 — LOW — Nhiều lớp tài liệu/schema lịch sử, ADR trùng số và đặc tả mới chưa có index chung

**Loại:** tổ chức tài liệu xác nhận.

**Vị trí:** `docs/adr/0002-do-an-ca-nhan.md` và `0002-nestjs-prisma.md`; `docs/spec/dac-ta-use-case.md` tóm tắt khác bản trích đầy đủ `docs/frontend/source-extracts/Project_1_06.md`; `database/migrations/`, `backend/prisma/review/`, `backend/prisma/migrations/` cùng tồn tại. Các tài liệu/baseline lịch sử không phải danh mục schema active hiện tại có 104 model.

**Tình huống/ảnh hưởng:** dùng sai migration chain hoặc đọc summary để suy rule còn thiếu; quyết định UC17/UC18 mới phân tán giữa README/code/migration và hội thoại.

**Hướng xử lý:** index nguồn authoritative/version áp dụng, chỉ rõ active vs archival và decision log Bước 9; giữ link lịch sử. Không chạy SQL review mang nhãn DO-NOT-APPLY, không đổi tên/xóa migration đã áp dụng.

**Chặn:** không chặn code hiện tại; cần trước bàn giao/onboarding database.

## 9. Chưa thể xác minh và quyết định còn cần nhóm xác nhận

1. **Database thực:** migration 13–16 đã được áp dụng ở đâu, role DB/extension/trigger/constraint và dữ liệu legacy nào tồn tại. Không kết nối, không suy từ schema/client compile hay báo cáo cũ.
2. **PostgreSQL UC17 mới:** 31 case đã viết nhưng chưa có kết quả thật; không có số đo giữ khóa/deadlock/timeout/rollback. Không có bằng chứng PG16/17 cho bốn migration mới.
3. **Auth/quyền triển khai:** seed permission mới và AcademicTermGrant thực tế đã cấp chưa, tài khoản nào ACTIVE, official assignments/roster có nhất quán không. Không chạy seed, không tạo tài khoản.
4. **Frontend runtime:** env/flag và VITE_API_URL trên máy từng người, CORS/private storage filesystem/permissions; chưa mở browser/API thật. .env.example chỉ là template, không chứng minh runtime đã bật flag.
5. **Full use case vs quyết định mới:** nội dung notification/reminder UC17, quyền sinh viên xem nhận xét/history, view Khoa; contract nguồn học vụ và proof eligibility UC18 cần xác nhận. Không suy “đã nộp/CONFIRMED = ELIGIBLE”.
6. **UC18 producer:** toàn đợt đã là quyết định hiện hành; snapshot phải bắt đầu TermStudent, giữ cả hồ sơ thiếu Proposal/PDF/quyết định, tách roster đầy đủ khỏi admitted. Cần rule finalize/reopen, lý do/thẩm quyền, freshness/STALE và policy điều chỉnh sau chốt.
7. **Scoring:** nguồn điểm GVHD, quorum/vắng, rubric, deadline, rounding, trọng số thay sau chốt, phúc tra và công bố; cần contract authoritative trước UC22–24. Không lấy demo service làm văn bản nghiệp vụ.
8. **Lưu trữ/xóa:** history RESTRICT + append-only có chủ đích giữ chứng cứ, chưa có workflow retention/anonymization/xóa đợt được nghiệm thu. Không thấy API delete term/proposal trong inventory; không tự coi các script DELETE cũ là nghiệp vụ xóa hợp lệ.
9. **Vận hành ngoài phạm vi:** dependency CVE/license, full production build, backup/restore, SMTP thật, load test, file-size lớn, UI accessibility và deployment secrets không được kiểm chứng trong lượt audit. Không tuyên bố an toàn từ thiếu evidence.

### Bộ kiểm chứng PostgreSQL cô lập cần làm trước triển khai

Không chạy trong audit. Tái sử dụng `backend/test/uc17/` thay vì viết lại, sau xác minh host/port/database/user + ownership marker, URL test riêng không fallback DATABASE_URL:

- Replay chuỗi active trên DB rỗng và upgrade có legacy; không giả history/backfill; kiểm extension, unique/CHECK/revision/FK.
- INSERT history/finalization được; UPDATE/DELETE/TRUNCATE kể cả cascade bị chặn; pointer sai term/revision bị chặn; DRAFT/OPEN/FINALIZED/reopen-state transitions theo CHECK.
- Hai kết nối độc lập và barrier chủ động: hai PUT cùng revision một thành công; cả hai thứ tự PDF upload ↔ decision; cùng checksum/revision mới; download identity cũ 409.
- Fault history/audit rollback decision; no-op không qua permission/window/UC18; deadline dùng DB clock sau chờ khóa; lock_timeout, interactive timeout và deadlock detection tách khỏi khẳng định app deadlock.
- JSONB canonical SHA-256 round-trip/roster uniqueness/completeness; FINALIZED lịch sử vẫn hợp lệ sau PDF/roster đổi. Fixture chốt dưới parent lock **không phải kiểm thử API FINALIZE**.
- Cleanup không xóa asset đang tham chiếu, rollback upload giữ bản cũ, đo thời gian giữ khóa/file I/O và công bố cả artificial delay nếu dùng.

Yêu cầu “không Docker” áp dụng lượt audit này: không khởi động runner Docker. Tương lai chỉ chọn môi trường test cô lập đã được duyệt; nếu không có thì tiếp tục ghi NOT RUN, không dùng database chung thay thế.

## 10. Roadmap theo rủi ro và phụ thuộc

### 10.1. Phần có thể giữ và tái sử dụng

Giữ JWT/session/RBAC, grant/official assignment resolver của workflow mới, transaction audit, shared contracts Bước 4–8, private storage/validator/checksum, FinalReport revision/cleanup, hai window độc lập, lõi UC17 PUT/GET/history/download, UC18 neutral port/Prisma reader/canonical snapshot V1 và DRAFT/OPEN. Có unit test và evidence Bước 1–8; không cần viết lại chỉ vì Bước 9–10 còn thiếu.

### 10.2. Các giai đoạn triển khai

1. **Authorization và gate trước dữ liệu thật:** xử lý C01, H01, H02 với negative tests và chính sách phạm vi rõ; chặn dùng công cụ phá hủy không guard (H03); sửa lint gate M04 trong phạm vi test. Không cấp quyền rộng để né lỗi frontend.
2. **Kiểm chứng nền Bước 9:** chuẩn bị target PostgreSQL cá nhân/test được xác minh; chạy suite hiện có, ghi PASS/FAIL/NOT RUN đúng thực tế, kiểm FS private/checksum/cleanup và đo lock. Không migrate/seed database chung.
3. **Khép UC17 và chuẩn bị UC18:** inbox official advisor, view phù hợp từng nhóm và notification audit/outbox khi được duyệt; giữ expectedContext/revision của GET→PUT. Bổ sung UI quản trị cửa sổ và DRAFT/OPEN theo permission/grant.
4. **UC18 producer:** đọc roster đầy đủ + context/evidence học vụ, preview/đối soát, eligibility có nguồn chính thức; finalize snapshot/version/hash/audit dưới cùng giao thức parent lock; reopen có lý do/permission/allDepartments. Tích hợp freshness STALE, không tự thay đổi UC17/PDF.
5. **UC19 → UC20 → UC21:** council/membership và phân bổ, reviewer assignment khác GVHD, room/session/lịch publish; controller/service/repository/DTO/permission/grant/audit/test, sau đó UI thật. Không tái sử dụng review group/proposal review như defense entities.
6. **UC22–23 → UC24:** duyệt contract scoring trước; phiếu GVHD/GVPB/hội đồng + biên bản; completeness/quorum/weights/rounding; aggregate/lock/publish và amendment có audit; student chỉ xem khi công bố.
7. **UC25/Bước 10:** export Excel đúng cột QT/KTHP/HP/danh sách chính thức, PDF biên bản đã duyệt; job/audit server, scope grant, dữ liệu từ bản chốt/điểm công bố; UI không đánh đồng export Bước 1–3.

Mỗi giai đoạn cần test đúng tầng; unit xanh là điều kiện cần, không thay nghiệm thu PostgreSQL hoặc browser thật.

## 11. Đúng một nhiệm vụ nên làm ngay tiếp theo

**Đóng lỗ hổng authorization của GET /api/scores/proposal/:proposalId (phần đọc điểm trong C01).**

Phạm vi nhỏ: duyệt chính sách đọc điểm theo actor/permission/ownership/grant và trạng thái công bố, rồi bổ sung controller/service policy cùng negative regression tests. Không mở rộng sang API nhập/tổng hợp điểm hoặc UC18 FINALIZE.

Tiêu chí hoàn thành: request đã đăng nhập nhưng thiếu permission/ngoài hồ sơ/ngoài grant không lấy được điểm; sinh viên không xem điểm chưa công bố; người được phép chỉ nhận DTO tối thiểu; không ADMIN bypass; tsc/lint/test liên quan và unit backend PASS. Chính sách nào chưa được đặc tả phải được chốt trước, không mặc định mọi LECTURER/FACULTY được đọc.

**Audit dừng ở báo cáo; chưa thực hiện nhiệm vụ này.**

## Phụ lục A. Danh mục 154 HTTP handler đã đăng ký

Tất cả path dưới đây dùng API_PREFIX mặc định /api; nếu cấu hình đổi prefix thì path runtime thay đổi. Dòng là decorator method trong controller. Cột permission chỉ thể hiện decorator khai báo, **không chứng minh policy service**; dấu “—” có thể là public/auth/own route có kiểm tra khác, không tự coi mọi dấu “—” là lỗ hổng. C01 được xác nhận thêm tại service/guard.


| # | Miền/controller | Method | Endpoint | Permission decorator | Bằng chứng file:dòng |
|---|---|---|---|---|---|
| 1 | AccountController | GET | `/api/accounts` | account:read | `backend/src/auth/controller/account.controller.ts:26` |
| 2 | AccountController | POST | `/api/accounts` | account:create | `backend/src/auth/controller/account.controller.ts:42` |
| 3 | AccountController | PATCH | `/api/accounts/:id` | account:update | `backend/src/auth/controller/account.controller.ts:51` |
| 4 | AccountController | PATCH | `/api/accounts/:id/status` | account:lock | `backend/src/auth/controller/account.controller.ts:61` |
| 5 | AccountController | POST | `/api/accounts/:id/reset-password` | account:update | `backend/src/auth/controller/account.controller.ts:70` |
| 6 | AuthController | POST | `/api/auth/login` | — | `backend/src/auth/controller/auth.controller.ts:20` |
| 7 | AuthController | GET | `/api/auth/me` | — | `backend/src/auth/controller/auth.controller.ts:38` |
| 8 | AuthController | POST | `/api/auth/change-password` | — | `backend/src/auth/controller/auth.controller.ts:43` |
| 9 | AuthController | PATCH | `/api/auth/profile` | — | `backend/src/auth/controller/auth.controller.ts:60` |
| 10 | AuthController | POST | `/api/auth/refresh` | — | `backend/src/auth/controller/auth.controller.ts:67` |
| 11 | AuthController | POST | `/api/auth/logout` | — | `backend/src/auth/controller/auth.controller.ts:73` |
| 12 | ImportController | GET | `/api/imports/students/template` | student:import | `backend/src/catalog/controller/import.controller.ts:33` |
| 13 | ImportController | POST | `/api/imports/students/preview` | student:import | `backend/src/catalog/controller/import.controller.ts:49` |
| 14 | ImportController | GET | `/api/imports/:id` | student:import | `backend/src/catalog/controller/import.controller.ts:65` |
| 15 | ImportController | POST | `/api/imports/:id/confirm` | student:import | `backend/src/catalog/controller/import.controller.ts:70` |
| 16 | LecturerController | GET | `/api/lecturers` | lecturer:read | `backend/src/catalog/controller/lecturer.controller.ts:25` |
| 17 | LecturerController | GET | `/api/lecturers/:id` | lecturer:read | `backend/src/catalog/controller/lecturer.controller.ts:32` |
| 18 | LecturerController | POST | `/api/lecturers` | catalog:manage | `backend/src/catalog/controller/lecturer.controller.ts:37` |
| 19 | LecturerController | PATCH | `/api/lecturers/:id` | lecturer:update | `backend/src/catalog/controller/lecturer.controller.ts:42` |
| 20 | ReferenceController | GET | `/api/departments` | catalog:read | `backend/src/catalog/controller/reference.controller.ts:23` |
| 21 | ReferenceController | GET | `/api/training-systems` | catalog:read | `backend/src/catalog/controller/reference.controller.ts:28` |
| 22 | ReferenceController | GET | `/api/research-areas` | catalog:read | `backend/src/catalog/controller/reference.controller.ts:33` |
| 23 | ReferenceController | POST | `/api/departments` | catalog:manage | `backend/src/catalog/controller/reference.controller.ts:36` |
| 24 | ReferenceController | POST | `/api/training-systems` | catalog:manage | `backend/src/catalog/controller/reference.controller.ts:46` |
| 25 | ReferenceController | POST | `/api/research-areas` | catalog:manage | `backend/src/catalog/controller/reference.controller.ts:56` |
| 26 | ReferenceController | PATCH | `/api/departments/:id` | catalog:manage | `backend/src/catalog/controller/reference.controller.ts:66` |
| 27 | ReferenceController | PATCH | `/api/training-systems/:id` | catalog:manage | `backend/src/catalog/controller/reference.controller.ts:77` |
| 28 | ReferenceController | PATCH | `/api/research-areas/:id` | catalog:manage | `backend/src/catalog/controller/reference.controller.ts:88` |
| 29 | StudentController | GET | `/api/students` | student:read | `backend/src/catalog/controller/student.controller.ts:25` |
| 30 | StudentController | GET | `/api/students/:id` | student:read | `backend/src/catalog/controller/student.controller.ts:32` |
| 31 | StudentController | POST | `/api/students` | catalog:manage | `backend/src/catalog/controller/student.controller.ts:37` |
| 32 | StudentController | PATCH | `/api/students/:id` | catalog:manage | `backend/src/catalog/controller/student.controller.ts:42` |
| 33 | CommitteeController | GET | `/api/committees/term/:termId` | — | `backend/src/defense/controller/committee.controller.ts:11` |
| 34 | DefenseListController | GET | `/api/terms/:termId/defense-list` | defense-list:read | `backend/src/defense/defense-lists/defense-list.controller.ts:53` |
| 35 | DefenseListController | POST | `/api/terms/:termId/defense-list` | defense-list:manage | `backend/src/defense/defense-lists/defense-list.controller.ts:67` |
| 36 | DefenseListController | POST | `/api/terms/:termId/defense-list/open` | defense-list:manage | `backend/src/defense/defense-lists/defense-list.controller.ts:87` |
| 37 | ScoreController | GET | `/api/scores/proposal/:proposalId` | — | `backend/src/grading/controller/score.controller.ts:11` |
| 38 | TaskController | GET | `/api/tasks/plan/:planId` | guidance:read | `backend/src/guidance/controller/task.controller.ts:17` |
| 39 | DefenseConfirmationReadController | GET | `/api/proposals/:proposalId/defense-confirmation-context` | defense-confirmation:read | `backend/src/guidance/defense-confirmations/defense-confirmation-read.controller.ts:31` |
| 40 | DefenseConfirmationReadController | GET | `/api/proposals/:proposalId/defense-confirmation` | defense-confirmation:read | `backend/src/guidance/defense-confirmations/defense-confirmation-read.controller.ts:46` |
| 41 | DefenseConfirmationReadController | GET | `/api/proposals/:proposalId/defense-confirmation/history` | defense-confirmation:read | `backend/src/guidance/defense-confirmations/defense-confirmation-read.controller.ts:61` |
| 42 | DefenseConfirmationReportController | GET | `/api/proposals/:proposalId/defense-confirmation/report/download` | defense-confirmation:read | `backend/src/guidance/defense-confirmations/defense-confirmation-report.controller.ts:35` |
| 43 | DefenseConfirmationController | PUT | `/api/proposals/:proposalId/defense-confirmation` | defense-confirmation:decide | `backend/src/guidance/defense-confirmations/defense-confirmation.controller.ts:32` |
| 44 | FinalReportController | GET | `/api/proposals/:proposalId/final-report-context` | submission:read | `backend/src/guidance/final-reports/final-report.controller.ts:103` |
| 45 | FinalReportController | GET | `/api/proposals/:proposalId/final-report` | submission:read | `backend/src/guidance/final-reports/final-report.controller.ts:113` |
| 46 | FinalReportController | PUT | `/api/proposals/:proposalId/final-report` | submission:create | `backend/src/guidance/final-reports/final-report.controller.ts:123` |
| 47 | FinalReportController | GET | `/api/proposals/:proposalId/final-report/download` | submission:download | `backend/src/guidance/final-reports/final-report.controller.ts:158` |
| 48 | ProgressReviewController | GET | `/api/guidance-review-options/terms` | guidance:read | `backend/src/guidance/reviews/progress-review.controller.ts:74` |
| 49 | ProgressReviewController | GET | `/api/task-submissions/:id/review-context` | submission:read | `backend/src/guidance/reviews/progress-review.controller.ts:86` |
| 50 | ProgressReviewController | POST | `/api/task-submissions/:id/reviews` | task:review | `backend/src/guidance/reviews/progress-review.controller.ts:91` |
| 51 | ProgressReviewController | POST | `/api/task-reviews/:id/amendments` | task:review | `backend/src/guidance/reviews/progress-review.controller.ts:108` |
| 52 | ProgressReviewController | GET | `/api/terms/:termId/progress-review-inbox` | task:review | `backend/src/guidance/reviews/progress-review.controller.ts:131` |
| 53 | ProgressReviewController | GET | `/api/terms/:termId/guidance-dashboard` | guidance:monitor | `backend/src/guidance/reviews/progress-review.controller.ts:141` |
| 54 | ProgressReviewController | GET | `/api/guidance-plans/:id/meetings` | guidance:read | `backend/src/guidance/reviews/progress-review.controller.ts:151` |
| 55 | ProgressReviewController | POST | `/api/guidance-plans/:id/meetings` | guidance:manage | `backend/src/guidance/reviews/progress-review.controller.ts:161` |
| 56 | ProgressReviewController | PATCH | `/api/guidance-meetings/:id` | guidance:manage | `backend/src/guidance/reviews/progress-review.controller.ts:192` |
| 57 | SubmissionController | GET | `/api/tasks/:taskId/submission-context` | submission:read | `backend/src/guidance/submissions/submission.controller.ts:113` |
| 58 | SubmissionController | POST | `/api/tasks/:taskId/submission-uploads` | submission:create | `backend/src/guidance/submissions/submission.controller.ts:118` |
| 59 | SubmissionController | POST | `/api/tasks/:taskId/submissions` | submission:create | `backend/src/guidance/submissions/submission.controller.ts:151` |
| 60 | SubmissionController | GET | `/api/tasks/:taskId/submissions` | submission:read | `backend/src/guidance/submissions/submission.controller.ts:185` |
| 61 | SubmissionController | GET | `/api/task-submissions/:submissionId` | submission:read | `backend/src/guidance/submissions/submission.controller.ts:195` |
| 62 | SubmissionController | GET | `/api/task-submissions/:submissionId/files/:fileId/download` | submission:download | `backend/src/guidance/submissions/submission.controller.ts:200` |
| 63 | GuidanceController | GET | `/api/proposals/:proposalId/guidance-context` | guidance:read | `backend/src/guidance/tasks/guidance.controller.ts:77` |
| 64 | GuidanceController | GET | `/api/proposals/:proposalId/guidance-plan` | guidance:read | `backend/src/guidance/tasks/guidance.controller.ts:86` |
| 65 | GuidanceController | POST | `/api/proposals/:proposalId/guidance-plan` | guidance:manage | `backend/src/guidance/tasks/guidance.controller.ts:91` |
| 66 | GuidanceController | PATCH | `/api/guidance-plans/:planId` | guidance:manage | `backend/src/guidance/tasks/guidance.controller.ts:115` |
| 67 | GuidanceController | POST | `/api/guidance-plans/:planId/resume` | guidance:manage | `backend/src/guidance/tasks/guidance.controller.ts:138` |
| 68 | GuidanceController | GET | `/api/guidance-plans/:planId/tasks` | guidance:read | `backend/src/guidance/tasks/guidance.controller.ts:168` |
| 69 | GuidanceController | GET | `/api/terms/:termId/guidance-tasks` | guidance:read | `backend/src/guidance/tasks/guidance.controller.ts:181` |
| 70 | GuidanceController | GET | `/api/terms/:termId/guidance-periods` | guidance:read | `backend/src/guidance/tasks/guidance.controller.ts:194` |
| 71 | GuidanceController | GET | `/api/terms/:termId/weekly-report-coverage` | guidance:read | `backend/src/guidance/tasks/guidance.controller.ts:199` |
| 72 | GuidanceController | POST | `/api/weekly-report-obligations/:id/task` | task:ensure-weekly | `backend/src/guidance/tasks/guidance.controller.ts:212` |
| 73 | GuidanceController | POST | `/api/guidance-plans/:planId/tasks` | task:manage | `backend/src/guidance/tasks/guidance.controller.ts:234` |
| 74 | GuidanceController | GET | `/api/tasks/:id` | guidance:read | `backend/src/guidance/tasks/guidance.controller.ts:269` |
| 75 | GuidanceController | PATCH | `/api/tasks/:id` | task:manage | `backend/src/guidance/tasks/guidance.controller.ts:274` |
| 76 | GuidanceController | POST | `/api/tasks/:id/progress` | task:progress | `backend/src/guidance/tasks/guidance.controller.ts:302` |
| 77 | GuidanceController | POST | `/api/tasks/:id/cancel` | task:manage | `backend/src/guidance/tasks/guidance.controller.ts:326` |
| 78 | HealthController | GET | `/api/health` | — | `backend/src/health.controller.ts:8` |
| 79 | NotificationController | GET | `/api/notifications/user/:userId` | — | `backend/src/notification/controller/notification.controller.ts:37` |
| 80 | NotificationController | GET | `/api/me/notifications` | — | `backend/src/notification/controller/notification.controller.ts:48` |
| 81 | NotificationController | POST | `/api/me/notifications/:id/read` | — | `backend/src/notification/controller/notification.controller.ts:56` |
| 82 | NotificationController | GET | `/api/notifications/me` | notification:own | `backend/src/notification/controller/notification.controller.ts:64` |
| 83 | NotificationController | PATCH | `/api/notifications/me/read` | notification:own | `backend/src/notification/controller/notification.controller.ts:69` |
| 84 | NotificationController | PATCH | `/api/notifications/:id/read` | notification:own | `backend/src/notification/controller/notification.controller.ts:74` |
| 85 | NotificationController | GET | `/api/notifications/outbox/term/:termId` | assignment:manage | `backend/src/notification/controller/notification.controller.ts:83` |
| 86 | NotificationController | POST | `/api/notifications/outbox/:id/retry` | assignment:manage | `backend/src/notification/controller/notification.controller.ts:88` |
| 87 | AssignmentController | GET | `/api/assignments/term/:termId/plan` | assignment:manage | `backend/src/registration/controller/assignment.controller.ts:39` |
| 88 | AssignmentController | GET | `/api/assignments/term/:termId/results` | assignment:read | `backend/src/registration/controller/assignment.controller.ts:47` |
| 89 | AssignmentController | POST | `/api/assignments/term/:termId/preview` | assignment:manage | `backend/src/registration/controller/assignment.controller.ts:55` |
| 90 | AssignmentController | PUT | `/api/assignments/term/:termId/draft` | assignment:manage | `backend/src/registration/controller/assignment.controller.ts:63` |
| 91 | AssignmentController | PUT | `/api/assignments/term/:termId/manual` | assignment:manage | `backend/src/registration/controller/assignment.controller.ts:72` |
| 92 | AssignmentController | POST | `/api/assignments/term/:termId/publish` | assignment:manage | `backend/src/registration/controller/assignment.controller.ts:81` |
| 93 | AssignmentController | POST | `/api/assignments/term/:termId/finalize` | assignment:manage | `backend/src/registration/controller/assignment.controller.ts:90` |
| 94 | RegistrationController | GET | `/api/registrations` | registration:read | `backend/src/registration/controller/registration.controller.ts:50` |
| 95 | RegistrationController | GET | `/api/registrations/term/:termId` | registration:read | `backend/src/registration/controller/registration.controller.ts:56` |
| 96 | RegistrationController | GET | `/api/registrations/term/:termId/me` | registration:own | `backend/src/registration/controller/registration.controller.ts:63` |
| 97 | RegistrationController | PUT | `/api/registrations/term/:termId/me/draft` | registration:own | `backend/src/registration/controller/registration.controller.ts:74` |
| 98 | RegistrationController | POST | `/api/registrations/term/:termId/me/submit` | registration:own | `backend/src/registration/controller/registration.controller.ts:87` |
| 99 | ExportController | GET | `/api/reports/stats` | — | `backend/src/report/controller/export.controller.ts:11` |
| 100 | AcademicSemesterController | GET | `/api/semesters` | term:read | `backend/src/term/controller/academic-semester.controller.ts:21` |
| 101 | AcademicSemesterController | POST | `/api/semesters` | term:create | `backend/src/term/controller/academic-semester.controller.ts:32` |
| 102 | ThesisTermController | GET | `/api/terms` | term:read | `backend/src/term/controller/thesis-term.controller.ts:51` |
| 103 | ThesisTermController | GET | `/api/terms/latest` | term:read | `backend/src/term/controller/thesis-term.controller.ts:60` |
| 104 | ThesisTermController | GET | `/api/terms/:id` | term:read | `backend/src/term/controller/thesis-term.controller.ts:74` |
| 105 | ThesisTermController | GET | `/api/terms/:id/operation-window` | term:read | `backend/src/term/controller/thesis-term.controller.ts:80` |
| 106 | ThesisTermController | POST | `/api/terms` | term:create | `backend/src/term/controller/thesis-term.controller.ts:90` |
| 107 | ThesisTermController | PATCH | `/api/terms/:id` | term:update | `backend/src/term/controller/thesis-term.controller.ts:102` |
| 108 | ThesisTermController | PATCH | `/api/terms/:id/status` | term:transition | `backend/src/term/controller/thesis-term.controller.ts:112` |
| 109 | ThesisTermController | PATCH | `/api/terms/:id/lock` | term:lock | `backend/src/term/controller/thesis-term.controller.ts:125` |
| 110 | ThesisTermController | PUT | `/api/terms/:id/phases` | term:plan | `backend/src/term/controller/thesis-term.controller.ts:137` |
| 111 | ThesisTermController | PUT | `/api/terms/:id/parameters` | term:parameters | `backend/src/term/controller/thesis-term.controller.ts:150` |
| 112 | ThesisTermController | PUT | `/api/terms/:id/roster` | term:roster | `backend/src/term/controller/thesis-term.controller.ts:163` |
| 113 | DefenseConfirmationWindowController | GET | `/api/terms/:termId/defense-confirmation-window` | term:read | `backend/src/term/defense-confirmation-window/defense-confirmation-window.controller.ts:42` |
| 114 | DefenseConfirmationWindowController | PUT | `/api/terms/:termId/defense-confirmation-window` | term:plan | `backend/src/term/defense-confirmation-window/defense-confirmation-window.controller.ts:56` |
| 115 | FinalReportWindowController | GET | `/api/terms/:termId/final-report-submission-window` | term:read | `backend/src/term/final-report-submission/final-report-window.controller.ts:42` |
| 116 | FinalReportWindowController | PUT | `/api/terms/:termId/final-report-submission-window` | term:plan | `backend/src/term/final-report-submission/final-report-window.controller.ts:55` |
| 117 | TopicController | GET | `/api/topics/term/:termId` | topic:read | `backend/src/topic/controller/topic.controller.ts:38` |
| 118 | TopicController | PUT | `/api/topics/term/:termId/student/:studentId/draft` | topic:write | `backend/src/topic/controller/topic.controller.ts:46` |
| 119 | TopicController | POST | `/api/topics/term/:termId/student/:studentId/submit` | topic:write | `backend/src/topic/controller/topic.controller.ts:57` |
| 120 | TopicController | POST | `/api/topics/:id/agree` | topic:write | `backend/src/topic/controller/topic.controller.ts:68` |
| 121 | TopicController | POST | `/api/topics/:id/prepare-workflow` | topic:write | `backend/src/topic/controller/topic.controller.ts:79` |
| 122 | TopicController | GET | `/api/topics/:id/versions/:version/pdf` | topic:read | `backend/src/topic/controller/topic.controller.ts:87` |
| 123 | DossierController | GET | `/api/proposals/:proposalId/dossier` | proposal:read | `backend/src/topic/proposal-dossiers/dossier.controller.ts:64` |
| 124 | DossierController | POST | `/api/proposals/:proposalId/finalize` | proposal:finalize | `backend/src/topic/proposal-dossiers/dossier.controller.ts:73` |
| 125 | DossierController | POST | `/api/proposals/:proposalId/dossier/receipt` | dossier:receive | `backend/src/topic/proposal-dossiers/dossier.controller.ts:104` |
| 126 | DossierController | POST | `/api/proposals/:proposalId/dossier/pdf` | proposal:export | `backend/src/topic/proposal-dossiers/dossier.controller.ts:127` |
| 127 | DossierController | GET | `/api/proposals/:proposalId/dossier.pdf` | proposal:export | `backend/src/topic/proposal-dossiers/dossier.controller.ts:155` |
| 128 | ProposalReviewController | GET | `/api/proposal-review-options/terms` | proposal:read | `backend/src/topic/proposal-reviews/proposal-review.controller.ts:80` |
| 129 | ProposalReviewController | GET | `/api/terms/:termId/proposal-review-options` | proposal:read | `backend/src/topic/proposal-reviews/proposal-review.controller.ts:85` |
| 130 | ProposalReviewController | GET | `/api/terms/:termId/proposals` | proposal:read | `backend/src/topic/proposal-reviews/proposal-review.controller.ts:90` |
| 131 | ProposalReviewController | GET | `/api/proposals/:id` | proposal:read | `backend/src/topic/proposal-reviews/proposal-review.controller.ts:103` |
| 132 | ProposalReviewController | GET | `/api/proposals/:id/review-candidates` | proposal:assign | `backend/src/topic/proposal-reviews/proposal-review.controller.ts:112` |
| 133 | ProposalReviewController | GET | `/api/proposals/:id/review-history` | proposal:read | `backend/src/topic/proposal-reviews/proposal-review.controller.ts:121` |
| 134 | ProposalReviewController | GET | `/api/proposal-reviews/:id` | proposal:read | `backend/src/topic/proposal-reviews/proposal-review.controller.ts:126` |
| 135 | ProposalReviewController | POST | `/api/proposals/:id/review-assignments` | proposal:assign | `backend/src/topic/proposal-reviews/proposal-review.controller.ts:131` |
| 136 | ProposalReviewController | POST | `/api/proposal-reviews/:id/start` | proposal:review | `backend/src/topic/proposal-reviews/proposal-review.controller.ts:156` |
| 137 | ProposalReviewController | POST | `/api/proposal-reviews/:id/comments` | proposal:comment | `backend/src/topic/proposal-reviews/proposal-review.controller.ts:178` |
| 138 | ProposalReviewController | POST | `/api/proposal-reviews/:id/decision` | proposal:review | `backend/src/topic/proposal-reviews/proposal-review.controller.ts:203` |
| 139 | ProposalVersionController | GET | `/api/proposals/:proposalId/editing-context` | proposal:read | `backend/src/topic/proposal-versions/proposal-version.controller.ts:75` |
| 140 | ProposalVersionController | GET | `/api/proposals/:proposalId/versions` | proposal:read | `backend/src/topic/proposal-versions/proposal-version.controller.ts:84` |
| 141 | ProposalVersionController | GET | `/api/proposals/:proposalId/versions/compare` | proposal:read | `backend/src/topic/proposal-versions/proposal-version.controller.ts:97` |
| 142 | ProposalVersionController | GET | `/api/proposals/:proposalId/versions/:versionId` | proposal:read | `backend/src/topic/proposal-versions/proposal-version.controller.ts:113` |
| 143 | ProposalVersionController | POST | `/api/proposals/:proposalId/versions` | proposal:edit | `backend/src/topic/proposal-versions/proposal-version.controller.ts:122` |
| 144 | ProposalVersionController | POST | `/api/proposals/:proposalId/submit` | proposal:submit | `backend/src/topic/proposal-versions/proposal-version.controller.ts:163` |
| 145 | ReviewGroupController | GET | `/api/review-group-options/terms` | review-group:read | `backend/src/topic/review-groups/review-group.controller.ts:85` |
| 146 | ReviewGroupController | GET | `/api/terms/:termId/review-group-options` | review-group:read | `backend/src/topic/review-groups/review-group.controller.ts:94` |
| 147 | ReviewGroupController | GET | `/api/terms/:termId/review-groups` | review-group:read | `backend/src/topic/review-groups/review-group.controller.ts:108` |
| 148 | ReviewGroupController | GET | `/api/review-groups/:id` | review-group:read | `backend/src/topic/review-groups/review-group.controller.ts:124` |
| 149 | ReviewGroupController | GET | `/api/review-groups/:id/members` | review-group:read | `backend/src/topic/review-groups/review-group.controller.ts:132` |
| 150 | ReviewGroupController | POST | `/api/terms/:termId/review-groups` | review-group:manage | `backend/src/topic/review-groups/review-group.controller.ts:138` |
| 151 | ReviewGroupController | PATCH | `/api/review-groups/:id` | review-group:manage | `backend/src/topic/review-groups/review-group.controller.ts:177` |
| 152 | ReviewGroupController | POST | `/api/review-groups/:id/members` | review-group:manage | `backend/src/topic/review-groups/review-group.controller.ts:214` |
| 153 | ReviewGroupController | DELETE | `/api/review-groups/:id/members/:lecturerId` | review-group:manage | `backend/src/topic/review-groups/review-group.controller.ts:248` |
| 154 | ReviewGroupController | DELETE | `/api/review-groups/:id` | review-group:manage | `backend/src/topic/review-groups/review-group.controller.ts:273` |

## Phụ lục B. Chỉ mục chứng cứ và giới hạn thay đổi

- Router: `frontend/src/app/router/routes.tsx`; manifest: `route-manifest.ts`.
- Backend registration: `backend/src/app.module.ts` và 16 module con/hạ tầng ở bảng 3.1; danh mục endpoint phụ lục A không có handler orphan.
- Hợp đồng UC17: `backend/src/guidance/defense-confirmations/{defense-confirmation.dto.ts,defense-confirmation.types.ts,defense-confirmation-read.dto.ts,defense-confirmation-report.dto.ts}`; frontend `features/guidance/defense-confirmations/{api.ts,types.ts,validation.ts,actions.ts}`.
- Hợp đồng PDF: `backend/src/guidance/final-reports/{final-report.dto.ts,final-report.validator.ts,final-report-policy.ts}`; frontend `features/guidance/final-reports/{api.ts,contracts.ts,validation.ts,actions.ts}`.
- UC18: `backend/src/common/contracts/uc18-finalization.port.ts`, `common/uc18-finalization/{uc18-finalization.module.ts,prisma-uc18-finalization.reader.ts,uc18-finalization.repository.ts,uc18-finalization.validator.ts,defense-list-snapshot.ts}`, `defense/defense-lists/`.
- Test mới chạy là các lệnh ghi mục 7; evidence JSON/ảnh/PDF lịch sử chỉ được đọc để phân loại tầng kiểm thử, không được sửa hoặc tái tạo.
- Các thay đổi/untracked có sẵn ở schema/migration/UC17/PDF/frontend/test trước audit không được stage/revert hoặc quy cho lượt này.
- **Chỉ tạo `docs/audits/project-audit-step9-10.md`; không thay đổi code/config/schema/migration, không database, không Docker.**
