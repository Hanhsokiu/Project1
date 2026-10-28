# Frontend integration merge — fix/integration-ui vào feature/step-9-10

## Trạng thái và điểm khôi phục

- Repository thực tế: `E:\Project-Xaydungdoantotnghiep\DATN\Project1` (đường dẫn trong yêu cầu là `C:\DATN\Project1`).
- Nhánh nhận merge: `feature/step-9-10`; upstream: `origin/feature/step-9-10`.
- Commit trước merge: `0b4f400b1d59ca3711d3254bfaf40eaa9fee4b73`.
- Backup local đã có, được xác minh trỏ đúng HEAD: `backup/my-work-before-merge`.
- Nhánh nguồn/merge parent: `origin/fix/integration-ui`, `abdbfdd9b90729d5758a2fa4da2244fabbe15eeb`.
- Merge base: `0c361709df34837df65b3ed429691599e6e2d93f`.
- Đã fetch origin; nhánh cá nhân không ahead/behind upstream (`0 0`).
- Khi tiếp nhận: merge đã bắt đầu, 953 file mới và 53 file sửa được staged; 3 file còn conflict. Đã dừng theo mục A; người dùng cho phép tiếp tục merge đang dở. Không abort/reset/stash hoặc bắt đầu merge thứ hai.
- Commit sau merge và push: **PENDING** — cập nhật sau các kiểm tra cuối.

## Phạm vi và bảng đối chiếu

So sánh trực tiếp hai tip có 1.282 file khác nhau (953 A, 84 M, 245 D). Các mục D là code Bước 9–10 có trên nhánh cá nhân nhưng chưa có trên nhánh nguồn; không dùng diff này như chỉ thị xóa. Merge giữ toàn bộ 245 file đó; kiểm tra tồn tại cho kết quả 0 file thiếu. Phần lớn file A là bằng chứng kiểm thử Bước 4–8 đã được commit trên nhánh nguồn; đây là bằng chứng lịch sử, không phải kết quả chạy lại trong phiên này.

| Module/trang          | UI được chọn                                                                           | Logic/API được giữ                                                            | Trùng lặp và cách tích hợp                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Login/authentication  | `fix/integration-ui`: form và session phản ứng với login/logout/401                    | JWT, refresh, đổi mật khẩu bắt buộc, session API tách demo                    | Một login; giữ cả pathname và query khi quay lại workflow                                                        |
| Layout/sidebar/navbar | `fix/integration-ui`: `WorkspaceLayout`, CSS, menu mobile, focus/Escape, shared Button | Cảnh báo phạm vi học thuật của nhánh cá nhân                                  | Bỏ shell riêng Bước 4–8 theo nhánh nguồn; UC17–25 cũng dùng shell này                                            |
| Dashboard             | Dashboard chung kế thừa ở cả hai nhánh                                                 | Snapshot API và cảnh báo quyền của nhánh cá nhân                              | Giữ một route `/`; không tạo dashboard thứ hai                                                                   |
| Routes/guards         | Manifest và navigation của nhánh nguồn, bổ sung các route Bước 9–10 đang có            | Role guard, JWT, feature flags, kiểm tra permission/grant tại API             | Một manifest; `/grading/scores` redirect sang `/grading/reviewer`, giữ query; `/forbidden` không hydrate catalog |
| Đợt/SV/GV/đề tài      | Giao diện chung và cải tiến đề tài/đề cương của nhánh nguồn                            | API term/catalog/registration và phạm vi học thuật nhánh cá nhân              | Các route quản lý giữ nguyên; trang chi tiết Bước 4–8 dùng shell chung                                           |
| UC17 + PDF cuối       | Shell/theme của nhánh nguồn + nội dung nghiệp vụ nhánh cá nhân                         | Inbox, PDF thực, quyết định GVHD, lịch sử, revision, loading/error, ownership | `/guidance/defense-confirm`, `/guidance/final-report`; không hydrate roster demo                                 |
| UC18                  | Shell chung + trang đối soát của nhánh cá nhân                                         | API danh sách, preview, nguồn học vụ, finalization/reopen, CAS                | Một `/defense/eligibility`; API/demo được chọn rõ bằng flag                                                      |
| UC19                  | Shell chung + trang lập hội đồng của nhánh cá nhân                                     | Planning context, draft, preview, chốt hội đồng và provenance                 | `/defense/committees` trong một PlanningWorkspace                                                                |
| UC20                  | Shell chung + trang phản biện của nhánh cá nhân                                        | Phân công/chốt phản biện, nguồn UC18, revision                                | `/defense/reviewers` dùng lại PlanningWorkspace                                                                  |
| UC21                  | Shell chung + trang lịch của nhánh cá nhân                                             | Draft/finalize/publish/amendment, lịch công bố có scope                       | `/defense/schedule`, `/defense/published`; route công bố chỉ có menu khi API tương ứng bật                       |
| UC22                  | Shell chung + form phản biện của nhánh cá nhân                                         | Rubric, validation, câu hỏi, lưu/chốt phiếu theo phân công                    | `/grading/reviewer`; route scores cũ chỉ redirect                                                                |
| UC23                  | Shell chung + form hội đồng của nhánh cá nhân                                          | Phiếu thành viên, cửa sổ chấm, revision/CAS                                   | `/grading/committee`; điều hướng phụ lọc theo cùng manifest                                                      |
| UC24                  | Shell chung + tổng hợp/kết quả/policy của nhánh cá nhân                                | Tách tổng hợp, chốt, công bố; nguồn điểm và policy chưa duyệt vẫn chặn        | `/grading/results`, `/grading/policy`; không tự mở công bố                                                       |
| UC25                  | Shell chung + xuất dữ liệu chính thức của nhánh cá nhân                                | File private từ backend, permission/scope/audit, dữ liệu đã công bố           | `/report/official` giữ riêng với `/report/export` vốn phục vụ biểu mẫu Bước 1–3                                  |

Đánh giá UI ở đây là quyết định tái sử dụng theo yêu cầu: nhánh nguồn có shell thống nhất và xử lý mobile tốt hơn; nhánh cá nhân có nghiệp vụ Bước 9–10 đầy đủ hơn. Các trang chưa có bản tương ứng trên nhánh nguồn được giữ và gắn vào shell, không bị thay bởi mock.

## Thiết kế tích hợp

- `AcademicWorkflowLayout` dùng cùng `WorkspaceLayout` và session phản ứng từ nhánh nguồn. `sessionWorkspace` chỉ tạo metadata trình bày từ tài khoản API; mọi tập dữ liệu nghiệp vụ rỗng, không gọi `readDb`/seed/demo hoặc tải catalog để dựng sidebar.
- UC17–25 giữ bộ chọn đợt/input theo API riêng. Ẩn bộ chọn đợt toàn cục trên các route này để không đưa danh sách đợt rộng hơn grant vào workflow hoặc khiến hai bộ chọn lệch nhau. Context/revision/CAS vẫn do module nghiệp vụ sở hữu.
- Bước 4–8 tái sử dụng cùng helper metadata, tiếp tục lấy options/notifications từ API của nhánh nguồn.
- Giữ nguyên API clients UC17–25, kiểm tra 401/403/409, loading/error và feature flags. Khi lỗi API không có chuyển sang demo. Session hết hạn chuyển về login qua subscription chung; role sai chuyển tới trang 403 mà không gọi catalog.
- Chỉ một phần tử `main` và một sidebar trên trang workflow. Nội dung UC17–25 dùng `section` bên trong shell; không còn layout trang độc lập song song.
- Route API/demo loại trừ nhau theo flag. Demo vẫn là chế độ thử nghiệm được cấu hình rõ, không phải phương án fallback. Không xóa chức năng demo hoặc test có giá trị.

## Conflict và bảo toàn backend

| File conflict                                  | Giải quyết                                                                                                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/app/layouts/WorkspaceLayout.tsx` | Giữ layout/children của nhánh nguồn và `academicAccessWarnings` của nhánh cá nhân; thêm khả năng ẩn term picker cho workflow scoped                             |
| `frontend/src/app/router/routes.tsx`           | Giữ `Notice`, UC17–25 và lazy routes của nhánh cá nhân; dùng `useApiSession` của nhánh nguồn; gắn shell và hợp nhất alias                                       |
| `backend/prisma/seed.cjs`                      | Giữ toàn bộ seed permission Bước 9–10; bổ sung duy nhất `proposal:reopen` cho FACULTY, đúng với migration/lifecycle đã có trên nhánh nguồn; không thực thi seed |

Không chọn nguyên file ours/theirs cho router, auth, API clients, package hoặc lockfile. Package/lockfile đã auto-merge và cài thành công bằng `pnpm install --frozen-lockfile --ignore-scripts`. Prettier chỉ chuẩn hóa các file code/config thay đổi; không nâng version dependencies. Lockfile giữ định dạng do pnpm tạo, không reformat bằng Prettier.

Đối chiếu với HEAD trước merge xác nhận không đổi schema Prisma và các module backend defense, grading, official report, UC17, final reports, term, security, UC18 finalization; shared contracts defense/planning/grading và exports cũng được giữ. Các migration cũ không bị sửa/xóa. Giữ bảo vệ ba endpoint C01, audit, revision/CAS và provenance.

Backend/shared tiếp nhận có chọn lọc các thay đổi Bước 4–8 đã đi kèm nhánh nguồn: lifecycle đề cương (guard permission + academic grant + revision), PDF preview/lịch sử, trường liên hệ tùy chọn trong snapshot, thông báo giao/nộp nhiệm vụ, xử lý JSON lớn chỉ tại endpoint lưu phiên bản và lỗi 413. Migration mới `202610280001_proposal_lifecycle` chỉ được giữ như source code, **NOT EXECUTED**. Quyền reopen là thay đổi của nhánh nguồn, không phải wildcard hoặc quyền ADMIN mới.

## Kiểm thử

| Kiểm tra                                                            | Kết quả                                                                      |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Cài đúng lockfile, bỏ lifecycle scripts                             | PASS                                                                         |
| Shared TypeScript: `pnpm --filter @doan/shared build`               | PASS                                                                         |
| Frontend TypeScript + Vite: `pnpm --filter @doan/frontend build`    | PASS; có cảnh báo bundle lớn, không lỗi build                                |
| Backend TypeScript: `pnpm --filter @doan/backend exec tsc --noEmit` | PASS                                                                         |
| Frontend unit tests                                                 | PASS — 37 files, 386 tests                                                   |
| Backend unit/HTTP tests với repository giả lập                      | PASS — 83 files, 1.320 tests; loại trừ integration specs                     |
| `pnpm -r lint`                                                      | PASS frontend/backend                                                        |
| TypeScript Playwright                                               | PASS                                                                         |
| Prettier code/config thay đổi                                       | PASS; baseline toàn repository không được format đại trà                     |
| Prisma validate                                                     | PASS; dùng URL giả localhost port 1 chỉ để validate schema, không kết nối DB |
| `git diff HEAD --check`                                             | PASS với attributes cho artifact lưu trữ nêu bên dưới                        |
| Playwright API mock                                                 | PASS — 25 tests; output mới `test-results/merge-api-final`, reporter list    |
| Playwright demo                                                     | PASS — 10 tests                                                              |
| PostgreSQL E2E, migration, seed, db push/reset, Docker              | NOT RUN theo yêu cầu                                                         |

Các browser test mới kiểm tra login quay lại đúng query, một shell cho UC17–25, menu không trùng/thiếu, không gọi catalog hoặc demo để dựng sidebar, role guard, alias scores, mobile Escape/focus/đổi trang và chuyển từ Bước 4–8 sang Bước 10. Giữ các test validation, 403, lỗi mạng, 409, revision và không tự retry/save. Assertion 401 được cập nhật từ thông báo inline sang kiểm tra redirect login, session bị xóa và đúng một request; không bỏ test.

Các script browser sử dụng localhost, API mock, chặn request bên ngoài và Vite trả 503 cho mọi API chưa được mock. Kết quả này không chứng minh tích hợp PostgreSQL hoặc policy production đã được duyệt.

`git diff --check` ban đầu phát hiện dòng chỉ có dấu cách trong 7 file text trích xuất PDF và dòng trống EOF trong 3 báo cáo lịch sử từ nhánh nguồn. `.gitattributes` giới hạn ngoại lệ whitespace vào text PDF lưu trữ và đúng 3 file báo cáo đó để bảo toàn nội dung/hash evidence; code sản phẩm không có ngoại lệ. Không sửa các manifest bằng chứng hoặc coi bằng chứng lịch sử là lần chạy hiện tại.

## Giới hạn nghiệp vụ và vận hành

- UC24 production vẫn phụ thuộc các nguồn GVHD/xác nhận tập thể và policy đã được duyệt. Các adapter Unknown và trạng thái BLOCKED được giữ; không lấy fixture PASS làm phê duyệt công bố.
- Các blocker học vụ, source UC18–21, quorum, cửa sổ workflow, amendment/sửa sau chốt và mẫu xuất chưa được duyệt tiếp tục theo backend hiện có; không đổi policy để vượt qua kiểm thử.
- Chưa chạy migration bổ sung trên DB; khả năng dùng lifecycle mới trong môi trường thật cần deployment được duyệt riêng.
- Không kết nối PostgreSQL; không mở endpoint C01; không chạy seed/migration/reset/db push/Docker; không tạo PR; không sửa/push nhánh nguồn, main hoặc develop.
- Các dependency/chromium cần quyền mạng để tải. Lần browser đầu có 24 PASS và 1 assertion 401 theo hành vi cũ; đã cập nhật assertion. Windows từng treo dọn Vite và lỗi unlink artifact cũ; kết quả cuối phải dựa trên lần chạy hoàn tất được ghi ở bảng trên.

Đã kiểm tra trực quan desktop 1440×1000 và mobile 375×812 trên Vite API cách ly: một shell, nội dung vừa màn hình. Nhóm menu theo thứ tự Tổng quan → quản lý → hướng dẫn → bảo vệ → điểm/kết quả, icon gắn với tên nhóm thay vì vị trí trong mảng.
