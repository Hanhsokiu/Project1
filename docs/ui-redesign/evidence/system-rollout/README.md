# Giao diện UTC toàn hệ thống

Bàn giao ngày **15/11/2026**, theo yêu cầu mở rộng phong cách mới sang toàn hệ thống.
[Kế hoạch triển khai](../../06-system-rollout.md) · [62 đích route và độ bao phủ](route-coverage.md).

## Đã triển khai

| Phần | Thay đổi |
|---|---|
| Nền tảng | Token navy/blue/yellow/white dùng toàn ứng dụng; Tailwind primary đồng bộ; Be Vietnam Pro giữ font local |
| Khung ứng dụng | Mọi route qua WorkspaceLayout dùng logo UTC chính thức, Sidebar navy, active blue/vàng, ảnh khuôn viên và dải nhận diện; Topbar và menu mobile thống nhất |
| Header/card | Header có nền xanh nhạt và điểm nhận diện; card border/radius/shadow theo mẫu, giảm hiệu ứng nâng thẻ khi hover |
| Form/action | Nút primary xanh sâu viền vàng, secondary rõ; control từ 44px, viền có tương phản, focus/disabled/loading rõ; giữ validation và callback |
| Bảng | Header xanh nhạt, chữ và hàng dữ liệu dễ đọc; toolbar/filter/sort/pagination/selection giữ nguyên hành vi; sửa tương phản metadata của hàng được chọn |
| Workflow | Kit riêng của xét duyệt/đề cương/hướng dẫn dùng cùng token; đồng bộ panel, bảng, bộ lọc và nút; trạng thái vẫn dựa trên API |
| Đăng nhập | Logo gốc, nền navy, ảnh khuôn viên, form card trắng; giữ xác thực, redirect, trợ giúp và trạng thái lỗi |
| Dashboard | Cả ba vai trò chính nhận cùng nhận diện; chỉ thay trình bày, không đổi phép đếm, giai đoạn hoặc hành động tiếp theo |
| Trạng thái | Badge semantic, Notice, empty, modal, toast cùng ngôn ngữ thiết kế; reduced motion và CSS in giữ được nội dung |

Kiểu mới được áp dụng qua lớp dùng chung cho các nhóm: quản trị/tài khoản, danh mục/import, kỳ học,
đăng ký/phân công, đề tài/đề cương/xét duyệt/hồ sơ, hướng dẫn/nhiệm vụ/báo cáo, bảo vệ/chấm điểm,
báo cáo/xuất dữ liệu, hồ sơ cá nhân và thông báo. Layout nghiệp vụ của từng màn vẫn được sử dụng;
không biến mọi màn thành một bản sao form đăng ký.

## Ảnh với API thật

Playwright MCP, ứng dụng tại `http://127.0.0.1:5173`, tài khoản mẫu hiện có `mau18_*`.
**40 ảnh** từ 8 biến thể route/vai trò, mỗi biến thể đủ 1440×900, 1024×768, 768×1024,
390×844 và 320×700. Thời điểm/viewport/route/axe nằm trong [browser-checks.json](browser-checks.json).

| Màn / vai trò | Desktop | Mobile |
|---|---|---|
| Đăng nhập | [1440](login-1440.png) | [390](login-390.png) |
| Tổng quan sinh viên | [1440](student-dashboard-1440.png) | [390](student-dashboard-390.png) |
| Tổng quan giảng viên | [1440](lecturer-dashboard-1440.png) | [390](lecturer-dashboard-390.png) |
| Tổng quan cán bộ khoa | [1440](faculty-dashboard-1440.png) | [390](faculty-dashboard-390.png) |
| Kỳ học & đợt / Khoa | [1440](faculty-terms-1440.png) | [390](faculty-terms-390.png) |
| Đăng ký / sinh viên | [1440](student-registration-1440.png) | [390](student-registration-390.png) |
| Hàng chờ nhận xét / giảng viên | [1440](lecturer-review-queue-1440.png) | [390](lecturer-review-queue-390.png) |
| Chi tiết nhận xét / giảng viên | [1440](lecturer-review-detail-1440.png) | [390](lecturer-review-detail-390.png) |

[Modal kỳ học thật, mở và hủy](faculty-term-modal.png). Route chi tiết nhận xét dùng ID lấy từ link
trong hàng chờ API thật. Không lưu/nộp, đánh giá, công bố, chốt hoặc đổi dữ liệu nghiệp vụ để tạo ảnh.
Ảnh toàn trang có chiều cao nội dung thực tế. Baseline trước thay đổi nằm trong các bộ audit/pilot trước:
[audit](../../01-ui-audit.md), [mẫu UTC v2](../utc-registration-v2/README.md).

## Kiểm tra đã chạy

### Ứng dụng thật

- 40 lượt viewport không tràn ngang; Be Vietnam Pro tải được; axe WCAG2 A/AA + WCAG2.1 AA không
  phát hiện violation. Một số kiểm tra có mục `incomplete`; không xem đây là chứng nhận toàn diện WCAG.
- Kiểm tìm kiếm và trạng thái rỗng bảng kỳ học, mở modal, focus vào modal, Escape trả focus;
  drawer mở bằng Enter, Escape trả focus và reduced motion. Không bấm lưu modal.
- Đăng nhập: required chặn form rỗng, hiện/ẩn mật khẩu bằng Enter, dialog trợ giúp nhận focus
  và Escape trả focus. Tổng 10 assertion tương tác thật, ngoài các lượt responsive/axe.
- Sửa lỗi tương phản ở metadata hàng chọn và nhãn metric dashboard giảng viên; đã chạy lại axe sau sửa.
- Trang đăng ký được kiểm lại 320px sau khi sửa lề âm banner ở kích thước nhỏ nhất.
- Các phiên thật đã xác thực lại bằng hướng dẫn tài khoản cục bộ; không đọc `.env`, không đưa mật khẩu,
  token hay header xác thực vào báo cáo. Các lần nạp đầu bị timeout được ghi ở giới hạn bên dưới.

### Hồi quy cô lập — không phải bằng chứng tích hợp database thật

| Bộ kiểm tra | Kết quả / bằng chứng |
|---|---|
| Frontend unit tests | **64 file / 403 test PASS** — [log](unit-tests.log) |
| Type-check | PASS: `cd frontend; node node_modules/typescript/bin/tsc --noEmit` |
| Lint | PASS: `cd frontend; node node_modules/eslint/bin/eslint.js src --ext .ts,.tsx` |
| Production build | PASS, **2233 module** — [log](build.log) |
| UI chung | **22 nhóm PASS** — [kết quả](isolated-browser/result.json), [log](browser-test.log) |
| Nhóm duyệt | **9 nhóm PASS** — [kết quả](step4-browser-results.json), [log](review-groups.log) |
| Xét duyệt đề cương | **10 nhóm PASS** — [kết quả](step5-browser-results.json), [log](proposal-reviews.log) |
| Phiên bản đề cương | **16 nhóm PASS** — [kết quả](step6-browser-results.json), [log](proposal-versions.log) |
| Hồ sơ / tiếp nhận | **8 nhóm PASS** — [kết quả](step7-browser-results.json), [log](proposal-dossiers.log) |
| Kế hoạch / nhiệm vụ | **11 nhóm PASS** — [kết quả](step8a-browser-results.json), [log](guidance-tasks.log) |
| Bài nộp | **10 nhóm PASS** — [kết quả](step8b-browser-results.json), [log](guidance-submissions.log) |
| Nhận xét tiến độ | **10 nhóm PASS** — [kết quả](step8c-browser-results.json), [log](guidance-reviews.log) |
| Lưu/nộp đăng ký | **5 nhóm PASS** — [kết quả](isolated-write-checks.json), [log](registration-browser.log) |

Tổng **101 nhóm assertion browser cô lập** trên các bộ trên. UI chung đi qua 22 màn core ở năm chiều rộng,
dashboard/màn đại diện và menu cho năm vai trò. Nó còn kiểm 13 component cũ chưa đăng ký route;
không dùng 13 component đó để tuyên bố đã kiểm API các route bảo vệ hiện hành.

Các bộ test chạy qua script trong `frontend/package.json`; bộ đăng ký dùng
`node frontend/scripts/test-utc-registration-browser.cjs`. Test sửa locator alert để chọn đúng thông báo
phạm vi/nội dung khi shell và màn con cùng có alert; giữ nguyên kỳ vọng nghiệp vụ.
Kỳ vọng sidebar thu gọn cập nhật 72 → 80px theo mẫu UTC. Không bỏ assertion, nới quyền hay đổi fixture
thành dữ liệu của ứng dụng thật.

Build vẫn cảnh báo chunk >500kB/CJS Vite; unit tests có cảnh báo useLayoutEffect ở SSR.
Hai browser test ban đầu timeout khi nhiều Vite server khởi động cùng lúc; chạy riêng đã PASS.

## Giới hạn nghiệm thu

- **Không khẳng định đã kiểm thủ công mọi trạng thái của 62 route.** Toàn bộ route nhận shell/token/kit
  mới theo code; cột bằng chứng trong inventory phân biệt API thật, fixture và chỉ kiểm code.
- `/defense/eligibility`: quan sát ban đầu thấy header/form/bộ lọc, sau đó snapshot chung báo
  `timeout of 20000ms exceeded`, thay toàn màn bằng lỗi/thử lại.
  [Ảnh bị chặn](faculty-eligibility-blocked.png). Chưa kiểm đầy đủ dữ liệu, quyết định/chốt hay các luồng
  bảo vệ khác qua API thật. Không quy nguyên nhân về backend chỉ từ timeout; F02 của audit vẫn cần xử lý riêng.
- Admin và COMMITTEE được kiểm bằng fixture hiện có; chưa dùng tài khoản thật cho hai vai trò này.
- Luồng ghi qua API/database thật không nằm trong lượt xác minh này. Pending/success/error/khóa và các
  thao tác nghiệp vụ được hồi quy bằng test cô lập; không gán các kết quả đó cho dữ liệu thật.
- Mẫu đăng nhập/danh mục/bảng/workflow đã cùng phong cách. Đây là triển khai ngôn ngữ giao diện toàn ứng dụng,
  không phải tuyên bố đã tái thiết kế mọi cấu trúc nội dung, khắc phục mọi phát hiện UX hay lỗi dữ liệu của audit.

## Phạm vi code và bảo toàn thay đổi có sẵn

- Thêm `frontend/src/utc-theme.css`, import từ main; token và utility primary đồng bộ trong design-system,
  index và Tailwind. Kit chỉ thêm class header; không đổi callback/nghiệp vụ.
- WorkspaceLayout áp dụng biến thể UTC cho mọi route, dùng chung focus/inert/reduced-motion.
  File shell giữ tên lịch sử `utc-registration-shell.css` nhưng selector hiện là `.utc-shell`.
- Đồng bộ stylesheet workflow/import; đăng nhập dùng asset chính thức đã có; sửa lề banner đăng ký 320px.
- `AdminLayout.tsx` là layout không được router thực thi; các route admin thực tế đi qua WorkspaceLayout.
  Không thay layout cũ không sử dụng hoặc đăng ký thêm route.
- Không sửa backend, Prisma, shared schema/contracts, API/service, router, RBAC, package/dependency hoặc
  logic thống kê/thuật toán. Hash các file được bảo vệ giữ nguyên so với baseline của lượt này.
- [Baseline](baseline-hashes.json) và [danh sách file baseline thay đổi](changed-baseline-files.json) giúp tách
  thay đổi mới khỏi git diff đã có sẵn. Hai artifact fixture của mẫu v2 được chạy lại trong quá trình kiểm tra;
  script đăng ký hiện ghi vào thư mục rollout này. Ảnh audit/baseline trước đó giữ nguyên.
- [Xác minh phạm vi](scope-verification.json): 671 file được bảo vệ giữ nguyên hash.
- Không commit, push hoặc merge.
