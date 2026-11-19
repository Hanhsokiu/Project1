# B9–B10 — kế hoạch E2E nghiệm thu

Trạng thái hiện tại: **NOT VERIFIED** trên PostgreSQL/Render/browser thật. Unit/HTTP synthetic/real file parsing đã chạy không thay thế các ca dưới đây. Cần môi trường database/private storage test được nhóm phê duyệt, cùng schema/runtime/Render cấu hình dự kiến, dữ liệu synthetic, không ghi Supabase chung để thử.

## Chuẩn bị và trách nhiệm

Nhóm trưởng xác nhận scope, DB owner review/rehearse schema/restore, người phụ trách Render kiểm disk/mount/backup, Khoa/giáo vụ duyệt rules/templates, QA ghi bằng chứng/case IDs. Không dùng tài khoản/secrets production trong report. Ghi versions: branch/code hash, migration/template/policy hashes, runtime role, browser/engine versions và technical limits.

## Luồng chính

| Bước | Actor và hành động | Bằng chứng phải có |
| --- | --- | --- |
| UC15/17 PDF | SV đúng term/assignment nộp PDF cuối, thay bản hợp lệ, tải lại | Bytes/SHA256 đúng, private READY/version append-only, old version còn, invalid mime/size/path bị từ chối, audit/key/revision |
| UC17 tổng kết | GVHD mở đúng PDF, comment/score/rubric, agree/reject | Assignment/topic/policy/PDF current, reject reason bắt buộc, step/precision đúng; SV chưa thấy nội dung chưa release |
| UC18 | Khoa review academic/progress, decide/finalize | Trusted source/attestation, thiếu chứng cứ không fake qualified, current eligibility có audit |
| UC19 | Khoa tạo 3/5 thành viên roles và phân SV, finalize | Kiểm xung đột với toàn bộ member, không chỉ advisor/reviewer cá nhân; provenance/quotas/scope |
| UC20 | Phân 1/nhiều GVPB, finalize | Đủ mỗi người, conflict/qualification/caps/dual-role policy, former advisor rules, không copy member slot thành reviewer |
| UC21 | Xếp sáng/chiều, Tên + Họ đệm, phòng/slots/buffers, chốt/công bố | Thứ tự Unicode/ties/exceptions được duyệt, trùng resource xuyên kỳ bị chặn; finalize không tự public |
| UC22 | Từng GVPB tải PDF, feedback/draft/finalize | Own record/approved rubric/window, không chấm thay; finalized/current reader đúng revision/hash |
| UC23 | Từng member rubric/draft/finalize | Mỗi người độc lập, đủ required roles; actual-defense evidence khi policy yêu cầu; không infer attendance từ lịch |
| UC24 | Preview → Chair/Secretary confirm → Khoa finalize → publish | Preview readonly; thiếu phiếu/confirmation/policy chặn; exact formula/rounding snapshot; immutable; own student release |
| UC25 | Preview/template → XLSX/PDF creation → authenticated download | File mở được trong Excel/PDF/browser, Unicode/leading zero/precision, không formula injection, snapshot UC24 khớp, no hidden leakage, metadata/audit/key chính xác, UNSIGNED |

## Negative/security matrix

Mỗi API/read/write/download/history: logged out, expired/revoked session, inactive user/profile, wrong role, flat ADMIN permission, split-role union, wrong term/department/committee/student/lecturer, tampered id/hash/revision/template/version/filename, permission và grant bị thu hồi. SV không thấy điểm dự kiến/người khác; member không export toàn kỳ/feedback người khác. Kiểm cả trực tiếp URL/HTTP và Supabase REST/SQL runtime grants, không chỉ menu.

DRAFT template không biến thành official; missing conclusion/remarks/revision requests có nhãn hoặc blocker, không tự sinh nhận xét/chữ ký. Tải bytes không được log thành chữ ký hoặc xác nhận browser đã lưu. Dossier export phải dùng bản B1–B8 hiện hành và quyền PII riêng.

## Stale và concurrency

Thay PDF/assignment/advisor/topic/eligibility/membership/reviewer duty/schedule/rubric/policy sau preview, giữa read/render/commit và sau finalize/publish/export. Downstream phải STALE/blocked, giữ lịch sử, không auto-recompute/rebind. Nguồn hết cửa sổ ghi đơn thuần khác nguồn bị thu hồi/đổi nội dung.

Chạy hai PostgreSQL transactions thật: same/different idempotency key, same/different body, same expected revision, source producers đồng thời, term phase/grant changes; dùng locks/barriers để tái hiện race. Kiểm rollback cả score/result/audit/key, deferred triggers và source snapshot nhất quán. Không dùng memory queue PASS làm bằng chứng PostgreSQL isolation.

## Storage, artifacts và performance

Xác minh final PDF sống qua Render restart/redeploy, disk mount/permissions/backup/restore và checksum; stream export không giải quyết persistent storage nguồn. Kiểm fonts Linux/OFL assets, workbook mở bằng Excel/LibreOffice, page layout/long text/many pages/print preview, dấu tiếng Việt, file headers/no-store/nosniff, permissions khi tải lại, hash/expiry/engine change.

Đo 3/5 members, nhiều reviewers, nhiều committee/kỳ/rooms, source hash reads, transaction latency/timeouts, rows/candidates/text/bytes caps, 2 renders/process/default timeout, memory và CPU trên Render. Xác minh API không truncate file hoặc hiển thị số 0 khi nguồn unknown. Không load-test shared production.

## Tiêu chí nghiệm thu / stop

Lưu testcase PASS/FAIL, artifact hashes và redacted logs; screenshots chỉ dữ liệu test. Restore drill thành công, B1–B8 regression/browser chạy đúng, tất cả critical security/current/transaction/storage tests PASS, template/rules/grants được ký duyệt và owner sign-off.

Nếu thiếu policy/schema/producer/storage/permission hoặc có stale/data mismatch: ghi BLOCKED/FAIL, không “green” bằng mock fallback, không bật flags/migration/production tự động. Lỗi tải/in thật và thiếu producer ký/biên bản phải tách khỏi code unit PASS.
