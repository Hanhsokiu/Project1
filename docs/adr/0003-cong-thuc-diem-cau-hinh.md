# ADR-0003: Công Thức Điểm Cấu Hình Được (Chuẩn UTC)

## Trạng thái
Đã quyết định (Đồng bộ với Bảng điểm thực tế Hội đồng 6 - UTC)

## Bối cảnh
Công thức tính điểm đồ án tốt nghiệp cần linh hoạt theo từng đợt nhưng phải tuân thủ đúng quy định đào tạo của Trường Đại học Giao thông vận tải:
- Điểm Quá trình (QT): kết hợp giữa đánh giá của Giảng viên hướng dẫn (GVHD) và Giảng viên phản biện (GVPB).
- Điểm Kết thúc học phần (KTHP): kết quả đánh giá trực tiếp của Hội đồng bảo vệ.
- Điểm Học phần (HP): tổng hợp theo tỷ lệ 40% Quá trình và 60% Hội đồng.

## Quyết định
Lưu các trọng số cấu hình trong bảng `TERM_PARAMETER`, không hardcode trong mã nguồn:
```sql
KEY                          VALUE   DESCRIPTION
process_weight               0.4     Trọng số điểm quá trình QT (40%)
committee_weight             0.6     Trọng số điểm hội đồng KTHP (60%)
advisor_weight_in_process    0.5     Trọng số GVHD trong điểm quá trình (50%)
reviewer_weight_in_process   0.5     Trọng số GVPB trong điểm quá trình (50%)
min_pass_score               5.0     Điểm đạt tối thiểu (thang 10)
passing_gpa_threshold        2.0     GPA tích lũy tối thiểu để được làm đồ án
```

### Công thức tính cụ thể:
1. $\text{Điểm QT} = \text{Điểm GVHD} \times 0.5 + \text{Điểm GVPB} \times 0.5$
2. $\text{Điểm KTHP} = \frac{\sum \text{Điểm thành viên HĐ}}{\text{Số lượng thành viên HĐ}}$
3. $\text{Điểm HP} = \text{Điểm QT} \times 0.4 + \text{Điểm KTHP} \times 0.6$

`ScoreAggregatorService` đọc các giá trị này từ `TermParameter` khi tính toán, đảm bảo:
- Cho phép điều chỉnh trọng số linh hoạt theo từng năm học hoặc hệ đào tạo.
- Khớp 100% với Bảng điểm thực tế và biên bản lưu chiểu của Khoa.
