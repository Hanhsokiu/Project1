// Deterministic constraint search. A resource limit is NOT a proof of UNSAT.
export type AllocationCommittee = {
  id: string;
  memberIds: string[];
  fixedStudents: number;
  capacity: number | null;
};
export type AllocationStudent = {
  id: string;
  allowed: string[];
  currentCommitteeId?: string | null;
};
export function allocateCommittees(
  input: {
    committees: AllocationCommittee[];
    students: AllocationStudent[];
    lecturerLoads: Record<string, number>;
    maxStudentsPerLecturer: number | null;
  },
  maxNodes = 100000,
) {
  const committees = [...input.committees].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const byId = new Map(committees.map((c) => [c.id, c]));
  const students = [...input.students]
    .map((s) => ({
      ...s,
      allowed: [...new Set(s.allowed)].filter((id) => byId.has(id)).sort(),
    }))
    .sort(
      (a, b) => a.allowed.length - b.allowed.length || a.id.localeCompare(b.id),
    );
  const counts = new Map(committees.map((c) => [c.id, c.fixedStudents]));
  if (
    new Set(students.map((s) => s.id)).size !== students.length ||
    new Set(committees.map((c) => c.id)).size !== committees.length ||
    committees.some(
      (c) =>
        new Set(c.memberIds).size !== c.memberIds.length ||
        c.fixedStudents < 0 ||
        (c.capacity !== null && c.fixedStudents > c.capacity),
    ) ||
    (input.maxStudentsPerLecturer !== null &&
      Object.values(input.lecturerLoads).some(
        (n) => n > input.maxStudentsPerLecturer!,
      ))
  ) {
    return {
      status: "UNSAT" as const,
      placements: [],
      exploredNodes: 0,
      loads: committees.map((c) => ({
        committeeId: c.id,
        students: c.fixedStudents,
      })),
    };
  }
  const loads = { ...input.lecturerLoads },
    result: { studentId: string; committeeId: string }[] = [];
  let nodes = 0,
    limited = false;
  const fits = (c: AllocationCommittee) =>
    (c.capacity === null || counts.get(c.id)! < c.capacity) &&
    c.memberIds.every(
      (id) =>
        input.maxStudentsPerLecturer === null ||
        (loads[id] ?? 0) < input.maxStudentsPerLecturer,
    );
  function search(index: number): boolean {
    if (index === students.length) return true;
    if (nodes++ >= maxNodes) {
      limited = true;
      return false;
    }
    const student = students[index];
    const choices = student.allowed
      .map((id) => byId.get(id)!)
      .filter(fits)
      .sort(
        (a, b) =>
          Number(b.id === student.currentCommitteeId) -
            Number(a.id === student.currentCommitteeId) ||
          counts.get(a.id)! - counts.get(b.id)! ||
          Math.max(0, ...a.memberIds.map((id) => loads[id] ?? 0)) -
            Math.max(0, ...b.memberIds.map((id) => loads[id] ?? 0)) ||
          a.id.localeCompare(b.id),
      );
    for (const c of choices) {
      counts.set(c.id, counts.get(c.id)! + 1);
      c.memberIds.forEach((id) => (loads[id] = (loads[id] ?? 0) + 1));
      result.push({ studentId: student.id, committeeId: c.id });
      if (search(index + 1)) return true;
      result.pop();
      counts.set(c.id, counts.get(c.id)! - 1);
      c.memberIds.forEach((id) => loads[id]--);
      if (limited) return false;
    }
    return false;
  }
  const feasible = search(0);
  return {
    status: feasible
      ? ("FEASIBLE" as const)
      : limited
        ? ("SEARCH_LIMIT" as const)
        : ("UNSAT" as const),
    placements: feasible
      ? result.sort((a, b) => a.studentId.localeCompare(b.studentId))
      : [],
    exploredNodes: nodes,
    loads: committees.map((c) => ({
      committeeId: c.id,
      students: counts.get(c.id)!,
    })),
  };
}
