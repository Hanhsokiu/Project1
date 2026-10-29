import { useEffect } from "react";
import {
  Outlet,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { Search } from "lucide-react";
import WorkspaceLayout from "../../app/layouts/WorkspaceLayout";
import { useWorkspace } from "../../shared/hooks/use-workspace";
import "./workspace.css";
import { useWorkflowShellData } from "./shell-data";

type Mode = {
  reviewMode?: boolean;
  versionMode?: boolean;
  dossierMode?: boolean;
  guidanceMode?: boolean;
};

export function ReviewGroupLayout(props: Mode) {
  const data = useWorkflowShellData(
    !props.reviewMode &&
      !props.versionMode &&
      !props.dossierMode &&
      !props.guidanceMode,
  );
  return (
    <WorkspaceLayout data={data}>
      <WorkflowContent {...props} />
    </WorkspaceLayout>
  );
}

function WorkflowContent({
  reviewMode,
  versionMode,
  dossierMode,
  guidanceMode,
}: Mode) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const { db, termId: selectedTerm, setTermId } = useWorkspace();
  const requestedTerm = params.get("termId");
  useEffect(() => {
    if (
      requestedTerm &&
      requestedTerm !== selectedTerm &&
      db.terms.some((term) => term.id === requestedTerm)
    )
      setTermId(requestedTerm);
  }, [requestedTerm, selectedTerm, db.terms, setTermId]);
  const list = guidanceMode
    ? "/guidance/tasks"
    : dossierMode
      ? "/topic/dossier"
      : versionMode
        ? "/topic/proposal"
        : reviewMode
          ? "/topic/reviews"
          : "/topic/review-groups";
  const label = guidanceMode
    ? "Tìm kiếm nhiệm vụ"
    : reviewMode || versionMode || dossierMode
      ? "Tìm kiếm đề cương"
      : "Tìm kiếm nhóm duyệt";
  const submitLabel = guidanceMode
    ? "Tìm nhiệm vụ"
    : reviewMode || versionMode || dossierMode
      ? "Tìm đề cương"
      : "Tìm nhóm";
  return (
    <div className="workflow-content">
      {pathname === list && (dossierMode || guidanceMode) && (
        <form
          className="workflow-toolbar"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            if (!requestedTerm && !selectedTerm) return;
            const search = String(
              new FormData(event.currentTarget).get("query") ?? "",
            ).trim();
            const query = new URLSearchParams({ search });
            if (requestedTerm || selectedTerm)
              query.set("termId", requestedTerm || selectedTerm);
            navigate(list + "?" + query);
          }}
        >
          <div className="search-input">
            <Search size={17} aria-hidden="true" />
            <input
              name="query"
              disabled={!requestedTerm && !selectedTerm}
              aria-label={label}
              placeholder={
                guidanceMode ? "Tìm nhiệm vụ…" : "Tìm đề cương…"
              }
            />
          </div>
          <button
            type="submit"
            disabled={!requestedTerm && !selectedTerm}
            className="btn btn-secondary"
            aria-label={submitLabel}
          >
            Tìm kiếm
          </button>
        </form>
      )}
      <Outlet />
    </div>
  );
}
