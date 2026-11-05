import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  currentUser,
  getWorkspaceSelection,
  setWorkspaceSelection,
  subscribeWorkspaceSelection,
  workspaceSelectionSnapshot,
} from "../data/store";
import { selectedTerm, termDestination } from "../data/term-selection";
import { useDemo } from "./use-demo";
import type { Account, DemoDb, Term } from "../data/types";
interface Workspace {
  db: DemoDb;
  user: Account;
  termId: string;
  term: Term;
  studentId: string;
  setStudentId: (id: string) => void;
  setTermId: (id: string) => void;
}
const emptyTerm: Term = {
  id: "",
  code: "",
  name: "Chưa chọn đợt",
  semester: "",
  program: "",
  status: "DRAFT",
  start: "",
  end: "",
  registrationStart: "",
  registrationEnd: "",
  locked: true,
  studentIds: [],
  lecturers: [],
  phases: [],
  parameters: { passing_gpa_threshold: 2, max_preferences: 3 },
  assignmentPublished: false,
  resultsPublished: false,
};
const Context = createContext<Workspace | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { data: db, isFetching } = useDemo();
  return db ? (
    <WorkspaceSnapshotProvider db={db} selectionReady={!isFetching}>
      {children}
    </WorkspaceSnapshotProvider>
  ) : null;
}
export function WorkspaceSnapshotProvider({
  children,
  db,
  selectionReady = true,
}: {
  children: ReactNode;
  db: DemoDb;
  selectionReady?: boolean;
}) {
  useSyncExternalStore(
    subscribeWorkspaceSelection,
    workspaceSelectionSnapshot,
    () => "{}",
  );
  const saved = getWorkspaceSelection();
  const location = useLocation(),
    navigate = useNavigate();
  const requested = new URLSearchParams(location.search).get("termId");
  const detailId = /^\/terms\/([^/]+)/.exec(location.pathname)?.[1];
  const user = currentUser(db);
  const visibleTerms = user?.studentId
    ? db.terms.filter((t) => t.studentIds.includes(user.studentId!))
    : db.terms;
  const term =
    selectedTerm(visibleTerms, detailId || requested, saved.termId) ||
    emptyTerm;
  useEffect(() => {
    if (selectionReady && term.id && term.id !== saved.termId)
      setWorkspaceSelection({ termId: term.id });
  }, [term.id, saved.termId, selectionReady]);
  // All workflow list pages consume this same termId in the URL.
  useEffect(() => {
    if (
      selectionReady &&
      !requested &&
      term.id &&
      /^\/(topic\/(review-groups|reviews|proposal|dossier)|guidance\/)/.test(
        location.pathname,
      )
    ) {
      const params = new URLSearchParams(location.search);
      params.set("termId", term.id);
      navigate(
        { pathname: location.pathname, search: params.toString() },
        { replace: true },
      );
    }
  }, [
    requested,
    term.id,
    location.pathname,
    location.search,
    navigate,
    selectionReady,
  ]);
  if (!user) return null;
  const value: Workspace = {
    db,
    user,
    termId: term.id,
    term,
    studentId: user.studentId || saved.studentId || "",
    setStudentId: (id) => {
      setWorkspaceSelection({ studentId: id });
    },
    setTermId: (id) => {
      setWorkspaceSelection({ termId: id });
      navigate(termDestination(location.pathname, location.search, id));
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("WorkspaceProvider is required");
  return value;
}
