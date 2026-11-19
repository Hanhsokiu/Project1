# UC25 — audit schema và kế hoạch tích hợp báo cáo

**REVIEW ONLY. UC25 không cần migration mới cho phương án hiện tại.** Không có migration.sql trong gói này; không apply/db push/seed/reset. Không sửa 17 migrations nền hoặc 8 gói review UC17–UC24.

## Audit và lựa chọn lưu trữ

| Đối tượng source | Kết quả audit / cách dùng UC25 |
| --- | --- |
| EXPORT_JOB | Baseline có id/termId/type/status/filePath/requestedBy/createdAt/completedAt, chưa đủ template/version/source scope/private artifact lifecycle. Không coi filePath local là kho lưu lâu dài trên Render; không adopt các jobs legacy |
| DEFENSE_MINUTES | Baseline unique sessionId, content JSON/filePath/timestamps; chưa có provenance phát biểu/kết luận/chữ ký/status/revision. Không adopt legacy hoặc coi là biên bản đã ký |
| FILE_ASSET | Dùng cho các producer có ownership và lifecycle riêng; không ép file xuất vào kind REPORT của PDF cuối hoặc ghi đè asset UC17 |
| AUDIT_LOG | Tái sử dụng resource defense-report để lưu metadata GENERATED/GENERATION_FAILED/DELIVERY_PREPARED và owner/term/template/filter/count/hash/time; không lưu bulk PII/điểm/nhận xét |
| IDEMPOTENCY_RECORD | Convention actor/method/route/key + payloadHash/result, audit/key atomic; không tạo hàng từ GET/preview |
| TERM_PARAMETER | UC25_POLICY versioned/approved, template registry overrides, visibility/retention/distribution. Không ghi policy mẫu vào database |
| FINAL_RESULT và nguồn UC17–UC24 | Dùng official readers trong caller ReportSession, không đọc final_score/boolean đơn lẻ thành official |

File được tạo trong memory, trả trực tiếp qua authenticated POST download. Không ghi bytes vào database, local uploads, disk/bucket hoặc queue mới. Metadata ghi audit là một bản xuất đã tạo, không phải archived file hay bằng chứng download/signature. Download tái sinh cùng snapshot/template/time/id; kiểm hash bằng bản gốc, kiểm lại actor/grants/source/TTL trước phát hành. Nếu nguồn đổi hoặc engine/artifact khác, chặn và yêu cầu xuất mới; không xuất lịch sử cũ như CURRENT.

Do đó không cần thêm cột EXPORT_JOB, bảng template, DEFENSE_EXPORT_UC25 hoặc DEFENSE_MINUTES_UC25. Nếu nhóm yêu cầu lưu lâu dài, lịch sử file bất biến ngay cả khi nguồn stale, signed scans/digital signatures, queue hoặc export lớn hơn giới hạn: cần policy + private durable storage + schema review riêng. Phương án hiện tại không giả lập các khả năng đó.

## Dependency

Read facts B1–B8 dùng cùng Prisma model/ownership/grants. Official committee/reviewer/schedule/grades/results cần gói UC17 → UC18 → UC19; UC20/UC21 → UC22 → UC23 → UC24 theo dependency thực. Readiness từng producer kiểm catalog trước khi dùng cột mới. UC25 không thể thay việc rehearsal các gói đó; thiếu nguồn → blocker/unknown, không tạo bảng/row tự động.

## Mapping quyền đề xuất — chưa provisioning

Resource defense-report, permission thuộc đúng role FACULTY hoặc LECTURER:

- read, templates-read, statistics, preview.
- list-export, components-export, final-export, comments-export, minutes-export.
- export (ghi metadata), download (tái sinh và ghi delivery-prepared), history-read.
- draft-preview/draft-export độc lập.
- grade-statistics/score-statistics độc lập; dossier-export/pii-export chỉ khi được phê duyệt.

FACULTY cần term/department grants, underlying UC24 components-read cho kết quả. LECTURER cần committeeId + actual current UC19 membership, không xuất toàn kỳ; kết quả còn cần UC25_POLICY.memberResults=EXPLICIT_RESULT_PERMISSION và UC24 read/components-read, các quyền nội dung riêng. Internal official reader dùng persisted faculty finalizer còn live rights/grants, không nhận source actor từ browser. Comment export còn kiểm underlying UC17/UC22 comment-read; member không tự lấy feedback người khác. Dossier dùng quyền dossier:export và snapshot/template B1–B8 hiện hành. Không STUDENT/ADMIN mapping hoặc role union.

## Điều kiện activation / rollback

UC25_WRITES_ENABLED mặc định false. Cần approved policy/templates thật, quyền/grants được duyệt, kiểm ACL/RLS/Supabase REST trực tiếp trên nguồn/audit/key, PostgreSQL transaction/rollback/concurrency rehearsal và browser/Render E2E. Không tự bật cờ hoặc sửa Render. Export stream không chứng minh final PDF UC17 đã có disk/mount/backup/restore bền vững.

Không xóa audit/key khi tắt tính năng. Rollback ứng dụng bằng tắt ghi, giữ lịch sử và dùng forward fix theo phê duyệt; không DROP/xóa legacy để làm sạch. RetentionDays chỉ giới hạn quyền tái sinh/tải, không tự xóa audit. Mọi direct-SQL ACL/RLS/backup/restore vẫn NOT VERIFIED.
