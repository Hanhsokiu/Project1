# Kế hoạch redesign theo giai đoạn

**Đây là đề xuất sau audit, chưa bắt đầu coding.** Phát hiện và độ bao phủ ở [01](01-ui-audit.md); phạm vi màn ở [02](02-route-inventory.md); tiêu chí kiểm chứng ở [04](04-acceptance-criteria.md). Mỗi đợt là một phần nghiệm thu độc lập, không thay đồng loạt toàn ứng dụng.

## Nguyên tắc triển khai

Bám AGENTS.md: đọc code thực tế, giữ kit/kiến trúc/API/RBAC/nghiệp vụ. Premium Academic SaaS ưu tiên rõ việc cần làm, chữ dễ đọc, nền yên, spacing nhất quán; hạn chế gradient, glass, shadow và motion không có tác dụng. Giữ đầy đủ chức năng, thao tác và lịch sử. Không tự commit/push/merge.

Đánh giá P0 trước mỗi đợt: hiện **chưa xác minh P0**. Nếu xuất hiện mất/lộ dữ liệu hoặc chặn luồng diện rộng có bằng chứng, tách xử lý khẩn theo phạm vi được giao trước khi tiếp tục thiết kế. Không dùng lý do redesign để sửa backend hoặc nới quyền.

## Các đợt có thể nghiệm thu

| Đợt | Phạm vi cụ thể | Phụ thuộc / rủi ro | Bàn giao và điều kiện qua đợt |
|---|---|---|---|
| 0. Hoàn tất khoảng trống bằng chứng | Chạy lại R04, R29, R49–R57, R62; bổ sung R34 mobile và dashboard 320/768; phiên Admin/COMMITTEE chỉ khi được cấp | F02: request500/timeout gián đoạn; R27–R28 chưa có phiên. F05 phải đối soát reason trước khi đổi nhãn | Baseline thật có phiên/đợt/trạng thái; ghi rõ scope và capability. Không cho các route còn chặn vào danh sách đã nghiệm thu |
| 1a. CTA và nội dung phạm vi nhỏ | F04: PageActions/editor cũ; F14: copy môi trường; F06: mapping nhãn/time ở một component lịch sử | PageActions dùng nhiều trang; lựa chọn primary phải rõ ràng, không đổi callback hoặc permission. Copy không được hứa thao tác bị gate | Before/after R45 và một PageHeader khác, keyboard/menu, link editor và version không đổi. AC01/03/06/07/09 |
| 1b. Kit form và trạng thái dữ liệu | F08/F09: Field, error/hint, loading/empty/retry; F10: scale chữ/spacing trong phạm vi selector nhỏ | Không thay đổi schema; error/retry phải phân biệt request đọc và mutation. Shell recovery F02 có thể cần task kiến trúc riêng | Một form ngắn, form dài, modal và bảng dùng kit đều đạt AC02–AC04/AC08; tests phù hợp + type-check/lint/test/build |
| 2a. R39 Đăng ký nguyện vọng | Gom hướng/NV, deadline, trạng thái đã nộp và hành động lưu/nộp; giữ dữ liệu từ registration API | Phụ thuộc kit, hồ sơ đủ điều kiện và đợt đang mở; không thay số NV/thuật toán/validation | AC-R39 và regression thiếu liên hệ/quá hạn/đã nộp; desktop/mobile/tablet |
| 2b. R03 Chi tiết nhận xét | Ưu tiên bản nộp/phiên bản, tài liệu, kết quả và lịch sử; form đánh giá rõ | Quan hệ GVHD, revision và deadline; không lẫn đánh giá nhiệm vụ với điểm tốt nghiệp | AC-R03, cùng ID ở SV/GV/Khoa trong phạm vi được cấp; đủ trạng thái form/lịch sử, không đổi semantics |
| 2c. R34 Kỳ học & đợt | Bảng/card, tìm/lọc, trạng thái, dialog và đường sang cấu hình | Phải phục hồi API và bổ sung baseline mobile; Table/Modal có phạm vi dùng chung lớn | AC-R34, sort/search/pagination/empty, dialog cancel/focus; quy tắc lifecycle giữ nguyên |
| 2d. R26 Tổng quan | F01: hành động tiếp theo theo vai trò/giai đoạn, thống nhất mốc; giảm card trang trí F10 | Phụ thuộc nguồn dữ liệu chuẩn và quan hệ trạng thái đã đối soát; tách phần cần dữ liệu chưa có khỏi cải thiện bố cục | AC-R26: ba vai trò × ba giai đoạn; không lấy count hiển thị thay trạng thái nghiệp vụ |
| 3. Đề cương/xét duyệt/hồ sơ | R13–R24, R44–R46; bộ lọc/term context F11, lịch sử F06, handoff F04 | Version immutable, vòng xét duyệt, nhóm active, bản giấy/PDF khác nhau | Review theo từng nhóm list/detail/form; đối chiếu cùng proposalId/versionId và trạng thái, giữ tất cả action hợp lệ |
| 4. Hướng dẫn/báo cáo | R01–R12, R47–R48; F03 trạng thái nộp/hạn, F07 scope, F06 ngôn ngữ | Tuần khác nhiệm vụ; PDF cuối khác báo cáo tuần; policy/feature gate/thời hạn hiện chưa cho ghi | Từng nhóm tuần/nhiệm vụ/nhận xét/final được nghiệm thu riêng, thêm trạng thái thật khi có môi trường |
| 5. Vận hành và bảo vệ | R27–R43 còn lại; R49–R57; R58–R62 | Màn bảo vệ chưa audit nội dung đầy đủ. F05 cần nhiệm vụ dữ liệu; F12 matrix chỉ trình bày quyền. Admin cần phiên được cấp | Bổ sung audit trước thiết kế chi tiết, rồi nghiệm thu từng phân hệ. Không lặp một layout mù lên toàn bộ route |

## Vì sao chọn bốn màn đại diện

1. **R26 — `/` Tổng quan:** kiểm chứng hierarchy và hành động tiếp theo cho cả SV/GV/Khoa; giải quyết F01 có tác động rộng. Audit có desktop cả ba vai trò; mobile chỉ SV một trạng thái hoàn chỉnh.
2. **R39 — `/registration`:** form có hạn, điều kiện hồ sơ, xếp thứ tự nguyện vọng, validation và hai ý nghĩa lưu/nộp. Đã có baseline đủ desktop390/320/768 sau retry; phù hợp thử kit form.
3. **R03 — `/guidance/review/:submissionId`:** đọc nội dung dài/tệp, đánh giá và lịch sử cùng phiên bản; đã mở biến thể SV readonly và đúng GVHD. Đại diện workflow có quan hệ quyền và nghiệp vụ phức tạp.
4. **R34 — `/terms`:** bảng/filter/dialog và quản lý lifecycle của Khoa; phạm vi UI dễ giới hạn, tái sử dụng được Table/Modal. Phải hoàn tất baseline mobile trước nghiệm thu.

Đây là danh sách màn pilot, không bắt buộc bắt đầu bằng màn đầu tiên. Thứ tự coding đề xuất: kit nhỏ → đăng ký → nhận xét → kỳ học khi API ổn → tổng quan khi dữ liệu hành động tiếp theo đã đối soát.

## Phân tách phụ thuộc ngoài frontend

- **F02:** giao nhóm sở hữu môi trường/API kiểm tra request500/timeout bằng URL/thời điểm trong evidence; chưa biết nguyên nhân. Frontend chỉ cải thiện cách tải/lỗi trong phạm vi được duyệt, không dùng mock để vượt cổng nghiệm thu.
- **F05:** xác minh nghĩa reason của phương án đã chốt với dữ liệu/API/adapter. Không sửa database hoặc thuật toán trong ticket UI.
- **F04:** đối chiếu nguồn preview legacy với canonical version trước khi sửa adapter. Chưa có bằng chứng PDF xuất sai.
- **F07:** xác nhận phạm vi đọc theo quan hệ xét duyệt/GVHD. Không tự đổi permission hoặc lọc để che dữ liệu.
- **R47–R48:** policy chưa phê duyệt, tính năng ghi chưa bật và chưa tới hạn là điều kiện nghiệp vụ quan sát được; không gỡ gate để làm demo.
- **Admin/COMMITTEE:** thiếu phiên được cấp không đồng nghĩa lỗi phân quyền; giữ mục kiểm tra chờ.

## Cách nghiệm thu mỗi phần

Trước sửa, chốt route/role/state và file được phép sửa trong task, chọn baseline đúng dữ liệu. Sau sửa, đối chiếu ảnh, hành động, request và trạng thái với AC liên quan; ghi lệnh/kết quả/giới hạn. Không gộp đổi token, tái cấu trúc data layer và thay hàng loạt page trong một phần khó review.

Nếu thiếu dữ liệu hoặc API lỗi, nghiệm thu riêng phần code/component được kiểm tra và để phần tích hợp ở trạng thái chưa đạt. Không giảm tiêu chí, xóa test hoặc tuyên bố hoàn thành dựa trên fixture. Chỉ mở rộng sang nhóm tiếp theo sau khi phần pilot liên quan được người dùng nghiệm thu; không tự triển khai phần tiếp theo từ hồ sơ audit này.
