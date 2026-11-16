# Database DEMO V3 — trạng thái thực thi

**PARTIAL — chưa đạt mục tiêu demo trọn 10 bước.** Đã tạo PostgreSQL TEST và dữ liệu thật; không chuyển ứng dụng/database dùng chung sang demo. Ngày kiểm chứng: 16/11/2026. Ba file `DATASET_BLUEPRINT.md`, `demo-manifest.json`, `CODEX_IMPLEMENTATION_PROMPT.md` được giải nén nguyên văn từ ZIP; các con số mục tiêu trong đó không phải kết quả đã đạt.

## Dữ liệu đã tạo

| Nội dung                                                   |      Kết quả hiện tại |
| ---------------------------------------------------------- | --------------------: |
| Tài khoản / SV duy nhất / GV / giáo vụ / admin             | 105 / 84 / 18 / 2 / 1 |
| Đợt / lượt tham gia / SV dùng chung hai đợt                |            2 / 87 / 3 |
| Đăng ký / phân công / đề tài / hồ sơ / kế hoạch            |           87 mỗi loại |
| Phiên bản đề cương / lượt duyệt                            |             133 / 133 |
| Bản nộp tuần / review tiến độ                              |             890 / 889 |
| PDF hồ sơ / FileAsset có bytes và checksum                 |            87 / 2.020 |
| Báo cáo cuối kỳ / GVHD xác nhận / đủ điều kiện đã chốt     |          60 / 60 / 60 |
| Hội đồng / vị trí thành viên / phân công phản biện đã chốt |           3 / 12 / 60 |
| Điểm GVHD / bộ điểm hoàn chỉnh / kết quả công bố           |        60 / **0 / 0** |
| Lịch bảo vệ / ExportJob / biên bản bảo vệ                  |         **0 / 0 / 0** |

Đợt cũ giữ `DEFENDING`, chưa ép `COMPLETED`. Đợt hiện tại `IN_PROGRESS`, chưa có hội đồng hoặc điểm bảo vệ. Tuần 5 của 11 SV hiện tại: 5 PASS, 3 REVISION_REQUIRED, 2 quá hạn không có bài nộp, 1 chờ review. Có 16 đề nghị hoãn/bảo lưu `PENDING`; không đồng nhất đề nghị với phê duyệt. Các quyết định UC18 hoãn trước lịch được ghi riêng trong thống kê sau seed.

Các bước 1–8 chủ yếu là lịch sử **fixture tổng hợp** được tạo bằng transaction, có quan hệ/version/binding/bytes thật. Không tuyên bố người dùng thật đã thực hiện các hành động đó qua UI. Bước 9 đã thực hiện producer service/API UC17–20 với auth, policy TEST và trigger hiện hành. Xếp lịch UC21 trả HTTP 500/P2028; các thao tác ghi UC22–25 phía sau chưa thực thi. Xem [blockers](blocked-gaps.md).

## Mở demo trên máy này

- Frontend thật: <http://127.0.0.1:5183/login>; API TEST riêng: <http://127.0.0.1:3083/api/demo-v3/status>.
- PostgreSQL 17 loopback `127.0.0.1:55463`, database `btl_pr2b_acceptance_utc_demo_v3_baseline_v3`.
- [Danh sách username và vai trò](demo-users.example.md). Mật khẩu ngẫu nhiên cục bộ nằm ở trường `accountPassword` trong `.cache/demo-v3/private-v3.json`; tự mở file tại máy, không đưa giá trị vào báo cáo/Git.
- Nên bắt đầu bằng `demo3_sv074`, `demo3_gv06`, `demo3_giaovu1`. Đây đều là danh tính tổng hợp; email dùng miền `.invalid`.

Nếu các process đã dừng, mở các terminal riêng từ thư mục gốc:

```powershell
node scripts/demo-v3.cjs --prepare --target=local-test
node scripts/demo-v3.cjs --serve --target=local-test
node scripts/demo-v3/preview.cjs
```

`--prepare` chỉ khởi động cluster TEST sở hữu và áp dụng migration nguyên bản khi database mới; không reset. Trên máy mới, cài PostgreSQL 17 binaries đầy đủ `bin/lib/share`, đặt `BTL_POSTGRES_BIN` tới thư mục `bin` trước lần prepare đầu. Cần dependencies monorepo và backend đã build. Bộ binaries sử dụng trên máy này nằm trong `.cache/demo-v3/postgresql/pgsql/`; không được commit. Không thay `.env` hay cấu hình Supabase.

## Chạy seed và kiểm tra

```powershell
# Mặc định offline, không kết nối database, không ghi dữ liệu
node scripts/demo-v3.cjs

# Chỉ database TEST allowlist; tiếp tục checkpoint, không reset
node scripts/demo-v3.cjs --seed --target=local-test
node scripts/demo-v3.cjs --validate --target=local-test
node scripts/demo-v3.cjs --api-smoke --target=local-test
node scripts/demo-v3/idempotence.cjs --target=local-test
node scripts/demo-v3/report-docs.cjs --target=local-test

# Các kiểm tra mã nguồn, không dùng file môi trường
node scripts/demo-v3/build-checks.cjs
node scripts/demo-v3/quality-checks.cjs
node scripts/demo-v3/unit-checks.cjs
node scripts/demo-v3/frontend-checks.cjs
node --test scripts/demo-v3/definition.test.cjs
```

Seed hiện trả lỗi khác 0 tại producer xếp lịch; checkpoint các bước đã hoàn tất được giữ. `--validate` kiểm tra tính toàn vẹn phần đã có và in `PARTIAL`, không có nghĩa nghiệm thu 10/10. `--report` cũng tạo lại báo cáo integrity. Không rerun seed liên tục để vượt timeout; cần xử lý nguyên nhân riêng. Dữ liệu thủ công ngoài phase sở hữu không được ghi đè. Manifest thay đổi sẽ bị từ chối thay vì âm thầm sửa dữ liệu cũ.

Idempotence đã kiểm tra bằng số hàng **và hash nội dung của toàn bộ 102 model** khi chạy lại các phase baseline hoàn tất. Chưa chứng minh crash-recovery/idempotence của toàn bộ producer UC21–25 hoặc seed đồng thời. ID fixture ổn định theo seed, khóa tự nhiên/composite như schema; ID do producer thật sinh và bytes PDF có thể khác giữa hai database dựng độc lập, không tuyên bố dump bit-for-bit giống nhau.

## Sao lưu và khôi phục an toàn

```powershell
node scripts/demo-v3.cjs --export-backup --target=local-test
```

Lệnh tạo dump custom và bản sao storage dưới `.cache/demo-v3/backups/<timestamp>/`, rồi **thực sự** restore bằng `pg_restore --single-transaction --exit-on-error` vào database mới `btl_pr2b_demo_v3_copy_<timestamp>`. Nó kiểm tra allowlist, tên chưa tồn tại, số hàng mọi model và checksum storage; không dùng `--clean`, không ghi đè database. PDF hồ sơ lưu trong DB, file upload nằm trong thư mục storage kèm backup.

Kết quả/path/hash nằm trong [backup-report.json](evidence/backup-report.json). Dump chứa password hashes và phiên TEST, nên chỉ lưu cục bộ; không commit dump/private JSON/storage. Database copy chỉ phục vụ kiểm tra restore, chưa được cấu hình thành runtime demo; runner vẫn khóa vào baseline V3. Các database V1/V2 chẩn đoán được giữ nguyên, không phải bản bàn giao.

## Kết quả kiểm tra

| Kiểm tra thực sự đã chạy                                                | Kết quả / giới hạn                                                                                              |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Prisma validate/generate, backend production build, frontend Vite build | PASS; dùng schema copy và config không đọc file môi trường, frontend build không thay thế type-check            |
| Type-check và lint backend/frontend                                     | 4/4 PASS                                                                                                        |
| Backend test liên quan                                                  | 54 files / 854 tests PASS; unit/HTTP fixture, không phải E2E PostgreSQL                                         |
| Frontend test                                                           | 64 files / 403 tests PASS; unit/API client fixture                                                              |
| Generator/safety gate                                                   | 5/5 PASS                                                                                                        |
| Integrity dữ liệu hiện có                                               | 10 nhóm PASS; tổng thể PARTIAL do thiếu kết quả cuối và precision BLOCKED                                       |
| Chạy lại phase baseline                                                 | 184 phase, hash nội dung 102 model không đổi                                                                    |
| Smoke API PostgreSQL                                                    | Lượt mới nhất **52/53 PASS, 1 FAIL** ở UC25 statistics HTTP500; trước đó từng 53/53, không coi endpoint ổn định |
| Backup + restore                                                        | Thực sự restore vào DB mới và đối chiếu tất cả model/storage; xem report mới nhất                               |
| Playwright MCP                                                          | Ba vai trò, 10 screenshot desktop/mobile; không phải browser mutation E2E                                       |

## Hồ sơ kiểm chứng

- [Mapping 102 model, FK và unique](model-map.md); [thống kê toàn bộ bảng](seed-diff.md).
- [Ma trận UC01–UC25](uc01-uc25-coverage.md): phân biệt smoke PASS và mutation/scenario chưa kiểm thử.
- [Ảnh và kiểm tra UI qua API thật](evidence/README.md).
- [Giới hạn và bước tiếp theo](blocked-gaps.md); [checkpoint triển khai](IMPLEMENTATION.md).
- [Integrity](evidence/data-integrity-report.json), [API smoke](evidence/api-smoke.json), [idempotence](evidence/idempotence.json), [build](evidence/build-checks.json), [type-check/lint](evidence/quality-checks.json), [backend unit](evidence/unit-checks.json), [frontend unit](evidence/frontend-checks.json).

## Checklist trình diễn

- [ ] Xác nhận endpoint status trả đúng baseline V3, `productionConnected:false`, workers 0.
- [ ] Đăng nhập SV074; chọn từng đợt để thấy cùng một tài khoản/hồ sơ SV, khác đề tài và tiến độ.
- [ ] Mở đăng ký đã nộp/hết hạn; không trình diễn lưu/nộp như thể đang mở đăng ký.
- [ ] Mở kế hoạch, nhiệm vụ, lịch sử/version, tải PDF và source ZIP thật.
- [ ] GV06 mở bộ lọc nhận xét, bỏ “chỉ chờ đánh giá”, chọn “Cần sửa”, xem SV079.
- [ ] Giáo vụ mở `/terms`, `/guidance/progress`; phân biệt số task toàn kỳ với phân bố tuần 5.
- [ ] Công khai blocker lịch/điểm/xuất; không trình diễn điểm cuối hoặc biên bản chưa được sinh.
- [ ] Sau khi sửa blocker được duyệt, chạy lại producer, kiểm tra integrity và cập nhật backup/evidence trước khi tuyên bố hoàn tất.
