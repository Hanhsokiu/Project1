# Kiểm toán database

## Đích và phương pháp

Database `btl_pr2b_audit_20261026144939_2663ec_live_e2e` trên PostgreSQL17 cục bộ 55451, hoàn toàn tổng hợp. [Raw catalog/integrity](evidence/20261026144939_2663ec/database/results.json). Không truy vấn ghi/xóa production, không Supabase, không reset/drop. Replay migration chuẩn vào DB test mới không thay thiết kế schema hoặc sửa migration cũ.

## Schema/catalog thực tế

| Kiểm tra | Kết quả |
| --- | --- |
| Migration history |12migration finished, checksumSHA256 khớp source, không rolledback |
| Constraints |397catalog rows (PK/unique/FK/CHECK), không diễn giải thành 397test độc lập |
| Foreignkeys |211constraints được kiểm orphan theo cặp cột thật, kể cả composite; không có orphan trong fixture |
| Indexes |224catalog rows toàn schema; không đồng nghĩa mọi query đã tối ưu |
| Triggerrows |55rows information_schema.triggers; một trigger nhiều event có thể xuất nhiều row, không gọi55unique triggers |
| Nullability/legacy |Giữ nullable metadata legacy và guard fail-closed, không backfill guessedownership/approval |
| State enums |[Inventory enums](evidence/20261026144939_2663ec/source-inventory.json); canonical task/review khác boolean/enum legacy |

GenericFK query bỏ qua FK tuple có thành phầnNULL theo semantics thông thường; không thay thế mọi CHECK/trigger/business invariant. Không làm hỏng database để thử constraint trên dữ liệu thật.

## Dữ liệu cuối luồng E2E

| Aggregate | Số record |
| --- | --- |
| ProposalVersion |4: ba v1của fixture và v2 được UI tạo |
| ProposalReviewDecision |2vòng, không ghi đè kết luận v1 |
| DossierFinalization/Receipt |1/0: tảiPDF không tự nhận giấy |
| GuidancePlan/Task |1/1 |
| TaskSubmission/ProgressReview |2/2, lần 1REVISION_REQUIRED, lần 2PASS |
| Notification |2, đều “Cập nhật đánh giá báo cáo” |
| FinalResult/DefenseEligibility |0/0 |

Task currentSubmission thuộc cùng task; COMPLETED có effective RECORDED/PASS. Các rowproducer1–3 được byte-level JSON comparison trước /sau E2E trong runner; không bị luồng4–8ghi đè. Receipt được kiểm bằng suite7 riêng, không suy từ 0receipt củaE2E rằng module chưa làm.

## Atomicity/concurrency đã kiểm động

- Membership/revision/history rollback khi audit lỗi; một CASwinner.
- Assignment/roundcounter/decision cùng transaction, unique active/vòngdecision.
- Versionpayload/pointer/counter/revision không partial khi audit hoặc phase close race.
- Finalization/snapshot/current pointer/receipt atomic; immutable oldsnapshot vàPDF.
- Plan/task/rebase/history không mất bài cũ khihandover.
- Submissioncurrent pointer/version/assets/claims và rollback metadata/storage cleanup.
- Revieweffectivepointer/taskcompletion/history/notifications/outbox rollback cùng nhau.

Nguồn:154 scenario groups tại [matrix](evidence/20261026144939_2663ec/test-case-matrix.json). Injectfault có chủ đích trong tests, không chứng minh databaseoutage/killprocess mọi điểm đều được thử.

## Finding/ rủi ro

1. **QA-007/008:** finalnotice/outboxtypes không có giao task/ nộp bài hoặc consumer eventđềcương. Dữ liệu task/submission đúng nhưng notificationworkflow chưa đủ.
2. **RISK-02 — thiếu index task-first:** `TASK_SUBMISSION` chỉ có PK(id) và unique(id,task_id); repositoryfilter taskId +ordercreatedAt/id chưa có index đầu task_id. Đây là catalogfinding đã xác nhận, **ảnh hưởng hiệu năng chưa được xác nhận **. Tinyfixture EXPLAIN lưu trongraw; sequentialscan ở2row không chứng minh bug hiệu năng.
3. **RISK-01:** lock THESIS_TERM FOR UPDATE cùng phase và assignments trong mỗi command; serialize command cùng đợt. Giữ correctness khihandover/phase close; chưa có benchmarkthroughput.
4. **RISK-03:** monitor/dashboard duyệt nhiều proposal/task/obligation trongmemory trước paging; có khả năng N+1. Chưa đo query count/EXPLAIN ởdataset đại diện.

Chỉ đề xuất additiveindex sau đo, migration mới và upgradecheck; không sửa SQL cũ. Databaseaudit trên fixture nhỏ không xác nhận dữ liệu /Supabase permissions/drift của môi trường nhóm. Upgradepopulatedbaseline từng bước là evidence lịch sử merge, ** không rerun trong audit này **; replay activechain mới không thay thế upgradecoverage.
