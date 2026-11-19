# Refined UTC Enterprise — audit và phạm vi hoàn thiện

Ngày 16/11/2026. Yêu cầu mới ưu tiên usability, hierarchy, typography và neutral surfaces;
đây là đợt finishing `/registration`, không triển khai lại các module nghiệp vụ.

## A. Visual audit trước sửa

Đã đọc AGENTS/CLAUDE/README, audit 01–04, spec 05 và hồ sơ rollout/refinement 06–07;
đối chiếu TSX đăng ký, service/validation, kit, CSS, shell, Tailwind, dependency và CI.
Playwright MCP đã mở API thật với SV/đợt 01 đang mở, hồ sơ đã nộp; chụp baseline đủ
1440/1280/1024/768/390/375/320px trước sửa. Không dùng ảnh loading làm baseline.

| Mã | Quyết định | Quan sát có căn cứ | Hướng xử lý / lý do |
|---|---|---|---|
| E01 | KEEP | Ba section liên hệ/hướng/NV; saved snapshot tách khỏi dữ liệu nhập | Giữ bố cục nghiệp vụ và toàn bộ callback/validation |
| E02 | KEEP | Logo UTC chính thức, Be Vietnam Pro local, navy navigation, thứ tự Tab, drawer inert/focus | Giữ bản sắc và nền accessibility đã có |
| E03 | REFINE | Primary gradient + viền vàng, nhiều heading 700; màu xanh bão hòa ở nhiều lớp | Action Blue phẳng, text neutral, weight 500–600; vàng chỉ còn ở nhận diện/active nav |
| E04 | REFINE | Card 14px và shadow thống nhất, hỗ trợ và nội dung chính cùng trọng lượng | Radius 12px, elevation theo vai trò; primary form border, supporting rules không bao card |
| E05 | REMOVE | Trạng thái lưu lặp ở context strip và saved rail, cùng nguồn `existing.status` | Giữ một nhãn trạng thái ở strip; rail vẫn giữ hướng, ngày, thứ tự đã lưu |
| E06 | REMOVE | Banner campus lớn/ribbon trong vùng làm việc, icon nền xanh ở mỗi mục context/input | Header chữ sạch; campus thật chỉ còn ở vùng sidebar phụ; label đủ giải thích input |
| E07 | REFINE | Student strip lồng border/nền; từng NV có khung/rank/blue avatar cạnh tranh | Identity row yên, NV dùng divider và rank nhỏ; tên/email/action dễ quét |
| E08 | REFINE | Label hướng ẩn ở desktop, metadata và icon nhiều cấp; tablet form liên hệ bị dồn một cột | Label nhất quán; hai cột khi đủ rộng, wrap tên hướng dài bằng phần mô tả thật |
| E09 | REMOVE | Entrance translate + stagger trên hero/period/ba card/rail, nav icon dịch khi hover | Bỏ chuyển động xuất hiện nhiều phần tử; giữ dropdown/drawer/modal/disclosure/reorder |
| E10 | REFINE | Button kit thêm spinner vào flex flow làm tăng chiều rộng lúc pending | Spinner overlay, label vẫn giữ kích thước và accessible name; kiểm kích thước hai CTA đăng ký |
| E11 | KEEP | Ghi chú tùy chọn và form liên hệ/hướng trên mobile có disclosure; lỗi mở lại section | Giữ giá trị, keyboard và logic mở khi lỗi; không thêm dấu hoàn thành giả |
| E12 | KEEP | Không có các thẻ quảng bá Nhanh chóng/Minh bạch/Đa thiết bị trong TSX hiện tại | Không tạo hoặc xóa chức năng để mô phỏng mockup |

E03–E10 là P2 UI/UX finishing, không quy thành lỗi backend/nghiệp vụ. Không tự chấm điểm thẩm mỹ.
Baseline chỉ xác minh SV/đợt 01; các màn khác được dùng để hồi quy shared component, không audit lại toàn hệ thống.

## B. Các phần triển khai và nghiệm thu

1. Token: palette neutral/navy/action, radius control 8/card 12/dialog 14, elevation 0–3.
   Giữ semantic success/warning/error hiện có; không thay mọi màu theo palette tham khảo.
2. Shared kit/shell: primary phẳng, badge gọn, heading 600, loading không đẩy kích thước;
   sidebar nhẹ trang trí, topbar giữ control thật. Kiểm bảng/dialog/dashboard/workflow dùng chung.
3. Finishing đăng ký: chỉnh stylesheet trong feature, gom rule pilot trùng nhau; giữ TSX/services,
   payload, API, gate, trạng thái và thứ tự thao tác. Chỉ bỏ DOM/icon/copy trang trí dư thừa.
4. Chạy ảnh sau ở bảy chiều rộng; kiểm API thật không ghi dữ liệu, keyboard/focus/reduced motion,
   axe/contrast/reflow, text dài/zoom mô phỏng. Hồi quy fixture chỉ là test cô lập; không tạo fixture mới
   thay API thật hoặc tuyên bố đã ghi database. Type-check, lint, build, unit tests và browser tests.

Nguồn nghiệm thu: [báo cáo / ảnh / log](evidence/enterprise-refinement/README.md).
Không sửa backend, schema/contracts, RBAC, data/service/router; không thêm dependency hay commit/push.
