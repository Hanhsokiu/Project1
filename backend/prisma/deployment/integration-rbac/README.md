# RBAC có giới hạn cho đợt tích hợp

Gói này chuẩn bị quyền, không thực thi SQL hay gọi Supabase. Không dùng nó để thêm quyền nhạy cảm vào role FACULTY/LECTURER/STUDENT dùng chung. `PERMISSION-MAPPING.json` đối chiếu đủ 27 permission UC24–UC25 với endpoint và các điều kiện service hiện tại; đây là mapping mô tả, không phải quyết định cấp quyền.

## Khả năng hiện có và giới hạn thật

`ROLE_PERMISSION` áp dụng toàn bộ tài khoản mang cùng role. `ACADEMIC_TERM_GRANT` giới hạn FACULTY theo user/term/bộ môn; không có danh sách action. `USER_ROLE` không có term. Service đòi hỏi permission và role nghiệp vụ nằm trong cùng role; quyền ADMIN hoặc custom role không được ghép vào FACULTY/LECTURER. Đổi tên hoặc thêm một custom role cho tài khoản tích hợp không giải quyết được giới hạn này.

Do đó không thể cấp riêng `finalize`, `publish`, `export`, `download`, quyền xem điểm/nhận xét cho một FACULTY hoặc LECTURER tại một term bằng cấu hình hiện có mà vẫn bảo đảm không mở rộng action cho tài khoản khác cùng role. Nếu action còn thiếu, planner trả `SCOPED_ACTION_GRANT_NOT_SUPPORTED`; không tạo câu lệnh `INSERT ROLE_PERMISSION`. Muốn hỗ trợ cần một forward schema/contract cho user + business role + action + term + department, phê duyệt, hết hạn, thu hồi và audit; authorization guard và service phải cùng kiểm tra. Gói này không tự thêm cơ chế an ninh mới chưa được xác minh và không sửa 27 migration cũ.

Thiết kế tối thiểu cho thay đổi forward riêng: bảng `SCOPED_PERMISSION_GRANT` có FK đến USER_ACCOUNT, ROLE, PERMISSION, THESIS_TERM, DEPARTMENT; các cột không nullable cho user/role/permission/term/department và cặp `startsAt < expiresAt`, `approvedBy`, `approvedAt`, `decisionReference`, `revokedAt`, `revision`. Unique theo user/role/permission/term/department; actor phê duyệt phải tồn tại thật và có quyền quản lý phạm vi, không chỉ là chuỗi UUID được điền tay. `allDepartments` không tồn tại trong grant pilot. Không cascade dữ liệu nghiệp vụ khi thu hồi; sự kiện cấp/thay đổi/thu hồi nằm trong audit transaction.

Guard chỉ xem grant bổ sung là quyền ứng viên cho endpoint; service vẫn phải xác minh cùng user/business role/action/term/department, ownership hoặc phân công thực và phiên bản nguồn ngay trước commit. Không thêm permission vào `userRoles` giả hoặc union thành role global; không tin term/department chỉ lấy từ request khi hồ sơ có scope khác. Quyền trong session/JWT không được cache vượt thời điểm thu hồi/hết hạn. Các endpoint options/list phải lọc scope trước paging và không lộ metadata của term/bộ môn khác. Phải kiểm thử SQL FK/ACL, rollback không xóa grant cũ, thời hạn, thu hồi đồng thời, cross-role/cross-term và bảo toàn B1–B8 trước khi triển khai schema này. Đây là đề xuất contract, chưa là migration được thực thi hoặc khả năng runtime hiện có.

Các lớp scope đang thực thi:

- UC17: SV phải sở hữu đề cương; GVHD phải là phân công chính thức hiện hành. Download vẫn kiểm tra ownership và version/file.
- UC18–UC21: FACULTY cần grant term/bộ môn; bản đủ điều kiện, hội đồng, phản biện và lịch phải khớp evidence/revision hiện hành. Role không thay cho phân công.
- UC22: LECTURER chỉ chấm đúng phân công phản biện hiện hành của mình; quyền đọc/điểm/nhận xét riêng của FACULTY không được thay quyền chấm.
- UC23: thành viên phải thuộc hội đồng đúng term, đúng hồ sơ, đúng phiếu của mình; không chấm thay thành viên khác.
- UC24: thành viên đúng hội đồng và policy mới được confirm; FACULTY có action cùng role và scope mới được finalize/publish. SV chỉ hồ sơ mình, điểm cuối chỉ khi đã công bố/current và được policy cho phép.
- UC25: read không tự mở export/download/điểm/nhận xét/PII. Mỗi mẫu cần quyền nội dung, scope hiện hành và policy release; preview cũng không bỏ qua quyền nội dung.

PostgreSQL RLS là lớp riêng với application RBAC. Planner không thay đổi RLS, ACL, policy hoặc flags; tài khoản migration có quyền SQL không chứng minh một tài khoản nghiệp vụ được phép thao tác API.

## Chạy preflight offline

Chuẩn bị snapshot tối thiểu ngoài Git, chỉ user ID/role/permission và scope, không email, mật khẩu, token hay connection string:

```json
{
  "accounts": [],
  "requests": []
}
```

Mỗi account có `userId`, `status`, `roles: [{name, permissions}]`, `termGrants: [{termId, allDepartments, departmentIds}]`; LECTURER/STUDENT bổ sung `assignmentScopes: [{termId, kind, departmentIds}]` trích từ dữ liệu workflow thật. Mỗi request có `userId`, `termId`, `role`, `departmentIds`, `permissions`; LECTURER/STUDENT bổ sung `assignmentKind`: ADVISOR/REVIEWER/COMMITTEE hoặc STUDENT_OWNER. Không tự tạo bằng chứng phân công để làm planner PASS.

```powershell
cd backend
node scripts/integration-rbac-plan.cjs <approved-account-snapshot.json>
node --test scripts/integration-rbac-plan.check.cjs
```

Planner yêu cầu đúng account active, role cùng permission, grant bộ môn chính xác (không chấp nhận allDepartments hoặc grant rộng hơn pilot), hoặc phân công đúng term. Nó chỉ trả `readyForAccessReview`, luôn giữ `productionChangesAuthorized: false` và `mutations: []`. Đây không phải chứng nhận an toàn end-to-end: API phải đọc lại phân công, ownership, revision, policy, trạng thái và cửa sổ thời gian ở thời điểm thao tác, bao gồm lúc commit transaction.

## Bằng chứng kiểm thử

`integration-rbac-plan.check.cjs` kiểm tra không cấp global grant khi thiếu action, không ghép ADMIN, sai term/bộ môn, allDepartments, grant rộng, account khóa, phân công chưa có hoặc sai term, dữ liệu trùng và đầu vào rỗng. Những test HTTP UC17/UC22/UC23/UC24 dùng JWT/session/RBAC thật trên loopback với persistence cô lập; phủ cả quyền có sẵn nhưng khác ownership/phân công và thiếu finalize/publish. Không kết nối production hoặc thay bộ manual staging.

## Điều kiện trước thay đổi production

Phải có danh sách account ID, term ID, department ID, phân công thật hiện hành và người quản lý quyền chấp thuận đúng action/phạm vi. Cần snapshot live READ ONLY về grants cùng backup/rollback đã xác minh. Gói chưa cấp bất kỳ grant nào; không dùng số liệu cũ trong tài liệu để coi đây là kiểm tra live. Nếu quyền còn thiếu chỉ có thể được cấp role-wide, giữ BLOCKED cho tới khi có scoped grant được triển khai và kiểm chứng hoặc phê duyệt rõ tác động toàn bộ role. Không mở flags hay tạo hồ sơ/điểm thật để chứng minh quyền.
