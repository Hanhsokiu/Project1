# Báo cáo hoàn thiện nền tảng cho nhóm ba người

Ngày: 2026-10-21. Thực hiện theo yêu cầu hoàn thiện phần nền để người 1 làm bước 1–3, người 2 làm bước 4–8, người 3 làm bước 9–10. Chỉ triển khai hạ tầng/schema/contracts/tooling; chưa implement workflow PR3 hoặc chức năng bước 4–8.

## 1. Kết quả bàn giao

**Có thể bắt đầu phát triển đồng thời trên local.** Active schema/client đã có model mở rộng; migration nằm trong cây chuẩn và được replay thực tế trên PostgreSQL17 riêng. Backend/frontend/shared compile, test và build thành công. Nest modules khởi động được trên database test, request students không token trả 401.

Đọc `03-team-development-guide.md` để chạy máy mới, chia file giữa ba người, xem contract bàn giao và điều kiện merge. Các contract PR1 không thay đổi. **Chưa chạy DDL lên Supabase chung**, không stage/commit/push; không tuyên bố production-ready hoặc zero drift.

## 2. Thay đổi thực tế

| Phần | Thay đổi |
|---|---|
| Prisma active | Kích hoạt 38 model/16 enum mới của SQL review vào `backend/prisma/schema.prisma`; tổng 94 model/27 enum. Giữ nguyên field/quan hệ/PK/unique của 56 model cũ, bao gồm Topic.proposals[], Student.proposal và unique Proposal.studentId |
| Migration | Thêm `202610210001_empty_baseline_bridge`, `202610210002_expand_workflow`, `migration_lock.toml`; giữ nguyên 0_init. Bridge chỉ chạy khi 56 bảng ứng dụng rỗng; expand additive, không backfill legacy |
| Line endings | SQL mới chuẩn LF và `.gitattributes` để checksum Windows/Linux ổn định; không thay câu lệnh SQL đã review. Không sửa line ending/bytes 0_init cũ. Guard history nhận đúng SQL với biến thể LF/CRLF, vẫn từ chối thay nội dung/unknown/failed migration |
| Compatibility | Legacy client tách riêng từ snapshot baseline vào node_modules/.pr2b-legacy. Kiểm old field/relation/enum bằng DMMF và payload types; kiểm active schema/SQL đúng bản đã rehearsal. Không lấy client mới so với chính nó rồi báo compatibility |
| Dev setup | `pnpm setup:dev` chỉ tạo env thiếu; sinh JWT secrets, không ghi đè env hiện có. `.nvmrc` khớp Node20 CI; không đổi dependencies/lockfile |
| Local database | Compose PG17 riêng, bind 127.0.0.1:55440, password/token ở ignored .env.team.local. Scripts init/up/status/migrate/dev/stop kiểm ownership/health/loopback, không dùng URL shared, không reset/xóa volume |
| Verify | `pnpm verify` generate clients, validate/schema compatibility, type-check ba workspace, lint backend/frontend, tooling guards, unit tests, build ba workspace. Không kết nối database hoặc DDL. Artifact tái sinh bằng Python chỉ cần cho người tích hợp schema, không bắt mỗi developer cài Python để verify hằng ngày |
| Integration tests | Thêm actual active-chain runner bằng canonical @prisma/client và migration repository, cùng smoke khởi động Nest. Giữ 29 SQL integration checks từ PR2B |
| Contracts | Thêm type-only CurrentUserResponse, OfficialAdvisorContext, TopicAgreement, SubmittedProposalContext, GuidancePeriodContext vào shared, export additive. Không tạo endpoint/producer giả |
| CI | PG17 job kiểm compatibility, rehearsal, active migration chain và Nest smoke; PG16 job cũ giữ. CI không dùng Supabase. Chưa chạy GitHub Actions từ máy này |
| Hướng dẫn | Thêm guide phân công, file chung, handoff và checklist PR; cập nhật README/root scripts; make seed dừng ở hướng dẫn vì chưa có Prisma seed được duyệt |

SQL Data API isolation vẫn là allowlist thu hồi privilege từ PUBLIC/anon/authenticated/service_role trên bảng ứng dụng; không sửa Supabase managed schemas. Không thử ACL Supabase thật bằng DDL. Frontend tiếp tục gọi Nest, auth/RBAC cũ không bị thay bằng Supabase Auth.

## 3. Migration/hash đang dùng

Hash bytes mới sau chuẩn hóa LF; hash lịch sử tại báo cáo 02c không dùng để deploy bản LF:

| Migration | SHA256 Windows worktree đã replay |
|---|---|
| 0_init, nguyên bản CRLF tại máy này | `533ffb3d89181a690ee6afbb15b9673d4f34dd5c75ecf542c596571cd1687504` |
| 202610210001_empty_baseline_bridge | `892d68d8e13c2c863e8786a841d3cbafa7603f3853ebbec35e979b919feec993` |
| 202610210002_expand_workflow | `933a053c2af980cb78d182d2a9b5fa915385374ea97a7948fae9de5d34b95503` |

0_init trong Git HEAD là LF, hash `5782fc7a04d884514644c59bf05a81d53970230c45a0e12713588cc8b6916563`; nội dung sau chuẩn hóa newline bằng bản Windows, không sửa migration cũ để đổi checksum. Foundation check dùng hash nội dung chuẩn hóa để chạy trên cả hai OS; actual migration history vẫn đối chiếu checksum bytes được áp dụng. Hai migration mới dùng LF nhất quán.

## 4. Validation thực tế

| Kiểm tra | Kết quả |
|---|---|
| pnpm setup:dev | PASS: giữ nguyên backend/.env và frontend/.env.local hiện có |
| pnpm db:local:init | PASS: tạo .env.team.local ignored, không in secret |
| Git ignore | PASS cho backend/.env, frontend/.env.local, .env.team.local |
| pnpm verify | PASS: Prisma validate/generate, compatibility check 56 model/11 enum cũ, type-check backend/frontend/shared, lint backend/frontend, unit/tooling tests, build cả ba workspace |
| Backend Vitest | 8/8 PASS |
| Frontend Vitest | 3/3 PASS |
| Database tooling guards | 9/9 PASS, gồm test LF/CRLF và từ chối nội dung SQL thay đổi |
| PR2B target guard | 1/1 PASS |
| Local Docker identity/config guards | 2/2 PASS |
| SQL rehearsal, bản LF cuối | 29/29 PASS trên database local mới; gồm rollback lỗi trước COMMIT, không rewrite false/ownership, cross-term, một review decision, CAS, weekly coverage, append-only |
| Diagnostic SELECT | 12 query READ ONLY trên fixture có dữ liệu; các count violations = 0 |
| Temporary Prisma chain, bản LF | PASS: ba history row finished, checksum đúng, deploy lại không pending; 95 base tables gồm history |
| **Active repository chain + canonical client** | PASS trên DB rỗng khác: deploy hai lần, checksum đúng, queries cũ của ba phạm vi và enum filter hoạt động, legacy false còn nguyên |
| Nest HTTP smoke | PASS: toàn bộ module khởi động, GET /api/students không token trả 401; app đóng sau test |
| DOCX | SHA256 vẫn `2afea1a8d2cc74c50a690f4fb91874c1c83bb3d2ad1fbdb2fadc1db49b808f1a`, không ghi đè thay đổi có trước |
| Docker build/up/dev:local end-to-end | **Chưa chạy** vì không có Docker khả dụng trên máy; không ghi PASS từ unit guards |
| CI Node20/pnpm9 trên GitHub | **Chưa chạy**; local thực tế Node24.13.1/pnpm12.14 |
| Supabase DDL/deploy/seed | **Không chạy** |

Portable PG17.11 được khởi động lại để test, bind loopback cổng 55439; các DB mới tách biệt và synthetic. Có một lần kết nối cổng 55439 bị từ chối vì portable khởi động bằng port mặc định; đã dừng đúng cluster và khởi động lại với explicit bind/port, sau đó các test cuối đều chạy thành công. Không thay service PostgreSQL khác hoặc kết nối shared để khắc phục.

Đã dừng đúng server portable sau lần kiểm thử cuối, giữ cluster/dữ liệu trong TEMP. `git diff --check` PASS; `git diff --cached --name-only` trống, không có file staged. Đã chạy `git status --short` và `git diff --stat` cuối phiên.

Kết quả máy đọc: `test-results.json`, `chain-results.json`, `active-chain-results.json`, `smoke-results.json` trong `backend/prisma/review/pr2b/`. Fixture không phải snapshot dữ liệu thật. Smoke không chứng nhận các workflow học thuật đã tồn tại; frontend hiện còn nhiều trang scaffold. Vite CJS/Node shell deprecation warning không làm test/build fail; chưa nâng dependency để xử lý cảnh báo.

## 5. Những phần còn thuộc chức năng của ba người

Không coi các mục sau là nền tảng đã implement:

- Người 1: current-user adapter sub→userId, trạng thái account/quyền hiện hành; producer official FINALIZED/assignmentRevision/history/handover; roster/phase/routing/grants; bootstrap tài khoản theo auth; UC11 agreement và cấu hình tuần/danh sách áp dụng.
- Người 2: endpoint/DTO/runtime policy theo PR1, immutable snapshot/submit/review/chốt hồ sơ, weekly materialization, task/submission/review amendment transaction, upload/outbox và history trong command. Trigger DB không thay thế policy hoặc tự tính lại toàn workflow.
- Người 3: API/handoff hồ sơ sang defense/grading/report, điều kiện bảo vệ và công thức điểm theo nguồn bước 9–10; không suy từ bool review cũ hoặc tự tạo điều kiện từ task PASS.

Các type shared mới là contract compile-time, không phải producer runtime. Handoff chi tiết và những file giao nhau đã chia tại guide §2–4. Không thay ngầm JSON cũ hoặc refactor business logic của các thành viên.

## 6. Giới hạn rollout cần giữ

Chưa chạy residual drift SQL. Native types/nullability/default/FK/onDelete cũ còn khác datamodel; SQL-only constraints/view/trigger cũng không được Prisma biểu diễn đầy đủ. Expand giữ compatibility và source SQL, không tự chuyển semantics cũ để ép zero diff. Người tích hợp phải review từng migration mới trên DB riêng, không lấy diff DB→Prisma làm migration tự động.

Việc giữ unique Proposal.studentId tạm thời là giới hạn multi-term đã được duyệt cho expand. Không bỏ unique/đổi Topic.proposals trong PR chức năng của một người. Schema nâng cấp tiếp và chuyển consumer cần PR contract riêng.

Nhóm có thể code/test local ngay. Supabase deploy vẫn cần approval riêng, kiểm read-only mới nhất, backup/recovery, xác nhận baseline rỗng và không consumer Data API bị ảnh hưởng. Trạng thái đã deploy của project chung không thay đổi trong phiên này. Không cần trả lời lại B01–B12/C01–C10 để bắt đầu code.

## 7. File thay đổi trong lần hoàn thiện này

- Thêm `.gitattributes`, `.nvmrc`, `.github/pull_request_template.md`, `compose.team-local.yml`, `scripts/setup-dev.cjs`, `scripts/verify.cjs`.
- Sửa root `package.json`, `README.md`, `Makefile`, `.github/workflows/backend-ci.yml`.
- Sửa `backend/package.json`, `backend/prisma/schema.prisma`; thêm hai migration và migration_lock.toml như §3.
- Thêm `backend/scripts/foundation-check.cjs`, `team-local.cjs`, `team-local.check.cjs`, `replay-active-chain.cjs`, `smoke-local.cjs`; cập nhật prepare-pr2b.py, shared-database.cjs và test checksum của nó.
- Cập nhật artifact review: legacy-client.prisma, expand/schema snapshots tương ứng, compatibility.ts, SQL line endings/fragments, README, kết quả chain/test; thêm active-chain-results.json và smoke-results.json. Baseline snapshot không trở thành active schema lần nữa.
- Sửa `shared/package.json`, `shared/src/index.ts`; thêm `shared/src/contracts/academic-context.ts`.
- Thêm guide 03 và báo cáo 03a; ghi notice trạng thái mới ở 02c, giữ nội dung review cũ như lịch sử.
- Tạo `.env.team.local` ignored để phát triển local, không stage và không đưa secret vào source. Các env thật đang có được giữ.

Những thay đổi env/Docker/app.module/frontend config/DOCX và tài liệu trước đã có sẵn trong working tree từ các phiên trước; không gán toàn bộ `git diff` cho lần này. Không xóa/ghi đè thay đổi của người khác. Git status/diff cuối bao gồm cả file untracked nên `git diff --stat` riêng không mô tả đầy đủ phạm vi bàn giao.
