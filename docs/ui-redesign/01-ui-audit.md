# Audit UI/UX hiện trạng

**Bàn giao audit ngày 15/11/2026; chưa triển khai redesign.** Phạm vi: trải nghiệm sinh viên, giảng viên và cán bộ khoa. Đọc toàn bộ router và các module được router sử dụng; chỉ tạo hồ sơ/bằng chứng. Không thay frontend, backend, schema, API contracts, RBAC hay dữ liệu nghiệp vụ.

## Kết quả và giới hạn

- Inventory đủ **62 đích route**, gồm59 mục manifest và3 đích login/403/404: **48 đã quan sát** ít nhất một trạng thái, **12 bị chặn** bởi loading/lỗi tải và **2 chỉ đọc code** (Admin). [Hồ sơ từng route](02-route-inventory.md).
- **Không có P0 được xác minh. Có5 phát hiện P1 và10 phát hiện P2.** Đây không phải chứng nhận hệ thống không có lỗi nghiêm trọng; chưa thể kiểm tra luồng ghi và nhiều trạng thái bảo vệ.
- 99 bản ghi baseline (gồm ảnh Khoa giai đoạn đầu), cùng tương tác bàn phím/reflow/axe, lưu trong [evidence ledger](evidence/README.md) và [JSON đã lược bỏ nội dung nhạy cảm](evidence/browser-audit.json). Ảnh có nội dung mẫu học vụ; không có token/mật khẩu. Hai ảnh danh mục có liên hệ ngoài bộ mẫu không được giữ.
- Màn bị chặn: **R04, R29, R49–R57, R62**. R04/R49 mới thấy shell/đang tải; R29/R50–R57/R62 bị boundary tải chung chặn. R57 chưa chạy được redirect đến R51 vì boundary trước trang lỗi. R61 từng mở được403. Không đánh giá bảng, dialog, tính đúng của điểm/lịch bên trong các màn bị chặn.
- Có phiên tách biệt cho SV, GVHD, GV xét duyệt và Khoa từ bộ tài khoản mẫu hiện có. Không có phiên ADMIN hoặc COMMITTEE; không tự tạo tài khoản. Snapshot quyền cho thấy Khoa có quyền đọc các route bảo vệ và nhật ký; không quy timeout thành lỗi thiếu quyền.

## Cách kiểm tra

Ứng dụng thật tại `http://127.0.0.1:5173`, API tại cổng3000. Phiên kiểm tra ngày15/11/2026 (timestamp bằng UTC trong ledger; giờ địa phương UTC+7). Dùng Playwright MCP với hồ sơ và3 đợt mẫu đã tồn tại: đăng ký, đề cương/xét duyệt, hướng dẫn/báo cáo tuần. ID động lấy từ danh sách/URL/API thật. Không đọc `.env`, seed, reset DB hoặc tạo fixture thay API.

Phần lớn chuyển route bằng history/popstate để khảo sát; chỉ những tương tác ghi trong ledger được tính là kiểm tra luồng bấm. Có kiểm tra mở/đóng menu, modal, tìm kiếm, native validation và focus. Không lưu/nộp/duyệt/công bố/chốt/xóa/đánh dấu đã đọc, không tạo PDF hoặc tải file có thể phát sinh ghi audit. Danh sách hành động trong inventory là từ code, không có nghĩa đã thực thi.

Mỗi ảnh ghi route, vai trò, viewport, trạng thái và thời điểm. Baseline desktop dùng1440×900; mobile 390×844; kiểm tra bổ sung 320px và768×1024. Phần lớn ảnh là full-page với viewport ghi trong ledger, nên kích thước PNG có thể cao hơn viewport. Ảnh hậu kiểm axe dùng crop viewport. Không có ảnh mobile hoàn chỉnh cho mọi route: ưu tiên4 màn đại diện và các workflow mở được; các cặp route/viewport chưa có evidence vẫn **chưa kiểm tra**, không suy rộng kết quả.

Có 121 response HTTP 500 trong log theo dõi; đây là số sự kiện gồm request lặp/retry, không phải số lỗi độc lập hay số màn hỏng. Console root context cũng ghi Failed to load resource 500. Log chỉ lưu phương thức, URL/path, status, thời điểm; không headers/body/token. Không có pageerror/non-read request được observer ghi trong khoảng theo dõi; auth xảy ra ngoài khoảng này. Chưa có log console đầy đủ của mọi context. Không đọc log backend nên **chưa xác định nguyên nhân gốc** của500/timeout; không tuyên bố nghẽn DB hay lỗi thuật toán.

## Kiến trúc thực tế và điểm mạnh

React 18, React Router 6, Vite 5, TypeScript, TanStack Query 5, axios, Tailwind 3; form có react-hook-form/Zod và validation riêng theo feature. Tham chiếu [dependency](../../frontend/package.json), [entrypoint](../../frontend/src/main.tsx), [router](../../frontend/src/app/router/routes.tsx). README mô tả shadcn/ui nhưng runtime dùng kit nội bộ: [kit](../../frontend/src/shared/components/kit.tsx), [DataTable](../../frontend/src/shared/components/data-table.tsx), [ActionMenu/PageActions](../../frontend/src/shared/components/action-menu.tsx); không đề xuất thay component kit.

WorkspaceLayout bọc workspace thông thường bằng DataBoundary/API snapshot. ReviewGroupLayout tái sử dụng WorkspaceLayout với scoped data và workflow CSS; không phải hai framework độc lập. Tên useDemo/DemoDb là di sản; đường AUTH_API hiện lấy API thật. [snapshot-api.ts](../../frontend/src/shared/data/snapshot-api.ts) dùng Promise.all cho nhiều nguồn và đợt, liên quan phạm vi ảnh hưởng của F02. Không được hiểu tên useDemo là lý do bật mock.

Entry import index.css trước design-system.css; workflow bổ sung workspace.css. Đã có tokens màu, nền, spacing/layout/radius/shadow, primary indigo và nền trắng/xám chuyên nghiệp. Bảng kit có sort, search/filter, pagination, selection và card mobile; nút icon nhiều nơi có aria-label. Layout có skip link, trạng thái nav và menu theo quyền. Modal/menu có trap/restore focus; Notice có status/alert. Các workflow giữ history, version, lý do disabled và ngữ cảnh đợt. Đây là nền để chỉnh từng phần, không viết lại toàn bộ UI.

## Đánh giá thiết kế

| Khía cạnh | Nhận xét có căn cứ | Hướng cải thiện |
|---|---|---|
| Phân cấp | Heading/CTA rõ trên đăng ký và form workflow; tổng quan có nhiều khối cùng trọng lượng, hành động tiếp theo chưa bao phủ hướng dẫn | F01/F10: ưu tiên việc cần làm và deadline, gộp số liệu phụ |
| Typography | Font sans có tiếng Việt; nhiều metadata 9–13px, đo được sidebar small 10px | F10: scale chữ nhất quán; không dùng chữ quá nhỏ để nhét dữ liệu |
| Spacing | Card/form desktop có khoảng thở; mobile workflow kéo dài; đợt chọn lặp nhiều chỗ | F10/F11: density theo tác vụ, giảm vùng ngữ cảnh lặp |
| Màu và trang trí | Indigo/nền trắng và badge có nhãn; CSS có gradient, blur, nhiều cấp shadow và pulse vô hạn | Giảm trang trí không giúp hành động; giữ màu trạng thái kèm chữ; không gán mọi gradient là lỗi |
| Form/button | Có required/disabled và cảnh báo điều kiện; nhiều form thiếu hợp đồng nối error/hint; PageActions chọn primary bằng heuristic | F04/F08: CTA chính rõ, lỗi theo trường, giữ validation |
| Table/list | Kit có khả năng dùng lại, workflow dùng list riêng; copy scope/filters chưa đồng nhất | F05/F07/F11: dữ liệu khớp, rõ phạm vi và filter đang dùng |
| Navigation | Nhóm menu theo role, active item, link về danh sách có sẵn | F04/F11/F13: link tới editor chuẩn, giữ đợt qua URL, tránh route legacy giả |
| Loading/empty/error | Có skeleton, Notice, GuidanceState; lỗi snapshot có thể làm mất shell; chưa đủ ngữ nghĩa empty từng trường hợp | F02/F09: phục hồi đúng vùng, không lấy empty che lỗi |
| Responsive | Login và đăng ký đo không tràn ở390/320/768; workflow form/list mobile đã mở; terms mobile bị chặn | Không tuyên bố toàn bộ route đạt. Kiểm thêm bảng dày, dialog, zoom và dữ liệu dài |
| Motion/accessibility | Menu mobile và dialog thử đạt focus; reduced motion có hiệu lực; axe không báo violation trên3 mẫu | Giữ nền này, kiểm form lỗi và contrast thủ công; chưa chứng nhận toàn ứng dụng |

## Phân loại phát hiện

P0: mất/lộ dữ liệu hoặc luồng cốt lõi bị chặn diện rộng có bằng chứng trực tiếp. P1: cản trở tác vụ chính, dễ làm sai hoặc không tiếp cận được. P2: thiếu nhất quán/khả năng đọc/thao tác thừa chưa chặn tác vụ chính. Timeout trong phiên cục bộ được xếpP1, chưa đủ bằng chứng tác động diện rộng để gọiP0.

Một mã có thể áp dụng nhiều route qua component chung. Hồ sơ route chỉ rõ bằng chứng trực tiếp và phần suy từ code; đề xuất không phải kết luận đã tái hiện ở mọi vai trò.

<a id="f01"></a>

### F01 · P1 · UX / thông tin nghiệp vụ

- **Route:** R26; đối chiếu R01, R10, R35–R36.
- **Bằng chứng / mức xác minh:** Đã quan sát SV, GV và Khoa; student-dashboard-1440-4.png, lecturer-dashboard-1440-5.png, faculty-dashboard-desktop.png. dashboard-service.ts:69–70 lọc giai đoạn bằng tên đăng ký/phân công/đề cương/đề tài.
- **Vấn đề và tác động:** Tổng quan tập trung đăng ký–đề cương, chưa phản ánh đầy đủ hướng dẫn/bảo vệ. SV ở đợt hướng dẫn vẫn được gợi ý kiểm tra/xuất đề cương; thẻ ghi 5/5 mốc nhưng vùng hero chỉ vẽ 4, trong khi phần dưới có 5 và kế hoạch đợt có 7 giai đoạn. Dễ bỏ sót báo cáo hoặc nhận xét cần xử lý; hoàn thành hồ sơ bị hiểu thành hoàn thành toàn bộ đồ án.
- **Đề xuất:** Nêu rõ phạm vi tiến độ; một hệ mốc nhất quán; ưu tiên hành động theo vai trò và giai đoạn từ dữ liệu chuẩn hiện có.
- **Phải giữ:** Không đổi trạng thái, deadline, thuật toán tiến độ hoặc quyền dữ liệu; không tự thêm API mới.
- **Kiểm thử lại:** AC05: ba vai trò × đăng ký/đề cương/hướng dẫn; đối chiếu CTA, số mốc và danh sách nhiệm vụ thật.

<a id="f02"></a>

### F02 · P1 · UI/UX + tích hợp/môi trường chưa xác định

- **Route:** R04, R29, R49–R57, R62; lỗi gián đoạn cả R26/R34/R39.
- **Bằng chứng / mức xác minh:** faculty-committees-1440-53.png; faculty-progress-final-1440-51.png; browser-audit.json ghi HTTP 500 và timeout. kit.tsx DataBoundary; snapshot-api.ts Promise.all; WorkspaceLayout.
- **Vấn đề và tác động:** Lỗi snapshot chung có thể thay toàn shell bằng thông báo kỹ thuật timeout 20000ms và nút Thử lại. Một số màn chỉ giữ loading trong thời gian quan sát. 12 route chưa xem được nội dung hoàn chỉnh ở thời điểm bàn giao. Không dùng được navigation khi boundary lỗi; không biết dữ liệu nào hỏng. Không thể audit các bảng/form bên dưới.
- **Đề xuất:** Giữ shell và ngữ cảnh khi tải/lỗi; phân biệt tải ban đầu/làm mới, nêu lỗi dễ hiểu và retry đúng vùng. Điều tra API 500/timeout thành đầu việc tích hợp riêng trước khi mở rộng redesign.
- **Phải giữ:** Không che lỗi bằng dữ liệu giả hoặc đổi semantics cache/phân quyền; backend chỉ xử lý qua nhiệm vụ riêng được duyệt.
- **Kiểm thử lại:** AC02/AC04: lỗi một nguồn không làm mất lối thoát; retry không ghi dữ liệu; chạy lại 12 route khi API ổn. Không dùng fixture để tuyên bố tích hợp đã đạt.

<a id="f03"></a>

### F03 · P1 · UX diễn giải trạng thái; chưa xác định lỗi tính toán

- **Route:** R01, R10–R12.
- **Bằng chứng / mức xác minh:** student-task-detail-1440-13.png, student-submissions-1440-15.png, student-weeks-1440-25.png; cùng nhiệm vụ/lần nộp thật.
- **Vấn đề và tác động:** Nhiệm vụ cùng lúc hiển thị Đã nộp/Quá hạn trong khi lịch sử bản nộp ghi Đúng hạn, đang chờ nhận xét. SV có thể tưởng đã nộp trễ hoặc phải nộp lại; GV phải giải thích trạng thái thay vì nhận xét.
- **Đề xuất:** Tách ba thông tin: hạn nhiệm vụ, thời điểm bản nộp, tình trạng đánh giá. Nêu rõ quá hạn của việc chưa hoàn thành khác nộp muộn.
- **Phải giữ:** Giữ enum, thời gian và quy tắc chấm; không đổi overdue thành false chỉ để hết cảnh báo.
- **Kiểm thử lại:** AC05: nộp đúng hạn nhưng chưa đánh giá; nộp trễ; cần sửa có hạn mới; đã hoàn thành.

<a id="f04"></a>

### F04 · P1 · UX navigation / biểu diễn dữ liệu

- **Route:** R44–R46, đối chiếu R16–R17.
- **Bằng chứng / mức xác minh:** student-draft-1440-40.png, student-overview-1440-41.png, student-proposal-edit-1440-22.png. ProposalEditorPage.tsx workflowReady; action-menu.tsx PageActions.isPrimary.
- **Vấn đề và tác động:** Editor cũ readonly khi đã chuyển workflow nhưng thông điệp chưa chỉ rõ lý do riêng. Heuristic chọn Badge là primary trước Link, đưa lối mở editor mới vào menu Thao tác khác. Preview cũ thiếu một số mục có ở phiên bản chuẩn; chưa kiểm tra PDF tải xuống. SV đi vào màn không sửa được, khó tìm nơi sửa đúng và không biết bản nào đáng tin.
- **Đề xuất:** Đưa lối sang editor chuẩn ra ngoài menu; diễn giải lý do readonly; đối soát adapter nội dung cũ/mới theo version, không xóa route cũ.
- **Phải giữ:** Giữ workflowReady, phiên bản đóng dấu, URL và chức năng xem/in; chưa kết luận lỗi PDF hay backend.
- **Kiểm thử lại:** AC05/AC07: đi từ đề tài→editor cũ→bản chuẩn bằng bàn phím; so cùng phiên bản; tệp in kiểm tra riêng.

<a id="f05"></a>

### F05 · P1 · Nhất quán dữ liệu/nghiệp vụ — nguyên nhân chưa xác định

- **Route:** R41.
- **Bằng chứng / mức xác minh:** faculty-assignment-1440-36.png: phương án đã chốt, 12 SV có GV nhưng cột lý do hiện Chưa phân công. AssignmentPlanPage render reason từ dữ liệu.
- **Vấn đề và tác động:** Kết quả phân công và lý do đi kèm mâu thuẫn. Giáo vụ khó tin cậy bảng trước khi công bố hoặc điều chỉnh.
- **Đề xuất:** Đối soát reason tại adapter/API và dữ liệu mẫu; sau khi thống nhất nghĩa, hiển thị nhãn phù hợp. Tách khỏi thay đổi màu/bố cục.
- **Phải giữ:** Không viết lại phương án, quota, thuật toán hoặc dữ liệu chỉ để sửa nhãn.
- **Kiểm thử lại:** AC05: assigned/unassigned/published và reason khớp; xác minh nguồn trước khi chọn cách sửa.

<a id="f06"></a>

### F06 · P2 · UI / ngôn ngữ

- **Route:** R03, R06, R08–R09, R11–R12, R14, R16–R17, R19, R24, R41, R46–R48, R60.
- **Bằng chứng / mức xác minh:** student-task-detail-1440-13.png, student-version-1440-42.png, lecturer-defense-confirm-1440-60.png: mã sự kiện, UUID/ISO, trạng thái kỹ thuật, UC17. Một số route chỉ là ứng viên áp dụng component chung, xem inventory.
- **Vấn đề và tác động:** Các màn khác nhau dùng nhãn tiếng Việt xen mã nội bộ, thời gian ISO và ID dài; giải thích nghiệp vụ bị chìm trong thông tin kỹ thuật. Tăng thời gian đọc, khó nhận biết ai làm gì và khi nào; khó dùng trên mobile.
- **Đề xuất:** Nhãn tiếng Việt và giờ Việt Nam thống nhất; đặt ID/hash/sự kiện gốc trong chi tiết có thể mở khi cần; điều chỉnh thông điệp theo vai trò.
- **Phải giữ:** Không bỏ audit trail, hash, version hoặc dữ liệu truy nguyên; không diễn giải gate thành quyền ghi.
- **Kiểm thử lại:** AC06: kiểm tra snapshot dài và lịch sử; nhãn không đổi ý nghĩa enum; luôn truy xuất được thông tin gốc.

<a id="f07"></a>

### F07 · P2 · UX phạm vi dữ liệu

- **Route:** R07.
- **Bằng chứng / mức xác minh:** lecturer-plans-1440-50.png; guidance-tasks/pages.tsx dùng danh sách đề cương APPROVED. GVHD mẫu có 3 SV ở final-defense nhưng danh sách kế hoạch có 9 hồ sơ.
- **Vấn đề và tác động:** Lời dẫn nói sinh viên bạn đang hướng dẫn nhưng danh sách API có thể gồm hồ sơ theo quan hệ xét duyệt; không giải thích quan hệ hay quyền chỉ đọc ngay trên item. GV phải mở hồ sơ để biết có thể giao việc hay chỉ xem.
- **Đề xuất:** Hiển thị quan hệ/phạm vi rõ và capability thao tác; kiểm chứng scope với API trước khi lọc.
- **Phải giữ:** Không kết luận lộ dữ liệu từ chênh lệch số lượng; không tự thu hẹp/mở rộng RBAC.
- **Kiểm thử lại:** AC01/AC06: GVHD, thành viên xét duyệt và người ngoài quan hệ; đọc và giao việc có điều kiện riêng.

<a id="f08"></a>

### F08 · P2 · Accessibility / form — chủ yếu bằng chứng code

- **Route:** Các route form trong inventory; component Field dùng chung.
- **Bằng chứng / mức xác minh:** kit.tsx Field: hint/error là small nhưng không tự nối aria-describedby/aria-invalid. Form nhận xét có role alert tổng hợp, native required và disabled riêng. Login empty validation đã chạy; chưa kích hoạt lỗi lưu trên server.
- **Vấn đề và tác động:** Liên kết lỗi/gợi ý với input chưa được bảo đảm ở cấp kit; nhiều form chỉ báo lỗi tổng quát, chưa chỉ ra trường cần sửa. Người dùng bàn phím/screen reader có thể mất ngữ cảnh khi sửa lỗi. Chưa khẳng định mọi form đều không truy cập được.
- **Đề xuất:** API Field có id/errorId/description và hợp đồng focus lỗi; thông báo từng trường khi schema cung cấp. Không bỏ validation hiện có.
- **Phải giữ:** Giữ schema, giới hạn, required và quy tắc xác nhận; không thay đổi lỗi nghiệp vụ thành thành công.
- **Kiểm thử lại:** AC03: lỗi bắt buộc/format/server, tên truy cập và mô tả đúng trường; focus và thông báo chỉ đọc cần thiết.

<a id="f09"></a>

### F09 · P2 · UI / feedback

- **Route:** R02, R04–R05, R18 và GuidanceState dùng chung.
- **Bằng chứng / mức xác minh:** lecturer-review-1440-24.png, student-meetings-1440-47.png; guidance-tasks/components.tsx GuidanceState có status/alert nhưng không nhận retry; router Loader và DataBoundary skeleton thiếu status tường minh.
- **Vấn đề và tác động:** Empty và loading không nhất quán về ngữ cảnh, ngữ nghĩa truy cập và đường phục hồi. Không có dữ liệu phù hợp khác đã xử lý hết công việc hoặc chưa có buổi hướng dẫn. Người dùng khó biết nên đổi bộ lọc, chọn kế hoạch hay chờ.
- **Đề xuất:** Empty theo nguyên nhân với hành động hợp quyền; loading có tên vùng; lỗi có retry khi an toàn.
- **Phải giữ:** Không dùng một empty chung để che lỗi/403; giữ thông tin request thất bại.
- **Kiểm thử lại:** AC04: chưa có dữ liệu, filter không khớp, không còn việc, lỗi thật và làm mới; không suy empty từ loading.

<a id="f10"></a>

### F10 · P2 · Visual hierarchy / typography / CSS

- **Route:** R26, R30–R31, R34–R36, R39–R42; tokens dùng chung.
- **Bằng chứng / mức xác minh:** Ảnh dashboard/terms/registration desktop; design-system.css, index.css, workspace.css. Đo sidebar-context small 10px, tương phản mẫu 4.9:1; không phát hiện fail tương phản ở mẫu này.
- **Vấn đề và tác động:** Nhiều chữ phụ 9–13px và nhiều thẻ thống kê/khung/nền làm loãng ưu tiên. Hai stylesheet nền có nhiều selector lặp, workflow lại có lớp riêng; dễ lệch spacing khi sửa cục bộ. Khó đọc nhanh lượng thông tin học vụ lớn; nguy cơ regression khi thay token diện rộng.
- **Đề xuất:** Scale chữ/spacing chung, giảm khung và nền phụ, một CTA chính; ưu tiên tokens và kit hiện có. Giảm blur/gradient/hover nâng thẻ nơi không hỗ trợ tác vụ.
- **Phải giữ:** Giữ thông tin và hành động; không thay kit, framework hoặc xóa chức năng để giảm mật độ.
- **Kiểm thử lại:** AC02/AC06/AC08: ảnh trước/sau, text dài, zoom, reflow và tương phản trên nền thật; kiểm tra cả workspace thường/workflow.

<a id="f11"></a>

### F11 · P2 · UX navigation / lọc

- **Route:** R01–R02, R07, R10, R13, R15, R18, R21, R47–R48.
- **Bằng chứng / mức xác minh:** Ảnh workflow có selector đợt ở topbar và trong màn; faculty-group-create-mobile-390-85.png. Các FilterBar workflow khác DataTable về chỉ báo filter/clear.
- **Vấn đề và tác động:** Ngữ cảnh đợt lặp lại với chuỗi dài, đặc biệt trên mobile; trạng thái bộ lọc ít nổi bật khi đóng popover. Tốn chiều cao, khó biết filter nào đang áp dụng hoặc đổi đợt có mất form chưa lưu.
- **Đề xuất:** Một ngữ cảnh đợt rõ, giữ liên kết URL/state; hiển thị filter đang dùng và xóa lọc; cảnh báo thay đợt theo hành vi hiện có.
- **Phải giữ:** Không bỏ chọn đợt bắt buộc của form; route động tiếp tục suy ra đúng đợt từ hồ sơ.
- **Kiểm thử lại:** AC07: đổi đợt ở hai nơi, Back/Forward, reload/deep link; không còn filter vô hình; không mất lựa chọn ngoài ý muốn.

<a id="f12"></a>

### F12 · P2 · UX giải thích quyền — chỉ đọc code

- **Route:** R28.
- **Bằng chứng / mức xác minh:** RolesPermissionsPage.tsx dùng r.roles.includes(role) để vẽ dấu cho phép mở màn hình; canAccessRoute còn xét permission; navigationRoutes còn xét menuMode/menuRoles.
- **Vấn đề và tác động:** Ma trận trình bày role allowlist như quyền truy cập thực tế; chưa phản ánh đủ điều kiện route/menu. Admin có thể hiểu sai quyền được cấp. Chưa vào được màn do không có phiên Admin được cấp cho audit.
- **Đề xuất:** Tách allowlist/permission/menu/scope trong phần trình bày, diễn giải giới hạn ma trận.
- **Phải giữ:** Không sửa cách kiểm quyền thực thi.
- **Kiểm thử lại:** AC01: người cùng role khác permission; menu ẩn nhưng route hợp lệ; đối chiếu từng hàng.

<a id="f13"></a>

### F13 · P2 · Kiến trúc thông tin / bảo trì — chỉ đọc code

- **Route:** R57 và constants không đăng ký.
- **Bằng chứng / mức xác minh:** shared/constants/routes.ts còn /catalog/research-areas, /defense/committee, /grading/scores, /grading/results; router không đăng ký. ExportCenterPage AUTH_API redirect /defense/reports.
- **Vấn đề và tác động:** Constants/legacy page dễ bị nhầm là route sống hoặc thiết kế nhầm màn xuất demo. Kế hoạch redesign có thể bỏ sót màn thật hoặc làm thêm màn không được dùng.
- **Đề xuất:** Lấy router thực thi làm nguồn inventory; ghi riêng legacy. Nếu đồng bộ constants về sau, thực hiện nhiệm vụ bảo trì riêng có kiểm tra link.
- **Phải giữ:** Không tự xóa file/route cũ và không bật demo.
- **Kiểm thử lại:** AC01/AC07: đủ62 đích,59 manifest; redirect và query đúng; không thêm route chỉ vì tồn tại component.

<a id="f14"></a>

### F14 · P2 · UX nội dung hỗ trợ

- **Route:** R25, R37.
- **Bằng chứng / mức xác minh:** Đã mở modal Quên mật khẩu trên login dùng API thật; có hướng dẫn demo và giá trị mật khẩu mặc định (không chép vào hồ sơ audit). faculty-parameters-1440-29.png có Chính sách phân công demo.
- **Vấn đề và tác động:** Copy demo chưa tách khỏi trải nghiệm API; người dùng dễ làm theo hướng dẫn không phù hợp môi trường. Tăng nhầm lẫn và yêu cầu hỗ trợ; không có bằng chứng tài khoản đang dùng mật khẩu mặc định nên không gán P0.
- **Đề xuất:** Hướng dẫn liên hệ quản trị đúng môi trường, bỏ thông tin không cần thiết trong nội dung người dùng; gọi đúng chính sách đang áp dụng.
- **Phải giữ:** Không đổi auth flow, reset password hay chính sách phân công.
- **Kiểm thử lại:** AC06: API mode không hiển thị lời hướng dẫn demo; modal Tab/Escape/focus vẫn hoạt động.

<a id="f15"></a>

### F15 · P2 · UI / thông báo

- **Route:** R06, R60.
- **Bằng chứng / mức xác minh:** student-notifications-1440-66.png và student-guidance-notifications-1440-63.png; DOM R60 có Chưa đọc lặp ở badge và dòng phụ; hai màn có cùng10 thông báo mẫu.
- **Vấn đề và tác động:** Cùng thông báo có nhãn chưa đọc lặp; hai màn đọc thông báo dùng bố cục và cách biểu diễn trạng thái khác nhau. Tăng nhiễu; dễ nhầm trạng thái gửi với trạng thái người nhận đã đọc.
- **Đề xuất:** Một nhãn read/unread, tách delivery khi cần; nhất quán đường mở hồ sơ và empty.
- **Phải giữ:** Không tự đánh dấu đã đọc khi vào màn; SENT/FAILED và read là hai thuộc tính khác nhau.
- **Kiểm thử lại:** AC04/AC06: so hai màn với cùng thông báo; phân trang/filter không đổi read; gửi lại chỉ theo quyền và thao tác rõ.

## Kiểm tra thực sự đã chạy

| Kiểm tra | Kết quả và giới hạn |
|---|---|
| Route manifest Vitest | `node node_modules/vitest/vitest.mjs run src/app/router/route-manifest.test.ts` tại frontend: **14/14 đạt**. Lần đầu sandbox chặn esbuild spawn EPERM; chạy lại cùng lệnh được phê duyệt ngoài sandbox đạt. Không đổi config/test. |
| Login required | Form trống bị native validation chặn; focus về username. Không gửi đăng nhập sai vào API. |
| Login modal hỗ trợ | Mở, Shift+Tab giữ trong dialog, Escape đóng và trả focus đúng nút. Nội dung demo làF14. |
| Menu mobile GVHD | Enter mở, Shift+Tab không thoát sidebar, Escape đóng và trả focus Mở điều hướng. Không thấy focus chạy vào sidebar đóng ở mẫu đã thử. |
| Reduced motion | emulate reduce: media query=true; transition sidebar 1e-05s. Chưa test mọi animation/print/system preference. |
| Reflow login/registration | 390/320/768: chiều rộng document không vượt viewport ở lần tải hoàn chỉnh. Đăng ký phải retry sau lỗi snapshot. |
| Reflow review | Lần capture đầu390 ghi 514px, sau layout ổn định client/scroll 375px trong viewport 390; ảnh crop hậu kiểm không còn tràn. **Không kết luận lỗi tràn kéo dài** từ capture đầu; cần đo sau ổn định và khi tải lại. |
| Reflow dashboard/terms | Dashboard SV có baseline 390; 320/768 bị timeout. Terms chỉ có desktop hoàn chỉnh, mobile/tablet bị timeout. |
| Search đề cương Khoa |12 hồ sơ trước; nhập chuỗi không khớp mới thấy loading; xóa chuỗi trở lại12. **Chưa xác minh empty sau lọc**. Sort/pagination nội dung chưa được chạy thành công. |
| Axe 4.14.0, API thật | Login, chi tiết nhận xét GVHD, danh sách đề cương Khoa ở390px: 0 violations thuộc wcag2a/2aa/21a/21aa. Incomplete color-contrast lần lượt3/1/1 node; không coi incomplete là pass. Không quét fixture. |
| Tương phản thủ công có tính toán | Một mẫu chữ sidebar 10px rgb(95,111,133) trên rgb(248,250,252):4.9:1. Không suy rộng ra mọi text/icon/gradient. |
| Deny route | SV vào /guidance/review chuyển URL /forbidden, nhưng nội dung bị timeout. SV /terms bị snapshot chặn trước guard; chưa kết luận negative permission test đạt. |

Chưa chạy screen reader thực, contrast toàn bộ, zoom 200%, upload/download/PDF thực, các thao tác ghi, toàn bộ role×route, các modal và trạng thái dữ liệu chưa có mẫu. Không chạy type-check/lint/build/full test vì không sửa source; không dùng test:ui:browser (fixture) làm bằng chứng API. Kiểm tra tài liệu, đối chiếu router, link và hash được ghi ở [verification.json](evidence/verification.json).

## Kết luận hành động

Ưu tiên làm rõ F02 và F05 bằng nhiệm vụ tích hợp/dữ liệu riêng; trong frontend, sửa nhỏ F04 và nền form/feedback trước khi mở rộng. Bốn màn thử nghiệm: **R26 tổng quan, R39 đăng ký, R03 chi tiết nhận xét, R34 kỳ học/đợt**. Chúng bao phủ ba vai trò, dashboard, form, lịch sử/tệp và bảng/dialog. R34 cần baseline mobile bổ sung khi API phục hồi. [Kế hoạch từng giai đoạn](03-redesign-plan.md) và [tiêu chí nghiệm thu](04-acceptance-criteria.md) là đầu vào cho nhiệm vụ sau; audit này dừng tại tài liệu.
