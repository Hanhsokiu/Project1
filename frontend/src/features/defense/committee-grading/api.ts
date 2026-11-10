import type {
  CommitteeGradeCommand,
  CommitteeGradeList,
  CommitteeGradeOptions,
  CommitteeGradeProgress,
  CommitteeGradeQuery,
  CommitteeGradeView,
} from "@doan/shared";
import { httpClient } from "../../../shared/api/http-client";
import type { WorkflowTerm } from "../../../shared/hooks/use-workflow-terms";
type Envelope<T> = { data: T };
const root = "/defense-committee-grades",
  path = (id: string) => root + "/" + encodeURIComponent(id);
export const committeeGradeKeys = {
  options: (actor: string) => ["committee-grade-options", actor] as const,
  list: (actor: string, q: CommitteeGradeQuery) =>
    ["committee-grade-list", actor, q] as const,
  progress: (actor: string, q: CommitteeGradeQuery) =>
    ["committee-grade-progress", actor, q] as const,
  detail: (
    actor: string,
    term: string,
    committee: string,
    member: string,
    lecturer: string,
  ) =>
    [
      "committee-grade-detail",
      actor,
      term,
      committee,
      member,
      lecturer,
    ] as const,
};
export const committeeGradeApi = {
  options: async () =>
    (
      await httpClient.get<
        Envelope<
          Omit<CommitteeGradeOptions, "terms"> & { terms: WorkflowTerm[] }
        >
      >(root + "/options")
    ).data.data,
  list: async (q: CommitteeGradeQuery) =>
    (await httpClient.get<Envelope<CommitteeGradeList>>(root, { params: q }))
      .data.data,
  progress: async (q: CommitteeGradeQuery) =>
    (
      await httpClient.get<
        Envelope<{
          items: CommitteeGradeProgress[];
          total: number;
          page: number;
          limit: number;
          blockers: string[];
        }>
      >(root + "/progress", { params: q })
    ).data.data,
  detail: async (
    id: string,
    termId: string,
    committeeId: string,
    lecturerId?: string,
  ) =>
    (
      await httpClient.get<Envelope<CommitteeGradeView>>(path(id), {
        params: { termId, committeeId, ...(lecturerId ? { lecturerId } : {}) },
      })
    ).data.data,
  command: async (
    id: string,
    action: "save" | "finalize",
    body: CommitteeGradeCommand,
    key: string,
  ) =>
    (
      await httpClient.post(`${path(id)}/${action}`, body, {
        headers: { "Idempotency-Key": key },
      })
    ).data,
  download: async (
    id: string,
    termId: string,
    committeeId: string,
    versionId: string,
  ) =>
    (
      await httpClient.get<Blob>(
        `${path(id)}/versions/${encodeURIComponent(versionId)}/pdf`,
        { params: { termId, committeeId }, responseType: "blob" },
      )
    ).data,
};
export async function saveCommitteePdf(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = "do-an-hoi-dong.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
