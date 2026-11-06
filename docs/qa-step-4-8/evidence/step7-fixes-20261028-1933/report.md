# Hoàn thiện bước 7 — 28/10/2026

> Cập nhật tiếp: đã hoàn thiện xử lý lỗi Blob của PDF, kiểm snapshot legacy và chạy toàn bộ test frontend. [Báo cáo bổ sung mới nhất](../step7-completion-20261028-2011/report.md). Kết quả lượt này bên dưới được giữ nguyên theo thời điểm thực thi.

**Đã sửa và kiểm chứng cả 4 lỗi S7-01–S7-04** từ [báo cáo QA trước](../step7-live-20261028-1426/report.md). Đã chạy HTTP/PostgreSQL thật, Edge và Playwright MCP trên DB test local mới. Không áp dụng DDL/seed lên DB nghiệp vụ hiện tại; **hash 100 bảng hiện tại giữ nguyên**. [Tổng hợp kiểm chứng](verification-summary.json), [đối chiếu DB](main-after.json).

## 1. Thay đổi và bằng chứng đóng lỗi

| Lỗi | Sửa | Kiểm chứng mới |
|---|---|---|
| S7-01: reopen sai guard phase | Guard riêng cho Khoa, dùng chung giữa capability GET và command; không yêu cầu phase EDIT mở. DEFENDING/COMPLETED/CANCELLED vẫn bị chặn; SV không được sửa khi EDIT còn khóa | [Lifecycle API](lifecycle-api/lifecycle-results.json), [UI/HTTP thực](lifecycle-checkpoints.json) |
| S7-02: không tải PDF cũ | Download có ID tìm đúng finalization trong dossier; bỏ ID mới dùng current. Command ghi vẫn chỉ dùng current. DTO/UI có danh sách bản chốt, snapshot, biên nhận riêng và nhãn đã thay thế. Header `X-Dossier-Status`, filename lịch sử phân biệt với bản hiện hành | [Sau reopen](historical-PDF-after-reopen.json), [sau chốt lại](historical-PDF-after-refinalize.json), [UI tải bản cũ](remaining-checkpoints.json), [ảnh](S7-02-historical-UI.png) |
| S7-03: thiếu preview watermark | Thêm `GET /proposals/:id/preview.pdf?versionId=...`, strict query, scope Khoa/owner/GVHD hiện hành, no-store/nosniff. PDF có watermark mọi trang, không lưu asset/finalization/receipt | [API/PDF](dossiers-api/generated/step7-results.json), [MCP tải preview](mcp-execution.txt), [ảnh preview](pdf-preview-first.png) |
| S7-04: thiếu trường mẫu DOCX | Snapshot mới đóng băng khóa học và liên hệ SV/GVHD; PDF/UI thể hiện các trường theo nguồn chính thức. Giữ đủ 4 phần nội dung, bảng tiến độ và 4 vị trí ký | [PDF mới](student-official.pdf), [ảnh đối chiếu](pdf-official-first.png), [inspection](pdf-inspection.json) |

Nguồn các field mới: `Student.cohort`; email từ `UserAccount.email`; điện thoại từ `Student.phone`/`Lecturer.phone`, fallback `UserAccount.phone`. Không tách “K63” từ tên lớp hoặc tự điền thông tin thiếu. Mẫu để ô trống khi nguồn thiếu giá trị. Đọc các trường này và khóa nguồn trong transaction chốt; xuất chính thức dùng snapshot đã lưu.

Các field mới optional trong snapshot schemaVersion 1 để đọc chứng cứ cũ. Không backfill hoặc đổi hash/PDF của bản đã chốt. PDF lịch sử được trả nguyên bytes và kiểm checksum/size, không render lại từ dữ liệu live.

Sửa bổ sung liên quan luồng thực tế:

- Login API dùng auth session trực tiếp, không chạy snapshot demo/catalog/assignment trước khi điều hướng. Luồng dossier được phép không còn các request nền 400/403 nêu ở O7-01 trước đây.
- Toolbar không submit tìm kiếm khi chưa có đợt; thao tác dossier remount theo proposal để tách note, message và idempotency key khi SPA đổi hồ sơ.
- UI cho tải PDF preview có nhãn “chưa chốt”; PDF chính thức và hành động nhận giấy vẫn độc lập.

## 2. Kiểm tra mới đã chạy

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| Backend build/shared build | PASS, exit 0 | [log](backend-build.log) |
| Frontend TypeScript/build | PASS, exit 0 | [type-check](frontend-type-check.log), [build](frontend-build.log) |
| Backend unit: dossier/version/review | 50/50 PASS | [log](unit-tests.log) |
| Frontend component dossier | 3/3 PASS | [log](frontend-unit-tests.log) |
| Dossier API/PDF suite mở rộng | 20 nhóm PASS, gồm producer prelude bước 5 | [result](dossiers-api/generated/step7-results.json), [summary](dossiers-api-summary.json) |
| Lifecycle API suite mở rộng | 29 nhóm PASS | [result](lifecycle-api/lifecycle-results.json), [summary](lifecycle-api-summary.json) |
| UI workflow | 10 PASS/0 FAIL | [checkpoints](workflow-checkpoints.json) |
| UI scope/boundaries | 11 PASS/0 FAIL | [checkpoints](scope-boundaries-checkpoints.json) |
| Reopen/history/preview/chốt lại | 9 PASS/0 FAIL | [checkpoints](lifecycle-checkpoints.json) |
| Supplemental: phase/receipt/legacy/mobile/SPA | 7 PASS/0 FAIL | [checkpoints](supplemental-checkpoints.json) |
| Ca bổ sung còn thiếu từ QA trước | 6 PASS/1 timeout ban đầu; tìm theo mã retest 2 PASS/0 FAIL | [bản chạy đầu](remaining-checkpoints.json), [retest](search-proof-checkpoints.json) |
| Mobile lịch sử mở rộng | 2 PASS/0 FAIL | [checkpoints](mobile-history-checkpoints.json), [ảnh](T41-expanded-mobile-history.png) |
| Playwright MCP | Login, toggle mật khẩu, mở dossier, bấm tải preview và chính thức thật đều thành công | [execution đã redacted](mcp-execution.txt), [ảnh](mcp-authenticated-dossier.png) |
| Render PDF thực trong Edge | Official 1 trang, MCP official 1 trang, MCP preview 1 trang, stress 16 trang: PASS | [inspection](pdf-inspection.json) |

Checkpoint điều khiển browser được lặp ở từng suite, không cộng thành số ca nghiệp vụ độc lập. Không cộng API groups, unit tests và checkpoint thành một tỷ lệ PASS chung.

Ca tìm theo mã lần đầu timeout khi chờ kết quả. Đã bổ sung chờ combobox chọn đúng `qa-t1`, chặn submit khi chưa có đợt và chạy lại form UI với `QA-PAGE-01`: đúng một hồ sơ. Giữ nguyên FAIL đầu trong artifact; không chạy lại toàn bộ producer/fixture ghi trên DB đã có dữ liệu để thay lịch sử bằng một log sạch.

Frontend build còn warning chunk lớn/Vite CJS; không có build failure. Lần Vitest đầu trong sandbox gặp `spawn EPERM`, đã chạy lại với quyền tạo subprocess và có kết quả PASS ở trên.

## 3. Đóng các nhánh PARTIAL của báo cáo trước

| ID | Bằng chứng bổ sung thực tế |
|---|---|
| T03 | Form tìm mã SV qua toolbar, kết quả/pointer đúng: [retest](search-proof-checkpoints.json) |
| T05 | Login COMMITTEE riêng; dossier/PDF/preview đều 403/404, không trả nội dung: [remaining](remaining-checkpoints.json) |
| T07 | Preview GET cho 3 actor hợp lệ; đối chiếu số bản ghi trước–sau, không ghi: [API](dossiers-api/generated/step7-results.json) |
| T08 | Fixture tạm thiếu ownership/official assignment chặn finalize 409; restore và không có ghi dở: [remaining](remaining-checkpoints.json) |
| T09 | Kiểm finalize riêng ở SUBMITTED/UNDER_REVIEW/REVISION_REQUESTED đều bị chặn, restore status: [remaining](remaining-checkpoints.json) |
| T19 | Audit fault rollback cả workflow/revision/history/finalization/idempotency bằng so sánh hàng trước–sau: [API script](../../../../backend/scripts/test-proposal-dossiers.cjs), [result](dossiers-api/generated/step7-results.json) |
| T20 | SQL UPDATE và DELETE PDF bytes bị chặn; snapshot/SEALED/receipt bất biến tiếp tục đạt: [API](dossiers-api/generated/step7-results.json) |
| T21 | Tải trước generate nhận `409 PDF_NOT_GENERATED`, sau generate tải được: [remaining](remaining-checkpoints.json) |
| T27 | Hai generate đầu đồng thời, key khác: một 200/một 409, một PDF; replay đúng key không thêm asset: [API](dossiers-api/generated/step7-results.json) |
| T35 | UI stale finalize bị chặn; stale generate phục hồi sau reload; receipt stale giữ note và xử lý receipt đã được command khác ghi: [remaining](remaining-checkpoints.json), [ảnh](T35-stale-receipt-note.png) |
| T42 | SPA đổi proposal không lẫn note/key/finalizationId; đã ghi request POST phục vụ kiểm chứng: [keys](SPA-mutation-keys.json) |
| T43 | Fixture legacy `printSnapshot=null` không bị backfill, không tải PDF; legacy thiếu workflow tiếp tục khóa: [remaining](remaining-checkpoints.json), [supplemental](supplemental-checkpoints.json) |
| T45 | Console/network/screenshot/download đủ; MCP logout và đóng browser thành công; API/Vite test được dừng: [cleanup](cleanup.json) |

Các fixture fault-injection chỉ thuộc DB test. Các ca trạng thái producer sai kiểm fail-closed, không được diễn giải thành thao tác nghiệp vụ bình thường của Khoa/SV. Lỗi ban đầu T25/T37/T38/T40 có bằng chứng đóng trong mục 1; các nhóm đã PASS trước được hồi quy bởi suite mới tại mục 2.

## 4. PDF và quan sát trình duyệt

Đã xem ảnh render mới, đối chiếu [mẫu DOCX trích ở lượt QA](../step7-live-20261028-1426/source-template.png). Có đủ field liên hệ/Khóa, Unicode, A4, bốn ô ký. [Trang cuối stress](pdf-stress-last.png) giữ dòng 35, header lặp và ô ký. Kiểm tự động mọi trang về text bounds; preview dài còn được kiểm watermark ở **tất cả 16 trang** trong API suite. Chỉ soi trực quan trang đầu/trang cuối, không thay thế nghiệm thu mẫu bởi Khoa.

[Suite summary và HTTP](suite-summary.json): mọi suite Edge có **0 pageerror, 0 requestfailed**, không lỗi logout. Workflow happy path chỉ có console HTTP 409 do ca khóa phase cố ý. Lifecycle suite có **0 console error**. MCP có **0 console error/1 React Router future-flag warning**: [console](mcp-console.log), [network](mcp-network.log).

Scope suite có các 403/404 có chủ đích; actor bị router đưa tới trang forbidden còn phát request catalog dùng chung và bị 403. Đây là hành vi trang forbidden ngoài luồng dossier được phép, không được ghi thành “toàn ứng dụng console sạch”. Không có 400 assignment results nền trong luồng dossier mới. Ca stale bổ sung có 409 dự kiến và được lưu đầy đủ.

Preview GET không đóng dấu ký số hoặc xác nhận nộp giấy. Chưa in vật lý, xin chữ ký người thật, chạy SMTP hay nghiệm thu biểu mẫu bởi Khoa.

## 5. Môi trường, dữ liệu và phạm vi thay đổi

Vite thực: **http://127.0.0.1:50186/**, API test `http://127.0.0.1:61158/api`. [Runtime](live-ready.json). Đã dừng sau kiểm thử.

DB UI mới: `btl_pr2b_step7fix_1793191452227_7d5922_live`. Dossier API chạy trên DB mới hai lần; kết quả cuối ở `btl_pr2b_step7fix_dossiers_1793191982877_97f9c8`. Lifecycle chạy trên `btl_pr2b_step7fix_lifecycle_1793191434201_8930e1`. Không reset/drop DB có sẵn. PostgreSQL 17.11 local, email worker tắt, không mock API trong các ca thực.

[Integrity cuối lượt](final-integrity.json): 5 finalization (1 legacy cố ý thiếu snapshot), 4 PDF có size/checksum đúng, 4 receipt gắn đúng từng bản, 2 plan; task/progressReview/finalResult đều 0. PDF lịch sử tải bằng UI khớp nguyên bytes file đã tải trước reopen. Receipt v2 trong fixture cuối lượt là thao tác tiếp nhận mới có chủ đích ở ca stale/SPA, không chuyển receipt v1 sang v2.

[Core producer](live-database-snapshot.json) giữ nguyên hash; [DB hiện tại](main-after.json) 100 bảng hash khớp trước–sau, transaction READ ONLY. [Cleanup](cleanup.json): đã logout/đóng browser và dừng riêng API/Vite QA; giữ DB test, không dừng cluster PostgreSQL.

[14 file ứng dụng/test thay đổi so với fingerprint cuối QA trước](source-changes.json), cộng cập nhật tài liệu triển khai bước 6/7 và evidence mới. Giữ toàn bộ thay đổi có sẵn của người dùng; không commit/reset. Không thêm dependency/migration. [Git status](git-status-final.txt).

Các thay đổi chính ở `shared/src/contracts/proposal-dossiers.ts`, backend dossier/lifecycle và hai script regression, frontend dossier/login/workflow toolbar. API/UI bảo toàn bản chốt cũ, fail-closed với legacy chưa đối soát. Không tự sửa dữ liệu cũ để làm test đạt.
