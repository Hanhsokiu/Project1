import { apiData, getStep1Resources } from "../../../shared/data/snapshot-api";
import type { Term, TermStatus } from "../../../shared/data/types";
import type { TermInput } from "./term-service";
import { vietnamInstant } from "../../../shared/utils/vietnam-time";
export { vietnamInstant } from "../../../shared/utils/vietnam-time";
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
    const existing = resources?.terms?.find(t => t.id === input.id) as
      (Term & { startDate?: string; endDate?: string }) | undefined;
    const payload = {
      code: input.code,
      name: input.name,
      semesterId: semester.id,
      trainingSystemId: program.id,
      startDate: existing?.start === input.start && existing.startDate
        ? existing.startDate : vietnamInstant(input.start),
      endDate: existing?.end === input.end && existing.endDate
        ? existing.endDate : vietnamInstant(input.end, true),
      registrationStart: vietnamInstant(input.registrationStart),
      registrationEnd: vietnamInstant(input.registrationEnd, true),
      ...(input.id && input.reason?.trim() ? { reason: input.reason.trim() } : {}),
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
  savePhases: (id: string, phases: Term["phases"], reason?: string) =>
    apiData<Term>("PUT", `/terms/${id}/phases`, {
      ...(reason?.trim() ? { reason: reason.trim() } : {}),
      phases: phases.map((phase) => ({
        ...phase,
        id: /^[0-9a-f-]{36}$/i.test(phase.id) ? phase.id : undefined,
        code:
          phase.code ||
          [
            "REGISTRATION",
            "ASSIGNMENT",
            "PROPOSAL",
            "WEEKLY",
            "FINAL",
            "DEFENSE",
          ][phases.filter((p) => p.code !== "PROPOSAL_REVIEW").indexOf(phase)],
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
  ) =>
    apiData<Term>("PUT", `/terms/${id}/roster`, {
      studentIds,
      lecturers: lecturers.map(({ lecturerId, quota }) => ({
        lecturerId,
        quota,
      })),
    }),
};
