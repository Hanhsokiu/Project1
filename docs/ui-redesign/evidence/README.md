# Bằng chứng audit

Ngày 15/11/2026. [Tổng hợp](../01-ui-audit.md), [inventory](../02-route-inventory.md), [machine-readable ledger](browser-audit.json), [router source](route-source.json), [kiểm tra cuối](verification.json).

Ảnh là baseline hiện trạng, không phải thiết kế mới. `đã quan sát` chỉ nói nội dung tại thời điểm chụp; loading/error cũng được lưu nhưng không chứng minh màn nghiệp vụ đã kiểm tra. Không có nội dung response, token, headers xác thực hoặc thông tin đăng nhập. Nhãn GV xét duyệt và GVHD phân biệt hai phiên giảng viên. ID trong path đều lấy từ dữ liệu thật; UUID không phải credential.

Viewport là cửa sổ dùng khi chụp; phần lớn ảnh full-page nên kích thước ảnh có thể khác chiều cao viewport. Ba ảnh axe là viewport-only sau layout ổn định. Các số đo ban đầu có thể chịu ảnh hưởng animation/layout chuyển breakpoint; xem lần hậu kiểm trong interactions.

## Các lượt quan sát

| Mã | Route | Vai trò | Viewport | Thời điểm UTC | Trạng thái | Ảnh |
|---|---|---|---|---|---|---|
| E001 | R26 · `/` | STUDENT | 1440×900 | 2026-11-15T12:37:22.778Z | bị chặn (đang tải) | [PNG](student-dashboard-1440.png) |
| E002 | R26 · `/` | GV xét duyệt | 1440×900 | 2026-11-15T12:37:41.280Z | bị chặn (đang tải) | [PNG](lecturer-dashboard-1440.png) |
| E003 | R34 · `/terms` | FACULTY | 1440×900 | 2026-11-15T12:37:59.878Z | bị chặn (đang tải) | [PNG](faculty-terms-1440.png) |
| E004 | R26 · `/` | STUDENT | 1440×900 | 2026-11-15T12:42:09.701Z | đã quan sát | [PNG](student-dashboard-1440-4.png) |
| E005 | R26 · `/` | GV xét duyệt | 1440×900 | 2026-11-15T12:42:10.058Z | đã quan sát | [PNG](lecturer-dashboard-1440-5.png) |
| E006 | R34 · `/terms` | FACULTY | 1440×900 | 2026-11-15T12:42:10.431Z | đã quan sát | [PNG](faculty-terms-1440-6.png) |
| E007 | R39 · `/registration?termId=cf40d4f4-6c49-490a-a361-4e2719ee40b2` | STUDENT | 1440×900 | 2026-11-15T12:42:21.503Z | bị chặn (đang tải) | [PNG](student-registration-1440-7.png) |
| E008 | R10 · `/guidance/tasks?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | STUDENT | 1440×900 | 2026-11-15T12:42:21.733Z | bị chặn (đang tải) | [PNG](student-tasks-1440-8.png) |
| E009 | R02 · `/guidance/review?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | GV xét duyệt | 1440×900 | 2026-11-15T12:42:21.916Z | bị chặn (đang tải) | [PNG](lecturer-review-1440-9.png) |
| E010 | R21 · `/topic/review-groups?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | FACULTY | 1440×900 | 2026-11-15T12:42:22.135Z | bị chặn (đang tải) | [PNG](faculty-groups-1440-10.png) |
| E011 | R39 · `/registration?termId=cf40d4f4-6c49-490a-a361-4e2719ee40b2` | STUDENT | 1440×900 | 2026-11-15T12:42:58.603Z | đã quan sát | [PNG](student-registration-1440-11.png) |
| E012 | R10 · `/guidance/tasks?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | STUDENT | 1440×900 | 2026-11-15T12:42:59.303Z | đã quan sát | [PNG](student-tasks-1440-12.png) |
| E013 | R11 · `/guidance/tasks/3873b769-e270-476c-be1f-b807cc6d6f1a?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | STUDENT | 1440×900 | 2026-11-15T12:43:12.514Z | đã quan sát | [PNG](student-task-detail-1440-13.png) |
| E014 | R21 · `/topic/review-groups?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | FACULTY | 1440×900 | 2026-11-15T12:43:12.728Z | đã quan sát | [PNG](faculty-groups-1440-14.png) |
| E015 | R12 · `/guidance/tasks/3873b769-e270-476c-be1f-b807cc6d6f1a/submissions?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | STUDENT | 1440×900 | 2026-11-15T12:43:31.314Z | đã quan sát | [PNG](student-submissions-1440-15.png) |
| E016 | R08 · `/guidance/plan/fe97acad-7567-481d-99ff-8ab07feb6a8d?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | STUDENT | 1440×900 | 2026-11-15T12:43:38.314Z | đã quan sát | [PNG](student-plan-detail-1440-16.png) |
| E017 | R18 · `/topic/reviews?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | FACULTY | 1440×900 | 2026-11-15T12:43:45.137Z | đã quan sát | [PNG](faculty-proposal-reviews-1440-17.png) |
| E018 | R15 · `/topic/proposal?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | FACULTY | 1440×900 | 2026-11-15T12:43:53.540Z | đã quan sát | [PNG](faculty-proposal-list-1440-18.png) |
| E019 | R24 · `/topic/review-groups/4d9d8861-301a-45c0-a4c6-1372f4bfa623?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | FACULTY | 1440×900 | 2026-11-15T12:44:11.583Z | đã quan sát | [PNG](faculty-group-detail-1440-19.png) |
| E020 | R22 · `/topic/review-groups/new?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | FACULTY | 1440×900 | 2026-11-15T12:44:15.892Z | đã quan sát | [PNG](faculty-group-create-1440-20.png) |
| E021 | R23 · `/topic/review-groups/4d9d8861-301a-45c0-a4c6-1372f4bfa623/edit?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | FACULTY | 1440×900 | 2026-11-15T12:44:16.530Z | đã quan sát | [PNG](faculty-group-edit-1440-21.png) |
| E022 | R16 · `/topic/proposal/f797923f-4e1a-4c08-80ee-213d874ccf6e?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | STUDENT | 1440×900 | 2026-11-15T12:44:21.829Z | đã quan sát | [PNG](student-proposal-edit-1440-22.png) |
| E023 | R04 · `/guidance/progress?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | FACULTY | 1440×900 | 2026-11-15T12:45:01.503Z | bị chặn (đang tải) | [PNG](faculty-progress-1440-23.png) |
| E024 | R02 · `/guidance/review?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | GV xét duyệt | 1440×900 | 2026-11-15T12:45:01.694Z | đã quan sát | [PNG](lecturer-review-1440-24.png) |
| E025 | R01 · `/guidance/weeks?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | STUDENT | 1440×900 | 2026-11-15T12:45:11.846Z | đã quan sát | [PNG](student-weeks-1440-25.png) |
| E026 | R13 · `/topic/dossier?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | FACULTY | 1440×900 | 2026-11-15T12:45:22.344Z | đã quan sát | [PNG](faculty-dossier-list-1440-26.png) |
| E027 | R35 · `/terms/cf40d4f4-6c49-490a-a361-4e2719ee40b2` | FACULTY | 1440×900 | 2026-11-15T12:45:39.316Z | đã quan sát | [PNG](faculty-term-detail-1440-27.png) |
| E028 | R36 · `/terms/cf40d4f4-6c49-490a-a361-4e2719ee40b2/phases` | FACULTY | 1440×900 | 2026-11-15T12:45:40.270Z | đã quan sát | [PNG](faculty-phases-1440-28.png) |
| E029 | R37 · `/terms/cf40d4f4-6c49-490a-a361-4e2719ee40b2/parameters` | FACULTY | 1440×900 | 2026-11-15T12:45:40.961Z | đã quan sát | [PNG](faculty-parameters-1440-29.png) |
| E030 | R38 · `/terms/cf40d4f4-6c49-490a-a361-4e2719ee40b2/roster` | FACULTY | 1440×900 | 2026-11-15T12:45:41.860Z | đã quan sát | [PNG](faculty-roster-1440-30.png) |
| E031 | R30 · `/catalog/students` | FACULTY | 1440×900 | 2026-11-15T12:45:57.072Z | đã quan sát | Không giữ ảnh có liên hệ ngoài mẫu |
| E032 | R31 · `/catalog/lecturers` | FACULTY | 1440×900 | 2026-11-15T12:45:58.017Z | đã quan sát | Không giữ ảnh có liên hệ ngoài mẫu |
| E033 | R32 · `/catalog/import` | FACULTY | 1440×900 | 2026-11-15T12:45:58.815Z | đã quan sát | [PNG](faculty-import-1440-33.png) |
| E034 | R33 · `/catalog/reference` | FACULTY | 1440×900 | 2026-11-15T12:45:59.459Z | đã quan sát | [PNG](faculty-catalog-1440-34.png) |
| E035 | R40 · `/registration/list?termId=cf40d4f4-6c49-490a-a361-4e2719ee40b2` | FACULTY | 1440×900 | 2026-11-15T12:46:00.177Z | đã quan sát | [PNG](faculty-registration-list-1440-35.png) |
| E036 | R41 · `/registration/assignment?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | FACULTY | 1440×900 | 2026-11-15T12:46:01.129Z | đã quan sát | [PNG](faculty-assignment-1440-36.png) |
| E037 | R43 · `/registration/manual?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | FACULTY | 1440×900 | 2026-11-15T12:46:14.116Z | đã quan sát | [PNG](faculty-manual-1440-37.png) |
| E038 | R42 · `/registration/result?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | STUDENT | 1440×900 | 2026-11-15T12:46:14.671Z | đã quan sát | [PNG](student-result-1440-38.png) |
| E039 | R44 · `/topic/my?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | STUDENT | 1440×900 | 2026-11-15T12:46:15.240Z | đã quan sát | [PNG](student-my-topic-1440-39.png) |
| E040 | R45 · `/topic/draft?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | STUDENT | 1440×900 | 2026-11-15T12:46:15.880Z | đã quan sát | [PNG](student-draft-1440-40.png) |
| E041 | R46 · `/topic/overview?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | STUDENT | 1440×900 | 2026-11-15T12:46:16.540Z | đã quan sát | [PNG](student-overview-1440-41.png) |
| E042 | R17 · `/topic/proposal/f797923f-4e1a-4c08-80ee-213d874ccf6e/versions/ec305310-fb9e-4e61-a341-972872ad9bb0?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | STUDENT | 1440×900 | 2026-11-15T12:46:20.953Z | đã quan sát | [PNG](student-version-1440-42.png) |
| E043 | R14 · `/topic/dossier/c9fd250b-1721-48cc-80c6-68efa3a0359e?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | FACULTY | 1440×900 | 2026-11-15T12:46:38.431Z | đã quan sát | [PNG](faculty-dossier-detail-1440-43.png) |
| E044 | R20 · `/topic/review-assignments/869d227c-bc06-4194-8960-6321ca252c31?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | FACULTY | 1440×900 | 2026-11-15T12:46:43.826Z | đã quan sát | [PNG](faculty-review-assignment-1440-44.png) |
| E045 | R19 · `/topic/reviews/a4e2af69-3190-4293-869a-47b571abf99d?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | GV xét duyệt | 1440×900 | 2026-11-15T12:46:52.364Z | đã quan sát | [PNG](lecturer-proposal-review-detail-1440-45.png) |
| E046 | R03 · `/guidance/review/fa57d781-f04c-44e3-8490-72458cbbffec?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | STUDENT | 1440×900 | 2026-11-15T12:46:54.990Z | đã quan sát | [PNG](student-review-detail-1440-46.png) |
| E047 | R05 · `/guidance/meetings?planId=2e396ebc-0849-4af5-a76f-7ccc80c880ae&termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | STUDENT | 1440×900 | 2026-11-15T12:47:01.571Z | đã quan sát | [PNG](student-meetings-1440-47.png) |
| E048 | R03 · `/guidance/review/fa57d781-f04c-44e3-8490-72458cbbffec?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | GVHD | 1440×900 | 2026-11-15T12:47:44.676Z | đã quan sát | [PNG](lecturer-review-detail-advisor-1440-48.png) |
| E049 | R09 · `/guidance/plan/fe97acad-7567-481d-99ff-8ab07feb6a8d/tasks/new?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | GVHD | 1440×900 | 2026-11-15T12:47:52.774Z | đã quan sát | [PNG](lecturer-task-create-1440-49.png) |
| E050 | R07 · `/guidance/plan?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | GVHD | 1440×900 | 2026-11-15T12:47:57.711Z | đã quan sát | [PNG](lecturer-plans-1440-50.png) |
| E051 | R04 · `/guidance/progress?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | FACULTY | 1440×900 | 2026-11-15T12:48:18.332Z | bị chặn (đang tải) | [PNG](faculty-progress-final-1440-51.png) |
| E052 | R49 · `/defense/eligibility?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | FACULTY | 1440×900 | 2026-11-15T12:48:55.710Z | bị chặn (đang tải) | [PNG](faculty-eligibility-1440-52.png) |
| E053 | R52 · `/defense/committees?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | FACULTY | 1440×900 | 2026-11-15T12:48:56.224Z | bị chặn | [PNG](faculty-committees-1440-53.png) |
| E054 | R53 · `/defense/reviewers?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | FACULTY | 1440×900 | 2026-11-15T12:48:56.743Z | bị chặn | [PNG](faculty-reviewers-1440-54.png) |
| E055 | R54 · `/defense/schedule?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | FACULTY | 1440×900 | 2026-11-15T12:48:57.240Z | bị chặn | [PNG](faculty-schedule-1440-55.png) |
| E056 | R55 · `/defense/committee-grading?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | FACULTY | 1440×900 | 2026-11-15T12:49:28.744Z | bị chặn | [PNG](faculty-committee-grading-1440-56.png) |
| E057 | R56 · `/defense/reviewer-grading?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | FACULTY | 1440×900 | 2026-11-15T12:49:29.304Z | bị chặn | [PNG](faculty-reviewer-grading-1440-57.png) |
| E058 | R50 · `/defense/results?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | FACULTY | 1440×900 | 2026-11-15T12:49:29.871Z | bị chặn | [PNG](faculty-defense-results-1440-58.png) |
| E059 | R51 · `/defense/reports?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | FACULTY | 1440×900 | 2026-11-15T12:49:30.405Z | bị chặn | [PNG](faculty-defense-reports-1440-59.png) |
| E060 | R47 · `/guidance/defense-confirm?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | GVHD | 1440×900 | 2026-11-15T12:49:50.501Z | đã quan sát | [PNG](lecturer-defense-confirm-1440-60.png) |
| E061 | R48 · `/guidance/final-report?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | STUDENT | 1440×900 | 2026-11-15T12:50:11.195Z | bị chặn (đang tải) | [PNG](student-final-report-1440-61.png) |
| E062 | R48 · `/guidance/final-report?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | STUDENT | 1440×900 | 2026-11-15T13:02:43.125Z | đã quan sát | [PNG](student-final-report-1440-62.png) |
| E063 | R06 · `/guidance/notifications?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | STUDENT | 1440×900 | 2026-11-15T13:02:47.576Z | đã quan sát | [PNG](student-guidance-notifications-1440-63.png) |
| E064 | R58 · `/profile` | STUDENT | 1440×900 | 2026-11-15T13:02:48.235Z | đã quan sát | [PNG](student-profile-1440-64.png) |
| E065 | R59 · `/change-password` | STUDENT | 1440×900 | 2026-11-15T13:02:48.790Z | đã quan sát | [PNG](student-password-1440-65.png) |
| E066 | R60 · `/notifications` | STUDENT | 1440×900 | 2026-11-15T13:03:04.565Z | đã quan sát | [PNG](student-notifications-1440-66.png) |
| E067 | R61 · `/forbidden` | STUDENT | 1440×900 | 2026-11-15T13:03:05.172Z | đã quan sát | [PNG](student-forbidden-1440-67.png) |
| E068 | R62 · `/audit-nonexistent-page` | STUDENT | 1440×900 | 2026-11-15T13:03:05.697Z | bị chặn | [PNG](student-not-found-1440-68.png) |
| E069 | R29 · `/admin/audit-logs` | FACULTY | 1440×900 | 2026-11-15T13:03:06.212Z | bị chặn | [PNG](faculty-audit-logs-1440-69.png) |
| E070 | R57 · `/report/export` | FACULTY | 1440×900 | 2026-11-15T13:03:06.715Z | bị chặn | [PNG](faculty-export-1440-70.png) |
| E071 | R39 · `/registration?termId=cf40d4f4-6c49-490a-a361-4e2719ee40b2` | STUDENT | 390×844 | 2026-11-15T13:03:35.903Z | bị chặn | [PNG](student-registration-reflow-390-71.png) |
| E072 | R39 · `/registration?termId=cf40d4f4-6c49-490a-a361-4e2719ee40b2` | STUDENT | 320×844 | 2026-11-15T13:03:35.965Z | bị chặn | [PNG](student-registration-reflow-320-72.png) |
| E073 | R39 · `/registration?termId=cf40d4f4-6c49-490a-a361-4e2719ee40b2` | STUDENT | 768×1024 | 2026-11-15T13:03:36.078Z | bị chặn | [PNG](student-registration-reflow-768-73.png) |
| E074 | R03 · `/guidance/review/fa57d781-f04c-44e3-8490-72458cbbffec?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | GVHD | 390×844 | 2026-11-15T13:03:51.136Z | đã quan sát | [PNG](lecturer-review-detail-advisor-reflow-390-74.png) |
| E075 | R03 · `/guidance/review/fa57d781-f04c-44e3-8490-72458cbbffec?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | GVHD | 320×844 | 2026-11-15T13:03:51.256Z | đã quan sát | [PNG](lecturer-review-detail-advisor-reflow-320-75.png) |
| E076 | R03 · `/guidance/review/fa57d781-f04c-44e3-8490-72458cbbffec?termId=01649c80-d8e1-4393-a8a5-29d585eb4ef6` | GVHD | 768×1024 | 2026-11-15T13:03:51.480Z | đã quan sát | [PNG](lecturer-review-detail-advisor-reflow-768-76.png) |
| E077 | R34 · `/terms` | FACULTY | 390×844 | 2026-11-15T13:03:51.595Z | bị chặn | [PNG](faculty-terms-reflow-390-77.png) |
| E078 | R34 · `/terms` | FACULTY | 320×844 | 2026-11-15T13:03:51.674Z | bị chặn | [PNG](faculty-terms-reflow-320-78.png) |
| E079 | R34 · `/terms` | FACULTY | 768×1024 | 2026-11-15T13:03:51.760Z | bị chặn | [PNG](faculty-terms-reflow-768-79.png) |
| E080 | R25 · `/login` | ANON | 1440×900 | 2026-11-15T13:05:06.804Z | đã quan sát | [PNG](anon-login-1440-80.png) |
| E081 | R25 · `/login` | ANON | 390×844 | 2026-11-15T13:05:21.105Z | đã quan sát | [PNG](anon-login-reflow-390-81.png) |
| E082 | R25 · `/login` | ANON | 320×844 | 2026-11-15T13:05:21.193Z | đã quan sát | [PNG](anon-login-reflow-320-82.png) |
| E083 | R25 · `/login` | ANON | 768×1024 | 2026-11-15T13:05:21.476Z | đã quan sát | [PNG](anon-login-reflow-768-83.png) |
| E084 | R21 · `/topic/review-groups?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | FACULTY | 390×844 | 2026-11-15T13:06:31.470Z | bị chặn (đang tải) | [PNG](faculty-groups-mobile-390-84.png) |
| E085 | R22 · `/topic/review-groups/new?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | FACULTY | 390×844 | 2026-11-15T13:06:36.378Z | đã quan sát | [PNG](faculty-group-create-mobile-390-85.png) |
| E086 | R18 · `/topic/reviews?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | FACULTY | 390×844 | 2026-11-15T13:06:49.144Z | đã quan sát | [PNG](faculty-proposal-reviews-mobile-390-86.png) |
| E087 | R13 · `/topic/dossier?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | FACULTY | 390×844 | 2026-11-15T13:06:59.027Z | đã quan sát | [PNG](faculty-dossier-list-mobile-390-87.png) |
| E088 | R15 · `/topic/proposal?termId=b2c1a53f-b94a-4f90-a95a-c4257bf09b4b` | FACULTY | 390×844 | 2026-11-15T13:07:13.142Z | đã quan sát | [PNG](faculty-proposal-list-mobile-390-88.png) |
| E089 | R26 · `/` | STUDENT | 390×844 | 2026-11-15T13:10:48.312Z | đã quan sát | [PNG](student-dashboard-reflow-390-89.png) |
| E090 | R39 · `/registration?termId=cf40d4f4-6c49-490a-a361-4e2719ee40b2` | STUDENT | 390×844 | 2026-11-15T13:10:59.970Z | đã quan sát | [PNG](student-registration-retry-390-90.png) |
| E091 | R39 · `/registration?termId=cf40d4f4-6c49-490a-a361-4e2719ee40b2` | STUDENT | 320×844 | 2026-11-15T13:11:00.167Z | đã quan sát | [PNG](student-registration-retry-320-91.png) |
| E092 | R39 · `/registration?termId=cf40d4f4-6c49-490a-a361-4e2719ee40b2` | STUDENT | 768×1024 | 2026-11-15T13:11:00.558Z | đã quan sát | [PNG](student-registration-retry-768-92.png) |
| E093 | R34 · `/terms` | FACULTY | 390×844 | 2026-11-15T13:11:02.335Z | bị chặn | [PNG](faculty-terms-retry-390-93.png) |
| E094 | R26 · `/?termId=cf40d4f4-6c49-490a-a361-4e2719ee40b2` | STUDENT | 320×844 | 2026-11-15T13:12:27.010Z | bị chặn | [PNG](student-dashboard-reflow-320-94.png) |
| E095 | R26 · `/?termId=cf40d4f4-6c49-490a-a361-4e2719ee40b2` | STUDENT | 768×1024 | 2026-11-15T13:12:27.101Z | bị chặn | [PNG](student-dashboard-reflow-768-95.png) |
| E096 | R34 · `/terms` | FACULTY | 390×844 | 2026-11-15T13:12:27.152Z | bị chặn | [PNG](faculty-terms-final-390-96.png) |
| E097 | R34 · `/terms` | STUDENT | 390×844 | 2026-11-15T13:12:27.655Z | bị chặn | [PNG](student-denied-terms-390-97.png) |
| E098 | R02 · `/guidance/review` | STUDENT | 390×844 | 2026-11-15T13:12:28.194Z | bị chặn | [PNG](student-denied-review-390-98.png) |
| E099 | R26 · `/` | FACULTY | 1440×900 | 2026-11-15T12:36:13Z | đã quan sát | [PNG](faculty-dashboard-desktop.png) |

## Kiểm tra tương tác và accessibility

Chi tiết từng bước và kết quả trong `interactions` của browser-audit.json. Mở menu/modal và tìm kiếm không ghi dữ liệu nghiệp vụ. Các lần click nút Thử lại chỉ gọi lại tải dữ liệu. Không kết luận empty từ loading.

| Kiểm tra | Route / role | Thời điểm UTC | Bằng chứng |
|---|---|---|---|
| Retry global DataBoundary after timeout | /defense/schedule · FACULTY | 2026-11-15T12:49:16.440Z | [JSON](browser-audit.json) |
| mobile-review-reflow-and-tab | Xem JSON · LECTURER | 2026-11-15T13:04:49.112Z | [JSON](browser-audit.json) |
| mobile-menu-keyboard-reduced-motion | Xem JSON · LECTURER | 2026-11-15T13:05:04.688Z | [JSON](browser-audit.json) |
| login-reflow-forgot | Xem JSON · ANON | 2026-11-15T13:05:21.593Z | [JSON](browser-audit.json) |
| login-empty-local-validation | Xem JSON · ANON | 2026-11-15T13:05:41.803Z | [JSON](browser-audit.json) |
| proposal-search-clear | Xem JSON · FACULTY | 2026-11-15T13:09:56.284Z | [JSON](browser-audit.json) |
| sample-computed-text-contrast | /topic/proposal · FACULTY | 2026-11-15T13:09:56.297Z | [JSON](browser-audit.json) |
| axe-real-page | /login · ANON | 2026-11-15T13:10:32.488Z | [PNG](anon-accessibility-390.png) |
| axe-real-page | /guidance/review/fa57d781-f04c-44e3-8490-72458cbbffec · LECTURER | 2026-11-15T13:10:33.810Z | [PNG](lecturer-accessibility-390.png) |
| axe-real-page | /topic/proposal · FACULTY | 2026-11-15T13:10:35.323Z | [PNG](faculty-accessibility-390.png) |

## Dữ liệu mạng và giới hạn

`events` chỉ chứa path/phương thức/status/thời điểm của các request lỗi (có thể lặp do refetch). `console` chỉ root context, không phải mọi phiên. `sessionPermissions` chỉ role/permission và cờ bắt buộc đổi mật khẩu; không lưu hồ sơ người dùng/token. Không có bằng chứng xác định nguyên nhân backend hay benchmark hiệu năng.

Ảnh danh mục sinh viên/giảng viên có liên hệ ngoài bộ mẫu đã được loại bỏ; vẫn ghi nhận lượt đã mở và kết luận code/UI phù hợp, không dùng ảnh đó làm bằng chứng visual công khai. Dữ liệu học vụ mẫu còn lại không dùng làm mock thay API.
