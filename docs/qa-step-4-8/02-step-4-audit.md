# Bước 4 — Nhóm duyệt đề cương

## 1. Nguồn và mục tiêu

Khoa tổ chức nhóm giảng viên duyệt đúng đợt / bộ môn, cấp quyền qua membership mà không cấp quyền học thuật toàn hệ thống. Phạm vi được xác minh tại [scope](01-scope-and-requirements.md), không suy từ tên module. Module liên quan: `backend/src/topic/review-groups; frontend/src/features/review-groups; shared/src/contracts/review-groups.ts`.

## 2. Chức năng và nghiệp vụ

| Chức năng | Vai trò | Điều kiện trước | Đầu vào | Quy tắc / từ chối | Đầu ra / trạng thái | Chứng cứ / triển khai |
| --- | --- | --- | --- | --- | --- | --- |
| Danh sách/options/chi tiết | Khoa trong grant; GV là member | JWT + permission + roster/scope | termId, page/limit/search/departmentId | Intersect scope trước phân trang | Page/GroupView; không ghi dữ liệu | 31 nhóm test + browser tạo/ đọc thật |
| Tạo nhóm | Khoa | Đợt cho phép quản lý, grant bộ môn, member hoạt động trong roster | Tên, bộ môn, memberIds, Idempotency-Key | Strict DTO, chống trùng member, kiểm eligibility | Nhóm + workflow + audit atomic | API và browser thật |
| Sửa/thêm/xóa thành viên | Khoa | Revision đúng, không có vòng active/legacy chưa đối soát | revision, thay đổi member, key | CAS; lịch sử append; loại member thu hồi quyền | Revision tăng, membership history giữ nguyên | Race, stale, rollback PASS |
| Archive nhóm | Khoa | Scope/revision hợp lệ, references được giữ | Nhóm, revision, key | Soft delete, không cascade mất hồ sơ | Nhóm ngừng dùng, member/review history còn | API PASS; modal xác nhận mọi biến thể NOT VERIFIED |

## 3. Trạng thái triển khai và state machine

**IMPLEMENTED / PARTIALLY VERIFIED**, không gắn PASS cho toàn tính năng khi còn nhánh acceptance thiếu bằng chứng. Nhóm dùng archivedAt và revision; không tự thêm trạng thái PUBLISHED/FINALIZED cho nhóm. Đợt CLOSED chỉ đọc. Có ASSIGNED/IN_REVIEW chặn thay membership; archive không làm mất references.

## 4. Test cases và kết quả mới

**31 nhóm kịch bản PASS**. Đây là scenario groups, có nested producer prelude; không cộng lặp các assertion của bước trước. Tên dưới đây chính là điều kiện /assertions trong test nguồn, không phải kết quả giả lập.

| ID / bằng chứng | Kịch bản | Kết quả |
| --- | --- | --- |
| [STEP4-01](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | active migration chain replays without reset/drop | PASS |
| [STEP4-02](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | migration history checksums match applied files | PASS |
| [STEP4-03](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | Swagger exposes step4 routes and response DTO | PASS |
| [STEP4-04](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | unauthenticated API denied | PASS |
| [STEP4-05](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | faculty creates department/term group with valid member | PASS |
| [STEP4-06](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | idempotent create replays without duplicate audit | PASS |
| [STEP4-07](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | idempotency key payload conflict rejected | PASS |
| [STEP4-08](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | cached create response cannot bypass revoked department scope | PASS |
| [STEP4-09](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | duplicate array validation | PASS |
| [STEP4-10](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | unknown input fields rejected | PASS |
| [STEP4-11](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | cross-term inactive missing role and nonexistent members denied | PASS |
| [STEP4-12](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | faculty cannot cross department or term grants | PASS |
| [STEP4-13](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | lecturer reads only membership and faculty only granted department | PASS |
| [STEP4-14](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | ADMIN/student cannot bypass policy even with permissions and forged role claims | PASS |
| [STEP4-15](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | lecturer cannot manage groups | PASS |
| [STEP4-16](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | cross-round lecturer access denied | PASS |
| [STEP4-17](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | pagination and name filter intersect scope | PASS |
| [STEP4-18](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | pagination bounds enforced | PASS |
| [STEP4-19](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | update CAS and stale revision rejection | PASS |
| [STEP4-20](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | add valid roster member including other home department | PASS |
| [STEP4-21](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | existing membership duplicate rejected | PASS |
| [STEP4-22](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | remove member revokes access and preserves membership history | PASS |
| [STEP4-23](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | membership changes recorded append-only | PASS |
| [STEP4-24](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | concurrent updates have one CAS winner | PASS |
| [STEP4-25](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | audit failure rolls back revision membership and history | PASS |
| [STEP4-26](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | unresolved legacy review blocks membership changes | PASS |
| [STEP4-27](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | active assigned round blocks membership mutation | PASS |
| [STEP4-28](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | assigned group deletion preserves proposal references | PASS |
| [STEP4-29](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | soft deletion and retry preserve group member history | PASS |
| [STEP4-30](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | closed term remains read-only | PASS |
| [STEP4-31](evidence/20261026144939_2663ec/step4/generated/step4-results.json) | lecturer options do not expose full roster | PASS |

## 5. Hành vi trình duyệt thực

List/options/empty/new/detail được mở thật; E2E tạo nhóm với member hợp lệ. Local sample còn OPEN_REGISTRATION nên canManage=false và nút tạo bị vô hiệu là precondition hợp lệ, không phải lỗi mất quyền. Scan form pháthiện QA-004/005; sidebar QA-002/003. Ca ban đầu gọi empty-submit trên header search không dùng để kết luận form validation PASS. [Live E2E](evidence/20261026144939_2663ec/live-e2e/live-browser.json), [UI local](evidence/20261026144939_2663ec/ui-local/ui-results.json), [UI bổ sung](evidence/20261026144939_2663ec/ui-boundaries-final/results.json).

## 6. Lỗi đã xác nhận

QA-002/003/004/005 thuộc workspace dùng chung. Không tái hiện lỗi service 500 khi sửa nhóm như ảnh CI cũ: update/member/concurrency hiện PASS. Chi tiết [bug register](12-confirmed-bugs.md), không tự sửa trong audit.

## 7. Chức năng còn thiếu / chưa xác minh

Không pháthiện thiếu CRUD cốt lõi trong baseline đã kiểm. Không kiểm đủ mọi tương tác cancel/modal/pagination UI với dữ liệu lớn. Các giới hạn chung ở [scope](01-scope-and-requirements.md) và [missing features](13-missing-features.md).

## 8. UI/UX

Không có React pageerror trong lượt mở 29 route desktop/3 mobile. Điều đó không chứng nhận tất cảinteractions. [UI/UX report](07-ui-ux-report.md) phân biệt lỗi, empty/readiness và harness capture chưa ổn định.

## 9. API

DTO, pagination, account revocation trước replay, forged role/ADMIN, grants, cross-term, idempotency, CAS và audit rollback có test. Không có 15 negative variants độc lập cho từng endpoint. [71-operation matrix](evidence/20261026144939_2663ec/api-operation-matrix.json) ghi riêng auth và authenticated statuses thực sự quan sát.

## 10. Database

ReviewGroup + workflow/membership history; nhiều updates cạnh tranh có một winner. Lỗi audit rollback revision/member/history. Không sửa schema/index. [DB audit](09-database-audit.md). Không migration/schema change trong audit.

## 11. Phân quyền

FACULTY manage trong grant; LECTURER read theo membership; STUDENT/ADMIN không bypass dù token role giả hoặc có permission đơn lẻ. [RBAC report](10-rbac-security-report.md).

## 12. Tích hợp

Roster/grant/routing từ bước 1–3. Nhóm vừa tạo được sử dụng ngay để phân review bước 5 trong live E2E. Thiếu cấu hình phải fail-closed. [Integration report](11-integration-e2e-report.md).

## 13. Đề xuất và thứ tự ưu tiên

P3: lọc navigation theo route/role, sửa ARIA/contrast. Giữ nguyên scope và transaction/CAS khi sửa UI.

## 14. Điều kiện nghiệm thu

Các ca 31 nhóm tiếp tục PASS; browser create/edit/archive có permission đúng; không gỡ checks grant/roster/active review để làm sample OPEN_REGISTRATION ghi được. Đóng lỗi accessibility trước xác nhận WCAG. Mỗi nhánh chưa chạy tiếp tục NOT VERIFIED; không suy phần trăm hoàn thiện từ số test xanh.
