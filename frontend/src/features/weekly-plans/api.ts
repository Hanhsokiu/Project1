import { httpClient } from "../../shared/api/http-client";
import type { WeeklyPlanView, WeeklySummary, WeeklyQuery } from "@doan/shared";
const read = async <T>(url: string, params?: object) =>
  (await httpClient.get<{ data: T }>(url, { params })).data.data;
export const weeklyApi = {
  options: () =>
    read<Array<{ id: string; name: string; canManage: boolean }>>(
      "/weekly-plans/options",
    ),
  plans: (term: string) =>
    read<WeeklyPlanView[]>(`/terms/${encodeURIComponent(term)}/weekly-plans`),
  summary: (term: string, query: WeeklyQuery) =>
    read<WeeklySummary>(
      `/terms/${encodeURIComponent(term)}/weekly-progress`,
      query,
    ),
  history: (term: string, id: string) =>
    read<
      Array<{
        id: string;
        createdAt: string;
        newValue: {
          reason?: string;
          before?: WeeklyPlanView;
          after?: WeeklyPlanView;
        };
      }>
    >(
      `/terms/${encodeURIComponent(term)}/weekly-plans/${encodeURIComponent(id)}/history`,
    ),
  write: async (
    term: string,
    body: unknown,
    key: string,
    id?: string,
    state = false,
  ) =>
    (
      await httpClient.request<{ data: WeeklyPlanView }>({
        method: id && !state ? "PATCH" : "POST",
        url: `/terms/${encodeURIComponent(term)}/weekly-plans${id ? "/" + encodeURIComponent(id) : ""}${state ? "/state" : ""}`,
        data: body,
        headers: { "Idempotency-Key": key },
      })
    ).data.data,
};
