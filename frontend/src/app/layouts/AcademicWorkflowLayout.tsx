import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AUTH_API } from "../../shared/api/api-session";
import { sessionWorkspace } from "../../shared/data/session-workspace";
import { useApiSession } from "../../shared/hooks/use-api-session";
import WorkspaceLayout from "./WorkspaceLayout";
import type { ReactNode } from "react";

export default function AcademicWorkflowLayout({
  children,
}: {
  children?: ReactNode;
}) {
  const user = useApiSession();
  const location = useLocation();
  // Let disabled/misconfigured feature pages explain their own flags.
  if (!AUTH_API) return <>{children ?? <Outlet />}</>;
  if (!user)
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  // UC17–25 obtain term options from their own permission-scoped APIs.
  // A second global picker would misrepresent that scope and lose draft state.
  return (
    <WorkspaceLayout data={sessionWorkspace(user)} showTermPicker={false}>
      {children ?? <Outlet />}
    </WorkspaceLayout>
  );
}
