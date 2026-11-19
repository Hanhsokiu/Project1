# B1–B10 storage: source, adapter và điều kiện mở luồng ghi

Phần triển khai kỹ thuật không thay `.env`, không tạo bucket/disk, không ghi vào Supabase hoặc thư mục upload hiện hữu. Mặc định của source tiếp tục là local. Các phép thử mới chỉ sử dụng byte tổng hợp trong thư mục temp tự sở hữu hoặc mock transport; **không phải bằng chứng file sống qua một lần redeploy Render thật**.

## Đường đi của byte và quyền tải

| File | Nơi lưu theo source | Cách tải và kiểm tra |
|---|---|---|
| PDF đề cương xem trước B5–B6 | Render từ version và template khi gọi, không tạo file persistent | Controller/service đề tài kiểm tra scope/version; không có URL thư mục upload |
| PDF hồ sơ đã chốt B7 | `DossierPdfContent.bytes` trong PostgreSQL; `FileAsset.storageKey = db:dossier-pdf/<assetId>` | `DossierService.download`: quyền export/ownership, finalization thuộc hồ sơ, snapshot hash, asset READY, SHA-256 và size |
| Báo cáo/source ZIP/minh chứng B8 | `FileAsset.storageKey = guidance/<uuid>`; qua `FileStorageService` | `SubmissionService`: quyền task và phân công, upload actor/task/manifest, trạng thái COMMITTED, size và SHA-256; cleanup không xóa asset đang được dùng |
| PDF đồ án cuối UC17 và nguồn UC18/UC22–UC24 | Cùng miền key `guidance/<uuid>` | `FinalDefenseService.download`: scope hồ sơ, quyền `final-report:download`, version thuộc report, asset READY/REPORT/PDF, size tối đa 50 MiB và SHA-256. Upload authorization/policy thực hiện trước Multer buffer và lặp lại dưới lock |
| Excel/PDF UC25 | Metadata/hash/snapshot trong database; byte được render lại khi tải | `ReportService.download` kiểm tra scope, quyền download, policy/template/source, thời hạn artifact, render lại và so SHA-256; ghi delivery audit. Không phải API GET không tác dụng phụ |
| Legacy `FinalReport.filePath` | Metadata lịch sử; không tự nhận là asset mới | UC17 trả reconciliation blocker khi chưa có revision/file asset hợp lệ. Không tự di chuyển hoặc xóa file legacy |

`FileStorageService.save/delete` legacy vẫn dùng local và hiện không có caller nghiệp vụ trong `backend/src` ngoài định nghĩa. Adapter mới không biến mọi `filePath` lịch sử thành object URL. `main.ts` và nginx source không public static uploads.

DB logical backup có thể chứa byte B7 nhưng **không chứa byte `guidance/*` trên disk hoặc object storage**. UC25 yêu cầu giữ metadata, dữ liệu nguồn, template và renderer có thể tái tạo đúng hash; hiện source không cam kết lưu trữ artifact đã ký hoặc lâu dài khi nguồn thay đổi. Không coi PDF chưa ký là tài liệu đồng ký.

## Hai phương án vận hành

**Local persistent disk:** `STORAGE_GUIDANCE_DRIVER` unset hoặc `local`. Root từ `STORAGE_LOCAL_PATH` (default `./uploads`), private bytes dưới `.private-guidance`. Trên Render phải xác minh root nằm trên persistent mount thật; đường dẫn `/var/data/uploads` trong tài liệu chỉ là hướng dẫn, không chứng minh disk đã được provision. Docker `compose.shared.yml` có named volume `shared_uploads:/app/uploads`; không chứng minh Render có volume đó.

**Private Supabase object storage:** adapter opt-in mới `SupabasePrivateStorage`, tái dùng `savePrivateGuidance/readPrivateGuidance/deletePrivateGuidance`, giữ nguyên key/DB và phân quyền nghiệp vụ. Cấu hình riêng tiến trình/secret manager sau khi được phép:

| Biến | Ý nghĩa |
|---|---|
| `STORAGE_GUIDANCE_DRIVER=supabase` | Chọn adapter cho toàn bộ miền `guidance/*`; không tự fallback |
| `STORAGE_SUPABASE_URL` | HTTPS project origin, không user/password/query/path; không đưa URL chứa credentials |
| `STORAGE_SUPABASE_BUCKET` | Bucket riêng đã tạo và được duyệt, public=false |
| `STORAGE_SUPABASE_SERVICE_KEY` | Server-only service-role JWT; tuyệt đối không có tiền tố VITE hoặc trả cho browser |

Adapter kiểm tra bucket private trước mỗi operation, không tạo bucket, không ký/public URL, không follow redirect, không ghi đè (`x-upsert=false`), download authenticated và giới hạn byte cả Content-Length lẫn stream, timeout 30 giây. Provider lỗi được làm sạch trước khi ném. Business service vẫn kiểm tra ownership/phân công/size/hash; service role bypass Storage RLS nên không được cho browser gọi trực tiếp bằng credential backend. Bucket private chưa đủ nếu có RLS grant mở cho anon/authenticated: operator phải xác minh không có SELECT/INSERT/UPDATE/DELETE trực tiếp vượt qua authorization ứng dụng.

Miền `guidance/<uuid>` hiện **chưa ghi provider trong mỗi locator**. Vì vậy không được đổi driver trên một root đang có dữ liệu rồi giả định file cũ tự chuyển: không có automatic copy hoặc fallback. Trước đổi provider phải khóa ghi theo kế hoạch được duyệt, inventory asset READY/COMMITTED + orphan intent, backup root cũ, copy nguyên key sang private destination bằng công cụ được duyệt, xác minh toàn bộ size/SHA-256, restore thử, rồi mới chọn driver và smoke đúng scope. Giữ nguồn cũ cho rollback; không xóa file chính thức. Không chỉnh `FileAsset`/key bằng SQL để che file thiếu. Nếu chưa hoàn tất đối soát, giữ driver cũ trên disk bền vững hoặc giữ upload BLOCKED.

## Bằng chứng cần có trước bật upload/export trên host

1. Revision/backend driver thực tế và root/mount hoặc bucket private, quyền riêng tư, dung lượng/retention; không suy từ default source.
2. Backup database production mới và file/object backup có manifest key/size/SHA-256 đồng bộ ở một mốc ngừng ghi được phép. Với Supabase, backup DB metadata `storage` không chứa object bytes.
3. Restore database và file vào môi trường cô lập; kiểm tra key→asset→report/submission, hash và truy vấn qua API đúng/sai quyền. Không restore vào database hoặc root chính thức.
4. Một PDF TEST riêng của đợt tích hợp được duyệt: upload→download→restart/redeploy có kiểm soát→download và so hash; giữ dữ liệu hồ sơ thật nguyên vẹn. Chỉ thực hiện khi có quyền host và thời điểm vận hành được duyệt.
5. Recovery: dừng ghi mới, giữ audit, chọn checkpoint DB/file tương ứng và xác minh restore trên bản sao trước xử lý production; rollback code/driver không tự phục hồi byte đã mất. Không tự chạy cleanup hoặc rollback production.

## Kết quả kiểm thử trong lượt hoàn thiện

- Storage 30 tests PASS: private bucket guard kiểm tra lại trên từng operation, immutable upload, canonical UUID key/traversal/redirect configuration, bounded chunked reads, lỗi không lộ credential, authenticated download lỗi 401/403/404/500, delete đúng key/idempotency và unknown driver fail-closed. Có kiểm thử local restart instance + copy backup/restore PDF tổng hợp, stateful object backup/restore qua adapter mới với SHA-256 và đổi provider thiếu file không fallback/xóa byte local.
- Lượt regression mở rộng storage + UC17 upload/download HTTP/validator/repository/migration, B8 submissions, B7 dossiers, UC18 eligibility và UC22–UC23 grading: 298 tests PASS, gồm 30 storage tests nêu trên. Ownership, phân công, hash/size và trạng thái evidence vẫn được kiểm tra ở business service.
- TypeScript backend và ESLint storage PASS.
- Mock/new service instance không phải restart host; copy temp file không phải backup production. Live Storage API, ACL/RLS thực tế và redeploy durability còn phải kiểm chứng trên hạ tầng được phép.

Tham chiếu chính thức: [private downloads](https://supabase.com/docs/guides/storage/serving/downloads), [Storage access control và service key](https://supabase.com/docs/guides/storage/security/access-control), [xóa object qua Storage API](https://supabase.com/docs/guides/storage/management/delete-objects). Không xóa object bằng SQL metadata.

## Bàn giao source trước tích hợp host

Mẫu riêng [storage-production.env.example](../../backend/storage-production.env.example) chỉ chứa tên biến và placeholder. Không thay `.env`, không tạo bucket, không sao chép credential hoặc di chuyển file thật. Khi chọn `supabase`, constructor của adapter từ chối origin không phải HTTPS, user/password/query/path, bucket không hợp lệ hoặc credential rỗng; driver lạ không fallback về local.

Trước khi nhóm triển khai `fix/integration-ui`, chọn duy nhất một provider cho miền `guidance/*`. Local default vẫn giữ layout `.private-guidance/<uuid>` và byte cũ. Backend cung cấp download qua business endpoint, không public static root hay trả signed URL. Các kiểm thử adapter không thay thế kiểm chứng RLS/ACL thật: backend service credential có thể bypass RLS, còn operator cần chứng minh anon/authenticated không được truy cập bucket ngoài luồng ứng dụng.

Sau deploy, nhóm phải ghi nhận bằng chứng private bucket hoặc persistent mount, backup byte+database cùng checkpoint, restore trên bản sao và download đúng/sai quyền, rồi thử một file TEST được phép qua restart/redeploy có kiểm soát. Chưa có các bằng chứng đó thì giữ write flags tắt. Không cần truy cập Render/Vercel hoặc URL host ở giai đoạn hoàn thiện source này.
