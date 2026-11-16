# Quy tắc làm việc và redesign giao diện

Áp dụng toàn repository cho hệ thống Quản lý hướng dẫn Đồ án Tốt nghiệp.
Kế thừa quy ước kỹ thuật trong [CLAUDE.md](CLAUDE.md) và hướng dẫn môi trường trong
[README.md](README.md); không sao chép lại các quy ước đó ở đây. Các giới hạn dưới đây
áp dụng cho nhiệm vụ redesign, không mặc nhiên cho phép mở rộng sang triển khai nghiệp vụ.

## Đọc trước, giữ đúng phạm vi

- Đọc code thực tế, chỉ dẫn liên quan và `git status` trước khi sửa; đối chiếu tài liệu
  với implementation hiện tại, không suy đoán từ tên file hoặc bản thiết kế cũ.
- Chỉ sửa file thuộc nhiệm vụ được giao; giữ nguyên thay đổi có sẵn của người khác.
  Nhiệm vụ lớn phải có kế hoạch, chia thành phần nhỏ với phạm vi và tiêu chí nghiệm thu rõ ràng.
- Không tự ý sửa backend, Prisma schema/migrations, API contracts (gồm
  `shared/src/contracts/`) hoặc RBAC, kể cả logic kiểm quyền phía frontend.
- Giữ nguyên quy tắc nghiệp vụ, validation, luồng trạng thái và điều kiện thao tác.
  Không xóa, đổi tên hoặc vô hiệu hóa chức năng đang hoạt động để phù hợp thiết kế.
- Giữ kết nối API thật qua service/hook hiện có; không tạo mock data hoặc bật chế độ demo
  để thay API thật. Khi API thiếu dữ liệu hoặc lỗi, hiển thị trạng thái thật và khả năng thử lại.
  Tài liệu/mock cũ không phải căn cứ chuyển ứng dụng sang dữ liệu giả.

## Kiến trúc và thiết kế

- Tôn trọng pnpm monorepo (`frontend/`, `backend/`, `shared/`) và kiến trúc React/Vite/TypeScript
  hiện tại. Bám theo `frontend/src/app/`, `features/`, `shared/`; không tự thay framework hoặc component kit.
- Ưu tiên tái sử dụng `frontend/src/shared/components/` (kit, bảng, form, modal, menu)
  và component của từng feature, như `features/guidance/components/guidance-kit.tsx`.
- Ưu tiên design tokens trong `frontend/src/design-system.css`, `frontend/src/index.css`
  và `frontend/tailwind.config.ts`; mở rộng nhất quán khi cần, tránh hardcode và sao chép component.
  Kiểm tra các màn dùng chung khi thay token hoặc component dùng chung.
- Phong cách **Premium Academic SaaS**: tinh tế, chuyên nghiệp, ít trang trí thừa, dễ sử dụng;
  ưu tiên phân cấp thông tin, typography dễ đọc, khoảng cách và thao tác rõ ràng.
- Không lạm dụng gradient, glassmorphism, shadow hoặc animation. Animation phải có mục đích
  và hỗ trợ `prefers-reduced-motion`.
- Bảo đảm responsive trên mobile/tablet/desktop, keyboard navigation, focus rõ và quản lý
  focus cho dialog/menu; dùng HTML semantic, nhãn truy cập, tương phản dễ đọc, không chỉ dùng màu
  để truyền đạt trạng thái. Giữ đầy đủ loading, empty, error, success và disabled states.

## An toàn và kiểm chứng

- Không đọc bí mật từ `.env`/`.env.*`; không in hoặc sao chép bí mật vào log, báo cáo hay commit.
- Không chạy lệnh phá hủy dữ liệu, reset database hoặc force push.
  Không tự động commit, push hoặc merge khi người dùng chưa yêu cầu.
- Mỗi thay đổi phải có bằng chứng kiểm tra phù hợp: ghi lệnh, kết quả và giới hạn kiểm chứng.
  Với code frontend, chạy các kiểm tra liên quan trong `frontend/package.json`
  (`type-check`, `lint`, `test`, `build`) theo phạm vi và yêu cầu nhiệm vụ;
  tham chiếu [.github/workflows/frontend-ci.yml](.github/workflows/frontend-ci.yml) khi cần kiểm tra CI.
- Với giao diện, kiểm tra màn/luồng bị ảnh hưởng, responsive, bàn phím và accessibility;
  lưu bằng chứng phù hợp. `test:ui:browser` hiện dùng fixture cô lập, không chứng minh tích hợp API thật.
  Thay đổi chỉ tài liệu cần kiểm tra nội dung, đường dẫn và diff; không buộc chạy ứng dụng.
- Không báo hoàn thành khi chưa chạy những bài kiểm tra đã yêu cầu hoặc khi còn lỗi liên quan
  chưa xử lý. Nếu bị chặn, nêu rõ kiểm tra chưa chạy, nguyên nhân và phần chưa được xác minh;
  không bỏ qua, vô hiệu hóa test hoặc hạ tiêu chí để báo đạt.
