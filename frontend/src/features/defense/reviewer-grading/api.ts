import type {
  ReviewerGradeCommand,
  ReviewerGradeList,
  ReviewerGradeQuery,
  ReviewerGradeView,
} from "@doan/shared";
import { httpClient } from "../../../shared/api/http-client";
import type { WorkflowTerm } from "../../../shared/hooks/use-workflow-terms";
type Envelope<T> = { data: T };
const root = "/defense-reviewer-grades",
  path = (id: string) => `${root}/${encodeURIComponent(id)}`;
export const reviewerGradeKeys = {
  terms: (actor: string) => ["reviewer-grade-terms", actor] as const,
  list: (actor: string, q: ReviewerGradeQuery) =>
    ["reviewer-grade-list", actor, q] as const,
  detail: (actor: string, term: string, student: string, reviewer: string) =>
    ["reviewer-grade-detail", actor, term, student, reviewer] as const,
};
export const reviewerGradeApi = {
  terms: async () =>
    (await httpClient.get<Envelope<WorkflowTerm[]>>(root + "/options")).data
      .data,
  list: async (q: ReviewerGradeQuery) =>
    (await httpClient.get<Envelope<ReviewerGradeList>>(root, { params: q }))
      .data.data,
  detail: async (id: string, termId: string, reviewerId?: string) =>
    (
      await httpClient.get<Envelope<ReviewerGradeView>>(path(id), {
        params: { termId, ...(reviewerId ? { reviewerId } : {}) },
      })
    ).data.data,
  command: async (
    id: string,
    action: "save" | "finalize",
    body: ReviewerGradeCommand,
    key: string,
  ) =>
    (
      await httpClient.post(`${path(id)}/${action}`, body, {
        headers: { "Idempotency-Key": key },
      })
    ).data,
  download: async (id: string, termId: string, versionId: string) =>
    (
      await httpClient.get<Blob>(
        `${path(id)}/versions/${encodeURIComponent(versionId)}/pdf`,
        { params: { termId }, responseType: "blob" },
      )
    ).data,
};
export async function saveReviewerPdf(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = "do-an-phan-bien.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
