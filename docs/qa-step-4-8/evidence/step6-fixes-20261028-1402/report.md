# Hoàn thiện bước 6 — 28/10/2026

**Đã sửa ba thiếu sót G6-01/G6-02/G6-03 trong [báo cáo QA](../step6-local-20261028-0953/report.md): bổ sung API và UI rút bài, trả nháp, mở lại đề cương.** Đã kiểm bằng HTTP, PostgreSQL 17.11 và Edge thật; không mock response. Không triển khai lên môi trường dùng chung. Migration quyền mới chỉ được áp dụng trên DB test mới, chưa áp dụng lên DB giao diện hiện tại/Supabase.

## Hành vi sau sửa

| Gap | Trigger và hành vi đã triển khai | Kiểm chứng |
|---|---|---|
| G6-01 | Owner có `proposal:submit` rút SUBMITTED về DRAFT. Nếu đang ASSIGNED, vòng được supersede; bản SEALED, nội dung, metadata và nhận xét giữ nguyên. GVHD/Khoa không rút thay SV. | API + UI PASS |
| G6-02 | FACULTY có `proposal:assign` trong grant đợt/bộ môn trả UNDER_REVIEW về DRAFT với lý do bắt buộc và revision vòng hiện hành. Vòng chuyển SUPERSEDED, không tạo quyết định giả hoặc sửa nhận xét. | API + UI PASS |
| G6-03 | FACULTY có `proposal:reopen` trong grant mở APPROVED về DRAFT với lý do. Dossier chuyển REOPENED, current-finalization pointer được bỏ, bản chốt cũ có `supersededAt/reason`; kế hoạch ACTIVE/PAUSED chuyển PAUSED. Giữ approval, bản in/PDF, biên nhận, task, tiến độ và lịch sử. | API + UI PASS |

Sau cả ba lệnh, working pointer vẫn trỏ nguồn SEALED; lần lưu kế tiếp mới append snapshot DRAFT mới. Chỉ owner nộp lại bản đã lưu, không tự phân nhóm. Chốt lại không tự phục hồi plan: GVHD cần acknowledge/rebase vào finalization mới qua lệnh resume hiện có.

Mọi mutation kiểm account, role/action và scope trước/sau khóa và trước replay cache; JWT claims/ADMIN không bypass. Khóa term → các group theo ID → proposal → phase/assignment. Transaction SERIALIZABLE, CAS proposal/review/dossier, kiểm phase EDIT trước/sau ghi. Audit/reason, outbox, thông báo trong ứng dụng và idempotency commit cùng aggregate. Audit lỗi rollback cả dossier/finalization/plan/history, không ghi dở.

Lệnh vẫn dùng được khi Topic agreement đã bị vô hiệu hóa do thay đổi phân công; **submit mới** tiếp tục yêu cầu xác nhận của GVHD hiện hành. Pointer working/submitted lệch, thiếu approval hiệu lực, hash sai, legacy thiếu chứng cứ bản chốt đều bị chặn; không tự backfill.

UI chỉ hiện thao tác do editing-context cấp quyền. Form giải thích tác động, yêu cầu lý do khi trả nháp/mở lại, có Hủy, chặn gửi trùng khi đang xử lý. Khi thành công, editor được khởi tạo lại theo revision mới; khi `409`, giữ lý do để người dùng tải lại chủ động. Khoa vẫn không có quyền sửa nội dung thay SV.

## Thay đổi để review

- [Shared contracts](../../../../shared/src/contracts/proposal-versions.ts): strict schemas `ProposalWithdraw`, `ProposalReturnToDraft`, `ProposalReopen`, capability/result types.
- [Lifecycle service](../../../../backend/src/topic/proposal-versions/proposal-lifecycle.service.ts), [repository](../../../../backend/src/topic/proposal-versions/proposal-version.repository.ts), [controller](../../../../backend/src/topic/proposal-versions/proposal-version.controller.ts): ba endpoint POST, cùng HTTP 200 và bắt buộc `Idempotency-Key`; [editing-context](../../../../backend/src/topic/proposal-versions/proposal-version.service.ts) công bố capability thực tế.
- [Form UI](../../../../frontend/src/features/proposal-versions/lifecycle-actions.tsx), [trang](../../../../frontend/src/features/proposal-versions/pages.tsx), [API client](../../../../frontend/src/features/proposal-versions/api.ts): ba thao tác và cập nhật cache/editor sau mutation.
- [Migration additive](../../../../backend/prisma/migrations/202610280001_proposal_lifecycle/migration.sql): thêm `proposal:reopen`, chỉ cấp cho FACULTY hiện hữu. Seed chính/fixture cũng khai báo quyền khi role được tạo sau migration. Không sửa migration cũ hoặc Prisma model, không backfill học thuật, không thêm dependency.
- [Regression API lâu dài](../../../../backend/scripts/test-proposal-lifecycle.cjs), script `test:proposal-lifecycle:api`, [CI](../../../../.github/workflows/backend-ci.yml): DB mới riêng cho lifecycle và upload kết quả. CI remote chưa được chạy trong lượt này.
- [Báo cáo triển khai mục 11](../../../implementation/06-step6-implementation-report.md): cập nhật hành vi và input command. Các file ứng dụng vốn có thay đổi trước đợt này được giữ nguyên; không coi toàn bộ git diff là thay đổi của lượt sửa này.

## Kết quả chạy mới

| Kiểm tra | Kết quả / bằng chứng |
|---|---|
| Type-check shared/backend/frontend; build backend/frontend | PASS |
| Unit backend | 191/191 PASS |
| Unit frontend | 115/115 PASS |
| Lint backend/frontend | PASS |
| API vòng đời mới | **26 nhóm PASS** — [kết quả](api/lifecycle-results.json), [console](api/console.log), [exit code](api-suite-summary.json) |
| API phiên bản cũ | **24 nhóm PASS**, gồm 1 producer prelude bước 5; prelude có 28 checks riêng, không cộng vào số ca bước 6 — [kết quả](regression-api/generated/step6-results.json), [producer](regression-api/generated/step5-results.json), [exit code](regression-api-summary.json) |
| Browser thật sau đăng nhập | **8 nhóm nghiệp vụ + 1 kiểm điều khiển PASS**, 0 FAIL — [checkpoints](lifecycle-ui-checkpoints.json), [summary](lifecycle-ui-summary.json) |
| Mobile form mở lại | Viewport 390 px, không tràn trang; Axe 0 violation/incomplete — [ảnh](U05-reopen-mobile.png), [Axe](U05-mobile-reopen-axe.json) |
| Bảo vệ DB hiện tại | **100/100 bảng cùng row count/hash trước–sau**, READ ONLY — [trước](main-before.json), [sau](main-after.json) |
| Cleanup | Browser đóng; API/Vite test không còn reachable; giữ DB — [cleanup](cleanup.json) |

[Tổng hợp kiểm chứng và SHA256 source](verification.json), [trạng thái DB test cuối](final-state.json), [snapshot/core hash](live-database-snapshot.json).

API mới kiểm đúng/sai scope, actor giả trong JWT, strict DTO/key/reason, phase future/expired/locked, GET không ghi, rút khi chưa/có ASSIGNED, stale revision/version/review, replay không trùng chứng cứ, thu hồi permission/grant trước replay, return giữ comments và không tạo decision, reopen sau agreement mất hiệu lực, dossier CAS bắt buộc, fault injection audit, hai reopen đồng thời, withdraw đua review start, bảo toàn snapshot/biên nhận/task/tiến độ, plan PAUSED chặn ghi, chốt mới rồi GVHD rebase/resume, pointer lệch và legacy thiếu bản chốt. Mỗi test chạy trên DB mới, không reuse/reset target có dữ liệu.

UI đã bấm thật:

1. Owner mở/Hủy form rút, kiểm không đổi server; GVHD và Khoa không có nút rút.
2. Owner xác nhận rút; UI có thể lưu theo revision mới, chưa được submit nguồn SEALED cũ. [Ảnh form](U02-withdraw-form.png).
3. Lưu và nộp v2 từ bản đã rút.
4. Khoa trả nháp từ vòng IN_REVIEW, blank/whitespace reason bị chặn; giữ comments, vòng SUPERSEDED. [Ảnh](U04-return-form.png).
5. Lưu/nộp v3, duyệt APPROVED, chốt/nhận giấy/tạo plan qua API thật, rồi Khoa mở lại bằng form mobile.
6. Đối chiếu DRAFT + REOPENED + PAUSED, giữ source SEALED, approval, finalization snapshot và receipt.
7. SV lưu/nộp v4; plan vẫn PAUSED. [Ảnh](U07-resubmitted-after-reopen.png).
8. Reviewer bắt đầu duyệt sau khi SV đã mở form rút: bấm xác nhận nhận `409`, lý do còn nguyên, server giữ UNDER_REVIEW; tải lại chủ động ẩn nút rút. [Ảnh](U08-stale-transition.png).

Các ca browser dùng **Playwright local + Microsoft Edge thật**, không gắn nhãn MCP. Phiên này không thực hiện kiểm sau đăng nhập bằng MCP. Vite thật cung cấp `http://127.0.0.1:50185/`, API `http://127.0.0.1:49297/api`, [runtime](live-ready.json). DB browser `btl_pr2b_step6fix_1793171312226_08290c_live`; DB API vòng đời và regression được tạo riêng. Không dùng URL 5173 của báo cáo bước 4.

## Console, giới hạn và trạng thái dữ liệu

Browser có **0 pageerror, 0 requestfailed transport**, nhưng có **17 console error đi cùng HTTP 4xx**, không kết luận console sạch. Trong đó 1 POST withdraw `409` là ca stale cố ý; các GET shell gồm registration/assignment `403` do permission/scope fixture và assignment results `400` vì term ID tổng hợp không phải UUID trong controller cũ. Trang/endpoint bước 6 vẫn tải và các assertion riêng đạt. [Raw browser log](lifecycle-ui-browser-log.json), [phân loại request](verification.json), [server traffic](live-server-traffic.json). Warning React Router future flag, Vite CJS/chunk size và SSR `useLayoutEffect` trong test vẫn còn từ nền tảng.

Có một lần runner mới dừng vì expected của test ghi `200` thay cho `201` ở API finalize/receipt hiện hữu; đã sửa **test**, không đổi API bước 7 để làm xanh. [Lần đầu](api-attempt-1/console.log) giữ nguyên. Các lần trung gian PASS 23/24 nhóm được lưu ở `api-attempt-2/3`; bản cuối 26 nhóm bao gồm ca bổ sung, không cộng lặp các lần chạy thành tổng ca mới. Không xóa evidence FAIL.

Trong đợt sửa này, DB giao diện hiện tại được đọc qua transaction `REPEATABLE READ READ ONLY`, không đăng nhập hoặc ghi vào DB đó. Cả 100 hash khớp baseline mới của đợt sửa; khác biệt xác thực trong đợt QA trước không được xóa/khôi phục để làm đẹp số liệu. Core đầu vào producer của DB browser test cũng khớp trước/sau. Có một dossier/finalization/receipt/plan tổng hợp được tạo để kiểm reopen; được giữ nguyên để đối chiếu.

**Chưa áp dụng migration mới lên DB hiện tại hoặc môi trường nhóm.** Khi triển khai phiên bản này, cần áp migration `202610280001_proposal_lifecycle` bằng quy trình deploy hiện có để FACULTY nhận capability reopen. Bản code và migration đã được kiểm trên DB test. Không tự chạy lại seed, reset hoặc sửa status dữ liệu thật.

Worker email bị tắt trong QA. In-app notifications/outbox được kiểm; SMTP gửi/nhận thật chưa chạy, không coi event PENDING là email đã gửi. Không tuyên bố CI remote, production deployment, kiểm tải hay mọi môi trường đều đạt từ các kết quả local này.
