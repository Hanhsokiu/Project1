import { httpClient } from "../../shared/api/http-client";
import type {
  ProgressReviewContext,
  ProgressReviewView,
  ProgressReviewCreate,
  ProgressReviewAmend,
  GuidanceMonitorQuery,
  GuidanceMonitorPage,
  GuidanceDashboard,
  GuidanceMeetingPage,
  GuidanceMeetingCreate,
  GuidanceMeetingAmend,
  GuidanceMeetingView,
  GuidanceNotificationView,
  GroupPage,
} from "@doan/shared";
type Envelope<T> = { success: true; data: T };
const get = async <T>(url: string, params?: object) =>
  (await httpClient.get<Envelope<T>>(url, { params })).data.data;
const write = async <T>(
  method: "POST" | "PATCH",
  url: string,
  body: unknown,
  key: string,
) =>
  (
    await httpClient.request<Envelope<T>>({
      method,
      url,
      data: body,
      headers: { "Idempotency-Key": key },
    })
  ).data.data;
export const progressApi = {
  options: () =>
    get<{
      terms: Array<{ id: string; name: string; status: string }>;
      canReview: boolean;
      canMonitor: boolean;
    }>("/guidance-review-options/terms"),
  inbox: (termId: string, q: GuidanceMonitorQuery) =>
    get<GuidanceMonitorPage>(
      `/terms/${encodeURIComponent(termId)}/progress-review-inbox`,
      q,
    ),
  dashboard: (termId: string, q: GuidanceMonitorQuery) =>
    get<GuidanceDashboard>(
      `/terms/${encodeURIComponent(termId)}/guidance-dashboard`,
      q,
    ),
  context: (id: string) =>
    get<ProgressReviewContext>(
      `/task-submissions/${encodeURIComponent(id)}/review-context`,
    ),
  record: (id: string, input: ProgressReviewCreate, key: string) =>
    write<ProgressReviewView>(
      "POST",
      `/task-submissions/${encodeURIComponent(id)}/reviews`,
      input,
      key,
    ),
  amend: (id: string, input: ProgressReviewAmend, key: string) =>
    write<ProgressReviewView>(
      "POST",
      `/task-reviews/${encodeURIComponent(id)}/amendments`,
      input,
      key,
    ),
  meetings: (id: string, page: number) =>
    get<GuidanceMeetingPage>(
      `/guidance-plans/${encodeURIComponent(id)}/meetings`,
      { page, limit: 10 },
    ),
  createMeeting: (id: string, input: GuidanceMeetingCreate, key: string) =>
    write<GuidanceMeetingView>(
      "POST",
      `/guidance-plans/${encodeURIComponent(id)}/meetings`,
      input,
      key,
    ),
  amendMeeting: (id: string, input: GuidanceMeetingAmend, key: string) =>
    write<GuidanceMeetingView>(
      "PATCH",
      `/guidance-meetings/${encodeURIComponent(id)}`,
      input,
      key,
    ),
  notifications: (page: number) =>
    get<GroupPage<GuidanceNotificationView>>("/me/notifications", {
      page,
      limit: 20,
    }),
  read: (id: string) =>
    httpClient.post(`/me/notifications/${encodeURIComponent(id)}/read`, {}),
};
