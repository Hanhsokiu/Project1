# Đối chiếu đặc tả frontend toàn hệ thống

Ngày khảo sát: 22/10/2026. Khảo sát ban đầu bao phủ toàn bộ UC01–UC25. **Phạm vi triển khai cuối đã được người dùng thu hẹp còn xác thực và frontend Bước 1–3 theo phần việc được giao**: danh mục/đợt/kế hoạch/roster → đăng ký → phân công/công bố/thông báo → thống nhất đề tài/đề cương/version/PDF. Các phần duyệt cấp nhóm, hướng dẫn tuần, final/bảo vệ/chấm điểm dưới đây chỉ là tham khảo bàn giao tương lai. Backend chỉ đọc và giữ nguyên.

## 1. Nguồn đã đọc và mức độ tin cậy

- `README.md`, `CLAUDE.md`, toàn bộ `docs/spec/*.md`, cả hai Word `Project_1_06.docx` và `dac-ta-use-case.docx`.
- Bốn ADR, `docs/erd/README.md`, bản ERD `.drawio`, `docs/api/openapi.yaml`, `backend/prisma/schema.prisma`, các controller và các service/validator liên quan, `shared/src/index.ts`.
- Router, layout, các feature page, shared/API client và cấu hình frontend được khảo sát trước triển khai. Các số lượng dưới đây là **ảnh chụp hiện trạng ban đầu**, không phải báo cáo hoàn thành cuối.
- Workflow `docs/workflows/vibe-coding-buoc-1-3.md` giúp phân định thành viên và nêu những chính sách còn đề xuất; nội dung này không thay thế yêu cầu frontend toàn bộ hệ thống của phiên hiện tại.
- Stitch: [project 3892494634894258957](https://stitch.withgoogle.com/projects/3892494634894258957). Ban đầu link trực tiếp chưa cung cấp được source; sau đó đã có export tại `design/stitch_project_one_starter`:6 thư mục `code.html` + `screen.png` (Đăng nhập, Đổi mật khẩu, dashboard Giáo vụ/SV/GV/Hội đồng) và `academic_minimalist/DESIGN.md`. Đã đọc token/font/layout trong DESIGN: Be Vietnam Pro; primary ink #1E2024, canvas #FBFBFC/#F9F9FA, accent lilac #8E7AC4, border #E2E0EC, card bo20px, input/button bo16px. Các màn hình nghiệp vụ thiếu source được xây theo cùng hệ thiết kế. Không tuyên bố export có sẵn mọi màn hình nghiệp vụ hoặc đã xác minh trực quan mọi kích thước.

Thứ tự xử lý mâu thuẫn: yêu cầu hiện tại → ADR đã quyết định → đặc tả UC/bảng biểu cụ thể → sơ đồ/đề xuất cũ → khung mã nguồn. Không tự coi implementation còn thiếu là quy định nghiệp vụ.

## 2. Word, bảng, sơ đồ và biểu mẫu

Đã giải nén XML và đọc paragraphs/tables bằng `source-extracts/extract-word.ps1` (PowerShell/.NET, không cần Word). Mỗi file có 496 paragraph ở cấp body, 69 bảng; bản Project có 48 embedded assets và bản dac-ta có 47. Văn bản trong ô bảng được giữ theo từng hàng/cột. Relationship của ảnh và kích thước byte nằm cuối hai bản extract; script không sửa tài liệu nguồn và không đưa ảnh nặng vào bundle frontend.

- [Project_1_06 extract](source-extracts/Project_1_06.md): bảng 20 có FR-01–45; bảng 21 có BR-01–24; bảng 23 có AC-01–15; bảng 33–57 chứa đủ UC01–25; bảng 58–68 liên kết ACT01–10.
- [dac-ta-use-case extract](source-extracts/dac-ta-use-case.md): bản cũ còn các câu hỏi/luồng ghép nhóm. Chỉ dùng nội dung phù hợp ADR cá nhân.
- Đã mở trực tiếp 4 hình biểu mẫu, ACT01–10 và 8 ảnh ERD tổng/phân hệ từ Word. Các ảnh mẫu không phải source Stitch. Đã đối chiếu toàn bộ text hai bản extract: khác biệt nghiệp vụ tập trung vào việc loại ghép nhóm trong bản Project; phần UC còn lại tương đồng.

| Nội dung Word Project | Relationship / asset | Điều frontend cần phản ánh |
| --- | --- | --- |
| Phiếu nhận xét GVHD | rId5 / image1.png | Quốc hiệu/đơn vị; tên đề tài; SV, MSSV, lớp, khóa, HĐ; GVHD/đơn vị; ý nghĩa thực tiễn, ý thức thái độ, kết quả đạt/chưa đạt; điểm /10; ký |
| Phiếu đọc duyệt GVPB | rId6 / image2.png | Báo cáo: hình thức 2, nội dung 3; sản phẩm: thực tiễn 1, hoàn thiện 2, làm chủ 2; ít nhất 2 câu hỏi; tổng /10; người đọc duyệt ký |
| Đề cương Cử nhân | rId7 / image3.png | SV họ tên/MSSV/lớp/khóa/SĐT/email/ngành/hệ; GVHD/đơn vị/SĐT/email; tên đề tài; nội dung/phạm vi; công nghệ/công cụ/ngôn ngữ; kết quả dự kiến; kế hoạch STT/công việc/thời gian/ghi chú; 4 vùng ký Khoa/Bộ môn/GVHD/SV |
| Tờ trình Hội đồng | rId8 / image4.png | Kính gửi BGH/Phòng đào tạo; năm học/lớp/khóa; từng HĐ; STT/họ tên/nhiệm vụ/ghi chú/đơn vị công tác; Chủ tịch, Thư ký, Ủy viên |
| ACT01–03 | rId35–37 / image31–33.png | Cấu hình đầy đủ trước mở; kiểm thời hạn; sửa NV trong cửa sổ; phương án kiểm lỗi/chỉnh tay/chốt rồi thông báo |
| ACT04–05 | rId38–39 / image34–35.png | Vòng sửa đề cương; GVHD và nhóm duyệt là hai thẩm quyền; kế hoạch, bài nộp, phản hồi, xác nhận tiến độ |
| ACT06–08 | rId40–42 / image36–38.png | Học vụ + xác nhận GVHD; ngoại lệ/bảo lưu; HĐ hợp lệ; loại xung đột; lịch tạm/chính thức, thông báo |
| ACT09–10 | rId43–44 / image39–40.png | Hồ sơ chấm được phân công; tổng hợp/chốt/công bố; đóng đợt |
| ERD tổng và phân hệ | rId45–52 / image41–48.png | Snapshot theo đợt; RBAC; version; tiến độ; eligibility; HĐ/phiên; rubric/điểm |

Một số hình còn chữ “nhóm sinh viên”, ACT06 đặt hoạt động nhận xét/chấm ở lane SV, ACT09 minh họa phần phân công nhiều hơn phần nhập điểm. Không đưa các sai lệch trình bày này vào quyền UI; dùng bảng UC và ADR. Mẫu Kỹ sư có template HTML sẵn trong backend nhưng không suy ra loại bằng từ hệ Chính quy/Liên thông/Từ xa. Mẫu bảng điểm thực tế được mô tả trong Markdown, không được nhầm với một ảnh Stitch đã nhận.

## 3. Các ràng buộc phải thể hiện trong demo

### Danh tính, quyền và dữ liệu theo đợt

- Năm role ADMIN/FACULTY/LECTURER/STUDENT/COMMITTEE; một giảng viên có thể đồng thời GVHD, GVPB, nhóm duyệt, thành viên HĐ. Quyền thao tác gắn thêm quan hệ phân công và phạm vi hồ sơ.
- Chưa login → login; thiếu quyền → forbidden; URL không tồn tại → 404. Đổi role demo không được cấp quyền theo URL tùy ý. mustChangePassword chặn các nghiệp vụ đến khi đổi mật khẩu; Email/SĐT hợp lệ là tiền điều kiện đăng ký.
- UC02: tạo/sửa/khóa/mở/reset tài khoản; không làm mất Admin cuối; cảnh báo nếu tài khoản đang có nhiệm vụ trong đợt; quyền role mới áp dụng từ phiên sau theo Word. Audit chỉ thêm, không cung cấp sửa/xóa; ghi actor/thời gian/trước/sau/lý do cho thay đổi quan trọng.
- Mỗi SV có **một hồ sơ/một đề tài trong từng đợt**. Không có nhóm SV. Khi bảo lưu sang đợt sau giữ liên kết lịch sử, không ghi đè hồ sơ cũ.
- Các mã SV/GV là chuỗi để giữ số 0 đầu. Import xem trước, lỗi theo dòng, kiểm trùng và ghi đúng đợt/hệ; import lại không nhân đôi và không reset mật khẩu đã đổi. Chưa có nguồn học vụ thật thì hiển thị là xác minh mẫu/thủ công.

### Đợt, đăng ký và phân công (BR03–09; AC01–06)

- Kỳ biểu diễn bằng academicYear + semester; đợt có hệ riêng, đối tượng khóa/lớp, mốc, danh sách đủ điều kiện, GV/hướng/quota, tham số. Ba hệ Chính quy/Liên thông/Từ xa không đồng nghĩa Cử nhân/Kỹ sư.
- Chỉ mở khi cấu hình bắt buộc đủ; mốc phải hợp thứ tự/nằm trong đợt. Khóa/mở giai đoạn có xác nhận/audit. Thao tác ghi kiểm `start <= now < end` và `!isLocked`; chỉ ẩn/disable nút chưa đủ nếu service vẫn cho ghi.
- Một hướng từ danh mục đang mở; tối đa 3 GV hợp lệ, khác nhau, có thứ tự liên tục. Khi đổi hướng phải xem lại các GV đã chọn. Demo chọn chính sách nộp 1–3 NV, nháp có thể chưa đủ; phải ghi đây là chính sách demo vì nguồn chỉ chốt “tối đa 3”.
- Roster, hệ, GPA/điều kiện học vụ, onboarding, thời gian và khóa đều được kiểm trước nộp. Quota là đầu vào phân công, đăng ký không tự giữ chỗ.
- Phân công theo vòng **NV1 toàn đợt → NV2 cho người còn lại → NV3 → AUTO_AREA đúng hướng → chưa phân**. Không dùng GPA toàn cục rồi xét hết ba NV cho từng SV. Tranh cùng GV trong cùng vòng dùng tiêu chí cấu hình (demo: GPA giảm, cộng tác đã xác minh khi hòa, mã SV ổn định); không cộng “điểm thưởng” tùy ý cho lời khai cộng tác.
- Khung đề xuất cũ về hệ số tải 1/1.2/1.3/2 chưa là quy định. Demo dùng quota và giải thích tải; không khẳng định đã mô phỏng một công thức học vụ chưa được chốt.
- Phương án nháp có tỷ lệ NV1/2/3/tự phân, tải GV, danh sách chưa phân có lý do; chỉnh tay kiểm quota/hướng/roster. Chạy lại không sửa kết quả chính thức; chốt/công bố không tạo thông báo lặp. SV/GV chỉ xem chính thức sau công bố.

### Đề tài, đề cương và hướng dẫn (BR08–15; AC06–08)

- Sau có GVHD chính thức, SV/GV thống nhất tên đề tài/phạm vi/nội dung. Nút xác nhận của GVHD là **thống nhất đề tài**, không duyệt đề cương thay nhóm/Khoa.
- Đề cương có form cấu trúc và bảng kế hoạch; lưu nháp, nộp, xem phiên bản/preview/PDF. Nộp thiếu nội dung bị chặn; sửa bản đang chờ duyệt tạo nháp/version và phải nộp lại. Đã chốt chỉ Khoa có quyền mở lại kèm lý do/audit.
- Khoa tạo nhóm duyệt theo bộ môn, thành viên/lịch/hướng; phân bản SUBMITTED; reviewer đúng nhóm bắt đầu duyệt và ra APPROVED/REVISION_REQUESTED/REJECTED. Sửa/từ chối phải có nhận xét. SV sửa/nộp lại giữ lịch sử. Khoa chốt hồ sơ sau APPROVED và đủ nội dung.
- Hướng dẫn bám đề cương đã chốt. GV tạo kế hoạch/mốc/việc/đầu ra/deadline; SV cập nhật tiến độ, nộp báo cáo + source/minh chứng; lưu mọi lần nộp và phản hồi. Nộp muộn trong giai đoạn mở được đánh dấu trễ; giai đoạn khóa chặn nộp.
- Đánh giá Đạt/Không đạt/Cần sửa; SV không tự xác nhận hoàn thành cuối cùng. GV không xác nhận đạt nếu chưa có bài nộp. Cần sửa phải nộp lại. Buổi hướng dẫn có ngày/hình thức/nội dung/kết luận; Khoa lọc chậm tiến độ. Mốc đánh giá/tiêu chí cấu hình được.
- Final là PDF có metadata/version; kiểm định dạng/dung lượng, hạn/khóa. GVHD xem final + tiến độ và đồng ý/không đồng ý bảo vệ; từ chối có lý do. Đây chưa phải kết luận học vụ của Khoa.

### Eligibility, Hội đồng, phản biện, lịch (BR15–20; AC09–11)

- Khoa đối chiếu xác nhận GVHD, tiến độ/final và học vụ/nợ học phần từ nguồn có xác minh. Trạng thái PENDING/ELIGIBLE/INELIGIBLE/DEFERRED và lý do phải rõ; trạng thái “được phản biện nhưng chưa bảo vệ”, “đủ sau bổ sung” chỉ áp dụng khi được cấu hình.
- Bảo lưu có lý do/duyệt Bộ môn/Khoa; hồ sơ quay lại được kiểm mới. Không gắn SV chưa đủ điều kiện vào HĐ chính thức.
- Ảnh ERD bảo lưu còn mô tả trường hợp phản biện trước/chưa bảo vệ: lưu GVPB, điểm/nhận xét phản biện, chờ GVPB đồng ý/từ chối, nộp đơn và liên kết đợt chuyển tiếp. Đây là nhánh cấu hình riêng của bảo lưu; Prisma hiện rút gọn thành PENDING/DEPARTMENT_APPROVED/FACULTY_APPROVED/REJECTED nên backend cần thống nhất mapping. Không tự coi mọi bảo lưu là đã có sự đồng ý GVPB hoặc giữ điểm cũ mà không có quyết định.
- HĐ 3–5 GV theo cấu hình, có đúng vai trò Chủ tịch/Thư ký/Ủy viên, sức chứa và phân SV tương đối đều. **GVHD không là thành viên HĐ chấm SV mình**; GVPB không là GVHD. Nguồn bước9 còn yêu cầu không phân phản biện cho HĐ có GVHD của SV; cần kiểm cả quan hệ HĐ, không chỉ so ID GVPB.
- Phân GVPB có tải/giải thích/chỉnh tay/chốt/thông báo. GVPB chỉ xem hồ sơ được giao có final PDF.
- Lịch có ngày, Sáng/Chiều, giờ, phòng, HĐ, thời lượng, SV/thứ tự. Xếp mặc định Tên + Họ đệm, locale tiếng Việt ổn định; kiểm trùng GV/HĐ/phòng, sức chứa; chỉnh/chốt/công bố riêng. Thay lịch đã công bố có audit/thông báo.
- Thư ký quản lý biên bản/câu hỏi/trả lời/ghi chú sửa; Chủ tịch xác nhận trong phạm vi HĐ; mỗi thành viên có ô nhập riêng và chỉ được chấm đúng HĐ/đúng phiên.

### Điểm, kết quả, báo cáo (BR21–24; AC12–15)

ADR0003 đã giải quyết phần Word còn ghi “cần xác nhận” đối với công thức chuẩn:

```text
QT   = advisor_weight_in_process * GVHD + reviewer_weight_in_process * GVPB
KTHP = SUM(điểm thành viên HĐ hợp lệ đã gửi) / số thành viên phải chấm
HP   = process_weight * QT + committee_weight * KTHP
Mặc định: 0.5 / 0.5 trong QT; 0.4 / 0.6 ở HP; ngưỡng 5.0.
```

Không thay điểm thiếu bằng 0 hoặc tính “hoàn chỉnh” với mẫu số nhỏ hơn thành viên bắt buộc. Chỉ tính thử có nhãn chưa hoàn chỉnh; chỉ chốt khi đủ người/tiêu chí. Ví dụ chuẩn: GVHD9/GVPB7; HĐ7.5/8/8.5/9 → QT8, KTHP8.25, HP8.15. Điều kiện đạt theo `diem-can-xac-nhan.md`: QT≥5, KTHP≥5, HP≥5, hoàn tất yêu cầu sửa trước lưu chiểu; nếu chưa sửa hiển thị trạng thái riêng.

- Điểm nháp → đã gửi → đã chốt → đã công bố khác nhau. SV chỉ xem sau công bố. Sau chốt khóa sửa thường; mở lại cần quyền đặc biệt + lý do + trước/sau.
- GVPB rubric mẫu 2+3+1+2+2=10 và ≥2 câu hỏi. GVHD nhận xét ba phần theo mẫu; HĐ tiêu chí/trọng số cấu hình, không tự gán rubric phản biện thành quy định HĐ.
- Trọng số đọc theo đợt, kiểm tổng từng nhóm=1, điểm trong max, lưu snapshot cấu hình. UI nêu công thức và trạng thái thành phần. Duy trì độ chính xác đủ ví dụ 8.15, không cắt về một chữ số lẻ khi tổng hợp.
- Báo cáo theo đợt/hệ/lớp/GV/HĐ/trạng thái; preview/download PDF và Excel thực mở được, trạng thái job QUEUED/PROCESSING/DONE/FAILED, thông báo không có dữ liệu và retry lỗi. File nháp ghi chưa chính thức, không giả chữ ký.

## 4. Ma trận màn hình và khoảng thiếu ban đầu

Router ban đầu có **38 page**: 36 placeholder; Login có biểu mẫu gọi API, Dashboard có số liệu tĩnh. Cùng một AdminLayout cho mọi vai trò; useAuth chưa hydrate user; chưa có guard/404/403. Không có màn hình đã xác minh từ Stitch. Các route sẵn được giữ để giảm thay đổi tích hợp.

Ký hiệu role: A Admin; K Khoa; G Giảng viên theo quan hệ; S SV; H thành viên HĐ. Ma trận dưới là ảnh chụp repository trước triển khai. Stitch có source cho login/password và dashboard4 vai trò; catalog/term/registration/topic được mở rộng theo DESIGN. Từ UC13 trở đi nằm ngoài phạm vi triển khai cuối.

| Màn hình / route | Role | Repository trước triển khai | Việc cần xây dựng |
| --- | --- | --- | --- |
| `/login` | tất cả | Form API + modal đổi mật khẩu | Demo login/khóa/sai thông tin; onboarding đầy đủ |
| `/` | A/K/G/S/H | Dashboard tĩnh | KPI/action/list theo role, dữ liệu nối các module |
| `/admin/accounts` | A | Placeholder | CRUD, role, khóa/mở/reset, Admin cuối |
| `/admin/roles` | A | Placeholder | Ma trận quyền, xem/sửa/lưu |
| `/admin/audit-logs` | A/K phạm vi | Placeholder | Search/filter/detail trước/sau |
| `/catalog/students` | K/A | Placeholder | CRUD/filter/page/detail/điều kiện |
| `/catalog/lecturers` | K/A; G xem | Placeholder | CRUD/hướng/bộ môn/chức danh/quota |
| `/catalog/import` | K/A | Placeholder | File mẫu/upload/preview/errors/commit/result |
| `/terms` | K/A; G/S/H xem phạm vi | Placeholder | Kỳ/đợt CRUD/lọc/trạng thái |
| `/terms/:id` | K/A; xem phạm vi | Placeholder | Tổng quan/cấu hình/checklist mở đợt |
| `/terms/:id/phases` | K/A | Placeholder | Timeline/mốc/khóa/mở |
| `/terms/:id/parameters` | K/A | Placeholder | Trọng số/ngưỡng/quota/chính sách |
| `/terms/:id/roster` | K/A | Placeholder | SV eligible + GV tham gia/quota |
| `/registration` | S | Placeholder | Contact/hướng/ranked NV/nháp/nộp/sửa/hết hạn |
| `/registration/assignment` | K/A | Placeholder | Danh sách đăng ký/preview/load/statistics/chốt |
| `/registration/manual` | K/A | Placeholder | Chưa phân/chuyển GV/lý do/validation |
| `/registration/result` | K/G/S; A xem | Placeholder | Published result, liên hệ, email jobs |
| `/topic/my` | S/G đúng hồ sơ | Placeholder, mô tả nhóm cũ | Cá nhân/đề tài/thống nhất/lịch sử |
| `/topic/proposal` | S; G xem | Placeholder | Form cấu trúc/kế hoạch/version/preview/PDF |
| `/topic/reviews` | K/G nhóm | Placeholder | Nhóm/phân công/chờ duyệt/filter |
| `/topic/reviews/:id` | K/G nhóm | Placeholder | Version/comment/approve/revise/reject |
| `/topic/dossier` | K/G/S phạm vi | Placeholder | Hồ sơ/đủ trường/chốt/tài liệu |
| `/guidance/plan` | G; S xem | Placeholder | Mốc/kế hoạch/tạo-sửa việc/tuần |
| `/guidance/tasks` | G/S; K xem | Placeholder | Board/filter/tiến độ/submission/version |
| `/guidance/review` | G; S xem | Placeholder | Bài nộp/file/nhận xét/đánh giá/cần sửa |
| `/guidance/meetings` | G/S; K xem | Placeholder | Buổi hướng dẫn/trao đổi/đánh giá mốc |
| `/guidance/final-report` | S/G/K phạm vi | Placeholder | Upload/preview/final PDF/history |
| `/guidance/defense-confirm` | G; S/K xem | Placeholder | Tóm tắt/đồng ý/từ chối/lý do |
| `/defense/eligibility` | K; G/S xem phạm vi | Placeholder | Học vụ/nguồn/checks/reasons/chốt |
| `/defense/deferment` | K/S phạm vi | Placeholder | Request/duyệt/bảo lưu/liên kết |
| `/defense/committee` | K; H xem phạm vi | Placeholder | CRUD/member roles/SV/constraints/chốt |
| `/defense/reviewers` | K; G xem phân công | Placeholder | Gán GVPB/tải/xung đột/chốt |
| `/defense/schedule` | K/G/S/H phạm vi | Placeholder | Room/session/date/order/validate/publish |
| `/defense/minutes` | K/H secretary | Placeholder | Biên bản/nhận xét/câu hỏi/sửa/sign regions |
| `/grading/rubric` | K; G/H xem | Placeholder | Bộ tiêu chí/max/trọng số/validation |
| `/grading/scores` | G/H theo phân công | Placeholder | GVHD/GVPB/HĐ đúng role; nháp/gửi/khóa |
| `/grading/results` | K/H; S sau công bố | Placeholder | Thành phần/công thức/thiếu/chốt/công bố/sửa |
| `/report/export` | K/H theo quyền; S bản thân | Placeholder | Filter/template/preview/jobs/real files |
| Hồ sơ cá nhân `/profile` | tất cả | Chưa có | Contact/avatar/hồ sơ chỉ sửa đúng trường |
| Đổi mật khẩu `/change-password` | tất cả | Chưa có route, chỉ modal login | Route bắt buộc, validation, logout |
| `/catalog/research-areas` | K/A | Có constant, chưa page/route | CRUD hướng/mở/đóng/GV phù hợp |
| `/catalog/departments`, `/catalog/training-systems` | K/A | Chưa có | CRUD danh mục có tham chiếu |
| Nhóm duyệt `/topic/review-groups` hoặc tab reviews | K; G xem | Chưa có | Bộ môn/hướng/thành viên/lịch/phân đề cương |
| Term GV/quota `/terms/:id/lecturers` hoặc tab roster | K/A | Chưa có riêng | GV tham gia/hướng/quota/tải |
| `/forbidden`, wildcard 404 | tất cả | Chưa có | Hướng dẫn quay lại/đăng nhập/route guard |
| Notification center hoặc menu | tất cả | Chưa có | Đọc/chưa đọc/link/email mock trạng thái |

Một màn hình có thể chứa tab/dialog cho chức năng con, không bắt buộc thêm route nếu luồng vẫn tìm thấy và kiểm chứng được. Màn hình tài liệu bàn giao cuối phải lấy từ router thực tế sau triển khai.

## 5. Mâu thuẫn và điểm cần đồng bộ backend sau này

| Nguồn / hiện trạng | Quyết định frontend / hợp đồng |
| --- | --- |
| Markdown/bản Word cũ còn nhóm tối đa2 | ADR cá nhân và yêu cầu hiện tại thắng; không thêm groupId/ghép nhóm |
| BR21–22 Word ghi cần chốt công thức | ADR0003 chốt QT50/50 + HP40/60; vẫn lưu cấu hình theo đợt |
| Có hai ADR mang số0002 | Cả hai được áp dụng theo tên nội dung: cá nhân và NestJS/Prisma; không sửa lịch sử ADR |
| ThesisTerm chưa trainingSystemId; Registration chưa researchAreaId | Types demo/hợp đồng có; backend thành viên Bước1–3 bổ sung khi triển khai |
| Word Topic có term_student_id; Prisma Topic chưa ownership, Proposal.studentId unique toàn cục | Hợp đồng dùng termStudentId/registrationId và unique theo đợt; bảo lưu không ghi đè |
| RegistrationStatus chỉ PENDING/APPROVED/REJECTED/CANCELLED, thiếu draft/submitted | Demo/hợp đồng phân biệt trạng thái thao tác; adapter cần mapping/migration có quyết định |
| TaskStatus thiếu REVISION_REQUESTED/COMPLETED; TaskReview chỉ boolean isPassed | Hợp đồng thêm kết quả PASSED/FAILED/REVISION_REQUESTED; không đánh đồng “cần sửa” với không đạt |
| HĐ/session chưa status và session buổi chưa tường minh | Hợp đồng có draft/finalized/published, start/end, morning/afternoon |
| ScoreEntry chưa submittedAt/status; FinalResult chưa locked flag/QT/KTHP snapshot | Hợp đồng thêm trạng thái/snapshot và lịch sử; giao thành viên grading |
| Word ERD có bảo lưu chờ GVPB, điểm/nhận xét giữ lại, carry_over_term_id; Prisma chỉ quy trình duyệt rút gọn | Hợp đồng có nhánh bảo lưu sau phản biện cấu hình riêng, link hồ sơ trước/sau; nhóm bảo vệ quyết định mapping |
| Prisma điểm Decimal(4,1), ví dụ chuẩn HP8.15 | Đề xuất 2–3 số lẻ/decimal string API; frontend không cắt một số lẻ |
| ScoreAggregatorService.isPassed chỉ kiểm HP>=5 | Theo tài liệu điểm kiểm QT/KTHP/HP, thêm sửa trước lưu chiểu; backend sau này cần đồng bộ |
| Backend calculator hardcode .5/.5 trong QT | Frontend đọc cấu hình; không sửa backend trong lần này |
| OpenAPI chỉ4 path; controller có thêm reads/auth | `api-contracts.md` là **API dự kiến**, không tuyên bố đã có backend |
| useAuth có TODO; chưa hydrate/guard; login response không nhất quán wrapper | Demo adapter độc lập; HTTP adapter chuẩn hóa ApiResponse khi kết nối thật |
| Tải chức danh, quota tổng nhiều đợt, tie-break GPA/cộng tác còn đề xuất | Hiển thị chính sách demo và không mô tả là quy định chính thức của trường |

## 6. Kiểm chứng chức năng cần bao phủ

Luồng chính: tạo kỳ/đợt và roster → onboarding SV → 1 hướng/NV1–3 → đóng/khóa đăng ký → tính/chỉnh/chốt/công bố phân công → GVHD thống nhất đề tài → nháp/nộp/version/PDF → nhóm duyệt yêu cầu sửa → sửa/nộp lại/duyệt/chốt hồ sơ → giao tuần/nộp code/nhận xét/nộp lại/đạt → final PDF → GVHD đồng ý → Khoa học vụ/eligibility → HĐ/GVPB/lịch không xung đột → điểm GVHD/GVPB/HĐ → tổng hợp/chốt/công bố → SV xem và xuất kết quả.

Nhánh phải demo: empty/filter không kết quả; loading/service lỗi/retry; bắt buộc đổi mật khẩu; thiếu Email/SĐT; SV không đủ điều kiện; đăng ký hết hạn/khóa; NV lặp/sai hướng; GV quá quota/chưa phân; yêu cầu sửa không nhận xét; nộp sai file/quá hạn; chưa final/thiếu học vụ; bảo lưu; GVHD xung đột HĐ; trùng phòng/giờ; điểm thiếu/ngoài max; chốt rồi sửa trái quyền; SV xem trước công bố; export lỗi/không dữ liệu. Toàn bộ route cần mở được, bảng dài cuộn ngang và form/dialog dùng ở mobile.

Tài liệu này không thay kết quả kiểm thử cuối. Chỉ ghi đã chạy khi có log/typecheck/build/browser thực tế ở tài liệu bàn giao.
