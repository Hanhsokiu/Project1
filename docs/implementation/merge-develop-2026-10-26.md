# Tích hợp develop vào feature/step-4-8 — 26/10/2026

## Trạng thái Git và phạm vi

- Nhánh làm việc: `feature/step-4-8`.
- HEAD giữ nguyên: `102a64f` — `fix: retry review group transaction conflicts`.
- Nguồn merge: `origin/develop`, `02f2540` — merge PR #3 của bước 1–3.
- Khi bắt đầu kiểm tra, workspace sạch, chưa có `MERGE_HEAD`. Sau khi fetch phát hiện develop mới; đã chạy `git merge --no-commit --no-ff origin/develop` để thực hiện yêu cầu.
- Đã xử lý 14 file conflict; không chọn hàng loạt ours/theirs, không reset, không tạo commit, không push, không sửa nhánh main/develop và không merge PR.
- Merge được giữ ở trạng thái đã giải quyết conflict, chờ người dùng review và commit.

## 14 file conflict và cách kết hợp

| File | Cách kết hợp |
| --- | --- |
| `backend/.env.example` | Giữ cấu hình upload riêng tư bước 8B và thêm SMTP/email worker bước 3. |
| `backend/package.json` | Giữ tất cả script API/upgrade/browser bước 4–8, thêm script bước 1–3; giữ cả PDFKit/pdfjs và Playwright/pdf-parse. Thêm sinh client lịch sử vào `pr2b:generate`. |
| `backend/prisma/schema.prisma` | Giữ các model, relation và index workflow bước 4–8; thêm schema bước 1–3. Tại `TermStudent` giữ `pr2bDossierStudentProfile` và kiểu timestamp từ develop. |
| `backend/scripts/foundation-check.cjs` | Giữ kiểm tra byte migration/baseline và hợp đồng PR2B bất biến; dùng danh sách thay đổi cardinality/enum bước 1–3 được liệt kê tường minh. |
| `backend/scripts/replay-active-chain.cjs` | Kết hợp replay có dữ liệu cũ với kiểm tra toàn bộ migration thực tế và checksum. |
| `backend/src/notification/controller/notification.controller.ts` | Giữ API cũ `/notifications/user/:userId`, `/me/notifications`, API đánh dấu đọc; thêm `/notifications/me`, đọc tất cả và email outbox/retry. Mỗi đường dẫn giữ kiểm tra người nhận/quyền tương ứng. |
| `backend/src/notification/notification.module.ts` | Đăng ký repository, service, validator và `EmailWorkerService`. |
| `backend/src/notification/repository/notification.repository.ts` | Giữ phân trang/đọc thông báo của chính mình; thêm email outbox, lease, claim, retry, sent/failed. Đặt tên `outbox` riêng để tránh trùng phương thức `list`. |
| `backend/src/notification/service/notification.service.ts` | Kết hợp thông báo cá nhân, kiểm tra tài khoản hiện tại và email outbox; không bỏ kiểm tra sở hữu của API cũ. |
| `backend/src/topic/topic.module.ts` | Giữ mọi controller/provider của nhóm duyệt, xét duyệt, phiên bản, hồ sơ/PDF; thêm `TopicRepository`, `ProposalPdfService`, import `RegistrationModule` và `TermModule`. |
| `backend/tsconfig.json` | Giữ alias shared trỏ tới `shared/dist` để backend build không kéo mã shared ngoài `rootDir`; các alias module vẫn đầy đủ. |
| `frontend/src/app/router/routes.tsx` | Giữ workspace, đăng nhập và route bước 1–3; giữ đầy đủ route bước 4–8; tách các màn hình trùng URL, thêm guard cho workflow và sắp thứ tự lazy imports để tránh trang trắng. |
| `pnpm-lock.yaml` | Kết hợp dependency của hai nhánh, chạy pnpm để xác nhận lockfile; frozen install từ cache đã qua. |
| `shared/src/index.ts` | Export đồng thời `step1`, `step2`, academic context và toàn bộ contract bước 4–8; dùng schema đăng ký mới từ develop. |

Các file tự merge từ develop vẫn được giữ. Danh sách đầy đủ thay đổi so với HEAD nằm tại [changed-files.txt](evidence/merge-develop-2026-10-26/changed-files.txt).

## Sửa tương thích ngoài các marker conflict

### Phân công và bàn giao đề cương

Theo lựa chọn của người dùng, công bố vẫn tạo trạng thái `PUBLISHED`. Thêm thao tác riêng:

```text
POST /assignments/term/:termId/finalize
{ "revision": <revision hiện tại> }
```

Thao tác này kiểm tra quyền quản lý phân công, trạng thái/thời gian/khóa đợt, revision, tính hợp lệ của phương án và phương án chính thức hiện tại. Sau đó ghi `FINALIZED`, `AssignmentPlanWorkflow.finalizedAt/finalizedByUserId`, `TermWorkflow.officialAssignmentPlanId` và audit trong một transaction. Gửi lại không tạo thêm audit chốt. Frontend có nút và xác nhận riêng.

`Registration.advisorAssignment` trước đây là relation đơn; develop đổi thành `advisorAssignments` để một đăng ký có lịch sử ở nhiều phương án. Truy vấn bước 4–8 đã đổi sang collection và chọn theo phương án chính thức; không lấy phần tử đầu của một phương án nháp. Validator vẫn yêu cầu đủ trạng thái FINALIZED và bằng chứng chốt trước khi cấp quyền nghiệp vụ.

Giữ hai giao diện đề cương:

- `/topic/draft`: soạn/thống nhất đề cương bước 3.
- `/topic/overview`: tổng quan hồ sơ bước 3.
- `/topic/proposal` và các route con: phiên bản, phản hồi và nộp xét duyệt bước 6.
- `/topic/dossier` và các route con: chốt hồ sơ/bản giấy bước 7.

Thêm `POST /topics/:id/prepare-workflow` và nút bàn giao trên màn hình bước 3. Chỉ chủ thể SV/GVHD được ghi theo quy tắc bước 3 mới thực hiện được. Cần phân công đã chốt chính thức. Hệ thống giữ nguyên snapshot nguồn, tạo bản nháp mới với provenance và counter; không biến bản nộp bước 3 thành một bản SEALED được suy đoán. Nội dung chính, ngày và các mốc chưa có phải được người dùng bổ sung. Sau bàn giao, API sửa bước 3 từ chối ghi để không đi vòng qua kiểm soát phiên bản/hồ sơ.

### Quyền truy cập, notification và ID

- JWT của develop yêu cầu session `sid` tồn tại, chưa bị thu hồi và chưa hết hạn. Giữ yêu cầu này. Tài khoản bị khóa có session hợp lệ nhận 403; token/session không hợp lệ nhận 401.
- Seed mới cấp đúng các quyền workflow cho FACULTY/LECTURER/STUDENT sau khi role được tạo; không thêm ADMIN wildcard cho bước 4–8.
- Route manifest bao phủ các route bước 4–8. Trang chi tiết nhận xét cho phép SV/GV/Khoa xem theo quyền đọc; thao tác đánh giá vẫn do API kiểm tra quyền GVHD và phạm vi dữ liệu. Live E2E xác nhận người khác không xem được nội dung của chủ hồ sơ.
- Giữ cả API notification cũ/mới; PATCH đọc thông báo của bước 3 vẫn trả `{ updated: 1 }`, API bước 8 giữ trả bản ghi thông báo.
- Thêm `EntityIdPipe` cho hai API danh sách đề tài/đăng ký theo đợt: bảng học thuật cũ dùng VARCHAR và có ID nhập khẩu không phải UUID. Vẫn kiểm tra ID không rỗng, độ dài và quyền truy cập, không làm mất khả năng đọc dữ liệu cũ.
- Cấu hình test frontend chạy cả `.test.ts`, `.spec.ts`, `.spec.tsx`, tránh bỏ sót bộ test bước 4–8.

## Database và migration

- Có 12 migration active sau merge. Giữ nguyên byte của 10 migration có sẵn trên HEAD.
- Hai migration từ develop được giữ nguyên, không chỉnh sửa migration đã phát hành:
  - `202610260001_step1_3_enum_values`.
  - `202610260002_integrate_step1_3`.
- Hai migration thêm các enum đăng ký/import, `AcademicSemester`, `EmailOutbox`, trường profile/import/term/proposal, index, FK và CHECK; backfill `Proposal.termId` từ Topic và semester từ dữ liệu đợt.
- Unique toàn cục theo sinh viên/đăng ký được thay bằng unique theo đợt/phương án theo thiết kế develop. Các model/metadata workflow, snapshot, file riêng tư, nhận xét, hồ sơ và lịch sử bước 4–8 được bảo toàn.
- Không thêm migration mới để tự suy đoán ownership, phê duyệt, biên nhận hoặc dữ liệu học thuật.
- `backend/prisma/review/steps4-8/schema.prisma` là schema lịch sử lấy từ `102a64f`, chỉ sinh client cho test nâng cấp ở thời điểm trước migration bước 1–3. Đây không phải schema runtime hay migration mới.
- Tất cả thao tác migration/seed/DDL kiểm thử chỉ chạy trên PostgreSQL 17.11 riêng ở loopback, các database `btl_pr2b_*`; không áp dụng lên database chia sẻ hoặc database trong `.env`.

## Kiểm chứng

| Kiểm tra | Kết quả |
| --- | --- |
| Prisma validate | PASS |
| Typecheck shared/backend/frontend | PASS |
| Production build shared/backend/frontend | PASS |
| Unit test backend | 181/181 PASS |
| Unit test frontend, gồm test bước 4–8 | 115/115 PASS |
| Integration term/import/handoff bước 1–3 | 11/11 PASS |
| HTTP bước 1 | 11 nhóm PASS |
| HTTP bước 2 | 11 nhóm PASS |
| API bước 4, 5, 6, 7, 8A, 8B, 8C | 154 kiểm tra PASS |
| Nâng cấp populated baseline từng bước 4–8 | 7/7 suite PASS |
| Browser smoke từng bước 4–8, mock API | 74 kiểm tra, 7/7 suite PASS |
| Live browser + NestJS + PostgreSQL + private files | 15 checkpoint PASS |
| Live E2E tổng hợp, gồm auth inventory/PDF/bảo toàn dữ liệu | PASS |
| Actual active-chain trên dữ liệu legacy, checksum và client chuẩn | PASS |
| Foundation/PR2B contract và migration integrity | PASS |
| pnpm frozen install, không chạy lifecycle script | PASS |

Bằng chứng nằm trong [evidence/merge-develop-2026-10-26](evidence/merge-develop-2026-10-26). Các artifact lịch sử của bước 4–8 được Git quản lý đã được giữ nguyên; không ghi đè báo cáo cũ bằng kết quả mới.

Test chỉ được cập nhật ở fixture/contract thực sự đổi: JWT có session, relation và khóa ghép phân công, trường term bắt buộc, client đọc schema lịch sử, danh sách migration chính xác, quyền đọc bước 1–3, locator giao diện và envelope phân trang mới. Các kiểm tra từ chối truy cập, chống sửa snapshot, rollback, revision, audit và bảo toàn dữ liệu vẫn được giữ. Có thêm integration regression cho thao tác chốt riêng và bàn giao đề cương.

## Giới hạn và việc vận hành cần lưu ý

1. Chưa chạy GitHub Actions trên remote; các kết quả trên là kiểm tra cục bộ Windows/Edge/PostgreSQL 17.11. Chưa commit hoặc push.
2. Chưa kiểm thử gửi email SMTP/MailHog thật trong lần merge này. Đã giữ nguyên cơ chế outbox/claim/lease/retry của develop và kiểm tra module khởi động được.
3. Đợt thật vẫn cần cấu hình grant theo đợt/bộ môn, ánh xạ hướng nghiên cứu → bộ môn, phase workflow `PROPOSAL_EDIT`/`PROPOSAL_REVIEW`/`GUIDANCE`, hồ sơ lớp/ngành và nghĩa vụ báo cáo theo quy định. Merge không tự cấp quyền toàn bộ hoặc đoán thời gian/ownership/phê duyệt. Những dữ liệu này thiếu sẽ tiếp tục báo lỗi readiness thay vì tự tạo bằng chứng học thuật.
4. Trước khi áp migration lên database chia sẻ cần kiểm tra dữ liệu hiện có với các CHECK/unique mới (GPA, quota, thời gian, nguyện vọng/phương án). Không tự xóa hoặc sửa dữ liệu thật để vượt constraint.
5. Build có cảnh báo bundle frontend lớn và Vite CJS deprecated; component smoke có cảnh báo SSR `useLayoutEffect`. Các cảnh báo không làm build/test thất bại.
6. Báo cáo `06-final-review.md` là đánh giá lịch sử trước khi tích hợp develop; không dùng các số dòng/evidence cũ làm trạng thái của bản merge hiện tại.
7. `git diff --cached --check` sạch trên backend, frontend/src, shared và lockfile. Kiểm tra toàn merge còn cảnh báo trailing whitespace trong tài liệu trích xuất/prototype design và script dữ liệu nhập từ develop; các artifact đó được giữ nguyên.

Sau khi review các thay đổi và cấu hình dữ liệu thật, người dùng có thể tự tạo merge commit trên `feature/step-4-8`. Không có lệnh commit/push tự động trong công việc này.
