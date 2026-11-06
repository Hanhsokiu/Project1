# Sửa lỗi STEP_4 và kiểm tra lại bằng Playwright MCP

Ngày 27/10/2026, Asia/Ho_Chi_Minh. Đối chiếu [báo cáo QA gốc](../step4-mcp-20261027-2047/report.md). Báo cáo gốc và evidence cũ được giữ nguyên; bản này ghi trạng thái sau sửa.

**Hai lỗi đã xác nhận đều FIXED.** Kiểm tra thực tế trên http://127.0.0.1:5173 với backend http://127.0.0.1:3000/api: **25/25 checkpoint PASS**, 0 page error, 0 failed request và 0 HTTP 4xx/5xx trong các đoạn retest đã thu. Không mock API hoặc thay response.

## Thay đổi

| Bug | Sửa | Trạng thái retest |
|---|---|---|
| STEP4-MCP-001 / U01 | State lưu lecturerId và fullName của từng người được chọn, độc lập kết quả tìm kiếm/phân trang. Payload tiếp tục lấy mảng lecturerId; nút bỏ chọn có accessible name theo tên người. | FIXED: tìm Z hoặc search không khớp vẫn giữ tên T; chọn thêm/bỏ Z, bỏ T bằng Enter khi T ngoài kết quả, clear search và reset theo đợt đều đúng. |
| STEP4-MCP-002 / G09 / U02 | Sidebar đóng ở breakpoint mobile dùng visibility:hidden để loại khỏi focus/accessibility tree. Khi mở dùng visibility:visible. Escape/backdrop trả focus về menu; bấm link cùng trang cũng đóng; xử lý trả focus khi đổi route từ sidebar. | FIXED: Shift+Tab sau Escape không vào Đăng xuất ẩn; 20 lần Tab không vào sidebar đóng; mở menu vẫn focus link được; desktop hiện sidebar bình thường. |

Source thay đổi trong lượt này:
- [components.tsx](../../../../frontend/src/features/review-groups/components.tsx), state từ dòng 108, chuyển sang ID payload ở dòng 130 và accessible name ở dòng 303.
- [WorkspaceLayout.tsx](../../../../frontend/src/app/layouts/WorkspaceLayout.tsx), refs/close/focus từ dòng 106, đóng menu khi bấm navigation và ref của nút menu.
- [index.css](../../../../frontend/src/index.css), visibility tại breakpoint mobile, dòng 1290/1296.

Các file trên đã có thay đổi từ trước lượt sửa. Chỉ bổ sung bản sửa liên quan hai bug, giữ lại phần công việc hiện có. Không sửa backend, DTO, RBAC, schema, migration, dependency hoặc dữ liệu nghiệp vụ.

## Kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| TypeScript frontend | PASS: pnpm --filter @doan/frontend type-check |
| ESLint hai file TSX đã sửa | PASS |
| Prettier ba file đã sửa | PASS |
| Unit frontend | 19 file, 115/115 test PASS |
| Build frontend | PASS: TypeScript + Vite production build |
| Playwright MCP — selection | 10/10 checkpoint PASS; [selection-live.json](selection-live.json) |
| Playwright MCP — focus/mobile/desktop | 11/11 checkpoint PASS; [focus-live.json](focus-live.json) |
| Axe và không phát sinh mutation | 4/4 checkpoint PASS; [axe-live.json](axe-live.json) |

Axe 4.14.0 với wcag2a/wcag2aa/wcag21aa có 0 violation trên list desktop, form desktop sau search và form mobile. Hai scan desktop có mục color-contrast ở trạng thái incomplete; không coi đó là xác nhận WCAG đầy đủ. Kiểm tay bàn phím xác nhận lỗi focus đã hết.

Build vẫn có warning Vite CJS API và chunk >500 kB; unit SSR có warning useLayoutEffect của MemoryRouter. Không có test/build failure cuối cùng. Lượt unit đầu bị sandbox chặn esbuild spawn EPERM; chạy lại cùng lệnh với quyền thực thi công cụ local đã PASS, không sửa dependency hoặc assertion để né lỗi.

## Bằng chứng trực quan

- [Tên thành viên giữ nguyên sau tìm kiếm](U01-fixed-search.png).
- [Menu mobile đóng sau sửa](U02-fixed-mobile.png).
- [Form mobile sau sửa](form-mobile-fixed.png).
- [Tổng kết máy đọc](summary.json), [console errors](console-errors.log), [console warnings](console-warnings.log).
- [Network buffer MCP](network-session.log): buffer của cả session, có request từ các lượt cũ. Dùng timestamp/request/response trong ba JSON retest để xác định phạm vi mới; không quy lỗi 400/404 của QA cũ thành lỗi lần sửa này.

## Bảo toàn dữ liệu

Không bấm Tạo/Lưu/Xác nhận xóa, không gửi mutation nghiệp vụ, không seed/reset. Chỉ có đăng nhập/đăng xuất local theo quyền đã được cấp. [Preservation](preservation.json) xác nhận các group views cuối retest giống mốc cuối báo cáo QA trước; không phải hash toàn DB.

[Cleanup](auth-cleanup.json): đã đăng xuất phiên QA, browser trở lại /login và không còn access token trong sessionStorage. Token/credentials không được ghi vào evidence mới.

## Giới hạn nghiệm thu

G09, U01 và U02 đã PASS trong retest tương ứng; không viết lại các dòng FAIL lịch sử của báo cáo gốc.

**5 nhóm BLOCKED và 9 nhóm mutation NOT RUN của báo cáo gốc vẫn chưa được xác minh đầy đủ.** Chúng không phải bug đã được chứng minh và không tự chuyển PASS sau khi sửa hai lỗi UI. Chưa kiểm luồng ghi tạo/sửa/lưu trữ thật, CAS/idempotency, rollback/audit, đầy đủ fixture role/grant/roster hoặc UI nhiều trang.

Phạm vi đã hoàn tất: sửa hai lỗi xác nhận trong báo cáo và kiểm tra lại cùng các hành vi liên quan. Chưa có căn cứ tuyên bố toàn bộ nghiệp vụ bước 4 đã nghiệm thu. Không commit/push.

