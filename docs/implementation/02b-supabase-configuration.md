# Cấu hình PostgreSQL Supabase dùng chung

Phạm vi lượt này: env/validation, Prisma datasource, Docker, script migration và kiểm tra DB **chỉ đọc**. Không thay nghiệp vụ/JWT/RBAC/shape API; không tạo hay chạy migration, seed hoặc DDL. Supabase là PostgreSQL phía sau Prisma, không chuyển sang Supabase Auth hoặc đưa secret key vào frontend.

## Cấu hình theo package

- `backend/.env.example` → `backend/.env` (ignored): DATABASE_URL cho app, DIRECT_URL cho CLI/inspection, DB_INSPECT_HOST pin hostname; JWT_SECRET/JWT_REFRESH_SECRET do từng môi trường cung cấp. Không lưu key Supabase SDK khi chưa dùng SDK.
- `frontend/.env.example` → `frontend/.env.local` (ignored): chỉ VITE_API_URL. Vite từ chối các biến VITE chứa tên secret/password/database/service-role/JWT hoặc giá trị DB URL/Supabase secret key.
- Root `.env.example` → `.env` chỉ dùng Docker interpolation, không còn là nguồn env ứng dụng. Nest đọc backend/.env qua đường dẫn cố định so với src/dist; process env vẫn có ưu tiên. Khởi động thiếu DB URL/JWT hoặc port không hợp lệ sẽ fail với tên field, không in giá trị secret.
- Backend/.env local đã tạo từ connection URL người dùng cung cấp, thêm TLS, secret JWT ngẫu nhiên; không lưu publishable/secret/JWKS keys. Credentials đã xuất hiện trong chat cần thay bằng credential mới ở local file. Không đưa vào source hoặc report.

Prisma 5.22 giữ schema hiện tại, chỉ thêm `directUrl = env("DIRECT_URL")` trong datasource. Không đổi bất kỳ model/field/table/enum/cardinality nào. DATABASE_URL và DIRECT_URL có thể cùng là direct/session connection phù hợp; transaction pooler không dùng cho migration/inspection cần phiên ổn định. Sao chép **đúng URL Dashboard → Connect**, không tự suy hostname/region. Bật TLS `sslmode=require`; URL-encode password nếu có ký tự đặc biệt.

Direct endpoint có yêu cầu mạng riêng; Session pooler là lựa chọn cho môi trường không truy cập direct endpoint được. Tham chiếu chính thức: [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase Prisma integration source](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/database/prisma.mdx). Không đổi dependency sang Prisma 7 hoặc áp prisma.config.ts của phiên bản khác.

## Docker và CI

Default `docker compose up -d --build` chạy app dùng backend/.env, không khởi động PostgreSQL local. Backend không còn depends_on postgres bắt buộc. MailHog/Nginx giữ cho dev; Compose chạy Nest dev để bind-mounted source không che mất dist cần thiết. Dockerfiles dùng build context root/lockfile/workspace và pnpm 9; `.dockerignore` loại .env, secrets local, node_modules, uploads khỏi image build.

Nếu thật sự cần DB local riêng:

```powershell
# Root .env có LOCAL_DB_PASSWORD ngẫu nhiên URL-safe, không commit.
docker compose --profile local-db -f docker-compose.yml -f compose.local-postgres.yml up -d --build
```

Override này chỉ trỏ backend tới service postgres local với database/user `doan_local`, không Supabase. Giữ volume cũ, không down -v/reset. Compose chỉ `--profile local-db` mà không override không đổi đích backend; dùng đầy đủ lệnh trên.

CI giữ service PostgreSQL16 riêng `doan_test`, đặt DATABASE_URL và DIRECT_URL bằng URL của CI, không dùng secret Supabase nhóm. CI test JWT là fixture riêng. Test tooling local Docker PR2 vẫn được giữ và cập nhật DIRECT_URL cho replay; không trỏ tooling đó vào DB chung.

Docker chưa có trên PATH, nên build image/compose execution chưa được kiểm thực tế. Việc sửa context nhằm dùng pnpm monorepo và không copy env vào image; không khẳng định container đã chạy.

## Kiểm tra DB chỉ đọc

```powershell
pnpm --filter @doan/backend db:inspect
```

Script `shared-database.cjs` đọc backend/.env + process env, yêu cầu DB_INSPECT_HOST khớp DIRECT_URL, Supabase TLS; không nhận SQL từ CLI. Toàn bộ SELECT chạy trong transaction READ ONLY, statement timeout 5 giây, transaction tối đa 60 giây. Chỉ lấy:

- Identity database/role/version và read_only flag.
- Danh sách bảng, cấu trúc cột public và constraint public.
- Count từng bảng ứng dụng (không đọc contents/password/token/source).
- Migration history không lấy cột logs; null nếu không có `_prisma_migrations`.
- Diagnostic duplicate/orphan/cross-term từ catalogue đã có; skip rõ nếu bảng ứng dụng chưa tồn tại.

Không dùng `prisma db pull` ghi đè schema; không seed/repair dữ liệu hoặc baseline history tự động. Query lỗi/timeout rollback read transaction, không có write. Lỗi được phân loại/redact, không in URL/credential/stack.

Kết quả lần kiểm tra trong lượt này: **FAIL kết nối, DNS ENOTFOUND** với hostname direct do người dùng cung cấp; kiểm DNS bằng Node ngoài sandbox cũng ENOTFOUND. Chưa có identity/catalog/count/history thật; không kết luận DB trống hoặc migration đã áp. Cần người dùng kiểm project đang hoạt động và cập nhật URL hiện tại từ Dashboard; không tự đoán nguyên nhân là password, pause project hoặc IPv6 khi chưa có bằng chứng.

## Migration có kiểm soát — chưa thực thi

- `make migrate`: chỉ in hướng dẫn inspect/review, **không DDL**, không db push.
- `make migrate-dev` và `make reset-db`: chỉ báo vô hiệu hóa với DB chung, không thay dữ liệu.
- Deploy sau backup, kiểm history, review SQL và phê duyệt đích cụ thể: `make migrate-deploy APPROVED_TARGET=host/database`; ngoài CLI target, phải chủ động đặt `ALLOW_DATABASE_MIGRATION=host/database` trong môi trường của đúng lượt chạy. Không lưu cờ này mặc định trong env example/local được tạo.
- Script db:deploy kiểm hai gate cùng host/database của DIRECT_URL, chạy inspection trước; public tables có sẵn mà không có Prisma history thì từ chối, cần reconciliation/baseline review. Gate không thay công việc backup/test/approval và không phải lời xác nhận migration an toàn.
- History có migration failed/rolled-back, không có SQL tương ứng hoặc checksum lệch cũng bị từ chối; không tự resolve/sửa history.
- CI không dùng script deploy shared, vẫn migrate deploy lên DB test CI riêng. Không chạy hai cây SQL song song, không sửa 0_init hoặc dùng resolve để che drift.

Lượt này **không chạy db:deploy/make migrate-deploy**. Phase expand/cutover PR2B và business bước 4–8 chưa triển khai. Giữ Topic.proposals[], Student.proposal và Proposal.studentId unique hiện tại.

## Validation và phần còn chặn

| Kiểm tra | Kết quả thực tế |
|---|---|
| Prisma validate/generate | PASS trên schema hiện tại với datasource directUrl; không DDL |
| Type-check backend/frontend | PASS |
| Lint backend/frontend | PASS |
| Backend unit tests | PASS 8 test, gồm 3 test env và regression assignment/score |
| Database tooling guards | PASS 8 test, gồm host pin/TLS, hai gate deploy và history mismatch |
| Frontend unit tests | PASS 3 test |
| Backend build/frontend build | PASS; frontend có warning Vite CJS deprecation, không nâng dependency |
| Frontend config negative checks | PASS: từ chối API URL không HTTP(S) và biến VITE chứa secret |
| Compose YAML parse và cấu trúc profile/override | PASS bằng js-yaml đã có trong dependency ESLint; parser Python yaml không có nên không dùng kết quả Python làm validation |
| Docker build/run | NOT RUN: Docker chưa có trong môi trường |
| Shared Supabase inspection | FAIL P1001, DNS lookup ngoài sandbox ENOTFOUND; không có kết quả catalog/count/history |
| Migration/seed/DDL lên Supabase | NOT RUN; không thuộc thao tác được thực thi trong lượt này |

Cần cập nhật connection URL và DB_INSPECT_HOST hiện hành trong backend/.env từ Dashboard để hoàn thành bước chỉ đọc. Không cần gửi secret qua chat. Việc chưa kết nối được không là lý do tạo migration/khởi tạo bảng tự động. Credentials local không được đưa vào source; root .env, backend/.env, frontend/.env.local và config test local vẫn bị Git bỏ qua.

Sau khi người dùng báo đã cập nhật env: validate chạy lại PASS, inspection chạy lại vẫn P1001. Kiểm metadata (không credential) cho thấy DIRECT_URL vẫn dùng direct host `db.zlsygwjskvxgtzdjhvzt.supabase.co:5432/postgres`, TLS require. OS DNS lookup host này ENOTFOUND trong khi supabase.com/example.com resolve được. Thử resolver A/AAAA riêng trả ECONNREFUSED nên chưa thể khẳng định project không có DNS record hoặc kết luận nguyên nhân IPv6. Bước tiếp theo là kiểm Dashboard và dùng URL Session pooler được Dashboard cung cấp nếu direct endpoint không khả dụng từ mạng máy này; không tự suy region/hostname/user pooler, không ghi đè env người dùng vừa sửa.

Các file thay đổi trong lượt: root env example, README, Makefile, Docker Compose/profile override, hai Dockerfile và dockerignore; backend env example/config validator + tests/AppModule, Prisma datasource, shared inspection/deploy script + guard tests/package scripts; frontend env example/Vite config; CI env cho DB test riêng; cập nhật test-local replay để DIRECT_URL vẫn trỏ test. Tài liệu này ghi kết quả. Không sửa DOCX, nghiệp vụ, relations/models Prisma hoặc migration 0_init; không stage/commit/push.

Kiểm cuối: `git diff --check` không có lỗi whitespace; chỉ có cảnh báo LF/CRLF của máy. So schema với HEAD sau khi loại đúng một dòng directUrl cho kết quả bằng nhau, xác nhận mọi model/relation còn nguyên. Inventory vẫn một migration 0_init; DOCX checksum không đổi. Quét file source mới/sửa không thấy giá trị credential từ backend/.env hoặc Supabase secret key thật. Các file local chứa secret được Git bỏ qua.

## Cập nhật: Session pooler đã kết nối thành công

Sau khi người dùng cung cấp hostname `aws-0-ap-northeast-1.pooler.supabase.com`, port 5432, database postgres và username pooler của project, đã cập nhật DATABASE_URL/DIRECT_URL/DB_INSPECT_HOST trong backend/.env ignored, giữ nguyên password local, không in credential. Không thay source connection mặc định thành host cố định của nhóm.

Kết quả thực tế chạy lại:

- Prisma validate: PASS.
- `db:inspect`: PASS, transaction_read_only=`on`, database=`postgres`, role=`postgres`, PostgreSQL **17.11**.
- Không thấy base table trong schema public; columns/constraints public rỗng theo catalog trả về. Không có bảng ứng dụng hay `_prisma_migrations` trong public (`migrations=null`).
- Có các bảng hệ thống Supabase thuộc auth/realtime/storage/vault; chỉ liệt kê metadata, không đọc nội dung các bảng này. Không gọi toàn bộ instance là database trống.
- Cả 12 diagnostic nghiệp vụ **SKIPPED** vì chưa có bảng ứng dụng; không báo PASS cho duplicate/orphan/cross-term.
- Không DDL, migration, seed, backfill hoặc repair đã chạy.

Kết quả này thay thế trạng thái kết nối thất bại ở các mục lịch sử trên. Supabase nhóm đang PostgreSQL17 trong khi CI/test Compose dùng PostgreSQL16: cần rehearsal migration với phiên bản tương ứng trước áp DDL vào DB chung. Kết nối thành công không tự cấp phép khởi tạo 0_init hoặc áp PR2B; tiếp tục theo quy trình review/migration được người dùng duyệt, giữ nguyên bảng hệ thống Supabase.
