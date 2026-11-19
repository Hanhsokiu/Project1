# DBA — xác minh và giải phóng Prisma advisory lock

## Hiện tại — UC24 đã triển khai, đủ 25 migration

**Database UC17–UC24 hoàn tất: 25 APPLIED / 0 FAILED, đủ 25 checksum, tất cả postflight PASS.** Lượt cuối chỉ ngắt PID được duyệt `1938065`, dấu thời gian đầy đủ **2026-11-09 13:27:05.988797 UTC**, sau khi kiểm tra lại idle/không transaction/đúng khóa, fingerprint không đổi và không có migration/DDL/prepared transaction khác. Sau tín hiệu xác nhận đúng một phiên hết và khóa hết; history 24 checksum giữ nguyên. Raw: `authorized-release-1938065.json`.

UC24 dùng đúng bản PG17 đã sửa `fr_commit_check`, SHA-256 **6A1F8328747A2780DD9D9BB25A542980113C01C1577EB7CB6D493D626D8E3F70**. Preflight/Prisma/postflight PASS. Đối chiếu READ ONLY sau cùng: function body đúng SQL đã kiểm thử, trigger/FK/CHECK/RLS catalog đúng postflight, 50 CHECK/FK validated và zero violations trên 15 bảng chịu tác động (kể cả bảng chỉ bổ sung trigger), 37 indexes valid/ready; dữ liệu gốc 98 bảng và managed-schema counts vẫn khớp backup.

**Vận hành còn theo dõi, không phải migration pending:** khóa `72707369` còn ở PID mới **1938848**, `backend_start=2026-11-09 13:38:16.640041 UTC` (mốc báo millis `.640`), role postgres/application Supavisor, idle, không transaction. Agent không ngắt PID mới. Không còn migration nào cần chạy; đã hoàn tất verification READ ONLY dù writer dừng sau khóa cuối. DBA chỉ xử lý riêng sau khi xác minh lại chủ sở hữu/PID/backend_start nếu cần dọn phiên hoặc chuẩn bị migration tương lai, không restart/ngắt hàng loạt.

**Nghiệm thu nghiệp vụ chưa chạy:** không có UC17_POLICY–UC25_POLICY, thiếu 11 permission definitions UC24/UC25, chưa có hồ sơ/điểm/kết quả B9–B10, tài khoản test chưa được nhóm chỉ định; Render revision/storage persistence chưa kiểm chứng, local write flags vẫn false. Không tạo dữ liệu, policy, quyền hoặc tài khoản để giả PASS. Kế hoạch cụ thể: [PRODUCTION-SMOKE.md](PRODUCTION-SMOKE.md). Evidence: `evidence/execution-result.json`, raw `session24-result.json` và `uc24-final-verification.json`. Không sửa checksum/.env, bật flags, commit/push. Các mục dưới là lịch sử.

## Lịch sử — sau UC23, trước UC24

Kiểm tra READ ONLY lúc 2026-11-09 12:56:03.750 UTC: PID được duyệt `1930913` và khóa đều không còn; agent **không ngắt phiên nào trong lượt này**. Kiểm tra ngay trước rollout lúc 13:26:14.727 UTC vẫn không có khóa/migration/DDL khác, đủ 23 checksum. Sau xác minh lại target/quyền/backup, **UC23 preflight/Prisma/postflight PASS**. Hiện **24 APPLIED / 0 FAILED**, checksum đúng; không chạy lại UC17–UC22. Dữ liệu gốc 98 bảng và managed-schema counts sau deploy vẫn khớp backup.

Kiểm tra riêng SCORE_ENTRY/SCORE_DETAIL READ ONLY lúc **13:28:52.841 UTC**: 4 CHECK và 5 FK validated, zero violations; hai cột điểm numeric(4,1), indexes valid/ready, ba trigger cg_score_guard/cg_detail_guard/cg_commit_guard đúng cấu hình, commit guard deferred. Hai bảng điểm đều **0 bản ghi**, legacy score cũng 0: phép quét CHECK/FK không chứng minh positive grading E2E trên dữ liệu thật; không tạo điểm/test ghi production. Postflight UC23 đã đối chiếu function bodies, trigger bindings, constraints và RLS catalog với SQL đã duyệt. Raw: `uc23-score-verification.json`.

Khóa **72707369** sau UC23 ở **PID mới `1938065`**, `backend_start=2026-11-09 13:27:05.988 UTC`, role postgres/application Supavisor, idle, `xact_start=NULL`, granted. Agent dừng trước UC24 theo điều kiện số 7, **không ngắt PID mới**. Cần đánh giá/phê duyệt riêng hoặc DBA xác minh xử lý đúng phiên. Khi tiếp tục phải kiểm tra lại lock/**24 APPLIED / 0 FAILED**/checksum/target/quyền/backup; chỉ chạy UC24. Không restart, ngắt hàng loạt, tắt locking, resolve, sửa checksum/.env, bật write flags, commit/push. Raw: `session23-result.json`; summary `evidence/execution-result.json`. Các mục dưới là lịch sử.

## Lịch sử — sau UC22, trước UC23

Đã ngắt **đúng một PID `1930156` trong lượt này**, theo quyền riêng người dùng cấp; dấu thời gian đầy đủ **2026-11-09 11:35:15.695013 UTC** khớp mốc `.695` đã báo. Ngay trước tín hiệu: đúng database postgres/role postgres/Supavisor, idle, không transaction, đúng khóa `72707369` granted, fingerprint migration không đổi; không có migration/DDL/prepared transaction khác. SQL materialized chỉ chọn đúng một ứng viên và kiểm tra lại toàn bộ điều kiện trước `pg_terminate_backend`. Sau thao tác xác minh phiên và khóa hết, history vẫn 22 APPLIED / 0 FAILED, checksum không đổi. Evidence: `authorized-release-1930156.json` trong cache rollout.

Sau xác minh lại target/quyền/backup, **UC22 preflight/Prisma deploy/postflight PASS**. Hiện **23 APPLIED / 0 FAILED**, đủ checksum; trigger/constraint/RLS catalog UC22 PASS. Dữ liệu gốc 98 bảng và managed-schema counts sau deploy vẫn khớp backup. Không chạy lại UC17–UC21; UC23/UC24 chưa chạy.

Khóa **72707369** sau UC22 ở **PID mới `1930913`**, `backend_start=2026-11-09 11:43:45.762 UTC`, role postgres/application Supavisor, idle, `xact_start=NULL`, granted. Agent dừng trước UC23, **không ngắt PID mới**. Cần đánh giá/phê duyệt riêng hoặc DBA xác minh xử lý đúng phiên, không restart hoặc ngắt hàng loạt. Khi tiếp tục phải kiểm tra lại lock/**23 APPLIED / 0 FAILED**/checksum/target/quyền/backup; chỉ chạy UC23–UC24. Raw: `session22-result.json`; summary `evidence/execution-result.json`. Không tắt locking, resolve, sửa checksum/.env, bật write flags, commit/push. Các mục dưới là lịch sử.

## Lịch sử — sau UC21, trước UC22

Đã xử lý **đúng một PID `1929376`** theo quyền riêng người dùng cấp. Trước thao tác: đúng database postgres, role postgres/Supavisor, idle, không transaction, đúng khóa granted; không có migration/DDL/prepared transaction khác. Dấu thời gian PostgreSQL đầy đủ là **2026-11-09 11:22:28.241903 UTC**, khớp `.241` ở độ chính xác đã báo. Lần kiểm tra SQL đầu tiên không có ứng viên vì JavaScript Date bỏ microseconds, không gửi signal; lần sau dùng đúng timestamp đầy đủ. `pg_terminate_backend` xác nhận true cho duy nhất PID này. Lúc **11:34:08.835 UTC**, phiên và khóa đều hết; history vẫn 21 APPLIED / 0 FAILED, checksum không đổi. Hai evidence gốc được giữ nguyên: `authorized-release-1929376.json` (không gửi signal) và `authorized-release-1929376-precise.json` (đã ngắt đúng một phiên).

Sau xác minh lại target/quyền/backup, **UC21 preflight/Prisma deploy/postflight PASS**. Hiện **22 APPLIED / 0 FAILED**, đúng 22 checksum; trigger/constraint/RLS catalog UC21 PASS. Dữ liệu gốc 98 bảng và managed-schema counts sau deploy vẫn khớp backup. Không chạy lại UC17–UC20; UC22–UC24 chưa chạy.

Khóa **72707369** tái xuất hiện sau UC21 ở **PID `1930156`**, `backend_start=2026-11-09 11:35:15.695 UTC`, role postgres/application Supavisor, idle, `xact_start=NULL`. Agent dừng trước UC22; **không có quyền và không tự ngắt PID mới**. Cần đánh giá riêng/DBA xác minh lại phiên trước xử lý. Sau đó kiểm tra lock/history/**22 APPLIED / 0 FAILED**/target/quyền/backup trước khi chỉ tiếp tục UC22–UC24. Không restart, tắt locking, resolve, sửa checksum/.env, bật write flags, commit/push. Raw: `session21-result.json`; summary `evidence/execution-result.json`. Các mục dưới là lịch sử.

## Lịch sử — sau UC20, trước UC21

**Kiểm tra lại READ ONLY lúc 2026-11-09 11:28:59.705 UTC (18:28:59.705 UTC+7): khóa vẫn còn ở đúng PID `1929376`, backend_start `2026-11-09 11:22:28.241 UTC`**, role `postgres`, application `Supavisor`, idle, `xact_start=NULL`, chờ `ClientRead`. Query cuối nhắc Prisma history; không thấy migration khác đang hoạt động hoặc DDL lock. History vẫn **21 APPLIED / 0 FAILED**, đủ 21 checksum PASS, cuối cùng là UC20. Không có quyền ngắt phiên mới trong lượt này; agent không terminate, không chạy UC21–UC24. Raw: `session21-initial-inspection.json`; sau khi khóa được xử lý phải kiểm tra lại target/quyền/backup trước deploy.

Lượt cấp quyền mới chỉ cho phép xử lý PID `1926489`, backend_start `2026-11-09 10:44:49.671 UTC`. Kiểm tra READ ONLY lúc **2026-11-09 11:20:20.562 UTC**: PID đó không còn, khóa đã hết; history **20 APPLIED / 0 FAILED**, đủ checksum. Agent **không phát lệnh terminate**, không dùng quyền đó cho PID khác. Sau kiểm tra lại target/quyền/backup, **UC20 preflight/Prisma deploy/postflight PASS**, không chạy lại UC17–UC19.

Hiện **21 APPLIED / 0 FAILED**, đúng 21 checksum. Trigger/constraint/RLS catalog UC20 PASS. Sau deploy, dữ liệu gốc 98 bảng và managed-schema counts vẫn khớp backup (11:22:56.441 UTC). UC21–UC24 chưa chạy.

Khóa mới quan sát sau UC20 lúc **2026-11-09 11:22:37.281 UTC**:

- Lock **72707369**, ExclusiveLock, granted.
- PID **1929376**, `backend_start=2026-11-09 11:22:28.241 UTC`.
- Role `postgres`, application `Supavisor`, **idle**, `xact_start=NULL`.
- Không thấy DDL lock hoặc prepared transaction khác. Query cuối nhắc Prisma history; không suy ra chắc chắn chủ sở hữu client từ tên pooler.

Agent dừng ngay trước UC21 theo điều kiện số 7, không tự ngắt phiên mới. Cần đánh giá riêng/DBA xác minh lại PID, backend_start, chủ sở hữu và migration khác trước khi xử lý đúng phiên; không ngắt hàng loạt hoặc restart. Sau xử lý phải kiểm tra lại lock, **21 APPLIED / 0 FAILED**, checksum/target/quyền/backup; chỉ tiếp tục UC21–UC24. Raw: `session20-single-session-inspection.json` và `session20-result.json`; summary `evidence/execution-result.json`. Các mục phía dưới là lịch sử.

## Lịch sử — sau UC19, trước UC20

**Xác minh mới nhất: 2026-11-09 10:56:51.776 UTC (17:56:51.776 UTC+7)**. Vẫn đúng PID `1926489`, backend_start `10:44:49.671 UTC`, giữ Exclusive advisory lock `72707369`; idle, `xact_start=NULL`, chờ `ClientRead`. Không có DDL lock; không thấy migration khác đang hoạt động. History/checksum vẫn **20 APPLIED / 0 FAILED / PASS**. Windows tại 10:56:50.809 UTC chỉ có Node PID `22960` phục vụ chính truy vấn READ ONLY này, không phải Prisma deploy; không có schema-engine/query-engine khác. Phiên server xuất hiện giữa lượt UC19 (10:44:42.656–10:44:56.799 UTC), query cuối nhắc Prisma history, phù hợp với phiên của lượt đó; chưa thể chứng minh danh tính client phía trước Supavisor hoặc client đã disconnect chỉ từ PostgreSQL views. DBA cần đối chiếu log frontend/backend mapping trước quyết định ngắt đúng phiên. Raw: `dba-live-confirmation.json`; agent không chạy migration hoặc terminate.

**Kiểm tra lại ngày 2026-11-09 lúc 10:49:58.990 UTC (17:49:58.990 UTC+7): vẫn đúng PID `1926489` và backend_start `2026-11-09 10:44:49.671 UTC` giữ khóa `72707369`**, idle, `xact_start=NULL`. `query_start=10:44:51.127 UTC`, `state_change=10:44:51.194 UTC`; fingerprint query cuối `35b0d688c0ffb204960b4bcc801a4131`, có nhắc Prisma history. Không thấy migration khác đang hoạt động; danh sách activity chỉ có chính phiên idle này. Supabase SESSION 5432, database postgres, PG17.11/UTF8; **20 APPLIED / 0 FAILED, đủ 20 checksum PASS**, migration cuối `202611090003_uc19_defense_committee`. Tại 10:50:48.822 UTC, kiểm tra Windows không còn Node/Prisma/schema-engine/query-engine chạy. Không có migration hoặc session termination mới trong lượt kiểm tra này. Raw: `session20-initial-inspection.json` trong cache rollout.

Đề nghị nhóm trưởng/DBA:

1. Xác minh lại khóa, PID, backend_start và chủ sở hữu hiện tại; đối chiếu các client/jobs khác trước khi giải phóng đúng phiên. Không dùng PID cũ nếu backend_start khác hoặc chủ khóa đã đổi.
2. Đối chiếu log pooler/client trong khoảng 10:44:42–10:50:49 UTC: Prisma CLI **5.22.0**, UC19 exit code 0, toàn chặng postflight kết thúc 10:44:56.799 UTC. Kiểm tra sự kiện client disconnect, backend checkout/check-in và session cleanup/reset; ánh xạ PID server về client trước khi kết luận nguồn phiên. Tên `Supavisor`/login dùng chung không đủ để định danh client.
3. Xác minh tenant/role thực sự ở session mode 5432 và cấu hình vòng đời/reset session sau khi client migration kết thúc. Chưa có quyền/log pooler để chứng minh nguyên nhân cụ thể từ phía agent; không kết luận lỗi Supavisor hoặc Prisma chỉ từ tương quan thời gian.
4. Sau xử lý, báo thời điểm và phiên đã xử lý. Agent sẽ kiểm tra lại lock/history/20 checksum/target/quyền/backup trước UC20–UC24; dừng nếu khóa xuất hiện lại. Không restart pooler, tắt advisory locking, resolve hoặc chạy lại UC17–UC19.

Query kiểm tra khóa READ ONLY, giới hạn đúng database hiện tại:

```sql
BEGIN READ ONLY;
SELECT l.pid, a.datname, a.usename, a.application_name, a.backend_start,
       a.state, a.xact_start, a.query_start, a.state_change,
       a.wait_event_type, a.wait_event, l.mode, l.granted,
       md5(a.query) AS query_digest
FROM pg_locks l
LEFT JOIN pg_stat_activity a ON a.pid = l.pid
WHERE l.locktype = 'advisory'
  AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
  AND l.classid = 0 AND l.objid = 72707369 AND l.objsubid = 1;
COMMIT;
```

Cơ chế đã biết: session-level advisory lock tồn tại đến khi được unlock hoặc PostgreSQL session kết thúc, không tự mất sau COMMIT/ROLLBACK. Vì vậy idle/không transaction không chứng minh session lock đã được giải phóng. Hiện tượng quan sát phù hợp với backend session còn tồn tại sau client CLI; **nguyên nhân giữ/reuse/cleanup cụ thể cần log DBA xác nhận**. Tham chiếu: [PostgreSQL 17 advisory locks](https://www.postgresql.org/docs/17/explicit-locking.html#ADVISORY-LOCKS), [Supabase Prisma Session 5432](https://supabase.com/docs/guides/database/prisma). Không đưa lệnh terminate/unlock vào bàn giao này.

Người dùng đã duyệt Supavisor SESSION IPv4 5432 và yêu cầu dừng nếu pooler giữ khóa sau từng chặng. Trước lượt này không còn khóa cũ và đúng 19 APPLIED. **UC19 preflight/Prisma deploy/postflight PASS**, không chạy lại UC17/UC18. Hiện **20 APPLIED, 0 FAILED**, đúng checksum; UC20–UC24 chưa được gọi deploy. Trigger/constraint/RLS catalog UC19 và dữ liệu gốc 98 bảng/managed-schema counts sau deploy PASS.

Khóa mới quan sát READ ONLY lúc **2026-11-09 10:44:57.463 UTC**:

- Advisory lock **72707369**, ExclusiveLock, granted.
- PID **1926489**, `backend_start=2026-11-09 10:44:49.671 UTC`.
- Role `postgres`, application `Supavisor`, **idle**, `xact_start=NULL`.
- Không thấy DDL lock hoặc prepared transaction khác. Query cuối nhắc Prisma history; không gán chắc chắn danh tính client từ tên pooler.

Nhờ DBA xác minh lại PID/backend_start/chủ sở hữu và migration khác trước khi xử lý đúng phiên. Agent **không ngắt phiên nào**, không unlock hoặc tắt locking. Sau DBA xác nhận phải kiểm tra lại lock, **20 checksum APPLIED / 0 FAILED**, target/quyền và backup; tiếp tục chỉ UC20–UC24. Không chạy lại UC17–UC19; giữ .env/write flags và checksum đã áp dụng. Bằng chứng: `evidence/execution-result.json`, raw `session19-result.json` trong cache rollout. Các mục phía dưới là lịch sử, không phải PID/history hiện tại.

## Cập nhật sau lần tiếp tục UC18

Khóa/PID cũ `1922771` đã không còn tại kiểm tra `2026-11-09 10:19:15.133 UTC`; **không ngắt phiên nào**. Sau khi xác minh backup/target/history, UC18 đã APPLIED và postflight PASS. History hiện **19 APPLIED, 0 FAILED**, đúng checksum 17 nền + UC17 + UC18; UC19–UC24 chưa chạy. Kiểm tra READ ONLY sau khi dừng xác nhận dữ liệu gốc 98 bảng và số bản ghi managed schemas vẫn khớp backup; SHA-256 và giải mã backup PASS.

Khóa `72707369` tái xuất hiện sau UC18 ở **PID `1924918`**, `backend_start=2026-11-09 10:22:30.636 UTC`, role `postgres`, application `Supavisor`, idle, `xact_start=NULL`. Quan sát lại `2026-11-09 10:24:35.636 UTC`: vẫn đúng phiên đó; không có DDL lock hoặc prepared transaction. Query cuối nhắc Prisma history; thời điểm khớp lượt CLI UC18, nhưng pooler không cung cấp danh tính client để xác minh độc lập chủ sở hữu ứng dụng. Agent dừng trước UC19 theo điều kiện người dùng: không ngắt phiên chưa xác định chủ sở hữu. Không gọi pg_terminate_backend.

Nhờ xác minh chủ sở hữu phiên mới và cách xử lý nếu từng lượt deploy tiếp tục để lại khóa qua pooler, hoặc cấp endpoint direct PostgreSQL được duyệt. Khi tiếp tục, phải kiểm tra lại lock/target/backup và **19** checksum APPLIED; chỉ chạy UC19–UC24. Không chạy lại UC17/UC18. Evidence hiện tại: `evidence/execution-result.json`; raw `resume-result.json` và `resume-verification.json` trong cache rollout. Thông tin bên dưới là lịch sử sự cố ban đầu, không phải PID/history hiện tại.

## Lịch sử trước UC18

Người dùng chọn **nhóm/DBA xử lý khóa**. Agent đã tạm dừng UC18–UC24; không được gọi pg_terminate_backend, tắt Prisma advisory locking, migrate resolve hoặc tự chạy lại migration.

Thông tin quan sát READ ONLY trên Supabase chung, database `postgres`:

- Prisma advisory lock: **72707369** (`classid=0`, `objid=72707369`, `objsubid=1`), ExclusiveLock, granted.
- PID quan sát giữ khóa: **1922771**.
- `backend_start`: **2026-11-09 10:00:27.769 UTC**.
- Role: `postgres`; application_name: `Supavisor`.
- Trạng thái quan sát: **idle**, `xact_start=NULL` — không có transaction mở tại lúc kiểm tra.
- UC18 CLI trả **P1002**, chờ `SELECT pg_advisory_lock(72707369)` trong 10000ms.

Nhờ DBA **xác minh lại thông tin hiện tại**, gồm PID và backend_start để tránh PID tái sử dụng, chủ sở hữu khóa và tình trạng migration khác. Chỉ giải phóng đúng phiên khi xác nhận an toàn; không xử lý hàng loạt session hoặc bỏ cơ chế locking.

Query chẩn đoán READ ONLY để DBA chạy trong Dashboard:

```sql
BEGIN READ ONLY;
SELECT l.pid, a.usename, a.application_name, a.state,
       a.backend_start, a.xact_start,
       l.classid, l.objid, l.objsubid, l.mode, l.granted
FROM pg_locks l
LEFT JOIN pg_stat_activity a ON a.pid=l.pid
WHERE l.locktype='advisory' AND l.classid=0 AND l.objid=72707369;
COMMIT;
```

Không kèm lệnh terminate/unlock trong tài liệu này. Thông tin quan sát có thể đã thay đổi; không dùng PID cũ mà không kiểm chứng lại.

## Trạng thái rollout đã xác minh

- **18 migration APPLIED**: 17 B1–B8 giữ nguyên checksum + `202611090001_uc17_final_defense`.
- UC17 SHA-256: `75CD92D5F97ACF26F3FE6A3EADBBCADFC54F9C81432BEEF4735E8BD8A51E092F`; postflight PASS.
- UC18 chưa bắt đầu DDL: không có record FAILED trong `_prisma_migrations`, chưa có cột `DEFENSE_ELIGIBILITY.revision`.
- UC19–UC24 chưa chạy. 98 bảng nghiệp vụ giữ nguyên dữ liệu gốc; các thay đổi metadata RBAC và history UC17 được kiểm riêng.
- Backup thủ công trước rollout đã mã hóa ngoài Git và restore thật thành công. Artifact ID `datn-restore-1794217151793-601862c5`; vị trí và giới hạn ở `MANUAL-RECOVERY.md`. Không gửi dump, khóa, password hoặc connection string qua chat/Git.
- UC write flags tắt, .env không sửa; không restore production, commit hoặc push.

## Chỉ tiếp tục sau khi DBA xác nhận đã giải phóng

1. Kiểm tra lại advisory lock hiện tại và migration khác; không giả định khóa cũ đã hết.
2. Kiểm tra Prisma history/checksum: UC17 APPLIED, UC18 chưa lỗi hoặc áp dụng dở. Nếu trạng thái khác quan sát trên, dừng để đối chiếu, không resolve hoặc sửa checksum.
3. Xác minh target và backup vẫn hợp lệ. Ghi nhận các ghi nghiệp vụ phát sinh trong thời gian chờ; backup cũ không tự trở thành snapshot của thời điểm mới.
4. Tiếp tục **chỉ UC18 → UC24** theo bounded Prisma stages, preflight/deploy/postflight từng UC. Không chạy lại UC17.
5. Dừng ngay khi có lỗi mới; không tắt advisory locking hoặc tự xử lý session tiếp theo.
