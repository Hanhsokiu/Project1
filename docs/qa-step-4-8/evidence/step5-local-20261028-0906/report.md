# Báo cáo kiểm thử chuyên sâu STEP_5 — Project1

> Cập nhật sau sửa: S5-01 và S5-02 đã được sửa và regression PASS. Xem [báo cáo bản sửa ngày 28/10](../step5-fixes-20261028-0926/report.md). Nội dung dưới đây giữ kết quả QA trước sửa.

**Kết quả: chưa đạt toàn bộ tiêu chí.** Luồng phân công và xét duyệt chính hoạt động; xác nhận **2 lỗi**, còn **2 nhóm có tiểu ca chưa kiểm chứng**. Chưa sửa code ứng dụng trong lượt QA này.

Thực thi ngày **27–28/10/2026**, múi giờ Asia/Ho_Chi_Minh. Báo cáo này tổng hợp phần MCP ngày 27/10 và phần tiếp tục bằng Playwright local ngày 28/10; không coi kết quả từ báo cáo triển khai cũ là kết quả chạy mới.

## Môi trường, phạm vi và quyền thực thi

- Nguồn nghiệp vụ: [đặc tả use case](../../../spec/dac-ta-use-case.md), [quyết định nghiệp vụ và contract](../../../implementation/01-business-decisions-and-contract.md), [mô tả triển khai bước 5](../../../implementation/05-step5-implementation-report.md). Kế hoạch trước thực thi: [52 nhóm test](../step5-mcp-20261027-2153/plan.md).
- User đã cho phép: **“Cho phép ghi trên database test local mới; giữ nguyên dữ liệu hiện tại”**. Chỉ tạo fixture và thao tác nghiệp vụ trên DB tổng hợp riêng. Không reset/drop DB, không sửa source/config/dependency/migration ứng dụng, không mock API hoặc sửa response/token để vượt quyền.
- Ngày 27/10: Playwright MCP mở và tương tác với UI hiện có tại `http://127.0.0.1:5173`; phần này chỉ đọc nghiệp vụ. Có đăng nhập local theo quyền đã cấp. [Bằng chứng anonymous/login](../step5-mcp-20261027-2153/E01-A04-anonymous.json), [queue/baseline](../step5-mcp-20261027-2153/F01-F13-baseline.json).
- Ngày 28/10: công cụ Playwright MCP **không được cung cấp trong phiên tiếp tục**. Dùng `@playwright/test` đã cài, điều khiển **Microsoft Edge thật, headless**, không giả lập kết quả. Mở login, bật/tắt hiện mật khẩu, đăng nhập và thao tác form thành công. [Screenshot login](workflow-login.png), [checkpoint điều khiển browser](workflow-checkpoints.json). Không kết luận rằng MCP đã được kiểm chứng lại ngày 28/10.
- Vite thực tế thông báo `http://127.0.0.1:50185/`, API thật `http://127.0.0.1:62033/api`: [Vite log](live-vite.log), [metadata](live-ready.json). Loopback, PostgreSQL 17.11, migration thật.
- DB browser mới ngày 28/10: `btl_pr2b_step5_1793153364374_e5b031_live`; DB API suite ngày 27/10: `btl_pr2b_step5_1793113476963_4fb968_api`. DB browser dở dang của ngày 27/10 được giữ nguyên; không dùng lại kết quả ghi đó để thay cho lượt mới.
- Fixture dùng tài khoản FACULTY, reviewer, GVHD chính thức, giảng viên ngoài nhóm/đợt, sinh viên owner/khác, ADMIN, COMMITTEE và tài khoản không quyền. COMMITTEE được cấp permission proposal nhưng không có quan hệ reviewer, để kiểm tra permission không thay thế membership/role nghiệp vụ.
- Seed tích hợp tối giản thiếu một số permission đọc UI thông thường. Chỉ bổ sung binding theo `backend/prisma/seed.cjs:44–70` trên DB riêng: [ghi nhận điều chỉnh fixture](fixture-ui-permissions.json), [launcher QA](harness/launch.cjs). Không mở rộng quyền STEP5 cho ADMIN/COMMITTEE; không sửa RBAC ứng dụng. Giữ lại toàn bộ log 403 ban đầu.
- Git HEAD tham chiếu: `0c361709df34837df65b3ed429691599e6e2d93f`. Working tree đã có thay đổi trước lượt này; fingerprint các file nghiệp vụ và bản build tại [run-summary.json](run-summary.json). Không coi đây là bản checkout sạch.

## Kết quả thực thi

| Lớp kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| Bộ integration API STEP5, chạy thật ngày 27/10 | **27/27 nhóm PASS**, exit 0; không thay assertions | [summary](../step5-mcp-20261027-2153/api-suite-summary.json), [27 checks](../step5-mcp-20261027-2153/api/generated/step5-results.json) |
| Browser workflow ngày 28/10 | 18 checkpoint PASS | [workflow](workflow-checkpoints.json) |
| Vai trò, queue, query, mobile ngày 28/10 | 22 PASS, 1 FAIL | [roles/UI](roles-ui-checkpoints.json) |
| Tái hiện search, phase guards, form mobile | 9 PASS, 1 FAIL | [boundaries](boundaries-checkpoints.json) |
| GVHD trong nhóm, reviewer mobile, validation | 4 PASS, 1 FAIL | [reviewer mobile](reviewer-mobile-checkpoints.json) |
| Idempotency và thu hồi permission/membership | 6 PASS | [replay](replay-checkpoints.json) |
| Đối chiếu DB sau thực thi | **9/9 PASS** | [integrity](integrity-checks.json) |

Browser có **62 checkpoint quan sát: 59 PASS, 3 FAIL**. Hai FAIL thuộc cùng lỗi search, một FAIL thuộc form nhận xét; tổng cộng **2 lỗi riêng biệt**. Các checkpoint có lặp kiểm tra browser-control và chồng lấn nghiệp vụ với API suite, vì vậy không cộng thành số test case độc lập.

Đối chiếu theo **52 nhóm trong kế hoạch**: **48 PASS, 2 FAIL, 2 BLOCKED ở tiểu ca**. Không tuyên bố 100% coverage hay toàn bộ bước 5 đã PASS.

## Lỗi đã xác nhận

### S5-01 — Tìm kiếm tên tiếng Việt viết HOA mất kết quả

**Mức độ: Medium / P2 đề xuất.** Ảnh hưởng tìm hồ sơ khi Khoa nhập tên bằng chữ hoa. Tái hiện trên cả API và UI của DB test riêng.

Điều kiện: đăng nhập `qa-faculty`, đợt `qa-t1`, có hồ sơ sinh viên `Nguyễn Văn Sinh`.

1. Mở hàng đợi xét duyệt, nhập `Nguyễn Văn Sinh`: có 1 hồ sơ `p-student`.
2. Đổi thành `NGUYỄN VĂN SINH`: UI hiển thị **Chưa có đề cương**, API trả total 0.
3. Đổi lại tên ban đầu: hồ sơ xuất hiện. Trim hai đầu và case của mã ASCII vẫn hoạt động.

Expected theo B02: thay đổi chữ hoa/thường của cùng tên không làm mất kết quả.

| Search | Actual total |
|---|---:|
| `Nguyễn Văn Sinh` | 1 |
| `  Nguyễn Văn Sinh  ` | 1 |
| `nguyễn văn sinh` | 1 |
| `NGUYỄN VĂN SINH` | 0 |
| `nGUYỄN vĂN sINH` | 0 |

Bằng chứng: [API và metadata locale](B02-search-reproduction.json), [ảnh tên gốc](B02-vietnamese-original-results.png), [ảnh tên viết HOA](B02-vietnamese-uppercase-no-results.png).

Chẩn đoán: service dùng Prisma `contains` với `mode: "insensitive"` ở `backend/src/topic/proposal-reviews/proposal-review.service.ts:380`. Cả DB test và DB UI hiện có đều có `datcollate=C`, `datctype=C`; truy vấn thực tế `lower('NGUYỄN VĂN SINH')` trả `nguyỄn vĂn sinh`. Bằng chứng xác nhận giới hạn chuyển hoa/thường trong môi trường local này. Chưa tái hiện search qua UI của DB hiện có ngày 28/10; không suy rộng sang mọi PostgreSQL locale.

Hướng xử lý đề xuất: thống nhất cơ chế so khớp Unicode của tìm kiếm với locale được hỗ trợ, bổ sung regression cho ký tự tiếng Việt có dấu; không chỉ thử mã ASCII. Chưa sửa code/locale/migration.

### S5-02 — Nhận xét chỉ gồm khoảng trắng bị bỏ qua mà không có thông báo lỗi

**Mức độ: Low / P3 đề xuất.** Dữ liệu không bị ghi sai; người dùng không biết vì sao thao tác không được xử lý.

Điều kiện: `qa-foreign` là thành viên hợp lệ của nhóm `qa-g3`, vòng đề cương sinh viên thứ ba đang `IN_REVIEW`.

1. Lưu một nhận xét hợp lệ: UI hiển thị **Đã lưu nhận xét.**
2. Nhập ba dấu cách vào **Nội dung nhận xét**, bấm **Lưu nhận xét**.

Actual: HTML validity vẫn hợp lệ, client không gửi POST, không có `role=alert`, không thêm comment; thông báo thành công của lần lưu trước vẫn tồn tại. Expected: báo nội dung nhận xét không hợp lệ/rỗng sau trim, giúp người dùng sửa và tránh hiểu nhầm banner cũ là kết quả lần gửi mới.

Bằng chứng: [quan sát DOM/network/state](U04-whitespace-comment-reproduction.json), [screenshot form](U04-whitespace-comment-no-feedback.png), checkpoint `U04-whitespace-comment-feedback` trong [reviewer-mobile](reviewer-mobile-checkpoints.json).

Nguyên nhân từ code: nhánh submit comment tại `frontend/src/features/proposal-reviews/pages.tsx` chỉ gọi mutation khi `ReviewCommentSchema.safeParse()` thành công; không hiển thị lỗi khi parse thất bại và không xóa feedback cũ. Chưa sửa code.

## Đối chiếu nghiệp vụ và dữ liệu

- Assign tạo `ASSIGNED`, gắn chính xác version `SEALED` đã nộp; proposal vẫn `SUBMITTED`. GET/reload không start hoặc tăng revision.
- Start là thao tác explicit; review thành `IN_REVIEW`, proposal thành `UNDER_REVIEW`. Không có decision trước start.
- Phân lại cần lý do; vòng cũ thành `SUPERSEDED`, vòng mới `ASSIGNED`, tăng round; comment, version và hash vòng cũ được bảo toàn. Submit từ form cũ nhận 409, UI báo lỗi và có nút tải lại. [Ảnh vòng cũ](W16-superseded-readonly.png).
- Hai thành viên lưu comment riêng, đúng actor/version, không overwrite. Draft comment/decision được xóa khi chuyển round qua liên kết SPA.
- `REVISION_REQUIRED` thiếu hoặc chỉ có khoảng trắng trong nhận xét kết luận bị chặn; kết luận hợp lệ tạo proposal `REVISION_REQUESTED`, canonical decision vẫn `REVISION_REQUIRED`. [Ảnh kết quả](W06-revision-required.png).
- `APPROVED` tạo review `DECIDED`, proposal `APPROVED`, không tự chốt hồ sơ. [Ảnh approved](W05-approved.png). Vòng đã quyết định không còn controls ghi.
- Sinh viên/GVHD đọc đúng quan hệ và không có action reviewer. GVHD có membership thật trên vòng `ASSIGNED` vẫn không thể tự duyệt sinh viên của mình. Sai sinh viên/nhóm/đợt/grant bị 403/404, không trả academic data. ADMIN không bypass; COMMITTEE có permission nhưng không membership/role hợp lệ vẫn bị chặn.
- Strict DTO/query chặn 400 đối với page/limit/status/unassigned sai, unknown field, forged actor, `REJECTED`, revision sai kiểu/âm, thiếu idempotency key và kết luận yêu cầu sửa rỗng. Review sau probes không thay đổi.
- API suite kiểm tra race assign/comment/decision bằng giao dịch thật, stale revision/version/agreement/routing, PUBLISHED thay FINALIZED, legacy version chưa SEALED, audit rollback, account bị khóa trước replay. Lượt tiếp tục kiểm tra thêm cùng key/cùng payload, khác payload, thu hồi permission và membership trước replay rồi khôi phục: không leak cached result hoặc duplicate comment/audit.
- Phase chưa mở/hết hạn/khóa và term `CANCELLED` đều 409 `TERM_003`; không tự approve/reject, không sinh review/outbox. Fixture phase/term được khôi phục chính xác. Đối chiếu audit cuối cùng xác nhận chỉ có audit của lệnh thành công; bộ đếm `commands` trong harness boundary ban đầu dùng prefix action không đúng nên không dùng riêng trường đó làm bằng chứng audit.
- Snapshot cuối: **4 vòng**, trong đó 1 `SUPERSEDED`, 2 `DECIDED`, 1 `IN_REVIEW`; **5 comment**, **2 decision**; tối đa một vòng active/proposal. **15 audit nghiệp vụ = 4 ASSIGN + 4 START + 5 COMMENT + 2 DECISION**.
- Có **4 notification**: đúng owner và GVHD chính thức cho mỗi decision; **2 outbox event** khớp review/version/decision, đều `PENDING`, attempts 0. Email worker tắt; **không kết luận email đã được gửi**.
- `thesisDossier`, `dossierFinalization`, `guidancePlan`, `task`, `progressReview`, `finalResult` đều 0. Hash các bảng producer gốc của DB test giữ nguyên. [Snapshot DB](live-database-snapshot.json), [9 đối chiếu có assertion](integrity-checks.json).
- Với **DB UI hiện có**, hash và số dòng của **100 bảng** trùng khớp trước/sau lượt tiếp tục ngày 28/10. Hai lần đo dùng giao dịch `REPEATABLE READ READ ONLY`. Đây là đối chứng cho lượt tiếp tục, không phải hash trước/sau toàn bộ phiên ngày 27/10 đã có đăng nhập được cho phép. [Trước](main-before.json), [sau: unchanged=true](main-after.json).

## Browser, console, network và accessibility

- Viewport desktop 1440×1000, mobile 390×844. Đã thao tác menu bằng Enter/Escape, kiểm tra focus quay về nút menu, Tab và controls có nhãn; queue/detail/form phân công và reviewer không tràn ngang toàn trang. Bảng queue có vùng cuộn riêng. [Queue mobile](U02-mobile-queue.png), [form phân công](U02-mobile-editable-assignment.png), [form reviewer](U02-mobile-reviewer-active-form.png).
- **5 lần quét Axe** với `wcag2a`, `wcag2aa`, `wcag21aa`: 0 violation được máy phát hiện; desktop queue có **1 incomplete** cần đánh giá thủ công. Không tương đương chứng nhận toàn app đạt WCAG. Xem các file `U03-*-axe.json` và [summary](run-summary.json).
- Ngày 28/10: **0 pageerror**, **0 requestfailed ở mức transport**, **113 console error**, **43 console warning**; đồng thời quan sát 113 HTTP response lỗi. HTTP 400/403/404/409 đã nhận response không phải transport failure.
- Trong 113 HTTP lỗi do page phát sinh: **13** thuộc ca âm tính STEP5 (8 GET review 404, 2 GET proposal 404, 2 GET history 404, 1 POST stale comment 409). **100** thuộc endpoint legacy/shell ngoài STEP5 khi đăng nhập/đi qua trang forbidden: plan/results, terms/catalog, registrations/accounts. Fixture tối giản/permission baseline và các tài khoản âm tính làm phát sinh nhiễu này; chưa coi chúng là lỗi nghiệp vụ STEP5. Không tuyên bố console sạch. Vite có cảnh báo CJS deprecated; browser có React Router future warning.
- Probes API trực tiếp qua `context.request` không phát console trong page; response status được ghi ở checkpoint và [server traffic](live-server-traffic.json). Không coi thiếu page event của các probe này là thiếu request.
- Log đầy đủ theo suite: [workflow](workflow-browser-log.json), [roles/UI](roles-ui-browser-log.json), [boundaries](boundaries-browser-log.json), [reviewer mobile](reviewer-mobile-browser-log.json), [replay](replay-browser-log.json). Không lưu password, JWT hoặc URL DB có credentials trong báo cáo này.

## Ma trận 52 nhóm theo kế hoạch

PASS nghĩa là đã có quan sát/assertion thực thi cho expected trong phạm vi ghi ở hàng; BLOCKED giữ nguyên tiểu ca chưa được chứng minh, không quy đổi thành PASS.

| ID | Kết quả | Bằng chứng/phạm vi |
|---|---|---|
| E01 | PASS | MCP 27/10 và browser-control 28/10: mở trang + toggle mật khẩu |
| A01 | PASS | MCP: queue anonymous chuyển login |
| A02 | PASS | MCP: detail anonymous chuyển login |
| A03 | PASS | MCP: assignment anonymous chuyển login |
| A04 | PASS | MCP: 7 GET canonical đều 401 |
| F01 | PASS | MCP baseline + workflow private queue/scope/options |
| F02 | PASS | MCP: tên/mã/không khớp/clear; lỗi Unicode case ghi riêng B02 |
| F03 | PASS | MCP: 4 bộ lọc trạng thái và rows tương ứng |
| F04 | PASS | MCP department + API grant isolation |
| F05 | PASS | MCP unassigned đối chiếu active review |
| F06 | PASS | MCP đổi đợt, clear department, quay lại |
| F07 | PASS | MCP phase ISO đối chiếu UI Asia/Ho_Chi_Minh |
| F08 | BLOCKED | API limit1 page1/2/3 PASS; UI một trang và nút disabled PASS; chưa có >20 hồ sơ/đợt để click UI sang trang 2 |
| F09 | PASS | MCP candidates + API scope/eligible/advisory, không auto-select |
| F10 | PASS | MCP draft/back/reset; private form chọn rồi rời trang không tạo vòng |
| F11 | PASS | MCP form phân lại + workflow reason required |
| F12 | PASS | MCP vòng cũ/active và workflow history/comment/decision/version/hash |
| F13 | PASS | MCP GET + workflow reload không start/tăng revision |
| R01 | PASS | Reviewer ASSIGNED có start/comment, không decide |
| R02 | PASS | IN_REVIEW có controls hợp lệ, không vote/quorum/chair |
| R03 | PASS | DECIDED/SUPERSEDED readonly, lịch sử giữ nguyên |
| R04 | PASS | Advisor readonly; active membership cũng không cho self-review |
| R05 | PASS | Outsider/cross-term GET và command bị chặn |
| R06 | PASS | Owner đọc đúng, không candidates/start/comment/decide |
| R07 | PASS | Sinh viên không đọc proposal/review người khác, UI báo lỗi |
| R08 | PASS | ADMIN UI forbidden, canonical API không bypass |
| R09 | PASS | COMMITTEE có permission nhưng không quan hệ: forbidden/404, không start |
| R10 | PASS | Faculty ngoài grant 404; thiếu permission 403 |
| U01 | PASS | Nhãn, Enter mở menu, Escape đóng/trả focus, Tab và controls desktop/mobile |
| U02 | PASS | 390px queue/detail/assignment và reviewer active, thao tác comment thật |
| U03 | PASS | 5 quét Axe, 0 violation; 1 incomplete được ghi riêng |
| U04 | FAIL | Empty và GET404/back recovery PASS; whitespace comment không có feedback — S5-02; chưa đo tải chậm có kiểm soát |
| U05 | PASS | SPA chuyển round rồi quay lại: comment/decision draft không lẫn |
| B01 | PASS | 10 query invalid đều 400, không stack/Prisma leak |
| B02 | FAIL | Trim/ASCII/group-history PASS; Unicode hoa/thường FAIL — S5-01 |
| B03 | PASS | Queue/options/history/detail trước-sau đọc không thay đổi |
| W01 | PASS | UI assign thật 3 proposal, state/version/actor/round đúng |
| W02 | PASS | Phân lại có reason, supersede/history/version/comment nguyên vẹn |
| W03 | PASS | Explicit start đúng hai trạng thái; GET không start |
| W04 | PASS | Nhiều reviewer append comment đúng actor/version/time |
| W05 | PASS | APPROVED/DECIDED, không dossier |
| W06 | PASS | Required/blank conclusion bị chặn; canonical REVISION_REQUIRED đúng |
| W07 | PASS | Strict body/actor/enum/revision/key; không ghi dở |
| W08 | PASS | API suite cross-term/department, faculty/reviewer/advisor role/scope |
| W09 | BLOCKED | Chưa mở/hết hạn/locked/cancelled và race lock PASS; chưa kiểm chứng đúng mili-giây tại start/end bằng real clock |
| W10 | PASS | API suite stale version/agreement/routing/PUBLISHED và legacy SEALED |
| W11 | PASS | API race assign/comment/CAS; stale UI submit 409 và reload recovery |
| W12 | PASS | API concurrent decisions: một commit, bên còn lại 409, một decision |
| W13 | PASS | Replay cùng payload trả cũ, khác payload 409; không duplicate |
| W14 | PASS | API locked account; lượt tiếp tục permission/membership revocation chặn replay trước khi trả cache |
| W15 | PASS | API audit failure rollback; DB audit/notification/outbox recipients/count đúng |
| W16 | PASS | Vòng cũ readonly, cấm ghi sau decided/superseded, không auto-approve khi đọc |

## Giới hạn và bàn giao

- Không thử UI nhiều trang vì fixture có tối đa hai hồ sơ/đợt. API pagination đã thử riêng. Không suy API pagination PASS thành UI pagination PASS.
- Không mock clock/API để chứng minh đúng mili-giây ở boundary deadline. Các thời điểm trước/sau rõ ràng và phase lock đã được kiểm tra; boundary chính xác còn thiếu bằng chứng.
- Loading chậm có kiểm soát, SMTP delivery, load/performance dài hạn, browser khác và toàn bộ WCAG thủ công chưa thực thi. Đây không phải kết luận PASS cho các phạm vi đó.
- Mỗi harness browser chạy theo thứ tự trên DB mới; `workflow`, `boundaries`, `reviewer-mobile` có tạo fixture/state nên không chạy lại tùy tiện trên DB đã dùng. Source harness, ảnh, response, snapshot và log được giữ để review; launcher từ chối reuse target cũ.
- Các browser context đã đóng; API/Vite riêng đã tắt và xác nhận không còn lắng nghe. DB test được giữ lại, PostgreSQL cluster local được để chạy, không shutdown/reset cluster. [Cleanup](cleanup.json), [service stopped](live-stopped.json).

Ưu tiên xử lý **S5-01**, sau đó **S5-02** và chạy regression tương ứng. Kết quả hiện tại đủ xác nhận luồng nghiệp vụ chính, nhưng chưa đủ kết luận STEP5 hoàn toàn đạt.
