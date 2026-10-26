# Tích hợp nguồn Stitch — frontend Bước 1–3

Nguồn tham chiếu: [Stitch project 3892494634894258957](https://stitch.withgoogle.com/projects/3892494634894258957). Mã nguồn thực tế dùng để chuyển giao diện nằm trong `design/stitch_project_one_starter/`, được cung cấp dưới dạng gói export gồm **6 bộ `code.html` + `screen.png`** và **`academic_minimalist/DESIGN.md`**. Tài liệu này xác nhận đã đọc mã HTML/CSS và ảnh trong workspace; không khẳng định đã tải trực tiếp nội dung project qua URL Stitch.

Theo phạm vi cập nhật, triển khai auth và **Bước 1–3**: đợt/kế hoạch/danh sách tham gia → đăng ký hướng/nguyện vọng → phân công/công bố/thông báo → thống nhất đề tài/đề cương/PDF. Năm màn nguồn liên quan được dùng; màn Hội đồng là tham khảo ngoài phạm vi hiện tại.

## Đối chiếu 6 màn nguồn

| Thư mục nguồn trong `design/stitch_project_one_starter/` | Màn nguồn | Route React tương ứng | Cách tích hợp |
| --- | --- | --- | --- |
| `ng_nh_p_h_th_ng_qu_n_l_n_t_t_nghi_p_utc` | Đăng nhập GPMS | `/login` | Chuyển bố cục, nhận diện UTC, khối form và trạng thái nhập liệu thành React; dùng auth mock chung thay JavaScript minh họa |
| `i_m_t_kh_u_h_th_ng_qu_n_l_n_t_t_nghi_p_utc` | Đổi mật khẩu | `/change-password` | Form mật khẩu hiện tại/mới/xác nhận và trạng thái lần đầu; dùng kiểm tra dữ liệu, thông báo và điều hướng React |
| `t_ng_quan_dashboard_gi_o_v_khoa_qu_n_l_n_t_t_nghi_p_utc_kh_i_t_o_t_m_i` | Dashboard Giáo vụ Khoa, đợt mới | `/` khi tài khoản Khoa | Giữ banner charcoal, thẻ chuẩn bị lilac, vùng chính 2/3 và sidebar 1/3, checklist và chỉ số; số liệu được tính từ đợt đã chọn. Rút tiến trình 10 bước nguồn về Bước 1–3 theo phạm vi cập nhật |
| `t_ng_quan_dashboard_sinh_vi_n_n_t_t_nghi_p_utc_ch_a_ng_k` | Dashboard SV chưa đăng ký | `/` khi tài khoản SV | Giữ trạng thái lớn trên banner, CTA tiếp theo, thẻ GVHD/đề tài/đề cương, mốc thời gian và thông báo. Chuyển timeline về 5 mốc thuộc phạm vi: hồ sơ → đăng ký → kết quả GVHD → thống nhất đề tài → đề cương/PDF |
| `t_ng_quan_dashboard_gi_ng_vi_n_h_ng_d_n_utc_ch_a_ph_n_c_ng` | Dashboard GV chưa phân công | `/` khi tài khoản GV | Giữ banner chỉ tiêu, danh sách SV, thẻ chuyên môn/hướng nghiên cứu và sidebar. Dùng SV được phân công đã công bố, đề tài chờ thống nhất và số phiên bản đề cương; trạng thái rỗng xuất hiện khi đợt chưa có phân công |
| `h_i_ng_b_o_v_n_t_t_nghi_p_kh_ng_gian_l_m_vi_c_ch_a_ph_n_c_ng` | Không gian Hội đồng chưa phân công | Không có route nghiệp vụ trong phạm vi hiện tại | Đã đọc để đối chiếu hệ thiết kế. Không triển khai luồng Hội đồng/bảo vệ/chấm điểm ở giai đoạn Bước 1–3 |

Dashboard Admin mở rộng từ cùng hệ card, typography, banner và bố cục của nguồn, với số liệu tài khoản/khóa/đổi mật khẩu/audit và liên kết đến các trang quản trị.

## Chuyển đổi kỹ thuật

- Giữ React + Vite + TypeScript, Tailwind, React Router, TanStack Query. Không thêm framework của nguồn hoặc CDN Tailwind chạy tại runtime.
- Tách phần giao diện dùng chung qua kit/layout hiện có. Dashboard dùng `DarkHero`, `DarkMetric`, `Milestones`, `Notifications`, `NextDeadline`, `QuickLink` trong `features/report/pages/DashboardPage.tsx`.
- Liên kết `href="#"`, onclick thao tác DOM và alert mẫu của HTML được thay bằng `Link`, state React, dialog và service của từng phân hệ. Không giữ nút minh họa không thực hiện công việc.
- Material Symbols của nguồn được ánh xạ sang `lucide-react` đã có trong repository. Các ảnh `screen.png` là ảnh đối chiếu thiết kế, không nhúng screenshot thay cho giao diện. Những màn nguồn này không có ảnh nội dung bắt buộc phải tải riêng.
- Dùng token Academic Minimalist: charcoal `#1e2024`, canvas `#fbfbfc`, lilac `#8e7ac4`, nền inset `#f3f2f8`, border `#e2e0ec`; góc 16/20/24 px và chữ Be Vietnam Pro theo `DESIGN.md`. Shell, form, table, button, badge và modal dùng CSS chung.
- Không sao chép thông tin minh họa không được xác thực trong HTML, ví dụ niên khóa 2024–2025, địa chỉ liên hệ văn phòng, tiêu chuẩn TLS/bcrypt, số chỉ tiêu hoặc số hướng cứng. Tên người, đợt, GPA, quota, mốc và số hướng lấy từ dữ liệu chung.

## Dữ liệu và trạng thái

`features/report/services/dashboard-service.ts` là lớp chọn dữ liệu theo vai trò/đợt. Dashboard không tạo mock rời. Giáo vụ xem số liệu đợt; SV chỉ xem hồ sơ mình; GV chỉ xem SV trong phân công đã công bố. Đề tài và GVHD của SV không lộ trước công bố. Thông báo giới hạn theo tài khoản hiện tại. Không có link từ dashboard sang hướng dẫn tuần, final, bảo vệ, chấm điểm hoặc báo cáo sau Bước 3.

Các trạng thái rỗng của HTML được giữ có ý nghĩa: đợt chưa có SV, GV chưa có phân công, SV chưa đăng ký, chưa có đề tài, chưa có phiên bản đề cương, chưa có thông báo và chưa có mốc sắp tới. Khi có dữ liệu, cùng card hiển thị số liệu thực từ mock chung. `DataBoundary` xử lý loading/error/retry; bảng có tìm kiếm và phân trang; CTA đi đến route hoạt động theo vai trò.

Các màn chức năng trong Bước 1–3 không có source riêng trong gói Stitch (danh mục, đợt chi tiết, bảng phân công, soạn đề cương...) được xây dựng bằng hệ component và token trên; không ghi nhận là màn đã có sẵn trong source.
