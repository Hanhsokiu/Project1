# Phạm vi, yêu cầu và phương pháp

## Thứ tự nguồn nghiệp vụ

1. [Đặc tả 10 bước](../spec/dac-ta-use-case.md), phần mở đầu xác định trực tiếp bước 4–8.
2. [Trích xuất tài liệu gốc ](../frontend/source-extracts/Project_1_06.md), UC12–16, bảng 44–48. Tài liệu DOCX gốc ở `docs/spec/Project_1_06.docx`; lượt này dùng bản trích xuất sẵn và nguồn Markdown, ** không xác minh lại ảnh nhúng/bố cục toàn DOCX**.
3. [Baseline D01–D14](../implementation/01-business-decisions-and-contract.md): cá nhân thay nhóm SV; nhóm duyệt là quan hệ; một kết luận chung/vòng; phase thay phiên họp duyệt vật lý; bốn chữ ký giấy; receipt riêng; nghĩa vụ tuần độc lập task; ba kết quả PASS/FAIL/REVISION_REQUIRED.
4. Báo cáo triển khai [4](../implementation/04a-step4-implementation-report.md), [5](../implementation/05-step5-implementation-report.md), [6](../implementation/06-step6-implementation-report.md), [7](../implementation/07-step7-implementation-report.md), [8A](../implementation/08a-guidance-task-implementation-report.md), [8B](../implementation/08b-weekly-submissions-implementation-report.md), [8C](../implementation/08c-progress-review-implementation-report.md).
5. [Hướng dẫn nhóm](../implementation/03-team-development-guide.md), [ báo cáo merge](../implementation/merge-develop-2026-10-26.md) và quyết định người dùng: ** giữ PUBLISHED, thêm thao tác chốt FINALIZED riêng **.

Câu “ chưa bắt đầu PR2” trong PR1 là trạng thái lịch sử, không phải blocker hiện tại. Báo cáo triển khai chỉ nói tính năng đã làm / đã hoãn; không tự xóa yêu cầu baseline chỉ vì chưa triển khai.

## Bảng đối chiếu

| Bước | Nghiệp vụ đúng nguồn | Module/UI | Điều kiện chủ yếu |
| --- | --- | --- | --- |
| 4 | Khoa tạo nhóm GV duyệt theo bộ môn, quản lý thành viên | `topic/review-groups`, `/topic/review-groups` | Grant đợt / bộ môn, roster hoạt động, term cho phép quản lý, không đổi membership khi vòng còn active |
| 5 | Phân đề cương và kết luận xét duyệt | `topic/proposal-reviews`, `/topic/reviews`, `/topic/review-assignments/:proposalId` | Bản nộp SEALED, routing, nhóm đúng đợt / bộ môn, reviewer không phải GVHD |
| 6 | Sửa, phản hồi, so sánh, lưu phiên bản và nộp lại | `topic/proposal-versions`, `/topic/proposal` | Owner/GVHD chính thức, agreement đúng revision, phase EDIT mở, CAS, chỉ SV submit |
| 7 | Chốt chính thức, PDF, tiếp nhận giấy | `topic/proposal-dossiers`, `/topic/dossier` | APPROVED đúng version, đủ lớp / ngành và snapshot, Khoa đúng grant; receipt không suy từ download |
| 8A | Kế hoạch, task, tiến độ, nghĩa vụ tuần | `guidance/tasks`, `/guidance/plan`, `/guidance/tasks` | Dossier FINALIZED, current advisor, phase GUIDANCE, period/obligation cấu hình |
| 8B | Upload và bài nộp phiên bản | `guidance/submissions`, `/guidance/tasks/:id/submissions` | Owner, task chưa COMPLETED/CANCELLED, policy và staging READY, khóa phase khi commit |
| 8C | Nhận xét /đánh giá báo cáo, họp, dashboard, thông báo | `guidance/reviews`, `/guidance/review`, `/guidance/progress`, `/guidance/meetings`, `/guidance/notifications` | Current advisor, exact current submission, effective review; Khoa chỉ đọc trong grant |

Không đưa defense/grading/final-report/exports bước 9–10 vào phạm vi sửa. Kiểm tra liên kết và đầu ra tích hợp, đánh dấu DEPENDENCY GAP nếu consumer chưa có. Vai trò “hội đồng /chủ tịch/thư ký ” không được tự thêm vào duyệt đề cương; baseline hiện dùng member của nhóm GV, không COMMITTEE role cho bước này.

## State machine đã đối chiếu

| Aggregate | Trạng thái thực tế và chuyển trạng thái kiểm tra |
| --- | --- |
| Assignment | DRAFT→PUBLISHED→FINALIZED; PUBLISHED chưa cấp quyền chính thức |
| Proposal | DRAFT→SUBMITTED→UNDER_REVIEW→APPROVED hoặc REVISION_REQUESTED; sửa từ REVISION_REQUESTED tạo DRAFT mới rồi RESUBMISSION. REJECTED là legacy, không tạo kết luận mới REJECTED |
| Version | DRAFT→SEALED khi SV submit; snapshot không sửa /unseal |
| Review | ASSIGNED→IN_REVIEW→DECIDED; phân lại làm vòng cũ SUPERSEDED |
| Dossier | DRAFT→FINALIZED→RECEIVED; REOPENED có trong enum nhưng chưa có producer reopen đầy đủ để nghiệm thu qua UI |
| Plan | ACTIVE/PAUSED/ARCHIVED; handover/reopen phải chặn ghi, current advisor acknowledge/rebase mới resume |
| Task canonical | TODO→IN_PROGRESS→SUBMITTED→COMPLETED hoặc REVISION_REQUESTED; CANCELLED có reason. OVERDUE là derived flag; không dùng raw legacy enum làm canonical |
| Submission | SUBMITTED/REVIEWED/SUPERSEDED; nộp lại append, không sửa bài cũ |
| ProgressReview | PASS/FAIL/REVISION_REQUIRED tách riêng; RECORDED/SUPERSEDED; amend append history |

## Môi trường và an toàn dữ liệu

- UI hiện tại `http://127.0.0.1:5173`, API `http://127.0.0.1:3000/api`; phiên UI người dùng được giữ nguyên.
- API tests mở NestJS ở cổng loopback ngẫu nhiên, full browser E2E dùng Vite 50180; DB mới riêng mỗi suite trên cluster test 55451.
- Replay 12 migration đã có, không sửa định nghĩa /schema/migration; không reset/drop DB. Các fixture/test có cập nhật trạng thái chỉ trong DB tổng hợp được tạo cho audit.
- EMAIL_WORKER_ENABLED=false; không gửi SMTP ra ngoài. Credential chỉ đọc vào bộ nhớ từ cấu hình local đã có, không ghi vào báo cáo.
- Adapter [preload](evidence/harness/preload.cjs) chỉ chuyển nơi xuất artifact và Vite cache; không thay assertion/logic sản phẩm. Test/API nguồn giữ nguyên; build không ghi đè backend/disthiện chạy.

## Coverage và giới hạn

[Source inventory](evidence/20261026144939_2663ec/source-inventory.json): 94 file liên quan, 23.067 dòng. Inventory không đồng nghĩa đã review từng dòng. Review thủ công tập trung contract, module/DI, route/permission, phase/assignment/ownership, state/CAS/idempotency/transaction, file và notification; các suite động đi qua service/repository thật.

154 scenario groups có thể chứa nhiều assertion; không phải 154 yêu cầu nghiệp vụ độc lập. Nested producer preludes không cộng lặp vào tổng. 71-operation auth inventory không có nghĩa mỗi operation đã đủ 15 loại negative case. [API matrix](evidence/20261026144939_2663ec/api-operation-matrix.json) chỉ ghi status thực sự quan sát.

Các vùng **NOT VERIFIED**: mọi tổ hợp field boundary từng endpoint; screen reader thủ công; tất cả modal/Cancel/Sort/Pagination từng màn; memory leak dài hạn; representative-load; Supabase/remote CI/SMTP thật; layout mẫu DOCX đầy đủ; toàn bộ consumer 9–10. DB/storage/audit failure được inject trong suite test riêng, không làm gi án đoạn UI đang dùng.

PASS chỉ áp dụng cho test có assertion/ bằng chứng cụ thể. Tính năng tổng thể vẫn PARTIALLY VERIFIED nếu còn acceptance branch chưa kiểm hoặc gap chưa đóng.
