# Quy trình vibe coding phần bước 1–3

Tài liệu này dành cho phần việc: tạo đợt và nhập sinh viên đủ điều kiện → sinh viên hoàn tất hồ sơ, đăng ký hướng/nguyện vọng → phân công GVHD, công bố, thống nhất đề tài, lập đề cương và xuất PDF.

Được lập sau khi đọc mã nguồn, Prisma, SQL, đặc tả và xem các sơ đồ ACT01–ACT03, ERD phân hệ đợt/phân công, mẫu đề cương trong `docs/spec/Project_1_06.docx`. Đây là kế hoạch triển khai; chưa có xác nhận hệ thống hiện tại build hoặc chạy thành công.

## 1. Xác định đúng phần việc

| Phần | Bạn triển khai | Điểm kết thúc |
| --- | --- | --- |
| Nền dùng chung | Đăng nhập, xác thực, quyền Khoa/GV/SV, ghi audit cho các thao tác trong phạm vi | Đủ để chạy và bảo vệ bước 1–3; giao diện quản trị RBAC đầy đủ có thể do thành viên phụ trách nền sở hữu |
| Bước 1 | Danh mục cần thiết; kỳ học/đợt theo hệ; kế hoạch giai đoạn; GV tham gia và quota; nhập SV đủ điều kiện | Đợt sẵn sàng mở đăng ký, danh sách SV/tài khoản/quota đúng |
| Bước 2 | Bắt buộc đổi mật khẩu, cập nhật Email/SĐT; một hướng; tối đa ba nguyện vọng có thứ tự | Đăng ký hợp lệ được lưu và khóa đúng thời hạn |
| Bước 3 | Thuật toán; xem trước; phương án nháp; phân công thủ công; chốt/công bố; email; thống nhất đề tài; đề cương; PDF | Có GVHD chính thức và đề cương sẵn sàng chuyển sang xét duyệt |
| Thành viên khác | Tạo nhóm GV duyệt, duyệt đề cương, hướng dẫn/báo cáo tuần, nộp final, hội đồng/bảo vệ/chấm điểm | Từ bước 4 của quy trình nghiệp vụ |

Use case liên quan: **UC01, UC04–UC12**, phần quyền/audit cần dùng của UC02–UC03 và phần xuất PDF đề cương của UC25. **UC13 trở đi thuộc luồng tiếp theo.**

Thiết lập mốc báo cáo tuần, nộp final và bảo vệ thuộc bước 1; chức năng nộp bài/chấm/duyệt tại các mốc đó thuộc phần thành viên khác. Số thứ tự “chặng” bên dưới là thứ tự lập trình, khác ba bước nghiệp vụ.

## 2. Những điểm trong khung cần xử lý trước

| Hiện trạng đã đọc thấy | Tác động tới cách làm |
| --- | --- |
| Nhiều trang `frontend/src/features/term`, `registration`, `topic` còn placeholder | Cần làm cả API và giao diện thật, không chỉ trang trí màn hình |
| API term/catalog/registration mới có các chức năng đọc cơ bản; `ImportService` trả số dòng giả lập | Chưa được coi chức năng import, CRUD hoặc đăng ký đã hoàn thành |
| `ThesisTerm` chưa liên kết `TrainingSystem`; `Registration` chưa lưu hướng | Bổ sung schema trước khi viết form và thuật toán |
| Chưa có dữ liệu cộng tác SV–GV được xác minh | Chưa thể áp dụng đúng ưu tiên “đã làm việc/nghiên cứu chung” |
| `UserAccount.email` bắt buộc và unique | Phải giải quyết được tài khoản chưa có email trước lần đăng nhập đầu |
| `RegistrationPrefSchema` trong `shared` chưa có hướng và chưa giới hạn ba NV | Đồng bộ validation frontend/backend, không dùng nguyên schema này làm đặc tả |
| Engine hiện sort GPA toàn cục rồi xét hết NV của từng SV | Cần sửa nếu áp dụng ưu tiên theo vòng NV1 toàn đợt → NV2 → NV3 |
| `AssignmentPlanService` mới tính và trả kết quả | Còn thiếu lưu nháp, phiên bản, điều chỉnh, chốt, công bố và gửi email |
| `mustChangePassword` được trả khi login nhưng guard chưa chặn nghiệp vụ | Chặn ở backend, kể cả người dùng gọi API trực tiếp |
| `auth.service.ts` dùng `PasswordPolicyValidator` nhưng thiếu import | Có lỗi mã nguồn cần xử lý trong chặng làm nền |
| Một số controller thiếu decorator quyền; guard hiện cho qua nếu endpoint không khai báo quyền | Rà từng endpoint, kiểm quyền theo vai trò và quyền sở hữu dữ liệu |
| `PdfUtil` mới tạo header; mẫu PDF mới là HTML | Chưa có quy trình sinh và tải file PDF thật |
| `Proposal.studentId` đang unique toàn hệ thống | Cần quy định đề cương theo SV trong từng đợt/đăng ký, tránh khóa đường tham gia đợt sau |
| `make migrate` đang chạy `db push`; migration SQL và Prisma có khác biệt về enum/kiểu thời gian; chưa cấu hình Prisma seed | Cần một luồng migration/seed tái lập được trên DB mới |
| Đặc tả Markdown còn ghép nhóm; ADR đã chốt đồ án cá nhân | Áp dụng một SV/một đề tài trong từng đợt theo ADR và yêu cầu hiện tại |
| Các activity/use case có ảnh trong Word; thư mục `docs/diagrams` mới có README; bản `.drawio` ERD hiện là bản rút gọn | Dùng cả Word và Prisma khi đối chiếu, không mặc định `.drawio` mô tả đầy đủ mọi bảng |

Tại thời điểm khảo sát, thư mục làm việc chưa có Git repository; `pnpm`, `docker`, `make` chưa được tìm thấy trên PATH của phiên shell. Chặng môi trường cần kiểm tra lại trên máy bạn. Chưa cài dependency hoặc chạy ứng dụng để viết tài liệu này.

## 3. Cách giao việc cho AI trong từng chặng

Vòng làm việc cho mỗi chặng:

1. Đưa mục tiêu, file cần đọc, quy tắc và tiêu chí nghiệm thu.
2. Yêu cầu AI đọc phần mã liên quan và báo ngắn các khoảng thiếu/mâu thuẫn.
3. Triển khai một lát cắt chạy được: dữ liệu → nghiệp vụ → API → giao diện → kiểm chứng.
4. Xem diff; chạy lại ca thành công và ca bị từ chối quan trọng; tự thao tác trên giao diện.
5. Khi đạt tiêu chí thì commit riêng và chuyển chặng. Lỗi còn mở được ghi rõ, không tính là hoàn thành.

Một cuộc hội thoại có thể đi qua nhiều chặng. Nếu mở hội thoại mới, đưa lại prompt nền, chặng đang làm, quyết định nghiệp vụ đã thống nhất và lỗi còn tồn tại. Không cần gửi toàn bộ tài liệu cho mọi thay đổi nhỏ.

Prompt nền dùng ở đầu phiên triển khai:

```text
Đây là monorepo quản lý đồ án: NestJS + Prisma + PostgreSQL,
React + Vite + TypeScript, pnpm workspaces. Đọc README.md, CLAUDE.md,
docs/adr, đặc tả và mã liên quan trước khi sửa.

Phạm vi tôi sở hữu là bước 1–3: tạo đợt/kế hoạch/import SV;
đăng nhập lần đầu/hồ sơ/đăng ký hướng và NV;
phân công GVHD/chốt/công bố/email; thống nhất đề tài/lập đề cương/xuất PDF.
Đồ án cá nhân: một SV/một đề tài trong một đợt.
Điểm bàn giao là đề cương SUBMITTED chờ bước duyệt của thành viên khác.

Giữ stack và cấu trúc module hiện tại. Controller gọi service;
nghiệp vụ dùng repository; validation Zod dùng chung khi phù hợp;
API dùng ApiResponse; mọi API được bảo vệ theo quyền và quyền sở hữu.
Đọc chữ ký RequirePermission thực tế: hiện nhận resource, action.
Migration đã được áp dụng phải được giữ nguyên.
Các BR/AC mới cần kiểm thử ca đúng và ca vi phạm theo quy ước dự án.

Chỉ triển khai chặng được giao và các phụ thuộc thật sự cần thiết.
Nêu rõ giả định, không tự đặt chính sách học vụ hoặc quy tắc ưu tiên.
Thực hiện đến khi có kết quả kiểm chứng; không dừng ở việc mô tả kế hoạch.
Báo lại: phần đã làm, file chính, kiểm tra thực sự đã chạy,
kết quả và vấn đề còn lại. Không tuyên bố đã test nếu chưa chạy.
```

## 4. Thứ tự triển khai và prompt từng chặng

### Chặng 1 — Chốt phạm vi, chính sách và đầu ra bàn giao

**Đầu ra:** tài liệu BR/AC cho bước 1–3, ma trận vai trò, quyết định nghiệp vụ và danh sách API dự kiến.

Các lựa chọn sau là **đề xuất để nhóm thống nhất**, chưa phải quy định của Khoa:

- Dùng `academicYear` và `semester` hiện có để biểu diễn kỳ trong MVP; chỉ thêm thực thể kỳ học riêng nếu nhóm cần quản lý danh mục kỳ độc lập.
- Mỗi đợt thuộc một hệ đào tạo; SV phải thuộc hệ phù hợp. Xác định rõ quota chỉ tính từng đợt hay còn có trần tổng khi các đợt nhiều hệ diễn ra đồng thời.
- `TermLecturer.quota` là chỉ tiêu thực tế trong đợt; `Lecturer.maxStudents` có thể dùng làm mặc định khi thêm GV vào đợt.
- Ưu tiên theo vòng NV1 → NV2 → NV3. Trong nhóm tranh một GV ở cùng vòng, đề xuất GPA giảm dần → cộng tác đã xác minh khi bằng GPA → mã SV làm tiêu chí phá hòa ổn định. Nếu Khoa ưu tiên cộng tác trước GPA, lưu thành chính sách khác; không tự cộng điểm thưởng.
- Làm rõ thang GPA, nguồn cung cấp và cách xử lý thiếu GPA. Không mặc định thiếu GPA là 0. Nên lưu ảnh chụp GPA dùng cho lần phân công để sau này giải thích được kết quả.
- Làm rõ “tối đa ba NV” có cho phép nộp với 0 NV không. Phương án MVP đề xuất: nháp có thể chưa chọn GV; khi nộp cần 1–3 GV khác nhau.
- Dữ liệu cộng tác do Khoa/GV có quyền xác minh; lời khai của SV chưa xác minh không tạo ưu tiên.
- SV chưa đăng ký hoặc thiếu hướng không được tự suy đoán hướng; đưa vào danh sách cần xử lý với lý do.
- Fallback đúng hướng: đề xuất ưu tiên GV có tỷ lệ tải thấp hơn, rồi mã GV; đây là quy tắc cần ghi rõ để kết quả tái lập.
- Khi chốt: đề xuất chặn nếu còn SV đủ điều kiện chưa phân công; SV bị rút/loại phải có trạng thái và lý do riêng do Khoa xử lý.
- Với yêu cầu hiện tại, thao tác “Chốt và công bố” nên đồng thời mở kết quả cho SV và tạo thông báo email cho GV. Nếu có hai nút riêng, phải ghi rõ điểm nào làm kết quả chính thức và điểm nào mở quyền xem.
- Sau chốt, đề xuất khóa chỉnh sửa thông thường; thay đổi hậu chốt cần quy trình riêng do nhóm quyết định.

```text
Làm chặng 1: đối chiếu yêu cầu bước 1–3 với đặc tả, ADR, sơ đồ trong Word,
Prisma và code. Lập BR/AC đánh số, ma trận Khoa/GV/SV, bảng khoảng thiếu
và hợp đồng bàn giao trước UC13. Ghi rõ các chính sách còn phải thống nhất:
vòng NV, GPA/cộng tác, quota, số NV tối thiểu, cửa sổ thời gian,
chốt/công bố và xử lý SV chưa đăng ký. Chưa đổi mã nghiệp vụ.
```

**Đạt khi:** mỗi chặng sau có tiêu chí cụ thể; không còn hai cách hiểu về ưu tiên NV/GPA/cộng tác bị trộn vào một thuật toán.

### Chặng 2 — Làm cho khung chạy được

**File đầu vào:** `README.md`, `Makefile`, `docker-compose.yml`, các `package.json`, `Dockerfile`, `tsconfig`, `.env.example`, CI.

```text
Làm chặng 2: kiểm tra công cụ và dependency, khắc phục lỗi build/type-check
hiện hữu và wiring NestJS. Chuẩn hóa cách chạy trên PowerShell.
Chọn rõ chạy ứng dụng trên host hoặc trong Docker; kiểm tra đường dẫn .env,
DATABASE_URL và volume không che mất artifact cần thiết.
Kiểm tra tích hợp shared package ở cả build và runtime.
Thiết lập Vitest và công cụ kiểm tra API cần thiết, dùng Playwright đã có
cho luồng giao diện. Không coi lệnh có trong package.json là đã hoạt động.
Ghi lại lệnh chạy có thể tái lập và kết quả thực tế.
```

**Đạt khi:** backend khởi động, frontend mở được, kết nối DB thành công, có cách chạy kiểm tra tự động. Chưa cần toàn bộ chức năng nghiệp vụ hoàn chỉnh.

### Chặng 3 — Đồng bộ schema, migration, seed và hợp đồng API

**File đầu vào:** `backend/prisma/schema.prisma`, hai cây migration, `database/seeds`, `shared/src/index.ts`, `docs/api/openapi.yaml`.

```text
Làm chặng 3 theo quyết định chặng 1. Bổ sung liên kết hệ đào tạo của đợt,
hướng của đăng ký, dữ liệu ưu tiên cộng tác đã xác minh và dữ liệu cần để
giải thích kết quả phân công. Thiết kế nháp/phiên bản phân công tương thích
với unique registrationId hiện có; không phá dữ liệu chính thức khi chạy lại.
Điều chỉnh vòng đời đề cương theo đăng ký/đợt, thống nhất với thành viên topic.
Giải quyết email chưa có lúc tạo tài khoản, không sinh email giả.

Thống nhất nguồn schema là Prisma theo ADR; kiểm tra sự khác biệt với SQL,
chọn luồng migration có kiểm chứng. Không áp dụng cả hai cây SQL lên một DB.
Giữ migration đã chạy, thêm migration tiến tới khi cần. Nếu chưa rõ DB đã
áp dụng gì, kiểm tra trước; không reset DB chỉ để làm hết lỗi drift.
Cấu hình seed tái chạy được cho vai trò, Khoa/GV/SV, hệ, hướng và dữ liệu demo.
Hoàn thiện OpenAPI và Zod schemas theo API được triển khai.
```

**Đạt khi:** migrate + seed trên DB phát triển mới chạy được; Prisma validate/generate thành công; ràng buộc rõ; không còn phải dùng `db push` thay cho việc ghi lịch sử migration chính thức.

### Chặng 4 — Nền đăng nhập, RBAC và audit

**Module:** `auth`, `common/security`, `common/audit`; `frontend/src/features/auth`, `useAuth`, router.

```text
Làm chặng 4: hoàn thiện login bằng tài khoản đã seed, /auth/me và logout;
thực hiện refresh/session nếu đó là hợp đồng auth đã chọn.
Chuẩn hóa ApiResponse và cách frontend đọc response.
Nạp user/roles/permissions vào trạng thái auth dùng chung và bảo vệ route.
Khai báo quyền thực tế cho endpoint Khoa/GV/SV; bổ sung kiểm tra quyền sở hữu.
Ghi audit các thao tác quản lý thuộc bước 1–3, không ghi mật khẩu/token.
Không trả passwordHash trong response tài khoản.
```

**Đạt khi:** Khoa, GV và SV đăng nhập được; SV bị từ chối API tạo đợt/phân công; thay `studentId` trong request không cho phép xem/sửa hồ sơ người khác.

### Chặng 5 — Danh mục hướng và giảng viên

**Module:** `catalog`; `ResearchArea`, `LecturerArea`, `TrainingSystem`, `Lecturer`.

```text
Làm chặng 5: API và màn hình quản lý hệ đào tạo, hướng đồ án và GV;
gán một/nhiều hướng phù hợp cho GV. Dùng dữ liệu danh mục thay vì hardcode
năm hướng; đối chiếu seeds hiện có. Hỗ trợ chọn GV tham gia từng đợt và
quota của đợt sau khi có term. Kiểm tra quota nguyên không âm;
không giảm dưới số phân công chính thức đang có.
```

**Đạt khi:** có đủ GV/hướng làm đầu vào phân công; GV không tham gia đợt không xuất hiện trong danh sách NV hợp lệ của đợt đó.

### Chặng 6 — Kỳ học, đợt và bảng kế hoạch

**Module:** `term`; các trang `TermListPage`, `TermDetailPage`, `PhasePlanPage`, `TermParameterPage`, `TermRosterPage`.

```text
Làm chặng 6: tạo/sửa đợt theo kỳ, năm học và hệ; gắn GV/quota;
thiết lập mốc đăng ký, phân công, đề cương, báo cáo tuần, nộp final, bảo vệ.
Dùng mã giai đoạn ổn định để kiểm tra nghiệp vụ, nhãn tiếng Việt cho UI.
Validate ngày đầu/cuối đợt, khoảng giai đoạn và các quan hệ trước-sau thật
sự bắt buộc; không cấm mọi chồng lấn vì báo cáo tuần có thể kéo dài qua
các giai đoạn khác. Mở/đóng/khóa có kiểm quyền và audit.

Định nghĩa một hàm dùng chung đánh giá cửa sổ thao tác: trạng thái đợt,
thời gian server, giai đoạn và isLocked. Quy định rõ biên thời gian;
đề xuất start <= now < end, hiển thị Asia/Ho_Chi_Minh và lưu thời gian
nhất quán. Scheduler chỉ cập nhật trạng thái; API vẫn kiểm tra thời gian.
```

**Đạt khi:** Khoa tạo được đợt cho Chính quy/Liên thông/Từ xa; không mở đăng ký khi thiếu cấu hình bắt buộc; API từ chối trước giờ mở, đúng giờ đóng và khi bị khóa, kể cả UI còn hiển thị form.

### Chặng 7 — Nhập SV đủ điều kiện vào đúng đợt

**Module:** `catalog` và `term`; `ImportService`, `ImportJob`, `Student`, `UserAccount`, `TermStudent`.

```text
Làm chặng 7: thay import giả lập bằng luồng tải mẫu CSV/XLSX → tải file →
kiểm tra/xem trước lỗi theo dòng → ghi dữ liệu. Chuẩn hóa mã SV là chuỗi,
giữ số 0 đầu; kiểm tra GPA theo thang đã chốt, hệ đào tạo và đợt đích.
Chốt các cột bắt buộc/cột tùy chọn cùng file mẫu.

Với SV mới: tạo Student, tài khoản username=mã SV, hash mật khẩu mặc định
là mã SV, vai trò STUDENT và mustChangePassword=true. Với SV cũ: dùng lại
tài khoản; không đặt lại mật khẩu đã đổi, không ghi đè liên hệ bằng ô trống.
Tạo TermStudent đúng đợt bằng transaction. Định nghĩa rõ xử lý trùng,
import lại và file có một phần lỗi; lỗi phải giải thích được theo dòng.
```

**Đạt khi:** file hợp lệ tạo đủ dữ liệu; import lại không nhân đôi; sai hệ/trùng mã/thiếu dữ liệu được báo; tài khoản mới đăng nhập được bằng mã SV.

### Chặng 8 — Bắt buộc đổi mật khẩu và hoàn tất liên hệ

**Module:** `auth`, `catalog`; thêm trang hoàn tất hồ sơ nếu khung chưa có.

```text
Làm chặng 8: login lần đầu dẫn SV đến đổi mật khẩu rồi cập nhật Email/SĐT.
SV có mustChangePassword chỉ được gọi các API onboarding tối thiểu cần thiết
và logout, không được dùng nghiệp vụ khác. Kiểm tra trạng thái từ nguồn
đáng tin cậy phía server để token cũ không bỏ qua được điều kiện này.
Cho phép SV cập nhật hồ sơ của mình; không sửa mã SV, hệ, GPA hoặc điều kiện
học vụ. Đồng bộ nơi lưu email/phone theo mô hình dữ liệu đã chọn.
Chặn đăng ký cho tới khi hoàn tất đổi mật khẩu và liên hệ hợp lệ.
```

**Đạt khi:** đi URL trực tiếp, refresh trang hoặc gọi API bằng token vẫn không bỏ qua onboarding; mật khẩu cũ không dùng được sau đổi; SV không sửa được GPA.

### Chặng 9 — Đăng ký một hướng và tối đa ba NV

**Module:** `registration`, `shared`; `StudentRegistrationPage` và API/hook tương ứng.

```text
Làm chặng 9: SV xem các đợt mình đủ điều kiện, chọn đúng một hướng,
chọn và sắp thứ tự NV1–NV3, lưu nháp/nộp/sửa trong cửa sổ cho phép theo
hợp đồng đã chốt. API suy ra studentId từ tài khoản đăng nhập.
Kiểm tra roster, hệ, onboarding, thời gian, khóa; GV thuộc đợt và phù hợp
hướng; không trùng GV; thứ tự NV liên tục; số NV theo chính sách chặng 1.
Ghi đăng ký và thay danh sách NV trong cùng transaction.
Quota là đầu vào phân công; đăng ký NV không tự giữ chỗ cho người bấm sớm.
Hiển thị trạng thái lưu/thời hạn và lý do từ chối rõ ràng.
```

**Đạt khi:** tải lại vẫn giữ đúng hướng/thứ tự; 4 NV, lặp GV, sai đợt/sai hướng, người ngoài roster và nộp sau hạn đều bị backend chặn.

### Chặng 10 — Thuật toán phân công thuần và kiểm thử

**File chính:** `backend/src/registration/engine/assignment-algorithm.ts` và file test cùng thư mục.

```text
Làm chặng 10: viết engine thuần theo BR/AC đã thống nhất, không truy cập DB,
không gửi email. Đầu vào gồm đăng ký hợp lệ, hướng, GPA được sử dụng,
cộng tác đã xác minh, GV/hướng/quota và phân công cố định cần giữ.
Xử lý theo vòng NV1 toàn bộ → NV2 cho SV còn lại → NV3 → fallback đúng hướng.
Áp dụng comparator GPA/cộng tác/phá hòa từ chính sách, không cộng điểm tùy ý.
Không đủ chỗ trả danh sách chưa phân và lý do, không tự vượt quota.
Kết quả có phương thức NV1/NV2/NV3/AUTO_AREA và dữ liệu giải thích.
Không mutate input; cùng dữ liệu/chính sách phải cho cùng kết quả.
Viết test cho các ca ở mục 5 trước khi ghép engine vào API.
```

**Đạt khi:** test chứng minh đúng ưu tiên từng vòng, quota, fallback và kết quả ổn định. Test cũ nếu đang mô tả ưu tiên GPA toàn cục cần được xem lại theo BR đã chốt.

### Chặng 11 — Xem trước và lưu phương án nháp

**Module:** `registration`; `AssignmentPlanService`, `AssignmentPlanPage`.

```text
Làm chặng 11: Khoa chọn đợt đã đóng đăng ký, chạy engine và xem phân bố tải,
tỷ lệ đạt NV1/NV2/NV3/AUTO_AREA và danh sách chưa phân có lý do.
Lưu phương án nháp cùng chính sách/đầu vào hoặc phiên bản dữ liệu cần truy vết.
Phân biệt dữ liệu nháp với phân công chính thức. Chạy lại theo chính sách
đã chốt: giữ các gán thủ công được khóa và trừ đúng tải của chúng;
không cộng tải nháp cũ hai lần. Nếu đăng ký/quota/roster thay đổi,
đánh dấu phương án cũ cần tính lại hoặc chặn chốt do dữ liệu lỗi thời.
Không công bố kết quả hoặc gửi email ở chặng chạy thử.
```

**Đạt khi:** tính lại không sinh phân công chính thức trùng; phương án tồn tại sau reload; SV và GV không đọc được dữ liệu nháp qua API.

### Chặng 12 — Điều chỉnh thủ công, chốt và công bố

**Module:** `registration`; `ManualAdjustPage`, `AssignmentResultPage`.

```text
Làm chặng 12: Khoa phân SV còn lại hoặc chuyển GV trong phương án nháp,
ghi người sửa/lý do và cập nhật tải hai GV. Kiểm tra lại roster, hướng,
GV tham gia, quota và các ràng buộc trước mỗi chỉnh sửa và trước chốt.
Thực hiện chốt/công bố theo hợp đồng chặng 1 trong transaction có cơ chế
chống xung đột theo đợt; mỗi SV trong đợt chỉ có một GVHD chính thức.
Nếu chính sách có trần tổng GV qua nhiều đợt/hệ đồng thời, kiểm cả tổng
và chống xung đột theo GV giữa các đợt, không chỉ khóa riêng từng đợt.
Chặn phương án lỗi thời và chốt hai lần gây tác dụng phụ lặp.
SV chỉ đọc được kết quả của mình sau công bố; GV chỉ đọc danh sách được giao.
Ghi sự kiện/outbox cần gửi email trong cùng transaction chốt/công bố.
```

**Đạt khi:** không vượt quota khi có hai request đồng thời; kết quả đã chốt không bị tính lại đè lên; thao tác trái quyền bị chặn; công bố mở đúng quyền xem.

### Chặng 13 — Email thông báo sau chốt/công bố

**Module:** `notification`; dùng `backend/templates/email/phan-cong-gvhd.html` và MailHog cho phát triển.

```text
Làm chặng 13: xử lý sự kiện/outbox phân công đã công bố để gửi email GV,
kèm danh sách SV và thông tin liên hệ hợp lệ. Có trạng thái gửi/thất bại,
retry và khóa chống chạy worker trùng. Tạo khóa duy nhất theo lần công bố,
GV và loại thông báo để request chốt/công bố lặp không tạo thêm thư.
Chỉ gửi sau DB commit. Lỗi SMTP không làm mất phân công đã chốt.
Nêu giới hạn retry của SMTP nếu gửi thành công nhưng chưa kịp ghi nhận;
không tuyên bố bảo đảm exactly-once nếu hạ tầng không hỗ trợ.
Kiểm chứng nội dung trong MailHog, không gửi thư thật khi demo.
```

**Đạt khi:** xem được email đúng GV sau công bố; SMTP lỗi có thể xử lý lại; bấm chốt/công bố lặp không tạo thêm công việc gửi.

### Chặng 14 — Thống nhất đề tài và lưu đề cương

**Module:** `topic`; `MyTopicPage`, `ProposalEditorPage`; `Topic`, `Proposal`, `ProposalVersion`.

```text
Làm chặng 14: sau phân công chính thức, SV nhập đề tài và nội dung đề cương;
GVHD được giao có thể xem và ghi nhận thống nhất đề tài theo hợp đồng đã chốt.
Không coi thao tác thống nhất của GVHD là duyệt đề cương của Khoa.
Form gồm tên đề tài, nội dung/phạm vi, công nghệ, kết quả dự kiến và kế hoạch
thực hiện; dùng đúng mẫu trong Word. Lưu nháp và phiên bản; nộp để chuyển
sang SUBMITTED khi đủ điều kiện và trong hạn. Kiểm quyền sở hữu,
GVHD chính thức, hạn giai đoạn và chỉnh sửa đồng thời để tránh mất nội dung.
Để nguyên bước UNDER_REVIEW/APPROVED cho thành viên phụ trách UC13.
```

**Đạt khi:** SV lưu và tải lại đề cương đúng đợt; có lịch sử phiên bản; GV khác không truy cập được; nộp đủ dữ liệu chuyển sang trạng thái nhận vào duyệt đã thống nhất.

### Chặng 15 — Xuất PDF đề cương thật

**File/module:** `topic`, phần export cần thiết; `backend/templates/pdf/de-cuong.html`, `de-cuong-ky-su.html`, `PdfUtil`.

```text
Làm chặng 15: chọn và tích hợp bộ render HTML→PDF phù hợp môi trường đã có;
đưa dependency/font/binary cần thiết vào cấu hình chạy và Docker nếu cần.
Đối chiếu mẫu HTML với mẫu chính thức trong Word: họ tên/mã SV/lớp/khóa,
liên hệ SV/GV, hệ, tên đề tài, nội dung/phạm vi, công nghệ, kết quả dự kiến,
bảng kế hoạch và bốn vị trí ký. Thống nhất bổ sung nguồn dữ liệu còn thiếu.
Đọc nội dung từ một ProposalVersion cụ thể, render PDF thật và cho tải
đúng quyền. Mẫu Cử nhân/Kỹ sư chọn theo loại văn bằng, không suy ra chỉ từ
hệ Chính quy/Liên thông/Từ xa. Giữ vùng ký trống theo mẫu.
Kiểm tra font tiếng Việt, khổ giấy, xuống trang và header tải file.
Không trả HTML rồi đổi đuôi thành .pdf.
```

**Đạt khi:** trình đọc PDF mở được file; tiếng Việt và bảng dài đúng; nội dung khớp phiên bản được chọn; tải PDF của SV khác bị từ chối. Bản xuất trước duyệt không được hiển thị như đã được Khoa phê duyệt.

### Chặng 16 — Kiểm thử xuyên suốt và bàn giao

```text
Làm chặng 16: chuẩn bị dữ liệu demo giả lập đủ các nhánh, chạy kiểm tra
engine, API/DB, quyền, thời gian, import và luồng giao diện bước 1–3.
Thực hiện kịch bản ở mục 7. Cập nhật README/lệnh chạy, OpenAPI, ERD và
các quyết định đã thay đổi. Lập tài liệu bàn giao dữ liệu/trạng thái/sự kiện
cho thành viên UC13 trở đi; báo kết quả kiểm tra đã chạy và lỗi còn mở.
Không mở rộng sang triển khai quy trình duyệt, báo cáo tuần hoặc bảo vệ.
```

**Đạt khi:** từ DB phát triển mới có thể dựng dữ liệu, demo hết bước 1–3 và chuyển một đề cương hợp lệ cho thành viên sau mà không sửa DB thủ công.

## 5. Ca kiểm thử đặc biệt cho thuật toán

### Ca phân biệt ưu tiên vòng NV và ưu tiên GPA toàn cục

Giả sử mọi SV/GV đều cùng hướng, chưa có phân công cố định:

| SV | GPA | NV1 | NV2 |
| --- | --- | --- | --- |
| C | 4.0 | Y | — |
| A | 3.8 | Y | X |
| B | 3.0 | X | — |

Quota X = 1, Y = 1. Theo chính sách vòng NV, **C → Y, B → X** ở vòng NV1; A không được lấy X bằng NV2 và chuyển sang fallback/danh sách cần xử lý. Engine hiện tại có thể cho C → Y, A → X rồi B chưa được phân. Ca này phải có expected result tường minh.

Các ca bắt buộc khác:

1. Nhiều SV cùng NV1 một GV: lấy đúng người theo chính sách ưu tiên, người còn lại đi vòng tiếp.
2. Trượt NV1 rồi đạt NV2; trượt NV1–NV2 rồi đạt NV3.
3. Trượt cả ba, có GV đúng hướng còn chỗ → `AUTO_AREA`.
4. Không còn GV đúng hướng → chưa phân với lý do; không chọn GV khác hướng ngầm.
5. Quota 0, đã đầy, có phân công cố định hoặc phân công thủ công cần giữ.
6. GPA bằng nhau; cộng tác đã xác minh/chưa xác minh; thiếu GPA xử lý đúng chính sách.
7. GV có nhiều hướng nhưng tổng số SV trong đợt vẫn không vượt quota của GV.
8. SV chưa nộp đăng ký/thiếu hướng hoặc không thuộc roster không bị đưa vào engine như một đăng ký hợp lệ.
9. Đổi thứ tự dữ liệu input vẫn cho cùng kết quả theo comparator đã định nghĩa.
10. Input không bị engine thay đổi; mỗi SV nhận tối đa một GV.

Ngoài unit test engine, kiểm thử API/DB riêng cho import lặp, ghi đăng ký nguyên tử, request chốt đồng thời, kế hoạch lỗi thời và kiểm quyền công bố.

## 6. Checklist chung để tính một chặng đã xong

- API dùng dữ liệu thật và có validation/kiểm quyền phía server.
- Giao diện xử lý tải dữ liệu, danh sách rỗng, lỗi, lưu thành công và ngăn gửi lặp hợp lý.
- Dữ liệu còn đúng sau khi tải lại trang.
- BR/AC có ca đúng và ca vi phạm theo quy ước `CLAUDE.md`; ưu tiên kiểm thử hành vi thay vì chép lại cách cài đặt.
- Type-check/build và những test liên quan thật sự được chạy; ghi rõ kiểm tra chưa chạy được.
- OpenAPI và shared schema phản ánh API thực tế, không phải endpoint dự kiến chưa tồn tại.
- Không commit mật khẩu, token, dữ liệu cá nhân thật hoặc file môi trường.
- Có commit riêng khi repository đã được thiết lập; chưa đạt tiêu chí thì tiếp tục sửa chặng hiện tại.

## 7. Kịch bản demo cuối phần của bạn

1. Khoa tạo kỳ/đợt Chính quy, nhập kế hoạch và gắn GV/hướng/quota. Thể hiện hệ đào tạo của đợt khác biệt với loại văn bằng Cử nhân/Kỹ sư.
2. Import danh sách SV giả lập; thử một dòng sai và import lại để chứng minh báo lỗi/chống trùng.
3. SV mới đăng nhập bằng mã SV; thử gọi API nghiệp vụ khi chưa đổi mật khẩu và nhận lỗi.
4. Đổi mật khẩu, nhập Email/SĐT; chọn một hướng và 1–3 NV theo chính sách đã chốt.
5. Thử lặp GV, sai hướng, người ngoài roster và nộp khi đã đóng đăng ký.
6. Khoa chạy phương án với dữ liệu làm xuất hiện NV1, NV2, NV3, fallback theo hướng và SV còn lại.
7. Điều chỉnh thủ công; thử vượt quota rồi sửa về hợp lệ.
8. Trước công bố, SV không xem được draft. Khoa chốt/công bố; SV thấy kết quả của mình, GV thấy danh sách được giao.
9. Mở MailHog xem thư GV; gửi lại cùng request công bố không tạo thêm công việc email.
10. SV nhập đề tài, GVHD ghi nhận thống nhất, SV lưu/nộp đề cương và tải PDF một phiên bản cụ thể.
11. Thành viên tiếp theo dùng API lấy đề cương `SUBMITTED` để bắt đầu luồng duyệt; phần việc của bạn kết thúc tại đây.

## 8. Hợp đồng bàn giao cho thành viên khác

Chốt hợp đồng này từ chặng 1–3 để mọi người có thể làm song song, sau đó cập nhật theo triển khai thực tế:

| Thành phần bàn giao | Nội dung cần thống nhất |
| --- | --- |
| Danh tính/đợt | `termId`, `studentId`, `termStudentId` hoặc định danh roster tương đương, `registrationId`, hệ, kỳ |
| Phân công chính thức | `assignmentPlanId`, `advisorId`, trạng thái công bố, thời điểm và nguồn dữ liệu chính thức |
| Đề tài/đề cương | `topicId`, `proposalId`, định danh/số phiên bản, nội dung và API PDF đúng quyền |
| Trạng thái đầu vào duyệt | Đề xuất `SUBMITTED`; rõ điều kiện nộp và quy tắc sửa/nộp lại khi đang chờ duyệt |
| Quyền | SV sở hữu hồ sơ; GVHD chính thức; nhóm duyệt/Khoa do thành viên UC13 bổ sung |
| Mốc thời gian | Mã giai đoạn, cửa sổ thao tác, khóa/mở và cách module khác hỏi trạng thái |
| Dữ liệu dùng chung | Nhóm thống nhất thay đổi `shared`, `auth`, schema và migration qua một đầu mối để tránh migration xung đột |
| Sự kiện nếu sử dụng | Tên sự kiện công bố phân công, nộp đề cương; payload và thời điểm phát sau commit |

Không chuyển quyền ghi điểm/duyệt/bảo vệ vào phần của bạn chỉ vì đã có trang khung hoặc bảng tương ứng trong DB.

## 9. Lệnh kiểm chứng sau khi chặng môi trường đã sẵn sàng

Các lệnh dưới đây là điểm bắt đầu theo package scripts hiện có. Cần sửa cấu hình còn thiếu ở chặng 2–3 trước khi coi đây là quy trình chạy đã được kiểm chứng.

```powershell
# Tại thư mục gốc: chỉ tạo .env nếu chưa tồn tại
if (-not (Test-Path .env)) { Copy-Item .env.example .env }

pnpm install

# Mô hình chạy ứng dụng trên host: hạ tầng ở Docker
docker compose up -d postgres mailhog

# Đảm bảo Prisma tìm đúng DATABASE_URL khi chạy tại backend;
# backend cần đọc đúng các biến môi trường của mô hình chạy đã chọn.
pnpm --filter @doan/backend exec prisma validate
pnpm --filter @doan/backend exec prisma generate
pnpm --filter @doan/backend exec prisma migrate deploy

# Chỉ chạy sau khi đã cấu hình Prisma seed ở chặng 3
pnpm --filter @doan/backend exec prisma db seed

pnpm --filter @doan/backend type-check
pnpm --filter @doan/frontend type-check
pnpm --filter @doan/backend test
pnpm build
```

Khi phát triển schema, tạo migration mới bằng `prisma migrate dev --name <ten_thay_doi>` trên DB phát triển đã xác định. Khi dựng từ lịch sử có sẵn, dùng `migrate deploy`. Không dùng reset tự động để xử lý một DB chưa biết tình trạng.

Sau khi cấu hình test frontend, chạy test liên quan và `pnpm --filter @doan/frontend test:e2e` với các dịch vụ/fixtures cần thiết. Chạy lint khi ESLint/config tương ứng đã được thiết lập. Không dùng tùy chọn bỏ qua test để báo một tính năng chưa kiểm chứng là đã đạt.

Có thể khởi động backend/frontend ở hai terminal bằng `pnpm --filter @doan/backend dev` và `pnpm --filter @doan/frontend dev` sau khi môi trường đã được chuẩn hóa. Nếu chọn chạy cả ứng dụng trong Docker, dùng lệnh và cấu hình dành riêng cho mô hình đó; hostname DB bên trong container khác hostname khi chạy trên host.
