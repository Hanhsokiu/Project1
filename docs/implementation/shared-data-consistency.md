# Đồng bộ dữ liệu và lựa chọn đợt — 05/11/2026

## Nguồn dữ liệu

Khi `VITE_AUTH_API=true`, các phần danh mục, đợt, import, đăng ký, phân công và đề tài đều sử dụng API của backend. Các cờ API riêng vẫn dùng được cho môi trường phát triển tách module khi không bật API auth.

Snapshot API bắt đầu từ danh sách trống, không đọc hoặc ghép dữ liệu demo trong localStorage. Các thao tác nghiệp vụ chỉ có triển khai demo bị từ chối ở lớp lưu trữ khi dùng API. Không thay đổi hoặc xóa dữ liệu demo cũ. Hai màn legacy xác nhận bảo vệ/báo cáo cuối kỳ vốn đã ẩn khỏi menu API được chặn cả khi mở URL trực tiếp.

Nhật ký hoạt động lấy metadata đã lưu từ `/api/audit-logs`, có quyền `audit:read`, phân trang và không trả raw payload của tài khoản. Xuất tệp sử dụng snapshot API; không tạo lịch sử xuất giả trong browser khi dùng tài khoản API. Lịch sử xuất tập trung chưa có API nên không hiển thị bảng lịch sử demo trong chế độ này.

## Một lựa chọn đợt

- ID trong URL là lựa chọn rõ ràng; trang chi tiết đợt lấy ID từ đường dẫn. Session chỉ ghi nhớ lựa chọn khi điều hướng qua các phần.
- Lựa chọn session có subscription chung, không còn bản sao useState ở mỗi layout. Khi URL chỉ định đợt ngoài phạm vi, không tự hiển thị dữ liệu của một đợt khác.
- Thanh trên và các bộ lọc workflow hiển thị cùng nhãn: mã đợt, tên đợt, hệ đào tạo. Các endpoint workflow vẫn lọc phạm vi theo quyền; cùng nguồn dữ liệu không có nghĩa mọi vai trò được xem cùng phạm vi.
- Đổi đợt từ trang chi tiết nhiệm vụ/hồ sơ quay về danh sách tương ứng, tránh giữ chi tiết của đợt cũ dưới tên đợt mới. Các tham chiếu tuần/kế hoạch và trang phân trang của đợt cũ được bỏ.
- Trang chi tiết mở qua bookmark/thông báo nhận lại `termId` từ hồ sơ đã được backend kiểm quyền, rồi đồng bộ URL và thanh trên. Không lấy đợt đã lưu trong session làm đợt của một hồ sơ khác.
- Danh sách đợt hướng dẫn dùng cùng endpoint scoped với trang tuần. Việc tạo/sửa đợt làm hết hạn cả cache tuần, nghĩa vụ và context hướng dẫn. Khi scope đang tải lại, không ghi đè lựa chọn đã lưu bằng đợt đầu trong cache cũ.
- Giữ cơ chế cập nhật hiện có: refetch sau ghi thành công, thông báo giữa các tab, khi quay lại cửa sổ và mỗi 30 giây khi trang hiển thị. Nội dung form chưa lưu được bảo vệ. Cache React Query xóa khi đổi tài khoản; snapshot kiểm tra token trước khi tái sử dụng và trước khi hoàn tất tải.

## Lịch hướng dẫn dùng chung

Producer quản lý đợt trước đây lưu `TERM_PHASE.code=WEEKLY`, trong khi consumer bước 8 chỉ tìm `TERM_PHASE_WORKFLOW.key=GUIDANCE`. Đây là nguyên nhân báo thiếu giai đoạn dù lịch đã có.

Tạo đợt và lưu lịch giai đoạn nay liên kết WEEKLY với GUIDANCE trong cùng transaction. Với các đợt cũ chưa có liên kết, bước 8 đọc trực tiếp phase WEEKLY duy nhất của đợt; dùng nguyên ngày giờ và trạng thái khóa, không tạo lịch khác hoặc ghi sửa dữ liệu khi đọc. Liên kết workflow rõ ràng đã tồn tại được giữ nguyên; trường hợp khác với WEEKLY được công cụ kiểm tra báo để đối soát.

Không có migration mới, reset, seed hay sửa dữ liệu nghiệp vụ trong lần thay đổi này.

## Kiểm chứng

- Frontend: 162/162 test đạt. TypeScript, lint và build đạt cho backend/frontend.
- Backend: các ca mới cho lịch dùng chung đạt; toàn bộ suite vẫn có 2 test import sinh viên lỗi đã tồn tại trước sửa đổi này. Không sửa nghiệp vụ import hoặc đổi expectation của hai test đó.
- Edge headless với API fixture: tạo đợt mới, đi qua các trang đề cương/xét duyệt/hồ sơ; chọn đợt ở thanh trên và trong trang; đổi đợt ở trang tuần, kiểm request đúng ID và reload; so nhãn Tổng quan với workflow; đổi tài khoản Khoa sang Giảng viên; kiểm scope tải chậm và giữ bộ lọc tìm kiếm. Đạt, không có lỗi JavaScript hoặc request ngoài fixture.
- Hồi quy UI API fixture: 11 ca giao nhiệm vụ, 10 ca nộp báo cáo và 10 ca nhận xét/tiến độ/nhật ký/thông báo đạt, có kiểm tra scope và viewport mobile. Các bài kiểm thử được cập nhật để thực hiện dialog xác nhận và nhập hạn sửa theo form hiện tại. Chạy lại bằng `pnpm --filter @doan/frontend test:data-consistency:browser`.
- Truy vấn READ ONLY database đang cấu hình: 4 đợt, tất cả có WEEKLY và thiếu liên kết GUIDANCE; không có xung đột liên kết hiện hữu. Mã `MD01` tương ứng tên `Đồ án tốt nghiệp 2026`.
- Database có 20 tài khoản, 12 sinh viên, 6 giảng viên, 46 bản ghi tham gia đợt và 2 hồ sơ. Kế hoạch hướng dẫn, tuần, nhiệm vụ, bài nộp và review tiến độ đều có 0 bản ghi. Các danh sách đó trống phản ánh dữ liệu thực, không phải mất đồng bộ.

Sau khi build backend có thể kiểm tra lại bằng `node backend/scripts/check-data-consistency.cjs`. Công cụ dùng kết nối runtime và transaction READ ONLY, không in URL hay thông tin đăng nhập.

Kiểm thử giao diện ở đây dùng fixture, không phải nghiệm thu toàn bộ nghiệp vụ với tài khoản thật trên database chung. Các bước nghiệp vụ vẫn phải được thực hiện: công bố tuần, khởi tạo kế hoạch hợp lệ, giao nhiệm vụ, nộp và đánh giá.
