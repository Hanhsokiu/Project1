# Backend Bước 1: kỳ học, đợt và cấu hình thực hiện

Phạm vi triển khai: module `backend/src/term`, đọc/ghi PostgreSQL qua Prisma repository. Không triển khai đăng ký/phân công, duyệt đề cương, hướng dẫn, bảo vệ hoặc chấm điểm. Sáu giai đoạn là kế hoạch và cửa sổ dùng chung để các module sau kết nối.

## API hiện có

Base `/api`; tất cả endpoint yêu cầu Bearer JWT, tài khoản hoạt động và đã hoàn tất đổi mật khẩu bắt buộc. Response `{success:true,data,timestamp}`. `term:read` được cấp cho năm vai trò trong seed; quyền ghi chỉ Admin/Giáo vụ theo RBAC.

| Method/path                       | Quyền             | Input / kết quả                                                                                                              |
| --------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| GET `/semesters`                  | `term:read`       | Query `academicYear?,search?`; trả mảng lookup kỳ học                                                                        |
| POST `/semesters`                 | `term:create`     | `{academicYear:'2026-2027',semester:1..3,name?,startDate,endDate}`                                                           |
| GET `/terms`                      | `term:read`       | Query `page=1,pageSize=10,search?,status?,semesterId?,trainingSystemId?,academicYear?`; `limit` là alias pageSize; tối đa100 |
| GET `/terms/latest`               | `term:read`       | Bắt buộc `semesterId` **và** `trainingSystemId`; chỉ lấy mới nhất trong đúng hai chiều này                                   |
| GET `/terms/:id`                  | `term:read`       | Chi tiết đợt, sáu giai đoạn, roster, quota, tham số                                                                          |
| POST `/terms`                     | `term:create`     | `{code,name,semesterId,trainingSystemId,startDate,endDate,registrationStart?,registrationEnd?}`                              |
| PATCH `/terms/:id`                | `term:update`     | Các trường POST dạng tùy chọn; mốc đăng ký chỉ thay đổi trước khi đóng đăng ký                                               |
| PATCH `/terms/:id/status`         | `term:transition` | `{status}`; kiểm chuỗi trạng thái và tiền điều kiện                                                                          |
| PATCH `/terms/:id/lock`           | `term:lock`       | `{locked:boolean}`; thao tác khóa/mở rõ giá trị, có audit                                                                    |
| PUT `/terms/:id/phases`           | `term:plan`       | `{phases:[{id?,code,name,start,end,locked}]}`; đúng sáu mã bên dưới                                                          |
| PUT `/terms/:id/parameters`       | `term:parameters` | `{parameters:Record<string,number>}`; merge với cấu hình hiện tại và kiểm tính hợp lệ                                        |
| PUT `/terms/:id/roster`           | `term:roster`     | `{studentIds:string[],lecturers:[{lecturerId,quota}]}`; thay danh sách có kiểm tham chiếu                                    |
| GET `/terms/:id/operation-window` | `term:read`       | Query `phaseCode`; clock và quyết định quyền ghi do server tính                                                              |

GET `/terms` trả `data:{items,total,page,pageSize,totalPages}`. Các endpoint chi tiết/ghi trả đối tượng đợt:

```ts
{
  id, code, name, semesterId, academicYear, semester, semesterNumber,
  trainingSystemId, program,
  start, end, // YYYY-MM-DD theo Asia/Ho_Chi_Minh
  startDate, endDate, // ISO8601 tuyệt đối
  status, locked, registrationStart, registrationEnd,
  phases: [{id, code, name, start, end, locked}],
  parameters: Record<string,number>, studentIds,
  lecturers: [{lecturerId, quota, officialCount}],
  assignmentPublished, resultsPublished, createdAt, updatedAt
}
```

`assignmentPublished`, `resultsPublished` và `officialCount` chỉ đọc từ dữ liệu đã có; module term không tạo/công bố dữ liệu các phân hệ sau. Không nhận các trường này từ request. Không có DELETE trong phạm vi bàn giao.

## Ràng buộc được kiểm

- Request thời gian là ISO8601 có offset hoặc `Z`; database lưu `timestamptz`. Khoảng thao tác dùng cận trên loại trừ: `start <= serverNow < end`. Đợt nằm trong kỳ học; các giai đoạn nằm trong đợt, đúng thứ tự và không chồng lấn. Sáu mã: `REGISTRATION`, `ASSIGNMENT`, `PROPOSAL`, `WEEKLY`, `FINAL`, `DEFENSE`.
- Tạo đợt sinh đủ sáu giai đoạn tuần tự và tham số mặc định. Hai mốc đăng ký khi tạo phải cùng được nhập hoặc cùng bỏ trống; thay kế hoạch qua PUT để điều chỉnh chính xác. Cửa sổ đăng ký không được chiếm hết đợt vì các giai đoạn sau phải có thời gian dương.
- Không mở đăng ký khi thiếu sinh viên, quota dương, kế hoạch, hướng chuyên môn, hoặc danh sách học vụ không còn hợp lệ. Mở lại sau khi đóng chỉ được khi chưa có phân công chính thức. Chuyển thực hiện cần phân công chính thức; hoàn thành cần kết quả đã công bố.
- Roster không nhận ID trùng/không tồn tại; sinh viên cần hoạt động, đúng hệ, đủ GPA và `academicEligible`. Giảng viên cần hoạt động và có hướng chuyên môn. Quota là số nguyên0–500; không giảm dưới tải phân công chính thức, không loại GV/SV đang có phân công hoặc SV có đăng ký còn hiệu lực.
- Tổng hai trọng số HP bằng1; tổng hai trọng số QT bằng1; tỷ lệ0–1, ngưỡng đạt0–10, GPA0–4 và tối đa1–3 nguyện vọng. Không tăng ngưỡng GPA vượt roster hiện có hoặc sửa cấu hình sau công bố kết quả.
- Khóa đợt chặn mọi ghi nghiệp vụ, ngoại trừ thao tác mở khóa rõ ràng có audit. Đợt hoàn thành/hủy không chỉnh cấu hình được. Mọi mutation dùng transaction `Serializable` và ghi audit cùng transaction; lỗi rollback không để lại audit thành công. Tranh chấp đồng thời trả409 để tải lại.

`TermWindowService.getWindow(termId,phaseCode,at?,transaction?)` trả `{phaseCode,status,serverNow,startAt,endAt,locked,canWrite,reason}`; `requireOpen(...)` từ chối khi cửa sổ đóng. Các service nghiệp vụ sau phải gọi lại kiểm tra trong transaction, không tin clock hoặc trạng thái disable nút từ frontend.

## Kiểm chứng đã chạy

Ngày 23/10/2026, API `127.0.0.1:3010`, PostgreSQL local port54339:

```powershell
cd backend
npm run type-check
npm test -- src/term/service/term-lifecycle.service.spec.ts
npm run test:integration
```

- TypeScript toàn backend: exit0.
- Riêng module term: 15 unit/service/permission/validator/window tests PASS.
- Riêng module term: 4 integration tests dùng HTTP thật và PostgreSQL PASS. Bao phủ đọc theo bốn vai trò,401/403, tạo kỳ/đợt, duplicate409, latest có cả kỳ+hệ, items/pageSize, mở khi thiếu roster, lỗi overlap không thêm audit, khóa đợt và quota thấp hơn phân công chính thức không thay dữ liệu. Wrapper `test:integration` chạy thêm các spec tích hợp của phân hệ khác; số lượng tổng đọc từ log chạy tương ứng.
- Các fixture integration có UUID/mã riêng, được dọn đúng ID của test; không sửa seed, migration hoặc tài khoản có sẵn. `npm test` mặc định loại integration; `npm run test:integration` tự đặt `GPMS_INTEGRATION=1` và `RUN_TERM_DB_TESTS=1` để chạy các spec tích hợp khi PostgreSQL/API đã sẵn sàng.

Chưa kiểm chứng bằng test tải lớn hoặc mô phỏng nhiều request đồng thời. Không suy từ các kiểm tra này rằng backend Bước2–10 đã được triển khai.
