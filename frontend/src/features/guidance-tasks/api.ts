import { httpClient } from "../../shared/api/http-client";
import type {
  GuidanceContext,
  GuidancePlanView,
  GuidanceTaskView,
  GuidanceTaskPage,
  GuidanceTaskQuery,
  GuidancePeriodView,
  WeeklyCoveragePage,
} from "@doan/shared";
type Envelope<T> = { success: true; data: T; timestamp: string };
const read = async <T>(url: string, params?: object) =>
  (await httpClient.get<Envelope<T>>(url, { params })).data.data;
const write = async <T>(
  method: "POST" | "PATCH",
  url: string,
  data: unknown,
  key: string,
) =>
  (
    await httpClient.request<Envelope<T>>({
      url,
      method,
      data,
      headers: { "Idempotency-Key": key },
    })
  ).data.data;
export const guidanceApi = {
  context: (id: string) =>
    read<GuidanceContext>(
      `/proposals/${encodeURIComponent(id)}/guidance-context`,
    ),
  createPlan: (id: string, input: unknown, key: string) =>
    write<GuidancePlanView>(
      "POST",
      `/proposals/${encodeURIComponent(id)}/guidance-plan`,
      input,
      key,
    ),
  updatePlan: (id: string, input: unknown, key: string) =>
    write<GuidancePlanView>(
      "PATCH",
      `/guidance-plans/${encodeURIComponent(id)}`,
      input,
      key,
    ),
  resume: (id: string, input: unknown, key: string) =>
    write<GuidancePlanView>(
      "POST",
      `/guidance-plans/${encodeURIComponent(id)}/resume`,
      input,
      key,
    ),
  periods: (termId: string) =>
    read<GuidancePeriodView[]>(
      `/terms/${encodeURIComponent(termId)}/guidance-periods`,
    ),
  tasks: (termId: string, q: GuidanceTaskQuery) =>
    read<GuidanceTaskPage>(
      `/terms/${encodeURIComponent(termId)}/guidance-tasks`,
      q,
    ),
  planTasks: (id: string, q: GuidanceTaskQuery) =>
    read<GuidanceTaskPage>(
      `/guidance-plans/${encodeURIComponent(id)}/tasks`,
      q,
    ),
  task: (id: string) =>
    read<GuidanceTaskView>(`/tasks/${encodeURIComponent(id)}`),
  createTask: (id: string, input: unknown, key: string) =>
    write<GuidanceTaskView>(
      "POST",
      `/guidance-plans/${encodeURIComponent(id)}/tasks`,
      input,
      key,
    ),
  updateTask: (id: string, input: unknown, key: string) =>
    write<GuidanceTaskView>(
      "PATCH",
      `/tasks/${encodeURIComponent(id)}`,
      input,
      key,
    ),
  progress: (id: string, input: unknown, key: string) =>
    write<GuidanceTaskView>(
      "POST",
      `/tasks/${encodeURIComponent(id)}/progress`,
      input,
      key,
    ),
  cancel: (id: string, input: unknown, key: string) =>
    write<GuidanceTaskView>(
      "POST",
      `/tasks/${encodeURIComponent(id)}/cancel`,
      input,
      key,
    ),
  coverage: (
    termId: string,
    q: { page: number; limit: number; periodId?: string },
  ) =>
    read<WeeklyCoveragePage>(
      `/terms/${encodeURIComponent(termId)}/weekly-report-coverage`,
      q,
    ),
  ensure: (id: string, input: unknown, key: string) =>
    write<GuidanceTaskView>(
      "POST",
      `/weekly-report-obligations/${encodeURIComponent(id)}/task`,
      input,
      key,
    ),
};
