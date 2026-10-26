import { apiData } from "../../../shared/api/api-data";
import { getAccessToken } from "../../../shared/api/api-session";
import type { Assignment, Student } from "../../../shared/data/types";
export const STEP3_API = import.meta.env.VITE_REGISTRATION_API === "true";
export interface AssignmentContext {
  plan: {
    id: string;
    termId: string;
    status: string;
    revision: number;
    publishedAt: string | null;
  } | null;
  assignments: (Assignment & { student: Student; directionId: string })[];
  results: {
    registrationId: string;
    studentId: string;
    assignedLecturerId: string | null;
    reason: string;
  }[];
  missingSubmissions: { studentId: string; reason: string }[];
  violations?: string[];
}
export interface AssignmentPreview {
  revision: number;
  inputHash: string;
  results: {
    registrationId: string;
    assignedLecturerId: string | null;
    preference: number;
    isManual: boolean;
    reason: string;
  }[];
  missingSubmissions: { studentId: string; reason: string }[];
}
const contexts = new Map<string, AssignmentContext>();
const key = (termId: string) => `${getAccessToken()}:${termId}`;
export function assignmentContext(termId: string) {
  return contexts.get(key(termId));
}
export function cacheAssignment(termId: string, value: AssignmentContext) {
  contexts.set(key(termId), value);
}
export const assignmentApi = {
  load(termId: string, manager: boolean) {
    return apiData<AssignmentContext>(
      "GET",
      `/assignments/term/${termId}/${manager ? "plan" : "results"}`,
    );
  },
  preview(termId: string, all = false) {
    return apiData<AssignmentPreview>(
      "POST",
      `/assignments/term/${termId}/preview`,
      {
        mode: all ? "all" : "remaining",
        confirmed: all,
        revision: assignmentContext(termId)?.plan?.revision ?? 0,
      },
    );
  },
  save(termId: string, preview: AssignmentPreview, all: boolean) {
    return apiData<AssignmentContext>(
      "PUT",
      `/assignments/term/${termId}/draft`,
      {
        mode: all ? "all" : "remaining",
        confirmed: all,
        revision: preview.revision,
        inputHash: preview.inputHash,
      },
    );
  },
  adjust(
    termId: string,
    studentId: string,
    lecturerId: string,
    reason: string,
  ) {
    return apiData<AssignmentContext>(
      "PUT",
      `/assignments/term/${termId}/manual`,
      {
        studentId,
        lecturerId,
        reason,
        revision: assignmentContext(termId)?.plan?.revision ?? 0,
      },
    );
  },
  publish(termId: string) {
    return apiData<AssignmentContext>(
      "POST",
      `/assignments/term/${termId}/publish`,
      { revision: assignmentContext(termId)?.plan?.revision ?? 0 },
    );
  },
  retry(id: string) {
    return apiData("POST", `/notifications/outbox/${id}/retry`);
  },
};
