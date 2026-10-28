import type { Role } from "../../shared/data/types";
export interface RouteInfo {
  path: string;
  title: string;
  group: string;
  roles: Role[];
  menu?: boolean;
}
const M: Role[] = ["ADMIN", "FACULTY"];
const G: Role[] = [...M, "LECTURER"];
const A: Role[] = [...G, "STUDENT", "COMMITTEE"];
export const routeManifest: RouteInfo[] = [
  { path: "/", title: "Tổng quan", group: "Không gian làm việc", roles: A },
  {
    path: "/notifications",
    title: "Thông báo",
    group: "Không gian làm việc",
    roles: A,
  },
  {
    path: "/admin/accounts",
    title: "Tài khoản",
    group: "Quản trị hệ thống",
    roles: ["ADMIN"],
  },
  {
    path: "/admin/roles",
    title: "Vai trò & quyền",
    group: "Quản trị hệ thống",
    roles: ["ADMIN"],
  },
  {
    path: "/admin/audit-logs",
    title: "Nhật ký hoạt động",
    group: "Quản trị hệ thống",
    roles: M,
  },
  {
    path: "/catalog/students",
    title: "Sinh viên",
    group: "Danh mục & kế hoạch",
    roles: M,
  },
  {
    path: "/catalog/lecturers",
    title: "Giảng viên",
    group: "Danh mục & kế hoạch",
    roles: G,
  },
  {
    path: "/catalog/reference",
    title: "Danh mục đào tạo",
    group: "Danh mục & kế hoạch",
    roles: M,
  },
  {
    path: "/catalog/import",
    title: "Import dữ liệu",
    group: "Danh mục & kế hoạch",
    roles: M,
  },
  {
    path: "/terms",
    title: "Kỳ học & đợt đồ án",
    group: "Danh mục & kế hoạch",
    roles: M,
  },
  {
    path: "/terms/:id",
    title: "Chi tiết đợt",
    group: "Danh mục & kế hoạch",
    roles: M,
    menu: false,
  },
  {
    path: "/terms/:id/phases",
    title: "Kế hoạch giai đoạn",
    group: "Danh mục & kế hoạch",
    roles: M,
    menu: false,
  },
  {
    path: "/terms/:id/parameters",
    title: "Tham số đợt",
    group: "Danh mục & kế hoạch",
    roles: M,
    menu: false,
  },
  {
    path: "/terms/:id/roster",
    title: "Danh sách tham gia",
    group: "Danh mục & kế hoạch",
    roles: M,
    menu: false,
  },
  {
    path: "/registration",
    title: "Đăng ký nguyện vọng",
    group: "Đăng ký & đề cương",
    roles: ["STUDENT"],
  },
  {
    path: "/registration/assignment",
    title: "Phân công GVHD",
    group: "Đăng ký & đề cương",
    roles: M,
  },
  {
    path: "/registration/list",
    title: "Danh sách đăng ký",
    group: "Đăng ký & đề cương",
    roles: M,
  },
  {
    path: "/registration/manual",
    title: "Điều chỉnh phân công",
    group: "Đăng ký & đề cương",
    roles: M,
  },
  {
    path: "/registration/result",
    title: "Kết quả phân công",
    group: "Đăng ký & đề cương",
    roles: [...G, "STUDENT"],
  },
  {
    path: "/topic/my",
    title: "Đề tài đồ án",
    group: "Đăng ký & đề cương",
    roles: [...G, "STUDENT"],
  },
  {
    path: "/topic/draft",
    title: "Soạn đề cương",
    group: "Đăng ký & đề cương",
    roles: ["STUDENT", "LECTURER"],
  },
  {
    path: "/topic/overview",
    title: "Hồ sơ đề tài",
    group: "Đăng ký & đề cương",
    roles: A,
  },
  {
    path: "/report/export",
    title: "Biểu mẫu & xuất dữ liệu",
    group: "Báo cáo Bước 1–3",
    roles: A,
  },
  {
    path: "/profile",
    title: "Thông tin cá nhân",
    group: "Cá nhân",
    roles: A,
    menu: false,
  },
  {
    path: "/change-password",
    title: "Đổi mật khẩu",
    group: "Cá nhân",
    roles: A,
    menu: false,
  },
  ...[
    ["/topic/review-groups", "Nhóm duyệt đề cương", ["FACULTY", "LECTURER"]],
    ["/topic/review-groups/new", "Tạo nhóm duyệt", ["FACULTY"]],
    ["/topic/review-groups/:id/edit", "Sửa nhóm duyệt", ["FACULTY"]],
    [
      "/topic/review-groups/:id",
      "Chi tiết nhóm duyệt",
      ["FACULTY", "LECTURER"],
    ],
    [
      "/topic/reviews",
      "Xét duyệt đề cương",
      ["FACULTY", "LECTURER", "STUDENT"],
    ],
    [
      "/topic/reviews/:id",
      "Chi tiết xét duyệt",
      ["FACULTY", "LECTURER", "STUDENT"],
    ],
    [
      "/topic/review-assignments/:proposalId",
      "Phân công xét duyệt",
      ["FACULTY"],
    ],
    [
      "/topic/proposal",
      "Đề cương & phiên bản",
      ["FACULTY", "LECTURER", "STUDENT"],
    ],
    [
      "/topic/proposal/:proposalId",
      "Phiên bản đề cương",
      ["FACULTY", "LECTURER", "STUDENT"],
    ],
    [
      "/topic/proposal/:proposalId/versions/:versionId",
      "Lịch sử đề cương",
      ["FACULTY", "LECTURER", "STUDENT"],
    ],
    [
      "/topic/dossier",
      "Chốt đề cương & bản giấy",
      ["FACULTY", "LECTURER", "STUDENT"],
    ],
    [
      "/topic/dossier/:proposalId",
      "Chi tiết hồ sơ",
      ["FACULTY", "LECTURER", "STUDENT"],
    ],
    [
      "/guidance/plan",
      "Kế hoạch hướng dẫn",
      ["FACULTY", "LECTURER", "STUDENT"],
    ],
    [
      "/guidance/plan/:proposalId",
      "Chi tiết kế hoạch",
      ["FACULTY", "LECTURER", "STUDENT"],
    ],
    ["/guidance/plan/:proposalId/tasks/new", "Giao nhiệm vụ", ["LECTURER"]],
    [
      "/guidance/tasks",
      "Nhiệm vụ & tiến độ",
      ["FACULTY", "LECTURER", "STUDENT"],
    ],
    [
      "/guidance/tasks/:id",
      "Chi tiết nhiệm vụ",
      ["FACULTY", "LECTURER", "STUDENT"],
    ],
    [
      "/guidance/tasks/:id/submissions",
      "Nộp báo cáo",
      ["FACULTY", "LECTURER", "STUDENT"],
    ],
    ["/guidance/review", "Nhận xét báo cáo", ["LECTURER"]],
    ["/guidance/review/:submissionId", "Chi tiết nhận xét", ["FACULTY", "LECTURER", "STUDENT"]],
    ["/guidance/progress", "Theo dõi tiến độ", ["FACULTY"]],
    [
      "/guidance/meetings",
      "Nhật ký hướng dẫn",
      ["FACULTY", "LECTURER", "STUDENT"],
    ],
    [
      "/guidance/notifications",
      "Thông báo hướng dẫn",
      ["FACULTY", "LECTURER", "STUDENT"],
    ],
    [
      "/guidance/defense-confirm",
      "Xác nhận bảo vệ",
      ["FACULTY", "LECTURER", "STUDENT"],
    ],
    [
      "/guidance/final-report",
      "Báo cáo cuối kỳ",
      ["FACULTY", "LECTURER", "STUDENT"],
    ],
  ].map(([path, title, roles]) => ({
    path: path as string,
    title: title as string,
    roles: roles as Role[],
    group: "Xét duyệt & hướng dẫn",
    menu: !(path as string).includes(":") && !(path as string).endsWith("/new"),
  })),
];
