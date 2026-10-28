# Báo cáo kiểm thử thực tế STEP_4 — Playwright MCP

Ngày 27/10/2026, múi giờ Asia/Ho_Chi_Minh. Khảo sát và thực thi khoảng 20:45–21:08; thời gian ISO của từng đoạn nằm trong JSON. Viết báo cáo sau khi hoàn tất thao tác browser.

**Kết luận:** Playwright MCP đã mở ứng dụng thật và tương tác thành công. Phần đọc/quyền truy cập đã kiểm có kết quả đúng trong các ca ghi PASS, nhưng phát hiện **2 lỗi UI/keyboard**. **Chưa đủ bằng chứng nghiệm thu toàn bộ bước 4**, vì 9 nhóm ca ghi chưa được phép chạy và 5 nhóm ca thiếu fixture/phạm vi đối chứng.

Có **41 nhóm test case: 24 PASS, 3 FAIL, 5 BLOCKED, 9 NOT RUN**. Ba dòng FAIL tương ứng hai bug: G09 và U02 cùng ghi nhận lỗi focus mobile; U01 là lỗi tên thành viên. Đây là số nhóm ca trong ma trận, không phải số request hoặc số bug.

## 1. Môi trường, nguồn chuẩn và quyền thực thi

| Hạng mục | Thực tế |
|---|---|
| Frontend | http://127.0.0.1:5173 — đối chiếu Local URL của Vite, TCP listener và /@vite/client được tải trong browser |
| Backend thực sự được frontend gọi | http://127.0.0.1:3000/api |
| Nhánh/HEAD | fix/integration-ui / 0c361709df34837df65b3ed429691599e6e2d93f; worktree có thay đổi sẵn từ trước |
| Đợt chính | DEMO 4–8 · Hồ sơ, xét duyệt và hướng dẫn; d4e2575a-c68d-40f7-8398-3fdcf34af59b; IN_PROGRESS |
| Đợt đối chiếu | Đợt mẫu kiểm tra giao diện sau merge; 726d8edf-bac0-47c3-bb9e-f8ce0b39cbcc; OPEN_REGISTRATION |
| Bộ môn được trả cho giaovu | Công nghệ phần mềm |
| Dữ liệu đầu lượt | 2 nhóm: hkt và Nhóm duyệt DEMO 4–8 · Công nghệ phần mềm; mỗi nhóm 2 thành viên, 1 vòng active, revision 0 |
| Tài khoản đã thực sự đăng nhập | giaovu, gv004, gv003, sv001, admin, gv002 — identity/role đối chiếu bằng /auth/me |
| Browser viewport | Desktop 1440×1000; mobile 390×844 |
| Database | Tài liệu vận hành xác định PostgreSQL local btl_integration_ui; lượt này không kết nối SQL trực tiếp, không xác nhận runtime DB bằng truy vấn |
| Đích ghi được phép | Chỉ phiên/audit xác thực và lastLoginAt theo xác nhận riêng của người dùng; không ghi nghiệp vụ |

Nguồn expected result:
- **S1:** [Đặc tả use case — Bước 4/UC13](../../../spec/dac-ta-use-case.md).
- **S2:** [Business decisions and contract](../../../implementation/01-business-decisions-and-contract.md): D03/D04/D05/D13, §3.2, §5.1.
- **S3:** [Test plan bước 4](../../../implementation/04-test-plan.md).
- Tham khảo hiện trạng: [Báo cáo bước 4](../../../implementation/04a-step4-implementation-report.md), [template UI](../../../implementation/04b-step4-template-ui.md), [UI workflow demo](../../../implementation/integration-ui-workflow-demo.md), [integration UI fixes](../../../implementation/integration-ui-fixes-2026-10-27.md), các finding trong docs/qa-step-4-8. Kết quả cũ không được dùng để tính PASS lần này.

Không phát hiện AGENTS.md áp dụng trong các đường dẫn đã tìm ở workspace/parent. [Kế hoạch ban đầu](plan.md), [kế hoạch bổ sung](supplemental-plan.md), [xác nhận cho phép đăng nhập](authorization.md). Dòng “đang chờ” trong kế hoạch ban đầu ghi nhận thời điểm trước khi nhận xác nhận; quyền mới được ghi riêng để giữ lịch sử.

Không dùng mock/interception thay response, seed/reset/migration hoặc các runner lịch sử. Không sửa source/config/dependency. Không thực hiện thao tác phân hồ sơ/ra quyết định bước 5. Token thật từ phiên đăng nhập UI chỉ được dùng nguyên vẹn trong bộ nhớ cho GET có xác thực, không sửa token, không xuất header/token ra evidence.

## 2. Những gì đã được chứng minh

- Sidebar và URL trực tiếp mở cùng danh sách đúng đợt. Thống kê 2 nhóm, 3 GV duy nhất trên trang và 2 vòng active khớp response thật.
- Tìm kiếm hkt → 1 nhóm, không khớp → 0, xóa tìm kiếm → 2; tìm HKT và khoảng trắng quanh hkt có cùng kết quả. Đổi đợt đồng bộ header và reset bộ lọc bộ môn.
- Form IN_PROGRESS khả dụng; OPEN_REGISTRATION không có link tạo và form trực tiếp bị khóa. Đổi đợt trong form xóa tên/thành viên chưa lưu.
- Form sửa nhóm có activeReviewCount=1 không cho đổi thành viên; bộ môn bị khóa. Chỉ xác nhận hành vi UI, chưa chứng minh tất cả nhánh chặn của mutation server.
- Hủy draft và đóng xác nhận lưu trữ không phát sinh request ghi nghiệp vụ. Snapshot group views đầu/cuối giống nhau.
- gv004 thực tế là Giảng viên T, tham gia 2 nhóm; gv003 là Giảng viên Z, tham gia 1 nhóm. Cả hai read-only. Không suy membership từ tên tài khoản hoặc tài liệu seed cũ.
- gv003 truy cập hkt ngoài membership bị 404 ở API detail/members và thông báo đúng ở UI. gv002 không có membership nhận danh sách rỗng và detail 404.
- sv001 và ADMIN-only đều bị chặn URL list; từng vai trò có 4 GET canonical trả 403. Không coi ẩn menu là bằng chứng duy nhất cho server authorization.
- API phân trang limit=1 trả hai trang có ID khác nhau và trang ba rỗng. Bảy query sai trả 400. UI hiện error banner cho search dài rồi phục hồi về hai nhóm sau khi clear.
- Đã quan sát loading status thật khi reload, không mock hoặc thêm độ trễ giả.
- Axe 4.14.0, tags wcag2a/wcag2aa/wcag21aa: **0 violation** trên list desktop, form desktop và form mobile. Không suy thành WCAG toàn ứng dụng; kiểm tay vẫn tìm được lỗi focus.
- Thông tin cập nhật nhóm hiển thị 09:57:39 ngày 27/10/2026 tương ứng timestamp 02:57:39Z. Không thấy deadline phase trên các màn nhóm đã mở nên chưa đối chiếu deadline.

## 3. Bug đã tái hiện

### STEP4-MCP-001 — Tên thành viên đã chọn biến thành UUID khi tìm giảng viên khác

**Mức độ/ưu tiên đề xuất: P3 (minor).** Ảnh hưởng nhận diện người đã chọn; chưa có bằng chứng mất selection hoặc lưu sai thành viên.

Điều kiện: giaovu mở Tạo nhóm trong đợt demo.
1. Chọn Giảng viên T.
2. Quan sát chip “Giảng viên T ×”.
3. Tìm “Giảng viên Z”.
4. Quan sát chip của người đã chọn.

Expected: tên Giảng viên T tiếp tục hiển thị dù không thuộc kết quả tìm kiếm hiện tại.

Actual: chip đổi thành “93355433-df35-48b3-b85a-cb1ddf0545e4 ×”; số lượng vẫn 1. Xóa search thì tên hiện lại. Đã tái hiện cả với search không có kết quả và với search Z có một kết quả. Không bấm Tạo nhóm.

Nguồn: S3 về nhãn/khả năng nhận diện thành viên, và yêu cầu giữ lựa chọn khi tìm kiếm. [Bằng chứng JSON](BUG01-reproduction.json), [ảnh trước](BUG01-selected-member-before.png), [ảnh sau](BUG01-selected-member-after.png), [lần quan sát đầu](G06-G08-create-candidate-reset-cancel.json).

Nguyên nhân phù hợp với mã hiện tại: [components.tsx](../../../../frontend/src/features/review-groups/components.tsx), khoảng dòng 291–305, lấy tên từ options của trang/kết quả hiện tại rồi fallback sang ID. Đây là kết luận đối chiếu source với biểu hiện UI, không phải lỗi backend đã chứng minh. Hướng sửa đề xuất: giữ metadata người được chọn độc lập kết quả tìm kiếm, dùng tên đọc được cả trên chip và accessible name. Không sửa trong lượt này.

### STEP4-MCP-002 — Sidebar mobile đã đóng vẫn nhận focus ngoài màn hình

**Mức độ/ưu tiên đề xuất: P3 (minor).** Ảnh hưởng người dùng bàn phím: focus có thể mất khỏi phần nhìn thấy; không chứng minh truy cập vượt quyền.

Điều kiện: viewport 390×844, giaovu ở trang nhóm.
1. Bấm Mở điều hướng.
2. Nhấn Escape để đóng; focus vẫn trên nút menu, aria-expanded=false.
3. Nhấn Shift+Tab.

Expected: focus chuyển đến phần tử đang nhìn thấy; điều hướng đã đóng không nằm trong tab order.

Actual: focus tới nút Đăng xuất trong sidebar ngoài màn hình, x=-51.8 px, width=33 px, cạnh phải âm; whollyOutsideViewport=true. Sidebar inert=false, không aria-hidden. Đã tái hiện lại bằng click và bàn phím, không cần ép focus vào phần tử ẩn.

Nguồn: S3 về labels/roles và kiểm thử keyboard. [JSON tái hiện](BUG02-mobile-offscreen-focus.json), [ảnh trạng thái](BUG02-mobile-offscreen-focus.png), [quan sát mobile](G09-G10-mobile-keyboard.json).

Đối chiếu source: [WorkspaceLayout.tsx](../../../../frontend/src/app/layouts/WorkspaceLayout.tsx), khoảng dòng 137, và [index.css](../../../../frontend/src/index.css), khoảng dòng 1289: sidebar được dịch ra ngoài màn hình; DOM kiểm tra không có inert. Hướng sửa đề xuất: loại sidebar đóng khỏi tab order/accessibility tree và quản lý focus theo trạng thái menu. Axe không bắt được lỗi trong các scan này. Không sửa trong lượt này.

## 4. Ma trận thực thi đầy đủ

PASS chỉ áp dụng cho actual và phạm vi ghi trong từng dòng. BLOCKED không đồng nghĩa app sai; NOT RUN không được tính PASS. Các nhóm W* giữ nguyên vì chưa có quyền ghi nghiệp vụ trên môi trường test riêng.

| ID | Status | Nguồn | Vai trò, dữ liệu và thao tác | Expected | Actual/phạm vi kết luận | Evidence |
|---|---|---|---|---|---|---|
| E01 | PASS | Yêu cầu MCP | Anonymous; mở login và click hiện/ẩn mật khẩu | Trang thật, input đổi text rồi password | Đã mở Vite client; toggle và khôi phục thành công | [E01-toggle-shown.txt](E01-toggle-shown.txt), [E01-login.png](E01-login.png) |
| A01 | PASS | S2 §5.1 | Anonymous; mở URL list | Redirect login, không lộ nhóm | /login; 0 bảng nhóm | [anonymous-results.json](anonymous-results.json), [A01-anonymous.png](A01-anonymous.png) |
| A02 | PASS | S2 §5.1 | Anonymous; GET 5 endpoint đọc | 401, không dữ liệu nhóm | 5/5 trả 401 AUTH_003 | [anonymous-results.json](anonymous-results.json) |
| A03 | PASS | S2 §5.1 | Anonymous; URL /new | Không có form quản lý khả dụng | Redirect /login | [anonymous-results.json](anonymous-results.json), [A03-anonymous.png](A03-anonymous.png) |
| A04 | PASS | S2 §5.1 | Anonymous; URL detail ID tổng hợp | Không có chi tiết khả dụng | Redirect /login; chỉ kiểm auth, không chứng minh ID tồn tại | [anonymous-results.json](anonymous-results.json), [A04-anonymous.png](A04-anonymous.png) |
| G01 | PASS | S1/S2 D03 | giaovu; sidebar và URL trực tiếp | Cùng trang đúng đợt | Cả hai mở demo term và 2 nhóm | [G01-G02-faculty-list.json](G01-G02-faculty-list.json), [G01-faculty-list.png](G01-faculty-list.png) |
| G02 | PASS | S2 D03/D13 | giaovu; đối chiếu identity/list/options | FACULTY có quyền; UI khớp canonical response | FACULTY, read/manage; đúng 1 bộ môn; 2 nhóm, 3 GV duy nhất, 2 vòng active | [G01-G02-faculty-list.json](G01-G02-faculty-list.json), [G09-accessibility-desktop.json](G09-accessibility-desktop.json) |
| G03 | PASS | S2 D03 | giaovu; đổi demo → đợt cũ → demo | Không lẫn nhóm/header/bộ lọc bộ môn | 2 → 0 → 2; header đồng bộ, department reset | [G03-G04-filters-terms.json](G03-G04-filters-terms.json), [G03-old-term.png](G03-old-term.png) |
| G04 | PASS | S3 | giaovu; search hkt/no-match/clear; lọc bộ môn | 1/0/2 nhóm; thống kê đúng | Đúng; Trước/Sau disabled ở trang 1/1; UI nhiều trang tách R06 | [G03-G04-filters-terms.json](G03-G04-filters-terms.json), [G04-empty-search.png](G04-empty-search.png) |
| G05 | PASS | S3 | giaovu; detail, edit và reload | Thông tin/role/số lượng khớp response | 2 thành viên MEMBER; 1 vòng active; revision 0 | [G05-G08-detail-lock-cancel.json](G05-G08-detail-lock-cancel.json), [G05-G08-detail-lock-cancel-retry.json](G05-G08-detail-lock-cancel-retry.json), [G05-detail.png](G05-detail.png) |
| G06 | BLOCKED | S2 D04/S3 | giaovu; đọc 4 candidates, chọn/search/clear | Candidate đúng roster/active/role; không cấm khác bộ môn | UI khớp 4 candidates và giữ lựa chọn. Không đủ fixture GV khác bộ môn/inactive/cross-term hoặc DB read độc lập để xác minh toàn bộ eligibility; lỗi tên tách U01 | [G06-G08-create-candidate-reset-cancel.json](G06-G08-create-candidate-reset-cancel.json) |
| G07 | BLOCKED | S2 §3.2 | giaovu; form demo IN_PROGRESS và đợt cũ OPEN_REGISTRATION | Chuẩn bị nhóm đúng trạng thái, không đòi preconditions bước sau | IN_PROGRESS mở form; OPEN_REGISTRATION read-only và không link tạo. Thiếu DRAFT/CLOSED_REGISTRATION/đợt không proposal/phase đóng để xác minh các nhánh còn lại | [G06-G08-create-candidate-reset-cancel.json](G06-G08-create-candidate-reset-cancel.json), [G07-old-term-form-readonly.png](G07-old-term-form-readonly.png) |
| G08 | PASS | S3/ràng buộc dữ liệu | giaovu; draft tên/lý do/thành viên rồi Hủy; đóng xác nhận archive bằng toggle | Không mutation; reload giữ nguyên | Không POST/PATCH/DELETE nghiệp vụ; 2 nhóm giữ nguyên revision 0 | [G05-G08-detail-lock-cancel-retry.json](G05-G08-detail-lock-cancel-retry.json), [G06-G08-create-candidate-reset-cancel.json](G06-G08-create-candidate-reset-cancel.json), [final-verification.json](final-verification.json) |
| G09 | FAIL | S3 accessibility | giaovu; Tab/Shift+Tab desktop, menu mobile/Escape | Focus rõ ràng và không vào sidebar đóng | Desktop name → department → name đúng. Mobile Shift+Tab vào Đăng xuất x=-51.8 ngoài viewport; cùng lỗi U02 | [G09-accessibility-desktop.json](G09-accessibility-desktop.json), [BUG02-mobile-offscreen-focus.json](BUG02-mobile-offscreen-focus.json) |
| G10 | PASS | S3 responsive | giaovu; list/detail/form ở 390×844 | Không tràn ngang toàn trang, thao tác điều hướng được | document/body ~375px < viewport 390px; mở detail/form và Hủy được. Lỗi focus được ghi riêng G09/U02 | [G09-G10-mobile-keyboard.json](G09-G10-mobile-keyboard.json), [G10-list-mobile.png](G10-list-mobile.png), [G10-detail-mobile.png](G10-detail-mobile.png), [G10-form-mobile.png](G10-form-mobile.png) |
| G11 | PASS | S2 D04/D05 | giaovu; quan sát các field form/detail | Không tự thêm trưởng nhóm/quorum/phiên phòng; deadline nếu hiện phải đúng phase | Không có field thêm trái baseline; vai trò MEMBER. Không hiển thị deadline trên các màn này, không kết luận đã đối chiếu thời hạn phase | [G06-G08-create-candidate-reset-cancel.json](G06-G08-create-candidate-reset-cancel.json), [G05-G08-detail-lock-cancel.json](G05-G08-detail-lock-cancel.json) |
| P01 | PASS | S2 D04/D13 | gv004/gv003; list/detail; URL edit trực tiếp | Chỉ nhóm là thành viên; read-only; options không lộ roster toàn đợt | gv004 là T thấy 2 nhóm, gv003 là Z thấy 1 nhóm; canManage=false; own options 1 GV; edit redirect /forbidden | [P01-P02-lecturer-member-scope.json](P01-P02-lecturer-member-scope.json), [P01-P02-gv003-scope.json](P01-P02-gv003-scope.json), [P01-lecturer-edit-forbidden.png](P01-lecturer-edit-forbidden.png) |
| P02 | PASS | S2 D04/D13 | gv003 không member hkt; gv002 không member nhóm nào; GET/detail UI | Không đọc được nhóm ngoài membership | gv003 detail/members hkt 404; gv002 list 200 rỗng và detail 404; UI hiển thị lỗi đúng; đợt cũ 200 rỗng không phải leak | [P01-P02-gv003-scope.json](P01-P02-gv003-scope.json), [P02-cross-term-clarification.json](P02-cross-term-clarification.json), [P02-gv002-no-membership.json](P02-gv002-no-membership.json) |
| P03 | PASS | S2 D13 | sv001; URL list/new và 4 GET canonical | UI deny, server deny; không chỉ ẩn menu | /forbidden, không link nhóm; 4/4 API 403 AUTH_004 | [P03-student-deny.json](P03-student-deny.json), [P03-student-forbidden.png](P03-student-forbidden.png) |
| P04 | PASS | S2 D13 | admin chỉ ADMIN; URL và 4 GET canonical | Không bypass quyền học thuật | ADMIN-only, không review permission; UI /forbidden; 4/4 API 403 | [P04-admin-deny.json](P04-admin-deny.json), [P04-admin-forbidden.png](P04-admin-forbidden.png) |
| P05 | BLOCKED | S2 D13 | Cần COMMITTEE-only có credentials được cấp | Không tự là reviewer | Không có tài khoản COMMITTEE-only được cung cấp; không tạo/sửa role | [authorization.md](authorization.md), [plan.md](plan.md) |
| P06 | BLOCKED | S2 D03/D13 | Cần FACULTY thiếu action/ngoài grant/bộ môn khác | 403 thiếu action; 404 ngoài scope tài nguyên | Chỉ có giaovu hợp lệ trong dữ liệu được phép; không giả token hoặc đổi grant để tạo nhánh âm tính | [authorization.md](authorization.md), [plan.md](plan.md) |
| W01 | NOT RUN | S3 | DB test riêng được phép ghi; tạo tên blank/space/unknown field | Validation đúng; không ghi dở | Không submit mutation. Quy tắc unique tên nhóm chưa được chốt rõ; không tự coi tên trùng là lỗi | [plan.md](plan.md) |
| W02 | NOT RUN | S2 D04/S3 | DB test riêng; tạo với duplicate/unknown/cross-term/inactive member | Từ chối từng nhánh, không nhóm dở | Chưa được phép ghi và thiếu fixture độc lập | [plan.md](plan.md) |
| W03 | NOT RUN | S2 D04 | DB test riêng; tạo nhiều nhóm/bộ môn và GV nhiều nhóm | Tạo hợp lệ rồi reload xác nhận | Chỉ đọc thấy dữ liệu hiện có hỗ trợ nhiều nhóm/membership; không thay kiểm luồng tạo | [plan.md](plan.md), [G01-G02-faculty-list.json](G01-G02-faculty-list.json) |
| W04 | NOT RUN | S3 | DB test riêng; update reason/revision và thử term/department | Update hợp lệ; trường bất biến reject | Chỉ kiểm UI department disabled và Hủy; không kiểm server PATCH | [plan.md](plan.md), [G05-G08-detail-lock-cancel-retry.json](G05-G08-detail-lock-cancel-retry.json) |
| W05 | NOT RUN | S2 §5.1/S3 | DB test riêng; CAS 2 tab/idempotency replay/conflict | Không lost update/trùng history | Không gửi mutation; chưa xác minh CAS/idempotency live | [plan.md](plan.md) |
| W06 | NOT RUN | S3 | DB test riêng có ASSIGNED/IN_REVIEW/legacy; đổi membership | Server chặn từng trạng thái | UI khóa active count=1 đã quan sát; chưa thử lệnh ghi hoặc phân loại trạng thái từng review | [plan.md](plan.md), [G05-G08-detail-lock-cancel-retry.json](G05-G08-detail-lock-cancel-retry.json) |
| W07 | NOT RUN | S3 | DB test riêng; archive nhóm có/không review | Chặn khi có review; soft archive giữ lịch sử | Chỉ mở/đóng xác nhận, không bấm Xác nhận xóa | [plan.md](plan.md), [G05-G08-detail-lock-cancel.json](G05-G08-detail-lock-cancel.json), [G05-G08-detail-lock-cancel-retry.json](G05-G08-detail-lock-cancel-retry.json) |
| W08 | NOT RUN | S2 §3.2 | DB test riêng đủ trạng thái; thử mutation | Cho/chặn ghi theo status đúng | UI quan sát 2 trạng thái không thay test ghi mọi trạng thái | [plan.md](plan.md) |
| W09 | NOT RUN | S3 | DB test riêng + phép ghi + đối chứng DB read-only | Atomic group/member/history/audit và rollback | Không kết nối DB trực tiếp, không fault injection, không mutation | [plan.md](plan.md) |
| Q01 | PASS | Yêu cầu telemetry | Các chunk đã chạy + console/network MCP | Thu và phân loại đúng lỗi | 0 pageerror/failed request trong telemetry đã lưu; 6 console resource errors thuộc negative 404/400; không HTTP5xx ghi nhận | [telemetry-summary.json](telemetry-summary.json), [console-errors-final.log](console-errors-final.log), [network-final.log](network-final.log) |
| R01 | PASS | S2 §5.1/S3 | giaovu; GET limit=1 pages 1/2/3 | 2 nhóm, IDs disjoint, trang 3 rỗng | 200 cả 3; total=2, pages 1/2 mỗi trang 1 nhóm khác nhau, page3 rỗng | [R01-R05-read-boundaries.json](R01-R05-read-boundaries.json) |
| R02 | PASS | S3 validation query | giaovu; 7 query sai page/limit/unknown/search length | 400 envelope, không stack/Prisma | 7/7 trả 400 COMMON_003 | [R01-R05-read-boundaries.json](R01-R05-read-boundaries.json) |
| R03 | PASS | S3 search | giaovu; HKT và space-hkt-space | Case insensitive và trim | Cả hai 200, total 1, cùng ID hkt | [R01-R05-read-boundaries.json](R01-R05-read-boundaries.json) |
| R04 | PASS | Yêu cầu error/recovery | giaovu; search UI 256 ký tự rồi clear | Error banner rõ; không success giả; phục hồi | Banner 400, không blank page; clear: 2 rows, 0 alert; thông báo validation hiện bằng tiếng Anh | [R01-R05-read-boundaries.json](R01-R05-read-boundaries.json), [R04-search-error.png](R04-search-error.png) |
| R05 | PASS | Ràng buộc giữ dữ liệu | So sánh canonical group views đầu/cuối | Cùng group views, revision, timestamps, member IDs | sameGroupViews=true cho cả 2 nhóm; không suy ra hash toàn DB | [final-verification.json](final-verification.json) |
| R06 | BLOCKED | S3 UI pagination | Cần >20 nhóm và >20 candidates | Bấm Trước/Sau và giữ selection qua trang | Dữ liệu chỉ 2 nhóm/4 candidates; chỉ kiểm trạng thái trang 1/1; API limit=1 không thay kiểm UI | [G03-G04-filters-terms.json](G03-G04-filters-terms.json), [G06-G08-create-candidate-reset-cancel.json](G06-G08-create-candidate-reset-cancel.json) |
| U01 | FAIL | S3 labels/giữ thành viên khi tìm kiếm | giaovu; chọn T rồi tìm Z | Chip giữ tên T, lựa chọn vẫn nhận diện được | Chip đổi Giảng viên T thành UUID; count vẫn 1; tái hiện cả search rỗng kết quả và search Z | [BUG01-reproduction.json](BUG01-reproduction.json), [BUG01-selected-member-before.png](BUG01-selected-member-before.png), [BUG01-selected-member-after.png](BUG01-selected-member-after.png) |
| U02 | FAIL | S3 keyboard/mobile | giaovu; 390px, mở menu → Escape → Shift+Tab | Không focus điều hướng đã đóng ngoài màn hình | Focus Đăng xuất x=-51.8, width 33, whollyOutsideViewport=true, inert=false; cùng bug G09 | [BUG02-mobile-offscreen-focus.json](BUG02-mobile-offscreen-focus.json), [BUG02-mobile-offscreen-focus.png](BUG02-mobile-offscreen-focus.png) |
| L01 | PASS | Yêu cầu loading | giaovu; reload thật, không mock/throttle | Quan sát đúng status đang tải rồi list thật | Đã bắt được status Đang tải nhóm duyệt…; sau đó 2 nhóm | [final-verification.json](final-verification.json) |

Dữ liệu có máy đọc và tổng đếm: [test-cases.json](test-cases.json). G09 và U02 cùng một bug, không đếm thành hai lỗi độc lập.

## 5. Console, page errors và network

[Telemetry summary](telemetry-summary.json), [console errors](console-errors-final.log), [console warnings](console-warnings-final.log), [network browser](network-final.log).

- **0 page error và 0 requestfailed** trong các đoạn có listener đã ghi. Không ghi nhận HTTP 5xx trong browser network log hoặc các probe đã lưu.
- **6 console error entries**, đều là resource errors của negative tests: 4 lần 404 khi mở ID không tồn tại/ngoài membership, 2 lần 400 khi search vượt 255 ký tự. Đây là response từ chối theo kỳ vọng; không báo “console 0 errors”.
- **17 warning entries**, cùng loại React Router future flag v7_startTransition, lặp qua navigation. Không dùng số tổng ở header MCP cho một navigation để thay số dòng trong export all-session.
- Các API probe page.request (401/403/404/400) được lưu trong JSON từng ca, không nằm đầy đủ trong browser_network_requests. Đây là HTTP response có status, không phải failed network request ở tầng transport.
- Network browser ghi **7 login + 7 logout**, tất cả POST tới auth. **0 POST/PUT/PATCH/DELETE ngoài auth**. Không ghi request body hoặc authorization header vào evidence.
- Buffer network/console MCP bao phủ session; timestamp các chunk JSON xác định phần của lượt chạy này. Không cộng dồn các export console trung gian vì chúng chứa cùng entry.

## 6. Sai sót harness và cách phân loại

Các điều chỉnh dưới đây được giữ minh bạch, không ghi thành bug ứng dụng hoặc PASS giả:

- Một lần dùng globalThis giữa hai lời gọi MCP không giữ được state, gây TypeError sau các GET anonymous. Đã chuyển sang đoạn tự chứa và chạy lại; kết quả dùng nghiệm thu ở anonymous-results.json.
- Một waitForResponse khi xóa search timeout vì React Query dùng dữ liệu cache, không tạo request mới. Đã đối chiếu UI/canonical response và dùng điều kiện DOM ở lượt lại.
- Một lần tìm nút Hủy trong xác nhận archive timeout vì UI dùng chính nút Xóa nhóm để toggle đóng. Đã đóng bằng toggle, không submit archive; kết quả retry và group views không đổi.
- Một lần đợi textbox trên URL sửa bằng lecturer timeout vì route đã chặn đúng và chuyển /forbidden. Đã xác nhận URL/heading/screenshot; không gọi đó là lỗi form.
- Probe đợt cũ của gv003 ban đầu gắn cờ unexpectedDataReturned chỉ theo status 200. Kiểm tra tiếp xác nhận total=0, returnedCount=0; không có nội dung nhóm ngoài scope. Xem [clarification](P02-cross-term-clarification.json). Không báo IDOR từ cờ harness này.

Các JSON có runnerError lưu lại là các lần thử chưa hoàn tất. Ma trận dùng actual được đối chứng ở lần retry và evidence bổ sung, không che những lần thử ban đầu.

## 7. Phần chưa thể kết luận

- Tạo/sửa/thêm/xóa thành viên/lưu trữ thật; validation mutation; CAS hai tab; idempotency; transaction/audit rollback. Cần DB test riêng và quyền ghi được xác nhận trước khi chạy W01–W09.
- Chuẩn bị nhóm ở DRAFT/CLOSED_REGISTRATION, các trạng thái cấm còn lại, phase đóng hoặc thiếu SubmittedProposalContext. Không thay status/phase thật để tạo fixture.
- Giảng viên khác bộ môn, account inactive/thiếu role/ngoài roster; đối chứng eligibility độc lập từ dữ liệu nguồn. Bốn candidates hiện tại đều thuộc cùng bộ môn.
- FACULTY thiếu action, grant giới hạn hoặc ngoài grant; COMMITTEE-only; tổ hợp nhiều role. Không đổi role/grant hoặc giả token.
- UI list/candidates nhiều trang: hiện chỉ 2 nhóm và 4 candidates. API limit=1 chỉ chứng minh API pagination.
- Quy tắc unique tên nhóm chưa rõ trong business contract; không tự áp unique toàn hệ thống hoặc kết luận duplicate-name bug từ code.
- Chặn archive theo mọi loại ProposalReview và chặn sửa thành viên riêng ASSIGNED/IN_REVIEW/legacy chưa xác định: không suy từ activeReviewCount UI.
- Không thử outage backend/offline, hết hạn phiên thật, screen reader, load/performance hoặc dữ liệu quy mô lớn.
- Không có hash toàn DB/audit trước và sau. Phạm vi bảo toàn được đối chứng là canonical group views và không gửi mutation nghiệp vụ.

## 8. Bảo toàn và trạng thái bàn giao

[Đối chiếu đầu/cuối](final-verification.json) cho thấy cả hai group views giữ nguyên ID, name, department, member IDs, revision và updatedAt; sameGroupViews=true. Đây không phải cam kết mọi bảng DB không đổi. Phiên/audit/lastLoginAt thay đổi theo quyền xác thực đã được người dùng cho phép.

[Cleanup](auth-cleanup.json): đã đăng xuất phiên QA cuối, browser về /login, không còn access token trong sessionStorage. Không xóa audit/session rows đã tạo vì chúng là lịch sử xác thực hợp lệ và thao tác xóa không được cấp quyền.

Chỉ thêm evidence/report của lượt này; không stage/commit/push hoặc sửa lỗi. Đã scan các file text của evidence: không thấy mẫu JWT, mật khẩu mẫu hoặc URL PostgreSQL chứa credentials. [Manifest](manifest.json) lưu hash file sau khi hoàn tất báo cáo.

**Đề nghị xử lý tiếp:** sửa hai lỗi UI trên; muốn kiểm chứng đầy đủ luồng ghi cần chuẩn bị môi trường riêng và cho phép mutation có giới hạn. Các kết quả hiện tại không được dùng để tuyên bố toàn bộ bước 4 đạt.

