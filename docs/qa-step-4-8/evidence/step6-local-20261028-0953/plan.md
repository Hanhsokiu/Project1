# STEP6 — Kế hoạch trước thực thi

Ngày 28/10/2026, Asia/Ho_Chi_Minh. Nguồn S1: docs/spec/dac-ta-use-case.md, bước 6; S2: docs/implementation/01-business-decisions-and-contract.md, D02/D06/D07/D13/D14, §3.2–3.4/§4.1–4.2/§5; S3: docs/implementation/06-step6-implementation-report.md. Kết quả QA/triển khai cũ chỉ là đầu mối cần tái kiểm tra, không là bằng chứng PASS mới.

Phạm vi: chỉnh sửa, snapshot, phản hồi góp ý, compare, nộp/nộp lại và tích hợp vòng duyệt mới. Dossier/PDF/guidance thuộc bước sau, chỉ kiểm không phát sinh ngoài ý muốn. Không sửa code/config/dependency/migration ứng dụng; không mock API/response. Các thao tác ghi chỉ trên DB test loopback mới, dữ liệu tổng hợp, theo quyền user đã cấp: “Cho phép ghi trên database test local mới; giữ nguyên dữ liệu hiện tại”. Hash toàn DB UI trước/sau bằng READ ONLY. Các file evidence/harness mới được phép tạo.

Playwright MCP không được cung cấp trong phiên; chạy Playwright local + Microsoft Edge thật. Chỉ kết luận browser điều khiển được sau khi mở trang và click thành công. PASS cần quan sát/assertion đã chạy; FAIL là trái expected; BLOCKED/NOT RUN giữ đúng lý do, không tính thành PASS. API suite gốc chạy mới trên DB riêng; không cộng lặp producer STEP5 vào số case STEP6.

| ID | Vai trò/thao tác | Expected / nguồn |
|---|---|---|
| T01 | Anonymous mở login và toggle password | Browser thật, input type đổi/khôi phục |
| T02 | Anonymous URL list/editor/historical + 4 GET | Login, 401, không academic data; S2 D13 |
| T03 | FACULTY list đợt, tìm tên/mã/empty, sidebar | Đúng scope/term, không edit/submit; S2 D02/D13 |
| T04 | FACULTY editor list >20, đổi trang/filter/term | Stable page IDs/count/reset; không lẫn hồ sơ |
| T05 | Owner context sau REVISION_REQUIRED | Đúng source version/comment/decision/actor/time/phase; S2 D06 |
| T06 | Owner gõ rồi rời/reload, không lưu | Không autosave server, version/revision không đổi; S2 D07 |
| T07 | Owner save sửa từ REVISION_REQUESTED | DRAFT v2 mới, base v1; v1+review/decision nguyên vẹn |
| T08 | Response COMMENT và DECISION | Metadata đúng target, source feedback không bị ghi đè |
| T09 | Save kế tiếp omit responses / gửi [] | Kế thừa khi omit; [] xóa ở bản mới, bản cũ giữ nguyên |
| T10 | Lưu draft thiếu field, submit | Save được, submit 400; không seal dở |
| T11 | Draft có thay đổi chưa lưu, bấm submit | Nút disabled/chặn; không POST submit |
| T12 | Submit current saved version bởi owner | Seal chính snapshot, SUBMITTED/RESUBMISSION; không tạo version mới |
| T13 | Submit lại cùng key / khác payload | Replay một lần; khác payload 409, không duplicate audit/outbox |
| T14 | Reviewer sau resubmit trước phân vòng mới | Chỉ v1 đã phân, không đọc v2/draft/compare trái scope |
| T15 | Khoa phân vòng mới cho submitted version | Vòng mới trỏ v2; v1 và lịch sử cũ giữ nguyên; không auto-assign |
| T16 | GVHD chính thức hiện hành edit | Append snapshot đúng actor; không submit hộ SV |
| T17 | SV khác / đợt khác / giảng viên outsider | UI và API không lộ context/version/content; 403/404 |
| T18 | FACULTY ngoài grant / thiếu action | 403/404 đúng; không sửa thay |
| T19 | ADMIN / COMMITTEE dù có permission | Không bypass quan hệ/role học thuật |
| T20 | Reviewer read history/detail/compare | Chỉ SEALED đã phân, không draft hoặc hồ sơ khác |
| T21 | Handover/revocation rồi replay | Kiểm quyền hiện hành trước cache; actor lịch sử giữ nguyên |
| T22 | SV/GVHD đồng thời save cùng revision | Một commit, một 409; không lost update hoặc trùng version |
| T23 | UI giữ stale draft sau actor khác save | 409, giữ input, reload chủ động; không auto overwrite |
| T24 | BasedOnVersionId cũ nhưng revision mới | STALE_VERSION, không ghi snapshot |
| T25 | UI lịch sử readonly + provenance | Nội dung/hash/actor/time/base đúng; không có controls ghi |
| T26 | Compare 2 version có thay đổi | Path/before/after/existence đúng cả content và responses |
| T27 | Compare bản giống nhau/key-order/null/added/removed | Diff đúng dữ liệu thực; không tự semantic merge |
| T28 | History >20 + compare phiên bản trang khác | Số giảm dần, trang ổn định, option tích lũy đúng quyền |
| T29 | Phase EDIT missing/locked/future/expired | Save/submit bị chặn, không tự đổi phase/status |
| T30 | Term không cho phép / phase bị đóng khi đợi lock | 409; transaction rollback |
| T31 | Official assignment PUBLISHED / stale agreement/routing | Không cấp quyền/không submit khi producer chưa sẵn sàng |
| T32 | SUBMITTED/UNDER_REVIEW/APPROVED/dossier locked | Readonly; save không bypass hoặc tự reopen |
| T33 | DTO unknown/actor/status injection, sai type/revision/key | 400, không ghi dở hoặc lộ stack |
| T34 | Page/limit/compare query invalid / ID khác proposal | 400/404, không leak |
| T35 | Duplicate/cross-proposal/nonexistent feedback target | 400 FEEDBACK_SCOPE_INVALID/COMMON_003; không giả target |
| T36 | Content limits field=20000/>20000, schedule 100/>100 | Đúng shared contract, không đổi cap âm thầm |
| T37 | Dates không timezone, start>=end, mốc ngoài khoảng | Draft/schema hoặc submit chặn đúng; không tự sửa ngày |
| T38 | UI save nội dung hợp lệ >100KiB UTF8 | Save thật thành công, byte/hash/content đúng; tái kiểm QA-001 |
| T39 | Payload vượt parser cap / route submit cap | 413 envelope, không 500, không đổi pointer/counter |
| T40 | API audit failure, trigger immutable snapshots | Rollback atomic; không UPDATE/DELETE payload cũ |
| T41 | Author/time/summary/hash của version | Server ghi actor/time, canonical content hash đúng |
| T42 | No partial save/submit on rejected probes | Snapshot/pointer/counter/revision/audit/outbox không đổi |
| T43 | Notification/outbox khi submit | Đúng advisor/owner/version, một event/submit; không suy email đã gửi |
| T44 | Mobile390 list/editor/history/compare | Không tràn trang, đọc/nhập/điều hướng được |
| T45 | Keyboard labels/menu/Escape/focus và Axe | Ghi violations/incomplete thật, không chứng nhận WCAG toàn app |
| T46 | Loading/empty/404 và recovery | Không trắng trang/success giả; phục hồi qua thao tác thật |
| T47 | Đổi proposal qua SPA và quay lại | Không lẫn draft/response/revision/version/compare IDs |
| T48 | Legacy malformed content/metadata | Read-only hoặc fail closed có thông báo; không tự convert/backfill |
| T49 | Chứng cứ DB trước/sau và GET-only snapshot | Producer/core/bản SEALED cũ không đổi ngoài thao tác đã định; main DB giữ nguyên |
| T50 | Console/network/screenshot/cleanup | Ghi pageerror, console, HTTP/transport riêng; tắt đúng API/Vite test, giữ DB |

Giới hạn dự kiến: không gửi email thật/không chạm DB chia sẻ; unit boundary không thay cho E2E real-clock tại mili-giây. Withdraw/return-to-draft/reopen trong contract sẽ đối chiếu availability, không ghi là PASS nếu không được triển khai.

Ghi nhận khi tiếp tục: Playwright MCP được cung cấp trở lại và đã mở/click thật tại Vite 50185; bằng chứng ghi riêng, không đổi phương pháp các ca đã chạy local Edge. Kết quả và giới hạn sau thực thi ở [report.md](report.md).
