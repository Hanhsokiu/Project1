import type {
  ProposalEditorContext,
  ProposalVersionPage,
  ProposalVersionView,
  ProposalVersionMutationView,
  ProposalVersionSave,
  ProposalVersionSubmit,
  DataChange,
  ProposalLifecycleAction,
  ProposalLifecycleView,
  ProposalWithdraw,
  ProposalReturnToDraft,
  ProposalReopen,
} from '@doan/shared';
import { httpClient } from '../../shared/api/http-client';
type Envelope<T> = { success: true; data: T; timestamp: string };
const read = async <T>(path: string, params?: object) =>
  (await httpClient.get<Envelope<T>>(path, { params })).data.data;
const post = async <T = ProposalVersionMutationView>(
  path: string,
  body: unknown,
  key: string,
) =>
  (
    await httpClient.post<Envelope<T>>(path, body, {
      headers: { 'Idempotency-Key': key },
    })
  ).data.data;
const root = (id: string) => `/proposals/${encodeURIComponent(id)}`;
export const proposalVersionApi = {
  context: (id: string) =>
    read<ProposalEditorContext>(`${root(id)}/editing-context`),
  list: (id: string, page = 1) =>
    read<ProposalVersionPage>(`${root(id)}/versions`, { page, limit: 20 }),
  detail: (id: string, versionId: string) =>
    read<ProposalVersionView>(
      `${root(id)}/versions/${encodeURIComponent(versionId)}`,
    ),
  compare: (id: string, fromVersionId: string, toVersionId: string) =>
    read<{ fromVersionId: string; toVersionId: string; changes: DataChange[] }>(
      `${root(id)}/versions/compare`,
      { fromVersionId, toVersionId },
    ),
  save: (id: string, body: ProposalVersionSave, key: string) =>
    post(`${root(id)}/versions`, body, key),
  submit: (id: string, body: ProposalVersionSubmit, key: string) =>
    post(`${root(id)}/submit`, body, key),
  transition: (
    id: string,
    action: ProposalLifecycleAction,
    body: ProposalWithdraw | ProposalReturnToDraft | ProposalReopen,
    key: string,
  ) => post<ProposalLifecycleView>(`${root(id)}/${action}`, body, key),
};
