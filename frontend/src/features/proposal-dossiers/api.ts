import type {
  DossierView,
  DossierFinalize,
  DossierReceiptInput,
} from "@doan/shared";
import { httpClient } from "../../shared/api/http-client";
type Envelope<T> = { success: true; data: T; timestamp: string };
const root = (id: string) => `/proposals/${encodeURIComponent(id)}`;
const post = async (path: string, input: unknown, key: string) =>
  (
    await httpClient.post<Envelope<DossierView>>(path, input, {
      headers: { "Idempotency-Key": key },
    })
  ).data.data;
export const dossierApi = {
  detail: async (id: string) =>
    (await httpClient.get<Envelope<DossierView>>(`${root(id)}/dossier`)).data
      .data,
  finalize: (id: string, input: DossierFinalize, key: string) =>
    post(`${root(id)}/finalize`, input, key),
  receive: (id: string, input: DossierReceiptInput, key: string) =>
    post(`${root(id)}/dossier/receipt`, input, key),
  generate: (
    id: string,
    input: { finalizationId: string; expectedRevision: number },
    key: string,
  ) => post(`${root(id)}/dossier/pdf`, input, key),
  download: async (id: string, finalizationId: string) =>
    (
      await httpClient.get<Blob>(`${root(id)}/dossier.pdf`, {
        params: { finalizationId },
        responseType: "blob",
      })
    ).data,
};
