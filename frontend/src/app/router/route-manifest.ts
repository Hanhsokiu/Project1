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
    path: "/topic/proposal",
    title: "Soạn đề cương",
    group: "Đăng ký & đề cương",
    roles: ["STUDENT", "LECTURER"],
  },
  {
    path: "/topic/dossier",
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
];
