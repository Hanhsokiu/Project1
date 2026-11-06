# Kiểm thử API

## Môi trường và inventory

NestJS AppModule thật, Prisma/PostgreSQL17 trên DB audit mới; permission guards/controller/service/repository thật. Suites thiết lập prefix và ValidationPipe; boundary probe bổ sung **GlobalExceptionHandler giống main.ts** để không bỏ sót khác biệt transport. Build/API hiện dùng backend đã build từ cùng source; source không thay đổi trong audit.

- [Inventory71 operations](evidence/20261026144939_2663ec/live-e2e/endpoint-auth.json): method/path/tag, anonymous status và account không permission.
- [Matrix từng operation](evidence/20261026144939_2663ec/api-operation-matrix.json): kèm status authenticated quan sát được trong traffic.
- [Traffic thật ](evidence/20261026144939_2663ec/live-e2e/live-api-traffic.json): method/path/status; không lưu Authorization header/token.
- [154 scenario groups](evidence/20261026144939_2663ec/test-case-matrix.json): tên assertion và link result từng bước; không nhân số count do producerprelude chạy lặp.

## Coverage các ca bắt buộc

| Loại ca | Bằng chứng mới | Kết luận chính xác |
| --- | --- | --- |
| Request hợp lệ |154groups +15 browser checkpoints;34operation có 2xxtrong live traffic | PASS cho các ca đó, không phải mọi operation |
| Thiếu trường /sai kiểu | Strict DTO suites; boundary missing-content400, revision string400 | PASS các payload cụ thể |
| ID không tồn tại | UI/API missing proposal, tests nonexistentmember/wrongparent | PASS ca đã kiểm, chưa vét mọi ID trên 71 operation |
| Trùng dữ liệu /requestlặp | Group/member/round/plan/receipt/submission idempotency suites | PASS ca đã kiểm |
| Không token |71 operation đều 401 | PASS inventory |
| Token sai | Boundary invalid-token401 | PASS một endpoint thật; chưa replay toàn 71 với token sai |
| Không quyền |71 operation với account không permission, ngoại lệ self-notification theo contract | PASS inventory đúng expectedstatus |
| Concurrent | CAS updates, assignments/decisions, versions, finalize, plan/task, resubmit, reviewamend | PASS controlled races; không phải stresstest |
| Locked/state invalid | Phaseclosure races, alreadydecided/finalized/completed, staleversion | PASS cụ thể trong suites |
| Session hết hạn | LoginSession.expiresAt về quá khứ trong DB test→401 | PASS boundarybackend |
| Lỗi database | Inject audit/metadata failure; assert no partial pointers/history/assets/notice | PASS failure atomicity ở các command được test |
| Lỗi storage | Inject private storage write failure và metadata-after-byte-write | PASS cleanup/rollback cases8B |
| Lỗi kết nối | HTTPclient có normalize ERR_NETWORK; chưa có ca mất mạng hoàn chỉnh cho từng màn | NOT VERIFIED; loadingdelay không phải mất kết nối |
| Payload UTF-8 dài | Schema valid110.377bytes→500, small control201 | **FAIL QA-001** |

Không gắn PASS cho15loại case trên từng API khi chưa có trace/assertion tương ứng. Một số API chỉ có authinventory; chi tiết matrix giữ trạng thái coverage đó.

## Finding transport

[Boundary-diagnosed](evidence/20261026144939_2663ec/boundary-diagnosed/results.json):

- Request POST `/api/proposals/p-student/versions`, bearer session hợp lệ, Idempotency-Key, expectedRevision đúng.
-5field, mỗi field11.000 ký tự `đ`, còn dưới max20.000 ký tự /field; `ProposalVersionSaveSchema.safeParse=true`.
- Parser phát `PayloadTooLargeError`, status413, type`entity.too.large`, limit102400, length110377.
- GlobalExceptionHandler không nhận đây là HttpException nên response thực tế500/INTERNAL_ERROR.
- Countversion trước /sau2→2, không ghi dở. Smallcontrol201 lưu snapshot thật.

Đây mạnh hơn transportprobe cũ không auth/DB. Harness có thể exit0 khi hoàn thành thu số đo, nhưng **case có expected201/actual500 là FAIL**, không dựa riêng exitcode để chứng nhận.

## API còn thiếu so với baseline

Inventory/controller không có producer hoàn chỉnh cho `/proposals/:id/withdraw`, `/return-to-draft`, `/reopen` và PhaseEvaluation CRUD theo criteria. Chi tiết [missingfeatures](13-missing-features.md); không suy đó là lỗi response của một API đã triển khai. Preview/generatePDF dùng contract triển khai bước7 hiện tại; không kết luận endpoint phải giống nguyên tên draft PR1 nếu hành vi thay thế đã được mô tả.

Swagger71 operation là tập feature tags dùng trong E2E, không phải toàn backend. Không công bố đã bảo vệ mọi API ngoài phạm vi hoặc đã kiểm full9–10.
