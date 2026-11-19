# Tiêu chí nghiệm thu có thể kiểm chứng

**Tất cả tiêu chí redesign bên dưới là việc cần chạy sau thay đổi, chưa phải kết quả đạt.** Kết quả audit thực tế nằm ở mục “Đã chạy” cuối file và [01-ui-audit.md](01-ui-audit.md). Mã route ở [02](02-route-inventory.md), phát hiện F01–F15 ở [01](01-ui-audit.md). Mỗi task ghi rõ route, vai trò, trạng thái, viewport, lệnh và artifact.

<a id="ac01"></a>

## AC01 — Quyền, route và phạm vi dữ liệu

Áp dụng toàn bộ62 route; F07/F12/F13.

- Inventory khớp router leaf routes và59 mục manifest; không tính constants/component chưa đăng ký là route sống.
- Giữ role allowlist, permission route, menuMode/menuRoles và mustChangePassword. Test cùng role có/không permission và nhiều role; menu ẩn không tự cấm route.
- Với route động, dùng ID lấy từ API/danh sách thật; SV chỉ hồ sơ hợp scope, GV theo quan hệ được giao/xét duyệt, Khoa theo đợt. Quyền đọc không bật nút ghi.
- Test direct link, phiên hết hạn, thiếu quyền,403/404 và redirect R57→R51 giữ query. Error boundary không che lối thoát.
- Hành động quản trị/duyệt/chấm phải giữ capability + trạng thái + deadline; không thay backend guard/RBAC.
- Bằng chứng: route comparison và unit manifest; API integration có phiên được cấp cho từng biến thể. Test fixture chỉ chứng minh UI logic của fixture.

<a id="ac02"></a>

## AC02 — Reflow, responsive và focus hiển thị

Áp dụng toàn bộ màn bị thay đổi; F02/F10/F11.

- Chụp desktop 1440×900, mobile 390×844; đo thêm320px và768×1024 sau font/CSS/data ổn định. Ghi loading riêng, không dùng ảnh skeleton nghiệm thu nội dung.
- Document không tràn ngang ở320px với text dài; nếu bảng cần scroll ngang, chỉ vùng bảng cuộn, có tên/khả năng focus và không mất cột/hành động quan trọng.
- Không chồng/lấp CTA, thông báo lỗi hoặc focus bởi topbar/sticky footer. Menu/dialog không vượt viewport; cuộn được nội dung và tới nút đóng.
- Zoom 200% giữ nội dung và chức năng; kiểm tra tên đề tài dài, UUID/filename dài, thông báo nhiều dòng.
- Mobile card vẫn thể hiện nhãn cột, trạng thái, liên kết và action của bản desktop; không giấu chức năng để “responsive”.
- Bằng chứng: ảnh trước/sau cùng dữ liệu + innerWidth/clientWidth/scrollWidth; kiểm lại sau chuyển breakpoint. Chưa đạt nếu screenshot chỉ là timeout.

<a id="ac03"></a>

## AC03 — Bàn phím, semantics và form lỗi

Áp dụng kit/modal/menu/form; F04/F08/F09.

- Tab/Shift+Tab theo trình tự đọc; Enter/Space kích hoạt đúng loại control; focus nhìn thấy và không chạy vào sidebar đóng.
- Skip link tới main; mỗi màn có tên/heading rõ. Nút icon có accessible name phù hợp, tên không chỉ dựa vào tooltip.
- Dialog có role/name, focus vào khi mở, giữ trong dialog; Escape/nút đóng trả về trigger hợp lý. Menu hỗ trợ phím mũi tên/Home/End/Escape theo pattern đang dùng.
- Mỗi input có label riêng; hint/error nối bằng id/aria-describedby khi dùng; aria-invalid phản ánh lỗi. Không gộp nhãn với nút hiện mật khẩu thành tên input khó hiểu.
- Lỗi required/format/server chỉ rõ trường hoặc nguyên nhân; focus lỗi/tóm tắt có thể đến bằng bàn phím; không chỉ đổi màu. Native validation và schema vẫn hoạt động.
- Disabled có lý do hiển thị phù hợp; không chỉ tooltip trên control không nhận focus. Lưu/nộp đang chạy có feedback và chống lặp theo cơ chế hiện có.
- Bằng chứng: keyboard trace và DOM/accessible tree, kiểm bằng screen reader ít nhất form/modal tiêu biểu; chạy axe rồi xử lý cả violation và incomplete. Audit hiện chưa có screen-reader run.

<a id="ac04"></a>

## AC04 — Trạng thái dữ liệu và phục hồi

Áp dụng list/detail/form; F02/F09/F15.

- Phân biệt initial loading, refresh, chưa có dữ liệu, filter không khớp, đã xử lý hết việc,403, lỗi mạng và lỗi validation.
- Loading có tên vùng/status; lỗi có thông điệp dễ hiểu và retry an toàn; giữ navigation/ngữ cảnh và dữ liệu hợp lệ có thể giữ theo kiến trúc hiện tại.
- Retry GET không kích hoạt mutation. Không tự đánh dấu thông báo đọc, tạo PDF, gửi lại mail, lưu form hoặc chốt hồ sơ khi chỉ mở màn.
- Search/filter/pagination giữ scope, reset trang khi cần và hiển thị điều kiện đang áp dụng. Xóa filter trả dữ liệu đúng; không dùng loading làm bằng chứng empty.
- Mutation ở môi trường được cho phép phải có pending/success/error rõ, không hiện thành công trước API. Audit này không cấp thêm quyền ghi.
- Bằng chứng: trạng thái thật khi có thể tái hiện; mock/fixture cho lỗi khó tạo phải gắn nhãn riêng và không thay thế API integration.

<a id="ac05"></a>

## AC05 — Giữ nghiệp vụ và tính nhất quán

F01/F03/F04/F05; áp dụng toàn bộ action thay bố cục.

- Cùng hồ sơ/đợt/phiên bản có dữ liệu, trạng thái và thời gian nhất quán giữa list/detail/dashboard/preview. Không sửa quy tắc tính để khớp thiết kế.
- Dashboard giải thích rõ phạm vi số mốc; CTA đúng trạng thái và vai trò, không trỏ vào màn readonly mà không chỉ nơi tiếp tục.
- Nhiệm vụ quá hạn, bản nộp trễ và chờ nhận xét là thông tin riêng; mẫu nộp đúng hạn nhưng chưa đánh giá phải diễn giải rõ.
- Phương án đã phân công không có lý do “chưa phân công” gây mâu thuẫn; phải xác minh nguồn reason trước khi sửa.
- Immutable version, history, reason sửa, expected revision/idempotency, quyền chính chủ, deadline, trạng thái chốt/công bố giữ nguyên.
- Dùng regression hiện có và ca trước/sau theo từng route trong inventory. Các ca ghi chỉ chạy trong môi trường được phép, không reset/seed tự phát.

<a id="ac06"></a>

## AC06 — Nội dung, hình thức và khả năng đọc

F06/F07/F10/F14/F15.

- Dùng design tokens và kit hiện có; không rải màu/font/spacing tùy ý. Thiết lập hierarchy title/body/meta và một CTA chính có nghĩa.
- Nội dung trạng thái bằng tiếng Việt dễ hiểu; giờ Việt Nam thống nhất; ngày/ID/version gốc vẫn tra được khi cần.
- Chỉ rõ scope/quan hệ và trạng thái readonly. API mode không chỉ người dùng làm theo hướng dẫn demo hoặc hiển thị giá trị mật khẩu mẫu.
- Màu không là dấu hiệu duy nhất. Mục tiêu tương phản: text thường4.5:1; chữ lớn3:1; control/focus có ý nghĩa3:1. Đo trên nền thực, kiểm thủ công gradient/transparency; không bỏ qua axe incomplete.
- Chữ nội dung thao tác đọc được ở100% và200%; kích thước metadata nhỏ phải được review trong ngữ cảnh, không tự coi mọi text 10px là lỗi WCAG.
- Không tăng gradient/glass/shadow để tạo cảm giác “premium”; giảm trang trí khi cạnh tranh với deadline, trạng thái và action.
- Thông báo phân biệt đã đọc với gửi thành công, không lặp cùng nhãn vô ích. Giữ dữ liệu/lịch sử có ích.

<a id="ac07"></a>

## AC07 — Điều hướng, đợt và handoff

F04/F11/F13.

- Back/Forward, deep link, reload giữ hồ sơ/đợt đúng. Route động và selector không đưa người dùng sang hồ sơ của đợt khác.
- Chọn đợt ở header hoặc trong workflow đồng bộ theo hook hiện tại; form chưa lưu có xử lý đúng hành vi đã thống nhất.
- Editor cũ vẫn vào được, nhưng CTA sang canonical editor nhìn thấy và nhận focus; readonly có lý do chính xác.
- Search/filter có nhãn, clear và trạng thái; link về danh sách không làm mất ngữ cảnh ngoài dự kiến.
- Kiểm các menu nhiều action sau thay PageActions; Badge không bị chọn thay nút hành động chính.

<a id="ac08"></a>

## AC08 — Motion và ảnh hưởng component chung

F10 và mọi token/kit thay đổi.

- Motion chỉ phục vụ phản hồi/trạng thái/định hướng; không trang trí lặp gây phân tâm.
- prefers-reduced-motion giảm/loại chuyển động không thiết yếu; spinner vẫn có thông tin tải bằng chữ/status.
- Kiểm hover/focus/disabled/loading, desktop/mobile, dark mode chỉ nếu hệ thống hỗ trợ hiện tại; không tự thêm theme mới.
- Sửa token/Field/Table/Modal phải có đại diện workspace thường và workflow, nhiều dữ liệu/rỗng/lỗi. Không chỉ test trang được sửa trực tiếp.
- Bằng chứng: computed style ở reduce/no-preference, keyboard và screenshot trước/sau; test đang có theo phạm vi.

<a id="ac09"></a>

## AC09 — Bằng chứng và phạm vi thay đổi

- Diff chỉ chứa file được giao; không sửa backend/schema/contracts/RBAC/dữ liệu để làm test xanh. Giữ nguyên thay đổi có sẵn.
- Với implementation frontend: chạy type-check, lint, tests liên quan và build theo AGENTS.md/CI; ghi lệnh, exit code và giới hạn. Thêm test cho hành vi quan trọng, không tạo test chỉ lặp implementation.
- Với audit tài liệu: kiểm router/source/relative links/ảnh/mã route–finding–AC; diff whitespace, thông tin nhạy cảm và hash file có thay đổi trước audit.
- Không nói test chưa chạy đã đạt, không dùng fixture thành bằng chứng tích hợp. Không tự commit/push/merge.
- Một phần bị chặn phải giữ nhãn chưa nghiệm thu và lý do, không đóng task bằng cách bỏ test hoặc gỡ chức năng.

## Tiêu chí riêng cho bốn màn thử nghiệm

| Mã | Màn / trạng thái cần có | Điều kiện chấp nhận |
|---|---|---|
| AC-R26 | R26, SV/GV/Khoa × đăng ký/đề cương/hướng dẫn; empty/error | Hành động tiếp theo có căn cứ, số mốc và nhãn cùng phạm vi, deadline/quan hệ đúng; không giấu công việc chỉ vì đề cương đã nộp |
| AC-R39 | R39, nháp/đã nộp còn hạn/hết hạn/thiếu liên hệ/NV trùng | Xếp tối đa ba NV theo cấu hình hiện tại, không trùng; lưu khác nộp; readonly và lý do đúng; giữ payload/rule |
| AC-R03 | R03, cùng ID ở SV và GVHD; chưa đánh giá/Đạt/Không đạt/Cần sửa/đánh giá sửa | Hiển thị đúng phiên bản/tệp; readonly SV; quyền GVHD; lịch sử, lý do và hạn sửa; không lẫn điểm tốt nghiệp |
| AC-R34 | R34, bảng nhiều/rỗng/filter rỗng; dialog tạo/sửa; đợt khóa | Search/sort/filter/pagination hoạt động; Cancel/Escape không ghi; giữ focus; đúng quy tắc đóng/mở/khóa và mọi link cấu hình |

## Đã chạy trong audit — không thay cho nghiệm thu redesign

- Router manifest Vitest: 14/14 đạt sau khi chạy lại ngoài sandbox (esbuild spawn bị chặn lần đầu).
- Browser: 48 route có ít nhất một trạng thái quan sát;12 bị chặn;2 chỉ code. Chi tiết role/viewport ở [ledger](evidence/README.md).
- Tab/Shift+Tab/Enter/Escape menu mobile GVHD, modal hỗ trợ login, native required login; reduced motion sidebar có hiệu lực.
- Reflow đủ390/320/768 ở login và đăng ký; review đủ ba kích thước nhưng số đo390 đầu có transient overflow, đo ổn định sau không tràn.
- Axe trên login/R03 GVHD/R15 Khoa tại390:0 violation trong tập rule đã chạy; contrast incomplete 3/1/1 chưa được giải quyết toàn bộ.
- Search R15: xóa từ khóa khôi phục12 hồ sơ; kết quả không khớp còn loading nên chưa xác minh empty; sort/pagination chưa chạy thành công.
- API/console có500/timeout. Màn bảo vệ bị chặn; chưa có bằng chứng write flows, screen reader, zoom 200%, PDF hoặc toàn bộ ma trận quyền.
- Kiểm tra cuối tài liệu/hash/link ở [verification.json](evidence/verification.json). **Không đánh dấu AC01–AC09 hay bốn pilot đã đạt redesign.**
