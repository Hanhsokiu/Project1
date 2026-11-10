export type ReviewerAllocationInput = {
  lecturers: {
    id: string;
    fixedReviewLoad: number;
    otherDuties: number;
    reviewCapacity: number | null;
    totalCapacity: number | null;
  }[];
  students: {
    id: string;
    needed: number;
    allowed: string[];
    current: string[];
  }[];
  nodeLimit?: number;
};
// Deterministic feasibility search with load/stability heuristics, not a global optimizer.
export function allocateReviewers(input: ReviewerAllocationInput) {
  const lecturers = [...input.lecturers].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const loads = new Map(lecturers.map((l) => [l.id, l.fixedReviewLoad]));
  const students = [...input.students].sort(
    (a, b) =>
      a.allowed.length - a.needed - (b.allowed.length - b.needed) ||
      a.id.localeCompare(b.id),
  );
  const placements: { studentId: string; reviewerIds: string[] }[] = [];
  let exploredNodes = 0,
    limited = false;
  const budget = input.nodeLimit ?? 100000;
  const fixedOverCapacity = lecturers.some(
    (l) =>
      (l.reviewCapacity !== null && l.fixedReviewLoad > l.reviewCapacity) ||
      (l.totalCapacity !== null &&
        l.fixedReviewLoad + l.otherDuties > l.totalCapacity),
  );
  const can = (id: string) => {
    const l = lecturers.find((l) => l.id === id);
    if (!l) return false;
    const n = (loads.get(id) ?? 0) + 1;
    return (
      (l.reviewCapacity === null || n <= l.reviewCapacity) &&
      (l.totalCapacity === null || n + l.otherDuties <= l.totalCapacity)
    );
  };
  function search(index: number): boolean {
    if (index === students.length) return true;
    const s = students[index];
    const allowed = [...new Set(s.allowed)]
      .filter(can)
      .sort(
        (a, b) =>
          Number(s.current.includes(b)) - Number(s.current.includes(a)) ||
          loads.get(a)! - loads.get(b)! ||
          loads.get(a)! +
            lecturers.find((l) => l.id === a)!.otherDuties -
            (loads.get(b)! + lecturers.find((l) => l.id === b)!.otherDuties) ||
          a.localeCompare(b),
      );
    if (allowed.length < s.needed) return false;
    function choose(start: number, picked: string[]): boolean {
      if (picked.length === s.needed) {
        placements.push({ studentId: s.id, reviewerIds: [...picked].sort() });
        if (search(index + 1)) return true;
        placements.pop();
        return false;
      }
      for (
        let i = start;
        i <= allowed.length - (s.needed - picked.length);
        i++
      ) {
        if (exploredNodes >= budget) {
          limited = true;
          return false;
        }
        exploredNodes++;
        const id = allowed[i];
        if (!can(id)) continue;
        loads.set(id, loads.get(id)! + 1);
        if (choose(i + 1, [...picked, id])) return true;
        loads.set(id, loads.get(id)! - 1);
        if (limited) return false;
      }
      return false;
    }
    return choose(0, []);
  }
  const feasible = !fixedOverCapacity && search(0);
  return {
    status: feasible
      ? ("FEASIBLE" as const)
      : limited
        ? ("SEARCH_LIMIT" as const)
        : ("UNSAT" as const),
    placements: feasible
      ? placements.sort((a, b) => a.studentId.localeCompare(b.studentId))
      : [],
    exploredNodes,
    loads: lecturers.map((l) => ({
      lecturerId: l.id,
      reviews: loads.get(l.id)!,
      total: loads.get(l.id)! + l.otherDuties,
    })),
  };
}
