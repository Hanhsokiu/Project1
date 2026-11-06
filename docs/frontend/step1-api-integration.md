# Frontend tích hợp API Bước 1

Giai đoạn hiện tại dùng API thật cho auth và Bước 1: kỳ học, danh mục phục vụ đợt, sinh viên đủ điều kiện, đợt/kế hoạch/tham số/danh sách tham gia/quota, import sinh viên. Đăng ký/phân công/đề tài/đề cương trong Bước 2–3 tiếp tục dùng service mock. Không mở rộng backend nghiệp vụ của các bước đó.

## Cấu hình độc lập theo phân hệ

`frontend/.env.local` cho môi trường local hiện tại:

```dotenv
VITE_API_URL=http://127.0.0.1:3010/api
VITE_AUTH_API=true
VITE_TERM_API=true
VITE_CATALOG_API=true
VITE_IMPORT_API=true
```

Không có biến datasource toàn cục. Tắt một cờ sẽ giữ adapter mock của chính phân hệ đó; bật cờ tương ứng chuyển mutation và dữ liệu phân hệ sang API. Kết nối các API có xác thực cần phiên đăng nhập API thật. Khởi động lại Vite khi đổi `.env.local`.

| Cờ                 | Phạm vi API                                                                           | Phạm vi còn mock                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `VITE_AUTH_API`    | Đăng nhập, phiên/tài khoản hiện tại, đổi mật khẩu, cập nhật liên hệ theo auth service | Các nghiệp vụ quản trị tài khoản ngoài backend Bước 1 theo phạm vi bàn giao riêng                       |
| `VITE_TERM_API`    | Kỳ học; tạo/sửa đợt; vòng đời; khóa/mở; 6 giai đoạn; tham số; danh sách SV/GV/quota   | Đăng ký/phân công/đề tài vẫn thuộc adapter Bước 2–3                                                     |
| `VITE_CATALOG_API` | Danh mục hệ/bộ môn/hướng, SV và GV; tạo/sửa qua form                                  | Không thay service đăng ký/đề tài                                                                       |
| `VITE_IMPORT_API`  | Mẫu, upload/preview, công việc và xác nhận import **sinh viên vào đợt**               | Import giảng viên là demo trên trình duyệt; UI nêu rõ và chỉ dẫn dùng form GV để cập nhật danh mục thật |

Backend local chạy cổng **3010**, PostgreSQL riêng của công việc ở **54339**, Vite ở **5173**. Không thay cấu hình các ứng dụng khác dùng 3000/54329.

## Route và endpoint

| Route frontend                                                                                                                                | Adapter/endpoint thực tế                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`, `/change-password`, `/profile`                                                                                                      | Auth adapter do root tích hợp; phiên thật trong `shared/api/api-session.ts`                                                                    |
| `/catalog/reference`                                                                                                                          | GET/POST/PATCH `/departments`, `/training-systems`, `/research-areas`; GET/POST `/semesters`                                                   |
| `/catalog/students`                                                                                                                           | GET `/students`; POST/PATCH `/students[/:id]`                                                                                                  |
| `/catalog/lecturers`                                                                                                                          | GET `/lecturers`; POST/PATCH `/lecturers[/:id]`                                                                                                |
| `/terms`                                                                                                                                      | GET/POST `/terms`; PATCH `/terms/:id`                                                                                                          |
| `/terms/:id`                                                                                                                                  | Thông tin đợt; PATCH `/terms/:id/status`, `/terms/:id/lock`                                                                                    |
| `/terms/:id/phases`                                                                                                                           | PUT `/terms/:id/phases`                                                                                                                        |
| `/terms/:id/parameters`                                                                                                                       | PUT `/terms/:id/parameters`                                                                                                                    |
| `/terms/:id/roster`                                                                                                                           | PUT `/terms/:id/roster` với `studentIds`, `lecturers[{lecturerId,quota}]`                                                                      |
| `/catalog/import` (SV)                                                                                                                        | GET `/imports/students/template?format=csv\|xlsx`; POST multipart `/imports/students/preview`; GET `/imports/:id`; POST `/imports/:id/confirm` |
| `/registration`, `/registration/assignment`, `/registration/manual`, `/registration/result`, `/topic/my`, `/topic/proposal`, `/topic/dossier` | Service mock Bước 2–3; tham chiếu UUID đợt/danh mục/người dùng thật từ snapshot                                                                |

Mutation của trang đã đi qua `useAction`, chờ Promise hoàn tất rồi làm mới query `['demo']`; không điều hướng trước khi API trả ID. Tạo đợt thành công điều hướng tới UUID mới. Lỗi validation được đưa qua HTTP client và toast/trạng thái lỗi, form giữ dữ liệu để sửa.

## Ownership và cache snapshot

`shared/data/snapshot-api.ts` cung cấp:

- `hydrateStep1Snapshot(mock)` tải API song song, đọc toàn bộ các trang `{items,total,page,pageSize,totalPages}` (cũng hiểu `data`/`limit` trong giai đoạn tương thích), rồi trả snapshot cho TanStack Query.
- `mergeStep1Snapshot(mock)` ghép đồng bộ cache API đã tải để mock registration/topic có thể kiểm tra đợt, roster và hướng/GV bằng UUID thật khi gọi `readDb()`.
- Cache thuộc access token hiện tại. Đổi tài khoản/token không tái sử dụng dữ liệu của token trước; lần hydrate tiếp theo tải lại API. HTTP failure không được biến thành một mutation mock thành công.

Khi cờ term bật, `db.terms` chỉ có đợt API. Khi cờ catalog bật, danh mục và các danh sách API được phép đọc là nguồn chính thức; không trộn thêm SV/GV demo vào danh sách quản lý của Khoa. Toàn bộ `registrations`, `assignments`, `topics` và lịch sử mock của chúng vẫn giữ nguyên trong lớp dữ liệu mẫu.

`term.assignmentPublished` được suy ra thêm từ phân công mock đã công bố của **đúng UUID đợt** để giữ khả năng demo Bước 2–3. Các field điều hành Bước 1 và `term.status` vẫn theo API, không nâng trạng thái đợt thật bằng kết quả mock. Chốt/công bố phân công mock không gọi endpoint phân công thật.

API `/students` bị giới hạn theo quyền. Với SV/GV không có quyền đọc toàn danh sách, snapshot không gọi endpoint đó. `/auth/me` cung cấp profile SV hiện tại; profile này được bridge vào `db.students`, tài khoản hiện tại vào `db.accounts`. Do đó SV thật chỉ đăng ký được nếu UUID của mình có trong roster API; không mượn SV demo `sv1`. Liên hệ bắt buộc của Bước 2 vẫn được kiểm tra trong service đăng ký.

Khi API trả không có đợt, workspace dùng ngữ cảnh rỗng, dashboard có trạng thái chưa có đợt và CTA tạo đợt cho Khoa/Admin; không tạo một đợt giả trong danh sách API.

## Ánh xạ dữ liệu

- `StudentDto.studentCode/fullName/academicEligible` → `Student.code/name/eligible`; GPA là `number | null`, giữ thiếu dữ liệu và hiển thị “—”, không đổi thành 0; tên hệ lấy từ relation `trainingSystem` hoặc danh mục hệ. SV không có field bộ môn trong API, form API ẩn lựa chọn bộ môn.
- `LecturerDto.lecturerCode/fullName/maxStudents/researchAreas` → `Lecturer.code/name/quota/directionIds`.
- Kỳ học có `academicYear`, `semester` 1–3, `startDate/endDate`; form tạo kỳ học nhập đủ các field. API hiện hỗ trợ tạo/tra cứu kỳ học, UI không giả lập PATCH kỳ học đã tạo.
- Hướng nghiên cứu API chỉ có tên/mô tả, không có mã/trạng thái sử dụng; form không hiển thị thao tác không được backend hỗ trợ. Mã hiển thị được tạo ổn định từ ID.
- Tạo/sửa đợt ánh xạ tên kỳ/hệ sang UUID từ lookup API, không gửi ID demo.
- Thời gian giai đoạn dùng `datetime-local` theo giờ Việt Nam, gửi ISO có `+07:00`. Sáu mã cố định: `REGISTRATION`, `ASSIGNMENT`, `PROPOSAL`, `WEEKLY`, `FINAL`, `DEFENSE`. UI API chỉ sửa 6 giai đoạn có sẵn; không thêm/xóa/đổi thứ tự tùy ý. Cấu hình các mốc sau Bước 3 không đồng nghĩa đã triển khai backend nghiệp vụ của các bước đó.

## Import sinh viên

`StudentApiImport.tsx` dùng tệp thật ở dạng multipart, luôn gửi `termId` UUID của đợt đã chọn. Không gửi các dòng đã tự phân tích trên client để thay kiểm tra tại server. Khi chưa có đợt, chọn tệp/preview bị vô hiệu hóa và có hướng dẫn chọn/tạo đợt.

1. Tải CSV UTF-8 BOM hoặc workbook XLSX từ endpoint mẫu.
2. Chọn tệp, bấm **Kiểm tra tệp**. Server trả job `VALIDATED` với số dòng, dữ liệu, action `CREATE/UPDATE/SKIP/ERROR`, trạng thái dòng và lỗi theo field.
3. Xem/tìm/lọc dòng lỗi; có thể tải CSV báo cáo lỗi. Để sửa, cập nhật tệp và tạo preview mới.
4. Chế độ `STRICT` yêu cầu mọi dòng hợp lệ; UI không cho xác nhận khi còn lỗi. Chọn chỉ nhập dòng hợp lệ dùng `VALID_ONLY`.
5. Confirm trả job `DONE/PARTIAL`, số nhập thành công/bỏ qua và kết quả từng dòng. Job đã hoàn tất không cho bấm xác nhận lại; có nút tải lại kết quả.

Preview lưu ID công việc vào URL `/catalog/import?job=<UUID>`. Khi tải lại trang, UI gọi `GET /imports/:id` và phục hồi số liệu, trạng thái hoàn tất, lỗi từng dòng và chế độ import từ server. Có trạng thái đang tải, lỗi và nút thử lại. Kết quả chỉ hiển thị khi `job.termId` khớp đợt đang chọn; đổi đợt không trộn lịch sử của đợt khác. Chọn tệp mới xóa tham số `job` để bắt đầu preview mới.

Các mã giữ số 0 đầu. Contact có thể trống; tài khoản SV mới bắt buộc đổi mật khẩu lần đầu. Import lại không tạo trùng tài khoản/SV và không đặt lại mật khẩu cũ. Dòng đã thuộc roster có thể là `SKIP`; dữ liệu thay đổi được `UPDATE` theo kết quả server.

## Kiểm chứng đã chạy

- `npm run type-check`: PASS sau tích hợp adapters/pages.
- Unit `snapshot-api.test.ts`: 5 ca ownership, token isolation, quyền SV và lỗi không fallback.
- Unit `hybrid-registration.test.ts`: 2 ca xác nhận SV thật dùng roster/UUID thật để nộp đăng ký mock mà không phát sinh API mutation Bước 2; SV ngoài roster bị chặn.
- Unit `catalog-term.test.ts`: 8 ca mock cũ vẫn hoạt động qua adapter mock explicit.
- `e2e/step1-api.spec.ts`: dùng UI đăng nhập Giáo vụ thật, tạo kỳ/đợt, lưu 6 giai đoạn và reload giữ giờ, lưu SV/GV/quota, preview tệp có 1 dòng hợp lệ + 1 dòng lỗi GPA, confirm `VALID_ONLY`, kiểm tra nhập lại và reload danh mục/roster/kết quả import. Kiểm tra thêm roster và form kế hoạch ở chiều rộng 390px. Theo dõi console/page errors và lưu ảnh desktop/mobile trong `frontend/test-results-api-ui/`.

Lệnh chạy UI test local:

```powershell
cd frontend
npm exec -- playwright test e2e/step1-api.spec.ts --output=test-results-api-ui --reporter=line
```

Test UI dùng Chrome đã cài, API phải chạy ở 3010. Kỳ/đợt và mã SV kiểm thử được tạo riêng theo mỗi lần chạy, tránh đụng hồ sơ sẵn có. Đây là kiểm chứng local; triển khai production và backend Bước 2–3 nằm ngoài lần tích hợp này.
