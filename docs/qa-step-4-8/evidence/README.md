# Bằng chứng kiểm thử

Lượt chính: `20261026144939_2663ec`. Thời gian từng ca ở JSON dùng UTC; báo cáo theo múi giờ Asia/Saigon và ngày bàn giao 27/10/2026.

- `run-summary.json`: 7 suite API/DB và live E2E, mỗi suite dùng DB mới.
- `step*/generated/*-results.json`, `console.log`: kết quả nguyên bản từ assertions của test trong repository, chuyển nơi xuất qua adapter.
- `live-e2e/`: 15 checkpoint browser thật, traffic, auth71operation,4legacyprobes, PDF tải thật và screenshot dashboard.
- `handoff/`: regression publish/finalize riêng và bàn giao bước3→4–8.
- `boundary-diagnosed/results.json`: probe authenticated đủ bootstrap/filter; payload hợp lệ bị500 và metadata parser413/limit102400. Các thư mục boundary trước đó được giữ để phân biệt lần thu bằng chứng chưa đủ.
- `ui-local/`, `ui-boundaries-final/`, `ui-followup/`: desktop/mobile, axe, loading,403/404 ổn định, Back/Refresh và session recovery. Một số capture đầu còn loading hoặc locator sai; không được dùng để kết luận form/error-state PASS.
- `database/results.json`: catalog, migration checksums, FK orphan checks, invariants, counts và EXPLAIN trên fixture nhỏ.
- `verification/`: validate/typecheck/unit/build logs, kết quả unit JSON và hash source trước chạy. Build binaries/cache/browser profiles đã loại khỏi bộ bàn giao.
- `api-operation-matrix.json`, `test-case-matrix.json`, `source-inventory.json`: coverage có giới hạn rõ; không phải dấu chứng nhận toàn requirement.
- `final-validation.json`, `manifest-sha256.json`: kiểm tính đầy đủ báo cáo, link và integrity cuối lượt.

Hai thư mục run trước lượt chính là lỗi thiết lập harness (spawn/path), không phải product failure. Không xóa hoặc đổi kết quả cũ thành PASS. Harness boundary hoàn tất thu dữ liệu có thể exit0 nhưng case expected201/actual500 vẫn là FAIL trong báo cáo.

## Tái chạy khi cần

Không cần cài package. Chỉ dùng cluster test local đã chuẩn bị; không chạy với URL Supabase.

```powershell
# Từ repository root; tạo DB test mới, không reset/drop DB hiện có:
node docs/qa-step-4-8/evidence/harness/run-audit.cjs
```

Runner cập nhật `latest-run.txt`; các harness bổ sung dùng run hiện tại. Muốn bổ sung bằng chứng cho run cũ, kiểm pointer trước, không ghi đè raw artifact. Chạy lại toàn bộ chỉ khi có thay đổi hoặc lý do xác minh mới; đọc báo cáo không cần chạy server/test mới.

`preload.cjs` chuyển nơi xuất result/PDF/cache và Vite config của runner, giữ nguyên assertions và logic ứng dụng. `TEMP/TMP` trỏ trong thư mục evidence khi chạy suite; dữ liệu upload/browser tạm được loại sau thu kết quả. Credential/JWT chỉ dùng trong bộ nhớ/env của test, không có trong bộ report đã kiểm.
