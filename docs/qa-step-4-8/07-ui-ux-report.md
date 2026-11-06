# UI/UX, accessibility và hiệu năng smoke

## Cách kiểm

Microsoft Edge headless qua Playwright đã có trong repo, mở UI thật `127.0.0.1:5173`; full workflow riêng dùng Vite50180→Nest→PG17. Không mock payload học thuật. Có một ca **trì hoãn response thật ** để chụp loading; có ca cố ý làm token/refresh token không hợp lệ để kiểm phản ứng401, không dùng đó làm chứng cứ giả về thời gian hết hạn token.

29 lượt mở route desktop1440×1000 thuộc Khoa/GV/SV/admin; 3 lượt tasks mobile390×844. [Kết quả gốc ](evidence/20261026144939_2663ec/ui-local/ui-results.json). Các kiểm sau lỗi capture/locator ban đầu được lưu riêng, không ghi đè bằng chứng cũ.

## Các màn đã mở

| Vai trò | Route thực tế |
| --- | --- |
| Khoa | review-groups/list/new; reviews; proposal; dossier; guidance/plan/tasks/progress/meetings/notifications |
| GVHD | review-groups; reviews; proposal; dossier; guidance/plan/tasks/review/meetings/notifications |
| SV | reviews; proposal; dossier; guidance/plan/tasks/meetings/notifications |
| Admin | review-groups/proposal/tasks bị route guard chuyển403, không coi là màn học thuật được phép |

Chi tiết parameterized route thuộc review round/version/finalization/task/submission được thực hiện trong [live workflow15checkpoints](evidence/20261026144939_2663ec/live-e2e/live-browser.json).

## Kết quả theo tiêu chí

| Hạng mục | Kết quả có chứng cứ |
| --- | --- |
| Bố cục desktop/mobile | Không overflow ngang ở39record đã thu; metrics width/documentWidth trong JSON. Chỉ có 3recordmobile, không suy toàn bộ màn responsive |
| Sidebar/navigation | QA-002: SV thấy link nhóm duyệt rồi403; QA-003: link hội đồng 404. Guard vẫn chặn đúng, không chứng minh RBAC bị bypass |
| Header/breadcrumb | Có search/context; text breadcrumb/footer nhỏ và contrast thấp QA-004. Một số màn guidance dùng breadcrumb chung, chưa đánh giá usability bằng user study |
| Table/filter | Live dashboard có row/thống kê thật và lọc advisor; API test có paging/search/scope. Chưa click đủ sort/page mọi bảng với nhiều trang dữ liệu |
| Form | Live tạo nhóm, phân công, sửa / nộp đề cương, finalize, task, upload/review thành công. Local sample OPEN_REGISTRATION làm form nhóm read-only đúng guard; ** không phải ca form validation đầy đủ ** |
| Modal/Cancel/Delete | Một số confirm theo flow live có assertion; chưa có inventory đủ mọi modal/Cancel/Delete UI. Archive/rollback đã kiểm API, không tự quy toàn UI PASS |
| Loading | [Ảnh trì hoãn response thật ](evidence/20261026144939_2663ec/ui-boundaries-final/loading-real-response.png) có loading rõ; đang tải có thể cùng hiển thị empty/warning, cần review UX thêm |
| Empty/config-not-ready | Tasks/weekly thiếu cấu hình có cảnh báo, không khẳng định 0missing. Đợt local chưa có plan/submission nên empty là dữ liệu thực |
| Error | Missing proposal có alert đúng sau retry; [ảnh](evidence/20261026144939_2663ec/ui-boundaries-final/missing-proposal-error.png). Ảnh capture sớm chỉ có loading không dùng làm proof error handling |
| Success/toast | Các bước live đợi response thành công và assert UI update; không dựa chỉ vào toast. Trường hợp API500 sau khi nhập nội dung dài qua UI trực tiếp còn NOT VERIFIED |
| Back/Refresh | [Follow-up](evidence/20261026144939_2663ec/ui-followup/results.json) về tasks sau403/404 và reload giữ route hợp lệ |
| Mobile menu | Mở được, aria-expanded=true; Escape đóng và expanded=false trong browserrecord |
| Session recovery | QA-006:401 làm sessionStorage sạch nhưng sau10giây còn màn workflow báo token lỗi, không có login link |
| Console/network | Lượt mở 29 route không có pageerror/5xx.401/403/404 chủ động trong negative probes là kết quả mong đợi, không cộng là lỗi hệ thống |
| Accessibility | Axe WCAG2A/2AA/2.1AA: login0violations; group form có 1ARIA+5contrastnodes; guidance empty có 5contrastnodes. Screen reader/focus trap mọi modal chưa kiểm |

## Bằng chứng trực quan tiêu biểu

- [Dashboard có task hoàn thành và tuần còn thiếu task](evidence/20261026144939_2663ec/live-e2e/live-faculty-dashboard.png): đã xem ảnh;1completed không xóa nghĩa vụ tuần còn thiếu.
- [Tasks mobile](evidence/20261026144939_2663ec/ui-local/sv001-mobile-tasks.png): đã xem ảnh; layout xếp dọc, warning thiếu cấu hình rõ, chữ phụ nhỏ.
- [Form nhóm khi đợt chưa cho quản lý ](evidence/20261026144939_2663ec/ui-boundaries-final/group-validation.png): đã xem ảnh; trường và nút bị vô hiệu kèm warning. Đây là readiness/permission state, không được ghi nhầm validation PASS.
- [403 ổn định ](evidence/20261026144939_2663ec/ui-followup/student-forbidden-stable.png), [404 ổn định ](evidence/20261026144939_2663ec/ui-followup/downstream-404-stable.png), [session sau10s](evidence/20261026144939_2663ec/ui-followup/expired-session-after-10s.png).

## Số đo smoke

29desktop navigation: min919ms, median1135ms, max1507ms. Bao gồm `goto` và chờ networkidle500ms; ** không phải LCP/TTI**, không so với SLA chưa có.

| API đọc loopback | 5 mẫu thực tế (ms) | HTTP |
| --- | --- | --- |
| proposal-review-options/terms | 44,48;20,51;21,26;20,21;18,89 | 200 cả 5 |
| me/notifications | 13,18;14,87;12,44;18,12;13,65 | 200 cả 5 |

[Raw metrics](evidence/20261026144939_2663ec/ui-boundaries-final/results.json). Chỉ request tuần tự với DB nhỏ trên máy Windows, không phải benchmark Supabase hoặc nhiều người đồng thời. Submit-form latency, memory leak dài hạn, event-loop lag ZIP và load đại diện **NOT VERIFIED**. Không stress hệ thống dùng chung.

## Kết luận

Core flow có UI thật và bằng chứng; các màn không phải chỉ JSX. Chưa nghiệm thu UX toàn bộ vì lỗi menu/session/a11y và coverage tương tác còn thiếu. Ưu tiên QA-001 về nội dung dài, rồi notice/khôi phục session/navigation; tránh thay state machine để làm giao diện bớt báo readiness.
