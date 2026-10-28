# Đồng nhất giao diện và sửa lỗi bước 4–8

Người dùng ngày 27/10/2026 đã cho phép sửa source: lấy giao diện bước 1–3 làm chuẩn và sửa lỗi thuộc bước 4–8. Chỉ dẫn audit only trước đó áp dụng cho snapshot QA lịch sử, không chặn công việc sửa hiện tại.

Nhánh `fix/integration-ui`; không commit/push/merge, không sửa nhánh main/develop. Giữ các thay đổi setup đã có trước. Chỉ kiểm thao tác ghi trên PostgreSQL test loopback, không Supabase.

## Thay đổi đã triển khai

- Dùng WorkspaceLayout của bước 1–3 cho mọi màn 4–8, bỏ sidebar/header riêng.
- Menu theo role/manifest; ẩn mục menu soạn/hồ sơ ban đầu trùng, giữ đường dẫn cũ và luồng bàn giao. Hồ sơ đã bàn giao mở đúng phiên bản. Chỉ một mục thông báo trong menu, hỗ trợ link vào hồ sơ từ hộp thư chung.
- Session thay đổi phát sự kiện reactive để route guard phản ứng ngay khi 401/refresh thất bại.
- JSON parser riêng cho POST phiên bản đề cương, giới hạn 32 MiB đủ DTO hiện tại kể cả escaped text; các route khác giữ 100 KiB. Oversize trả 413, không 500. Không hạ giới hạn ký tự trong shared contract để né lỗi.
- Notice giao task/tuần, bài nộp, nộp đề cương và kết luận review được ghi trong cùng transaction/idempotency của lệnh; outbox hiện có được bảo toàn. Không gửi SMTP thật hoặc tự thêm worker email.
- Sửa ARIA/contrast và dùng button chuẩn chung.

Các màn workflow chỉ lấy metadata người dùng, đợt và thông báo bằng API có scope để dựng khung chung. Không gọi toàn bộ snapshot danh mục bước 1–3, không cấp thêm quyền để vượt lỗi 403, không lấy dữ liệu demo thay cho API. Form, bộ lọc và các lệnh nghiệp vụ tiếp tục dùng API canonical của từng bước.

## File ứng dụng đã xử lý

Đường dẫn dưới đây tính từ gốc repository; hash của từng file ứng dụng thay đổi nằm trong `evidence/integration-ui-fixes-2026-10-27/delivery-check.json`.

| Nhóm | File | Cách kết hợp và mục đích |
| --- | --- | --- |
| Khung chung | `frontend/src/app/layouts/WorkspaceLayout.tsx`, `shared/hooks/use-workspace.tsx` | Tái sử dụng sidebar/header/context bước 1–3; nhận metadata workflow khi cần; giữ nhánh snapshot cũ cho màn bước 1–3. Menu mobile đóng bằng Escape và có ARIA controls. |
| Workflow | `frontend/src/features/review-groups/workspace.tsx`, `workspace.css`, `shell-data.ts` mới | Thay shell riêng bằng khung chung; giữ nội dung, tìm kiếm, mode, Outlet và query đợt. CSS còn lại phục vụ các component workflow. |
| Routing | `frontend/src/app/router/route-manifest.ts`, `routes.tsx`, `features/topic/pages/MyTopicPage.tsx` | Một nguồn menu/role; ẩn mục trùng nhưng giữ route cũ. Hồ sơ `workflowReady` mở editor phiên bản; hồ sơ trước bàn giao vẫn dùng luồng thống nhất ban đầu. Không thêm nghiệp vụ bước 9–10. |
| Phiên đăng nhập | `frontend/src/shared/api/api-session.ts`, `shared/hooks/use-api-session.ts` mới | Phát sự kiện khi token/user bị xóa hoặc thay đổi; guard cập nhật ngay sau refresh thất bại. |
| UI/accessibility | `frontend/src/index.css`, `shared/components/ui/Button.tsx`, `features/review-groups/components.tsx` | Dùng Button chung; màu chữ phụ rõ hơn; container thành viên có role group hợp lệ. |
| Hộp thư | `frontend/src/features/auth/pages/NotificationsPage.tsx`, `shared/data/snapshot-api.ts`, `shared/data/types.ts` | Bảo toàn tab theo dõi email bước 3; thêm link hồ sơ cho thông báo cá nhân. Menu dùng một trung tâm thông báo. Route hộp thư cũ vẫn hoạt động. |
| HTTP | `backend/src/main.ts`, `common/http/body-parsers.ts` mới, `common/exception/global-exception.handler.ts` | Parser hữu hạn theo đúng endpoint; nhận diện chính xác `entity.too.large` và trả envelope 413, không lộ lỗi nội bộ. |
| Notification repository | `backend/src/topic/proposal-reviews/proposal-review.repository.ts`, `guidance/reviews/progress-review.repository.ts` | Đưa thao tác notify vào session transaction chung; bỏ override trùng trong session kế thừa. |
| Notice nghiệp vụ | `backend/src/topic/proposal-reviews/proposal-review.service.ts`, `topic/proposal-versions/proposal-version.service.ts`, `guidance/tasks/guidance.service.ts`, `guidance/submissions/submission.service.ts`, `guidance/reviews/progress-review.service.ts` | Kết luận review → SV và GVHD; nộp đề cương/báo cáo → GVHD chính thức; giao task/tuần → SV; bổ sung termId cho notice đánh giá. Tất cả trong transaction/idempotency hiện có. |
| Regression mới | `backend/src/common/http/body-parsers.spec.ts`, `common/exception/global-exception.handler.spec.ts`; `backend/scripts/test-integration-ui-fixes.cjs`, `test-workflow-remediation.cjs`; `frontend/scripts/test-unified-workspace.cjs`, `test-large-proposal.cjs` | Thêm kiểm thử có ý nghĩa cho transport, UI thật, recipient, retry, rollback và đề cương dài. Không sửa assertion các bộ API/browser nguồn để ép PASS. |

README, package/lockfile và các script setup UI local đã có thay đổi từ trước lượt sửa này; được giữ lại. Không thay đổi dependencies backend/frontend để giải quyết các lỗi trên.

## Database và tương thích

- Không thay `schema.prisma`, migration, enum, relation, index hoặc shared API contract. Không có migration mới phải chạy cho bản sửa này.
- Notification dùng bảng hiện có và cùng transaction với lệnh chính. Không ghi task/version thành công dở nếu ghi notice hoặc bước sau thất bại.
- Giữ CAS/revision, snapshot và review bất biến, permission/scope, kiểm tra giai đoạn, outbox events và lịch sử cũ.
- Giữ `PUBLISHED` riêng thao tác chốt `FINALIZED` và metadata bàn giao đã thống nhất; không thay logic bước 3.
- Test tạo DB tổng hợp mới `btl_pr2b_audit_*` trên PG17 loopback. Không reset/drop database, không deploy lên Supabase. Test fault injection chỉ đặt trigger tạm trên DB riêng và gỡ trong finally.

## Kết quả xác minh

| Kiểm tra | Kết quả / bằng chứng |
| --- | --- |
| Prisma validate | PASS, schema canonical; dùng URL kiểm tra local, không kết nối production |
| `pnpm type-check` | PASS backend/frontend và build shared |
| `pnpm build` | PASS shared/backend/frontend |
| `pnpm test` | Backend **186/186**, frontend **115/115** PASS; có 5 regression mới cho parser/filter |
| API/DB bước 4–8 | **154 nhóm scenario PASS**, theo bước 31/27/24/19/19/17/17; [lượt cuối](evidence/integration-ui-fixes-2026-10-27/20261027020326_8e5346/run-summary.json) |
| Luồng Edge → Vite → Nest → PG17 | **15 checkpoint PASS**, DB mới, không mock API; PDF thật, snapshot bước 1–3 không bị sửa; [kết quả](evidence/integration-ui-fixes-2026-10-27/20261027020326_8e5346/live-e2e/live-e2e.json) |
| Auth/scope | 71 operation inventory kiểm anonymous/no-permission; 4 probe legacy writer; xem JSON trong cùng thư mục live-e2e |
| UI chung | **10 kiểm tra PASS**, 3 vai trò giáo vụ/GV/SV, desktop và mobile 390 px; một shell/menu, hộp thư chung, Escape và 401 → login; [kết quả](evidence/integration-ui-fixes-2026-10-27/ui-1793066763199/results.json) |
| Axe | **0 violation trên 4 màn đã scan**: danh sách nhóm, form nhóm, tasks và proposal; không suy thành WCAG toàn ứng dụng |
| Recipient/retry/rollback và UTF-8 | **8 kiểm tra PASS**: đúng 10 notice sau E2E, decision/task/weekly replay, lỗi sau notify, API 110.377 byte, hard cap 413 và browser lưu/reload đề cương 110.450 byte; [kết quả](evidence/integration-ui-fixes-2026-10-27/20261027020326_8e5346/remediation-1793066855102/results.json), [browser](evidence/integration-ui-fixes-2026-10-27/20261027020326_8e5346/remediation-1793066855102/large-proposal-ui.json) |
| Diff/marker | `git diff --check` PASS; không còn conflict marker trong source đã rà |
| Bàn giao evidence | Đã loại cache/runtime của test, giữ JSON/log/PDF/screenshot; scan 127 file evidence không thấy mật khẩu DB local, JWT hoặc URL DB chứa credentials. [Manifest và 28 source hash](evidence/integration-ui-fixes-2026-10-27/delivery-check.json) |

Build còn cảnh báo Vite CJS API và bundle lớn; unit smoke render có warning useLayoutEffect/SSR. Các lệnh kết thúc thành công. Lần build bị `spawn EPERM` trong sandbox được chạy lại với quyền thực thi công cụ local và đã PASS. Lượt E2E đầu phụ thuộc sai catalog permission được giữ nguyên bằng chứng FAIL; sửa bằng adapter metadata, lượt cuối toàn bộ PASS.

## Trạng thái lỗi QA cũ sau sửa

| ID | Trạng thái hiện tại |
| --- | --- |
| QA-001 | FIXED: authenticated API dài 201; browser lưu rồi reload giữ đúng nội dung; quá hard cap 413 và không append dở. |
| QA-002 | FIXED trong các vai trò đã kiểm: menu lấy từ manifest/role, backend guard giữ nguyên. |
| QA-003 | FIXED navigation: bỏ link tĩnh tới route chưa tồn tại. Không coi nghiệp vụ consumer 9–10 đã được triển khai. |
| QA-004 | FIXED trên 4 màn axe đã scan sau sửa; phần còn lại chưa kiểm đầy đủ. |
| QA-005 | FIXED: selected-members group hợp lệ, form axe không còn lỗi ARIA này. |
| QA-006 | FIXED: clear session làm guard redirect login ngay; đã kiểm browser với access/refresh invalid. |
| QA-007 | Đã thêm notice giao task, tuần và nộp báo cáo, đúng current recipient, có kiểm retry/rollback. |
| QA-008 | Đã khắc phục thông báo **trong app** ngay trong transaction submit/decision; outbox cũ được giữ. Worker tiêu thụ OutboxEvent để gửi email vẫn chưa triển khai; không gọi trạng thái outbox pending là email đã gửi. |

## Giới hạn còn lại và cách xem

- Withdraw/return-to-draft, reopen/rebase và criteria/điểm giai đoạn FR25 vẫn là các gap nghiệp vụ đã công bố trong [báo cáo thiếu chức năng](../qa-step-4-8/13-missing-features.md). Chưa tự quyết transition hoặc công thức điểm mới. Bước 9–10 do phần khác phụ trách.
- Không có xác minh SMTP thật, Supabase/production, CI remote, load/memory, screen reader toàn ứng dụng hoặc toàn bộ modal. Chưa chạy mới 7 suite upgrade populated-baseline trong lượt sửa UI này; replay chuỗi migration active trên DB mới có trong API/E2E.
- Nội dung chưa bấm lưu khi phiên kết thúc không được cam kết tự khôi phục; snapshot đã lưu vẫn ở server. Không tự thêm autosave server vào nghiệp vụ manual snapshot.
- **Cập nhật sau phản hồi màn trống:** đã thêm đợt DEMO 4–8 trên chính DB UI cổng 5173, thực hiện transition và tạo task/bài nộp qua API/UI thật. Đợt đăng ký cũ giữ nguyên. Xem [dữ liệu và link thao tác](integration-ui-workflow-demo.md); không dùng dữ liệu E2E riêng thay cho demo này.

Mở `http://127.0.0.1:5173`. Tài khoản `giaovu`, `gv001`, `sv001`, mật khẩu mẫu `Demo@2026`. Khi khởi động lại dùng `pnpm ui:dev`; nếu đã chạy, script chỉ báo địa chỉ và không mở server trùng. Xem thêm [hướng dẫn local](integration-ui-local.md).

Snapshot audit tại `docs/qa-step-4-8/` giữ kết quả lịch sử. Bằng chứng sửa ở `docs/implementation/evidence/integration-ui-fixes-2026-10-27/`; không ghi đè raw evidence audit. Chưa commit hoặc push.

Để chạy lại kiểm tra bổ sung: khởi động PostgreSQL local bằng `pnpm ui:dev`, rồi chạy `node backend/scripts/test-integration-ui-fixes.cjs` và `node backend/scripts/test-workflow-remediation.cjs` theo thứ tự. Supplemental runner chỉ dùng DB live-E2E tổng hợp vừa PASS và chạy một lần trên fixture đó; muốn lặp cần tạo lượt E2E mới, không reset DB cũ. Chạy UI local riêng bằng `node frontend/scripts/test-unified-workspace.cjs`.
