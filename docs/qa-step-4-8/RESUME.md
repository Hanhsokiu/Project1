# Tiến độ audit bước 4–8

## Checkpoint sau sửa — 27/10/2026

**Bổ sung sau phản hồi UI không có dữ liệu:** đã kiểm trên chính cổng 5173 và tạo đợt `UI-DEMO-48-20261027` trong DB `btl_integration_ui`; giữ nguyên đợt đăng ký cũ. Xem [hướng dẫn hiện tại](../implementation/integration-ui-workflow-demo.md). Script `pnpm ui:workflow` có marker, không reset/nhân đôi dữ liệu; `pnpm ui:check-workflow` chỉ đọc và giả định trạng thái demo ban đầu. Giaovu quản lý, gv003/gv004 duyệt, sv001 sửa đề cương, sv003 chờ chốt, gv001/sv004 có kế hoạch và task. Dữ liệu hiện có 4 đề cương/5 task/3 bài nộp/25 notice. Browser setup 11 checkpoint PASS; check cuối `check-1793070568144` có 15 kiểm tra và 12 axe scan 0 violation. Sửa thêm contrast các dòng/badge/bảng/pagination khi có dữ liệu. Hai CSS đã thay đổi sau manifest của lượt sửa trước; không dùng hash cũ để coi source hiện tại chưa đổi.

Người dùng đã yêu cầu sửa source và đồng nhất giao diện bước 4–8 theo bước 1–3. Đã triển khai và retest trên nhánh `fix/integration-ui`, **chưa commit/push**. Xem [báo cáo hiện tại](../implementation/integration-ui-fixes-2026-10-27.md) trước khi tiếp tục; quy tắc audit only bên dưới chỉ là lịch sử.

- Shared WorkspaceLayout, menu theo role, một hộp thư, session reactive; sửa ARIA/contrast và parser đề cương dài.
- Notice giao task/tuần, nộp bài/đề cương, kết luận duyệt được ghi cùng transaction/idempotency. OutboxEvent cũ được giữ; worker email chưa thêm.
- Build/typecheck/Prisma validate PASS; backend 186 và frontend 115 unit PASS.
- Lượt `docs/implementation/evidence/integration-ui-fixes-2026-10-27/20261027020326_8e5346/`: cả 8 suite PASS (154 nhóm API + 15 checkpoint browser thật), auth 71 operation và legacy probe.
- `remediation-1793066855102/`: 8 kiểm tra PASS về đúng recipient, retry, weekly, rollback, API dài/413 và UI lưu/reload 110.450 byte.
- UI `ui-1793066763199/`: 10 kiểm tra PASS cho 3 vai trò; 4 axe scan không violation.
- UI local đang dùng PostgreSQL riêng cổng 55451, frontend 5173, backend 3000. `pnpm ui:dev` nhận biết phiên đang chạy, không khởi động trùng. Không đụng Supabase.
- Không có migration/schema mới. Không tự thêm withdraw/reopen/FR25 hoặc chức năng 9–10; không tuyên bố nghiệm thu toàn baseline.
- Harness mới: `backend/scripts/test-integration-ui-fixes.cjs`, `test-workflow-remediation.cjs`; `frontend/scripts/test-unified-workspace.cjs`, `test-large-proposal.cjs`. Supplemental chỉ chạy một lần trên fixture E2E mới, không reset/reuse lại fixture đã sửa.

## Snapshot audit trước khi sửa

## Quy tắc tiếp tục

- Audit only theo tệp người dùng gửi ngày 26/10/2026. Không sửa source/schema/dependencies; không reset DB, commit, push hoặc merge.
- Chỉ tạo báo cáo, harness kiểm thử và bằng chứng trong `docs/qa-step-4-8/`.
- Nhánh thực tế `fix/integration-ui`, HEAD `0c361709df34837df65b3ed429691599e6e2d93f`, bản tích hợp develop. Không chuyển về feature cũ.
- Các thay đổi README/package/lockfile và scripts UI local đã tồn tại trước audit; không ghi đè/hoàn tác.
- Không có Playwright MCP trong phiên. Playwright trong repo + Microsoft Edge có thể dùng; không cài thêm package.
- Chỉ DB loopback PostgreSQL 17 cổng 55451. Không dùng DATABASE_URL trong backend/.env hoặc Supabase.
- UI đang mở cổng 5173, API 3000; không khởi động trùng hoặc dừng phiên của người dùng.
- Không dùng báo cáo lịch sử làm kết quả kiểm thử mới. FAIL/NOT VERIFIED/BLOCKED phải được giữ nguyên nếu chưa có bằng chứng mới.

## Đã xác định

Nguồn phạm vi: `docs/implementation/01-business-decisions-and-contract.md`, các báo cáo triển khai 04a/05/06/07/08a/08b/08c, hướng dẫn nhóm và báo cáo merge 26/10. Câu “chưa bắt đầu PR2” trong tài liệu PR1 là lịch sử, đã được thay thế bằng triển khai và các quyết định sau đó.

| Bước | Phạm vi |
| --- | --- |
| 4 | Nhóm duyệt, thành viên/roster, bộ môn, routing, CAS/lịch sử |
| 5 | Phân công vòng duyệt đúng bản nộp, comments, một kết luận chung/vòng |
| 6 | Snapshot/version bất biến, chỉnh sửa/phản hồi/so sánh, SV nộp và nộp lại |
| 7 | Chốt bản được duyệt, PDF riêng tư, tiếp nhận bản giấy tách biệt |
| 8A | Kế hoạch, task, tiến độ, nghĩa vụ tuần độc lập task |
| 8B | Upload REPORT/SOURCE/EVIDENCE, bài nộp bất biến, nộp lại, tải riêng tư |
| 8C | PASS/FAIL/REVISION_REQUIRED, sửa nhận xét có lịch sử, họp/dashboard/thông báo |

Điểm nối: PUBLISHED vẫn riêng FINALIZED; bước 3 phải bàn giao workflow, không tự đoán snapshot chính thức. Bước 9–10 là consumer; không coi PASS task là điểm/đủ bảo vệ. COMMITTEE/chủ tịch/thư ký không phải role duyệt trong baseline hiện tại.

## Checkpoint hoàn tất audit — báo cáo ngày 27/10/2026

- Đã xuất đủ 16 báo cáo `00`–`15`. Đọc `00-executive-summary.md`, `12-confirmed-bugs.md` và `15-final-qa-verdict.md` trước khi tiếp tục.
- Lượt chính: `evidence/20261026144939_2663ec/`; `evidence/latest-run.txt` trỏ tới lượt này. Raw timestamps là UTC, các lần kiểm bổ sung có timestamp riêng trong JSON.
- 154 scenario groups API/DB PASS (31/27/24/19/19/17/17), không cộng lặp producer preludes.
- Live browser thật 15 checkpoint PASS; 71-operation auth inventory; 4 probe legacy topic/registration hiện đều403.
- Handoff bước3 publish riêng finalize, metadata, provenance và chặn legacywriter: PASS qua regression có sẵn.
- Prisma validate, typecheck, shared/backend/frontend build PASS; unit backend181/frontend115 PASS.
- DB audit 12 migration checksum khớp, 211 FK không có orphan trong fixture; current COMPLETED task có effective PASS.
- 29 lần mở route desktop, 3 tasks mobile; kiểm thêm loading/error/Back/Refresh/menu/session/axe. Không gọi đó là coverage đầy đủ mọi form/modal.
- QA-001: authenticated valid UTF-8 110.377 byte→500. `boundary-diagnosed/results.json` ghi PayloadTooLargeError, status413, limit102400, length110377; GlobalExceptionHandler chuyển500. Small control201, version count2→2, không ghi dở.
- QA-002/003 menu dẫn403/404; QA-004 contrast; QA-005 ARIA; QA-006 session clear nhưng sau10s chưa có login CTA; QA-007/008 thiếu notice/consumer. Xem register, không tự biến thành8criticalsecuritybugs.
- Các gap withdraw/return-to-draft/reopen/FR25 và consumer9–10 đã phân loại; không tự sửa nghiệp vụ.

## Nếu tiếp tục sau khi hồi token

1. Audit đã kết thúc với kết luận **demo có điều kiện, chưa nghiệm thu toàn baseline**. Các lỗi chưa sửa vì yêu cầu vẫn là audit only.
2. Nếu người dùng yêu cầu sửa, ưu tiên QA-001 rồi QA-007/008; chỉ sửa trong phạm vi được yêu cầu mới. Giữ PUBLISHED/FINALIZED riêng, immutable history và tất cả guard.
3. Chưa có chỉ dẫn sửa thì chỉ giải thích báo cáo/thiết kế acceptance/thu bằng chứng bổ sung; không tự thay source/schema/dependencies.
4. Test thiếu bằng chứng được liệt kê trong 13-missing-features: UI payload dài, mọi modal/page/sort, screen reader, tải đại diện/memory, SMTP/Supabase/remoteCI, upgrade suites mới và consumer9–10.
5. Không reset/drop/reuse DB đã có dữ liệu cho runner yêu cầu empty. `run-audit.cjs` tạo DB mới mỗi lượt, không cần chạy lại toàn bộ nếu chỉ đọc báo cáo. URL bí mật vẫn chỉ nằm ở `.cache/integration-ui/config.json`, không copy vào report.

## Lỗi harness đã gặp, không phải lỗi sản phẩm

- Lần đầu sandbox không cho spawn git; chạy lại qua quyền thực thi được review.
- NODE_OPTIONS dùng backslash mất escape trên Windows; adapter đã đổi sang forward slash. Lượt fail được giữ riêng.
- Model session trong harness phải là LoginSession, không phải AuthSession; probe hoàn tất ở boundary-complete và diagnosed.
- Form nhóm local read-only do sample OPEN_REGISTRATION; disabled submit không phải lỗi validation. Một capture đầu click header search, không dùng làm chứng cứ form PASS.
- Chờ Playwright route handler trước unroute để không có race; ảnh403/404 được chụp lại sau khi UI ổn định ở ui-followup.

Harness chỉ chứa công cụ thu evidence, không sửa assertion test nguồn. Runtime cache/build/temp đã được loại khỏi bộ bàn giao để tránh đính kèm browser session hoặc artifact dư. DB test vẫn được giữ lại; không dừng phiên UI của người dùng.
