# Chẩn đoán tải chậm màn hội đồng và phản biện

Ngày 19/11/2026, trên bộ NGUON80 hiện có. Ảnh người dùng gửi là `/defense/reviewer-grading`, không phải trang thành lập hội đồng.

## Bằng chứng

Chạy service thực tế đã build, cùng tài khoản Khoa và đợt đang dùng, giữ isolation/deadline 30 giây của repository. Thêm `SET TRANSACTION READ ONLY` để DB chặn ghi; không dùng token/mật khẩu của người dùng, không giả đăng nhập HTTP. Các số đo này không bao gồm middleware HTTP hay thời gian render trình duyệt.

| Màn/service | Thời gian | Số truy vấn | Kết quả |
|---|---:|---:|---|
| Danh sách chấm phản biện | 30.742 ms | 225 | Prisma P2028, transaction hết thời gian |
| Workspace hội đồng | 30.799 ms | 277 | Prisma P2028, transaction hết thời gian |
| Danh sách chấm hội đồng | 30.666 ms | 353 | Prisma P2028, transaction hết thời gian |

Ở lần đo phản biện, nhánh hội đồng chưa tải xong: mới hoàn thành kiểm tra điều kiện 10 hồ sơ, hồ sơ thứ 11 đang xử lý. Riêng thời gian truy vấn cộng dồn là 29.307 ms. Ở workspace hội đồng mới hoàn thành 13 hồ sơ, hồ sơ thứ 14 đang xử lý. Chưa trả được danh sách nên không thể kết luận các hồ sơ còn lại tốn bao nhiêu thời gian.

Lệnh tái hiện (chỉ đọc):

```powershell
node scripts/source-dataset/diagnose-defense-performance.cjs reviewer-list
node scripts/source-dataset/diagnose-defense-performance.cjs committee-workspace
node scripts/source-dataset/diagnose-defense-performance.cjs committee-grade-list
```

Chi tiết không chứa nội dung bản ghi/credentials nằm ở `.cache/source-dataset/performance-*.json`. Lần đầu trong sandbox bị lỗi kết nối P1011, không dùng làm số đo; đã chạy lại ngoài sandbox và tái hiện P2028 trên DB thật.

## Nguyên nhân trong implementation

- `backend/src/defense/reviewer-grading/reviewer-grade.service.ts`: `list` gọi `load` tuần tự từng phân công; `source` cần workspace phản biện, workspace này lại cần workspace hội đồng. Chỉ cắt trang sau khi dựng toàn bộ danh sách.
- `backend/src/defense/committees/committee-workflow.service.ts`: workspace duyệt các ứng viên và gọi `EligibilityService.forCommittee` từng người. Mỗi người cần nhiều truy vấn về đề cương, GVHD, hồ sơ, báo cáo, tiến độ và audit. Cache snapshot hiện tại chưa giảm được chi phí lần tải đầu này.
- `backend/src/defense/committee-grading/committee-grade.service.ts`: danh sách có vòng lặp hội đồng → sinh viên → thành viên để dựng từng phiếu, sau đó mới lọc/sắp xếp/cắt trang.
- Frontend `shared/api/http-client.ts` có timeout 20 giây; `app/App.tsx` đặt retry một lần. Vì backend đã cần hơn 30 giây rồi thất bại, người dùng có thể chờ khoảng hai lượt timeout trước khi thấy lỗi. Đây là suy ra từ cấu hình code; chưa đo trực tiếp phiên trình duyệt đang đăng nhập của người dùng.

Kết luận: đã xác nhận điểm nghẽn truy vấn ở backend bằng dữ liệu thật. Không có căn cứ quy nguyên nhân cho mất dữ liệu hoặc lỗi riêng của máy/trình duyệt người dùng. Tăng timeout đơn thuần không xử lý lượng truy vấn tuần tự này.

## Phạm vi sửa đề xuất

1. Gom đọc dữ liệu điều kiện/ứng viên theo đợt thành các truy vấn theo lô trong transaction chỉ đọc; tiếp tục dùng validator, chứng cứ và kiểm quyền hiện có cho từng người.
2. Tái sử dụng dữ liệu nguồn không đổi trong đúng transaction, với khóa chứa actor/đợt/phạm vi; không dùng cache chung giữa người dùng hoặc giữ chứng cứ cũ qua transaction. Các truy vấn Prisma dạng lazy cần chuyển thành Promise thực trước khi dùng làm cache kết quả.
3. Tách công việc cần cho danh sách khỏi nội dung chỉ cần ở chi tiết khi contract cho phép. Giữ nguyên ngữ nghĩa trạng thái, tổng số, bộ lọc và thứ tự; không cắt trang sớm nếu làm sai các giá trị này.
4. Giữ kiểm tra mới tại thao tác ghi/chốt, giữ toàn bộ ownership, grant, stale evidence, revision và khóa. Không sửa schema, RBAC, policy hay dữ liệu NGUON80 trong bản sửa hiệu năng.

Tiêu chí nghiệm thu: ba đường đọc trên trả dữ liệu dưới timeout frontend hiện tại trên cùng bộ dữ liệu; đối chiếu kết quả với logic cũ trong phạm vi có thể chạy, kiểm tra quyền/thu hồi quyền/chứng cứ stale và phân trang; chạy test liên quan, type-check/build backend, rồi đo lại. Mục tiêu nhanh hơn cần được xác nhận bằng số đo, chưa coi đề xuất là bản sửa đã đạt.

## Bản sửa đã được duyệt và kiểm chứng

Người dùng đã trả lời **“Đồng ý sửa backend để xử lý tải chậm”**. Bản sửa giữ nguyên schema, policy, RBAC và dữ liệu; không thay timeout frontend hoặc deadline API.

- Gom các phép đọc theo lô và tái sử dụng kết quả trong đúng transaction RepeatableRead của các repository hội đồng, phản biện, lịch và chấm điểm. Dùng Promise thực để mỗi truy vấn lazy chỉ thực thi một lần. Bộ gom giữ nguyên bộ lọc, cặp proposal/scorer, giới hạn audit từng hồ sơ, projection và kết quả null khi thiếu bản ghi.
- Kiểm tra điều kiện và validator vẫn chạy từng sinh viên. Chỉ transaction đọc đã đánh dấu mới chạy các vòng đọc đồng thời; command vẫn dùng transaction gốc, khóa và kiểm tra mới. Không cache qua request, không sửa quyền.
- Gom lịch sử GVHD của đợt, tiếp tục tách đúng sinh viên trước khi tính chứng cứ; tránh JSON join lặp snapshot kế hoạch phân công lớn. Gom audit hội đồng/lịch theo lô.
- `windowTerm` chỉ đọc phase và dữ liệu đợt dùng để xác định thời gian/khóa; không tải cả roster và profile khi kiểm tra cửa sổ thao tác. Kiểu đầu vào của bộ tính cửa sổ được thu hẹp tương ứng, không đổi cách tính.

Kết quả bản cuối ngày 19/11, đo từng service qua DB thật, không có cache giữa các lần chạy:

| Màn/service | Trước sửa | Sau sửa | Dữ liệu trả về |
|---|---|---|---|
| Workspace hội đồng | Hết thời gian 30,8 giây, chưa dựng xong danh sách | 11,195 giây, 49 truy vấn | 4 hội đồng có chứng cứ hiện hành |
| Chấm phản biện | Hết thời gian 30,7 giây, chưa dựng xong danh sách | 16,903 giây, 100 truy vấn | 20 hồ sơ: 16 FINALIZED, 4 NONE |
| Chấm hội đồng | Hết thời gian 30,7 giây, chưa dựng xong danh sách | 17,124 giây, 90 truy vấn | 96 phiếu: 48 FINALIZED, 48 NONE |

Đây là số đo của các lần chạy cuối, không phải cam kết thời gian mọi lần truy cập. Các bản thử trung gian vẫn có lần vượt 20 giây; service còn phải xác minh nhiều chứng cứ qua Supabase từ xa. Bản cuối đã trả được dữ liệu dưới timeout frontend 20 giây trong lần đo trên; chưa xác minh phiên trình duyệt Khoa đang đăng nhập của người dùng. Không tuyên bố UI hiển thị tức thì hoặc toàn hệ thống đã hết vấn đề hiệu năng.

Kiểm chứng đã chạy:

```powershell
cd backend
corepack pnpm exec tsc --noEmit
corepack pnpm run build
corepack pnpm exec vitest run src/defense src/guidance/final-defense src/report/defense-reporting src/term
```

Type-check/build đạt; **42 file test, 701 test đạt**, gồm kiểm quyền, thu hồi grant, stale evidence, trạng thái, khóa, replay, bản xuất và các test mới cho việc gom truy vấn. ESLint đã đạt trên toàn bộ file TypeScript sửa/thêm. Test trong sandbox bị `spawn EPERM` đã được chạy lại ngoài sandbox; không bỏ test hoặc đổi tiêu chí.

`compare-eligibility-read.cjs` chạy inspector gốc từ Git HEAD và inspector mới trên cùng một snapshot DB chỉ đọc. Tám hồ sơ ở các bước từ đề cương cần sửa tới kết quả đã công bố có chứng cứ giống hệt, gồm evidence hash. Báo cáo ở `.cache/source-dataset/eligibility-performance-parity.json`. Công cụ so sánh dùng transaction dài riêng để đọc cả hai bản, không thay deadline API. Số đo hiệu năng riêng vẫn giữ deadline repository gốc. Không ghi Supabase trong các kiểm tra này.

API cổng 3011 và UI 5183 đã khởi động lại bằng bản build mới. Không commit/push. Việc kiểm tra UI toàn bộ vai trò, responsive và accessibility vẫn chưa hoàn tất.
