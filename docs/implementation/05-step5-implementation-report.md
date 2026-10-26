# BƯỚC 5 — Phân công và xét duyệt đề cương

Ngày: 22/10/2026. Đã triển khai backend và frontend, tích hợp nhóm duyệt bước 4. **Chưa deploy migration hoặc ghi dữ liệu lên Supabase chung. Không triển khai bước 6–8, không stage/commit/push.**

## 1. Baseline và quyết định bổ sung

Theo `01-business-decisions-and-contract.md` §2–§7, các ADR, tài liệu DOCX và hướng dẫn phân công ba thành viên. Các proposal lịch sử trong audit không thay baseline PR1 đã được người dùng phê duyệt.

Trong phiên này người dùng xác nhận: **chỉ nhận xét; chờ chốt bộ tiêu chí/kết quả cá nhân**. Vì vậy không thêm rubric, điểm cá nhân, vote, quorum, trưởng nhóm hoặc kết quả cá nhân. Nhiều thành viên được append nhận xét; một thành viên hợp lệ được ghi **một kết luận chung duy nhất/vòng**. Hai kết quả chuẩn của quyết định là `APPROVED` và `REVISION_REQUIRED`.

Giữ enum Proposal cũ: quyết định `REVISION_REQUIRED` chuyển Proposal sang **`REVISION_REQUESTED`**, đúng baseline và tương thích consumer hiện tại. Response quyết định vẫn giữ `REVISION_REQUIRED`, không gộp hoặc đổi thành REJECTED. APPROVED không tự chốt dossier; chức năng Khoa chốt hồ sơ thuộc bước tiếp theo.

## 2. Chức năng đã có

- Khoa xem hàng đợi có phân trang, tìm theo đề tài/tên/mã SV, lọc đợt, bộ môn, trạng thái, nhóm và chưa phân công (groupId được hỗ trợ qua API). Scope luôn giao với grant hiện hành.
- Đề xuất nhóm cùng đợt/bộ môn theo `Topic.researchAreaId → ResearchAreaWorkflow.departmentId`. Đếm GV khớp hướng chuyên môn để tham khảo; không xếp điểm, chọn ngẫu nhiên, tự chọn hoặc tự xác nhận nhóm. Nhóm cần thành viên hiện hành hợp lệ và có reviewer ngoài GVHD.
- Khoa xác nhận hoặc phân lại. Phân lại cần vòng cũ/revision/lý do, supersede vòng cũ, tạo vòng ASSIGNED mới và giữ liên kết lịch sử. Không sửa nhóm hoặc version trên vòng cũ.
- Reviewer đọc đúng version được phân; inbox không đưa version mới chưa phân công cho reviewer cũ. F/owner/GVHD hiện hành có đường đọc riêng theo PR1. Không lấy quyền GVHD để ghi như reviewer trên hồ sơ mình.
- Start là POST rõ ràng, không tự đổi trạng thái khi GET. Nhận xét append-only, có author/version/time. Kết luận lưu actor/version/time/comment riêng, immutable và tối đa một hàng/vòng.
- Mọi mutation có strict Zod validation, Idempotency-Key, expected revisions, kiểm phase/state/ownership/official assignment/agreement/version/routing, audit cùng transaction. Từ chối dữ liệu legacy thiếu chứng cứ, không suy từ latest version hoặc PUBLISHED.
- Giao diện nối `/topic/reviews`, `/topic/reviews/:id` và `/topic/review-assignments/:proposalId`; dùng layout template của bước 4. Có loading/empty/error/success, phiên bản/hash/vòng đang xét, lịch sử vòng, nhận xét nhiều người và kết luận chung riêng. Giữ nội dung đang nhập khi gặp 409; tải lại là thao tác chủ động. Đổi ID vòng reset form để không mang nhận xét sang vòng khác.
- Ghi `PROPOSAL_REVIEW_DECIDED` vào OutboxEvent cùng transaction, chứa ID người nhận SV/GVHD và resource. **Chưa có worker gửi email/thông báo cho event mới**; không tuyên bố đã gửi email.

## 3. State machine thực thi

| Command | Proposal | ProposalReview | Guard chính |
|---|---|---|---|
| Assign | SUBMITTED → SUBMITTED | tạo ASSIGNED | SEALED submitted version, routing đúng, official FINALIZED, counter đã có |
| Reassign | SUBMITTED/UNDER_REVIEW → SUBMITTED | vòng cũ SUPERSEDED + vòng mới ASSIGNED | replacesReviewId/revisions/reason; một active vòng |
| Start | SUBMITTED → UNDER_REVIEW | ASSIGNED → IN_REVIEW | member hiện hành, khác GVHD, đúng version |
| Comment | giữ nguyên | ASSIGNED/IN_REVIEW, revision +1 | version hiện hành; không ghi khi đã kết luận |
| Decide APPROVED | UNDER_REVIEW → APPROVED | IN_REVIEW → DECIDED | CAS hai aggregate, unique decision |
| Decide REVISION_REQUIRED | UNDER_REVIEW → REVISION_REQUESTED | IN_REVIEW → DECIDED | bắt buộc comment, CAS hai aggregate |

Không có PATCH status, amend kết luận cũ, REJECTED mới, tự approve, finalize dossier, submit/rút/sửa đề cương hoặc guidance/task trong lần này. Vòng cũ read-only; phiên bản cũ không được kết luận dù client gửi revision cũ hoặc versionId mới vào vòng cũ. Routing đổi revision/hướng/bộ môn cần Khoa phân lại có lý do trước khi tiếp tục ghi.

## 4. API và quyền

Success `{success:true,data,timestamp}`; list data `{data,total,page,limit,totalPages}`. ID opaque, không ép UUID lên ID legacy. Error `{success:false,error:{code,message},timestamp}`. Actor lấy từ JWT sub được verify và account/role/permission trong database; không lấy actor từ body hoặc tin mảng role client.

| Method / sau `/api` | Input | Output / quyền |
|---|---|---|
| GET `/proposal-review-options/terms` | — | các đợt đọc được; proposal:read |
| GET `/terms/:termId/proposal-review-options` | — | phase, bộ môn trong grant, canAssign; không trả roster toàn đợt cho reviewer |
| GET `/terms/:termId/proposals` | page/limit/search/status/departmentId/groupId/unassigned | page summary, phiên bản trong scope; proposal:read |
| GET `/proposals/:id` | — | submitted version SEALED; F/owner/GVHD; reviewer chỉ khi version hiện hành đã được phân cho mình |
| GET `/proposals/:id/review-candidates` | — | nhóm và số khớp chuyên môn tham khảo; proposal:assign + F |
| GET `/proposals/:id/review-history` | — | vòng/comment/decision trong quyền đọc; R chỉ vòng của nhóm mình |
| GET `/proposal-reviews/:id` | — | version đã phân, comments[], decision object/null, allowedActions[] |
| POST `/proposals/:id/review-assignments` | groupId,proposalVersionId,expectedProposalRevision; phân lại thêm replacesReviewId,expectedReviewRevision,reason | 201 ReviewView; proposal:assign + F |
| POST `/proposal-reviews/:id/start` | expectedProposalRevision,expectedReviewRevision | 200 ReviewView; proposal:review + R |
| POST `/proposal-reviews/:id/comments` | expectedReviewRevision,versionId,text | 201 ReviewView; proposal:comment + R |
| POST `/proposal-reviews/:id/decision` | expectedProposalRevision,expectedReviewRevision,versionId,decision,comment? | 200 ReviewView; proposal:review + R; trả sửa phải có comment |

Mọi POST cần Idempotency-Key, replay cùng payload không thêm vòng/audit/outbox; khác payload → IDEMPOTENCY_CONFLICT. Trước replay vẫn kiểm account/quyền/scope/quan hệ hiện hành. Scope ngoài tài nguyên trả 404; không có action trả 403. Các lỗi 409 gồm INPUT_NOT_READY, TOPIC_NOT_AGREED, ROUTING_NOT_CONFIGURED, ROUTING_MISMATCH, TERM_003, STALE_VERSION, ACTIVE_REVIEW_EXISTS, REVIEW_ALREADY_DECIDED, STATE_TRANSITION_INVALID, REVISION_CONFLICT. DTO sai/field lạ/thiếu key → 400 COMMON_003. Swagger công bố route, request body, idempotency header và lỗi.

| Chủ thể | Đọc | Phân/phân lại | Nhận xét / start / kết luận |
|---|---|---|---|
| FACULTY | đợt/bộ môn trong grant của đúng role/action | có proposal:assign + grant | không bằng quyền Khoa |
| LECTURER là reviewer | version/vòng của nhóm, roster hiện hành | không | có permission tương ứng, thành viên hiện hành và không là GVHD hồ sơ |
| GVHD chính thức hiện hành | hồ sơ SV hướng dẫn qua official FINALIZED | không | không được self-review dù thuộc nhóm |
| STUDENT | hồ sơ của mình theo ownership | không | không |
| ADMIN-only | không có quyền học thuật tự động | không | không |

Không tạo JWT role REVIEW_GROUP_MEMBER. Người có nhiều role vẫn phải thỏa action + scope trên cùng đường cấp quyền; không mượn action ADMIN ghép grant FACULTY.

## 5. Schema và migration mới

File: `backend/prisma/migrations/202610220001_proposal_review_assignment/migration.sql`.

SHA256 SQL cuối đã kiểm thử: `1a77a25e8dca6baacefaf69ae8ee67b0b96a8b97ee0d4b30a17eb22eba39dc37`.

- Thêm nullable `ProposalReviewWorkflow.assignedAt` (TIMESTAMPTZ), `assignedByUserId` (VARCHAR36) và FK Restrict tới UserAccount; relation `assignedBy` và inverse `UserAccount.assignedProposalReviews`.
- Tạo definitions `proposal:read/assign/comment/review` nếu chưa tồn tại; bind **chỉ action liệt kê** cho role có sẵn: FACULTY read/assign, LECTURER read/comment/review, STUDENT read. Không tạo user/role/grant và không bind ADMIN hoặc permission tương lai.
- Role tạo sau migration cần chủ auth/bootstrap cấp permission đúng manifest, kèm scope/quan hệ; không dùng seed ADMIN wildcard làm nghiệp vụ chuẩn.
- Giữ các bảng/cột/unique/relation legacy, Topic.proposals[], Student.proposal, Proposal.studentId unique và enum cũ. Không backfill actor/time/approval/ownership hoặc sửa 0_init/migration cũ.
- Reuse partial unique `pr2b_one_active_review`, unique `ProposalReviewDecision.reviewId`, composite review/version FK và trigger append-only sẵn có từ expand PR2B. Không tạo constraints trùng hoặc thay onDelete/timestamp của module khác.

Migration có BEGIN/COMMIT và lock_timeout 10s. Đã replay trên DB trống và nâng cấp từ baseline bước 4 có fixture synthetic. Deploy lặp lại bằng Prisma không áp lại DDL. Mật khẩu test chỉ ở TEMP, không nằm trong source/tài liệu; URL test phải được cấp qua PR2B_TEST_URL và bị chặn nếu không phải loopback/btl_pr2b_*.

Phục hồi: trước deploy thật phải read-only inspect/history/checksum, backup và duyệt SQL theo quy trình nhóm. Nếu transaction DDL lỗi, PostgreSQL rollback; kiểm history rồi xử lý migration failed qua quy trình Prisma được duyệt, không reset/db push. Nếu cần quay lại app cũ sau deploy thành công, giữ cột nullable/permission definitions/lịch sử, ngừng feature mới và quay về app trước đó; không xóa chứng cứ, không tự chạy down SQL/drop. Dữ liệu đã có quyết định phải giữ nguyên; lỗi nghiệp vụ xử lý bằng vòng mới theo quyền, không sửa decision cũ.

## 6. Concurrency, audit và phối hợp producer

Transaction mutation SERIALIZABLE; read REPEATABLE READ. Lock order term → group IDs theo thứ tự → proposal → phase rows → assignment rows. Tái kiểm quyền sau lock, kiểm revision và phase trước khi hoàn tất command. Retry bounded cho P2034/P2002 và raw SQL P2010 với SQLSTATE 40001/40P01; hết retry trả 409. Hai quyết định hoặc phân công cùng revision chỉ một thành công. Append comment cũng tăng review revision nên client cũ phải reload.

Audit không sao chép nội dung học thuật vào technical log; nhận xét/decision đầy đủ lưu trong bảng domain append-only. Audit/outbox/idempotency cùng transaction với thay đổi nghiệp vụ. Audit INSERT lỗi phải rollback vòng/revision, không để kết quả một nửa.

Chủ bước 1–3 cần bàn giao:

1. Account ACTIVE, business role/permission hiện hành, AcademicTermGrant theo đợt/bộ môn; bootstrap role sau migration theo manifest trên.
2. TermStudent ownership nhất quán với Proposal.studentId và Topic.termId; TopicWorkflow.termStudentId/termId; TermLecturer của GVHD/reviewer.
3. TermPhaseWorkflow.key=PROPOSAL_REVIEW cùng term, revision, thời gian và lock rõ ràng; mutation producer dùng cùng protocol term lock.
4. ResearchAreaWorkflow.departmentId/revision. Đổi routing không âm thầm chuyển review cũ.
5. TermWorkflow.officialAssignmentPlanId trỏ AssignmentPlan FINALIZED cùng đợt, AssignmentPlanWorkflow.finalizedAt/finalizedByUserId; AdvisorAssignment và AssignmentChange có revision/effectiveAt nhất quán. PUBLISHED chưa đủ. Bàn giao/roster/member/grant/phase writer phải phối hợp khóa để không bỏ qua kiểm quyền/state trong consumer.
6. Topic agreement đúng topic revision, assignment revision và advisor hiện hành. Không suy xác nhận từ isActive.
7. ProposalWorkflow submittedVersionId/submissionKind/revision/**nextReviewRound**; ProposalVersion thuộc đúng proposal, SEALED, schemaVersion1, canonical contentHash, submittedAt và submittedByUserId đúng SV. Counter thiếu/legacy mơ hồ trả INPUT_NOT_READY; không dùng MAX+1 hoặc tự backfill.

Read adapter mới không sửa business logic/API cũ của auth/catalog/term/registration hoặc consumer bước 9–10. Producer phải giữ SEALED content bất biến và cập nhật pointer/revision cùng transaction; không ghi trực tiếp vòng/decision để né policy. Scope học thuật của các endpoint legacy ngoài feature này chưa được sửa trong PR.

## 7. Kiểm thử thực tế

| Lệnh / nhóm kiểm tra | Kết quả |
|---|---|
| `pnpm verify` | PASS: validate/generate, legacy/PR2B compatibility, type-check, lint, tests, build |
| Backend Vitest | 48 tests PASS; 18 mới của bước 5, 22 bước 4, 8 hiện có |
| Frontend Vitest | 11 tests PASS; 4 mới của bước 5, 7 hiện có |
| Database/tool guards trong verify | 12 checks PASS |
| `pnpm --filter @doan/backend test:proposal-reviews:api` | 27 PostgreSQL17 + HTTP checks PASS |
| `pnpm --filter @doan/backend test:proposal-reviews:upgrade` | PASS: baseline có dữ liệu, metadata cũ NULL, data/boolean/audit giữ nguyên, action chính xác, checksum/deploy lại |
| `pnpm --filter @doan/frontend test:proposal-reviews:browser` | 10 Edge checks PASS, API giả lập |
| Hồi quy `test:review-groups:api` | 31 checks PASS trên cây migration active |
| Hồi quy `test:review-groups:upgrade` | PASS cho mốc nâng cấp bước 4 đã cố định |
| Hồi quy `test:review-groups:browser` | 9 Edge checks PASS |

27 ca HTTP bao phủ: scope và forged claims; ADMIN deny; owner/advisor đọc đúng phạm vi nhưng không self-review; candidates không ghi dữ liệu; group khác đợt/bộ môn; sealed submitted thay vì latest draft; idempotency/duplicate; explicit start; nhiều nhận xét; concurrent approval; revision-required bắt buộc comment; round read-only; cached response sau revoke; stale version; reassign/history; input counter thiếu; phase khóa; audit rollback; concurrent assignment/comment; race khóa phase thật trên PostgreSQL; PUBLISHED/agreement hết hiệu lực; routing thay đổi cần xác nhận phân lại; không tạo dossier/task/guidance.

Browser kiểm giao diện Khoa chọn nhóm chủ động, validate bắt buộc, reviewer start, nhận xét riêng, kết luận hai mức, 409 giữ văn bản, khóa controls sau quyết định, lỗi scope và mobile 375px không tràn ngang. Đây là browser với mock API, tách biệt integration HTTP/PostgreSQL thật; chưa chạy browser với login thật/dữ liệu Supabase.

Các lượt đầu phát hiện và đã sửa: trạng thái ACTIVE của fixture, reviewer khác advisor trong fixture đợt 2, raw row-lock serialization cần xử lý P2010/40001, upgrade fixture dùng client mới trước khi cột mới có. Không reset/xóa các DB test thất bại, mỗi lượt dữ liệu mới dùng DB mới.

Windows sandbox có spawn EPERM khi chạy worker test không escalation; chạy lại với quyền thực thi local hợp lệ thì PASS. Một lượt generate bị Windows giữ DLL vì chạy song song integration Prisma; đã chạy lại verify **tuần tự sau khi client đóng**, PASS, không nâng dependency/xóa node_modules. Còn warning Vite CJS deprecated, React Router useLayoutEffect khi SSR test và Node DEP0190 trong verify runner cũ; không làm checks thất bại, không refactor ngoài phạm vi.

Evidence: `backend/prisma/review/step5-results.json`, `step5-upgrade-results.json`, `step5-browser-results.json`. Database riêng chạy PostgreSQL17.11 portable trên 127.0.0.1:55441; cluster test trong TEMP, không Windows service, không database nhóm. Đã dừng các cluster local do phiên này khởi động sau khi kiểm thử, giữ dữ liệu/evidence. CI bổ sung hai runner backend bước 5, chưa tuyên bố CI remote đã chạy.

## 8. File thay đổi trong phiên bước 5

**Mới:**

- `backend/src/topic/proposal-reviews/proposal-review.controller.ts`
- `backend/src/topic/proposal-reviews/proposal-review.repository.ts`
- `backend/src/topic/proposal-reviews/proposal-review.service.ts`
- `backend/src/topic/proposal-reviews/proposal-review.validator.ts`
- `backend/src/topic/proposal-reviews/proposal-review.spec.ts`
- `shared/src/contracts/proposal-reviews.ts`
- `backend/prisma/migrations/202610220001_proposal_review_assignment/migration.sql`
- `backend/scripts/test-proposal-reviews.cjs`
- `backend/scripts/test-proposal-review-upgrade.cjs`
- `frontend/src/features/proposal-reviews/api.ts`
- `frontend/src/features/proposal-reviews/components.tsx`
- `frontend/src/features/proposal-reviews/components.spec.tsx`
- `frontend/src/features/proposal-reviews/pages.tsx`
- `frontend/scripts/test-proposal-reviews-browser.cjs`
- Ba JSON evidence bước 5 và tài liệu này.

**Mở rộng file chung / tích hợp trực tiếp:**

- `backend/prisma/schema.prisma`: hai field nullable + relations metadata phân công.
- `backend/src/topic/topic.module.ts`: đăng ký controller/service/repository/validator mới.
- `shared/src/index.ts`: export contract.
- `frontend/src/app/router/routes.tsx`: nối route bước 5, thay đăng ký route placeholder cũ, giữ route khác.
- `frontend/src/features/review-groups/workspace.tsx`: mode/layout bước 5 và liên kết menu; mode bước 4 giữ nguyên, đã hồi quy.
- `backend/package.json`, `frontend/package.json`: script test; không thêm dependency.
- `.github/workflows/backend-ci.yml`: job steps/evidence bước 5, không URL Supabase.
- `backend/scripts/test-review-groups.cjs`: đếm migration active thay hardcode 4.
- `backend/scripts/test-review-group-upgrade.cjs`: cố định lịch sử tới migration bước 4 cho đúng đối tượng regression.
- Ba JSON evidence bước 4 được cập nhật do chạy lại kiểm thử.

Git có sẵn nhiều thay đổi chưa commit của bước 4 từ đầu phiên; danh sách trên chỉ phần lượt bước 5 tác động. Giữ nguyên DOCX, ADR, tài liệu baseline 00–03, migration 0_init/bridge/expand/nhóm duyệt, lockfile và các module business của người 1/3. Không stage/commit/push.

## 9. Còn thiếu trước chạy môi trường nhóm

- Người dùng/nhóm duyệt và triển khai migration mới qua quy trình kiểm tra/backup/approval của Supabase, chưa chạy trong phiên này.
- Bàn giao dữ liệu thật từ bước 1–3 theo §6; test fixture không thay dữ liệu chính thức. Không có submitted context hợp lệ thì workflow chặn ghi rõ lỗi.
- Bộ tiêu chí/kết quả cá nhân chờ người dùng chốt; đã chủ động loại khỏi chức năng thay vì tự đặt quy định.
- Worker xử lý outbox/email và file download có kiểm quyền chưa thuộc phần chức năng này. Version content hiển thị; không công khai filePath/storage key legacy.
- Student save/submit/resubmit/withdraw và Khoa finalize/reopen/dossier chưa được triển khai ở đây. Luồng sửa rồi nộp lại end-to-end cần các command tương ứng ở PR sau; kiểm thử stale version dùng producer synthetic trong DB riêng.

Không tự bắt đầu bước 6–8 hoặc deploy database nhóm từ kết quả kiểm thử này.
