# Kiểm thử nghiệm thu UC17–UC25 trên hệ thống chung

Trạng thái: **ĐÃ CHUẨN BỊ, CHƯA CHẠY HTTP/nghiệp vụ production**. Database UC17–UC24 đã có đủ 25 migration APPLIED, 0 FAILED và postflight PASS. Điều này không thay thế nghiệm thu nghiệp vụ, quyền của người dùng hoặc độ bền file trên Backend Render.

## Bằng chứng hiện có và điều kiện còn thiếu

- Đối chiếu READ ONLY: 25 checksum, function `fr_commit_check` đúng bản PG17 đã sửa, catalog trigger/FK/CHECK/index/RLS và dữ liệu gốc. Chi tiết trong `evidence/execution-result.json`, raw `uc24-final-verification.json` trong cache rollout.
- Các bảng hồ sơ bảo vệ, PDF cuối, hội đồng, lịch, điểm và kết quả hiện chưa có bản ghi. Không tự tạo dữ liệu điểm/kết quả để làm test PASS. Phép quét CHECK/FK trên bảng trống chỉ xác minh catalog, không chứng minh positive E2E.
- Không có bản ghi `UC17_POLICY`–`UC25_POLICY`. Nhóm/Khoa phải duyệt cấu hình có version theo từng đợt, gồm hạn nộp, rubric/bước điểm, quyền hiển thị, xung đột hội đồng, lịch, công thức điểm, xác nhận/công bố và mẫu xuất. Không suy ra quy định hoặc tự chèn policy.
- Thiếu định nghĩa permission UC24: `defense-result:{read,confirm,finalize,publish}`; UC25: `defense-report:{read,templates-read,statistics,preview,export,history-read,download}`. Cần nhóm duyệt mapping role và triển khai bổ sung bằng thay đổi riêng; không sửa checksum hoặc tự cấp quyền trong lượt migration này.
- Có tài khoản ACTIVE thuộc FACULTY/LECTURER/STUDENT, nhưng chưa được nhóm chỉ định tài khoản nào được phép nghiệm thu. Số tài khoản không phải sự chấp thuận dùng chúng để test. Không tạo tài khoản, giả JWT, đọc password hash hoặc gửi thông tin đăng nhập qua chat/Git.
- Write flags UC17–UC25 trong cấu hình local vẫn false; cấu hình và revision đang deploy trên Render chưa được kiểm chứng. Mọi nghiệm thu có ghi phải được duyệt riêng; tài liệu này không cho phép bật flags.
- Chưa kiểm chứng file storage đang deploy có lưu bền, PDF có thực sự tồn tại và tải được sau restart/redeploy. Không tự tạo Disk/bucket hoặc restart production để test.

## Nhóm cung cấp trước khi thực thi

Chỉ định Backend Render đúng revision, một đợt/hồ sơ nghiệp vụ hợp lệ và người phụ trách xác nhận dữ liệu. Chọn tài khoản hiện có: sinh viên sở hữu hồ sơ và sinh viên khác, GVHD đúng phân công và giảng viên ngoài phạm vi, GVPB đúng phân công, từng thành viên hội đồng với vai trò thực tế, giáo vụ/Khoa được cấp quyền. Các vai trò chốt/công bố phải đáp ứng separation policy đã duyệt. Không ghi tên hoặc credentials vào artifact công khai.

Người có thẩm quyền xác nhận policy/version, mapping quyền và phạm vi thao tác hợp lệ. Cấp phiên đăng nhập qua kênh bảo mật, không sửa `.env` để lưu token. Chỉ dùng hồ sơ/điểm/xác nhận do người có trách nhiệm tạo theo nghiệp vụ thật; không seed hoặc giả lập quyết định trên Supabase chung.

## Lượt 1 — đọc và phân quyền bằng tài khoản đã được duyệt

Chỉ thực thi sau khi Backend và danh tính tài khoản được xác minh. Kiểm tra anonymous được 401, tài khoản thiếu quyền được 403, phạm vi hồ sơ không rò rỉ PDF/điểm/nhận xét. Với quyền đọc hợp lệ, danh sách trống hoặc trạng thái thiếu policy phải được hiển thị trung thực. Không thay empty list thành dữ liệu mẫu và không coi thiếu permission UC24/UC25 là lỗi migration.

Các endpoint options/list dưới prefix `/api`: `final-defense`, `defense-eligibility`, `defense-committees`, `defense-reviewers`, `defense-schedules`, `defense-reviewer-grades`, `defense-committee-grades`, `defense-results`, `defense-reports`. UC25 có thêm `templates`/`statistics`; chỉ kiểm tra sau mapping quyền được duyệt. Không chạy script rehearsal `uc17-24-api-smoke.cjs` lên production: script đó tạo fixtures và quyền local.

## Lượt 2 — nghiệm thu nghiệp vụ hợp lệ, cần duyệt ghi riêng

| UC | Tài khoản / điều kiện thật | Kiểm thử cần ghi nhận |
| --- | --- | --- |
| UC17 + PDF cuối UC15 | SV đúng hồ sơ, GVHD đúng phân công, thời hạn và policy được duyệt, storage bền | Nộp PDF theo version; tải đúng checksum; GVHD nhận xét/điểm/xác nhận; Không đồng ý có lý do; revision/audit/idempotency; quyền xem từng loại nội dung và quyết định khi PDF thay đổi. |
| UC18 | Khoa/giáo vụ có quyền, hồ sơ nguồn hiện hành | Xét điều kiện, lý do, chốt đúng nguồn/revision; không cho hồ sơ chưa đủ điều kiện đi tiếp. |
| UC19 | Khoa, danh sách giảng viên và vai trò thực tế | Hội đồng 3–5 thành viên, vai trò đúng policy; finalize chỉ khi đủ thành phần và nguồn hợp lệ. |
| UC20 | Khoa/giáo vụ, hồ sơ được phép bảo vệ | Phân công GVPB; kiểm tra xung đột GVHD với **toàn bộ thành viên** hội đồng; snapshot/revision đúng nguồn. |
| UC21 | Giáo vụ, hội đồng và phân công đã chốt | Lịch sáng/chiều, phòng/giảng viên không trùng; thứ tự Tên + Họ đệm; finalize/publish theo policy. |
| UC22 | GVPB được phân công, PDF hiện hành, rubric approved | Tải PDF, nhận xét và điểm thật; lưu/finalize theo policy; quyền ngoài phạm vi bị từ chối, audit và revision đúng. |
| UC23 | Mỗi thành viên hội đồng thật, rubric/version approved | Chấm độc lập; tổng/chi tiết đúng rubric và precision lưu trữ; finalize đúng người/nguồn; không sửa phiếu đã chốt; không lộ điểm thành viên khác ngoài quyền. |
| UC24 | Điểm nguồn thật đã finalized; policy công thức/xác nhận/separation approved | Preview công thức/rounding; xác nhận đúng vai trò; finalize/publish đúng thẩm quyền; phát hiện nguồn đổi; dữ liệu công bố bất biến; đối chiếu kết quả bằng tính toán độc lập. |
| UC25 | Kết quả đã công bố hợp lệ, mẫu/version approved, storage xuất file được duyệt | Báo cáo theo hội đồng, Excel/PDF đúng mẫu/số dòng/tổng điểm; tải đúng quyền/checksum; đối chiếu bản in, đồng ký và lưu trữ theo quy trình Khoa đã duyệt. |

Đây là các thao tác nghiệp vụ thật, không phải lệnh tự động tạo điểm test. Không chạy fault injection, rollback phá hủy, ghi cạnh tranh hoặc replay dữ liệu giả trên database chung. Bằng chứng concurrency/rollback/trigger behavior cô lập đã PASS trên PG17 được giữ nguyên, không chạy lại chỉ để đổi báo cáo.

## Ghi nhận kết quả

Mỗi ca có người phê duyệt, actor alias/role, policy/version, bản ghi nguồn hợp lệ, thời điểm, thao tác, kết quả mong đợi/thực tế và trạng thái PASS/FAIL/BLOCKED/NOT RUN. Lưu PDF, điểm, nhận xét, token và log chứa dữ liệu thật ngoài Git với quyền phù hợp; artifact trong repository chỉ ghi metadata cần thiết. Đối chiếu audit/revision/idempotency và số bản ghi nghiệp vụ trước/sau với đúng thao tác đã duyệt. Không tuyên bố UC17–UC25 end-to-end PASS khi policy, quyền, file, tài khoản hoặc dữ liệu nguồn chưa đủ.
