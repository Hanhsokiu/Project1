# Gói E — Implementation chính thức UC18–UC21

Ngày: 28/10/2026. Workspace: `C:\DATN\Project1`.

Phạm vi nghiệp vụ là **MVP D1–D5 do người dùng duyệt cho đồ án** trong yêu cầu Gói E, không tự nhận là quy định hành chính chính thức của Khoa. Đã đối chiếu working tree, unblock plan, báo cáo gói A/B/C, đặc tả DOCX/bản trích UC18–21 và các tài liệu được yêu cầu. Những BLOCKED nghiệp vụ cũ trong báo cáo B/C được thay bằng chính sách MVP của lượt này; không sửa lại báo cáo lịch sử để giả rằng chức năng đã tồn tại từ trước.

**Database: SQL NOT EXECUTED. Không kết nối bất kỳ PostgreSQL instance nào.** Chỉ tạo schema/migration để review; Prisma validate/generate dùng URL kiểm tra riêng `127.0.0.1:1`, không dùng URL ứng dụng. Hai lệnh này chỉ parse/generate client, không áp dụng schema/database.

## 1. Trạng thái và luồng đã triển khai

Đánh giá DONE bên dưới chỉ áp dụng **mức code và mock tests đã chạy**; chưa nghiệm thu PostgreSQL, browser E2E hoặc dữ liệu thật. Các ca ngoài MVP không được biến thành nhánh bypass để chạy demo.

| UC   | Trạng thái implementation MVP | Chức năng                                                                                                                                                                                                               |
| ---- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UC18 | DONE — code/mock              | Chứng cứ học vụ thủ công append-only theo TermStudent; policy bốn mốc riêng và CAS; full roster/eligibility có lý do; FINALIZE snapshot V2/hash; REOPEN chỉ trước downstream official; reader V1/V2 và lịch sử bản chốt |
| UC19 | DONE — code/mock              | Lưu/nạp draft server, sửa phương án; chốt cơ cấu/coverage/sức chứa/collision GVHD trên nguồn UC18 V2 hiện hành; artifact bất biến                                                                                       |
| UC20 | DONE — code/mock              | Lưu/nạp draft GVPB; đúng một GVPB mỗi hồ sơ admitted, active TermLecturer, khác GVHD; gợi ý ít tải/tie-break ổn định; chốt/audit/thông báo in-app atomic                                                                |
| UC21 | DONE — code/mock              | Chuẩn bị draft sau UC19; chốt/công bố chỉ sau UC20; kiểm tra tài nguyên xuyên đợt; publication/amendment version mới; đọc lịch PUBLISHED theo quan hệ/grant                                                             |

Luồng: **tạo DRAFT → cấu hình policy → mở xét OPEN → ghi chứng cứ → đối soát full roster → chốt UC18 → lưu/chốt hội đồng → lưu/chốt GVPB → lưu/chốt/công bố lịch → amendment bằng version mới**. Sau create/open hoặc command, frontend tải lại dữ liệu backend. Không dùng React state, preview hoặc record legacy làm bằng chứng đã lưu/chốt.

## 2. Nguồn dữ liệu và điều kiện

- Bắt đầu từ **toàn bộ TermStudent**, không từ danh sách Proposal. Thiếu Proposal/PDF/quyết định/học vụ vẫn có dòng và lý do loại. `admitted` là tập con riêng, không bỏ sinh viên bị loại để làm roster có vẻ hoàn chỉnh.
- Chứng cứ học vụ hiện hành là revision cao nhất của stream đúng term/member/student, có sourceReference, verdict, note, actor/time, schema version và hash xác minh lại. Flag Student.academicEligible/GPA/note legacy không phải chứng cứ. `SPECIAL` không có override; thiếu/không đạt/chưa xác minh đều không admit.
- CONFIRMED chỉ được dùng khi quyết định RECORDED, actor là GVHD hiện hành, assignment/revision và PDF identity khớp, metadata và bytes private PDF được xác minh. PENDING, legacy, invalid, actor sai, PDF/assignment đổi đều có lý do loại; tiến độ chưa hoàn thành không được thêm làm hard gate.
- GVHD lấy qua validator UC17 hiện có: TermWorkflow.officialAssignmentPlanId → AssignmentPlan FINALIZED → AdvisorAssignment + AssignmentChange hiện hành + roster. Không lấy PUBLISHED, GuidancePlan hoặc role LECTURER làm phân công chính thức.
- UC18 FINALIZED dùng snapshot V2 chứa full manifest, PDF/UC17 metadata, proof học vụ, policy và policyRevision. V1 hợp lệ vẫn đọc lịch sử FINALIZED; command downstream mới chỉ nhận V2 có provenance hợp lệ. Không sửa/backfill bản V1.
- Nộp lại PDF không sửa UC17/UC18. Revision PDF đổi kể cả checksum giống làm evidence stale; bản chốt lịch sử vẫn FINALIZED. Command mới dừng khi nguồn stale/không xác minh được. Lịch đã công bố vẫn là bản lịch sử hiện hành cho đến một command điều chỉnh hợp lệ; không tự thu hồi bởi upload.
- REOPEN giữ toàn bộ bản chốt cũ, clear pointer trong cùng CAS, tăng revision và ghi reason/audit. Khi đã có downstream FINALIZED/PUBLISHED hoặc artifact official, MVP từ chối; không cascade. Không gia hạn cửa sổ UC17.
- Khoa được điều chỉnh bốn cửa sổ vận hành sau chốt bằng CAS/context và audit, kể cả mở lại mốc đã hết hạn hoặc bị khóa. Cấu trúc policy đã chốt (quy mô/sức chứa hội đồng, cấu hình tải phản biện) vẫn bị khóa; snapshot cũ giữ nguyên policy/revision. Thay đổi riêng cửa sổ không làm bản chốt lịch sử mất hiệu lực hoặc tự chuyển trạng thái. Bản V1 có thể được cấu hình policy rõ ràng để REOPEN hợp lệ trước downstream; không tự nâng cấp thành V2.
- UC19 size cấu hình 3–5, đúng một CHAIR/SECRETARY khác người, không trùng thành viên, không GVHD trong hội đồng SV mình; đúng một allocation mỗi hồ sơ admitted; capacity theo policy, không lấy Room.capacity. Allocation lưu trong artifact/draft độc lập session.
- UC20 đúng một reviewer mỗi admitted, không quota hướng dẫn, không bắt buộc cùng hội đồng. Gợi ý cân bằng deterministic trên toàn phương án; tải được hiển thị, ngưỡng cảnh báo chỉ khi policy cấu hình và không phải hard quota.
- UC21 lưu start/end cụ thể, thứ tự thủ công, không Alphabet/default 30 phút. GVPB luôn là người tham dự khi kiểm conflict, GVHD không mặc nhiên phải dự. Room.capacity chỉ dùng cho số người có mặt tối thiểu. PUBLISHED/amend tạo artifact mới; snapshot giữ cả thông tin phòng để tên/mã phòng lịch sử không phụ thuộc catalog sau đó.

## 3. Schema và migration

Migration **duy nhất** của Gói E: `backend/prisma/migrations/202610280001_official_defense_workflows/migration.sql`. Không sửa migration cũ.

| Thay đổi                                                         | Ràng buộc/ý nghĩa                                                                                                                                                                                     |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enum mới DefenseStage, DefenseStageState, DefenseAcademicVerdict | Không sửa enum/status legacy; PUBLISHED chỉ cho SCHEDULE                                                                                                                                              |
| DefenseAcademicEvidence                                          | PK id; unique(termId,termStudentId,revision); index(termId,studentId,revision); revision dương, source không rỗng, schema/hash hợp lệ; FK term/actor RESTRICT; trigger UPDATE/DELETE/TRUNCATE bị chặn |
| DefenseList                                                      | Bổ sung workflowPolicy nullable, policy revision mặc định 0 và metadata actor/time. CHECK chưa cấu hình/đã cấu hình nhất quán. Không tự tạo policy/window OPEN                                        |
| DefenseStageWorkflow                                             | PK(termId,stage), state/revision/draft; source UC18 pointer ghép cùng term/listRevision; upstream đúng stage; current pointer cùng term/stage/revision; actor/timestamps                              |
| DefenseStageArtifact                                             | Unique(termId,stage,version), unique(termId,stage,workflowRevision), unique identity tuple cho FK; JSON/hash/version/actor/time; chỉ FINALIZED hoặc SCHEDULE PUBLISHED; append-only trigger           |

Source UC18 FK tái sử dụng unique `(id,termId,listRevision)` sẵn có. Current/upstream FK được map rõ tên ngắn trong Prisma và SQL để tránh identifier PostgreSQL bị cắt hoặc sinh FK trùng. CHECK upstream dùng `IS TRUE` để NULL không lọt qua CHECK ba giá trị. Artifact INSERT trước CAS coordinator được phép vì FK artifact → workflow chỉ cần term/stage tồn tại; không bắt coordinator phải ở revision tương lai trước khi insert.

Không thêm FK lịch sử vào TermStudent, Proposal, FileAsset hoặc FinalReport; roster IDs và evidence được capture/kiểm tra server. Không lưu PDF cũ. Không dual-write sang bảng hội đồng/reviewer/session legacy; artifact là authority, legacy tiếp tục UNVERIFIED. Không thay công thức điểm, TermWindowService, sáu phase hoặc Bước 1–8. `Room.name` đã có từ trước lượt này, không thêm lại.

**Tương thích/giới hạn SQL:** giữ nguyên các FK legacy hiện có, không tạo lại relation/FK Proposal vốn đã tồn tại. Chỉ ALTER ADD các cột/constraint trên DefenseList và tạo object mới, không DROP/đổi type/xóa dữ liệu/backfill. RESTRICT mới bảo toàn term/actor sau khi có bằng chứng, vì vậy xóa term/user vật lý cần tuân thủ retention; không dùng cleanup/reset để vượt lịch sử. Chưa chứng minh migration replay/upgrade hoặc trigger trên PostgreSQL thực.

## 4. API thực tế

Các path dưới đây có prefix `/api`. Controller dùng JWT/permission guards hiện có; service kiểm tra lại principal/permission/grant.

| Method/path                                                        | Hành vi                                                                                                                                      |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/terms/:termId/defense-workflow`                              | Context toàn đợt: full roster, lý do/admitted, policy/revision, capability, stage draft/state/version, workload/suggestions, expectedContext |
| GET `/terms/:termId/defense-workflow/history`                      | Metadata các bản chốt UC18 và artifact UC19–21, version/revision/actor/time/integrity; không trả whole snapshot                              |
| PUT `/terms/:termId/defense-list/workflow-policy`                  | Cấu hình policy/CAS/audit; sau chốt chỉ điều chỉnh cửa sổ vận hành, giữ nguyên cấu trúc và snapshot lịch sử                                  |
| POST `/terms/:termId/defense-list/academic-evidence`               | Append chứng cứ mới theo member hiện hành, revision CAS; actor/time/hash từ server                                                           |
| GET `/terms/:termId/defense-list/academic-evidence/:termStudentId` | Lịch sử stream học vụ readonly, có integrity và legacy/invalid không giả xác minh                                                            |
| POST `/terms/:termId/defense-list/finalize`                        | Capture V2 đầy đủ, insert seal + CAS pointer/revision + audit/idempotency                                                                    |
| POST `/terms/:termId/defense-list/reopen`                          | reason + CAS/context, chặn downstream official, không sửa lịch sử                                                                            |
| PUT `/terms/:termId/defense-workflow/:stage/draft`                 | Lưu draft có thực; chỉ sau nguồn UC18 FINALIZED V2 hợp lệ; stage dùng COMMITTEES/REVIEWERS/SCHEDULE                                          |
| POST `/terms/:termId/defense-workflow/:stage/finalize`             | Validate lại saved draft và nguồn hiện hành, insert artifact + CAS; SCHEDULE cần UC20 official                                               |
| POST `/terms/:termId/defense-workflow/SCHEDULE/publish`            | Chỉ FINALIZED → PUBLISHED, recheck nguồn/conflict, artifact publication mới, notify                                                          |
| POST `/terms/:termId/defense-workflow/SCHEDULE/amend`              | Chỉ PUBLISHED → publication version mới, slots mới + reason; audit/notify, không rewrite lịch cũ                                             |
| GET `/terms/:termId/defense-schedule/published`                    | Lịch theo own student/current advisor/current sealed committee/reviewer hoặc grant Khoa; không lộ draft/whole snapshot                       |

GET/create DRAFT/DRAFT → OPEN cũ vẫn giữ route. **OPEN nay cần policy UC18 đã cấu hình, không khóa và trong hạn**, dùng database wall clock trước ghi và sau audit. Bootstrap tạo DRAFT/cấu hình policy không tự mở window và không yêu cầu đã có PDF/UC17 cho mọi SV. Frontend hướng dẫn cấu hình policy trên DRAFT trước OPEN; không có fallback phase FINAL/UC17.

Ví dụ command chung:

```json
{
  "expectedRevision": 1,
  "expectedContext": "<64 ký tự hex lấy nguyên từ GET context>",
  "requestId": "<ID ngẫu nhiên 16–80 ký tự cho lần thao tác>"
}
```

Các DTO là Zod strict; không nhận actorId, advisor snapshot, PDF snapshot hoặc trạng thái chốt từ client. Academic thêm termStudentId/verdict/sourceReference/note; policy thêm policy; save thêm draft đúng loại stage; reopen/amend thêm reason có nội dung. Revision của policy là policyRevision, của evidence là academicRevision stream, của list/stage là revision tương ứng từ context.

Response command: envelope ApiResponse chứa `changed`, revision, expectedContext mới, artifactId/version khi có. Create seal POST trả 201, PUT draft/policy 200; lỗi 401/403/404/409/400/422/503 theo guard, validation, source/concurrency hoặc storage. Schema chưa áp dụng trả controlled 503, bao gồm raw SQL undefined table/column; không giả persist.

## 5. Quyền, transaction và idempotency

- Definition helper mới `defense-workflow-permissions.cjs`: resource defense-workflow với read/configure/verify-academic/manage/finalize/reopen/publish cho FACULTY; defense-schedule:read cho FACULTY/LECTURER/STUDENT. Chỉ sửa wiring seed, **không chạy seed hoặc cấp grant thực tế**. ADMIN không được tự thêm permission/grant.
- Tất cả context quản lý/command/history mới cần active account, không mustChangePassword, exact permission và AcademicTermGrant allDepartments=true của đúng actor/term. Bộ môn vẫn đối soát qua reader scoped cũ; lịch PUBLISHED của Khoa theo department grant kiểm **routing hiện hành**, không dùng routing snapshot để bypass grant.
- Sinh viên chỉ nhận row lịch của mình. Giảng viên chỉ nhận slot thuộc committee/reviewer artifact hiện hành hoặc quan hệ GVHD chính thức **hiện tại**, không dựa chỉ role/snapshot GVHD cũ. Read không audit nghiệp vụ hay tạo bản ghi.
- Writer ReadCommitted, parent THESIS_TERM trước, sau đó DefenseList/stages và source rows theo thứ tự cố định. Có thêm khóa TermWorkflow/AssignmentPlan/AssignmentPlanWorkflow/Registration/AdvisorAssignment/AssignmentChange/roster/Proposal/decision/report vì một số producer cũ chưa dùng parent-first. Các cột PR2B camelCase trong raw SQL dùng identifier quoted đúng schema.
- Khóa file theo key server và thứ tự sort chung. Resource advisory locks xuyên đợt theo type/id đã sort, gồm phòng/hội đồng/giảng viên/GVPB/studentId; khóa Room rows hiện có. Sau chờ khóa đọc lại booking official hiện hành và legacy. Amendment không tính trùng bản current của chính mình, vẫn giữ khóa tài nguyên cũ/mới.
- Recheck source identity/hash/revision, nguồn UC18/19/20, permission và database `clock_timestamp()`; có fingerprint nguồn metadata kiểm lại trước kết thúc transaction. lock_timeout 5 giây, Prisma timeout 60 giây/maxWait 10 giây cho workflow mới. Map raw lock/deadlock/timeout hoặc serialization thành conflict; **chưa có số đo thực tế**.
- Insert artifact + CAS + audit + notification + IdempotencyRecord trong cùng transaction; fault injection rollback toàn bộ. Idempotency theo actor/term/action/requestId + payload hash, expiry dùng DB clock. Replay chỉ trả changed=false sau kiểm lại quyền/window/source và context kết quả vẫn hiện hành; không vượt qua PDF hỏng hoặc context đổi. Không retry command mù.
- Notification dùng **Notification in-app và consumer hiện có**, không phát loại OutboxEvent chưa có consumer hoặc tạo transport mail mới. UC20 báo GVPB được phân; publication báo bên liên quan; amendment tính các hồ sơ/nhóm người bị thay đổi. Không gửi network/mail trong transaction. Chưa có bằng chứng SMTP và không tuyên bố đã gửi mail.

Các writer cũ có thứ tự khóa khác vẫn có khả năng gây deadlock/serialization dưới tải; bổ sung source locks và controlled conflict giúp fail closed, không phải bằng chứng hết deadlock. Cần PostgreSQL hai connection để nghiệm thu trước triển khai.

## 6. Frontend và cách sử dụng

Không thêm cơ chế auth hoặc localStorage mới. Dùng HTTP client/JWT/sessionStorage và feature flags đang có:

```dotenv
VITE_AUTH_API=true
VITE_DEFENSE_LIST_API=true
VITE_DEFENSE_PLANNING_API=true
```

Không sửa env cá nhân. Khởi động lại Vite sau khi người dùng chủ động cấu hình. Flag off giữ demo cũ; API error không nạp DemoDb. Route published luôn xác thực riêng và khi thiếu flag/auth hiển thị configuration error, không chạy demo.

| Route                           | Phần UI thực                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/defense/eligibility`          | Bootstrap DRAFT/OPEN, policy editor có các mốc độc lập, bảng học vụ/nguồn/lý do full roster, ghi evidence/history, explicit đối soát context trước FINALIZE, REOPEN reason/capability |
| `/defense/committees`           | Form phương án cũ được dùng để chỉnh local; panel official lưu/nạp draft server, chốt bản đã lưu và hiện state/version/history                                                        |
| `/defense/reviewers`            | Gán thủ công, xem tải/gợi ý server để chỉnh, save/finalize và đọc lại state/draft/history                                                                                             |
| `/defense/schedule`             | Slot thủ công, save/finalize/publish/amend có reason; chỉ bật nút theo server capability; preview vẫn không đặt chỗ                                                                   |
| `/defense/published?termId=...` | SV/GV/HĐ/Khoa tra cứu đúng row được backend cho phép; khi không có publication hoặc không có row thuộc quyền thì empty; không dùng URL PDF demo                                       |

Sau command đọc lại context; các panel lịch sử đọc backend. Sau create/open, invalidate context official để có thể cấu hình/chốt tiếp mà không dùng trạng thái giả. Policy editor giữ các mốc vận hành có thể điều chỉnh và khóa trường cấu trúc đã chốt theo capability. 409/lỗi command chặn thử lại cho đến khi xem lại nguồn và chủ động nạp server drafts/ack dữ liệu mới. Không tự gắn hash mới vào phương án cũ. Lỗi 503 nói rõ schema chưa sẵn sàng; không success toast giả.

## 7. File tạo/sửa trong lượt Gói E

Working tree có nhiều thay đổi từ trước; danh sách này không quy toàn bộ git diff cho Gói E.

**Tạo:**

- `shared/src/contracts/defense-workflow.ts`.
- `backend/prisma/migrations/202610280001_official_defense_workflows/migration.sql`.
- `backend/prisma/defense-workflow-permissions.cjs`.
- `backend/src/defense/workflow/defense-workflow.controller.ts`.
- `backend/src/defense/workflow/defense-workflow.service.ts`.
- `backend/src/defense/workflow/defense-workflow.repository.ts`.
- `backend/src/defense/workflow/defense-workflow.policy.ts`.
- `backend/src/defense/workflow/defense-workflow.module.ts`.
- `backend/src/defense/workflow/defense-workflow.test-fixtures.ts`.
- `backend/src/defense/workflow/defense-workflow.service.spec.ts`.
- `backend/src/defense/workflow/defense-workflow.invariants.spec.ts`.
- `backend/src/defense/workflow/defense-workflow.http.spec.ts`.
- `backend/src/defense/workflow/defense-workflow.repository.spec.ts`.
- `frontend/src/features/defense/workflow/api.ts`.
- `frontend/src/features/defense/workflow/panels.tsx`.
- `frontend/src/features/defense/workflow/published.tsx`.
- `frontend/src/features/defense/workflow/test-fixtures.ts`.
- `frontend/src/features/defense/workflow/api.test.ts`.
- `frontend/src/features/defense/workflow/panels.spec.tsx`.
- `docs/audits/step9-uc18-uc21-official-implementation.md`.

**Sửa:**

- `shared/src/index.ts` — export contracts.
- `backend/prisma/schema.prisma`, `backend/prisma/seed.cjs` — additive models/relations và wiring definition helper, không execute seed.
- `backend/src/common/uc18-finalization/defense-list-snapshot.ts`, `uc18-finalization.validator.ts`, `uc18-finalization.test-fixtures.ts`, `prisma-uc18-finalization.reader.spec.ts` — V2 và tương thích V1.
- `backend/src/defense/defense.module.ts` — wiring module mới.
- `backend/src/defense/defense-lists/defense-list.service.ts`, `defense-list.repository.ts`, `defense-list.test-fixtures.ts`, `defense-list.service.spec.ts`, `defense-list.controller.spec.ts` — OPEN gate policy/time và fixtures/type compatibility.
- `backend/src/defense/planning/defense-planning.service.ts`, `defense-planning.policy.ts` — preview nhận V2, thông báo dùng official panel thay BLOCKED cũ; API preview vẫn không persist.
- `backend/src/defense/reviews/defense-review.dto.ts`, `defense-review.service.spec.ts` — làm rõ metadata-only preview, không tuyên bố policy còn chưa được duyệt.
- `frontend/src/features/defense/defense-lists/page.tsx` — official panel và refresh.
- `frontend/src/features/defense/planning/layout.tsx`, `pages.tsx`, `pages.spec.tsx`, `README.md` — save/load controls, giữ legacy read/preview, bỏ thông báo BLOCKED đã hết hiệu lực.
- `frontend/src/app/router/routes.tsx`, `route-manifest.ts` — published route/menu.

Không sửa controller C01, API PDF, TermWindowService, công thức grading, migration cũ, scripts database hoặc workflow Bước 1–8. Shared dist/Prisma client được generate tại chỗ theo cơ chế sẵn có, không phải migration hay dữ liệu thực.

## 8. Kiểm thử thực tế

Kết quả chạy ngày 28/10/2026, sau các sửa cuối về OPEN gate, source locks và điều chỉnh cửa sổ sau chốt:

| Kiểm tra                                                                                          | Kết quả thực tế                                                                                          |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Backend `GPMS_INTEGRATION=0 pnpm exec vitest run --exclude '**/*.integration.spec.ts' --no-cache` | **PASS 1.116/1.116**, 74 file; 79,53 giây                                                                |
| Frontend `pnpm exec vitest run --no-cache`                                                        | **PASS 342/342**, 34 file; 16,80 giây                                                                    |
| TypeScript backend/frontend/shared `tsc --noEmit --incremental false`                             | **PASS cả ba package**                                                                                   |
| Backend lint toàn bộ `eslint src --ext .ts`                                                       | **PASS**                                                                                                 |
| Frontend lint toàn bộ `eslint src --ext .ts,.tsx`                                                 | **PASS**                                                                                                 |
| Prisma validate                                                                                   | **PASS**, biến môi trường riêng `127.0.0.1:1`, không kết nối DB                                          |
| Prisma generate và shared build                                                                   | **PASS**, generate client/build local, không chạy migration                                              |
| `node --check` permission helper mới và seed                                                      | **PASS cú pháp**; không execute seed                                                                     |
| Migration review tĩnh                                                                             | **Không có DROP TABLE/COLUMN/TYPE, DELETE dữ liệu, đổi type hoặc INSERT/backfill**; **SQL NOT EXECUTED** |
| Prettier các file tạo/sửa của gói                                                                 | **PASS** sau định dạng                                                                                   |
| `git diff --check`                                                                                | **PASS**                                                                                                 |

Gói E bổ sung **89 backend tests**: 86 trong bốn file workflow (service 29, invariants 29, HTTP 13, repository/static SQL 15), ba negative tests OPEN cần policy/cửa sổ hợp lệ. Bổ sung **25 frontend tests**: adapter 16, panel/route SSR 9. Tổng toàn suite bao gồm các test hiện có, không phải tất cả đều được tạo trong lượt này. Ba bộ regression C01 (score/committee/stats, mỗi bộ 10 test) đều PASS trong lượt backend cuối.

Các lỗi gặp trong lúc phát triển đã sửa và chạy lại: HTTP fixture thiếu dữ liệu profile làm DTO lỗi; fixture OPEN chưa cấu hình policy sau khi siết điều kiện; assertion cũ còn coi policy là chưa duyệt; adapter validation cần trả rejected Promise nhất quán. Đối chiếu SQL tĩnh cũng sửa identifier camelCase của PR2B; đây không phải bằng chứng migration đã chạy. Kiểm tra Prettier ban đầu báo hai file chưa định dạng, đã chạy định dạng và kiểm tra lại. Seed/index được định dạng bằng Prettier cùng phần wiring/export; không execute seed.

Còn warning không làm test thất bại: Vite CJS, React useLayoutEffect trong SSR và thông báo cleanup PDF giả được trì hoãn trong fixture. Không tắt rule lint hoặc biến warning thành bằng chứng browser/SMTP đã chạy.

Phạm vi test mới: full roster/học vụ unknown/special/hash/revision/legacy; no default admit; snapshot V2 và V1 đọc được; stale PDF cùng checksum/revision khác; authority/actor/permission/grant/ADMIN; saved-draft structural/cardinality/capacity/coverage/conflict; source UC18/19/20; publish/amend/history và scoped publication; CAS/idempotency/audit/notification rollback; DB clock/source/resource lock SQL và missing-schema controlled errors. HTTP tests dùng guards/controller/DTO/service thật, repository transaction giả; module wiring override Prisma trước khi instantiate.

Frontend test adapter/SSR: flag/JWT, strict DTO, context/revision từ server, API paths, không fallback/retry giả khi 400/401/403/404/409/422/503/network, policy không invent ngày/capacity, state/capability, publication empty/scoped rows. Không có browser click E2E hoặc dữ liệu PostgreSQL.

## 9. Rủi ro và checklist nghiệm thu còn lại

**NOT RUN:** migration replay, FK/CHECK/trigger thực, PostgreSQL concurrency/deadlock/rollback, đo latency/lock hold, browser E2E, SMTP và production deployment. SQL static tests không thay thế PostgreSQL execution.

- [ ] Provision PostgreSQL cô lập đã xác minh quyền sở hữu trong một nhiệm vụ được phép riêng; tuyệt đối không dùng DB chung. Replay chain rỗng và upgrade có dữ liệu legacy; kiểm type/FK drift giữa `0_init` và Prisma trước deploy.
- [ ] INSERT proof/artifact được; UPDATE/DELETE/TRUNCATE bị trigger chặn kể cả statement không match row; rollback INSERT vẫn được. Kiểm RESTRICT term/user và chính sách lưu trữ, không tự xóa lịch sử.
- [ ] Composite pointer sai term/stage/revision, source sai stage, NULL upstream metadata, hash/JSON/schema version lỗi đều bị chặn hoặc reader UNKNOWN. Không có backfill official/histories giả.
- [ ] Ít nhất hai PostgreSQL connections với barrier chủ động: hai FINALIZE cùng revision, hai public schedules tranh cùng phòng/lecturer/student, legacy producer đổi assignment, UC17/PDF reupload tranh UC18, deadline hết trong lúc chờ khóa. Không dùng Promise.all fixture để nhận đã test race DB.
- [ ] Audit/history/notification/idempotency lỗi phải rollback mọi pointer/version; request replay không tạo lại seal/notification; timeout/lock failure controlled conflict. Kiểm nguồn đổi giữa GET và command phải 409.
- [ ] JSONB/canonical SHA-256 round-trip, snapshot V1/V2; roster thêm/xóa và reupload PDF sau chốt không sửa lịch sử, nhưng source freshness ngăn command mới sai bằng chứng.
- [ ] Đo roster lớn + PDF lớn: hiện context/command xác minh bytes trong transaction và giữ file/source/term locks tương ứng. Transaction 60 giây/lock_timeout 5 giây là budget triển khai, chưa phải số đo đạt tải. Cần đo trước vận hành, không tự bỏ byte verification để giảm latency.
- [ ] Browser từng vai trò: DRAFT → policy → OPEN → evidence → UC18 FINALIZE → UC19/20/21 → publication → amendment; 401/403/409/503, không fallback; SV/giảng viên khác không thấy row ngoài quyền, GVHD cũ mất quan hệ, partial grant theo routing hiện hành.
- [ ] Chuẩn bị dữ liệu/tài khoản/permissions/grants trên DB cá nhân được duyệt riêng; không chạy seed chung. Kiểm notification poll/link thực tế; in-app không chứng minh SMTP. Người nhận thông báo vẫn phải vượt reader authorization.

Giới hạn MVP cố ý giữ: không override học vụ/ngoại lệ bảo lưu, không cascade REOPEN khi downstream official, không chỉnh cấu trúc hội đồng/phản biện sau chốt, không tự gia hạn UC17 hoặc tự thu hồi xác nhận. Khi PDF/GVHD đổi sau downstream chốt, UI báo stale và command mới bị chặn; cần quy trình tương lai được duyệt để xử lý, không lách bằng DRAFT/OPEN hoặc SQL thủ công.

## 10. Trước khi triển khai UC22–UC25

Consumer mới phải lấy reviewer/committee/schedule từ artifact current đã xác minh, không mượn legacy ReviewerAssignment/CommitteeStudent hoặc global role COMMITTEE. Còn cần đặc tả quyền xem/chấm trước công bố, rubric, cửa sổ chấm, quorum/đủ phiếu, amend khi đã có điểm, công thức/rounding và quy trình chốt/công bố điểm; UC25 cần mẫu biểu/export job/retention. Không mở lại ba reader C01 như đường tắt.

**Xác nhận:** không kết nối hoặc thao tác database thật/chung/bất kỳ PostgreSQL nào; không chạy migration, seed, reset, db push/deploy/dev, cleanup hoặc Docker; không tạo tài khoản/dữ liệu thật. Ba endpoint C01 giữ 401 trước JWT, 403 sau JWT. Implementation MVP hoàn tất ở mức code/mock tests với các kết quả trên; chưa kết luận nghiệm thu PostgreSQL hay toàn bộ Bước 9–10.
