# Smoke UC17–UC25 chỉ đọc — chuẩn bị, chưa chạy HTTP

12 ca GET cụ thể nằm trong `smoke-cases.json`, bao phủ options của 9 UC, UC24 list, UC25 templates/statistics. Controller GET gọi các luồng `repo.read`; UC24/UC25 service tiếp tục kiểm tra role + phạm vi. Không chạy app hoặc đăng nhập tự động. Cần backend/revision và tài khoản nghiệp vụ được nhóm cho phép trước khi chạy.

| Ca | Điều kiện / kết quả cần kiểm tra riêng tư |
| --- | --- |
| Không token | Mỗi route trả 401, không lộ dữ liệu. Token hết hạn là ca riêng dùng token thực đã hết hạn. |
| Tài khoản không có permission | 403 từ guard; không dùng tài khoản ADMIN để mặc định bỏ qua RBAC. UC24/25 đã đủ 27 definitions nhưng chưa có grants cho các quyền này, nên ca dương vẫn BLOCKED. |
| UC17 options | Chỉ các đợt của SV, phân công GVHD hoặc grant FACULTY hợp lệ; không xuất hiện hồ sơ người khác. |
| UC18/19/20 options | Chỉ term/department được cấp. Tài khoản không có grant trả rỗng hoặc lỗi theo service; không coi rỗng là thành công nghiệp vụ. |
| UC21 options | Phạm vi hợp lệ; không lộ lịch/nhân sự ngoài chính sách. Chưa có policy phải hiển thị blocker hoặc rỗng theo contract, không được tự suy ra lịch hợp lệ. |
| UC22/23 options | Đúng GVPB/thành viên hội đồng; không lộ phiếu/điểm độc lập của người khác. Không có phân công thật thì ghi BLOCKED cho ca dương. |
| UC24 options/list | Đúng term, bộ môn, hội đồng hoặc sở hữu SV; không lộ scores/sources/history khi thiếu permission. Policy thiếu phải thể hiện blocker tương ứng; 200 không chứng minh tính được kết quả. |
| UC25 templates | Đúng mẫu/role/version; mẫu không được duyệt không được coi là bản chính thức. LECTURER cần `committeeId` hội đồng thực của mình, ngoài `termId`. |
| UC25 statistics | Không grade/score hoặc phân bố nhạy cảm khi thiếu quyền tương ứng. Đúng phạm vi term/department/hội đồng và trạng thái theo policy. |
| Phạm vi âm | Dùng một term/hội đồng CÓ THẬT được nhóm cho phép làm đối chứng ngoài phạm vi; trả 403/404 hoặc tập rỗng theo contract. Không đoán UUID/đổi ID để dò dữ liệu. |
| SV và nhiều role | SV không thấy điểm chưa công bố. Người có nhiều role không được ghép quyền khác role để vượt service. Kiểm tra cùng dữ liệu được duyệt, không tạo account/quyền để test. |

Danh sách chi tiết hồ sơ/phiếu/PDF/history chỉ mở rộng khi nhóm cung cấp ID thật và scope; không tự tạo fixture. Kiểm tra đúng ownership, revision, redaction và trạng thái nguồn. Không có file/hội đồng/phiếu thật thì ghi BLOCKED, không tạo điểm để làm ca dương.

**Loại khỏi lượt READ ONLY:** mọi submit/save/review/decide/confirm/finalize/publish/export; `POST /defense-reports/exports/:id/download` vì ghi audit/idempotency. Hai preview POST UC24/25 hiện gọi repo.read nhưng không nằm trong runner GET này. Các API tải PDF cũng chưa nằm trong allowlist; cần đối chiếu riêng quyền, storage và side effects trước khi bổ sung.

Runner mặc định chỉ in kế hoạch offline:

```powershell
node backend/scripts/smoke-uc17-25-readonly.cjs
```

Sau khi nhóm duyệt account/target/scope, nạp biến **chỉ trong tiến trình** bằng phương thức giữ bí mật, không sửa `.env` hoặc dán token vào shell history: `UC_SMOKE_APPROVED=true`, `UC_SMOKE_ORIGIN` (HTTPS origin, không /api), `UC_SMOKE_CASE`, `UC_SMOKE_EXPECT_STATUS` (200/401/403/404), `UC_SMOKE_TOKEN` (trừ ca 401), và khi cần `UC_SMOKE_TERM_ID`, `UC_SMOKE_COMMITTEE_ID` đã được duyệt. Chạy một ca mỗi lần bằng `node backend/scripts/smoke-uc17-25-readonly.cjs --execute`. Chưa chạy lệnh execute trong lượt này.

Runner chỉ GET, không theo redirect, không in response body/URL/token/PII; HTTP status khớp chỉ được ghi `PASS_STATUS_ONLY_CONTENT_ASSERTIONS_PENDING`. Người nghiệm thu phải kiểm tra nội dung, redaction và phạm vi riêng tư rồi mới ký PASS ca. Không giả lập JWT, không bật flags, không dùng script rehearsal fixtures lên Supabase. HTTP GET vẫn có thể làm hạ tầng cập nhật telemetry/session; nếu yêu cầu database tuyệt đối không có ghi từ middleware, cần xác nhận backend runtime trước khi chạy.

Ghi kết quả: alias actor, role, UC/case, scope alias, policy version hoặc MISSING, timestamp, expected/actual status, redaction/scope assertions, PASS/FAIL/BLOCKED. Bằng chứng chứa điểm/PDF/tên thật lưu ngoài Git theo quyền nhóm phê duyệt. Nghiệm thu ghi điểm và end-to-end chỉ thực hiện ở lượt được duyệt riêng.
