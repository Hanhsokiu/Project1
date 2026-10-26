import { apiData, getStep1Resources } from "../../../shared/data/snapshot-api";
import type { Term, TermStatus } from "../../../shared/data/types";
import type { TermInput } from "./term-service";

export function vietnamInstant(value: string, end = false) {
  if (value.length === 10)
    return `${value}T${end ? "23:59:59.999" : "00:00:00"}+07:00`;
  return /[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}+07:00`;
}
export const termApi = {
  async save(input: TermInput) {
    const resources = getStep1Resources();
    const semester = resources?.semesters.find(
      (s) => s.name === input.semester,
    );
    const program = resources?.programs.find((p) => p.name === input.program);
    if (!semester || !program)
      throw new Error(
        "Vui lòng chọn kỳ học và hệ đào tạo đã được tải từ hệ thống.",
      );
    const payload = {
      code: input.code,
      name: input.name,
      semesterId: semester.id,
      trainingSystemId: program.id,
      startDate: vietnamInstant(input.start),
      endDate: vietnamInstant(input.end, true),
      registrationStart: vietnamInstant(input.registrationStart),
      registrationEnd: vietnamInstant(input.registrationEnd, true),
    };
    const term = await apiData<Term>(
      input.id ? "PATCH" : "POST",
      input.id ? `/terms/${input.id}` : "/terms",
      payload,
    );
    return term.id;
  },
  transition: (id: string, status: TermStatus) =>
    apiData<Term>("PATCH", `/terms/${id}/status`, { status }),
  toggleLock(id: string) {
    const term = getStep1Resources()?.terms?.find((t) => t.id === id);
    if (!term)
      throw new Error("Chưa tải được đợt cần khóa/mở. Hãy tải lại danh sách.");
    return apiData<Term>("PATCH", `/terms/${id}/lock`, {
      locked: !term.locked,
    });
  },
  savePhases: (id: string, phases: Term["phases"]) =>
    apiData<Term>("PUT", `/terms/${id}/phases`, {
      phases: phases.map((phase, i) => ({
        ...phase,
        id: /^[0-9a-f-]{36}$/i.test(phase.id) ? phase.id : undefined,
        code:
          (phase as { code?: string }).code ||
          [
            "REGISTRATION",
            "ASSIGNMENT",
            "PROPOSAL",
            "WEEKLY",
            "FINAL",
            "DEFENSE",
          ][i],
        start: vietnamInstant(phase.start),
        end: vietnamInstant(phase.end, true),
      })),
    }),
  saveParameters: (id: string, parameters: Record<string, number>) =>
    apiData<Term>("PUT", `/terms/${id}/parameters`, { parameters }),
  saveRoster: (
    id: string,
    studentIds: string[],
    lecturers: Term["lecturers"],
  ) => apiData<Term>("PUT", `/terms/${id}/roster`, { studentIds, lecturers }),
};
