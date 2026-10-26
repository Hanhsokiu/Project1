# Hợp đồng API thực tế — backend Bước 1

Đối chiếu mã nguồn ngày 23/10/2026: controller/DTO/service auth, catalog, import, term; `common/swagger/step1-document.ts` và `shared/src/step1.ts`. Đây là hợp đồng đang được mount trong `AppModule`, không phải danh sách API dự kiến cho toàn bộ đồ án. Backend Bước 1 của người yêu cầu gồm auth cần thiết, danh mục, kỳ/đợt, kế hoạch sáu giai đoạn, roster/quota và import SV đủ điều kiện.

Base local: `http://127.0.0.1:3010/api`; Swagger: `/api/docs`, JSON: `/api/docs-json`. Trừ login/refresh/health, request cần `Authorization: Bearer <accessToken>`. Server tải lại trạng thái tài khoản, session và quyền từ DB. Tài khoản khóa, token/session hết hạn hoặc đã logout bị từ chối. Khi `mustChangePassword=true`, chỉ me/change-password/logout được dùng với access token; nghiệp vụ và profile bị403 cho đến khi đổi mật khẩu.

## Response, phân trang và lỗi

```ts
type Success<T> = {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
};
type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
type Failure = {
  success: false;
  data: null;
  error: {
    code: string;
    message: string;
    fields?: { path: string; message: string }[];
    details?: Record<string, unknown>;
  };
  message: string;
  timestamp: string;
  path: string;
};
```

POST thành công mặc định201; GET/PATCH/PUT200. Ngoại lệ tải template trả binary và header đúng định dạng. Ba danh sách `/students`, `/lecturers`, `/terms` trả `Success<Page<T>>`; mặc định `page=1,pageSize=10`, tối đa100, chấp nhận alias `limit`. Lookup danh mục/kỳ trả mảng, không bọc Page. Mã SV/GV luôn là chuỗi giữ số0 đầu. Thời gian request ISO8601 có offset/Z; phase response ISO; `term.start/end` là ngày Việt Nam. Không dùng `data.data` thay `data.items` khi đọc Page.

| HTTP | Trường hợp / code tiêu biểu                                                                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400  | JSON/query/UUID/tệp hoặc mode không hợp lệ; `VALIDATION_ERROR`, catalog có `VALIDATION_FAILED`, đổi mật khẩu có `PASSWORD_POLICY_VIOLATED`                        |
| 401  | Login sai, tài khoản không hoạt động, token/session không hợp lệ; `UNAUTHENTICATED`                                                                               |
| 403  | Thiếu permission (`AUTH_004`) hoặc chưa đổi mật khẩu (`PASSWORD_CHANGE_REQUIRED`)                                                                                 |
| 404  | Không có thực thể/job; `NOT_FOUND`                                                                                                                                |
| 409  | Mã/email trùng, liên kết đang dùng, trạng thái hoặc khóa; `DUPLICATE`, `REFERENCE_IN_USE`, `CONCURRENT_UPDATE`, `TERM_001`, `TERM_003`, `REG_003` hoặc `CONFLICT` |
| 413  | Multipart vượt5MB; `FILE_TOO_LARGE`                                                                                                                               |
| 422  | Chưa đủ điều kiện/cấu hình; `COMMON_003`, `TERM_002`, `IMPORT_HAS_ERRORS` hoặc `HTTP_ERROR` tùy đường kiểm                                                        |

Không giả định mọi lỗi400/422 có cùng code hoặc có lỗi từng field. Auth/term và lỗi field catalog được chuẩn hóa về `error.fields:[{path,message}]`; `error.details` giữ dữ liệu nghiệp vụ tùy chọn, ví dụ `{invalidRows:number}` khi confirm STRICT trả `IMPORT_HAS_ERRORS`. Lỗi chi tiết từng dòng import vẫn đọc từ `job.rows[].errors`.

## Auth và hồ sơ

| Method/path                  | Request                     | `data` trả về                                                  |
| ---------------------------- | --------------------------- | -------------------------------------------------------------- |
| POST `/auth/login`           | `{username,password}`       | `{accessToken,refreshToken,user:Account}`                      |
| GET `/auth/me`               | —                           | `Account` hiện tại                                             |
| POST `/auth/refresh`         | `{refreshToken}`            | `{accessToken,user:Account}`; không trả refreshToken mới       |
| POST `/auth/change-password` | `{oldPassword,newPassword}` | `Account` đã bỏ cờ bắt buộc đổi; các phiên khác bị revoke      |
| PATCH `/auth/profile`        | `{name,email?,phone?}`      | `Account`; cập nhật liên hệ chính chủ và hồ sơ SV/GV tương ứng |
| POST `/auth/logout`          | Không cần body              | `{loggedOut:true}`; revoke session của access token            |
| GET `/health`                | Public                      | `{status:'ok',scope:'step-1',serverTime}`                      |

`Account={id,username,name,email:string|null,phone,roles:string[],permissions:string[],mustChangePassword,locked,studentId?,lecturerId?,student?,lecturer?}`. Không trả password/hash/token session trong Account. `student`/`lecturer` là bản tóm tắt danh tính có code, tên, liên hệ và hệ/hướng/quota thích hợp, không phải toàn bộ danh sách của Khoa.

Tên hồ sơ3–200 ký tự. Email được bỏ qua/null/chuỗi rỗng; phone được bỏ qua/chuỗi rỗng hoặc số Việt Nam hợp lệ. Giá trị liên hệ trống hiện **giữ dữ liệu đã có**, không phải yêu cầu xóa contact. Mật khẩu mới8–128 ký tự, có hoa/thường/số/ký tự đặc biệt và khác mật khẩu cũ. DTO auth nhận trường dư sẽ bị400. Profile không cho client đổi role, GPA, mã SV hoặc hệ đào tạo.

## Danh mục SV, GV và tham chiếu

Trong seed, A=Admin, K=Giáo vụ, G=GV, S=SV, H=thành viên HĐ. Permission là căn cứ thực tế; các nhãn role bên dưới mô tả cấp quyền mặc định.

| Method/path                                                | Permission / role mặc định  | Request / filter                                                                         |
| ---------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------- |
| GET `/students`; GET `/students/:id`                       | `student:read` / A,K        | Page: `search,termId,trainingSystemId,className,academicEligible,isActive,page,pageSize` |
| POST `/students`; PATCH `/students/:id`                    | `catalog:manage` / A,K      | StudentInput; PATCH các trường tùy chọn                                                  |
| GET `/lecturers`; GET `/lecturers/:id`                     | `lecturer:read` / A,K,G,S,H | Page: `search,termId,departmentId,researchAreaId,isActive,page,pageSize`                 |
| POST `/lecturers`                                          | `catalog:manage` / A,K      | LecturerInput                                                                            |
| PATCH `/lecturers/:id`                                     | `lecturer:update` / A,K     | Các trường LecturerInput tùy chọn                                                        |
| GET `/departments`, `/training-systems`, `/research-areas` | `catalog:read` / A,K,G,S,H  | Mảng lookup; chưa có paging/filter riêng                                                 |
| POST các path tham chiếu trên; PATCH `/:id`                | `catalog:manage` / A,K      | Bộ môn/hệ `{code,name}`; hướng `{name,description?}`                                     |

Boolean filter là chuỗi query `true`/`false`. SV tìm tên/mã/email, lớp lọc khớp chính xác; GV tìm tên/mã. `termId` lọc người đã được thêm vào roster đợt, không tự suy từ hệ hoặc học kỳ.

```ts
type StudentInput = {
  studentCode: string;
  fullName: string;
  className: string;
  trainingSystemId: string;
  gpa: number;
  cohort?: string;
  academicEligible?: boolean;
  isActive?: boolean;
  email?: string | null;
  phone?: string | null;
};
type LecturerInput = {
  lecturerCode: string;
  fullName: string;
  departmentId: string;
  researchAreaIds: string[];
  titleId?: string | null;
  maxStudents?: number;
  isActive?: boolean;
  email?: string | null;
  phone?: string | null;
};
```

GPA đầu vào bắt buộc từ 0–4; không nhận ô trống/null thành 0. Hồ sơ legacy có thể trả `gpa: null`; UI giữ trạng thái thiếu và không đủ điều kiện, kể cả ngưỡng bằng 0. `researchAreaIds` cần ít nhất một hướng khác nhau và tồn tại. `maxStudents` nguyên 0–100, mặc định 5, là quota mặc định của GV; quota thực tế thuộc từng TermLecturer. Student response thêm `{id,userId,trainingSystem,termIds,createdAt,updatedAt}` vào hồ sơ; Lecturer response thêm `{id,userId,department,title,researchAreas,researchAreaIds,createdAt,updatedAt}`. Không trả password/hash.

Tạo SV/GV tạo tài khoản với username theo mã, role tương ứng và `mustChangePassword=true`: mật khẩu SV là mã SV, GV là `Default@2026`. PATCH không reset mật khẩu. Chặn email/mã trùng và tham chiếu không tồn tại; không đổi hệ của SV đang thuộc đợt hệ khác, không ngưng hoạt động GV đang có phân công. Catalog loại bỏ trường ngoài schema; DTO auth/term từ chối trường dư. Không có DELETE trong phạm vi này.

## Kỳ học, đợt, kế hoạch và roster

Hợp đồng chi tiết, ví dụ response và cửa sổ clock server: [term-step1.md](term-step1.md).

| Nhóm endpoint thực tế                                                                    | Quyền                                                        |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| GET `/semesters`, `/terms`, `/terms/latest`, `/terms/:id`, `/terms/:id/operation-window` | `term:read` / cả năm role                                    |
| POST `/semesters`, `/terms`                                                              | `term:create` / A,K                                          |
| PATCH `/terms/:id`, `/:id/status`, `/:id/lock`                                           | lần lượt `term:update`, `term:transition`, `term:lock` / A,K |
| PUT `/terms/:id/phases`, `/:id/parameters`, `/:id/roster`                                | lần lượt `term:plan`, `term:parameters`, `term:roster` / A,K |

Kỳ học POST `{academicYear:'2026-2027',semester:1|2|3,name?,startDate,endDate}`. Tạo đợt `{code,name,semesterId,trainingSystemId,startDate,endDate,registrationStart?,registrationEnd?}`; PATCH cùng trường dạng tùy chọn. GET terms lọc `search,status,semesterId,trainingSystemId,academicYear` và Page; latest **bắt buộc cả kỳ và hệ**. Response gồm ID/nhãn kỳ/hệ, status/locked, mốc ISO, phases, parameters, studentIds và `lecturers:[{lecturerId,quota,officialCount}]`.

Status: `DRAFT→OPEN_REGISTRATION→CLOSED_REGISTRATION→IN_PROGRESS→DEFENDING→COMPLETED`; có nhánh hủy và mở lại đăng ký khi chưa công bố phân công. Trạng thái chỉ chuyển qua endpoint status, không gửi trong PATCH thông tin. Roster PUT `{studentIds,lecturers:[{lecturerId,quota}]}` kiểm đúng hệ, học vụ, GPA, ID trùng và quota không thấp hơn tải chính thức. Thay roster không được loại người đang có phân công chính thức hoặc SV có đăng ký còn hiệu lực.

Plan PUT nhận đúng sáu mã `REGISTRATION/ASSIGNMENT/PROPOSAL/WEEKLY/FINAL/DEFENSE` cùng `{id?,code,name,start,end,locked}`, tuần tự, không overlap và nằm trong đợt. Operation-window chỉ đọc `{phaseCode,status,serverNow,startAt,endAt,locked,canWrite,reason}` với khoảng `[start,end)`; không triển khai nghiệp vụ các bước sau. Cờ assignmentPublished/resultsPublished/officialCount là dữ liệu đọc, không phải lệnh phân công/chấm điểm. Mutation term dùng Serializable và audit cùng transaction.

## Import SV đủ điều kiện

Tất cả endpoint sau cần `student:import` / A,K; không có API import GV trong phạm vi hiện tại.

| Method/path                                       | Request / response                                                                                    |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| GET `/imports/students/template?format=csv\|xlsx` | Binary CSV UTF8 BOM hoặc workbook XLSX; mặc định csv                                                  |
| POST `/imports/students/preview`                  | `multipart/form-data`: `termId` UUID và `file`; trả ImportJob, chưa tạo tài khoản/SV                  |
| GET `/imports/:id`                                | ImportJob theo UUID; chưa có endpoint list job/phân trang                                             |
| POST `/imports/:id/confirm`                       | JSON `{mode:'STRICT'\|'VALID_ONLY'}`; trả ImportJob đã xác nhận hoặc kết quả trước nếu job đã confirm |

```ts
type ImportJob = {
  id: string;
  termId: string | null;
  fileName: string;
  status: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  successRows: number;
  errorRows: number;
  skippedRows: number;
  createdAt: string;
  confirmedAt: string | null;
  mode: "STRICT" | "VALID_ONLY" | null;
  canConfirm: boolean;
  rows: {
    rowNumber: number;
    values: {
      studentCode: string;
      fullName: string;
      className: string;
      cohort: string;
      trainingSystemCode: string;
      gpa: number | null;
      email: string | null;
      phone: string | null;
      academicEligible: boolean;
    };
    action: "CREATE" | "UPDATE" | "SKIP" | "ERROR";
    status: "VALID" | "ERROR" | "IMPORTED" | "SKIPPED";
    errors: { field: string; code: string; message: string }[];
    studentId?: string;
  }[];
};
```

Tối đa5MB,1000 dòng dữ liệu; XLSX tối đa30 cột. Tên cột mẫu: `studentCode,fullName,className,cohort,trainingSystemCode,gpa,email,phone,academicEligible`; bốn cột bắt buộc là studentCode/fullName/className/gpa. Chỉ CSV UTF8 hoặc XLSX; XLSX mã SV kiểu numeric bị lỗi để bảo toàn số0. GPA bắt buộc và đạt ngưỡng đợt; học vụ phải đủ; hệ trống dùng hệ đợt, hệ khác bị lỗi. Email/SĐT có thể trống, không sinh email giả. `rowNumber` giữ tọa độ dòng nguồn, kể cả CSV có ô nhiều dòng.

Đợt đích chỉ `DRAFT` hoặc `OPEN_REGISTRATION`, chưa khóa và đã cấu hình hệ. Preview tạo job `VALIDATED`, từng dòng giữ lỗi và action. STRICT có bất kỳ dòng lỗi sẽ422, không ghi dòng nào; VALID_ONLY nhập riêng dòng hợp lệ trong transaction. Sau confirm `DONE` hoặc `PARTIAL` nếu còn dòng lỗi. Dòng đã thuộc đợt là SKIP; SV cũ chưa thuộc đợt được reuse và không reset mật khẩu/không ghi đè liên hệ bằng ô trống. Confirm kiểm lại điều kiện và có retry tranh chấp Serializable; xác nhận lại cùng job không tạo SV/tài khoản trùng.

## Điểm bàn giao và giới hạn

Backend Bước 1 của người yêu cầu ghi thật auth, danh mục, kỳ/đợt, kế hoạch, roster/quota, import SV và audit các thao tác đó. Frontend chọn từng adapter bằng `VITE_AUTH_API`, `VITE_TERM_API`, `VITE_CATALOG_API`, `VITE_IMPORT_API`; không âm thầm fallback mock khi API lỗi.

Đăng ký, tính/chỉnh/công bố phân công, thông báo/email, đề tài/đề cương/PDF, admin tài khoản/role/audit UI và import GV vẫn là mock hoặc chưa có endpoint mounted trong lần này. Bước4–10 thuộc thành viên khác, chưa triển khai backend; có Prisma model hoặc file module không có nghĩa API đã hoạt động. Không dùng hợp đồng dự kiến toàn hệ thống để tuyên bố backend các phần này đã hoàn thành.

Chạy kiểm tra từ `backend`: `npm test` (unit), `npm run test:integration` (PostgreSQL và API cần chạy), `npm run test:http` (luồng HTTP). Kết quả thực và cách chạy xem [bàn giao backend Bước1](../implementation/backend-step1.md); tài liệu hợp đồng này không tự là bằng chứng đã chạy test.

Nguồn chuẩn để đối chiếu khi thay adapter: [auth DTO](../../backend/src/auth/dto/auth.dto.ts), [Account mapper](../../backend/src/auth/mapper/account.mapper.ts), [catalog DTO](../../backend/src/catalog/dto/catalog.dto.ts), [catalog filter](../../backend/src/catalog/validator/catalog.validator.ts), [import job service](../../backend/src/catalog/service/import.service.ts), [term DTO](../../backend/src/term/dto/term.dto.ts), [schema public dùng chung](../../shared/src/step1.ts).
