> Current release: production is 27 APPLIED / 0 FAILED, 124 permission definitions, 166 role grants and zero UC17-UC25 policies. Counts, PIDs and commands below document historical stages. Do not repeat applied SQL or migrate resolve. See [current main release handoff](../../../../docs/implementation/B9-B10-MAIN-RELEASE.md). Live JSON evidence is retained locally outside the release commit.

# Đưa RBAC vào main — history26 đã đối soát, chưa commit/push/merge

**Đã thực hiện theo phê duyệt mới của người dùng:** `20261109150000_uc24_uc25_rbac_permissions/migration.sql` đã nằm trong chuỗi Prisma, nguyên SHA-256 nêu dưới đây. Kiểm thử Prisma deploy trên PG17 chưa có hotfix PASS; production chỉ chạy resolve một lượt và đạt **26 APPLIED / 0 FAILED**, không chạy SQL lần hai, 25 history rows/checksum cũ và 102 bảng public không đổi. Xem `history-sync-local.json`, `history-sync-production.json`. Không chạy lại lệnh resolve trong tài liệu.

Sau đó đã cấp đúng bốn quyền đọc FACULTY theo gói riêng được duyệt: grants hiện **166**, riêng FACULTY **67**, permission **124**; history vẫn **26/0**. Gói role grant là thao tác vận hành RBAC có provenance riêng, **chưa là migration Prisma thứ 27**. Không sửa migration26 để nhét thêm grant. Nếu nhóm muốn quản lý grant bằng migration sau này, cần đợt mới được duyệt, hash mới và đối soát hotfix tương tự; không tự tạo history27 ở lượt này.

Đưa main sau này: review/copy migration26 cùng evidence và code nhánh hiện tại, giữ nguyên byte; production đã có history26 nên không resolve lại và không chạy migration.sql trực tiếp. Môi trường khác còn 25 entries/chưa hotfix dùng migrate deploy bình thường để áp migration26. Role mapping nhạy cảm và cả chín policy vẫn cần duyệt riêng. Phần dưới giữ lại quy trình/hướng dẫn **lịch sử trước khi đã thực hiện**, không phải các việc cần chạy lại.

Trạng thái thật sau 21:25 ngày 09/11/2026: production đã có 27 định nghĩa + schema provenance, không gán role; Prisma history vẫn 25 APPLIED/0 FAILED. Đây là **manual database hotfix đã được người dùng phê duyệt**, chưa phải migration thứ 26 trong history. Không chạy lại SQL production và không tự ghi history trong lượt này.

## Nội dung PR/release sau này

1. Review và đưa code UC17–UC25 cùng RBAC vào quy trình main của nhóm, giữ nguyên 25 migration hiện tại và checksum. Không commit/push/merge tự động ở lượt hiện tại.
2. Khi duyệt release, chọn tên mới không trùng, ví dụ `20261109150000_uc24_uc25_rbac_permissions` (chỉ tên đề xuất, chưa tạo thư mục migration). Copy **nguyên byte** `migration.sql` đã kiểm thử vào migration mới. SHA-256 phải là `1d309be4a0a43fd782594bacecc31d489ff06e6cff68c2cbacd27f0c0070a082`. Không sửa comment DRAFT của file đã được duyệt để tránh đổi nội dung đã kiểm thử; trạng thái triển khai ghi trong evidence/README.
3. Đưa preflight/postflight/rollback, manifest, hash và bằng chứng đã khử dữ liệu nhạy cảm vào gói release. `datn_rbac_uc24_25` là schema provenance vận hành, không dùng Prisma db push/introspection để tự xóa nó. Không thêm nó thành model nghiệp vụ chỉ để làm schema drift biến mất.
4. CI kiểm tra hash 25 migration cũ, 27 permission đúng controller/service và không có câu ghi ROLE_PERMISSION. Kiểm thử migration mới trên PG17 riêng; môi trường chưa có hotfix sẽ chạy migration mới theo Prisma và đạt 26 entries. Không dùng production làm test.

## Production đã có hotfix: chỉ ghi nhận history, không chạy lại SQL

Trước mọi `migrate deploy` của release main, DBA/operator phải đối chiếu target, **25 checksum cũ**, 27 định nghĩa, provenance/snapshot, ACL, không có failed/partial migration và không có rollout/lock khác; đối chiếu SQL migration mới với hash nêu trên và bằng chứng production. Backup và quyền vận hành vẫn phải còn hợp lệ. Nếu có thay đổi RBAC hợp lệ sau đợt này, đối chiếu bằng migration/grant approval riêng; không sửa snapshot để che sai lệch.

Sau **phê duyệt riêng cho thao tác ghi Prisma history**, operator mới dùng chức năng reconciliation của Prisma để đánh dấu migration RBAC mới là đã áp dụng. Đây là đối soát hotfix thật đã được xác minh, không dùng để bỏ qua migration lỗi hoặc thiếu schema. CLI Prisma cài trong repository đã được kiểm tra bằng `migrate resolve --help`, có hỗ trợ reconcile hotfix thủ công.

Ví dụ cho operator, chạy trong `backend` với đúng process environment chứa kết nối Session 5432 đã xác minh; **không thực thi các lệnh này trong lượt hiện tại**:

```powershell
# Chỉ sau khi tên migration mới và việc cập nhật history đã được duyệt.
node .\node_modules\prisma\build\index.js migrate resolve --applied 20261109150000_uc24_uc25_rbac_permissions --schema .\prisma\schema.prisma
node .\node_modules\prisma\build\index.js migrate status --schema .\prisma\schema.prisma
```

Không đặt connection string vào command line hoặc sửa `.env`; dùng cấu hình riêng trong process của operator. Lệnh resolve ghi metadata vào `_prisma_migrations`, **không chạy migration.sql**. Sau đợt reconciliation được duyệt, kỳ vọng history là **26 APPLIED/0 FAILED**, 25 checksum cũ giữ nguyên; checksum entry mới phải khớp nguyên byte SQL, permissions vẫn 124 và grants vẫn 162 nếu chưa có đợt RBAC khác được duyệt. Xác minh dữ liệu/ACL sau khi đối soát. Không cập nhật history bằng SQL thủ công, không resolve migration UC17–UC24 hoặc migration FAILED.

Chưa được phép reconciliation thì giữ nguyên 25 entries và chặn automation chạy `migrate deploy` trên production có migration RBAC pending. Không dựa vào idempotency để lặp lại thao tác production. Môi trường khác chưa có hotfix dùng migration bình thường, **không** đánh dấu applied trước khi SQL thật được thực thi.

## Các phê duyệt tách biệt còn thiếu

- **Role mapping:** FACULTY tối thiểu `defense-result:read`, `defense-report:read`, `templates-read`, `statistics`; LECTURER/STUDENT/ADMIN/COMMITTEE chưa cấp mới. Confirm/finalize/publish/export/download, xem điểm/nhận xét/PII và mọi quyền nhạy cảm phải duyệt riêng theo role/phạm vi; xem README.
- **9 policy:** UC17_POLICY (PDF/GVHD), UC18_POLICY (điều kiện bảo vệ), UC19_POLICY (hội đồng), UC20_POLICY (phản biện), UC21_POLICY (lịch), UC22_POLICY (chấm phản biện), UC23_POLICY (rubric hội đồng), UC24_POLICY (công thức/chốt/công bố), UC25_POLICY (mẫu/xuất/lưu trữ). Cả chín đang thiếu; giá trị cần chốt nằm ở POLICY-DECISIONS.md.
- **Runtime:** tài khoản/scope nghiệm thu, backend revision, storage Render bền vững, nguồn nội dung biên bản và quy trình ký. Không bật write flags hoặc thử chấm/công bố kết quả chỉ vì RBAC definitions đã tồn tại.
