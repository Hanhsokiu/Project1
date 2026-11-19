import type {
  CommitteeAllocation,
  CommitteeAssign,
  CommitteeFinalize,
  CommitteeSave,
  CommitteeUnassign,
  CommitteeWorkspace,
} from "@doan/shared";
import { httpClient } from "../../../shared/api/http-client";
import type { WorkflowTerm } from "../../../shared/hooks/use-workflow-terms";
type Envelope<T> = { data: T };
const root = "/defense-committees";
const post = async (path: string, body: unknown, key: string) =>
  (
    await httpClient.post(root + path, body, {
      headers: { "Idempotency-Key": key },
    })
  ).data;
export const committeeApi = {
  terms: async () =>
    (await httpClient.get<Envelope<WorkflowTerm[]>>(`${root}/options`)).data
      .data,
  workspace: async (termId: string) =>
    (
      await httpClient.get<Envelope<CommitteeWorkspace>>(`${root}/workspace`, {
        params: { termId },
      })
    ).data.data,
  propose: async (termId: string, ids: string[]) =>
    (
      await httpClient.get<Envelope<CommitteeAllocation>>(
        `${root}/allocation`,
        {
          params: {
            termId,
            ...(ids.length ? { termStudentIds: ids.join(",") } : {}),
          },
        },
      )
    ).data.data,
  save: (id: string | null, body: CommitteeSave, key: string) =>
    post(id ? `/${encodeURIComponent(id)}/update` : "", body, key),
  assign: (body: CommitteeAssign, key: string) =>
    post("/assignments", body, key),
  unassign: (id: string, body: CommitteeUnassign, key: string) =>
    post(`/${encodeURIComponent(id)}/unassign`, body, key),
  finalize: (id: string, body: CommitteeFinalize, key: string) =>
    post(`/${encodeURIComponent(id)}/finalize`, body, key),
};
