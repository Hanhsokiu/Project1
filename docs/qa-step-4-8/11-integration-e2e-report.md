# Tích hợp và end-to-end

## Chuỗi thật

Playwright Edge→React/Vite→NestJWT/guards→controller→service→Prisma→PostgreSQL17→private files→response→ReactUI. Không fulfill/mockresponse họcthuật. Guardbrowser chỉ chặn outbound ngoài originlocal.

[15 browsercheckpoints](evidence/20261026144939_2663ec/live-e2e/live-browser.json), [aggregate](evidence/20261026144939_2663ec/live-e2e/live-e2e.json), [traffic](evidence/20261026144939_2663ec/live-e2e/live-api-traffic.json).

| Điểm nối | Thao tác và mong đợi | Quan sát |
| --- | --- | --- |
| 4→5 |Khoa tạo nhóm với roster hợp lệ rồi phân v1 |Nhóm thật và exactSEALEDv1 dùng cho vòng1 |
| 5→6 |Reviewer start, yêu cầu sửa kèm comment |SV thấy phản hồi đúng v1 |
| 6→5 |SV savev2, responseDECISION, resubmit |V1/ cũ không đổi; vòng mới đúng v2 |
| 5→7 |Reviewer approvev2, Khoa finalize |FinalizationapprovedVersionIdv2, không tự receipt |
| 7→8A |SV tảiPDF, GVHD createplan/task |PDFprivate thật, plan chỉ sauFINALIZED |
| 8A→8B |SV uploadPDF+ZIP, commitv1 |Bài immutable, filesprivate, current pointer đúng |
| 8B→8C→8B |GVHD REVISION_REQUIRED, SV nộp v2 |Bài/files/ nhận xét v1 giữ nguyên |
| 8C |GVHD PASSv2 |TaskCOMPLETED, effective PASS; SV không tự complete |
| 8Cmonitor |Khoa lọcadvisor và xem nghĩa vụ tuần |1completed task nhưng 1weekly chưa có task/ báo cáo, không đếm falsecomplete |
| Cross-scope |Account khác thử proposal/task/review/file |403/404; UI không hiện controlđánhgiá choSV khác |

PDFdownloaddùngpdfjs kiểm textViệt, A4 và bounds; DBassert oldversion, exactdecision, taskstate vàproducerpreservation. Không phải mockPDF hoặc chỉ thấy toast.

## Tích hợp 1–3 mới được chạy lại

[Handoffregression](evidence/20261026144939_2663ec/handoff/results.json), [testassertions](evidence/20261026144939_2663ec/handoff/vitest.json):

1. Finalize trước publish bị từ chối; publish tạoPUBLISHED và chưa có finalizedmetadata.
2. SV không finalize; stale revisionbị409.
3. Khoa finalize→FINALIZED với actor/time; requestlặp không thêmaudit chốt.
4. Step3draft/agree được tạo bằng API thật; Khoa không tự prepareworkflow thaySV.
5. SVhandoff tạoDRAFT mới, provenance, giữ snapshot nguồn; không giảSEALED/submitted; cần bổsungdate/schedule.
6. Handofflặp không duplicate; writerlegacy sauhandoffbị409.

Đây là 1testVitest chứa nhiều assertion, không phải 11integrationtests cũ. Fullterm/import/HTTP1–3 là evidence lịch sử merge; không tự tính là chạy mới ởaudit.

## Tích hợp 9–10

Đã kiểm không sinh FinalResult/DefenseEligibility sauPASS task; legacyboolreview/điểm không bịghi đè. Phânchiaownership vàcontractapprovedVersion/finalization/currentreview được đối chiếu nguồn.

**DEPENDENCY GAP:** chưa chạy consumer9–10 end-to-end. Sidebar `/defense/committee` dẫn 404, `grading/results` cònlinktĩnh không có router phù hợp. Không triển khai defense/grading trong audit và không quy missingconsumer thành corruption bước4–8.

## Gaps được luồng thật bộc lộ

DBsauflow chỉ có 2notification progressreview; không có notice giao task/ nộp bài (QA-007). Proposalreview/submitted event có OutboxEvent nhưng không có consumer delivery (QA-008). Vì vậy E2Erunner PASS là **workflowtestedsubset**; không chứng minh toàn bộ yêu cầu thông báo UC12–16 đã đạt.

Cácfixture cung cấp producerinputs để test4–8, không chứng minh UIproducer cấu hình đủ mọi grants/phase/obligations ngoài đời. Đợt sample củaUI5173 cònOPEN_REGISTRATION, bắt đầu 4–8 cần đi quacác bước chuẩn/ đủ precondition; không mở khóa bằng SQL để che dependency.
