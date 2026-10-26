# Hợp đồng API — Bước 1 đã triển khai; Bước 2–3 dự kiến

**Cập nhật 23/10/2026:** backend auth cần thiết/catalog/term/import của Bước 1 đã được triển khai và frontend chuyển sang API theo từng adapter. Hợp đồng đang chạy xem [bàn giao backend Bước 1](../implementation/backend-step1.md), [term API](../api/term-step1.md) và [OpenAPI](../api/openapi.yaml). Các phát biểu “backend giữ nguyên” dưới đây là lịch sử khảo sát giai đoạn frontend, không còn mô tả trạng thái hiện tại. Phần đăng ký/phân công/đề cương và các bước sau vẫn là hợp đồng dự kiến/mock, chưa triển khai backend nghiệp vụ.

Ngày: 22/10/2026. **Phạm vi bàn giao frontend hiện tại chỉ gồm đăng nhập/auth và Bước 1–3**, theo yêu cầu thu hẹp mới nhất: danh mục cần thiết → kỳ/đợt/kế hoạch/roster → đăng ký nguyện vọng → phân công/công bố/thông báo → thống nhất đề tài, đề cương và PDF cuối Bước 3. Không triển khai backend nghiệp vụ; mã nguồn backend giữ nguyên. Đây là hợp đồng **dự kiến**, không phải danh sách endpoint backend đã hoàn thành hoặc bằng chứng đã kiểm thử.

Các mục 3–7 mô tả hợp đồng phục vụ phạm vi đang bàn giao. Các mục 8–12 và phần báo cáo nghiệp vụ sau Bước 3 trong mục 13 được giữ làm **tham khảo ngoài phạm vi**, chưa là cam kết hoàn thiện frontend hoặc backend lần này. File nguồn của các phân hệ ngoài phạm vi nếu còn trong repository không đồng nghĩa có route/menu đang hoạt động. Tên thành viên chưa được cung cấp nên dùng nhóm sở hữu để nhóm dự án gán người cụ thể.

## 1. Phân nhóm và điểm bàn giao

| Nhóm phụ trách | Module / UC | Điểm bàn giao |
| --- | --- | --- |
| **Nhóm của người yêu cầu – backend Bước 1–3** | auth/catalog/term/registration/assignment/notification cần thiết; UC01, UC04–12; phần UC02–03 hỗ trợ và PDF đề cương UC25 | Danh tính/roster/đợt; phân công chính thức đã công bố; topic GVHD thống nhất; ProposalVersion SUBMITTED; file PDF đúng version |
| Thành viên nền hệ thống (có thể cùng nhóm Bước1–3) | UC02–03 đầy đủ, RBAC/audit | User/role/permission; phạm vi dữ liệu; audit dùng chung |
| **Thành viên duyệt đề cương — ngoài phạm vi** | ReviewGroup/Review/ThesisDossier; UC13 | Tham khảo: Proposal APPROVED, hồ sơ chốt; nhận SUBMITTED từ nhóm Bước1–3 |
| **Thành viên hướng dẫn — ngoài phạm vi** | UC14–17 | Tham khảo: nhiệm vụ/submission/review/meeting/evaluation; FinalReport; DefenseConfirmation |
| **Thành viên tổ chức bảo vệ — ngoài phạm vi** | UC18–21 | Tham khảo: eligibility/deferment/committee/reviewer/session/minutes; hồ sơ và lịch đã công bố |
| **Thành viên chấm điểm/kết quả — ngoài phạm vi** | UC22–24, rubric | Tham khảo: điểm nháp/gửi/chốt; snapshot kết quả; công bố; yêu cầu sửa sau bảo vệ |
| **Thành viên báo cáo — ngoài phạm vi sau Bước3** | UC25 ngoài PDF đề cương bước3 | Tham khảo: thống kê bảo vệ/kết quả, export PDF/Excel và hàng đợi; dùng dữ liệu module chủ sở hữu |

Auth/shared/migration do một đầu mối tích hợp; mỗi nhóm không tự tạo User/Student/Term khác nhau. Backend UC13–25 tiếp tục thuộc thành viên khác; các mô tả tham khảo bên dưới không mở rộng phạm vi frontend hiện tại.

## 2. Quy ước chung

Base URL thật dự kiến `/api`; Axios hiện có `VITE_API_URL || '/api'`. UUID là string; mã SV/GV là string giữ số 0; DateTime ISO8601 có offset/UTC; UI hiển thị Asia/Ho_Chi_Minh. `academicYear` ví dụ `2026-2027`, semester 1/2/3; TrainingSystem CQ/LT/TX là danh mục, degreeType BACHELOR/ENGINEER độc lập.

```ts
type ID = string;
type Role = 'ADMIN' | 'FACULTY' | 'LECTURER' | 'STUDENT' | 'COMMITTEE';
interface ApiResponse<T> {
  success: true; data: T; message?: string; timestamp: string;
}
interface PageResponse<T> {
  data: T[]; total: number; page: number; limit: number; totalPages: number;
}
interface Query {
  page?: number; limit?: number; search?: string;
  sortBy?: string; sortOrder?: 'asc' | 'desc';
}
interface ApiError {
  success: false; data: null;
  error: { code: string; message: string;
    fieldErrors?: Record<string, string[]>;
    details?: Record<string, unknown>; traceId?: string };
  timestamp: string; path?: string;
}
```

Danh sách trả `ApiResponse<PageResponse<T>>` (page mặc định1, limit10, tối đa100; page rỗng vẫn totalPages theo total); lookup nhỏ trả `ApiResponse<T[]>`. Detail/mutation trả `ApiResponse<T>`. Lỗi: 400 validation, 401 cần login/token, 403 thiếu quyền hoặc ownership, 404 không có, 409 trùng/xung đột/stale/locked, 422 điều kiện nghiệp vụ chưa đủ, 413 file lớn, 415 sai MIME. Field errors dùng path như `preferences.1.lecturerId`. Các endpoint file trả binary + Content-Type đúng và `Content-Disposition: attachment; filename*=UTF-8''...`.

Client kiểm tra biểu mẫu để có phản hồi nhanh, server kiểm lại role/permission/ownership/mốc thời gian/trạng thái. Quyền `resource:action` ánh xạ decorator hiện tại `@RequirePermission(resource, action)`; token không thay cho ownership. StudentId/scorerId cho thao tác cá nhân suy từ session; không tin ID client để cho phép thao tác hồ sơ khác.

Mutation quan trọng nhận `expectedVersion` hoặc `If-Match` và trả `version`; xung đột409 trả `currentVersion`. Publish/finalize/import commit/export create hỗ trợ `Idempotency-Key`. Audit ghi actor, thời gian, resource, before/after, reason; không ghi mật khẩu/token. Các sự kiện phát sau commit; email thất bại không rollback phân công chính thức.

Mock hiện tại và HTTP adapter nên cùng một interface theo module; hooks sử dụng interface, không import seed trực tiếp trong page. Sau mutation invalidate query theo module + termStudent/proposal liên quan. Không bật HTTP mode cho một module khi backend chưa trả được toàn hợp đồng; có thể thay từng service riêng.

### Lỗi nghiệp vụ dùng chung

| Code giữ theo backend nếu có | Ý nghĩa | UI |
| --- | --- | --- |
| AUTH_001 / AUTH_002 / AUTH_003 / AUTH_004 / AUTH_005 | Sai login/khóa/token/quyền/chính sách mật khẩu | Message chung login, onboarding/forbidden/validation |
| AUTH_PASSWORD_CHANGE_REQUIRED / AUTH_CONTACT_INCOMPLETE | Mã mở rộng dự kiến: chưa đổi mật khẩu/thiếu liên hệ | Điều hướng đúng bước hoàn tất hồ sơ |
| TERM_001 / TERM_002 / TERM_003 | Chuyển trạng thái sai/mốc mâu thuẫn/khóa | Nêu mục chưa đạt hoặc cửa sổ thao tác |
| REG_001 / REG_002 / REG_003 / REG_004 | Hết hạn/GPA thấp/quota/NV không hợp lệ | Gắn field hoặc row cụ thể |
| TOPIC_001 / TOPIC_002 | Hồ sơ thiếu/yêu cầu sửa thiếu nhận xét | Field errors/comment |
| DEF_001 / DEF_002 / DEF_003 | GVPB=GVHD/xung đột HĐ/trùng lịch | Danh sách cặp xung đột và cách điều chỉnh |
| GRADE_001 / GRADE_002 / GRADE_003 | Điểm ngoài max/thiếu/đã khóa | Không chốt, chỉ rõ thành phần thiếu |
| COMMON_001 / COMMON_002 / COMMON_003 | Không có/trùng/validation | 404 hoặc form |
| STALE_VERSION / PLAN_STALE / FILE_INVALID / EXPORT_EMPTY | Mã mở rộng dự kiến | Reload/compute lại/sửa file/đổi filter |

### DTO dùng chung

```ts
interface FileRef {
  id: ID; fileName: string; mimeType: string; size: number;
  downloadUrl: string; uploadedAt: string; uploadedBy: ID;
}
interface Identity {
  id: ID; username: string; fullName: string; email: string | null;
  phone: string | null; roles: Role[]; permissions: string[];
  studentId?: ID; lecturerId?: ID; mustChangePassword: boolean;
  status: 'ACTIVE' | 'LOCKED' | 'PENDING_ACTIVATION';
}
interface Scope {
  termId: ID; termStudentId: ID; studentId: ID;
  registrationId?: ID; topicId?: ID; proposalId?: ID;
}
interface PhaseAccess {
  code: string; startAt: string; endAt: string; isLocked: boolean;
  canWrite: boolean; reason?: string; serverNow: string;
}
```

Mọi response đối tượng nghiệp vụ đính kèm `id`, `version`, `createdAt`, `updatedAt` khi thích hợp; trường tóm tắt liên quan có `id/code/fullName` để render và deep-link. Các DTO chi tiết dưới đây bổ sung các trường ấy.

## 3. Auth, profile, tài khoản, RBAC, audit

Chủ sở hữu: nhóm Bước1–3 cho nền auth/profile; thành viên nền cho quản trị đầy đủ. Mục đích: xác thực/onboarding và phân quyền năm role, nhiều vai trò trên một giảng viên.

| Method/path dự kiến | Request | Response data | Role / điều kiện |
| --- | --- | --- | --- |
| POST `/auth/login` | `{username,password}` | `{accessToken,refreshToken,expiresIn,user:Identity}` | Public, ACTIVE; thông báo sai chung |
| GET `/auth/me` | — | `Identity` + phiên bản quyền | Login, cho onboarding |
| POST `/auth/refresh` | `{refreshToken}` | Token pair mới + user | Public, session chưa revoke |
| POST `/auth/logout` | `{refreshToken}` | `{revoked:true}` | Login/onboarding |
| POST `/auth/change-password` | `{oldPassword,newPassword}` | `{mustChangePassword:false}` | Chính chủ; >=8, hoa/thường/số/đặc biệt theo validator |
| PATCH `/auth/profile` | `{fullName?,email,phone}` | `Identity` + contactComplete | Chính chủ; SV không sửa mã/GPA/hệ/điều kiện |
| GET `/accounts` | Query + `role,status` | Page `<Identity>` | A |
| POST `/accounts` | `{username,fullName,email?,roles,studentId?,lecturerId?}` | Identity, onboarding flags | A; password mặc định qua kênh được quy định |
| PATCH `/accounts/:id` | `{roles?,status?,email?,expectedVersion,reason}` | Identity | A; chặn mất Admin cuối |
| POST `/accounts/:id/reset-password` | `{reason}` | `{id,mustChangePassword:true,resetAt}` | A; không đưa plaintext password vào audit |
| GET `/roles`; GET `/permissions` | `search?` | Role/permission lookup | A; permissions dạng resource/action |
| PUT `/roles/:id/permissions` | `{permissionIds,expectedVersion,reason}` | Role + permissions + `effectiveFrom:'NEXT_LOGIN'` | A, audit |
| GET `/audit-logs` | Query + `from,to,actorId,action,resource,resourceId,termId` | Page `<AuditEvent>` | A/K trong phạm vi |
| GET `/audit-logs/:id` | — | `{actor,action,resource,before,after,reason,ipAddress,createdAt}` | A/K; read-only |

Trạng thái: account ACTIVE/LOCKED/PENDING_ACTIVATION; onboarding PASSWORD_REQUIRED → CONTACT_REQUIRED → COMPLETE. `mustChangePassword` cho phép me/change-password/profile tối thiểu/logout; nghiệp vụ khác403. Khóa/reset cần confirmation; tài khoản đang giữ nhiệm vụ có warnings trả từ service. Lỗi auth như bảng chung; duplicate username409, last admin409.

## 4. Catalog và import

Chủ sở hữu: nhóm Bước1–3. Mục đích: dữ liệu nhân sự/danh mục dùng xuyên suốt; không xóa cứng thực thể có tham chiếu.

```ts
interface Student {
 id: ID; userId: ID; studentCode: string; fullName: string;
 className: string; cohort: string; dateOfBirth?: string;
 trainingSystemId: ID; degreeType: 'BACHELOR' | 'ENGINEER';
 gpa: number | null; gpaScale: 4 | 10; email: string | null; phone: string | null;
 isActive: boolean;
}
interface Lecturer {
 id: ID; userId: ID; lecturerCode: string; fullName: string;
 departmentId: ID; titleId?: ID; organization: string;
 researchAreaIds: ID[]; maxStudents: number;
 email: string; phone: string; isActive: boolean;
}
interface CatalogItem { id: ID; code: string; name: string; description?: string; isActive: boolean }
interface ImportPreview {
 id: ID; type: 'STUDENT' | 'LECTURER'; termId?: ID;
 fileName: string; totalRows: number; validRows: number; invalidRows: number;
 duplicates: number; rows: Array<{rowNumber:number; data:Record<string,unknown>;
   action:'CREATE'|'UPDATE'|'SKIP'|'ERROR'; errors:Array<{field:string;message:string}>}>;
 expiresAt: string;
}
```

| Method/path | Request | Response data | Role |
| --- | --- | --- | --- |
| GET `/students` | Query + `termId,className,cohort,trainingSystemId,isActive,eligible` | Page `<Student>` | A/K; G/H scoped read |
| POST `/students`; PATCH `/students/:id` | Student mutable fields + expectedVersion on PATCH | Student | A/K |
| GET `/students/:id` | `termId?` | Student + scoped roster/proposal summary | A/K/G assigned/S own |
| GET `/lecturers` | Query + `departmentId,areaId,termId,isActive,availableOnly` | Page `<Lecturer & {quota?,assignedCount?}>` | A/K; scoped lookup S/G/H |
| POST `/lecturers`; PATCH `/lecturers/:id` | Lecturer mutable fields + version | Lecturer | A/K |
| PUT `/lecturers/:id/research-areas` | `{researchAreaIds,expectedVersion}` | Lecturer | A/K, hoặc G có quyền chuyên môn |
| GET/POST `/departments`, `/training-systems`, `/research-areas`, `/titles` | GET Query; POST CatalogItem fields | GET Page/lookup, POST item | Read scoped; write A/K |
| PATCH `/{catalog}/:id` | `{name?,description?,isActive?,expectedVersion}` | CatalogItem + warnings | A/K; referenced item chỉ ngưng sử dụng |
| GET `/imports/templates/:type` | `format=csv|xlsx` | File binary thật | A/K |
| POST `/imports/preview` | multipart `{file,type,termId?,duplicatePolicy:'SKIP'|'UPDATE'}` | ImportPreview | A/K |
| POST `/imports/:id/commit` | `{acceptValidOnly,expectedVersion}` + idempotency | ImportJob | A/K; preview còn hiệu lực |
| GET `/imports`; GET `/imports/:id` | List Query + `type,status,termId` | Page `<ImportJob>` / job + row errors | A/K |
| GET `/imports/:id/error-report` | — | CSV/XLSX lỗi đúng MIME | A/K |

ImportJob states QUEUED→PROCESSING→DONE/FAILED, có `totalRows/successRows/errorRows/errorReport`. CSV demo là file CSV thật UTF8 BOM; XLSX thật phải là workbook, không đổi đuôi CSV. Import kiểm mẫu/cột/GPA/thang/hệ/MSSV trùng trong file và đợt. SV mới có username=MSSV/mật khẩu mặc định tương ứng/mustChangePassword; SV cũ giữ password và liên hệ khi ô trống. Giảm quota dưới tải409; xóa hướng có đăng ký409; thiếu GV đúng hướng trả warning trước mở. API lỗi theo dòng không trộn với lỗi HTTP của toàn file.

## 5. Kỳ học, đợt, kế hoạch, roster, tham số

Chủ sở hữu: nhóm Bước1–3. Mục đích: scope và cửa sổ thao tác tất cả phân hệ.

```ts
interface Term {
 id: ID; code: string; name: string; academicYear: string; semester: number;
 trainingSystemId: ID; cohort: string; classNames: string[];
 startDate: string; endDate: string;
 status: 'DRAFT'|'OPEN_REGISTRATION'|'CLOSED_REGISTRATION'|'IN_PROGRESS'|'DEFENDING'|'COMPLETED'|'CANCELLED';
 phases: Array<PhaseAccess>; parameters: TermParameters;
}
interface TermParameters {
 processWeight: number; committeeWeight: number;
 advisorWeightInProcess: number; reviewerWeightInProcess: number;
 minPassScore: number; passingGpaThreshold: number;
 preferenceMin: number; preferenceMax: 3;
 assignmentPolicy: { priority:'PREFERENCE_ROUND'; tieBreak:string[]; fallback:'LOWEST_LOAD_RATIO' };
 committeeMin: number; committeeMax: number; maxFileSizeMb: number;
}
interface TermStudent {
 id: ID; termId: ID; studentId: ID; eligibility:'ELIGIBLE'|'INELIGIBLE'|'WITHDRAWN';
 academicVerified: boolean; academicSource?: string; reason?: string;
 gpaSnapshot: number | null; previousTermStudentId?: ID;
}
interface TermLecturer { termId:ID; lecturerId:ID; quota:number; researchAreaIds:ID[]; assignedCount:number }
```

| Method/path | Request | Response data | Role |
| --- | --- | --- | --- |
| GET `/terms` | Query + `academicYear,semester,trainingSystemId,status` | Page `<Term summary>` | Login scoped |
| POST `/terms`; PATCH `/terms/:id` | Code/name/year/semester/system/cohort/classes/start/end; version | Term | A/K |
| GET `/terms/:id` | — | Term + statistics/readiness/warnings | Login scoped |
| GET `/terms/:id/readiness` | — | `{ready,missing:[{code,label}],warnings}` | A/K |
| POST `/terms/:id/transition` | `{targetStatus,reason?,expectedVersion}` | Term | A/K, kiểm state machine |
| PUT `/terms/:id/phases` | `{phases:[{code,name,startAt,endAt,isLocked}],expectedVersion}` | PhaseAccess[] | A/K |
| POST `/terms/:id/phases/:code/lock` hoặc `/unlock` | `{reason,expectedVersion}` | PhaseAccess | A/K, confirm/audit |
| GET `/terms/:id/access/:phaseCode` | — | PhaseAccess | Scoped login; source server time |
| GET/PUT `/terms/:id/parameters` | PUT TermParameters + version | TermParameters + version | A/K; G/H read rubric/score weights |
| GET `/terms/:id/students` | Query + `className,eligibility,academicVerified` | Page `<TermStudent + Student>` | A/K |
| POST `/terms/:id/students` | `{studentIds,eligibility,reason?}` | `{added,skipped,rows}` | A/K |
| PATCH `/terms/:id/students/:id` | `{eligibility?,academicVerified?,academicSource?,reason,expectedVersion}` | TermStudent | A/K |
| GET `/terms/:id/lecturers` | Query + `areaId,departmentId` | Page `<TermLecturer + Lecturer>` | A/K; S/G read lookup |
| PUT `/terms/:id/lecturers/:lecturerId` | `{quota,researchAreaIds,expectedVersion}` | TermLecturer | A/K |

Phases đề xuất có code ổn định REGISTRATION/ASSIGNMENT/TOPIC/PROPOSAL/PROPOSAL_REVIEW/GUIDANCE/FINAL_REPORT/ELIGIBILITY/COMMITTEE/REVIEW/DEFENSE/PUBLICATION. Không cấm mọi phase giao nhau; chỉ validate phụ thuộc đã chốt và nằm trong đợt. Lỗi readiness422, invalid transition TERM001, overlap TERM002, locked TERM003. COMPLETED/CANCELLED chỉ xem; đóng đợt chặn nếu điểm/hồ sơ quan trọng chưa hoàn tất. Parameter snake_case trong DB map camelCase ở adapter; snapshot weights của kết quả không đổi khi sửa cấu hình sau chốt.

## 6. Đăng ký, phương án phân công, công bố, thông báo

Chủ sở hữu: nhóm Bước1–3. Mục đích: một hướng/1–3 NV theo đợt, phương án có giải thích và kết quả chính thức.

```ts
interface Registration {
 id:ID; termId:ID; termStudentId:ID; studentId:ID; researchAreaId:ID;
 preferences:Array<{lecturerId:ID;order:1|2|3}>; note?:string;
 status:'DRAFT'|'SUBMITTED'|'LOCKED'|'CANCELLED'; submittedAt?:string; version:number;
}
interface AssignmentPlan {
 id:ID; termId:ID; status:'DRAFT'|'FINALIZED'|'PUBLISHED'; version:number;
 inputVersion:string; isStale:boolean; policy:TermParameters['assignmentPolicy'];
 rows:Array<{registrationId:ID;termStudentId:ID;advisorId:ID|null;
   method:'NV1'|'NV2'|'NV3'|'AUTO_AREA'|'MANUAL'|'UNASSIGNED';
   locked:boolean; explanation:string; reason?:string}>;
 loads:Array<{lecturerId:ID;quota:number;assigned:number;ratio:number}>;
 statistics:Record<'NV1'|'NV2'|'NV3'|'AUTO_AREA'|'MANUAL'|'UNASSIGNED',number>;
 violations:Array<{code:string;studentId?:ID;lecturerId?:ID;message:string}>;
 publishedAt?:string;
}
```

| Method/path | Request | Response data | Role |
| --- | --- | --- | --- |
| GET `/registrations/me` | `termId` | `{registration:Registration|null,access:PhaseAccess,availableAreas,profileComplete}` | S own |
| PUT `/registrations/me` | `{termId,researchAreaId,preferences,note?,intent:'DRAFT'|'SUBMIT',expectedVersion?}` | Registration | S, checks roster/system/onboarding/phase |
| GET `/registrations/term/:termId` | Query + `areaId,status,lecturerId` | Page `<Registration + Student summary>` | A/K |
| GET `/assignment-plans` | Query + `termId,status` | Page `<AssignmentPlan summary>` | A/K |
| POST `/assignment-plans/preview` | `{termId,keepLockedManual:true,policy?,expectedInputVersion?}` | AssignmentPlan DRAFT; không publish/email | A/K, registrations đóng |
| GET `/assignment-plans/:id` | — | AssignmentPlan | A/K |
| PATCH `/assignment-plans/:id/rows/:registrationId` | `{advisorId,locked,reason,expectedVersion}` | Updated plan/load/violations | A/K, draft only |
| POST `/assignment-plans/:id/validate` | `{expectedVersion}` | `{valid,violations,isStale}` | A/K |
| POST `/assignment-plans/:id/finalize` | `{expectedVersion,reason?}` | Plan FINALIZED | A/K; không vi phạm/chưa phân/stale |
| POST `/assignment-plans/:id/publish` | `{expectedVersion}` + idempotency | `{plan,notificationJobs:[...]}` | A/K, finalized |
| GET `/assignments/me` | `termId` | `{published,assignment?,advisorContact?,studentContacts?}` | S own / G được giao; ẩn draft |
| GET `/assignments` | Query + `termId,advisorId,areaId` | Page `<OfficialAssignment>` | A/K; G own |
| GET `/notifications/me` | Query + `status,type,termId` | Page `<Notification>` | Chính chủ |
| PATCH `/notifications/:id/read` | — | Notification READ | Chính chủ |
| GET `/notification-jobs` | Query + `termId,type,status,recipientId` | Page `<DeliveryJob>` | A/K |
| POST `/notification-jobs/:id/retry` | `{reason?}` | DeliveryJob QUEUED | A/K, failed only |

Policy demo hiện thực: GPA giảm → mã SV khi GPA hòa; fallback đúng hướng theo ratio tải thấp/mã GV. Dữ liệu cộng tác đã xác minh chưa có trong adapter, nên không tự cộng điểm hoặc ưu tiên từ lời khai. Submit cần 1–3 NV; nháp cho trống và không ghi đè liên hệ hợp lệ bằng dữ liệu liên hệ chưa hoàn chỉnh. Hạn chỉ có ngày bao gồm hết ngày ở Việt Nam: `[startT00:00+07:00, (end+1 ngày)T00:00+07:00)`; hạn có DateTime dùng cận trên loại trừ. REG003/004 có details NV/lecturer/quota khi API thật hỗ trợ; chốt kiểm lại học vụ/hệ/hướng/quota và chặn còn SV chưa phân. Chạy thử chỉ đọc; lưu phương án nháp được tính lại, còn phương án chính thức không bị chạy lại ghi đè. Chính sách giữ manual locked qua lần tính lại là mở rộng của hợp đồng, chưa có trong adapter demo. Chốt+công bố có thể là một transaction/nút với hai hiệu ứng, nhưng trạng thái trả về phải rõ. Mỗi registration chỉ một official advisor trong đợt. DeliveryJob `QUEUED|SENDING|SENT|FAILED`, loại ADVISOR_ASSIGNMENT_PUBLISHED, unique theo publishEventId/lecturer/type; retry gửi thật không bảo đảm exactly-once SMTP.

## 7. Đề tài, đề cương và PDF cuối Bước3

Chủ sở hữu: nhóm Bước1–3 đến trạng thái SUBMITTED; nhận phản hồi/nộp lại qua cùng interface nhưng logic review thuộc thành viên UC13.

```ts
interface Topic {
 id:ID; termId:ID; termStudentId:ID; advisorId:ID; researchAreaId:ID;
 title:string; scope:string; description:string;
 status:'DRAFT'|'AGREED'|'LOCKED'; agreedBy?:ID; agreedAt?:string;
}
interface ProposalContent {
 objectives:string; scope:string; mainContent:string; technologies:string;
 expectedResults:string; startDate:string; endDate:string;
 plan:Array<{id:ID;order:number;work:string;startDate:string;endDate:string;note:string}>;
}
interface ProposalVersion {
 id:ID; proposalId:ID; version:number; content:ProposalContent;
 changeNote?:string; createdBy:ID; createdAt:string;
}
interface Proposal {
 id:ID; topicId:ID; termStudentId:ID;
 status:'DRAFT'|'SUBMITTED'|'UNDER_REVIEW'|'REVISION_REQUESTED'|'APPROVED'|'REJECTED';
 currentVersion:ProposalVersion; submittedVersionId?:ID;
 reviewSummary?:{decision:string;comment:string;reviewer:string;reviewedAt:string};
 dossierStatus:'DRAFT'|'LOCKED';
}
```

| Method/path | Request | Response data | Role |
| --- | --- | --- | --- |
| GET `/topics/me` | `termId`; G `termStudentId` | `{topic:Topic|null,assignment,proposalSummary?,access}` | S own/G advisor/K |
| PUT `/topics/me` | `{termId,termStudentId?,title,scope,description,researchAreaId,expectedVersion?}` | Topic | S own/G advisor, phase open |
| POST `/topics/:id/agree` | `{comment?,expectedVersion}` | Topic AGREED | GVHD chính thức |
| GET `/topics/:id/history` | Query | Page `<{actor,before,after,createdAt}>` | Own S/assigned G/K |
| GET `/proposals/:id`; GET `/proposals/me` | me `termId` | Proposal + Topic + identity/form context | S own/G advisor/K/review assigned |
| PUT `/proposals/:id/draft` | `{content:ProposalContent,changeNote?,expectedVersion}` | Proposal + new version | S own; G edit nếu quyền, phase open |
| POST `/proposals/:id/submit` | `{versionId,expectedVersion}` | Proposal SUBMITTED + submittedAt | S own; fields complete/topic AGREED |
| POST `/proposals/:id/withdraw` | `{reason,expectedVersion}` | Proposal DRAFT + version | S own nếu chưa khóa/review policy cho phép |
| GET `/proposals/:id/versions`; GET `/proposals/:id/versions/:versionId` | Query / — | Page versions / immutable version | Scoped roles |
| GET `/proposals/:id/versions/:versionId/preview` | `degreeType?` | `{html,templateCode,isOfficial,versionId}` | Scoped roles |
| GET `/proposals/:id/versions/:versionId/pdf` | `degreeType?` | Binary PDF thật | S own/G advisor/K/assigned review |

PDF lấy version cụ thể; đầy đủ fields mẫu Word, Unicode/font/bảng xuống trang, 4 vùng ký trống. Bản trước chốt có nhãn nháp/chưa phê duyệt. Không dùng HTML đổi đuôi PDF. Chọn mẫu bằng degreeType, không bằng trainingSystem. Ngoài TOPIC001/002, stale409/phase closed409/ownership403. Topic đã chốt không sửa trực tiếp. Proposal persistence phải theo termStudentId/đợt, thay unique studentId toàn cục hiện có khi backend được triển khai.

**Sự kiện bàn giao:** `assignment.published {eventId,termId,planId,publishedAt,assignments:[registrationId,termStudentId,studentId,advisorId]}` và `proposal.submitted {eventId,termId,termStudentId,proposalId,versionId,submittedAt}`. Event version1, phát sau commit; consumer idempotent theo eventId.

## 8. Tham khảo ngoài phạm vi: nhóm duyệt, duyệt đề cương và chốt hồ sơ

Chủ sở hữu: **thành viên UC13**. Mục đích: thẩm quyền duyệt cấp nhóm/Bộ môn/Khoa tách biệt thống nhất GVHD.

| Method/path | Request | Response data | Role |
| --- | --- | --- | --- |
| GET `/review-groups` | Query + `termId,departmentId` | Page `<ReviewGroup>` | K; G member |
| POST `/review-groups`; PATCH `/review-groups/:id` | `{termId,name,departmentId,researchAreaIds,lecturerIds,reviewStartAt,reviewEndAt,expectedVersion?}` | Group + members | K |
| POST `/review-groups/:id/assign` | `{proposalIds,versionIds?,expectedVersion}` | `{assigned,skipped,violations}` | K; proposals SUBMITTED |
| GET `/proposal-reviews` | Query + `termId,groupId,departmentId,status,overdue` | Page `<ReviewAssignment>` | K/G member own |
| GET `/proposal-reviews/:id` | — | Assignment + submitted version + history | K/G member |
| POST `/proposal-reviews/:id/start` | `{expectedVersion}` | Proposal UNDER_REVIEW | G assigned/K authorized |
| POST `/proposal-reviews/:id/decision` | `{decision:'APPROVED'|'REVISION_REQUESTED'|'REJECTED',comment,versionId,expectedVersion}` | Review + Proposal | G assigned/K; required comment sửa/từ chối |
| POST `/dossiers/:proposalId/finalize` | `{versionId,expectedVersion}` | `{proposalId,status:'LOCKED',finalizedAt,finalizedBy}` | K; approved+complete |
| POST `/dossiers/:proposalId/reopen` | `{reason,expectedVersion}` | Dossier DRAFT + audit | K có quyền mở |
| GET `/dossiers` | Query + `termId,status,advisorId` | Page dossier + required field checks | K/G assigned/S own |

ReviewGroup `{id,termId,departmentId,name,researchAreaIds,members,reviewStartAt,reviewEndAt}`; ReviewAssignment `{id,groupId,proposalId,versionId,status,decision,comment,reviewedBy,reviewedAt}`. Review decision gắn **version**, không duyệt nhầm bản SV vừa sửa. Revision → SV nộp version mới → SUBMITTED, giữ review cũ. Không chốt thiếu field/approved; quá hạn trả cảnh báo; review không được gán403. `proposal.approved`/`dossier.finalized` là đầu vào guidance.

## 9. Tham khảo ngoài phạm vi: hướng dẫn, nhiệm vụ, báo cáo tuần, final, xác nhận GVHD

Chủ sở hữu: **thành viên UC14–17**. Mục đích: vòng giao việc → SV nộp → GV nhận xét → nộp lại → xác nhận, đầy đủ lịch sử.

```ts
interface Task {
 id:ID; planId:ID; termStudentId:ID; week:number; title:string; description:string;
 deliverables:string; deadline:string; requiresReport:boolean; requiresSource:boolean;
 status:'TODO'|'IN_PROGRESS'|'SUBMITTED'|'REVISION_REQUESTED'|'COMPLETED'|'OVERDUE';
 progress:number; latestSubmissionId?:ID; isLate:boolean;
}
interface Submission {
 id:ID; taskId:ID; version:number; content:string; progress:number;
 reportFile?:FileRef; sourceFiles:FileRef[]; resourceLinks:string[];
 submittedAt:string; isLate:boolean;
 reviews:Array<{id:ID;reviewerId:ID;decision:'PASSED'|'FAILED'|'REVISION_REQUESTED';comment:string;reviewedAt:string}>;
}
```

| Method/path | Request | Response data | Role |
| --- | --- | --- | --- |
| GET `/guidance-plans` | Query + `termId,advisorId,termStudentId` | Page plan summaries | G assigned/S own/K read |
| POST `/guidance-plans`; PATCH `/guidance-plans/:id` | `{proposalId,description,milestones:[{name,startAt,endAt,objectives}],expectedVersion?}` | Plan | G advisor; dossier locked |
| GET `/guidance-plans/:id` | — | Plan + proposal + milestones + progress | Scoped |
| GET `/tasks` hoặc `/tasks/plan/:planId` | Query + `termId,studentId,week,status,overdue` | Page Task | Scoped |
| POST `/tasks`; PATCH `/tasks/:id` | `{planId,week,title,description,deliverables,deadline,requiresReport,requiresSource,expectedVersion?}` | Task | G advisor |
| POST `/tasks/:id/cancel` | `{reason,confirmHasSubmissions,expectedVersion}` | Task/cancellation history | G advisor |
| PATCH `/tasks/:id/progress` | `{progress,status:'TODO'|'IN_PROGRESS',note,expectedVersion}` | Task | S own; không tự COMPLETED |
| POST `/tasks/:id/submissions` | multipart `{content,progress,reportFile,sourceFiles[],resourceLinks[]}` | Submission + updatedTask | S own, phase unlocked |
| GET `/tasks/:id/submissions` | Query | Page immutable Submission | S/G assigned/K |
| POST `/submissions/:id/reviews` | `{decision,comment,expectedVersion}` | Review + updatedTask | G advisor; PASSED cần file theo yêu cầu |
| GET/POST `/guidance-plans/:id/meetings` | GET Query; POST `{meetingDate,format,location,summary,conclusion,attendees}` | Page / Meeting | G write; S/K scoped read |
| GET/POST `/guidance-plans/:id/evaluations` | POST `{phaseCode,criteria:[{id,score,comment}],comment,evidenceIds}` | Page / PhaseEvaluation | G write/K read |
| GET `/guidance/alerts` | Query + `termId,advisorId,type` | Page overdue/missing report alerts | G own/K all |
| POST `/proposals/:id/final-reports` | multipart `{file:PDF,changeNote}` | FinalReport + FileRef | S own, FINAL_REPORT phase |
| GET `/proposals/:id/final-reports` | Query | Page versioned FinalReport | S/G advisor/GVPB/H/K scoped |
| POST `/proposals/:id/defense-confirmation` | `{decision:'CONFIRMED'|'REJECTED',note,expectedVersion}` | DefenseConfirmation | G advisor |
| GET `/defense-confirmations` | Query + `termId,advisorId,status` | Page confirmation + progress/final checks | G own/K; S own |

Confirmation `{proposalId,advisorId,status:'PENDING'|'CONFIRMED'|'REJECTED',note,confirmedAt}`. Từ chối phải có note; đồng ý khi việc chưa hoàn thành trả warning/needsConfirmation theo chính sách, không âm thầm coi nhiệm vụ hoàn thành. Nộp muộn được ghi `isLate` nếu phase còn cho phép; phase khóa chặn. Không có file bắt buộc422; MIME415/size413; reviewer không phải GVHD403. Source có thể ZIP hoặc repo link theo cấu hình, weekly report PDF/DOCX theo cấu hình; Final chỉ PDF. Files được download qua endpoint bảo vệ/signedURL, không lộ đường dẫn ổ đĩa. `final-report.submitted` và `defense.confirmed` chuyển đầu vào eligibility.

## 10. Tham khảo ngoài phạm vi: eligibility và bảo lưu

Chủ sở hữu: **thành viên UC18**. Mục đích: Khoa chốt đủ điều kiện, tách khỏi ý kiến GVHD.

```ts
interface Eligibility {
 id:ID; proposalId:ID; termStudentId:ID;
 status:'PENDING'|'ELIGIBLE'|'INELIGIBLE'|'DEFERRED';
 checks:Array<{code:string;label:string;passed:boolean;reason?:string;source?:string;verifiedAt?:string}>;
 advisorConfirmation:'PENDING'|'CONFIRMED'|'REJECTED';
 academicVerified:boolean; reasons:string[]; isFinalized:boolean; checkedAt?:string;
}
```

| Method/path | Request | Response data | Role |
| --- | --- | --- | --- |
| GET `/eligibilities` | Query + `termId,status,advisorId,className,missingCheck` | Page Eligibility + student | K; G/S scope |
| GET `/eligibilities/:id` | — | Eligibility + final/progress/academic evidence | K/G assigned/S own |
| POST `/eligibilities/evaluate` | `{termId,proposalIds?}` | `{rows,summary,violations}` | K |
| PATCH `/eligibilities/:id/academic-check` | `{academicVerified,source,evidenceId?,reason,expectedVersion}` | Eligibility | K, manual source explicit |
| POST `/eligibilities/finalize` | `{termId,eligibleIds,expectedVersion}` | `{finalizedIds,rejectedIds,violations}` | K; confirmed+academic+final |
| GET `/deferments` | Query + `termId,status,studentId` | Page Deferment | K/S own |
| POST `/deferments` | `{proposalId,reason,evidenceIds?,targetTermId?}` | Deferment PENDING | S own/K |
| POST `/deferments/:id/decision` | `{decision:'DEPARTMENT_APPROVED'|'FACULTY_APPROVED'|'REJECTED',comment,expectedVersion}` | Deferment + Eligibility | K/quyền tương ứng |
| POST `/deferments/:id/resume` | `{targetTermId,academicVerified,source,reason}` | New TermStudent + previousTermStudentId | K, kiểm điều kiện lại |
| POST `/deferments/:id/reviewer-confirmation` | `{decision:'AGREED'|'REJECTED',comment,scoreEntryId?,expectedVersion}` | Deferment + retained review reference | GVPB được giao; nhánh bảo lưu sau phản biện nếu cấu hình |

Trạng thái đặc biệt REVIEW_ONLY/SUPPLEMENTED_ELIGIBLE là extension tùy chính sách, không tự thêm vào enum bắt buộc. Bảo lưu được phê duyệt mới chuyển eligibility DEFERRED. Không đưa DEFERRED/INELIGIBLE/PENDING vào HĐ. Mỗi check/reason cần có nguồn; demo không khẳng định kết nối hệ thống học vụ thật. Thiếu xác nhận/final/học vụ422; roster sai đợt403/422; finalized409.

Ảnh ERD Word có nhánh bảo lưu chờ GVPB → GVPB đồng ý/từ chối → nộp đơn/quyết định, kèm reviewerScore/reviewerComment/carryOverTermId. Đề xuất Deferment bổ sung `{mode:'STANDARD'|'AFTER_REVIEW',reviewerId?,reviewerDecision?,retainedScoreEntryId?,reviewerComment?,previousTermStudentId?,targetTermId?}`. Không sao chép điểm vào đợt sau tự động; chỉ giữ reference và quyết định cho phép sử dụng lại. Status chờ/xác nhận GVPB ánh xạ thành substate của PENDING hoặc enum mở rộng sau khi nhóm bảo vệ chốt; không coi enum Prisma hiện tại mô tả đủ nhánh này.

## 11. Tham khảo ngoài phạm vi: hội đồng, GVPB, phòng, phiên, lịch, biên bản

Chủ sở hữu: **thành viên UC19–21**. Mục đích: phân bố cân bằng, chặn quan hệ GVHD–HĐ/GVPB và trùng lịch.

```ts
interface Committee {
 id:ID; termId:ID; name:string; capacity:number;
 members:Array<{lecturerId:ID;role:'CHAIR'|'SECRETARY'|'MEMBER'}>;
 proposalIds:ID[]; status:'DRAFT'|'FINALIZED';
}
interface DefenseSession {
 id:ID; committeeId:ID; roomId:ID; date:string; period:'MORNING'|'AFTERNOON';
 startAt:string; endAt:string; durationMinutes:number;
 students:Array<{proposalId:ID;order:number;scheduledAt:string}>;
 status:'DRAFT'|'FINALIZED'|'PUBLISHED';
}
interface Conflict {code:string;message:string;lecturerId?:ID;roomId?:ID;proposalId?:ID;sessionIds?:ID[]}
```

| Method/path | Request | Response data | Role |
| --- | --- | --- | --- |
| GET `/committees/term/:termId` | Query + `status,lecturerId` | Page Committee + student/member summaries | K/H assigned; S own summary |
| POST `/committees`; PATCH `/committees/:id` | `{termId,name,capacity,members,proposalIds,expectedVersion?}` | Committee + conflicts | K |
| POST `/committees/distribute` | `{termId,committeeIds,proposalIds,policy:'BALANCED',keepManual:true}` | Draft distribution + conflicts + load | K |
| POST `/committees/:id/validate`; POST `/committees/:id/finalize` | `{expectedVersion}` | Validation / FINALIZED Committee | K |
| GET `/reviewer-assignments` | Query + `termId,committeeId,reviewerId,status` | Page assignment + loads | K/G own |
| POST `/reviewer-assignments/preview` | `{termId,committeeIds?}` | Draft rows + conflicts/loads | K |
| PUT `/reviewer-assignments/:proposalId` | `{reviewerId,reason,expectedVersion}` | Assignment + load | K |
| POST `/reviewer-assignments/publish` | `{termId,expectedVersion}` + idempotency | `{published,notificationJobs}` | K |
| GET/POST `/rooms`; PATCH `/rooms/:id` | GET Query; write `{code,name,location,capacity,expectedVersion?}` | Page / Room | K/A write; scoped read |
| GET `/defense-sessions` | Query + `termId,committeeId,roomId,date,period,status` | Page DefenseSession | K/G/H scope; S own published |
| POST `/defense-sessions`; PATCH `/defense-sessions/:id` | Session fields + expectedVersion | Session + conflicts | K |
| POST `/defense-sessions/:id/sort` | `{policy:'VI_GIVEN_NAME_THEN_FAMILY',expectedVersion}` | Session ordered students | K |
| POST `/defense-sessions/validate` | `{termId,sessionIds?}` | `{valid,conflicts:Conflict[]}` | K |
| POST `/defense-sessions/publish` | `{termId,sessionIds,expectedVersion}` + idempotency | Sessions PUBLISHED + notification jobs | K; conflict free |
| GET `/defense-minutes/:sessionId` | — | Minutes + student proceedings | K/H assigned secretary/chair |
| PUT `/defense-minutes/:sessionId` | `{content,questions,answers,revisionNotes,attendance,expectedVersion}` | Minutes DRAFT | K/H secretary |
| POST `/defense-minutes/:sessionId/confirm` | `{expectedVersion}` | Minutes CONFIRMED + signer placeholders | H chair/K authorized |

Validate members3–5/cấu hình, đủ Chủ tịch/Thư ký, không trùng người/vai trò; SV eligible+finalized; GVHD của bất kỳ SV trong HĐ không nằm members. GVPB không là GVHD, đồng thời loại HĐ chứa GVHD khi áp dụng nguyên tắc bước9 của nguồn. DEF001/002/003 details có IDs để UI tô hàng/cặp. Lịch so sánh khoảng thời gian, chung endpoint không đồng nghĩa overlap; kiểm mỗi giảng viên, HĐ, phòng và sức chứa. Chỉnh lịch đã publish buộc reason/audit/re-notify. Biên bản không tạo chữ ký điện tử giả; chỉ lưu danh sách người cần đồng ký/vùng ký.

## 12. Tham khảo ngoài phạm vi: Rubric, điểm GVHD/GVPB/HĐ và kết quả

Chủ sở hữu: **thành viên UC22–24**. Mục đích: các bộ điểm độc lập, đủ thành phần rồi tổng hợp/chốt/công bố.

```ts
interface Rubric {
 id:ID; termId:ID; type:'ADVISOR'|'REVIEWER'|'COMMITTEE'; version:number;
 criteria:Array<{id:ID;name:string;description:string;maxScore:number;weight:number;required:boolean}>;
}
interface ScoreEntry {
 id:ID; proposalId:ID; scorerId:ID;
 role:'ADVISOR'|'REVIEWER'|'COMMITTEE_CHAIR'|'COMMITTEE_SECRETARY'|'COMMITTEE_MEMBER';
 rubricId:ID; rubricVersion:number;
 details:Array<{criterionId:ID;score:number;comment?:string}>;
 totalScore:number|null; comment:string; questions:string[];
 status:'DRAFT'|'SUBMITTED'|'LOCKED'; submittedAt?:string; version:number;
}
interface FinalResult {
 proposalId:ID; advisorScore:number|null; reviewerScore:number|null;
 processScore:number|null; committeeScore:number|null; finalScore:number|null;
 committeeEntries:Array<{scorerId:ID;role:string;score:number|null;status:string}>;
 missingComponents:string[]; weightsSnapshot:TermParameters;
 status:'DRAFT'|'LOCKED'|'PUBLISHED'; isPassed:boolean|null;
 revisionNotes:string; revisionStatus:'NOT_REQUIRED'|'PENDING'|'COMPLETED';
 lockedAt?:string; publishedAt?:string;
}
```

API có thể dùng decimal string khi backend cần bảo toàn độ chính xác; adapter frontend chuyển tại một chỗ, không trộn number/string tùy trang. Không round từng criterion trước tổng; quy tắc demo giữ QT2 chữ số, KTHP3, HP2 giống calculator hiện có, cần chốt quy tắc làm tròn chính thức khi kết nối.

| Method/path | Request | Response data | Role |
| --- | --- | --- | --- |
| GET `/rubrics` | Query + `termId,type` | Page Rubric | K/G/H read |
| POST `/rubrics`; PUT `/rubrics/:id` | `{termId,type,criteria,expectedVersion?}` | Rubric new version | K; không sửa version đã dùng |
| GET `/grading/assignments/me` | Query + `termId,role,status,committeeId` | Page hồ sơ được chấm + files | G/H đúng phân công |
| GET `/scores/proposal/:proposalId` | `role?` | ScoreEntry[] theo scope | K/G/H đúng quyền; S sau công bố theo final response |
| PUT `/scores/proposal/:proposalId/me` | `{role,rubricId,rubricVersion,details,comment,questions,expectedVersion?}` | ScoreEntry DRAFT + calculated total | G advisor/reviewer hoặc H member |
| POST `/scores/:id/submit` | `{expectedVersion}` | ScoreEntry SUBMITTED | Chính scorer, đủ fields/đúng hạn |
| POST `/scores/:id/reopen` | `{reason,expectedVersion}` | ScoreEntry DRAFT + audit | K quyền đặc biệt; không xóa history |
| GET `/scores/:id/history` | Query | Page actor/time/before/after/reason | K/scorer theo quyền |
| GET `/results` | Query + `termId,committeeId,className,advisorId,status,isPassed` | Page FinalResult + student/topic | K/H scope |
| POST `/results/aggregate` | `{termId,proposalIds?}` | Results DRAFT + missing/warnings | K/H secretary/chair đúng HĐ |
| POST `/results/lock` | `{termId,proposalIds,expectedVersion}` | `{lockedIds,violations}` | K; đủ bắt buộc, confirmed |
| POST `/results/publish` | `{termId,proposalIds,expectedVersion}` + idempotency | `{publishedIds,publishedAt}` | K; locked + đúng mốc |
| GET `/results/me` | `termId` | `{published:boolean,result?:FinalResult}` | S own; ẩn toàn điểm trước publish |
| PATCH `/results/:proposalId/revisions` | `{notes,status,evidenceIds?,expectedVersion}` | FinalResult + revision history | K/H note; S own evidence; K confirm |

GVPB cần5 tiêu chí max2/3/1/2/2, tổng10, ≥2 câu hỏi khi submit. GVHD cần nhận xét tính thực tiễn/ý thức/kết quả và điểm/10. HĐ dùng rubric cấu hình riêng, không coi5 tiêu chí GVPB mặc định là chuẩn HĐ. GVHD không được entry HĐ cho SV mình. ScoreEntry.status khác FinalResult.status; draft không tính điểm chính thức.

```text
QT = a*GVHD + b*GVPB         (a=.5,b=.5; a+b=1)
KTHP = tổng điểm các thành viên hợp lệ bắt buộc / số thành viên đó
HP = p*QT + c*KTHP          (p=.4,c=.6; p+c=1)
Đạt điểm: QT>=5 && KTHP>=5 && HP>=5.
Hoàn tất lưu chiểu: đạt điểm && revisionStatus != PENDING.
```

Thiếu1 điểm trả null/missingComponents; không ngầm đổi0 hoặc lấy trung bình người đã nhập rồi cho chốt. GRADE001 ngoài max; GRADE002 thiếu; GRADE003 locked; công thức chưa hợp lệ422; publish trước lock/mốc409. Ví dụ kiểm chứng: 9/7 và HĐ7.5/8/8.5/9 cho8/8.25/8.15. Snapshot rubric/weights/entries lúc lock; sửa đặc biệt sau lock audit người/thời gian/trước/sau/lý do và quy trình công bố lại.

## 13. Dashboard, báo cáo, export và files

**Trong phạm vi hiện tại:** dashboard cho auth/Bước 1–3, danh sách tham gia/phân công và PDF đề cương cuối Bước 3; file mẫu import nếu có trong màn hình đang bàn giao. **Ngoài phạm vi:** trung tâm báo cáo bảo vệ/kết quả, biểu mẫu nhận xét GVHD/GVPB, Hội đồng, lịch/biên bản, điểm và các job tương ứng. Bảng dưới là hợp đồng mở rộng để tham khảo, không khẳng định đã có trung tâm xuất toàn hệ thống.

### 13.1. Adapter frontend đang bàn giao

`features/report/services/report-service.ts` có `allowedReportKinds(user)`, `buildReport(db,user,termId,kind,filters)` và `createReport(termId,kind,format,filters)`. Đây là mock adapter, chưa gọi những endpoint dự kiến dưới đây.

```ts
type ReportKind = 'STUDENTS' | 'LECTURERS' | 'ROSTER' | 'REGISTRATIONS'
  | 'ASSIGNMENTS' | 'TOPICS' | 'PROPOSAL';
interface ReportFilters {
  program?: string; directionId?: ID; lecturerId?: ID;
  status?: string; studentId?: ID; degree?: 'Cử nhân' | 'Kỹ sư';
}
// preview: {title:string, rows:Record<string,unknown>[], lines:string[]}
// job: {id,termId,name,format:'PDF'|'XLSX',status:'PENDING'|'COMPLETED'|'FAILED',
//       requestedBy,reportKind,filters,at,completedAt?,error}
```

Admin/Giáo vụ được xuất toàn bộ dữ liệu trong đợt; GV chỉ xuất danh sách/hồ sơ gắn phân công chính thức của mình; SV chỉ được xuất phân công đã công bố và đề cương của mình. Cả cờ công bố của đợt lẫn từng phân công đều được kiểm. Filter không mở rộng quyền sở hữu. Chỉ vai trò COMMITTEE không có mẫu xuất trong Bước 1–3.

Mẫu PDF đề cương dùng `proposalLines` chung với trang đề cương, chọn Cử nhân/Kỹ sư riêng với hệ đào tạo và có bốn vùng ký trống. Bản demo/chưa phê duyệt có nhãn rõ. Bộ lọc được lưu trên job để thử lại khi lỗi; kết quả rỗng trả `EXPORT_EMPTY` và không tạo tệp/job. `PENDING` lưu trước khi gọi bộ tạo tệp, thành công chuyển `COMPLETED`, lỗi chuyển `FAILED` kèm nguyên nhân. PDF dùng `application/pdf`; XLSX là workbook thật qua adapter dùng chung. Kiểm tra việc tạo file tại browser là phần nghiệm thu riêng, không suy từ unit test adapter.

### 13.2. Hợp đồng HTTP dự kiến và tham khảo mở rộng

Chủ sở hữu: **thành viên báo cáo**, phối hợp module nghiệp vụ; PDF đề cương bước3 do nhóm người yêu cầu.

| Method/path | Request | Response data | Role |
| --- | --- | --- | --- |
| GET `/reports/dashboard` | `termId?,trainingSystemId?` | Role dashboard `{cards,charts,upcoming,recentActivity,actionItems}` | Login theo scope |
| GET `/reports/stats` | `termId,trainingSystemId,advisorId,committeeId,className,status` | `{students,lecturers,areas,topics,progress,scores,assignmentDistribution}` | K/A; scoped G/H |
| GET `/exports/templates` | `type?,role?` | Template lookup `{code,name,format,requiredFilters,officialOnly}` | Theo quyền |
| POST `/exports/preview` | `{templateCode,termId,filters,versionId?}` | `{html?,columns?,rows?,isOfficial,recordCount,warnings}` | Theo loại/scope |
| POST `/exports` | `{templateCode,termId,filters,format:'PDF'|'XLSX'|'CSV',versionId?}` + idempotency | ExportJob QUEUED | K/H hoặc S own proposal/result |
| GET `/exports` | Query + `termId,type,status,requestedBy` | Page ExportJob | K hoặc chính chủ phạm vi |
| GET `/exports/:id` | — | ExportJob | Chính chủ/quyền module |
| GET `/exports/:id/download` | — | Binary đúng format | Job DONE + scoped quyền |
| POST `/exports/:id/retry` | `{reason?}` | ExportJob QUEUED | Chính chủ/K; FAILED |
| GET `/files/:id/download`; GET `/files/:id/preview` | — | Binary hoặc signedURL ngắn hạn | Theo ownership/module |

ExportJob `{id,termId,type,format,templateCode,filters,status:'QUEUED'|'PROCESSING'|'DONE'|'FAILED',progress,recordCount,requestedBy,createdAt,completedAt?,file?:FileRef,error?:{code,message},isOfficial}`. Không có dữ liệu422 EXPORT_EMPTY; chưa cấu hình template404/422; chưa chốt ghi watermark chưa chính thức hoặc chặn officialOnly; job lỗi không có link download giả. Render file ngay trong demo có thể vẫn dùng cùng states để chuẩn bị worker thật.

Loại mẫu tối thiểu: PROPOSAL_BACHELOR/PROPOSAL_ENGINEER; ADVISOR_REVIEW_VI/EN; REVIEWER_REVIEW_VI/EN; COMMITTEE_REQUEST; DEFENSE_SCHEDULE; DEFENSE_MINUTES; RESULT_BY_COMMITTEE; RESULT_BY_CLASS; TERM_RESULTS (QT/KTHP/HP); REVIEWER_ASSIGNMENTS; STUDENT_IMPORT/LECTURER_IMPORT. PDF cần font Việt/khổ giấy/vùng ký; Excel workbook hoặc CSV nếu hiển thị rõ format, không file rỗng/đổi đuôi.

## 14. Hiện trạng backend thực đọc được

Từ controller: POST auth login/change-password/refresh/logout; GET students/lecturers; GET terms và terms/:id; GET registrations/term/:termId; GET topics/term/:termId; GET tasks/plan/:planId; GET committees/term/:termId; GET scores/proposal/:proposalId; GET reports/stats; GET notifications/user/:userId. Phần lớn là read đơn giản, response/pagination/quyền chưa bao phủ hợp đồng trên. OpenAPI hiện chỉ mô tả4 path (login/students/terms/registrations). Không coi sự hiện diện model Prisma là API đã triển khai.

Những thay đổi schema cần nhóm backend tự chốt trước kết nối: Term.trainingSystemId; Registration.researchAreaId/draft/submitted; Topic ownership theo TermStudent; Proposal unique theo SV+đợt; lecturer quota/chính sách snapshot/cộng tác xác minh; AssignmentPlan version/stale/finalize/publish; submission review3 trạng thái; final version; eligibility checks/evidence; committee/session lifecycle; score submit/locked/status/decimal precision; FinalResult QT/KTHP/weights/locked snapshot/revisions. Frontend demo có thể chứa các trường còn thiếu bằng types riêng; tuyệt đối không migrate/sửa backend của thành viên khác trong giai đoạn frontend.

## 15. Kịch bản nghiệm thu dự kiến — không phải kết quả đã chạy

Chỉ kịch bản số 1 và phần PDF đề cương/danh sách của kịch bản số 6 thuộc phạm vi bàn giao hiện tại. Các kịch bản 2–5 và báo cáo sau Bước 3 là tham khảo cho thành viên sau. Kết quả kiểm tra thực tế phải đọc trong tài liệu bàn giao và log chạy; không suy ra từ danh sách yêu cầu này.

1. Bước1–3: mới login bắt buộc đổi password/contact; roster sai/hệ sai/hết hạn bị chặn; NV đúng thứ tự; thuật toán theo vòng; quota và stale; publish idempotent; S/G chỉ thấy sau publish; topic AGREED; submit/version/PDF đúng sở hữu.
2. Duyệt: chỉ member đúng nhóm mở; sửa không comment bị chặn; version vừa duyệt không đổi khi SV tạo nháp; APPROVED mới chốt dossier.
3. Hướng dẫn: báo cáo/source thật; version nộp lại; PASSED/FAILED/Cần sửa rõ; chỉ GV hoàn thành; final PDF; confirmation reason.
4. Bảo vệ: học vụ/xác nhận/final; bảo lưu liên kết; loại GVHD khỏi HĐ/GVPB;3–5 đủ chức vụ; trùng GV/phòng/giờ; thứ tự locale Việt; publish lịch/biên bản.
5. Chấm/kết quả: scorer scope; rubric ranges/câu hỏi; thiếu thành phần không lock; ví dụ8.15; nháp/gửi/khóa/công bố; SV trước publish không điểm; hậu chốt audit.
6. Báo cáo: filter giữ scope; rỗng/lỗi/retry; PDF đọc được/tiếng Việt; CSV/XLSX mở đúng; official/draft rõ. Từng nhóm cập nhật OpenAPI bằng API **thực sự có**, không copy toàn bộ dự kiến thành tuyên bố đã xong.
