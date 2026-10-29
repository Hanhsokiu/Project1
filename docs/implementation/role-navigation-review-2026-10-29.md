# Phân tích database và điều hướng bước 4–8

## Hoàn thiện giao diện theo vai trò

Lượt sửa tiếp theo tập trung trực tiếp giao diện:

- Dùng `WorkflowHeading` cho các danh sách nhóm duyệt, xét duyệt, đề cương, hồ sơ, kế hoạch và nhiệm vụ. Tiêu đề/lời dẫn theo role: SV xem hồ sơ, nộp bài; GV hướng dẫn/xét duyệt; giáo vụ phân công/chốt/giám sát. Không chỉ đổi nhãn trên sidebar.
- Sidebar cho phép thu gọn từng nhóm bằng nút có aria-expanded; khi mở workflow, nhóm hiện hành và mục chung được mở mặc định. Các mục ngoài role/permission tiếp tục bị loại khỏi menu.
- Bỏ ô tìm kiếm chung bị trùng với bộ lọc riêng ở nhóm duyệt, xét duyệt và đề cương. Giữ tìm kiếm cho hồ sơ/nhiệm vụ với nhãn đúng nội dung; không đưa thanh tìm kiếm lên trang chi tiết/đánh giá.
- Sửa lời dẫn “mở kế hoạch để giao nhiệm vụ” thành lời dẫn xem kế hoạch, phù hợp SV chỉ đọc. Trang đánh giá chỉ đọc dùng tên “Kết quả đánh giá báo cáo”; link quay lại không đưa SV vào inbox chỉ dành cho GVHD.
- Đổi enum trạng thái đề cương trong danh sách hồ sơ sang nhãn tiếng Việt. Thêm nút đóng menu trong sidebar trên mobile, giữ hỗ trợ Escape và focus trở về nút mở.
- Ba test mới xác nhận nội dung riêng cho SV, GV và giáo vụ. Toàn bộ frontend: **23 files / 128 tests PASS**; type-check/build PASS. Warning build CJS/bundle lớn và warning SSR test cũ vẫn còn.
- Kiểm tra browser bằng phiên tách riêng cho `sv004`, `gv001`, `giaovu`, `admin`: trang đúng role, không page error; bốn URL mẫu trái quyền đều chuyển 403. Mobile 390px không tràn ngang, mở/đóng menu được bằng nút và Escape. Ảnh kiểm tra nằm ở `.cache/ui-role-review/` (không đưa vào Git).

Lượt browser thử đầu có timeout do tái sử dụng phiên kiểm tra và chọn điểm click giữa lớp phủ mobile. Lượt cuối dùng browser context riêng cho mỗi user và nút đóng menu cụ thể; không coi các timeout của harness là kết quả nghiệm thu. Không thay DB, cấp thêm quyền backend hoặc chạy lại toàn bộ E2E ghi dữ liệu trong lượt sửa giao diện này.

## Kết quả và nguyên nhân

- `ui:dev` cố ý cô lập database/UI theo máy. Đây là môi trường thử, không đồng bộ dữ liệu nhóm bằng Git được. Storage local khiến mô hình nhiều backend/cùng DB còn lệch file.
- Sidebar đã lọc role trước lần thay đổi này, nhưng nhóm “Xét duyệt & hướng dẫn” gom nhiều mục, tên thiên về quản lý và chưa đối chiếu permissions của phiên API. Vì vậy không phải toàn bộ người dùng đều có mọi quyền, mà việc trình bày và kiểm tra quyền frontend còn thiếu nhất quán.
- Trang hàng đợi hiển thị link quản lý nhóm cho cả sinh viên dù sinh viên không được mở nhóm. Nhật ký nằm trên sidebar nhưng cần planId nên mở trực tiếp thường rỗng. Thanh tìm kiếm chung trên màn đánh giá/chi tiết có thể đưa người dùng sang danh sách nhiệm vụ không liên quan.
- Hai mục legacy xác nhận bảo vệ/báo cáo cuối kỳ dùng store trình duyệt, không phải workflow API 4–8. Hiển thị chung khiến người dùng nhầm dữ liệu đã ghi lên server.

## Thay đổi

1. Chọn mô hình một frontend/backend/DB/storage chung theo lựa chọn người dùng. Thêm compose riêng, API relative cùng origin, volume uploads bền vững, không tự migrate/seed. Giữ dev/test local riêng.
2. Tách “Đề cương & xét duyệt” và “Hướng dẫn đồ án”; tên menu theo role, khối ngữ cảnh sidebar hiển thị vai trò đăng nhập.
3. Dùng chung `canAccessRoute` cho sidebar và hai guard. Workflow API yêu cầu cả role và permission tương ứng. Backend vẫn kiểm scope/owner/phase/trạng thái và allowedActions; không thêm wildcard ADMIN hoặc cấp quyền trong database.
4. Giáo vụ tập trung dashboard giám sát; link kế hoạch/nhiệm vụ chi tiết vẫn giữ quyền đọc theo scope. Nhật ký mở từ kế hoạch; bỏ hai mục legacy khỏi sidebar. Đây là thay đổi điều hướng, không tuyên bố đã triển khai API mới cho các trang legacy.
5. Link quản lý nhóm chỉ xuất hiện khi được phép. Sidebar giữ termId hiện chọn khi mở workflow. Tìm kiếm chung chỉ xuất hiện trên danh sách phù hợp, không xuất hiện ở màn chi tiết/đánh giá/dashboard/nhật ký.
6. Viết hướng dẫn từng user, bảng quyền, điều kiện tiên quyết, mốc kết quả, kịch bản local và mẫu báo lỗi; thêm hướng dẫn server tích hợp và backup DB kèm file.

## Kiểm chứng

- Frontend type-check/build: PASS; còn warning Vite CJS/bundle lớn có sẵn.
- Vitest frontend: **22 files, 125 tests PASS**, gồm 5 test mới cho menu/guard: ADMIN không tự có quyền học vụ, permission bắt buộc ở API mode, phạm vi menu SV/giáo vụ, multi-role và demo mode. Có warning SSR useLayoutEffect của test render cũ.
- Trình duyệt thật local với login API: `sv001` thấy đề cương/kết quả/hồ sơ/kế hoạch/nhiệm vụ của SV, không có nhóm/giám sát/chấm bài; dán URL tạo nhóm chuyển 403.
- `giaovu`: có menu nhóm/phân công/chốt/giám sát, không có menu chấm báo cáo; dán `/guidance/review` chuyển 403.
- `gv001`: có nhóm/duyệt/kế hoạch/nhiệm vụ/nhận xét, không có menu giám sát giáo vụ; dán `/guidance/progress` chuyển 403.
- `admin`: không có menu nghiệp vụ 4–8; dán `/topic/proposal` chuyển 403.
- Supabase Project1 được inspect trong transaction READ ONLY, không DDL/seed/repair: kết nối thành công, public chưa có bảng ứng dụng hoặc lịch sử migration. Chi tiết ở tài liệu môi trường chung.

## Chưa xác minh hoặc chưa triển khai

- Chưa deploy môi trường chung, migrate/seed/chuyển dữ liệu hoặc công bố server. Cần chọn máy chủ và dữ liệu khởi tạo; máy hiện tại chưa có Docker trên PATH. Không thay backend local đang chạy sang Supabase trống.
- Kiểm tra trình duyệt lần này tập trung điều hướng và từ chối URL theo role. Không chạy lại toàn bộ thao tác ghi E2E 4–8, không suy từ các kiểm tra này rằng mọi scope/legacy API đều đã được audit lại.
- Quyền theo từng bản ghi vẫn phải kiểm trên backend. Cảnh báo bảo mật legacy trong tài liệu tích hợp cũ cần được đối chiếu và kiểm lại độc lập; lần thay đổi này không tự kết luận đã sửa tất cả API legacy.
- Sidebar lọc theo permission của phiên đăng nhập. Sau đổi quyền cần đăng nhập lại/refresh phiên; các nút thao tác tiếp tục dùng allowedActions mới nhất của backend.

Tài liệu: [môi trường chung](team-shared-environment.md), [hướng dẫn user](user-guide-steps4-8.md).
