# Triển khai bộ demo V3

Nguồn ZIP đã giải nén nguyên văn vào thư mục này. Đây là đặc tả đầu vào, không phải bằng chứng dữ liệu đã tồn tại.

## Phạm vi và kế hoạch

1. Kiểm tra schema, migration, dịch vụ, RBAC và nguồn dữ liệu UI; lưu fingerprint của mã hiện có.
2. Tạo PostgreSQL 17 TEST riêng, chỉ bind loopback; mặc định dry-run, ghi dữ liệu cần `--seed --target=local-test`.
3. Tạo generator deterministic cho 105 người dùng, 84 sinh viên, 87 lượt tham gia, 18 giảng viên và hai đợt. Seed từng nhóm quan hệ trong transaction, kiểm chứng trước khi chuyển bước.
4. Tạo đề cương, lịch sử duyệt, hồ sơ/PDF, kế hoạch và báo cáo tuần bằng dữ liệu tổng hợp. Không thay seed hệ thống hoặc dữ liệu `mau18_*`.
5. Kiểm chứng khả năng thực thi bước 9–10 qua producer hiện có. Không giả policy được Khoa phê duyệt, không ép trạng thái hoàn tất hoặc bỏ kiểm tra provenance để đạt số lượng.
6. Chạy assertion, smoke API, kiểm tra UI qua API thật nếu khả dụng; xuất thống kê, ma trận UC, blocker và backup TEST kèm storage.

## Quyết định đã xác minh

- ADR-0002 hiện hành: một sinh viên/một đề tài/đợt; ba sinh viên tham gia lại dùng chung tài khoản.
- Danh mục seed chuẩn có năm hướng; dùng năm hướng, không tự thêm hai hướng.
- Schema hiện tại có `ScoreEntry.totalScore` và `FinalResult.finalScore` Decimal(4,1). Không thể chứng minh bảo toàn mọi kết quả hai chữ số thập phân; cần báo blocker riêng, không sửa migration.
- Các UC17–25 có dịch vụ thật với kiểm tra policy, provenance, snapshot và quyền. Các model legacy không đủ làm bằng chứng luồng hợp lệ.
- Bộ approval producer `AcceptancePolicyService` hiện chỉ nhận namespace `DATN-E2E-B1B10-TEST-*`, không nhận mã `DEMO-2026-*`. Không giả mạo approval của producer đó cho hai mã demo.
- Cần kiểm tra route thực thi: sự tồn tại của trang legacy có `DemoDb` chưa chứng minh router đang dùng trang đó.

## Checkpoint

Trạng thái bàn giao **PARTIAL** ngày 16/11/2026, database hiện tại `btl_pr2b_acceptance_utc_demo_v3_baseline_v3` tại loopback:55463. 105 users/84 SV/87 lượt tham gia/87 dossier/890 bài nộp/2.020 assets; producer UC17–20 đã tạo 60 hồ sơ đủ điều kiện, 3 hội đồng và 60 phản biện chốt. Đợt cũ DEFENDING, đợt hiện tại IN_PROGRESS.

184 phase dữ liệu sở hữu đã được chạy lặp và đối chiếu nội dung 102 model không đổi. Các bước chưa xong không được đánh dấu PASS trong checkpoint. Actions producer nằm trong `.cache/demo-v3/<database>-defense-actions.json`; phase marker được commit cùng transaction trong AuditLog. Phần producer dùng checkpoint file và idempotency key API; chưa chứng minh phục hồi mọi crash giữa response/checkpoint.

UC21 đề xuất lịch: HTTP500/P2028 sau 30 giây. UC25 thống kê ở lượt lặp: HTTP500, gọi service riêng P2028 sau 60 giây. Không sửa transaction timeout hay backend. Bổ sung 11 quyết định DEFERRED vào baseline cũ bị chặn do term đã DEFENDING; giữ 16 request PENDING và không rewind trạng thái. Producer đã được đặt đúng trước transition cho lần dựng mới, nhưng nhánh đó chưa được kiểm chứng trên DB mới.

Schema không bảo toàn điểm hai số lẻ (8.25 → 8.3 khi numeric(4,1)); chưa có 60 bộ điểm/FinalResult/ExportJob/biên bản và chưa triển khai 10 scenario DB độc lập. Cần xử lý các [blocker](blocked-gaps.md), sau đó tiếp tục producer với checkpoint và chạy lại assertions/API/backup. Không cần hoặc được phép reset baseline để tiếp tục.

Chỉ thêm scripts/demo-v3 và docs/demo-data-v3 trong nhiệm vụ này; không sửa source sản phẩm, schema, API hay logic RBAC. Có nhiều thay đổi UI tồn tại trước nhiệm vụ, được giữ nguyên. Fingerprint 728 file được ghi sau khi phần seed đã bắt đầu, nên chỉ chứng minh chúng không đổi kể từ checkpoint đó, không giả là snapshot đầu phiên.
