# Tạo database Supabase và kết nối dự án bước 1–8

Ngày 29/10/2026, đối chiếu code hiện tại. Các lệnh ghi database bên dưới chỉ chạy cho đúng môi trường và phạm vi đã được người phụ trách duyệt.

**Cập nhật sau triển khai:** người phụ trách đã chạy SQL tương thích UUID, áp dụng đủ 13 migration (`db:status`: up to date) và chạy seed nền thành công trên Project1. Sau đó đã thêm 10 SV (`221000001`–`221000010`, mật khẩu ban đầu là mã SV) và 5 GV (`gv000001`–`gv000005`, mật khẩu ban đầu `Demo@2026`) cùng hồ sơ và role tương ứng. Đây là dữ liệu kiểm thử. Các bước khởi tạo bên dưới dành cho database mới, không chạy lại trên Project1 hiện tại; thành viên lấy code không cần migrate/seed lại. Backend dùng chung, truy cập mạng riêng và Supabase Storage chưa hoàn tất.

Script tạo tài khoản mẫu: `backend/scripts/seed-shared-test-users.cjs`. Mặc định chỉ kiểm tra READ ONLY; chế độ `--apply --project-ref zlsygwjskvxgtzdjhvzt` ghi đúng 15 tài khoản khi chưa tồn tại và từ chối ghi đè/reset mật khẩu. Trên Project1 đã có các tài khoản này nên script sẽ dừng, không tạo bản sao. Script này không tạo đợt, roster hoặc phân công.

## Phân biệt ba việc

1. **Tạo cấu trúc database:** dùng toàn bộ 13 migration trong repository. Không tự tạo bảng bằng Table Editor hoặc chép lại các SQL lịch sử trong `database/`.
2. **Khởi tạo nền:** script seed hiện có chỉ tạo roles/permissions, danh mục nền, kỳ học và một tài khoản admin. Đây chưa phải dữ liệu nghiệp vụ để thử đủ 1–8.
3. **Dùng đủ quy trình:** cần tạo user/đợt/roster/phân công và bổ sung các cấu hình producer liệt kê ở mục 8. Hiện chưa có seed Supabase đầy đủ 1–8 hoặc adapter Supabase Storage dùng được trong code. Không mô tả hai phần này là đã sẵn sàng chỉ nhờ migrate thành công.

## 1. Chọn project và cách kết nối

Nhóm đã chọn Project1, ref `zlsygwjskvxgtzdjhvzt`, region `ap-northeast-1`. Vào đúng project trên Supabase Dashboard, mở **Connect**, chọn URL PostgreSQL **Session pooler, cổng 5432** cho máy Windows cần IPv4. Sao chép URL từ Dashboard, không tự suy hostname. Dùng mật khẩu database, không dùng anon/publishable/service-role key làm mật khẩu PostgreSQL.

Backend NestJS → Prisma → PostgreSQL. React chỉ gọi NestJS. Không cần đưa Supabase Auth vào luồng đăng nhập hiện tại.

Nếu project chỉ dùng Prisma cho dữ liệu, tắt **Data API** trong phần cấu hình API của project theo tài liệu Supabase. Các migration có thu hồi quyền trên bảng ứng dụng, nhưng vẫn cần kiểm chính sách truy cập của project để tránh đường truy cập bỏ qua NestJS. Nếu project có ứng dụng khác đang dùng Data API thì phải thống nhất trước khi tắt.

Nguồn chính thức: [kết nối PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres), [Prisma với Supabase](https://supabase.com/docs/guides/database/prisma), [bảo vệ Data API](https://supabase.com/docs/guides/api/securing-your-api). Dự án đang dùng Prisma 5.x theo lockfile: không áp cấu hình Prisma mới hoặc nâng phiên bản CLI trong lúc thiết lập.

## 2. Chuẩn bị máy và cấu hình

Mở PowerShell mới tại repo, dùng Node >=20 và pnpm phù hợp lockfile:

```powershell
cd D:\Project1\BTL
pnpm install --frozen-lockfile
pnpm setup:dev
```

`setup:dev` giữ file env đã có; không kết nối/migrate DB. Không chép đè backend/.env nếu đang chứa credential thật. Kiểm tra và sửa trực tiếp file đó.

Mẫu cấu hình PostgreSQL, thay các placeholder bằng giá trị Dashboard:

```dotenv
DATABASE_URL=postgresql://postgres.zlsygwjskvxgtzdjhvzt:MAT_KHAU_DA_URL_ENCODE@HOST_SESSION_POOLER:5432/postgres?sslmode=require
DIRECT_URL=postgresql://postgres.zlsygwjskvxgtzdjhvzt:MAT_KHAU_DA_URL_ENCODE@HOST_SESSION_POOLER:5432/postgres?sslmode=require
DB_INSPECT_HOST=HOST_SESSION_POOLER
JWT_SECRET=CHUOI_NGAU_NHIEN_RIENG_DU_DAI
JWT_REFRESH_SECRET=CHUOI_NGAU_NHIEN_KHAC_DU_DAI
NODE_ENV=development
PORT=3000
API_PREFIX=api
FRONTEND_URL=http://127.0.0.1:5173,http://localhost:5173
EMAIL_WORKER_ENABLED=false
```

DATABASE_URL và DIRECT_URL có thể cùng dùng session pooler trong thiết lập Windows này. DIRECT_URL phải là kết nối phù hợp migration, không dùng transaction pooler 6543 cho bước đó. Với URL đã có query, nối tham số bằng `&`, không thêm dấu `?` thứ hai. Password có `@`, `#`, `:`… phải URL-encode **phần password**, không encode toàn bộ URL.

Giữ các cấu hình khác từ backend/.env.example. Hai JWT secret phải khác nhau; có thể sinh từng chuỗi bằng lệnh sau và tự điền cục bộ, không gửi vào chat:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Sửa `frontend/.env.local`:

```dotenv
VITE_API_URL=http://127.0.0.1:3000/api
VITE_AUTH_API=true
VITE_TERM_API=true
VITE_CATALOG_API=true
VITE_IMPORT_API=true
VITE_REGISTRATION_API=true
VITE_DEMO_MODE=false
```

Không đưa database URL hoặc secret vào VITE_*. Khi đổi env frontend phải khởi động lại Vite. File env thật không commit.

Để terminal này đọc đúng backend/.env, bỏ các biến DB kế thừa từ phiên local/test nếu có:

```powershell
Remove-Item Env:DATABASE_URL,Env:DIRECT_URL,Env:DB_INSPECT_HOST -ErrorAction SilentlyContinue
```

Không chạy lệnh xóa env này trên một môi trường chủ ý quản lý credential bằng process env; hướng dẫn đang áp dụng cho máy Windows đọc file backend/.env.

## 3. Kiểm tra chỉ đọc trước khi tạo bảng

```powershell
pnpm --filter @doan/backend prisma validate
pnpm --filter @doan/backend prisma generate
pnpm --filter @doan/backend db:inspect
```

Nếu `prisma generate` báo `EPERM ... rename ... query_engine-windows.dll.node`, kiểm tra backend NestJS/test worker đang giữ DLL Prisma. Dừng đúng phiên backend bằng Ctrl+C trong terminal đã chạy nó, chờ tiến trình kết thúc rồi chạy lại `prisma generate`. Nếu backend chạy nền, xác minh PID và command line thuộc dự án trước khi dừng cả watcher lẫn tiến trình backend con để tránh watcher khởi động lại. Không tắt toàn bộ Node hoặc xóa node_modules chỉ vì lỗi này. Đây là lỗi file cục bộ; không phải bằng chứng Supabase mất kết nối. Tham khảo [issue Prisma về EPERM trên Windows](https://github.com/prisma/orm/issues/20090).

Kết quả phải đúng host/database và identity; transaction phải ở READ ONLY. Lần kiểm tra trước public chưa có bảng ứng dụng/history, nhưng cần kiểm lại tại thời điểm triển khai. Các bảng auth/storage/realtime của Supabase không phải bảng ứng dụng và không cần xóa.

Chỉ tiếp tục luồng **khởi tạo mới** khi public chưa có bảng ứng dụng và chưa có history. Nếu public có bảng nhưng không có `_prisma_migrations`, hoặc có migration failed/checksum khác: dừng để đối soát; không `db push`, reset hoặc đánh dấu đã apply theo phỏng đoán. Nếu DB đã có history hợp lệ, dùng quy trình cập nhật và backup thay cho khởi tạo mới.

### Kiểm tra UUID trước migration đầu

`0_init` dùng `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` rồi gọi `uuid_generate_v4()` không kèm schema. Extension đã được Supabase cài ở schema khác có thể khiến hàm này không được tìm thấy trong ngữ cảnh migration. Chạy đoạn **chỉ đọc** sau trong SQL Editor, chọn role `postgres`, để kiểm tra khả năng phân giải với search_path chỉ có public:

```sql
BEGIN READ ONLY;
SET LOCAL search_path TO public;
SELECT e.extname, n.nspname AS extension_schema
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'uuid-ossp';
SELECT current_setting('search_path') AS search_path,
       to_regprocedure('uuid_generate_v4()')::text AS uuid_function;
ROLLBACK;
```

Nếu extension đã tồn tại nhưng `uuid_function` là NULL, **dừng trước mục 4**: cần chuẩn bị cách tương thích extension cho chuỗi migration, thử trên DB riêng và review trước khi áp dụng. Không tự chuyển schema extension, sửa migration lịch sử hoặc chạy lại sau một lần lỗi. Nếu extension chưa tồn tại, `0_init` dự kiến sẽ tạo nó; vẫn cần kiểm tra quyền tạo extension. Kết quả kiểm tra UUID hợp lệ chỉ xác nhận điều kiện này, không bảo đảm toàn bộ migration đã được thử trên Supabase. Xem [tài liệu UUID của Supabase](https://supabase.com/docs/guides/database/extensions/uuid-ossp).

Ngày 29/10/2026 đã kiểm tra Project1 bằng transaction READ ONLY: `uuid-ossp` nằm trong `extensions`, có `extensions.uuid_generate_v4()`, không có `public.uuid_generate_v4()` và public chưa có bảng. Vì vậy không chạy migration trực tiếp ở trạng thái này.

Phương án đã chuẩn bị để review: [SQL tương thích UUID](sql/supabase-uuid-compat.sql). File tạo **một hàm chuyển tiếp** `public.uuid_generate_v4()` gọi `extensions.uuid_generate_v4()`, giữ nguyên extension và nội dung 13 migration. Hàm dùng quyền người gọi, cố định search_path, thu hồi quyền EXECUTE của PUBLIC và các role Data API thông dụng. Nó dành cho kết nối backend/migration hiện tại bằng `postgres`; nếu đổi sang role backend riêng, cần review và cấp EXECUTE cho đúng role đó. Không xóa hàm sau migrate vì default của các bảng có thể phụ thuộc nó.

**Đây là SQL ghi schema, chưa được áp dụng lên Supabase.** Chỉ chạy sau khi người phụ trách xác nhận. Mở đúng Project1, chọn role `postgres`, chạy nguyên file trong một lần; nếu guard báo lỗi thì dừng đối soát. File từ chối khi public đã có bảng hoặc hàm cùng tên, không ghi đè hàm. Sau khi thành công, chạy lại kiểm tra chỉ đọc ở trên: `uuid_function` phải không còn NULL; rồi mới thực hiện mục 4 theo phạm vi đã được duyệt.

Đã thử phương án trên database PostgreSQL 17 local riêng tại `127.0.0.1:55451`, tái tạo extension trong schema `extensions`: toàn bộ 13 migration thành công, insert thử dùng default UUID thành công, không cấp EXECUTE cho PUBLIC, và script từ chối chạy lại sau migration. Bằng chứng local: `.cache/supabase-uuid-compat-rehearsal.json`. Kết quả này chưa thay cho nghiệm thu trực tiếp trên Supabase. Cách khai báo quyền hàm dựa trên [CREATE FUNCTION của PostgreSQL 17](https://www.postgresql.org/docs/17/sql-createfunction.html).

## 4. Áp toàn bộ migration — có ghi schema

Chỉ thực hiện mục này sau khi nhóm đã duyệt đúng project/credential, review SQL và có phương án backup nếu project chứa dữ liệu cần giữ.

Repo có **13 migration** từ `0_init` đến `202610280001_proposal_lifecycle`. Chạy trọn chuỗi một lần trước seed. Migration `202610210001_empty_baseline_bridge` yêu cầu bảng ứng dụng rỗng; seed giữa chuỗi sẽ làm bridge bị chặn. Baseline có cả bảng cho giai đoạn sau, không tự bỏ migration chỉ để giữ riêng bước 1–8.

Gate deploy dùng `host/database`, lấy **đúng target** được in bởi db:inspect. Với session pooler đã kiểm tra trước đó, target có dạng:

```powershell
$taskDbTarget = 'aws-0-ap-northeast-1.pooler.supabase.com/postgres'
$env:ALLOW_DATABASE_MIGRATION = $taskDbTarget
try {
    node backend/scripts/shared-database.cjs deploy --target $taskDbTarget
    if ($LASTEXITCODE -ne 0) { throw 'Migration failed. Stop and inspect history.' }
}
finally {
    Remove-Item Env:ALLOW_DATABASE_MIGRATION -ErrorAction SilentlyContinue
}
```

Thay target nếu Dashboard/inspect cho ra hostname khác. Pooler host/database có thể được nhiều project dùng chung; ngoài target còn phải kiểm username có ref đúng `zlsygwjskvxgtzdjhvzt`. Đây là lệnh tạo/đổi schema, không phải lệnh kiểm tra.

Nếu thất bại, giữ nguyên history/log và kiểm tra lỗi. Không chạy seed, reset hoặc migrate resolve để ép qua. Script deploy chủ ý che raw URL/error; người phụ trách cần kiểm history trong môi trường riêng trước khi retry.

Sau khi thành công:

```powershell
pnpm --filter @doan/backend db:status
pnpm --filter @doan/backend db:inspect
```

Mong đợi: 13 migration của repository đã hoàn tất, không pending/failed; có các bảng ứng dụng trong public. `prisma generate` và `validate` riêng lẻ không tạo bảng.

## 5. Seed nền — có ghi dữ liệu

Chỉ sau khi toàn bộ migration đã thành công, và chỉ với DB tích hợp mới đã duyệt:

```powershell
pnpm --filter @doan/backend db:seed
```

Script hiện tạo 5 role, permissions tương ứng, hệ đào tạo CQ/LT/TX, bộ môn CNPM, 5 hướng nghiên cứu, kỳ 2026–2027/HKI và **duy nhất admin**. Tài khoản ban đầu: `admin` / `Demo@2026`.

Đổi mật khẩu admin trước khi chia sẻ môi trường, sau đó tạo tài khoản riêng theo vai trò. Đây là fixture kiểm thử, không phải thông tin đăng nhập để vận hành lâu dài. Seed có thể cập nhật trạng thái/tên user đã có, nên không coi việc chạy lại là thao tác vô hại trên DB đang được sử dụng. Không có sẵn giaovu/gv001/sv001 chỉ nhờ lệnh này.

Có thể kiểm tra trong Supabase SQL Editor bằng SELECT:

```sql
SELECT migration_name, finished_at, rolled_back_at
FROM public."_prisma_migrations"
ORDER BY migration_name;

SELECT username, status FROM public."USER_ACCOUNT";
SELECT name FROM public."ROLE" ORDER BY name;
```

Không dùng bảng auth.users của Supabase để tạo user ứng dụng; app dùng USER_ACCOUNT và mật khẩu băm của NestJS.

## 6. Khởi động dự án bằng database Supabase

Trước tiên dừng các terminal `ui:dev`/`dev:local` đang giữ cổng 3000/5173. Nếu server chạy nền, xác định đúng PID và command line rồi mới dừng; không tắt toàn bộ Node trên máy. `ui:stop` chỉ dừng PostgreSQL UI local, không phải cách dừng mọi watcher frontend/backend.

Mở terminal PowerShell mới ở thư mục gốc, kiểm env đúng như mục 2, rồi:

```powershell
pnpm dev
```

Truy cập:

- UI: http://127.0.0.1:5173/login
- API: http://127.0.0.1:3000/api
- Swagger dev: http://127.0.0.1:3000/api/docs
- Health: http://127.0.0.1:3000/api/health

Đăng nhập admin và kiểm tra dữ liệu trong Supabase thay đổi khi tạo bản ghi. Health OK chỉ chứng minh server phản hồi; không thay kiểm tra DB và quyền.

**Không dùng** `pnpm ui:dev`, `ui:prepare`, `ui:sample`, `ui:workflow` hoặc `dev:local` cho bước này: chúng phục vụ DB local/fixture riêng, không phải bộ khởi tạo Supabase. Không chạy test fixture integration lên DB nhóm.

## 7. Trình tự dữ liệu nghiệp vụ 1–8

| Bước | Người thao tác | Dữ liệu cần có / kết quả |
| --- | --- | --- |
| 1 | Admin, giáo vụ | Tạo tài khoản giáo vụ/GV/SV, liên kết hồ sơ; danh mục, kỳ học, đợt, lịch, roster và chỉ tiêu |
| 2 | SV | Hồ sơ đủ điều kiện trong đợt; gửi hướng đề tài và nguyện vọng |
| 3 | Giáo vụ, GVHD, SV | Phân công/công bố/chốt chính thức; thống nhất đề tài và chuẩn bị đầu vào workflow |
| 4 | Giáo vụ | Có grant, routing và roster hợp lệ; tạo nhóm duyệt/thành viên |
| 5 | Giáo vụ, GV nhóm | SV đã gửi một phiên bản hợp lệ; phân nhóm, bắt đầu, nhận xét, kết luận |
| 6 | SV, GVHD theo quyền | Sửa theo góp ý, lưu phiên bản mới, gửi lại; giữ lịch sử |
| 7 | Giáo vụ, SV | Đúng bản được duyệt và profile lớp/ngành đã xác nhận; chốt, tải PDF, nhận giấy thực tế |
| 8 | GVHD, SV, giáo vụ | Kế hoạch, nhiệm vụ, báo cáo/source, đánh giá, nhật ký và giám sát nghĩa vụ tuần |

Chi tiết bấm trên UI: [hướng dẫn user bước 4–8](user-guide-steps4-8.md). Không chỉ đổi enum status trong Table Editor để giả lập quy trình đã hoàn tất.

## 8. Phần còn thiếu để thử trọn vẹn trên Supabase mới

Schema có đủ bảng không có nghĩa các đầu vào sau tự xuất hiện. Code hiện chưa có seed Supabase đầy đủ cho chúng; một phần cũng chưa có màn quản trị producer:

| Cấu hình | Model/bảng liên quan | Nếu thiếu |
| --- | --- | --- |
| Quyền giáo vụ trên đợt/bộ môn | AcademicTermGrant, GrantDepartment | Không thấy hoặc không quản lý được đợt/nhóm/hồ sơ |
| Hướng đề tài thuộc bộ môn | ResearchAreaWorkflow | Không định tuyến hoặc phân nhóm/chốt được |
| Ánh xạ phase của workflow | TermPhaseWorkflow: PROPOSAL_EDIT, PROPOSAL_REVIEW, GUIDANCE | Có lịch hiển thị nhưng backend vẫn báo thiếu phase |
| Phân công chính thức/ownership | TermWorkflow, AssignmentPlanWorkflow, TopicWorkflow và các bản ghi nguồn | Không xác định được owner/GVHD hoặc đầu vào chưa bàn giao |
| Lớp/ngành được xác nhận | DossierStudentProfile theo TermStudent | Không chốt hồ sơ bước 7 |
| Lịch hướng dẫn, đối tượng, nghĩa vụ tuần | GuidancePeriod, PeriodRequiredStudent, WeeklyReportObligation và configSnapshot hợp lệ | Không tạo đúng nhiệm vụ tuần/không thống kê đủ nghĩa vụ |

Để hoàn chỉnh, cần bổ sung **một script khởi tạo môi trường tích hợp Supabase có target guard**, kiểm project/history, tạo dữ liệu giả lập riêng, không ghi đè bản ghi người dùng và dùng contract/API nghiệp vụ cho chuyển trạng thái. Hoặc hoàn thiện UI/API quản trị các đầu vào còn thiếu rồi nhập qua đó.

Hiện không có lệnh `supabase:seed:steps1-8` tương đương trong package.json. Các script seed UI local có ví dụ cấu hình producer để tham khảo nhưng hardcode DB local và fixture; không thay URL để bỏ guard rồi chạy thẳng vào Supabase. Tài liệu không thể thay phần code khởi tạo còn thiếu này bằng một lệnh có sẵn.

## 9. File Storage và nhóm ba người

Theo yêu cầu kiến trúc trước đó, file cuối cùng phải ở Supabase Storage. Code hiện vẫn ghi bài nộp/source xuống Windows và giữ PDF chính thức dạng byte trong database. **Tạo bucket hoặc thêm env Storage chưa làm app tự dùng bucket.** Cần triển khai adapter upload/read/delete riêng tư và đường lưu PDF, giữ kiểm JWT/scope/owner, trước khi nghiệm thu yêu cầu này.

Trong lúc đó database Supabase có thể kết nối để kiểm bước nhập liệu, nhưng không gọi đó là hệ thống 1–8 dùng chung hoàn chỉnh theo kiến trúc đã chọn. Cấu hình chia sẻ Windows qua mạng riêng là một việc riêng; chưa công bố backend. Xem [đề xuất Windows + Supabase](windows-supabase-shared-proposal.md).

Tiêu chí hoàn tất: hai máy thành viên cùng thấy một bản ghi/đợt sau reload, đúng phân quyền; các thao tác 4–8 không thiếu producer; file nằm trong bucket private và vẫn tải được sau khi restart backend mà không cần uploads Windows; mật khẩu demo đã đổi; không có secret trong frontend/Git.
