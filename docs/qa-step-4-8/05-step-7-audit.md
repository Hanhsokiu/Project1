# Bước 7 — Chốt hồ sơ, PDF và giấy

## 1. Nguồn và mục tiêu

Khoa chốt bản đã được duyệt chính xác, đóng băng biểu mẫu đủ hồ sơ, cho tải PDF riêng tư và ghi nhận nộp giấy bằng bằng chứng độc lập. Phạm vi được xác minh tại [scope](01-scope-and-requirements.md), không suy từ tên module. Module liên quan: `backend/src/topic/proposal-dossiers; frontend/src/features/proposal-dossiers; shared/src/contracts/proposal-dossiers.ts`.

## 2. Chức năng và nghiệp vụ

| Chức năng | Vai trò | Điều kiện trước | Đầu vào | Quy tắc / từ chối | Đầu ra / trạng thái | Chứng cứ / triển khai |
| --- | --- | --- | --- | --- | --- | --- |
| Dossier/context/preview | Khoa, owner, current advisor | Grant/ownership; profile lớp / ngành và version hợp lệ | proposalId, version/finalization IDs | Không đoán profile hoặc approval | Snapshot preview/readiness | API; toàn bố cục mẫu DOCX NOT VERIFIED |
| Finalize | Khoa đúng grant | APPROVED đúng SEALED version, đủ content/profile, review phase mở | approvedVersionId, revision, key | Unique/CAS; frozen print snapshot + hash | FINALIZED + actor/time; chưa có receipt | Concurrent/idempotent/rollback + UI thật |
| Generate/download PDF | Owner, current advisor, scoped Khoa | Đã finalized; permission export; private asset đúng parent | finalizationId/key | Render Unicode/A4; download recheck scope/checksum | Private PDF; không suy chữ ký hay receipt | Real browser PDF + parse bounds + long table |
| Tiếp nhận giấy | Khoa | Finalized version đúng, review phase cho phép, scope/revision | Receipt input, key | Một receipt/finalization, server actor/time, immutable audit | RECEIVED tách finalize/download | API PASS; mọi biến thể UI receipt modal NOT VERIFIED |

## 3. Trạng thái triển khai và state machine

**IMPLEMENTED / PARTIALLY VERIFIED**, không gắn PASS cho toàn tính năng khi còn nhánh acceptance thiếu bằng chứng. DRAFT→FINALIZED→RECEIVED; APPROVED là trạng thái Proposal riêng. REOPENED có trong data contract nhưng command reopen producer chưa hoàn thiện. Tải/xuất PDF không chuyển FINALIZED thành RECEIVED và không giả chữ ký số.

## 4. Test cases và kết quả mới

**19 nhóm kịch bản PASS**. Đây là scenario groups, có nested producer prelude; không cộng lặp các assertion của bước trước. Tên dưới đây chính là điều kiện /assertions trong test nguồn, không phải kết quả giả lập.

| ID / bằng chứng | Kịch bản | Kết quả |
| --- | --- | --- |
| [STEP7-01](evidence/20261026144939_2663ec/step7/generated/step7-results.json) | active migration chain/checksums and 27 Step 5 API producer checks replay successfully | PASS |
| [STEP7-02](evidence/20261026144939_2663ec/step7/generated/step7-results.json) | valid Step 6 resubmission and Step 5 APPROVED decision provide exact input to finalization | PASS |
| [STEP7-03](evidence/20261026144939_2663ec/step7/generated/step7-results.json) | missing producer class/major blocks finalize and never invents official metadata | PASS |
| [STEP7-04](evidence/20261026144939_2663ec/step7/generated/step7-results.json) | faculty/student/advisor scopes, cross-term/department and ADMIN denial do not trust JWT roles | PASS |
| [STEP7-05](evidence/20261026144939_2663ec/step7/generated/step7-results.json) | unapproved proposals and approved but incomplete legacy content cannot finalize | PASS |
| [STEP7-06](evidence/20261026144939_2663ec/step7/generated/step7-results.json) | faculty preview uses confirmed producer profile; stale/cross-proposal approved version is rejected | PASS |
| [STEP7-07](evidence/20261026144939_2663ec/step7/generated/step7-results.json) | audit failure rolls back dossier, finalization, pointers and revisions atomically | PASS |
| [STEP7-08](evidence/20261026144939_2663ec/step7/generated/step7-results.json) | routing changed after approval cannot silently finalize under stale review evidence | PASS |
| [STEP7-09](evidence/20261026144939_2663ec/step7/generated/step7-results.json) | concurrent finalize commits once; exact approvedVersionId/time stored separately from PDF and receipt | PASS |
| [STEP7-10](evidence/20261026144939_2663ec/step7/generated/step7-results.json) | duplicate same-key request replays one finalization; different payload conflicts | PASS |
| [STEP7-11](evidence/20261026144939_2663ec/step7/generated/step7-results.json) | DB and API preserve finalized snapshot and the SEALED approved version | PASS |
| [STEP7-12](evidence/20261026144939_2663ec/step7/generated/step7-results.json) | student creates private PDF once; PDF generation never claims a signature or physical submission | PASS |
| [STEP7-13](evidence/20261026144939_2663ec/step7/generated/step7-results.json) | authenticated PDF download rechecks ownership/current advisor/grants and blocks ID tampering and ADMIN | PASS |
| [STEP7-14](evidence/20261026144939_2663ec/step7/generated/step7-results.json) | real PDF text extraction verifies Vietnamese Unicode, all required fields, A4 and page bounds | PASS |
| [STEP7-15](evidence/20261026144939_2663ec/step7/generated/step7-results.json) | long content and oversized schedule rows paginate, repeat table header and retain all final rows/signatures | PASS |
| [STEP7-16](evidence/20261026144939_2663ec/step7/generated/step7-results.json) | changes to live catalog/profile do not alter official snapshot or stored PDF bytes | PASS |
| [STEP7-17](evidence/20261026144939_2663ec/step7/generated/step7-results.json) | receipt requires scoped faculty and open review phase; historical PDF reads remain available when phase locks | PASS |
| [STEP7-18](evidence/20261026144939_2663ec/step7/generated/step7-results.json) | physical receipt has server actor/time, unique finalization, immutable evidence and idempotent atomic audit | PASS |
| [STEP7-19](evidence/20261026144939_2663ec/step7/generated/step7-results.json) | grant revocation blocks cached replay and approved version remains unchanged after finalization/PDF/receipt | PASS |

## 5. Hành vi trình duyệt thực

Khoa finalize v2, SV tạo/tải PDF thật. Đã xem screenshot dashboard liên quan đầu ra; file PDF được parse text và A4/bounds, không thay thế nghiệm thu trực quan đủ bốn chữ ký /bố cục DOCX bởi Khoa. [Live E2E](evidence/20261026144939_2663ec/live-e2e/live-browser.json), [UI local](evidence/20261026144939_2663ec/ui-local/ui-results.json), [UI bổ sung](evidence/20261026144939_2663ec/ui-boundaries-final/results.json).

## 6. Lỗi đã xác nhận

Không có confirmed bug mới về chốt /snapshot/PDF/private download trong các ca này. QA-002/003/004/006 ảnh hưởng workspace dùng chung; thiếu producer reopen là gap, không lỗi tự mất dữ liệu. Chi tiết [bug register](12-confirmed-bugs.md), không tự sửa trong audit.

## 7. Chức năng còn thiếu / chưa xác minh

Reopen producer/approval workflow cần phối hợp; layout mẫu gốc đầy đủ chưa được người dùng nghiệm thu trực quan. Không gọi e-signature/scan bắt buộc là missing vì baseline dùng chữ ký giấy và scan optional. Các giới hạn chung ở [scope](01-scope-and-requirements.md) và [missing features](13-missing-features.md).

## 8. UI/UX

Không có React pageerror trong lượt mở 29 route desktop/3 mobile. Điều đó không chứng nhận tất cảinteractions. [UI/UX report](07-ui-ux-report.md) phân biệt lỗi, empty/readiness và harness capture chưa ổn định.

## 9. API

19 nhóm: profile missing, incomplete legacy, routing stale, CAS/idempotency, grants revoked, audit rollback, ID tampering, receipt guards. Không đủ chứng cứ từng field/date boundary cho mọi receipt request. [71-operation matrix](evidence/20261026144939_2663ec/api-operation-matrix.json) ghi riêng auth và authenticated statuses thực sự quan sát.

## 10. Database

DossierFinalization đóng băng approvedVersionId/content/profile/template/hash/actor/time. Thay catalog sau chốt không đổi bytes/snapshot. Race finalize một winner; audit lỗi rollback pointer/revision. E2E có 1 finalization,0 receipt vì luồng đó chưa nhận giấy; suite step7 riêng đã kiểm receipt. [DB audit](09-database-audit.md). Không migration/schema change trong audit.

## 11. Phân quyền

FACULTY finalize/receive trong grant; owner/advisor chỉ export/read. ADMIN, người khác, reviewer thuần và ID sai không tải PDF private. [RBAC report](10-rbac-security-report.md).

## 12. Tích hợp

Người1 cung cấp lớp / ngành thật; thiếu phải chặn finalize. Guidance plan bước8 tạo sau FINALIZED, không cần RECEIVED. Consumer9–10 phải đọc approvedVersionId/currentFinalization thay vì chỉ Proposal.APPROVED. [Integration report](11-integration-e2e-report.md).

## 13. Đề xuất và thứ tự ưu tiên

Giữ cơ chế fail-closed khi thiếu profile, không thêm form đoán lớp / ngành để demo. Bổ sung acceptance visual và luồng reopen được giao đúng owner.

## 14. Điều kiện nghiệm thu

19 nhóm và actual PDF download tiếp tục PASS; Khoa xác nhận bố cục mẫu; receipt chỉ được ghi khi nhận giấy thật trong vận hành. Không thay dữ liệu test thành bằng chứng nhận hồ sơ thật. Mỗi nhánh chưa chạy tiếp tục NOT VERIFIED; không suy phần trăm hoàn thiện từ số test xanh.
