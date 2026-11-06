# Kiểm tra trực tiếp giao diện có dữ liệu bước 4–8

Ngày 27/10/2026, nhánh `fix/integration-ui`. Giao diện **http://127.0.0.1:5173**, API 3000, database **btl_integration_ui** trên PostgreSQL local 55451.

## Nguyên nhân màn trống

Đợt duy nhất trên UI ở OPEN_REGISTRATION; DB có 0 đề cương, 0 kế hoạch, 0 nhiệm vụ và 0 bài nộp. Còn thiếu phase PROPOSAL_REVIEW. E2E trước đó dùng DB test riêng nên người dùng mở UI local chưa thấy dữ liệu của các lần E2E.

Không có Playwright MCP trong phiên. Đã dùng Playwright + Microsoft Edge thật, đăng nhập các tài khoản local và thao tác trên chính cổng 5173, không mock API.

## Mở để thao tác ngay

Đăng nhập tại http://127.0.0.1:5173/login. Mật khẩu chung: **Demo@2026**.

Chọn đợt **DEMO 4–8 · Hồ sơ, xét duyệt và hướng dẫn** (`UI-DEMO-48-20261027`) ở header/bộ lọc. Tab cũ có thể đang giữ termId của đợt đăng ký; đổi đợt hoặc dùng các link dưới. Đợt cũ được giữ nguyên và vẫn có danh sách workflow trống.

| Tài khoản | Thao tác đang chờ bạn | Mở sau đăng nhập |
| --- | --- | --- |
| giaovu | Bước 4: xem/sửa nhóm, thành viên hoặc tạo nhóm | [Nhóm duyệt](http://127.0.0.1:5173/topic/review-groups?termId=d4e2575a-c68d-40f7-8398-3fdcf34af59b) |
| giaovu | Bước 5: xem 4 hồ sơ, lọc trạng thái, phân công khi đủ điều kiện | [Hàng đợi](http://127.0.0.1:5173/topic/reviews?termId=d4e2575a-c68d-40f7-8398-3fdcf34af59b) |
| gv003 / gv004 | Bước 5: sv002 đã phân nhóm, chưa bắt đầu; thử bắt đầu và ghi kết luận chung | [Vòng duyệt sv002](http://127.0.0.1:5173/topic/reviews/54d650c9-5a7b-4c7a-a2e7-c3a9e30f1d0f?termId=d4e2575a-c68d-40f7-8398-3fdcf34af59b) |
| sv001 | Bước 6: cần sửa, có nhận xét; sửa nội dung, phản hồi, lưu snapshot, nộp lại | [Đề cương sv001](http://127.0.0.1:5173/topic/proposal/a7bc28c0-873e-4dde-9a2d-ca97f351895d?termId=d4e2575a-c68d-40f7-8398-3fdcf34af59b) |
| sv002 | Bản đã nộp đang chờ duyệt chỉ đọc, không sửa trực tiếp bản SEALED | [Đề cương sv002](http://127.0.0.1:5173/topic/proposal/201335e2-9fe4-49b6-bc2e-1c805f44803a?termId=d4e2575a-c68d-40f7-8398-3fdcf34af59b) |
| giaovu | Bước 7: sv003 đã duyệt, chưa chốt; nút chốt sẵn sàng | [Chốt sv003](http://127.0.0.1:5173/topic/dossier/8c447530-71bb-4033-a3be-9ec680a6b1e3?termId=d4e2575a-c68d-40f7-8398-3fdcf34af59b) |
| giaovu / sv004 | Bước 7: sv004 đã chốt và có PDF, chưa nhận giấy; để sẵn thao tác tiếp nhận cho Khoa thử trên demo | [Hồ sơ sv004](http://127.0.0.1:5173/topic/dossier/73d376de-3359-4de8-b88d-ba742cb0a3a1?termId=d4e2575a-c68d-40f7-8398-3fdcf34af59b) |
| gv001 | Bước 8A: GVHD của cả 4 SV; sv004 có kế hoạch để giao thêm việc | [Kế hoạch sv004](http://127.0.0.1:5173/guidance/plan/73d376de-3359-4de8-b88d-ba742cb0a3a1?termId=d4e2575a-c68d-40f7-8398-3fdcf34af59b) |
| sv004 | Bước 8A/8B: 5 task, có task chưa nộp/cần nộp lại, có nút tạo task tuần | [Nhiệm vụ và báo cáo tuần](http://127.0.0.1:5173/guidance/tasks?termId=d4e2575a-c68d-40f7-8398-3fdcf34af59b) |
| gv001 | Bước 8C: bài chờ đánh giá, form PASS/FAIL/REVISION_REQUIRED sẵn sàng | [Đánh giá bài nộp](http://127.0.0.1:5173/guidance/review/e649eadb-0413-4941-bd6f-49bcc86509fa?termId=d4e2575a-c68d-40f7-8398-3fdcf34af59b) |
| gv001 / sv004 | Bước 8C: xem nhật ký; GVHD có thể thêm/sửa có lịch sử | [Nhật ký](http://127.0.0.1:5173/guidance/meetings?planId=da9cc485-f464-4008-93df-e6628e9055bf&termId=d4e2575a-c68d-40f7-8398-3fdcf34af59b) |
| giaovu | Bước 8C: thống kê thật và nghĩa vụ tuần độc lập task | [Dashboard](http://127.0.0.1:5173/guidance/progress?termId=d4e2575a-c68d-40f7-8398-3fdcf34af59b) |

File để thử upload bằng sv004:

- `.cache/integration-ui/sample-files/bao-cao-demo.pdf`
- `.cache/integration-ui/sample-files/source-demo.zip`

PDF được tải qua UI từ hồ sơ đã chốt; ZIP chứa source mẫu hợp lệ. Chọn cả hai file, bấm **Tải file lên**, rồi **Xác nhận nộp**. Sv001 chưa có task hướng dẫn vì đề cương đang cần sửa; dữ liệu task nằm ở sv004.

## Chuẩn bị và bảo toàn dữ liệu

- Chỉ thêm một đợt tổng hợp, không ghi đè đợt đang đăng ký hoặc đổi mật khẩu hiện có.
- Seed cấu hình đầu vào: roster, grant Khoa, routing hướng/bộ môn, lớp/ngành, phase, mốc và nghĩa vụ tuần. Phase demo mở song song để thử nhiều trạng thái trong cùng lần xem; đây là lịch demo local.
- Phân công được công bố qua API rồi chốt FINALIZED riêng; đề tài được GVHD đồng ý, bàn giao, lưu bản đầy đủ và nộp qua API.
- Nhóm, vòng duyệt/kết luận, chốt hồ sơ, tải PDF, kế hoạch/task, upload/nộp, đánh giá và nhật ký đều được thực hiện bằng UI thật.
- DB sau chuẩn bị: 1 nhóm, 4 đề cương, 4 vòng duyệt, 1 kế hoạch, 5 task, 3 bài nộp, 2 đánh giá, 1 nhật ký và 25 thông báo.
- Task: 2 TODO (một quá hạn), 1 SUBMITTED, 1 REVISION_REQUESTED, 1 COMPLETED. Nghĩa vụ tuần chưa materialize để bạn tự thử tạo task.
- Chạy lại chuẩn bị không tạo trùng hay đưa hồ sơ về trạng thái ban đầu; hash các hàng của đợt cũ trước/sau khớp.
- Không thay schema/migration, không commit/push, không dùng Supabase; SMTP worker local vẫn tắt.

## Lỗi phát hiện khi có dữ liệu

Các node số thành viên, badge vòng duyệt, nội dung bảng và pagination hộp thư chưa xuất hiện trong scan màn trống trước đó. Đã chỉnh contrast trong `frontend/src/features/review-groups/workspace.css` và `frontend/src/index.css`.

Lượt cuối **15 kiểm tra chức năng PASS, 12 scan axe không violation, không page error/HTTP 4xx–5xx** trên các màn đã mở. Bao gồm nhóm/form sửa, vòng duyệt, editor cần sửa, hồ sơ trước/sau chốt, task, nộp lại, đánh giá, nhật ký, hộp thư và dashboard; thêm bộ lọc, đổi đợt và mobile.

## Chạy lại

Môi trường hiện tại đã có dữ liệu, chỉ cần reload và chọn đúng đợt. Khi khởi động lại:

```powershell
pnpm ui:dev
# Terminal khác, sau khi API sẵn sàng:
pnpm ui:workflow
```

Máy chưa có tài khoản mẫu: `pnpm ui:prepare`, khởi động `pnpm ui:dev`, chạy `pnpm ui:sample` trước `pnpm ui:workflow`.

```powershell
pnpm ui:check-workflow
```

Bộ check chỉ đọc UI và giả định trạng thái demo ban đầu. Sau khi bạn tự duyệt/chốt/nộp lại/giao thêm task, assertion theo fixture có thể khác; không dùng điều đó để kết luận lỗi sản phẩm. Lệnh chuẩn bị không reset các thao tác bạn đã thử.

## Bằng chứng

- [Trước khi chuẩn bị](evidence/ui-workflow-data-2026-10-27/before.json).
- [API đầu vào](evidence/ui-workflow-data-2026-10-27/producer.json).
- [Thao tác qua UI](evidence/ui-workflow-data-2026-10-27/browser-setup.json): 11 checkpoint PASS, không page error/HTTP 500.
- [DB sau chuẩn bị và sau chạy lại](evidence/ui-workflow-data-2026-10-27/database.json).
- [15 kiểm tra và 12 scan axe cuối](evidence/ui-workflow-data-2026-10-27/check-1793070568144/results.json).
- [Manifest bàn giao](evidence/ui-workflow-data-2026-10-27/delivery-check.json): frontend build/TypeScript PASS, formatting PASS; evidence không có DB secret/JWT. Còn warning Vite CJS/bundle lớn, không chặn build.
- [Mobile có dữ liệu](evidence/ui-workflow-data-2026-10-27/check-1793070568144/student-populated-mobile.png).
- [Dashboard có dữ liệu](evidence/ui-workflow-data-2026-10-27/after-faculty-dashboard.png).
- [Task của sinh viên](evidence/ui-workflow-data-2026-10-27/after-student-tasks.png).

Giữ các lượt FAIL ban đầu, gồm lỗi locator/context của harness và contrast trước sửa. Chỉ dùng lượt kiểm cuối cho trạng thái hiện tại.
