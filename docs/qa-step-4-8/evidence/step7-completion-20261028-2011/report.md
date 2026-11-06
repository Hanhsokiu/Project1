# Bước 7 — hoàn thiện bổ sung ngày 28/10/2026

Đã hoàn tất lượt rà soát sau [bốn lỗi được sửa ở lượt trước](../step7-fixes-20261028-1933/report.md), đồng thời xử lý thêm lỗi thông báo PDF và kiểm tra cấu trúc snapshot legacy. Không thay đổi dữ liệu nghiệp vụ hiện tại: **100 bảng giữ nguyên hash trước–sau**. [Đối chiếu DB](main-after.json), [kết quả tổng hợp](verification-summary.json).

## Thay đổi bổ sung

1. **Hiện đúng lỗi nghiệp vụ khi tải PDF thất bại.** Với request `responseType: blob`, Axios giữ cả JSON lỗi dưới dạng Blob. Interceptor nay giải mã JSON lỗi, giữ nguyên code/status/fields và thông báo tiếng Việt; PDF thành công vẫn trả nguyên bytes. JSON lỗi bị hỏng dùng thông báo HTTP dự phòng, không phát sinh lỗi parse ngoài xử lý.
2. **Chặn snapshot sai cấu trúc trước khi render.** Không chỉ kiểm hash/content: kiểm cả cấu trúc student/advisor, thông tin học thuật và revision của snapshot. Hash khớp nhưng student null hoặc field liên hệ sai kiểu trả `409 INPUT_NOT_READY`, không tạo PDF hoặc gây lỗi render. Snapshot schemaVersion 1 chưa có trường liên hệ vẫn đọc được và được trả nguyên payload, không backfill hay đổi hash.

File ứng dụng: `frontend/src/shared/api/http-client.ts`, `backend/src/topic/proposal-dossiers/dossier.validator.ts`; bổ sung regression trong hai file unit test tương ứng và `backend/scripts/test-proposal-dossiers.cjs`. Không thêm dependency/migration. Những thay đổi của lượt hoàn thiện trước được giữ nguyên.

## Kiểm chứng mới

| Kiểm tra | Kết quả |
|---|---|
| Toàn bộ frontend Vitest | **118/118 PASS**, 20 file, gồm 3 ca Blob error/PDF bytes mới |
| Backend dossier/version/review Vitest | **52/52 PASS**, 3 file, gồm malformed snapshot và backward compatibility |
| Backend/shared build, frontend TypeScript | PASS, exit 0 |
| Frontend production build | PASS, exit 0 — [log](frontend-build.log) |
| ESLint các file thay đổi trong lượt bổ sung | PASS, exit 0 |
| HTTP/PostgreSQL/PDF suite | **21 nhóm PASS**, gồm producer prelude — [kết quả](dossiers-api/generated/step7-results.json), [summary](dossiers-api-summary.json), [log](dossiers-api/console.log) |
| Edge thực | **3 checkpoint PASS/0 FAIL**, gồm 1 browser-control — [checkpoints](pdf-errors-checkpoints.json) |
| Playwright MCP | Đăng nhập thật, bấm preview và xác nhận lỗi nghiệp vụ, tải PDF lịch sử thành công — [execution](mcp-execution.txt) |

Số unit test và exit code được ghi từ kết quả công cụ chạy thực tế; không tạo log unit giả. Suite API chạy trên DB local **mới** `btl_pr2b_step7fix_dossiers_1793193124907_e870d9`. Suite lifecycle 29 nhóm và các luồng chốt/receipt/reopen/chốt lại vẫn có bằng chứng ở [lượt trước](../step7-fixes-20261028-1933/report.md); không cộng các nhóm/chạy lặp thành một tỷ lệ chung.

Các bước browser mới:

- Khoa mở hồ sơ tổng hợp thiếu profile, bấm “Tải PDF xem trước”: UI hiện **“Bước 1–3 chưa cung cấp lớp/ngành đã xác nhận cho sinh viên trong đợt.”**, thay cho lỗi HTTP chung. [Ảnh Edge](preview-business-error.png), [ảnh MCP](mcp-preview-error.png).
- Fixture metadata size của PDF lịch sử bị thay đổi tạm trên DB test: UI hiện **“File PDF không khớp metadata.”**; khôi phục đúng size/updatedAt rồi tải lại thành công. [Ảnh lỗi](historical-PDF-business-error.png), [file phục hồi](recovered-historical.pdf).
- File tải bằng MCP và Edge khớp nguyên bytes [PDF trước reopen](../step7-fixes-20261028-1933/student-official.pdf); không render lại hoặc thay chứng cứ cũ. [MCP PDF](mcp-historical.pdf).
- Các hàng trong 8 bảng nghiệp vụ được so sánh đầy đủ trước–sau: không đổi. [Kết quả](no-business-changes.json). Login chỉ ghi dữ liệu phiên/audit xác thực đã được cho phép.

Lần chạy browser đầu bị assertion do helper SELECT không có ORDER BY: UPDATE fixture làm thứ tự hàng trả về thay đổi. Đã thêm sắp xếp theo id/assetId và chạy lại; hàng/bytes không đổi. [Dấu vết lần đầu](pdf-errors-attempt-1-checkpoints.json) được giữ nguyên, không ghi đè thành PASS.

## Môi trường và cleanup

Browser dùng Vite thật **http://127.0.0.1:50187/**, API `http://127.0.0.1:54725/api`, tiếp tục DB test `btl_pr2b_step7fix_1793191452227_7d5922_live` đã tạo ở lượt trước; **không reseed/migrate** khi mở lại. [Runtime](live-ready.json).

Edge có **0 pageerror/0 requestfailed**; hai console HTTP 409 là lỗi thiếu profile/corrupt metadata có chủ đích. [Browser log](pdf-errors-browser-log.json). MCP console header chỉ tổng hợp trang hiện hành, nhưng nội dung `all` vẫn ghi HTTP 409 của preview ở trang trước; không dùng header “0 errors” để tuyên bố toàn luồng không có lỗi HTTP. [Console](mcp-console.log), [network](mcp-network.log).

Đã logout và đóng browser MCP thành công; dừng riêng API/Vite QA, giữ DB test và PostgreSQL. [Cleanup](cleanup.json). DB hiện tại được đối chiếu trong transaction READ ONLY, 100 bảng không đổi. Không sửa hoặc chạy migration trên DB giao diện hiện tại/Supabase.

Giới hạn còn lại là nghiệm thu biểu mẫu bởi Khoa, in giấy/chữ ký người thật và SMTP; không dùng kiểm thử kỹ thuật để xác nhận các hoạt động này đã xảy ra. React Router/Vite có warning sẵn có, không làm build/test thất bại.
