# B9–B10: bàn giao merge và phát hành

Tài liệu hiện hành ngày 11/11/2026. Các README gói UC17–24, history26 và grant FACULTY lưu lịch sử triển khai; không dùng số migration/PID cũ trong đó để quyết định chạy lệnh. Production đã có **27 APPLIED / 0 FAILED**, **124 permission definitions / 166 grants**, **0 policy UC17–25**. Lượt chuẩn bị merge chỉ đọc Supabase, không triển khai SQL, sửa flags hoặc dữ liệu.

**READY TO MERGE** cho tập file đã chọn và kiểm thử dưới đây. **NOT READY FOR PRODUCTION** cho việc bật nghiệp vụ B9–B10 trên Render. Chưa commit, push, merge hoặc deploy; kết luận merge áp dụng cho đúng hash source và main đã kiểm tra.

## Phạm vi bản thay đổi

Đã fetch `origin/main` tại `05131282a686eacfe4ff23a24f26a5ac02feb3b9`. Feature HEAD `0093f81a6017a8e046a03a8ce9786189cd5b37d8` là ancestor, sau một merge commit có cùng tree; phần B9–B10 hiện vẫn là thay đổi chưa commit. Bản thay đổi đã được áp lên worktree detached từ main mới nhất, không có conflict. Không merge/commit/rebase/reset branch gốc.

Danh sách commit chính xác và SHA-256 từng file nằm trong `.cache/release/commit-files.json` của worktree review; bản sao bàn giao ở Project1 `.cache/merge-readiness/`. Chỉ chọn những file trong danh sách, không `git add .`. Các kết quả chạy, dữ liệu staging, tài khoản/password thật, vault, backup, PDF/ZIP và file Word khóa không thuộc commit. Fixture tổng hợp trong test và công cụ staging có guard là source kiểm thử, không phải danh sách tài khoản đang sử dụng.

## Kiểm chứng thực thi

| Kiểm tra | Kết quả |
|---|---|
| Backend unit/HTTP cô lập | 947/947 PASS |
| Frontend unit/component | 403/403 PASS |
| Backend/frontend lint, typecheck, Prisma validate | PASS |
| Backend Nest production build, frontend Vite production build | PASS |
| PG17 mới: 17 migration nền → role bootstrap TEST → đủ 27 migration | PASS; không đổi SQL đã applied |
| Regression B4–B8 API và populated upgrade | 14/14 nhóm PASS |
| Browser B4–B8, đăng nhập, PDF, revision, RBAC, monitor, mobile | PASS; API và PG17 thật, không mock nghiệp vụ |
| B1–B10 nối tiếp qua service/API trên run auto mới | PASS; PDF cuối, phân công, lịch, chấm, UC24 và 5 loại xuất/tải UC25 |
| Feature B1–B3 HTTP, SMTP sink và integration DB | PASS; 25 integration assertions |
| Source origin/main biên dịch riêng + schema27 | HTTP B1–B3/SMTP/PDF PASS; không phải kiểm chứng revision Render đang chạy |
| Production READ ONLY | 27 checksum đúng, 124/166/27 provenance/0 policy, `fr_guard` đã sửa |
| Secret/artifact scan của tập file commit | PASS, không phát hiện credentials hoặc tài khoản staging đã lưu |

Bằng chứng đầy đủ được giữ local ở `.cache/release/`, `docs/implementation/evidence/steps4-8/` và cache run PG17 riêng; không đưa raw dữ liệu vào Git. Bộ manual hiện hữu không được dùng cho các lượt kiểm thử này. Các run/container mới được giữ lại, chưa cleanup.

## Những sửa lỗi để chuẩn bị release

- Tách producer policy TEST khỏi `backend/dist` bằng `tsconfig.build.json`; build riêng bằng `tsconfig.acceptance.json` vào `.acceptance-build`, bị loại khỏi Git và Docker context. AppModule không đăng ký producer này.
- Bootstrap bình thường từ `main.ts` luôn từ chối `/api/acceptance/*` bằng HTTP 404, kể cả khi vô tình đăng ký controller TEST. Runtime staging từ chối NODE_ENV production và kiểm tra loopback, tên DB, nhãn container, port cùng runId trước đổi đồng hồ.
- Frontend production bắt buộc `VITE_AUTH_API=true`, không cho `VITE_DEMO_MODE=true`; fixture demo không thể tạo trong production. Asset đã kiểm tra không còn mật khẩu demo hoặc công cụ clock, dù cố tình đặt cờ nghiệm thu khi build.
- CI dùng PG17. Fresh DB kiểm thử áp baseline trước, tạo role học vụ TEST, sau đó áp phần còn lại. Không sửa migration để tự tạo role trên production. Test ghi DB không đọc `.env` làm fallback và từ chối target ngoài loopback `btl_pr2b_*`.
- `.gitattributes` ghim SQL UC17–27 nguyên byte. Riêng `0_init` dùng `text eol=crlf` để Linux checkout có checksum đã applied trên Supabase, trong khi Git blob và SQL trong workspace không đổi. Đã kiểm tra bằng Git filters với `core.autocrlf=false`.
- Fixture CHECK cũ được đưa vào `backend/test/fixtures`, không phụ thuộc báo cáo review/ZIP ngoài source. Công cụ verify biết chuỗi chính thức 27, vẫn kiểm tra checksum/dependency và từ chối drift; chế độ promotion lịch sử vẫn yêu cầu ZIP đã ghim.

## Trước merge

Reviewer kiểm tra API/contracts và permission matrix UC17–25, các thay đổi dùng chung B1–B8, migration nguyên byte, quy tắc lịch thực và fail-closed. Đọc `backend/prisma/deployment/uc24-25-rbac/PERMISSION-MAPPING.md`, `POLICY-DECISIONS.md`, `docs/implementation/REAL-TIME-OPERATION.md` và phần storage bên dưới. CI GitHub thực tế chỉ chạy sau push/PR; lượt này chưa push.

Các file được bàn giao theo manifest đã kiểm thử, nhưng chưa commit. Giữ nguyên những file vận hành và kết quả cũ ngoài manifest. Nếu main hoặc source tiếp tục thay đổi sau SHA đã kiểm tra, cần cập nhật worktree và chạy lại các kiểm tra bị ảnh hưởng trước merge.

## Trước khi bật B9–B10 trên Render

**NOT READY FOR PRODUCTION** cho luồng ghi chính thức. Merge code với flags tắt được tách khỏi việc mở nghiệp vụ:

1. Xác minh revision Render, health/HTTP, log, Node/Prisma engine, CORS và cấu hình kết nối; lượt này không có quyền/endpoint để kiểm chứng deployment thực tế.
2. Chuẩn bị chín policy cho term thật: version/contract, actor và thời điểm phê duyệt thật, hiệu lực, nguồn minh chứng, rubric/bước điểm, công thức, công bố và mẫu. Không chuyển TEST policy hoặc tự tạo APPROVED. Bảng quyết định chi tiết nằm trong `POLICY-DECISIONS.md`.
3. Duyệt đúng người/scope/phân công cho quyền xem điểm, confirm, finalize, publish, export và download. 124/166 không có nghĩa mọi vai trò đã đủ quyền nhạy cảm. Không áp role mapping rộng của staging.
4. Xác minh storage bền vững, backup file và restore thật trước cho nộp/xuất. DB backup không chứa byte PDF/ZIP.
5. Sau smoke có quyền trên deployment mới và các điều kiện trên, quyết định riêng việc bật từng `UC17_WRITES_ENABLED` … `UC25_WRITES_ENABLED`. Default của source là false. Không giả định Render đang có cùng giá trị; phải kiểm tra dashboard/process thực tế.

## Storage production

`FileStorageService` dùng `STORAGE_LOCAL_PATH`, mặc định `./uploads`. PDF cuối và file hướng dẫn nằm trong `.private-guidance` dưới root này; dùng key nội bộ, file bất biến, không phục vụ thư mục tĩnh, service kiểm tra lại quyền/phân công khi tải. Private storage từ chối symlink/traversal và kiểm tra kích thước/hash theo luồng. Metadata trong PostgreSQL không bảo đảm file sống qua redeploy.

Ưu tiên giữ adapter hiện tại nếu Render đã có persistent disk: operator kiểm tra disk/mount path, root trỏ vào volume, private ACL, dung lượng, retention và backup/restore riêng. Tạo một file nghiệm thu được phép, xác minh vẫn tải được qua một lần restart/redeploy có kiểm soát; không làm bước đó trong lượt này. Nếu chưa có disk, phải chọn storage bền vững và kiểm thử adapter/ownership/lifecycle trước khi bật upload. Không tự tạo disk/bucket hay thay env. Supabase Storage có thể là phương án sau khi được chọn, không coi metadata `storage` là bản sao file.

## Sau merge và rollback

1. Build backend/shared và frontend API mode từ đúng commit merge, giữ mọi UC write flag false. Không chạy seed, db push, reset hoặc SQL gói RBAC thủ công.
2. Supabase đã đủ 27; **không cần chạy lại migration trong release này**. Nếu pipeline có bước migrate tự động, operator kiểm tra target/history/27 checksum/backup và advisory lock trước; hiện còn ghi nhận khóa 72707369 ở PID 2061694, backend_start `2026-11-10 18:17:16.849945 UTC`, idle/không transaction tại thời điểm kiểm tra. Không tự terminate hoặc tắt locking. Kiểm tra lại trạng thái hiện tại, không dùng PID trong tài liệu để tự hành động.
3. Deploy code theo yêu cầu phát hành riêng, smoke đăng nhập/GET/RBAC/timezone và log trước; không tạo điểm hoặc công bố dữ liệu thật để smoke. Sau đó cấu hình policy/scope/storage đã duyệt, bật từng luồng và theo dõi.
4. Sự cố code: tắt các luồng ghi mới theo quyết định incident, quay lại image/revision trước và kiểm tra B1–B8. Schema additive 27 đã được kiểm tra với main; không rollback 27/26/UC17–24 để rollback code.
5. `uc24-runtime-fix/rollback.sql` khôi phục lỗi cũ, không phải rollback thông thường. Backup logic production đã restore PG17 ở lượt database; trước một thao tác ghi mới phải có backup mới còn hiệu lực và quyền khôi phục. Full restore cần ngừng ghi, bảo vệ các thay đổi sau backup và quy trình Supabase-managed riêng; không tự restore production. Filesystem PDF cần bộ backup và recovery riêng.

Không commit/push/merge, thay `.env`, policy/grants/flags production hoặc deploy Render đã được thực hiện trong lượt chuẩn bị này.
