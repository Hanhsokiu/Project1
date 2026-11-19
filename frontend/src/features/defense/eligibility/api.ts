import type {
  EligibilityDecision,
  EligibilityFinalize,
  EligibilityList,
  EligibilityQuery,
  EligibilityReview,
  EligibilityView,
} from "@doan/shared";
import { httpClient } from "../../../shared/api/http-client";
import type { WorkflowTerm } from "../../../shared/hooks/use-workflow-terms";
type Envelope<T> = { data: T };
const root = "/defense-eligibility";
export const eligibilityApi = {
  terms: async () =>
    (await httpClient.get<Envelope<WorkflowTerm[]>>(`${root}/options`)).data
      .data,
  list: async (query: EligibilityQuery) =>
    (await httpClient.get<Envelope<EligibilityList>>(root, { params: query }))
      .data.data,
  detail: async (id: string, termId: string) =>
    (
      await httpClient.get<Envelope<EligibilityView>>(
        `${root}/${encodeURIComponent(id)}`,
        { params: { termId } },
      )
    ).data.data,
  review: async (id: string, body: EligibilityReview, key: string) =>
    (
      await httpClient.post(`${root}/${encodeURIComponent(id)}/review`, body, {
        headers: { "Idempotency-Key": key },
      })
    ).data,
  decide: async (id: string, body: EligibilityDecision, key: string) =>
    (
      await httpClient.post(`${root}/${encodeURIComponent(id)}/decide`, body, {
        headers: { "Idempotency-Key": key },
      })
    ).data,
  finalize: async (body: EligibilityFinalize, key: string) =>
    (
      await httpClient.post(`${root}/finalize`, body, {
        headers: { "Idempotency-Key": key },
      })
    ).data,
};
