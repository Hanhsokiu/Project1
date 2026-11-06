import { Outlet } from "react-router-dom";
import WorkspaceLayout from "../../app/layouts/WorkspaceLayout";
import "./workspace.css";
import { useWorkflowShellData } from "./shell-data";

type Mode = {
  reviewMode?: boolean;
  versionMode?: boolean;
  dossierMode?: boolean;
  guidanceMode?: boolean;
};

export function ReviewGroupLayout(props: Mode) {
  const shell = useWorkflowShellData(
    props.guidanceMode
      ? "guidance"
      : !props.reviewMode &&
          !props.versionMode &&
          !props.dossierMode &&
          !props.guidanceMode,
  );
  return (
    <WorkspaceLayout data={shell?.data} selectionReady={shell?.selectionReady}>
      {shell?.error && (
        <p role="alert">
          Không tải được danh sách đợt trong phạm vi tài khoản.
        </p>
      )}
      <div className="workflow-content">
        <Outlet />
      </div>
    </WorkspaceLayout>
  );
}
