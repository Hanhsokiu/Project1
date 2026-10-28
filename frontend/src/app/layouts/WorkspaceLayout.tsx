import { AUTH_API } from "../../shared/api/api-session";
import { useEffect, useState } from "react";
import {
  Link,
  matchPath,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Bell,
  BookOpen,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  Home,
  Layers,
  LogOut,
  Menu,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { routeManifest } from "../router/route-manifest";
import {
  DataBoundary,
  Person,
  Confirm,
  labels,
  Notice,
} from "../../shared/components/kit";
import { currentUser, resetDemo } from "../../shared/data/store";
import {
  WorkspaceProvider,
  useWorkspace,
} from "../../shared/hooks/use-workspace";
import { authService } from "../../features/auth/services/auth-service";
export default function WorkspaceLayout() {
  const location = useLocation();
  return (
    <DataBoundary>
      {(db) => {
        const user = currentUser(db);
        if (!user)
          return (
            <Navigate to="/login" state={{ from: location.pathname }} replace />
          );
        if (user.mustChangePassword && location.pathname !== "/change-password")
          return <Navigate to="/change-password" replace />;
        if (
          AUTH_API &&
          user.studentId &&
          !user.mustChangePassword &&
          !user.profileComplete &&
          !["/profile", "/change-password"].includes(location.pathname)
        )
          return <Navigate to="/profile" replace />;
        return (
          <WorkspaceProvider>
            <Shell />
          </WorkspaceProvider>
        );
      }}
    </DataBoundary>
  );
}
function Shell() {
  const { db, user, termId, setTermId } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [mobile, setMobile] = useState(false);
  const [reset, setReset] = useState(false);
  useEffect(() => setMobile(false), [location.pathname]);
  const routes = routeManifest.filter(
    (r) =>
      r.menu !== false && r.roles.some((role) => user.roles.includes(role)),
  );
  const groups = [...new Set(routes.map((r) => r.group))];
  const active = routeManifest.find((r) =>
    matchPath({ path: r.path, end: true }, location.pathname),
  );
  const icons = [
    Home,
    ShieldCheck,
    Users,
    ClipboardList,
    BookOpen,
    GraduationCap,
    FileText,
  ];
  const isDemo =
    !AUTH_API &&
    (import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === "true");
  return (
    <div className="app-shell">
      <button
        aria-label="Đóng điều hướng"
        className={`sidebar-shade ${mobile ? "open" : ""}`}
        onClick={() => setMobile(false)}
      />
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <Link to="/" className="brand">
          <span className="brand-mark">
            <GraduationCap size={26} />
          </span>
          <div>
            <strong>KHOA CNTT – UTC</strong>
            <small>GPMS Portal</small>
          </div>
        </Link>
        <div className="sidebar-context">
          <Layers size={18} className="text-blue-500" />
          <div>
            <small>Không gian làm việc</small>
            <strong>Khoa Công nghệ thông tin</strong>
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="Điều hướng chính">
          {groups.map((group, i) => {
            const Icon = icons[i % icons.length];
            return (
              <div className="nav-group" key={group}>
                <p className="nav-group-title">{group}</p>
                {routes
                  .filter((r) => r.group === group)
                  .map((r) => (
                    <NavLink
                      key={r.path}
                      to={r.path}
                      end
                      className={({ isActive }) =>
                        `nav-item ${isActive ? "active" : ""}`
                      }
                    >
                      <Icon />
                      <span>{r.title}</span>
                    </NavLink>
                  ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer flex items-center justify-between">
          <Link to="/profile">
            <Person
              name={user.name}
              sub={user.roles.map((r) => labels[r]).join(" · ")}
            />
          </Link>
          <button
            title="Đăng xuất"
            aria-label="Đăng xuất"
            className="icon-btn"
            onClick={async () => {
              try {
                await authService.logout();
              } catch {
                // Logout clears the browser session even when the API is unavailable.
              }
              await cache.invalidateQueries({ queryKey: ["demo"] });
              navigate("/login");
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            aria-label="Mở điều hướng"
            onClick={() => setMobile(true)}
          >
            <Menu size={22} />
          </button>
          <div className="topbar-title">
            UTC GPMS Portal <ChevronRight size={13} />
            <b>{active?.title || "Trang không tồn tại"}</b>
          </div>
          <div className="topbar-controls">
            <select
              className="term-picker"
              aria-label="Đợt làm việc"
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
            >
              {db.terms
                .filter(
                  (t) =>
                    !user.studentId || t.studentIds.includes(user.studentId),
                )
                .map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.code} · {t.program}
                  </option>
                ))}
            </select>
            <span className="topbar-divider" />
            <Link
              to="/notifications"
              aria-label="Thông báo"
              className="icon-btn"
            >
              <Bell size={19} />
              {db.notifications.some(
                (n) => n.userId === user.id && !n.read,
              ) && <span className="notification-dot" />}
            </Link>
            <Link
              to="/profile"
              aria-label="Thông tin cá nhân"
              className="hidden lg:flex"
            >
              <Person
                name={user.name}
                sub={user.roles.map((r) => labels[r]).join(" · ")}
              />
            </Link>
            <Link
              to="/profile"
              aria-label="Mở hồ sơ"
              className="avatar lg:hidden"
            >
              {user.name
                .split(" ")
                .slice(-2)
                .map((s) => s[0])
                .join("")}
            </Link>
          </div>
        </header>
        <main className="page-content" key={`${termId}-${user.id}`}>
          {db.academicAccessWarnings?.length ? (
            <Notice tone="warning">
              {db.academicAccessWarnings.join(" ")}
            </Notice>
          ) : null}
          <Outlet />
        </main>
      </div>
      {isDemo && (
        <div className="demo-control">
          <span>
            <Sparkles size={13} /> DEMO
          </span>
          <select
            aria-label="Tài khoản demo"
            value={user.id}
            onChange={async (e) => {
              authService.demoLogin(e.target.value);
              await cache.invalidateQueries({ queryKey: ["demo"] });
              navigate("/");
            }}
          >
            {db.accounts
              .filter((a) => !a.locked)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.roles.map((r) => labels[r]).join("/")}
                </option>
              ))}
          </select>
          <button
            aria-label="Mô phỏng lỗi tải dữ liệu"
            title="Mô phỏng lỗi tải dữ liệu"
            className="icon-btn demo-secondary"
            onClick={() => {
              sessionStorage.setItem("utc-demo-error", "1");
              cache.invalidateQueries({ queryKey: ["demo"] });
            }}
          >
            <Activity size={15} />
          </button>
          <button
            aria-label="Đặt lại dữ liệu demo"
            title="Đặt lại dữ liệu demo"
            className="icon-btn"
            onClick={() => setReset(true)}
          >
            <RotateCcw size={15} />
          </button>
        </div>
      )}
      {reset && (
        <Confirm
          title="Đặt lại dữ liệu demo?"
          description="Xóa các thay đổi demo trên trình duyệt này và khôi phục bộ hồ sơ ban đầu. Bạn sẽ cần đăng nhập lại."
          onClose={() => setReset(false)}
          onConfirm={async () => {
            resetDemo();
            setReset(false);
            await cache.invalidateQueries({ queryKey: ["demo"] });
            navigate("/login");
          }}
        />
      )}
    </div>
  );
}
