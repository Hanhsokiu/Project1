# Bàn giao mẫu R39 — Đăng ký nguyện vọng

Ngày 15/11/2026. Thiết kế theo [05-design-spec.md](../../05-design-spec.md), dựa trên R39 trong [kế hoạch audit](../../03-redesign-plan.md). Chỉ triển khai `/registration` cho sinh viên; Login, Dashboard, Kỳ học và màn nhận xét chưa được redesign trong nhiệm vụ này.

## Thay đổi và phạm vi

- Be Vietnam Pro local, heading navy, CTA xanh trầm, neutral và border rõ; bỏ shadow/hover lift trên card của mẫu.
- Tách đợt/thời gian khỏi thông báo; chia ba nhóm liên hệ, hướng, thứ tự nguyện vọng. Đưa hồ sơ đã lưu lên trước nguyên tắc, phân biệt với lựa chọn đang nhập; giải thích lưu nháp khác nộp.
- Input 16px, control và icon target tối thiểu 44px theo CSS; mobile một cột. Tablet 768–991px xếp liên hệ và hồ sơ thành một cột để tránh chật trong shell hiện có.
- Thêm nhãn nhóm, liên kết helper với select, giải thích dấu bắt buộc; sau đổi thứ tự, focus chuyển tới nhóm nguyện vọng vừa di chuyển. Thuật toán đổi thứ tự và callback ghi giữ nguyên.
- Code chỉ sửa [StudentRegistrationPage.tsx](../../../../frontend/src/features/registration/pages/StudentRegistrationPage.tsx), thêm [student-registration.css](../../../../frontend/src/features/registration/pages/student-registration.css). Tất cả selector/token mới nằm trong `.registration-pilot`; dùng lại kit. Sidebar/Topbar giữ style hiện có nên còn màu tím ở shell trong ảnh.
- Không thay service, backend, schema, API contracts, RBAC, polling, deadline, validation, filter GV, giới hạn NV hoặc trạng thái nghiệp vụ. Không commit/push/merge.

## Ảnh trước/sau từ ứng dụng thật

Ứng dụng đang chạy tại `http://127.0.0.1:5173`, Playwright MCP dùng phiên sinh viên của bộ mẫu hiện có. Đợt đăng ký mở, hồ sơ đã nộp, hai nguyện vọng; dữ liệu đến từ API thật. Không seed, tạo fixture hoặc ghi dữ liệu để chụp ảnh. Thời điểm chi tiết theo UTC nằm trong [browser-checks.json](browser-checks.json); giờ Việt Nam = UTC+7.

| Viewport | Trước | Sau | Trạng thái |
|---|---|---|---|
| 1440×900 | [Before](before-1440.png) | [After](after-1440.png) | Cùng sinh viên/đợt, 2 NV, cổng mở |
| 390×844 | [Before](before-390.png) | [After](after-390.png) | Cùng dữ liệu; form một cột |
| 320×844 | Không chụp before | [After](after-320.png) | Reflow hẹp; đủ hành động |
| 768×1024 | Không chụp before | [After](after-768.png) | Liên hệ và hồ sơ một cột |
| 1440×900 / 390×844 | Không chụp before dialog | [Desktop](confirm-1440.png), [Mobile](confirm-390.png) | Chỉ mở rồi hủy xác nhận, không nộp |
| 390×844 | Không chụp before readonly | [Hết hạn](readonly-390.png) | Đợt đề cương hiện có, cả ba fieldset và nút nộp disabled |

Ảnh trang dùng full-page nên chiều cao ảnh lớn hơn viewport. Ảnh dialog dùng viewport để thấy overlay đúng phạm vi màn hình. Ảnh readonly chụp trước lần chỉnh cuối nhãn ARIA/chữ “đến”; dùng chứng minh trạng thái khóa, không đại diện typography cuối cùng. Baseline audit cũ giữ nguyên.

## Kết quả kiểm tra

### Playwright MCP và API thật

| Kiểm tra | Kết quả quan sát |
|---|---|
| API đăng ký đúng đợt | GET `/api/registrations/term/cf40d4f4-6c49-490a-a361-4e2719ee40b2/me` → 200 |
| Reflow 1440/768/390/320 | `scrollWidth == clientWidth` tại cả 4 kích thước; đã xem ảnh |
| Thêm/bỏ/đổi thứ tự NV | Đạt; thêm tới 3 thì không còn select thêm; bỏ NV3, phục hồi thứ tự gốc |
| Đổi hướng | Xóa hướng làm trống NV và khóa thêm GV; chọn lại hướng/GV thật khôi phục lựa chọn gốc |
| Email sai định dạng | `checkValidity()` trả false; khôi phục email. Đây chỉ là kiểm native, không thay kết quả validation của service |
| Bàn phím | Enter đổi thứ tự; focus visible tại nhóm vừa di chuyển. Dialog giữ Tab/Shift+Tab, Escape trả focus, Hủy đóng |
| Đợt hết hạn | Hiện “Đã hết hạn đăng ký.”; 3 fieldset và nút nộp đều disabled |
| Reduced motion | Animation `none`, transition `0.00001s` trong mẫu; feedback chữ vẫn còn |
| Forced colors | Input giữ border và outline solid khi mô phỏng forced-colors |
| Font | Be Vietnam Pro đã tải; không thêm CDN/dependency |
| Axe WCAG2A/AA, 2.1A/AA | Không có violation tự động ở trang desktop/mobile/tablet và dialog desktop/mobile; còn mục `color-contrast` cần kiểm thủ công |
| Tương phản đo trên DOM | CTA 7.19:1; notice 7.11:1; input text 14.23:1; helper 6.19:1. Chữ mô tả dialog cùng màu #526373/trắng: 6.19:1 |
| Ghi dữ liệu | Không ghi nhận POST/PUT/PATCH/DELETE trong phiên kiểm tra mẫu; không bấm Lưu nháp hoặc Xác nhận nộp |

Hai HTTP500 của module TSX xuất hiện lúc HMR đang cập nhật file; reload sau khi hoàn tất đã tải được mẫu. Không có `pageerror` được listener ghi nhận. Đây không phải lỗi API/backend. Các mục axe còn cần xem thủ công chủ yếu nằm ở avatar/profile shell và mô tả dialog; không tuyên bố toàn hệ thống đạt accessibility.

### Kiểm tra kỹ thuật

Chạy từ `frontend/` bằng executable local tương ứng script package:

| Lệnh | Kết quả bản cuối |
|---|---|
| `node node_modules/typescript/bin/tsc --noEmit` | Exit 0 |
| `node node_modules/eslint/bin/eslint.js src --ext .ts,.tsx` | Exit 0 |
| `node node_modules/vitest/vitest.mjs run --reporter=json --outputFile=../docs/ui-redesign/evidence/pilot-registration/unit-tests.json` | Exit 0; 403/403 test, 64 file; [báo cáo JSON](unit-tests.json) |
| `node node_modules/typescript/bin/tsc` rồi `node node_modules/vite/bin/vite.js build` | Cả hai exit 0; 2231 module; build thành công |

Vitest ban đầu bị sandbox `spawn EPERM`; chạy với quyền tạo tiến trình đã được duyệt. Một lần redirect stderr bằng PowerShell trả exit1 dù JSON 403/403 đạt; đã chạy lại không redirect và nhận exit0. Có cảnh báo Vite CJS deprecated, React useLayoutEffect trong test SSR và chunk production >500kB; không bỏ test/hạ ngưỡng để che cảnh báo.

Từ repo root chạy `node docs/ui-redesign/evidence/pilot-registration/verify-scope.cjs`: đối chiếu AST phần setup/save/filter, callback/disabled/value, thuật toán reorder; kiểm CSS scoped, hash 15 file đã sửa sẵn và liên kết tài liệu. Phần bổ sung trong hàm move chỉ quản lý focus. Kết quả lưu ở [scope-check.json](scope-check.json).

## Giới hạn và bước đánh giá mẫu

Chưa thực hiện ghi lưu/nộp thật, error/success sau ghi, legacy registration, mọi tổ hợp permission hoặc screen reader thủ công. Loading đã thấy khi tải context; không giả response để tạo empty/error. Chưa kiểm native browser zoom200%, bàn phím ảo trên thiết bị thật hoặc Safari/Firefox; các viewport Chromium không thay thế những kiểm tra này. F02 về global snapshot và các vấn đề nghiệp vụ trong audit vẫn là hạng mục riêng.

Mẫu đủ để đánh giá hierarchy, palette, độ đọc và form ở bốn kích thước. Khi duyệt visual direction, cần xem cả độ dài trang mobile và sự khác biệt giữa shell cũ với màu mới. Dừng tại mẫu này; chỉ chuẩn hóa token/component dùng chung và triển khai Login/Dashboard/Terms trong nhiệm vụ tiếp theo sau đánh giá.
