# Tinh chỉnh chất liệu và chuyển động UTC

Ngày 16/11/2026 (UTC+7). Thực hiện theo phản hồi giao diện còn “nhựa”, thiếu chuyển động
và chưa gần ảnh. [Phạm vi nghiệm thu](../../07-visual-refinement.md).

## Kết quả hiển thị

- Card làm việc chuyển sang nền trắng; giảm bóng xanh, bỏ highlight inset và gradient ở avatar.
  Panel quy tắc có nền kem nhẹ, vùng hồ sơ giữ trắng. Card tĩnh không nhảy khi hover.
- Sidebar navy, mục active xanh/vạch vàng; topbar trắng. Header chung bỏ hộp gradient/ribbon
  lặp lại; banner campus riêng của đăng ký vẫn giữ logo và ảnh UTC chính thức đã có.
- Đăng ký: dải thông tin đợt sát banner hơn, form/rail cân lại; select thêm nguyện vọng gọn,
  danh sách và nút có thứ bậc rõ. Input desktop 14px, mobile 16px; chỉ thiết bị con trỏ chính xác
  ở desktop rộng dùng nút sắp xếp 36px, còn tablet/mobile giữ 44px.
- Mobile thu gọn liên hệ/hướng khi đã có giá trị ban đầu; phần thiếu dữ liệu vẫn mở.
  Không thêm dấu “đã hoàn thành” suy đoán. Khi lỗi validation, các phần mở lại theo logic cũ.
- Ghi chú tùy chọn dùng disclosure native mở bằng bàn phím. Ghi chú đã có nội dung tự mở;
  nội dung không mất khi thu gọn. Không bỏ trường ghi chú hoặc thay payload.

### Đối chiếu ảnh

| Nguồn | Ảnh |
|---|---|
| Tham chiếu người dùng | [UTC reference](../../references/utc-ui-reference/utc-registration-reference.png) |
| Bản trước, cùng tài khoản/đợt 01, chụp ở lượt rollout | [Desktop trước](../system-rollout/student-registration-1440.png), [mobile trước](../system-rollout/student-registration-390.png) |
| Bản sau | [1440px](registration-after-1440.png), [1024px](registration-after-1024.png), [768px](registration-after-768.png), [390px](registration-after-390.png), [320px](registration-after-320.png) |
| Tổng quan dùng kit chung | [Trước](dashboard-before-1440.png), [sau desktop](dashboard-after-1440.png), [sau mobile](dashboard-after-390.png) |
| Bảng kỳ học/đợt, API thật | [Desktop](terms-after-1440.png), [mobile](terms-after-390.png) |
| Đăng nhập dùng token chung | [Desktop](login-after-1440.png) |

Các file `registration-before-*` chụp ngay đầu lượt này ở đợt 03 đang tải, **không dùng làm cặp
so sánh dữ liệu với ảnh sau đợt 01**. Hai file `registration-draft-1440.png` và
`registration-refined-1440.png` là ảnh trung gian, không phải kết quả cuối.

Khớp ngôn ngữ ảnh: navy/blue/yellow/white, nhận diện chính thức, ba section đánh số,
form hai cột ở desktop, rail hồ sơ/quy tắc, thứ tự giảng viên, accordion mobile và CTA xanh đậm.
Không tuyên bố giống từng pixel: giữ ảnh campus thật, nguồn ngày/trạng thái thật, selector đợt
và ghi chú hiện có; không thêm autosave, countdown, tick hợp lệ, liên kết hồ sơ hoặc các thẻ
quảng bá không có chức năng. Biên control đậm hơn ảnh để nhận diện được bằng mắt.

## Chuyển động

| Tương tác | Cách thể hiện |
|---|---|
| Nội dung vào màn | Fade/translate 8px trong 320ms; các section đăng ký lệch nhau 35–135ms, không lặp theo refetch |
| Hover/press | Đổi biên/nền; icon nav dịch 2px trên thiết bị hover; nút nhấn xuống 1px, không nâng mọi card |
| Drawer | Trượt 260ms, visibility chờ đóng; Escape/focus trap/restore; inert ngăn Tab vào menu ngay khi bắt đầu đóng |
| Dialog/menu | Fade/translate ngắn 180–260ms, không blur/backdrop kính |
| Disclosure | Chevron xoay, nội dung mở fade ngắn; giữ trường và giá trị |
| Đổi thứ tự nguyện vọng | Đo vị trí thật trước/sau, animate transform 240ms; giữ focus vào hàng đã đổi |
| Giảm chuyển động | CSS bỏ motion không thiết yếu; reorder không tạo animation mới và hủy animation đang chạy khi media preference đổi |

Không thêm dependency animation. Motion dùng token/easing chung. Lỗi animation còn chạy khi
bật reduced motion giữa chừng đã được tái hiện trên ứng dụng thật, sửa và kiểm tra lại.

## Kiểm chứng đã chạy

| Kiểm tra | Kết quả / bằng chứng |
|---|---|
| TypeScript `tsc --noEmit` | PASS — [log](type-check.log) |
| ESLint `src --ext .ts,.tsx` | PASS — [log](lint.log) |
| `pnpm --filter @doan/frontend test` | **64 file / 403 test PASS** — [log](unit-tests.log) |
| `pnpm --filter @doan/frontend build` | PASS — [log](build.log) |
| `test-ui-redesign-browser.cjs` | **22 nhóm PASS** — [kết quả](isolated-browser/result.json), [log](browser-test.log) |
| Đăng ký cuối, năm viewport + drawer đóng không nhận Tab | PASS — [log](registration-responsive.log) |
| `test-utc-registration-browser.cjs` | **7 nhóm PASS** — [kết quả](isolated-write-checks.json), [log](registration-browser.log) |
| MCP, ứng dụng/API thật | [Bằng chứng](browser-checks.json): đăng ký và dashboard ở năm viewport; bảng đợt ở desktop/mobile; các tương tác đọc/thay đổi cục bộ |
| Kiểm tra phạm vi | [Hash baseline](baseline-hashes.json), [đối soát](scope-verification.json); 670 file backend/contracts/API/service/router/data/package được bảo vệ không đổi |
| Diff / script | `git diff --check`, `node --check` hai script browser: PASS |

Kiểm browser chung dùng fixture cô lập: 22 màn core ở năm chiều rộng, menu/dialog/filter/bảng
và các vai trò; 13 component legacy chưa đăng ký route được kiểm riêng, không tính là 13 màn
API thật. Sau tinh chỉnh riêng đăng ký, đã chạy lại bộ đăng ký ở năm viewport và bộ ghi cô lập.
Không bỏ assertion hoặc sửa điều kiện nghiệp vụ để qua test.

Bộ ghi cô lập kiểm: validation email và mở lại section; ghi chú qua bàn phím/giữ giá trị;
animation/focus/reduced motion; PUT lưu nháp với thứ tự đúng và pending; POST nộp qua xác nhận;
HTTP 409 giữ trạng thái đã lưu; cổng khóa vô hiệu thao tác đúng điều kiện. Đây là test fixtures,
**không phải bằng chứng đã ghi thành công vào database thật**.

Trên ứng dụng thật đã kiểm Enter mở/đóng section và giữ giá trị, drawer focus/Escape,
đổi thứ tự và khôi phục thứ tự ban đầu, đổi reduced motion ngay khi đang trượt,
ghi chú bằng bàn phím, mở/hủy xác nhận nộp và trả focus. Không bấm xác nhận ghi dữ liệu.
Đã chọn giảng viên thứ ba từ danh sách API thật rồi xóa cục bộ để khôi phục hai nguyện vọng;
drawer đóng chuyển inert ngay và trở lại tương tác khi chuyển sang desktop.
Ảnh cuối đăng ký chụp khi API đã tải và hiển thị cổng mở.

Axe trên đăng ký (5 viewport) và bảng kỳ học (2 viewport) không phát hiện vi phạm trong tập
WCAG2A/AA + 2.1AA đã chạy; mỗi lượt có một mục cần đánh giá thủ công. Không có tràn ngang ở
các viewport đã ghi. Đây không phải chứng nhận toàn hệ thống đạt WCAG.

## Giới hạn và phạm vi bảo toàn

- Không kiểm thủ công lại mọi route hoặc mọi trạng thái API; giữ giới hạn inventory/audit trước.
  Không tự kết luận lỗi timeout snapshot F02 đã được sửa. Bảng kỳ học tải chậm ở lần mở đầu,
  sau đó quan sát được bảng/API thật; không gán nguyên nhân cho backend.
- Bản build còn cảnh báo CJS Vite/chunk lớn; unit test còn warning `useLayoutEffect` khi SSR.
  Các kiểm tra đã kết thúc với exit code 0. Lần chạy đầu trong sandbox gặp `spawn EPERM` và
  khóa pnpm store, đã chạy lại bằng quyền thực thi phù hợp, không đổi dependency hay test.
- Source chỉ đổi 6 file trình bày: token, theme, shell CSS/TSX và TSX/CSS đăng ký. Hai script test
  thêm thư mục output tùy chọn/kiểm motion; artifact trước giữ nguyên. Không sửa backend,
  Prisma, shared contract, API/service/hook, router, RBAC, schema validation hoặc logic lưu/nộp.
- Baseline chỉ lưu đường dẫn/hash; không đọc `.env`. Giữ các thay đổi có sẵn của người dùng.
  Không commit, push hoặc merge. Mức độ thẩm mỹ cuối cùng cần người dùng đánh giá trên ứng dụng.
