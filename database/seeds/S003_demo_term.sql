-- S003: Đợt mẫu K62 trở về trước + Tham số chuẩn UTC

INSERT INTO "THESIS_TERM" (id, code, name, academic_year, semester, status, start_date, end_date)
VALUES (
    'term-utc-k62',
    'DATN-K62-HK2',
    'Đồ án tốt nghiệp K62 trở về trước (2024-2025)',
    '2024-2025',
    2,
    'DEFENDING',
    '2025-01-15 00:00:00+00',
    '2025-06-30 23:59:59+00'
) ON CONFLICT (code) DO NOTHING;

-- THAM SỐ CẤU HÌNH TÍNH ĐIỂM CHUẨN UTC
INSERT INTO "TERM_PARAMETER" (id, term_id, key, value, description) VALUES
  ('param-01', 'term-utc-k62', 'process_weight', '0.4', 'Trọng số điểm quá trình QT (40%)'),
  ('param-02', 'term-utc-k62', 'committee_weight', '0.6', 'Trọng số điểm hội đồng KTHP (60%)'),
  ('param-03', 'term-utc-k62', 'advisor_weight_in_process', '0.5', 'Trọng số GVHD trong điểm quá trình (50%)'),
  ('param-04', 'term-utc-k62', 'reviewer_weight_in_process', '0.5', 'Trọng số GVPB trong điểm quá trình (50%)'),
  ('param-05', 'term-utc-k62', 'min_pass_score', '5.0', 'Điểm đạt tối thiểu (thang 10)'),
  ('param-06', 'term-utc-k62', 'passing_gpa_threshold', '2.0', 'GPA tối thiểu để được làm đồ án')
ON CONFLICT (term_id, key) DO NOTHING;
