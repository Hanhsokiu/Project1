# Kiểm thử tích hợp Project 1 — bước 4–8

Ngày 23/10/2026, Asia/Ho_Chi_Minh. **Kết luận QA: chưa đề nghị merge toàn bộ hệ thống**, vì còn hai đường đọc legacy thiếu kiểm scope. Luồng nghiệp vụ mới 4–8 đã PASS qua browser/backend/database thật; kết quả đó không che các ca security FAIL bên dưới.

Không kết nối Supabase/production; không reset/drop database, không sửa schema/migration/business logic, không stage/commit/push trong lượt QA. Các migration có sẵn được replay trên PostgreSQL test riêng.

## 1. Nguồn, môi trường và cách kiểm thử

Đã đối chiếu [architecture/audit](00-repository-audit.md), [baseline PR1](01-business-decisions-and-contract.md) §3–§7 (ownership, official assignment, state machines, API, RBAC), [migration plan](02-prisma-migration-plan.md), [team guide](03-team-development-guide.md), [test plan](04-test-plan.md), các báo cáo triển khai 4/5/6/7/8A/8B/8C, ADR monorepo/NestJS-Prisma/đồ án cá nhân, shared contracts và controller/service hiện tại. Test plan 04 ban đầu chỉ dành cho bước 4; báo cáo này mở rộng kiểm thử tích hợp, không thay baseline học vụ.

| Thành phần | Môi trường thực tế |
|---|---|
| OS / runtime | Windows; Node 24.13.1, pnpm 12.14.0 |
| ORM / DB | Prisma Client 5.22.0; PostgreSQL portable 17.11, loopback `127.0.0.1:55441` |
| Database | Mỗi API/upgrade suite một DB mới `btl_pr2b_qa_*`; E2E mỗi lần chạy một DB rỗng mới, giữ lại sau test |
| Backend E2E | Nest AppModule thật, JWT/PermissionsGuard thật, ValidationPipe, port loopback ngẫu nhiên, CORS chỉ origin browser test |
| Frontend E2E | React/Vite thật tại `127.0.0.1:50180`, Edge headless; đăng nhập bằng UI, bốn browser context độc lập |
| File E2E | Private storage trong TEMP riêng; PDF được tạo/tải thật rồi dùng làm báo cáo test; ZIP hợp lệ có source tổng hợp |
| Browser hồi quy | Bảy runner mock API đã có; tách biệt hoàn toàn với E2E thật |

Live runner không `fulfill` hoặc thay response API. Network guard chỉ cho phép hai origin localhost của test. Credentials/JWT ngẫu nhiên truyền trong bộ nhớ/stdin, không lưu source, log, HAR hoặc trace chứa Authorization. Chỉ log method/path/status; tất cả dữ liệu là tổng hợp.

Seed mới: `backend/scripts/integration/seed-steps4-8.cjs`, được live runner gọi sau khi xác minh target và replay migration. Có hai đợt, ba SV, roster, GVHD/reviewer/GV ngoài nhóm/khác đợt, Khoa theo grant, ADMIN, một account không role, official assignment FINALIZED, topic agreement, SEALED v1, lớp/ngành và nghĩa vụ tuần. Đây là **fixture thay thế producer bước 1–3**, không chứng minh các màn ghi của người 1 đã hoàn thiện. Không seed sẵn kết quả review, hồ sơ chốt, task hoặc submission cho luồng chính.

Seed từ chối target không phải loopback `btl_pr2b_*`, database identity không khớp hoặc đã có dữ liệu. Đã kiểm lần gọi seed thứ hai bị từ chối. Chạy lại bằng database mới; không truncate/upsert đè dữ liệu cũ để làm test xanh. Suite coordinator có thể tái sử dụng khi vẫn rỗng, nhưng mỗi child suite luôn tạo tên DB mới ngẫu nhiên.

## 2. Kết quả các lệnh thực tế

| Lệnh / bộ kiểm tra | Actual result | Trạng thái | Evidence/log |
|---|---|---|---|
| `pnpm verify` | Prisma validate/generate + frozen compatibility, toàn workspace type-check/lint/unit/build đều thành công; exit 0 | PASS | [verify.log](evidence/steps4-8/verify.log) |
| Backend Vitest | 10 files, 107 tests | PASS | verify.log, dòng kết quả Vitest |
| Frontend Vitest | 8 files, 27 tests | PASS | verify.log, dòng kết quả Vitest |
| Database/local target guards | 9 + 1 + 2 = 12 tests | PASS | verify.log |
| `test:integration:steps4-8:suite` | 7 API suites + 7 upgrade suites; mỗi suite exit 0 | PASS | [database-suite.json](evidence/steps4-8/database-suite.json) |
| `test:integration:steps4-8:browser` | 7 Edge/mock suites, 73 checks; không dùng DB học thuật | PASS | [browser-suite.json](evidence/steps4-8/browser-suite.json) |
| `test:integration:steps4-8:e2e` — luồng chính | 15 browser checkpoints thật + PDF parsing + kiểm dữ liệu sau luồng | PASS | [live-browser.json](evidence/steps4-8/live-browser.json), [live-browser.log](evidence/steps4-8/live-browser.log) |
| Cùng lệnh E2E — security toàn điểm nối | 4 probe legacy trả 200 ngoài scope; command exit 1, `workflowResult=PASS`, `result=FAIL` | **FAIL** | [live-e2e.json](evidence/steps4-8/live-e2e.json), [legacy-security.json](evidence/steps4-8/legacy-security.json) |
| Syntax QA scripts mới | `node --check` trên seed, suite runner, backend E2E và browser E2E, exit 0 | PASS | Đã chạy trực tiếp; source bốn runner trong §9 |
| Deploy Supabase/shared DB; production data diagnostic | Không chạy theo giới hạn target đã được giao | NOT RUN | Không có bằng chứng deploy hoặc dữ liệu production trong kết luận |
| Remote GitHub CI | Chưa chạy trên remote | NOT RUN | Không suy kết quả CI từ local |

Các script `test:integration:*` thuộc package `@doan/backend`. Không gọi nhầm `typecheck`: script thực tế là `type-check`. `pnpm verify` thực thi script hiện có của từng package. Vite CJS, React Router SSR trong smoke test và Node DEP0190 còn warning, không phải lỗi đã sửa hoặc bài test thất bại. Không đổi dependency để che warning.

Chi tiết từng suite:

| Bước | API checks | Upgrade | Browser mock checks | Evidence gốc được snapshot cho lượt QA |
|---|---:|---|---:|---|
| 4 | 31 PASS | PASS; structured assertions bảo toàn legacy/permission/checksum/redeploy | 9 PASS | [API](evidence/steps4-8/step4-api.json), [upgrade](evidence/steps4-8/step4-upgrade.json), [browser](evidence/steps4-8/step4-browser.json) |
| 5 | 27 PASS | 5 PASS | 10 PASS | [API](evidence/steps4-8/step5-api.json), [upgrade](evidence/steps4-8/step5-upgrade.json), [browser](evidence/steps4-8/step5-browser.json) |
| 6 | 24 PASS | 5 PASS | 15 PASS | [API](evidence/steps4-8/step6-api.json), [upgrade](evidence/steps4-8/step6-upgrade.json), [browser](evidence/steps4-8/step6-browser.json) |
| 7 | 19 PASS | 4 PASS | 8 PASS | [API](evidence/steps4-8/step7-api.json), [upgrade](evidence/steps4-8/step7-upgrade.json), [browser](evidence/steps4-8/step7-browser.json) |
| 8A | 19 PASS | 4 PASS | 11 PASS | [API](evidence/steps4-8/step8a-api.json), [upgrade](evidence/steps4-8/step8a-upgrade.json), [browser](evidence/steps4-8/step8a-browser.json) |
| 8B | 17 PASS | 4 PASS | 10 PASS | [API](evidence/steps4-8/step8b-api.json), [upgrade](evidence/steps4-8/step8b-upgrade.json), [browser](evidence/steps4-8/step8b-browser.json) |
| 8C | 17 PASS | 4 PASS | 10 PASS | [API](evidence/steps4-8/step8c-api.json), [upgrade](evidence/steps4-8/step8c-upgrade.json), [browser](evidence/steps4-8/step8c-browser.json) |

154 API checks là tổng check ở cấp bảy suite, có prelude kiểm lại producer; không phải 154 endpoint hoặc số ca độc lập không trùng. Upgrade kiểm mốc migration tương ứng từng feature; ví dụ bước 4 kiểm mốc bốn migration, không giả mọi upgrade fixture đều bắt đầu/kết thúc tại mười migration. API suites và live E2E chạy active chain mười migration. Mỗi file JSON có log cùng tên `.log`; wrapper chỉ nhận evidence mới được script vừa ghi, không nhận file PASS cũ sau command fail.

## 3. Test cases xuyên suốt — browser + API + DB thật

| ID / Test case | Expected result | Actual result | Status | Evidence |
|---|---|---|---|---|
| E01 — seed/migration target | Chỉ DB mới riêng; không sửa DB đã có dữ liệu | PG17 identity đúng, replay 10 migration; seed lần hai bị từ chối | PASS | live-e2e.json |
| E02 — Khoa tạo nhóm | Nhóm đúng đợt/bộ môn, member đủ roster | UI login Khoa → tạo nhóm chứa reviewer hợp lệ, server 201 | PASS | live-browser.json checks 1–2; live-api-traffic.json |
| E03 — phân công v1 | Dùng nhóm vừa tạo, version SEALED hiện hành | Assignment mới trỏ v1, reviewer đúng nhóm đọc được | PASS | live-browser.json checks 2–3 |
| E04 — reviewer yêu cầu sửa | Start rõ ràng; một kết luận chung, nhận xét bắt buộc | Start v1 → REVISION_REQUIRED với nhận xét tiếng Việt | PASS | live-browser.json check 3 |
| E05 — SV sửa v2 | Phản hồi gắn góp ý v1; không overwrite v1 | SV sửa mục tiêu, trả lời quyết định, lưu versionNumber=2 | PASS | live-browser.json check 4; assertion DB sau luồng |
| E06 — gửi lại/duyệt | Seal v2; vòng mới trỏ v2; không tái dùng quyết định v1 | Resubmit → Khoa phân vòng 2 → reviewer APPROVED | PASS | live-browser.json checks 4–5 |
| E07 — Khoa chốt | Chỉ bản được duyệt; approvedVersionId chính xác | Finalization trỏ v2, receipt vẫn null | PASS | live-browser.json check 6; live-e2e.json |
| E08 — SV xuất PDF | File private từ snapshot, Unicode/A4, không giả ký/nộp giấy | Browser tải PDF thật; pdfjs kiểm lớp/ngành/tên/mục tiêu v2/chữ ký, bounds từng text item | PASS | [PDF](evidence/steps4-8/live-finalized.pdf), live-e2e.json |
| E09 — kế hoạch/nhiệm vụ | Chỉ official GVHD; ngày có timezone, đúng plan | UI login GVHD → ACTIVE plan → task có deadline/mốc; server 201 | PASS | live-browser.json check 8 |
| E10 — nộp báo cáo v1 | PDF+ZIP thật, staging private chưa phải bài nộp | Picker → upload → READY → xác nhận nộp v1 | PASS | live-browser.json check 9; live-api-traffic.json |
| E11 — nhận xét v1 | Review gắn chính xác submission v1; SV đọc được | GVHD chọn CẦN SỬA; SV thấy đúng yêu cầu | PASS | live-browser.json check 10 |
| E12 — nộp lại/Đạt | Giữ bài cũ, v2 riêng; PASS mới hoàn thành | SV nộp v2 → GVHD PASS, một task COMPLETED; review v1 vẫn còn | PASS | live-browser.json check 11; live-e2e.json DB assertions |
| E13 — Khoa thống kê | Tổng hợp dữ liệu thật, nghĩa vụ tuần không phụ thuộc task | Tổng task=1, hoàn thành=1; lọc advisor; tuần bắt buộc chưa có task vẫn hiện | PASS | [dashboard](evidence/steps4-8/live-faculty-dashboard.png), live-browser.json check 12 |
| E14 — khác SV/đợt/nhóm | Biết ID không được đọc tài nguyên người khác | API mới 403/404; browser SV khác không có nội dung/form đánh giá | PASS | live-browser.json check 14; live-api-traffic.json |
| E15 — bản cũ/mobile | Bài v1 read-only; không crash hoặc tràn ngang | Không có nút amend v1; viewport 375px không overflow; pageErrors=[] | PASS | [mobile](evidence/steps4-8/live-stale-version-mobile.png), live-browser.json check 15 |
| E16 — dữ liệu cũ 1–3 | Roster/registration/assignment/topic không bị thay; read shape còn dùng được | So sánh toàn bộ hàng core trước/sau bằng nhau; 6 API GET giữ envelope/dữ liệu | PASS | live-browser.json check 13; live-e2e.json |
| E17 — không lấn bước 9 | Không sinh điểm/điều kiện bảo vệ | FinalResult=0, DefenseEligibility=0 sau luồng | PASS | live-e2e.json |

## 4. RBAC, ownership và trạng thái sai

Inventory [endpoint-auth.json](evidence/steps4-8/endpoint-auth.json) liệt kê **66 method+path** thuộc các tag feature, gồm legacy task read và notifications. Mỗi operation đã được gọi thật:

- Anonymous: 66/66 trả 401.
- Tài khoản ACTIVE không role/permission: 63 protected operations trả 403; GET thông báo chính mình trả 200; hai notification ID không thuộc mình/không tồn tại trả 404. Đây là semantics self-auth đã định nghĩa, không yêu cầu role học thuật để đọc notification của mình.
- Đây là kiểm authentication/action gate của mọi operation. Không diễn giải thành mọi tổ hợp role × trạng thái × tài nguyên đã được vét cạn. Scope/ownership được kiểm riêng bằng fixture có quyền và dữ liệu tồn tại trong các API suite/E2E.

| Test case | Expected result | Actual result | Status | Evidence |
|---|---|---|---|---|
| Khoa ngoài grant đợt/bộ môn | Không đọc/ghi nhóm, review, dossier, dashboard ngoài scope | 403/404; không tin role claim giả | PASS | step4/5/7/8a/8c API JSON |
| GV ngoài nhóm / sai roster / cùng nhóm nhưng là GVHD hồ sơ | Không được reviewer-comment/decide trái scope | Các command bị chặn; owner/GVHD chỉ đọc quyền cha | PASS | step5-api.json |
| SV/GVHD sửa đề cương | Chỉ owner/current official advisor; PUBLISHED chưa đủ | Old advisor, phân công chưa chốt, agreement stale bị chặn | PASS | step6-api.json |
| ADMIN có action permission giả lập trong fixture | Vẫn không academic bypass | Không đọc/kết luận/tải học thuật ngoài relation scope | PASS | step4/5/6/7/8a/8b/8c API JSON |
| Cross-round/version | Nhóm cũ không nhận bản mới chưa phân; quyết định không trỏ stale version | Stale version bị conflict; draft không lộ cho reviewer | PASS | step5/6-api.json |
| Sai state review | Không decide trước start hoặc thêm decision/comment sau DECIDED | Invalid transition/duplicate rejected | PASS | step5-api.json |
| Bản đã chốt | Không sửa snapshot hoặc unseal SEALED | API/DB đều từ chối, v1/v2 giữ nguyên | PASS | step6/7-api.json |
| Tự hoàn thành chưa nộp | SV không gửi status COMPLETED; GVHD không PASS khi thiếu chứng cứ | DTO/state/evidence guards từ chối | PASS | step8a/8c-api.json |
| FAIL / REVISION_REQUIRED | Lưu riêng, cùng yêu cầu nộp lại; comment bắt buộc | PASS→FAIL→REVISION_REQUIRED giữ các hàng/history riêng | PASS | step8c-api.json |
| Notification IDOR/retry | Chỉ recipient; cached mutation không vượt revocation | Legacy notification guard và self mark-read đúng scope | PASS | step8c-api.json |
| Legacy topic list, account không role | Không trả metadata hồ sơ ngoài quyền | GET 200, trả hai đề tài có Proposal.studentId/status | **FAIL** | legacy-security.json finding 1 |
| Legacy registration list, account không role | Không trả thông tin SV/đăng ký ngoài quyền | GET 200, trả hai đăng ký kèm student/advisor | **FAIL** | legacy-security.json finding 2 |
| Legacy topic/registration, SV chỉ thuộc đợt 2 đọc đợt 1 | Không đọc chéo đợt | Cả hai GET 200, mỗi API hai hàng | **FAIL** | legacy-security.json findings 3–4 |

## 5. File, PDF, concurrency, rollback và compatibility

| Test case | Expected result | Actual result | Status | Evidence/log |
|---|---|---|---|---|
| Upload extension/MIME/content/filename/ZIP/oversize | Từ chối file sai/đường dẫn nguy hiểm trước READY; không thực thi file | Các ca invalid bị chặn, không tạo orphan READY | PASS | step8b-api.json/log |
| Private download | Owner/current advisor/scoped faculty; ID khác SV/đợt/file bị từ chối | Byte thật tải đúng; không public path/static URL | PASS | step7/8b/8c-api.json |
| PDF dài/Unicode/bảng | A4, không tràn, giữ dòng cuối/chữ ký | pdfjs kiểm text coordinates và trang của mẫu ngắn/dài | PASS | step7-api.json/log; live-finalized.pdf |
| Nộp lại / deadline | Giữ v1; nhận muộn khi phase mở; snapshot isLate/deadline | V2 riêng, v1 SUPERSEDED; trễ vẫn nhận, phase khóa thì chặn | PASS | step8b-api.json |
| Mốc bằng deadline | Đúng deadline là đúng hạn theo `<=`; quá hạn là `>` | Boundary validator được kiểm trong unit suite; không giả có network commit đúng nanosecond | PASS (unit) | verify.log + submission.spec.ts |
| Concurrent group/assignment/decision/edit/finalize/task/submission/review | Một CAS winner/effective result, không mất history | Promise.all/transaction race thật, 409 cho contender cũ | PASS | step4/5/6/7/8a/8b/8c-api.json/log |
| Idempotency/revoked scope | Retry cùng payload không tạo thêm rows/events; payload khác conflict | Replay đúng; revocation kiểm trước cached response | PASS | các API JSON |
| Audit lỗi / metadata/storage lỗi | Rollback pointer/version/state/history/outbox; dọn orphan có kiểm soát | Failure injection và đối soát DB/filesystem thành công | PASS | step4/5/6/7/8a/8b/8c-api.json |
| Phase lock tranh chấp với commit | Command chờ lock không ghi muộn sau khóa | Real row-lock races bị từ chối, không có audit/bài nộp một phần | PASS | step5/6/8a/8b/8c-api.json |
| Handover/reopen | GVHD cũ mất quyền, plan pause, không mất bài | Guard và rebase/acknowledgement được kiểm; không tự tạo agreement | PASS | step6/8a/8b/8c-api.json |
| Buổi hướng dẫn | Author/revision, amendment reason, before/after immutable | API create/amend/partial PATCH/history/CAS đúng | PASS | step8c-api.json; step8c-browser.json |
| Upgrade dữ liệu cũ | Không map boolean false thành FAIL; không sửa 0_init; giữ legacy summary | Bảy upgrade suites giữ fixture, checksum/redeploy, injected DDL rollback theo scope từng suite | PASS | *-upgrade.json/log |
| Producer ghi bước 1–3, full bước 9–10 | Không thể suy PASS từ fixture/core read/score unit | Chưa có E2E đầy đủ các màn ghi producer hoặc nghiệp vụ bảo vệ/chấm điểm | NOT RUN | Ngoài phạm vi luồng đã giao; có compatibility checks cụ thể ở trên |
| Production-sized load / Supabase permissions / email delivery | Cần môi trường/consumer thật và target được phép | Chưa benchmark hoặc chạy production/shared deployment/email worker | NOT RUN | Không đổi outbox PENDING thành email đã gửi |

## 6. Bug found và Fix applied

### SEC-01 — legacy topic list vượt scope (P1, chưa sửa)

Tái hiện bằng account ACTIVE không role hoặc SV chỉ thuộc `qa-t2`: GET `/api/topics/term/qa-t1` trả 200 và hai rows, gồm `proposals` với studentId/status. Trong cùng phiên, `/api/proposals/p-student` hoặc `/api/task-submissions/.../review-context` từ chối principal ngoài scope. Lỗi hiện hữu trong `backend/src/topic/controller/topic.controller.ts` và `service/topic.service.ts`: chỉ nhận termId, không chuyển principal hoặc intersect grant/owner.

Đây là lộ metadata học thuật/ownership; **không tuyên bố** endpoint này đã trả nội dung ProposalVersion hoặc cho tải file private. Các download negative tests vẫn PASS.

Fix applied: chưa thay đổi module của người 1. Cần xác nhận API này là danh mục công khai riêng hay endpoint học thuật có scope; nếu có nhu cầu catalog công khai, phải chốt projection loại dữ liệu hồ sơ/SV. Phương án cần phối hợp: read policy theo principal + term/grant/owner, giữ array envelope và ID cũ; kiểm reviewer chỉ thấy assigned SEALED context, không draft. Không dùng role FACULTY/ADMIN làm toàn hệ thống và không lấy grant từ client.

### SEC-02 — legacy registration list vượt scope (P1, chưa sửa)

Cùng hai principal trên gọi GET `/api/registrations/term/qa-t1` đều nhận 200, hai registrations kèm student/preferences/advisor. `backend/src/registration/controller/registration.controller.ts` và `service/registration.service.ts` chưa có action permission/scope policy cho read này.

Fix applied: chưa tự chọn quy tắc visibility đăng ký/nguyện vọng của bước 1–3. Chủ module cần chốt permission và projection cho Khoa/SV/GVHD/ADMIN, rồi thêm policy server-side với negative tests. Chỉ thêm decorator mà vẫn cho mọi STUDENT có read permission xem tất cả term là chưa đủ. Không đổi shape API hoặc đưa dependency `registration → topic` để chữa tắt.

Hai finding là lỗi có sẵn, không do code nghiệp vụ 8C mới. Tuy nhiên API cũ tồn tại song song nên vẫn là blocker đánh giá an toàn tích hợp. Chỉ dẫn trước yêu cầu dừng nếu cần đổi contract của module bước 1–3; vì vậy lượt QA này ghi evidence và phương án phối hợp, không âm thầm sửa hai contract đó.

### QA-01 / QA-02 — lỗi harness mới, đã sửa và chạy lại

- QA-01: snapshot compatibility dùng `orderBy.id` cho TermLecturer có khóa ghép. Sửa thành termId+lecturerId; seed/DB comparison sau luồng chạy thành công. Evidence lỗi trước sửa: [attempt-01-harness.json](evidence/steps4-8/attempt-01-harness.json).
- QA-02: `fetch` của Node trả property `response.status`, không phải method Playwright `status()`. Sửa đúng API, negative checks sau luồng thực sự đã chạy. Evidence: [attempt-02-browser.json](evidence/steps4-8/attempt-02-browser.json), [attempt-02-harness.json](evidence/steps4-8/attempt-02-harness.json).
- Wrapper được bổ sung chặn snapshot evidence cũ/thiếu file và không ghi aggregate PASS khi chưa chạy đủ suite; đã chạy lại wrapper cuối. Không bỏ assertion, không nới quyền hoặc thay state để làm test xanh.

Không tìm thấy lỗi mới buộc phải sửa business logic/schema trong các đường canonical 4–8 đã kiểm. Điều này không phải cam kết không còn lỗi hoặc mọi state combination đã được vét cạn.

## 7. Chạy lại an toàn

Prerequisite: cài dependencies đúng lockfile, PG17 riêng loopback và role có quyền tạo database test, Edge, build backend và Prisma Client đã generate. Không dùng DATABASE_URL/DIRECT_URL của nhóm làm target; runners không fallback sang backend/.env. Tên DB bắt buộc `btl_pr2b_*` và host bắt buộc `127.0.0.1`.

```powershell
pnpm verify
# Tự tạo một database RỖNG mới trên PostgreSQL test; cung cấp URI riêng
# vào PR2B_TEST_URL trong process bằng secret local, không ghi password vào Git.
# PR2B_PSQL trỏ psql.exe của PostgreSQL test nếu psql không có trên PATH.
pnpm --filter @doan/backend test:integration:steps4-8:suite
pnpm --filter @doan/backend test:integration:steps4-8:browser

# Đổi PR2B_TEST_URL sang database test RỖNG mới trước E2E.
# E2E tự replay migrations + seed + chạy backend/browser và giữ DB sau test.
pnpm --filter @doan/backend test:integration:steps4-8:e2e
```

Suite cần quyền CREATEDB trên server test vì mỗi child tạo DB mới; không xin quyền này trên Supabase chung. Lượt đã chạy sử dụng portable PG17 có sẵn ngoài repository, không cài Docker hoặc dependency mới. E2E hiện **cố ý báo exit 1 vì phát hiện security bug có thật**, không phải command demo; không bỏ probe để nhận PASS. Sau khi SEC-01/02 được sửa theo contract đã duyệt, chạy lại suite liên quan và E2E trên DB mới để cập nhật báo cáo.

Evidence JSON/log được giữ dưới `docs/implementation/evidence/steps4-8`; suite snapshot riêng tránh việc producer prelude ghi lại evidence cũ. Runner khép Nest/Vite/Edge sau test. PostgreSQL test được dừng cuối lượt QA, giữ nguyên các database và private fixtures; không có cleanup tự drop DB hoặc xóa bài nộp để thử lại.

## 8. Remaining risks và điều kiện merge

1. **Chặn merge an toàn toàn hệ thống:** xử lý SEC-01/SEC-02 với chủ bước 1–3; chốt visibility/projection của hai legacy list, bổ sung permission/parent scope, giữ read shape đã cam kết; chạy lại bốn probe đến PASS. Báo cáo hiện có FAIL thực tế, không kết luận mọi API đã an toàn.
2. Review phạm vi feature 4–8 đã có bằng chứng tốt: core E2E thật PASS, 154 API checks, bảy upgrade suites, 73 browser mock checks và unit/build/lint/type-check PASS. Có thể mở PR để review, chưa nên merge toàn bộ nhánh như một hệ thống đã qua QA security.
3. Không deploy Supabase trong lượt này. Trước DDL chung vẫn cần inspect history/checksum/drift/dữ liệu, backup DB+volume và phê duyệt đúng target/SQL. Test loopback không chứng minh quyền PostgreSQL/Supabase hoặc tải/lock production.
4. Producer bước 1–3 phải cung cấp roster, officialPlan FINALIZED, agreement/profile, phase/period/obligation/grant và lock/handover protocol. Fixture không thay được nghiệm thu producer thật; legacy rows thiếu canonical provenance vẫn fail closed/được cảnh báo.
5. Chưa có email worker/automated prolonged-delay alerts, FR25 criteria/điểm giai đoạn hoặc E2E nghiệp vụ bước 9–10; không coi PASS task là đủ bảo vệ/điểm tốt nghiệp. Các phần này không được tự implement trong lượt QA.
6. Browser thật mới kiểm Edge desktop/mobile viewport với một luồng thành công xuyên suốt. Chưa chạy Firefox/Safari, concurrency nhiều nghìn user, scan virus ngoài validators hiện có, nghiệm thu bố cục PDF bằng người dùng hay remote CI.

## 9. File thay đổi trong lượt QA

Thêm:

- `backend/scripts/integration/seed-steps4-8.cjs` — seed tổng hợp có guard, không overwrite.
- `backend/scripts/test-steps4-8-suite.cjs` — điều phối API/upgrade hoặc browser mock, DB mới và snapshot/log riêng.
- `backend/scripts/test-steps4-8-e2e.cjs` — live backend, inventory 66 operations, roleless gate, PDF/legacy data assertions và security probes.
- `frontend/scripts/test-steps4-8-browser.cjs` — UI thật từ login qua bước 4–8, negative ownership/mobile.
- Báo cáo này và `docs/implementation/evidence/steps4-8/` gồm JSON/log/PDF/ảnh và evidence hai lỗi harness đã sửa.

Sửa trực tiếp: `backend/package.json` thêm ba script QA; `docs/implementation/03-team-development-guide.md` thêm đường dẫn kết quả integration và trạng thái blocker. Các runner có sẵn ghi lại `backend/prisma/review/step*-results.json` và PDF fixture bước 7; đây là artifacts được tái tạo, không phải sửa logic chức năng cũ.

Working tree đã có nhiều modified/untracked từ các bước trước khi bắt đầu QA. Không coi toàn bộ `git diff --stat` là thay đổi của lượt này. Không sửa source business/backend/frontend đã triển khai, schema, migration, env, dependencies hoặc lockfile. Git status/diff được kiểm cuối lượt; index không có file stage.

## 10. Endpoint authentication/action inventory

Mỗi hàng là một operation đã gọi thật trên backend của live runner. Expected/actual chỉ áp dụng authentication/action gate; ownership với ID hợp lệ được kiểm ở §3–§5. Notification self-list/read dùng quyền recipient theo thiết kế.

| Method + endpoint | Expected anonymous / no-permission | Actual anonymous / no-permission | Status |
|---|---|---|---|
| GET `/api/review-group-options/terms` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/terms/{termId}/review-group-options` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/terms/{termId}/review-groups` | 401 / 403 | 401 / 403 | PASS |
| POST `/api/terms/{termId}/review-groups` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/review-groups/{id}` | 401 / 403 | 401 / 403 | PASS |
| PATCH `/api/review-groups/{id}` | 401 / 403 | 401 / 403 | PASS |
| DELETE `/api/review-groups/{id}` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/review-groups/{id}/members` | 401 / 403 | 401 / 403 | PASS |
| POST `/api/review-groups/{id}/members` | 401 / 403 | 401 / 403 | PASS |
| DELETE `/api/review-groups/{id}/members/{lecturerId}` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/proposal-review-options/terms` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/terms/{termId}/proposal-review-options` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/terms/{termId}/proposals` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/proposals/{id}` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/proposals/{id}/review-candidates` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/proposals/{id}/review-history` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/proposal-reviews/{id}` | 401 / 403 | 401 / 403 | PASS |
| POST `/api/proposals/{id}/review-assignments` | 401 / 403 | 401 / 403 | PASS |
| POST `/api/proposal-reviews/{id}/start` | 401 / 403 | 401 / 403 | PASS |
| POST `/api/proposal-reviews/{id}/comments` | 401 / 403 | 401 / 403 | PASS |
| POST `/api/proposal-reviews/{id}/decision` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/proposals/{proposalId}/editing-context` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/proposals/{proposalId}/versions` | 401 / 403 | 401 / 403 | PASS |
| POST `/api/proposals/{proposalId}/versions` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/proposals/{proposalId}/versions/compare` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/proposals/{proposalId}/versions/{versionId}` | 401 / 403 | 401 / 403 | PASS |
| POST `/api/proposals/{proposalId}/submit` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/proposals/{proposalId}/dossier` | 401 / 403 | 401 / 403 | PASS |
| POST `/api/proposals/{proposalId}/finalize` | 401 / 403 | 401 / 403 | PASS |
| POST `/api/proposals/{proposalId}/dossier/receipt` | 401 / 403 | 401 / 403 | PASS |
| POST `/api/proposals/{proposalId}/dossier/pdf` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/proposals/{proposalId}/dossier.pdf` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/tasks/plan/{planId}` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/proposals/{proposalId}/guidance-context` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/proposals/{proposalId}/guidance-plan` | 401 / 403 | 401 / 403 | PASS |
| POST `/api/proposals/{proposalId}/guidance-plan` | 401 / 403 | 401 / 403 | PASS |
| PATCH `/api/guidance-plans/{planId}` | 401 / 403 | 401 / 403 | PASS |
| POST `/api/guidance-plans/{planId}/resume` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/guidance-plans/{planId}/tasks` | 401 / 403 | 401 / 403 | PASS |
| POST `/api/guidance-plans/{planId}/tasks` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/terms/{termId}/guidance-tasks` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/terms/{termId}/guidance-periods` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/terms/{termId}/weekly-report-coverage` | 401 / 403 | 401 / 403 | PASS |
| POST `/api/weekly-report-obligations/{id}/task` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/tasks/{id}` | 401 / 403 | 401 / 403 | PASS |
| PATCH `/api/tasks/{id}` | 401 / 403 | 401 / 403 | PASS |
| POST `/api/tasks/{id}/progress` | 401 / 403 | 401 / 403 | PASS |
| POST `/api/tasks/{id}/cancel` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/tasks/{taskId}/submission-context` | 401 / 403 | 401 / 403 | PASS |
| POST `/api/tasks/{taskId}/submission-uploads` | 401 / 403 | 401 / 403 | PASS |
| POST `/api/tasks/{taskId}/submissions` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/tasks/{taskId}/submissions` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/task-submissions/{submissionId}` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/task-submissions/{submissionId}/files/{fileId}/download` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/guidance-review-options/terms` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/task-submissions/{id}/review-context` | 401 / 403 | 401 / 403 | PASS |
| POST `/api/task-submissions/{id}/reviews` | 401 / 403 | 401 / 403 | PASS |
| POST `/api/task-reviews/{id}/amendments` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/terms/{termId}/progress-review-inbox` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/terms/{termId}/guidance-dashboard` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/guidance-plans/{id}/meetings` | 401 / 403 | 401 / 403 | PASS |
| POST `/api/guidance-plans/{id}/meetings` | 401 / 403 | 401 / 403 | PASS |
| PATCH `/api/guidance-meetings/{id}` | 401 / 403 | 401 / 403 | PASS |
| GET `/api/notifications/user/{userId}` | 401 / 404 | 401 / 404 | PASS |
| GET `/api/me/notifications` | 401 / 200 | 401 / 200 | PASS |
| POST `/api/me/notifications/{id}/read` | 401 / 404 | 401 / 404 | PASS |

Evidence: [endpoint-auth.json](evidence/steps4-8/endpoint-auth.json). Kết quả tổng hợp máy đọc được: [summary.json](evidence/steps4-8/summary.json); hash artifacts/QA source: [sha256-manifest.json](evidence/steps4-8/sha256-manifest.json).
