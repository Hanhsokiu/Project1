# STEP 7 — Kiểm thử thực tế hồ sơ đề cương chính thức

> Báo cáo lịch sử trước sửa. Cả 4 lỗi đã được sửa và kiểm chứng lại trong [lượt hoàn thiện bước 7](../step7-fixes-20261028-1933/report.md); các kết quả dưới đây được giữ nguyên để đối soát.

Ngày 28/10/2026, Asia/Ho_Chi_Minh. Bắt đầu chuẩn bị 14:26; hoàn tất thực thi và dừng dịch vụ QA lúc 19:25. **Kết luận: chưa đạt nghiệm thu bước 7.** Có **4 lỗi xác nhận**: ngoại lệ phase của reopen không đúng contract, không tải được PDF bản chốt cũ, thiếu endpoint preview PDF watermark, và PDF thiếu trường so với mẫu DOCX gốc.

**Playwright MCP đã hoạt động thực tế**: mở giao diện Vite, tương tác nút hiện/ẩn mật khẩu, đăng nhập tài khoản SV tổng hợp, mở hồ sơ và bấm tải PDF thành công. Không suy kết luận này từ kiểm tra kết nối hoặc từ suite API. [Bằng chứng MCP](mcp-verification.json), [ảnh sau đăng nhập](mcp-authenticated-dossier.png), [PDF tải bằng MCP](mcp-student2-official.pdf).

Không sửa mã nguồn, cấu hình, dependency hay migration ứng dụng trong lượt QA này. Chỉ tạo bằng chứng/harness kiểm thử. Các thay đổi ứng dụng có sẵn từ bước 4–6 được giữ nguyên. Không thay đổi dữ liệu nghiệp vụ hiện tại: **hash cả 100 bảng `btl_integration_ui` khớp trước–sau**, ở cả khoảng toàn lượt và khoảng sau tiếp tục. [Toàn lượt](main-after.json), [sau tiếp tục](main-after-resumed.json).

## 1. Nguồn expected và môi trường

Expected được đối chiếu từ:

- [Đặc tả use case](../../../spec/dac-ta-use-case.md), bước 7: SV xuất đề cương đã hoàn thiện theo mẫu, in, xin chữ ký và nộp Khoa.
- [Mẫu gốc Project_1_06.docx](../../../spec/Project_1_06.docx), ảnh trích từ DOCX: [source-template.png](source-template.png).
- [Business contract](../../../implementation/01-business-decisions-and-contract.md): §3.2/line 98 về phase; §4.4/line 232 và §6 về bản chốt cũ; API line 391 về preview PDF.
- [Implementation report bước 7](../../../implementation/07-step7-implementation-report.md) chỉ dùng định vị tính năng; không dùng làm bằng chứng PASS.
- [Kế hoạch 45 nhóm ca lập trước thực thi](plan.md).

Frontend thực tế do Vite cung cấp là **http://127.0.0.1:50185/**, không mặc định lấy 5173. API sau tiếp tục là `http://127.0.0.1:52773/api`. [Thông tin runtime](live-ready.json), [log Vite](resumed-vite.log). Sau kiểm thử, hai dịch vụ QA này đã được dừng.

Ba DB local mới, chỉ dữ liệu tổng hợp, không reset/drop DB hiện tại:

| Mục đích | Database |
|---|---|
| Suite API | `btl_pr2b_step7_1793172586774_bd13ef_api` |
| Upgrade/rollback migration | `btl_pr2b_step7_1793172588484_11e682_api` |
| Giao diện/MCP/lifecycle | `btl_pr2b_step7_1793172588137_95906b_live` |

Các thao tác chốt, generate PDF, nhận bản giấy, reopen, duyệt/chốt lại và tạo plan phục vụ ranh giới bước 8 đều diễn ra trên DB test được cho phép. Fixture tạm về phase, term, grant, tài khoản, profile, metadata file và quan hệ GVHD được khôi phục. Một fixture legacy được giữ lại có chủ đích để đối soát. Worker email bị tắt; không mock response API.

Lượt trước bị gián đoạn do quota công cụ, chưa được coi UI PASS tại thời điểm đó. Khi tiếp tục, PostgreSQL và API/Vite QA đã dừng. PostgreSQL được đưa lại đúng cổng local 55451; API/Vite khởi động lại với DB test cũ, **không reseed/migrate lại**. Lần khởi động PostgreSQL đầu dùng nhầm cổng mặc định đã được sửa trước khi kiểm thử. [Runtime ban đầu](live-ready-original.json), [runtime sau tiếp tục](live-ready.json).

## 2. Kết quả thực thi

| Bộ kiểm tra | Kết quả mới chạy | Bằng chứng |
|---|---|---|
| Backend build | PASS | [log](backend-build.log) |
| Suite API bước 7 nguyên bản | 19 nhóm PASS, gồm 18 nhóm bước 7 và 1 nhóm producer prelude | [kết quả](api/generated/step7-results.json), [log](api/console.log) |
| Producer bước 5 trong prelude | 28 check PASS; tên nhóm ngoài vẫn ghi “27”, số thực tế lấy từ kết quả con | [kết quả](api/generated/step5-results.json) |
| Upgrade/rollback | 4 nhóm PASS trên baseline lịch sử 7 migration; không tuyên bố đó là toàn bộ chuỗi hiện tại | [log](upgrade/console.log), [summary](upgrade-summary.json) |
| UI workflow, Playwright local + Edge | 10 PASS / 0 FAIL, gồm 1 check điều khiển browser | [checkpoints](workflow-checkpoints.json) |
| Scope/boundaries, Playwright local + Edge | 11 PASS / 0 FAIL, gồm 1 check điều khiển browser | [checkpoints](scope-boundaries-checkpoints.json) |
| Reopen/chốt lại, Playwright local + Edge | 5 PASS / 4 FAIL, gồm 1 check điều khiển browser; 4 FAIL thuộc 3 lỗi API riêng biệt | [checkpoints](lifecycle-checkpoints.json) |
| Bổ sung phase/receipt/legacy/mobile/SPA | 7 PASS / 0 FAIL, gồm 1 check điều khiển browser | [checkpoints](supplemental-checkpoints.json) |
| MCP | Đăng nhập, đọc hồ sơ và tải PDF thật thành công | [verification](mcp-verification.json) |
| Render PDF trong Edge | Bản SV 1 trang, bản MCP 1 trang, stress 16 trang: A4, bounds, Unicode, ô ký đạt | [inspection](pdf-inspection.json), [visual review](visual-review.json) |

Không cộng các đơn vị này thành một tỷ lệ PASS chung: nhóm API, checkpoint UI và nhóm ca trong kế hoạch có phạm vi chồng nhau. 4 suite Edge có tổng 33 checkpoint PASS/4 FAIL, trong đó 4 PASS là kiểm tra browser lặp lại. Sai lệch mẫu biểu được phát hiện qua đối chiếu trực quan, không nằm trong 4 FAIL assertion lifecycle.

Luồng chính đã thực thi: duyệt đúng version → Khoa chốt bằng UI → SV tải PDF bằng UI/MCP → ghi nhận nhận bản giấy bằng UI → reopen → SV tạo/nộp v2 → duyệt riêng v2 → chốt lại. Chốt không tự sinh PDF/receipt/plan; tải PDF không đồng nghĩa ký hoặc nộp giấy; bản mới không tự nhận biên nhận/PDF của bản cũ.

## 3. Lỗi xác nhận

### S7-01 — High — Khoa không reopen được khi phase sửa bị khóa

**Expected:** contract §3.2 quy định reopen của Khoa là ngoại lệ phase khi đợt chưa kết thúc; sau reopen SV vẫn phải chịu phase edit. Đây là lỗi tích hợp bước 6 → 7.

**Tái hiện:** dùng Khoa có grant đúng, proposal APPROVED, dossier RECEIVED và plan ACTIVE; giữ term IN_PROGRESS; khóa riêng PROPOSAL_EDIT; gửi `POST /proposals/p-student/reopen` với reason và revision/version hiện hành.

**Actual:** `409 TERM_003`, “Phase chỉnh sửa chưa mở, đã khóa hoặc hết hạn.” Expected `200`. Mở lại phase edit rồi gửi lại hợp lệ thì thành công: Proposal DRAFT, dossier REOPENED, current pointer null, plan PAUSED. Không mất receipt/SEALED version/approval/PDF cũ.

**Định vị:** `backend/src/topic/proposal-versions/proposal-lifecycle.service.ts`, các lệnh `validator.phase(...)` trong command/context vẫn áp phase sửa lên reopen. Cần sửa guard riêng cho reopen và bổ sung regression chứng minh SV không được sửa khi phase còn khóa.

**Bằng chứng:** [request/response](reopen-phase-observation.json), [checkpoints](lifecycle-checkpoints.json), [ảnh sau reopen hợp lệ](T37-reopened-history.png).

### S7-02 — High — Không tải được PDF bản chốt đã thay thế

**Expected:** contract §4.4 và §6 cho đọc bản chốt cũ theo quyền lịch sử, có nhãn đã thay thế; bỏ `finalizationId` mới mặc định dùng current.

**Tái hiện:** SV sở hữu đã tải PDF của bản chốt sequence 1; Khoa reopen. Gửi `GET /proposals/p-student/dossier.pdf?finalizationId=<id-sequence-1>` bằng chính SV đó. Sau đó chốt lại v2 và gửi lại cùng request bản cũ.

**Actual:** sau reopen nhận `409 DOSSIER_NOT_FINALIZED`; sau chốt lại nhận `409 STALE_FINALIZATION`. Expected `200` cho bản cũ trong scope. Bytes vẫn tồn tại và checksum đúng trong DB; lỗi nằm ở quyền truy xuất phiên bản, **không phải mất file**. PDF current v2 tải bình thường.

**Định vị:** `backend/src/topic/proposal-dossiers/dossier.service.ts`, `download()` gọi `current()`; hàm này chỉ chấp nhận current finalization và từ chối ID lịch sử. Cần resolver bản lịch sử có kiểm scope/integrity, giữ quy tắc current cho các command ghi.

**Bằng chứng:** [sau reopen](historical-PDF-after-reopen.json), [sau chốt lại](historical-PDF-after-refinalize.json), [checksum lưu trữ cuối lượt](final-integrity.json).

### S7-03 — Medium — Endpoint preview PDF watermark chưa tồn tại

**Expected:** API trong contract line 391: `GET /proposals/:id/preview.pdf?versionId=...`, trả PDF watermark cho version người gọi được đọc.

**Tái hiện:** SV sở hữu, version SEALED `v1-student` tồn tại và đã được đọc hợp lệ; gọi `/api/proposals/p-student/preview.pdf?versionId=v1-student`.

**Actual:** `404 NOT_FOUND`, “Cannot GET /api/proposals/p-student/preview.pdf?versionId=v1-student”. Đây là thiếu route theo contract. Trang HTML preview hồ sơ vẫn có; không đánh đồng hai tính năng. Chưa thể kiểm nội dung watermark vì endpoint không trả PDF.

**Bằng chứng:** [response thật](preview-availability.json), [checkpoints](lifecycle-checkpoints.json). Cần triển khai route theo contract và kiểm riêng visibility, watermark, cache/header, GET không ghi.

### S7-04 — Medium — Thiếu trường trên PDF so với mẫu gốc

**Expected:** mẫu trong `Project_1_06.docx` có điện thoại/email của SV và GVHD, cùng ô Khóa.

**Actual:** PDF sinh mới giữ các phần nội dung, lịch công việc và bốn ô ký, nhưng bỏ các trường liên hệ và ô Khóa riêng. Class có “K63” không thay thế một mapping Khóa được xác nhận. Kiểm trích text cũng không thấy các nhãn điện thoại/email/Khóa. Không phải lỗi font hoặc tràn trang.

**Tác động:** chưa thể nghiệm thu “theo mẫu” dù PDF render đạt kỹ thuật. Cần xác nhận mapping nguồn chính thức cho các trường, đưa vào snapshot tại lúc chốt rồi render từ snapshot; không tự đoán dữ liệu hoặc lấy live profile thay cho bản đã chốt.

**Bằng chứng:** [mẫu gốc](source-template.png), [PDF thực tế](pdf-official-first.png), [PDF tải thật](student-official.pdf), [đối chiếu](visual-review.json).

## 4. Ma trận 45 nhóm ca

PASS áp dụng đúng phần đã nêu; PARTIAL nghĩa là nhóm còn nhánh chưa thực thi, không được tính đạt toàn nhóm. FAIL nghĩa là đã tái hiện lệch expected. Các ký hiệu bằng chứng:

- **A:** [API](api/generated/step7-results.json); **U:** [upgrade](upgrade/console.log).
- **W:** [workflow](workflow-checkpoints.json); **S:** [scope](scope-boundaries-checkpoints.json).
- **L:** [lifecycle](lifecycle-checkpoints.json); **X:** [bổ sung](supplemental-checkpoints.json).
- **P:** [PDF](pdf-inspection.json) và [visual](visual-review.json); **M:** [MCP](mcp-verification.json).
- **F:** [integrity cuối lượt](final-integrity.json).

| ID | Kết quả | Đã kiểm / phần chưa kiểm | Chứng cứ |
|---|---|---|---|
| T01 | PASS | Vite thật; mở login, toggle mật khẩu, đăng nhập, bấm tải PDF | M, W |
| T02 | PASS | Anonymous UI về login; 3 GET trả 401, không lộ nội dung | S |
| T03 | PARTIAL | Phân trang 20+3 không trùng, APPROVED empty/recovery, search Unicode; chưa kiểm search mã riêng | W |
| T04 | PASS | Owner/GVHD hiện hành đọc/export, không có finalize/receive | W, A |
| T05 | PARTIAL | Reviewer, ADMIN, outsider/unprivileged bị chặn; chưa đăng nhập actor COMMITTEE riêng | S, A |
| T06 | PASS | Khoa khác scope/term, SV khác, foreign IDs bị chặn | S, A |
| T07 | PARTIAL | GET dossier/readiness không ghi; preview PDF chưa kiểm được do S7-03 | W, X, L |
| T08 | PARTIAL | APPROVED thiếu class/major bị chặn, không tự điền; chưa fault-inject từng lỗi ownership/assignment riêng ở command finalize | W, A |
| T09 | PARTIAL | Proposal chưa approved bị chặn; chưa chạy riêng đủ ba trạng thái SUBMITTED/UNDER_REVIEW/REVISION_REQUESTED tại finalize | A |
| T10 | PASS | Chốt đúng approval/version SEALED/hash; content legacy thiếu schedule bị chặn | A, W |
| T11 | PASS | Working/submitted pointer stale, revision và version khác proposal bị chặn | A |
| T12 | PASS | Đổi routing revision sau approval không chốt bằng evidence cũ | A |
| T13 | PASS | Missing/locked/future/expired review phase; COMPLETED/CANCELLED/DEFENDING chặn finalize và receipt | X |
| T14 | PASS | Strict DTO, actor/status/time giả, 2001 ký tự, key/query sai, malformed JSON 400, body lớn 413 | S |
| T15 | PASS | UI Khoa chốt snapshot đúng, actor/time/template/hash do server | W |
| T16 | PASS | Finalize không sinh PDF/receipt/plan, không tự đánh dấu chữ ký | W, A |
| T17 | PASS | Concurrent finalize chỉ một commit/pointer/sequence | A |
| T18 | PASS | Replay cùng key, payload khác 409; revoke grant chặn replay | A, S |
| T19 | PARTIAL | Audit fault làm rollback dossier/finalization; chưa assert độc lập toàn bộ history/key/revision trong fault này | A |
| T20 | PARTIAL | DB chặn sửa snapshot, SEALED content, receipt; giữ nguyên bytes cũ qua lifecycle; chưa thử UPDATE/DELETE bytes bằng SQL riêng | A, L, F |
| T21 | PARTIAL | Owner/advisor/Khoa export đúng scope; chưa chạy riêng lỗi tải trước generate | A, W, S |
| T22 | PASS | UI/MCP tải file thật, `%PDF-`, checksum/bytes/header khớp DB | M, W, S |
| T23 | PASS | Download giữ FINALIZED/receipt null; UI phân biệt duyệt, chốt, PDF, bản giấy | M, W |
| T24 | PASS | Unicode, A4, nội dung/profile đã snapshot, footer/bounds và 4 ô ký đạt kỹ thuật; completeness mẫu biểu ở T25 | A, P |
| T25 | FAIL | Mẫu DOCX có trường liên hệ/Khóa mà PDF bỏ — S7-04 | P |
| T26 | PASS | PDF stress 16 trang, 35 dòng, header lặp, giữ dòng cuối và ô ký | A, P |
| T27 | PARTIAL | Generate replay không thêm asset, payload khác 409; chưa chạy race hai lần generate đầu tiên | S |
| T28 | PASS | Đổi live catalog/profile không đổi frozen snapshot/PDF; restore fixture | A, S |
| T29 | PASS | IDOR, foreign IDs, query/path giả bị chặn; private/no-store, attachment, nosniff | A, S |
| T30 | PASS | Corrupt size/checksum/kind/state bị chặn 409, không trả PDF; restore rồi tải lại 200 | S |
| T31 | PASS | Phase khóa chặn ghi receipt/finalize, vẫn tải current PDF được phép | W, A, X |
| T32 | PASS | UI note Unicode 2000; note bỏ trống qua API thành null; actor/time server | W, X |
| T33 | PASS | Hai receipt key khác đồng thời: 201+409, chỉ 1 receipt/history/audit; replay không nhân bản | X, A |
| T34 | PASS | Chưa finalized, finalization khác, stale revision, actor/time giả bị chặn | X, S |
| T35 | PARTIAL | Receipt lỗi phase giữ note 2000 và reload chủ động; chưa chạy đủ UI stale finalize/PDF/receipt | W |
| T36 | PASS | Grant bị thu hồi chặn replay/download; LOCKED account chặn token cũ; GVHD đổi quan hệ mất scope cũ | S, X |
| T37 | FAIL | Reopen khi phase edit khóa bị chặn trái contract — S7-01; phase mở thì bảo toàn chứng cứ, pause plan đạt | L |
| T38 | FAIL | Hai thời điểm tải bản chốt cũ đều 409 — S7-02; file DB không mất | L, F |
| T39 | PASS | v2 chốt sequence 2, không chuyển receipt/PDF cũ; PDF mới khác checksum, plan vẫn PAUSED | L, F |
| T40 | FAIL | Route preview watermark trả 404 — S7-03; chưa đánh giá watermark bytes | L |
| T41 | PASS | Mobile390 list/detail/form/history không overflow; Tab focus; 3 Axe scan 0 violations/0 incomplete | W, S, X |
| T42 | PARTIAL | Loading bằng latency thật, empty/404 recovery, SPA không reload và note không lẫn; chưa instrument key/reset mọi mutation qua SPA | W, S, X |
| T43 | PARTIAL | Legacy thiếu workflow giữ state null/DOSSIER_LOCKED, GET không backfill; incomplete content bị chặn; chưa fixture riêng finalization có printSnapshot null | X, A, U |
| T44 | PASS | Main100 bảng hash khớp; core producer hash khớp; downstream ngoài dự kiến bằng 0 | F, live-database-snapshot.json, main-after.json |
| T45 | PARTIAL | Có screenshot/download/log và dừng QA services; MCP logout đạt nhưng đóng tab MCP bị treo, chưa xác nhận đóng hết | M, cleanup.json |

Tổng ma trận: **28 PASS, 13 PARTIAL, 4 FAIL**. Các nhánh chưa chạy nằm ngay trong hàng tương ứng, không ngầm tính PASS từ đọc code hoặc báo cáo cũ.

## 5. Console, network, PDF và giới hạn

[Phân loại console/network](console-network-classification.json): tổng 105 console error trong bốn suite Edge (15/70/14/6), **0 uncaught page error, 0 requestfailed**. Console error HTTP không đồng nghĩa transport failure. Các request bằng `context.request` được assert/ghi checkpoint, không được coi là toàn bộ sự kiện của page listener.

- 403/404 ở ca scope/anonymous và 409 khi khóa phase là kết quả âm có chủ đích.
- **O7-01 — quan sát tích hợp cần triage:** shell còn tự gọi assignment/registration/catalog ngoài quyền hoặc sai đầu vào; có 400 `/assignments/term/.../results` và 403 trên plan/me/danh mục. Đây không phải tất cả đều là negative test có chủ đích. Chưa xác định root cause hay quy lỗi cho module dossier; cần xử lý riêng để có console sạch trong luồng được phép.
- React Router có future-flag warning, không phải crash. MCP trong luồng riêng có 0 console error/1 warning: [console](mcp-console.log), [network](mcp-network.log).
- Một cleanup của suite workflow gặp protocol error khi set viewport cho trang Downloads của Edge. Browser local vẫn được đóng ở cuối suite; các suite còn lại không có logout error. MCP đã logout về login thành công; lệnh đóng tab Downloads MCP bị treo và cell điều phối bị kết thúc, nên không xác nhận đóng hết tab MCP. Không kill browser/process người dùng.

PDF được render thật bằng PDF.js trong Edge từ các file tải xuống; viewer chỉ phục vụ artifact local, không thay response ứng dụng. Lần đầu harness sai escape JS; lần sau PDF.js streaming chủ động abort 3 fetch dù render đủ. Hai dấu vết được giữ tại [debug](pdf-render-debug-events.json) và [attempt 2](pdf-render-attempt-2.json). Sửa **harness viewer** để fetch đầy đủ ArrayBuffer trước khi render: lần cuối 0 page error/0 requestfailed, 3 file đều render đạt. Không sửa PDF hay ứng dụng để làm PASS. Đối chiếu thủ công trang đầu/trang cuối; không tuyên bố đã soi bằng mắt mọi trang giữa.

Ảnh chính: [login MCP](mcp-login.png), [chốt chưa nhận giấy](T15-finalized-no-paper.png), [tải chưa nhận giấy](T22-student-downloaded-no-paper.png), [receipt lỗi giữ note](T35-receipt-phase-error-note-kept.png), [đã nhận giấy](T32-received-paper.png), [reopen](T37-reopened-history.png), [v2 chưa nhận giấy](T39-refinalized-new-version.png), [mobile form/history](T41-mobile-form-history.png).

Chưa thực hiện in vật lý, ký của con người, nộp giấy thật hoặc nghiệm thu mẫu biểu bởi Khoa. Không kiểm SMTP. Axe chỉ phản ánh các trang/trạng thái đã quét, không chứng nhận toàn bộ khả năng tiếp cận của hệ thống.

## 6. Dữ liệu cuối lượt và cleanup

[Integrity cuối lượt](final-integrity.json): 24 proposal, 25 version, 3 finalization, 3 PDF lưu trữ đều đúng size/checksum, 2 receipt, 2 guidance plan. Có 3 ThesisDossier nhưng chỉ 2 workflow; dossier thứ ba là fixture legacy cố ý thiếu metadata, không bị tự convert.

- `p-student`: APPROVED v2, current sequence2 FINALIZED, có PDF mới, chưa có receipt mới; sequence1 superseded vẫn giữ PDF/receipt cũ; plan PAUSED.
- `p-student2`: sau chứng minh MCP tải mà chưa nhận giấy, ca concurrency bổ sung đã ghi đúng một receipt; trạng thái cuối RECEIVED, plan ACTIVE.
- `p-page-01`: approved nhưng thiếu profile, không có finalization; dùng kiểm guard, không tự bổ sung dữ liệu.
- `p-page-02`: giữ fixture legacy để tái hiện GET không backfill.
- Task, progressReview, finalResult đều 0. Hai plan được tạo có chủ đích để chứng minh không bắt chờ giấy và reopen pause plan; không phải tự sinh bởi download/finalize.

[Snapshot producer](live-database-snapshot.json) có `coreUnchanged: true`; snapshot/hash DB hiện tại dùng transaction READ ONLY. [Cleanup](cleanup.json), [server stopped](resumed-stopped.json): API/Vite QA không còn truy cập được; giữ DB test để tái hiện, PostgreSQL local được để chạy. Tình trạng tab MCP còn chưa xác nhận như phần 5.

[Git status cuối lượt](git-status-final.txt), [415 fingerprint source cuối lượt](source-hashes-final.json). Không có baseline hash source đầu bước 7 để đối chiếu cơ học; không tuyên bố git clean hay quy các thay đổi có sẵn thành thay đổi QA. Các file được sửa/tạo trong lượt này nằm ở bằng chứng/harness.

Ưu tiên khắc phục S7-01/S7-02, sau đó S7-03/S7-04; chạy regression các nhánh PARTIAL trước khi nghiệm thu. Báo cáo này là kết quả QA, **chưa sửa bốn lỗi ứng dụng**.
