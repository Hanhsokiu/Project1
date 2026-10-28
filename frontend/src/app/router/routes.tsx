import { TaskSubmissionsPage } from "../../features/task-submissions/pages";
import {
  DossierListPage,
  DossierDetailPage,
} from "../../features/proposal-dossiers/pages";
import {
  GuidancePlanListPage,
  GuidancePlanDetailPage,
  GuidanceTaskListPage,
  GuidanceTaskCreatePage,
  GuidanceTaskDetailPage,
} from "../../features/guidance-tasks/pages";
import {
  ProposalReviewQueuePage,
  ProposalReviewDetailPage,
  ProposalReviewAssignmentPage,
} from "../../features/proposal-reviews/pages";
import {
  ProposalEditorListPage,
  ProposalEditorPage as VersionEditorPage,
} from "../../features/proposal-versions/pages";
import {
  ReviewGroupLayout,
  ReviewGroupListPage,
  ReviewGroupEditorPage,
  ReviewGroupDetailPage,
} from "../../features/review-groups/pages";

import { createBrowserRouter } from "react-router-dom";
import { lazy, Suspense } from "react";
import WorkspaceLayout from "../layouts/WorkspaceLayout";
import {
  Navigate,
  Outlet,
  useLocation,
  useRouteError,
  Link,
} from "react-router-dom";
import { useWorkspace } from "../../shared/hooks/use-workspace";
import { routeManifest } from "./route-manifest";
import { Empty } from "../../shared/components/kit";
import { AUTH_API, getApiUser } from "../../shared/api/api-session";
import type { ReactNode } from "react";

function WorkflowAccess({ children }: { children: ReactNode }) {
  const location = useLocation();
  if (AUTH_API) {
    const user = getApiUser();
    if (!user)
      return (
        <Navigate to="/login" state={{ from: location.pathname }} replace />
      );
    if (user.mustChangePassword)
      return <Navigate to="/change-password" replace />;
    const route = routeManifest.find((r) =>
      new RegExp("^" + r.path.replace(/:[^/]+/g, "[^/]+") + "$").test(
        location.pathname,
      ),
    );
    if (!route || !route.roles.some((role) => user.roles.includes(role)))
      return <Navigate to="/forbidden" replace />;
  }
  return <>{children}</>;
}

const ProgressReviewInboxPage = lazy(() =>
  import("../../features/guidance-reviews/pages").then((m) => ({
    default: m.ProgressReviewInboxPage,
  })),
);
const ProgressReviewDetailPage = lazy(() =>
  import("../../features/guidance-reviews/pages").then((m) => ({
    default: m.ProgressReviewDetailPage,
  })),
);
const GuidanceProgressDashboardPage = lazy(() =>
  import("../../features/guidance-reviews/pages").then((m) => ({
    default: m.GuidanceProgressDashboardPage,
  })),
);
const GuidanceMeetingsPage = lazy(() =>
  import("../../features/guidance-reviews/pages").then((m) => ({
    default: m.GuidanceMeetingsPage,
  })),
);
const GuidanceNotificationsPage = lazy(() =>
  import("../../features/guidance-reviews/pages").then((m) => ({
    default: m.GuidanceNotificationsPage,
  })),
);

const LoginPage = lazy(() => import("../../features/auth/pages/LoginPage"));
const DashboardPage = lazy(
  () => import("../../features/report/pages/DashboardPage"),
);
const AccountsPage = lazy(
  () => import("../../features/auth/pages/AccountsPage"),
);
const RolesPermissionsPage = lazy(
  () => import("../../features/auth/pages/RolesPermissionsPage"),
);
const AuditLogPage = lazy(
  () => import("../../features/auth/pages/AuditLogPage"),
);

const StudentListPage = lazy(
  () => import("../../features/catalog/pages/StudentListPage"),
);
const LecturerListPage = lazy(
  () => import("../../features/catalog/pages/LecturerListPage"),
);
const ImportPage = lazy(
  () => import("../../features/catalog/pages/ImportPage"),
);

const TermListPage = lazy(
  () => import("../../features/term/pages/TermListPage"),
);
const TermDetailPage = lazy(
  () => import("../../features/term/pages/TermDetailPage"),
);
const PhasePlanPage = lazy(
  () => import("../../features/term/pages/PhasePlanPage"),
);
const TermParameterPage = lazy(
  () => import("../../features/term/pages/TermParameterPage"),
);
const TermRosterPage = lazy(
  () => import("../../features/term/pages/TermRosterPage"),
);

const StudentRegistrationPage = lazy(
  () => import("../../features/registration/pages/StudentRegistrationPage"),
);
const RegistrationListPage = lazy(
  () => import("../../features/registration/pages/RegistrationListPage"),
);
const AssignmentPlanPage = lazy(
  () => import("../../features/registration/pages/AssignmentPlanPage"),
);
const AssignmentResultPage = lazy(
  () => import("../../features/registration/pages/AssignmentResultPage"),
);
const ManualAdjustPage = lazy(
  () => import("../../features/registration/pages/ManualAdjustPage"),
);

const MyTopicPage = lazy(
  () => import("../../features/topic/pages/MyTopicPage"),
);
const ProposalEditorPage = lazy(
  () => import("../../features/topic/pages/ProposalEditorPage"),
);
const DossierPage = lazy(
  () => import("../../features/topic/pages/DossierPage"),
);

const ExportCenterPage = lazy(
  () => import("../../features/report/pages/ExportCenterPage"),
);
const ProfilePage = lazy(() => import("../../features/auth/pages/ProfilePage"));
const ChangePasswordPage = lazy(
  () => import("../../features/auth/pages/ChangePasswordPage"),
);
const NotificationsPage = lazy(
  () => import("../../features/auth/pages/NotificationsPage"),
);
const ReferenceCatalogPage = lazy(
  () => import("../../features/catalog/pages/ReferenceCatalogPage"),
);
const DefenseConfirmPage = lazy(
  () => import("../../features/guidance/pages/DefenseConfirmPage"),
);
const FinalReportUploadPage = lazy(
  () => import("../../features/guidance/pages/FinalReportUploadPage"),
);
function PermissionGuard() {
  const { user } = useWorkspace();
  const { pathname } = useLocation();
  const route = routeManifest.find((r) =>
    r.path === "/"
      ? pathname === "/"
      : new RegExp("^" + r.path.replace(/:[^/]+/g, "[^/]+") + "$").test(
          pathname,
        ),
  );
  return route && !route.roles.some((r) => user.roles.includes(r)) ? (
    <Navigate to="/forbidden" replace />
  ) : (
    <Outlet />
  );
}
function NotFound() {
  return (
    <Empty
      title="404 · Không tìm thấy trang"
      description="Đường dẫn không tồn tại. Chọn một chức năng trong điều hướng để tiếp tục."
      action={
        <Link to="/" className="btn btn-primary">
          Về tổng quan
        </Link>
      }
    />
  );
}
function Forbidden() {
  return (
    <Empty
      title="403 · Không đủ quyền"
      description="Vai trò hiện tại chưa được cấp quyền truy cập chức năng này."
      action={
        <Link to="/" className="btn btn-primary">
          Về tổng quan
        </Link>
      }
    />
  );
}
function RouteError() {
  const err = useRouteError();
  return (
    <div className="p-10">
      <Empty
        title="Không thể mở trang"
        description={
          err instanceof Error ? err.message : "Có lỗi khi tải trang."
        }
        action={
          <a href="/" className="btn btn-primary">
            Tải lại tổng quan
          </a>
        }
      />
    </div>
  );
}

const Loader = () => (
  <div className="flex items-center justify-center h-screen text-gray-500 font-medium">
    Đang tải...
  </div>
);
const wrap = (el: React.ReactNode) => (
  <Suspense fallback={<Loader />}>{el}</Suspense>
);

export const router = createBrowserRouter([
  {
    path: "/guidance/review",
    element: (
      <WorkflowAccess>
        <ReviewGroupLayout guidanceMode />
      </WorkflowAccess>
    ),
    children: [
      { index: true, element: wrap(<ProgressReviewInboxPage />) },
      { path: ":submissionId", element: wrap(<ProgressReviewDetailPage />) },
    ],
  },
  {
    path: "/guidance/progress",
    element: (
      <WorkflowAccess>
        <ReviewGroupLayout guidanceMode />
      </WorkflowAccess>
    ),
    children: [
      { index: true, element: wrap(<GuidanceProgressDashboardPage />) },
    ],
  },
  {
    path: "/guidance/meetings",
    element: (
      <WorkflowAccess>
        <ReviewGroupLayout guidanceMode />
      </WorkflowAccess>
    ),
    children: [{ index: true, element: wrap(<GuidanceMeetingsPage />) }],
  },
  {
    path: "/guidance/notifications",
    element: (
      <WorkflowAccess>
        <ReviewGroupLayout guidanceMode />
      </WorkflowAccess>
    ),
    children: [{ index: true, element: wrap(<GuidanceNotificationsPage />) }],
  },
  {
    path: "/guidance/plan",
    element: (
      <WorkflowAccess>
        <ReviewGroupLayout guidanceMode />
      </WorkflowAccess>
    ),
    children: [
      { index: true, element: <GuidancePlanListPage /> },
      { path: ":proposalId", element: <GuidancePlanDetailPage /> },
      { path: ":proposalId/tasks/new", element: <GuidanceTaskCreatePage /> },
    ],
  },
  {
    path: "/guidance/tasks",
    element: (
      <WorkflowAccess>
        <ReviewGroupLayout guidanceMode />
      </WorkflowAccess>
    ),
    children: [
      { index: true, element: <GuidanceTaskListPage /> },
      { path: ":id", element: <GuidanceTaskDetailPage /> },
      { path: ":id/submissions", element: <TaskSubmissionsPage /> },
    ],
  },
  {
    path: "/topic/dossier",
    element: (
      <WorkflowAccess>
        <ReviewGroupLayout dossierMode />
      </WorkflowAccess>
    ),
    children: [
      { index: true, element: <DossierListPage /> },
      { path: ":proposalId", element: <DossierDetailPage /> },
    ],
  },
  {
    path: "/topic/proposal",
    element: (
      <WorkflowAccess>
        <ReviewGroupLayout versionMode />
      </WorkflowAccess>
    ),
    children: [
      { index: true, element: <ProposalEditorListPage /> },
      { path: ":proposalId", element: <VersionEditorPage /> },
      {
        path: ":proposalId/versions/:versionId",
        element: <VersionEditorPage />,
      },
    ],
  },
  {
    path: "/topic/reviews",
    element: (
      <WorkflowAccess>
        <ReviewGroupLayout reviewMode />
      </WorkflowAccess>
    ),
    children: [
      { index: true, element: <ProposalReviewQueuePage /> },
      { path: ":id", element: <ProposalReviewDetailPage /> },
    ],
  },
  {
    path: "/topic/review-assignments/:proposalId",
    element: (
      <WorkflowAccess>
        <ReviewGroupLayout reviewMode />
      </WorkflowAccess>
    ),
    children: [{ index: true, element: <ProposalReviewAssignmentPage /> }],
  },
  {
    path: "/topic/review-groups",
    element: (
      <WorkflowAccess>
        <ReviewGroupLayout />
      </WorkflowAccess>
    ),
    children: [
      { index: true, element: <ReviewGroupListPage /> },
      { path: "new", element: <ReviewGroupEditorPage /> },
      { path: ":id/edit", element: <ReviewGroupEditorPage /> },
      { path: ":id", element: <ReviewGroupDetailPage /> },
    ],
  },

  {
    path: "/login",
    element: wrap(<LoginPage />),
    errorElement: <RouteError />,
  },
  {
    path: "/",
    element: <WorkspaceLayout />,
    errorElement: <RouteError />,
    children: [
      {
        element: <PermissionGuard />,
        children: [
          { index: true, element: wrap(<DashboardPage />) },
          { path: "admin/accounts", element: wrap(<AccountsPage />) },
          { path: "admin/roles", element: wrap(<RolesPermissionsPage />) },
          { path: "admin/audit-logs", element: wrap(<AuditLogPage />) },

          { path: "catalog/students", element: wrap(<StudentListPage />) },
          { path: "catalog/lecturers", element: wrap(<LecturerListPage />) },
          { path: "catalog/import", element: wrap(<ImportPage />) },
          {
            path: "catalog/reference",
            element: wrap(<ReferenceCatalogPage />),
          },

          { path: "terms", element: wrap(<TermListPage />) },
          { path: "terms/:id", element: wrap(<TermDetailPage />) },
          { path: "terms/:id/phases", element: wrap(<PhasePlanPage />) },
          {
            path: "terms/:id/parameters",
            element: wrap(<TermParameterPage />),
          },
          { path: "terms/:id/roster", element: wrap(<TermRosterPage />) },

          { path: "registration", element: wrap(<StudentRegistrationPage />) },
          {
            path: "registration/list",
            element: wrap(<RegistrationListPage />),
          },
          {
            path: "registration/assignment",
            element: wrap(<AssignmentPlanPage />),
          },
          {
            path: "registration/result",
            element: wrap(<AssignmentResultPage />),
          },
          { path: "registration/manual", element: wrap(<ManualAdjustPage />) },

          { path: "topic/my", element: wrap(<MyTopicPage />) },
          { path: "topic/draft", element: wrap(<ProposalEditorPage />) },
          { path: "topic/overview", element: wrap(<DossierPage />) },
          {
            path: "guidance/defense-confirm",
            element: wrap(<DefenseConfirmPage />),
          },
          {
            path: "guidance/final-report",
            element: wrap(<FinalReportUploadPage />),
          },

          { path: "report/export", element: wrap(<ExportCenterPage />) },
          { path: "profile", element: wrap(<ProfilePage />) },
          { path: "change-password", element: wrap(<ChangePasswordPage />) },
          { path: "notifications", element: wrap(<NotificationsPage />) },
        ],
      },
      { path: "forbidden", element: <Forbidden /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
