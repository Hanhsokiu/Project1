# Bước 2 — UC01 và UC09

Đối chiếu hai tệp Word trong `docs/spec`, ADR-0002 và mã nguồn ngày 25/10/2026. Mỗi SV làm đồ án cá nhân. Phần ghép nhóm trong UC09 của Word bị thay thế bởi ADR và yêu cầu hiện tại.

Base `/api`, response `ApiResponse<T>` và Bearer session như Bước 1. Các endpoint dưới đây đã được mount. Request không nhận `studentId`, `registrationId`, GPA, eligible hay thời gian nộp từ client. Trường dư bị 400; UUID URL không hợp lệ bị 400.

| Method/path                                  | Quyền                                        | Dữ liệu                                                      |
| -------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| GET `/registrations`                         | `registration:read` — Admin/Giáo vụ mặc định | Tất cả đăng ký và thống kê                                   |
| GET `/registrations/term/:termId`            | `registration:read`                          | `{items,stats:{total,draft,submitted}}` theo đợt             |
| GET `/registrations/term/:termId/me`         | `registration:own` — SV mặc định             | `{registration,window,directions,lecturerIds}` của chính chủ |
| PUT `/registrations/term/:termId/me/draft`   | `registration:own`                           | Lưu/thay nháp, trả RegistrationResponse                      |
| POST `/registrations/term/:termId/me/submit` | `registration:own`                           | Nộp/sửa, trả RegistrationResponse                            |

Body ghi:

```ts
{
  directionId?: string | null; // UUID, duy nhất một hướng
  preferences?: {lecturerId: string; preferenceOrder: number}[];
  note?: string; // tối đa 3000 ký tự
  email?: string; // email hợp lệ, nếu sửa liên hệ trong form
  phone?: string; // /^(0|\+84)[0-9]{9,10}$/
}
```

Nháp mặc định hướng null, NV rỗng; hướng đã chọn và NV đã điền vẫn phải hợp lệ. Nộp cần một hướng và 1–min(3,max_preferences) NV. Không trùng GV, thứ tự đúng 1,2,3 theo vị trí trong mảng, không có khoảng trống. GV cần đang hoạt động, thuộc roster GV của đợt và có chuyên môn đúng hướng. Quota không giữ chỗ, quota 0 vẫn có thể được đăng ký nguyện vọng.

Hướng áp dụng cho đợt là giao của `ResearchArea.isActive=true` với các hướng của GV đang hoạt động trong `TermLecturer`. Đây là chính sách áp dụng dựa trên roster hiện có; không thêm danh sách cấu hình hướng riêng hoặc suy hướng cho đăng ký cũ. Giáo vụ có thể bật/tắt hướng bằng `PATCH /research-areas/:id {isActive:boolean}` với quyền `catalog:manage`.

Đọc/ghi chính chủ đều kiểm đổi mật khẩu và liên hệ trong DB. `profileComplete` được tính trong mapper tài khoản, không nhận từ client. Request ghi không thể dùng email/phone để vượt bước onboarding: phải hoàn tất `/auth/profile` trước. `/auth/me`, change-password, logout vẫn dùng được khi bắt đổi mật khẩu; sau đổi có thể cập nhật hồ sơ mà không bị guard chặn. Email lưu ở `UserAccount`, SĐT được đồng bộ `UserAccount.phone` và `Student.phone`.

Mọi lần ghi kiểm lại roster SV, trạng thái hoạt động/học vụ, hệ đào tạo và GPA hiện tại so với ngưỡng. Dùng `TermWindowService.requireOpen` với clock server, khoảng `[start,end)`, kiểm lại trước ghi; chặn đợt/giai đoạn khóa, trạng thái không mở, đã công bố/finalize phân công. Mọi kiểm tra, cập nhật liên hệ, registration, thay toàn bộ NV và audit nằm trong transaction Serializable có retry tranh chấp. Unique `(termId,studentId)` ngăn hai bản hiện hành.

Trạng thái public chỉ `DRAFT | SUBMITTED`; `submittedAt` do server ghi khi nộp/sửa. Nộp lại cập nhật thời điểm theo lần xác nhận hợp lệ mới nhất; chuyển về nháp xóa thời điểm hiện hành. Các trạng thái DB cũ giữ nguyên, public trả `DRAFT` và `legacyStatus` để SV nộp lại rõ ràng. Migration không tự đoán hướng hoặc tạo thời điểm nộp cũ từ `createdAt`.

RegistrationResponse có `{id,termId,studentId,directionId,status,legacyStatus,note,submittedAt,updatedAt,preferences}`; `directionId/submittedAt/legacyStatus` có thể null. API không trả tài khoản/hash/session của SV hoặc GV. SV không có quyền list và không có endpoint đọc/sửa bằng registrationId của người khác. Query `studentId` không thay đổi chủ thể phiên.

Lỗi: 401 phiên không hợp lệ; 403 `PASSWORD_CHANGE_REQUIRED`, `PROFILE_INCOMPLETE` hoặc thiếu quyền; 400 DTO; 404 đợt/route không tồn tại; 422 `REGISTRATION_INVALID`; 409 hết hạn/khóa/công bố hoặc tranh chấp/email trùng. Không fallback sang mock khi lỗi.

Nguồn: `backend/src/registration`, `shared/src/step2.ts`; [OpenAPI sinh từ server](openapi.yaml). Shared và DTO backend được kiểm tra đồng bộ trong suite validator; frontend dùng shared schema và status type.
