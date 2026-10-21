# PR2A — Database stabilization report

Ngày 21/10/2026. **Đã gỡ lỗi Prisma generate và chuẩn bị môi trường/công cụ test. Chưa tạo được PostgreSQL test trên máy, chưa đủ điều kiện tạo migration PR2B. Không bắt đầu PR3 hoặc nghiệp vụ bước 4–8.**

Nguồn: [audit 00](00-repository-audit.md), [baseline PR1 đã duyệt](01-business-decisions-and-contract.md), [kế hoạch PR2](02-prisma-migration-plan.md), schema, manifest/workspace, CI backend, ADR. Chỉ dẫn hiện tại đã phê duyệt expand-only và cho phép sửa cấu hình/công cụ tương thích, thay thế điều kiện xin duyệt rollout cũ của T03. Quyết định nghiệp vụ PR1 giữ nguyên.

## 1. Kết quả T01–T05 và nguyên nhân

| Blocker | Nguyên nhân/bằng chứng đã xác minh | Trạng thái sau lượt này |
|---|---|---|
| T01 — DB test | DATABASE_URL chưa được cung cấp; không thấy PostgreSQL/Docker trong PATH, các thư mục cài đặt phổ biến hoặc Windows service; thử khởi động công cụ mới báo `Cannot run docker: ENOENT` | **Còn chặn môi trường.** Có Compose/config/script test riêng; chưa có DB hoạt động, chưa có catalog/history/diagnostic live |
| T02 — drift | Source SQL V001–V010 khớp 0_init; SQL với Prisma khác enum/VARCHAR, timestamp/native type/default/nullability/FK/onDelete như PR2 §2 | **Chưa giải quyết live.** Không có DB test để replay/introspect. Không sửa toàn bộ schema/type hoặc history để che drift |
| T03 — compatibility | Topic.proposals[] và Student.proposal dựa unique studentId hiện hữu; raw Prisma result làm scalar mới có thể lọt API | **Đã giải quyết về phê duyệt chiến lược:** user yêu cầu giữ relations/unique/fields hiện tại trong expand. Thực thi schema/API compatibility còn phải kiểm khi PR2B có baseline DB; chưa đổi cardinality hoặc shape API |
| T04 — backfill | Schema cũ không chứa đủ ownership/agreement/actor/version/receipt/routing/applicability/criteria; isPassed=false không phân biệt FAIL/cần sửa | **Còn dependency dữ liệu.** Empty test mới cũng không chứng minh dữ liệu legacy sạch. Không map giả, không seal/finalize/receipt/assign/file READY giả |
| T05 — generate EPERM | Trong sandbox, `child_process.spawnSync(process.execPath,['--version'])` và cả cmd.exe đều EPERM; cùng Node binary ngoài sandbox spawn thành công; `prisma generate` ngoài sandbox thành công | **Đã giải quyết ở môi trường thực thi phù hợp.** Nguyên nhân tái hiện là giới hạn spawn của sandbox; không có bằng chứng engine hỏng hoặc cần nâng Prisma |

T01 “không tìm thấy” là kết quả phạm vi kiểm tra, không khẳng định máy không thể có PostgreSQL cài ở vị trí tùy chỉnh. Nếu có sẵn Docker/PostgreSQL ngoài PATH, mở terminal có PATH đúng và báo vị trí; không trỏ công cụ test vào database dùng chung.

## 2. Prisma/Node/pnpm và điều tra Windows

- Node thực tế `v24.13.1`, pnpm `12.14.0`; CI dùng Node 20/pnpm 9. Manifest Node>=20/pnpm>=9; Prisma CLI và @prisma/client đều `5.22.0`, không lệch phiên bản đôi client/CLI.
- Kiểm tra launcher `backend/node_modules/.bin/prisma.cmd` trỏ đúng Prisma trong pnpm store của workspace; resolve `prisma/build/index.js` thành công. Engines không phải dependency trực tiếp ở `backend/node_modules/@prisma/engines`, nên việc path trực tiếp đó không tồn tại không chứng minh thiếu engine trong pnpm store.
- Cả Node→Node và Node→cmd bị EPERM trong sandbox trước khi liên quan model/DB. Ngoài sandbox Node→Node trả exit 0; Prisma sinh client v5.22.0 thành công vào `node_modules/.pnpm/.../@prisma/client`. Lệnh generate không kết nối DB và không sửa schema.
- Không đổi ACL/antivirus, không Unblock-File, không tắt engine, không đổi generator, không xóa node_modules/cache/lockfile hoặc reinstall. Không nâng dependency để xử lý một lỗi đã chứng minh do spawn restriction.
- Khi agent bị sandbox chặn, chỉ chạy phép kiểm/generate/test bằng công cụ được cấp quyền ngoài sandbox như lượt này. Trên terminal PowerShell của người dùng dùng lệnh bình thường; không cấu hình toàn dự án tự chạy Administrator hoặc tự nâng quyền mọi lệnh.
- Để tái hiện CI, dùng Node 20 và pnpm 9 theo cấu hình CI trong môi trường riêng; lượt này chưa cài/chuyển runtime và không khẳng định đã test trên Node 20. Node 24/pnpm 12 không được xác định là nguyên nhân EPERM vì cùng runtime đã generate/test thành công ngoài sandbox.

## 3. Test environment đã chuẩn bị

### 3.1 Cấu hình tách biệt

- `compose.pr2-test.yml`: project `btl-pr2-test`, service `postgres-test`, container `btl-pr2-postgres-test`, image `postgres:16-alpine`; bind duy nhất `127.0.0.1:55432` tới 5432; named volume `btl-pr2-test_pr2-test-data`. Không dùng root docker-compose.yml, volume/port hoặc DB dev của nhóm.
- Database `doan_pr2_test`, user `btl_pr2_test`; chỉ là đích thiết kế test, **chưa tồn tại/được kết nối thành công trong lượt này**.
- `.env.pr2-test.example` chỉ là mô tả placeholder, không hoạt động như credential. `db:test:init` đã tạo `.env.pr2-test.local` chứa password/token ngẫu nhiên. File được `.gitignore` hiện hữu bỏ qua (`.env.*.local`), không in giá trị, không ghi vào báo cáo, không overwrite file có sẵn.
- `backend/scripts/database-test.cjs` không đọc DATABASE_URL để chọn đích; URL được xây từ cấu hình local do init sinh, fixed loopback/port/database/user. Root .env.example dev được giữ nguyên, không đưa secret test vào file dùng chung.
- Không có `down -v`, reset/drop/delete hoặc lệnh dọn volume tự động. Khởi động lại cùng config giữ test data; nếu mất config hoặc nhãn không khớp phải dừng, không nhận một container cũ làm đích mới.

### 3.2 Guard và chức năng script

| Command từ root | Tác dụng | Giới hạn |
|---|---|---|
| `pnpm --filter @doan/backend db:test:init` | Sinh password/token trong ignored local config, mở file bằng wx | Đã chạy; chạy lại sẽ từ chối ghi đè, không cần chạy lại trên máy này |
| `pnpm --filter @doan/backend db:test:up` | Chỉ Docker local socket; kiểm container trùng tên/nhãn; Compose up --wait DB test | Đã thử: Docker ENOENT. Không chạy migration khi up |
| `pnpm --filter @doan/backend db:test:status` | Kiểm project/service/instance token/image/loopback binding; kết nối bằng Prisma và kiểm database/user/PostgreSQL16, đọc migration history | Chưa chạy đến DB; không nhận URL tùy ý |
| `pnpm --filter @doan/backend db:test:replay` | Cùng guard, kiểm checksum/history; chỉ migrate deploy ở đích test do script xác nhận | Chưa chạy. DB không có history nhưng có bảng bị từ chối; unknown/failed/rolled-back/checksum mismatch bị từ chối, không tự resolve |
| `pnpm --filter @doan/backend db:test:diagnose` | Xác minh history, chạy 12 check SELECT trong transaction READ ONLY; chỉ counts/distributions, không dump content/token/password | Chưa có DB để chạy; violations>0 exit 2; không vi phạm chỉ trên dataset test không thay legacy audit |
| `pnpm --filter @doan/backend test:database-tools` | Node built-in tests cho config/đích/container ownership/secret redaction/read-only SELECT catalogue | 5 test đã pass, không chứng minh Docker/replay integration pass |

Config parser từ chối unknown/duplicate keys, placeholder, thiếu giá trị. Script từ chối remote Docker endpoint, container không đúng project/service/token/image hoặc bind không loopback:55432. Trước replay kiểm identity và history; URL chỉ qua môi trường của child Prisma, không command-line/log. Error bị redact connection URL/password/token. Đây là guard chống dùng nhầm đích; không thay quyền truy cập OS/Docker của người dùng.

Replay áp các migration hiện có trong cây Prisma, không sinh migration và không gọi db push/reset. Sau này phải review migration mới/backup/test plan trước dùng replay; command không tự chứng minh DDL an toàn hoặc đồng bộ baseline. Không chạy file SQL lịch sử song song với Prisma deploy.

Diagnostic tại `backend/scripts/sql/pr2-diagnostics.sql` kiểm duplicate Topic/Proposal owner, missing TermStudent/orphan, nhiều Topic/SV/đợt, assignment cross-term/ngoài roster, nhiều FINALIZED plans, review cross-term/member ngoài roster, duplicate version và phân phối legacy isPassed/proposal/dossier status. Các diagnostic không suy ownership/approval/receipt hoặc convert false. Chưa thay thế full catalog diff, storage inventory, mọi FK hoặc kiểm legacy fixture đại diện nêu PR2.

## 4. Bước thủ công cần người dùng thực hiện

**Dừng phần tạo/kết nối/replay DB tại bước cài và khởi động Docker Desktop**, do chưa phát hiện Docker/PostgreSQL sẵn có trong môi trường. Không tự cài software hệ thống hoặc đổi cấu hình WSL/virtualization trên máy người dùng.

1. Nếu Docker đã cài, mở Docker Desktop và terminal mới có docker trên PATH. Nếu chưa cài, dùng [hướng dẫn Docker Desktop cho Windows](https://docs.docker.com/desktop/setup/install/windows-install/) và [WSL2 backend](https://docs.docker.com/desktop/features/wsl/); kiểm system requirements và hoàn thành bước WSL/virtualization/restart mà trình cài yêu cầu. Chọn Linux containers cho PostgreSQL image.
2. Trong PowerShell tại `D:\Project1\BTL`, chạy `docker version` và `docker compose version`. Cần thấy Docker daemon hoạt động; CLI tồn tại chưa đủ chứng minh daemon sẵn sàng.
3. Local config đã được tạo trong lượt này; **không copy example và không chạy init ghi đè**. Chạy lần lượt:

```powershell
pnpm --filter @doan/backend db:test:up
pnpm --filter @doan/backend db:test:status
pnpm --filter @doan/backend db:test:replay
pnpm --filter @doan/backend db:test:status
pnpm --filter @doan/backend db:test:diagnose
```

4. Nếu port 55432 đã được dùng, label/token mismatch, DB không empty hoặc history fail: dừng và gửi lỗi đã redact; không đổi URL sang DB nhóm, không xóa volume/reset hoặc mark migration applied để vượt guard.
5. Sau baseline replay, cần thêm fixture/snapshot đã được phép sử dụng và introspection/diff SQL-Prisma để kiểm T02/T04. Các counts bằng 0 trên DB trống không xác nhận legacy backfill an toàn.

Nếu không thể dùng Docker nhưng muốn PostgreSQL Windows riêng, dùng [trang Windows installer chính thức PostgreSQL](https://www.postgresql.org/download/windows/). Cần tạo instance/role/database test tách biệt và xác minh identity/ownership; script hiện **cố ý không nhận arbitrary/native URL**. Báo lại vị trí/cấu hình test để bổ sung adapter có guard riêng trước khi kết nối. Không tự dùng service/database sẵn có chưa được xác nhận là riêng.

## 5. Thay đổi thực tế và rollout compatibility

### Đã làm

- Thêm Compose test, env example riêng, Node test lifecycle tool và SELECT catalogue.
- Thêm script `db:test:init/up/status/replay/diagnose`, `test:database-tools` trong backend/package.json, không thêm dependencies.
- Thêm bước chạy test guard trong backend CI sau generate; không thay database/credential/service hiện hữu của CI, chưa chạy workflow GitHub thực tế.
- Sinh client baseline bằng generate thành công ngoài sandbox; tạo ignored runtime config chứa random secrets, không source-controlled.

### Chưa làm và lý do

- **Không sửa schema, không thêm model/field/constraint hoặc migration mới**: user yêu cầu migration chỉ khi baseline DB test đã xác minh; DB chưa khởi động được. Schema expand chưa có DDL replay tương ứng có thể làm generated client chọn scalar mới trên DB cũ và gây runtime failure ở các GET raw Prisma hiện tại, nên không tạo trạng thái schema đi trước DB khi thiếu test.
- Giữ nguyên Topic.proposals[], Student.proposal, Proposal.studentId unique, ProposalVersion.version, Task.guidancePlanId, enum/timestamp/onDelete và mọi relation bước 1–3/9–10. Không thay response/API hoặc logic nghiệp vụ, không drop/cast/backfill.
- Expand-only đã được phê duyệt nên không hỏi lại chiến lược. PR2B sau môi trường test sẽ thêm nullable/default kỹ thuật hoặc bảng mới, giữ legacy constraints; chỉ bật ghi workflow mới sau dữ liệu/contract producers hợp lệ. Không giả state ACTIVE/SEALED/APPROVED/RECEIVED hoặc file READY.
- Ba kết quả PASS/FAIL/REVISION_REQUIRED và quyết định chung unique/vòng vẫn là mục tiêu schema PR1; không convert isPassed=false. Obligation tuần vẫn phải không phụ thuộc task/plan, không auto-complete.

Phục hồi test: trước replay mới trên dataset có giá trị, lấy backup test ngoài repository bằng công cụ PostgreSQL và ghi nhận history/checksum, giữ volume/config; nếu migration lỗi không chạy reset/drop hoặc sửa 0_init. Dừng, phân tích và dùng corrective forward migration đã review hoặc khôi phục vào instance test mới tách biệt theo kế hoạch được phép. Chưa có DDL mới nên chưa có recovery script giả chưa kiểm chứng.

## 6. Kết quả validation thực tế

| Phép kiểm | Kết quả | Phạm vi |
|---|---|---|
| Node→Node và Node→cmd trong sandbox | FAIL EPERM | Tái hiện lỗi spawn rộng hơn Prisma |
| Node→Node ngoài sandbox | PASS exit 0, Node24 | Chứng minh khác biệt execution permission |
| Prisma generate ngoài sandbox | PASS, generated v5.22.0 | Schema baseline hiện tại, không DB |
| Prisma validate với URL offline placeholder chỉ cho config parsing | PASS | Không dùng làm target test, không kết nối/không tuyên bố DB hoạt động |
| Backend type-check `--incremental false` | PASS | Sau generate baseline, không schema mới |
| `node --check` hai file tool/check | PASS | Syntax của công cụ |
| `test:database-tools` | PASS 5/5 | Fixed URL/config guard, container ownership, redaction, SELECT-only catalogue |
| Backend `pnpm test` lần đầu | FAIL vì Vitest nhặt file Node `database-test.test.cjs`, không thấy suite Vitest | Lỗi do tên bộ test mới, đã sửa thành `.check.cjs`, không sửa test/logic cũ |
| Backend `pnpm test` sau sửa | PASS 2 files/5 tests | Assignment algorithm 2, score aggregator 3; chạy ngoài sandbox |
| Test database tools sau đổi tên | PASS 5/5 | Chạy độc lập bằng Node test runner; tránh Vitest collect nhầm |
| `git check-ignore .env.pr2-test.local` | PASS | Runtime config không bị đưa vào source status |
| `db:test:up` ngoài sandbox | FAIL ENOENT docker | Đã thử thật, không container/database được tạo |
| Migration replay / live history / diagnostics SELECT / DB integration | **NOT RUN** | Thiếu Docker/DB test; unit tool tests không thay replay/integration |
| Backend CI trên GitHub | **NOT RUN** | Chỉ thêm step; CI Node20/pnpm9 chưa được tái hiện local |

## 7. Phối hợp bước 1–3 và tiêu chí tiếp tục PR2B

Sau khi Docker/DB test sẵn sàng, tiếp tục các việc sau, không hỏi lại quyết định nghiệp vụ đã chốt:

1. Replay 0_init vào test riêng, kiểm `_prisma_migrations` và SQL catalog; xác nhận two SQL trees tương đương nhưng chưa có native schema reconciliation. Lưu diagnostic counts và nguồn fixture.
2. Chủ auth/term xác nhận identity/grant theo đợt, phase key/lock revision và cách giữ API projections cũ khi thêm scalar. Chưa thêm field nhạy cảm vào raw responses mà không có compatibility test.
3. Chủ catalog/term cung cấp mapping ResearchArea→Department, roster và periods/applicability do Khoa duyệt; thiếu thì NOT_CONFIGURED, không tự tạo số liệu.
4. Chủ assignment cung cấp official FINALIZED pointer/handover revision/history; bàn giao phải phối hợp pause plan/invalid agreement trong transaction. Không sửa thuật toán bước 3 hoặc tự promote PUBLISHED.
5. Chủ Topic/Proposal xác nhận contract agreement/submittedVersion; expand giữ proposals[]/Student.proposal/unique cũ, cutover cardinality là pha riêng chưa thực hiện.
6. Giữ proposalId/read contracts cho bước 9–10, không đổi công thức/score/checks hoặc điều kiện bảo vệ từ task reviews.
7. Chỉ sinh migration additive mới khi baseline test và ảnh hưởng client đã được kiểm; rehearsal trên baseline trống và dataset đại diện, generate/typecheck/compatibility tests và plan phục hồi đầy đủ. Không xóa hoặc sửa migration đã áp dụng.

**Hiện tại chưa đủ điều kiện thực thi schema/migration PR2B** vì T01/T02 còn mở; T04 vẫn cần dữ liệu/mapping trước backfill/constraint. Có thể tiếp tục ngay sau thao tác Docker thủ công và xác minh DB, không cần xin lại permission cho expand-only đã được user cấp. Nếu xuất hiện thay đổi API/nghiệp vụ ngoài compatibility trực tiếp, lập danh sách và dừng riêng phần đó để duyệt. Chưa PR3, chưa triển khai chức năng bước 4–8.

## 8. Danh sách file và Git

Source/config mới hoặc sửa trong lượt:

- `.github/workflows/backend-ci.yml` — thêm test tooling guard.
- `backend/package.json` — thêm scripts, không dependency/version changes.
- `compose.pr2-test.yml` — PostgreSQL test riêng.
- `.env.pr2-test.example` — reference không secret thật.
- `backend/scripts/database-test.cjs` — tooling lifecycle/guard/diagnostics.
- `backend/scripts/database-test.check.cjs` — Node regression tests guard.
- `backend/scripts/sql/pr2-diagnostics.sql` — SELECT-only diagnostics.
- `docs/implementation/02a-database-stabilization-report.md` — báo cáo này.

Artifact local ngoài source: `.env.pr2-test.local` ignored chứa secret ngẫu nhiên; generated Prisma client trong node_modules ignored. Không in password/token hoặc URL thật trong source/tài liệu. Không tạo database, migration, seed hoặc repair data.

DOCX modified và tài liệu 00/01/02 untracked có sẵn từ trước; giữ nguyên. Cuối lượt kiểm status/diff, đối chiếu checksum schema/0_init/DOCX/tài liệu cũ, không stage/commit/push. Git diff stat không bao gồm file untracked, phải đọc status chi tiết để kiểm đầy đủ.

Kết quả cuối: `git diff --check` không có lỗi whitespace (Git chỉ nhắc chuyển LF/CRLF theo cấu hình máy). SHA256 schema, DOCX, tài liệu 00/01 khớp baseline đã ghi; nội dung 0_init và inventory một migration không đổi. Local links trong báo cáo hợp lệ. Không có source/dependency lockfile nào khác bị đổi; hai file tracked do lượt này sửa là package.json backend và workflow CI, các file mới liệt kê ở trên vẫn untracked.
