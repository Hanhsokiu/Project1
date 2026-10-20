-- S002: Bộ môn, chức danh, hệ đào tạo, hướng nghiên cứu chuẩn Khoa CNTT - ĐH Giao thông vận tải (UTC)

-- 1. BỘ MÔN
INSERT INTO "DEPARTMENT" (id, code, name) VALUES
  ('dept-cnpm', 'CNPM', 'Công Nghệ Phần Mềm'),
  ('dept-httt', 'HTTT', 'Hệ Thống Thông Tin'),
  ('dept-khmt', 'KHMT', 'Khoa Học Máy Tính'),
  ('dept-ktmt', 'KTMT', 'Mạng và Kỹ Thuật Máy Tính')
ON CONFLICT (code) DO NOTHING;

-- 2. CHỨC DANH / HỌC VỊ
INSERT INTO "TITLE_CONFIG" (id, name, abbreviation) VALUES
  ('title-th-s', 'Thạc sĩ', 'ThS.'),
  ('title-ts', 'Tiến sĩ', 'TS.'),
  ('title-pgs', 'Phó Giáo sư', 'PGS.TS.'),
  ('title-gs', 'Giáo sư', 'GS.TS.')
ON CONFLICT (name) DO NOTHING;

-- 3. HỆ ĐÀO TẠO
INSERT INTO "TRAINING_SYSTEM" (id, code, name) VALUES
  ('ts-cq', 'CQ', 'Chính quy'),
  ('ts-clc', 'CLC', 'Chất lượng cao (Việt - Anh)'),
  ('ts-lt', 'LT', 'Liên thông'),
  ('ts-tx', 'TX', 'Từ xa')
ON CONFLICT (code) DO NOTHING;

-- 4. 6 HƯỚNG LÀM ĐỒ ÁN TỐT NGHIỆP CHUẨN KHOA CNTT - UTC (Theo Khảo sát K63)
INSERT INTO "RESEARCH_AREA" (id, name, description) VALUES
  ('area-se', 'Phát triển phần mềm và ứng dụng (webApp, MobleApp)', 'Phát triển các ứng dụng Web, Di động, Cloud Native, Microservices'),
  ('area-ai', 'Dữ liệu và trí tuệ nhân tạo', 'Machine Learning, Deep Learning, NLP, Data Mining, RAG, AI Chatbot'),
  ('area-test', 'Kiểm thử phần mềm', 'Kiểm thử tự động, Selenium Webdriver, Agile Testing, Performance Testing'),
  ('area-game', 'Lập trình Game', 'Phát triển Game 2D, 3D bằng Unity, Unreal Engine, Game VR/AR'),
  ('area-infra', 'Hệ thống, mạng và hạ tầng CNTT', 'Thiết kế hệ thống, Quản trị mạng, Ảo hóa, Hạ tầng Cloud Server'),
  ('area-sec', 'An toàn thông tin và an ninh mạng', 'Cybersecurity, Mật mã học, Giám sát và phòng chống tấn công mạng')
ON CONFLICT (name) DO NOTHING;
