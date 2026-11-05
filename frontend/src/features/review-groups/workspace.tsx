import { useEffect } from "react";
import { Outlet, useSearchParams } from "react-router-dom";
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
      <WorkflowContent />
    </WorkspaceLayout>
  );
}

function WorkflowContent() {
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
  return (
    <div className="workflow-content">
      <Outlet />
    </div>
  );
}
