# BƯỚC 8B — Báo cáo tiến độ tuần và source code

Ngày 22/10/2026, Asia/Ho_Chi_Minh. Đã triển khai backend/frontend, migration additive, kiểm thử API với PostgreSQL/filesystem thật và browser với API mock. **Không kết nối hoặc chạy DDL lên Supabase chung; không stage/commit/push.**

## 1. Căn cứ và quyết định đã xác nhận

Bám baseline PR1 D10/D11, §3.2, §3.6, §4.6–4.7, §5–7; audit/migration plan, ADR đồ án cá nhân, contract hướng dẫn nhóm và báo cáo 8A. Không sửa DOCX hoặc các quyết định ownership/phân công/approval/receipt đã duyệt.

- Mỗi bài thuộc một task của một plan/Proposal/TermStudent, có đợt/đề tài/tuần hoặc mốc/GVHD. Phạm vi cá nhân theo baseline, không thêm ProjectGroup.
- Chỉ SV owner hoạt động, account/permission hợp lệ được upload và xác nhận nộp. Cần phân công GVHD chính thức hiện hành, roster, Topic agreement, bản chốt hợp lệ, plan ACTIVE và phase GUIDANCE mở. Khoa/GVHD không nộp thay SV.
- Nộp muộn được nhận khi phase còn mở. `isLate = submittedAt > deadlineSnapshot`; bằng deadline là đúng hạn. Không lấy lúc bắt đầu upload làm thời điểm nộp, không tự khóa vì quá hạn, không tự hoàn thành task/SV.
- Task TODO/IN_PROGRESS/SUBMITTED/REVISION_REQUESTED được nộp; COMPLETED/CANCELLED không được nộp. Không thêm điều kiện chặn riêng trước startDate ngoài phase đã xác nhận. Task/metadata legacy chưa đủ cần đối soát, không đoán số phiên bản, ownership hoặc ngày nộp.
- Upload, staging, bài nộp chính thức và kết quả đánh giá là các mốc khác nhau. **Chưa triển khai module đánh giá**, không tạo ProgressReview/TaskReview hoặc map isPassed=false.

Người dùng đã chọn **“Đồng ý policy đề xuất”** trong phiên 8B. Cấu hình khởi đầu được ghi tại `submission-policy.ts`, ID `approved-20261022-v1`:

| Cấu hình | Giá trị đã duyệt |
|---|---|
| REPORT bắt buộc | đúng 1 PDF, MIME application/pdf |
| SOURCE bắt buộc | đúng 1 ZIP, MIME application/zip hoặc application/x-zip-compressed; lưu MIME chuẩn application/zip |
| EVIDENCE tùy chọn | tối đa 3 PDF/PNG/JPG/JPEG với MIME tương ứng |
| Dung lượng | 20 MiB/file, 50 MiB tổng/bài; không nhận file rỗng |
| ZIP | không mã hóa, không đường dẫn nguy hiểm/symlink, tối đa 1.000 entries và 200 MiB tổng giải nén |
| File chưa nộp | staging hết hạn sau 24 giờ |
| Bài đã nộp | không tự xóa, không giới hạn số lần nộp nghiệp vụ khi task/phase cho phép |

Quota kỹ thuật mặc định 10 file pending/ready chưa hết hạn/SV, để giới hạn staging bỏ dở; không phải giới hạn số lần nộp bài. Schema policy cho phép override có kiểm tra. Đổi cấu hình chính thức phải được người quản lý duyệt, không tự thay giá trị trong quá trình chạy.

## 2. Storage, validation và vòng đời file

Tái sử dụng **FileStorageService** hiện có, thêm ba phương thức save/read/delete private dành cho guidance; giữ nguyên save/delete legacy cho caller khác. Không thêm object storage, SDK, bucket hoặc dependency.

- Bytes nằm trong `STORAGE_LOCAL_PATH/.private-guidance/<UUID>`; storageKey là `guidance/<UUID>` do server tạo, không là path hoặc URL do client gửi. File không có extension thực thi trên disk và không được chạy/giải nén ra filesystem.
- Path chỉ nhận namespace/UUID, kiểm tra realpath/symlink/junction, file thường; ghi exclusive `wx`, quyền POSIX 0600/root 0700 khi OS hỗ trợ, flush/close handle. Windows vẫn chịu ACL của thư mục chạy backend.
- Backend hiện không mount static uploads; Nginx hiện chỉ proxy, không serve thư mục này. Download chỉ qua JWT + permission + quyền đọc cha, attachment application/octet-stream, nosniff, CSP sandbox và private/no-store. Không thêm public route hoặc Supabase public bucket URL.
- Kiểm scope/phase trước khi Multer cấp buffer và kiểm lại trong transaction trước READY/commit. Mỗi multipart chỉ một `file` và một `kind`, dung lượng parser lấy từ policy. Strict schema chặn field actor/path/owner/status giả. Filename chuẩn Unicode NFC; xử lý UTF-8 filename từ Busboy/Multer, chặn path/control/bidi/reserved Windows/trailing dot; không dùng filename làm path.
- Extension và MIME phải cùng allowlist. PDF kiểm envelope/header/catalog/startxref/EOF và sàng lọc một số active actions. PNG kiểm signature/chunk boundaries/CRC/IEND; JPEG kiểm envelope/marker/frame. ZIP kiểm central/local header, entry/count/size, mã hóa/phương thức, tên trùng/path/symlink/overlap, inflate trong bộ nhớ có maxOutputLength, kích thước thật và CRC từng entry. Không extract hoặc execute source.
- Đây là kiểm tra định dạng/nội dung có giới hạn; **không tuyên bố antivirus/CDR hoặc full PDF interpretation**. PDF không được render inline từ server; file chỉ tải attachment. Chưa có kiểm thử malware scanner hoặc benchmark upload tải lớn.

Vòng đời `GuidanceSubmissionUpload`: PENDING → READY → COMMITTED; PENDING/READY → EXPIRED. COMMITTED là bất biến, không nằm trong sweeper.

1. Sau validation, ghi intent PENDING vào DB **trước** khi ghi bytes; intent chứa actor/task/storageKey/hash/manifest/policy/expiry và khóa idempotency.
2. Ghi private bytes. Transaction mới khóa lại aggregate, kiểm lại actor/plan/phase, tạo FileAsset READY + cập nhật intent READY + audit atomic. File đang upload chưa phải bài nộp.
3. SV gửi uploadIds + task revision. Server khóa/upload ownership, kiểm READY/expiry/policy/checksum/kích thước/manifest thật; xác nhận đủ REPORT/SOURCE và số minh chứng/tổng dung lượng. Kiểm lại TTL/phase sau IO trước khi ghi bài.
4. Tạo TaskSubmission + SubmissionWorkflow + SubmissionAsset, claim intent COMMITTED, supersede bản cũ, cập nhật currentSubmissionId/counter/task SUBMITTED, history/audit/idempotency **cùng transaction**.
5. IO hoặc READY metadata thất bại: không có bài nộp; intent được đánh dấu hết hạn và dọn file. Nếu crash/DB lỗi khiến cleanup chưa xong, intent còn để sweeper thử lại.
6. Sweeper kỹ thuật mỗi 60 giây, batch 100 intent hết hạn, khóa intent và kiểm mọi reference submission/evaluation/dossier/receipt trước khi quarantine/dọn. Tombstone metadata và cleanedAt giữ lại; không xóa bảng/record hoặc bài nộp. Delete thất bại sẽ được thử lại. Không tự dọn file đã COMMITTED dù quá 24 giờ.

Không có API xóa/withdraw bài chính thức. File mỗi lần nộp là references riêng; nộp lại phải staging file mới, không chuyển quyền file cũ sang task/SV khác. Download lịch sử vẫn qua quyền cha hiện hành; GVHD cũ không được giữ quyền chỉ vì là tác giả lịch sử.

## 3. API và frontend

Base `/api`, success/error envelope theo bước 4–8A. POST trả 201, GET trả 200. Actor từ JWT đã xác minh, không nhận actor/term/advisor từ body.

| Endpoint | DTO / hành vi | Permission và scope |
|---|---|---|
| GET `/tasks/:taskId/submission-context` | taskRevision, dueDate, currentSubmissionId, canSubmit, readiness, policy, latePolicy | submission:read + owner/current advisor/FACULTY grant |
| POST `/tasks/:taskId/submission-uploads` | multipart kind REPORT/SOURCE/EVIDENCE + file; Idempotency-Key → id, expiresAt, metadata file; không trả storageKey/path | submission:create + SV owner, phase/plan/bản chốt hợp lệ |
| POST `/tasks/:taskId/submissions` | expectedTaskRevision, uploadIds UUID unique 2..12, content? <=20.000 ký tự; Idempotency-Key → SubmissionView | submission:create + SV owner, CAS, đủ file READY |
| GET `/tasks/:taskId/submissions?page=&limit=` | page mặc định 1/20, max100; current pointer và lịch sử, thứ tự thời gian/ID ổn định | submission:read + scope cha |
| GET `/task-submissions/:id` | SubmissionView, metadata/version/files/contextSnapshot | submission:read + scope cha |
| GET `/task-submissions/:id/files/:fileId/download` | bytes attachment; file phải thuộc đúng submission, task và committed intent | submission:download + scope cha |

SubmissionView gồm versionNumber/state, actor/submittedAt/deadlineSnapshot/isLate/revision, content/files và contextSnapshot. Snapshot ghi term/TermStudent/student/topic/proposal/plan/period, GVHD/assignmentId/revision/finalization tại lúc nộp, file manifest; filePolicySnapshot lưu riêng trong DB. Legacy chưa có metadata trả null, không tự giả version=1/đúng hạn/tác giả hoặc trả raw SubmissionFile.filePath.

| Vai trò | Nộp | Xem/tải |
|---|---|---|
| STUDENT | chỉ owner hợp lệ | chỉ owner |
| LECTURER | không | GVHD chính thức hiện hành, account/roster/assignment hợp lệ |
| FACULTY | không | grant đúng đợt/bộ môn của hồ sơ |
| Review member | không | membership review không cấp quyền báo cáo/source tuần |
| ADMIN-only | không | không bypass, kể cả có action permission do seed cũ |

Lỗi chính: 400 COMMON_003/FILE_TYPE_INVALID/FILE_NAME_INVALID/REQUIRED_FILE_MISSING; 401 AUTH_003; 403 thiếu permission; ngoài scope 404 COMMON_001; 413 FILE_TOO_LARGE; 429 UPLOAD_QUOTA_EXCEEDED; 503 UPLOAD_FAILED. Các precondition trả 409: REVISION_CONFLICT, IDEMPOTENCY_CONFLICT, UPLOAD_IN_PROGRESS/UPLOAD_EXPIRED, FILE_NOT_READY, FILE_POLICY_CHANGED/FILE_POLICY_NOT_CONFIGURED, TERM_003, INPUT_NOT_READY, PLAN_PAUSED/REBASE_REQUIRED, DOSSIER_NOT_FINALIZED, TOPIC_NOT_AGREED, REPORTING_SCOPE_NOT_CONFIGURED, STATE_TRANSITION_INVALID. Không trả SQL/env hoặc path private trong lỗi.

Frontend route mới: `/guidance/tasks/:id/submissions`, có link từ chi tiết nhiệm vụ. Hiển thị SV/đề tài/mốc/hạn, policy được duyệt, file picker từng loại, tiến trình upload thực từ Axios, trạng thái file tải lên nhưng chưa nộp, ghi chú, nút xác nhận nộp, lịch sử phân trang, bản hiện hành/bản cũ, đúng/trễ và tải private.

Client kiểm extension/count/size/filename trước upload; server vẫn kiểm nội dung thật. Lỗi upload giữ file đã staging và nội dung; retry file lỗi không tải lại file thành công. Revision được giữ khi đang chuẩn bị; 409 giữ dữ liệu, cần tải trạng thái mới chủ động trước retry. Nộp thành công reset picker để có thể chọn lại cùng tên file. Có loading/empty/error/success và responsive 375px. Khoa/GVHD xem read-only; không có chấm điểm, đánh giá hoặc tự hoàn thành.

## 4. Transaction và bất biến

Reuse quyền cha của GuidanceService thay vì thêm đường bỏ qua phân công. Mutation SERIALIZABLE, read REPEATABLE READ; retry conflict bounded theo repository hiện có. Khóa theo thứ tự term → proposal/phase/assignment → plan → obligation → task → upload IDs đã sort. Recheck principal và quan hệ sau lock; kiểm phase/plan trước và sau work/IO.

Submission idempotency actor+method+route+key, hash toàn request có uploadIds gắn manifest immutable; upload idempotency actor+task+key, hash manifest/checksum+policy. Cùng key khác payload bị 409. Replay đã commit vẫn kiểm quyền cha hiện hành; không tạo version/history lần nữa.

Counter cấp version từ TaskWorkflow.nextSubmissionNumber dưới khóa/CAS và unique(taskId,versionNumber) hiện có. Hai lần nộp cùng revision chỉ một commit. Bản cũ giữ content/bytes/review/link, chỉ SubmissionWorkflow.state chuyển SUPERSEDED và revision tăng; không đổi isLate/deadlineSnapshot của bản cũ khi sửa task.

SQL guards mới bảo vệ snapshot TaskSubmission/SubmissionWorkflow chính thức, FileAsset metadata và committed intent, chống sửa/xóa links và gắn file không thuộc READY staging trong manifest. History append-only PR2B và composite current pointer/scope tiếp tục dùng. Audit kỹ thuật chỉ ID/hash/number/action, không copy content/source vào log vận hành. Lỗi audit rollback cả metadata/pointers/history/file claims; file staging vẫn recoverable.

## 5. Schema, migration và phục hồi

Migration mới: `backend/prisma/migrations/202610220005_guidance_submissions/migration.sql`.

SHA256: `C13CD1CA97E453CF765E9D861B1E08EAD088DD5456DBB5A91F42A88743E1D3AE`.

- SubmissionWorkflow thêm nullable contextSnapshot/filePolicySnapshot JSONB. Không backfill.
- Model GuidanceSubmissionUpload mới: id/taskId/actorId/requestKey/payloadHash/storageKey/state/manifest/policySnapshot/assetId/submissionId/createdAt/expiresAt/cleanedAt. FileAsset có relation tùy chọn guidanceUpload. FK task/actor/submission và CHECK state/pointers là SQL-only cùng với triggers; không sửa field/unique legacy để diễn đạt lại quan hệ.
- Unique storageKey, assetId, actor+task+requestKey; index state+expiresAt và actor+state. Không thêm enum vào các enum cũ.
- Dùng lại TaskSubmission, SubmissionWorkflow, SubmissionAsset, FileAsset, TaskWorkflow/counter/current pointer, TaskHistory, AuditLog, IdempotencyRecord. Không mirror private path vào SubmissionFile legacy và không sửa API cũ thành shape mới.
- Thêm submission:read/create/download và grants theo matrix, không cấp ADMIN hoặc tạo actor/roster/assignment giả.
- BEGIN/COMMIT + lock_timeout 10s; không sửa 0_init/migration cũ, không drop/reset/db push.

Đã replay đủ chín migration từ DB rỗng; nâng cấp từ tám migration có task/submission/false review legacy; inject division-by-zero trước COMMIT chứng minh schema/grants rollback; kiểm chín checksum và deploy lại không áp trùng. Legacy payload/boolean/null metadata giữ nguyên.

Chưa deploy Supabase. Deploy sau này là thao tác riêng: inspect history/checksum/data mới nhất, backup, review SQL/target và quyền Data API trên bảng ứng dụng mới trước phê duyệt. Dùng quy trình deploy có guard đã có, không migrate dev/db push/reset trên DB nhóm. Nếu DDL lỗi thì kiểm rollback/history trước resolve; nếu tắt ứng dụng thì giữ additive table/cột/history/file đã nộp. Khôi phục bằng forward migration được review, không down/drop hoặc xóa bài để rollback.

## 6. Cấu hình vận hành và dependency nhóm

`GUIDANCE_UPLOAD_ENABLED=true|false` mặc định true theo policy đã được người dùng duyệt. `GUIDANCE_UPLOAD_POLICY_JSON` tùy chọn override strict `SubmissionUploadPolicySchema`; sai format/limit làm backend từ chối khởi động, thông báo chỉ tên key. Env example không chứa credential. Cấu hình được validate lúc khởi động; sửa env thì restart backend, không coi thay file env là đã đổi policy trong process đang chạy. Policy đã đổi thì file staging cũ phải tải lại; bài đã nộp giữ snapshot cũ.

Storage dùng `STORAGE_LOCAL_PATH` đã có; Docker hiện có volume uploads_data. Khi chạy nhiều backend instance phải dùng cùng filesystem bền vững được kiểm soát; chưa triển khai object storage/distributed file adapter. Backup phải gồm DB **và private upload volume**, không chỉ Supabase DB. Không mount toàn bộ uploads làm public static hoặc cấu hình Nginx/Data API bỏ qua JWT/scope. Quyền OS/người vận hành volume tách khỏi quyền đọc học thuật trong app.

Người 1 vẫn phải cung cấp phase/tuần/SV áp dụng/obligation config, roster/officialPlan/assignment/agreement và finalization hợp lệ. Khóa phase/handover dùng cùng term lock; sau handover/reopen giữ plan PAUSED cho tới rebase/ack theo 8A. Upload không tự tạo các đầu vào này. Task tuần materialize bằng command 8A; coverage đọc current submission thật, không mất tuần thiếu do chưa có task.

Người 3 và phần đánh giá sau này dùng SubmissionWorkflow/version/currentSubmissionId + SubmissionAsset và secure endpoint, không suy từ Task.status legacy/TaskReview.isPassed hoặc lấy filePath public. Tra cứu repository chưa có consumer SubmissionFile/TaskSubmission khác ngoài guidance bị thay contract trong lượt này. Bước đánh giá phải dùng bài hiện hành/revision và giữ ba kết quả PASS/FAIL/REVISION_REQUIRED; 8B chỉ tạo SUBMITTED và giữ effective review cũ, không quyết định kết quả.

## 7. Validation thực tế

| Kiểm tra | Kết quả |
|---|---|
| `pnpm verify` | PASS: Prisma validate/generate, frozen legacy/PR2B compatibility, typecheck/lint/unit/build toàn workspace |
| Backend unit | **96 PASS**, gồm 11 test mới 8B |
| Frontend unit | **24 PASS**, gồm 2 test mới 8B |
| Database target/tool guards trong verify | **12 PASS** |
| `test:guidance-submissions:api` | **17 nhóm PASS**, PostgreSQL 17 + private filesystem + Nest HTTP thật; producer prelude 8A/7/5 lần lượt 19/19/27 checks |
| `test:guidance-submissions:upgrade` | **4 nhóm PASS**: rollback DDL, legacy preservation, grants, checksums/repeat deploy |
| `test:guidance-submissions:browser` | **10 checks PASS**, Edge với API mock |
| Hồi quy `test:guidance-tasks:browser` | **11 checks PASS**, Edge mock |

Sau guard TTL cuối đã chạy lại backend lint/typecheck/96 unit/build và API. Browser 8B dùng mock; chưa tuyên bố đã chạy browser + backend/login thật, malware scanning, tải lớn hoặc remote CI. CI đã bổ sung job API/upgrade nhưng chưa chạy từ môi trường GitHub trong lượt này. Warnings Vite CJS/React Router SSR/Node DEP0190 hiện hữu không làm check thất bại.

API kiểm: unauthorized/non-owner/cross-term/department/reviewer/ADMIN/old advisor, spoofed MIME/extension/nội dung, unsafe ZIP/filename, multipart quá dung lượng, tiếng Việt filename, staging idempotency/no public path, owner commit/snapshot, scoped download/ID tamper, concurrent resubmission/CAS, immutable v1, late allowed, audit rollback, phase khóa/race thực bằng transaction chờ lock, IO failure, READY metadata failure sau ghi bytes/cleanup orphan, expired/reference-safe cleanup, weekly coverage và invalid dossier/disabled policy. Unit kiểm deadline equality và +1ms riêng; không tuyên bố HTTP có thể ghim đúng 1ms bằng đồng hồ client.

Evidence: `backend/prisma/review/step8b-results.json`, `step8b-upgrade-results.json`, `step8b-browser-results.json`. Dữ liệu test synthetic chỉ trong database mới `btl_pr2b_step8b_*`, PostgreSQL portable 17.11 loopback 127.0.0.1:55441, credentials ngoài source. Không reset/drop DB. Cluster được dừng sau kiểm thử, giữ dữ liệu và private fixture ngoài repository.

## 8. File thay đổi trong lượt 8B

**Mới:**

- `shared/src/contracts/task-submissions.ts`.
- `backend/src/guidance/submissions/submission-policy.ts`, `submission.validator.ts`, `submission.repository.ts`, `submission.service.ts`, `submission.controller.ts`, `submission.spec.ts`.
- `backend/prisma/migrations/202610220005_guidance_submissions/migration.sql`.
- `backend/scripts/test-guidance-submissions.cjs`, `test-guidance-submission-upgrade.cjs`.
- `frontend/src/features/task-submissions/api.ts`, `pages.tsx`, `pages.spec.tsx`.
- `frontend/scripts/test-guidance-submissions-browser.cjs`.
- Ba JSON evidence 8B và báo cáo này.

**Tích hợp trực tiếp:**

- `backend/prisma/schema.prisma`: model staging, hai field snapshot nullable và relation FileAsset.
- `backend/src/common/storage/file-storage.service.ts`: private methods additive, giữ legacy methods.
- `backend/src/config/environment.ts`, `backend/.env.example`: validated policy/enable flag, không sửa backend/.env thật.
- `backend/src/guidance/tasks/guidance.service.ts`: tái sử dụng scope cha qua submissionAccess; tách action create SV khỏi GVHD.
- `backend/src/guidance/guidance.module.ts`: đăng ký controller/providers mới.
- `shared/src/index.ts`, backend/frontend package.json, backend-ci.yml: export/scripts/job/artifacts; không thêm dependency/đổi lockfile trong lượt 8B.
- `frontend/src/app/router/routes.tsx`, `frontend/src/features/guidance-tasks/pages.tsx`: route và link báo cáo.
- `backend/scripts/test-guidance-tasks.cjs`: chỉ sửa log “eight-migration chain” thành “active migration chain”; không sửa assertions/nghiệp vụ 8A.
- `docs/implementation/03-team-development-guide.md`: cập nhật bàn giao và lệnh demo.

Producer prelude ghi lại JSON/PDF evidence bước 5/7/8A; browser hồi quy ghi lại JSON 8A. Những modified/untracked khác trong Git đã có trước lượt này được giữ. `git diff --stat` toàn working tree gồm các bước trước và không liệt kê file untracked; không gán toàn bộ diff là thay đổi của 8B. Không sửa code nghiệp vụ bước 1–3/9–10, auth JWT, DOCX, ADR hoặc migration cũ.

## 9. Xem giao diện

```powershell
# SV: chọn file, tải lên, xác nhận nộp và nộp lại
pnpm --filter @doan/frontend preview:guidance-submissions
# GVHD/Khoa: xem lịch sử và tải file mẫu
pnpm --filter @doan/frontend preview:guidance-submissions --advisor
pnpm --filter @doan/frontend preview:guidance-submissions --faculty
```

Edge mở tại port 50178, chỉ API mock và dữ liệu bộ nhớ, không cần Docker/backend/DB. Chỉ cửa sổ do lệnh mở có mock. Demo không thay kiểm tra nội dung file server thật; các menu ngoài bước 8B chưa giả lập đầy đủ. Đóng Edge/Ctrl+C để dừng. Chạy thật vào **Chi tiết nhiệm vụ → Báo cáo tuần và source**, sau khi deployment/input producer đã được phê duyệt và cấu hình.
