# Kết luận QA

**Có thể demo luồng chính với điều kiện đã nêu; chưa đủ căn cứ nghiệm thu toàn bộ baseline bước 4–8 hoặc triển khai production.**

## Trả lời 15 câu hỏi nghiệm thu

| Câu hỏi | Kết luận dựa trên bằng chứng |
| --- | --- |
| 1. Bước 4 hoàn thiện đến đâu? | Nhóm, membership, scope, CAS và archive đã có; 31 nhóm test và thao tác tạo nhóm qua browser đạt. Còn lỗi menu/accessibility và các tương tác UI chưa kiểm hết. |
| 2. Bước 5? | 27 nhóm test và hai vòng duyệt thật đạt; một kết luận chung gắn đúng phiên bản. Thông báo chưa được chuyển đến người dùng; withdraw/return-to-draft chưa đủ baseline. |
| 3. Bước 6? | 24 nhóm test về sửa, phản hồi, so sánh, nộp lại và bất biến đạt. Payload UTF-8 hợp lệ 110.377 byte bị 500: chưa nghiệm thu nội dung dài. |
| 4. Bước 7? | 19 nhóm test, chốt và tải PDF thật đạt; receipt được kiểm riêng qua API. Reopen producer và nghiệm thu trực quan toàn mẫu PDF còn thiếu. |
| 5. Bước 8? | 53 nhóm test cùng luồng plan/task/upload/review/dashboard thật đạt. Thiếu thông báo giao nhiệm vụ/nộp bài; criteria và đánh giá giai đoạn FR25 chưa đủ toàn UC16. |
| 6. Lỗi nghiêm trọng nào? | Chưa tái hiện P0/P1 trong phạm vi đã chạy. QA-001 là P2 chặn lưu input hợp lệ; QA-007/008 là P2 thiếu thông báo. Không suy rằng production không còn lỗi nghiêm trọng. |
| 7. Chức năng nào chưa hoạt động? | Withdraw/return-to-draft/reopen producer đầy đủ; criteria evaluation; delivery thông báo được nêu ở QA-007/008. Consumer 9–10 chưa nghiệm thu. |
| 8. Chức năng nào chỉ có UI? | Không có căn cứ gọi core 4–8 là chỉ UI: các thao tác chính đi tới DB thật. Sidebar có link consumer hội đồng dẫn 404. |
| 9. Phần nào cần làm lại? | Chưa có căn cứ viết lại toàn bộ. Cần bổ sung delivery và producer được chốt phạm vi, sửa JSON transport; giữ history/CAS/scope. |
| 10. Phần nào cần cải thiện giao diện? | Menu theo role/route, khôi phục session, contrast/ARIA; kiểm thêm mobile upload/review, các modal và lỗi form. |
| 11. Có sai hoặc thiếu nghiệp vụ? | Thông báo chưa đủ UC13–15; một số đường trả nháp/mở lại thiếu so với baseline. Không tự thêm vote, COMMITTEE hoặc nhóm SV. |
| 12. Có nguy cơ sai dữ liệu? | Chưa thấy corruption trong fixture; atomicity và các race đã thử đạt. Producer/legacy nullable/consumer vẫn cần kiểm ở môi trường đại diện. Task PASS không tự thành điểm hay đủ bảo vệ. |
| 13. Có lỗi phân quyền? | Các negative cases canonical đạt; 4 probe legacy hiện trả 403. Menu dẫn 403 là lỗi UX, không phải bằng chứng bypass. Chưa pentest toàn hệ thống. |
| 14. Tích hợp có chính xác? | Bàn giao từ bước 3 và core 4→8 đã kiểm đúng; dữ liệu producer được bảo toàn; không sinh FinalResult/DefenseEligibility. Luồng 9–10 chưa kiểm. |
| 15. Đủ điều kiện demo chưa? | Có điều kiện: database test, cấu hình và trạng thái đợt đúng, công bố giới hạn nội dung/thông báo/consumer. Chưa đủ nghiệm thu toàn baseline hoặc production. |

Không tính phần trăm hoàn thiện: 154 nhóm API, 15 checkpoint trình duyệt, 181 unit test backend và 115 frontend là số test đã chạy, không phải mẫu số yêu cầu nghiệp vụ đầy đủ. 71 operation trong auth inventory không thay thế các ca hợp lệ/biên/concurrency cho từng operation.

## Chuẩn bị demo

1. Mở UI tại http://127.0.0.1:5173; không chạy thêm server trùng cổng. Đợt sample bắt đầu ở OPEN_REGISTRATION, cần đi đúng bước 1–3 trước khi thao tác 4–8. Không mở khóa bằng SQL để che thiếu điều kiện.
2. Chuẩn bị grant, routing, phase PROPOSAL_EDIT/PROPOSAL_REVIEW/GUIDANCE, profile lớp/ngành và nghĩa vụ tuần. Thiếu cấu hình phải hiển thị readiness, không giả approval/receipt.
3. Demo các vai trò Khoa/GVHD/reviewer/SV; công bố phần chưa gửi thông báo và chưa tích hợp consumer. Luồng E2E đã chạy trên fixture riêng không tự biến thành dữ liệu UI sample.
4. Trước nghiệm thu nội dung thật, sửa QA-001 và kiểm lại cả API lẫn UI với nội dung dài; không chỉ chọn input nhỏ để che lỗi.

## Hồ sơ bàn giao

- [Tổng quan](00-executive-summary.md), [phạm vi](01-scope-and-requirements.md).
- [Lỗi có bằng chứng](12-confirmed-bugs.md), [chức năng thiếu](13-missing-features.md), [roadmap](14-improvement-roadmap.md).
- [Manifest bằng chứng](evidence/manifest-sha256.json), [tiến độ và hướng dẫn tiếp tục](RESUME.md).

Audit không sửa source/schema/lockfile/test nguồn, không cài package, không reset DB, commit, push hoặc merge. Artifact build/cache/temp được loại khỏi bộ bằng chứng bàn giao; database test giữ lại. Lỗi harness được lưu và phân loại riêng, không tính thành bug ứng dụng.
