# Danh sách phê duyệt B9–B10

Ngày bàn giao UC18: 2026-11-07. Đây là danh sách cần nhóm/Khoa xác nhận sau các phần code; không phải biên bản phê duyệt. Chưa có policy production được tạo/cập nhật trong lượt này. Không lấy fixture có chữ APPROVED làm quy định thật.

## UC17 và dependency UC15–UC16

| Quyết định cần duyệt | Hành vi kỹ thuật hiện có | Trạng thái |
| --- | --- | --- |
| Bước điểm GVHD, rubric và cách tổng hợp/làm tròn | Thang 10; bước điểm/rubric lấy UC17_POLICY versioned; không suy ngưỡng đủ điều kiện bảo vệ từ điểm | Chờ Khoa; Decimal(4,1) cần đối chiếu |
| Ý nghĩa Đồng ý/Không đồng ý | GVHD quyết định thủ công; từ chối bắt buộc lý do; gắn PDF/topic/phân công/policy hiện hành | Chờ duyệt nghiệp vụ chi tiết |
| Hạn nộp, gia hạn, nộp muộn | Dùng FINAL của đợt B1–B8; không tự thêm ngoại lệ | Chờ quy định ngoại lệ |
| Thay PDF sau xác nhận, sửa điểm/nhận xét | Policy chọn BLOCK hoặc INVALIDATE cho PDF; sửa summary yêu cầu xác nhận lại; revision/audit giữ lịch sử | Chờ chọn policy vận hành |
| Công bố điểm, nhận xét, lý do từ chối | Các quyền UC17 tách riêng; sinh viên mặc định không nhận nội dung nhạy cảm | Chờ mốc và nhóm quyền công bố |
| Giới hạn PDF, kiểm tra an toàn, đối soát staging thất bại | Giới hạn từ policy, phiên bản immutable/private; không tuyên bố parser/AV đầy đủ | Chờ quy trình và tiêu chuẩn Khoa/nhóm |
| Storage Render lâu dài | Tái sử dụng FileStorageService và FILE_ASSET; chưa xác minh disk/mount/backup/restart | Nhóm trưởng kiểm tra Dashboard; chưa tạo tài nguyên |

## UC18

| Quyết định cần duyệt | Hành vi kỹ thuật hiện có | Trạng thái |
| --- | --- | --- |
| Mốc xét điều kiện theo kế hoạch | UC18_POLICY chọn FINAL hoặc DEFENSE hiện hữu; kiểm term status, term/phase lock và thời gian server | Chưa chọn phase chính thức; không có ngày mặc định |
| Nguồn học vụ được Khoa xác nhận | Policy liệt kê source key/label/mode; hiện hỗ trợ FACULTY_ATTESTATION có văn bản tham chiếu, PASS/FAIL, khoảng hiệu lực, actor/time và policy hash | Xác nhận thủ công mới là đề xuất trong đặc tả; chưa được coi là đã duyệt |
| Quyền ai xác minh và trách nhiệm đối chiếu văn bản | Chỉ FACULTY có review permission, term/department grant; API không tự xác minh nội dung văn bản ở hệ thống ngoài | Chờ cơ quan nguồn, quy trình kiểm tra, thời hạn chứng cứ và phân tách người kiểm tra/người duyệt nếu cần |
| Nợ học phần, tiêu chí đủ điều kiện học vụ, tích hợp hệ thống đào tạo | Không dùng Student.academicEligible/GPA làm nguồn quyết định; chưa có adapter học vụ tự động được duyệt | Chờ nguồn/schema/tiêu chí và quyền kết nối; không fake import |
| UC14–UC16 cần kiểm tra những gì | Policy có UC17_REVIEW (GVHD xác nhận tổng kết) hoặc ALL_ACTIVE_TASKS_PASSED (kế hoạch đúng context, effective reviews và coverage nghĩa vụ tuần). Không tự dùng điểm PhaseEvaluation legacy để làm ngưỡng | Chờ chọn rule. Tiêu chí mốc/rubric/điểm khác ngoài hai rule cần đặc tả thêm trước khi mở ghi |
| Kết quả kiểm tra và quyết định Khoa | QUALIFIED/NEGATIVE/PENDING/MISSING/STALE/UNVERIFIED là preview; ELIGIBLE/INELIGIBLE/DEFERRED là quyết định có lý do; chốt là bước riêng | Chờ tên trạng thái/mẫu quy trình chính thức; không gọi DEFERRED là quyết định bảo lưu |
| Phạm vi chốt danh sách | API chốt atomic nhóm 1–100 hồ sơ được chọn trong scope, có batch ID; không khóa toàn term và không tự thêm hồ sơ ngoài lựa chọn | Chờ xác nhận cách tổng hợp các nhóm/bộ môn thành danh sách toàn đợt và người chịu trách nhiệm |
| Thay đổi đầu vào sau chốt | GET phát hiện stale và loại khỏi downstream; không sửa âm thầm quyết định đã chốt | Chờ quy trình thu hồi/mở lại/ban hành revision thay thế, xử lý ảnh hưởng sau phân hội đồng |
| Tách người xét/người quyết định/người chốt | Hiện là ba permission độc lập, có thể cùng một FACULTY nếu được cấp; không tự bắt buộc hai người khác nhau | Chờ quy tắc phân tách trách nhiệm |
| Sinh viên kỳ trước quay lại, bảo lưu, được phản biện nhưng chưa bảo vệ, bổ sung điều kiện | Không có đường bỏ qua hồ sơ hiện hành/UC17/học vụ; không tự biến DefermentRequest legacy thành quyết định mới | Chờ nguồn liên kết hồ sơ cũ, schema/actor/hiệu lực và trạng thái đặc thù; chưa triển khai ngoại lệ thiếu định nghĩa |
| Dòng eligibility legacy | Chỉ hiển thị LEGACY_UNVERIFIED, chặn tự nhận/adopt; migration không đổi nghĩa dữ liệu | Chờ quy trình đối soát có bằng chứng nếu thực tế có dữ liệu cũ |
| Quyền đọc hồ sơ và dữ liệu nhạy cảm | read theo owner/official advisor/grants; grade/comment dùng quyền UC17 độc lập, reason/học vụ/history chỉ trả Khoa có scope; không ADMIN bypass | Review bốn permissions UC18 và mapping trước provisioning |
| Lưu trữ và thời hạn audit | Row + snapshot trong context, AuditLog, IdempotencyRecord; hồ sơ chốt bất biến, không endpoint xóa/mở lại | Chờ chính sách retention, truy cập audit và xử lý dữ liệu cá nhân |

## Điều kiện kỹ thuật trước khi vận hành ghi

- Nhóm chỉ định môi trường rehearsal ghi được phép, chạy cùng code/schema/chain; Supabase chung hiện không mặc nhiên là database test.
- Đối chiếu schema live DEFENSE_ELIGIBILITY (metadata UC17 đã lưu không bao gồm bảng này), review migration UC17 rồi UC18, permissions và runtime role/ACL/RLS.
- Kiểm chứng transactions, constraints/triggers, idempotency/CAS, rollback, concurrency cùng producer B1–B8/UC17, backup/restore.
- Xác minh Render storage mount/backup và tải lại PDF sau restart/redeploy được phép. Chưa tạo Render Disk hoặc Supabase Storage bucket.
- Duyệt policy thật, grants và phase/locks cho từng đợt; không copy fixture vào production.
- Kiểm thử browser/API end-to-end với record/account được nhóm cho phép; đo thời gian danh sách khi quy mô đợt lớn (evaluator hiện kiểm chứng từng hồ sơ và đọc checksum PDF).
- Sau đủ bằng chứng, người có thẩm quyền mới bật UC17/UC18 flags theo quy trình triển khai. Trong lượt này không bật flag, không sửa `.env`, không migration/seed/ghi production.

UC19–UC25 chưa triển khai trong lượt UC18. Danh sách này chưa xác nhận quy định hội đồng, phản biện, lịch, rubric hội đồng, công thức tổng hợp điểm, xuất/in/ký biên bản.

## UC19 — bổ sung khi bàn giao code, chưa phê duyệt

Ngày bổ sung: 2026-11-07. UC19 đã có code và tests cô lập; không mục nào dưới đây tự chuyển thành APPROVED. Policy synthetic chỉ dùng trong tests; không tạo policy/grants/migration production.

| Quyết định cần duyệt | Hỗ trợ kỹ thuật / phạm vi hiện tại | Trạng thái |
| --- | --- | --- |
| Tiêu chuẩn thành viên | Active Lecturer/User có role LECTURER, roster đúng term; policy chọn TERM_ROSTER hoặc SAME_DEPARTMENT và allowedTitleIds (null phải được duyệt là không có hạn chế chức danh thêm) | PENDING_APPROVAL; tiêu chuẩn học vị/học hàm/chức vụ theo từng vai trò ngoài chức danh cần đặc tả thêm nếu Khoa yêu cầu |
| Vai trò/chức danh bắt buộc | 3–5 người là quy tắc user xác nhận; chairCount/secretaryCount từ policy, không có production default. PK một giảng viên/một role; distinctOfficers=true phải được duyệt | PENDING_APPROVAL về counts/tiêu chuẩn; chưa hỗ trợ kiêm nhiệm Chủ tịch/Thư ký bằng một người |
| Số hội đồng mỗi giảng viên | maxCommitteesPerLecturer cấu hình, kể cả tải membership legacy bảo thủ. Null chỉ có nghĩa không giới hạn nếu policy đó được duyệt | PENDING_APPROVAL, không dùng maxStudents hướng dẫn của Lecturer làm giới hạn hội đồng |
| Số sinh viên/hội đồng và tải thành viên | maxStudentsPerCommittee/maxStudentsPerLecturer cấu hình, không có ngưỡng mặc định; tải SV tính cho mọi thành viên của hội đồng | PENDING_APPROVAL |
| Chốt hội đồng chưa có sinh viên | allowEmptyFinalization bắt buộc khai báo trong policy; không tự chọn giá trị production | PENDING_APPROVAL |
| Nguyên tắc cân bằng tải | Engine ưu tiên giữ phân công khả thi hiện tại, rồi ít SV/hội đồng, tải giảng viên thấp, tie-break bằng ID; deterministic, không bảo đảm optimum soft objectives | PENDING_APPROVAL về thứ tự/weights/ngoại lệ. Search budget là giới hạn kỹ thuật, không phải ngưỡng học vụ |
| Quyền Khoa tạo/duyệt/chốt | Năm permission độc lập, FACULTY-bound và term/department grant; chưa bắt buộc người tạo khác người chốt | PENDING_APPROVAL; provisioning chưa thực hiện |
| Thời hạn thành lập | UC19_POLICY chọn FINAL hoặc DEFENSE của kế hoạch B1–B8, kiểm status/deadline/lock | PENDING_APPROVAL phase chính thức, không ngày hard-code |
| Phạm vi theo bộ môn/toàn kỳ | Hội đồng mới có department; studentScope hiện chỉ hỗ trợ SAME_DEPARTMENT. Grants toàn kỳ cho phép quản lý nhiều bộ môn nhưng không tự trộn sinh viên giữa bộ môn | PENDING_APPROVAL; hội đồng liên bộ môn/toàn Khoa cần quy tắc/scope được duyệt trước khi mở ghi |
| Sửa hội đồng sau chốt | Hội đồng/active assignments chốt bất biến; GET phát hiện STALE, không tự chuyển/gỡ SV | PENDING_APPROVAL workflow thu hồi/mở lại/revision thay thế và xử lý ảnh hưởng UC20/UC21 |
| Thành viên vắng/thay thế | Dự thảo cho sửa toàn bộ danh sách với revision/audit và kiểm lại mọi SV; sau chốt bị chặn | PENDING_APPROVAL về xử lý sau chốt/biên bản vắng/thay thế |
| UC18 stale sau phân công | Loại khỏi downstream, giữ nguyên phân công/hồ sơ, hiển thị cảnh báo. Gỡ/chuyển dự thảo phải explicit và có lý do | PENDING_APPROVAL xử lý nghiệp vụ và thông báo cho các bên |
| Đối chiếu GVHD/handover | Nguồn duy nhất: officialAssignmentPlanId → FINALIZED plan + current assignment và effective latest AssignmentChange; phải khớp UC18 binding. Kiểm tất cả thành viên không phụ thuộc role | Core conflict rule đã được user yêu cầu; ngoại lệ/đối soát change legacy chưa được tự duyệt |
| Legacy và lịch cũ | Không adopt committee legacy hoặc session claim cũ. COMMITTEE_STUDENT giữ nguyên; UC19 thêm assignment trước lịch, không tạo room/time giả | PENDING_APPROVAL schema/đối soát nếu có legacy data |
| Deployment/kiểm thử | UC19_WRITES_ENABLED mặc định false; SQL review phụ thuộc UC17→UC18; Postgres/permissions/RLS/triggers/Render/storage/load/browser cần rehearsal được phép | NOT VERIFIED, chưa bật flag/ghi production |

UC20–UC25 chưa triển khai trong lượt UC19. Contract UC19 chỉ cung cấp hội đồng và danh sách sinh viên đã chốt còn hiệu lực; chưa phân phản biện, xếp lịch, chấm điểm, tổng hợp hay xuất/in/ký biên bản.

## UC20 — phân công giảng viên phản biện (bổ sung 2026-11-07)

Đây là danh sách cần phê duyệt, không phải policy production. Giá trị trong fixtures chỉ phục vụ tests cô lập. UC20_POLICY phải có version, APPROVED/actor/time/reference hợp lệ; lượt này không tạo hoặc cập nhật TermParameter thật.

| Quyết định cần duyệt | Code hiện hỗ trợ / hành vi khi thiếu | Trạng thái |
| --- | --- | --- |
| Số GVPB mỗi đồ án | reviewersPerStudent bắt buộc, không default 1/2; draft được thiếu, chốt phải đúng số; tối đa 20 là giới hạn kỹ thuật của payload | PENDING_APPROVAL |
| Tiêu chuẩn phản biện | Active account/LECTURER/roster bắt buộc; allowedTitleIds explicit null hoặc danh sách; expertiseRule NONE hoặc REQUIRED_AREA_MATCH dùng LECTURER_AREA/ResearchArea. Không suy thâm niên/bằng cấp khi thiếu producer | PENDING_APPROVAL tiêu chuẩn học vụ và dữ liệu chuyên môn |
| Người từng hướng dẫn sau bàn giao | Current official GVHD luôn bị chặn. History gồm current/past published/finalized assignments và changes của registration; ALLOW/FORBID/PENDING_APPROVAL riêng. Lịch sử thiếu/gãy/future chưa hiệu lực chặn mọi phân công hồ sơ | PENDING_APPROVAL về former advisor, completeness và cách đối soát lịch sử legacy |
| Kiêm nhiệm hội đồng/GVPB | ALLOW/FORBID/PENDING_APPROVAL; trạng thái pending chặn chọn thành viên hội đồng làm GVPB, không đoán quy định. UC19 all-member advisor conflict luôn giữ | PENDING_APPROVAL |
| Phản biện khác bộ môn | SAME_DEPARTMENT hoặc CROSS_DEPARTMENT phải explicit; dù cho cross-department vẫn cần term/department grant của actor đối với GVPB và sinh viên | PENDING_APPROVAL scope/bộ môn/chuyên môn và pooling liên Khoa |
| Số sinh viên tối đa/GVPB | maxReviewsPerLecturer explicit positive hoặc null được duyệt; tính toàn kỳ gồm finalized/draft và bảo thủ giữ tải stale/legacy chưa đối soát | PENDING_APPROVAL caps và reservation semantics |
| Tổng tải giảng viên | maxTotalStudentDuties explicit; code hỗ trợ ADVISOR_PLUS_COMMITTEE_PLUS_REVIEW theo số duty, không tự suy trọng số/tín chỉ/tiền giờ; null cũng phải được duyệt | PENDING_APPROVAL công thức, weights nếu cần, phạm vi tính tải |
| Cân bằng tải | Giữ phân công hợp lệ hiện tại, ưu tiên ít bài phản biện rồi tổng duty thấp, tie-break ID. Chuyên môn hiện là hard filter khi policy yêu cầu; không có trọng số độ phù hợp không được duyệt | PENDING_APPROVAL thứ tự, cân bằng giữa bộ môn/hội đồng và soft weights |
| Thời hạn phân công | phaseCode FINAL/DEFENSE lấy TERM_PHASE/kế hoạch/status/locks; không hard-code ngày hoặc tự mở ngoài hạn | PENDING_APPROVAL mốc chính thức/gia hạn |
| Ai tạo/sửa/chốt | FACULTY-bound read/assign/update/finalize + grants; sửa nhóm có sẵn cần cả assign và update. Chưa bắt buộc người chốt khác người tạo | PENDING_APPROVAL role mapping, separation of duties và provisioning |
| Thay GVPB sau chốt | Nhóm FINALIZED bất biến, kể cả các dòng đã deselect; chưa có bypass ADMIN hoặc endpoint mở lại | PENDING_APPROVAL workflow thu hồi/thay thế, bảo toàn dữ liệu UC22 sau này |
| GVPB vắng | Chỉ điều chỉnh draft có reason/revision/audit; sau chốt chặn | PENDING_APPROVAL quy trình vắng/thay thế/biên bản |
| Eligibility/committee/advisor stale | Downstream null/STALE, giữ nguyên phân công. Draft chỉ được lưu lại khi có nguồn hiện hành; không âm thầm gỡ/chuyển. Finalized không chốt lại bằng binding mới | PENDING_APPROVAL xử lý nghiệp vụ và thu hồi thông báo |
| Điều kiện UC22 bắt đầu chấm | EffectiveReviewerAssignment chỉ CURRENT khi cả nhóm finalized và current provenance/policy/UC18/UC19/advisor/history/qualifications/caps; consumer phải đọc lại trong transaction, kiểm reviewer identity/quyền/cửa sổ riêng | PENDING_APPROVAL cửa sổ, quyền và workflow UC22; chưa viết UC22 |
| Thông báo/công khai phân công | Chưa gửi email/notification hoặc công khai tự động. Cần duyệt đối tượng, kênh, thời điểm, retry/outbox/idempotency và xử lý stale; UC20 hiện trả phân công chính thức cho consumer | PENDING_APPROVAL; không tuyên bố đã thông báo giảng viên |
| Legacy/schema/deployment | Giữ nguyên REVIEWER_ASSIGNMENT revision 0; không adopt COMMITTEE_MEMBER REVIEWER. SQL review ngoài chain, UC20_WRITES_ENABLED false; cần live metadata/DDL/ACL/DB rehearsal/storage/Render/browser/load verification | PENDING_APPROVAL / NOT VERIFIED |

UC20 chỉ phân công và cung cấp contract cho UC22; lượt này chưa triển khai UC21–UC25, không tạo lịch, nhận xét, điểm hoặc kết quả phản biện. Các mục còn thiếu được gom ở đây để nhóm/Khoa xác nhận một lần.

## UC21 — xếp lịch bảo vệ (bổ sung 2026-11-07)

Các mục dưới đây cần nhóm/Khoa phê duyệt, chưa là policy production. UC21_POLICY bắt buộc version/status/approvedBy/approvedAt/reference và mọi thông số explicit; fixture TEST_ONLY không phải phê duyệt thật. UC21_WRITES_ENABLED mặc định false.

| Quyết định cần duyệt | Hành vi kỹ thuật / khi thiếu | Trạng thái |
| --- | --- | --- |
| Ngày/buổi tổ chức | allowedDates và MORNING/AFTERNOON windows explicit; ngày/slot phải nằm trong term + DEFENSE phase B1–B8 | PENDING_APPROVAL ngày, lịch sử dụng và phase cho thao tác xếp lịch |
| Giờ sáng/chiều | periods.start/end/breaks, timezone Asia/Ho_Chi_Minh; không default giờ trong production | PENDING_APPROVAL |
| Thời lượng, đệm, nghỉ | durationMin, bufferMin sau mỗi lượt, sessionBufferMin sau phiên, breaks và startStepMin explicit; room/committee giữ toàn khoảng phiên kể cả break | PENDING_APPROVAL thông số, ý nghĩa giữ phòng và GVPB di chuyển |
| Số SV tối đa/buổi và sức chứa | maxStudentsPerSession riêng, ROOM.capacity phải đạt minRoomCapacity đã duyệt. Không tự đồng nhất ghế/phòng với tổng số lượt tuần tự hoặc tự suy số người nghe bảo vệ | PENDING_APPROVAL capacity/đối tượng tham dự/giới hạn mỗi hội đồng |
| Phòng được sử dụng và scope | roomAccess gắn room thật với departmentIds; actor cần grants cả hội đồng/bộ môn và room scope; không tạo phòng giả | PENDING_APPROVAL phòng, quyền dùng phòng liên bộ môn/kỳ, lịch ngoài hệ thống |
| Trùng lịch liên kỳ | ALL_TERMS: đọc ledger mọi kỳ; không chỉ filter kỳ trên UI. Legacy chưa có interval/provenance xác minh khóa bảo thủ tài nguyên chung | Core conflict theo user; đối soát legacy/ngoài hệ thống PENDING_APPROVAL |
| GVPB tham dự | REQUIRED dùng EffectiveReviewerAssignment CURRENT và reserve reviewer theo slot + buffers; NOT_REQUIRED không tạo blocker UC20; PENDING_APPROVAL chặn ghi chính thức | PENDING_APPROVAL có cần có mặt và khoảng cần tham dự |
| Tên trùng/tên kép | Tên token cuối → Họ đệm → Họ, Intl.Collator vi, NFC/whitespace normalization, tie code/id. compoundFamilyNames phải explicit. Tên kép khác rule cần producer/definition bổ sung | User yêu cầu ABC; compound family/given name exceptions PENDING_APPROVAL |
| Đổi thứ tự thủ công | manualOrderAllowed explicit, permutation đầy đủ + lý do; luôn giữ automaticOrder gốc trong snapshot/audit, không âm thầm bỏ ABC | PENDING_APPROVAL quyền/ngoại lệ |
| Ai xếp/sửa/chốt/công bố | FACULTY-bound create/update/finalize/publish riêng + read/grants; chưa bắt buộc người công bố khác người chốt | PENDING_APPROVAL mapping/provisioning/separation of duties |
| Công bố cho SV/GV | FINALIZED không tự public. publish explicit sau publishNotBefore, studentVisibility/lecturerVisibility/advisorCanView độc lập và own relationship projection. Draft/stale không hiện personal | PENDING_APPROVAL thời điểm, đối tượng và quyền cá nhân |
| Đổi lịch sau chốt | Finalized bất biến, chỉ công bố một lần; cancel chỉ draft. Không có bypass ADMIN hay chỉnh row để hợp thức hóa | PENDING_APPROVAL reschedule/withdraw/reopen và ảnh hưởng UC22/UC23 |
| GV vắng/đổi hội đồng | Dự thảo điều chỉnh có reason/revision/audit; phải có nguồn UC19/UC20 mới hiệu lực. Sau chốt chặn | PENDING_APPROVAL quy trình thay người/vắng |
| UC18/UC19/UC20 stale | Giữ lịch và reservations, downstream null, ẩn personal; không tự hủy/di chuyển/công bố lại. Draft có thể sửa khi nguồn hợp lệ hoặc hủy explicit | PENDING_APPROVAL cách xử lý nghiệp vụ, thu hồi/thông báo |
| Thuật toán/giới hạn tải | Deterministic bounded search, giữ phiên đã có, balance số phiên đề xuất theo ngày/buổi rồi thứ tự thời gian/phòng; không claim optimum hoặc tính điểm chuyên môn/di chuyển chưa duyệt | PENDING_APPROVAL weights, ưu tiên, giờ di chuyển và calendars ngoài hệ thống |
| Legacy DEFENSE_SESSION/COMMITTEE_STUDENT | Không adopt. Slots UC21 nằm trong session context versioned để không gây vòng stale UC19; legacy projection tách khỏi API UC21 | PENDING_APPROVAL DDL/đối soát và kế hoạch projection nếu cần |
| Thông báo thay đổi lịch | Công bố là quyền hiển thị, chưa gửi email/notification. Chưa triển khai reschedule chính thức hoặc xuất UC25 | PENDING_APPROVAL recipients/channel/outbox/retry/retention |
| Đọc nguồn cho personal | Revalidate bằng actor Khoa đã ghi/công bố, còn active/grants/source permissions; actor đó hết quyền thì fail closed, không tự nâng quyền cho SV/GV | PENDING_APPROVAL service-reader identity lâu dài và ownership chuyển cán bộ |
| Production/test/locking | SQL review chưa apply; cần môi trường rehearsal được cấp, hai transactions thật cùng/khác kỳ, legacy writers, ACL/RLS/backup/storage/Render/browser/load verification | NOT VERIFIED, chưa bật flag |

UC21 chỉ cung cấp lịch hiện hành cho consumer tương lai. Lượt này không viết UC22–UC25, không tạo điểm/nhận xét/kết quả/biên bản/xuất chính thức và không ghi lên Supabase chung.

## UC22 — nhận xét và chấm điểm phản biện (bổ sung 08/11/2026)

Các mục dưới đây **PENDING_APPROVAL**, không phải policy production. UC22_POLICY cần version/status/approvedBy/approvedAt/reference; fixtures TEST_ONLY chỉ kiểm parser và workflow. Không tạo policy/rubric/account hoặc bật UC22_WRITES_ENABLED trên hệ thống chung.

| Quyết định cần nhóm/Khoa duyệt | Hành vi kỹ thuật hiện có | Trạng thái |
| --- | --- | --- |
| Bước điểm GVPB | scoreStep bắt buộc, thang tổng 0–10; Decimal(4,1) không lưu được độ chính xác cao hơn; chặn, không tự làm tròn | PENDING_APPROVAL |
| Có bắt buộc rubric | rubric=null chỉ khi được duyệt cho tổng trực tiếp; rubric khác GVHD, version riêng | PENDING_APPROVAL |
| Tiêu chí/trọng số/thang tiêu chí | Dùng rubricCriteriaId thật cùng đợt; kiểm name/weight/maxScore; weight tổng 1, đủ tiêu chí khi chốt; CHECK baseline chỉ cho điểm tiêu chí 0–10 | PENDING_APPROVAL nội dung và provisioning dữ liệu thật |
| Tổng/làm tròn/ngưỡng đạt | Hiện hỗ trợ WEIGHTED_NORMALIZED_10_EXACT bằng phân số BigInt, không rounding/ngưỡng đạt; công thức khác cần code/schema được review | PENDING_APPROVAL |
| Nội dung nhận xét bắt buộc | requiredFeedback explicit giữa comment/strengths/weaknesses/questions; không mặc định tất cả bắt buộc hoặc tùy chọn | PENDING_APPROVAL |
| Lưu nháp | draftAllowed explicit; nháp chưa đủ nội dung được lưu trong scope, không vào downstream/công bố | PENDING_APPROVAL |
| Mốc bắt đầu/kết thúc phản biện | FINAL hoặc DEFENSE theo TERM_PHASE/status/lock/deadline thật; không ngày cố định, không tự gia hạn | PENDING_APPROVAL phase/mốc, nộp muộn/gia hạn và thông báo quá hạn |
| Có cần UC21 | schedule.required explicit; nếu false không đòi schema/lịch; nếu true dùng finalized/current đúng SV/đợt/phiên | PENDING_APPROVAL |
| Công bố lịch/cửa sổ chấm | requirePublished và opensMinutesBefore/closesMinutesAfter explicit; không tự yêu cầu publication. Công bố đơn thuần không đổi binding học vụ khi không required | PENDING_APPROVAL |
| Quyền xem từng nội dung | GVPB đọc phiếu riêng; Khoa read tiến độ theo grants, score-read/comment-read/history-read độc lập; không ADMINGVPB bypass | PENDING_APPROVAL mapping và provisioning |
| Sinh viên xem khi nào | WITHHELD; chưa có quyền/luồng công bố điểm, nhận xét, câu hỏi hoặc audit cho sinh viên | PENDING_APPROVAL; release producer thuộc quy trình sau |
| Sửa sau chốt/phúc khảo/điều chỉnh | IMMUTABLE/BLOCK, giữ snapshot, không endpoint mở khóa hoặc chỉnh bởi ADMIN | PENDING_APPROVAL người duyệt/lý do/revision thay thế/ảnh hưởng UC24 |
| Khi chuyển cho UC24 | Chỉ finalized/CURRENT; consumer phải revalidate tại lúc tính/chốt. Chưa có tổng hợp/chốt kết quả | PENDING_APPROVAL thời điểm và quyền consumer |
| GVPB thay đổi sau chấm | Grade cũ STALE, không chuyển scorer/điểm. Lịch sử giữ nguyên; unique proposal/scorer/role không tự tạo episode thay thế | PENDING_APPROVAL workflow thu hồi/phân lại/đánh giá lại |
| PDF thay đổi | Bind version/checksum; grade cũ STALE giữ history, không chuyển điểm; chưa cho rebind/sửa sau chốt | PENDING_APPROVAL điều kiện nộp lại/đánh giá lại và người chịu trách nhiệm |
| Nhiều GVPB | Mỗi người một phiếu; không lấy trung bình, cộng/trọng số hoặc chọn một phiếu tùy ý | PENDING_APPROVAL cách tổng hợp ở UC24 và quy định đủ số phiếu |
| SCORE_ENTRY legacy | Không adopt/upsert/xóa; không cấp quyền từ legacy reviewer_id/COMMITTEE_MEMBER. Cần đối soát có provenance trước khi công nhận | PENDING_APPROVAL quy trình/owner và retention |
| Audit/retention/thông báo | Snapshot và metadata sửa được lưu atomic; chưa tự xóa audit hoặc gửi email/notification; history API chỉ projection được phép | PENDING_APPROVAL thời hạn lưu, xuất dữ liệu, kênh/recipients/retry/outbox |
| Internal source reader | Dùng persisted UC20 finalizer/UC21 updater với live quyền/grants; mất quyền thì fail closed. Không cấp source permission Khoa cho GVPB | PENDING_APPROVAL service-reader identity, bàn giao cán bộ và policy revocation |
| SQL/ACL/production | Gói review riêng, không thêm bảng/cột; sửa constraint ADVISOR-only giữ nguyên nhánh UC17, thêm reviewer guards. Cần rehearsal PostgreSQL/unique/CAS/deferred trigger/rollback và kiểm ACL/RLS/REST SCORE_ENTRY/SCORE_DETAIL/AUDIT_LOG/IDEMPOTENCY_RECORD trên hạ tầng được phép | PENDING_APPROVAL / NOT VERIFIED |
| Render/storage/browser | Dùng lại private FileStorageService, chưa xác minh disk/mount/backup/restore/redeploy; component SSR/HTTP synthetic không thay browser/PostgreSQL/Render E2E | NOT VERIFIED; chưa bật ghi |

UC22 không triển khai UC23–UC25, không công bố/tổng hợp điểm hoặc xuất/in/ký kết quả. Các quyết định thiếu được tổng hợp tại đây, không coi dữ liệu TEST_ONLY là chính sách đã được Khoa duyệt.

## UC23 — từng thành viên hội đồng chấm rubric (bổ sung 08/11/2026)

Các quyết định dưới đây **PENDING_APPROVAL**. UC23_POLICY phải có version/approval/reference, không defaults học vụ từ fixtures TEST_ONLY. Code và SQL review chưa là phê duyệt production; không tạo policy/rubric/grant/account/grade thật hoặc bật flag ghi.

| Quyết định cần nhóm/Khoa xác nhận | Code hiện hỗ trợ và giới hạn khi thiếu | Trạng thái |
| --- | --- | --- |
| Thành viên phải chấm | gradingRoles explicit CHAIR/SECRETARY/MEMBER; hỗ trợ từng người chấm độc lập, không tự bỏ Chủ tịch/Thư ký hoặc cấp ngoại lệ | PENDING_APPROVAL roles bắt buộc/ngoại lệ |
| Loại phiếu lưu trữ | Canonical SCORE_ENTRY COMMITTEE_MEMBER cho mọi vai trò; role thực bind UC19 riêng, compound unique theo scorer/proposal/type; legacy COMMITTEE_CHAIR không adopt/duplicate | PENDING_APPROVAL convention và đối soát |
| Rubric hội đồng chính thức | Rubric version và criterion IDs thật riêng UC23; khớp term/name/description/max/weight của RUBRIC_CRITERIA, không lấy UC22/GVHD làm default | PENDING_APPROVAL nội dung và provisioning |
| Min/max/step/weights | Mỗi tiêu chí explicit, step tính từ min, tổng weight 1; criterion required và missingOptional ZERO/BLOCK explicit; min phải cho phép 0 nếu optional ZERO | PENDING_APPROVAL |
| Công thức điểm phiếu | WEIGHTED_NORMALIZED_10 theo score/max ×weight×10, BigInt rational; không tự gộp nhiều member hoặc UC22 | PENDING_APPROVAL công thức và cách quy đổi |
| Precision và rounding | EXACT/HALF_UP/HALF_EVEN/DOWN, decimalPlaces và totalStep explicit; Decimal(4,1)/CHECK detail 0–10 giữ nguyên; vượt precision/range chặn hoặc cần schema review | PENDING_APPROVAL; không rounding fallback |
| Nhận xét bắt buộc | commentRequired explicit khi finalize, nháp có thể thiếu | PENDING_APPROVAL |
| Nháp/chốt trực tiếp | draftAllowed explicit; có thể finalize trực tiếp khi đủ điều kiện, không bắt buộc tạo nháp trước | PENDING_APPROVAL |
| Mốc chấm trước/trong/sau bảo vệ | Đặc tả UC23 hiện yêu cầu DEFENDING + phase DEFENSE + trong buổi; hỗ trợ SESSION/SLOT explicit. Ngoại lệ trước/sau chưa tự mở | PENDING_APPROVAL chi tiết cửa sổ và ngoại lệ nếu có |
| Hiệu lực policy theo thời gian | effectiveFrom/Until + effectiveScope GRADING_WINDOW explicit; chặn ghi ngoài khoảng, giữ grade đã finalized hợp lệ trong khoảng đó. Thay nội dung/version làm stale; scope khác chưa hỗ trợ | PENDING_APPROVAL semantics/version chuyển tiếp |
| Lịch chốt/công bố | UC21 finalized/CURRENT bắt buộc theo đặc tả; requirePublished riêng, không mặc định publication; kiểm đúng committee/student/session và source hash | PENDING_APPROVAL công bố và anchor SESSION/SLOT |
| Đã bảo vệ thực tế | defenseEvidence NOT_REQUIRED/REQUIRED explicit; REQUIRED chặn finalize vì chưa có approved producer. Chuẩn bị DefensePerformanceEvidenceSchema, không fake attendance từ lịch/score | PENDING_APPROVAL producer/quy trình/cơ quan xác nhận; BLOCKED nếu REQUIRED |
| Member xem phiếu nhau | read-own/save-own/finalize-own/download-own theo actual membership; cùng hội đồng hoặc CHAIR/SECRETARY không tự đọc/sửa phiếu người khác | PENDING_APPROVAL ngoại lệ đọc; hiện không mở |
| Khoa theo dõi và nội dung | read + progress-read thuộc FACULTY, term/department grants; score-read/comment-read/history-read độc lập; tiến độ chỉ đếm phiếu, không tổng hợp điểm | PENDING_APPROVAL mapping và scope |
| Kiêm GVPB/hội đồng | Khi có duty REVIEWER: UC20_POLICY ALLOW và EffectiveReviewerAssignment CURRENT; hai record REVIEWER/COMMITTEE_MEMBER độc lập, không copy | PENDING_APPROVAL ràng buộc kiêm nhiệm và thay đổi duty |
| Mở khóa/sửa sau chốt | IMMUTABLE/BLOCK; không ADMIN/Chair/Secretary bypass hoặc tự cập nhật theo rubric mới; snapshot rubric/policy cũ giữ riêng | PENDING_APPROVAL người duyệt, lý do, revision thay thế |
| Phúc khảo/điều chỉnh | Chưa có workflow chính thức, giữ audit/history; không endpoint chấm thay hoặc silent repair | PENDING_APPROVAL |
| Vắng/thay thế/chuyển hội đồng | Mất membership/assignment không được tiếp tục chấm; grade cũ giữ dữ liệu và không downstream CURRENT; không tự chuyển score/unique slot sang người/hội đồng khác | PENDING_APPROVAL xử lý và đánh giá lại |
| Hội đồng/lịch/PDF/rubric stale | Revalidate khi ghi và downstream; STALE giữ snapshot/row/audit, không xóa hoặc tự rebind. Nguồn UC19/UC21 rộng có thể invalidation bảo thủ | PENDING_APPROVAL quy trình đối soát/khôi phục/thông báo |
| Điều kiện đủ số phiếu UC24 | Đếm từ members CURRENT + gradingRoles approved; unknown policy/source thì requiredCount chưa xác minh, không suy 0 hoặc mặc định 3. Chỉ finalized/CURRENT là đầu vào, UC24 phải đọc lại transaction | PENDING_APPROVAL thời điểm và cách xử lý thiếu phiếu |
| Công bố điểm hội đồng | WITHHELD; không STUDENT mapping/release endpoint trong UC23, không tự lấy trung bình hoặc gộp GVPB | PENDING_APPROVAL quy trình UC24 sau này |
| Mẫu phiếu/retention/audit | Lưu snapshot, actor/time/revision; history API projection theo quyền, chưa xuất/in/ký/xóa audit tự động | PENDING_APPROVAL mẫu và thời hạn lưu |
| Thông báo thiếu/chưa chốt | Chỉ progress counts, chưa gửi mail/notification hoặc quyết định tự động thay người | PENDING_APPROVAL recipients/channel/outbox/retry |
| Internal reader identity | Dùng persisted UC19 finalizer/UC21 updater/UC20 finalizer với live rights/grants, không nhận source actor từ client; revoked actor fail closed | PENDING_APPROVAL service identity/bàn giao cán bộ |
| Schema/ACL/production | Gói SQL riêng giữ nguyên ADVISOR/REVIEWER branches, thêm committee guards và proposed mappings; không migration/bật flag. Cần PostgreSQL rehearsal/concurrency/rollback và kiểm ACL/RLS/REST score/details/audit/idempotency | PENDING_APPROVAL / NOT VERIFIED |
| Render/storage/browser | Dùng FileStorageService/private PDF hiện có; disk/mount/backup/restore/redeploy, browser interaction và load toàn kỳ chưa kiểm chứng | NOT VERIFIED |

UC23 chỉ chấm và cung cấp EffectiveCommitteeGrade; không UC24–UC25, không tổng hợp/công bố/biên bản/xuất/in/ký. Những mục thiếu được gom để nhóm/Khoa xác nhận một lượt; không dùng các policy/rubric TEST_ONLY như quy định chính thức.

## UC24 — tổng hợp, chốt và công bố kết quả (bổ sung 08/11/2026)

Mọi quyết định dưới đây **PENDING_APPROVAL**. UC24_POLICY phải versioned với APPROVED/approvedBy/approvedAt/reference; code hỗ trợ không phải phê duyệt học vụ. Không ghi fixture/policy/rubric/account/result TEST_ONLY vào Supabase chung; UC24_WRITES_ENABLED mặc định false.

| Quyết định cần nhóm/Khoa xác nhận | Code hiện hỗ trợ / khi thiếu | Trạng thái |
| --- | --- | --- |
| Nguồn quá trình/hướng dẫn UC16/UC17 | UC16 PHASE_EVALUATION/milestone là đánh giá riêng; chưa mapping approved sang điểm học phần. ADVISOR UC17 chỉ dùng khi policy explicit UC17_OFFICIAL_SUMMARY và reader current/audit/decision/PDF hợp lệ; không cộng trùng | PENDING_APPROVAL; PROCESS_UC16 BLOCKED reader/mapping |
| Sources tham gia công thức | Danh sách components explicit, không default tất cả nguồn hay bỏ nguồn thiếu | PENDING_APPROVAL |
| Nhiều GVPB bắt buộc | Toàn bộ EffectiveReviewerAssignment UC20; từng phiếu UC22 finalized/current, không coi thiếu là 0 | PENDING_APPROVAL completeness/exceptions |
| Aggregate GVPB | MEAN hoặc WEIGHTED theo exact lecturer IDs/weights tổng 1 và rounding riêng | PENDING_APPROVAL |
| Thành viên hội đồng phải chấm | Từ actual UC19 members + gradingRoles UC23 approved; đủ 3/5 phiếu tùy nguồn thực, không tự bỏ Chair/Secretary | PENDING_APPROVAL role exceptions/quorum thiếu phiếu |
| Aggregate hội đồng | MEAN hoặc ROLE_WEIGHTED; role weight chia đều cho actual members của role. Không Chair bonus default | PENDING_APPROVAL |
| Công thức và weights cuối | WEIGHTED_SUM, components/weights tổng 1 explicit, không formula frontend/eval. Formula khác UNSUPPORTED_POLICY cần mở rộng | PENDING_APPROVAL |
| Tỷ lệ 40/60 | Ví dụ tài liệu và ScoreAggregatorService cũ không là approval; UC24 không gọi default cũ | PENDING_APPROVAL có áp dụng hay không |
| Step/precision/rounding | BigInt rational, aggregate rounding riêng rồi final rounding EXACT/HALF_UP/HALF_EVEN/DOWN explicit. FINAL_RESULT Decimal(4,1); step/final precision không biểu diễn được bị chặn, không ALTER/cắt ngầm | PENDING_APPROVAL; precision >1 cần migration review riêng |
| Đạt/điểm liệt | passRule nullable hoặc minimumFinal + minimumComponents explicit; so trên điểm aggregate/final đã rounding, không default 5.0 | PENDING_APPROVAL thresholds và cơ sở so sánh |
| Xếp loại | Danh sách threshold/label explicit; chọn ngưỡng cao nhất đạt trên final đã rounding, không tên/xếp loại mặc định | PENDING_APPROVAL |
| Chair/Secretary xác nhận | scope STUDENT + rule ONE_PER_ROLE, required roles/distinctActors/reasonRequired explicit. Mỗi role một actor actual member, không xác nhận thay roles khác | PENDING_APPROVAL; quorum khác cần code/contract bổ sung |
| Chốt theo sinh viên/hội đồng/đợt | Hiện từng sinh viên; không batch âm thầm. Phiên/toàn đợt cần atomic semantics và approval bổ sung | PENDING_APPROVAL |
| Quyền Khoa và phân tách trách nhiệm | FACULTY read/finalize/publish riêng + term/department grants, finalizerNotConfirmer/publisherNotFinalizer explicit | PENDING_APPROVAL mapping/provisioning |
| Thời hạn chốt/khóa/đóng đợt | Theo TERM/DEFENSE phase/status/lock thật + finalizeWindow explicit. Không hard-code ngày/gia hạn | PENDING_APPROVAL; publish ngoài DEFENSE cần mở rộng phase policy |
| Khóa phiếu nguồn khi chốt | PRESERVE_PRODUCER_LOCKS; không tự thay lock UC17/22/23. Nguồn đổi làm result stale. Nếu yêu cầu khóa cả nguồn cần workflow/migration review khác | PENDING_APPROVAL |
| Thời điểm công bố | Quyền publish riêng, FINALIZED/CURRENT + đầy đủ confirmations, TERM/DEFENSE mở và publication window. Không tự công bố khi chốt | PENDING_APPROVAL |
| Khoa/hội đồng xem nội dung | read tiến độ, components-read/history-read tách riêng, actual scope. Không mặc định member đọc/sửa nguồn người khác qua UC24 | PENDING_APPROVAL |
| Sinh viên xem nội dung | Chính mình; read/read-own/final-read + PUBLISHED/CURRENT + studentFinal=true. Component release thêm components-read và studentComponents=true; không raw audit/source/comment | PENDING_APPROVAL |
| Nhận xét/reasons công khai | Không có comment release ở UC24, confirmation reason không trả raw. Không coi công bố final score là quyền xem nhận xét/lý do nội bộ | PENDING_APPROVAL; cần policy/consumer riêng nếu yêu cầu |
| Sửa sau chốt/mở khóa/điều chỉnh | IMMUTABLE/BLOCK; không ADMIN override hoặc rebind kết quả cũ | PENDING_APPROVAL workflow thay thế, người duyệt/lý do |
| Phúc khảo sau công bố | Chưa tự mở endpoint hoặc ban hành kết quả mới; giữ snapshot/history | PENDING_APPROVAL |
| Score/assignment/PDF/rubric/policy stale | Revalidate trong transaction, stale chặn publish/consumer; sinh viên không thấy điểm stale. Không auto-recompute/delete/repair publication | PENDING_APPROVAL đối soát, thông báo và thay thế |
| Legacy FINAL_RESULT | Không adopt/backfill/delete; revision0 LEGACY_UNVERIFIED, giữ điểm/publication cũ nhưng không công nhận qua UC24 | PENDING_APPROVAL owner/quy trình đối soát |
| Internal reader identity | Persisted producer finalizers/updaters với live quyền/grants; UC17 audit GVHD. Revocation fail closed, không lấy source actor từ browser | PENDING_APPROVAL service identity/bàn giao cán bộ |
| Retention/audit/notification | Atomic snapshot/audit/key; không xóa history hoặc gửi mail/notification tự động | PENDING_APPROVAL retention, recipients, outbox/retry |
| Contract UC25 | EffectiveFinalResult chỉ finalized/current và authorized read trong cùng snapshot/transaction; không dùng preview/stale/legacy/boolean độc lập | PENDING_APPROVAL quyền và mốc xuất; chưa viết UC25 |
| SQL/DB/ACL/REST | SQL ngoài active chain, chưa apply; cần approved PostgreSQL rehearsal và ACL/RLS/REST FINAL_RESULT/sources/audit/idempotency, concurrent SQL writers/rollback/legacy | PENDING_APPROVAL / NOT VERIFIED |
| Render/storage/browser/load | Kế thừa FileStorageService hiện có; disk/mount/backup/restore/redeploy/browser và tải toàn kỳ chưa kiểm chứng | NOT VERIFIED |

UC24 chỉ tổng hợp/xác nhận/chốt/công bố, không triển khai UC25 hoặc tạo database/service/project riêng. Chưa bật bất kỳ flag ghi production nào.

## UC25 — báo cáo, Excel/PDF và biểu mẫu (08/11/2026)

Phần UC24 phía trên là ghi nhận lịch sử. UC25 hiện đã có code trong cùng Project1; mọi quyết định bên dưới vẫn **PENDING_APPROVAL**. ENGINEERING_DRAFT_V1 và fixtures TEST_ONLY không phải mẫu chính thức. Không tạo/cập nhật UC25_POLICY trên database trong phiên này.

| Quyết định cần duyệt | Hành vi kỹ thuật hiện có | Trạng thái |
| --- | --- | --- |
| Loại báo cáo bắt buộc | Registry 8 XLSX + 7 PDF; mẫu ngoài registry cần audit nguồn/renderer riêng | PENDING_APPROVAL |
| Cột Excel chính thức | Whitelist theo template/version; mã và Decimal giữ dạng text; không formula tính lại UC24 | PENDING_APPROVAL |
| Mẫu phiếu GVHD/GVPB | Dùng feedback/điểm đã có effective evidence và content permission; không tạo nhận xét mới | PENDING_APPROVAL |
| Mẫu bảng điểm/hội đồng/kết quả | Layout engineering draft; tên trường/Khoa, cột, vai trò ký phải do template đã duyệt cung cấp | PENDING_APPROVAL |
| Mẫu biên bản hội đồng | MINUTES chưa có producer kết luận/phát biểu/yêu cầu sửa; MISSING_SOURCE hoặc blank có nhãn khi explicitly cho phép | PENDING_APPROVAL |
| Mẫu đề cương được phép xuất | Chỉ DossierPdfService và exact source snapshot/templateVersion B1–B8, thêm dossier:export và pii-export | PENDING_APPROVAL |
| Người duyệt/version/hiệu lực | Registry metadata owner/version/approvedBy/At/reference/effective dates; không tự gán APPROVED | PENDING_APPROVAL |
| Quy định dùng DRAFT | draft-preview/draft-export riêng; incompleteDraft explicit, không xuất điểm stale/preview như official | PENDING_APPROVAL |
| Xuất trước công bố | Template requirePublished tách FINALIZED và PUBLISHED; thống kê PUBLISHED_ONLY hoặc FINALIZED_INTERNAL explicit | PENDING_APPROVAL |
| Các thành phần điểm/nhận xét được xuất | UC25 list/components/final/comments/minutes/dossier/pii riêng, cộng quyền producer; không raw hidden columns | PENDING_APPROVAL |
| Quyền Khoa/thành viên hội đồng | FACULTY term/department grants; LECTURER actual current committee, explicit memberResults policy và UC24 rights; không ADMIN/STUDENT bypass | PENDING_APPROVAL |
| In/ký/xác nhận | PDF có ô ký và UNSIGNED; không coi tạo file hoặc download là ký; cần quy trình xác nhận thực và actor evidence | PENDING_APPROVAL |
| Ký giấy hay ký số/ngày ký | Không có signature producer được duyệt, không tạo ngày ký hoặc chữ ký thay người | PENDING_APPROVAL |
| Nguồn yêu cầu chỉnh sửa/kết luận | Chưa suy từ điểm; cần owner, provenance và workflow ghi nhận/duyệt nguồn | PENDING_APPROVAL |
| Lưu biên bản đã ký | Stream hiện tại không archive; scan/digital evidence và private durable archive cần review schema/storage riêng | PENDING_APPROVAL |
| Giữ PDF/Excel và retention | Không lưu file lâu dài; retentionDays giới hạn tái sinh/tải lại, không tự purge audit | PENDING_APPROVAL |
| Quyền tải lại | Chỉ owner trong scope hiện tại; reauthorize, expiry/source/template/hash revalidation; POST download audited | PENDING_APPROVAL |
| Đạt/trượt/xếp loại/phân bố | Dùng approved UC24 pass/classification, không ngưỡng 5 mặc định; distribution bins explicit, không overlap | PENDING_APPROVAL |
| Chốt sổ/thời điểm báo cáo | Snapshot theo request; chưa có workflow đóng sổ hoặc ban hành hàng loạt; cần authority/window/exceptions | PENDING_APPROVAL |
| Thông báo/đối soát/trách nhiệm cuối | Không gửi thông báo tự động; cần recipients, owner kiểm file, người phê duyệt và quy trình đối soát | PENDING_APPROVAL |
| Nguồn UC24 stale | Chặn file official/tải lại; không tự sửa kết quả hoặc tái ban hành; replacement/recall workflow cần duyệt | PENDING_APPROVAL |
| Render/Supabase storage | Tái dùng backend hiện hữu; source PDF cần durable private storage, export stream không chứng minh signed archive bền vững | PENDING_APPROVAL / NOT VERIFIED hạ tầng |
| EXPORT_JOB/DEFENSE_MINUTES legacy | Không adopt filePath/trạng thái legacy thiếu provenance, không tạo bảng trùng; cần DB owner đối soát | PENDING_APPROVAL |
| Schema/security/RBAC rehearsal | UC25 không migration mới; cần schema nguồn UC17–24, permissions provisioned, ACL/RLS/REST và audit/key thực được kiểm | PENDING_APPROVAL / NOT VERIFIED database |
| Limits/tải thật/engine upgrade | Row/candidate/byte/text/time/concurrency caps cấu hình; checksum khác sau engine upgrade sẽ chặn tải lại, không silent replace | PENDING_APPROVAL / NOT VERIFIED tải toàn đợt |

Bộ quyết định tổng hợp có owner/ưu tiên cho toàn UC17–UC25: [09-10-team-approval-summary.md](09-10-team-approval-summary.md). Mọi flag ghi vẫn mặc định false; unit/HTTP/artifact PASS không thay phê duyệt Khoa hoặc E2E thật.
