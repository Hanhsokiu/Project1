# Kiểm toán chất lượng bước 4–8

> **Có lượt sửa sau audit:** xem [báo cáo sửa UI và retest ngày 27/10/2026](../implementation/integration-ui-fixes-2026-10-27.md). Phần dưới là snapshot audit trước khi sửa, không dùng để suy trạng thái hiện tại.

Ngày báo cáo: **27/10/2026, UTC+7**. Các lần chạy lưu timestamp UTC riêng; lượt chính bắt đầu `2026-10-26T14:49:39Z`, kiểm tra bổ sung diễn ra sau đó. **AUDIT ONLY**: không sửa source/schema/dependencies, không reset DB, không commit/push/merge.

**Kết luận: có thể demo luồng chính có điều kiện; chưa đủ căn cứ nghiệm thu toàn bộ baseline bước 4–8.** Luồng thật hoạt động, nhưng đề cương UTF-8 dài bị lỗi 500, có khoảng trống thông báo /khôi phục nghiệp vụ và lỗi UX/accessibility.

## Đối tượng và bằng chứng

- Nhánh thực tế `fix/integration-ui`, HEAD `0c361709df34837df65b3ed429691599e6e2d93f`, bản đã tích hợp develop. Không chuyển nhánh về feature cũ.
- Source ứng dụng bước 4–8 không thay đổi trong audit. README/package/lockfile/scripts UI local đã modified/untracked từ trước; giữ nguyên. 416 file được hash trước /sau verification, không đổi.
- Dùng PostgreSQL 17 loopback cổng 55451, database test mới tên `btl_pr2b_audit_*`, fixture tổng hợp; không dùng Supabase/backend `.env` làm đích DB.
- Không có Playwright MCP trong phiên; dùng Playwright đã cài + Microsoft Edge thật. Không cài package.
- Kết quả mới: [run-summary](evidence/20261026144939_2663ec/run-summary.json), [test matrix](evidence/20261026144939_2663ec/test-case-matrix.json), [manifest](evidence/manifest-sha256.json). Kết quả lịch sử không được tính lại thành PASS mới.

## Kiểm tra đã thực hiện

| Kiểm tra | Kết quả / giới hạn |
| --- | --- |
| API + DB bước 4/5/6/7/8A/8B/8C | **154 nhóm kịch bản PASS**, gồm CAS, idempotency, rollback, race khóa phase, IDOR và private file |
| Browser E2E thật 4→5→6→7→8A→8B→8C | **15 checkpoint PASS**, không mock API |
| Inventory auth API | **71 operation**: anonymous bị từ chối; account không permission bị từ chối đúng, trừ notification cá nhân theo contract |
| Authenticated success trong traffic live | Có 2xx ở **34/71 operation**; không suy 37 operation còn lại đã kiểm happy path riêng chỉ từ inventory |
| Legacy topic/registration security | 4 probe cũ hiện **PASS**, trả 403, không lộ row ngoài phạm vi |
| Handoff bước 3→4–8 | Regression publish riêng finalize, bảo toàn snapshot, chặn writer legacy: **PASS** |
| UI local | 29 lần mở route desktop; 3 mobile; error/loading/navigation/session probes. Không pageerror hoặc HTTP 5xx trong lượt mở màn hình thông thường |
| Accessibility | Login không có violation trong scan; form nhóm có ARIA sai; workspace có contrast không đạt ở các node được ghi nhận |
| Prisma/typecheck/build | PASS; build output chuyển vào thư mục báo cáo |
| Unit tests | Backend **181/181**, frontend **115/115** PASS |
| Database sau E2E | 12 checksum migration khớp; kiểm **211 FK không có orphan** trong fixture; COMPLETED có effective PASS |
| Payload boundary bổ sung | Nội dung hợp lệ **110.377 byte → HTTP 500**, control nhỏ →201; không ghi dở version |

PASS ở đây là kết quả kịch bản cụ thể, không phải tỷ lệ hoàn thiện sản phẩm. Không tính phần trăm vì chưa có tập acceptance requirements đầy đủ được nghiệm thu.

## Các vấn đề ưu tiên

Chi tiết chuẩn tái hiện ở [12-confirmed-bugs](12-confirmed-bugs.md). Không pháthiện P0/P1 trong các ca đã chạy; điều này không chứng minh toàn hệ thống không có P0/P1.

| ID | Mức | Loại | Vấn đề |
| --- | --- | --- | --- |
| QA-001 | P2 | CONFIRMED BUG | Đề cương UTF-8 hợp lệ theo DTO bị JSON transport từ chối và trả 500 |
| QA-007 | P2 | BUSINESS LOGIC GAP, có bằng chứng | Tạo task/ nộp bài không tạo thông báo cho người nhận như UC14/15 |
| QA-008 | P2 | BUSINESS LOGIC GAP, có bằng chứng | Kết luận / nộp lại đề cương chỉ có OutboxEvent; chưa có consumer để trở thành thông báo người dùng |
| QA-006 | P3 | UI/UX ISSUE | Session bị xóa sau 401 nhưng màn workflow còn đứng ở lỗi, thiếu đường đăng nhập lại |
| QA-002 | P3 | UI/UX ISSUE | Sidebar hiển thị chức năng không dành cho SV, click đi tới 403 |
| QA-003 | P3 | UI/UX ISSUE / DEPENDENCY GAP | Sidebar có link hội đồng / kết quảnhưng router hiện không có trang tương ứng |
| QA-004 | P3 | UI/UX ISSUE | Contrast một số chữ nhỏ không đạt WCAG AA trong scan |
| QA-005 | P3 | UI/UX ISSUE | `aria-label` trên div không có role phù hợp ở danh sách thành viên |

Không bịa đủ “10 lỗi nghiêm trọng ”. Hai mục ưu tiên bổ sung trong danh sách review là **GAP-01 withdraw/return-to-draft/reopen chưa có producer hoàn chỉnh** và **RISK-01 serialize/N+1 khi tải tăng**; đây không phải hai bug runtime đã xác nhận mới.

## Cần làm tiếp

1. Chốt và sửa JSON byte budget/error mapping; regression bằng API authenticated + UI nội dung dài.
2. Bổ sung thông báo giao task/ nộp bài / kết luận đề cương theo contract, không tự thêm SMTP gửi ra ngoài.
3. Xác nhận phạm vi/owner cho withdraw, return-to-draft, reopen, criteria giai đoạn trước PR chức năng.
4. Sửa sidebar/session/accessibility rồi chạy lại browser regression.
5. Đo tải đại diện và kiểm các consumer 9–10 khi có bản triển khai; không coi PASS task là điểm/ đủ bảo vệ.

Đường đọc báo cáo: [phạm vi](01-scope-and-requirements.md) → báo cáo từng bước 02–06 → [bugs](12-confirmed-bugs.md) → [roadmap](14-improvement-roadmap.md) → [verdict](15-final-qa-verdict.md). Tiến độ bàn giao được lưu ở [RESUME](RESUME.md).
