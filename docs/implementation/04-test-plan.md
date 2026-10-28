# Test plan — BƯỚC 4: nhóm giảng viên duyệt đề cương

Tạo theo yêu cầu triển khai bước 4; file này chưa tồn tại trước phiên này. Nguồn nghiệp vụ là PR1 §2–3, §5–6 và yêu cầu bước 4, không thay thế baseline. Không triển khai phân/duyệt đề cương bước 5–8.

## Phạm vi và điều kiện

- Dùng ReviewGroup, ReviewGroupMember, ReviewGroupWorkflow và ReviewMembershipHistory hiện có. Thành viên thuộc TermLecturer cùng đợt, Lecturer/account hoạt động và có role LECTURER. Không tự thêm trưởng nhóm/quorum hoặc cấm GV khác bộ môn: baseline chỉ yêu cầu roster cùng đợt.
- FACULTY cần permission và grant đợt/bộ môn. LECTURER chỉ đọc nhóm mình là thành viên, cần permission read và roster hiện hành. ADMIN không có bypass.
- Mutation có revision, idempotency và reason cho chỉnh sửa; transaction gồm group/membership/history/AuditLog. Không sửa thành viên khi có vòng ASSIGNED/IN_REVIEW hoặc legacy chưa xác định trạng thái. Không đổi term/bộ môn qua PATCH.
- Xóa là lưu trữ mềm để giữ audit/membership history. Chặn khi có bất kỳ ProposalReview liên kết; không cascade xóa. Nhóm lưu trữ không hiện trong danh sách hoạt động.
- Kiểm thử migration chỉ trên PG17 local riêng; không DDL/fixture/seed lên Supabase chung.

## Ma trận kiểm thử

| Tầng | Ca bắt buộc |
|---|---|
| Shared validation | trim/empty/unknown field, opaque ID, duplicate member, revision/reason, page/limit |
| Service/policy unit | FACULTY grant hợp lệ/ngoài scope; ADMIN-only/student deny; lecturer membership read/không phải member; active/closed term; eligible/ineligible roster; duplicate/conflict; active review lock |
| PostgreSQL + HTTP | create/detail/list/filter/update; add/remove/member list; duplicate/unknown/cross-term/disabled lecturer; 401/403/404; cross-term access; forged roles vs DB; stale revision; idempotency replay/conflict; concurrent mutation; audit rollback/history; assigned group delete rejected; archive preserves rows |
| Frontend | validation chung; render smoke SSR cho loading/empty/error/detail/form; labels/roles/read-only state; type-check/build; không báo đã chạy browser test khi chưa chạy |
| Migration | replay cây chuẩn trên DB rỗng riêng; giữ existing constraints và legacy API; additive nullable field, index/permission definitions; không drop/reset/backfill |

## Lệnh và evidence

Chạy type-check/lint/Vitest/build cho package bị ảnh hưởng. Integration runner phải chỉ chấp nhận PR2B_TEST_URL tại 127.0.0.1, database mới tên btl_pr2b_*; không fallback env shared. Ghi kết quả thực tế và hạn chế tại báo cáo triển khai bước 4. Browser e2e chỉ báo PASS nếu thực sự chạy với browser.
