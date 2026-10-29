import type { Account, Role } from "../../shared/data/types";
export interface RouteInfo {
  path: string;
  title: string;
  group: string;
  roles: Role[];
  menu?: boolean;
  permission?: string;
  menuRoles?: Role[];
  roleTitles?: Partial<Record<Role, string>>;
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
    title: "Thống nhất đề tài",
    group: "Đăng ký & đề cương",
    roles: [...G, "STUDENT"],
  },
  {
    path: "/topic/draft",
    title: "Soạn đề cương",
    group: "Đăng ký & đề cương",
    roles: ["STUDENT", "LECTURER"],
    menu: false,
  },
  {
    path: "/topic/overview",
    title: "Hồ sơ đề tài",
    group: "Đăng ký & đề cương",
    roles: A,
    menu: false,
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
    [
      "/guidance/review/:submissionId",
      "Chi tiết nhận xét",
      ["FACULTY", "LECTURER", "STUDENT"],
    ],
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
    group: (path as string).startsWith("/topic/")
      ? "Đề cương & xét duyệt"
      : "Hướng dẫn đồ án",
    permission: workflowPermission(path as string),
    ...workflowPresentation(path as string),
    menu:
      !(path as string).includes(":") &&
      !(path as string).endsWith("/new") &&
      path !== "/guidance/notifications",
  })),
];

function workflowPermission(path: string): string | undefined {
  if (path.startsWith("/topic/review-groups"))
    return path.endsWith("/new") || path.endsWith("/edit")
      ? "review-group:manage"
      : "review-group:read";
  if (path.startsWith("/topic/review-assignments")) return "proposal:assign";
  if (path.startsWith("/topic/")) return "proposal:read";
  if (path.endsWith("/tasks/new")) return "task:manage";
  if (path === "/guidance/review") return "task:review";
  if (path.startsWith("/guidance/review/")) return "submission:read";
  if (path === "/guidance/progress") return "guidance:monitor";
  if (path === "/guidance/defense-confirm" || path === "/guidance/final-report")
    return undefined;
  if (path.includes("/submissions")) return "submission:read";
  if (path.startsWith("/guidance/")) return "guidance:read";
}

function workflowPresentation(path: string): Partial<RouteInfo> {
  switch (path) {
    case "/topic/review-groups":
      return { roleTitles: { LECTURER: "Nhóm duyệt của tôi" } };
    case "/topic/reviews":
      return {
        roleTitles: {
          FACULTY: "Phân công & xét duyệt",
          LECTURER: "Đề cương cần xét duyệt",
          STUDENT: "Kết quả xét duyệt",
        },
      };
    case "/topic/proposal":
      return {
        roleTitles: {
          STUDENT: "Đề cương của tôi",
          LECTURER: "Đề cương sinh viên",
          FACULTY: "Tra cứu đề cương",
        },
      };
    case "/topic/dossier":
      return {
        roleTitles: {
          STUDENT: "Hồ sơ & bản in",
          LECTURER: "Hồ sơ sinh viên",
          FACULTY: "Chốt hồ sơ & nhận bản giấy",
        },
      };
    case "/guidance/plan":
      return {
        roleTitles: {
          STUDENT: "Kế hoạch của tôi",
          LECTURER: "Kế hoạch hướng dẫn",
        },
        menuRoles: ["LECTURER", "STUDENT"],
      };
    case "/guidance/tasks":
      return {
        roleTitles: {
          STUDENT: "Nhiệm vụ & nộp báo cáo",
          LECTURER: "Nhiệm vụ sinh viên",
        },
        menuRoles: ["LECTURER", "STUDENT"],
      };
    case "/guidance/meetings":
      // Open from a plan, which supplies the required planId.
      return { menuRoles: [] };
    case "/guidance/defense-confirm":
    case "/guidance/final-report":
      // These legacy screens use browser demo storage, not the step 4–8 APIs.
      return { menuRoles: [] };
    default:
      return {};
  }
}

// API permissions are authoritative; demo accounts have no permission snapshot.
export function canAccessRoute(
  route: RouteInfo,
  user: Pick<Account, "roles" | "permissions">,
  api: boolean,
) {
  return (
    route.roles.some((role) => user.roles.includes(role)) &&
    (!api ||
      !route.permission ||
      !!user.permissions?.includes(route.permission))
  );
}

export function navigationRoutes(
  user: Pick<Account, "roles" | "permissions">,
  api: boolean,
) {
  return routeManifest.filter(
    (route) =>
      route.menu !== false &&
      canAccessRoute(route, user, api) &&
      (!route.menuRoles ||
        route.menuRoles.some((role) => user.roles.includes(role))),
  );
}

export function routeTitle(route: RouteInfo, user: Pick<Account, "roles">) {
  const role = user.roles.find((role) => route.roleTitles?.[role]);
  return (role && route.roleTitles?.[role]) || route.title;
}
