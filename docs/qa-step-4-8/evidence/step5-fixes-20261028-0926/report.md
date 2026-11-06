# STEP5 — Báo cáo sửa lỗi và regression ngày 28/10/2026

**Đã sửa và kiểm chứng lại S5-01, S5-02.** Luồng nghiệp vụ chính và các ca regression thực thi trong lượt này đều PASS. Dữ liệu UI hiện tại không thay đổi. Báo cáo trước sửa được giữ tại [QA STEP5](../step5-local-20261028-0906/report.md).

## Thay đổi

| Vấn đề | Bản sửa | Kết quả thực tế |
|---|---|---|
| S5-01: tên tiếng Việt viết HOA không tìm thấy khi DB locale `C` | Chuẩn hóa NFC trên query và các cột tìm kiếm; dùng Unicode lowercase với collation tường minh. Tìm substring dạng literal, giữ dấu. Kết quả ID tiếp tục giao với scope, status, department, group trước count/pagination. | Tên gốc, HOA, trộn hoa/thường, trim và NFD đều tìm đúng `p-student`; ký tự `%`, `_`, backslash và chuỗi SQL không trở thành wildcard/lệnh SQL; không lộ hồ sơ ngoài quyền. |
| S5-02: nhận xét toàn khoảng trắng bị bỏ qua, giữ banner thành công cũ | Báo lỗi tiếng Việt khi validation thất bại; gắn `aria-invalid`/`aria-describedby`; xóa feedback cũ khi nhập/gửi thao tác mới; xóa marker `saved` cũ khi cần. Khi sửa nội dung, lỗi cũ được xóa và người dùng gửi lại bình thường. | Spaces/tab/newline không gửi POST, không tăng revision/comment; UI báo lỗi. Sau khi sửa, lưu đúng một comment đã trim, đúng actor/version. |

Code liên quan:

- [Repository tìm kiếm](../../../../backend/src/topic/proposal-reviews/proposal-review.repository.ts:174).
- [Service giữ scope và pagination](../../../../backend/src/topic/proposal-reviews/proposal-review.service.ts:376).
- [Form nhận xét và feedback](../../../../frontend/src/features/proposal-reviews/pages.tsx:569).
- [Regression API Unicode và scope](../../../../backend/scripts/test-proposal-reviews.cjs).
- [Unit test boundary phase](../../../../backend/src/topic/proposal-reviews/proposal-review.spec.ts:279).

Truy vấn dùng `pg_catalog.pg_c_utf8`, phù hợp đích PostgreSQL **17 / UTF8** của workflow bước 4–8 và CI PR2B. Collation này cung cấp Unicode simple case mapping cho `lower`; NFC làm đồng nhất dạng ký tự tổ hợp. Không đổi locale, schema, dữ liệu hoặc thêm extension/migration. Xem [tài liệu PostgreSQL 17](https://www.postgresql.org/docs/17/collation.html#COLLATION-MANAGING-STANDARD). Không tuyên bố hỗ trợ truy vấn mới trên PostgreSQL 16 hoặc encoding khác UTF8.

## Kiểm chứng bản sửa

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| Backend build | PASS | `pnpm --filter @doan/backend build`, exit 0 |
| Backend unit | **191/191 PASS** | [log](backend-unit.log) |
| Frontend unit | **115/115 PASS** | [log](frontend-unit.log) |
| Frontend build và TypeScript | PASS | [log](frontend-build.log) |
| Backend / frontend lint | PASS cả hai | [backend log](backend-lint.log); frontend command exit 0 trong lượt thực thi |
| API integration STEP5 trên DB mới | **28/28 nhóm PASS** | [summary](api-suite-summary.json), [28 nhóm có assertions](api/generated/step5-results.json), [log](api/console.log) |
| Luồng browser nghiệp vụ thật | **18/18 checkpoint PASS** | [workflow](workflow-checkpoints.json) |
| Browser regression hai lỗi, pagination, loading, scope | **10/10 checkpoint PASS** | [fixes](fixes-checkpoints.json) |
| Đối chiếu DB và kết quả chạy | **9/9 PASS** | [verification.json](verification.json) |

Không cộng các lớp kiểm tra thành số test case độc lập: browser có checkpoint điều khiển lặp lại và nghiệp vụ chồng lấn API. Đã chạy backend/frontend unit toàn bộ; không dùng browser mock làm bằng chứng nghiệm thu. Các lần chạy ban đầu bị sandbox chặn `spawn EPERM` đã được chạy lại với quyền tạo worker/esbuild và PASS; đây là giới hạn môi trường, không phải lỗi ứng dụng.

Phần browser dùng **Playwright local + Microsoft Edge thật**, API/Nest/PostgreSQL thật, không intercept hoặc sửa response, không chỉnh token để vượt quyền. Playwright MCP không được cung cấp trong phiên này; không gọi kết quả này là MCP.

## Các phần kiểm chứng thiếu trước đây

- **F08 UI pagination: đã bổ sung bằng chứng thật.** Fixture có 23 hồ sơ cùng đợt: trang 1 có 20, trang 2 có 3; click Sau/Trước đúng ID và tổng số, không trùng/thiếu; nút ở biên disabled đúng. Tìm kiếm từ trang 2 reset về trang 1. [Checkpoint](fixes-checkpoints.json), [ảnh trang 2](F08-page2.png).
- **W09 exact boundary: đã bổ sung 5 unit case với clock cố định**, tại start−1ms, start, end−1ms, end, end+1ms. Chứng minh khoảng hợp lệ `[start, end)`; test khôi phục clock sau mỗi case. Đây là test validator với fixture và clock kiểm soát, **không phải E2E đồng hồ thật đúng mili-giây**. Các guard/race phase qua API vẫn PASS trong suite 28 nhóm; không sửa logic phase chỉ để test PASS.
- **U04 loading: đã kiểm tra qua mạng thật.** CDP thêm latency 800ms cho request thật; UI hiện `Đang tải đề cương…`, sau đó trả hàng đúng. Không mock response. Empty/error/recovery và stale form 409 được kiểm tra trong regression nghiệp vụ.

## Bằng chứng browser

- [Tên viết HOA tìm đúng hồ sơ](S5-01-uppercase-found.png).
- [Form mobile hiển thị lỗi khoảng trắng](S5-02-whitespace-validation-mobile.png).
- [Luồng APPROVED](W05-approved.png), [REVISION_REQUIRED](W06-revision-required.png), [vòng SUPERSEDED chỉ đọc](W16-superseded-readonly.png).
- [Axe trên trạng thái có lỗi nhập liệu](S5-02-error-state-axe.json): 0 violation, 0 incomplete trong lần quét này; không suy thành chứng nhận WCAG toàn ứng dụng.
- [Log workflow](workflow-browser-log.json), [log regression](fixes-browser-log.json), [server traffic](live-server-traffic.json).

Tổng lượt browser: **0 pageerror**, **0 requestfailed transport**, **27 console error**, **20 warning**. Các HTTP lỗi gồm một POST stale comment 409 được cố ý thử, còn lại 26 response từ endpoint legacy/shell ngoài STEP5 (`assignment plan/results`, `registration/me`) khi fixture tối giản đi qua đăng nhập. Các request STEP5 hợp lệ của bản sửa không phát sinh 5xx. Không tuyên bố toàn bộ console sạch; lỗi response của probe API qua `context.request` được ghi ở checkpoint/server traffic, không xuất hiện trong page console.

## Dữ liệu và trạng thái bàn giao

User đã cho phép ghi trên DB test local mới. Lượt này tạo riêng:

- Browser: `btl_pr2b_step5_1793154429481_788d51_live`.
- API regression: `btl_pr2b_step5_1793154427767_ef45c5_api`.

Vite báo frontend thực tế `http://127.0.0.1:50185/`, API `http://127.0.0.1:60959/api`: [metadata](live-ready.json), [Vite log](live-vite.log). 21 hồ sơ pagination được tạo trước baseline, cùng hai hồ sơ gốc thành 23 trong `qa-t1`; fixture được giữ nguyên sau test. Không seed/reset DB hiện có.

Đối chứng cuối: 4 vòng (1 SUPERSEDED, 2 DECIDED, 1 IN_REVIEW), 5 comment hợp lệ, 2 canonical decision, 15 audit nghiệp vụ khớp đúng các lệnh thành công. Notification đúng owner/GVHD, 2 outbox event khớp decision, không tạo dữ liệu bước 6–8; hash producer core không đổi. Email worker tắt và outbox còn PENDING; không kiểm chứng SMTP delivery. [Snapshot](live-database-snapshot.json), [assertions đối chứng](verification.json).

**100 bảng DB UI hiện có trùng số dòng và SHA-256 trước/sau**, đo bằng giao dịch READ ONLY: [trước](main-before.json), [sau: unchanged=true](main-after.json). Không ghi nghiệp vụ lên DB đó.

API/Vite test đã được tắt và xác nhận hết lắng nghe; các DB test được giữ lại, không drop/reset. [Cleanup](cleanup.json). Các thay đổi có trước trong working tree được giữ nguyên; chưa commit/push. Bằng chứng QA lịch sử không được ghi đè.

Các lỗi đã xác nhận trong báo cáo trước đã đóng theo regression trên. Phần E2E chính xác mili-giây của deadline, SMTP, tải dài hạn và trình duyệt khác không được suy thành PASS từ các kết quả này.
