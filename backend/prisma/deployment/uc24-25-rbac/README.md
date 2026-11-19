# UC24–UC25 RBAC: đã triển khai định nghĩa trên production

**Cập nhật sau công việc 2–3:** Prisma history đã **26 APPLIED / 0 FAILED**; migration thứ 26 copy nguyên byte và được ghi nhận bằng `migrate resolve --applied`, không chạy lại SQL production. Đã cấp đúng bốn FACULTY read grants: ROLE_PERMISSION **162 → 166**, FACULTY **63 → 67**; permission vẫn 124. Các role khác và chín policy giữ nguyên, không bật flags. Trạng thái hiện tại ở `history26-faculty-readonly.json`, `history-sync-production.json`, `faculty-read/production-result.json`. Các đoạn 25/162 bên dưới là bằng chứng lịch sử của riêng đợt bổ sung định nghĩa trước đó, không phải trạng thái hiện tại. Không chạy lại resolve hoặc gói grant.

Website local đã chạy từ nhánh feature với chế độ preview chặn ghi và 0 background intervals. Checklist và giới hạn: [B1-B10-WEB-READONLY-ACCEPTANCE.md](../../../../docs/implementation/B1-B10-WEB-READONLY-ACCEPTANCE.md). Mapping đủ 27 quyền ở `PERMISSION-MAPPING.md`; cấu hình đề xuất chưa APPROVED ở `POLICY-SPEC-CANDIDATES.json`. Chưa có policy thật cho cả chín UC.

Đã triển khai đúng một lượt lúc **21:22:40 ngày 09/11/2026** (`14:22:40 UTC`), sau 13 kiểm thử SQL PG17 PASS và đầy đủ gate production. Permission **97 → 124**, ROLE_PERMISSION **162 → 162**, lịch sử Prisma **25 APPLIED / 0 FAILED**, 25 checksum không đổi. Không chạy lại UC17–UC24. Không gán role, không tạo policy, không thay flags.

Gói này vẫn nằm **ngoài** `prisma/migrations`: phần RBAC đã tồn tại trên database thật nhưng **chưa được ghi trong Prisma history**. Không chạy lại SQL để ghi nhận lịch sử. Xem [MAIN-RELEASE.md](MAIN-RELEASE.md) cho phương án đối soát ở đợt main được duyệt sau này.

Bằng chứng mới nhất: [production-execution.json](production-execution.json), [production-final-readonly.json](production-final-readonly.json), [pg17-rehearsal-result.json](pg17-rehearsal-result.json). Postflight độc lập READ ONLY lúc 21:25:43 xác nhận đủ 27 định nghĩa đúng manifest, provenance/ACL PASS, không trùng/orphan/grant mới, không advisory lock; digest 97 permission cũ và toàn bộ role grants giữ nguyên. Các dòng comment DRAFT trong bốn SQL là nội dung review lịch sử được giữ nguyên để bảo toàn SHA-256.

Bằng chứng READ ONLY **trước triển khai**: [readonly-evidence.json](readonly-evidence.json), lúc `2026-11-09T13:57:34.134Z` (20:57 giờ Việt Nam). Giữ nguyên snapshot này; nó ghi các quyền thiếu ở thời điểm trước triển khai, không mô tả trạng thái hiện tại.

## Quyền thiếu và đối chiếu source

| Nơi kiểm tra | Resource | Actions đã bổ sung |
| --- | --- | --- |
| UC24 controller | `defense-result` | `read`, `confirm`, `finalize`, `publish` |
| UC25 controller | `defense-report` | `read`, `templates-read`, `statistics`, `preview`, `export`, `history-read`, `download` |
| UC24 service | `defense-result` | `read-own`, `components-read`, `history-read`, `final-read` |
| UC25 service/reader/templates | `defense-report` | `grade-statistics`, `score-statistics`, `draft-preview`, `draft-export`, `list-export`, `components-export`, `final-export`, `comments-export`, `minutes-export`, `dossier-export`, `pii-export` |
| UC25 reader, nhánh PDF_DOSSIER | `dossier` | `export` |

11 quyền controller ban đầu, 15 quyền service và một quyền liên resource đã được bổ sung: **27 định nghĩa**, chưa có grant nào cho hai resource UC24/UC25 hoặc `dossier:export`. Chỉ có định nghĩa chưa đủ mở nghiệp vụ; mapping vẫn chờ duyệt.

Source đối chiếu:

- `src/defense/final-results/final-result.controller.ts` và `final-result.service.ts`: controller kiểm tra action; service kiểm tra cùng role, term/department grant, phân công hội đồng hoặc sở hữu hồ sơ. `confirm` dành cho LECTURER đúng vai trò hội đồng theo policy; `finalize/publish` chỉ FACULTY. Điểm thành phần, lịch sử và công bố cho SV có gate riêng.
- `src/report/defense-reporting/report.controller.ts`, `report.service.ts`, `report.reader.ts`, `report-templates.ts`: chỉ FACULTY hoặc LECTURER có phạm vi hợp lệ. LECTURER cần hội đồng thực tế và `committeeId`. Nội dung preview cũng cần các quyền `*-export` tương ứng mẫu; quyền `preview` riêng chưa đủ.
- `src/common/security/permissions.guard.ts` dùng quyền người dùng; `src/guidance/tasks/guidance.validator.ts` kiểm tra quyền **trong cùng role nghiệp vụ** tại service. Phân tán `read` ở FACULTY và action ở ADMIN không đáp ứng điều kiện service.
- UC25 cần thêm `defense-result:components-read` khi đọc kết quả; phiếu phản biện cần `defense-reviewer-grade:comment-read` cho FACULTY; nhận xét GVHD cần `defense-confirmation:comment-read` cho FACULTY; hồ sơ cần `dossier:export`. Quyền nhận xét GVHD chỉ gán LECTURER, quyền nhận xét phản biện chưa gán role; `dossier:export` nay đã tồn tại nhưng chưa có grant. Không tự mở các quyền này.

## Mapping tối thiểu đề xuất để nhóm trưởng duyệt

| Role có thật | Đề xuất ban đầu | Giới hạn |
| --- | --- | --- |
| FACULTY | `defense-result:read`; `defense-report:read`, `templates-read`, `statistics` | Chỉ metadata/trạng thái/thống kê không có điểm hoặc phân loại khi chưa cấp quyền tương ứng; vẫn cần term/department grant B1–B8. |
| LECTURER | Chưa cấp mới trong đợt tối thiểu | Khi duyệt quyền đọc UC24: `read`, hội đồng thực tế; quyền UC25: `read` + action được chọn, `committeeId` và policy. `confirm` cần quyết định riêng về vai trò/người xác nhận. |
| STUDENT | Chưa cấp mới | Nếu duyệt trạng thái riêng: `read` + `read-own`; xem kết quả cần thêm `final-read`, kết quả PUBLISHED/current và policy cho phép. `components-read` là quyết định riêng. |
| ADMIN / COMMITTEE | Không cấp mới | Không dùng làm bypass. Các service UC24/25 không chấp nhận hai role này thay FACULTY/LECTURER/STUDENT; CHAIR/SECRETARY/MEMBER là vai trò trong hội đồng. |

**Chưa có SQL gán quyền**: bảng trên và `permissions.json` là đề xuất. Gán vào ROLE_PERMISSION sẽ ảnh hưởng mọi tài khoản cùng role, sau đó mới giới hạn bằng grant/phân công. Cần duyệt rõ người/phạm vi; role mới mang tên người vận hành sẽ không tự được service chấp nhận.

Cần duyệt riêng `confirm`, `finalize`, `publish`, mọi action xuất/tải, quyền điểm/nhận xét/lịch sử/PII, xem bản DRAFT và liên resource. Định nghĩa permission không cấp quyền sử dụng nó.

| Nhóm capability chờ duyệt | Role đề xuất theo service hiện tại | Điều kiện phải chốt trước khi gán |
| --- | --- | --- |
| UC24 `confirm` | LECTURER + `read` | Vai trò CHAIR/SECRETARY/MEMBER nào xác nhận; người thực tế được phân công, cửa sổ và separation policy. |
| UC24 `finalize`, `publish` | FACULTY + `read` | Chỉ định người/phạm vi và tách người xác nhận/chốt/công bố. Không gán đồng loạt chỉ vì role tên FACULTY. |
| UC24 `components-read`, `history-read` | FACULTY; LECTURER nếu được duyệt | Loại nội dung, hội đồng/phạm vi, thời điểm được xem. |
| UC24 `read-own`, `final-read` | STUDENT + `read` | Chỉ hồ sơ sở hữu, published/current và policy công bố. Điểm thành phần cần quyết định riêng. |
| UC25 `preview`, `history-read`, `export`, `download`, DRAFT và các quyền nội dung | FACULTY; LECTURER theo từng mẫu được duyệt | Đủ `read` cùng role; mẫu/columns/scope, `list-export` và các quyền nội dung phù hợp. `download` là thao tác ghi audit. |
| UC25 grade/score statistics | FACULTY; LECTURER nếu policy cho phép | Quyền điểm UC24 liên resource và trạng thái công bố; không kèm vào mapping tối thiểu. |
| Phiếu GVHD / phản biện / dossier | FACULTY; phản biện chỉ chính GVPB theo service; dossier theo role mẫu | Quyền nhận xét/liên resource nêu trên, bản nguồn chính thức và chấp thuận chia sẻ PII. |

Nhánh UC25 đọc kết quả cho LECTURER còn xác minh nguồn bằng `row.finalizedBy` qua `FinalResultService.effectiveInSession`; tài khoản người chốt phải còn quyền FACULTY đọc điểm thành phần và grant hợp lệ. Policy cho thành viên xem kết quả không tự bỏ điều kiện này. Không gán thêm quyền cho người chốt để che lỗi nếu thiếu phê duyệt.

## SQL cụ thể và rollback

- `preflight.sql`: READ ONLY; kiểm tra database, PG17+, quyền thao tác RBAC, 25 APPLIED/không unfinished, Prisma lock và role; trả trạng thái 27 định nghĩa. Nếu còn lock thì dừng cho DBA, không ngắt phiên.
- `migration.sql`: transaction, giới hạn chờ lock 5 giây; khóa hai bảng RBAC trong lúc thêm định nghĩa. `ON CONFLICT(resource,action) DO NOTHING`, không sửa mô tả/id của quyền có trước. Lưu chính xác các dòng **do gói này tạo** trong schema riêng `datn_rbac_uc24_25`, thu hồi quyền PUBLIC trên schema/tables; lưu snapshot grants ban đầu. Không ghi ROLE_PERMISSION.
- `postflight.sql`: READ ONLY; đủ 27 định nghĩa, provenance đúng manifest, quyền mới không bị sửa và snapshot grant không thay đổi. Nếu gán role bằng một đợt riêng sau này, đợt đó cần postflight riêng; không coi snapshot ban đầu là trạng thái vĩnh viễn.
- `rollback.sql`: chỉ xóa permission được ghi nhận do gói tạo; bảo toàn quyền có sẵn. Từ chối toàn bộ nếu permission đã được sửa hoặc có role grant, không xóa cascade. Xóa schema provenance khi hết đối tượng; chạy rollback lần hai là no-op. Rollback sau COMMIT cần duyệt riêng và bảo đảm không có đợt cấp quyền đồng thời. Với migration đã đưa vào Prisma, rollback dữ liệu không tự xóa lịch sử Prisma; DBA cần một migration bù mới được duyệt, không sửa checksum hoặc dùng resolve để che lỗi.

SQL đã được kiểm thử và triển khai; giữ nguyên hash trong `SHA256.json`. Kiểm tra byte/hash và đối chiếu source offline bằng:

```powershell
node backend/scripts/prepare-uc24-25-rbac.cjs --check
node --test backend/scripts/uc24-25-rbac.test.cjs
node backend/scripts/smoke-uc17-25-readonly.cjs
```

Kết quả offline 7/7 test PASS; SQL thực thi PG17 13/13 PASS (gồm hai kịch bản có sẵn một quyền và thiếu cả 27 quyền, chạy lặp, ACL, FK/unique, rollback bị chặn khi có grant hoặc bị sửa, lỗi trước COMMIT và khôi phục trạng thái chính xác). Các script qua `node --check`. Không chạy lại build/regression ứng dụng vì không sửa code nghiệp vụ/shared contracts. Smoke HTTP nghiệp vụ: **NOT RUN**.

Backup RBAC mới trước triển khai ở ngoài repository, được mã hóa AES-256-GCM, khóa Windows DPAPI CurrentUser, ACL chỉ chủ sở hữu/SYSTEM/Administrators. Đã restore thật vào database riêng trong container PG17 không có mạng: 97 permissions, 5 roles, 162 grants, 25 history rows khớp đầy đủ. Postflight còn giải mã lại bằng khóa đọc từ đĩa. Backup này chỉ chứa phạm vi RBAC/history cùng số lượng policy; không phải toàn bộ database hoặc Supabase platform. Chi tiết đường dẫn/hash ở `production-execution.json`. Backup logic Supabase lịch sử trước UC17 cũng đã kiểm tra hash, key và bằng chứng restore trước khi triển khai; không dùng nó để tuyên bố có snapshot toàn hệ thống hiện tại.

Hai lỗi harness ban đầu (readiness lúc initdb đổi server và escape `$$` của fault injection) được khắc phục trước khi chạy lại trọn bộ trên container mới. Không thay bốn file SQL; lưu lần chạy harness trước ở `pg17-prior-attempt.json`. Lần rehearsal cuối PASS rồi mới mở gate production. Không chạy rollback production; mọi xử lý sự cố sau này cần phê duyệt riêng.

Không chạy lại `deploy-uc24-25-rbac.cjs`: file `production-write-intent.json` chặn retry mù. Script gate trước triển khai cố ý yêu cầu còn thiếu 27 quyền, nên không dùng nó để kiểm tra sau triển khai. Dùng `verify-uc24-25-rbac-production.cjs` cho READ ONLY; script này không có đường apply/rollback. Việc đưa vào main/Prisma history là đợt metadata mới cần duyệt riêng, không thực hiện trong lượt này.

Xem [POLICY-DECISIONS.md](POLICY-DECISIONS.md) để điền quyết định và [READONLY-SMOKE.md](READONLY-SMOKE.md) để nghiệm thu chỉ đọc. Không đánh dấu UC17–UC25 end-to-end PASS khi các gate đó chưa đạt.
