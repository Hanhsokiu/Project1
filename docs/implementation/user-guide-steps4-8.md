# Hướng dẫn sử dụng và kiểm tra bước 4–8 theo vai trò

Ngày 29/10/2026. Dùng cùng địa chỉ hệ thống và cùng đợt khi kiểm tra chéo người dùng. Đường dẫn trong tài liệu là phần phía sau tên miền; ở local là `http://127.0.0.1:5173`, trên server là địa chỉ nhóm thống nhất. Không chép ID hồ sơ local sang database chung.

## 1. Ai làm gì?

| Người dùng | Mục chính bước 4–8 | Được thao tác khi đủ điều kiện | Không được làm |
| --- | --- | --- | --- |
| Quản trị ADMIN | Quản lý tài khoản/quyền; không có menu nghiệp vụ 4–8 chỉ nhờ vai trò admin | Tạo, khóa/mở tài khoản, cấp đúng vai trò/quyền | Tự duyệt, chốt hoặc đánh giá thay giảng viên/giáo vụ |
| Giáo vụ FACULTY | Nhóm duyệt, phân công & xét duyệt, tra cứu đề cương, chốt hồ sơ & nhận giấy, theo dõi tiến độ | Quản lý trong đợt/bộ môn có grant; phân nhóm, chốt bản đã duyệt, ghi nhận nhận giấy | Kết luận thay nhóm duyệt; sửa/nộp bài thay SV; chấm báo cáo thay GVHD |
| Giảng viên LECTURER | Nhóm duyệt, đề cương cần xét duyệt, đề cương/hồ sơ SV, kế hoạch, nhiệm vụ, nhận xét báo cáo | Xét duyệt nếu có phân công nhóm; hướng dẫn nếu là GVHD hiện hành; thêm nhật ký từ kế hoạch | Xem tùy ý SV ngoài phạm vi; chốt/nhận giấy thay giáo vụ |
| Sinh viên STUDENT | Kết quả xét duyệt, đề cương của tôi, hồ sơ & bản in, kế hoạch của tôi, nhiệm vụ & nộp báo cáo | Sửa/nộp đề cương và báo cáo của mình khi workflow cho phép; xem nhận xét/nhật ký | Tạo nhóm, phân công, duyệt/chốt, tự đánh giá Đạt, xem hồ sơ SV khác |
| Hội đồng COMMITTEE | Không có menu nghiệp vụ 4–8 chỉ nhờ vai trò hội đồng | Chức năng khác theo phân công của giai đoạn tương ứng | Quyền duyệt/hướng dẫn không tự suy từ vai trò hội đồng |

Menu dùng cả role và permission đăng nhập. Nếu một tài khoản có nhiều role, các mục hợp lệ được hợp nhất. Phạm vi từng bản ghi, phase và trạng thái vẫn do backend quyết định; ẩn menu không thay cho bảo vệ API. Tài khoản giảng viên có thể đồng thời là người duyệt của nhóm A và GVHD của SV B, nhưng hai phạm vi này độc lập.

Nhật ký được mở từ một kế hoạch có planId, không là mục sidebar rỗng. Giáo vụ vào giám sát từ **Theo dõi tiến độ**, các trang kế hoạch/nhiệm vụ liên quan vẫn có thể đọc theo scope. Hai trang legacy “Xác nhận bảo vệ”, “Báo cáo cuối kỳ” được bỏ khỏi sidebar bước 4–8 vì còn dùng dữ liệu demo trình duyệt, chưa đại diện cho API quy trình này.

## 2. Trước khi thao tác

1. Mở `/login`, đăng nhập tài khoản được cấp. Hoàn thành đổi mật khẩu/hồ sơ nếu được yêu cầu.
2. Chọn **Đợt làm việc** trên header; kiểm tra đợt ở bộ lọc nội dung nếu có. Khi di chuyển bằng sidebar, đợt hiện chọn được đưa vào link.
3. Kiểm tra mã/tên SV, tên đề tài và trạng thái trước khi bấm. Không kết luận lỗi quyền chỉ vì chưa xuất hiện nút: phase có thể chưa mở hoặc thiếu đầu vào.
4. Với UI local đã chuẩn bị: mật khẩu mẫu `Demo@2026`, `giaovu`, `gv001`–`gv004`, `sv001`–`sv004`. Chọn **DEMO 4–8 · Hồ sơ, xét duyệt và hướng dẫn**. Database chung cần tài khoản/dữ liệu riêng do quản trị xác nhận.

Đầu vào bước 1–3 cần có: SV thuộc đợt, hồ sơ lớp/ngành được xác nhận, phân công GVHD chính thức, thống nhất đề tài và bàn giao hợp lệ; thêm routing hướng/bộ môn, grant giáo vụ, lịch các phase. Bước 8 cần giai đoạn GUIDANCE, kỳ hướng dẫn và nghĩa vụ báo cáo tuần. Nếu thiếu, sửa ở chức năng nguồn tương ứng hoặc báo người phụ trách cấu hình; không cập nhật trạng thái trực tiếp bằng SQL.

## 3. Giáo vụ — bước 4: nhóm duyệt

1. Mở **Nhóm duyệt đề cương** (`/topic/review-groups`), chọn đúng đợt, lọc/tìm nhóm theo bộ môn.
2. Chọn **Tạo nhóm** nếu có quyền quản lý. Điền các trường bắt buộc của form, chọn bộ môn và giảng viên hợp lệ trong danh sách; kiểm tra phân vai/thành viên theo form rồi lưu.
3. Mở nhóm vừa tạo, kiểm tra danh sách thành viên và thông báo lưu thành công. Dùng chức năng sửa nếu cần; nếu nhóm đã được dùng hoặc bị khóa, đọc thông báo trước khi thay đổi.
4. Đăng nhập một giảng viên của nhóm và một giảng viên ngoài nhóm để đối chiếu phạm vi. Thành viên chỉ có quyền đọc không được thấy nút tạo/sửa của giáo vụ.

Kết quả mong đợi: nhóm xuất hiện trong đợt/bộ môn đúng; người không có scope không đọc được chi tiết bằng cách dán URL. Nếu không có giảng viên để chọn, kiểm tra roster giảng viên, bộ môn, grant và giai đoạn; tạo account giảng viên đơn thuần chưa đủ.

## 4. Giáo vụ — bước 5: phân công đề cương vào nhóm

1. Mở **Phân công & xét duyệt** (`/topic/reviews`). Chọn đợt, lọc hồ sơ chưa phân công hoặc tìm SV.
2. Mở hồ sơ đủ điều kiện, chọn thao tác phân công khi hiển thị. Trang `/topic/review-assignments/:proposalId` phải mở từ hồ sơ thật.
3. Chọn nhóm phù hợp routing/bộ môn và các trường yêu cầu trên form, kiểm tra phiên bản được gửi duyệt rồi xác nhận.
4. Quay lại danh sách, kiểm tra nhóm đã gán và vòng duyệt. Đăng nhập thành viên nhóm để kiểm tra hồ sơ xuất hiện trong inbox.

Kết quả mong đợi: phân công gắn với phiên bản cụ thể; không tự coi việc phân công là đã duyệt. Không có nút phân công: xem canAssign/điều kiện hiển thị, phase PROPOSAL_REVIEW, phiên bản đã gửi, routing và grant.

## 5. Giảng viên nhóm duyệt — bước 5: nhận xét và kết luận

1. Mở **Đề cương cần xét duyệt** (`/topic/reviews`), chọn đợt và mở vòng được phân cho nhóm mình.
2. Xem nội dung, số phiên bản và thông tin nhóm. Khi vòng đang được phân công và backend cho phép, chọn **Bắt đầu** để chuyển sang đang duyệt.
3. Đọc đề cương, ghi nhận xét bằng form nhận xét của vòng nếu có quyền. Nhận xét riêng và kết luận chung là hai dữ liệu khác nhau.
4. Người được phép kết luận chọn kết quả trên form: **Đạt** hoặc **Cần sửa** theo lựa chọn thực tế đang hiển thị, nhập nhận xét cần thiết và xác nhận.
5. Tải lại vòng; kiểm tra trạng thái/kết luận và đúng số phiên bản. SV đăng nhập tài khoản của mình để xem kết quả.

Kết quả mong đợi: người ngoài nhóm/GVHD không có quyền duyệt chỉ nhờ đang hướng dẫn SV. Nếu SV đã gửi phiên bản mới, không kết luận trên một bản cũ như thể đó là bản hiện hành; tải lại để lấy trạng thái mới.

## 6. Sinh viên — bước 6: sửa, lưu và gửi duyệt lại

1. Mở **Đề cương của tôi** (`/topic/proposal`), chọn đúng hồ sơ rồi **Mở đề cương & lịch sử**.
2. Xem nhận xét/kết luận và số phiên bản đang gửi. Khi hồ sơ ở trạng thái được sửa, cập nhật các trường nội dung bắt buộc theo mẫu, thêm tóm tắt thay đổi và phản hồi nhận xét nếu form yêu cầu.
3. Bấm **Lưu nháp mới**. Mỗi lần lưu tạo phiên bản; chờ thông báo thành công và kiểm tra số phiên bản tăng.
4. Sau khi đã lưu hết thay đổi, chọn **Gửi duyệt** hoặc **Gửi duyệt lại**. Nút có thể bị vô hiệu hóa nếu còn nội dung chưa lưu hoặc chưa có bản hợp lệ.
5. Mở lại lịch sử và kết quả xét duyệt; kiểm tra phiên bản vừa gửi. Phiên bản đã gửi được niêm phong, không sửa trực tiếp nội dung của bản đó.

Kết quả mong đợi: giữ nguyên lịch sử cũ, GV nhìn thấy đúng phiên bản mới. GVHD/giáo vụ có quyền xem không đồng nghĩa mọi tài khoản đều có nút sửa. Nếu nội dung legacy không đúng mẫu, giao diện chỉ đọc và yêu cầu đối soát; không tự điền nội dung giả để vượt kiểm tra.

## 7. Giáo vụ và sinh viên — bước 7: chốt, in và nhận giấy

Giáo vụ:

1. Mở **Chốt hồ sơ & nhận bản giấy** (`/topic/dossier`), lọc hồ sơ đã duyệt, mở chi tiết đúng SV.
2. Kiểm tra thông tin cá nhân, phiên bản đã duyệt, GVHD, routing và các cảnh báo thiếu đầu vào.
3. Khi nút xuất hiện, chọn **Chốt đề cương chính thức**. Kiểm tra bản chốt mới trong lịch sử. Chốt lưu nội dung in bất biến; không phải ký điện tử.
4. Chỉ sau khi thực tế nhận đủ giấy đã ký, nhập ghi chú và xác nhận tiếp nhận trên form. Không bấm nhận giấy chỉ để làm đẹp trạng thái demo.

Sinh viên:

1. Mở **Hồ sơ & bản in** (`/topic/dossier`), chọn hồ sơ của mình.
2. Có thể tải **PDF xem trước (chưa chốt)** khi được phép; đó chưa phải bản chính thức.
3. Khi giáo vụ đã chốt, chọn **Tải PDF để in và ký**; kiểm tra họ tên, đề tài và số phiên bản, in/ký/nộp theo quy trình của Khoa.
4. Sau khi nộp giấy, kiểm tra trạng thái tiếp nhận; liên hệ giáo vụ nếu chưa cập nhật. SV không tự xác nhận nhận giấy.

Phân biệt bốn mốc: được duyệt → được chốt → đã tải/in PDF → đã nhận giấy. Tải PDF không tự chuyển sang đã nhận giấy. Nếu PDF báo lỗi, kiểm tra API tải có trả 403 (quyền), 409 (điều kiện) hay 500 (render/storage).

## 8. GVHD — bước 8A: lập kế hoạch và giao việc

1. Mở **Kế hoạch hướng dẫn** (`/guidance/plan`), chọn SV được phân công chính thức và mở chi tiết.
2. Nếu chưa có kế hoạch và đầu vào hợp lệ, điền mô tả rồi tạo kế hoạch theo form. Hồ sơ phải có bản chốt và phase GUIDANCE phù hợp.
3. Nếu kế hoạch tạm dừng do đổi GVHD/bản chốt, đọc cảnh báo, kiểm tra đầu vào mới rồi xác nhận tiếp tục/rebase bằng form nếu có quyền. Không tạo bản khác để bỏ qua lịch sử cũ.
4. Chọn **Giao nhiệm vụ**, nhập tiêu đề, mô tả, sản phẩm dự kiến, lịch bắt đầu/hạn và kỳ hướng dẫn theo form; lưu rồi mở nhiệm vụ vừa tạo.
5. Chỉnh sửa hoặc hủy bằng chức năng cho phép; nếu đã có bài nộp, đọc xác nhận giữ lịch sử và nhập lý do khi được yêu cầu.

Kết quả mong đợi: SV thấy nhiệm vụ trong **Nhiệm vụ & nộp báo cáo**; giảng viên khác không được chỉnh sửa. Quá hạn là trạng thái suy từ thời gian, không đồng nghĩa nhiệm vụ tự bị hủy.

## 9. Sinh viên — bước 8A/8B: tiến độ và nộp báo cáo

1. Mở **Nhiệm vụ & nộp báo cáo** (`/guidance/tasks`), chọn đợt, mở đúng nhiệm vụ.
2. Đọc yêu cầu và hạn. Dùng form bắt đầu/cập nhật tiến độ/ghi chú nếu xuất hiện. SV không tự chuyển nhiệm vụ sang hoàn thành bằng cách đánh dấu Đạt.
3. Nếu có nghĩa vụ tuần chưa có nhiệm vụ và nút tạo nhiệm vụ tuần được cấp, dùng nút đó; không tạo trùng nhiệm vụ thủ công.
4. Trong chi tiết nhiệm vụ, chọn **Báo cáo tuần và source** (`/guidance/tasks/:id/submissions`). Chọn đúng một PDF báo cáo và một ZIP source; minh chứng là tùy chọn.
5. Bấm **Tải file lên** và chờ tải xong. Đây mới là staging, chưa phải đã nộp bài.
6. Điền nội dung theo yêu cầu, bấm **Xác nhận nộp**. Kiểm tra thông báo thành công và bản nộp xuất hiện trong lịch sử.
7. Khi có nhận xét **Không đạt/Cần sửa**, đọc góp ý, sửa file và nộp bản mới trên cùng nhiệm vụ; không xóa bản cũ. Dùng **Xem nhận xét và đánh giá** để đọc kết quả.

Policy mặc định: tối đa 20 MiB/file, 50 MiB/bài, tối đa 3 minh chứng PDF/PNG/JPEG. ZIP tối đa 1.000 entries/200 MiB sau giải nén và phải qua kiểm tra an toàn. Giao diện hiển thị policy có hiệu lực; nếu server cấu hình khác thì dùng policy server. File staging hết hạn sau 24 giờ cần tải lại. Nộp muộn vẫn có thể được nhận khi phase còn mở và sẽ ghi nhận trễ.

## 10. GVHD — bước 8C: đánh giá và nhật ký

1. Mở **Nhận xét báo cáo** (`/guidance/review`), lọc đợt/SV/trạng thái, chọn bài chờ đánh giá.
2. Kiểm tra đúng bản nộp; tải và đọc PDF/ZIP bằng link riêng trong giao diện.
3. Chọn **Đạt (PASS)**, **Không đạt (FAIL)** hoặc **Cần sửa (REVISION_REQUIRED)**. Với hai mức sau, nhập nhận xét bắt buộc; xác nhận đánh giá và kiểm tra kết quả.
4. PASS hoàn thành nhiệm vụ; FAIL và REVISION_REQUIRED là hai kết quả khác nhau, đều dẫn đến sửa/nộp lại. Đây không phải điểm bảo vệ hoặc quyết định đủ điều kiện tốt nghiệp.
5. Nếu cần sửa đánh giá, dùng chức năng sửa có lý do để lưu lịch sử. Khi đã có bản nộp mới, không sửa đánh giá bản cũ như thể đó là đánh giá hiện hành.
6. Để ghi buổi hướng dẫn: mở kế hoạch SV → **Nhật ký hướng dẫn**. Điền ngày/nội dung theo form và lưu; khi sửa nhật ký, nhập lý do theo yêu cầu. SV chỉ xem nhật ký thuộc kế hoạch của mình.

## 11. Giáo vụ — bước 8C: giám sát

1. Mở **Theo dõi tiến độ** (`/guidance/progress`), chọn đợt, lọc GVHD/SV theo nhu cầu.
2. Xem số nhiệm vụ và các trạng thái; mở bản ghi liên quan để kiểm tra chi tiết khi có link.
3. Đọc riêng phần **Nghĩa vụ báo cáo tuần**: chưa có task không có nghĩa là không có nghĩa vụ báo cáo. Bài Không đạt/Cần sửa vẫn được tính là đã nộp, nhưng chưa hoàn thành.
4. Nếu thấy “Chưa cấu hình” hoặc “Dữ liệu cũ chưa đối soát”, báo người phụ trách cấu hình lịch/đối tượng; không diễn giải số 0 thành tất cả SV đều hoàn thành.

## 12. Kịch bản local có sẵn để thử nhanh

Các tình huống này phản ánh fixture ban đầu; thao tác trước đó có thể đã đổi trạng thái. Không reset database chỉ để khớp tài liệu.

| Tài khoản local | Tình huống ban đầu | Kiểm tra chính |
| --- | --- | --- |
| giaovu | Nhóm và 4 hồ sơ trong đợt demo 4–8 | Bước 4, phân công, giám sát |
| gv003 / gv004 | sv002 được phân nhóm, chưa bắt đầu duyệt | Bắt đầu → nhận xét → kết luận |
| sv001 | Đề cương cần sửa | Lưu bản mới → gửi lại |
| sv002 | Bản đã gửi, đang chờ duyệt | Chỉ đọc bản niêm phong |
| giaovu + sv003 | Đã duyệt, chưa chốt | Chốt → tải PDF |
| giaovu + sv004 | Đã chốt, có PDF, chưa nhận giấy ban đầu | Kiểm tra/in; chỉ nhận giấy khi thực tế đã nhận |
| gv001 + sv004 | Có kế hoạch và các nhiệm vụ nhiều trạng thái | Giao việc → nộp/nộp lại → đánh giá → nhật ký |

File mẫu local: `.cache/integration-ui/sample-files/bao-cao-demo.pdf` và `source-demo.zip`. Link ID cụ thể xem [demo local](integration-ui-workflow-demo.md); chỉ có ý nghĩa với database tương ứng.

## 13. Tìm lỗi và ghi bằng chứng

| Hiện tượng | Kiểm tra trước | Hướng xử lý |
| --- | --- | --- |
| Hai người thấy dữ liệu khác nhau | URL hệ thống, đợt, mã hồ sơ, commit server | Dùng cùng server; không để một máy mở UI local |
| Không kết nối máy chủ | DevTools → Network: request URL; `/api/health`; log backend | Kiểm tra server/port/proxy; trên máy thành viên không dùng localhost của server |
| Health OK nhưng nghiệp vụ lỗi | Request nghiệp vụ và log backend/database | Health chỉ chứng minh API phản hồi, không chứng minh DB/file/quyền đầy đủ |
| 401 | Phiên/token hết hạn, tài khoản bị khóa | Đăng nhập lại; kiểm tra server cấp token, không chép token giữa môi trường |
| 403 hoặc không thấy menu | Role, permissions trong phiên đăng nhập, grant/roster/owner | Đăng nhập lại sau đổi quyền; quản trị kiểm quyền, giáo vụ kiểm scope |
| Danh sách trống | Đợt, bộ lọc, SV/nhóm/GVHD được phân công | So sánh bằng người có scope; không cấp quyền rộng chỉ để hết trống |
| Không có nút ghi hoặc lỗi 409 | Phase, lịch, khóa, bản hiện hành, revision | Tải lại, đọc cảnh báo, hoàn tất bước trước; không bấm lặp trên trang cũ |
| Upload xong chưa thấy bài nộp | Đã bấm Xác nhận nộp chưa | Hoàn tất nộp; staging riêng không phải bài chính thức |
| File không tải được từ máy khác | Tất cả có cùng backend/kho file không | Kiểm tra volume upload và bản ghi FileAsset; không đổi sang link public để bỏ quyền |
| 413/file bị từ chối | Kích thước từng file, tổng bài, loại file và ZIP | Đúng policy; nếu qua proxy, kiểm cả giới hạn body của proxy |
| PDF 500 | Log render PDF, Chrome trong container, volume/quyền ghi | Người vận hành kiểm server; giữ mã lỗi/thời điểm để tra log |

Mỗi lỗi ghi một bản theo mẫu:

```text
Thời điểm (UTC+7):
Môi trường/URL và commit server:
Tài khoản, vai trò (không ghi mật khẩu/token):
Đợt + mã SV + ID hồ sơ/nhiệm vụ + số phiên bản:
Các bước tái hiện (1, 2, 3):
Kết quả mong đợi:
Kết quả thực tế + thông báo nguyên văn:
Request: method + path + HTTP status + mã lỗi trong response:
Ảnh màn hình/log đã loại token, cookie, thông tin bí mật:
Lặp lại sau tải trang? Người khác cùng scope có gặp không?:
```

Kiểm tra âm tính tối thiểu: SV không thấy nhóm duyệt/phân công/đánh giá; SV A không đọc hồ sơ hoặc file SV B; giảng viên ngoài nhóm không kết luận; giảng viên ngoài phân công không chấm; giáo vụ ngoài grant không chốt; admin chỉ có vai trò quản trị không có quyền nghiệp vụ 4–8. Thử cả menu lẫn dán URL trực tiếp; API phải tiếp tục từ chối bản ghi ngoài scope.

Các kịch bản có ghi dữ liệu nên chạy trên đợt thử riêng, phối hợp để không hai người cùng sửa một hồ sơ. Không dùng bộ kiểm thử fixture để reset dữ liệu chung.
