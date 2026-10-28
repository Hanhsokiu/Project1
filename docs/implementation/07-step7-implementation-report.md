# BƯỚC 7 — Chốt đề cương chính thức, PDF và tiếp nhận giấy

Ngày 22/10/2026, Asia/Ho_Chi_Minh. Triển khai riêng bước 7, tích hợp bước 5–6. Không triển khai bước 8 hoặc sửa nghiệp vụ bước 1–3/9–10. Không kết nối/chạy DDL lên Supabase chung; không stage/commit/push.

## 1. Căn cứ và quyết định đã xác nhận

- Đã đối chiếu audit 00, baseline PR1 01 (§4.4, §5–§7), kế hoạch migration 02, hướng dẫn nhóm 03, test plan 04, ADR và code bước 5–6.
- Đọc OOXML `docs/spec/Project_1_06.docx` và xem trực quan **ảnh mẫu đề cương nhúng `word/media/image3.png`**, quanh mục “c. Đề cương đồ án tốt nghiệp”. Tham chiếu trang 12 do người dùng chỉ định; cached page breaks trong DOCX không phải bản render Word đáng tin cậy để khẳng định số trang. Không thay đổi DOCX.
- Mẫu có tên/mã SV, lớp/ngành, GVHD, tên đề tài, bốn phần nội dung và bảng kế hoạch; vị trí ký theo thứ tự Trưởng Khoa, Trưởng Bộ môn, GVHD, SV. Bốn vị trí ký để trống; ngày ký để người ký điền. Không ký điện tử hoặc tự xác nhận đã ký.
- DOCX lưu page size kiểu Letter; **yêu cầu người dùng ở bước 7 chọn A4**, nên renderer xuất A4, không sao chép page size lưu trong DOCX.
- Tiếp nhận giấy đã được baseline D08/B08/C06 xác nhận: FINALIZED và RECEIVED là hai mốc riêng, scan không bắt buộc, xuất PDF không chứng minh đã nộp giấy.
- **Quyết định bổ sung của người dùng trong lượt này:** chờ người phụ trách bước 1–3 cung cấp lớp/ngành; thiếu thì chặn chốt. Không có form cho Khoa/SV tự nhập thay hoặc suy ngành từ hướng đề tài/bộ môn.
- Mẫu triển khai có version `project1-docx-individual-v1`. Dùng Noto Serif nhúng có OFL để hỗ trợ tiếng Việt trên Windows/Linux. Đây là bản theo mẫu nguồn để nhóm kiểm tra bản in; không tuyên bố đã có nghiệm thu hành chính của Khoa ngoài chỉ dẫn triển khai hiện tại.

## 2. Luồng và bất biến

1. Proposal phải APPROVED, submittedVersion phải SEALED đúng ownership/term, hash và metadata nộp hợp lệ; official advisor FINALIZED/roster/agreement/routing theo baseline. Working version phải đúng submitted version; không chốt bản cũ khi bản làm việc đã đổi.
2. Vòng hiệu lực mới nhất phải DECIDED và có một ProposalReviewDecision APPROVED gắn đúng version; không còn vòng active hoặc review legacy chưa đối soát. Term/routing/revision phải khớp snapshot vòng duyệt; mapping đổi sau APPROVED thì chặn chốt với ROUTING_MISMATCH. Nội dung phải đủ theo SubmittedProposalContentSchema, gồm kế hoạch thực hiện.
3. Khoa có action permission và grant đúng đợt/bộ môn. Phase PROPOSAL_REVIEW mở, term CLOSED_REGISTRATION/IN_PROGRESS. Service kiểm lại phase trước kết thúc command dưới khóa transaction.
4. Chốt tạo DossierFinalization bất biến với `versionId` (**DTO gọi `approvedVersionId`**), `approvalDecisionId`, `finalizedAt/by`, templateVersion và printSnapshot. Không thêm cột approvedVersionId thứ hai. Proposal vẫn APPROVED; DossierWorkflow chuyển FINALIZED và trỏ currentFinalizationId; tăng revision dossier/proposal.
5. Snapshot in gồm nội dung đúng bản duyệt, title, tên/mã SV/lớp/ngành/hệ đào tạo, GVHD/bộ môn và revision của profile/topic/assignment. `contentHash` của finalization là hash canonical **toàn snapshot in**, khác `ProposalVersionWorkflow.contentHash` chỉ hash content. Không đổi định nghĩa hash ở bước 5–6.
6. Tạo PDF là command riêng, không nằm trong finalize và không đổi trạng thái dossier. PDF generation cập nhật metadata/revision và ghi history/audit, giữ state FINALIZED hoặc RECEIVED. GET chỉ tải file đã có, không tạo file/ghi nghiệp vụ.
7. Khoa nhận giấy thực tế thì command receipt tạo DossierReceipt với actor/thời gian server, chuyển FINALIZED→RECEIVED. Không yêu cầu phải có sự kiện tải PDF trước đó. Note tùy chọn; không nhận thời gian/tác giả/chữ ký do client gửi. Chưa làm upload scan khi chưa có policy/staging contract.
8. Không expose reopen/unlock endpoint hoặc nút mở khóa. Baseline có quy tắc cần pause/rebase guidance; phần phối hợp đó chưa thuộc bước 7 hiện tại. APPROVED/FINALIZED/RECEIVED vẫn chặn SV/GVHD lưu qua guard bước 6 và trigger snapshot.

Mutation SERIALIZABLE với CAS và bounded retry; lock term → proposal → phase → assignment như bước 5–6, thêm shared locks trên dữ liệu SV/GVHD/profile khi chốt. Snapshot/pointer/revisions/history/AuditLog/idempotency cùng transaction. Audit/history chỉ metadata ID/hash/action, không copy nội dung học thuật vào technical log. Replay kiểm lại tài khoản và quyền trước khi trả cached response.

## 3. API và phân quyền

Base `/api`, envelope JSON và lỗi theo các bước trước; PDF trả binary. POST bắt buộc Idempotency-Key.

| Endpoint | Request | Response / quyền |
|---|---|---|
| GET `/proposals/:proposalId/dossier` | — | DossierView: revision/state, currentFinalization, receipt, history metadata, readiness/actions; F trong grant, owner SV, GVHD chính thức |
| POST `/proposals/:proposalId/finalize` | expectedProposalRevision, expectedDossierRevision (0 nếu chưa dossier), approvedVersionId, templateVersion mặc định version duy nhất được hỗ trợ | 201 DossierView; proposal:finalize + FACULTY + grant + phase + approval/version/input |
| POST `/proposals/:proposalId/dossier/pdf` | expectedRevision, finalizationId | 200 DossierView; proposal:export + F/owner/GVHD; không cần phase mở để xuất bản chốt lịch sử hiện hành |
| GET `/proposals/:proposalId/dossier.pdf` | finalizationId tùy chọn, mặc định current | application/pdf, attachment, private/no-store/nosniff; kiểm scope lại và checksum/size/kind/state trước trả |
| POST `/proposals/:proposalId/dossier/receipt` | expectedRevision, finalizationId, note? | 201 DossierView; dossier:receive + FACULTY + grant + phase |

| Chủ thể | Đọc dossier | Tạo/tải PDF | Chốt | Ghi nhận nhận giấy |
|---|---|---|---|---|
| FACULTY | grant đúng đợt/bộ môn | cùng scope + export | cùng scope + finalize và preconditions | cùng scope + dossier:receive |
| STUDENT | đúng TermStudent owner | đúng owner + export | không | không |
| GVHD | phân công chính thức hiện hành | cùng quan hệ + export | không | không |
| Reviewer chỉ thuộc nhóm | không tự có quyền dossier/PDF từ membership | không | không | không |
| ADMIN-only | không tự có quyền học thuật | không | không | không |

Không nhận storageKey/path hoặc assetId để tải. Thay proposalId không vượt owner/term/grant; finalizationId ngoài current bị STALE_FINALIZATION. File bản chốt cũ vẫn được giữ nhưng chưa có chức năng tải bản superseded. Bản legacy thiếu snapshot không được tự tạo PDF.

Lỗi quan trọng: 401 AUTH_003, 403 permission/account, 404 COMMON_001 ngoài scope; 409 REVISION_CONFLICT, IDEMPOTENCY_CONFLICT, STALE_VERSION, STALE_FINALIZATION, STATE_TRANSITION_INVALID, APPROVAL_NOT_READY, STUDENT_PROFILE_NOT_READY, INPUT_NOT_READY, DOSSIER_LOCKED, DOSSIER_NOT_FINALIZED, PDF_NOT_GENERATED, FILE_NOT_READY, TERM_003; 400 input Zod. Swagger mô tả route/header/body và MIME PDF.

## 4. Schema, migration, storage và phục hồi

Migration mới: `backend/prisma/migrations/202610220003_dossier_finalization/migration.sql`.

SHA256: `c6d8b146d02dc25374bb06e38bdf73f4213e6e66cca4b5d812aee493ef4e26a3`.

- DossierFinalization thêm nullable `printSnapshot` JSONB và `approvalDecisionId` VARCHAR(36), FK sang decision. Không backfill snapshot hoặc approval cho legacy.
- DossierStudentProfile mới: `termStudentId` PK/FK, className, majorName bắt buộc không rỗng, revision>=0. Đây là **đầu vào producer**, bước 7 chỉ đọc. Không có endpoint ghi/profile seed chính thức trong feature này.
- DossierPdfContent mới: assetId PK/FK FileAsset, bytes BYTEA không rỗng. PDF được lưu private trong PostgreSQL cùng FileAsset metadata để atomic và không cần public bucket/filesystem path; storageKey là logical DB key, không trả client. FileAsset có kind DOSSIER_PDF, READY, MIME, byte length, SHA256, actor/time.
- Trigger bảo vệ snapshot finalization đã có chứng cứ, chỉ cho thêm PDF pointer lần đầu và giữ extension point supersede/history tương lai; receipt và PDF bytes append-only. Trigger bước 6 tiếp tục bảo vệ ProposalVersion. Không đổi enum legacy, cardinality, unique Proposal.studentId hoặc timestamp/onDelete ngoài phạm vi.
- Thêm permission proposal:finalize, proposal:export, dossier:receive; gán role hiện có theo matrix, không gán ADMIN. Role tạo sau migration cần auth/bootstrap cấp đúng action, không tự tạo user/grant/assignment.
- New private tables revoke Data API roles/PUBLIC như nền tảng. Khi deploy phải cấp quyền đúng backend database role được nhóm chọn; không tự đoán role vận hành.

Migration dùng BEGIN/COMMIT, lock_timeout 10s. Đã replay cây 7 migration trên DB mới và diễn tập nâng cấp từ cây 6 migration có dữ liệu: injected failure trước COMMIT rollback field/table/trigger/permission; deploy lại không áp trùng, dữ liệu cũ giữ nguyên. Không sửa migration 0_init hoặc migration trước.

Trước Supabase deploy vẫn cần inspect chỉ đọc/history/checksum, backup, review SQL và phê duyệt target riêng. Nếu transaction SQL lỗi, kiểm migration state và rollback thực trước resolve; nếu app rollback sau deploy thì giữ additive columns/tables/receipt/evidence, không drop/down/reset hoặc gỡ trigger để sửa chứng cứ. Sửa schema bằng forward migration được review; phục hồi dữ liệu từ backup theo runbook riêng. Bytea PDF có thể tăng dung lượng DB; chuyển sang object storage cần adapter private và quy trình consistency riêng, không đổi sang URL công khai.

## 5. Dependency bàn giao cho người 1 và người 3

**Người 1 / bước 1–3:** cung cấp `DossierStudentProfile` cho TermStudent đã xác nhận, với lớp/ngành thực và revision; dùng chung term lock, tăng revision/audit khi sửa. Không lấy lớp từ studentCode hoặc ngành từ ResearchArea/Department. Contract bảng được chuẩn bị additive để producer tích hợp, chưa sửa API/import của người 1. Nếu muốn dùng bảng nguồn khác, phối hợp adapter rõ ràng trước đổi consumer; không tự map/backfill dữ liệu thật. Ownership, official assignment, Topic agreement, review/edit phases và scoped academic grants vẫn là đầu vào bắt buộc.

**Người 3 / bước 9–10:** đọc current DossierWorkflow + DossierFinalization/version/hash và receipt riêng. Không suy trạng thái chốt từ legacy ThesisDossier.status, Proposal.APPROVED hoặc sự tồn tại filePath. Giữ API/module hiện hữu của defense/grading/report; không đồng bộ điểm/eligibility ở feature này.

**Người 2 / bước 8:** plan có thể bắt đầu khi FINALIZED, không cần chờ RECEIVED. Reopen/handover phải pause/rebase plan cùng transaction trước khi mở chức năng; feature này chưa cung cấp endpoint đó.

## 6. Giao diện và lệnh chạy

- `/topic/dossier`: danh sách hồ sơ trong scope, chọn đợt, phân trang và lọc APPROVED. APPROVED chỉ là ứng viên; trang chi tiết kiểm đủ dữ liệu/phase/decision/version trước cho chốt, không gọi mọi APPROVED là đã đủ điều kiện.
- `/topic/dossier/:proposalId`: xem trước snapshot, bốn mốc trạng thái riêng, Khoa chốt/tiếp nhận, SV/GVHD tải PDF, lịch sử metadata. Form lỗi/409 giữ note; có nút tải lại chủ động. Không có nút mở khóa.
- Layout/menu dùng design system đã có, responsive 375px. Không thêm Supabase SDK hoặc public link; axios mang Bearer khi tải blob.

```powershell
# DEMO Khoa, dữ liệu tổng hợp trong bộ nhớ, không backend/Docker/database
pnpm --filter @doan/frontend preview:proposal-dossiers
# DEMO SV: hồ sơ đã chốt, chỉ tải PDF
pnpm --filter @doan/frontend preview:proposal-dossiers --student
```

Demo mở Edge riêng ở port 50176. PDF demo dùng sample từ integration artifact, không phải tài liệu thật của SV; ID footer là fixture trong artifact. Các menu ngoài bước 7 chưa được giả lập đầy đủ. Đóng Edge hoặc Ctrl+C để dừng. Chạy thật cần backend, migration được duyệt và dữ liệu producer; demo không thay các điều kiện đó.

## 7. Kết quả kiểm thử thực tế

| Kiểm tra | Kết quả |
|---|---|
| `pnpm verify` | PASS: Prisma validate/generate, frozen legacy/PR2B fields/enum, type-check, lint, unit và build toàn repository |
| Backend unit | 75 PASS, gồm 7 mới bước 7 |
| Frontend unit | 18 PASS, gồm 3 mới bước 7 |
| Tool/database target guards trong verify | 12 PASS |
| `pnpm --filter @doan/backend test:proposal-dossiers:api` | 19 nhóm checks PostgreSQL17/HTTP/PDF PASS; thêm prelude toàn bộ 27 checks API bước 5 trên cây 7 migration |
| `pnpm --filter @doan/backend test:proposal-dossiers:upgrade` | 4 nhóm checks PASS: rollback, preservation, grants, checksum/idempotent deploy |
| `pnpm --filter @doan/frontend test:proposal-dossiers:browser` | 8 Edge checks PASS; API mock, tải file PDF thật của fixture |
| Hồi quy browser bước 4 / 5 / 6 | 9 / 10 / 15 PASS |
| PDF text extraction và layout | PASS: tiếng Việt/trường bắt buộc, A4 và bounds từng text item; sample ngắn 1 trang, stress test 16 trang; header bảng lặp, dòng/cell dài tiếp trang, đủ dòng cuối/vị trí ký, footer không tạo trang trắng |

API coverage gồm thiếu lớp/ngành, unapproved, approved nhưng thiếu nội dung/kế hoạch, working version stale, exact decision/version linkage, routing thay đổi sau vòng duyệt, role/grant/cross-term/IDOR, audit failure rollback, concurrent finalize, idempotency/payload conflict, immutable snapshot, generate/download tách receipt, scoped advisor, cache headers/hash/size, thay dữ liệu danh mục không đổi PDF, phase khóa chặn nhận giấy, immutable/idempotent receipt và thu hồi grant chặn replay. DB test riêng loopback 127.0.0.1:55441, database mới btl_pr2b_step7_*, password ngoài source trong TEMP. Không reset/reuse database đã có dữ liệu. Đã dừng cluster test riêng sau khi kiểm thử và giữ các database/evidence.

Đã xem ảnh render PDF mẫu sau khi đọc lại bằng PDF.js. Mẫu được sinh từ font nhúng local, không gọi dịch vụ PDF bên ngoài. PDFKit sử dụng font embedding/wrapping theo [tài liệu chính thức](https://pdfkit.org/docs/text.html); kiểm PDF bằng PDF.js dev dependency, không dùng parser PDF trên endpoint nhận file từ người dùng.

Trong quá trình kiểm thử đã sửa hai fixture sai (workingVersion đầu vào và ID proposal legacy), thêm ca stale riêng; không sửa dữ liệu thật để làm test pass. Kiểm tra trực quan phát hiện footer làm sinh trang trắng; đã sửa margin footer và bổ sung assertion số trang render/parse phải khớp, chạy lại API/PDF thành công. CI thêm job step 7 nhưng chưa tuyên bố remote CI đã chạy. Warnings nền tảng Vite CJS, React Router SSR useLayoutEffect và Node DEP0190 vẫn có; không làm test fail.

Evidence: `backend/prisma/review/step7-results.json`, `step7-upgrade-results.json`, `step7-browser-results.json`, `step7-sample.pdf`, `step7-long-sample.pdf`.

## 8. File thay đổi trong lượt bước 7

**Mới:**

- `backend/src/topic/proposal-dossiers/dossier.controller.ts`
- `backend/src/topic/proposal-dossiers/dossier.repository.ts`
- `backend/src/topic/proposal-dossiers/dossier.service.ts`
- `backend/src/topic/proposal-dossiers/dossier.validator.ts`
- `backend/src/topic/proposal-dossiers/dossier-pdf.service.ts`
- `backend/src/topic/proposal-dossiers/dossier.spec.ts`
- `backend/prisma/migrations/202610220003_dossier_finalization/migration.sql`
- `backend/scripts/test-proposal-dossiers.cjs`, `test-proposal-dossier-upgrade.cjs`
- `backend/assets/fonts/NotoSerif-Regular.ttf`, `NotoSerif-Bold.ttf`, `OFL.txt`, `README.md`
- `shared/src/contracts/proposal-dossiers.ts`
- `frontend/src/features/proposal-dossiers/api.ts`, `components.tsx`, `pages.tsx`, `components.spec.tsx`
- `frontend/scripts/test-proposal-dossiers-browser.cjs`
- Năm evidence/sample bước 7 ở mục 7 và chính báo cáo này.

**Tích hợp trực tiếp:** `backend/prisma/schema.prisma`, `backend/src/topic/topic.module.ts`, `backend/package.json`, `frontend/package.json`, `pnpm-lock.yaml`, `shared/src/index.ts`, `frontend/src/app/router/routes.tsx`, `frontend/src/features/review-groups/workspace.tsx`, `.github/workflows/backend-ci.yml`, `docs/implementation/03-team-development-guide.md`.

Dependency thêm riêng backend: pdfkit 0.17.2; dev-only @types/pdfkit 0.17.3 và pdfjs-dist 4.10.38. Không nâng dependency hiện hữu hàng loạt hoặc thay Node/pnpm. Các JSON bước 4–6 có thể được ghi lại khi chạy prelude/browser hồi quy; không sửa source service/validator hoặc migration các bước đó. Các file modified/untracked khác đã có từ đầu lượt không bị ghi đè. Không sửa env/secrets, DOCX, module nghiệp vụ người 1/3. Git status/diff cuối lượt bao gồm cả công việc chưa commit từ trước, không đồng nghĩa toàn bộ là thay đổi bước 7.
