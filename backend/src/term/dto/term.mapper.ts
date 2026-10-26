import { phaseCodes, PhaseCode } from "./term.dto";
import { LoadedTerm } from "../repository/term.repository";
import { defaultTermParameters } from "../validator/term-configuration.validator";

export function parametersFromTerm(term: LoadedTerm): Record<string, number> {
  const values = { ...defaultTermParameters };
  for (const parameter of term.parameters) {
    const value = Number(parameter.value);
    if (Number.isFinite(value)) values[parameter.key] = value;
  }
  return values;
}
export function phasesFromTerm(term: LoadedTerm) {
  return [...term.phases]
    .sort(
      (a, b) =>
        a.startDate.getTime() - b.startDate.getTime() ||
        a.id.localeCompare(b.id),
    )
    .map((phase, index) => ({
      ...phase,
      code: (phaseCodes.includes(phase.code as PhaseCode)
        ? phase.code
        : phaseCodes[index]) as PhaseCode,
    }))
    .sort((a, b) => phaseCodes.indexOf(a.code) - phaseCodes.indexOf(b.code));
}
const vietnamDate = (value: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
export interface PublicationState {
  assignmentPublished: boolean;
  resultsPublished: boolean;
  officialAssignments: {
    advisorId: string;
    registration: { studentId: string };
  }[];
}
export function toTermResponse(term: LoadedTerm, state: PublicationState) {
  const phases = phasesFromTerm(term);
  const registration = phases.find((p) => p.code === "REGISTRATION");
  return {
    id: term.id,
    code: term.code,
    name: term.name,
    semesterId: term.semesterId,
    academicYear: term.academicYear,
    semester:
      term.semesterRecord?.name ??
      `${term.academicYear} / Học kỳ ${term.semester}`,
    semesterNumber: term.semester,
    trainingSystemId: term.trainingSystemId,
    program: term.trainingSystem?.name ?? "",
    start: vietnamDate(term.startDate),
    end: vietnamDate(term.endDate),
    startDate: term.startDate.toISOString(),
    endDate: term.endDate.toISOString(),
    status: term.status,
    locked: term.isLocked,
    registrationStart:
      registration?.startDate.toISOString() ?? term.startDate.toISOString(),
    registrationEnd:
      registration?.endDate.toISOString() ?? term.endDate.toISOString(),
    phases: phases.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.phaseName,
      start: p.startDate.toISOString(),
      end: p.endDate.toISOString(),
      locked: p.isLocked,
    })),
    parameters: parametersFromTerm(term),
    studentIds: term.termStudents.map((s) => s.studentId),
    lecturers: term.termLecturers.map((l) => ({
      lecturerId: l.lecturerId,
      quota: l.quota,
      officialCount: state.officialAssignments.filter(
        (a) => a.advisorId === l.lecturerId,
      ).length,
    })),
    assignmentPublished: state.assignmentPublished,
    resultsPublished: state.resultsPublished,
    createdAt: term.createdAt.toISOString(),
    updatedAt: term.updatedAt.toISOString(),
  };
}
