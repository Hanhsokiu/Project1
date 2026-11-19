import type {
  AdvisorConfirmation,
  AdvisorSummary,
  FinalDefenseRow,
  FinalDefenseView,
} from "@doan/shared";
import { httpClient } from "../../../shared/api/http-client";
import type { WorkflowTerm } from "../../../shared/hooks/use-workflow-terms";

type Envelope<T> = { data: T };
const root = (id: string) =>
  `/proposals/${encodeURIComponent(id)}/final-report`;
export const finalDefenseApi = {
  terms: async () =>
    (await httpClient.get<Envelope<WorkflowTerm[]>>("/final-defense/options"))
      .data.data,
  list: async (termId: string, page = 1) =>
    (
      await httpClient.get<
        Envelope<{
          items: FinalDefenseRow[];
          total: number;
          page: number;
          limit: number;
        }>
      >("/final-defense", { params: { termId, page, limit: 20 } })
    ).data.data,
  detail: async (id: string) =>
    (await httpClient.get<Envelope<FinalDefenseView>>(root(id))).data.data,
  upload: async (
    id: string,
    expectedRevision: number,
    file: File,
    key: string,
  ) => {
    const form = new FormData();
    form.append("expectedRevision", String(expectedRevision));
    form.append("file", file);
    return (
      await httpClient.post(`${root(id)}/pdf`, form, {
        headers: { "Idempotency-Key": key },
      })
    ).data;
  },
  summary: async (id: string, body: AdvisorSummary, key: string) =>
    (
      await httpClient.post(`${root(id)}/review`, body, {
        headers: { "Idempotency-Key": key },
      })
    ).data,
  decide: async (id: string, body: AdvisorConfirmation, key: string) =>
    (
      await httpClient.post(`${root(id)}/decide`, body, {
        headers: { "Idempotency-Key": key },
      })
    ).data,
  download: async (id: string, versionId: string) =>
    (
      await httpClient.get<Blob>(
        `${root(id)}/versions/${encodeURIComponent(versionId)}/pdf`,
        { responseType: "blob" },
      )
    ).data,
};
