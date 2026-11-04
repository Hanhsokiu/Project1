import { AUTH_API } from "../../shared/api/api-session";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useApiSession } from "../../shared/hooks/use-api-session";
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
  X,
  PanelLeftClose,
  PanelLeftOpen,
  CalendarDays,
  ListChecks,
  FolderKanban,
  MessageSquareText,
  UserRound,
  Upload,
  FileClock,
} from "lucide-react";
import {
  navigationRoutes,
  routeManifest,
  routeTitle,
} from "../router/route-manifest";
import {
  DataBoundary,
  Person,
  Confirm,
  labels,
} from "../../shared/components/kit";
import { currentUser, resetDemo } from "../../shared/data/store";
import {
  WorkspaceProvider,
  WorkspaceSnapshotProvider,
  useWorkspace,
} from "../../shared/hooks/use-workspace";
import { authService } from "../../features/auth/services/auth-service";
import type { DemoDb } from "../../shared/data/types";
export default function WorkspaceLayout({
  children,
  data,
}: {
  children?: ReactNode;
  data?: DemoDb;
}) {
  const location = useLocation();
  const apiUser = useApiSession();
  if (AUTH_API && !apiUser)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (data) {
    if (apiUser?.mustChangePassword)
      return <Navigate to="/change-password" replace />;
    return (
      <WorkspaceSnapshotProvider db={data}>
        <Shell>{children}</Shell>
      </WorkspaceSnapshotProvider>
    );
  }
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
            <Shell>{children}</Shell>
          </WorkspaceProvider>
        );
      }}
    </DataBoundary>
  );
}
function Shell({ children }: { children?: ReactNode }) {
  const { db, user, termId, setTermId } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("utc-sidebar-collapsed") === "true"; }
    catch { return false; }
  });
  const [reset, setReset] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const closeMobileMenu = useCallback(() => {
    setMobile(false);
    menuButtonRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    try { localStorage.setItem("utc-sidebar-collapsed", String(collapsed)); } catch { /* Browser storage may be unavailable. */ }
  }, [collapsed]);
  useEffect(() => {
    setMobile(false);
    const toggle = menuButtonRef.current;
    if (
      toggle?.getClientRects().length &&
      sidebarRef.current?.contains(document.activeElement)
    )
      toggle.focus({ preventScroll: true });
  }, [location.pathname]);
  useEffect(() => {
    if (!mobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebarRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileMenu();
      if (event.key === "Tab") {
        const items = Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)') || []).filter(item => item.getClientRects().length);
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("keydown", close); document.body.style.overflow = previousOverflow; };
  }, [mobile, closeMobileMenu]);
  const routes = navigationRoutes(user, AUTH_API);
  const groups = [...new Set(routes.map((r) => r.group))];
  const active = routeManifest.find((r) =>
    matchPath({ path: r.path, end: true }, location.pathname),
  );
  const workflowPage =
    location.pathname.startsWith("/guidance/") ||
    /^\/topic\/(review|proposal|dossier)/.test(location.pathname);
  const navigationIcon = (path: string) => {
    if (path === "/") return Home;
    if (path.includes("notifications")) return Bell;
    if (path.includes("accounts")) return Users;
    if (path.includes("roles")) return ShieldCheck;
    if (path.includes("audit")) return FileClock;
    if (path.includes("students")) return GraduationCap;
    if (path.includes("lecturers")) return UserRound;
    if (path.includes("import")) return Upload;
    if (path.includes("reference")) return Layers;
    if (path.startsWith("/terms")) return CalendarDays;
    if (path.includes("review-group")) return Users;
    if (path.includes("review")) return MessageSquareText;
    if (path.includes("tasks")) return ListChecks;
    if (path.includes("plan") || path.includes("assignment")) return FolderKanban;
    if (path.includes("registration")) return ClipboardList;
    if (path.includes("topic")) return BookOpen;
    return FileText;
  };
  const isDemo =
    !AUTH_API &&
    (import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === "true");
  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <a className="skip-link" href="#workspace-main">Đi đến nội dung chính</a>
      {mobile && (
        <button
          aria-label="Đóng điều hướng"
          className={`sidebar-shade ${mobile ? "open" : ""}`}
          onClick={closeMobileMenu} title="Đóng điều hướng"
        />
      )}
      <aside
        ref={sidebarRef}
        id="workspace-navigation"
        className={`sidebar ${mobile ? "open" : ""}`}
        aria-label="Thanh điều hướng"
      >
        <Link to="/" className="brand" aria-label="KHOA CNTT – UTC Quản lý đồ án tốt nghiệp — Tổng quan" title="Tổng quan hệ thống">
          <span className="brand-mark">
            <GraduationCap size={22} />
          </span>
          <div>
            <strong>KHOA CNTT – UTC</strong>
            <small>Quản lý đồ án tốt nghiệp</small>
          </div>
        </Link>
        <div className="sidebar-context">
          <Layers size={18} className="text-blue-500" />
          <div>
            <small>Không gian làm việc</small>
            <strong>
              {user.roles.map((role) => labels[role]).join(" · ")}
            </strong>
          </div>
          {mobile && (
            <button
              type="button"
              className="icon-btn sidebar-close"
              aria-label="Đóng menu điều hướng"
              onClick={closeMobileMenu} title="Đóng menu điều hướng"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <nav className="sidebar-nav" aria-label="Điều hướng chính">
          {groups.map((group, i) => {
            const expanded =
              collapsed || (expandedGroups[group] ??
              (!workflowPage ||
                group === active?.group ||
                group === "Không gian làm việc"));
            return (
              <div className="nav-group" key={group}>
                <button
                  type="button"
                  className="nav-group-toggle"
                  aria-expanded={expanded}
                  aria-controls={`nav-group-${i}`}
                  onClick={() =>
                    setExpandedGroups((previous) => ({
                      ...previous,
                      [group]: !expanded,
                    }))
                  }
                >
                  <span>{group}</span>
                  <ChevronRight
                    size={14}
                    className={expanded ? "expanded" : ""}
                  />
                </button>
                <div id={`nav-group-${i}`} hidden={!expanded}>
                  {routes
                    .filter((r) => r.group === group)
                    .map((r) => {
                      const Icon = navigationIcon(r.path);
                      return (
                      <NavLink
                        key={r.path}
                        to={
                          r.path.startsWith("/topic/") ||
                          r.path.startsWith("/guidance/")
                            ? `${r.path}?${new URLSearchParams(termId ? { termId } : {})}`
                            : r.path
                        }
                        end={r.path === "/"}
                        title={routeTitle(r, user)}
                        aria-label={routeTitle(r, user)}
                        onClick={() => {
                          if (mobile) closeMobileMenu();
                        }}
                        className={({ isActive }) =>
                          `nav-item ${isActive ? "active" : ""}`
                        }
                      >
                        <Icon />
                        <span>{routeTitle(r, user)}</span>
                      </NavLink>
                    ); })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer flex items-center justify-between">
          <Link to="/profile" aria-label={`${user.name} ${user.roles.map(r => labels[r]).join(" · ")} — Thông tin cá nhân`} title="Thông tin cá nhân">
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
        <button type="button" className="sidebar-collapse" aria-label={collapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"} title={collapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"} aria-expanded={!collapsed} onClick={() => setCollapsed(value => !value)}>
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}<span>Thu gọn thanh điều hướng</span>
        </button>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button
            ref={menuButtonRef}
            className="icon-btn mobile-menu"
            aria-label={mobile ? "Đóng menu" : "Mở điều hướng"}
            aria-controls="workspace-navigation"
            aria-expanded={mobile}
            onClick={() => setMobile((open) => !open)} title={mobile ? "Đóng menu" : "Mở điều hướng"}
          >
            <Menu size={22} />
          </button>
          <nav className="breadcrumbs" aria-label="Đường dẫn trang">
            <Link to="/" title="Tổng quan" aria-label="Tổng quan"><Home size={16} /></Link>
            <ChevronRight size={13} aria-hidden="true" />
            {active?.path !== "/" && <><span className="breadcrumb-group">{active?.group}</span><ChevronRight className="breadcrumb-group" size={13} aria-hidden="true" /></>}
            <span aria-current="page">{active ? routeTitle(active, user) : "Trang không tồn tại"}</span>
          </nav>
          <div className="topbar-controls">
            <select
              className="term-picker"
              aria-label="Đợt làm việc"
              value={termId}
              onChange={(e) => {
                setTermId(e.target.value);
                if (
                  /^\/(topic\/(?:review|proposal|dossier)|guidance\/(?:plan|tasks|review|progress|meetings))/.test(
                    location.pathname,
                  )
                )
                  navigate({
                    pathname: location.pathname,
                    search: new URLSearchParams({
                      termId: e.target.value,
                    }).toString(),
                  });
              }}
            >
              {db.terms
                .filter(
                  (t) =>
                    !user.studentId || t.studentIds.includes(user.studentId),
                )
                .map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.code || t.name}
                    {t.program ? ` · ${t.program}` : ""}
                  </option>
                ))}
            </select>
            <span className="topbar-divider" />
            <Link
              to="/notifications"
              aria-label="Thông báo"
              title="Thông báo"
              className="icon-btn"
            >
              <Bell size={19} />
              {db.notifications.some(
                (n) => n.userId === user.id && !n.read,
              ) && <span className="notification-dot" />}
            </Link>
            <Link
              to="/profile"
              aria-label={`${user.name} ${user.roles.map(r => labels[r]).join(" · ")} — Thông tin cá nhân`}
              title="Thông tin cá nhân"
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
              className="avatar lg:hidden" title="Mở hồ sơ"
            >
              {user.name
                .split(" ")
                .slice(-2)
                .map((s) => s[0])
                .join("")}
            </Link>
          </div>
        </header>
        <main id="workspace-main" tabIndex={-1} className="page-content" key={`${termId}-${user.id}`}>
          {children ?? <Outlet />}
        </main>
      </div>
      {isDemo && (
        <div className="demo-control" role="region" aria-label="Điều khiển dữ liệu demo">
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
