# STEP6 — Kiểm thử thực tế chỉnh sửa đề cương và quản lý phiên bản

Ngày thực thi: 28/10/2026, Asia/Ho_Chi_Minh. Đây là kết quả chạy mới, không kế thừa PASS từ báo cáo cũ. Phạm vi đúng của bước 6 là SV/GVHD chỉnh sửa, phản hồi góp ý, lưu snapshot, xem/so sánh lịch sử và nộp lại. Chốt hồ sơ/PDF thuộc bước 7.

**Kết luận: các luồng đã triển khai trong phạm vi trên đạt kiểm tra; chưa chấp thuận bước 6 hoàn chỉnh theo business contract.** Ba lệnh vòng đời bắt buộc trong contract chưa được triển khai: SV rút bài, Khoa trả nháp khi đang duyệt, Khoa mở lại bản đã duyệt. SMTP/email thực tế chưa chạy. Việc toàn bộ DB hiện tại không thay đổi cũng không được kết luận: 97/100 bảng khớp hash; ba bảng xác thực có thay đổi phù hợp một lần đăng nhập trong khoảng đo.

Không sửa code/config/dependency/migration ứng dụng trong đợt QA này. Chỉ thêm evidence và harness trong thư mục báo cáo. Các thay đổi ứng dụng đã có sẵn trong working tree được giữ nguyên; [git status cuối](final-git-status.txt) không phải danh sách thay đổi do đợt QA tạo ra.

## Môi trường, quyền ghi và cách thực thi

- Theo quyền người dùng đã cấp: chỉ ghi trên **DB test local mới**, giữ nguyên dữ liệu nghiệp vụ hiện tại; đăng nhập local được phép ghi phiên/audit xác thực.
- DB browser: `btl_pr2b_step6_1793155911083_8ed178_live`; API suite dùng DB test riêng khác, xem [api-target.json](api-target.json). Có kiểm tra loopback, tên DB và `current_database()` trước khi thao tác. Không DROP/reset DB.
- PostgreSQL **17.11**, Nest thực, Vite thực, không mock API/response. Dữ liệu tổng hợp; đầu vào bước 1–4 được fixture hóa, không khẳng định đã kiểm lại toàn bộ bước 1–4 bằng UI. Việc duyệt yêu cầu sửa và duyệt lại chạy qua HTTP thực bằng phiên đăng nhập lấy từ UI.
- Vite cung cấp **http://127.0.0.1:50185/**, không dùng địa chỉ 5173 từ báo cáo bước 4. API ban đầu `127.0.0.1:53019`; sau phục hồi là `127.0.0.1:58628`. [Thông tin môi trường](live-ready.json), [Vite log](resumed-vite.log).
- Trước gián đoạn: Playwright local + Microsoft Edge thật thực hiện các ca nghiệp vụ. Sau khi tiếp tục: DB vẫn có đủ 53 phiên bản; khởi động lại đúng DB, **không seed/migration**. Sandbox chặn `esbuild` bằng `spawn EPERM`; launcher QA chạy lại với quyền cần thiết và thành công.
- **Playwright MCP đã hoạt động thực tế:** mở trang `/login`, click hiện/ẩn mật khẩu và kiểm `type=text → password`, chụp [screenshot](mcp-login.png). Mở URL bước 6 khi anonymous dẫn về login. [Snapshot](mcp-anonymous-step6.yml), [bằng chứng MCP](mcp-verification.json).
- Lần MCP đầu trả `ERR_CONNECTION_REFUSED` vì API/Vite cũ đã dừng. Chỉ kết luận hoạt động sau khi mở trang và click thành công. MCP không thực hiện ca sau đăng nhập: môi trường VM không hỗ trợ import file credential. Các ca sau đăng nhập bên dưới chạy bằng **Playwright local + Edge**, không gắn nhãn MCP.

Nguồn expected: [use case](../../../spec/dac-ta-use-case.md), [business contract](../../../implementation/01-business-decisions-and-contract.md) D02/D06/D07/D13/D14 và §3–5, [triển khai bước 6](../../../implementation/06-step6-implementation-report.md), shared contracts và API hiện hành. [Kế hoạch trước chạy](plan.md).

## Kết quả có bằng chứng

**API gốc: 24 nhóm assertion PASS**, gồm **23 nhóm riêng bước 6 và 1 nhóm producer prelude bước 5**. Prelude thực tế có 28 checks PASS trong file riêng; tên testcase cũ còn ghi “27”, không sử dụng nhãn cũ để đếm. Không cộng producer vào số ca bước 6. Chạy migration trên DB test mới; giữ nguyên assertion gốc. [Kết quả bước 6](api/generated/step6-results.json), [producer](api/generated/step5-results.json), [exit code](api-suite-summary.json).

Các luồng thực tế đáng chú ý:

- Khoa phân nhóm, reviewer bắt đầu/nhận xét/kết luận `REVISION_REQUIRED` trên v1. SV lưu v2 mới với phản hồi COMMENT và DECISION; v1 và bằng chứng vòng duyệt cũ giữ nguyên. SV nộp **chính v2**, chuyển SEALED và `SUBMITTED/RESUBMISSION`; không sinh snapshot thừa, không tự phân nhóm. Khoa phân vòng 2 đúng v2. Sau đó kiểm thêm `UNDER_REVIEW → APPROVED`, cả hai đều chỉ đọc với SV.
- GVHD chính thức lưu bản mới đúng actor, không nộp thay SV. Hai actor lưu cùng revision: một `201`, một `409`. UI stale giữ input để người dùng tải lại chủ động. Base version cũ bị chặn dù dùng revision mới.
- Lưu nháp thiếu nội dung được phép; nộp bị `400`, không seal dở. Responses bỏ qua thì kế thừa, `[]` xóa ở bản mới; bản cũ không đổi. Lịch sử 29 phiên bản phân trang thật; compare chọn được hai bản ở hai trang khác nhau.
- **UI lưu và nộp thành công nội dung UTF-8 240.344 byte**, mỗi trường văn bản chính 20.000 ký tự. Hash/payload khớp. Đây là tái kiểm đạt lỗi lịch sử giới hạn 100 KiB, không phải sửa ứng dụng mới trong đợt này. [Screenshot lưu](T38-large-UTF8-saved.png), [metadata](boundary-stage.json).
- Vượt cap save 32 MiB hoặc cap submit 100 KiB đều `413 PAYLOAD_TOO_LARGE`, envelope hợp lệ `data:null`, không thay snapshot/pointer/counter/audit/outbox/idempotency. Các probe DTO, target giả/khác hồ sơ, ngày giờ, phase và term bị chặn đúng.
- Fixture legacy có JSON sai schema, thiếu workflow metadata: UI chỉ đọc, hiển thị bản gốc và cảnh báo, không backfill. Compare bỏ qua thứ tự key, phân biệt `null` và field vắng mặt, escape JSON pointer `/a~1b~0c`; chuỗi script hiển thị dạng text, không chạy. [Ảnh](T48-legacy-readonly.png), [diff](legacy-diff.json), [ghi fixture được khai báo](legacy-fixture.json).

### Ma trận 50 nhóm đã lập trước khi chạy

PASS trong bảng chỉ áp dụng expected và phương pháp ghi ở từng dòng. Không dùng bảng này để che ba contract gap bên dưới. `API` tham chiếu suite gốc nói trên; W=workflow, R=roles-ui, S=snapshots, B=boundaries, F=final-cases, C=rechecks. File `*-checkpoints.json` giữ chi tiết từng assertion.

| ID | Nội dung / bằng chứng | Kết quả |
|---|---|---|
| T01 | Mở login, click password toggle; MCP + Edge | PASS |
| T02 | Anonymous 3 URL UI và 4 GET; R, MCP snapshot | PASS |
| T03 | Khoa list/search tên/mã/Unicode/empty; R | PASS |
| T04 | 23 hồ sơ, 20/3, filter/term đúng scope; R | PASS |
| T05 | Context thật sau yêu cầu sửa, nguồn góp ý đúng v1; W | PASS |
| T06 | Gõ/rời/reload không autosave; W, C | PASS |
| T07 | Save v2 mới, giữ v1 và review evidence; W resumed | PASS |
| T08 | Phản hồi COMMENT/DECISION đúng target; W resumed | PASS |
| T09 | Omit kế thừa; [] xóa chỉ ở version mới; S | PASS |
| T10 | Draft thiếu field lưu được, submit bị chặn; S, API | PASS |
| T11 | Có thay đổi chưa lưu thì submit disabled; W resumed | PASS |
| T12 | Nộp đúng snapshot, SEALED, không version thừa; W, B | PASS |
| T13 | Replay cùng key không duplicate; khác payload 409; API, B | PASS |
| T14 | Reviewer không đọc draft hoặc bản mới chưa được phân; W | PASS |
| T15 | Vòng 2 trỏ v2; không tự phân sau submit; W resumed | PASS |
| T16 | GVHD lưu đúng actor, không nộp hộ; S, API | PASS |
| T17 | SV khác, outsider, khác term không lộ nội dung; R, API | PASS |
| T18 | Khoa ngoài grant/thiếu action bị chặn; R, API | PASS |
| T19 | ADMIN/COMMITTEE không bypass; R, API | PASS |
| T20 | Reviewer chỉ đọc SEALED đã phân; R, W, API | PASS |
| T21 | Handover/revoke kiểm quyền trước replay; API, B | PASS |
| T22 | Hai save đồng thời: 1 winner/1 conflict; S, API | PASS |
| T23 | UI stale giữ input, reload chủ động; S | PASS |
| T24 | Base cũ + revision mới vẫn STALE_VERSION; S | PASS |
| T25 | Historical readonly, metadata/provenance; W | PASS |
| T26 | Diff path/before/after/existence và responses; W, API | PASS |
| T27 | Key-order/null/added/removed/pointer escape; C, legacy-diff | PASS |
| T28 | History >20, compare qua trang, không trùng options; S, C | PASS |
| T29 | EDIT missing/future/expired/locked; API, B | PASS |
| T30 | Term CANCELLED và phase đóng trong lúc đợi lock; B, API | PASS |
| T31 | PUBLISHED assignment/stale agreement/handover; API | PASS |
| T32 | SUBMITTED/UNDER_REVIEW/APPROVED readonly; B, F; dossier lock qua API | PASS |
| T33 | Strict DTO/type/revision/key/malformed JSON; B, API | PASS |
| T34 | Query invalid, version khác proposal; B, API | PASS |
| T35 | Duplicate/cross-proposal/nonexistent feedback; B, API | PASS |
| T36 | Field 20.000/>20.000, schedule 100/>100; B; overlap hợp lệ qua shared submit schema | PASS |
| T37 | Timezone/start=end/mốc ngoài range/thiếu sản phẩm; B | PASS |
| T38 | UI save và submit UTF-8 240.344 byte; B | PASS |
| T39 | Hai parser cap, envelope 413, không ghi dở; F recheck | PASS |
| T40 | DB immutable trigger, rollback khi audit lỗi; API | PASS |
| T41 | Actor/time/hash/counter do server, không nhận giả DTO; W, B, integrity | PASS |
| T42 | Rejected requests không ghi dở; B, F, API | PASS |
| T43 | Đúng 2 audit/event/in-app notify cho advisor; integrity; email ngoài kết quả này | PASS |
| T44 | Mobile 390 list/editor/history/compare, không tràn viewport; R, S, C | PASS |
| T45 | Keyboard/menu/Escape/focus; Axe hai trang có 0 violation/incomplete; R, S | PASS |
| T46 | Loading với latency mạng thật 1.500 ms; empty/404/recovery; F, R | PASS |
| T47 | SPA qua hai hồ sơ, back, không lẫn draft/response/compare; C | PASS |
| T48 | Legacy readonly, không XSS/backfill, metadata null rõ ràng; C | PASS |
| T49 | Private core nguyên vẹn; main 97 bảng khớp, 3 bảng auth đổi | PARTIAL |
| T50 | Console/network/screenshot được thu; đóng browser/dừng riêng QA, giữ DB | PASS |

Các file chính: [workflow](workflow-checkpoints.json), [workflow tiếp tục](workflow-resumed-checkpoints.json), [roles/UI](roles-ui-checkpoints.json), [snapshots](snapshots-checkpoints.json), [boundaries](boundaries-checkpoints.json), [ca cuối](final-cases-checkpoints.json), [chạy lại](rechecks-checkpoints.json), [tổng hợp máy đọc](execution-overview.json).

## Contract gap cần xử lý

Ba mục dưới là **GAP đã xác nhận**, không phải feature PASS. Chưa sửa vì nhiệm vụ hiện tại là kiểm thử, không phải triển khai.

| ID / mức độ | Yêu cầu contract | Actual / ảnh hưởng |
|---|---|---|
| G6-01 / High | D06, bảng state và `POST /proposals/:id/withdraw`: owner rút SUBMITTED về DRAFT, supersede ASSIGNED, giữ SEALED cũ | Route không tồn tại, `404 Cannot POST`; SV không thực hiện được luồng rút để sửa |
| G6-02 / High | `POST /proposals/:id/return-to-draft`: Khoa trả UNDER_REVIEW về DRAFT, reason/audit, supersede active review | Route không tồn tại, `404 Cannot POST`; thiếu luồng Khoa trả nháp khi đang duyệt |
| G6-03 / High | `POST /proposals/:id/reopen`: Khoa mở APPROVED về DRAFT, reason/audit, phối hợp dossier/plan | Route không tồn tại, `404 Cannot POST`; bản APPROVED chỉ đọc nhưng thiếu luồng mở sửa hợp lệ |

[HTTP availability probes](contract-gaps.json) và rà controller xác nhận thiếu handler. Đây là kiểm tra availability, không giả là đã thực hiện trọn transition với đúng state. Khi triển khai cần kiểm lại đúng actor/quyền, state, CAS/idempotency, reason, rollback, supersede, bản SEALED và tích hợp pause/reopen; không chỉ thêm nút UI hoặc đổi status trực tiếp. Contract API tham chiếu các dòng 380–388 và bảng state 190–205 trong business contract.

## Console, network và giới hạn tích hợp

- Bảy phiên local ghi **0 pageerror, 0 requestfailed transport**. Có **115 console error** đi kèm **115 HTTP 4xx**, không gọi đây là “console sạch”. [Tổng hợp endpoint/status](execution-overview.json), raw `*-browser-log.json` và server traffic giữ đầy đủ.
- Các 4xx gồm scope/404 cố ý, stale-save `409`, và request shell tới assignment/registration/catalog. Riêng 44 request assignment results `400` liên quan fixture term `qa-t1/qa-t2` không phải UUID trong khi controller cũ dùng `ParseUUIDPipe`; assignment plan/registration/catalog có các `403` do permission/scope của actor test. Trang bước 6 vẫn tải từ API bước 6 và các assertion riêng đạt. Đây là giới hạn fixture/tích hợp shell, không suy thành môi trường production không có lỗi.
- Warning lặp là React Router future flag. MCP login có **0 console error**, 1 warning mỗi navigation; [console MCP cuối](mcp-console-final.log), [network MCP cuối](mcp-network-final.log). `ERR_CONNECTION_REFUSED` ban đầu được ghi riêng trong mcp-verification, không bị bỏ qua khi kết luận.
- Axe chỉ kiểm các trang/trạng thái đã chạy với tags WCAG 2 A/AA và 2.1 AA, không chứng nhận toàn ứng dụng. Mobile diff lớn dùng cuộn trong bảng; screenshot toàn trang siêu dài bị timeout ở harness nên bằng chứng chạy lại dùng [viewport](T44-large-compare-mobile-viewport.png).
- Worker email tắt. Hai event `PROPOSAL_VERSION_SUBMITTED` đang `PENDING`; in-app notification đã xác nhận. Không kết luận email được gửi/nhận, delivery/retry SMTP là **NOT RUN**.
- Race CAS/phase/audit fault chạy trên API thật và DB test; không thay bằng mock. Không kiểm ở đúng một mili-giây biên phase bằng đồng hồ E2E, không stress/load/đa trình duyệt, không triển khai các command còn thiếu.

## Kiểm soát dữ liệu và lỗi harness

DB test cuối có **55 versions: 26 SEALED, 27 DRAFT, 2 legacy thiếu metadata**; số phiên bản liên tục và `nextVersionNumber=max+1` trên mọi hồ sơ. Có 29 audit `VERSION_SAVED`, 2 audit `VERSION_SUBMITTED`, 2 outbox event duy nhất, 2 in-app notification đúng advisor/term/link. Không tạo dossier/finalization/guidance/task/progress/finalResult. [Integrity assertions](integrity.json), [snapshot DB test](live-database-snapshot.json).

Producer core hash trước/sau giống nhau; payload/hash/actor/time của source v1 được đối chiếu. Snapshot mới chỉ thêm theo các save đã thực hiện. Hai version legacy là fixture chủ động, ghi rõ trong legacy-fixture và không được tính nhầm thành save audit. Phase/term/permission bị thay tạm trong ca âm đã khôi phục đúng giá trị.

Đối với `btl_integration_ui`, mọi truy vấn kiểm chứng của harness chạy trong transaction **REPEATABLE READ READ ONLY**. [Trước](main-before.json) lúc 09:51:22; [sau](main-after.json) lúc chốt: **97 bảng khớp hash**, khác `AUDIT_LOG` 237→238, `LOGIN_SESSION` 126→127 và hash `USER_ACCOUNT` (10 rows giữ nguyên). [Delta đã loại token](main-auth-delta.json) ghi một `AUTH_LOGIN` lúc **13:39:18** cùng phiên đăng nhập và `lastLoginAt/updatedAt` tương ứng. Không có audit nghiệp vụ mới trong khoảng đo. Chưa có snapshot từng field user trước đó, nên không khẳng định toàn bộ fields user không đổi hoặc quy kết nguồn đăng nhập. Không khôi phục/xóa phiên hoặc audit này.

Raw harness giữ **5 lần FAIL kỹ thuật**, không xóa/đổi lịch sử để làm đẹp kết quả:

| Lần | Nguyên nhân | Kiểm lại |
|---|---|---|
| workflow-fatal | So sánh review view gồm status/revision hiện tại của aggregate, vốn thay đổi hợp lệ sau save | Tách evidence immutable của review; workflow-resumed đạt |
| T39 trong boundaries | Assertion chỉ nhận `undefined`, trong khi envelope parser hợp lệ `data:null` | F: hai cap `413`, snapshot/audit/outbox/key không đổi |
| T44 trong final-cases | Full-page screenshot diff rất dài vượt timeout 12 s; assertion width đã qua | C: viewport screenshot và width assertion đạt |
| T47 trong final-cases | Tìm link trước khi list tải xong, bấm nhầm trang | C: tìm theo mã rồi đợi link; SPA marker và server snapshot đạt |
| T27/T48 trong final-cases | Selector kỳ vọng sai câu “không có khác biệt” | C: đúng text UI, API diff/no-backfill/XSS assertions đạt |

Các lần chạy lại chỉ sửa QA harness/assertion, không chỉnh ứng dụng. `git diff --check` exit 0; có warning CRLF trên file đã có thay đổi từ trước, không coi là lỗi nghiệp vụ.

## Kết thúc

MCP page, các context Edge đã đóng. Chỉ API/Vite QA được dừng; kiểm tra cả frontend và API health không còn reachable. [Cleanup](cleanup.json). PostgreSQL tiếp tục chạy, cả DB test được giữ lại; không xóa/reset dữ liệu. Muốn tái chạy dùng DB test mới hoặc launcher phục hồi có guard, không tự chạy lại fixture trên DB hiện có.

Tiêu chí để chấp thuận bước 6 theo toàn contract còn lại: triển khai và kiểm thử G6-01/G6-02/G6-03; kiểm delivery nếu yêu cầu bao gồm email thực tế; chốt yêu cầu tích hợp shell trên fixture UUID hợp lệ. Các phần chưa chạy/thiếu không được chuyển thành PASS chỉ vì API suite hiện có xanh.
