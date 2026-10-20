-- S001: 5 vai trò + toàn bộ quyền

INSERT INTO "ROLE" (id, name, description, created_at) VALUES
  (uuid_generate_v4()::text, 'ADMIN', 'Quản trị viên hệ thống', NOW()),
  (uuid_generate_v4()::text, 'FACULTY', 'Ban/Khoa quản lý đào tạo', NOW()),
  (uuid_generate_v4()::text, 'LECTURER', 'Giảng viên hướng dẫn & phản biện', NOW()),
  (uuid_generate_v4()::text, 'STUDENT', 'Sinh viên làm đồ án', NOW()),
  (uuid_generate_v4()::text, 'COMMITTEE', 'Thành viên hội đồng chấm bảo vệ', NOW())
ON CONFLICT (name) DO NOTHING;

INSERT INTO "PERMISSION" (id, resource, action, description, created_at) VALUES
  ('perm-01', 'account', 'read', 'Xem tài khoản', NOW()),
  ('perm-02', 'account', 'create', 'Tạo tài khoản', NOW()),
  ('perm-03', 'account', 'update', 'Cập nhật tài khoản', NOW()),
  ('perm-04', 'account', 'lock', 'Khóa/Mở tài khoản', NOW()),
  ('perm-05', 'student', 'read', 'Xem danh sách sinh viên', NOW()),
  ('perm-06', 'student', 'import', 'Import danh sách sinh viên', NOW()),
  ('perm-07', 'lecturer', 'read', 'Xem danh sách giảng viên', NOW()),
  ('perm-08', 'lecturer', 'import', 'Import danh sách giảng viên', NOW()),
  ('perm-09', 'term', 'read', 'Xem đợt đồ án', NOW()),
  ('perm-10', 'term', 'create', 'Tạo đợt đồ án', NOW()),
  ('perm-11', 'term', 'transition', 'Chuyển trạng thái đợt', NOW()),
  ('perm-12', 'registration', 'create', 'Sinh viên đăng ký GVHD', NOW()),
  ('perm-13', 'registration', 'read', 'Xem danh sách đăng ký', NOW()),
  ('perm-14', 'assignment', 'run', 'Chạy thuật toán phân công', NOW()),
  ('perm-15', 'assignment', 'publish', 'Công bố kết quả phân công', NOW()),
  ('perm-16', 'topic', 'create', 'Đề xuất đề tài', NOW()),
  ('perm-17', 'topic', 'read', 'Xem thông tin đề tài', NOW()),
  ('perm-18', 'proposal', 'review', 'Duyệt đề cương', NOW()),
  ('perm-19', 'task', 'manage', 'Quản lý nhiệm vụ tiến độ', NOW()),
  ('perm-20', 'defense', 'manage', 'Quản lý hội đồng và lịch bảo vệ', NOW()),
  ('perm-21', 'score', 'enter', 'Nhập điểm đánh giá', NOW()),
  ('perm-22', 'result', 'publish', 'Công bố điểm cuối cùng', NOW()),
  ('perm-23', 'report', 'export', 'Xuất báo cáo thống kê', NOW())
ON CONFLICT (resource, action) DO NOTHING;

-- Gán toàn bộ quyền cho ADMIN
INSERT INTO "ROLE_PERMISSION" (role_id, permission_id)
SELECT r.id, p.id FROM "ROLE" r, "PERMISSION" p WHERE r.name = 'ADMIN'
ON CONFLICT DO NOTHING;
