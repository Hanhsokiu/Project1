# API Bước 3 — UC10, UC11, UC12 và PDF UC25

Base: `http://127.0.0.1:3010/api`. JWT bearer, guard đổi mật khẩu và RBAC hiện có vẫn áp dụng. JSON dùng `ApiResponse`; PDF trả binary. Swagger tại `/api/docs`; hợp đồng sinh từ bản NestJS đang chạy nằm trong `openapi.json` và `openapi.yaml`.

## Phân công

| Method/path | Quyền | Nội dung |
|---|---|---|
| GET `/assignments/term/:termId/plan` | assignment:manage | Plan hiện tại, revision, phân công, kết quả/lý do, vi phạm, danh sách chưa nộp riêng |
| POST `/assignments/term/:termId/preview` | assignment:manage | Tính từ DB, chưa ghi phương án; trả `revision`, `inputHash`, `results`, `missingSubmissions` |
| PUT `/assignments/term/:termId/draft` | assignment:manage | Tính và kiểm lại trong transaction rồi lưu nháp |
| PUT `/assignments/term/:termId/manual` | assignment:manage | Điều chỉnh nháp, lý do bắt buộc; kiểm roster/đăng ký/GV/chuyên môn/quota |
| POST `/assignments/term/:termId/publish` | assignment:manage | Chốt/công bố, chuyển đợt IN_PROGRESS, tạo thông báo và email outbox cùng transaction |
| GET `/assignments/term/:termId/results` | assignment:read | Trước công bố: 403. Sau công bố: SV chính chủ, GV được giao; quản lý xem toàn đợt |

`preview` và `draft`:

```json
{"revision":0,"mode":"remaining","confirmed":false}
```

Khi lưu `draft`, gửi thêm `inputHash` nhận từ preview. `mode=remaining` giữ tất cả phân công hiện có, chỉ bổ sung SV chưa phân. `mode=all` phải có `confirmed=true`; UI hỏi xác nhận rồi hiển thị preview trước khi ghi. Mọi thao tác ghi dùng revision hiện tại. Hash hoặc revision thay đổi trả 409 để yêu cầu xem trước lại.

Điều chỉnh:

```json
{"studentId":"uuid","lecturerId":"uuid","reason":"Lý do ít nhất 10 ký tự","revision":1}
```

Công bố: `{"revision":2}`. Request lặp sau khi công bố trả cùng phương án chính thức, không thêm outbox/thông báo. Các thao tác đổi/tính lại sau công bố bị chặn. Không có API điều chỉnh chính thức sau công bố trong phạm vi này.

Đăng ký phải đóng (`CLOSED_REGISTRATION`), cửa sổ ASSIGNMENT cho phép theo giờ server, đợt chưa khóa. Khi công bố, mọi đăng ký SUBMITTED phải hợp lệ và có GV, mọi phân công phải đúng hướng và trong quota. SV chưa nộp hiển thị riêng, không được tự gán hướng; nhóm này không được thêm vào phương án và không tự cản công bố các đăng ký đã nộp hợp lệ.

## Đề tài và đề cương

| Method/path | Quyền và ownership | Nội dung |
|---|---|---|
| GET `/topics/term/:termId` | topic:read; quản lý/toàn đợt, SV/chính chủ, GV/được giao | Trả hồ sơ có phân công chính thức; không lộ nháp phân công |
| PUT `/topics/term/:termId/student/:studentId/draft` | topic:write; SV chính chủ hoặc đúng GVHD | Tạo/cập nhật đề tài/đề cương, luôn thêm phiên bản |
| POST `/topics/term/:termId/student/:studentId/submit` | topic:write; chỉ SV chính chủ | Nộp phiên bản mới SUBMITTED để bàn giao UC13 |
| POST `/topics/:id/agree` | topic:write; SV chính chủ hoặc đúng GVHD | Xác nhận/từ chối nội dung ở phiên bản đang xem |
| GET `/topics/:id/versions/:version/pdf?degree=bachelor` | topic:read + ownership | PDF từ đúng phiên bản DB; `degree=engineer` cho mẫu kỹ sư |

`id` trong DTO topic/API là ID hồ sơ `Proposal`. Bản nội dung:

```json
{
  "expectedVersion": 0,
  "content": {
    "title": "Hệ thống quản lý đồ án tốt nghiệp",
    "objectives": "Mục tiêu của đề tài",
    "scope": "Nội dung và phạm vi thực hiện",
    "technology": "React, NestJS, PostgreSQL",
    "expected": "Các kết quả dự kiến",
    "plan": [{"week":"1–3","content":"Khảo sát và phân tích yêu cầu"}]
  }
}
```

`agree`: `{"agreed":true,"expectedVersion":1}`. Mọi thay đổi `title/objectives/scope/technology/expected/plan` vô hiệu hóa xác nhận GVHD cũ. Bên chỉnh sửa xác nhận nội dung của mình; nộp bởi SV cũng xác nhận nội dung hiện tại của SV. Chỉ nộp khi GVHD đã xác nhận chính nội dung đó và đủ trường bắt buộc. Không thay đổi nội dung rồi nộp trực tiếp bằng xác nhận cũ.

Mỗi ghi kiểm phân công PUBLISHED/FINALIZED, đúng SV/GVHD, TermWindowService PROPOSAL bằng giờ server và trạng thái hồ sơ trong transaction. `expectedVersion` cũ trả 409. Sửa SUBMITTED chuyển về DRAFT, thêm phiên bản, ghi audit; các phiên bản đã nộp giữ nguyên. UNDER_REVIEW/APPROVED hoặc dossier APPROVED không sửa trực tiếp. API chưa cung cấp duyệt/chốt hồ sơ UC13.

PDF không nhận content từ request. Bản nháp/chờ duyệt có nhãn rõ, mã phiên bản và thời điểm; không tự tạo chữ ký hay giả duyệt. Hồ sơ lịch sử thiếu snapshot biểu mẫu trả 422, không đoán lại nội dung. API xác minh quyền trước khi đọc phiên bản. Mẫu dùng HTML có sẵn được đối chiếu ảnh trong Word, Times New Roman/Chrome in Unicode. Chạy backend từ thư mục `backend` và giữ `templates/`; cần Chrome hoặc `PDF_CHROME_PATH`.

## Thông báo và SMTP

| Method/path | Quyền | Nội dung |
|---|---|---|
| GET `/notifications/me` | notification:own | Thông báo trong ứng dụng của phiên hiện tại, trạng thái UNREAD/READ |
| PATCH `/notifications/me/read` | notification:own | Đánh dấu các thông báo của mình đã đọc |
| PATCH `/notifications/:id/read` | notification:own + ownership | Đánh dấu một thông báo; sai chủ trả 404 |
| GET `/notifications/outbox/term/:termId` | assignment:manage | SMTP PENDING/PROCESSING/SENT/FAILED; attempts, lastError, availableAt, sentAt, messageId |
| POST `/notifications/outbox/:id/retry` | assignment:manage | Chỉ FAILED → PENDING, đặt lại retry budget |

`SENT` nghĩa SMTP đã chấp nhận người nhận, không chứng minh thư vào inbox cuối cùng. Thiếu SMTP hoặc lỗi mạng giữ FAILED với lỗi cụ thể. Event key duy nhất theo plan/advisor chống tạo trùng khi công bố lặp. Worker dùng lease token và `FOR UPDATE SKIP LOCKED`; tự thử tối đa 5 lần, backoff `min(1h, 2^attempts giây)`, khôi phục lease sau 5 phút. Gửi xong nhưng crash trước ghi SENT có thể gửi trùng khi khôi phục; stable Message-ID hỗ trợ đối chiếu, không bảo đảm exactly-once qua SMTP.

## Schema/migration

- `202610250003_step3`: revision/inputSnapshot/outcome/updatedAt của AssignmentPlan; FK đợt; partial unique một DRAFT và một official mỗi đợt; AdvisorAssignment unique theo plan/registration, cho phép lịch sử vòng đời; Proposal unique term/student; version có status/createdBy/submittedAt; xác nhận topic; EmailOutbox và quyền Bước 3.
- `202610250004_step3_notification_term`: thêm termId nullable cho thông báo trong ứng dụng, tách read state khỏi delivery state.
- Transaction Serializable có retry giới hạn; revision/inputHash ngăn ghi đè kết quả đang được người khác xem/sửa. Migration cũ giữ nguyên; legacy conflict làm migration mới lỗi nguyên tử, không xóa dữ liệu nguồn để chạy qua.
