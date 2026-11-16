# Bàn giao — Refined UTC Enterprise, /registration

Ngày 16/11/2026 (UTC+7). [Audit KEEP / REFINE / REMOVE và kế hoạch A–D](../../08-enterprise-refinement.md).
Đây là đợt finishing trang đăng ký và những thành phần dùng chung cần thiết; không thay cấu trúc
nghiệp vụ hay triển khai lại các module khác. Không tự chấm điểm thẩm mỹ.

## 1. Giữ, tinh chỉnh, loại bỏ

| Quyết định | Thành phần | Lý do |
|---|---|---|
| KEEP | Logo UTC chính thức, Be Vietnam Pro local, nhóm menu/route/quyền | Giữ nhận diện, kiến trúc và cách người dùng tìm chức năng |
| KEEP | Liên hệ, hướng, NV, ghi chú, lưu nháp/nộp, xác nhận, hồ sơ đã lưu và quy tắc | Không mất chức năng hoặc thay payload/validation/gate |
| KEEP | Native select, disclosure mobile/ghi chú, focus/inert, lịch sử trạng thái thật | Tận dụng kit hiện có; không thêm library hoặc trạng thái giả |
| REFINE | Palette, radius, elevation, heading/label/helper, button/input/badge/table/header dùng chung | Màu tập trung vào navigation/action; bề mặt neutral và thứ bậc rõ |
| REFINE | Identity row, list NV, form grid và summary | Giảm khung lồng; tên/email/rank/action dễ quét, đúng trọng lượng |
| REFINE | Loading spinner và chiều rộng dialog action | Spinner nằm ngoài flow; giữ nhãn truy cập, không làm CTA co lại khi xử lý |
| REMOVE | Gradient/viền vàng/glow ở primary, nền tròn xanh trang trí trong context/input, icon mũ tốt nghiệp | Không giúp hiểu hoặc hoàn tất đăng ký |
| REMOVE | Banner campus/ribbon trong header đăng ký; ribbon lớn của sidebar | Giữ ảnh campus thật ở vùng phụ thấp của sidebar, nhường chỗ cho công việc |
| REMOVE | Badge trạng thái trùng ở rail, card/header vàng của nguyên tắc, avatar lặp trên từng NV | Một trạng thái lưu ở context; hỗ trợ có trọng lượng thấp hơn form |
| REMOVE | Entrance/stagger trên nhiều section và chuyển icon nav khi hover | Giữ motion cho tương tác, tránh nhiều phần tử cùng di chuyển |

Không có thẻ quảng bá Nhanh chóng/Minh bạch/Đa thiết bị trong TSX trước lượt này, nên không có
chức năng nào bị xóa để loại chúng. Không thêm KPI, autosave, countdown hay progress tracker.

## 2. Token và component

- Navy `#112B45`, deep navy `#0B223B`; action `#204E73`, accent `#376D97`, vàng UTC `#F5C542`.
  Canvas `#F7F9FB`, surface trắng, border `#E2E7ED`, text `#1D2D3D`.
  Secondary dùng `#58697A`, muted `#627284`; biên control `#8795A4` đậm hơn border trang trí.
  Giữ success/warning/error hiện có vì ngữ nghĩa và tương phản đang phù hợp.
- Radius: small/badge 6px, control 8px, card 12px, dialog 14px; không áp một radius cho mọi thứ.
  Elevation 0 = none, 1 = viền/nổi rất nhẹ, 2 = dropdown, 3 = modal. Card thường dùng border.
- Be Vietnam Pro: page title 28/600 (mobile 23/600, nhỏ nhất 22), section 16/600, body 14/400,
  label 13/500, meta 12. Input desktop 14px, mobile 16px. Helper và ngày không bị làm mờ quá mức.
- Button primary phẳng, secondary trung tính, destructive giữ màu/ngữ nghĩa riêng; hover đổi màu,
  pressed 1px, focus outline rõ. Label/disabled/aria-busy hiện có được giữ.
- Card/header/table/badge dùng kit cũ. Table header trung tính, divider nhẹ, selected vẫn rõ;
  không tạo khung bo tròn lớn mới cho từng row. Dropdown elevation nhẹ hơn modal.
- Sidebar navy phẳng, active xanh trầm/vạch vàng, icon 19px; campus thấp/ít nổi để menu có chỗ cuộn.
  Topbar vẫn breadcrumb, selector đợt, thông báo/profile thật; không bổ sung menu hoặc search giả.
- Form chính giữ ba section. Rank NV nhỏ, divider, không khung/blue avatar lặp. Rules là section
  hỗ trợ không cần thêm card. Rail vẫn chứa hướng/ngày cập nhật/ngày nộp/thứ tự từ snapshot đã lưu.
- Stylesheet đăng ký gom các lớp pilot trùng thành một bộ rule scoped; không thay toàn bộ index.css
  hoặc component kit. Token legacy gradient được alias về màu phẳng để tương thích các chỗ đang dùng.

Motion: control 140ms; dropdown 180ms; drawer 260ms; modal 240ms; reorder 240ms.
Không card entrance/stagger, hover scale, glow hoặc animation nền. Reduced motion tắt motion
không thiết yếu và hủy animation reorder đang chạy; không bỏ feedback bằng chữ.

## 3. Ảnh trước/sau — ứng dụng và API thật

SV được cấp sẵn, cùng đợt 01 đang mở và hồ sơ đã nộp. Baseline chụp trước mọi thay đổi source
của lượt này; ảnh sau lấy khi dữ liệu API đã tải. Timestamp UTC/viewport/route trong
[ledger](browser-checks.json). Full-page PNG có thể cao hơn viewport; scrollbar làm chiều rộng
ảnh nhỏ hơn chiều rộng viewport. Không chèn mockup vào ứng dụng.

| Viewport | Trước | Sau |
|---|---|---|
| 1440×900 | [Desktop](registration-before-1440.png) | [Desktop](registration-after-1440.png) |
| 1280×900 | [Desktop hẹp](registration-before-1280.png) | [Desktop hẹp](registration-after-1280.png) |
| 1024×900 | [Laptop/tablet](registration-before-1024.png) | [Laptop/tablet](registration-after-1024.png) |
| 768×1024 | [Tablet](registration-before-768.png) | [Tablet](registration-after-768.png) |
| 390×844 | [Mobile](registration-before-390.png) | [Mobile](registration-after-390.png) |
| 375×844 | [Mobile](registration-before-375.png) | [Mobile](registration-after-375.png) |
| 320×844 | [Mobile hẹp](registration-before-320.png) | [Mobile hẹp](registration-after-320.png) |

Ảnh trạng thái: [validation thật, không gửi mutation](registration-validation-390.png),
[dialog xác nhận, đã hủy](registration-confirm-1440.png),
[focus khi viewport cao 450px](mobile-small-height-focus.png),
[forced colors](forced-colors-focus.png),
[loading fixture cô lập](isolated-draft-pending.png).

Desktop giữ form + rail; 1024px xếp form và hỗ trợ theo vùng khả dụng; dưới 1024px dùng drawer.
Tablet đủ rộng giữ hai cột liên hệ; mobile một cột, action reorder 44px; desktop con trỏ chính xác
có action 36px. Tên hướng dài có mô tả đầy đủ dưới native select ở màn hẹp. 320px giữ từ “đến”
khi khoảng ngày xuống dòng. Không sticky action bar che nội dung; dialog action wrap khi thiếu chỗ.

Độ nổi giảm là chủ đích so với ảnh minh họa cũ: navy/yellow vẫn ở nhận diện, nhưng vùng làm việc
ưu tiên dữ liệu và form. Không cố khớp trang trí của mockup hoặc tự đổi ngày/trạng thái theo ảnh.

## 4. Kiểm chứng

| Kiểm tra đã chạy | Kết quả / bằng chứng |
|---|---|
| `tsc --noEmit` | PASS — [log](type-check.log) |
| `eslint src --ext .ts,.tsx` | PASS — [log](lint.log) |
| `pnpm --filter @doan/frontend build` | PASS — [log](build.log) |
| `pnpm --filter @doan/frontend test` | **64 file / 403 test PASS** — [log](unit-tests.log) |
| Shared UI browser hiện có | **22 nhóm PASS**, gồm bảng/menu/dialog và các vai trò — [kết quả](isolated-browser/result.json), [log](browser-test.log) |
| Đăng ký, bảy viewport + drawer | PASS — [log](registration-responsive.log) |
| Validation/lưu/nộp/loading/reorder | **7 nhóm PASS** — [kết quả](isolated-write-checks.json), [log](registration-browser.log) |
| Workflow nhận xét dùng kit/shell chung | **10 nhóm PASS** — [kết quả](workflow-results.json), [log](workflow-browser.log) |
| MCP / API thật / axe / focus | [Ledger](browser-checks.json) và ảnh mục 3 |
| Phạm vi / diff | [Đối soát hash](scope-verification.json): 670 file được bảo vệ không đổi; `git diff --check` và `node --check` hai script: PASS |

Browser tests trong ba bộ trên dùng fixture cô lập **đã có sẵn**; không dùng fixture trong app thật.
Không tạo dataset mới thay API. 13 component legacy trong bộ UI chưa đăng ký route không được
tính thành 13 route API đã kiểm chứng. Chỉ các ảnh/kiểm tra có nhãn API thật trong ledger mới là
bằng chứng chạy ứng dụng với backend thật.

Bộ đăng ký kiểm email sai không ghi, reveal field khi section đóng, note/keyboard/giữ giá trị,
reorder/focus/reduced motion, PUT draft và POST submit đúng thứ tự, pending/409/khóa.
Đo kích thước hai CTA trước/trong pending và nút xác nhận trước/khi đổi nhãn “Đang xử lý…”.
Phép đo hủy animation pause một animation thật đang chạy để không phụ thuộc tải CPU; vẫn yêu cầu
animation tồn tại, bị cancel khi reduced motion đổi và không tạo animation mới trong chế độ reduce.

Trên API thật đã kiểm validation cục bộ chặn request, chọn/xóa giảng viên, đổi/khôi phục thứ tự,
drawer Enter/Escape/inert, note bằng Enter, mở/hủy dialog nộp và restore focus.
Không xác nhận lưu/nộp/duyệt vào database thật. Snapshot đã lưu không bị sửa để tạo ảnh đẹp.

Axe không phát hiện violation ở bảy viewport đăng ký trong tập WCAG2A/AA + 2.1AA đã chạy.
Mục contrast của link bị cắt ở biên vùng cuộn sidebar được ghi là incomplete; đã cuộn link vào
vùng nhìn và kiểm riêng không có violation/incomplete. Không suy kết quả này thành chứng nhận
toàn hệ thống đạt WCAG.

Các lần kiểm đầu phát hiện khác biệt markup Button và co nút do CSS loading cũ; đã giữ DOM nhãn,
sửa spinner ngoài flow và bảo toàn chỗ icon. Không sửa/hạ 20 assertion SSR để cho qua. Unit tests
đã PASS lại. Kiểm button size từng thất bại đã được sửa đúng nguyên nhân, không tăng sai số để đạt.

## 5. File thay đổi trong lượt này

1. [design-system.css](../../../../frontend/src/design-system.css): token enterprise/elevation/radius.
2. [tailwind.config.ts](../../../../frontend/tailwind.config.ts): đồng bộ palette utilities hiện có.
3. [utc-theme.css](../../../../frontend/src/utc-theme.css): finishing shared kit, button loading và motion.
4. [utc-registration-shell.css](../../../../frontend/src/app/layouts/utc-registration-shell.css): shell/nav/brand phụ.
5. [kit.tsx](../../../../frontend/src/shared/components/kit.tsx): spinner overlay, giữ DOM nhãn/callback.
6. [StudentRegistrationPage.tsx](../../../../frontend/src/features/registration/pages/StudentRegistrationPage.tsx): bỏ trang trí/trạng thái lặp, rules semantic section.
7. [student-registration.css](../../../../frontend/src/features/registration/pages/student-registration.css): bố cục/density/responsive/focus riêng đăng ký.
8. [test-ui-redesign-browser.cjs](../../../../frontend/scripts/test-ui-redesign-browser.cjs): nhánh đăng ký kiểm đủ bảy viewport.
9. [test-utc-registration-browser.cjs](../../../../frontend/scripts/test-utc-registration-browser.cjs): đo loading, test motion ổn định, locator trạng thái duy nhất.
10. [08-enterprise-refinement.md](../../08-enterprise-refinement.md) và các bằng chứng trong thư mục này.

Không sửa source của module khác, backend, Prisma, shared contracts, services/hooks/API/router/RBAC,
package/dependency hoặc schema validation. [Baseline](baseline-hashes.json) chỉ lưu đường dẫn/hash,
không đọc `.env`. Giữ thay đổi có sẵn. Không commit/push/merge.

## 6. Giới hạn còn lại

- Bảy viewport là browser emulation trên desktop. Chưa kiểm bàn phím ảo iOS/Android thật hoặc
  native browser zoom 200%. Đã kiểm reflow bằng viewport 720px (tương đương vùng layout 1440px ở
  200%) và focus với vùng nhìn 390×450; không gọi đó là thử thiết bị vật lý.
- Không audit/kiểm API mọi route và mọi trạng thái dữ liệu. Những giới hạn F02 trước đây vẫn cần
  đầu việc môi trường/API riêng; không sửa data layer hoặc backend trong finishing này.
- Cuối lượt có `ERR_CONNECTION_REFUSED` cổng 3000 ở GET registrations/auth-me, làm lần đăng nhập
  Khoa mới timeout. API sau đó phản hồi trở lại và đăng ký lại hiện cổng mở; không cần sửa backend.
  Lần thử Khoa tiếp theo tới `/` nhưng chưa quan sát được menu `/terms` trong 30 giây, nên không
  tuyên bố đã kiểm bảng Khoa/API thật trong lượt này. Shared table/dialog/workflow đã kiểm bằng
  các browser tests cô lập nêu trên. Không suy nguyên nhân từ việc chưa thấy menu.
- Build còn cảnh báo Vite CJS/chunk lớn; SSR có warning useLayoutEffect. Những cảnh báo này không
  bị tắt để báo đạt. Thẩm mỹ cuối cùng cần người dùng đánh giá trên app/ảnh đối chiếu.
