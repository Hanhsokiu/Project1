> Current release: production is 27 APPLIED / 0 FAILED, 124 permission definitions, 166 role grants and zero UC17-UC25 policies. Counts, PIDs and commands below document historical stages. Do not repeat applied SQL or migrate resolve. See [current main release handoff](../../../../docs/implementation/B9-B10-MAIN-RELEASE.md). Live JSON evidence is retained locally outside the release commit.

# Thực hiện UC17–UC24 theo từng migration

Đã đưa và triển khai 8 SQL trong **chuỗi Prisma chính thức**, sau 17 migration B1–B8. UC24 dùng bản đã sửa trước lần áp production đầu tiên: parenthesize CASE trong fr_commit_check và so action bằng IS DISTINCT FROM. Bảy SQL còn lại nguyên byte ZIP v2; UC24 giữ hash gốc và hash candidate trong `rehearsal-fixes.json` và `backend/prisma/uc17-24-chain.json`. Hash UC24 đã APPLIED: `6A1F8328747A2780DD9D9BB25A542980113C01C1577EB7CB6D493D626D8E3F70`. Không sửa checksum migration đã áp dụng. Không chạy thêm bản trong prisma/review hoặc schema.diff.sql.

Đã chạy lại trên **PostgreSQL 17.11 Docker mới**, khớp phiên bản Supabase: 25 migrations APPLIED, preflight/postflight từng UC, rollback chèn lỗi cả 8 UC, backup/restore baseline và bản nâng cấp đủ 25 migration, FK/RLS/append-only/legacy và hai-session concurrency PASS. Tìm kiếm Unicode `pg_c_utf8`, HTTP B1–B8 và weekly trước/sau nâng cấp PASS; 25 integration tests B1–B3 PASS trên cả baseline và bản nâng cấp; 913 backend unit tests PASS. Smoke UC17–UC25 kiểm 71 operations (401/403) và 9 options endpoints có đăng nhập. Đây là smoke đọc/phân quyền với write flags tắt; quyền đọc UC24/UC25 dùng fixture local tường minh, không phải phê duyệt mapping production hoặc xác nhận toàn bộ positive business E2E.

**Backup thủ công và restore thật đã PASS**: bản dump database Supabase, roles và metadata được mã hóa ngoài repository; restore vào Docker PG17 cô lập đã đối chiếu dữ liệu, catalog, quyền và 17 migration nền. Phạm vi, vị trí và giới hạn khôi phục ở [MANUAL-RECOVERY.md](MANUAL-RECOVERY.md); không bao gồm file bytes trong Storage hoặc toàn bộ cấu hình nền tảng Supabase.

**Production hoàn tất database: 25 APPLIED / 0 FAILED, đủ checksum, UC24 và toàn bộ UC17–UC24 postflight PASS.** Lượt cuối ngắt đúng một PID được duyệt `1938065`, timestamp đầy đủ `2026-11-09 13:27:05.988797 UTC`, rồi xác minh lại target/quyền/backup/24 checksum trước chỉ deploy UC24. Đối chiếu READ ONLY sau cùng: function fr_commit_check đúng bản đã sửa, trigger/FK/CHECK/RLS catalog PASS, 50 CHECK/FK validated và zero violations trên 15 bảng chịu tác động, 37 indexes valid/ready. Dữ liệu gốc 98 bảng/managed-schema counts giữ nguyên. Không còn migration pending. Pooler giữ khóa ở PID mới `1938848`, backend_start `2026-11-09 13:38:16.640041 UTC`, idle/không transaction; không ngắt PID mới, chỉ theo dõi vận hành riêng. Nghiệp vụ chưa E2E: chưa có policy UC17–UC25, thiếu 11 permission definitions UC24/UC25, dữ liệu hồ sơ/điểm/kết quả trống và chưa xác nhận tài khoản/Render/storage để smoke. Xem [PRODUCTION-SMOKE.md](PRODUCTION-SMOKE.md), [DBA-HANDOFF.md](DBA-HANDOFF.md), `evidence/execution-result.json`; raw cuối: `session24-result.json`, `uc24-final-verification.json`. Không sửa checksum/.env, bật write flags, commit/push.

## Chuẩn bị offline đã chạy được

Từ Project1, Python 3.12+ và dependencies local hiện có:

```powershell
python backend/scripts/prepare-uc17-24.py verify
python backend/scripts/check-uc17-24-offline.py
```

Lệnh thứ hai tạo chặng `.cache/uc17-24-deploy/uc17..uc24/prisma` và một chặng `b1-b8` chỉ chứa 17 prerequisite. Đây là bản sao artifact trong Project1, không phải worktree/checkout/project mới. Schema là bản sao nguyên bytes của canonical schema, không có datamodel riêng hay .env. Mỗi chặng có đúng prefix migration; không chuyển/xóa migration chính thức để giới hạn deploy. `.gitattributes` mới chỉ áp dụng 8 SQL, tắt newline conversion để giữ bytes khi checkout Git; B1–B8 không đổi.

## Lệnh rollout đã dùng — không chạy lại trên Supabase đã đủ 25 migration

**Tất cả 25 migration đã APPLIED. Đoạn dưới lưu lại quy trình lịch sử; không còn chặng pending để thực thi.**

Prisma **5.22.0 local** chạy tất cả pending migrations, không có `migrate deploy --to`. Vì vậy không dùng trực tiếp schema gốc để rollout có checkpoint. Sau khi nhóm duyệt rehearsal + backup/restore + migration login, operator chạy **một UC mỗi lần** bằng prefix tương ứng:

```powershell
$repo = 'E:\Project-Xaydungdoantotnghiep\DATN_Backup\Project1'
$uc = 24  # Lịch sử: UC24 đã APPLIED. Không chạy lại rollout trên Supabase chung.
$approved = Get-Content -LiteralPath '<approved non-secret target JSON>' -Raw | ConvertFrom-Json
$prisma = Join-Path $repo 'backend/node_modules/.bin/prisma.cmd'
$checkpoints = Join-Path $repo 'backend/prisma/deployment/uc17-24'
$stage = Join-Path $repo ".cache/uc17-24-deploy/uc$uc/prisma"

# DBA/secret manager cấp DATABASE_URL và DIRECT_URL trong process environment,
# cùng một session/direct endpoint và migration login. Không sửa .env.
# Đồng thời cấp PGHOST, PGPORT, PGDATABASE, PGUSER, PGSSLMODE=require và
# PGPASSFILE hoặc PGPASSWORD cho psql. Không đưa password/URL vào command/log.
# approved-target.example.json chỉ là mẫu; không dùng REQUIRED/null làm approval.

python "$repo/backend/scripts/prepare-uc17-24.py" verify
if ($LASTEXITCODE -ne 0) { throw 'Migration artifact verification failed' }
python "$repo/backend/scripts/prepare-uc17-24.py" stage --through $uc
if ($LASTEXITCODE -ne 0) { throw 'Stage verification failed' }
python "$repo/backend/scripts/prepare-uc17-24.py" target --host $approved.host --port $approved.port --database $approved.database --user $approved.connectionUser
if ($LASTEXITCODE -ne 0) { throw 'Target settings mismatch' }

$identity = @('-X','--no-password','--set=ON_ERROR_STOP=1',"--set=expected_database=$($approved.database)","--set=expected_role=$($approved.sqlRole)","--set=expected_pg_major=$($approved.postgresMajor)")
& psql @identity --file "$checkpoints/preflight-access.sql"
if ($LASTEXITCODE -ne 0) { throw 'Migration login lacks approved DDL access' }
& psql @identity --file "$checkpoints/uc$uc-preflight.sql"
if ($LASTEXITCODE -ne 0) { throw 'Preflight failed; do not migrate' }

# GATE: nhóm xác nhận backup/restore evidence và rehearsal trước dòng ghi dưới.
# Dừng mọi migration writer khác trong maintenance window; không bật write flags.
Push-Location $stage
try {
  & $prisma migrate deploy --schema schema.prisma
  if ($LASTEXITCODE -ne 0) { throw 'Deploy failed; stop and reconcile history' }
} finally { Pop-Location }

& psql @identity --file "$checkpoints/uc$uc-postflight.sql"
if ($LASTEXITCODE -ne 0) { throw 'Postflight failed; stop before next UC' }
```

Quy trình ghi ở trên đã thực hiện sau rehearsal và backup/restore PASS, qua Supavisor SESSION IPv4 5432; hiện đã xác minh **25 APPLIED / 0 FAILED**, không chạy lại UC17–UC24. `prepare-uc17-24.py target` chỉ so endpoint/options trong memory. `uc17-24-supabase-preflight.cjs` kiểm chứng tại thời điểm còn 17 migration nền; không chạy lại script giả định 17 entries để đánh giá trạng thái hiện tại. Script này không có đường chạy deploy. Supabase session pooler có login `postgres.<ref>` nhưng current_user có thể là `postgres`; không nhầm với Transaction 6543. Không dùng connection string trên command line. Khóa còn ở PID sau UC24 được ghi riêng trong bàn giao DBA, không phải migration pending.

16 checkpoint scripts kiểm tra lịch sử/checksum raw chính xác trước/sau từng UC (17→18→…→25 entries), không chấp nhận failed/rolled-back/unknown history; kiểm tra cột, constraints validated, function body/config (chỉ normalize CRLF của prosrc), trigger binding/events/deferral, indexes, RLS/FK mới. Function bodies xuất hiện như SQL string literals để so catalog, không được EXECUTE. Metadata PASS không chứng minh behavior, quyền runtime hoặc race safety. Nếu lịch sử raw checksum lệch do newline hoặc lỗi cũ, DBA phải điều tra; không sửa checksum, resolve hoặc normalize B1–B8 tự động.

Sau UC24 PASS, history phải đủ 25 entries. Không chạy lại migration.sql bằng psql để “đánh dấu đã chạy”; chỉ Prisma quản lý history. Không dùng migrate dev/db push/reset/seed hay sửa history/checksum. Không rollback UC23 bằng UC22 cũ vì sẽ mất nhánh COMMITTEE_MEMBER. Nếu lỗi trước COMMIT, transaction SQL abort nhưng Prisma có thể lưu failed history; dừng để DBA đối chiếu schema và history. Sau COMMIT, ưu tiên forward-fix hoặc restore theo kế hoạch riêng; không có rollback xóa dữ liệu được phép chạy tự động.

## Backup/restore bắt buộc trước production

Backup thủ công đã thực hiện và restore thật đã PASS; xem `MANUAL-RECOVERY.md` và `evidence/execution-result.json`. Không chạy lại chỉ để thay bằng chứng. Các lệnh dưới là tham chiếu quy trình cho operator, không thay thế helper mã hóa đã dùng. Nhóm/DBA xác nhận phạm vi backup, quyền đọc, vị trí mã hóa ngoài repository, thời điểm restore và maintenance window trước mọi lần khôi phục production:

```powershell
& pg_dump --no-password --format=custom --file $approved.backupFile
if ($LASTEXITCODE -ne 0) { throw 'Backup failed; no migration' }
Get-FileHash -LiteralPath $approved.backupFile -Algorithm SHA256
& pg_restore --list $approved.backupFile
if ($LASTEXITCODE -ne 0) { throw 'Backup archive unreadable; no migration' }
```

`pg_restore --list` chỉ xác minh archive đọc được. Nhóm phải **restore thật vào một target riêng đã có và được duyệt**, xác minh tables/data/constraints/ACL/history trước production. Operator cấp PG* credentials của target restore trong process riêng, kiểm tra identity của target đó trước khi dùng:

```powershell
# Chỉ target restore riêng, empty và đã được nhóm cấp; KHÔNG Supabase chung.
& pg_restore --no-password --exit-on-error --single-transaction --dbname $approvedRestoreDatabase $approvedBackupFile
if ($LASTEXITCODE -ne 0) { throw 'Restore rehearsal failed; no production rollout' }
```

Không --clean, --create, DROP DATABASE hay tự tạo target. pg_dump không chứa cluster roles/tablespaces hoặc PDF bytes ở storage; nhóm phải bảo đảm roles/ownership/storage backups và Supabase-managed schemas qua phương án đã được DBA chấp thuận. Nếu login Developer không dump đủ phạm vi, dùng backup/PITR do nhóm quản trị cung cấp, không coi partial dump là backup toàn hệ thống. Không lưu dump/secrets vào evidence hay Git.

## Rehearsal PostgreSQL 17 đã chạy

Runner tạo container/volume mới, giữ nguyên mọi resource cũ và dừng nếu có lỗi. Chạy lại toàn bộ bằng `node backend/scripts/rehearse-uc17-24.cjs`. Run thực tế đã PASS có ID `uc1724-1794215028918-cc0b4a29`; không chạy lại chỉ để thay bằng chứng mới. Trình kiểm Supabase READ ONLY: `node backend/scripts/uc17-24-supabase-preflight.cjs uc1724-1794215028918-cc0b4a29`. Credentials chỉ dùng trong memory/process env, không ghi .env hoặc log.

1. Dùng target riêng đã được nhóm cấp, xác minh identity/history. Đối với fresh target, chặng `stage --through 16` chỉ chứa B1–B8; chuẩn bị academic roles và dữ liệu synthetic trước UC17 bằng fixture được nhóm cho phép, không dùng production seed. Các migration mới không tự tạo STUDENT/LECTURER/FACULTY.
2. Producer/weekly dùng đúng chặng 17 migration trước khi seed tài khoản synthetic, sau đó backup/restore và nâng cấp từng UC. Test fixtures B1–B3 đã cập nhật theo quy trình tài khoản Admin có sẵn trước khi Khoa bổ sung hồ sơ; quota test kiểm đúng quy tắc đóng băng sau công bố hiện hữu. Không thay nghiệp vụ source B1–B8. SMTP chỉ đi vào MailHog local mới.
3. Sau mỗi deploy UC17..24, chạy checkpoint tương ứng rồi kiểm thử trigger/FK/RLS bằng runtime role thật: NULL status/state, hidden/missing parent, legacy update/delete/cascade, append-only PDF, weekly↔final file claims, rollback toàn transaction khi audit/key thiếu, ba role chấm điểm, current-source UC24.
4. Hai session thật: UC21 mutex-first ReadCommitted xuyên đợt và các writer cũ; UC17 final-vs-weekly claim ở RC/RR; nguồn đổi đồng thời khi finalize/publish. Không suy ra deadlock/TOCTOU đã hết từ unit.
5. Kiểm thử rollback DDL bằng fault injection **chỉ trên bản rehearsal** trước COMMIT, so catalog/data/history; official SQL/checksum giữ nguyên. Kiểm thử backup restore vào target riêng. Không chạy empty-only rollback UC17 trên dữ liệu có version; UC18–24 dùng forward-fix/restore đã duyệt.
6. Weekly HTTP upload/submit/review/download/reopen PASS 10/10 trước và 10/10 sau nâng cấp. Full 25-migration dump đã restore thật sang database local khác, kiểm dữ liệu PDF và postflight UC24. Các trường hợp cụ thể được ghi trong result.json; không suy rộng thành mọi race hoặc toàn bộ UC17–UC25 positive E2E. Write flags vẫn tắt.

## Docker cũ giữ nguyên; dùng resource rehearsal mới

| File | PostgreSQL/endpoint khai báo | Volume |
| --- | --- | --- |
| compose.pr2-test.yml | postgres:16-alpine; loopback 55432; doan_pr2_test / btl_pr2_test | pr2-test-data |
| compose.team-local.yml | postgres:17-alpine; loopback 55440; btl_pr2b_dev / btl_local | team_local_data |
| docker-compose.yml | postgres:16-alpine; loopback DB_PORT mặc định 5432; doan_local | postgres_data |
| compose.local-postgres.yml | Override backend tới service postgres:5432/doan_local | Theo compose gốc |

Đây là cấu hình Docker cũ; không dùng/xóa dữ liệu hoặc volume của chúng. Lượt PG17 tạo mới `datn-uc1724-1794215028918-cc0b4a29`, volume cùng tên thêm `-data`, và SMTP sink cùng tên thêm `-smtp`; chỉ bind loopback port ngẫu nhiên. Hai container/volume PG16 của lượt trước vẫn giữ nguyên. Không sửa .env hoặc in password. `compose.shared.yml` trỏ backend dùng .env của nhóm, không phải fixture DB. Backend Dockerfile chỉ generate/build/start, không migrate ở startup. Harness baseline kiểm loopback và đúng 17 hashes; mặc định integration tests vẫn dùng PG17/canonical schema. CI database workflow chưa được chạy.

Kết quả offline cụ thể ở `evidence/offline-checks.json`, `backend-tests.json`, `frontend-tests.json`, `preparation-result.json`. Không phát sinh báo cáo kiểm kê/review tổng quát mới.

Tham chiếu thao tác: [Prisma migrate deploy](https://www.prisma.io/docs/orm/reference/prisma-cli-reference#migrate-deploy) (cú pháp phiên bản local xác nhận bằng `prisma-deploy-help-only.txt`), [PostgreSQL backup/restore](https://www.postgresql.org/docs/17/backup-dump.html).
