# Kế hoạch kiểm thử STEP_5 trước thực thi

Ngày 27/10/2026, Asia/Ho_Chi_Minh. Nguồn S1: docs/spec/dac-ta-use-case.md (Bước 5/UC13); S2: docs/implementation/01-business-decisions-and-contract.md (D03–D08/D13/D14, §3.2–3.5/§4.3/§5); S3: docs/implementation/05-step5-implementation-report.md, dùng mô tả chức năng và quyết định bổ sung, không dùng kết quả test cũ làm bằng chứng.

Đã được phép đăng nhập local từ phiên trước. Mặc định không ghi nghiệp vụ, không sửa code/config/dependency/migration, không seed/reset dữ liệu hiện có, không mock API hoặc thay response. Yêu cầu xác nhận mở rộng sang DB test local mới đã được gửi riêng; W* chỉ chạy khi xác nhận thực tế cho phép và đích test được kiểm chứng tách biệt. Nếu chưa có, W* = NOT RUN. Không coi thiếu fixture là bug. PASS chỉ khi đã chạy đủ expected; FAIL khi trái expected; BLOCKED khi thiếu dữ liệu/quyền/hạ tầng; NOT RUN khi chưa thực thi. Chỉ tạo evidence mới trong thư mục này.

| ID | Nguồn | Vai trò/điều kiện | Thao tác | Expected |
|---|---|---|---|---|
| E01 | MCP | Anonymous | Mở login, click hiện/ẩn mật khẩu | Trang thật mở được, input type đổi và khôi phục |
| A01 | S2 §5.1 | Anonymous | URL /topic/reviews | Login; không lộ queue |
| A02 | S2 §5.1 | Anonymous | URL /topic/reviews/:id | Login; không lộ version/comment/decision |
| A03 | S2 §5.1 | Anonymous | URL /topic/review-assignments/:proposalId | Login; không lộ form phân công |
| A04 | S2 §5.1 | Anonymous | GET 7 endpoint đọc canonical | 401 từng endpoint, không có dữ liệu học thuật |
| F01 | D03/D13 | FACULTY có quyền/grant | Sidebar và URL queue, đối chiếu identity/options/list | UI và response đúng đợt/bộ môn/scope |
| F02 | S3 | FACULTY | Tìm đề tài/tên/mã SV, không khớp, clear | Rows/totals đúng response; phục hồi sau clear |
| F03 | S2 §4.3 | FACULTY | Lọc trạng thái | Không nhầm proposal status với review state; rows đúng filter |
| F04 | D03 | FACULTY | Lọc bộ môn | Intersect grant; không lẫn department |
| F05 | S3 | FACULTY | Chỉ hồ sơ chưa có vòng active | Filter khớp activeReviewId và query API |
| F06 | D03 | FACULTY | Đổi đợt và quay lại | Header/list/options đúng term, không giữ group/version nhầm |
| F07 | D05/§3.2 | FACULTY | Đối chiếu phase và deadline hiển thị | Asia/Ho_Chi_Minh, đúng start/end/isLocked canonical |
| F08 | S2 §5.1 | FACULTY | API list limit nhỏ/pages; UI page controls | Pagination ổn định; phân biệt UI nhiều trang chưa đủ fixture |
| F09 | D03/D04/§3.5 | FACULTY | Mở candidates và đối chiếu groups | Đúng term/department, counts hợp lệ, không tự chọn theo điểm chuyên môn |
| F10 | S3 | FACULTY | Chọn nhóm trong form rồi Hủy/đi lại | Không auto-assign, không POST; selection chủ động |
| F11 | D05/§4.3 | FACULTY | Mở phân lại, xem reason và vòng cũ | Không thay version/nhóm trên vòng cũ; form thể hiện reassign cần reason |
| F12 | §4.3 | FACULTY | Đọc history/detail các round | Author/version/hash/time, comments và common decision tách biệt; một decision/vòng |
| F13 | §4.3 | FACULTY | GET/reload detail nhiều lần | Không auto-start/đổi proposal/review revision |
| R01 | D04/§4.3 | Reviewer member, không GVHD | Inbox/detail ASSIGNED | Chỉ vòng được phân; allowed start/comment phù hợp, chưa có quyết định khi chưa start |
| R02 | §4.3 | Reviewer | Detail IN_REVIEW nếu tồn tại | comment/decide theo quyền/state, không vote/quorum/chair bắt buộc |
| R03 | §4.3 | Reviewer/FACULTY | Detail DECIDED/SUPERSEDED | Read-only; không sửa kết luận cũ; lịch sử giữ nguyên |
| R04 | D04/D14 | GVHD chính thức | Đọc hồ sơ SV mình, kể cả có membership | Được đọc; không self-review bằng quyền GVHD |
| R05 | D04/D13 | GV ngoài nhóm và không GVHD | GET/detail tài nguyên ngoài quan hệ | 403/404, không lộ nội dung |
| R06 | D02/D13 | STUDENT owner | Đọc hồ sơ/vòng của mình | Đọc đúng ownership, không có action reviewer/assign |
| R07 | D02/D13 | STUDENT khác | GET/detail hồ sơ người khác | 403/404; không xuất nội dung ngoài scope |
| R08 | D13 | ADMIN-only | URL queue và GET canonical | Không bypass nghiệp vụ |
| R09 | D13 | COMMITTEE-only | URL/API khi có credentials được cấp | Không tự thành reviewer nếu không có quan hệ |
| R10 | D03/D13 | FACULTY ngoài grant/thiếu action | GET scope/action âm tính với fixture riêng | 403 thiếu action; 404 ngoài scope; không ghép quyền nhiều role |
| U01 | S3/UI | Các vai trò đã login | Nhãn input, keyboard Tab/Escape, điều hướng | Focus nhìn thấy, controls đúng vai trò, không kẹt bàn phím |
| U02 | S3/UI | FACULTY/reviewer | 390px queue/detail/assignment | Không tràn ngang toàn trang, đọc và điều hướng được |
| U03 | S3/UI | FACULTY/reviewer | Axe WCAG2A/AA/2.1AA | Ghi violation/incomplete thật, không suy WCAG toàn app |
| U04 | S3/UI | FACULTY | Loading/empty/GET error và recover | Không trang trắng/success giả; banner và phục hồi hợp lý |
| U05 | S3/UI | Reviewer có form | Nhập draft rồi đổi round và quay lại, không submit | Không mang draft/comment/decision sang vòng khác |
| B01 | S2 §5.1 | FACULTY | GET page/limit/status/unassigned/unknown/search dài sai | 400 envelope; không stack/Prisma |
| B02 | S3 | FACULTY | Search hoa/thường, trim và groupId API | Filter canonical đúng, không suy group filter UI nếu UI không có |
| B03 | S2 §4.3 | FACULTY | Snapshot đầu/cuối queue/options/history/detail | Dữ liệu đọc giữ nguyên trong phần chỉ đọc; không hash toàn DB |
| W01 | D03/D04/§4.3 | DB test riêng được phép ghi | Assign version SUBMITTED+SEALED hợp lệ | ASSIGNED mới, proposal vẫn SUBMITTED, một active round |
| W02 | D05/§4.3 | DB test riêng được phép ghi | Reassign có round/revisions/reason | Cũ SUPERSEDED, mới ASSIGNED; giữ history/comments/version cũ |
| W03 | §4.3 | DB test riêng được phép ghi | Reviewer explicit start | SUBMITTED→UNDER_REVIEW; ASSIGNED→IN_REVIEW; GET không start |
| W04 | §4.3 | DB test riêng được phép ghi | Nhiều reviewer append comment | Đúng actor/version/time; không overwrite comment |
| W05 | D04/D08 | DB test riêng được phép ghi | Decide APPROVED | Proposal APPROVED, review DECIDED, một decision; không tự finalize dossier |
| W06 | D06/§4.3 | DB test riêng được phép ghi | Decide REVISION_REQUIRED, thử thiếu/blank comment | Comment bắt buộc; proposal REVISION_REQUESTED, decision giữ REVISION_REQUIRED |
| W07 | S2 §5.1 | DB test riêng được phép ghi | POST unknown fields/actor giả/REJECTED/thiếu key/body sai | 400; không tạo dữ liệu dở, không REJECTED mới |
| W08 | D03/D04/D13 | DB test riêng được phép ghi | Assign sai term/department, reviewer ngoài nhóm/GVHD tự duyệt | Server chặn dù client gửi ID hợp lệ |
| W09 | S2 §3.2 | DB test riêng được phép ghi | Phase khóa/ngoài khoảng, term cấm, boundary deadline | Ghi đúng guards; không tự approve/reject quá hạn |
| W10 | D07/D14/§3.4 | DB test riêng được phép ghi | Stale version/agreement/routing, PUBLISHED thay FINALIZED | 409 đúng nguyên nhân; không lấy latest draft hoặc quyền assignment cũ |
| W11 | S2 §5.1 | DB test riêng được phép ghi | Đồng thời assign/comment và stale revision | CAS đúng, không lost update, một active round |
| W12 | D04/§4.3 | DB test riêng được phép ghi | Hai reviewer kết luận đồng thời | Một thành công, bên kia 409, một decision/vòng |
| W13 | S2 §5.1 | DB test riêng được phép ghi | Replay key cùng/khác payload | Cùng trả kết quả cũ, khác 409; không duplicate audit/outbox |
| W14 | D13 | DB test riêng được phép ghi | Thu hồi quyền sau cached result rồi replay | Kiểm quyền hiện hành trước replay; không leak result cũ |
| W15 | S2 audit/outbox | DB test riêng được phép ghi + DB đối chứng | Audit/history/notification/outbox rollback | Atomic; đúng người nhận; không dùng saved outbox làm bằng chứng đã gửi email |
| W16 | §4.3 | DB test riêng được phép ghi | Đọc vòng cũ và thử quyết định sau DECIDED/SUPERSEDED | Read-only, version cũ không ghi; không auto-approve khi đọc/quá hạn |

