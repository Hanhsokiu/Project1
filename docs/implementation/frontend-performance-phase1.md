# Tối ưu tải dữ liệu frontend — đợt 1

Ngày kiểm tra: 19/11/2026.

## Phạm vi và tiêu chí

Đợt đầu giảm các lần đọc lặp và thời gian giao diện chờ sau khi API lưu thành
công. Chỉ thay frontend, giữ API thật, validation, RBAC và nghiệp vụ hiện có.

| Phần | Tiêu chí nghiệm thu |
| --- | --- |
| Danh mục tham chiếu | Tái sử dụng kỳ học, hệ đào tạo, bộ môn, hướng chuyên môn trong cùng phiên; chỉnh sửa danh mục phải làm mất hiệu lực cache tương ứng. |
| Tải định kỳ | Timer/focus không vô hiệu hóa dữ liệu còn mới; query có polling riêng không bị timer chung gọi thêm. |
| Lưu | Chỉ báo thành công sau khi mutation hoàn tất, nhưng không chờ các GET phục vụ đồng bộ giao diện. Lỗi tải nền có thông báo riêng. |
| Nhất quán | Giữ cơ chế bảo vệ bản nháp, cập nhật sau ghi và xóa cache khi đổi tài khoản. Không dùng dữ liệu giả khi API lỗi. |

## Thay đổi đã thực hiện

- Cache trong bộ nhớ cho bốn danh mục tham chiếu, thời gian 5 phút. Các lượt đọc
  đồng thời dùng chung request. Không lưu lỗi, không lưu vào localStorage và không
  tái sử dụng giữa các access token. Không cache thêm identity, permissions hay
  trạng thái workflow trong lớp cache này.
- Ghi thành công vào danh mục làm mất hiệu lực đúng danh mục trước khi tải lại;
  tạo/cập nhật đợt cũng làm mất hiệu lực kỳ học vì tạo đợt có thể tạo kỳ học mới.
  BroadcastChannel truyền tên danh mục cần làm mới sang các tab khác, không truyền
  token, dữ liệu người dùng hay nội dung request. Thay đổi từ thiết bị/người dùng
  khác vẫn có thể chờ hết thời hạn cache 5 phút.
- Timer chung vẫn kiểm tra mỗi 30 giây nhưng chỉ refetch query đang dùng và đã
  stale; không ép invalidate mọi query khi focus/polling. Query lịch đợt workflow
  và đăng ký giữ polling riêng 30/15 giây. Ghi thành công vẫn invalidate để cập
  nhật cả query còn mới; lịch sử phiên bản bất biến vẫn được loại trừ.
- Snapshot chung được coi là mới trong 60 giây. Khi không có thao tác ghi, lượt
  tải nền thực tế diễn ra ở lần kiểm tra 30 giây tiếp theo sau khi snapshot stale;
  không bảo đảm cập nhật đúng mỗi 60 giây. Query chuyên biệt giữ chính sách riêng.
- Hook `useAction` báo lưu thành công ngay sau khi mutation thành công, tải lại
  snapshot/đăng ký đồng thời ở nền và tránh hủy để khởi động lại GET đang chạy.
  Nếu tải nền lỗi, thông báo phân biệt lỗi tải với thao tác đã lưu thành công;
  trạng thái lỗi và nút thử lại hiện có vẫn được giữ.
- Bỏ độ trễ mô phỏng 120 ms khỏi đường snapshot dùng xác thực API thật.

Trong test snapshot, lần hydrate tiếp theo bỏ được bốn request danh mục nhưng
vẫn đọc lại sinh viên, giảng viên và đợt. Đây là bằng chứng giảm request trong
fixture, không phải phép đo mức tăng tốc trên production.

## Phần cần làm tiếp

1. Tách snapshot theo màn hình. Đợt này **chưa** bỏ tải toàn bộ danh sách sinh
   viên/tài khoản/nhật ký và dữ liệu nhiều đợt ở lần tải đầu. Cần lập danh sách
   dependency của dashboard, shell và từng màn trước khi tách để tránh hiển thị
   số liệu thiếu như một danh sách đầy đủ.
2. Chuyển từng mutation sang invalidate đúng query của feature và các dependency
   liên quan. Tín hiệu ghi chung hiện vẫn invalidate rộng để giữ tính nhất quán;
   đợt này chỉ thu hẹp tải định kỳ và cache danh mục, chưa hoàn tất bước này.
3. Dùng danh sách sinh viên làm màn thử nghiệm phân trang server. Endpoint thực
   tế là `StudentController -> StudentService -> CatalogRepository.students`,
   đã có page/pageSize, search, termId, trainingSystemId, className và
   academicEligible. Không suy luận khả năng endpoint từ `StudentRepository`
   nền cũ. Giao diện hiện tìm cả tên lớp, còn server search tìm mã/tên/email;
   giao diện tính điều kiện có xét GPA null, còn server chỉ lọc cờ
   academicEligible. Các thẻ thống kê và lựa chọn lớp cũng đang phụ thuộc toàn
   bộ sinh viên. Phải giữ các chức năng và kết quả này khi thiết kế phương án
   phân trang; thay đổi backend/contracts nếu cần là phạm vi riêng.
4. Đo Network trước/sau trên cùng tài khoản, màn hình và dữ liệu thật: số request,
   byte tải, thời gian có dữ liệu chính, thời gian API ghi và thời gian kết thúc
   trạng thái đang lưu. Đo lần đầu và lần quay lại riêng. Render Free cold start
   không được giải quyết bởi đợt frontend này.

## Kiểm chứng

Các lệnh chạy từ gốc repository:

| Lệnh | Kết quả |
| --- | --- |
| `corepack pnpm --filter @doan/frontend type-check` | Đạt. |
| `corepack pnpm --filter @doan/frontend lint` | Đạt. |
| `corepack pnpm --filter @doan/frontend test` | Đạt: 66 file, 412 test. Có cảnh báo SSR `useLayoutEffect` và Vite CJS từ bộ kiểm tra hiện có. |
| `corepack pnpm --filter @doan/frontend build` | Đạt với `VITE_AUTH_API=true`, `VITE_DEMO_MODE=false`, `VITE_API_URL=/api`. Còn cảnh báo kích thước bundle; không thay ngưỡng cảnh báo. |
| `corepack pnpm --filter @doan/frontend test:data-consistency:browser` | Đạt: đồng bộ đợt/đổi tài khoản, 11 kiểm tra nhiệm vụ, 10 kiểm tra nộp bài, 10 kiểm tra đánh giá/nhắc việc; gồm bảo vệ bản nháp và mobile. |
| `corepack pnpm --filter @doan/frontend test:ui:browser -- --registration-only` | Đạt: màn đăng ký ở 7 kích thước 320–1440 px; Escape/Tab không đưa focus vào menu đã đóng. |
| `corepack pnpm --filter @doan/frontend test:ui:browser -- --accessibility-only` | Đạt 6 kiểm tra thành phần dùng chung, menu bàn phím, drawer, tìm/lọc/sắp xếp/xuất; axe trên trang tài khoản trả về 0 vi phạm. |
| `node scripts/check-production-assets.cjs --frontend frontend/dist` | Đạt: 51 asset, không có finding. |
| `git diff --check` | Đạt trên diff cuối. |

Bằng chứng dùng `UI_EVIDENCE_DIR=docs/performance/evidence/2026-11-19-phase1`:
[ảnh đăng ký mobile 375 px](../performance/evidence/2026-11-19-phase1/registration-375.png),
[ảnh desktop 1440 px](../performance/evidence/2026-11-19-phase1/registration-1440.png),
[kết quả axe](../performance/evidence/2026-11-19-phase1/accessibility.json).
Các ảnh là fixture kiểm tra; kiểm tra axe nói trên áp dụng trang tài khoản, không
phải chứng nhận accessibility toàn hệ thống.

Vitest cần chạy ngoài sandbox vì esbuild bị chặn tạo tiến trình con (`spawn
EPERM`). Kiểm tra trình duyệt dùng API fixture cô lập, không kết nối Supabase và
không chứng minh tốc độ hoặc tích hợp API production. Chưa commit, push hoặc
triển khai những thay đổi này.
