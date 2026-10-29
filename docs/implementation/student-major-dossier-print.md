# Ngành học sinh viên và bản in đề cương — 29/10/2026

## Luồng sử dụng

1. Khi tạo tài khoản sinh viên hoặc thêm sinh viên trong danh mục, nhập **Ngành học**. Sinh viên cũ đăng nhập → **Thông tin cá nhân** → nhập ngành học thật → lưu.
2. Khoa vào **Chốt hồ sơ & nhận bản giấy** → hồ sơ đã duyệt. Lớp và ngành được gợi ý từ hồ sơ sinh viên; đối chiếu thông tin, tích xác nhận rồi bấm **Xác nhận lớp/ngành cho bản in**.
3. Khoa xem trước nội dung và bấm **Chốt đề cương chính thức**. Chốt đúng phiên bản APPROVED và lưu snapshot bất biến; không ghi nhận đã có chữ ký hoặc đã nhận bản giấy.
4. Sinh viên vào **Hồ sơ & bản in** (cũng có liên kết từ đề cương đã duyệt) → **Tải PDF để in và ký**. In, xin chữ ký theo mẫu và nộp Khoa.
5. Khoa chỉ ghi nhận tiếp nhận bản giấy sau khi thực sự nhận hồ sơ.

Ngành học không được suy từ tên lớp, hệ đào tạo hoặc bộ môn. Việc sinh viên đổi ngành trong hồ sơ cá nhân không thay đổi dữ liệu lớp/ngành đã được Khoa xác nhận hoặc PDF đã chốt.

## Phần triển khai

- Thêm nguồn `Student.majorName` (`STUDENT.major_name`), hiển thị trong tài khoản và danh mục sinh viên. API tạo/cập nhật cũ không gửi trường mới vẫn hoạt động; dữ liệu cũ mặc định chuỗi rỗng. API hồ sơ cá nhân chỉ cho sinh viên cập nhật ngành của chính mình.
- Import hỗ trợ cột `majorName` (hoặc Ngành học/Ngành), tùy chọn. Tệp cũ hoặc ô trống không xóa ngành đã có; trường nhập có giới hạn 200 ký tự.
- `PUT /proposals/:proposalId/dossier/student-profile` xác nhận `className`, `majorName`, `expectedRevision`. Chỉ FACULTY có `proposal:finalize` và grant đúng đợt/bộ môn được ghi. Không thay lớp trong hồ sơ sinh viên, nội dung đề cương hay kết luận duyệt.
- `expectedRevision=null` chỉ dành cho profile chưa tồn tại; cập nhật phải khớp revision hiện tại. Ghi trong transaction Serializable, khóa đợt/hồ sơ, kiểm tra lại phạm vi và trạng thái, ghi audit `STUDENT_PROFILE_CONFIRMED`.
- Hồ sơ đã chốt/đã nhận giấy/legacy chưa đối soát không được sửa profile trực tiếp. Lịch xét duyệt và khóa đợt vẫn có hiệu lực.
- Giao diện giải thích tình trạng chờ xác nhận/chờ chốt, hướng dẫn sinh viên cập nhật ngành và dẫn từ đề cương đã duyệt sang hồ sơ bản in. Không hiển thị nút PDF xem trước khi dữ liệu lớp/ngành chưa sẵn sàng.

## Cập nhật Supabase và kiểm chứng

- Áp dụng duy nhất migration `202610290001_student_major_name`: thêm cột TEXT NOT NULL DEFAULT ''. Đã kiểm tra lịch sử migration, không có migration khác chờ áp dụng; lưu history/checksum đúng file đã chạy trong cùng transaction.
- Bản chụp trước sửa và đối chiếu 14 bảng xác nhận dữ liệu cũ không thay đổi. Không seed, reset, gán ngành giả, tự chốt hồ sơ thật hoặc ghi nhận bản giấy.
- Dữ liệu ngành thật của sinh viên `221000009` vẫn để trống để sinh viên nhập. Hồ sơ **Kiểm thử hệ thống đồ án** vẫn APPROVED và chưa có bản chốt chính thức.
- Backend/frontend build và TypeScript thành công. Toàn bộ unit tests: **259 backend, 136 frontend PASS**.
- Kiểm tra trọn luồng service xác nhận profile → khoa chốt → sinh viên tạo/tải PDF trong transaction bắt buộc rollback: thành công; PDF hợp lệ, trạng thái tiếp nhận giấy vẫn chưa có, đối chiếu sau rollback không có thay đổi được commit. Chuỗi ngành kiểm thử chỉ tồn tại trong transaction bị rollback.
- Browser bằng phiên hiện có của `admin`, `221000009`, `giaovu`: form tạo tài khoản có ngành; sinh viên có ô nhập ngành và liên kết cập nhật hồ sơ; khoa có form xác nhận đúng lớp hiện có; không có lỗi JavaScript/API. Không lưu dữ liệu thử hoặc tạo phiên đăng nhập mới.
- Bằng chứng và bản chụp phạm vi dữ liệu nằm trong `.cache/shared-dev/student-major-*`, `.cache/shared-dev/dossier-rollback-verification.json`, `.cache/shared-dev/dossier-major-ui-verification.json` (được Git bỏ qua). Đây không phải bản backup toàn bộ database.
