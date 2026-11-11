# Phát hành nhánh tích hợp B1–B10

Kế hoạch hiện hành ngày 11/11/2026: hoàn thiện source → PR/merge `feature/b9-b10-implementation` vào `fix/integration-ui` → nhóm triển khai nhánh tích hợp và nghiệm thu Supabase thật → chỉ sau nghiệm thu mới xem xét PR vào `main`. Tài liệu này thay thế các chỉ dẫn phát hành thẳng `main` trong báo cáo lịch sử. Không coi bản build local hay PostgreSQL test là bằng chứng revision/cấu hình của host.

## Hai mức readiness

**READY FOR INTEGRATION DEPLOY** nghĩa là source đã tích hợp, test/build PASS và có thể deploy code với các luồng ghi mới tắt. Nó không cho phép ghi hồ sơ thật hoặc bỏ qua cấu hình học vụ. **READY FOR PRODUCTION** còn đòi hỏi chín policy được phê duyệt thật, quyền/phạm vi đã duyệt, storage và recovery được kiểm chứng trên host, cùng smoke nghiệp vụ được phép. Thiếu các điều kiện đó, giữ mức production là NOT READY.

Không thay 27 migration đã áp dụng. Không chạy `db push`, `migrate reset`, seed hoặc SQL review trong build/startup. Dockerfile chỉ generate Prisma client và build; Supabase đã có schema 27. Nếu hạ tầng hiện có tự chạy migration trước deploy, operator phải kiểm tra và ngăn chạy lại SQL thủ công, xác minh target/history/checksum/advisory lock trước bất kỳ release database riêng nào.

## Policy và quyền trước khi mở ghi

- [Chín policy chính thức](B9-B10-OFFICIAL-POLICIES.md) có template DRAFT, trường cần quyết định và preflight offline. Không đổi nhãn policy TEST thành APPROVED, không tự điền actor/thời điểm/văn bản.
- [RBAC release](../../backend/prisma/deployment/integration-rbac/RELEASE-RBAC.md) có inventory toàn B1–B10, mapping UC17–25, approval template, preflight/postflight và rollback. SQL này **chỉ cấp action theo toàn role khi tác động toàn role được duyệt rõ**, không giả thành quyền riêng một tài khoản/đợt. Không chạy gói nếu yêu cầu chỉ dành cho một pilot account.
- `ACADEMIC_TERM_GRANT` hiện giới hạn term/bộ môn nhưng chưa cấp action theo user. Chưa có service quản trị scope cho đợt đang tồn tại. Nếu quyền pilot chưa có và không được duyệt role-wide, luồng đó vẫn BLOCKED; cần một thay đổi scoped authorization riêng được kiểm chứng.
- PostgreSQL RLS/ACL là lớp riêng: private Storage không bảo vệ bảng public, và login migration không phải tài khoản API nghiệp vụ. Sau deploy phải đối soát anon/authenticated/API access riêng, đặc biệt điểm, nhận xét, FILE_ASSET và audit.

## Cấu hình triển khai do nhóm thực hiện sau merge

1. Ghi lại merge SHA của `fix/integration-ui` và revision đang chạy trước thay đổi. Chọn đúng branch ở Render/Vercel; không thay `main`. Không giả định hai host đã đổi branch chỉ vì PR được merge.
2. Dùng Docker context ở repository root, Dockerfile `backend/Dockerfile`; frontend Root Directory là `frontend`, dùng `frontend/vercel.json`. Kiểm tra install/build log của shared/backend/frontend từ cùng source.
3. Tham khảo `backend/.env.production.example` và `frontend/.env.production.example`. Đây là mẫu, **không ghi đè `.env` hiện hữu**. Nhập DB TLS URL, JWT và private Storage key qua secret manager của host. Không đưa server secret vào `VITE_*`.
4. Ban đầu giữ `GUIDANCE_UPLOAD_ENABLED=false` và toàn bộ `UC17_WRITES_ENABLED` … `UC25_WRITES_ENABLED=false`. Giữ email/reminder workers tắt cho đợt tích hợp nếu chưa có delivery isolation; không gửi tới người ngoài bộ được phép. Các service vẫn kiểm tra quyền, trạng thái, policy và hạn tại từng thao tác.
5. Cấu hình origin frontend chính xác trong `FRONTEND_URL`, frontend `VITE_API_URL` đúng `/api`; `NODE_ENV=production`, `VITE_AUTH_API=true`, `VITE_DEMO_MODE=false`, `VITE_ACCEPTANCE_STAGING=false`. Build production không sử dụng TEST clock; API `/api/acceptance/*` bị từ chối ở bootstrap thông thường.
6. Chọn storage trước khi mở upload. [Hướng dẫn storage](B9-B10-STORAGE-OPERATIONS.md) và `backend/storage-production.env.example` mô tả hai lựa chọn: local trên persistent disk đã xác minh hoặc adapter private Supabase Storage. `deploy/render.integration.example.yaml` chỉ là mẫu review, không tạo service/disk/bucket và không đổi service đang chạy. Không áp Blueprint tự động lên hạ tầng hiện hữu.
7. Nếu dùng object storage: cấu hình server-only HTTPS origin/bucket/private service key; bucket phải private. Bản local cũ không tự di chuyển, adapter không fallback giữa hai provider. Chuyển provider cần inventory metadata/byte, copy được phê duyệt, so hash/kích thước và recovery cho **toàn bộ guidance domain** trước khi đổi driver. Không mở public bucket hay static PDF directory.
8. Sau deploy, nhóm xác minh URL, exact revision, health `/api/health`, đăng nhập/RBAC, CORS, actual DB project và giá trị flags thực tế từ Dashboard/process. Đây là bước **sau merge/deploy**, không phải điều kiện yêu cầu URL trong lượt hoàn thiện source.

Blueprint dùng `autoDeployTrigger: off`; secrets `sync: false` để operator cấp khi tạo/cấu hình. Đối chiếu [Render Blueprint specification](https://render.com/docs/blueprint-spec) trước khi dùng mẫu. Supabase private bucket yêu cầu tải có xác thực theo [Storage downloads](https://supabase.com/docs/guides/storage/serving/downloads); ứng dụng tiếp tục proxy qua API có quyền, không trả provider URL/signed URL cho trình duyệt.

## Nghiệm thu sau triển khai

Tạo một đợt tích hợp riêng qua workflow B1, mã và runId rõ ràng; không lấy hồ sơ/điểm chính thức để thử. Dùng lịch thực do Khoa cấu hình, không TEST clock. Trước ghi: backup DB và byte file, restore kiểm chứng, danh tính/role/phạm vi/phân công được duyệt, chín policy đúng term/version/contract và không có rollout đồng thời. Bật từng flag theo quyết định vận hành riêng, không bật chín cờ chỉ vì build PASS.

Thử tuần tự B1 → B10 bằng tài khoản được phép; kiểm tra ownership, wrong advisor/reviewer/member, cross-term/bộ môn, sửa nguồn làm evidence stale, lịch/hạn và audit. UC25 phải đối chiếu bytes/hash/quyền nội dung; PDF UNSIGNED không phải biên bản đã đồng ký. Sau mỗi bước ghi ID và PASS/FAIL; dừng tại lỗi, không sửa SQL trạng thái để vượt validation. Xác minh download sau restart/redeploy có kiểm soát và restore byte+DB trước khi coi durability đạt.

## Recovery và giới hạn phát hành

Lỗi code: theo quyết định incident, tắt luồng ghi ảnh hưởng, quay lại revision code trước và smoke B1–B8. Giữ schema/history 27; rollback code không chạy ngược migration 27 hoặc khôi phục function UC24 lỗi cũ. Rollback quyền cần phê duyệt riêng và gói provenance-aware; không xóa toàn bộ grant của role. Policy có consumer hoặc thay đổi downstream cần review version/recovery, không xóa trực tiếp để làm hồ sơ stale. Full restore production là quy trình riêng có thời gian ngừng ghi và đối soát thay đổi sau backup.

Kết quả chạy local, manifest SHA-256 và CI thuộc đợt tích hợp được ghi trong `.cache/integration-readiness/`, ngoài Git. Tài khoản, vault, dump, PDF/ZIP nghiệm thu, `.env` và dữ liệu manual/auto hiện hữu không thuộc commit. Việc deploy hay bật cờ không được thực hiện bởi tài liệu hoặc build.

Lượt source ngày 11/11/2026: 1.004 backend tests, 403 frontend tests, 25 ca HTTP/database (14 ca API và 11 ca automation), 14 nhóm regression B4–B8/184 checks, 14 ca SQL RBAC và 23 ca planner/artifact gate đều PASS. Typecheck, lint và production build hai phía PASS. E2E B1–B10 qua 69 HTTP requests cùng service nghiệp vụ PASS trên đợt mới riêng, gồm tải và đối chiếu hash năm loại Excel/PDF UNSIGNED. Rehearsal giữ 27 migration nguyên byte; restore thật đối chiếu 103 bảng cùng constraints/indexes/triggers/RLS/ACL, kiểm thử rollback policy/quyền trong transaction, FK, trigger bất biến và mutex hai session PASS. Production frontend được kiểm tra với cờ nghiệm thu cố ý bật lúc build nhưng không có TEST UI/API request; backend bootstrap thường trả 404 cho API nghiệm thu. Những kết quả này không chứng minh bucket/backup của Supabase thật hoặc độ bền disk trên Render; các mục đó vẫn là gate vận hành sau merge.
