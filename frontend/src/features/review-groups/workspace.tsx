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
  return <div className="workflow-content"><Outlet /></div>;
}
