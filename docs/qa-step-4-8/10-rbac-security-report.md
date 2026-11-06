# Phân quyền và bảo mật trong phạm vi

## Matrix nghiệp vụ

| Hành động | Khoa/FACULTY | GVHD hiện hành | Reviewer đúng vòng | SV owner | ADMIN |
| --- | --- | --- | --- | --- | --- |
| Quản lý nhóm/ phân review |Có, grant đợt / bộ môn |Không |Không |Không |Không tự bypass |
| Đọc đề cương/version |Trong grant |Hồ sơ hướng dẫn |Chỉ SEALEDversion được phân |Của mình |Không tự bypass |
| Save snapshot |Không theo facultyaction |Có |Không theo membership |Có |Không |
| Submit |Không |Không |Không |Có |Không |
| Comment/decision review |Không chỉnhờ role Khoa |Không reviewhồ sơmình |Có, roster/phase/currentversion |Không |Không |
| Finalize/receipt |Có trong grant |Không |Không |Không |Không |
| PDF finalized |Trong grant+export |Hồ sơ hướng dẫn |Không tự có quyền dossierexport |Của mình |Không |
| Plan/task manage |Đọc tổng hợp |Có |Không |Không |Không |
| Progress/submit bài |Không |Không |Không |Của mình |Không |
| Đọc/tải filetuần |Trong grant |Hồ sơ hướng dẫn |Không nhờ proposalreview |Của mình |Không |
| Review/amend bài |Không |Có exactcurrentsubmission |Không |Không |Không |
| Dashboard |Trong grant |Inbox của mình |Không |Không toàn đợt |Không |
| Notification |Self |Self |Self |Self |Self, không đọc người khác |

Role, permission và relationship đều cần thiết; tokenclaim giả không đủ. Chức danh hội đồng /chủtịch/thư ký không đưa vào nhómduyệt của baseline này; permissions cho consumer9–10 **NOT VERIFIED**.

## Kiểm động

- [71 operation auth](evidence/20261026144939_2663ec/live-e2e/endpoint-auth.json): anonymous401; useractive không permission từ chối đúng. Một số legacyselfnotification được authenticated self đọc là contract hợp lệ, không phải bypass.
- Scenario154: ADMIN dù có permission/claim, cross-student/term/department, reviewer không được phân, GVHD cũ, account/grant bịthu hồi và replaycached đều có negativecase.
- Fileprivate: đổi ID submission/file/finalization, wrongparent, reviewerproposal tảifiletuần bịchặn; authorizeserver trước multipartbuffer trong8Bcases.
- Tokeninvalid và LoginSession hết hạn thực trả 401 trong [boundary](evidence/20261026144939_2663ec/boundary-diagnosed/results.json).
- [Legacysecurity4probes](evidence/20261026144939_2663ec/live-e2e/legacy-security.json) đều 403; H01/H02 lịch sử không còn tái hiện trên bản này.
- Notificationselfonly/markread/IDOR được 8C kiểm; thông báo không cấp quyền tài nguyên.

## Findings và giới hạn

QA-002 là menu hiển thị sai theo role, ** không phải pháthiện backend cấp quyền trái phép**. QA-006 là UX khi401, không phải sessionvô hiệu vẫn truy cập được. QA-001 là parserbudget/errormapping, chưa có bằng chứng dataexposure. Không có confirmedIDOR mới trong phạmvi đã chạy.

Chưa thực hiện pentest toàn hệthống, XSSpayload matrix, dependency/CVEscan, refresh-tokenrace/rotation exhaustive, objectstorage permissions production, RLS/SupabaseDataAPI, rate-limit/loadabuse hoặc malware scan. Không cài scanner/package và không stress dịch vụ chia sẻ. ZIP được validate format/path/CRC/size, không đồng nghĩa đã quét virus hay phân tích an toàn mọi source code.

Rủiroresource: inflateRawSync/CRC đồng bộ trên requestthread trước pending quota; có giới hạn bytes vàexpandedsize, không gọi là ZIPbombvô hạn. Cần measurement/concurrencybudget riêng, không vô hiệu guard.

**Kết luận:** các RBAC/IDORcases đã chạy đạt; chưa có căn cứ chứng nhận an toàn toàn backend/production. Giữ negativeownership regressions trong CI khi có PR sửa.
