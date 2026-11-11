# Vận hành B1–B10 theo lịch thật

Backend thông thường khởi động từ `backend/src/main.ts`, dùng `Date` thật của server. Không import runtime nghiệm thu. Chưa triển khai thay đổi của lượt này lên Render/Supabase; kết luận về production ở đây là kết luận từ source/bootstrap và test HTTP, không phải kiểm tra deployment Render đang chạy.

## Ba loại trạng thái

- Lịch giai đoạn: các hàng `TERM_PHASE`, so với thời gian server ở mỗi request. Cửa sổ `[start, end)`: đúng giờ bắt đầu được phép; đúng giờ kết thúc bị chặn. Có thể không có giai đoạn nào trong khoảng trống; PROPOSAL_REVIEW có thể trùng PROPOSAL.
- Vòng đời đợt: DRAFT, OPEN_REGISTRATION, CLOSED_REGISTRATION, IN_PROGRESS, DEFENDING, COMPLETED/CANCELLED. Đến giờ DEFENSE không tự chuyển IN_PROGRESS thành DEFENDING.
- Trạng thái hồ sơ/phiếu: phiên bản, gửi/duyệt, chốt, xác nhận, công bố. Đến hạn chỉ khóa thao tác, không tạo quyết định hoặc điểm thay người có quyền.

Ngoại lệ tự động đã có của B1–B3: scheduler 30 giây đóng cửa sổ đăng ký đã hết hạn, ghi `REGISTRATION_AUTO_CLOSED`, có thể tạo phương án phân công **nháp**. Không tự chốt/công bố phương án, duyệt hồ sơ, chốt điểm hoặc công bố kết quả. Không thay đổi cơ chế này trong lượt sửa.

## Cách Khoa cấu hình/gia hạn

1. `/terms` → **Tạo đợt mới**, chọn kỳ/hệ và ngày thật. Backend kiểm tra đợt nằm trong kỳ. Sáu giai đoạn mặc định chỉ là kế hoạch ban đầu để Khoa chỉnh.
2. `/terms/<id>/phases` → cấu hình lịch, có thể thêm PROPOSAL_REVIEW. Người lưu cần `term:plan`; đợt phải chưa khóa/chưa kết thúc. Mốc trong form là giờ Việt Nam, giữ cả giây/mili giây nếu có.
3. Khi đợt đã rời DRAFT, đổi lịch/khóa/mở phải có **Lý do điều chỉnh/gia hạn kế hoạch** (5–2000 ký tự). Bản nháp vẫn được lập lịch ban đầu mà chưa cần lý do điều chỉnh. API kiểm tra lý do; audit `SAVE_TERM_PHASES` lưu trước/sau, người thực hiện và lý do trong cùng transaction.
4. Gia hạn phải nằm trong đợt và không chồng giai đoạn sau. Nếu cần, người có `term:update` điều chỉnh hạn đợt trong kỳ trước; API sửa hạn đợt cũng yêu cầu lý do khi đã mở, audit `UPDATE_TERM`. Sau đó người có `term:plan` điều chỉnh lịch các giai đoạn liên quan.
5. Mở khóa không bỏ qua thời hạn; gia hạn không bỏ qua trạng thái đợt, RBAC, scope, phân công hoặc policy. Không tự viết lại hạn riêng trong policy, lịch phiên bảo vệ hoặc hạn nhiệm vụ tuần.
6. Khoa chuyển vòng đời theo workflow: ví dụ trang chi tiết đợt → **Điều khiển vòng đời** → **Chuyển sang bảo vệ** → **Xác nhận**. Cần `term:transition`.

## Cửa sổ và các điều kiện bổ sung

| Luồng | Cơ chế thời gian |
|---|---|
| B1 lập kế hoạch/đợt | Cấu hình ngày trong kỳ; thay đổi sau khi mở cần lý do và quyền |
| B2 đăng ký | REGISTRATION + OPEN_REGISTRATION |
| B3 phân công | ASSIGNMENT + CLOSED_REGISTRATION; chốt/công bố bằng workflow |
| B4 nhóm xét duyệt | Cấu hình học vụ theo quyền/scope; không phải quyết định hồ sơ theo đồng hồ |
| B5–B7 đề cương | PROPOSAL_EDIT/PROPOSAL_REVIEW liên kết lịch; khóa đợt, hạn và revision/duyệt/chốt riêng |
| B8 hướng dẫn/tiến độ | GUIDANCE liên kết WEEKLY; thêm hạn của nhiệm vụ, báo cáo và quy tắc nộp muộn riêng |
| UC17 PDF cuối, GVHD | FINAL + IN_PROGRESS; thêm policy/quyền/sở hữu/phiên bản |
| UC18 đủ điều kiện | Giai đoạn do UC18_POLICY chỉ định; quyết định và chốt của Khoa |
| UC19 hội đồng | Giai đoạn do UC19_POLICY chỉ định; thêm roster/hash, thành viên và xung đột |
| UC20 phản biện | Giai đoạn do UC20_POLICY chỉ định; thêm phân công và xung đột |
| UC21 lịch | Giai đoạn do UC21_POLICY chỉ định và DEFENSE, ngày/buổi/cửa sổ công bố trong policy |
| UC22 phản biện chấm | Giai đoạn do UC22_POLICY chỉ định; có thể thêm cửa sổ quanh lịch bảo vệ |
| UC23 hội đồng chấm | DEFENSE + DEFENDING, hiệu lực policy và cửa sổ từng phiên |
| UC24 kết quả | DEFENSE + DEFENDING và đủ nguồn điểm/xác nhận; không tự tổng hợp/chốt/công bố |
| UC25 báo cáo | Quyền/scope, policy, mẫu và hiệu lực mẫu; đọc/lưu trữ không bị khóa chỉ vì hết DEFENSE. Xuất chính thức yêu cầu nguồn hợp lệ/công bố theo mẫu |

Backend quyết định quyền ghi tại thời điểm request/transaction. Dữ liệu GET có thể lưu tạm trên UI; request ghi vẫn bị từ chối nếu vừa qua hạn. Không dùng đồng hồ máy người dùng làm căn cứ cấp quyền.

## UTC và công cụ nghiệm thu

Prisma dùng PostgreSQL `timestamptz`, API nhận ISO8601 có `Z`/offset và trả UTC bằng `toISOString()`. UI nhập/hiển thị Asia/Ho_Chi_Minh (UTC+7), không phụ thuộc múi giờ Windows. Lưu form không cắt bỏ giây/mili giây của lịch.

Bootstrap thông thường chặn toàn bộ `/<API_PREFIX>/acceptance/*` bằng HTTP 404, kể cả nếu một controller TEST vô tình được import. Không có cờ env để bật lại ở bootstrap này. UI bản build production không hiển thị công cụ dù đặt nhầm VITE_ACCEPTANCE_STAGING.

Chỉ `scripts/acceptance/runtime.cjs` riêng mới đăng ký công cụ: kiểm tra không phải NODE_ENV=production, nhánh, URL loopback, tên DB/mode, label Docker và port thuộc runId trước khi cài đồng hồ. API đổi giờ còn kiểm tra Origin, JWT/session sống, FACULTY TEST và namespace đợt. Chỉ sửa clock của tiến trình app TEST và container PG TEST sở hữu; không sửa Windows hoặc PostgreSQL production.

## Đợt mới trên hệ thống thật

Không có dependency bắt buộc vào công cụ TEST: có thể tạo đợt và đi B1–B10 theo lịch thực đã cấu hình, chuyển trạng thái nghiệp vụ bằng vai trò có quyền. Tuy nhiên **tạo đợt mới không tự tạo chín policy APPROVED UC17–UC25**: code tạo đợt chỉ sinh tham số nền và liên kết phase. Trước khi chạy B9–B10 cần policy đúng term/version/contract và phê duyệt thật, RBAC/scope/phân công hợp lệ, storage bền vững và write flags được duyệt riêng. Không sao chép policy TEST vào đợt chính thức. Những điều kiện này không được coi là đã đáp ứng trên production trong lượt sửa.

Kiểm thử tạo đợt mới bằng server clock thật, biên thời gian/gia hạn, HTTP quyền, từ chối clock TEST, cùng regression code chạy cô lập; không tuyên bố đã chạy một đợt chính thức B1–B10 end-to-end qua nhiều ngày trên production.
