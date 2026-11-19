# UC25 — báo cáo, Excel và PDF biểu mẫu

08/11/2026. Chỉ Project1, nhánh feature/b9-b10-implementation tại 0093f81a6017a8e046a03a8ce9786189cd5b37d8. Giữ thay đổi UC17–UC24 chưa commit. Code tích hợp/kiểm thử cô lập; không nghiệm thu production hoặc signed archive.

## 1. Excel

ExcelJS hiện có tạo XLSX thật: sinh viên theo đợt/lớp, hội đồng/vai trò, sinh viên theo hội đồng, phân công GVPB, bảng điểm hội đồng/lớp/bộ môn/toàn đợt và kết quả chính thức. Filter term/department/class/committee/student/state/date theo scope; có limits, không silently truncate file. Headers/merge/width/wrap/filter/freeze/print header và metadata template/version/đợt/time/actor/id.

Mã sinh viên và điểm snapshot ghi dạng text bảo toàn số 0 và mọi chữ số Decimal; không chuyển qua JS float hoặc tạo Excel formula tính điểm. Dữ liệu tên/đề tài/nhận xét prefix =,+,-,@ (kể cả sau whitespace/control) được neutralize; cell luôn literal string, không formula/link tùy ý/hidden sheet/private URL. ZIP entry timestamps được chuẩn hóa để tái sinh byte-identical, workbook metadata vẫn ghi thời gian xuất thật.

## 2. PDF / biểu mẫu

PDFKit và Noto Serif Regular/Bold/OFL có sẵn, đường dẫn tương đối cùng backend assets, không OS Windows fonts/network/browser automation. PDF thật phân trang; bảng tách nhóm cột có mã SV lặp lại, nội dung dài wrap/split, headers/version/time/actor/page, DRAFT và UNSIGNED rõ ràng.

Phiếu GVHD/GVPB lấy feedback hiện hữu sau effective reader + content permission. Hội đồng/vai trò, bảng điểm, kết quả và biên bản lấy nguồn current. MINUTES in tên/vai trò hội đồng, thời gian/buổi/phòng/SV/đề tài/điểm, ô ký theo template; kết luận/phát biểu/yêu cầu sửa thiếu producer → MISSING_SOURCE. Chỉ để trống có nhãn khi template policy explicitly cho phép. Không suy kết luận từ điểm, không signature giả hoặc tự chuyển sang SIGNED.

PDF_DOSSIER dùng lại DossierValidator/GuidanceValidator và DossierPdfService B1–B8: current sealed/finalized snapshot/hash/assignment, đúng source templateVersion, quyền dossier:export + UC25 dossier/pii. Không sửa header/nội dung mẫu B1–B8 để giả thành mẫu mới. Chọn một sinh viên; thiếu producer/snapshot/version → blocker.

## 3. Thống kê

Cùng scope/snapshot: SV, hồ sơ có đề tài, distinct giảng viên có nhiệm vụ, hội đồng current, SV/phiên có lịch current, eligibility current/unknown, tải GVHD/GVPB, số phiếu finalized/current, kết quả finalized/published/current; nhóm lớp/hội đồng/bộ môn/hướng, tiến độ kế hoạch hiện hành.

Không cộng nhầm người/phiên/phiếu. Thiếu capability/quyền grade/score → null hoặc unknown được ghi rõ, không fake 0. Average/phân bố chỉ từ kết quả được phép theo policy PUBLISHED_ONLY hoặc FINALIZED_INTERNAL; average hiển thị 2 chữ số HALF_UP bằng rational BigInt cho thống kê, không thay điểm chính thức. Tỷ lệ đạt chỉ khi mọi kết quả trong mẫu được phép có pass result từ UC24 approved rule; không >=5 mặc định. Distribution bins explicit, không overlap. Giảng viên có nhiệm vụ khác tổng roster; hồ sơ có đề tài khác hồ sơ đã chốt. Eligibility không đủ proof được ghi unknown, không tự kết luận chưa đạt.

## 4. Template thực tế

Registry 15 codes: 8 XLSX, 7 PDF (GVHD, GVPB, hội đồng, bảng điểm HĐ, minutes, results, dossier). Repository chỉ có đặc tả DOCX và nguồn mẫu đề cương B1–B8; chưa có bộ mẫu báo cáo chính thức của Khoa được xác nhận. Các layout UC25 mặc định ENGINEERING_DRAFT_V1, DRAFT/PENDING_APPROVAL, không tự APPROVED. UC25_POLICY có metadata từng mẫu: version/owner/format/engine/columns/role/approval/reference/effective dates/requirePublished/allowMissing/signature slots/institution/source dossier version. Không template upload/eval hoặc đường dẫn file tùy ý.

## 5. Files

- Backend mới: backend/src/report/defense-reporting gồm reader, registry/validator, statistics, renderer, service, repository/session, controller và 3 test files; backend/test/reporting.fixture.ts, scripts/check-reporting-build.cjs.
- Shared contracts: shared/src/contracts/defense-reporting.ts và index export.
- Frontend: frontend/src/features/report/defense-reporting gồm api/page/components/fixtures và 3 tests, router/manifest/access regression.
- Tích hợp ReportModule hiện hữu import DefenseModule; export thêm AdvisorGradeReader/EligibilityService/CommitteeGradeValidator để reuse, không đổi producer nghiệp vụ. Environment thêm flag/technical limits + default test. ExportCenterPage cũ redirect trong API mode, demo cũ giữ nguyên; menu theo mode chỉ có một trang báo cáo API.
- README schema audit, policy approval list, báo cáo này và 4 tài liệu tổng hợp B9–B10.

## 6. APIs / route

Frontend /defense/reports; alias /report/export chỉ redirect ở API mode. Existing reports/stats và demo services không dùng làm fallback UC25.

| Method | Path sau global API prefix | Side effects |
| --- | --- | --- |
| GET | /defense-reports/options (termId optional) | Read-only scopes/terms/filters |
| GET | /defense-reports/templates?termId=... | Read-only registry |
| GET | /defense-reports/statistics?termId=... | Read-only snapshot |
| POST | /defense-reports/exports/preview | Read-only JSON preview tối đa 20 dòng, không tạo file/job/audit/key |
| POST | /defense-reports/exports | Render thật rồi commit generated/failed metadata + idempotency |
| GET | /defense-reports/exports?termId=... | Own scoped history |
| GET | /defense-reports/exports/:id | Own metadata/current/expired, không tạo file |
| POST | /defense-reports/exports/:id/download | Reauthorize/revalidate/rerender/hash + atomic delivery-prepared audit/key |

Download dùng POST vì có audit, không lách side effects qua GET. Content-Type đúng XLSX/PDF, attachment tên server-generated không PII/path input; no-store/private, nosniff và Content-Length. Không public link hoặc đọc filePath từ client.

## 7–8. Database / migration

Tái sử dụng TERM_PARAMETER, AUDIT_LOG, IDEMPOTENCY_RECORD và các nguồn B1–B8/UC17–24. Audit EXPORT_JOB baseline thiếu template/source/private lifecycle; DEFENSE_MINUTES baseline thiếu official remarks/signature provenance; FILE_ASSET không bị ép nhận export kind. **Không cần UC25 migration** với phương án stream in-memory. [Schema audit](../../backend/prisma/review/defense-reporting/README.md). Không tạo bảng trùng, queue hoặc private bucket/disk mới; không apply các gói cũ.

## 9. Quyền/scope/privacy

JWT/session + role-bound FACULTY/LECTURER permissions. read/templates/statistics/preview, list/components/final/comments/minutes export, export/download/history, draft-preview/draft-export, grade/score statistics, dossier/pii tách riêng. Không role union hoặc ADMIN/STUDENT academic bypass.

FACULTY theo term/department grants. Member bắt buộc committeeId và actual current membership, không toàn kỳ. Member results còn cần explicit policy + UC24 read/components-read; reader nội bộ dùng persisted faculty finalizer có live scope, không nâng quyền caller hoặc nhận actor từ browser. UC24 underlying components-read cần khi consume official results; comment riêng theo UC17/UC22, không tự xuất feedback người khác.

Preview chỉ columns được phép, không raw context/audit. Actor/role/permissions/term/filter cache isolation; late responses không phát hành file khi tài khoản/phạm vi đổi. Ngày sinh chưa có nguồn được kiểm chứng trong report projection, không tự thêm DOB; contact chỉ trong dossier đã cấp pii-export.

## 10. EffectiveFinalResult

Bắt buộc FinalResultService.effectiveInSession trong caller transaction; finalized/published CURRENT + snapshot/evidence/confirmations/official source UC17/22/23 + policy thật. Không raw final_score/is_published, không preview/legacy/draft/stale làm official. requirePublished của template explicit; finalized không tự public. Các điểm từng GVPB/member và aggregates/final lấy snapshot/source đã xác minh, không viết lại công thức 40/60 trong Excel/PDF.

## 11. Audit/idempotency/lifecycle

Read RepeatableRead lấy snapshot, render ngoài transaction, Serializable term-first locks + reauthorize/revalidate source/template/hash trước metadata commit. Kết quả audit và key atomic; duplicate same key/body replay, body khác 409. No success audit khi renderer lỗi; lỗi render ghi GENERATION_FAILED redacted. Các authorization/source blockers trước tạo không được ghi như một bản xuất thành công.

Audit metadata tối thiểu actor/term/template/version/mode/normalized filters/count/source+scope hash/file hash/time/status, không bulk tên/điểm/feedback. File không lưu lâu dài. Metadata GENERATED không chứng minh client đã tải; POST download ghi DELIVERY_PREPARED, frontend chỉ báo đã nhận bytes/yêu cầu browser lưu. Không khẳng định file đã được lưu hoặc đã ký.

Tải lại tái sinh cùng id/time/template/snapshot và so SHA256; quyền bị thu hồi/nguồn hoặc template đổi/TTL hết/engine tạo bytes khác → chặn. Không historical file archive hay download link công khai. retentionDays giới hạn tái sinh, không tự xóa audit. Render concurrency/rows/candidates/text/bytes/time bounded; không queue mới.

## 12–13. Kiểm thử và regression

Kết quả thực chạy cuối được ghi ở mục Xác minh cuối. Tests gồm real XLSX read-back/Unicode/leading zero/Decimal/formula injection, PDF parse/tiếng Việt/form/unsigned/dossier reuse, actor/grants/role union/privacy, current/unpublished/missing/stale/legacy, render errors/replay/rollback/source race/revocation/limits và GET readonly. HTTP loopback dùng JWT/session/RBAC/Zod thật; persistence/storage adapters memory. SSR/API frontend tests không thay browser click/download E2E.

Giữ B1–B8 và UC17–24; không sửa 17 migrations/8 SQL packages, package dependencies/lockfiles, source grading hoặc FINAL_RESULT. UC25 new module route không thay global formula hay signed minutes. Native compiled ReportModule kiểm DI với mocked infrastructure, không AppModule/server/database.

## 14–15. BLOCKED / NOT VERIFIED

BLOCKED activation: approved policy/templates/cột/quyền/grants thực, rehearsal nguồn UC17–24 và ACL/RLS/REST, source storage bền vững. Biên bản đủ remarks/conclusion/revision requests và signed archive chưa có approved producer; code chỉ MISSING_SOURCE/allowed blank/UNSIGNED. Quy trình chữ ký số/scan/archival, thay thế báo cáo sau stale, DOB và mẫu khác registry cần schema/policy/producer review nếu yêu cầu.

PostgreSQL transaction/lock/audit/key rollback thực, live schema/security, browser Save/print, Linux Render font/artifact verification, performance toàn đợt, private source PDF restart/redeploy/restore đều NOT VERIFIED. Không unit PASS = E2E PASS.

## 16–17. Render/storage và đối soát file

Export stream không phụ thuộc persistent disk để lưu bản xuất; vẫn phụ thuộc PDF nguồn UC17 private FileStorageService và producer proofs. Render disk/mount/backup chưa được nhóm xác nhận. Không tạo disk/bucket hoặc ghi đè uploads. Không tuyên bố đã lưu lâu dài; nếu cần archive phải duyệt storage/schema/lifecycle riêng.

File hash và source/template/scope hashes + owner/current/expiry kiểm mỗi download; không dùng EXPORT_JOB.filePath legacy. Cờ UC25_WRITES_ENABLED false mặc định, không bật cờ cũ. Technical defaults: rows 100 (max 500), candidates 1000 (max 5000), bytes 10 MiB, text 200k chars, 2 renders/process, timeout 30s; statistics/options có candidate cap, export có row cap. Đây là giới hạn kỹ thuật, không quy định học vụ.

## 18. Tác động B1–B8 / an toàn workspace

ReportModule thêm UC25, DefenseModule export thêm reusable readers; API export page cũ redirect, demo menu giữ nguyên. Không thay schema Prisma hoặc migrate trong UC25. Không Supabase writes/secrets/env/Word/uploads/Render/app production, không account/seed/commit/push/branch/worktree/project mới. Existing worktree metadata giữ nguyên.

## Xác minh cuối

| Kiểm tra thực chạy | Kết quả |
| --- | --- |
| Backend full Vitest | PASS — 66 files, 834 tests; gồm 45 tests UC25 (38 workflow/artifact/privacy, 4 HTTP, 3 adapter) |
| Frontend full Vitest | PASS — 59 files, 385 tests; UC25 có 26 tests API/page/components và 1 route/menu regression mới |
| Shared TypeScript build | PASS |
| Backend/frontend typecheck và lint toàn src | PASS |
| Prisma validate + generate | PASS; chỉ kiểm schema/generate client, không connect/ghi database hoặc apply SQL |
| Nest build + tsc tsconfig.build.json không incremental | PASS |
| Vite production artifact build | PASS; không chạy app hoặc deploy |
| Native compiled modules UC17–UC25 | PASS — 9 scripts, infrastructure giả lập, không server/database |
| Kiểm lại sau sửa cuối | PASS HTTP UC25 4 tests và frontend UC25 26 tests; typecheck/lint/build lại. Native DI phát hiện thiếu export CommitteeGradeValidator; đã sửa export và kiểm lại thành công |
| Git / SQL review | PASS git diff --check; không conflict marker/trailing whitespace trong files UC25 mới; 17 migrations nền giữ nguyên, SHA256 SQL UC24 vẫn AE99FD15270F0CDBF229A25E14D04D67B963CA5FE6AA388A6445767EC9B7F3FF |

Warnings còn: Vite CJS deprecated và chunk >500 kB; SSR useLayoutEffect trong suite khi không silent; Git LF→CRLF. Không có lỗi test/typecheck/lint/build còn mở. Đây không phải kết quả PostgreSQL/Render/browser E2E.

Git cuối vẫn feature/b9-b10-implementation, HEAD 0093f81a6017a8e046a03a8ce9786189cd5b37d8. Không commit/push/chuyển nhánh/tạo worktree. Metadata Project1-B9-B10 cũ vẫn prunable, folder thực không tồn tại; không dọn metadata. Không sửa env/uploads/spec Word/package/lockfiles/active migrations; thay đổi UC17–24 có sẵn giữ nguyên. UC25 không có migration mới; schema.prisma đang modified từ công việc UC17–24, không phải đã sạch hoặc đã deploy.
