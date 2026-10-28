# BƯỚC 6 — Chỉnh sửa đề cương và quản lý phiên bản

Ngày 22/10/2026. Đã triển khai backend/frontend bước 6 và kiểm thử tích hợp với bước 5. Không triển khai chốt hồ sơ/PDF/hướng dẫn/task của bước 7–8. **Không kết nối hoặc chạy DDL lên Supabase chung; chưa stage/commit/push.**

## 1. Quy tắc và hành vi

Nguồn: baseline PR1 `01-business-decisions-and-contract.md` §3.2–3.4, §4.1–4.2, §5–§7, tài liệu DOCX/use-case, ADR và contract bước 5 hiện hành.

- `ProposalReviewDecision.decision=REVISION_REQUIRED` tương ứng `Proposal.status=REVISION_REQUESTED` trong enum hiện tại. Không thêm/đổi enum legacy hoặc diễn giải REJECTED thành yêu cầu sửa.
- SV sở hữu và GVHD chính thức hiện hành được lưu snapshot khi Proposal DRAFT hoặc REVISION_REQUESTED, đúng phase PROPOSAL_EDIT. Không cho ghi khi SUBMITTED/UNDER_REVIEW/APPROVED hoặc dossier đã chốt/nhận giấy/còn finalization hiệu lực. Dossier legacy chưa xác định cũng chặn để đối soát.
- Từ REVISION_REQUESTED phải có quyết định REVISION_REQUIRED gắn đúng submittedVersionId, và bản bị trả sửa phải SEALED. Lưu tạo snapshot DRAFT mới dựa trên bản đó, chuyển Proposal về DRAFT. Không sửa nội dung/nhận xét/quyết định của bản cũ.
- Mỗi lần bấm lưu nháp tạo một ProposalVersion mới, dùng counter và CAS, không UPDATE content bản nháp cũ; chưa autosave server. Chỉ SV gửi đúng workingVersion đã lưu. Gửi seal chính hàng snapshot đó một lần, không tạo bản trùng rồi đổi số phiên bản: v2 lưu → v2 SEALED → submittedVersionId=v2.
- Nội dung draft được thiếu trường; submit kiểm đủ mục tiêu/phạm vi/nội dung/công cụ/kết quả, thời gian có timezone, bắt đầu trước kết thúc và mốc có nội dung/sản phẩm/thời gian trong khoảng thực hiện. Không tự tạo tuần, deadline hoặc quy tắc cấm mốc chồng lấn.
- Submit kiểm official plan FINALIZED, pointer chính thức cùng đợt, roster, assignment/history hiệu lực, Topic agreement đúng revision và routing. PUBLISHED hoặc kết quả thuật toán chưa chốt không cấp quyền GVHD. Không thêm sign-off mỗi version.
- Sửa ProposalContent tạo version, không âm thầm sửa Topic UC11 hoặc gia hạn phase. Thay Topic/assignment cần producer xác nhận agreement theo PR1; thiếu chứng cứ trả lỗi, không tự ghi xác nhận.
- Gửi lại ghi `submissionKind=RESUBMISSION` nếu có bản đã nộp trước, đưa Proposal về SUBMITTED và ghi outbox. Không tự phân nhóm; Khoa phân vòng mới qua API bước 5. Vòng cũ vẫn trỏ đúng v1.

## 2. Phản hồi góp ý và so sánh

Nhận xét ReviewComment và quyết định yêu cầu sửa được đọc từ bước 5, có ID tác giả, version/vòng nguồn, nội dung, thời gian. Mỗi snapshot mới lưu `revisionResponses` gồm `{targetType:COMMENT|DECISION,targetId,text}`. Server kiểm target thực thuộc cùng Proposal, nguồn SEALED và không trùng mục. Không nhận tác giả/thời gian từ client.

Phản hồi nằm trong metadata snapshot bất biến. Khi không gửi field responses, lưu kế tiếp kế thừa phản hồi của snapshot nền; gửi `[]` tạo bản mới không có phản hồi, bản cũ vẫn được giữ. Tác giả/thời gian lưu nằm ở snapshot; không bịa tác giả riêng cho phản hồi kế thừa. Không ghi đè góp ý gốc, không tự đánh dấu góp ý “đã được reviewer chấp nhận”. Baseline chưa yêu cầu trả lời đủ mọi góp ý trước submit nên không tự thêm điều kiện bắt buộc đó.

So sánh đệ quy dữ liệu thực: trường JSON content, các phần tử schedule và responses. Trả path/before/after/beforeExists/afterExists; phân biệt thêm/xóa với null và không coi thứ tự key object là thay đổi. Không tuyên bố semantic diff, word diff, so sánh PDF hoặc tự merge xung đột.

`contentHash` dùng canonical ProposalContentV1 như bước 5. Phản hồi được bảo vệ bằng snapshot metadata bất biến, không đổi định nghĩa hash của content gây lệch consumer cũ.

## 3. API

Base `/api`, envelope/error theo bước 5. Read có `proposal:read` và scope; POST cần Idempotency-Key. Strict Zod dùng chung frontend/backend, opaque ID, không ép UUID.

| Method / endpoint | Request | Response / guard |
|---|---|---|
| GET `/proposals/:proposalId/editing-context` | — | title/term/status/revision, working/submitted snapshots trong quyền đọc, feedback, phase, readiness, allowedActions |
| GET `/proposals/:proposalId/versions` | page=1,limit=20 (1..100) | page VersionView, số phiên bản giảm dần |
| GET `/proposals/:proposalId/versions/:versionId` | — | VersionView; kiểm cùng Proposal và quyền version trước trả content |
| GET `/proposals/:proposalId/versions/compare` | fromVersionId,toVersionId | changes[]; phải được đọc cả hai version |
| POST `/proposals/:proposalId/versions` | expectedRevision,basedOnVersionId?,content,changeSummary?,responses? | 201 VersionView + proposalRevision mới; proposal:edit + owner/GVHD |
| POST `/proposals/:proposalId/submit` | expectedRevision,versionId | 200 VersionView SEALED + proposalRevision mới; proposal:submit + owner SV |

VersionView có số phiên bản, state, content/hash, createdAt/createdByUserId/authorName, submittedAt/by, basedOnVersionId, changeSummary, responses và provenance. Actor legacy có thể NULL, không tự điền. Không lộ filePath/storage key. Danh sách so sánh trên UI tích lũy các version đã tải qua phân trang; API vẫn kiểm quyền từng ID.

`basedOnVersionId` nếu có phải là bản nền hiện hành: bản submitted bị trả sửa hoặc workingVersion hiện hành. Nếu bỏ field, server chọn chính bản nền hiện hành dưới khóa/revision; không chọn latest bất kỳ. Dùng bản cũ có revision mới cũng bị STALE_VERSION, không overwrite bản người khác.

Các lỗi: 400 COMMON_003/PROPOSAL_CONTENT_INVALID/FEEDBACK_SCOPE_INVALID; 401 AUTH_003; 403 AUTH_002/AUTH_004; ngoài scope 404 COMMON_001; 409 REVISION_CONFLICT/STALE_VERSION/STATE_TRANSITION_INVALID/DOSSIER_LOCKED/ACTIVE_REVIEW_EXISTS/TERM_003/INPUT_NOT_READY/TOPIC_NOT_AGREED/IDEMPOTENCY_CONFLICT. Swagger công bố route, input, header và lỗi.

## 4. Quyền và consistency

| Chủ thể | Đọc version | Lưu bản mới | Gửi duyệt |
|---|---|---|---|
| STUDENT | hồ sơ mình theo TermStudent ownership | đúng owner, role/action và phase/state | chỉ owner, working snapshot DRAFT hợp lệ |
| GVHD | hồ sơ được hướng dẫn qua official assignment hiện hành | official FINALIZED + roster + role/action | không gửi thay SV |
| FACULTY | trong grant đợt/bộ môn | không sửa thay | không |
| REVIEW_GROUP_MEMBER | chỉ SEALED version được phân cho nhóm hiện hành | không | không |
| ADMIN-only | không tự có quyền học thuật | không | không |

Mutation SERIALIZABLE, đọc REPEATABLE READ. Reuse lock order từ bước 5: term → proposal → phase rows → assignment rows (save/submit không đổi review group). Kiểm account/quyền lại sau khóa và trước replay cache; revision tăng atomic; counter nextVersionNumber và unique(proposalId,version) giữ số phiên bản không trùng. Retry bounded serialization/deadlock/unique, lỗi không còn retry trả 409.

Snapshot + pointer/counter/status + audit + idempotency cùng transaction. Submit seal + submitted pointer + RESUBMISSION + outbox cùng commit. Audit chỉ metadata/ID/hash/path thay đổi, không copy nội dung học thuật sang technical log. Query GET không mutate state.

## 5. Schema / migration

Migration mới: `backend/prisma/migrations/202610220002_proposal_version_snapshots/migration.sql`.

SHA256: `69edd06f7a2aa15c5b18c19c741f0b4d52605e80286ef0ec10503d39f8712b39`.

- Thêm nullable `ProposalVersionWorkflow.changeSummary` TEXT và `revisionResponses` JSONB. CHECK JSON null hoặc array. Không thêm model/enum mới, không sửa field/unique/cardinality legacy.
- Thêm trigger bảo vệ UPDATE/DELETE trên payload ProposalVersion khi metadata đã DRAFT/SEALED. Metadata đã có state chỉ được chuyển một lần DRAFT→SEALED với submittedAt/by và revision+1; không sửa contentHash/author/base/summary/responses sau tạo. Không mở lại SEALED. Hàng legacy state NULL vẫn giữ contract chưa đối soát; API mới không UPDATE content legacy.
- Định nghĩa `proposal:edit` và `proposal:submit`. Role có sẵn: STUDENT read/edit/submit, LECTURER read/edit. Đây là action permission; **không tạo advisor assignment hoặc grant**, service vẫn yêu cầu quan hệ chính thức. Không cấp FACULTY/ADMIN edit hoặc submit.
- Giữ Topic.proposals[], Student.proposal, unique Proposal.studentId, mọi FK/index/enum và migration cũ. Không backfill người sửa, phản hồi, approval, receipt hoặc ownership.
- Reply references là JSON của snapshot và được kiểm same-proposal trong transaction. ReviewComment/ProposalReviewDecision nguồn đã append-only, không có API xóa target; không tạo một workflow “resolved” hoặc bảng điểm cá nhân mới.

SQL có BEGIN/COMMIT và lock_timeout 10s. Đã kiểm nâng cấp từ baseline bước 5 có dữ liệu, inject lỗi trước COMMIT để xác minh rollback cột/trigger/permissions, sau đó deploy thành công và deploy lại không áp trùng. Payload/metadata cũ giữ nguyên; field mới của hàng cũ NULL.

Phục hồi: trước triển khai thật cần inspect read-only/checksum/history, backup và review SQL theo quy trình Supabase nhóm. Nếu SQL transaction lỗi, PostgreSQL rollback; đối chiếu trạng thái migration trước thao tác resolve được duyệt. Nếu quay app sau deploy thành công, giữ cột nullable và chứng cứ, không down/drop/reset; bản ghi snapshot không được sửa tại chỗ nữa theo contract đã duyệt, producer phải append. Sửa lỗi bằng forward migration được review, không chỉnh migration đã triển khai hoặc gỡ trigger để ghi đè chứng cứ.

## 6. Frontend và chạy xem thử

Routes mới thay route editor placeholder trong router, giữ module Topic UC11 và các route khác:

- `/topic/proposal`: chọn đợt/hồ sơ trong quyền đọc.
- `/topic/proposal/:proposalId`: editor hiện hành, phản hồi góp ý, lịch sử và so sánh.
- `/topic/proposal/:proposalId/versions/:versionId`: phiên bản lịch sử chỉ đọc, góp ý đúng bản đó và các target phản hồi mà snapshot tham chiếu.

Template dùng layout đã có ở bước 4. Mỗi snapshot hiển thị tác giả/thời gian/state; form giữ revision/base ban đầu khi đang nhập, không tự overwrite khi query refetch. Save thành công lấy proposalRevision từ response; submit bị chặn trên client nếu còn thay đổi chưa lưu. 409 giữ nội dung nhập và có thao tác tải lại chủ động. Nội dung legacy không khớp mẫu được hiển thị bản gốc và chặn tự chuyển đổi. Có loading/empty/error/success, readonly theo quyền/state và kiểm mobile 375px.

**Mở giao diện DEMO để tự thao tác, tại thư mục gốc:**

```powershell
pnpm --filter @doan/frontend preview:proposal-versions
# Hoặc chế độ GVHD: lưu được, không gửi thay SV
pnpm --filter @doan/frontend preview:proposal-versions --advisor
```

Mở Microsoft Edge với API giả lập và nhãn BẢN DEMO. Có sẵn v1 bị yêu cầu sửa; nhập nội dung/phản hồi → lưu v2 → xem lịch sử/so sánh → gửi duyệt lại. Không cần Docker, backend hoặc dữ liệu bước 1–3. Chỉ cửa sổ Edge được lệnh mở có mock API; không tự mở URL trong cửa sổ khác. Đóng Edge hoặc Ctrl+C để dừng. Dữ liệu trong bộ nhớ, mất khi đóng. Preview chỉ mô phỏng bước 6, không giả lập Khoa duyệt lại ở bước 5 hoặc ghi vào Supabase. Các menu ngoài bước 6 có thể hiển thị lỗi API ngoài phạm vi demo; chọn **Đề cương & phiên bản** để quay lại. Các request này không được chuyển tới backend.

## 7. Kết quả kiểm thử thực tế

| Kiểm tra | Kết quả |
|---|---|
| `pnpm verify` | PASS: Prisma validate/generate, PR2B/legacy compatibility, shared/backend/frontend type-check, lint, tests, build |
| Backend unit tests | 68 PASS, gồm 20 mới bước 6 |
| Frontend unit tests | 15 PASS, gồm 4 mới bước 6 |
| Database/target/local-tool guards trong verify | 12 PASS |
| `pnpm --filter @doan/backend test:proposal-versions:api` | 24 checks PostgreSQL17/HTTP PASS; chạy thêm toàn bộ 27 checks bước 5 làm producer prelude |
| `pnpm --filter @doan/backend test:proposal-versions:upgrade` | PASS, 5 nhóm kiểm tra upgrade/rollback/preservation/permissions/history |
| `pnpm --filter @doan/frontend test:proposal-versions:browser` | 15 Edge checks PASS, API giả lập; gồm 5 ca hồi quy lỗi preview bổ sung |
| Hồi quy API bước 4 trên cây active 6 migration | 31 checks PASS |
| Hồi quy upgrade bước 5 đã pin mốc | PASS |
| Hồi quy browser bước 4 / bước 5 | 9 / 10 checks PASS |

API coverage: tạo v2 từ kết luận trả sửa v1; giữ nguyên v1 và reviewer/decision; author/time/summary/response; đúng/ngoài scope, ADMIN và forged claims; PUBLISHED không cấp quyền GVHD; duplicate/cross-proposal response; idempotency/revoke; reviewer không đọc draft hoặc compare trái quyền; data diff; trigger chặn ghi đè; SV-only submit v2/resubmission; vòng mới duyệt v2 giữ vòng cũ; incomplete draft không seal dở; GVHD lưu bản mới; agreement sai; concurrent SV/GVHD save; audit rollback; race khóa phase; handover thu hồi GVHD cũ; APPROVED và dossier FINALIZED chặn sửa độc lập.

Browser coverage: feedback nguồn v1, tạo v2/phản hồi, compare dữ liệu, lịch sử readonly, gửi đúng v2, 409 giữ bản đang nhập, validate gửi lại, GVHD không có nút gửi, mobile và lỗi scope không lộ content. Browser này dùng mock; luồng API/PostgreSQL thật được kiểm riêng, chưa chạy browser với đăng nhập thật/Supabase.

Hồi quy preview: chuyển sang menu nhóm duyệt hoặc phân công/xét duyệt ngoài demo rồi quay lại vẫn hoạt động; GET/POST không hỗ trợ và GET nhầm endpoint submit trả 404; POST thiếu Idempotency-Key/JSON lỗi trả 400, revision cũ trả 409 và không ghi snapshot; compare version không tồn tại trả 404. Các lỗi request không làm dừng tiến trình preview. Browser theo dõi `pageerror` và yêu cầu không có lỗi ứng dụng không được xử lý.

Database test riêng: PostgreSQL17.11 portable, loopback 127.0.0.1:55441, tên btl_pr2b_step6_*, password ngoài source trong TEMP. Không reset/reuse DB có dữ liệu; mỗi runner dùng DB mới. Không dùng db push, migrate reset hoặc migrate dev. CI thêm runner bước 6 nhưng chưa tuyên bố CI remote đã chạy.

Đã dừng cluster test do lượt này khởi động sau khi kiểm thử, giữ nguyên dữ liệu/evidence. Đã chạy `git status --short`, `git diff --stat`, `git diff --check`; không có lỗi whitespace và không có file staged.

Warnings còn có từ nền tảng: Vite CJS deprecated, useLayoutEffect trong React Router SSR test và Node DEP0190 ở verify runner. Không làm check thất bại và không refactor ngoài phạm vi. Các kiểm tra spawn worker/browser chạy với quyền thực thi local phù hợp trên Windows.

Evidence: `backend/prisma/review/step6-results.json`, `step6-upgrade-results.json`, `step6-browser-results.json`.

## 8. File thay đổi trong lượt bước 6

**Mới:**

- `backend/src/topic/proposal-versions/proposal-version.controller.ts`
- `backend/src/topic/proposal-versions/proposal-version.repository.ts`
- `backend/src/topic/proposal-versions/proposal-version.service.ts`
- `backend/src/topic/proposal-versions/proposal-version.validator.ts`
- `backend/src/topic/proposal-versions/proposal-version.spec.ts`
- `shared/src/contracts/proposal-versions.ts`
- `backend/prisma/migrations/202610220002_proposal_version_snapshots/migration.sql`
- `backend/scripts/test-proposal-versions.cjs`
- `backend/scripts/test-proposal-version-upgrade.cjs`
- `frontend/src/features/proposal-versions/api.ts`
- `frontend/src/features/proposal-versions/components.tsx`
- `frontend/src/features/proposal-versions/pages.tsx`
- `frontend/src/features/proposal-versions/components.spec.tsx`
- `frontend/scripts/test-proposal-versions-browser.cjs`
- Ba evidence bước 6 và tài liệu này.

**Tích hợp trực tiếp:**

- `backend/prisma/schema.prisma`: thêm hai metadata field nullable.
- `backend/src/topic/topic.module.ts`: đăng ký providers/controller mới.
- `shared/src/index.ts`: export contract mới.
- `frontend/src/app/router/routes.tsx`: thay đăng ký editor placeholder bằng các route bước 6.
- `frontend/src/features/review-groups/workspace.tsx`: mode/layout, menu và search bước 6; mode cũ đã hồi quy.
- `backend/package.json`, `frontend/package.json`: thêm script test/preview; không thêm dependency.
- `.github/workflows/backend-ci.yml`: runner/evidence bước 6.
- `backend/scripts/test-proposal-reviews.cjs`: đếm cây migration active; fixture malformed tạo draft riêng thay vì unseal v8 cũ, tương thích invariant mới. Giữ 27 ca và không đổi business code bước 5.
- `backend/scripts/test-proposal-review-upgrade.cjs`: pin lịch sử tới mốc bước 5 để regression có đúng baseline.
- JSON bước 4/5 được ghi lại khi chạy regression/prelude (nội dung có thể trùng bản trước).

Git từ đầu lượt đã có thay đổi chưa commit của bước 4/5. Không coi toàn bộ Git status là thay đổi của lượt này. Không sửa lockfile, env, DOCX, ADR, migration cũ, business logic người 1/3 hoặc service/controller bước 5. Không stage, commit, push.

## 9. Dependency và giới hạn chạy môi trường nhóm

- Producer UC11 tạo Proposal/Topic ownership và ProposalWorkflow với counter rõ ràng; không tự khởi tạo/backfill legacy ở bước 6. Giữ hạn chế unique Proposal.studentId của giai đoạn expand; chưa bỏ unique để hỗ trợ nhiều đợt toàn diện.
- Khoa/producer term cần cấu hình và mở PROPOSAL_EDIT khi cho chỉnh sửa, kể cả đợt trả sửa; hệ thống không tự gia hạn/mở lại phase. Các writer phase/roster/assignment/grant cần phối hợp protocol khóa term và tăng revision.
- Auth/bootstrap cấp read/edit/submit theo manifest cho role tạo sau migration; role/action không thay official advisor relation. SV vẫn có thể lưu nháp sở hữu khi thiếu advisor hợp lệ, nhưng không gửi được; GVHD chưa có assignment chính thức không được sửa.
- Topic agreement/routing, official plan và assignment/history phải được bàn giao thật từ bước 1–3. Thiếu dữ liệu sẽ có lỗi readiness; fixture không thay dữ liệu chính thức.
- Outbox `PROPOSAL_VERSION_SUBMITTED` lưu cùng submit; worker gửi thông báo/email cho event mới chưa triển khai, không tuyên bố đã gửi mail.
- Chưa làm withdraw/return-to-draft/reopen/finalize/PDF/signature/receipt hoặc hướng dẫn, task, upload. Không dùng trạng thái APPROVED làm dossier đã chốt/đã nhận giấy.
- Cần nhóm review SQL/backup/inspect và phê duyệt deploy riêng trước áp migration lên Supabase. Không tự bắt đầu bước 7–8.

## 10. Sửa lỗi preview Idempotency-Key

Người dùng báo preview bị thoát do assert thiếu header trong route mock. Nguyên nhân: request không khớp các route đọc (ví dụ API nhóm duyệt khi chuyển menu) rơi xuống nhánh mutation và bị assert dù là GET. Request ghi không hợp lệ cũng có thể làm callback Playwright ném lỗi không được xử lý.

Script demo hiện phân loại cả method và endpoint trước khi đọc body/header. API ngoài demo trả JSON 404; mutation vẫn bắt buộc Idempotency-Key, kiểm revision/base/state/quyền và trả lỗi HTTP thay vì assert. Compare kiểm version tồn tại trước khi đọc content. Không bỏ kiểm tra header trên luồng ghi, không nối tới backend và không sửa API/business logic/schema.

Kiểm tra thực tế ở lượt sửa preview đầu tiên: `node --check` PASS, Prettier check PASS và 14 browser checks Edge PASS (10 ca cũ + 4 nhóm hồi quy mới). Các kết quả backend/DB/verify ở mục 7 là từ lượt triển khai trước; không chạy lại trong lượt chỉ sửa script demo này. File được cập nhật: script browser bước 6, JSON evidence browser bước 6 và báo cáo này. Không thay đổi dependency, migration hoặc database; không stage/commit/push.

### Bổ sung hồi quy chuyển menu phân công/xét duyệt

Người dùng tiếp tục báo `Cannot read properties of undefined (reading 'length')` tại hàng đợi bước 5. API `/terms/t1/proposals` dùng chung với danh sách editor, nhưng fixture bước 6 chỉ trả các field mà editor cần, thiếu `ProposalReviewSummary.readiness` và các metadata khác. JSX của hàng đợi đánh giá `p.readiness.length` trước khi component trạng thái có thể hiển thị lỗi options ngoài demo. Vì vậy việc trả 404 cho API options chưa đủ ngăn lỗi render.

Đã tái hiện bằng ca browser chuyển menu thực: ca mới FAIL trước khi sửa fixture. Sau đó bổ sung đầy đủ field của summary trong mock: revision, submitted version ID/number, routing và active review/group nullable, readiness array, canAssign=false. Không tự cấp quyền Khoa hoặc mô phỏng phân công mới. API options bước 5 vẫn trả thông báo ngoài phạm vi demo; giao diện giữ layout và cho quay lại editor.

Sau sửa: `node --check`, Prettier check và **15 Edge browser checks PASS**. Ca mới kiểm không xuất hiện trang Unexpected Application Error, không có pageerror và trở lại danh sách editor bình thường; 10 luồng bước 6 cũ tiếp tục PASS. Lượt này chỉ sửa script browser, evidence browser bước 6 và báo cáo; không sửa trang bước 5/business code/schema, không chạy database hoặc DDL.
