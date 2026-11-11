> Acceptance update 2026-11-10: ACT Diagram.zip is now available and reviewed. Missing-ACT/group-approval statements below are historical. The user delegated technical project decisions. All 27 permission definitions (30 role pairs) and nine TEST policies are configured ONLY in isolated PG17 staging. Production remains 26 migrations / 124 permissions / 166 grants. See docs/implementation/B1-B10-TEST-REPLAY.md and the current run manifest.

# Mapping đủ 27 permission: role, scope, trạng thái và endpoint

Đối chiếu `docs/spec/dac-ta-use-case.md` mục B9–B10/UC17–UC25, Word gốc `Project_1_06.docx` (SHA-256 `2afea1a8d2cc74c50a690f4fb91874c1c83bb3d2ad1fbdb2fadc1db49b808f1a`), bản trích `docs/frontend/source-extracts/Project_1_06.md` P74, P83–P96 và controller/service hiện tại. `docs/diagrams/activity/README.md` chỉ nêu tên ba file `.drawio`; các file ACT thật không tồn tại trong workspace. Không coi README là đã đọc nội dung ACT. Đối chiếu ACT đầy đủ còn BLOCKED vì thiếu file; không chặn việc đối chiếu source và các đặc tả đã có.

Trong bảng, **F** = FACULTY có grant đúng term/bộ môn; **L** = LECTURER active có phân công hội đồng hợp lệ; **S** = STUDENT active sở hữu hồ sơ. ADMIN/COMMITTEE không thay thế role nghiệp vụ tại service. Quyền `read` và action phải cùng role; không ghép ADMIN quyền nhạy cảm với FACULTY read. Actor phải là tài khoản thật được phép dùng; không tự cấp grant term/bộ môn hay phân công để làm test chạy được.

Đã đọc thêm tài liệu người dùng `C:/Users/DELL/Downloads/B9-B10-mapping-27-va-trien-khai.md`. Phân loại đối chiếu: S1 = #1/#9/#10/#11 (đúng bốn FACULTY read đã cấp), S2 = #5/#8, S3 = các quyền còn lại. Bảng ghi khả năng role của source; với draft-preview/draft-export/components-export/final-export/comments-export/dossier-export/pii-export/dossier:export, đề xuất nghiệp vụ bảo thủ theo tài liệu mới là **FACULTY**, không gán LECTURER chỉ vì service có thể hỗ trợ. Mọi S2/S3 vẫn chưa được cấp.

S1 UC24 vẫn trả tên/mã SV của hồ sơ **trong grant được phép**, không tuyên bố payload hoàn toàn không có PII. Điều kiện yêu cầu trực tiếp của người dùng là không lộ PII ngoài phạm vi; các scope test kiểm tra điều kiện đó. Nếu cần ẩn cả tên/mã trong scope thì phải chốt thêm yêu cầu và thay DTO/UI, không tự coi đã đáp ứng.

Các endpoint đều có prefix `/api`. R = `/defense-results`, P = `/defense-reports`. `:id` của UC24 là termStudentId, không phải final_result.id. Ghi/xuất/tải vẫn cần flags và policy/nguồn hợp lệ, kể cả khi đã có permission.

| # | Permission | Role đề xuất theo source | Endpoint / trạng thái / điều kiện |
|---|---|---|---|
| 1 | defense-result:read | F; L; S cùng read-own | GET R/options, R, R/:id; POST R/:id/preview. F chỉ term/bộ môn; L đúng hội đồng; S hồ sơ sở hữu. Read riêng chỉ metadata/trạng thái, ẩn sources/calculation/saved calculation/history. |
| 2 | defense-result:confirm | L cùng read | POST R/:id/confirm; vai trò hội đồng thuộc policy.confirmation.roles, nguồn hiện hành, cửa sổ hợp lệ; không xác nhận thay người khác. Chờ policy/phân công. |
| 3 | defense-result:finalize | F cùng read | POST R/:id/finalize; đủ nguồn/confirmation, đúng finalizeWindow, separation, revision/evidence; chờ duyệt người/phạm vi. |
| 4 | defense-result:publish | F cùng read | POST R/:id/publish; đã finalized/current, đúng publication window và separation; chờ duyệt riêng. |
| 5 | defense-result:read-own | S cùng read | GET R/R/:id; hồ sơ sở hữu; chỉ mở trạng thái riêng, không tự mở điểm. |
| 6 | defense-result:components-read | F/L; S khi được công bố | GET/preview UC24 và reader UC25. F/L có thể đọc điểm nội bộ theo scope nên là quyền nhạy cảm. S còn cần final-read, PUBLISHED/current và policy.studentComponents. Không cấp đợt bốn quyền. |
| 7 | defense-result:history-read | F/L cùng read | GET/preview UC24; lịch sử actor/revision trong phạm vi. Nhánh S luôn ẩn history. Không cấp đợt bốn quyền. |
| 8 | defense-result:final-read | S cùng read + read-own | GET/preview UC24; PUBLISHED/current + publication.studentFinal. Chưa có policy nên BLOCKED. |
| 9 | defense-report:read | F; L đúng hội đồng | GET P/options, đồng thời là gate nền của mọi action P. Không mở riêng điểm, nhận xét hoặc export. |
| 10 | defense-report:templates-read | F/L cùng read | GET P/templates?termId; L cần committeeId thực. Chỉ metadata mẫu; DRAFT/ENGINEERING_DRAFT không được coi là mẫu chính thức. |
| 11 | defense-report:statistics | F/L cùng read | GET P/statistics?termId; chỉ số lượng/tải/tiến độ trong scope. Không average/pass/distribution/sheet counts khi thiếu quyền điểm tương ứng. |
| 12 | defense-report:preview | F/L cùng read và quyền nội dung mẫu | POST P/exports/preview; repo.read nhưng vẫn kiểm tra list-export và quyền theo columns. Preview DRAFT cần draft-preview. Không thuộc runner GET. |
| 13 | defense-report:export | F/L được policy mẫu cho phép | POST P/exports; ghi metadata/audit/idempotency/file. Cần mẫu/version approved, nguồn hiện hành, quyền nội dung, flags. Chờ duyệt riêng. |
| 14 | defense-report:history-read | F/L cùng read | GET P/exports, P/exports/:id; kiểm tra lại ownership/scope và quyền nội dung; bản DRAFT có thể cần draft-export. Không tự cấp vì tên có chữ read. |
| 15 | defense-report:download | F/L cùng read | POST P/exports/:id/download; có ghi audit/idempotency, kiểm tra thời hạn/nguồn/quyền hiện hành. Không phải smoke READ ONLY. |
| 16 | defense-report:grade-statistics | F/L được duyệt | GET P/statistics; mở số phiếu/kết quả đã chốt; reader kết quả cần defense-result:components-read. Policy quyết định phạm vi release. |
| 17 | defense-report:score-statistics | F/L được duyệt | GET P/statistics; mở điểm trung bình/phân bố/tỉ lệ theo policy.statisticsRelease và bins approved; cần quyền UC24 liên resource. |
| 18 | defense-report:draft-preview | F/L được duyệt | POST P/exports/preview với mode DRAFT; vẫn cần preview + các quyền nội dung; không biến DRAFT thành bản chính thức. |
| 19 | defense-report:draft-export | F/L được duyệt | Export/history/detail/download bản DRAFT; vẫn cần action nền và quyền nội dung. Không cấp mặc định. |
| 20 | defense-report:list-export | F/L được mẫu cho phép | Gate nội dung bắt buộc của mọi mẫu kể cả preview; gồm danh sách/tên/mã SV nên phải có scope và quyết định chia sẻ. |
| 21 | defense-report:components-export | F/L được duyệt | Mẫu có ADVISOR_SCORE/REVIEWER_SCORE/COMMITTEE_SCORE/MEMBER_SCORES/REVIEWER_SCORES; quyền UC24 và release riêng vẫn áp dụng. |
| 22 | defense-report:final-export | F/L được duyệt | Mẫu kết quả/biên bản hoặc cột FINAL_SCORE; cần kết quả chính thức/current và policy release. |
| 23 | defense-report:comments-export | F/L được duyệt | COMMENTS/QUESTIONS; phiếu GVHD còn cần F + defense-confirmation:comment-read; phiếu GVPB cần đúng GVPB hoặc F + defense-reviewer-grade:comment-read. |
| 24 | defense-report:minutes-export | F/L theo mẫu | PDF_MINUTES; thiếu CONCLUSION/DEFENSE_REMARKS/REVISION_REQUESTS phải block hoặc để trống theo allowMissing được duyệt. Chỉ UNSIGNED, không giả lập đồng ký. |
| 25 | defense-report:dossier-export | F/L theo mẫu | PDF_DOSSIER; cùng pii-export, dossier:export, mẫu/version và bản đề cương chốt hiện hành. |
| 26 | defense-report:pii-export | F/L theo mẫu | PDF_DOSSIER; dữ liệu cá nhân chỉ đúng hồ sơ/scope đã duyệt; không gộp vào read. |
| 27 | dossier:export | F/L theo policy mẫu và quyền nền | Reader PDF_DOSSIER của UC25 gọi snapshot B1–B8 đã finalized, checksum/templateVersion đúng; không mở quyền sửa đề cương. |

Bốn quyền được duyệt có điều kiện cho FACULTY chính xác là #1, #9, #10, #11; đã được cấp production sau SQL/service test PASS và khóa tự hết. Những role/action còn lại chỉ là mapping để duyệt, **không được gán ở lượt này**. Đặc tả xác định Khoa/Giáo vụ làm UC24/25 nhưng không tự phê duyệt thời điểm công khai điểm, rubric/rounding, người finalize/publish hoặc xuất PII.

Đã sửa `report.reader.ts`: với FACULTY, committeeId phải thuộc đúng term và bộ môn grant trước khi trả access; tránh options liệt kê tên hội đồng ngoài phạm vi. Có regression riêng trong `faculty-read-access.spec.ts`. Bản sửa chỉ nằm nhánh local; chưa thay đổi Render/main. Website nghiệm thu phải chạy đúng build nhánh này.
