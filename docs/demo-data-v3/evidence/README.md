# Bằng chứng thực thi

Chụp ngày **16/11/2026**, frontend React thật trên `127.0.0.1:5183` → Nest API TEST `127.0.0.1:3083` → PostgreSQL riêng `baseline_v3`. Playwright MCP dùng phiên đăng nhập tách biệt theo role; không intercept/fulfill API và không dùng fixture browser của UI redesign.

| Ảnh                                              | Route / tài khoản tổng hợp                                           | Viewport / trạng thái đã quan sát                                            |
| ------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [Dashboard SV](student-dashboard.png)            | `/` · demo3_sv074                                                    | 1440×900; hồ sơ và các mốc thật, chụp lại sau sửa nhãn phase                 |
| [Đăng ký](student-registration.png)              | `/registration` · demo3_sv074                                        | 1440×900; đã nộp, hết hạn, không mutate                                      |
| [Danh sách kế hoạch](student-guidance-plans.png) | `/guidance/plan` · demo3_sv074                                       | 1440×900; current term                                                       |
| [Chi tiết kế hoạch](student-guidance-detail.png) | `/guidance/plan/eee81099-9885-58c8-9f56-dbf0b276f35a` · demo3_sv074  | 1440×900; các tuần đã hoàn thành và công việc tiếp theo                      |
| [Kế hoạch mobile](student-guidance-mobile.png)   | cùng route chi tiết trên                                             | 390×844; kiểm tra scrollWidth không vượt innerWidth ở thời điểm đo           |
| [Inbox rỗng đúng bộ lọc](lecturer-reviews.png)   | `/guidance/review` · demo3_gv01                                      | 1440×900; mặc định chỉ chờ nhận xét, dữ liệu GV này đã PASS                  |
| [Inbox cần sửa](lecturer-revision-inbox.png)     | `/guidance/review` · demo3_gv06                                      | 1440×900; mở bộ lọc, bỏ chỉ chờ đánh giá, chọn REVISION_REQUIRED; thấy SV079 |
| [Chi tiết nhận xét](lecturer-review-detail.png)  | `/guidance/review/c14a0e4f-61ec-5ec1-96b2-21c133ad0bb4` · demo3_gv06 | 1440×900; kết luận Cần sửa, lịch sử đúng GV, liên kết REPORT/SOURCE          |
| [Hai đợt](faculty-terms.png)                     | `/terms` · demo3_giaovu1                                             | 1440×900; 76 và 11 SV, 18 GV/đợt; DEFENDING và IN_PROGRESS                   |
| [Tiến độ toàn đợt](faculty-progress.png)         | `/guidance/progress` · demo3_giaovu1                                 | 1440×900; 66 task, 49 PASS, 3 cần sửa, 1 chờ đánh giá, 2 quá hạn chưa nộp    |

Các route guidance kèm `termId=256adf1f-1c50-546a-b7a1-58fcb735d56f` của DEMO-2026-10. 66 task gồm 6 tuần của 11 SV, không phải tổng 11 trạng thái của riêng tuần 5. Số nhóm tổng hợp có thể giao nhau theo giải thích của UI.

Quan sát request thật trả 200: `/auth/me`, `/terms`, `/students` (giáo vụ), `/lecturers`, `/registrations`, `/registrations/term/:id/me`, `/topics/term/:id`, `/assignments/term/:id/results`, `/weekly-plans/options`, `/terms/:id/proposals`, `/notifications/me`. Không lưu headers/token/request body đăng nhập. Tải PDF/source và kiểm checksum qua API được kiểm tra riêng trong [api-smoke.json](api-smoke.json).

Tab trên Dashboard đưa focus tới liên kết “Đi đến nội dung chính”. Đây chỉ là một kiểm tra focus; không tuyên bố audit WCAG/keyboard toàn hệ thống. Browser ghi 0 console errors tại lượt Dashboard, có warning React Router future flags. Lần đầu dùng nhầm `/guidance/plans` trả 404 và locator heading/filter sai khiến automation timeout; đã sửa đường dẫn/locator rồi chụp lại đúng màn, không gán đó là lỗi sản phẩm.

Các test unit frontend dùng fixture/mock theo thiết kế test, **không** là bằng chứng PostgreSQL. Lần đầu runner frontend thiếu alias do truyền sai tham số ViteOverrides gây lỗi import; đã sửa runner, giữ nguyên assertions và chạy lại. Những trạng thái không mở qua browser không được đánh dấu đã quan sát.
