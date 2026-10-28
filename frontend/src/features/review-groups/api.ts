import { httpClient } from '../../shared/api/http-client';
import type {
  GroupCreate,
  GroupUpdate,
  GroupMutation,
  GroupOptions,
  GroupPage,
  ReviewGroupView,
} from '@doan/shared';
type Envelope<T> = { success: true; data: T; timestamp: string };
const read = async <T>(path: string, params?: object) =>
  (await httpClient.get<Envelope<T>>(path, { params })).data.data;
export const reviewGroupApi = {
  terms: () =>
    read<Array<{ id: string; name: string; status: string }>>(
      '/review-group-options/terms',
    ),
  options: (termId: string, page = 1, search = '') =>
    read<GroupOptions>(
      `/terms/${encodeURIComponent(termId)}/review-group-options`,
      { page, limit: 20, search },
    ),
  list: (termId: string, page: number, search: string, departmentId?: string) =>
    read<GroupPage<ReviewGroupView>>(
      `/terms/${encodeURIComponent(termId)}/review-groups`,
      { page, limit: 20, search, departmentId: departmentId || undefined },
    ),
  detail: (id: string) =>
    read<ReviewGroupView>(`/review-groups/${encodeURIComponent(id)}`),
  create: async (termId: string, body: GroupCreate, key: string) =>
    (
      await httpClient.post<Envelope<ReviewGroupView>>(
        `/terms/${encodeURIComponent(termId)}/review-groups`,
        body,
        { headers: { 'Idempotency-Key': key } },
      )
    ).data.data,
  update: async (id: string, body: GroupUpdate, key: string) =>
    (
      await httpClient.patch<Envelope<ReviewGroupView>>(
        `/review-groups/${encodeURIComponent(id)}`,
        body,
        { headers: { 'Idempotency-Key': key } },
      )
    ).data.data,
  archive: async (id: string, body: GroupMutation, key: string) =>
    (
      await httpClient.delete<Envelope<ReviewGroupView>>(
        `/review-groups/${encodeURIComponent(id)}`,
        { data: body, headers: { 'Idempotency-Key': key } },
      )
    ).data.data,
};
