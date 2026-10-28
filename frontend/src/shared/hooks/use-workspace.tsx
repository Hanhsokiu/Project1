import { createContext, useContext, useState, type ReactNode } from "react";
import {
  currentUser,
  getWorkspaceSelection,
  setWorkspaceSelection,
} from "../data/store";
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
  const { data: db } = useDemo();
  return db ? (
    <WorkspaceSnapshotProvider db={db}>{children}</WorkspaceSnapshotProvider>
  ) : null;
}
export function WorkspaceSnapshotProvider({
  children,
  db,
}: {
  children: ReactNode;
  db: DemoDb;
}) {
  const [termId, setTerm] = useState(
    () => getWorkspaceSelection().termId || "dot1",
  );
  const [studentId, setStudent] = useState(
    () => getWorkspaceSelection().studentId || "sv1",
  );
  const user = currentUser(db);
  if (!user) return null;
  const visibleTerms = user.studentId
    ? db.terms.filter((t) => t.studentIds.includes(user.studentId!))
    : db.terms;
  const term =
    visibleTerms.find((t) => t.id === termId) || visibleTerms[0] || emptyTerm;
  const value: Workspace = {
    db,
    user,
    termId: term.id,
    term,
    studentId: user.studentId || studentId,
    setStudentId: (id) => {
      setStudent(id);
      setWorkspaceSelection({ studentId: id });
    },
    setTermId: (id) => {
      setTerm(id);
      setWorkspaceSelection({ termId: id });
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("WorkspaceProvider is required");
  return value;
}
