# Chức năng thiếu, dependency và phần chưa kiểm chứng

Không phải mọi mục dưới đây là bug của người phụ trách4–8. Các báo cáo triển khai có giới hạn được công bố; baseline rộng hơn vẫn cần quyết định acceptance. Không tự thêm nghiệp vụ hoặc đưa phần9–10 vào phạm vi sửa.

| ID | Yêu cầu / nguồn | Hiện trạng | Phân loại / owner cần chốt |
| --- | --- | --- | --- |
| GAP-01 |D06, API§5.2: SVwithdraw khiSUBMITTED; Khoareturn-to-draft khiUNDER_REVIEW có reason |Không thấy command/controller/UIhoàn chỉnh tronginventory hiện tại; báo cáo6nói chưa làm. Không có functionaltestđường này |MISSING FEATURE so với baseline; xác nhận task thuộc 5/6hay PR riêng |
| GAP-02 |D09: reopen dossierpauseplan, audit/rebase |Enums/guards/consumerpause/rebase có; APIproducerreopenhoàn chỉnh chưa có. Testgiảlập đầu vào reopened không chứng minh UIproducer |DEPENDENCY GAP phối hợp 1–3và7/8; không tự mở khóa SQL |
| GAP-03 |UC16/FR25: criteria/điểm giai đoạn |Baseline/models có; 8Cgiới hạn report review, họp /dashboard/notices; chưa có criteria producer/acceptanceapproved |BUSINESS SCOPE GAP /REQUIREMENT UNCLEAR cho cấu hình; không ápweightsđiểmtốt nghiệp |
| GAP-04 |UC14/15 notification |QA-007 xác nhận thiếu noticegiao/ nộp |BUSINESS LOGIC GAP,8A/8B+notification |
| GAP-05 |UC13/submit eventdelivery |QA-008:outbox producer có, consumer chưa |BUSINESS LOGIC GAP,5/6+notification |
| GAP-06 |Producerconfig: grant/routing/phase/profile/period/obligation |FixtureE2Ecung cấp input đúng; sampleUI hiện chưa đủ để bắt đầu 4–8ngay. Chưa có UIacceptancefullconfig mọi trường hợp |DEPENDENCY GAP/VẬN HÀNH, chủproducer1–3; không đoán grant/profile |
| GAP-07 |Consumer9–10 |Linksome404, chưa có E2Edefense/grading/finalreport |DEPENDENCY GAP, người 3; chỉ kiểm handofftrongaudit này |

## Không coi là missing theo baseline đã chốt

- Không ghép nhóm sinh viên; mỗiSV một hồ sơ/ đợt.
- Không có roleCOMMITTEE/chủtịch/thư ký riêng trong nhóm duyệt; membershipvà một common decision/vòng.
- Không có ReviewSession phòng /slotvật lý, không thu vote bắt buộc tất cả member.
- Không ký số; bốn chữ ký giấy, scanreceiptoptional.
- Không autosaveserver nếu D07 đã giới hạn manualsnapshot.
- Không tự tính đủ bảo vệ/điểm tốt nghiệp từ taskPASS; không tự gửi SMTPđến người thật trongtest.

## NOT VERIFIED / BLOCKED chính xác

| Phần | Trạng thái / lý do |
| --- | --- |
| UIautomation |KhôngBLOCKED: đã chạyEdgePlaywright; MCP không có không ngănbrowser thật |
| Writesdatabase |KhôngBLOCKED: có DBtestlocal riêng; productionwrites không được thực hiện |
| Consumer9–10full flow |DEPENDENCY GAP/NOT VERIFIED, không đủ bản triển khai tích hợp |
| Production/SupabaseDB/RLS |NOT TESTED theo phạm vi; không có đíchproduction được phéptác động |
| SMTPdelivery thật |NOT TESTED,workertắt để không gửi ra ngoài |
| Upgradepopulatedbaseline7suite |NOT RUN mới; có evidence lịch sử merge, không dùngthay kết quả mới |
| UIlong proposal500, mọi modal/cancel/sort/page/fileboundary |NOT VERIFIED đầy đủ quaUI; API có nhiều cụmcaseđạt và QA-001tái hiện |
| Screenreader/keyboard mọi modal |NOT VERIFIED; axe không thay kiểm thủ công |
| Load/memoryleak/ZIPevent loop |NOT VERIFIED; smoke DB nhỏ không đủ kết luận |
| Bố cục DOCX/PDF toàn mẫu |NOT VERIFIED đầy đủ; PDFtext/A4/bounds đã kiểm |

Các mục này là backlog acceptance cụ thể, không được đổi thành PASS chỉ vì build/unit/APIgreen.
