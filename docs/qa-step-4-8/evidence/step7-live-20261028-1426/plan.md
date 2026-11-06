# STEP7 — Kế hoạch trước thực thi

28/10/2026, Asia/Ho_Chi_Minh. Chỉ QA, không sửa code/config/dependency/migration ứng dụng. Quyền ghi đã cấp từ các lượt trước áp dụng trên DB test local mới, dữ liệu tổng hợp; DB hiện tại chỉ đọc hash trước–sau. Không mock response; không suy PASS từ báo cáo cũ. Kết quả sau chạy phải chỉ rõ MCP hoặc Playwright local/Edge và từng phần NOT RUN.

Nguồn expected: dac-ta-use-case.md bước 7, Project_1_06.docx (ảnh mẫu gốc), business contract D07/D08/D13 và state/API tables; shared proposal-dossiers; implementation report chỉ là đầu mối kiểm lại. Reopen mới ở bước 6 được dùng để kiểm vòng đời bản chốt, không coi gap cũ còn đúng mà chưa chạy.

| ID | Kịch bản / expected |
|---|---|
| T01 | Vite thực, browser mở và click thành công; ảnh login, console/network |
| T02 | Anonymous list/detail/PDF redirect hoặc 401, không lộ nội dung |
| T03 | Khoa list, filter APPROVED, search Unicode/mã, phân trang và empty recovery |
| T04 | Owner/current advisor đọc đúng scope; không finalize/receive |
| T05 | Reviewer thuần/ADMIN/COMMITTEE/outsider không bypass academic scope |
| T06 | Khoa khác grant/term/department; SV khác và ID tampering bị chặn |
| T07 | GET dossier/preview không tạo dossier/finalization/receipt/asset |
| T08 | APPROVED là ứng viên; thiếu lớp/ngành/ownership/assignment fail closed |
| T09 | SUBMITTED/UNDER_REVIEW/REVISION_REQUESTED không được chốt |
| T10 | Approval đúng submitted SEALED version/hash/content đủ trường |
| T11 | Stale working/version/revision, version khác hồ sơ bị chặn |
| T12 | Routing đổi sau approval không chốt bằng evidence cũ |
| T13 | Review phase missing/locked/future/expired, term kết thúc chặn ghi |
| T14 | Strict DTO/unknown actor/status/time/key/JSON/query, bounded note |
| T15 | UI Khoa chốt snapshot chính xác, actor/time/template/hash server |
| T16 | Finalize không tạo PDF/receipt/chữ ký hoặc tự tạo plan |
| T17 | Hai finalize đồng thời: một commit, không duplicate sequence/pointer |
| T18 | Same-key replay một lần, payload khác 409; quyền trước replay |
| T19 | Audit fault rollback dossier/pointer/revision/history/idempotency |
| T20 | Snapshot/SEALED/receipt/PDF bytes append-only qua DB trigger |
| T21 | SV/GVHD/Khoa tải PDF qua auth; chưa generate thì lỗi rõ |
| T22 | UI SV generate/download thật, bytes PDF/hash/headers đúng |
| T23 | PDF không tự ghi nhận ký/nộp giấy; bốn mốc UI độc lập |
| T24 | PDF Unicode/A4/đủ nội dung/profile/4 ô ký/footer/bounds |
| T25 | Đối chiếu trực quan mẫu DOCX và PDF sinh mới; không suy digital signature |
| T26 | Long content/schedule paginate/header lặp, không mất dòng cuối/ô ký |
| T27 | Generate concurrent/idempotent không thêm asset trùng; stale revision 409 |
| T28 | Thay live catalog/profile sau chốt không đổi snapshot/bytes |
| T29 | Download IDOR/foreign finalization/path/query/unauthorized, private cache headers |
| T30 | Corrupt asset/checksum/size/state/kind từ fixture chặn file không hợp lệ |
| T31 | Phase khóa chặn receipt/finalize, vẫn đọc/tải bản chốt được phép |
| T32 | UI receipt note optional/Unicode/2000, server actor/time; receive khác finalize |
| T33 | Duplicate/concurrent receipt: một bản immutable; replay không nhân audit |
| T34 | Receipt chưa finalized/sai finalization/stale rev/actor giả bị chặn |
| T35 | UI stale finalize/PDF/receipt giữ note, báo lỗi và reload chủ động |
| T36 | Revoke account/grant/current advisor trước đọc/replay/download, không cached leak |
| T37 | Reopen: DRAFT+REOPENED, giữ finalization/receipt/asset/history, plan PAUSED |
| T38 | Đọc/tải historical finalization theo contract, nhãn đã thay thế; không nhầm current |
| T39 | Chốt lại version mới, sequence mới, không chuyển receipt/PDF cũ sang bản mới |
| T40 | Preview PDF watermark endpoint theo contract: kiểm availability thực, không giả PASS |
| T41 | Mobile390 list/preview/form/history; keyboard/focus; Axe và incomplete thật |
| T42 | Loading mạng thật/empty/404/recovery, SPA đổi hồ sơ không lẫn note/state/key |
| T43 | Legacy thiếu snapshot/meta/approval không tự convert/backfill |
| T44 | DB main hash trước/sau; test producer core; downstream ngoài dự kiến không phát sinh |
| T45 | Console HTTP/transport/page errors được phân loại, screenshot/download, cleanup đúng QA |

Các ca ghi giấy/chữ ký chỉ là mô phỏng trên fixture test; không phải bằng chứng Khoa đã nhận hồ sơ thật. SMTP, máy in vật lý và chữ ký con người không thực hiện. Visual QA kỹ thuật không thay nghiệm thu chính thức mẫu biểu bởi Khoa.
