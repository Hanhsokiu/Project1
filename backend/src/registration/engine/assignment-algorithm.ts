/** Implementation tie breakers: GPA, valid submission time, student code.
 * All NV1 decisions precede NV2, NV3, then direction fallback. Inputs are immutable. */
export interface RegistrationInput {
  registrationId: string;
  studentId: string;
  studentCode?: string;
  submittedAt?: string;
  directionId?: string;
  gpa: number | null;
  preferences: Array<{ lecturerId: string; order: number }>;
}
export interface LecturerCapacity {
  lecturerId: string;
  lecturerCode?: string;
  directionIds?: string[];
  active?: boolean;
  quota: number;
  currentCount: number;
}
export interface AssignmentResult {
  registrationId: string;
  assignedLecturerId: string | null;
  isManual: boolean;
  preference: number;
  reason: string;
}
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export function runAssignmentAlgorithm(
  registrations: RegistrationInput[],
  capacities: LecturerCapacity[],
): AssignmentResult[] {
  const loads = capacities.map((c) => ({ ...c }));
  const sorted = [...registrations].sort(
    (a, b) =>
      (b.gpa ?? -Infinity) - (a.gpa ?? -Infinity) ||
      cmp(a.submittedAt ?? "9999", b.submittedAt ?? "9999") ||
      cmp(a.studentCode ?? a.studentId, b.studentCode ?? b.studentId),
  );
  const result = new Map<string, AssignmentResult>();
  const can = (r: RegistrationInput, c: LecturerCapacity) =>
    c.active !== false &&
    c.quota > 0 &&
    c.currentCount < c.quota &&
    !!r.directionId &&
    !!c.directionIds?.includes(r.directionId);
  const put = (
    r: RegistrationInput,
    c: LecturerCapacity,
    preference: number,
  ) => {
    c.currentCount++;
    result.set(r.registrationId, {
      registrationId: r.registrationId,
      assignedLecturerId: c.lecturerId,
      isManual: false,
      preference,
      reason: preference <= 3 ? `NV${preference}` : "Theo hướng",
    });
  };
  for (const r of sorted)
    if (r.gpa === null || !Number.isFinite(r.gpa))
      result.set(r.registrationId, {
        registrationId: r.registrationId,
        assignedLecturerId: null,
        isManual: false,
        preference: 0,
        reason: "Chưa phân: GPA còn thiếu hoặc không hợp lệ, cần xử lý dữ liệu",
      });
  for (let round = 1; round <= 3; round++)
    for (const r of sorted) {
      if (result.has(r.registrationId)) continue;
      const pref = r.preferences.find((p) => p.order === round);
      const c = loads.find((c) => c.lecturerId === pref?.lecturerId);
      if (c && can(r, c)) put(r, c, round);
    }
  for (const r of sorted) {
    if (result.has(r.registrationId)) continue;
    const available = loads
      .filter((c) => can(r, c))
      .sort(
        (a, b) =>
          a.currentCount / a.quota - b.currentCount / b.quota ||
          cmp(a.lecturerCode ?? a.lecturerId, b.lecturerCode ?? b.lecturerId),
      );
    if (available[0]) put(r, available[0], 4);
    else
      result.set(r.registrationId, {
        registrationId: r.registrationId,
        assignedLecturerId: null,
        isManual: false,
        preference: 0,
        reason: "Chưa phân: không còn GV hoạt động đúng hướng và còn quota",
      });
  }
  return sorted.map((r) => result.get(r.registrationId)!);
}
