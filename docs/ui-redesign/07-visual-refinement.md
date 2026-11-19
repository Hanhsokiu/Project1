# Tinh chỉnh giao diện và chuyển động UTC

Phản hồi mới: bề mặt còn “nhựa”, chuyển động chưa rõ, bố cục chưa gần ảnh tham chiếu.
Phạm vi: token/kit trình bày dùng chung, shell và mẫu đăng ký; giữ API, quyền, validation,
điều kiện lưu/nộp và dữ liệu thật. Giữ mọi thay đổi đã có trước lượt này.

1. **Chất liệu và phân cấp:** nền trắng cho vùng làm việc, giảm bóng xanh/inset highlight,
   chỉ giữ màu ở nhận diện, trạng thái và hành động; bỏ khung hero dư thừa ở header chung.
2. **Bố cục đăng ký:** cân form/rail, nhịp khoảng cách gọn, thông tin hồ sơ dễ quét;
   giữ ghi chú và những thông tin nghiệp vụ mà ảnh minh họa không thể hiện.
3. **Motion:** entrance ngắn theo nhóm nội dung, hover/pressed, drawer/dialog,
   chevron/disclosure và chuyển vị trí nguyện vọng thật. Không hiệu ứng chạy nền,
   animation lặp trang trí hoặc bổ sung trạng thái lưu giả. Tắt chuyển động khi reduced motion.
4. **Nghiệm thu:** ảnh trước/sau 1440/1024/768/390/320px, đối chiếu ảnh tham chiếu;
   hồi quy kit/drawer/dialog và đăng ký, kiểm animation/reduced-motion/bàn phím;
   type-check, lint, unit tests, build. Phân biệt API thật và fixture cô lập.

Bằng chứng: [visual-refinement/](evidence/visual-refinement/README.md).
