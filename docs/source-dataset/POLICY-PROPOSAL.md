# Cấu hình đề xuất cho phần bảo vệ và chấm điểm NGUON80

**Cập nhật theo yêu cầu mới ngày 18/11/2026:** người dùng xác nhận bộ này dùng để test và yêu cầu điều chỉnh thời gian để mọi bước có dữ liệu ngay. Lịch 19/11 ở bản v1 bên dưới đã được thay bằng lịch test ngày **18/11/2026**, mở DEFENSE sau các thao tác FINAL đã hoàn thành. UC21/UC23/UC24 được lưu phiên bản mới cùng audit, 6 policy nguồn giữ nguyên. Có 4 phòng mô phỏng, mỗi slot 10 phút + 5 phút đệm; phiên công bố lúc 21:00, thời lượng tùy số sinh viên. Công thức 20/20/60 và rubric 30/30/20/20 giữ nguyên. Xem `.cache/source-dataset/accelerated-defense-report.json` và các bản `before-accelerated-v2` để đối chiếu. Đây là lịch test, không phải lịch/kết quả học vụ thật.

**Cập nhật đã duyệt ngày 19/11/2026:** riêng UC24 có phiên bản v3: điểm cuối làm tròn HALF_UP một chữ số, bước 0.1 và lưu một chữ số; trung bình thành phần vẫn hai chữ số. Trọng số 20/20/60 và ngưỡng đạt 5 giữ nguyên. Đã áp dụng và kiểm chứng 8 kết quả, trong đó 4 đã công bố. Các quyền dùng chung được duyệt riêng trong [FINAL-STAGES-REVIEW.md](FINAL-STAGES-REVIEW.md), đối chiếu 21 liên kết đúng audit. Bản hiện hành ở `policy-approval.private.json` và `policy-release-report.json`; bản trước v3 được lưu với hậu tố `before-final-precision-v3`.

Phần dưới ghi lại cấu hình v1 trước yêu cầu mới, không dùng lịch hoặc hash cũ để tiếp tục runner.

Trạng thái: **đã phát hành đủ 9 policy, 3 phòng mô phỏng và 4 tiêu chí vào Supabase ngày 18/11/2026**.
Bản cấu hình cụ thể nằm tại `../../.cache/source-dataset/policy-proposal.json`.
Ngày 18/11, người dùng xác nhận chuyển lịch sang **19/11/2026**, giữ nguyên
các cấu hình khác để có thời gian thực hiện báo cáo cuối và xét điều kiện trước bảo vệ.
Phê duyệt hiện tại gắn với SHA-256 `fa23f848d8d1f5755550067fd78ed419da44aeab7b2b105d0be4a4d65527ff23`,
lưu tại `policy-approval.private.json`. Không tái sinh hoặc sửa bản cấu hình đã duyệt;
nội dung thay đổi cần được đối chiếu và duyệt lại. Lệnh tạo bản đề xuất ban đầu là
`node scripts/source-dataset/policy-proposal.cjs --defense-date 2026-11-18`.
Bản cũ được lưu riêng với hậu tố `superseded-2026-11-18`; công cụ đổi lịch đã
đối chiếu rằng chỉ ngày bảo vệ và các mốc hiệu lực phụ thuộc ngày được thay đổi.
Cấu hình chỉ dành cho lịch sử tổng hợp mà người dùng yêu cầu. Không xác nhận các
sinh viên thực sự đã bảo vệ, nhận điểm hoặc đáp ứng điều kiện học vụ.

| Phần | Giá trị đề xuất |
|---|---|
| Báo cáo cuối | PDF tối đa 20 MiB; điểm GVHD 0–10, bước 0,1; không thay báo cáo sau quyết định |
| Điều kiện bảo vệ | Tất cả nhiệm vụ đang hiệu lực đạt; Khoa ghi xác nhận học vụ với nguồn tổng hợp |
| Hội đồng | 3–5 thành viên trong roster, một chủ tịch và một thư ký khác người; GVHD không chấm sinh viên mình |
| Phân hội đồng | Sinh viên đúng bộ môn phụ trách; tối đa 12 SV/hội đồng; mỗi GV tối đa 3 hội đồng và 24 SV hội đồng |
| Phản biện | Một người/SV, có hướng chuyên môn phù hợp; được chọn khác bộ môn; không là GVHD hiện tại hoặc trước đây; có thể là thành viên hội đồng |
| Tải phản biện | Tối đa 10 bài phản biện/GV và tổng 40 nhiệm vụ hướng dẫn + hội đồng + phản biện |
| Lịch đã duyệt lại | Ngày **19/11/2026**, giờ Việt Nam; sáng 07:30–11:30, chiều 13:30–17:30 |
| Phiên và phòng | 25 phút/SV, nghỉ 5 phút giữa SV, nghỉ 15 phút giữa phiên; tối đa 8 SV/phiên; 3 phòng mô phỏng, sức chứa 40 |
| Xung đột lịch | Kiểm tra tất cả các đợt; không bỏ qua lịch cũ chưa đối soát; phản biện không bắt buộc tham dự |
| Phiếu phản biện | Điểm 0–10, bước 0,1; có nhận xét, ưu/nhược điểm và ít nhất 2 câu hỏi; chốt rồi không sửa |
| Phiếu hội đồng | Bốn tiêu chí: nội dung/phân tích 30%, thiết kế/triển khai 30%, kiểm thử/kết quả 20%, trình bày/trả lời 20%; mỗi tiêu chí 0–10, bước 0,1 |
| Thời điểm chấm | Chủ tịch, thư ký và thành viên chấm trong thời gian phiên đã công bố, theo đồng hồ thật của hệ thống |
| Minh chứng buổi bảo vệ | Không yêu cầu minh chứng tham dự cho lịch sử tổng hợp; không sinh chữ ký hoặc xác nhận buổi bảo vệ thật |
| Điểm cuối | **20% GVHD + 20% phản biện + 60% trung bình hội đồng**; làm tròn HALF_UP đến 2 chữ số; đạt từ 5,00; không tự gán xếp loại |
| Xác nhận/chốt | Chủ tịch và thư ký xác nhận, hai người khác nhau; Khoa chốt, khác người xác nhận; cùng Khoa có thể công bố |
| Sinh viên xem | Kết quả cuối và các điểm thành phần sau công bố; phiếu chưa công bố không được phát hành |
| Biểu mẫu | 15 mẫu XLSX/PDF hiện có, có tên đánh dấu tổng hợp; bản nháp thể hiện trạng thái thiếu; không giả chữ ký; lưu 365 ngày |

Công thức 20/20/60 được suy ra từ công thức ở sheet **HĐ6**, hàng 3 của file
`3. Chấm điểm- HD6.xlsx`: QT = (HD + PB)/2, HP = 0,4 × QT + 0,6 × KTHP.
Các tiêu chí, ngưỡng đạt, phòng, hạn mức và lịch nêu trên là **đề xuất mới**,
không phải thông tin trích nguyên từ tài liệu nguồn.

Mốc hiệu lực của giai đoạn DEFENSE: 00:00 ngày 19/11/2026 đến hết đợt
đã tạo (12:50:56 ngày 15/02/2027, giờ Việt Nam). Chỉ ngày 19/11 nằm trong danh
sách ngày xếp lịch. Giai đoạn FINAL phải được bố trí trước mốc DEFENSE qua
TermLifecycleService; kiểm tra lại lịch thực tế trước áp dụng. Nếu chưa chạy kịp
trước ngày này, phải lập lại bản lịch và kiểm tra, không giả đồng hồ hoặc audit.

Việc phê duyệt ở đây là chốt cấu hình cho bộ dữ liệu tổng hợp. Không coi đây là
quyết định của trường. Cổng phát hành hiện tại
[`preparePolicyRelease`](../../backend/src/defense/policies/policy-release.ts)
yêu cầu dấu phê duyệt gắn với đúng nội dung cấu hình trước khi ghi; bản DRAFT
không được đổi trạng thái chỉ để vượt kiểm tra. Quyền và cờ bật ghi UC17–25 cũng
phải được kiểm tra trước khi thực thi các thao tác tiếp theo.

Giới hạn: lịch ghi điểm hội đồng chỉ mở trong phiên thật theo giờ hệ thống.
Không thể tạo điểm hội đồng cho một phiên ngày mai bằng cách gọi đúng service
trong hôm nay. Phần đề cương, hồ sơ và hướng dẫn vẫn có thể hoàn thiện trước.
