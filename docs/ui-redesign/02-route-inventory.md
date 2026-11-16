# Inventory route và hồ sơ từng màn

Ngày audit: 15/11/2026. Nguồn: [router thực thi](../../frontend/src/app/router/routes.tsx), [manifest](../../frontend/src/app/router/route-manifest.ts), [bản trích xuất 62 route](evidence/route-source.json). Có 59 mục manifest + login, forbidden và fallback 404. Layout/index lồng nhau đã gộp thành đích route; query không tạo route mới.

## Cách đọc quyền và độ bao phủ

- `ADMIN`: quản trị; `FACULTY`: cán bộ khoa; `LECTURER`: giảng viên; `STUDENT`: sinh viên; `COMMITTEE`: role hội đồng. Role COMMITTEE không thay cho giảng viên được phân công hội đồng.
- Trong API mode, phải có **ít nhất một role trong allowlist VÀ permission ghi ở bảng** nếu route khai báo permission. Dấu `—` chỉ có nghĩa route không khai báo permission riêng; không có nghĩa API/hành động không kiểm quyền.
- Menu còn phụ thuộc `menu`, `menuMode`, `menuRoles`. Ẩn menu không đồng nghĩa cấm URL. R05 phải mở từ kế hoạch có planId; R07/R10 vẫn cho Khoa vào URL dù menu Khoa ẩn.
- Quyền đọc route khác quyền thao tác và phạm vi dữ liệu. Mỗi trang tiếp tục kiểm quan hệ người–hồ sơ, capability, trạng thái, deadline và permission thao tác; API là nguồn quyết định. Không có override ADMIN cho mọi route học vụ.
- Có phiên SV, GVHD, GV xét duyệt và Khoa tách biệt. Permission snapshot đã lưu (chỉ roles/permissions, không token/thông tin đăng nhập) trong [bằng chứng](evidence/browser-audit.json). Khoa có các quyền đọc bảo vệ và audit:read; màn timeout không được gán nhầm thành thiếu quyền.
- **48 đã quan sát / 12 bị chặn / 2 chỉ đọc code.** Đã quan sát nghĩa mở được ít nhất một trạng thái, không phải kiểm đủ mọi vai trò, dialog hoặc transition. Các biến thể chưa mở chỉ đánh giá qua code. F08/F10 là rủi ro component chung; không khẳng định mọi instance đều mắc lỗi.
- Mọi phát hiện dẫn tới [01-ui-audit.md](01-ui-audit.md); mọi ca kiểm tra sau sửa phải áp dụng thêm [04-acceptance-criteria.md](04-acceptance-criteria.md). Không thao tác ghi trong audit.

## Danh sách đầy đủ

| Mã | Route / màn | Role allowlist | Permission route | Menu sau khi đủ quyền | Kiểm chứng |
|---|---|---|---|---|---|
| [R01](#r01) | `/guidance/weeks` · Kế hoạch và báo cáo tuần | FACULTY, LECTURER, STUDENT | `guidance:read` | API/DEMO | đã quan sát |
| [R02](#r02) | `/guidance/review` · Nhận xét báo cáo | LECTURER | `task:review` | API/DEMO | đã quan sát |
| [R03](#r03) | `/guidance/review/:submissionId` · Chi tiết nhận xét | FACULTY, LECTURER, STUDENT | `submission:read` | Ẩn | đã quan sát |
| [R04](#r04) | `/guidance/progress` · Theo dõi tiến độ | FACULTY | `guidance:monitor` | API/DEMO | bị chặn |
| [R05](#r05) | `/guidance/meetings` · Nhật ký hướng dẫn | FACULTY, LECTURER, STUDENT | `guidance:read` | Ẩn (menuRoles rỗng) | đã quan sát |
| [R06](#r06) | `/guidance/notifications` · Thông báo hướng dẫn | FACULTY, LECTURER, STUDENT | `guidance:read` | Ẩn | đã quan sát |
| [R07](#r07) | `/guidance/plan` · Kế hoạch hướng dẫn | FACULTY, LECTURER, STUDENT | `guidance:read` | API/DEMO; LECTURER,STUDENT | đã quan sát |
| [R08](#r08) | `/guidance/plan/:proposalId` · Chi tiết kế hoạch | FACULTY, LECTURER, STUDENT | `guidance:read` | Ẩn | đã quan sát |
| [R09](#r09) | `/guidance/plan/:proposalId/tasks/new` · Giao nhiệm vụ | LECTURER | `task:manage` | Ẩn | đã quan sát |
| [R10](#r10) | `/guidance/tasks` · Nhiệm vụ & tiến độ | FACULTY, LECTURER, STUDENT | `guidance:read` | API/DEMO; LECTURER,STUDENT | đã quan sát |
| [R11](#r11) | `/guidance/tasks/:id` · Chi tiết nhiệm vụ | FACULTY, LECTURER, STUDENT | `guidance:read` | Ẩn | đã quan sát |
| [R12](#r12) | `/guidance/tasks/:id/submissions` · Nộp báo cáo | FACULTY, LECTURER, STUDENT | `submission:read` | Ẩn | đã quan sát |
| [R13](#r13) | `/topic/dossier` · Chốt đề cương & bản giấy | FACULTY, LECTURER, STUDENT | `proposal:read` | API/DEMO | đã quan sát |
| [R14](#r14) | `/topic/dossier/:proposalId` · Chi tiết hồ sơ | FACULTY, LECTURER, STUDENT | `proposal:read` | Ẩn | đã quan sát |
| [R15](#r15) | `/topic/proposal` · Đề cương & phiên bản | FACULTY, LECTURER, STUDENT | `proposal:read` | API/DEMO | đã quan sát |
| [R16](#r16) | `/topic/proposal/:proposalId` · Phiên bản đề cương | FACULTY, LECTURER, STUDENT | `proposal:read` | Ẩn | đã quan sát |
| [R17](#r17) | `/topic/proposal/:proposalId/versions/:versionId` · Lịch sử đề cương | FACULTY, LECTURER, STUDENT | `proposal:read` | Ẩn | đã quan sát |
| [R18](#r18) | `/topic/reviews` · Xét duyệt đề cương | FACULTY, LECTURER, STUDENT | `proposal:read` | API/DEMO | đã quan sát |
| [R19](#r19) | `/topic/reviews/:id` · Chi tiết xét duyệt | FACULTY, LECTURER, STUDENT | `proposal:read` | Ẩn | đã quan sát |
| [R20](#r20) | `/topic/review-assignments/:proposalId` · Phân công xét duyệt | FACULTY | `proposal:assign` | Ẩn | đã quan sát |
| [R21](#r21) | `/topic/review-groups` · Nhóm duyệt đề cương | FACULTY, LECTURER | `review-group:read` | API/DEMO | đã quan sát |
| [R22](#r22) | `/topic/review-groups/new` · Tạo nhóm duyệt | FACULTY | `review-group:manage` | Ẩn | đã quan sát |
| [R23](#r23) | `/topic/review-groups/:id/edit` · Sửa nhóm duyệt | FACULTY | `review-group:manage` | Ẩn | đã quan sát |
| [R24](#r24) | `/topic/review-groups/:id` · Chi tiết nhóm duyệt | FACULTY, LECTURER | `review-group:read` | Ẩn | đã quan sát |
| [R25](#r25) | `/login` · Đăng nhập | Công khai | — | Không có mục manifest | đã quan sát |
| [R26](#r26) | `/` · Tổng quan | ADMIN, FACULTY, LECTURER, STUDENT, COMMITTEE | — | API/DEMO | đã quan sát |
| [R27](#r27) | `/admin/accounts` · Tài khoản | ADMIN | — | API/DEMO | chỉ đọc code |
| [R28](#r28) | `/admin/roles` · Vai trò & quyền | ADMIN | — | API/DEMO | chỉ đọc code |
| [R29](#r29) | `/admin/audit-logs` · Nhật ký hoạt động | ADMIN, FACULTY | `audit:read` | API/DEMO | bị chặn |
| [R30](#r30) | `/catalog/students` · Sinh viên | ADMIN, FACULTY | — | API/DEMO | đã quan sát |
| [R31](#r31) | `/catalog/lecturers` · Giảng viên | ADMIN, FACULTY, LECTURER | — | API/DEMO | đã quan sát |
| [R32](#r32) | `/catalog/import` · Import dữ liệu | ADMIN, FACULTY | — | API/DEMO | đã quan sát |
| [R33](#r33) | `/catalog/reference` · Danh mục đào tạo | ADMIN, FACULTY | — | API/DEMO | đã quan sát |
| [R34](#r34) | `/terms` · Kỳ học & đợt đồ án | ADMIN, FACULTY | — | API/DEMO | đã quan sát |
| [R35](#r35) | `/terms/:id` · Chi tiết đợt | ADMIN, FACULTY | — | Ẩn | đã quan sát |
| [R36](#r36) | `/terms/:id/phases` · Kế hoạch giai đoạn | ADMIN, FACULTY | — | Ẩn | đã quan sát |
| [R37](#r37) | `/terms/:id/parameters` · Tham số đợt | ADMIN, FACULTY | — | Ẩn | đã quan sát |
| [R38](#r38) | `/terms/:id/roster` · Danh sách tham gia | ADMIN, FACULTY | — | Ẩn | đã quan sát |
| [R39](#r39) | `/registration` · Đăng ký nguyện vọng | STUDENT | — | API/DEMO | đã quan sát |
| [R40](#r40) | `/registration/list` · Danh sách đăng ký | ADMIN, FACULTY | — | API/DEMO | đã quan sát |
| [R41](#r41) | `/registration/assignment` · Phân công GVHD | ADMIN, FACULTY | — | API/DEMO | đã quan sát |
| [R42](#r42) | `/registration/result` · Kết quả phân công | ADMIN, FACULTY, LECTURER, STUDENT | — | API/DEMO | đã quan sát |
| [R43](#r43) | `/registration/manual` · Điều chỉnh phân công | ADMIN, FACULTY | — | API/DEMO | đã quan sát |
| [R44](#r44) | `/topic/my` · Thống nhất đề tài | ADMIN, FACULTY, LECTURER, STUDENT | — | API/DEMO | đã quan sát |
| [R45](#r45) | `/topic/draft` · Soạn đề cương | STUDENT, LECTURER | — | Ẩn | đã quan sát |
| [R46](#r46) | `/topic/overview` · Hồ sơ đề tài | ADMIN, FACULTY, LECTURER, STUDENT, COMMITTEE | — | Ẩn | đã quan sát |
| [R47](#r47) | `/guidance/defense-confirm` · Xác nhận bảo vệ | FACULTY, LECTURER, STUDENT | `defense-confirmation:read` | API/DEMO; FACULTY,LECTURER | đã quan sát |
| [R48](#r48) | `/guidance/final-report` · Báo cáo cuối kỳ | FACULTY, LECTURER, STUDENT | `final-report:read` | API/DEMO; STUDENT | đã quan sát |
| [R49](#r49) | `/defense/eligibility` · Xét điều kiện bảo vệ | FACULTY, LECTURER, STUDENT | `defense-eligibility:read` | API/DEMO | bị chặn |
| [R50](#r50) | `/defense/results` · Kết quả bảo vệ | FACULTY, LECTURER, STUDENT | `defense-result:read` | API/DEMO | bị chặn |
| [R51](#r51) | `/defense/reports` · Báo cáo & biểu mẫu bảo vệ | FACULTY, LECTURER | `defense-report:read` | API | bị chặn |
| [R52](#r52) | `/defense/committees` · Hội đồng bảo vệ | FACULTY | `defense-committee:read` | API/DEMO | bị chặn |
| [R53](#r53) | `/defense/reviewers` · Phân công phản biện | FACULTY | `defense-reviewer:read` | API/DEMO | bị chặn |
| [R54](#r54) | `/defense/schedule` · Lịch bảo vệ | FACULTY, STUDENT, LECTURER | `defense-schedule:read` | API/DEMO | bị chặn |
| [R55](#r55) | `/defense/committee-grading` · Chấm điểm hội đồng | LECTURER, FACULTY | `defense-committee-grade:read` | API/DEMO | bị chặn |
| [R56](#r56) | `/defense/reviewer-grading` · Chấm điểm phản biện | LECTURER, FACULTY | `defense-reviewer-grade:read` | API/DEMO | bị chặn |
| [R57](#r57) | `/report/export` · Biểu mẫu & xuất dữ liệu | ADMIN, FACULTY, LECTURER, STUDENT, COMMITTEE | — | DEMO | bị chặn |
| [R58](#r58) | `/profile` · Thông tin cá nhân | ADMIN, FACULTY, LECTURER, STUDENT, COMMITTEE | — | Ẩn | đã quan sát |
| [R59](#r59) | `/change-password` · Đổi mật khẩu | ADMIN, FACULTY, LECTURER, STUDENT, COMMITTEE | — | Ẩn | đã quan sát |
| [R60](#r60) | `/notifications` · Thông báo | ADMIN, FACULTY, LECTURER, STUDENT, COMMITTEE | — | API/DEMO | đã quan sát |
| [R61](#r61) | `/forbidden` · 403 | Phiên đã xác thực qua WorkspaceLayout | — | Không có mục manifest | đã quan sát |
| [R62](#r62) | `/*` · 404 | Phiên đã xác thực qua WorkspaceLayout | — | Không có mục manifest | bị chặn |

## Hồ sơ màn hình

Hành động dưới đây được xác định từ code; chỉ các thao tác ghi rõ ở evidence ledger mới được chạy trên trình duyệt. Các ca ghi/lưu/nộp/duyệt là **kế hoạch kiểm thử sau sửa**, chưa chạy trong audit này.

<a id="r01"></a>

### R01 — Kế hoạch và báo cáo tuần

- **Route / nguồn:** `/guidance/weeks` — [WeeklyPlansPage](../../frontend/src/features/weekly-plans/pages.tsx). Vai trò/permission/menu: hàng R01 ở bảng trên.
- **Mục đích và dữ liệu:** Tuần đã công bố, hạn và báo cáo của SV trong đợt; weekly-plans API.
- **Hành động / phạm vi quyền:** Chọn đợt/tuần, mở nhiệm vụ/báo cáo; Khoa quản lý tuần theo quyền. Thời hạn, trạng thái tuần, liên kết nhiệm vụ và bản nộp chính thức.
- **Kiểm chứng:** **đã quan sát**. E025 (STUDENT, 1440×900) — [ảnh](evidence/student-weeks-1440-25.png). Biến thể đã thấy: STUDENT 1440px.
- **Vấn đề / ưu tiên:** P1: [F03](01-ui-audit.md#f03), [F06](01-ui-audit.md#f06), [F11](01-ui-audit.md#f11).
- **Giải pháp đề xuất:** F03: Tách ba thông tin: hạn nhiệm vụ, thời điểm bản nộp, tình trạng đánh giá. Nêu rõ quá hạn của việc chưa hoàn thành khác nộp muộn. F06: Nhãn tiếng Việt và giờ Việt Nam thống nhất; đặt ID/hash/sự kiện gốc trong chi tiết có thể mở khi cần; điều chỉnh thông điệp theo vai trò. F11: Một ngữ cảnh đợt rõ, giữ liên kết URL/state; hiển thị filter đang dùng và xóa lọc; cảnh báo thay đợt theo hành vi hiện có.
- **Hành vi phải giữ:** Thời hạn, trạng thái tuần, liên kết nhiệm vụ và bản nộp chính thức.
- **Kiểm thử sau sửa:** Đối chiếu cùng một tuần với R10–R12; kiểm tra chưa mở/đang mở/quá hạn. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r02"></a>

### R02 — Nhận xét báo cáo

- **Route / nguồn:** `/guidance/review` — [ProgressReviewInboxPage](../../frontend/src/features/guidance-reviews/pages.tsx). Vai trò/permission/menu: hàng R02 ở bảng trên.
- **Mục đích và dữ liệu:** Hàng đợi báo cáo cần nhận xét; guidance-reviews API theo GV.
- **Hành động / phạm vi quyền:** Tìm SV/nhiệm vụ, lọc trạng thái, phân trang, mở bản nộp. Chỉ hồ sơ thuộc phạm vi được giao; không suy từ route permission thành quyền chấm.
- **Kiểm chứng:** **đã quan sát**. E024 (GV xét duyệt, 1440×900) — [ảnh](evidence/lecturer-review-1440-24.png). Biến thể đã thấy: GV xét duyệt 1440px.
- **Vấn đề / ưu tiên:** P2: [F09](01-ui-audit.md#f09), [F11](01-ui-audit.md#f11).
- **Giải pháp đề xuất:** F09: Empty theo nguyên nhân với hành động hợp quyền; loading có tên vùng; lỗi có retry khi an toàn. F11: Một ngữ cảnh đợt rõ, giữ liên kết URL/state; hiển thị filter đang dùng và xóa lọc; cảnh báo thay đợt theo hành vi hiện có.
- **Hành vi phải giữ:** Chỉ hồ sơ thuộc phạm vi được giao; không suy từ route permission thành quyền chấm.
- **Kiểm thử sau sửa:** So sánh GVHD có báo cáo với GV chưa có báo cáo; xóa bộ lọc. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r03"></a>

### R03 — Chi tiết nhận xét

- **Route / nguồn:** `/guidance/review/:submissionId` — [ProgressReviewDetailPage](../../frontend/src/features/guidance-reviews/pages.tsx). Vai trò/permission/menu: hàng R03 ở bảng trên.
- **Mục đích và dữ liệu:** Nội dung báo cáo, tệp, đánh giá hiện hành/lịch sử; submission context API.
- **Hành động / phạm vi quyền:** Đọc/tải tệp; GV ghi/sửa nhận xét, mở lại theo điều kiện; SV chỉ xem. Đúng phiên bản nộp, quyền GVHD, trạng thái khóa; sửa đánh giá có lý do/lịch sử.
- **Kiểm chứng:** **đã quan sát**. E046 (STUDENT, 1440×900) — [ảnh](evidence/student-review-detail-1440-46.png). Biến thể đã thấy: STUDENT 1440px; GVHD 1440px; GVHD 390px; GVHD 320px; GVHD 768px.
- **Vấn đề / ưu tiên:** P2: [F06](01-ui-audit.md#f06), [F08](01-ui-audit.md#f08).
- **Giải pháp đề xuất:** F06: Nhãn tiếng Việt và giờ Việt Nam thống nhất; đặt ID/hash/sự kiện gốc trong chi tiết có thể mở khi cần; điều chỉnh thông điệp theo vai trò. F08: API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có.
- **Hành vi phải giữ:** Đúng phiên bản nộp, quyền GVHD, trạng thái khóa; sửa đánh giá có lý do/lịch sử.
- **Kiểm thử sau sửa:** So sánh cùng ID ở SV/GV; validation nhận xét; kiểm tra readonly và lịch sử trong môi trường được phép ghi. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r04"></a>

### R04 — Theo dõi tiến độ

- **Route / nguồn:** `/guidance/progress` — [GuidanceProgressDashboardPage](../../frontend/src/features/guidance-reviews/pages.tsx). Vai trò/permission/menu: hàng R04 ở bảng trên.
- **Mục đích và dữ liệu:** Tiến độ toàn đợt theo SV/nhiệm vụ; guidance monitoring API.
- **Hành động / phạm vi quyền:** Chọn đợt, xem thống kê, tìm/lọc và mở hồ sơ. Giới hạn dữ liệu theo Khoa/đợt, công thức tiến độ.
- **Kiểm chứng:** **bị chặn**. E023 (FACULTY, 1440×900) — [ảnh](evidence/faculty-progress-1440-23.png). Biến thể đã thấy: Không có nội dung hoàn chỉnh. Chỉ quan sát loading/error của vùng hoặc shell; chưa kết luận về bảng/form nghiệp vụ phía dưới.
- **Vấn đề / ưu tiên:** P1: [F02](01-ui-audit.md#f02), [F09](01-ui-audit.md#f09).
- **Giải pháp đề xuất:** F02: Giữ shell và ngữ cảnh khi tải/lỗi; phân biệt tải ban đầu/làm mới, nêu lỗi dễ hiểu và retry đúng vùng. Điều tra API 500/timeout thành đầu việc tích hợp riêng trước khi mở rộng redesign. F09: Empty theo nguyên nhân với hành động hợp quyền; loading có tên vùng; lỗi có retry khi an toàn.
- **Hành vi phải giữ:** Giới hạn dữ liệu theo Khoa/đợt, công thức tiến độ.
- **Kiểm thử sau sửa:** Khi API phục hồi, đối chiếu số liệu với tuần/nhiệm vụ; empty/error/retry. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r05"></a>

### R05 — Nhật ký hướng dẫn

- **Route / nguồn:** `/guidance/meetings` — [GuidanceMeetingsPage](../../frontend/src/features/guidance-reviews/pages.tsx). Vai trò/permission/menu: hàng R05 ở bảng trên.
- **Mục đích và dữ liệu:** Nhật ký theo planId thực; guidance meetings API.
- **Hành động / phạm vi quyền:** Xem buổi hướng dẫn; GV thêm/sửa theo quyền. planId bắt buộc và đúng quan hệ GV–SV; SV đọc nhật ký của mình.
- **Kiểm chứng:** **đã quan sát**. E047 (STUDENT, 1440×900) — [ảnh](evidence/student-meetings-1440-47.png). Biến thể đã thấy: STUDENT 1440px.
- **Vấn đề / ưu tiên:** P2: [F09](01-ui-audit.md#f09).
- **Giải pháp đề xuất:** F09: Empty theo nguyên nhân với hành động hợp quyền; loading có tên vùng; lỗi có retry khi an toàn.
- **Hành vi phải giữ:** planId bắt buộc và đúng quan hệ GV–SV; SV đọc nhật ký của mình.
- **Kiểm thử sau sửa:** Mở từ R08 có planId; kiểm tra kế hoạch có/chưa có buổi. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r06"></a>

### R06 — Thông báo hướng dẫn

- **Route / nguồn:** `/guidance/notifications` — [GuidanceNotificationsPage](../../frontend/src/features/guidance-reviews/pages.tsx). Vai trò/permission/menu: hàng R06 ở bảng trên.
- **Mục đích và dữ liệu:** Thông báo cá nhân từ guidance-reviews notification API.
- **Hành động / phạm vi quyền:** Phân trang, mở hồ sơ liên quan, đánh dấu đã đọc. Trạng thái đã đọc chỉ đổi khi thao tác; liên kết chỉ xuất hiện khi có đích hợp lệ.
- **Kiểm chứng:** **đã quan sát**. E063 (STUDENT, 1440×900) — [ảnh](evidence/student-guidance-notifications-1440-63.png). Biến thể đã thấy: STUDENT 1440px.
- **Vấn đề / ưu tiên:** P2: [F06](01-ui-audit.md#f06), [F15](01-ui-audit.md#f15).
- **Giải pháp đề xuất:** F06: Nhãn tiếng Việt và giờ Việt Nam thống nhất; đặt ID/hash/sự kiện gốc trong chi tiết có thể mở khi cần; điều chỉnh thông điệp theo vai trò. F15: Một nhãn read/unread, tách delivery khi cần; nhất quán đường mở hồ sơ và empty.
- **Hành vi phải giữ:** Trạng thái đã đọc chỉ đổi khi thao tác; liên kết chỉ xuất hiện khi có đích hợp lệ.
- **Kiểm thử sau sửa:** Mở link mà không đổi read; kiểm tra thông báo cũ và hiện hành. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r07"></a>

### R07 — Kế hoạch hướng dẫn

- **Route / nguồn:** `/guidance/plan` — [GuidancePlanListPage](../../frontend/src/features/guidance-tasks/pages.tsx). Vai trò/permission/menu: hàng R07 ở bảng trên; nhãn menu theo vai trò: STUDENT: Kế hoạch của tôi; LECTURER: Kế hoạch hướng dẫn.
- **Mục đích và dữ liệu:** Đề cương đã duyệt/kế hoạch thuộc phạm vi API; proposalReviewApi.list(APPROVED).
- **Hành động / phạm vi quyền:** Chọn đợt, tìm/lọc, mở hoặc lập kế hoạch khi được phép. Phạm vi API có thể gồm quan hệ xét duyệt; quyền đọc không đồng nghĩa quyền giao việc.
- **Kiểm chứng:** **đã quan sát**. E050 (GVHD, 1440×900) — [ảnh](evidence/lecturer-plans-1440-50.png). Biến thể đã thấy: GVHD 1440px.
- **Vấn đề / ưu tiên:** P2: [F07](01-ui-audit.md#f07), [F11](01-ui-audit.md#f11).
- **Giải pháp đề xuất:** F07: Hiển thị quan hệ/phạm vi rõ và capability thao tác; kiểm chứng scope với API trước khi lọc. F11: Một ngữ cảnh đợt rõ, giữ liên kết URL/state; hiển thị filter đang dùng và xóa lọc; cảnh báo thay đợt theo hành vi hiện có.
- **Hành vi phải giữ:** Phạm vi API có thể gồm quan hệ xét duyệt; quyền đọc không đồng nghĩa quyền giao việc.
- **Kiểm thử sau sửa:** GVHD so với người xét duyệt; chỉ rõ quan hệ và kiểm tra canManage. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r08"></a>

### R08 — Chi tiết kế hoạch

- **Route / nguồn:** `/guidance/plan/:proposalId` — [GuidancePlanDetailPage](../../frontend/src/features/guidance-tasks/pages.tsx). Vai trò/permission/menu: hàng R08 ở bảng trên.
- **Mục đích và dữ liệu:** Kế hoạch, nhiệm vụ và liên kết nhật ký theo proposalId; guidance-tasks API.
- **Hành động / phạm vi quyền:** Mở nhiệm vụ/nhật ký; GV tạo nhiệm vụ hoặc lập kế hoạch theo điều kiện. Đề cương đủ điều kiện, một kế hoạch tương ứng, quyền GVHD và trạng thái.
- **Kiểm chứng:** **đã quan sát**. E016 (STUDENT, 1440×900) — [ảnh](evidence/student-plan-detail-1440-16.png). Biến thể đã thấy: STUDENT 1440px.
- **Vấn đề / ưu tiên:** P2: [F06](01-ui-audit.md#f06).
- **Giải pháp đề xuất:** F06: Nhãn tiếng Việt và giờ Việt Nam thống nhất; đặt ID/hash/sự kiện gốc trong chi tiết có thể mở khi cần; điều chỉnh thông điệp theo vai trò.
- **Hành vi phải giữ:** Đề cương đủ điều kiện, một kế hoạch tương ứng, quyền GVHD và trạng thái.
- **Kiểm thử sau sửa:** Kế hoạch có/chưa có nhiệm vụ; link giữ termId/planId. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r09"></a>

### R09 — Giao nhiệm vụ

- **Route / nguồn:** `/guidance/plan/:proposalId/tasks/new` — [GuidanceTaskCreatePage](../../frontend/src/features/guidance-tasks/pages.tsx). Vai trò/permission/menu: hàng R09 ở bảng trên.
- **Mục đích và dữ liệu:** Form giao nhiệm vụ cho kế hoạch; context kế hoạch API.
- **Hành động / phạm vi quyền:** Nhập loại, tên, mô tả, thời gian, yêu cầu; lưu khi hợp lệ. Quyền task:manage cộng quan hệ GVHD; mốc Asia/Ho_Chi_Minh và ràng buộc ngày.
- **Kiểm chứng:** **đã quan sát**. E049 (GVHD, 1440×900) — [ảnh](evidence/lecturer-task-create-1440-49.png). Biến thể đã thấy: GVHD 1440px.
- **Vấn đề / ưu tiên:** P2: [F08](01-ui-audit.md#f08), [F06](01-ui-audit.md#f06).
- **Giải pháp đề xuất:** F08: API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có. F06: Nhãn tiếng Việt và giờ Việt Nam thống nhất; đặt ID/hash/sự kiện gốc trong chi tiết có thể mở khi cần; điều chỉnh thông điệp theo vai trò.
- **Hành vi phải giữ:** Quyền task:manage cộng quan hệ GVHD; mốc Asia/Ho_Chi_Minh và ràng buộc ngày.
- **Kiểm thử sau sửa:** Bắt buộc/giới hạn ngày/lỗi trường; hủy không tạo nhiệm vụ. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r10"></a>

### R10 — Nhiệm vụ & tiến độ

- **Route / nguồn:** `/guidance/tasks` — [GuidanceTaskListPage](../../frontend/src/features/guidance-tasks/pages.tsx). Vai trò/permission/menu: hàng R10 ở bảng trên; nhãn menu theo vai trò: STUDENT: Nhiệm vụ & nộp báo cáo; LECTURER: Nhiệm vụ sinh viên.
- **Mục đích và dữ liệu:** Danh sách nhiệm vụ, hạn và trạng thái nộp theo đợt; guidance-tasks API.
- **Hành động / phạm vi quyền:** Tìm/lọc, mở chi tiết/nộp báo cáo. Tách trạng thái nhiệm vụ với tính đúng hạn của lần nộp; không đổi enum.
- **Kiểm chứng:** **đã quan sát**. E012 (STUDENT, 1440×900) — [ảnh](evidence/student-tasks-1440-12.png). Biến thể đã thấy: STUDENT 1440px.
- **Vấn đề / ưu tiên:** P1: [F03](01-ui-audit.md#f03), [F11](01-ui-audit.md#f11).
- **Giải pháp đề xuất:** F03: Tách ba thông tin: hạn nhiệm vụ, thời điểm bản nộp, tình trạng đánh giá. Nêu rõ quá hạn của việc chưa hoàn thành khác nộp muộn. F11: Một ngữ cảnh đợt rõ, giữ liên kết URL/state; hiển thị filter đang dùng và xóa lọc; cảnh báo thay đợt theo hành vi hiện có.
- **Hành vi phải giữ:** Tách trạng thái nhiệm vụ với tính đúng hạn của lần nộp; không đổi enum.
- **Kiểm thử sau sửa:** Bản nộp đúng hạn nhưng nhiệm vụ chưa hoàn thành; các bộ lọc và link. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r11"></a>

### R11 — Chi tiết nhiệm vụ

- **Route / nguồn:** `/guidance/tasks/:id` — [GuidanceTaskDetailPage](../../frontend/src/features/guidance-tasks/pages.tsx). Vai trò/permission/menu: hàng R11 ở bảng trên.
- **Mục đích và dữ liệu:** Chi tiết nhiệm vụ, tiêu chí và lịch sử sự kiện; guidance-tasks API.
- **Hành động / phạm vi quyền:** Mở lịch sử nộp, kế hoạch; thao tác theo quyền và trạng thái. Giữ sự kiện gốc, actor, thời điểm và khóa nộp.
- **Kiểm chứng:** **đã quan sát**. E013 (STUDENT, 1440×900) — [ảnh](evidence/student-task-detail-1440-13.png). Biến thể đã thấy: STUDENT 1440px.
- **Vấn đề / ưu tiên:** P1: [F03](01-ui-audit.md#f03), [F06](01-ui-audit.md#f06).
- **Giải pháp đề xuất:** F03: Tách ba thông tin: hạn nhiệm vụ, thời điểm bản nộp, tình trạng đánh giá. Nêu rõ quá hạn của việc chưa hoàn thành khác nộp muộn. F06: Nhãn tiếng Việt và giờ Việt Nam thống nhất; đặt ID/hash/sự kiện gốc trong chi tiết có thể mở khi cần; điều chỉnh thông điệp theo vai trò.
- **Hành vi phải giữ:** Giữ sự kiện gốc, actor, thời điểm và khóa nộp.
- **Kiểm thử sau sửa:** Đối chiếu ngày/hạn với R01/R12; lịch sử dễ đọc nhưng tra cứu được ID gốc. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r12"></a>

### R12 — Nộp báo cáo

- **Route / nguồn:** `/guidance/tasks/:id/submissions` — [TaskSubmissionsPage](../../frontend/src/features/task-submissions/pages.tsx). Vai trò/permission/menu: hàng R12 ở bảng trên.
- **Mục đích và dữ liệu:** Tệp báo cáo/source và lịch sử phiên bản; task-submissions API.
- **Hành động / phạm vi quyền:** Chọn tệp, nộp khi được phép; tải/xem lịch sử. Loại/dung lượng tệp, quy tắc commit, lần nộp chính thức, hạn và quyền sở hữu.
- **Kiểm chứng:** **đã quan sát**. E015 (STUDENT, 1440×900) — [ảnh](evidence/student-submissions-1440-15.png). Biến thể đã thấy: STUDENT 1440px.
- **Vấn đề / ưu tiên:** P1: [F03](01-ui-audit.md#f03), [F06](01-ui-audit.md#f06), [F08](01-ui-audit.md#f08).
- **Giải pháp đề xuất:** F03: Tách ba thông tin: hạn nhiệm vụ, thời điểm bản nộp, tình trạng đánh giá. Nêu rõ quá hạn của việc chưa hoàn thành khác nộp muộn. F06: Nhãn tiếng Việt và giờ Việt Nam thống nhất; đặt ID/hash/sự kiện gốc trong chi tiết có thể mở khi cần; điều chỉnh thông điệp theo vai trò. F08: API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có.
- **Hành vi phải giữ:** Loại/dung lượng tệp, quy tắc commit, lần nộp chính thức, hạn và quyền sở hữu.
- **Kiểm thử sau sửa:** Readonly khi quá hạn; lỗi tệp, tiến trình upload, thất bại/thử lại trong test được phép. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r13"></a>

### R13 — Chốt đề cương & bản giấy

- **Route / nguồn:** `/topic/dossier` — [DossierListPage](../../frontend/src/features/proposal-dossiers/pages.tsx). Vai trò/permission/menu: hàng R13 ở bảng trên; nhãn menu theo vai trò: STUDENT: Hồ sơ & bản in; LECTURER: Hồ sơ sinh viên; FACULTY: Chốt hồ sơ & nhận bản giấy.
- **Mục đích và dữ liệu:** Hồ sơ đã duyệt/chốt/nhận bản giấy theo đợt; proposal-dossiers API.
- **Hành động / phạm vi quyền:** Lọc/tìm, mở hồ sơ theo vai trò. Chốt hồ sơ khác duyệt đề cương, PDF khác xác nhận bản giấy.
- **Kiểm chứng:** **đã quan sát**. E026 (FACULTY, 1440×900) — [ảnh](evidence/faculty-dossier-list-1440-26.png). Biến thể đã thấy: FACULTY 1440px; FACULTY 390px.
- **Vấn đề / ưu tiên:** P2: [F11](01-ui-audit.md#f11).
- **Giải pháp đề xuất:** F11: Một ngữ cảnh đợt rõ, giữ liên kết URL/state; hiển thị filter đang dùng và xóa lọc; cảnh báo thay đợt theo hành vi hiện có.
- **Hành vi phải giữ:** Chốt hồ sơ khác duyệt đề cương, PDF khác xác nhận bản giấy.
- **Kiểm thử sau sửa:** Đối chiếu counts/bộ lọc với R14; SV/GV/Khoa có hành động khác nhau. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r14"></a>

### R14 — Chi tiết hồ sơ

- **Route / nguồn:** `/topic/dossier/:proposalId` — [DossierDetailPage](../../frontend/src/features/proposal-dossiers/pages.tsx). Vai trò/permission/menu: hàng R14 ở bảng trên.
- **Mục đích và dữ liệu:** Snapshot đề cương chính thức, PDF và receipt; dossier API theo proposalId.
- **Hành động / phạm vi quyền:** Chốt hồ sơ, tạo/tải PDF, nhận/đính chính bản giấy nếu đủ quyền. Phiên bản đã duyệt, tính bất biến snapshot, receipt và lịch sử.
- **Kiểm chứng:** **đã quan sát**. E043 (FACULTY, 1440×900) — [ảnh](evidence/faculty-dossier-detail-1440-43.png). Biến thể đã thấy: FACULTY 1440px.
- **Vấn đề / ưu tiên:** P2: [F06](01-ui-audit.md#f06).
- **Giải pháp đề xuất:** F06: Nhãn tiếng Việt và giờ Việt Nam thống nhất; đặt ID/hash/sự kiện gốc trong chi tiết có thể mở khi cần; điều chỉnh thông điệp theo vai trò.
- **Hành vi phải giữ:** Phiên bản đã duyệt, tính bất biến snapshot, receipt và lịch sử.
- **Kiểm thử sau sửa:** Chưa chốt/đã chốt/chưa PDF/đã nhận; không gộp các trạng thái. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r15"></a>

### R15 — Đề cương & phiên bản

- **Route / nguồn:** `/topic/proposal` — [ProposalEditorListPage](../../frontend/src/features/proposal-versions/pages.tsx). Vai trò/permission/menu: hàng R15 ở bảng trên; nhãn menu theo vai trò: STUDENT: Đề cương của tôi; LECTURER: Đề cương sinh viên; FACULTY: Tra cứu đề cương.
- **Mục đích và dữ liệu:** Danh sách đề cương và phiên bản trong phạm vi được đọc; proposal versions API.
- **Hành động / phạm vi quyền:** Tìm/lọc, mở editor/lịch sử. SV chỉ hồ sơ mình; GV/Khoa theo scope thật, không mở quyền ghi từ quyền đọc.
- **Kiểm chứng:** **đã quan sát**. E018 (FACULTY, 1440×900) — [ảnh](evidence/faculty-proposal-list-1440-18.png). Biến thể đã thấy: FACULTY 1440px; FACULTY 390px.
- **Vấn đề / ưu tiên:** P2: [F11](01-ui-audit.md#f11).
- **Giải pháp đề xuất:** F11: Một ngữ cảnh đợt rõ, giữ liên kết URL/state; hiển thị filter đang dùng và xóa lọc; cảnh báo thay đợt theo hành vi hiện có.
- **Hành vi phải giữ:** SV chỉ hồ sơ mình; GV/Khoa theo scope thật, không mở quyền ghi từ quyền đọc.
- **Kiểm thử sau sửa:** So sánh số bản và trạng thái với R16/R18; bộ lọc giữ đợt. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r16"></a>

### R16 — Phiên bản đề cương

- **Route / nguồn:** `/topic/proposal/:proposalId` — [VersionEditorPage](../../frontend/src/features/proposal-versions/pages.tsx). Vai trò/permission/menu: hàng R16 ở bảng trên.
- **Mục đích và dữ liệu:** Editor/snapshot bản hiện hành; proposal versions API.
- **Hành động / phạm vi quyền:** Lưu nháp, nộp phiên bản, xem diff/lịch sử khi được phép. Bản SEALED không sửa trực tiếp; sửa theo vòng xét duyệt và version id.
- **Kiểm chứng:** **đã quan sát**. E022 (STUDENT, 1440×900) — [ảnh](evidence/student-proposal-edit-1440-22.png). Biến thể đã thấy: STUDENT 1440px.
- **Vấn đề / ưu tiên:** P2: [F06](01-ui-audit.md#f06), [F08](01-ui-audit.md#f08).
- **Giải pháp đề xuất:** F06: Nhãn tiếng Việt và giờ Việt Nam thống nhất; đặt ID/hash/sự kiện gốc trong chi tiết có thể mở khi cần; điều chỉnh thông điệp theo vai trò. F08: API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có.
- **Hành vi phải giữ:** Bản SEALED không sửa trực tiếp; sửa theo vòng xét duyệt và version id.
- **Kiểm thử sau sửa:** Draft/revision/readonly; validation và version conflict trong test được phép. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r17"></a>

### R17 — Lịch sử đề cương

- **Route / nguồn:** `/topic/proposal/:proposalId/versions/:versionId` — [VersionEditorPage](../../frontend/src/features/proposal-versions/pages.tsx). Vai trò/permission/menu: hàng R17 ở bảng trên.
- **Mục đích và dữ liệu:** Snapshot phiên bản cụ thể của đề cương; versionId API.
- **Hành động / phạm vi quyền:** Đọc nội dung/lịch sử, quay về hiện hành. Không sửa phiên bản lịch sử; ID và thời điểm đúng bản.
- **Kiểm chứng:** **đã quan sát**. E042 (STUDENT, 1440×900) — [ảnh](evidence/student-version-1440-42.png). Biến thể đã thấy: STUDENT 1440px.
- **Vấn đề / ưu tiên:** P2: [F06](01-ui-audit.md#f06).
- **Giải pháp đề xuất:** F06: Nhãn tiếng Việt và giờ Việt Nam thống nhất; đặt ID/hash/sự kiện gốc trong chi tiết có thể mở khi cần; điều chỉnh thông điệp theo vai trò.
- **Hành vi phải giữ:** Không sửa phiên bản lịch sử; ID và thời điểm đúng bản.
- **Kiểm thử sau sửa:** So sánh nội dung bản cũ và hiện hành; không hiện nút ghi sai quyền. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r18"></a>

### R18 — Xét duyệt đề cương

- **Route / nguồn:** `/topic/reviews` — [ProposalReviewQueuePage](../../frontend/src/features/proposal-reviews/pages.tsx). Vai trò/permission/menu: hàng R18 ở bảng trên; nhãn menu theo vai trò: FACULTY: Phân công & xét duyệt; LECTURER: Đề cương cần xét duyệt; STUDENT: Kết quả xét duyệt.
- **Mục đích và dữ liệu:** Queue xét duyệt theo vai trò; proposal-reviews API.
- **Hành động / phạm vi quyền:** Lọc/tìm, mở nhận xét; Khoa chuyển phân công. Danh sách chờ xét khác danh sách đã có kết luận; scope và round.
- **Kiểm chứng:** **đã quan sát**. E017 (FACULTY, 1440×900) — [ảnh](evidence/faculty-proposal-reviews-1440-17.png). Biến thể đã thấy: FACULTY 1440px; FACULTY 390px.
- **Vấn đề / ưu tiên:** P2: [F11](01-ui-audit.md#f11), [F09](01-ui-audit.md#f09).
- **Giải pháp đề xuất:** F11: Một ngữ cảnh đợt rõ, giữ liên kết URL/state; hiển thị filter đang dùng và xóa lọc; cảnh báo thay đợt theo hành vi hiện có. F09: Empty theo nguyên nhân với hành động hợp quyền; loading có tên vùng; lỗi có retry khi an toàn.
- **Hành vi phải giữ:** Danh sách chờ xét khác danh sách đã có kết luận; scope và round.
- **Kiểm thử sau sửa:** Ba vai trò, trạng thái chưa phân công/đang xét/yêu cầu sửa/đã duyệt. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r19"></a>

### R19 — Chi tiết xét duyệt

- **Route / nguồn:** `/topic/reviews/:id` — [ProposalReviewDetailPage](../../frontend/src/features/proposal-reviews/pages.tsx). Vai trò/permission/menu: hàng R19 ở bảng trên.
- **Mục đích và dữ liệu:** Phiếu xét duyệt, bản đề cương và lịch sử; proposal review API.
- **Hành động / phạm vi quyền:** Thành viên được giao ghi nhận xét/kết luận; SV đọc. Đúng nhóm/thành viên/phiên bản/vòng; không thay quy tắc kết luận.
- **Kiểm chứng:** **đã quan sát**. E045 (GV xét duyệt, 1440×900) — [ảnh](evidence/lecturer-proposal-review-detail-1440-45.png). Biến thể đã thấy: GV xét duyệt 1440px.
- **Vấn đề / ưu tiên:** P2: [F06](01-ui-audit.md#f06), [F08](01-ui-audit.md#f08).
- **Giải pháp đề xuất:** F06: Nhãn tiếng Việt và giờ Việt Nam thống nhất; đặt ID/hash/sự kiện gốc trong chi tiết có thể mở khi cần; điều chỉnh thông điệp theo vai trò. F08: API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có.
- **Hành vi phải giữ:** Đúng nhóm/thành viên/phiên bản/vòng; không thay quy tắc kết luận.
- **Kiểm thử sau sửa:** Phiếu chưa bắt đầu so với đã kết luận; quyền người được giao và người đọc. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r20"></a>

### R20 — Phân công xét duyệt

- **Route / nguồn:** `/topic/review-assignments/:proposalId` — [ProposalReviewAssignmentPage](../../frontend/src/features/proposal-reviews/pages.tsx). Vai trò/permission/menu: hàng R20 ở bảng trên.
- **Mục đích và dữ liệu:** Thông tin đề cương và nhóm/thành viên có thể phân công; proposal-review API.
- **Hành động / phạm vi quyền:** Chọn nhóm/thành viên, lưu phân công theo điều kiện. Quyền proposal:assign, nhóm hợp lệ, thời hạn và hồ sơ đúng đợt.
- **Kiểm chứng:** **đã quan sát**. E044 (FACULTY, 1440×900) — [ảnh](evidence/faculty-review-assignment-1440-44.png). Biến thể đã thấy: FACULTY 1440px.
- **Vấn đề / ưu tiên:** P2: [F08](01-ui-audit.md#f08).
- **Giải pháp đề xuất:** F08: API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có.
- **Hành vi phải giữ:** Quyền proposal:assign, nhóm hợp lệ, thời hạn và hồ sơ đúng đợt.
- **Kiểm thử sau sửa:** Danh sách nhóm rỗng/khác đợt; validation, hủy không thay phân công. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r21"></a>

### R21 — Nhóm duyệt đề cương

- **Route / nguồn:** `/topic/review-groups` — [ReviewGroupListPage](../../frontend/src/features/review-groups/pages.tsx). Vai trò/permission/menu: hàng R21 ở bảng trên; nhãn menu theo vai trò: LECTURER: Nhóm duyệt của tôi.
- **Mục đích và dữ liệu:** Nhóm xét duyệt, trạng thái và thành viên theo đợt; review-groups API.
- **Hành động / phạm vi quyền:** Tìm/lọc/phân trang, xem/tạo/sửa/kích hoạt theo quyền. Nhóm đã hoạt động có ràng buộc chỉnh thành viên; không xóa để đơn giản UI.
- **Kiểm chứng:** **đã quan sát**. E014 (FACULTY, 1440×900) — [ảnh](evidence/faculty-groups-1440-14.png). Biến thể đã thấy: FACULTY 1440px.
- **Vấn đề / ưu tiên:** P2: [F11](01-ui-audit.md#f11).
- **Giải pháp đề xuất:** F11: Một ngữ cảnh đợt rõ, giữ liên kết URL/state; hiển thị filter đang dùng và xóa lọc; cảnh báo thay đợt theo hành vi hiện có.
- **Hành vi phải giữ:** Nhóm đã hoạt động có ràng buộc chỉnh thành viên; không xóa để đơn giản UI.
- **Kiểm thử sau sửa:** Khoa và GV, nhóm nháp/hoạt động, filter không làm mất đợt. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r22"></a>

### R22 — Tạo nhóm duyệt

- **Route / nguồn:** `/topic/review-groups/new` — [ReviewGroupEditorPage](../../frontend/src/features/review-groups/pages.tsx). Vai trò/permission/menu: hàng R22 ở bảng trên.
- **Mục đích và dữ liệu:** Form tạo nhóm; options đợt/bộ môn/GV từ review-groups API.
- **Hành động / phạm vi quyền:** Chọn đợt, tên, bộ môn, thành viên; lưu/hủy. review-group:manage, dữ liệu options thật, ràng buộc thành viên.
- **Kiểm chứng:** **đã quan sát**. E020 (FACULTY, 1440×900) — [ảnh](evidence/faculty-group-create-1440-20.png). Biến thể đã thấy: FACULTY 1440px; FACULTY 390px.
- **Vấn đề / ưu tiên:** P2: [F08](01-ui-audit.md#f08).
- **Giải pháp đề xuất:** F08: API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có.
- **Hành vi phải giữ:** review-group:manage, dữ liệu options thật, ràng buộc thành viên.
- **Kiểm thử sau sửa:** Trường bắt buộc, thêm/bỏ thành viên cục bộ, hủy không ghi. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r23"></a>

### R23 — Sửa nhóm duyệt

- **Route / nguồn:** `/topic/review-groups/:id/edit` — [ReviewGroupEditorPage](../../frontend/src/features/review-groups/pages.tsx). Vai trò/permission/menu: hàng R23 ở bảng trên.
- **Mục đích và dữ liệu:** Form nhóm hiện có và options API.
- **Hành động / phạm vi quyền:** Sửa trường được phép, lưu/hủy. Giữ khóa thành viên của nhóm đang hoạt động và lý do disabled.
- **Kiểm chứng:** **đã quan sát**. E021 (FACULTY, 1440×900) — [ảnh](evidence/faculty-group-edit-1440-21.png). Biến thể đã thấy: FACULTY 1440px.
- **Vấn đề / ưu tiên:** P2: [F08](01-ui-audit.md#f08).
- **Giải pháp đề xuất:** F08: API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có.
- **Hành vi phải giữ:** Giữ khóa thành viên của nhóm đang hoạt động và lý do disabled.
- **Kiểm thử sau sửa:** So sánh nhóm nháp/hoạt động; không bật lại control bị nghiệp vụ khóa. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r24"></a>

### R24 — Chi tiết nhóm duyệt

- **Route / nguồn:** `/topic/review-groups/:id` — [ReviewGroupDetailPage](../../frontend/src/features/review-groups/pages.tsx). Vai trò/permission/menu: hàng R24 ở bảng trên.
- **Mục đích và dữ liệu:** Chi tiết nhóm, thành viên, trạng thái; review-groups API.
- **Hành động / phạm vi quyền:** Quay về danh sách, sửa/thay trạng thái khi được phép. Vai trò thành viên và lịch sử hoạt động.
- **Kiểm chứng:** **đã quan sát**. E019 (FACULTY, 1440×900) — [ảnh](evidence/faculty-group-detail-1440-19.png). Biến thể đã thấy: FACULTY 1440px.
- **Vấn đề / ưu tiên:** P2: [F06](01-ui-audit.md#f06).
- **Giải pháp đề xuất:** F06: Nhãn tiếng Việt và giờ Việt Nam thống nhất; đặt ID/hash/sự kiện gốc trong chi tiết có thể mở khi cần; điều chỉnh thông điệp theo vai trò.
- **Hành vi phải giữ:** Vai trò thành viên và lịch sử hoạt động.
- **Kiểm thử sau sửa:** Deep-link đúng ID/đợt; GV đọc và Khoa quản lý. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r25"></a>

### R25 — Đăng nhập

- **Route / nguồn:** `/login` — [LoginPage](../../frontend/src/features/auth/pages/LoginPage.tsx). Vai trò/permission/menu: hàng R25 ở bảng trên.
- **Mục đích và dữ liệu:** Xác thực tài khoản; auth API.
- **Hành động / phạm vi quyền:** Đăng nhập, hiện/ẩn mật khẩu, hỗ trợ quên mật khẩu. Redirect from, bắt buộc đổi mật khẩu, lỗi xác thực không tiết lộ bí mật.
- **Kiểm chứng:** **đã quan sát**. E080 (ANON, 1440×900) — [ảnh](evidence/anon-login-1440-80.png). Biến thể đã thấy: ANON 1440px; ANON 390px; ANON 320px; ANON 768px.
- **Vấn đề / ưu tiên:** P2: [F14](01-ui-audit.md#f14), [F08](01-ui-audit.md#f08).
- **Giải pháp đề xuất:** F14: Hướng dẫn liên hệ quản trị đúng môi trường, bỏ thông tin không cần thiết trong nội dung người dùng; gọi đúng chính sách đang áp dụng. F08: API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có.
- **Hành vi phải giữ:** Redirect from, bắt buộc đổi mật khẩu, lỗi xác thực không tiết lộ bí mật.
- **Kiểm thử sau sửa:** Required cục bộ, Tab/Escape dialog, mobile; thử auth lỗi bằng tài khoản kiểm thử được phép. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r26"></a>

### R26 — Tổng quan

- **Route / nguồn:** `/` — [DashboardPage](../../frontend/src/features/report/pages/DashboardPage.tsx). Vai trò/permission/menu: hàng R26 ở bảng trên.
- **Mục đích và dữ liệu:** Tổng quan cá nhân/đợt từ dashboard-service trên API snapshot.
- **Hành động / phạm vi quyền:** Chọn đợt, mở nhiệm vụ tiếp theo, thống kê/hồ sơ/mốc thời gian. Phạm vi vai trò, số liệu API, link nghiệp vụ và công bố phân công.
- **Kiểm chứng:** **đã quan sát**. E004 (STUDENT, 1440×900) — [ảnh](evidence/student-dashboard-1440-4.png). Biến thể đã thấy: STUDENT 1440px; GV xét duyệt 1440px; STUDENT 390px; FACULTY 1440px.
- **Vấn đề / ưu tiên:** P1: [F01](01-ui-audit.md#f01), [F02](01-ui-audit.md#f02), [F10](01-ui-audit.md#f10).
- **Giải pháp đề xuất:** F01: Nêu rõ phạm vi tiến độ; một hệ mốc nhất quán; ưu tiên hành động theo vai trò và giai đoạn từ dữ liệu chuẩn hiện có. F02: Giữ shell và ngữ cảnh khi tải/lỗi; phân biệt tải ban đầu/làm mới, nêu lỗi dễ hiểu và retry đúng vùng. Điều tra API 500/timeout thành đầu việc tích hợp riêng trước khi mở rộng redesign. F10: Scale chữ/spacing chung, giảm khung và nền phụ, một CTA chính; ưu tiên tokens và kit hiện có. Giảm blur/gradient/hover nâng thẻ nơi không hỗ trợ tác vụ.
- **Hành vi phải giữ:** Phạm vi vai trò, số liệu API, link nghiệp vụ và công bố phân công.
- **Kiểm thử sau sửa:** Ba vai trò ở đợt đăng ký/đề cương/hướng dẫn; CTA phải khớp việc còn lại. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r27"></a>

### R27 — Tài khoản

- **Route / nguồn:** `/admin/accounts` — [AccountsPage](../../frontend/src/features/auth/pages/AccountsPage.tsx). Vai trò/permission/menu: hàng R27 ở bảng trên.
- **Mục đích và dữ liệu:** Danh sách tài khoản/vai trò/trạng thái từ auth service.
- **Hành động / phạm vi quyền:** Tìm/lọc, tạo/sửa, khóa/mở, đặt lại mật khẩu theo quyền. Admin, vòng đời tài khoản, mustChangePassword và thông tin học vụ.
- **Kiểm chứng:** **chỉ đọc code**. Không có phiên ADMIN được cấp; không mở màn.. Biến thể đã thấy: Không có nội dung hoàn chỉnh.
- **Vấn đề / ưu tiên:** P2: [F08](01-ui-audit.md#f08).
- **Giải pháp đề xuất:** F08: API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có.
- **Hành vi phải giữ:** Admin, vòng đời tài khoản, mustChangePassword và thông tin học vụ.
- **Kiểm thử sau sửa:** Cần tài khoản Admin được cấp; kiểm tra dialog và trạng thái khóa; chưa kiểm tra browser. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r28"></a>

### R28 — Vai trò & quyền

- **Route / nguồn:** `/admin/roles` — [RolesPermissionsPage](../../frontend/src/features/auth/pages/RolesPermissionsPage.tsx). Vai trò/permission/menu: hàng R28 ở bảng trên.
- **Mục đích và dữ liệu:** Ma trận route theo routeManifest và số liệu tài khoản.
- **Hành động / phạm vi quyền:** Chọn vai trò/nhóm, tìm route, sang cấp vai trò. Không đổi RBAC; giải thích role allowlist khác permission thực và scope.
- **Kiểm chứng:** **chỉ đọc code**. Không có phiên ADMIN được cấp; không mở màn.. Biến thể đã thấy: Không có nội dung hoàn chỉnh.
- **Vấn đề / ưu tiên:** P2: [F12](01-ui-audit.md#f12).
- **Giải pháp đề xuất:** F12: Tách allowlist/permission/menu/scope trong phần trình bày, diễn giải giới hạn ma trận.
- **Hành vi phải giữ:** Không đổi RBAC; giải thích role allowlist khác permission thực và scope.
- **Kiểm thử sau sửa:** Đối chiếu từng dấu với canAccessRoute, menuMode/menuRoles; cần phiên Admin. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r29"></a>

### R29 — Nhật ký hoạt động

- **Route / nguồn:** `/admin/audit-logs` — [AuditLogPage](../../frontend/src/features/auth/pages/AuditLogPage.tsx). Vai trò/permission/menu: hàng R29 ở bảng trên.
- **Mục đích và dữ liệu:** Nhật ký hoạt động từ db.audits/API snapshot.
- **Hành động / phạm vi quyền:** Lọc thời gian/người/thao tác, mở chi tiết. audit:read; giờ Việt Nam, log chỉ đọc.
- **Kiểm chứng:** **bị chặn**. E069 (FACULTY, 1440×900) — [ảnh](evidence/faculty-audit-logs-1440-69.png). Biến thể đã thấy: Không có nội dung hoàn chỉnh. Chỉ quan sát loading/error của vùng hoặc shell; chưa kết luận về bảng/form nghiệp vụ phía dưới.
- **Vấn đề / ưu tiên:** P1: [F02](01-ui-audit.md#f02).
- **Giải pháp đề xuất:** F02: Giữ shell và ngữ cảnh khi tải/lỗi; phân biệt tải ban đầu/làm mới, nêu lỗi dễ hiểu và retry đúng vùng. Điều tra API 500/timeout thành đầu việc tích hợp riêng trước khi mở rộng redesign.
- **Hành vi phải giữ:** audit:read; giờ Việt Nam, log chỉ đọc.
- **Kiểm thử sau sửa:** Phục hồi tải trước; lọc biên ngày, mở/đóng dialog, không thay nhật ký. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r30"></a>

### R30 — Sinh viên

- **Route / nguồn:** `/catalog/students` — [StudentListPage](../../frontend/src/features/catalog/pages/StudentListPage.tsx). Vai trò/permission/menu: hàng R30 ở bảng trên.
- **Mục đích và dữ liệu:** Danh mục SV, liên hệ, học vụ và điều kiện từ catalog API/snapshot.
- **Hành động / phạm vi quyền:** Tìm/lọc/sort/phân trang; tạo/sửa/xóa theo quyền. Học vụ, GPA, liên hệ, danh sách tham gia; không đổi điều kiện đủ.
- **Kiểm chứng:** **đã quan sát**. E031 (FACULTY, 1440×900) — ảnh bỏ để giảm thông tin liên hệ ngoài mẫu. Biến thể đã thấy: FACULTY 1440px.
- **Vấn đề / ưu tiên:** P2: [F08](01-ui-audit.md#f08), [F10](01-ui-audit.md#f10).
- **Giải pháp đề xuất:** F08: API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có. F10: Scale chữ/spacing chung, giảm khung và nền phụ, một CTA chính; ưu tiên tokens và kit hiện có. Giảm blur/gradient/hover nâng thẻ nơi không hỗ trợ tác vụ.
- **Hành vi phải giữ:** Học vụ, GPA, liên hệ, danh sách tham gia; không đổi điều kiện đủ.
- **Kiểm thử sau sửa:** Bảng desktop/card mobile; kiểm tra search, lỗi form; dữ liệu ngoài mẫu không đưa vào ảnh. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r31"></a>

### R31 — Giảng viên

- **Route / nguồn:** `/catalog/lecturers` — [LecturerListPage](../../frontend/src/features/catalog/pages/LecturerListPage.tsx). Vai trò/permission/menu: hàng R31 ở bảng trên.
- **Mục đích và dữ liệu:** Danh mục GV, bộ môn, hướng chuyên môn và tải hướng dẫn từ catalog API.
- **Hành động / phạm vi quyền:** Tìm/lọc, xem và quản lý khi có quyền. GV xem không đồng nghĩa được sửa; quota theo đợt/hệ.
- **Kiểm chứng:** **đã quan sát**. E032 (FACULTY, 1440×900) — ảnh bỏ để giảm thông tin liên hệ ngoài mẫu. Biến thể đã thấy: FACULTY 1440px.
- **Vấn đề / ưu tiên:** P2: [F08](01-ui-audit.md#f08), [F10](01-ui-audit.md#f10).
- **Giải pháp đề xuất:** F08: API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có. F10: Scale chữ/spacing chung, giảm khung và nền phụ, một CTA chính; ưu tiên tokens và kit hiện có. Giảm blur/gradient/hover nâng thẻ nơi không hỗ trợ tác vụ.
- **Hành vi phải giữ:** GV xem không đồng nghĩa được sửa; quota theo đợt/hệ.
- **Kiểm thử sau sửa:** So sánh GV/Khoa, liên hệ và quota; mobile card không mất hành động. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r32"></a>

### R32 — Import dữ liệu

- **Route / nguồn:** `/catalog/import` — [ImportPage](../../frontend/src/features/catalog/pages/ImportPage.tsx). Vai trò/permission/menu: hàng R32 ở bảng trên.
- **Mục đích và dữ liệu:** Wizard nhập dữ liệu Excel/CSV; catalog import service.
- **Hành động / phạm vi quyền:** Chọn loại/tệp, kiểm tra trước, xác nhận import. Bước preview khác bước ghi; lỗi từng dòng, chống nhập sai dữ liệu.
- **Kiểm chứng:** **đã quan sát**. E033 (FACULTY, 1440×900) — [ảnh](evidence/faculty-import-1440-33.png). Biến thể đã thấy: FACULTY 1440px.
- **Vấn đề / ưu tiên:** P2: [F08](01-ui-audit.md#f08).
- **Giải pháp đề xuất:** F08: API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có.
- **Hành vi phải giữ:** Bước preview khác bước ghi; lỗi từng dòng, chống nhập sai dữ liệu.
- **Kiểm thử sau sửa:** Chỉ mở bước đầu trong audit; test tệp hợp lệ/lỗi và transaction ở môi trường riêng. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r33"></a>

### R33 — Danh mục đào tạo

- **Route / nguồn:** `/catalog/reference` — [ReferenceCatalogPage](../../frontend/src/features/catalog/pages/ReferenceCatalogPage.tsx). Vai trò/permission/menu: hàng R33 ở bảng trên.
- **Mục đích và dữ liệu:** Bộ môn/hệ/hướng/kỳ học từ catalog service.
- **Hành động / phạm vi quyền:** Đổi tab, tìm, thêm/sửa/xóa theo quyền. Quan hệ danh mục được tham chiếu; không xóa chức năng để đẹp UI.
- **Kiểm chứng:** **đã quan sát**. E034 (FACULTY, 1440×900) — [ảnh](evidence/faculty-catalog-1440-34.png). Biến thể đã thấy: FACULTY 1440px.
- **Vấn đề / ưu tiên:** P2: [F08](01-ui-audit.md#f08).
- **Giải pháp đề xuất:** F08: API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có.
- **Hành vi phải giữ:** Quan hệ danh mục được tham chiếu; không xóa chức năng để đẹp UI.
- **Kiểm thử sau sửa:** Từng tab và dependency delete validation; audit mới mở tab bộ môn. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r34"></a>

### R34 — Kỳ học & đợt đồ án

- **Route / nguồn:** `/terms` — [TermListPage](../../frontend/src/features/term/pages/TermListPage.tsx). Vai trò/permission/menu: hàng R34 ở bảng trên.
- **Mục đích và dữ liệu:** Kỳ học/đợt, thời gian, hệ và trạng thái từ term service.
- **Hành động / phạm vi quyền:** Tìm/lọc/sort, xem/tạo/sửa/đổi trạng thái theo quyền. Điều kiện đóng/mở/khóa, giới hạn dữ liệu theo đợt.
- **Kiểm chứng:** **đã quan sát**. E006 (FACULTY, 1440×900) — [ảnh](evidence/faculty-terms-1440-6.png). Biến thể đã thấy: FACULTY 1440px.
- **Vấn đề / ưu tiên:** P1: [F02](01-ui-audit.md#f02), [F10](01-ui-audit.md#f10).
- **Giải pháp đề xuất:** F02: Giữ shell và ngữ cảnh khi tải/lỗi; phân biệt tải ban đầu/làm mới, nêu lỗi dễ hiểu và retry đúng vùng. Điều tra API 500/timeout thành đầu việc tích hợp riêng trước khi mở rộng redesign. F10: Scale chữ/spacing chung, giảm khung và nền phụ, một CTA chính; ưu tiên tokens và kit hiện có. Giảm blur/gradient/hover nâng thẻ nơi không hỗ trợ tác vụ.
- **Hành vi phải giữ:** Điều kiện đóng/mở/khóa, giới hạn dữ liệu theo đợt.
- **Kiểm thử sau sửa:** Bảng7 đợt baseline; search rỗng, dialog hủy, 4 viewport khi API phục hồi. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r35"></a>

### R35 — Chi tiết đợt

- **Route / nguồn:** `/terms/:id` — [TermDetailPage](../../frontend/src/features/term/pages/TermDetailPage.tsx). Vai trò/permission/menu: hàng R35 ở bảng trên.
- **Mục đích và dữ liệu:** Thông tin đợt và liên kết cấu hình từ term service.
- **Hành động / phạm vi quyền:** Mở kế hoạch/tham số/roster, sửa theo quyền. Đúng id, hệ/kỳ học, trạng thái lifecycle.
- **Kiểm chứng:** **đã quan sát**. E027 (FACULTY, 1440×900) — [ảnh](evidence/faculty-term-detail-1440-27.png). Biến thể đã thấy: FACULTY 1440px.
- **Vấn đề / ưu tiên:** P1: [F01](01-ui-audit.md#f01), [F10](01-ui-audit.md#f10).
- **Giải pháp đề xuất:** F01: Nêu rõ phạm vi tiến độ; một hệ mốc nhất quán; ưu tiên hành động theo vai trò và giai đoạn từ dữ liệu chuẩn hiện có. F10: Scale chữ/spacing chung, giảm khung và nền phụ, một CTA chính; ưu tiên tokens và kit hiện có. Giảm blur/gradient/hover nâng thẻ nơi không hỗ trợ tác vụ.
- **Hành vi phải giữ:** Đúng id, hệ/kỳ học, trạng thái lifecycle.
- **Kiểm thử sau sửa:** Đối chiếu7 giai đoạn với R36 và tổng quan; deep link giữ id. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r36"></a>

### R36 — Kế hoạch giai đoạn

- **Route / nguồn:** `/terms/:id/phases` — [PhasePlanPage](../../frontend/src/features/term/pages/PhasePlanPage.tsx). Vai trò/permission/menu: hàng R36 ở bảng trên.
- **Mục đích và dữ liệu:** Các giai đoạn, lịch và trạng thái khóa của đợt từ term service.
- **Hành động / phạm vi quyền:** Sửa mốc, khóa/mở khi được phép. Thứ tự, không chồng sai mốc, giới hạn đóng/mở nghiệp vụ.
- **Kiểm chứng:** **đã quan sát**. E028 (FACULTY, 1440×900) — [ảnh](evidence/faculty-phases-1440-28.png). Biến thể đã thấy: FACULTY 1440px.
- **Vấn đề / ưu tiên:** P2: [F08](01-ui-audit.md#f08), [F10](01-ui-audit.md#f10).
- **Giải pháp đề xuất:** F08: API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có. F10: Scale chữ/spacing chung, giảm khung và nền phụ, một CTA chính; ưu tiên tokens và kit hiện có. Giảm blur/gradient/hover nâng thẻ nơi không hỗ trợ tác vụ.
- **Hành vi phải giữ:** Thứ tự, không chồng sai mốc, giới hạn đóng/mở nghiệp vụ.
- **Kiểm thử sau sửa:** Boundary ngày giờ, dependency giữa giai đoạn, readonly đợt khóa. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r37"></a>

### R37 — Tham số đợt

- **Route / nguồn:** `/terms/:id/parameters` — [TermParameterPage](../../frontend/src/features/term/pages/TermParameterPage.tsx). Vai trò/permission/menu: hàng R37 ở bảng trên.
- **Mục đích và dữ liệu:** Tham số đăng ký, GPA/tín chỉ/nguyện vọng/quota và chính sách phân công.
- **Hành động / phạm vi quyền:** Nhập/lưu cấu hình theo quyền. Validation giới hạn, chính sách thật; không thay thuật toán khi redesign.
- **Kiểm chứng:** **đã quan sát**. E029 (FACULTY, 1440×900) — [ảnh](evidence/faculty-parameters-1440-29.png). Biến thể đã thấy: FACULTY 1440px.
- **Vấn đề / ưu tiên:** P2: [F14](01-ui-audit.md#f14), [F08](01-ui-audit.md#f08).
- **Giải pháp đề xuất:** F14: Hướng dẫn liên hệ quản trị đúng môi trường, bỏ thông tin không cần thiết trong nội dung người dùng; gọi đúng chính sách đang áp dụng. F08: API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có.
- **Hành vi phải giữ:** Validation giới hạn, chính sách thật; không thay thuật toán khi redesign.
- **Kiểm thử sau sửa:** Số âm/min/max, lỗi trường và copy demo; so sánh cấu hình trước/sau. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r38"></a>

### R38 — Danh sách tham gia

- **Route / nguồn:** `/terms/:id/roster` — [TermRosterPage](../../frontend/src/features/term/pages/TermRosterPage.tsx). Vai trò/permission/menu: hàng R38 ở bảng trên.
- **Mục đích và dữ liệu:** SV/GV tham gia đợt và quota theo hệ; term roster service.
- **Hành động / phạm vi quyền:** Đổi tab, tìm/phân trang, thêm/bỏ/cập nhật quota theo quyền. Điều kiện học vụ và công thức quota; quan hệ hồ sơ đang dùng.
- **Kiểm chứng:** **đã quan sát**. E030 (FACULTY, 1440×900) — [ảnh](evidence/faculty-roster-1440-30.png). Biến thể đã thấy: FACULTY 1440px.
- **Vấn đề / ưu tiên:** P2: [F08](01-ui-audit.md#f08).
- **Giải pháp đề xuất:** F08: API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có.
- **Hành vi phải giữ:** Điều kiện học vụ và công thức quota; quan hệ hồ sơ đang dùng.
- **Kiểm thử sau sửa:** Tab SV đã mở; bổ sung tab GV, trang2, trường hợp đã phát sinh hồ sơ. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r39"></a>

### R39 — Đăng ký nguyện vọng

- **Route / nguồn:** `/registration` — [StudentRegistrationPage](../../frontend/src/features/registration/pages/StudentRegistrationPage.tsx). Vai trò/permission/menu: hàng R39 ở bảng trên.
- **Mục đích và dữ liệu:** Hồ sơ đăng ký, hướng, tối đa ba NV, thông tin liên hệ và hạn; registration API.
- **Hành động / phạm vi quyền:** Chọn hướng/GV, sắp thứ tự; lưu nháp/nộp/cập nhật trong thời gian cho phép. GPA/tín chỉ/liên hệ, NV không trùng, hạn/khóa đợt, trạng thái draft/submitted.
- **Kiểm chứng:** **đã quan sát**. E011 (STUDENT, 1440×900) — [ảnh](evidence/student-registration-1440-11.png). Biến thể đã thấy: STUDENT 1440px; STUDENT 390px; STUDENT 320px; STUDENT 768px.
- **Vấn đề / ưu tiên:** P2: [F08](01-ui-audit.md#f08), [F10](01-ui-audit.md#f10).
- **Giải pháp đề xuất:** F08: API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có. F10: Scale chữ/spacing chung, giảm khung và nền phụ, một CTA chính; ưu tiên tokens và kit hiện có. Giảm blur/gradient/hover nâng thẻ nơi không hỗ trợ tác vụ.
- **Hành vi phải giữ:** GPA/tín chỉ/liên hệ, NV không trùng, hạn/khóa đợt, trạng thái draft/submitted.
- **Kiểm thử sau sửa:** Bản đã nộp còn hạn; hết hạn/thiếu liên hệ/NV trùng; hủy không ghi. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r40"></a>

### R40 — Danh sách đăng ký

- **Route / nguồn:** `/registration/list` — [RegistrationListPage](../../frontend/src/features/registration/pages/RegistrationListPage.tsx). Vai trò/permission/menu: hàng R40 ở bảng trên.
- **Mục đích và dữ liệu:** Đăng ký của đợt, hướng/NV/trạng thái; registration API.
- **Hành động / phạm vi quyền:** Tìm/lọc, xem chi tiết theo quyền. Phân biệt nháp/đã nộp, scope đợt, giữ nguyên dữ liệu NV.
- **Kiểm chứng:** **đã quan sát**. E035 (FACULTY, 1440×900) — [ảnh](evidence/faculty-registration-list-1440-35.png). Biến thể đã thấy: FACULTY 1440px.
- **Vấn đề / ưu tiên:** P2: [F10](01-ui-audit.md#f10).
- **Giải pháp đề xuất:** F10: Scale chữ/spacing chung, giảm khung và nền phụ, một CTA chính; ưu tiên tokens và kit hiện có. Giảm blur/gradient/hover nâng thẻ nơi không hỗ trợ tác vụ.
- **Hành vi phải giữ:** Phân biệt nháp/đã nộp, scope đợt, giữ nguyên dữ liệu NV.
- **Kiểm thử sau sửa:** 8 hồ sơ mẫu gồm4 nháp4 đã nộp; lọc và đối chiếu chi tiết. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r41"></a>

### R41 — Phân công GVHD

- **Route / nguồn:** `/registration/assignment` — [AssignmentPlanPage](../../frontend/src/features/registration/pages/AssignmentPlanPage.tsx). Vai trò/permission/menu: hàng R41 ở bảng trên.
- **Mục đích và dữ liệu:** Phương án, kết quả theo SV/GV/quota/lý do, công bố và outbox; assignment API.
- **Hành động / phạm vi quyền:** Xem/tạo/chốt/công bố hoặc xử lý thông báo theo trạng thái. Thuật toán, khóa/phê duyệt, published, quota và audit; không tự sửa reason.
- **Kiểm chứng:** **đã quan sát**. E036 (FACULTY, 1440×900) — [ảnh](evidence/faculty-assignment-1440-36.png). Biến thể đã thấy: FACULTY 1440px.
- **Vấn đề / ưu tiên:** P1: [F05](01-ui-audit.md#f05), [F06](01-ui-audit.md#f06).
- **Giải pháp đề xuất:** F05: Đối soát reason tại adapter/API và dữ liệu mẫu; sau khi thống nhất nghĩa, hiển thị nhãn phù hợp. Tách khỏi thay đổi màu/bố cục. F06: Nhãn tiếng Việt và giờ Việt Nam thống nhất; đặt ID/hash/sự kiện gốc trong chi tiết có thể mở khi cần; điều chỉnh thông điệp theo vai trò.
- **Hành vi phải giữ:** Thuật toán, khóa/phê duyệt, published, quota và audit; không tự sửa reason.
- **Kiểm thử sau sửa:** Đối chiếu reason với assigned/published; kiểm tra theo từng trạng thái và quyền, không gửi lại thư trong audit. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r42"></a>

### R42 — Kết quả phân công

- **Route / nguồn:** `/registration/result` — [AssignmentResultPage](../../frontend/src/features/registration/pages/AssignmentResultPage.tsx). Vai trò/permission/menu: hàng R42 ở bảng trên.
- **Mục đích và dữ liệu:** Kết quả phân công đã công bố theo người dùng/đợt; assignment API.
- **Hành động / phạm vi quyền:** Đọc GVHD/danh sách, sang thống nhất đề tài. Chưa công bố không lộ kết quả; SV chỉ bản của mình, GV theo phân công.
- **Kiểm chứng:** **đã quan sát**. E038 (STUDENT, 1440×900) — [ảnh](evidence/student-result-1440-38.png). Biến thể đã thấy: STUDENT 1440px.
- **Vấn đề / ưu tiên:** P2: [F10](01-ui-audit.md#f10).
- **Giải pháp đề xuất:** F10: Scale chữ/spacing chung, giảm khung và nền phụ, một CTA chính; ưu tiên tokens và kit hiện có. Giảm blur/gradient/hover nâng thẻ nơi không hỗ trợ tác vụ.
- **Hành vi phải giữ:** Chưa công bố không lộ kết quả; SV chỉ bản của mình, GV theo phân công.
- **Kiểm thử sau sửa:** Trước/sau công bố, không có phân công, link sang R44. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r43"></a>

### R43 — Điều chỉnh phân công

- **Route / nguồn:** `/registration/manual` — [ManualAdjustPage](../../frontend/src/features/registration/pages/ManualAdjustPage.tsx). Vai trò/permission/menu: hàng R43 ở bảng trên.
- **Mục đích và dữ liệu:** Form điều chỉnh SV–GV và lý do trên phương án; assignment API.
- **Hành động / phạm vi quyền:** Chọn SV/GV, nhập lý do, lưu khi hợp lệ. Quota, điều kiện đổi, lịch sử và công bố; không tự chạy lại phân công.
- **Kiểm chứng:** **đã quan sát**. E037 (FACULTY, 1440×900) — [ảnh](evidence/faculty-manual-1440-37.png). Biến thể đã thấy: FACULTY 1440px.
- **Vấn đề / ưu tiên:** P2: [F08](01-ui-audit.md#f08).
- **Giải pháp đề xuất:** F08: API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có.
- **Hành vi phải giữ:** Quota, điều kiện đổi, lịch sử và công bố; không tự chạy lại phân công.
- **Kiểm thử sau sửa:** Hiển thị phân công trước/sau và lý do; quyền/trạng thái khóa; hủy giữ dữ liệu. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r44"></a>

### R44 — Thống nhất đề tài

- **Route / nguồn:** `/topic/my` — [MyTopicPage](../../frontend/src/features/topic/pages/MyTopicPage.tsx). Vai trò/permission/menu: hàng R44 ở bảng trên.
- **Mục đích và dữ liệu:** Đề tài của SV và xác nhận GVHD trên topic service.
- **Hành động / phạm vi quyền:** Đề xuất/thống nhất/cập nhật theo vai trò; chuyển đề cương. Có phân công công bố, quan hệ GVHD, trạng thái đề tài và revision.
- **Kiểm chứng:** **đã quan sát**. E039 (STUDENT, 1440×900) — [ảnh](evidence/student-my-topic-1440-39.png). Biến thể đã thấy: STUDENT 1440px.
- **Vấn đề / ưu tiên:** P1: [F04](01-ui-audit.md#f04).
- **Giải pháp đề xuất:** F04: Đưa lối sang editor chuẩn ra ngoài menu; diễn giải lý do readonly; đối soát adapter nội dung cũ/mới theo version, không xóa route cũ.
- **Hành vi phải giữ:** Có phân công công bố, quan hệ GVHD, trạng thái đề tài và revision.
- **Kiểm thử sau sửa:** SV yêu cầu sửa so với GV xác nhận; link tới editor chuẩn. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r45"></a>

### R45 — Soạn đề cương

- **Route / nguồn:** `/topic/draft` — [ProposalEditorPage](../../frontend/src/features/topic/pages/ProposalEditorPage.tsx). Vai trò/permission/menu: hàng R45 ở bảng trên.
- **Mục đích và dữ liệu:** Editor đề cương cũ và cổng sang phiên bản mới; topic service adapter.
- **Hành động / phạm vi quyền:** Đọc form; mở đề cương & phiên bản, lưu/nộp nếu workflow cũ còn cho phép. workflowReady readonly, không xóa route cũ; canonical editor mới giữ version.
- **Kiểm chứng:** **đã quan sát**. E040 (STUDENT, 1440×900) — [ảnh](evidence/student-draft-1440-40.png). Biến thể đã thấy: STUDENT 1440px.
- **Vấn đề / ưu tiên:** P1: [F04](01-ui-audit.md#f04), [F08](01-ui-audit.md#f08).
- **Giải pháp đề xuất:** F04: Đưa lối sang editor chuẩn ra ngoài menu; diễn giải lý do readonly; đối soát adapter nội dung cũ/mới theo version, không xóa route cũ. F08: API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có.
- **Hành vi phải giữ:** workflowReady readonly, không xóa route cũ; canonical editor mới giữ version.
- **Kiểm thử sau sửa:** CTA chuyển editor luôn rõ; bảng lý do readonly không mâu thuẫn. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r46"></a>

### R46 — Hồ sơ đề tài

- **Route / nguồn:** `/topic/overview` — [DossierPage](../../frontend/src/features/topic/pages/DossierPage.tsx). Vai trò/permission/menu: hàng R46 ở bảng trên.
- **Mục đích và dữ liệu:** Xem/in hồ sơ đề cương cũ từ topic/report adapter.
- **Hành động / phạm vi quyền:** Chọn biểu mẫu, xem trước/tải theo khả năng hiện tại. Chưa duyệt phải ghi rõ, giữ nguồn nội dung/version; không coi preview là PDF đã kiểm tra.
- **Kiểm chứng:** **đã quan sát**. E041 (STUDENT, 1440×900) — [ảnh](evidence/student-overview-1440-41.png). Biến thể đã thấy: STUDENT 1440px.
- **Vấn đề / ưu tiên:** P1: [F04](01-ui-audit.md#f04), [F06](01-ui-audit.md#f06).
- **Giải pháp đề xuất:** F04: Đưa lối sang editor chuẩn ra ngoài menu; diễn giải lý do readonly; đối soát adapter nội dung cũ/mới theo version, không xóa route cũ. F06: Nhãn tiếng Việt và giờ Việt Nam thống nhất; đặt ID/hash/sự kiện gốc trong chi tiết có thể mở khi cần; điều chỉnh thông điệp theo vai trò.
- **Hành vi phải giữ:** Chưa duyệt phải ghi rõ, giữ nguồn nội dung/version; không coi preview là PDF đã kiểm tra.
- **Kiểm thử sau sửa:** So nội dung legacy preview và canonical version; PDF thực cần test riêng. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r47"></a>

### R47 — Xác nhận bảo vệ

- **Route / nguồn:** `/guidance/defense-confirm` — [FinalDefensePage](../../frontend/src/features/guidance/final-defense/page.tsx). Vai trò/permission/menu: hàng R47 ở bảng trên.
- **Mục đích và dữ liệu:** PDF cuối, tiến độ và quyết định GVHD; finalDefenseApi.
- **Hành động / phạm vi quyền:** Chọn hồ sơ, đọc PDF, nhận xét/điểm/quyết định khi đủ điều kiện. Chính sách UC17, feature gate, thời hạn, đúng PDF/version, khác xét học vụ.
- **Kiểm chứng:** **đã quan sát**. E060 (GVHD, 1440×900) — [ảnh](evidence/lecturer-defense-confirm-1440-60.png). Biến thể đã thấy: GVHD 1440px.
- **Vấn đề / ưu tiên:** P2: [F06](01-ui-audit.md#f06), [F11](01-ui-audit.md#f11).
- **Giải pháp đề xuất:** F06: Nhãn tiếng Việt và giờ Việt Nam thống nhất; đặt ID/hash/sự kiện gốc trong chi tiết có thể mở khi cần; điều chỉnh thông điệp theo vai trò. F11: Một ngữ cảnh đợt rõ, giữ liên kết URL/state; hiển thị filter đang dùng và xóa lọc; cảnh báo thay đợt theo hành vi hiện có.
- **Hành vi phải giữ:** Chính sách UC17, feature gate, thời hạn, đúng PDF/version, khác xét học vụ.
- **Kiểm thử sau sửa:** Hiện tại bị khóa đúng điều kiện; kiểm tra từng lý do rồi các trạng thái đủ điều kiện ở môi trường phù hợp. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r48"></a>

### R48 — Báo cáo cuối kỳ

- **Route / nguồn:** `/guidance/final-report` — [FinalDefensePage](../../frontend/src/features/guidance/final-defense/page.tsx). Vai trò/permission/menu: hàng R48 ở bảng trên.
- **Mục đích và dữ liệu:** PDF cuối của SV và tình trạng xác nhận; finalDefenseApi.
- **Hành động / phạm vi quyền:** Chọn/nộp PDF mới khi được phép, xem kết quả. Không dùng báo cáo tuần thay PDF cuối; loại/kích thước, deadline, version.
- **Kiểm chứng:** **đã quan sát**. E062 (STUDENT, 1440×900) — [ảnh](evidence/student-final-report-1440-62.png). Biến thể đã thấy: STUDENT 1440px.
- **Vấn đề / ưu tiên:** P2: [F06](01-ui-audit.md#f06), [F08](01-ui-audit.md#f08), [F11](01-ui-audit.md#f11).
- **Giải pháp đề xuất:** F06: Nhãn tiếng Việt và giờ Việt Nam thống nhất; đặt ID/hash/sự kiện gốc trong chi tiết có thể mở khi cần; điều chỉnh thông điệp theo vai trò. F08: API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có. F11: Một ngữ cảnh đợt rõ, giữ liên kết URL/state; hiển thị filter đang dùng và xóa lọc; cảnh báo thay đợt theo hành vi hiện có.
- **Hành vi phải giữ:** Không dùng báo cáo tuần thay PDF cuối; loại/kích thước, deadline, version.
- **Kiểm thử sau sửa:** Chưa PDF, chưa đến hạn, policy chưa phê duyệt; kiểm tra lỗi tệp sau được cấp môi trường ghi. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r49"></a>

### R49 — Xét điều kiện bảo vệ

- **Route / nguồn:** `/defense/eligibility` — [EligibilityPage](../../frontend/src/features/defense/eligibility/page.tsx). Vai trò/permission/menu: hàng R49 ở bảng trên.
- **Mục đích và dữ liệu:** Chứng cứ và quyết định đủ điều kiện bảo vệ; eligibilityApi.
- **Hành động / phạm vi quyền:** Chọn đợt/SV, đánh giá/quyết định/chốt danh sách theo quyền. Điều kiện học vụ khác nhận xét GVHD; quyền finalize và phiên bản chứng cứ.
- **Kiểm chứng:** **bị chặn**. E052 (FACULTY, 1440×900) — [ảnh](evidence/faculty-eligibility-1440-52.png). Biến thể đã thấy: Không có nội dung hoàn chỉnh. Chỉ quan sát loading/error của vùng hoặc shell; chưa kết luận về bảng/form nghiệp vụ phía dưới.
- **Vấn đề / ưu tiên:** P1: [F02](01-ui-audit.md#f02).
- **Giải pháp đề xuất:** F02: Giữ shell và ngữ cảnh khi tải/lỗi; phân biệt tải ban đầu/làm mới, nêu lỗi dễ hiểu và retry đúng vùng. Điều tra API 500/timeout thành đầu việc tích hợp riêng trước khi mở rộng redesign.
- **Hành vi phải giữ:** Điều kiện học vụ khác nhận xét GVHD; quyền finalize và phiên bản chứng cứ.
- **Kiểm thử sau sửa:** Chưa đọc được danh sách; bổ sung pending/eligible/ineligible/finalized sau khôi phục. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r50"></a>

### R50 — Kết quả bảo vệ

- **Route / nguồn:** `/defense/results` — [FinalResultPage](../../frontend/src/features/defense/final-results/page.tsx). Vai trò/permission/menu: hàng R50 ở bảng trên.
- **Mục đích và dữ liệu:** Kết quả bảo vệ tổng hợp; finalResultApi.
- **Hành động / phạm vi quyền:** Lọc, đọc điểm/kết quả và thao tác mà capability cho phép. Đúng người/đợt, nguồn điểm và công bố; không đổi cách tính/làm tròn.
- **Kiểm chứng:** **bị chặn**. E058 (FACULTY, 1440×900) — [ảnh](evidence/faculty-defense-results-1440-58.png). Biến thể đã thấy: Không có nội dung hoàn chỉnh. Chỉ quan sát loading/error của vùng hoặc shell; chưa kết luận về bảng/form nghiệp vụ phía dưới.
- **Vấn đề / ưu tiên:** P1: [F02](01-ui-audit.md#f02).
- **Giải pháp đề xuất:** F02: Giữ shell và ngữ cảnh khi tải/lỗi; phân biệt tải ban đầu/làm mới, nêu lỗi dễ hiểu và retry đúng vùng. Điều tra API 500/timeout thành đầu việc tích hợp riêng trước khi mở rộng redesign.
- **Hành vi phải giữ:** Đúng người/đợt, nguồn điểm và công bố; không đổi cách tính/làm tròn.
- **Kiểm thử sau sửa:** Chưa vào được; đối chiếu điểm hội đồng/phản biện/công bố sau phục hồi. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r51"></a>

### R51 — Báo cáo & biểu mẫu bảo vệ

- **Route / nguồn:** `/defense/reports` — [DefenseReportsPage](../../frontend/src/features/report/defense-reporting/page.tsx). Vai trò/permission/menu: hàng R51 ở bảng trên.
- **Mục đích và dữ liệu:** Mẫu, thống kê, preview và lịch sử xuất; defenseReportApi.
- **Hành động / phạm vi quyền:** Lọc/chọn template, preview, tạo/tải theo permission riêng. templates-read/statistics/history-read/preview/export/download; template đã duyệt và validPreview.canExport.
- **Kiểm chứng:** **bị chặn**. E059 (FACULTY, 1440×900) — [ảnh](evidence/faculty-defense-reports-1440-59.png). Biến thể đã thấy: Không có nội dung hoàn chỉnh. Chỉ quan sát loading/error của vùng hoặc shell; chưa kết luận về bảng/form nghiệp vụ phía dưới.
- **Vấn đề / ưu tiên:** P1: [F02](01-ui-audit.md#f02).
- **Giải pháp đề xuất:** F02: Giữ shell và ngữ cảnh khi tải/lỗi; phân biệt tải ban đầu/làm mới, nêu lỗi dễ hiểu và retry đúng vùng. Điều tra API 500/timeout thành đầu việc tích hợp riêng trước khi mở rộng redesign.
- **Hành vi phải giữ:** templates-read/statistics/history-read/preview/export/download; template đã duyệt và validPreview.canExport.
- **Kiểm thử sau sửa:** Không tự tạo báo cáo trong audit; kiểm tra từng permission, stale preview, tệp sau được phép. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r52"></a>

### R52 — Hội đồng bảo vệ

- **Route / nguồn:** `/defense/committees` — [CommitteePage](../../frontend/src/features/defense/committees/page.tsx). Vai trò/permission/menu: hàng R52 ở bảng trên.
- **Mục đích và dữ liệu:** Workspace hội đồng và thành viên theo đợt; committeeApi.
- **Hành động / phạm vi quyền:** Lập/sửa/phê duyệt danh sách theo capability. Thành phần hội đồng, xung đột, trạng thái chốt; không đổi RBAC.
- **Kiểm chứng:** **bị chặn**. E053 (FACULTY, 1440×900) — [ảnh](evidence/faculty-committees-1440-53.png). Biến thể đã thấy: Không có nội dung hoàn chỉnh. Chỉ quan sát loading/error của vùng hoặc shell; chưa kết luận về bảng/form nghiệp vụ phía dưới.
- **Vấn đề / ưu tiên:** P1: [F02](01-ui-audit.md#f02).
- **Giải pháp đề xuất:** F02: Giữ shell và ngữ cảnh khi tải/lỗi; phân biệt tải ban đầu/làm mới, nêu lỗi dễ hiểu và retry đúng vùng. Điều tra API 500/timeout thành đầu việc tích hợp riêng trước khi mở rộng redesign.
- **Hành vi phải giữ:** Thành phần hội đồng, xung đột, trạng thái chốt; không đổi RBAC.
- **Kiểm thử sau sửa:** Chưa vào được; kiểm tra nhóm nháp/đã duyệt và lỗi thành viên khi API ổn. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r53"></a>

### R53 — Phân công phản biện

- **Route / nguồn:** `/defense/reviewers` — [ReviewerPage](../../frontend/src/features/defense/reviewers/page.tsx). Vai trò/permission/menu: hàng R53 ở bảng trên.
- **Mục đích và dữ liệu:** Workspace phân công phản biện; reviewerApi.
- **Hành động / phạm vi quyền:** Chọn hồ sơ/người, phân công/điều chỉnh theo capability. Điều kiện phản biện/xung đột/quota và trạng thái hồ sơ.
- **Kiểm chứng:** **bị chặn**. E054 (FACULTY, 1440×900) — [ảnh](evidence/faculty-reviewers-1440-54.png). Biến thể đã thấy: Không có nội dung hoàn chỉnh. Chỉ quan sát loading/error của vùng hoặc shell; chưa kết luận về bảng/form nghiệp vụ phía dưới.
- **Vấn đề / ưu tiên:** P1: [F02](01-ui-audit.md#f02).
- **Giải pháp đề xuất:** F02: Giữ shell và ngữ cảnh khi tải/lỗi; phân biệt tải ban đầu/làm mới, nêu lỗi dễ hiểu và retry đúng vùng. Điều tra API 500/timeout thành đầu việc tích hợp riêng trước khi mở rộng redesign.
- **Hành vi phải giữ:** Điều kiện phản biện/xung đột/quota và trạng thái hồ sơ.
- **Kiểm thử sau sửa:** Chưa vào được; kiểm tra preview/validation/lý do thay đổi sau phục hồi. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r54"></a>

### R54 — Lịch bảo vệ

- **Route / nguồn:** `/defense/schedule` — [SchedulePage](../../frontend/src/features/defense/scheduling/page.tsx). Vai trò/permission/menu: hàng R54 ở bảng trên.
- **Mục đích và dữ liệu:** Lịch/phòng/ca/hội đồng của đợt; scheduleApi.
- **Hành động / phạm vi quyền:** Lọc/xem; Khoa xếp/công bố theo capability. Xung đột thời gian/phòng/người và phạm vi lịch công bố cho SV/GV.
- **Kiểm chứng:** **bị chặn**. E055 (FACULTY, 1440×900) — [ảnh](evidence/faculty-schedule-1440-55.png). Biến thể đã thấy: Không có nội dung hoàn chỉnh. Chỉ quan sát loading/error của vùng hoặc shell; chưa kết luận về bảng/form nghiệp vụ phía dưới.
- **Vấn đề / ưu tiên:** P1: [F02](01-ui-audit.md#f02).
- **Giải pháp đề xuất:** F02: Giữ shell và ngữ cảnh khi tải/lỗi; phân biệt tải ban đầu/làm mới, nêu lỗi dễ hiểu và retry đúng vùng. Điều tra API 500/timeout thành đầu việc tích hợp riêng trước khi mở rộng redesign.
- **Hành vi phải giữ:** Xung đột thời gian/phòng/người và phạm vi lịch công bố cho SV/GV.
- **Kiểm thử sau sửa:** Chưa vào được; test desktop/mobile lịch dày, chưa công bố/đã công bố. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r55"></a>

### R55 — Chấm điểm hội đồng

- **Route / nguồn:** `/defense/committee-grading` — [CommitteeGradePage](../../frontend/src/features/defense/committee-grading/page.tsx). Vai trò/permission/menu: hàng R55 ở bảng trên.
- **Mục đích và dữ liệu:** Phiếu điểm hội đồng và tiến độ; committeeGradeApi.
- **Hành động / phạm vi quyền:** Thành viên đọc/ghi phiếu theo capability; Khoa theo dõi progress-read. LECTURER được phân công khác role COMMITTEE; rubric/khóa/phiên bản/lịch sử.
- **Kiểm chứng:** **bị chặn**. E056 (FACULTY, 1440×900) — [ảnh](evidence/faculty-committee-grading-1440-56.png). Biến thể đã thấy: Không có nội dung hoàn chỉnh. Chỉ quan sát loading/error của vùng hoặc shell; chưa kết luận về bảng/form nghiệp vụ phía dưới.
- **Vấn đề / ưu tiên:** P1: [F02](01-ui-audit.md#f02).
- **Giải pháp đề xuất:** F02: Giữ shell và ngữ cảnh khi tải/lỗi; phân biệt tải ban đầu/làm mới, nêu lỗi dễ hiểu và retry đúng vùng. Điều tra API 500/timeout thành đầu việc tích hợp riêng trước khi mở rộng redesign.
- **Hành vi phải giữ:** LECTURER được phân công khác role COMMITTEE; rubric/khóa/phiên bản/lịch sử.
- **Kiểm thử sau sửa:** Chưa vào được; điểm biên, người không được giao, phiếu draft/locked. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r56"></a>

### R56 — Chấm điểm phản biện

- **Route / nguồn:** `/defense/reviewer-grading` — [ReviewerGradePage](../../frontend/src/features/defense/reviewer-grading/page.tsx). Vai trò/permission/menu: hàng R56 ở bảng trên.
- **Mục đích và dữ liệu:** Phiếu điểm phản biện; reviewerGradeApi.
- **Hành động / phạm vi quyền:** Người phản biện đọc/nhập/chốt theo capability. Đúng reviewer, rubric, hạn, khóa và lịch sử điều chỉnh.
- **Kiểm chứng:** **bị chặn**. E057 (FACULTY, 1440×900) — [ảnh](evidence/faculty-reviewer-grading-1440-57.png). Biến thể đã thấy: Không có nội dung hoàn chỉnh. Chỉ quan sát loading/error của vùng hoặc shell; chưa kết luận về bảng/form nghiệp vụ phía dưới.
- **Vấn đề / ưu tiên:** P1: [F02](01-ui-audit.md#f02).
- **Giải pháp đề xuất:** F02: Giữ shell và ngữ cảnh khi tải/lỗi; phân biệt tải ban đầu/làm mới, nêu lỗi dễ hiểu và retry đúng vùng. Điều tra API 500/timeout thành đầu việc tích hợp riêng trước khi mở rộng redesign.
- **Hành vi phải giữ:** Đúng reviewer, rubric, hạn, khóa và lịch sử điều chỉnh.
- **Kiểm thử sau sửa:** Chưa vào được; so sánh Khoa đọc/người phản biện ghi và validation điểm. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r57"></a>

### R57 — Biểu mẫu & xuất dữ liệu

- **Route / nguồn:** `/report/export` — [ExportCenterPage](../../frontend/src/features/report/pages/ExportCenterPage.tsx). Vai trò/permission/menu: hàng R57 ở bảng trên.
- **Mục đích và dữ liệu:** Route xuất cũ; AUTH_API chuyển tới /defense/reports + query.
- **Hành động / phạm vi quyền:** Trong API mode redirect; menu chỉ hiện DEMO. Không bật demo; giữ redirect và permission tại đích.
- **Kiểm chứng:** **bị chặn**. E070 (FACULTY, 1440×900) — [ảnh](evidence/faculty-export-1440-70.png). Biến thể đã thấy: Không có nội dung hoàn chỉnh. Chỉ quan sát loading/error của vùng hoặc shell; chưa kết luận về bảng/form nghiệp vụ phía dưới.
- **Vấn đề / ưu tiên:** P1: [F02](01-ui-audit.md#f02), [F13](01-ui-audit.md#f13).
- **Giải pháp đề xuất:** F02: Giữ shell và ngữ cảnh khi tải/lỗi; phân biệt tải ban đầu/làm mới, nêu lỗi dễ hiểu và retry đúng vùng. Điều tra API 500/timeout thành đầu việc tích hợp riêng trước khi mở rộng redesign. F13: Lấy router thực thi làm nguồn inventory; ghi riêng legacy. Nếu đồng bộ constants về sau, thực hiện nhiệm vụ bảo trì riêng có kiểm tra link.
- **Hành vi phải giữ:** Không bật demo; giữ redirect và permission tại đích.
- **Kiểm thử sau sửa:** Lần mở bị boundary chặn trước redirect; kiểm tra khi snapshot phục hồi và người thiếu permission. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r58"></a>

### R58 — Thông tin cá nhân

- **Route / nguồn:** `/profile` — [ProfilePage](../../frontend/src/features/auth/pages/ProfilePage.tsx). Vai trò/permission/menu: hàng R58 ở bảng trên.
- **Mục đích và dữ liệu:** Hồ sơ cá nhân, liên hệ và học vụ; auth/profile service.
- **Hành động / phạm vi quyền:** Sửa trường được phép, lưu, sang đổi mật khẩu. SV không tự sửa học vụ; validation email/điện thoại và điều kiện đăng ký.
- **Kiểm chứng:** **đã quan sát**. E064 (STUDENT, 1440×900) — [ảnh](evidence/student-profile-1440-64.png). Biến thể đã thấy: STUDENT 1440px.
- **Vấn đề / ưu tiên:** P2: [F08](01-ui-audit.md#f08).
- **Giải pháp đề xuất:** F08: API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có.
- **Hành vi phải giữ:** SV không tự sửa học vụ; validation email/điện thoại và điều kiện đăng ký.
- **Kiểm thử sau sửa:** Đọc được form SV; lỗi trường, hủy, điều hướng; không lưu trong audit. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r59"></a>

### R59 — Đổi mật khẩu

- **Route / nguồn:** `/change-password` — [ChangePasswordPage](../../frontend/src/features/auth/pages/ChangePasswordPage.tsx). Vai trò/permission/menu: hàng R59 ở bảng trên.
- **Mục đích và dữ liệu:** Mật khẩu hiện tại/mới/xác nhận; auth service.
- **Hành động / phạm vi quyền:** Nhập/đổi mật khẩu. Độ phức tạp, khớp xác nhận, bắt buộc đổi lần đầu và xử lý phiên.
- **Kiểm chứng:** **đã quan sát**. E065 (STUDENT, 1440×900) — [ảnh](evidence/student-password-1440-65.png). Biến thể đã thấy: STUDENT 1440px.
- **Vấn đề / ưu tiên:** P2: [F08](01-ui-audit.md#f08).
- **Giải pháp đề xuất:** F08: API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có.
- **Hành vi phải giữ:** Độ phức tạp, khớp xác nhận, bắt buộc đổi lần đầu và xử lý phiên.
- **Kiểm thử sau sửa:** Required/mismatch/complexity cục bộ; không đổi mật khẩu tài khoản audit. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r60"></a>

### R60 — Thông báo

- **Route / nguồn:** `/notifications` — [NotificationsPage](../../frontend/src/features/auth/pages/NotificationsPage.tsx). Vai trò/permission/menu: hàng R60 ở bảng trên.
- **Mục đích và dữ liệu:** Inbox và giao nhận thông báo từ snapshot/notification service.
- **Hành động / phạm vi quyền:** Search/lọc/phân trang, mở hồ sơ, đọc/gửi lại theo quyền. Đọc khác SENT/FAILED; ownership và retry email không thay bởi redesign.
- **Kiểm chứng:** **đã quan sát**. E066 (STUDENT, 1440×900) — [ảnh](evidence/student-notifications-1440-66.png). Biến thể đã thấy: STUDENT 1440px.
- **Vấn đề / ưu tiên:** P2: [F15](01-ui-audit.md#f15), [F06](01-ui-audit.md#f06).
- **Giải pháp đề xuất:** F15: Một nhãn read/unread, tách delivery khi cần; nhất quán đường mở hồ sơ và empty. F06: Nhãn tiếng Việt và giờ Việt Nam thống nhất; đặt ID/hash/sự kiện gốc trong chi tiết có thể mở khi cần; điều chỉnh thông điệp theo vai trò.
- **Hành vi phải giữ:** Đọc khác SENT/FAILED; ownership và retry email không thay bởi redesign.
- **Kiểm thử sau sửa:** Đối chiếu R06; không mark read khi chỉ mở màn; bỏ lặp badge/read status. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r61"></a>

### R61 — Không đủ quyền

- **Route / nguồn:** `/forbidden` — [Forbidden](../../frontend/src/app/router/routes.tsx). Vai trò/permission/menu: hàng R61 ở bảng trên.
- **Mục đích và dữ liệu:** Trang 403 trong WorkspaceLayout.
- **Hành động / phạm vi quyền:** Về tổng quan. Không nới quyền để tránh trang lỗi; không lộ nội dung bị cấm.
- **Kiểm chứng:** **đã quan sát**. E067 (STUDENT, 1440×900) — [ảnh](evidence/student-forbidden-1440-67.png). Biến thể đã thấy: STUDENT 1440px.
- **Vấn đề / ưu tiên:** Chưa xác minh vấn đề riêng. Chưa phát hiện vấn đề riêng trong phần đã quan sát; không suy thành đạt toàn bộ..
- **Giải pháp đề xuất:** Giữ cấu trúc chức năng, áp dụng tiêu chí kit chung; chỉ sửa sau khi tái hiện vấn đề cụ thể.
- **Hành vi phải giữ:** Không nới quyền để tránh trang lỗi; không lộ nội dung bị cấm.
- **Kiểm thử sau sửa:** Có phiên/thiếu quyền, keyboard link và tránh redirect loop. Cộng AC01–AC04 và AC08 theo phạm vi.

<a id="r62"></a>

### R62 — Không tìm thấy trang

- **Route / nguồn:** `/*` — [NotFound](../../frontend/src/app/router/routes.tsx). Vai trò/permission/menu: hàng R62 ở bảng trên.
- **Mục đích và dữ liệu:** Fallback 404 trong WorkspaceLayout.
- **Hành động / phạm vi quyền:** Về tổng quan/chọn navigation. Route không tồn tại không thành một màn nghiệp vụ; giữ auth.
- **Kiểm chứng:** **bị chặn**. E068 (STUDENT, 1440×900) — [ảnh](evidence/student-not-found-1440-68.png). Biến thể đã thấy: Không có nội dung hoàn chỉnh. Chỉ quan sát loading/error của vùng hoặc shell; chưa kết luận về bảng/form nghiệp vụ phía dưới.
- **Vấn đề / ưu tiên:** P1: [F02](01-ui-audit.md#f02).
- **Giải pháp đề xuất:** F02: Giữ shell và ngữ cảnh khi tải/lỗi; phân biệt tải ban đầu/làm mới, nêu lỗi dễ hiểu và retry đúng vùng. Điều tra API 500/timeout thành đầu việc tích hợp riêng trước khi mở rộng redesign.
- **Hành vi phải giữ:** Route không tồn tại không thành một màn nghiệp vụ; giữ auth.
- **Kiểm thử sau sửa:** Đường dẫn thử không tồn tại bị boundary chặn; kiểm tra 404 sau phục hồi. Cộng AC01–AC04 và AC08 theo phạm vi.

## Ngoài inventory đang hoạt động

`shared/constants/routes.ts` còn `/catalog/research-areas`, `/defense/committee`, `/grading/scores`, `/grading/results`; không có đích tương ứng trong router. Các page cũ dưới features và AdminLayout không tự tạo route. Chúng không được tính là màn đã audit trên browser. R57 vẫn là route thật nhưng API mode redirect sang R51; việc menu DEMO ẩn không tự làm route biến mất. Không bật demo hay xóa legacy trong giai đoạn này.
