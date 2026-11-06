# Lỗi và khoảng trống đã có bằng chứng

> **Cập nhật sau audit — 27/10/2026:** người dùng đã cho phép sửa source và đồng nhất UI theo bước 1–3. Kết quả sửa/retest hiện tại ở [báo cáo đồng nhất giao diện](../implementation/integration-ui-fixes-2026-10-27.md), gồm trạng thái từng QA-001…008 và giới hạn còn lại. Các entry OPEN bên dưới ghi nhận **thời điểm audit**, không phải trạng thái worktree sau sửa. Raw evidence lịch sử được giữ nguyên. Thông báo trong app đã bổ sung; worker OutboxEvent/email vẫn chưa triển khai.

> **Kiểm lại chính UI người dùng:** DB UI chưa có đề cương/task; đã thêm đợt demo riêng trên cùng DB cổng 5173 và kiểm thao tác có dữ liệu. Sửa thêm contrast ở dòng/badge/pagination xuất hiện khi có dữ liệu. Xem [báo cáo kiểm UI có dữ liệu và link thao tác](../implementation/integration-ui-workflow-demo.md).

Ngày báo cáo27/10/2026. **6 bug/UX issues +2 business logic gaps** dưới đây, không phải 8securitycriticalbugs. Không có P0/P1 được tái hiện trong phạm vi đã chạy. Rủiro chỉ từ code và chức năng chưa có tách ở [missingfeatures](13-missing-features.md)/[roadmap](14-improvement-roadmap.md).

Môi trường chung cho từng entry: Windows, Node 24.13.1; nhánh `fix/integration-ui`, commit `0c361709df34837df65b3ed429691599e6e2d93f`, worktree có thay đổi localsetup từ trước audit. Frontend `http://127.0.0.1:5173`; APIUI `http://127.0.0.1:3000/api`; E2E Vite50180/APIloopback ephemeral; DBtestPG17cổng55451. Không Supabase/production. Status mọi entry: **OPEN, chưa sửa trong audit**.

## QA-001 — Đề cương hợp lệ vượt JSON limit bị trả 500

| Trường | Nội dung |
| --- | --- |
| Module/Step |ProposalVersions, step6; sharedcontent/transport integration |
| Category |CONFIRMED BUG |
| Severity/Priority |P2–MAJOR /P2; ưu tiên sửa đầu vì chặn lưu nội dung hợp lệ |
| Environment/Branch/SHA |Môi trường chung; API ephemeral với AppModule, ValidationPipe, GlobalExceptionHandler giốngmain |
| Preconditions |Syntheticowner đã login/sessionvalid, proposalDRAFT, EDIT mở, agreement/assignment đúng, revision0 |
| Steps |1.POSTversions với smallcontent vàkey riêng →201.2.Dùngrevision trả về; thayobjectives/scope/mainContents/tools/expectedResults bằng 11.000 ký tự `đ`mỗi trường.3.Xác nhận sharedschema hợp lệ.4.POSTversions với key mới |
| Expected |Nội dung trongcontract được lưu 201; nếu có budget riêng phải công bố/validate tương thích, oversize thật trả 413 rõ ràng |
| Actual |110.377bytes→500INTERNAL_ERROR; parsererror413entity.too.large, limit102400; không appendpartial version |
| Evidence |[Diagnosedresults](evidence/20261026144939_2663ec/boundary-diagnosed/results.json), small control201, caseexpected201/actual500; versioncount2→2 |
| RelatedFiles |`shared/src/contracts/proposal-versions.ts:10`, `backend/src/main.ts:12`, `backend/src/common/exception/global-exception.handler.ts:69` |
| SuspectedRootCause |**Parsermetadata đã đo:** mặc định 100KiB; error không phải NestHttpException nênGlobalExceptionHandler đổi thành 500. DTOgiới hạn ký tự không tương thích byte budget |
| BusinessImpact |SV/GVHD không lưu được đề cương dài hợp lệ; thông báo 500chung không giúp sửa input; chưa thấy data corruption |
| RecommendedFix |ThốngnhấtUTF-8byte budget frontend/shared/parser, hard cap hữu hạn; mapPayloadTooLargeError về 413/errorenvelope; giữ draft khi thất bại |
| RegressionRisk |Tănglimitảnh hưởng resource/endpoint khác; không nâng vô hạn hoặc hạcontract âmthầm. TestASCII/Việt/boundary/exceed trên authenticated API vàUI |
| VerificationStatus |REPRODUCED bằng API+DB thật; UI large-submit riêng NOT VERIFIED; chưa fix/retest |

## QA-002 — Sidebar hiển thị link không dành cho SV

| Trường | Nội dung |
| --- | --- |
| Module/Step |ReviewGroupLayout dùng chung4–8 |
| Category |UI/UX ISSUE, confirmed |
| Severity/Priority |P3–MINOR /P3 |
| Environment/Branch/SHA |Môi trường chung, Edge desktop1440×1000, UI5173/API3000 |
| Preconditions |Đăng nhập sv001, mở /guidance/tasks |
| Steps |Trongsidebar bấm“Nhóm duyệt đề cương” |
| Expected |Điều hướng chỉ đưa chức năng hợp vai trò hoặc giải thích quyền trước click |
| Actual |Link vẫn hiện, click chuyển/forbidden và403“Không đủ quyền ” |
| Evidence |[FollowupJSON](evidence/20261026144939_2663ec/ui-followup/results.json), [403screenshot](evidence/20261026144939_2663ec/ui-followup/student-forbidden-stable.png) |
| RelatedFiles |`frontend/src/features/review-groups/workspace.tsx:29`, `frontend/src/app/router/route-manifest.ts`, `routes.tsx:WorkflowAccess` |
| SuspectedRootCause |Navigation tĩnh không intersectrouteManifest/userroles trước render |
| BusinessImpact |Người dùng đi vào ngõ cụt; ** không có chứng cứ bypass backend RBAC** |
| RecommendedFix |Dùng cùng manifest/ quyền cho menu vàguard; giữ backend kiểm permission/scope |
| RegressionRisk |Không vô hiệu guard để link“hoạt động ”; testSV/GV/Khoa/adminvàback/refresh |
| VerificationStatus |REPRODUCED, chưa fix |

## QA-003 — Link hội đồng trong workspace dẫn 404

| Trường | Nội dung |
| --- | --- |
| Module/Step |Sidebar4–8→consumer9–10 |
| Category |UI/UX ISSUE +DEPENDENCY GAP |
| Severity/Priority |P3–MINOR /P3 |
| Environment/Branch/SHA |Môi trường chung, UI5173/API3000, Edge |
| Preconditions |SV đang ở/guidance/tasks |
| Steps |Click“Hội đồng & phản biện” |
| Expected |Chỉ hiện link nếu có destination đã triển khai và được phép; nếu chưa có, thể hiện trạng thái rõ |
| Actual |Đi/defense/committee, trang404ổn định |
| Evidence |[404screenshot](evidence/20261026144939_2663ec/ui-followup/downstream-404-stable.png), [JSON](evidence/20261026144939_2663ec/ui-followup/results.json) |
| RelatedFiles |`frontend/src/features/review-groups/workspace.tsx` navigation, `frontend/src/app/router/routes.tsx` |
| SuspectedRootCause |Navigation chứa routeconsumer chưa có trongrouter hiện tại; grading/results cũng cần reviewtĩnh, chưa click xác nhận ởca này |
| BusinessImpact |Demo dễ mất luồng, gây hiểu nhầm9–10 đã hoàn chỉnh |
| RecommendedFix |Ẩn/đánh dấu chức năng chưa có theo manifest; phối hợp chủmodule9–10, không tự viếtdefense/gradingtrongPR sửa UI |
| RegressionRisk |Đừngchelinkconsumer đã có ở nhánh khác trước khi đối chiếu bản tích hợp |
| VerificationStatus |REPRODUCED cho/defense/committee; consumer nghiệp vụ NOT VERIFIED |

## QA-004 — Contrast chữ phụ không đạt trong workspace

| Trường | Nội dung |
| --- | --- |
| Module/Step |CSSworkspace chung4–8 |
| Category |UI/UX ISSUE, accessibility |
| Severity/Priority |P3–MINOR /P3; axeimpact“serious” là phân loại công cụ, không tự đổi thành P1 |
| Environment/Branch/SHA |Môi trường chung, Edge1440×1000, axeWCAG2A/AA/2.1AA |
| Preconditions |Khoa mở formnhóm sauchọn đợt hoặc guidance/tasks |
| Steps |Scanaxe và xemnodecontrastcụ thể |
| Expected |Normaltextcontrast>=4,5:1 trongnhómWCAG đã scan |
| Actual |Navigationsection2,79:1; breadcrumb4,22:1;footer2,69:1;5 nodeởmỗiscreenbịflag |
| Evidence |[Axeviolations](evidence/20261026144939_2663ec/ui-boundaries-final/results.json), [ảnhform](evidence/20261026144939_2663ec/ui-boundaries-final/group-validation.png) |
| RelatedFiles |`frontend/src/features/review-groups/workspace.css`, `workspace.tsx` |
| SuspectedRootCause |Màu chữ nhạt trên nềnnhạt vàcỡ chữ 9–10px |
| BusinessImpact |Đọc khó với người thị lực yếu; chưa đạtclaimWCAGAAtrongcácnode đã scan |
| RecommendedFix |Điều chỉnhtokenmàu/typography, scan lại cả workspace; giữ cấu trúc nghiệp vụ |
| RegressionRisk |Kiểmhover/active/disabled state riêng; không suy disabledform phải đạt cùng rule textnormal |
| VerificationStatus |REPRODUCED bằng axe+computedcontrast; toàn bộ appaccessibility NOT VERIFIED |

## QA-005 — aria-label không hợp lệ trên div thành viên

| Trường | Nội dung |
| --- | --- |
| Module/Step |ReviewGroupcomponents, step4 |
| Category |UI/UX ISSUE, accessibility |
| Severity/Priority |P3–MINOR /P3 |
| Environment/Branch/SHA |Môi trường chung, formnhómUI5173, Edge+axe |
| Preconditions |Khoa mở formnhóm, danh sáchselectedmembers |
| Steps |ScanaxeWCAG, xemviolationaria-prohibited-attr |
| Expected |Accessible name gắn element/role được ARIAcho phép |
| Actual |`<div class="mt-3 flex flex-wrap gap-2" aria-label="Thành viên đã chọn">` không có rolesupportlabel |
| Evidence |[Node/HTML/targetraw](evidence/20261026144939_2663ec/ui-boundaries-final/results.json) |
| RelatedFiles |`frontend/src/features/review-groups/components.tsx` |
| SuspectedRootCause |Dùnglabel trên generic container thay vì semanticgroup/list phù hợp |
| BusinessImpact |Accessiblelabel không đángtin cho assistive technology |
| RecommendedFix |Dùngsemantic markup/role đúng hoặc labeledheading phù hợp; retestaxe vàkeyboard/screen reader |
| RegressionRisk |Khôngthêmrole tùytiện làm thay đổi keyboardsemantics |
| VerificationStatus |REPRODUCED bằng axe, screen readerthủ công NOT VERIFIED |

## QA-006 — Sau401 vẫn đứng ở màn workflow, thiếu đường đăng nhập lại

| Trường | Nội dung |
| --- | --- |
| Module/Step |API session/interceptor vàworkflow layout4–8 |
| Category |UI/UX ISSUE, confirmed |
| Severity/Priority |P3–MINOR /P3 |
| Environment/Branch/SHA |Môi trường chung, EdgeUI5173/API3000 |
| Preconditions |SV đăng nhập, ởmànworkflow; probeđặttoken/refreshinvalid trongcontexttest |
| Steps |1.Setutc-api-access/refresh=`invalid`.2.Mở/topic/proposal.3.ChờAPI401/clearApiSession vàthêm10giây |
| Expected |Thông báo phiên kết thúc và hành động đăng nhập lại /redirect có giữ return path |
| Actual |Sessionstorage đã clear; vẫn /topic/proposal báo token lỗi,0link/login |
| Evidence |[FollowupJSON](evidence/20261026144939_2663ec/ui-followup/results.json), [ảnhsau10s](evidence/20261026144939_2663ec/ui-followup/expired-session-after-10s.png) |
| RelatedFiles |`frontend/src/shared/api/http-client.ts`, `api-session.ts`, `frontend/src/app/router/routes.tsx:WorkflowAccess` |
| SuspectedRootCause |Interceptorclearstorage nhưng không phát reactive auth state/navigationevent; guard đọc storage không tự rerender |
| BusinessImpact |Ngườidùngkhóbiếtbước tiếp; có thể reload/manual/login để phục hồi; API vẫn chặn đúng |
| RecommendedFix |Authcontext/sessionexpiredsignal đồng nhất, loginCTA/redirect, preservelocaldraft/return path |
| RegressionRisk |Tránhredirectloop/race refresh, không logtoken; tests401lặp/concurrentrequests |
| VerificationStatus |REPRODUCED cho401forcedcredential; backendLoginSession hết hạn thật có test401 riêng, không tuyênbố đã chờJWT tự expiretrongbrowser |

## QA-007 — Thiếu thông báo giao nhiệm vụ và bài nộp

| Trường | Nội dung |
| --- | --- |
| Module/Step |Guidancetasks/submissions, step8A/8B |
| Category |BUSINESS LOGIC GAP, runtime+source evidence |
| Severity/Priority |P2–MAJOR /P2 |
| Environment/Branch/SHA |Môi trường chung; full live E2E trên DBaudit riêng |
| Preconditions |GVHD/owner/plan/phase đầy đủ; fixtureban đầu chưa có task/submission/notification |
| Steps |1.GVHDtạotaskquaUI.2.SVuploadcommitv1rồiv2.3.Đối chiếu audit/task/submission vànotification/outboxcuốiluồng |
| Expected |UC14:SV nhận noticekhi được giao. UC15:GVHD nhận noticekhi nộp bài; recipient đúng current assignment |
| Actual |Task/submission/audit đã ghi;2notices đều “Cập nhật đánh giá báo cáo”; không noticegiao/ nộp. Sourcetaskcommit/submissioncommit không tạonotice hoặc eventcho cách ành động này |
| Evidence |[DBcounts/titles/outboxtypes](evidence/20261026144939_2663ec/database/results.json), [liveflow](evidence/20261026144939_2663ec/live-e2e/live-browser.json); UC14/15 bảng46/47trong[spec](../frontend/source-extracts/Project_1_06.md) |
| RelatedFiles |`backend/src/guidance/tasks/guidance.service.ts:845`, `backend/src/guidance/submissions/submission.service.ts:480` |
| SuspectedRootCause |8Ahoãn thông báo; 8C chỉ bùprogressreviewnotice, chưa bùtask/submissionevents |
| BusinessImpact |SV/GVHD phải chủ động mở list, có thể bỏlỡnhiệm vụ / bài mới |
| RecommendedFix |Notice/eventtransactional đúng recipient, genericpayload+scopedlink, idempotentvàrollback; không cần gửi mail thật trongaudit |
| RegressionRisk |Trùngnoticekhiretry, saiGVHDsauhandover, leaklink/metadata; giữ testsatomicity |
| VerificationStatus |CONFIRMED REQUIREMENT GAP; chưa implement; không kết luận SMTP toàn bộ hỏng |

## QA-008 — Proposal events chưa có consumer thông báo

| Trường | Nội dung |
| --- | --- |
| Module/Step |Proposalreview/versions→notification, step5/6 |
| Category |BUSINESS LOGIC GAP, runtime+source evidence |
| Severity/Priority |P2–MAJOR /P2 |
| Environment/Branch/SHA |Môi trường chung, DBE2E riêng |
| Preconditions |Reviewv1REVISION_REQUIRED, SVresubmitv2, reviewv2APPROVED |
| Steps |Thực hiện liveflow; đối chiếu OutboxEventvàNotification; tìmconsumer các event types trongbackend/src |
| Expected |QuytrìnhUC13 thông báo SV/GVHDkhi cần sửa; deliverytheoevent được xác nhận, không nhầmlẫnsavedOutbox với đã gửi thông báo |
| Actual |PROPOSAL_REVIEW_DECIDED=2, PROPOSAL_VERSION_SUBMITTED=1; không noticeproposal; không thấy consumertrongsource. EmailWorker hiện tại chỉ xử lý EmailOutbox khác |
| Evidence |[Outbox/notificationcatalog](evidence/20261026144939_2663ec/database/results.json), [ triển khai5ghihoãnworker](../implementation/05-step5-implementation-report.md), [ triển khai6](../implementation/06-step6-implementation-report.md) |
| RelatedFiles |`backend/src/topic/proposal-reviews/proposal-review.service.ts:957`, `backend/src/topic/proposal-versions/proposal-version.service.ts:518`, notificationmodule |
| SuspectedRootCause |Producercommitoutbox đã có; delivery consumer chưa được implement, không phải là outboxghiDB thất bại |
| BusinessImpact |Thông báo yêu cầu sửa không đếninbox; core UI vẫn đọc trạng thái đúng khi mở lại |
| RecommendedFix |Chốtin-app/emaildelivery contract, thêmconsumeridempotentvàstatus/retry được kiểm; không dùngSMTPproduction để test |
| RegressionRisk |Trùngdelivery, quyền resource đã thu hồi, PIIpayload, emailworkerchungbịảnhhưởng |
| VerificationStatus |CONFIRMED REQUIREMENT GAP; deliverytiming/SLA chưa có để đánhgiálatency; chưa được sửa |

## Phân biệt với kết quả lịch sử

Legacytopic/registrationIDOR H01/H02 của06-final-review ** không còntái hiện **:4 probe 403. CASupdategroup500trongảnhCI cũ không tái hiện ở31 ca APIstep4. Không mở lại bug chỉ vì báo cáo cũ có finding; cũng không xóa bằng chứng cũ.
