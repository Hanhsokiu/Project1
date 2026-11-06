# Roadmap khắc phục theo bằng chứng

## Ưu tiên trước nghiệm thu nội dung thật

1. **QA-001/P2:** thống nhất giới hạn byteUTF-8, JSON parser và error413; giữ draft; thêm authenticated API+UIregressioncỡbiên. Không tănglimitvô hạn. Nghiệmthu bằng control201/valid large201/oversize413vàDB không partial.
2. **QA-007/008/P2:** thống nhất delivery contract, bổsung notice/consumer theo đúng recipienthiện hành. Test trùng request/rollback/handover/revokedgrants; không đưaPII/ toàn content vào outbox/log. Emailworkerchung không tự động tiêuthụ mọi OutboxEvent mới.
3. **GAP-01/02:** chốt đầu vệccủawithdraw/return-to-draft/reopen, quyền /reason/CAS/planpause/rebase và phiên bản immutable. Cần quyết định scope, không tự thiết kế lại quytrình.

## Ưu tiên trải nghiệm demo

4. **QA-002/003/P3:** một manifestchungcho menu/guard; ẩnlink không đủ quyền / chưa có consumer. Giữbackend RBAC, không thêm9–10 để sửa link404.
5. **QA-006/P3:** reactive auth state/expiredsessionCTA; giữ return path/draft, không redirectloopkhi401 đồng thời.
6. **QA-004/005/P3:** sửa contrast token/typography vàsemanticgroup; axe+keyboard test, không claimfullWCAG chỉ vì scan3screenđạt.
7. Chuẩn bị đợt demo đúng trạng thái /officialassignment/grants/phase/profile/obligation; dữ liệu demo được đánhdấugiảlập, không tạoreceipt/approval chính thức giả để mở menu.

## Rủi ro kỹ thuật — chưa phải bug hiệu năng đã đo

| ID | Phân tích tĩnh / catalog | Cần kiểm thêm | Cách xử lý sau đo |
| --- | --- | --- | --- |
| RISK-01 |`proposal-review.repository.ts:277`lockterm+phase+assignments toàn đợt FORUPDATE; PDF/fileIO có thể trongtransaction |Concurrentusers cùng đợt, lock wait/latencyp95/tỷ lệ retry |Thiết kế sharedrevision/locktheoaggregate phối hợp producer; không tự bỏlock |
| RISK-02 |TASK_SUBMISSION thiếu indextask-first, catalog đã xác nhận |EXPLAINởdatasetđạidiện, count/historyqueries |Additive migration index(task_id,created_at,id) nếu có căn cứ; không sửa migration cũ |
| RISK-03 |Dashboard/monitorquavònglặpproposal/task/obligation, lọc/pagingsaumaterialize |Querycount/rows/memory với multipleterms/largecohort |Batch/scopedSQLaggregation, giữ weeklymissingsemantics |
| RISK-04 |inflateRawSync/CRC trên requestthread, pending quotachecksauvalidation |Eventlooplag/RSS/concurrentuploadsmoke trên DBtest |Concurrencybudget/worker/quarantine được review, giữ cap/path/CRC |
| RISK-05 |Sessionrepository kết hừaxuyênfeature, transaction/idempotencypatternlặp |Reviewcoupling/changesurface, không có runtime failure đã chứng minh |Refactor riêng saukhitestbehavior đầy đủ; không trộn vào fixbug |
| RISK-06 |ReviewGroupExceptionFiltercatchunexpected500 không logdiagnostic |Controlledunexpectederror và quan sát log/correlation |Structuredredactedlogging, không trả SQL/stack/academictextchoclient |
| RISK-07 |CI chưa gatefull browserliveE2E hiện có |Đối chiếu workflowremotevàrunnerbrowser, không coi local Node 24 là CI Node 20 |PRCI riêng, giữ negativeownershipcases; không bỏexpectation để xanh |

Bundlefrontend có cảnh báo >500kB vàViteCJSdeprecated; build không fail. Không đổi library/dependenciestrongaudit. Không có SLAtải/chất lượng nghiệmthu nên không nêu số RPS/p95cam kết.

## Top10 mục review, không ngụy tạo10criticalbugs

QA-001,QA-007,QA-008,QA-006,QA-002,QA-003,QA-004,QA-005,GAP-01/02,RISK-01/03. Tám mục đầu có bằng chứng runtime/axe hoặc gap đã đối chiếu; hai mụccuối làm issingproducer/ rủi roluồngvàtải. Chi tiếtseverity phải đọc đúng loại ởbugregister.

## Regression gate sau PR khắc phục

Prismavalidate+typecheck+unit+build;154 scenario groups; handoffPUBLISHED/FINALIZED;71 operationauth; liveworkflow15checkpoint; boundarylargepayload; negativeIDOR/private files; UIrole/mobile/a11y/session. Chạy7upgrade suites trên DB mới nếu thaymigration/schema; shareddeploy cần reviewđích/backup riêng.

Không yêu cầu thiết kế lại toàn bộ 4–8: core workflow vàdatahistory đã có bằng chứng. Chỉ cần thiết kế /bổsungphầndelivery vàproducer được chốt scope; performancearchitecture chỉ đổi sau đo.
