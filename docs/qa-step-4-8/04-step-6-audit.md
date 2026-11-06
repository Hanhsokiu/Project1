# Bước 6 — Chỉnh sửa và phiên bản đề cương

## 1. Nguồn và mục tiêu

Cho SV/GVHD hiện hành sửa theo phản hồi, lưu snapshot bất biến và để SV gửi bản hiện hành, giữ toàn bộ bằng chứng vòng trước. Phạm vi được xác minh tại [scope](01-scope-and-requirements.md), không suy từ tên module. Module liên quan: `backend/src/topic/proposal-versions; frontend/src/features/proposal-versions; shared/src/contracts/proposal-versions.ts`.

## 2. Chức năng và nghiệp vụ

| Chức năng | Vai trò | Điều kiện trước | Đầu vào | Quy tắc / từ chối | Đầu ra / trạng thái | Chứng cứ / triển khai |
| --- | --- | --- | --- | --- | --- | --- |
| Context/list/history | Owner, current advisor, Khoa, assigned reviewer | Quyền đọc từng version | proposalId, versionId, page | Reviewer chỉ SEALED version đã phân | Context/allowedActions/history | API và UI thật |
| Save snapshot | SV hoặc GVHD chính thức | DRAFT/REVISION_REQUESTED, EDIT mở, dossier chưa chốt | Content, basedOnVersionId, expectedRevision, key | Append version; CAS; không sửa version cũ | DRAFT mới + pointer/counter/audit | 24 nhóm PASS; QA-001 nội dung dài FAIL |
| Phản hồi /so sánh | Actor đọc được các bản liên quan | Reference feedback cùng proposal/version | COMMENT/DECISION target và text; hai version IDs | Không response target giả/ trùng; diff JSON thực | Responses snapshot và field diff | API PASS; UI phản hồi decision thật |
| Nộp/ nộp lại | Chỉ SV owner | Nội dung đủ; Topic agreement đúng revision/assignment; current working draft | versionId, expectedRevision, key | Seal immutable; RESUBMISSION giữ vòng cũ | SUBMITTED + SEALED, audit/outbox | API + browser v2 |

## 3. Trạng thái triển khai và state machine

**IMPLEMENTED / PARTIALLY VERIFIED**, không gắn PASS cho toàn tính năng khi còn nhánh acceptance thiếu bằng chứng. Version DRAFT→SEALED, không unseal. Proposal REVISION_REQUESTED→DRAFT khi save rồi SUBMITTED/RESUBMISSION khi submit. SUBMITTED/UNDER_REVIEW/APPROVED hoặc dossier đã chốt không được save trực tiếp. Withdraw chưa có, không đánh dấu transition đó PASS.

## 4. Test cases và kết quả mới

**24 nhóm kịch bản PASS**. Đây là scenario groups, có nested producer prelude; không cộng lặp các assertion của bước trước. Tên dưới đây chính là điều kiện /assertions trong test nguồn, không phải kết quả giả lập.

| ID / bằng chứng | Kịch bản | Kết quả |
| --- | --- | --- |
| [STEP6-01](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | active migration replay and all 27 Step 5 real HTTP checks run as the producer prelude | PASS |
| [STEP6-02](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | version reads enforce JWT, owner/term scope and no ADMIN wildcard | PASS |
| [STEP6-03](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | missing PROPOSAL_EDIT mapping fails closed without creating a version | PASS |
| [STEP6-04](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | only SV/current official GVHD edit; PUBLISHED never grants advisor rights | PASS |
| [STEP6-05](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | strict DTO and feedback references reject forged actor, duplicate and cross-proposal response | PASS |
| [STEP6-06](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | create v2 from returned v1, preserve v1/decision exactly, record editor/time/summary/response | PASS |
| [STEP6-07](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | save idempotency replays one snapshot and never duplicates audit | PASS |
| [STEP6-08](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | account revocation is checked before returning cached snapshot | PASS |
| [STEP6-09](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | reviewer cannot read/compare draft or another proposal; faculty scoped reads remain available | PASS |
| [STEP6-10](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | real JSON comparison includes content and revision responses | PASS |
| [STEP6-11](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | database rejects rewriting old and new snapshot payloads or response metadata | PASS |
| [STEP6-12](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | only student submits current v2, seals immutable snapshot and records RESUBMISSION once | PASS |
| [STEP6-13](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | submitted and sealed snapshots cannot be edited or unsealed | PASS |
| [STEP6-14](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | Step 5 reviews v2 in a new round while old reviewer comments/decision remain linked to v1 | PASS |
| [STEP6-15](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | incomplete draft saves successfully but cannot be submitted or partially sealed | PASS |
| [STEP6-16](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | current official advisor appends a new snapshot and inherits prior response evidence | PASS |
| [STEP6-17](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | stale Topic agreement blocks submission without inventing advisor confirmation | PASS |
| [STEP6-18](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | concurrent SV/GVHD edits produce one CAS winner without overwriting the other snapshot | PASS |
| [STEP6-19](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | audit failure rolls back snapshot, pointer, counter and revision atomically | PASS |
| [STEP6-20](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | concurrent phase closure blocks a waiting save and preserves the last snapshot | PASS |
| [STEP6-21](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | advisor handover revokes old advisor edit access and does not auto-confirm Topic for the new advisor | PASS |
| [STEP6-22](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | APPROVED proposal is read-only and Step 6 never reopens/finalizes it | PASS |
| [STEP6-23](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | finalized dossier blocks direct edits even if Proposal status is inconsistent | PASS |
| [STEP6-24](evidence/20261026144939_2663ec/step6/generated/step6-results.json) | v1 payload, metadata, reviewer and decision are preserved after every revision cycle | PASS |

## 5. Hành vi trình duyệt thực

Sửa mục tiêu, phản hồi DECISION, lưu v2 và nộp lại qua browser thật. Error detail không tồn tại hiển thị đúng sau retry; ảnh đầu chụp loading không được tính là error-state đạt. Session recovery QA-006; form nội dung dài qua UI trực tiếp NOT VERIFIED, lỗi API cùng contract đã xác nhận. [Live E2E](evidence/20261026144939_2663ec/live-e2e/live-browser.json), [UI local](evidence/20261026144939_2663ec/ui-local/ui-results.json), [UI bổ sung](evidence/20261026144939_2663ec/ui-boundaries-final/results.json).

## 6. Lỗi đã xác nhận

QA-001 là confirmed P2, không phải rủi ro suy ra từ code: request authenticated thật, DTO hợp lệ, body parser/global handler trả 500. QA-008: submit outbox chưa có delivery consumer. Chi tiết [bug register](12-confirmed-bugs.md), không tự sửa trong audit.

## 7. Chức năng còn thiếu / chưa xác minh

Withdraw/return-to-draft/reopen chưa nghiệm thu; scope GAP-01. Không có autosave server là giới hạn đã ghi trong D07, không tự coi là missing feature. Các giới hạn chung ở [scope](01-scope-and-requirements.md) và [missing features](13-missing-features.md).

## 8. UI/UX

Không có React pageerror trong lượt mở 29 route desktop/3 mobile. Điều đó không chứng nhận tất cảinteractions. [UI/UX report](07-ui-ux-report.md) phân biệt lỗi, empty/readiness và harness capture chưa ổn định.

## 9. API

24 nhóm: strict DTO, writer/scope, immutable snapshots, CAS SV/GV đồng thời, rebase, stale agreement, phase closure/audit rollback. Boundary riêng: small-save 201; payload hợp lệ 110.377 byte trả 500 (QA-001); thiếu field/type sai/actor injection400; invalid token/expired session401. [71-operation matrix](evidence/20261026144939_2663ec/api-operation-matrix.json) ghi riêng auth và authenticated statuses thực sự quan sát.

## 10. Database

ProposalVersion và version metadata cũ giữ nguyên; lỗi lưu dài không append partial version (count 2→2). Counter/pointer/revision/audit rollback cùng transaction trong suite. [DB audit](09-database-audit.md). Không migration/schema change trong audit.

## 11. Phân quyền

GVHD save được nhưng không submit hộ SV. Handover thu hồi GVHD cũ; PUBLISHED không cấp quyền. Reviewer không đọc /compare draft hoặc proposal khác; Khoa đọc theo grant. [RBAC report](10-rbac-security-report.md).

## 12. Tích hợp

Bước 3 prepare-workflow bảo toàn snapshot nguồn, tạo draft provenance, thiếu field bắt buộc phải bổ sung. Regression handoff thực đã PASS. V2 sau submit được phân review vòng mới và chốt đúng v2 ở bước 7. [Integration report](11-integration-e2e-report.md).

## 13. Đề xuất và thứ tự ưu tiên

P2: thống nhất byte budget UTF-8 frontend/shared/parser, map oversize về lỗi có nghĩa; giữ hard cap và bảo toàn draft. Không nâng JSON limit vô hạn hoặc giảm contract âm thầm.

## 14. Điều kiện nghiệm thu

Small và valid-large save qua API+UI đều đạt theo cap đã duyệt; quá cap trả 413 có envelope, không ghi dở; snapshot/revision/race giữ nguyên. Không nghiệm thu toàn bộ step6 khi QA-001 còn mở. Mỗi nhánh chưa chạy tiếp tục NOT VERIFIED; không suy phần trăm hoàn thiện từ số test xanh.
