import type {
  ReviewerAllocation,
  ReviewerAssign,
  ReviewerFinalize,
  ReviewerWorkspace,
} from "@doan/shared";
import { httpClient } from "../../../shared/api/http-client";
import type { WorkflowTerm } from "../../../shared/hooks/use-workflow-terms";
type Envelope<T> = { data: T };
const root = "/defense-reviewers";
const post = async (path: string, body: unknown, key: string) =>
  (
    await httpClient.post(root + path, body, {
      headers: { "Idempotency-Key": key },
    })
  ).data;
export const reviewerApi = {
  terms: async () =>
    (await httpClient.get<Envelope<WorkflowTerm[]>>(root + "/options")).data
      .data,
  workspace: async (termId: string) =>
    (
      await httpClient.get<Envelope<ReviewerWorkspace>>(root + "/workspace", {
        params: { termId },
      })
    ).data.data,
  propose: async (termId: string, ids: string[]) =>
    (
      await httpClient.get<Envelope<ReviewerAllocation>>(root + "/allocation", {
        params: {
          termId,
          ...(ids.length ? { termStudentIds: ids.join(",") } : {}),
        },
      })
    ).data.data,
  assign: (body: ReviewerAssign, key: string) =>
    post("/assignments", body, key),
  update: (id: string, body: ReviewerAssign, key: string) =>
    post(`/${encodeURIComponent(id)}/update`, body, key),
  finalize: (body: ReviewerFinalize, key: string) =>
    post("/finalize", body, key),
};
