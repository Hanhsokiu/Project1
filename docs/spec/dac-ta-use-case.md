# ĐẶC TẢ CHI TIẾT NGHIỆP VỤ & 25 USE CASE HỆ THỐNG QUẢN LÝ ĐỒ ÁN TỐT NGHIỆP
**Đơn vị:** Trường Đại học Giao thông vận tải (UTC) – Bộ môn Công nghệ Thông tin
**Đề tài:** Phần mềm quản lý hướng dẫn đồ án tốt nghiệp trong trường đại học
**Nhóm thực hiện:** Nhóm 06 – Lớp CNTT VA1 K64

---

## 1. QUY TRÌNH 10 BƯỚC NGHIỆP VỤ CHÍNH

- **Bước 1:** Khoa tạo kỳ học, tạo đợt làm đồ án cho từng hệ (Chính quy, Liên thông, Từ xa), thiết lập kế hoạch mốc thời gian và nhập danh sách sinh viên đủ điều kiện.
- **Bước 2:** Sinh viên đăng nhập bằng mã SV (mật khẩu mặc định là mã SV), đổi mật khẩu, cập nhật Email/SĐT. Chọn 01 Hướng đồ án (trong danh mục 5 hướng: Phần mềm, Game, Kiểm thử, Học máy, Mạng) và đăng ký tối đa 03 nguyện vọng GVHD (NV1, NV2, NV3). Có thể ghép nhóm tối đa 2 SV/nhóm.
- **Bước 3:** Phân công GVHD bán tự động:
  - Ưu tiên NV1 -> Nếu vượt Quota ưu tiên GPA cao hơn hoặc đã từng làm việc chung -> Xét tiếp NV2, NV3 -> Trượt hết phân tự động theo Hướng.
  - Số SV còn lại Giáo vụ Khoa điều chỉnh thủ công.
  - Chốt phân công: Hệ thống gửi Email thông báo GV, mở quyền cho SV xem kết quả.
  - SV gặp GV thống nhất đề tài, cập nhật đề cương lên phần mềm, xuất PDF.
- **Bước 4:** Khoa tạo các nhóm giảng viên duyệt đề cương (theo Bộ môn).
- **Bước 5:** Phân đề cương về cho các nhóm bộ môn duyệt, họp xét duyệt trên hệ thống và đưa ra yêu cầu chỉnh sửa (nếu có).
- **Bước 6:** GVHD và SV thống nhất chỉnh sửa nội dung đề cương theo góp ý của nhóm duyệt.
- **Bước 7:** SV xuất đề cương hoàn thiện theo mẫu chuẩn, in xin chữ ký GVHD và nộp về Khoa.
- **Bước 8:** Hàng tuần, SV bắt buộc nộp báo cáo tiến độ và mã nguồn (source code) lên hệ thống. GVHD review, nhận xét, đánh giá (Đạt/Không đạt/Cần sửa), giao việc cho tuần tiếp theo. Lưu vết lịch sử nhận xét.
- **Bước 9:** Tổ chức bảo vệ:
  - SV nộp file PDF đồ án hoàn chỉnh. GVHD viết nhận xét và cho Điểm hướng dẫn.
  - Khoa lập các Hội đồng bảo vệ (3-5 GV/HĐ) và phân công Giảng viên phản biện (GVPB) theo nguyên tắc: **GV thuộc HĐ nào thì SV do GV đó hướng dẫn KHÔNG được phân cho thành viên HĐ đó chấm/phản biện** (GVHD tuyệt đối không ngồi chấm SV mình hướng dẫn). Cân bằng khối lượng giữa các HĐ và các thành viên.
  - GVPB tải file đồ án, đọc duyệt, viết nhận xét và nhập Điểm phản biện.
  - Sắp xếp thứ tự bảo vệ trong từng buổi (Sáng/Chiều) tự động theo bảng chữ cái: **Tên + Họ đệm**.
  - Ngày bảo vệ: Từng thành viên HĐ có giao diện riêng chấm điểm theo tiêu chí Rubric.
  - Tổng hợp điểm theo công thức chuẩn UTC:
    $$\text{Điểm Quá trình (QT)} = 0.5 \times \text{Điểm GVHD} + 0.5 \times \text{Điểm GVPB}$$
    $$\text{Điểm KTHP (Hội đồng)} = \frac{\sum \text{Điểm các thành viên HĐ}}{\text{Số thành viên HĐ}}$$
    $$\text{Điểm Học phần (Tổng kết)} = 0.4 \times \text{Điểm QT} + 0.6 \times \text{Điểm KTHP}$$
- **Bước 10:** Xuất kết quả bảo vệ tại các Hội đồng theo mẫu chuẩn để các thành viên đồng ký và nộp lưu trữ về Khoa.

---

## 2. DANH SÁCH 25 USE CASE CHUẨN

| ID | Tên Use Case | Tác nhân chính | Tác nhân phụ |
|---|---|---|---|
| **UC01** | Đăng nhập hệ thống & đổi mật khẩu lần đầu | Người dùng | Hệ thống |
| **UC02** | Quản lý tài khoản và phân quyền RBAC | Admin | Hệ thống |
| **UC03** | Giám sát lịch sử hệ thống (Audit Log) | Admin | Khoa/Giáo vụ |
| **UC04** | Quản lý danh sách sinh viên đủ điều kiện | Khoa/Giáo vụ | Hệ thống |
| **UC05** | Quản lý danh sách giảng viên & Quota | Khoa/Giáo vụ | Hệ thống |
| **UC06** | Quản lý danh mục hướng nghiên cứu | Khoa/Giáo vụ | Giảng viên |
| **UC07** | Quản lý đợt đồ án & vòng đời đợt | Khoa/Giáo vụ | Hệ thống |
| **UC08** | Quản lý kế hoạch & khóa/mở các giai đoạn | Khoa/Giáo vụ | Hệ thống |
| **UC09** | Đăng ký hướng đồ án & nguyện vọng GVHD | Sinh viên | Khoa/Giáo vụ |
| **UC10** | Phân công bán tự động & điều chỉnh GVHD | Khoa/Giáo vụ | Hệ thống, GV, SV |
| **UC11** | Quản lý & thống nhất đề tài đồ án | Sinh viên / GVHD | Khoa/Giáo vụ |
| **UC12** | Lập & cập nhật đề cương theo mẫu | Sinh viên | GVHD |
| **UC13** | Duyệt đề cương & chốt hồ sơ đề tài | Khoa/Giáo vụ | Nhóm GV duyệt |
| **UC14** | Lập kế hoạch & giao nhiệm vụ hàng tuần | GVHD | Sinh viên |
| **UC15** | Cập nhật tiến độ & nộp báo cáo tuần, code | Sinh viên | GVHD |
| **UC16** | Theo dõi, nhận xét & đánh giá tiến độ | GVHD | Sinh viên, Khoa |
| **UC17** | GVHD xác nhận điều kiện cho SV bảo vệ | GVHD | Khoa/Giáo vụ |
| **UC18** | Xét điều kiện bảo vệ & lọc danh sách | Khoa/Giáo vụ | Hệ thống |
| **UC19** | Thành lập & quản lý Hội đồng bảo vệ | Khoa/Giáo vụ | Thành viên HĐ |
| **UC20** | Phân công Giảng viên phản biện (GVPB) | Khoa/Giáo vụ | GVPB |
| **UC21** | Lập lịch bảo vệ & xếp thứ tự Alphabet | Khoa/Giáo vụ | SV, GV, HĐ |
| **UC22** | Nhận xét & chấm điểm phản biện | GV phản biện | Khoa/Giáo vụ |
| **UC23** | Thành viên HĐ nhập điểm ngày bảo vệ (Rubric) | Thành viên HĐ | Khoa/Giáo vụ |
| **UC24** | Tổng hợp, chốt & công bố kết quả (40/60) | Khoa/Giáo vụ | Thư ký, HĐ, SV |
| **UC25** | Báo cáo, xuất Excel & in PDF biểu mẫu | Khoa/Giáo vụ | Thành viên HĐ |

---

## 3. CÁC BIỂU MẪU CHUẨN CỦA KHOA CNTT - ĐẠI HỌC GIAO THÔNG VẬN TẢI

1. **Bản nhận xét và chấm điểm ĐATN của người hướng dẫn:** Nhận xét tính thực tiễn, ý thức thái độ, kết quả đạt được, Điểm /10 và chữ ký GVHD.
2. **Bản nhận xét và chấm điểm của người đọc duyệt (GVPB):**
   - A. Quyển báo cáo đồ án (5 điểm): Bố cục hình thức (2đ) + Nội dung (3đ).
   - B. Sản phẩm đồ án (5 điểm): Ý nghĩa thực tiễn (1đ) + Tính hoàn thiện (2đ) + Khả năng làm chủ sản phẩm (2đ).
   - C. Các câu hỏi trao đổi (Đặt ra ít nhất 2 câu hỏi cho SV).
   - D. Điểm tổng /10.
3. **Đề cương đồ án tốt nghiệp Cử nhân/Kỹ sư:** Mục tiêu, phạm vi, công nghệ, kết quả dự kiến, bảng kế hoạch theo tuần, 4 chữ ký (Trưởng Khoa, Trưởng Bộ môn, GVHD, SV).
4. **Tờ trình thành lập Hội đồng:** Danh sách từng HĐ, phân công nhiệm vụ: Chủ tịch Hội đồng, Thư ký, Ủy viên, cơ quan công tác.
5. **Bảng điểm bảo vệ đồ án tốt nghiệp Hội đồng:**
   - Cột: TTBV, Lớp, Mã SV, Họ đệm, Tên, Ngày sinh, GVHD, GVPB, HĐ, Tên đề tài.
   - Điểm: GVHD (1), GVPB (2), Chủ tịch HĐ (3), Thư ký (4), Ủy viên 1 (5), Ủy viên 2 (6).
   - Điểm QT (7) = (1)*0.5 + (2)*0.5.
   - Điểm KTHP (8) = ((3)+(4)+(5)+(6))/4.
   - Điểm HP = (7)*0.4 + (8)*0.6.
   - Cột Sửa: Ghi chú yêu cầu chỉnh sửa đồ án sau bảo vệ.
