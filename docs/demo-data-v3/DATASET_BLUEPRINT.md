# UTC Project1 — Bộ dữ liệu DEMO V3 xuyên suốt 10 bước

**Trạng thái:** Đặc tả + cấu hình đầu vào cho Codex; **KHÔNG phải database đã seed**. Tham chiếu repository `Hanhsokiu/Project1`, nhánh `develop`, ngày tham chiếu 2026-11-16; kiểm tra lại commit hiện tại trước khi triển khai.

## 1. Nguồn và giới hạn

- Tài liệu UTC: `Thứ tự bảo vệ tại các Hội đồng chấm đồ án...xlsx` (sheet `HĐ-PB`, `CNTT - Đại trà`), `3. Chấm điểm- HD6.xlsx` (sheet `In`, `HĐ6`), và `Điểm HP Đồ án TN.pdf`.
- Đặc tả dự án: `docs/spec/dac-ta-use-case.md` và `docs/frontend/source-extracts/Project_1_06.md` trong repository.
- Căn cứ nghiệp vụ: 10 bước/25 UC, phân loại vai trò, nguyện vọng/quota, lịch bảo vệ, quy tắc tách GVHD khỏi chấm của chính sinh viên đó, phiếu chấm 6 người theo bảng mẫu và công thức QT–BV–HP.
- Không sử dụng bất kỳ tên, MSSV, ngày sinh, email, điểm hay đề tài cá nhân thật nào từ ba tài liệu trong dữ liệu demo. Mã `DEMO-*`, địa chỉ `example.invalid`, văn bản minh họa riêng.
- Nguồn khác khóa/đợt không hợp nhất máy móc; số lượng trong các tài liệu dùng để **tham khảo cấu trúc**, không để thay thế quy mô demo do người dùng chọn.
- Lưu ý mâu thuẫn: đặc tả UC cũ mô tả có thể ghép 2 sinh viên; quyết định Project1 hiện tại là **mỗi sinh viên một đề tài mỗi đợt**. Ưu tiên nghiệp vụ hiện hành. Đặc tả hướng ban đầu có 5 hướng, mục tiêu demo là 7: phải xác nhận danh mục đang dùng, không tự thêm 2 hướng trái quy định.

## 2. Quy mô chuẩn và cân đối

| Danh mục | Số lượng | Điều kiện |
|---|---:|---|
| Đợt đồ án | 2 | Đợt 03/2026 COMPLETED, đợt 10/2026 IN_PROGRESS tại mốc 16/11/2026 |
| Sinh viên duy nhất | 84 | 76 ở đợt đầu, 11 ở đợt hai, **3 trùng tài khoản** |
| Lượt tham gia (TermStudent) | 87 | 76 + 11; không tạo 87 Student |
| Giảng viên | 18 | Dùng chung, mỗi GV có thể giữ nhiều vai trò hợp lệ |
| Giáo vụ | 2 | Quyền trong phạm vi đơn vị/đợt |
| Admin | 1 | Quyền cấu hình kỹ thuật, không mặc định được chấm |
| UserAccount | 105 | 84 + 18 + 2 + 1 |
| Hội đồng | 3 | Thuộc đợt 03/2026 |
| CommitteeMember | 12 vị trí | Mỗi HĐ gồm Chủ tịch, Thư ký, 2 ủy viên; thành viên đến từ 18 GV |
| Đề tài được giao | 87 | Mỗi lượt tham gia một đề tài riêng, tuân theo trạng thái quy trình |
| Lượt đã từng xếp lịch | 65 | Trong đợt cũ, **60 chấm hoàn chỉnh, 5 có điều chỉnh/hoãn sau khi đã xếp lịch** (chỉ tạo theo khả năng lưu lịch sử hợp lệ) |
| Bảo lưu/hoãn trước xếp lịch | 11 | Đợt 03/2026 |
| Bộ điểm đầy đủ | 60 | 60 × (1 GVHD + 1 GVPB + 4 HĐ) = 360 lượt chấm nếu schema hỗ trợ |
| Hướng chuyên môn | mục tiêu 7 | Nếu chính sách chỉ cho 5 thì dùng 5, bổ sung lý do |

**Tính nhất quán kết thúc đợt cũ:** 76 = 60 đã bảo vệ/chấm điểm hoàn chỉnh + 11 bảo lưu trước lịch + 5 có lịch sử đã xếp lịch nhưng sau đó hoãn/không bảo vệ. **Không để 5 hồ sơ vừa được chấm và công bố vừa bị hoãn**. Nếu schema chưa lưu được lịch sử hủy/chuyển ca, phải giảm số *lịch hiệu lực* còn 60, hoặc chuyển 5 tình huống thành kịch bản QA riêng; không tự tạo dữ liệu mâu thuẫn chỉ để đạt 65 dòng lịch.

## 3. Dữ liệu và điều kiện theo 10 bước

| Bước | Dữ liệu cần có | Điều kiện/trường hợp cần kiểm tra |
|---|---|---|
| **1. Kỳ và đợt** | `AcademicSemester`, `ThesisTerm`, `TermPhase`, `TermParameter`, `TermStudent`, `TermLecturer`, `Department`, `TrainingSystem`, `ImportJob`, grant theo đơn vị/đợt | DRAFT → mở đăng ký → đóng → thực hiện → bảo vệ → hoàn tất; hạn hợp lệ; quota GV; nhập bảng SV có preview, trùng, thiếu, sai; quyền chỉ theo đơn vị/đợt. Các trạng thái mở đăng ký thử riêng bằng scenario profile, không đổi baseline. |
| **2. Đăng ký SV** | `UserAccount`, `UserRole`, `Student`, `Registration`, `RegistrationPref`, cập nhật thông tin liên hệ, event/audit | Đăng nhập/đổi mật khẩu; SV chỉ đăng ký khi đủ điều kiện và mở hạn; 1 hướng, 1–3 NV hợp lệ khác nhau; sửa thứ tự; nháp/nộp; hạn đóng; chưa đủ dữ liệu; sai hệ; khác đợt; trùng GV; thiếu quyền. |
| **3. Phân công và đề tài** | `AssignmentPlan`, `AdvisorAssignment`, `AssignmentPlanWorkflow`, `AssignmentChange`, `Topic`, `TopicWorkflow`, `TopicHistory`, `Notification` | Ưu tiên NV1→NV2→NV3, GPA khi vượt quota theo chính sách; điều chỉnh tay có lý do; DRAFT/PUBLISHED/FINALIZED; SV không thấy kết quả trước publish; 1 đề tài/người/đợt, hai bên xác nhận, sửa có history. |
| **4. Nhóm duyệt** | `ReviewGroup`, `ReviewGroupMember`, `ReviewGroupWorkflow`, `ReviewMembershipHistory` | Tạo theo bộ môn, thành viên là GV được phép; ít nhất 2 nhóm nếu workflow phù hợp; chống nhóm rỗng, nhầm phạm vi, người không có grant, đổi thành viên có audit. |
| **5. Nộp & phân duyệt đề cương** | `Proposal`, `ProposalVersion`, `ProposalWorkflow`, `ProposalVersionWorkflow`, `ProposalReview`, `ProposalReviewWorkflow`, `ProposalReviewDecision`, `ReviewComment` | Lần nộp ban đầu, duyệt, yêu cầu sửa, phiên bản sau, quyết định chốt; reviewer đúng nhóm/đợt; không sửa bản SEALED; chống review cùng phiên bản không đúng lượt; giữ version & comment history. |
| **6. Sửa đề cương** | Các version/review ở trên cùng snapshot, lịch sử; xác nhận GVHD nếu workflow yêu cầu | Hai vòng sửa cho vài hồ sơ, một vòng sửa cho nhiều hồ sơ; không ghi đè version nộp trước; trạng thái REVISION_REQUIRED → resubmit → APPROVED; ngăn thao tác khi phase locked. |
| **7. Hồ sơ hoàn thiện** | `ThesisDossier`, `DossierWorkflow`, `DossierFinalization`, `DossierReceipt`, `DossierHistory`, `DossierStudentProfile`, `DossierPdfContent`, `FileAsset` | Chỉ hoàn thiện khi đề cương duyệt; tạo PDF thật, checksum/hash/version đúng; in, tiếp nhận, sửa sau chốt có reason/reopen; ấn phẩm và file thực có thể tải. Chữ ký chỉ là trạng thái/biên nhận kiểm thử, không giả mạo chữ ký thật. |
| **8. Hướng dẫn và báo cáo tuần** | `GuidancePlan`, `GuidancePlanWorkflow`, `GuidancePeriod`, `PeriodRequiredStudent`, `WeeklyReportObligation`, `Task`, `TaskWorkflow`, `TaskSubmission`, `SubmissionWorkflow`, `FileAsset`, `SubmissionAsset`, `ProgressReview`, `TaskReview`, `GuidanceMeeting`, `PhaseEvaluation`, histories | Tuần có hạn nộp; giao việc; REPORT + SOURCE thật; nộp đúng/muộn; REVISION_REQUIRED, PASS, FAIL; nộp lại bất biến/superseded; ghi nhận xét, giao nhiệm vụ tiếp; không có nộp thì không review; GV chỉ review SV được giao; cảnh báo quá hạn và reduced data state. |
| **9. Điều kiện & bảo vệ/chấm điểm** | `FinalReport`, `DefenseConfirmation`, `DefenseEligibility`, `DefermentRequest`, `ReviewerAssignment`, `DefenseCommittee`, `CommitteeMember`, `Room`, `DefenseSession`, `CommitteeStudent`, `RubricCriteria`, `ScoreEntry`, `ScoreDetail`, `FinalResult`, `DefenseMinutes` | Kiểm điều kiện, bảo lưu, phân phản biện, kiểm xung đột GVHD–HĐ/phản biện; phòng/ca không trùng; thứ tự theo Tên + Họ đệm; GVHD/GVPB/4 HĐ đúng người; điểm từng tiêu chí 0–max, tổng ≤10; khóa điểm, công bố theo quyền. |
| **10. Xuất, ký, công bố, đóng đợt** | `ExportJob`, `FinalResult` công bố, `DefenseMinutes`, `Notification`, `AuditLog`/`OutboxEvent` | Xuất Excel/PDF có nội dung thật; phiên bản, ngày tạo, người yêu cầu; test thiếu điểm, chưa công bố, được công bố; biên bản được xuất để ký thủ công, không làm giả chữ ký; chỉ đóng đợt khi quy trình cho phép. |

## 4. Phân bổ trạng thái tối thiểu

**Đợt 03/2026 — lịch sử đã xử lý:**
- 60 sinh viên có đủ nguồn hồ sơ, final report, điều kiện, 6 lượt chấm đúng quyền, tổng hợp và trạng thái kết thúc; trong đó một số được cấu hình điểm dưới ngưỡng đạt để kiểm thử kết quả không đạt (không áp đặt tỷ lệ thực tế).
- 11 bảo lưu trước khi chính thức được xếp lịch: hồ sơ có nguyên nhân/lịch sử thích hợp, không có điểm bảo vệ.
- 5 đã từng được xếp lịch nhưng sau đó hoãn/bảo lưu có ghi nhận: nếu hệ thống chưa biểu diễn được, dùng scenario riêng và báo bất tương thích; không lưu thời khóa biểu hiệu lực mâu thuẫn với deferment.
- Một số đề cương đã từng bị yêu cầu chỉnh sửa, có ít nhất 2 version và history; một số đề cương được duyệt ngay lần đầu.
- Có dữ liệu đủ để tạo báo cáo xuất và xem lịch sử, không có file hoặc email giả là đã được gửi thật.

**Đợt 10/2026 — đang hướng dẫn:**
- 11 SV đã phân công, mỗi SV có topic; ít nhất một số có đề cương với lịch sử đã sửa và duyệt.
- Để demo Bước 8 thống nhất, tất cả 11 phải đủ điều kiện tạo kế hoạch hướng dẫn; nếu dữ liệu nào còn đang sửa đề cương thì không gán báo cáo tuần cho SV đó.
- Chọn 5 trường hợp tuần gần nhất PASS, 3 REVISION_REQUIRED, 2 OVERDUE/không nộp, 1 đã nộp đang chờ review (tổng 11). `OVERDUE` là trạng thái nghĩa vụ/task, **không phải một TaskSubmission rỗng**.
- Không tạo hội đồng/chấm điểm/kết quả công bố cho đợt này.

## 5. Kịch bản riêng cần có để đủ chức năng nhưng không làm hỏng baseline

Một snapshot duy nhất không thể đồng thời ở trạng thái OPEN_REGISTRATION và COMPLETED, hoặc vừa chưa chốt phân công vừa đã bảo vệ. Dùng các **scenario profile trên DB test tách biệt**, fork từ bộ baseline hoặc tạo lại bằng seed deterministic:

1. `registration_open`: nháp, hợp lệ, trùng GV, vượt quota, hết hạn, hạn mở, khác hệ, chưa đổi mật khẩu.
2. `preferences_over_quota`: NV1 cùng giảng viên, tie-break theo GPA/quan hệ làm việc đã được hệ thống cho phép.
3. `assignment_revision`: DRAFT/PUBLISHED/FINALIZED, thay GVHD có lý do, thử publish lại, quyền xem kết quả.
4. `proposal_revision`: review đúng nhóm, request changes, sửa/submit version 2, superseded decision.
5. `dossier_reopen`: finalization/receipt, mở lại có reason, bản PDF phiên bản mới và bản cũ bất biến.
6. `guidance_overdue`: thiếu nộp, nộp muộn, upload lỗi, sửa nhận xét, nộp lại và lịch sử.
7. `defense_conflict`: trùng phòng, trùng giảng viên/ca, GVHD tự chấm SV mình; thử thao tác phải bị từ chối.
8. `partial_grading`: thiếu điểm GVHD, GVPB, ủy viên; điểm quá giới hạn; chốt/công bố phải bị chặn.
9. `publication_locked`: kết quả công bố, chỉnh điểm bị cấm hoặc có quy trình sửa được audit.
10. `rbac_cross_term`: 401/403, SV/GV khác đợt, admin không thể chấm thay, reviewer không có quyền, audit không lộ nội dung nhạy cảm.

## 6. Bắt buộc phân tích vấn đề kỹ thuật trước seed

- Schema nhánh `develop` có 99 models và 27 enums; các model `*Workflow` thường thêm trạng thái, ràng buộc, snapshot, revision nên phải tạo đồng bộ với bảng cơ sở.
- `FinalResult.finalScore Decimal(4,1)` và `ScoreEntry.totalScore Decimal(4,1)` có thể làm mất độ chính xác hiển thị hai chữ số trong mẫu PDF; service tính điểm hiện hỗ trợ hai chữ số. **Chưa được âm thầm làm tròn**; báo sai khác, đề xuất migration chỉ khi được phê duyệt.
- Các màn `frontend/src/features/defense/pages/SchedulePage.tsx` và `frontend/src/features/grading/pages/ScoreEntryPage.tsx` trên `develop` còn dùng `DemoDb`. Dữ liệu seed PostgreSQL có thể không hiện trên UI nếu chưa nối API. Ghi blocker rõ, không báo "end-to-end PASS" giả.
- `Lecturer.maxStudents` và `TermLecturer.quota` mặc định là 5; với 18 GV và 76 SV, phải chứng minh tổng quota và phân phối hợp lệ ở đợt 1, đồng thời không vượt giới hạn trong đợt 2.
- 7 hướng mô phỏng cần khớp catalog và workflow thực tế; đặc tả UC gốc có 5 hướng. Không mở rộng enum hoặc bảng tùy tiện.
- Không tự tạo dữ liệu đã gửi mail thật; outbox/event của demo để disabled/sandbox.
- Các file PDF, report, source code là fixture an toàn, kích thước nhỏ, thực sự có bytes trên storage test và checksum đúng; không import bất kỳ dữ liệu cá nhân hoặc điểm thật của UTC.

## 7. Quy định script seed và xác minh

- `--dry-run` mặc định, `--seed` chỉ với cờ opt-in, đích là DB PostgreSQL test **riêng** và chỉ có localhost/địa chỉ máy test được allowlist rõ; KHÔNG cho Supabase chung/production.
- Dùng config `demo-manifest.json` với seed cố định và `reference_date`. Mã định danh deterministic `DEMO-*` hoặc UUIDv5 phù hợp field; idempotent bằng unique keys/upsert và namespaces để tái chạy an toàn.
- Chạy theo thứ tự phụ thuộc, nhóm transactional; log chi tiết progress/count; không xóa bản ghi không thuộc namespace demo; không làm thay đổi schema trong nhiệm vụ seed.
- Kiểm tra mỗi bước (1..10) bằng assertion và một số luồng API thật; đối chiếu tổng bản ghi, FK, unique, quota, role, cross-term, thời điểm, checksum, scoring precision, closed/published consistency.
- Trước/sau seed lưu báo cáo `counts-before.json`, `counts-after.json`, `validation-report.json`, `coverage-matrix.md`, `demo-users.example.md` (không chứa password hoặc secrets), `blocked-gaps.md`.
- Nếu cần API/backend/frontend hoặc schema mới, chỉ báo blocker/diff đề xuất và dừng bước liên quan; không tự tuyên bố DB seed đã làm chức năng chưa được triển khai.

## 8. Ngưỡng hoàn thành

- Baseline đúng: 2 terms, 84 Student, 87 TermStudent, 18 Lecturer, 2 FACULTY, 1 ADMIN, 3 DefenseCommittee, 12 CommitteeMember, 60 bộ điểm chỉ cho sinh viên hợp lệ (sau khi xác minh ràng buộc chấm).
- Dữ liệu có **truy vết** từ student → term registration → advisor assignment → topic → proposal/review/version → dossier → guidance/task/submission/review → eligibility → committee/session → rubric score → final result → export.
- 25 use case có ít nhất một kịch bản success và negative/forbidden/boundary khi chức năng tương ứng thực sự tồn tại.
- Không báo đạt 100% nếu bước 9–10 còn là DemoDb/placeholder, nếu dữ liệu file không tải được, hoặc schema mất độ chính xác điểm.
- Không chạy seed lên DB dùng chung; không tự commit/push/merge.
