import { useWorkspace } from "../../../shared/hooks/use-workspace";
import { useAction } from "../../../shared/hooks/use-demo";
import type { DemoDb, Defense } from "../../../shared/data/types";
export function useDefenseScope(db: DemoDb) {
  const workspace = useWorkspace();
  const action = useAction();
  const term = db.terms.find((t) => t.id === workspace.termId) ?? db.terms[0];
  const user = workspace.user;
  const faculty = !!user?.roles.includes("FACULTY");
  const visible = (studentId: string) =>
    faculty ||
    user?.studentId === studentId ||
    db.assignments.some(
      (a) =>
        a.termId === term?.id &&
        a.studentId === studentId &&
        a.lecturerId === user?.lecturerId,
    ) ||
    db.defenses.some(
      (d) =>
        d.termId === term?.id &&
        d.studentId === studentId &&
        (d.reviewerId === user?.lecturerId ||
          db.committees
            .find((c) => c.id === d.committeeId)
            ?.members.some((m) => m.lecturerId === user?.lecturerId)),
    );
  const defenses = db.defenses.filter(
    (d) =>
      d.termId === term?.id &&
      visible(d.studentId) &&
      (faculty || d.reviewerPublished !== false),
  );
  const name = (id: string) => db.students.find((s) => s.id === id)?.name ?? id;
  const lecturer = (id: string) =>
    db.lecturers.find((l) => l.id === id)?.name ?? "Chưa phân công";
  const committeeName = (d: Defense) =>
    db.committees.find((c) => c.id === d.committeeId)?.name ?? "Chưa phân công";
  return {
    ...workspace,
    term,
    user,
    faculty,
    visible,
    defenses,
    name,
    lecturer,
    committeeName,
    pending: action.pending,
    exec: (fn: () => unknown | Promise<unknown>) => {
      void action.run(fn).catch(() => {});
    },
  };
}
