# Nội dung hỏi nhóm trưởng/Khoa một lượt — B9–B10

**Tất cả PENDING_APPROVAL.** Đây là danh sách quyết định, không yêu cầu gửi secrets và không phải lệnh deploy. Chi tiết lịch sử từng UC trong 09-10-policy-approval-list.md; đề nghị nhóm ghi owner + quyết định + reference/version + ngày duyệt.

| Ưu tiên / chủ đề | Phương án code đang hỗ trợ | Quyết định cần nhóm/Khoa | Chủ sở hữu cần chỉ định | Chặn activation |
| --- | --- | --- | --- | --- |
| P0 Nguồn học vụ | B1–B8 milestone/review riêng; UC17 summary gắn PDF; UC18 attestation/source explicit | Điểm UC16 nào là học phần, UC17 có được dùng không, academic/progress authority và evidence nào hợp lệ | Khoa + cán bộ dữ liệu | Có |
| P0 Điểm/rubric/công thức | Rubric/version/step; BigInt; reviewer/member aggregates explicit; WEIGHTED_SUM, rounding/precision 1 digit storage | Criteria/weights/required roles; nhiều GVPB tính thế nào; 40/60 có áp dụng không; ngưỡng/điểm liệt/classification/basis rounding | Khoa/chuyên môn | Có |
| P0 Hội đồng/phản biện | 3–5 members, roles/quota/caps/qualifications, all-member advisor conflicts, current assignments | Officers/degree/title, former advisor, dual reviewer/member, tải tối đa và ngoại lệ | Khoa + giáo vụ | Có |
| P0 Mốc/phòng/lịch | Kế hoạch TERM/PHASE, FINAL/DEFENSE, morning/afternoon intervals, ABC/ties/buffers/cross-term resources | Hạn nộp/chấm/chốt/công bố, phòng/calendar, duration/buffers, reviewer attendance, name exceptions và reschedule | Giáo vụ + phụ trách phòng | Có |
| P0 Actual defense/confirmation | UC23 REQUIRED evidence chặn nếu chưa có producer; UC24 ONE_PER_ROLE/STUDENT + distinct/separation config | Ai ghi đã bảo vệ, minh chứng nào; Chair/Secretary có cùng xác nhận không; mỗi SV hay phiên/đợt; Khoa/publisher có phải khác người | Khoa/hội đồng | Có nếu yêu cầu |
| P0 Scope/release/RBAC | Role-bound + term/department/member scope, components/comments/status/history độc lập, no admin bypass | Mapping cấp cho ai, member xem/export phiếu nào, SV xem gì/khi nào, finalized internal có được xuất không | Nhóm trưởng + Khoa | Có |
| P0 Templates/cột/in-ký | 15 layouts engineering draft; template registry/version/approval; original dossier renderer; MISSING_SOURCE/UNSIGNED | Gửi nguồn mẫu/cột chính thức, institution/owner/version, DRAFT usage, missing fields có được để trống không, paper/digital signature, ngày ký/quy trình xác nhận | Khoa + thư ký hội đồng | Có cho official export |
| P0 Schema/live security | 8 SQL review packages + UC25 không migration, fail closed capability | Review DDL/constraints/guards, live metadata/legacy/ACL/RLS/REST, cho phép rehearsal ở đâu và ai chịu trách nhiệm | DB owner/nhóm trưởng | Có |
| P0 Test/backup/storage | Reuse Render/Supabase; export stream; source PDF cần private durable storage | Môi trường DB/storage test được duyệt; Render disk/mount/backup/restore/redeploy có bằng chứng không; retention/owner vận hành | Render/DB owner | Có |
| P1 Sửa/thay thế/phúc khảo | Immutable final, stale không tự sửa/xóa; giữ audit | Gia hạn/thay PDF/sửa score sau chốt, đổi hội đồng/lịch, phúc khảo, replacement result/report và thu hồi công bố | Khoa + nhóm trưởng | Có cho ngoại lệ này |
| P1 Biên bản/signed archive | Không infer conclusion/remarks từ scores; no fake signatures; stream không archive | Producer remarks/questions/revision requests/kết luận; ký giấy/scan/digital evidence; durable archive và quyền tải lịch sử stale | Khoa/thư ký + hạ tầng | Có cho minutes đầy đủ/signed archive |
| P1 Legacy/retention/notifications | Không adopt legacy; atomic audit/key; no automatic purge/notify | Ai đối soát scores/results/minutes/jobs cũ, hạn lưu, mail/recipients/outbox, thông báo khi stale, thời điểm chốt sổ/đóng đợt | Khoa + DB owner | Có theo phần được bật |
| P1 Identity/performance | Persisted producer actors reauthorized; limits configurable; no queue mới | Bàn giao cán bộ/service identity, quy mô đợt/SLAs, benchmark và batching cần thiết | Nhóm trưởng/dev/QA | Có trước tải thật |

## Nội dung có thể gửi nhóm trưởng

“Code UC17–UC25 đã có trong Project1/feature-b9-b10-implementation và được kiểm thử cô lập; chưa migrate/deploy/bật write flags. Nhờ nhóm chốt một lượt: nguồn điểm UC16/17 và công thức/rubric/rounding; điều kiện eligibility/hội đồng/phản biện/lịch; ai confirm/finalize/publish và release quyền; nguồn mẫu/cột/biên bản/chữ ký; DB rehearsal + ACL/RLS/legacy + Render disk/backup/test environment. Mỗi mục cần owner và reference/version. Các file tổng hợp đã tách phần code, phần policy BLOCKED và E2E NOT VERIFIED để review. Không cần gửi secrets.”

## Trạng thái và thứ tự quyết định

1. P0 nghiệp vụ + template/data authority trước provisioning hoặc rehearsal có thao tác học vụ.
2. P0 hạ tầng/security + owner backup/test trước mọi apply/ghi lên môi trường được cấp.
3. Chạy E2E/restore/browser/load, phân loại PASS/FAIL/BLOCKED theo test plan.
4. Nhóm/Khoa sign-off riêng trước production rollout và flags; PR/commit/push/deploy không được tự thực hiện trong phiên code này.

Nguồn quyết định học vụ khác nguồn phê duyệt hạ tầng. Unit/HTTP/artifact PASS không thay chữ ký duyệt nghiệp vụ hoặc nghiệm thu E2E.
