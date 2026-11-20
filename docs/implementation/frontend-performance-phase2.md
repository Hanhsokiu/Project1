# Tách dữ liệu màn sinh viên — đợt 2

Ngày kiểm tra: 20/11/2026. Tiếp nối [đợt 1](frontend-performance-phase1.md).

## Phạm vi và nghiệm thu

Chỉ thay frontend của màn `/catalog/students` và cơ chế dữ liệu/bảng dùng chung
cần thiết. Không sửa backend, Prisma, contracts, permission guards hay quy tắc
nghiệp vụ. Giữ các thay đổi đợt 1 đang có trong working tree.

| Phần | Tiêu chí |
| --- | --- |
| Snapshot riêng | Mở màn sinh viên không gọi danh sách giảng viên, tài khoản, đăng ký, phân công, đề tài, outbox email hoặc nhật ký. |
| Hiển thị sớm | Lô sinh viên đầu xuất hiện dù lô thứ hai chưa trả về. Tổng bản ghi lấy từ API, không lấy số dòng đã tải làm tổng. |
| Kết quả đầy đủ | Thống kê điều kiện, lựa chọn lớp, tìm/lọc/sắp xếp toàn danh sách chỉ được kết luận khi tải đủ dữ liệu. GPA null vẫn không đủ điều kiện. |
| Tương tác | Giữ sửa sinh viên, lựa chọn qua nhiều trang, xuất Excel, phạm vi đợt/hệ/lớp/học vụ, reset và sắp xếp. |
| Trạng thái lỗi | API lỗi phải hiện lỗi thật và thử lại; không đổi thành danh sách rỗng thành công. Dữ liệu trùng/đổi tổng trong lúc tải không được dùng như thống kê đầy đủ. |
| Khả năng truy cập | Kiểm tra mobile/tablet/desktop, bàn phím, dialog và axe; đổi tài khoản không lẫn danh sách cũ. |

## Cách hoạt động

`WorkspaceLayout` chọn scope dữ liệu `student-directory` cho đúng màn sinh viên
khi dùng API thật. Các permission guard/redirect hiện có vẫn được giữ nguyên.
`DataBoundary` và `WorkspaceProvider` dùng chung query có scope này. Các màn khác
tiếp tục dùng snapshot đầy đủ; snapshot riêng không ghi đè snapshot đầy đủ trong
bộ nhớ của các consumer đồng bộ. Dữ liệu danh mục phục vụ thao tác lưu vẫn được
cập nhật từ lần hydrate gần nhất của cùng token.

Shell lấy đợt, kỳ học, hệ đào tạo, bộ môn và thông báo của chính người dùng.
Danh sách sinh viên có query riêng, lấy `/students?page=N&pageSize=100` qua
`httpClient` hiện có, giữ xác thực và hỗ trợ hủy request. Không tạo endpoint mới.
Lô tiếp theo được tải ở nền; tạm dừng việc tự lấy thêm lô khi mở form sửa.

Bảng vẫn hiển thị 8 dòng/trang, giữ nguyên bộ lọc và sắp xếp ở trình duyệt. Chế độ
collection bổ sung cho bảng chỉ được dùng ở màn này:

- Tổng API có thể hiển thị ngay; hai thống kê điều kiện và lựa chọn lớp hiển thị
  đang tải cho đến khi tập dữ liệu đầy đủ.
- Nếu đang tìm/lọc/sắp xếp trên tập chưa đầy đủ, bảng báo đang tải kết quả thay
  vì trả kết quả thiếu hoặc báo không tìm thấy. Các tiêu đề sắp xếp được giữ
  trong DOM để không làm mất focus bàn phím.
- Trang nằm vắt qua hai lô chờ đủ số dòng của trang đó, không bỏ qua các dòng
  chưa tải. Khi lỗi vẫn có thể quay về trang trước đã tải được.
- API lỗi có nút thử lại. Khi tổng hoặc ID thay đổi bất nhất giữa các lô, tổng
  không còn được coi là đã xác minh và thống kê không được công bố như đầy đủ.
- Query không giữ dữ liệu của token trước khi đổi phiên. Luồng API thật không
  đọc demo storage làm nguồn thay thế.

## Giới hạn còn lại

Đây là tải API theo lô kết hợp bảng phân trang tại trình duyệt, **chưa phải**
phương án chỉ tải duy nhất trang đang xem trong toàn bộ thời gian mở màn.
Để giữ thống kê và lựa chọn lớp hiện có, cuối cùng vẫn phải tải toàn bộ sinh viên
ở nền. Tổng dung lượng sinh viên vì vậy chưa giảm hoàn toàn; lợi ích đợt này là
hiển thị sớm, cache riêng và không tải các phân hệ không liên quan.

Backend hiện có bộ lọc trang/hệ/lớp/đợt/cờ học vụ, nhưng server search chưa tìm
theo lớp như giao diện; cờ học vụ cũng chưa bao gồm điều kiện GPA null của giao
diện. Chưa có summary/distinct-class API riêng cho các thống kê/lựa chọn hiện có.
Muốn bỏ việc tải toàn bộ, cần một phạm vi backend riêng để thống nhất các phần
này, rồi dùng phân trang/lọc/sắp xếp server hoàn toàn. Đợt này không tự thay các
contract hoặc thu hẹp chức năng để né giới hạn đó.

## Kiểm chứng

| Lệnh từ gốc repository | Kết quả |
| --- | --- |
| `corepack pnpm --filter @doan/frontend type-check` | Đạt. |
| `corepack pnpm --filter @doan/frontend lint` | Đạt. |
| `corepack pnpm --filter @doan/frontend test` | Đạt: 68 file, 419 test. Có cảnh báo SSR useLayoutEffect và Vite CJS từ bộ kiểm tra hiện có. |
| `node frontend/scripts/test-student-directory-browser.cjs` | Đạt 8 nhóm kiểm tra với 120 sinh viên; chặn lô 2, lỗi 503/thử lại, GPA null, tìm lớp ở lô sau, xuất 2 dòng qua 2 trang, sửa và đổi tài khoản. Axe 0 vi phạm; không tràn ngang ở 320/375/768/1440 px sau khi layout ổn định. |
| `corepack pnpm --filter @doan/frontend test:ui:browser` | Đạt 22 nhóm kiểm tra: 22 màn hiện có và 13 component ở 5 kích thước 320–1440 px, menu/modal bàn phím, chọn/xuất bảng, dashboard/điều hướng các vai trò. |
| `corepack pnpm --filter @doan/frontend build` | Đạt với `VITE_AUTH_API=true`, `VITE_DEMO_MODE=false`, `VITE_API_URL=/api`; còn cảnh báo bundle >500 kB, không thay ngưỡng để ẩn cảnh báo. |
| `node scripts/check-production-assets.cjs --frontend frontend/dist` | Đạt: 51 asset, 0 finding. |
| `git diff --check` | Đạt trên diff cuối. |

Kiểm tra browser là fixture cô lập, không truy cập Render/Supabase và không phải
benchmark production. Hai lượt kiểm tra đầu đã phát hiện cấu hình thư mục chạy
fixture/CSS và thời điểm đo ngay khi đổi viewport; harness đã sửa thư mục chạy,
dùng reduced motion và chờ layout ổn định trước chụp/đo. Không bỏ assertion
responsive hoặc tắt accessibility để báo đạt.

Bằng chứng nằm trong thư mục theo ngày bắt đầu đợt kiểm tra 19–20/11:
[kết quả và request đã gọi](../performance/evidence/2026-11-19-phase2/result.json),
[ảnh lô đầu khi lô sau bị chặn](../performance/evidence/2026-11-19-phase2/first-batch-desktop.png),
[mobile 375 px](../performance/evidence/2026-11-19-phase2/students-375.png),
[kết quả axe](../performance/evidence/2026-11-19-phase2/accessibility.json).
Kết quả hồi quy giao diện dùng chung:
[22 nhóm kiểm tra](../performance/evidence/2026-11-19-phase2/shared-table/result.json).

Chưa commit, push hoặc deploy; chưa đo lại hiệu năng bản production đã đăng nhập.
