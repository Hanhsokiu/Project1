# BƯỚC 4 — Quản lý nhóm giảng viên duyệt đề cương

**Xem và thao tác UI không cần database:** chạy `pnpm --filter @doan/frontend preview:review-groups`. Lệnh mở Edge có cửa sổ và giữ giao diện với API mock, khác lệnh test headless tự chạy rồi đóng. Chỉ dùng cửa sổ Edge do lệnh mở; tab tự mở ở trình duyệt khác không có API mock. Có thể tạo nhiều nhóm demo, sửa/xóa; dữ liệu chỉ trong bộ nhớ và mất khi dừng preview. Đóng cửa sổ hoặc Ctrl+C để dừng, không tác động Supabase.

Hoàn tất kiểm thử ngày 22/10/2026 (Asia/Saigon), tiếp tục phần triển khai ngày 21/10. Phạm vi chỉ bước 4. Không triển khai phân đề cương, quyết định duyệt, phiên bản, chốt hồ sơ hoặc báo cáo tuần của bước 5–8.

## 1. Chức năng đã làm

- Danh sách, tìm kiếm tên nhóm, lọc bộ môn, chọn đợt, phân trang; chi tiết nhóm và danh sách thành viên.
- Khoa tạo nhóm với bộ môn/đợt rõ ràng, sửa tên/thành viên; API thêm/xóa từng thành viên riêng. PATCH không nhận đổi term/department.
- Thành viên cần Lecturer tồn tại/hoạt động, account ACTIVE, role LECTURER và TermLecturer đúng đợt. PK hiện có chặn trùng thành viên; thêm kiểm tra DTO/service.
- Không tạo trưởng nhóm, vote/quorum, review session hoặc vai trò JWT REVIEW_GROUP_MEMBER. Vai trò hiển thị là “Thành viên duyệt”. Không tự cấm giảng viên khác bộ môn gốc: baseline chỉ bắt buộc roster cùng đợt.
- Chặn thay đổi thành viên khi nhóm có review ASSIGNED/IN_REVIEW hoặc legacy review chưa xác định trạng thái. Tên nhóm vẫn sửa được nếu revision/term hợp lệ.
- Xóa thực hiện bằng lưu trữ mềm, giữ group/member/history. Chặn xóa khi có bất kỳ ProposalReview liên kết, không làm mất liên kết đề cương. Không có endpoint khôi phục hoặc xóa vật lý.
- Mọi mutation gồm revision, idempotency, audit/history trong cùng transaction. Có Serializable retry cho conflict; khóa theo thứ tự term → group. Thao tác actor/time do server xác định.
- DTO Zod strict dùng chung backend/frontend; request không nhận field ngoài contract. Swagger có request schema, quyền/lỗi và response DTO nhóm.
- Giao diện tại `/topic/review-groups`: danh sách, tạo, sửa, chi tiết; loading/empty/error/success; responsive layout riêng cho feature. Trang tạo cho chọn đợt trực tiếp. Thành viên đã chọn được giữ khi tìm kiếm/phân trang. Revision được giữ theo bản mở form, không tự lấy revision mới để ghi đè dữ liệu đang sửa.

## 2. Quyền và scope

| Chủ thể | Hành vi |
|---|---|
| FACULTY | Cần permission review-group:read/manage trên chính role FACULTY và AcademicTermGrant đúng đợt/bộ môn; allDepartments chỉ theo grant rõ ràng |
| LECTURER | Cần permission read trên role LECTURER, account/Lecturer hoạt động, TermLecturer cùng đợt và membership hiện hành; chỉ xem nhóm đó |
| ADMIN-only / STUDENT / COMMITTEE | Không có quyền chỉ vì role hoặc được gán permission học thuật. ADMIN không bypass |
| Người đồng thời nhiều role | Action và scope phải thuộc một đường quyền hợp lệ; không ghép permission của ADMIN với role FACULTY không có action |

Đọc role/permission/account/grant từ DB mỗi request; không tin roles trong JWT để mở scope. Adapter sub→userId chỉ nằm trong controller bước 4, không sửa auth của người 1. Ngoài scope tài nguyên trả 404; thiếu action/role trả 403; không token trả 401. Idempotency replay kiểm tra lại scope, kể cả scope bộ môn của POST create trước khi trả response cache.

Nhóm legacy chưa có ReviewGroupWorkflow/department mapping không bị tự gán bộ môn hoặc nhập vào scope. Người phụ trách dữ liệu cần đối soát mapping đó; đây không phải backfill của bước 4.

## 3. API đã triển khai

Base `/api`. Success `{success:true,data,timestamp}`; list data có `{data,total,page,limit,totalPages}`. Mutation có `Idempotency-Key`; update/member/delete yêu cầu expectedRevision và reason. ID opaque, không ép UUID.

| Method | Endpoint | Request / response |
|---|---|---|
| GET | /review-group-options/terms | Đợt được cấp hoặc có membership hợp lệ; không trả toàn bộ đợt hệ thống |
| GET | /terms/:termId/review-group-options | Bộ môn theo grant; danh sách Lecturer hợp lệ phân trang cho Khoa. Lecturer đọc chỉ nhận hồ sơ chính mình, không roster toàn đợt |
| GET | /terms/:termId/review-groups | page/limit/search/departmentId; list trong scope, không gồm archived |
| POST | /terms/:termId/review-groups | GroupCreate: name,departmentId,memberLecturerIds → GroupView (201) |
| GET | /review-groups/:id | GroupView: members, bộ môn, revision, activeReviewCount, canManage |
| PATCH | /review-groups/:id | expectedRevision,reason,name?,memberLecturerIds? → GroupView |
| GET | /review-groups/:id/members | Danh sách thành viên và role MEMBER |
| POST | /review-groups/:id/members | expectedRevision,reason,lecturerId → GroupView (201) |
| DELETE | /review-groups/:id/members/:lecturerId | expectedRevision,reason → GroupView |
| DELETE | /review-groups/:id | expectedRevision,reason → GroupView, lưu trữ mềm |

Các options endpoint là read adapter của riêng feature, không sửa API catalog/term/auth. Chúng không cung cấp proposal hoặc các endpoint bước 5–8.

Lỗi chính: COMMON_003 (validation), AUTH_002/003/004, COMMON_001 (404), MEMBER_INELIGIBLE (400), COMMON_002 (trùng member, 409), TERM_003, REVISION_CONFLICT, IDEMPOTENCY_CONFLICT, ACTIVE_REVIEW_EXISTS, GROUP_IN_USE (409). Lỗi nội bộ được che thông tin Prisma/DB/stack khỏi response.

## 4. Schema và migration

Migration mới duy nhất: `backend/prisma/migrations/202610210003_review_group_management/migration.sql`.

- Thêm `ReviewGroupWorkflow.archivedAt DateTime? @db.Timestamptz(6)` và index `(departmentId, archivedAt)`.
- Giữ ReviewGroup/ReviewGroupMember/ReviewMembershipHistory và toàn bộ PK/unique/FK cũ; không cần thêm bảng membership trùng lặp.
- Thêm hai Permission definitions review-group:read và review-group:manage. Chỉ bind read/manage cho role FACULTY hiện có, read cho LECTURER hiện có. Không tạo user/role/grant, không cấp ADMIN hoặc action khác.
- Toàn bộ SQL trong transaction; không drop/reset, không sửa 0_init hoặc hai migration trước, không suy dữ liệu ownership/department/approval/file.

SHA256 bytes của migration bước 4: `924e394bf9ae7f69629abc698e9fa7d0073a2462ec9d4a7ca08905ce8389525b`.

Đã replay trên PostgreSQL17 local rỗng và thử upgrade từ ba migration trước với dữ liệu synthetic có sẵn. Dữ liệu Topic/Proposal, group/member và legacy isPassed=false giữ nguyên; không tạo sidecar mapping giả. Deploy lại không pending, checksum bốn migration đúng.

Chưa chạy DDL/migration/seed lên Supabase chung. Trước deploy thật vẫn cần read-only inspection/history, backup và approval target riêng theo quy trình hiện có. Không áp file residual-drift.DO-NOT-APPLY.sql. Nếu Prisma migration thất bại, điều tra history trước khi retry; không tự reset/resolve. Sau commit ưu tiên rollback app tương thích/forward fix, không cung cấp down script xóa dữ liệu.

## 5. Kết quả kiểm thử thực tế

| Kiểm tra | Kết quả |
|---|---|
| Prisma validate/generate | PASS |
| `pnpm verify` | PASS: compatibility, type-check ba workspace, lint backend/frontend, unit/tooling tests và build ba workspace |
| Backend Vitest | 30/30 PASS, gồm 22 test bước 4; test assignment/config/grading cũ giữ xanh |
| Frontend Vitest | 7/7 PASS, gồm 4 test validation/render smoke bước 4 |
| HTTP + PostgreSQL17.11 | **31/31 PASS**: create/update/member/duplicate, scope/role/401/403/404, cross-term, pagination, idempotency và scope bị thu hồi, CAS concurrency, active review guard, archive/history, audit failure rollback và Swagger DTO |
| Populated baseline upgrade | PASS: giữ dữ liệu cũ/false, không backfill, cấp đúng quyền cho role hiện có, không grant ADMIN/action không liên quan, checksum và deploy lặp đúng |
| Browser Edge headless qua Playwright | **9/9 PASS**, API mock hoàn toàn: empty state, chọn đợt trên trang tạo, required validation, create/success, giữ member selection khi search, revision error giữ input, lecturer read-only + viewport 375px không tràn trang, archive/reason, error scope |
| CI GitHub | Đã thêm step API/upgrade trên PostgreSQL17 riêng; **chưa chạy GitHub Actions** trong phiên này |
| Browser nói chuyện với backend thật | **Chưa chạy**; kiểm browser mock và HTTP backend thật là hai bộ tách biệt |
| Supabase / Docker end-to-end | **Không chạy** trong phạm vi kiểm thử này |

Evidence: `backend/prisma/review/step4-results.json`, `step4-upgrade-results.json`, `step4-browser-results.json`. Chỉ fixture synthetic; không dùng snapshot dữ liệu nhóm. Có Vite/Node deprecation warnings và React useLayoutEffect warning từ SSR smoke; không có test/build fail vì những cảnh báo này. Không nâng dependency để xử lý cảnh báo.

Lệnh tái lập:

```powershell
pnpm verify
# PR2B_TEST_URL riêng, local 127.0.0.1, PG17, DB rỗng mới tên btl_pr2b_*:
pnpm --filter @doan/backend test:review-groups:api
# Chọn một DB rỗng khác cho upgrade; psql trong PATH hoặc PR2B_PSQL:
pnpm --filter @doan/backend test:review-groups:upgrade
# Edge đã cài, Vite loopback + mock API, không dùng backend/database:
pnpm --filter @doan/frontend test:review-groups:browser
```

Các runner từ chối remote/shared/default DB và không fallback backend/.env. Không tái sử dụng/reset DB test đã có dữ liệu.

## 6. Phối hợp và giới hạn còn lại

1. Người 1 phải cung cấp account/role, permission bindings, AcademicTermGrant/GrantDepartment, bộ môn/đợt và TermLecturer thật. Nếu role được tạo **sau migration**, owner RBAC cần gán hai action mới qua quy trình quản trị; migration không dùng trigger tự cấp quyền. Không thêm tài khoản/grant giả vào DB nhóm để UI hoạt động.
2. Người làm bước 5 sau này cần cùng protocol khóa term → group khi phân review và kiểm archived/membership/routing trong transaction. Chưa implement assignment/start/decision hoặc thay producer bước 1–3.
3. Term/bộ môn của nhóm không sửa qua PATCH. Đổi routing của nhóm đã dùng cần contract riêng/phân lại theo baseline, không tự chuyển đề cương ở bước 4.
4. Hiện không tự purge audit/idempotency/membership history. Chính sách retention/idempotency TTL cần được thống nhất trước production; không tự xóa chứng cứ.
5. Có sẵn identity adapter trong feature; không sửa `/auth/me`, JWT guard, RBAC service hoặc các endpoint academic cũ của người khác. Những vấn đề scope legacy ngoài nhóm duyệt vẫn giữ như audit trước, không được coi đã xử lý toàn hệ thống.

## 7. File đã thay đổi

**Backend / shared nghiệp vụ bước 4:**

- `backend/src/topic/review-groups/review-group.controller.ts`
- `backend/src/topic/review-groups/review-group.dto.ts`
- `backend/src/topic/review-groups/review-group.errors.ts`
- `backend/src/topic/review-groups/review-group.repository.ts`
- `backend/src/topic/review-groups/review-group.response.ts`
- `backend/src/topic/review-groups/review-group.service.ts`
- `backend/src/topic/review-groups/review-group.validator.ts`
- `backend/src/topic/review-groups/review-group.spec.ts`
- `backend/src/topic/topic.module.ts`: chỉ đăng ký controller/providers mới, giữ TopicController/TopicService cũ.
- `shared/src/contracts/review-groups.ts`, `shared/src/index.ts`: Zod contracts/types và export additive.

**Frontend:**

- `frontend/src/features/review-groups/api.ts`, `components.tsx`, `pages.tsx`, `components.spec.tsx`.
- `frontend/src/app/router/routes.tsx`: đăng ký routes feature; `frontend/src/app/layouts/AdminLayout.tsx`: thêm một menu link. Không refactor layout/module khác.

**Schema/config/test tích hợp trực tiếp:**

- `backend/prisma/schema.prisma` và migration mới nêu ở §4.
- `backend/package.json`, `backend/tsconfig.json`, `pnpm-lock.yaml`: link workspace @doan/shared sẵn có, dùng declaration đã build để Nest vẫn xuất dist/main.js; build/dev/type-check build shared trước. Không thêm/nâng package bên ngoài; install offline, không xóa node_modules/lockfile.
- `frontend/package.json`: thêm lệnh browser smoke.
- `backend/scripts/foundation-check.cjs`: giữ nguyên compatibility checks, cho phép field additive mới thay vì ép active schema bằng snapshot PR2B vĩnh viễn.
- `backend/scripts/replay-active-chain.cjs`: đếm migration thật thay hardcode 3.
- `backend/scripts/test-review-groups.cjs`, `test-review-group-upgrade.cjs`, `frontend/scripts/test-review-groups-browser.cjs`.
- `.github/workflows/backend-ci.yml`: chạy API/upgrade step4 và upload evidence; không URL Supabase.
- Ba JSON evidence trong `backend/prisma/review/` nêu ở §5.
- `docs/implementation/04-test-plan.md` (file thiếu được tạo cho bước 4), báo cáo này.

Không sửa business logic auth/catalog/term/registration/guidance/defense/grading/report của thành viên khác. Không sửa DOCX, ADR hoặc migration cũ. Không stage, commit hoặc push.
