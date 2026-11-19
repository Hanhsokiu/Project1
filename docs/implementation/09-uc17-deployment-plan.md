# Kế hoạch đưa UC17 vào Backend Render và Supabase chung

Ngày đối chiếu: **07/11/2026, Asia/Bangkok**. Tài liệu là gói review và thao tác tương lai cho người được nhóm ủy quyền; **không phải xác nhận đã deploy**. Không chạy các bước ghi trong lượt này.

Repository duy nhất: `Project1`, nhánh `feature/b9-b10-implementation`, base `0093f81a6017a8e046a03a8ce9786189cd5b37d8`. Giữ toàn bộ thay đổi chưa commit. Nhóm đã xác nhận backend ở Render, PostgreSQL ở Supabase và B1–B8 trên GitHub main; trước khi tích hợp cần review chênh lệch main hiện tại với base fix/integration-ui. Không tự merge/rebase/commit/push trong lượt này.

## Hiện trạng đã xác minh và giới hạn bằng chứng

Bằng chứng READ ONLY mới: [09-uc17-readiness.json](09-uc17-readiness.json), tạo bởi `backend/scripts/inspect-final-defense.cjs --readiness` sử dụng **DATABASE_URL của ứng dụng**, TLS, transaction READ ONLY và timeout. Không tạo AppModule/session/account/proposal, không xuất tên sinh viên/GV, điểm, contacts, URL hoặc credentials. Báo cáo cũ [09-uc17-supabase-schema.json](09-uc17-supabase-schema.json) giữ làm snapshot lịch sử.

| Nội dung                           | Kết quả kiểm tra                                                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Đợt đồ án                          | Đọc được 7 đợt bằng Prisma mapping hiện có                                                                                                                                                  |
| FINAL                              | Có ở cả 7 đợt; thời gian bắt đầu đều sau ngày kiểm tra, vì vậy chưa thể ghi UC17 theo cửa sổ thật                                                                                           |
| Phân công chính thức               | 4 đợt có pointer official plan, đúng term, FINALIZED và metadata chốt; 29 assignment tổng cộng trên hệ thống, không đồng nhất tất cả với assignment đang hiệu lực                           |
| Student–TermStudent–Topic–Proposal | 26 proposal, 82 TermStudent; kiểm tra join cho 26 proposal không phát hiện sai term/student/topic hoặc thiếu owner workflow                                                                 |
| UC17_POLICY                        | Chưa có ở cả 7 đợt; không có policy APPROVED để sử dụng                                                                                                                                     |
| Permission UC17                    | Thiếu cả 10 permission, nên chưa có ROLE_PERMISSION tương ứng                                                                                                                               |
| Schema UC17                        | Thiếu FINAL_REPORT_VERSION và 8 cột bổ sung ở 3 bảng cũ (13 tên cột còn thiếu khi tính 5 cột của bảng mới)                                                                                  |
| Dữ liệu UC17 hiện hữu              | FINAL_REPORT = 0, DEFENSE_CONFIRMATION = 0, SCORE_ENTRY role ADVISOR = 0 tại thời điểm SELECT                                                                                               |
| Auth database trực tiếp            | anon/authenticated không có SELECT/INSERT/UPDATE trên FINAL_REPORT, DEFENSE_CONFIRMATION, SCORE_ENTRY, FILE_ASSET; RLS các bảng cũ đang false, vì vậy không được tự cấp lại quyền trực tiếp |
| Runtime role trong lần kiểm tra    | Có quyền đọc và bypass/owner với các bảng cũ; không đồng nghĩa đã kiểm chứng grant của bảng mới sau migration                                                                               |
| GET trước migration                | Đã chạy SELECT bằng các projection legacy thực tế và capability check; kết quả chi tiết ở `baselineGetProbes` trong readiness JSON                                                          |
| Storage Render                     | Backend chạy Render đã được người dùng xác nhận; disk, mount, durability, backup và restore **NOT VERIFIED**                                                                                |

Đây là snapshot, không phải cam kết trạng thái không đổi. Trước deployment phải chạy lại kiểm tra. Danh sách trên không chứng minh FK/trigger/RLS mới đã chạy: chưa có database rehearsal được nhóm phê duyệt.

UC17 tái sử dụng trực tiếp **8 bảng**: FINAL_REPORT, DEFENSE_CONFIRMATION, SCORE_ENTRY, FILE_ASSET, AUDIT_LOG, IDEMPOTENCY_RECORD, TERM_PARAMETER, TERM_PHASE; dùng lại các quan hệ auth/roster/đề tài/phân công/grants từ B1–B8. Chỉ thêm **1 bảng FINAL_REPORT_VERSION**; không có database nghiệp vụ hoặc hệ thống login/storage UC17 riêng.

## A. Gói migration và quyền cần duyệt

**Review bổ sung 09/11/2026:** [metadata và hardening FILE_ASSET](09-uc17-live-schema-review.md) dùng SELECT do người dùng cung cấp, không query lại Supabase. 17 migrations nền đã applied, chưa UC17–24. Cả 10 REPORT assets hiện có thuộc weekly, không có READY PDF rảnh để adopt. Runtime DB role Render vẫn chưa biết; postgres có quyền/bypass không chứng minh Render dùng role đó. anon/authenticated/service_role không có direct CRUD trên 10 bảng đã kiểm, không suy toàn REST/functions/views đã an toàn.

Candidate thêm final_pdf_asset_immutable trên FILE_ASSET, hai chiều claim no-op UPDATE có kiểm row count, key/id/size/SHA checks và invoker guards báo lỗi nếu RLS che references. Nếu runtime role bị RLS hoặc thiếu SELECT/UPDATE(id), **weekly có thể bị chặn**; phải rehearsal đúng identity trước promotion, không auto-GRANT/BYPASSRLS hay thay ACL/RLS legacy. Fingerprint migration.sql `75CD92D5F97ACF26F3FE6A3EADBBCADFC54F9C81432BEEF4735E8BD8A51E092F`; rollback `7B343F4E5C4BA897FAFF59F9C77E5CA8BD91830EAEA1315065C92CB4A82AEB1F`. schema.diff không đổi. Snapshots bên trên là lịch sử, không phải phép kiểm mới.

Các file trong `backend/prisma/review/final-defense/`:

| File                    | Vai trò                                                                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| migration.sql           | SQL mở rộng, preflight metadata/role, transaction, lock_timeout 5 giây, statement_timeout 60 giây; có quyền, FK, CHECK, triggers, RLS                                                    |
| schema.diff.sql         | DDL sinh offline từ Prisma schema base → schema mới; không kết nối hoặc ghi database. Chỉ đối chiếu structural DDL, không thay thế phần security/trigger/permission được review thủ công |
| rollback.empty-only.sql | Chỉ dùng trong rehearsal hoặc quy trình bù đã được duyệt khi chưa hề có dữ liệu/staging UC17; không là cách tự sửa migration history production                                          |

Thay đổi tối thiểu giữ nguyên kiến trúc đã chọn:

- FINAL_REPORT: thêm revision NOT NULL DEFAULT 0, CHECK không âm.
- DEFENSE_CONFIRMATION: thêm revision, report_version_id nullable, context nullable; CHECK mới chỉ yêu cầu context/trạng thái/lý do ở bản ghi có binding UC17, không sửa giá trị legacy.
- SCORE_ENTRY: thêm revision, report_version_id nullable, comment/context nullable. Giữ Decimal(4,1), unique (proposal_id, scorer_id, role), không thay công thức tổng kết hoặc role khác; bound UC17 score phải là ADVISOR, 0–10, có nhận xét/context.
- FINAL_REPORT_VERSION: id, report_id, sequence, file_asset_id, submitted_at. FK RESTRICT/CASCADE theo Prisma; unique report/sequence và asset; sequence dương, append-only.
- Trigger xác minh PDF READY/private đúng người nộp là chủ proposal; cấm dùng file đã thuộc weekly upload/submission. Trigger phía weekly cấm chiều ngược lại. Hai chiều no-op UPDATE cùng FILE_ASSET tạo row version, không đổi visible metadata; final-linked asset không được đổi metadata/DELETE. Concurrency, invoker/RLS và compatibility weekly vẫn cần rehearsal PostgreSQL thật.
- FK từ điểm/quyết định đến phiên bản và trigger kiểm tra cùng proposal. Tên FK được map rõ trong Prisma để không drift với SQL review.
- RLS bật cho bảng mới, revoke PUBLIC/anon/authenticated. Không thêm policy truy cập trực tiếp cho trình duyệt. Runtime role phải thực sự đọc/ghi được sau migration; nếu không, nhóm duyệt grant cho đúng backend role, không mở quyền cho anon để chữa lỗi.
- GET capability check yêu cầu cột và các CHECK/FK/trigger UC17 hoạt động; chỉ có cột chưa được coi là migration hoàn chỉnh.

**10 permission cần bổ sung:**

| Resource             | Actions                                  | Mapping đề xuất đã có trong draft                                                 |
| -------------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| final-report         | read, download                           | STUDENT, LECTURER, FACULTY, vẫn kiểm tra owner/official advisor/grant tại service |
| final-report         | create                                   | STUDENT sở hữu hồ sơ                                                              |
| defense-confirmation | read, status-read                        | STUDENT, LECTURER, FACULTY theo scope                                             |
| defense-confirmation | review, decide                           | LECTURER là GVHD chính thức                                                       |
| defense-confirmation | score-read, comment-read, rejection-read | LECTURER là GVHD chính thức; không cấp mặc định cho STUDENT/FACULTY               |

Không gán học vụ cho ADMIN, không tạo role hoặc tài khoản. Permission/grant INSERT dùng ON CONFLICT; thay đổi schema không phải script chạy lặp lại mù quáng. Nếu có DDL UC17 một phần hoặc tên function/constraint trùng khác định nghĩa, dừng đối soát.

Sau khi được nhóm review/rehearsal, người triển khai mới promote **đúng bytes đã duyệt** vào active migration directory (tên dự kiến `202611070001_final_defense_confirmation`, kiểm tra tránh trùng/đảo thứ tự với main mới). Không copy rồi tự chạy trong lượt hiện tại. Ghi hash SQL, commit triển khai và approval trong biên bản. Không sửa migration đã áp dụng thành công.

## B. Sao lưu và phục hồi trước deployment

1. Nhóm trưởng xác nhận đúng Supabase project, đúng Render service, runtime/migration role và người có quyền phục hồi. Không đưa connection string vào terminal log, ticket hoặc Git. Dùng secret manager/PGSERVICE/pgpass của nhóm.
2. Xác minh backup/PITR hiện có ở Supabase Dashboard theo plan; tạo mốc backup phù hợp thời điểm triển khai và ghi mã bằng chứng riêng. Nếu không có backup phục hồi được thì dừng. Khả năng backup phụ thuộc plan, không mặc định mọi project đều có PITR. [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups).
3. Có thể lấy thêm archive schema/data public của ứng dụng và metadata quyền/migration vào kho bảo mật. Ví dụ lệnh dành cho operator đã được duyệt, với PostgreSQL client tương thích server:

   ```text
   pg_dump --dbname=service=datn-approved --schema=public --format=custom --file=<secure-backup-path>
   pg_restore --list <secure-backup-path>
   ```

   Giữ ACL và migration history trong phương án backup; archive public không thay thế toàn bộ backup platform/roles. Kiểm tra restore với roles/extensions/RLS thực tế trên môi trường nhóm chỉ định trước khi coi là backup dùng được. Không restore thử vào Supabase chung. Script `database/scripts/backup.sh` hiện nhắm Docker local, **không dùng làm bằng chứng backup Supabase**.

4. Backup toàn bộ uploads gồm `.private-guidance` và các thư mục ẩn, metadata/checksum/file key, tới kho backup riêng được kiểm soát quyền. Không dùng glob bỏ sót dotfiles; không commit tài liệu nộp vào Git. Database backup không chứa bytes trong filesystem Render.
5. Đối chiếu thời điểm chụp DB và files; nhóm chọn cửa sổ bảo trì/kiểm soát ghi để có snapshot nhất quán. Rehearsal phục hồi phải kiểm tra tải lại một file đã được cho phép và so checksum, không chỉ xem danh sách archive.

Không chạy backup, restore hoặc thay đổi dịch vụ bằng tài liệu này trong lượt kiểm tra.

## C. Thứ tự schema → backend → frontend

1. Chốt package/hash, rehearsal SQL + permission + RLS + rollback, backup và người trực deployment. Đối chiếu đủ migration history/checksum local/main/DB; không deploy một chuỗi có migration lỗi/không rõ nguồn.
2. Đảm bảo **UC17_WRITES_ENABLED=false** ở build/config chuẩn bị triển khai. Không seed, db push, reset hoặc chạy migrate trong Docker Build/Start Command. Dockerfile hiện chỉ generate client/build, không tự migrate.
3. Người được duyệt áp dụng active migration đã promote qua quy trình `db:inspect` / `db:deploy` của nhóm, với đúng target và approval environment đã được quy trình đó yêu cầu. Không đặt credentials vào tham số được ghi log; không bỏ gates. Theo dõi timeout/transaction, không thử lại liên tục nếu khóa bảng hoặc lỗi preflight.
4. Kiểm tra table/columns/FK/unique/CHECK/triggers/RLS, quyền runtime role và 10 permission mapping. Xác nhận schema capability true sau migration và records B1–B8 không đổi. Code B1–B8 cũ chỉ đọc cột cũ, nên additive migration không bắt buộc deploy client mới trước schema.
5. Deploy backend đã review lên **đúng Render service** dùng cùng Supabase. Generate Prisma client từ schema mới trong build. Giữ JWT secrets ổn định và đường dẫn storage nhất quán. Backend mới dùng projection cũ khi chưa đủ schema, nên không tự đọc các cột UC17 chưa tồn tại; vẫn phải kiểm tra health + các GET thật.

   Kiểm tra build local/CI bằng `node backend/scripts/check-final-defense-build.cjs` sau build. Nếu cache incremental cũ khiến thiếu JS trong dist, biên dịch đầy đủ trong backend bằng `node node_modules/typescript/bin/tsc --project tsconfig.build.json --incremental false`, rồi chạy lại loader. Loader không bootstrap app hoặc kết nối database. Lượt review đã phát hiện và xử lý tình huống này; chỉ exit code của Nest build không đủ chứng minh artifact runtime đầy đủ.

6. Xác nhận `/api/final-defense/options`, list/detail, GET legacy tương ứng API_PREFIX thực tế; write flag false phải chặn ghi. Xác minh API legacy scores không trả điểm ADVISOR. Không rollback về backend cũ có đường lộ điểm sau khi đã có dữ liệu UC17.
7. Deploy frontend cùng bộ contracts/endpoints; giữ các biến VITE chỉ là cấu hình public, API URL trỏ đúng Render/API_PREFIX, không có backend credentials. Logout/login hoặc refresh session theo luồng hiện có để snapshot permission frontend được cập nhật sau migration.
8. Chạy baseline smoke B1–B8 được nhóm cho phép, kiểm tra UC17 ở chế độ đọc; chưa bật ghi trên Supabase chung chỉ để làm demo.

GET UC17 hiện tại vẫn cần permission ở guard: trước migration/quyền, request thật có thể 403 và menu bị ẩn. “Projection tương thích schema cũ” không có nghĩa UC17 UI đã dùng được trên Supabase khi 10 quyền còn thiếu.

## D. TERM_PHASE và UC17_POLICY

Phase sử dụng **FINAL của B1–B8** qua `operationWindow`, không gán báo cáo tuần thành PDF cuối. Kiểm tra status IN_PROGRESS, khóa đợt/phase, thời gian term và FINAL [start,end) theo server time. Snapshot hiện cả 7 FINAL nằm trong tương lai; không đổi ngày hoặc mở khóa Supabase chung để vượt kiểm thử. Mốc thay thế/gia hạn phải do nhóm/Khoa phê duyệt, không fallback sang WEEKLY/DEFENSE.

Policy theo từng đợt ở TERM_PARAMETER, key `UC17_POLICY`, value là JSON versioned, các trường:

```text
version: mã phiên bản đã duyệt
status: APPROVED chỉ sau khi có quyết định thực tế
approvedBy: user ID người duyệt được nhóm xác nhận
approvedAt: thời điểm duyệt ISO8601 có timezone
scoreStep: bước điểm do Khoa/nhóm duyệt, phù hợp Decimal(4,1)
maxPdfBytes: dung lượng PDF được duyệt, trong giới hạn kỹ thuật 50 MiB
replacementAfterDecision: BLOCK hoặc INVALIDATE đã được duyệt
rubric: null khi đã duyệt chấm tổng trực tiếp, hoặc danh sách key/label/maxScore/weight đã duyệt
```

Đây là mô tả cấu trúc, **không phải policy APPROVED mẫu để copy chạy**. Không có API approval policy mới trong UC17. Endpoint tham số B1 hiện thiên về số; không ép JSON qua validator số. Nhóm dùng quy trình cấu hình quản trị đã được cho phép, lưu policy và audit trong cùng transaction, không tự viết dữ liệu từ readiness script. `approvedBy`/`approvedAt` trong JSON không tự chứng minh quyết định của Khoa: cần biên bản review ngoài hệ thống và quyền cấu hình được kiểm soát.

| Policy thiếu                             | Đề xuất để xét duyệt, chưa áp dụng                                                                                                   | Nguồn tham chiếu và tác động code                                                                                                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bước điểm                                | Xem xét 0.1; đối chiếu 0.5 nếu biểu mẫu Khoa yêu cầu                                                                                 | Yêu cầu người dùng chưa xác nhận; SCORE_ENTRY Decimal(4,1). Runtime chỉ nhận policy đã duyệt, không có default                                                                                           |
| Rubric/aggregation                       | Chấm tổng trực tiếp (`rubric=null`) chỉ khi được duyệt; nếu dùng rubric phải duyệt tiêu chí, maxScore, weight và công thức chuẩn hóa | Tài liệu DATN Table 49/UC16–17 không xác nhận rubric chi tiết. Code kiểm đủ tiêu chí và tổng `Σ(score/maxScore × weight) × 10`, không làm tròn ngầm; công thức này phải nằm trong phần policy được duyệt |
| Ngưỡng được bảo vệ                       | Không đề xuất tự động suy ra từ điểm                                                                                                 | Người dùng đã xác nhận GVHD quyết định thủ công, Khoa xét chính thức ở UC18; không thêm threshold vào code UC17                                                                                          |
| Thay PDF sau xác nhận                    | Xem xét BLOCK cho lần đầu vận hành; INVALIDATE nếu Khoa cho thay và yêu cầu đánh giá/xác nhận lại                                    | Chưa xác nhận. Code có cả hai nhánh, audit, giữ phiên bản cũ và binding; không tự chọn chính sách production                                                                                             |
| Sửa nhận xét/điểm sau quyết định         | Đề xuất ghi lịch sử và chuyển PENDING để GVHD xác nhận lại; cần nhóm ký quy tắc                                                      | Code hiện làm như vậy. Không tự sửa khi SCORE_ENTRY isLocked; cần đưa hành vi này vào nghiệm thu policy                                                                                                  |
| Công khai điểm, nhận xét, lý do          | Đề xuất giữ kín cho tới mốc công bố được duyệt; xét từng permission độc lập                                                          | User instruction; DATN phần công bố điểm UC24. Mặc định STUDENT không có ba quyền đọc nội dung này                                                                                                       |
| Mốc nộp/ra quyết định, gia hạn, nộp muộn | Dùng FINAL đã được B1–B8 quản lý; đề nghị không ngoại lệ tới khi có quy trình gia hạn riêng                                          | TermPhase thực tế và DATN UC17 Table 49. Hiện code từ chối ngoài window, không có hard-coded ngày                                                                                                        |
| Dung lượng/PDF kiểm an toàn              | Đề xuất 20 MiB nếu phù hợp mẫu; nhóm quyết định scanner/parser cần thiết                                                             | Đây là đề xuất kỹ thuật, không APPROVED. Tái sử dụng validator UC15 kiểm envelope/actions; không tuyên bố AV/full parser                                                                                 |

Nguồn nghiệp vụ local: [DATN trích xuất, Table 49 UC17 và phần công bố điểm](../frontend/source-extracts/Project_1_06.md). Yêu cầu người dùng hiện tại là nguồn ưu tiên khi tài liệu đồ án chưa được Khoa duyệt đầy đủ. Không lấy ví dụ 40/60 hoặc điều kiện tuần làm công thức/threshold UC17.

## E. Storage Render: điều gì có bằng chứng, điều gì phải kiểm tra Dashboard

| Kiểm chứng được từ source/config local                                                                             | Chưa thể khẳng định từ source                                                                      |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| FileStorageService đọc STORAGE_LOCAL_PATH, default `./uploads`                                                     | Giá trị biến ở service Render đang chạy                                                            |
| Private guidance/final PDF nằm dưới `<storage-root>/.private-guidance/<UUID>`; key FILE_ASSET là `guidance/<UUID>` | Disk thật có tồn tại/gắn ở service không; thư mục có nằm trong mount thực tế không                 |
| Dockerfile WORKDIR cuối `/workspace/backend`, nên default tương đối là `/workspace/backend/uploads`                | Render có dùng chính Dockerfile/commit/WORKDIR này không                                           |
| compose.shared.yml đặt `/app/uploads` trên named volume `shared_uploads`                                           | Named volume Docker Compose không chứng minh Render service có volume                              |
| Repository không có Render blueprint/manifest khai báo disk; hướng dẫn deploy đề xuất `/var/data/uploads`          | Plan/instance count/disk snapshot/offsite backup/restore có được nhóm cấu hình và kiểm chứng không |

Render mặc định dùng filesystem ephemeral; chỉ dữ liệu dưới mount của persistent disk được giữ khi restart/redeploy. Disk không chia sẻ cho nhiều instance. [Render Persistent Disks](https://render.com/docs/disks).

**Phương án ưu tiên sau khi nhóm duyệt:** dùng persistent disk của chính backend Render, ví dụ mount `/var/data` và cấu hình STORAGE_LOCAL_PATH `/var/data/uploads`. Đây chỉ là đường dẫn đề xuất. Giữ FileStorageService, private namespace, FILE_ASSET và tất cả module B1–B8 dùng chung adapter; không tạo storage UC17 riêng. Nếu đã có disk đúng cấu hình, tái sử dụng nguyên trạng.

Checklist dành cho nhóm trưởng trên Dashboard/runtime:

- [ ] Chọn đúng service/commit; ghi bằng chứng plan, disk và mount path, không ghi secrets.
- [ ] Kiểm tra giá trị STORAGE_LOCAL_PATH nằm trong mount theo đường dẫn thực/WORKDIR; không dựa vào tên thư mục “uploads”.
- [ ] Xác minh runtime user đọc/ghi private directory, dung lượng đủ và không có public/static route phục vụ `.private-guidance`.
- [ ] Nếu phải chuyển files, backup trước, bảo toàn relative key/UUID/checksum và dotfiles, đối chiếu số file/DB. Không đổi key hoặc tự dọn file cũ.
- [ ] Trên môi trường/record được duyệt, nộp một PDF synthetic, tải và so checksum; restart/redeploy được cho phép rồi tải lại cùng phiên bản. Không thực hiện lên service chung trong lượt này.
- [ ] Disk dùng một instance; nếu thực tế nhiều instance, local filesystem không đủ để đảm bảo mọi download thấy cùng bytes. Chưa bật ghi tới khi giải quyết.
- [ ] Xác nhận lịch giữ snapshot và một backup file riêng/offsite, quyền tải backup, RPO/RTO, lần restore thử. Snapshot tự động của nền tảng không thay thế bằng chứng restore ứng dụng. [Render disk snapshots](https://render.com/docs/disks).

Nếu Render không có disk và nhóm không chọn phương án disk, đề xuất một private persistent object-storage adapter **dùng chung tại FileStorageService** cho backend (có thể là Supabase Storage được duyệt). Bucket private, metadata vẫn FILE_ASSET, authorization ở API, secret chỉ ở backend, key immutable và quy trình chuyển/backup file phải được review. Chỉ PostgreSQL trên Supabase không tự lưu PDF. Không tự tạo bucket, cấp policy, upload file hoặc viết adapter phụ thuộc bucket chưa được nhóm chấp thuận. Không thay Supabase PostgreSQL đích.

## F. Điều kiện mở UC17_WRITES_ENABLED

Chỉ người được nhóm cho phép bật flag sau khi có **tất cả**: migration/permissions runtime đúng; policy được duyệt theo đợt; FINAL hợp lệ; upstream ownership/phân công chính thức; storage bền vững + backup; rehearsal transaction/FK/triggers/RLS + E2E được duyệt; B1–B8 regression đạt.

Trong môi trường test đã được chỉ định, bật flag phục vụ rehearsal rồi trả về false khi xong. Trên hệ thống chung, bật ở Render Environment theo quy trình rollout sau phê duyệt, không sửa `.env` local để giả lập production đã sẵn sàng. Sau restart kiểm lại config không in secrets. Flag false mặc định; frontend không có override mở nút khi API còn blocker.

## G. Kiểm thử end-to-end được nhóm cho phép

Nhóm phải chỉ định môi trường/record được phép ghi. Không tự tạo account/proposal/test data trên Supabase chung. Không xây database nghiệp vụ khác; môi trường test phụ trợ nếu nhóm cấp phải chạy cùng schema/migration chain và code của nhóm.

Checklist nghiệm thu gồm:

1. Đăng nhập account STUDENT, GVHD chính thức, FACULTY đã được cấp/cho phép; xác minh đúng đợt/proposal/student và grants, refresh permission snapshot.
2. Kiểm tra GET options/list/detail trước ghi không làm tăng academic rows/audit/idempotency; thông báo schema/policy/FINAL/permission đúng. Không công khai điểm/nhận xét/lý do cho student.
3. Student nộp PDF synthetic, lưu version/asset/hash/revision/idempotency/audit, tải lại đúng bytes; báo cáo tuần hoặc file của sinh viên khác không gắn được vào final report.
4. GVHD đọc tóm tắt UC14–UC16 theo quyền, tải PDF, ghi comment/score/criterionScores đúng policy; reload thấy dữ liệu đã lưu. Thử sai bước điểm/thang điểm/rubric và thiếu quyền phải thất bại không tạo ghi một phần.
5. GVHD Đồng ý hoặc Không đồng ý; từ chối thiếu lý do bị 400. Reload và Khoa scope list cho đúng trạng thái. Sinh viên không thể tự review/decide; GV ngoài phân công/khác term/bộ môn không đọc hoặc sửa được.
6. Gửi lại cùng idempotency key/payload chỉ replay; đổi payload với key cũ bị 409. Hai ghi cùng expectedRevision chỉ một ghi được; audit/idempotency lỗi thì transaction không lưu điểm/quyết định một phần.
7. Test BLOCK/INVALIDATE theo policy được duyệt; giữ PDF cũ, phiên bản/decision stale được nhận diện; sửa đánh giá phải xác nhận lại. Không tự suy điều kiện học vụ từ điểm/nhiệm vụ.
8. Kill/failure chỉ trong môi trường được duyệt ở bước staging: FILE_ASSET QUARANTINED + idempotency/audit định danh file; không báo thành công, không overwrite. Hiện cần quy trình đối soát thủ công được nhóm thống nhất, chưa có job tự xóa/khôi phục staging production.
9. Rehearse restore file và truy cập sau restart/redeploy được phép; kiểm tra trường hợp thiếu file/checksum sai trả lỗi rõ. Nếu nhiều instance, kiểm từng instance trước khi cho vận hành.
10. Lưu bằng chứng SQL/counters đã ẩn dữ liệu cá nhân và kết quả API/browser. Hiện HTTP tests chạy loopback in-memory, không là bằng chứng E2E PostgreSQL/Render.

## H. Rollback/roll-forward

- Nếu SQL lỗi trước COMMIT, transaction phải rollback; kiểm tra trạng thái và Prisma history trước retry, không reset/db push hoặc sửa checksum cho qua.
- Nếu schema đã thêm nhưng chưa mở ghi: giữ schema additive, flag false; sửa backend/frontend theo hướng roll-forward. Backend compatibility build vẫn phải giữ bộ lọc ADVISOR ở API legacy và capability checks.
- Nếu đã có UC17 data/staging: tắt ghi, giữ DB/files/audit, chụp evidence và roll-forward. **Không rollback về backend B1 cũ còn trả điểm ADVISOR từ endpoint legacy thiếu scope.** Không drop version table/cột/context hoặc restore cả DB lên snapshot cũ làm mất B1–B8 mới hơn.
- `rollback.empty-only.sql` cố ý từ chối khi có version/revision/context/comment/audit/idempotency UC17. Không xóa permission/grant vì các row có thể đã tồn tại trước migration. Không CASCADE/drop dữ liệu nghiệp vụ.
- Rollback chỉ trong maintenance đã dừng writers, khóa FILE_ASSET/weekly/các bảng liên quan NOWAIT; lỗi phải ROLLBACK toàn transaction. Gỡ guard mới trước bảng version, giữ step8b. Không rollback UC17 dưới các gói downstream đã deploy mà chưa review dependencies.
- Với migration đã được Prisma ghi nhận thành công: không chạy rollback SQL độc lập rồi xóa/sửa `_prisma_migrations`; tạo một compensating forward migration được duyệt hoặc giữ schema và rollback compatibility code. `migrate resolve --rolled-back` không dùng để làm như một migration thành công chưa từng xảy ra.
- Rollback code trên Render không tự rollback database hoặc disk. Khôi phục snapshot disk/DB là quy trình sự cố riêng, cần xét mất dữ liệu và consistency DB–file, có approval và restore rehearsal. [Render Rollbacks](https://render.com/docs/rollbacks).

## I. Chứng minh B1–B8 được bảo toàn

Trước/sau rehearsal và deployment được duyệt, so migration history/checksum, row counts và các khóa ownership/official assignment; không coi row count một mình là bằng chứng đủ. So byte/snapshot đại diện đã được phép cho hồ sơ cũ và checksum file cũ; chứng minh draft không UPDATE/backfill các giá trị legacy.

Chạy build/typecheck/lint/tests hiện có, bổ sung smoke có scope cho login/session/RBAC, danh mục, term/roster/quota/phase, đăng ký/phân công, đề tài/versions/reviews/dossier, kế hoạch/nhiệm vụ, weekly upload/download/review. Kiểm tra riêng trigger exclusivity mới không chặn weekly asset bình thường. Chứng minh GET cũ không chọn cột UC17 chưa có; legacy score API không lộ điểm GVHD mới. Không seed vào database chung để có dữ liệu kiểm tra.

Lưu kết quả commit/migration/hash/runtime storage evidence/approval và counters riêng cho từng môi trường. Unit/component/HTTP in-memory PASS chỉ xác nhận code trong phạm vi đó.

## J. Điều kiện dừng triển khai

- Không rõ target, runtime role, lịch sử migration/checksum không khớp, DDL UC17 một phần hoặc lock/preflight lỗi.
- Chưa có backup + restore rehearsal, không bảo toàn dữ liệu/file B1–B8.
- FINAL chưa mở/khóa/đợt sai trạng thái; policy chưa được duyệt hoặc không tương thích Decimal/rubric; chưa có permission/assignment/owner/grant hợp lệ.
- Chưa chứng minh disk/mount/backup hoặc nhiều instance không có shared storage; không giải quyết file thiếu/hash lệch bằng cách trả success.
- Migration/transaction/FK/trigger/RLS chưa kiểm thử trên môi trường được nhóm cho phép; chưa đủ môi trường E2E.
- Endpoint/API URL không khớp, auth/scope leak, GET tạo dữ liệu, grade legacy leak, test/build/lint/typecheck/regression thất bại.
- Chưa có quyền thực hiện ghi/deploy từ nhóm. Hiện tại các thiếu sót thực tế ở bảng hiện trạng vẫn là điều kiện dừng **bật ghi**, không phải lý do xóa hoặc viết lại code UC17.

**Kết luận nghiệm thu hiện tại:** code UC17 tiếp tục được tích hợp trên cùng hệ thống; chưa đủ điều kiện nghiệm thu ghi end-to-end trên Supabase/Render chung. Nhóm cần duyệt migration/permission/policy, cung cấp môi trường rehearsal và xác minh storage. Không chuyển UC18 trong lượt này.
