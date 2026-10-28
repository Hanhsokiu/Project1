# Bước 5 — Phân công và xét duyệt

## 1. Nguồn và mục tiêu

Phân đúng snapshot đã nộp tới nhóm đúng bộ môn, cho reviewer hợp lệ ghi comments và một kết luận chung cho mỗi vòng. Phạm vi được xác minh tại [scope](01-scope-and-requirements.md), không suy từ tên module. Module liên quan: `backend/src/topic/proposal-reviews; frontend/src/features/proposal-reviews; shared/src/contracts/proposal-reviews.ts`.

## 2. Chức năng và nghiệp vụ

| Chức năng | Vai trò | Điều kiện trước | Đầu vào | Quy tắc / từ chối | Đầu ra / trạng thái | Chứng cứ / triển khai |
| --- | --- | --- | --- | --- | --- | --- |
| Queue/candidates/history | Khoa, owner, GVHD, reviewer trong scope | Permission + grant/ownership/assigned round | termId, filters, proposalId | Candidate chỉ gợi ý; GET không phân công | Page/history có scope | API + list UI |
| Phân công / phân lại | Khoa | SubmittedVersion SEALED; official assignment FINALIZED; routing/phase hợp lệ | groupId, proposalVersionId, proposal/review revision, reason nếu thay | Một active round; supersede vòng cũ atomic | Review ASSIGNED, exact version + round counter | CAS/race/phase-lock/rollback + E2E |
| Bắt đầu và góp ý | Member của nhóm được phân, không GVHD hồ sơ | Đúng roster/phase/current version; vòng chưa DECIDED | Comment hoặc start + expected revisions | Nhiều comments; start rõ ràng trước decision | IN_REVIEW/UNDER_REVIEW; comment append | API + E2E start |
| Kết luận chung | Reviewer hợp lệ | IN_REVIEW, exact current SEALED version, CAS | APPROVED hoặc REVISION_REQUIRED; comment bắt buộc khi sửa | Unique decision/vòng; không thu vote; không tự finalize | DECIDED + APPROVED/REVISION_REQUESTED; audit/outbox | Race/duplicate/rollback PASS; QA-008 notification gap |

## 3. Trạng thái triển khai và state machine

**IMPLEMENTED / PARTIALLY VERIFIED**, không gắn PASS cho toàn tính năng khi còn nhánh acceptance thiếu bằng chứng. ASSIGNED→IN_REVIEW→DECIDED, phân lại →SUPERSEDED. Proposal SUBMITTED→UNDER_REVIEW→APPROVED/REVISION_REQUESTED. Decision APPROVED không đồng nghĩa dossier FINALIZED hoặc receipt RECEIVED.

## 4. Test cases và kết quả mới

**27 nhóm kịch bản PASS**. Đây là scenario groups, có nested producer prelude; không cộng lặp các assertion của bước trước. Tên dưới đây chính là điều kiện /assertions trong test nguồn, không phải kết quả giả lập.

| ID / bằng chứng | Kịch bản | Kết quả |
| --- | --- | --- |
| [STEP5-01](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | active migration chain replays with matching history/checksums | PASS |
| [STEP5-02](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | Swagger exposes step 5 assignment/decision endpoints | PASS |
| [STEP5-03](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | 401, ADMIN deny despite permission and forged claims, cross-term/department isolation | PASS |
| [STEP5-04](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | specialty candidates are advisory, scoped and have no assignment side effects | PASS |
| [STEP5-05](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | cross-term and wrong-department group assignment rejected | PASS |
| [STEP5-06](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | assignment binds submitted version, actor, history, idempotency and duplicate-active guard | PASS |
| [STEP5-07](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | only assigned roster members or academic owners/advisors read; faculty cannot review as faculty | PASS |
| [STEP5-08](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | owner/current advisor read scoped evidence but cannot comment or decide as reviewers | PASS |
| [STEP5-09](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | decision before explicit start is an invalid transition | PASS |
| [STEP5-10](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | valid assign → comments by multiple members → explicit start flow | PASS |
| [STEP5-11](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | concurrent decisions commit exactly once; APPROVED never finalizes a dossier | PASS |
| [STEP5-12](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | decided rounds reject later comments/decisions | PASS |
| [STEP5-13](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | revision-required needs comment, preserves canonical result and legacy state, replay emits one outbox event | PASS |
| [STEP5-14](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | revoked account cannot replay cached academic response | PASS |
| [STEP5-15](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | new submitted version blocks stale decision and never leaks the unassigned content to reviewer | PASS |
| [STEP5-16](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | reassignment atomically supersedes prior round with reason and preserves scoped history | PASS |
| [STEP5-17](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | missing producer counter fails closed, never guessed/backfilled | PASS |
| [STEP5-18](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | locked phase blocks assignment | PASS |
| [STEP5-19](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | audit failure rolls back assignment, revisions and idempotency atomically | PASS |
| [STEP5-20](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | concurrent assignments create exactly one active round | PASS |
| [STEP5-21](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | second term review remains isolated from first-term reviewer | PASS |
| [STEP5-22](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | step 5 does not implement/fabricate dossier, guidance or task workflows | PASS |
| [STEP5-23](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | phase lock racing with assignment commits first and prevents the blocked assignment | PASS |
| [STEP5-24](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | concurrent comments honor review revision and reject stale append | PASS |
| [STEP5-25](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | PUBLISHED is not official and obsolete Topic agreement never enables assignment | PASS |
| [STEP5-26](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | routing revision change requires explicit faculty reassignment before review can continue | PASS |
| [STEP5-27](evidence/20261026144939_2663ec/step5/generated/step5-results.json) | malformed legacy review pointing to an unsealed version never exposes draft content | PASS |

## 5. Hành vi trình duyệt thực

Khoa phân v1, reviewer yêu cầu sửa; sau SV nộp v2, Khoa phân vòng mới và reviewer duyệt đúng v2 qua UI thật. Không kiểm hết sort/pagination/Cancel và mọi state change từ nhiều tab trên UI. [Live E2E](evidence/20261026144939_2663ec/live-e2e/live-browser.json), [UI local](evidence/20261026144939_2663ec/ui-local/ui-results.json), [UI bổ sung](evidence/20261026144939_2663ec/ui-boundaries-final/results.json).

## 6. Lỗi đã xác nhận

QA-008: OutboxEvent PROPOSAL_REVIEW_DECIDED tồn tại nhưng không có consumer/notice tương ứng sau luồng thật. Cần phân biệt event đã commit và người dùng đã nhận thông báo. Chi tiết [bug register](12-confirmed-bugs.md), không tự sửa trong audit.

## 7. Chức năng còn thiếu / chưa xác minh

GAP-01: endpoint withdraw/return-to-draft còn thiếu so với D06/§5.2. Phạm vi giao việc/reopen producer phải được chốt, không sửa trong audit. Các giới hạn chung ở [scope](01-scope-and-requirements.md) và [missing features](13-missing-features.md).

## 8. UI/UX

Không có React pageerror trong lượt mở 29 route desktop/3 mobile. Điều đó không chứng nhận tất cảinteractions. [UI/UX report](07-ui-ux-report.md) phân biệt lỗi, empty/readiness và harness capture chưa ổn định.

## 9. API

27 nhóm kiểm assignment, reviewer conflict, stale version, concurrent comments/decisions/assignments, grant/account revocation, phase lock, routing revision. Thiếu withdraw/return-to-draft theo baseline được ghi GAP-01, không giả định có API. [71-operation matrix](evidence/20261026144939_2663ec/api-operation-matrix.json) ghi riêng auth và authenticated statuses thực sự quan sát.

## 10. Database

ProposalReviewWorkflow gắn versionId/roundNumber; unique active và decision; lỗi audit không để lại partial assignment/counter/idempotency. V1 decision không chuyển sang v2. [DB audit](09-database-audit.md). Không migration/schema change trong audit.

## 11. Phân quyền

FACULTY có quyền phân không tự là reviewer; owner/GVHD có quyền đọc không tự được kết luận. Reviewer chỉ đọc bản đã được phân, không lấy draft mới chưa phân. ADMIN/foreign term bị từ chối. [RBAC report](10-rbac-security-report.md).

## 12. Tích hợp

PUBLISHED không đủ official assignment. Bộ môn/routing đổi cần phân lại rõ ràng. Đầu ra APPROVED+exact version được bước 7 tiêu thụ, không tạo dossier/guidance ngầm. [Integration report](11-integration-e2e-report.md).

## 13. Đề xuất và thứ tự ưu tiên

P2: xử lý notification consumer và quyết định phạm vi đường trả nháp. Giữ một common decision, exact version, no-advisor-review và active-round guard.

## 14. Điều kiện nghiệm thu

27 nhóm và E2E hai vòng PASS sau thay đổi; acceptance thông báo có recipient/count/link/idempotency/rollback; demo không tuyên bố đã có withdraw hay email cho event này. Mỗi nhánh chưa chạy tiếp tục NOT VERIFIED; không suy phần trăm hoàn thiện từ số test xanh.
