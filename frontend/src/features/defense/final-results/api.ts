import type {
  FinalResultCommand,
  FinalResultList,
  FinalResultOptions,
  FinalResultQuery,
  FinalResultView,
} from "@doan/shared";
import type { WorkflowTerm } from "../../../shared/hooks/use-workflow-terms";
import { httpClient } from "../../../shared/api/http-client";
type Envelope<T> = { data: T };
const root = "/defense-results",
  path = (id: string) => root + "/" + encodeURIComponent(id);
export const finalResultKeys = {
  options: (actor: string) => ["final-result-options", actor] as const,
  list: (actor: string, q: FinalResultQuery) =>
    ["final-result-list", actor, q] as const,
  detail: (actor: string, term: string, member: string) =>
    ["final-result-detail", actor, term, member] as const,
};
export const finalResultApi = {
  options: async () =>
    (
      await httpClient.get<
        Envelope<Omit<FinalResultOptions, "terms"> & { terms: WorkflowTerm[] }>
      >(root + "/options")
    ).data.data,
  list: async (q: FinalResultQuery) =>
    (await httpClient.get<Envelope<FinalResultList>>(root, { params: q })).data
      .data,
  detail: async (id: string, termId: string) =>
    (
      await httpClient.get<Envelope<FinalResultView>>(path(id), {
        params: { termId },
      })
    ).data.data,
  preview: async (id: string, termId: string) =>
    (
      await httpClient.post<Envelope<FinalResultView>>(path(id) + "/preview", {
        termId,
      })
    ).data.data,
  command: async (
    id: string,
    action: "confirm" | "finalize" | "publish",
    body: FinalResultCommand,
    key: string,
  ) =>
    (
      await httpClient.post<
        Envelope<{ finalResultId: string; revision: number; state: string }>
      >(path(id) + "/" + action, body, { headers: { "Idempotency-Key": key } })
    ).data.data,
};
