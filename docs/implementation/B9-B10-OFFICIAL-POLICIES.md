# Cấu hình 9 policy cho đợt thật

Phạm vi tài liệu này là chuẩn bị source trước khi nhóm triển khai `fix/integration-ui`. Không cần URL hoặc phiên đăng nhập host ở bước này. Không có policy production nào được ghi bởi các công cụ dưới đây.

## Mẫu có thể nhập và kiểm tra offline

Mẫu JSON được lưu tại `backend/prisma/deployment/application-policies/draft.template.json`; unit test đối chiếu mẫu này với factory theo từng field để phát hiện drift.

Sau khi build backend, chạy từ thư mục Project1:

```powershell
node backend/dist/defense/policies/policy-cli.js draft .cache/official-policy-draft.json
```

Lệnh tạo đúng 9 bộ trường theo contract hiện tại. Các trường có `__REQUIRED_DECISION__` là lựa chọn cần nhập; `approvedBy`, `approvedAt`, thông tin quyết định và phê duyệt biểu mẫu để `null`. Mọi policy có `status: DRAFT`. Lệnh từ chối ghi đè file có sẵn, không kết nối database, không tự chọn trọng số/bước điểm và không chuyển DRAFT thành APPROVED. Chưa có màn hình quản trị phê duyệt policy chuyên biệt; không coi màn hình cấu hình đợt hoặc công cụ chuyển đồng hồ nghiệm thu là màn hình đó.

Với bản đã được phê duyệt thật, tách object `policies` thành một JSON riêng, cung cấp facts được người vận hành xác minh độc lập và chạy:

```powershell
node backend/dist/defense/policies/policy-cli.js preflight .cache/official-policies.json .cache/verified-policy-facts.json .cache/policy-release-plan.json
```

Facts tuân theo `PolicyReleaseFacts` trong `backend/src/defense/policies/policy-release.ts`: term/bộ môn/giai đoạn, tài khoản thật và grants thực tế, quyết định phê duyệt, các policy hiện có, rubric thuộc đợt và phòng. Không tự điền facts từ cùng file policy rồi gọi đó là xác minh độc lập. Kết quả `OFFLINE_PREFLIGHT_NOT_APPLIED` chỉ là kế hoạch; không thực thi SQL. `contentHash` SHA-256 canonical ràng buộc **termId và toàn bộ chín policy**, `snapshotHash` ràng buộc facts. Khi thay một giá trị, quyết định cũ không đủ để áp dụng cấu hình mới.

## Các quyết định phải điền

| Policy | Trường nghiệp vụ cần người có thẩm quyền xác nhận | Căn cứ và giới hạn kỹ thuật |
| --- | --- | --- |
| UC17 | Bước điểm, rubric GVHD hoặc quyết định không dùng rubric, giới hạn PDF, BLOCK/INVALIDATE khi thay PDF sau xác nhận | Thang 10 đã được yêu cầu; schema điểm chỉ hỗ trợ một chữ số thập phân. FINAL lấy từ kế hoạch đợt; quyết định GVHD thủ công, từ chối phải có lý do; không suy ngưỡng đạt từ ví dụ TEST. |
| UC18 | FINAL/DEFENSE, ALL_ACTIVE_TASKS_PASSED hay UC17_REVIEW, danh sách nguồn học vụ và trách nhiệm xác minh | Contract chỉ hỗ trợ FACULTY_ATTESTATION có chứng cứ; chưa có adapter hệ thống học vụ tự động. Không dùng GPA/academicEligible legacy thay nguồn được duyệt. |
| UC19 | Số Chủ tịch/Thư ký, điều kiện chức danh, roster/bộ môn, quota hội đồng và tải sinh viên, cho phép chốt hội đồng rỗng hay không | 3–5 giảng viên và tránh GVHD của bất kỳ sinh viên thuộc hội đồng là yêu cầu đã xác định. `distinctOfficers=true`, SAME_DEPARTMENT sinh viên là giới hạn source hiện tại. |
| UC20 | Số GVPB, chuyên môn/chức danh, tải riêng/tổng, kiêm nhiệm hội đồng, người từng hướng dẫn, cross-department | Current GVHD luôn xung đột; PENDING_APPROVAL là blocker, không phải chấp thuận. Tổng tải source hiện tại là ADVISOR_PLUS_COMMITTEE_PLUS_REVIEW. |
| UC21 | Ngày/buổi, thời lượng/nghỉ/bước xếp, phòng/sức chứa/bộ môn, GVPB có mặt, công khai lịch, thứ tự thủ công/họ kép | Ngày hiển thị Asia/Ho_Chi_Minh, instant UTC; sắp Tên rồi Họ đệm theo contract; luôn kiểm tra xung đột ALL_TERMS. Phải đối soát lịch legacy dùng chung tài nguyên. |
| UC22 | Bước điểm, rubric hoặc điểm tổng, feedback/số câu hỏi, nháp, yêu cầu lịch công bố và cửa sổ quanh lịch | Rubric WEIGHTED_NORMALIZED_10_EXACT, tổng weight=1; ID criterion phải thuộc đúng đợt và đúng metadata. Chốt bất biến, source thay đổi bị chặn, điểm SV WITHHELD. |
| UC23 | Vai trò chấm, cửa sổ hiệu lực, rubric (min/max/step/weight/description), làm tròn, thiếu tiêu chí, evidence bảo vệ, anchor SESSION/SLOT | Rubric WEIGHTED_NORMALIZED_10; mỗi thành viên chấm độc lập; storage chỉ một chữ số thập phân, weight tối đa hai chữ số. Không tự làm tròn để hợp thức hóa dữ liệu không biểu diễn được. |
| UC24 | Thành phần và weight, GVHD hay quá trình UC16, aggregate GVPB/hội đồng, làm tròn/bước/precision, passRule/phân loại, ai xác nhận/chốt/công bố, phân tách người thao tác, ngày, điểm được SV xem | WEIGHTED_SUM là thuật toán hỗ trợ, **không phải công thức chính thức đã được duyệt**. Không dùng 20/20/60, ngưỡng 5 hoặc HALF_UP của TEST làm mặc định. Giữ producer locks và không đổi source đã chốt. |
| UC25 | Bộ mẫu thực tế, chủ sở hữu/phiên bản/cột/role/mốc hiệu lực, approved template/reference, nội dung điểm/nhận xét, công khai/thống kê, retention, signatureRoles | Mỗi mẫu phải có căn cứ riêng, đúng engine UC25_V1. `signature=UNSIGNED_ONLY`: file xuất không chứng minh đồng ký điện tử. Chữ ký số thật cần workflow/adapter riêng nếu Khoa yêu cầu. |

`null` trong một trường nullable (ví dụ không giới hạn quota, không dùng rubric, không đặt passRule) là **quyết định phải ghi rõ**, không phải chỗ trống được tự điền. Các mảng `breaks`, `classifications`, `compoundFamilyNames`, `distribution`, `allowMissing` rỗng trong mẫu cần được review như mọi giá trị khác. Các giá trị literal cố định trong mẫu mô tả giới hạn contract, không tuyên bố là quy định của Khoa.

## Trình tự nhập, phê duyệt và áp dụng sau này

1. Người có quyền cấu hình tạo kế hoạch đợt thật, kiểm tra danh mục phòng/rubric/roster và phạm vi bộ môn. Không tạo rubric ID ví dụ; criterion binding đối chiếu dữ liệu thật.
2. Điền tất cả lựa chọn còn thiếu theo quyết định thật. Định danh người duyệt là User ID đang active, FACULTY, có term grant và đủ department grants; việc được giao quyền kỹ thuật không tự tạo User ID hay văn bản của Khoa.
3. Lưu căn cứ quyết định bên ngoài bundle: ID, reference, purpose OFFICIAL, termId, timestamp thực tế, người duyệt thật và hash nội dung cuối cùng. Các trường approval trong policy/biểu mẫu phải khớp căn cứ được xác minh. Không dùng CURRENT_TIMESTAMP để giả thời điểm phê duyệt.
4. Chạy preflight offline trên facts độc lập và kiểm thử trong PG17 riêng. Preflight dùng chín runtime readers thật; kiểm tra lịch, room capacity/scope, rubric DB metadata, role chấm/xác nhận, đồng bộ trọng số và precision thông qua validators. Thời gian so bằng instant, không so chuỗi offset.
5. Người vận hành được phép áp dụng sau khi backup, target, quyền và concurrence đều được kiểm tra. Cần đọc lại facts trong cùng transaction, khóa đợt/các TERM_PARAMETER liên quan, so snapshot/hash và chỉ insert 9 khóa còn thiếu. Unique `(term_id,key)` là rào chặn cuối; không UPSERT đè cấu hình đang có. Module chuẩn bị kế hoạch không tự ghi DB hoặc bật flags.
6. Postflight đọc lại đúng 9 khóa, kiểm hash, runtime readers, scope/rubric, ACL và audit vận hành. Giá trị hiện có giống hệt là NOOP; thiếu một phần hoặc khác phiên bản là BLOCKED cần review riêng. Có hồ sơ nghiệp vụ đã ghi thì rollback không được xóa policy rồi làm hồ sơ stale; dùng recovery/versioned review có ảnh hưởng downstream được đánh giá rõ. Chỉ rollback 9 dòng chính gói vừa tạo khi chưa có consumer và body/hash còn nguyên, với quyền xử lý sự cố riêng.

Backend tự xác định hạn từ server và TERM_PHASE. Đổi giai đoạn thời gian không tự đổi trạng thái đợt/hồ sơ, không tự chốt/công bố. Hết hạn cần điều chỉnh kế hoạch đúng quyền/lý do/audit; không dùng TEST clock trên host production.

## Trạng thái readiness

Source có đủ chín contracts/readers, template DRAFT, preflight và test âm tính; có thể đưa lên nhánh tích hợp với write flags tắt. **Chưa có chín policy được phê duyệt và áp dụng production**. Host integration kiểm thử GET có thể triển khai theo kế hoạch của nhóm; mở toàn luồng ghi thực tế vẫn phụ thuộc quyết định từng đợt, mapping/grants tối thiểu, storage bền vững và kiểm chứng host sau deploy. Không có dữ liệu staging hoặc dấu APPROVED tổng hợp nào được sao chép sang Supabase.
