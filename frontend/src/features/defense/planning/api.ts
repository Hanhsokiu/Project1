import {
  committeePreviewSchema,
  reviewerPreviewSchema,
  schedulePreviewSchema,
  type CommitteePreviewInput,
  type ReviewerPreviewInput,
  type SchedulePreviewInput,
  type PlanningContext,
  type PlanningPreview,
  type LegacyCommittee,
  type LegacyReviewer,
  type LegacySchedule,
} from "@doan/shared";
import { httpClient } from "../../../shared/api/http-client";
import { getAccessToken } from "../../../shared/api/api-session";

export function defensePlanningMode(): "DEMO" | "API" | "CONFIGURATION_ERROR" {
  if (import.meta.env.VITE_DEFENSE_PLANNING_API !== "true") return "DEMO";
  return import.meta.env.VITE_AUTH_API === "true"
    ? "API"
    : "CONFIGURATION_ERROR";
}
function path(termId?: string) {
  if (defensePlanningMode() !== "API")
    throw new Error(
      "UC19–21 API cần VITE_DEFENSE_PLANNING_API=true và VITE_AUTH_API=true.",
    );
  if (!getAccessToken())
    throw Object.assign(new Error("Vui lòng đăng nhập lại."), { status: 401 });
  if (termId !== undefined && (!termId.trim() || termId.length > 36))
    throw new Error("Đợt không hợp lệ.");
  return `/terms/${encodeURIComponent(termId || "")}/defense-planning`;
}
const read = async <T>(url: string) =>
  (await httpClient.get<{ data: T }>(url)).data.data;
const post = async (url: string, body: unknown) =>
  (await httpClient.post<{ data: PlanningPreview }>(url, body)).data.data;
export const planningApi = {
  terms: () => {
    path();
    return read<{ items: { id: string; name: string; status: string }[] }>(
      "/defense-planning/terms",
    );
  },
  context: (id: string) => read<PlanningContext>(`${path(id)}/context`),
  committees: (id: string) =>
    read<{ items: LegacyCommittee[]; official: false }>(
      `${path(id)}/committees`,
    ),
  committee: (id: string, committeeId: string) =>
    read<{ record: LegacyCommittee; official: false }>(
      `${path(id)}/committees/${encodeURIComponent(committeeId)}`,
    ),
  reviewers: (id: string) =>
    read<{ items: LegacyReviewer[]; official: false }>(`${path(id)}/reviewers`),
  schedule: (id: string) =>
    read<{ items: LegacySchedule[]; official: false }>(`${path(id)}/schedule`),
  previewCommittees: (id: string, input: CommitteePreviewInput) =>
    post(`${path(id)}/committees/preview`, committeePreviewSchema.parse(input)),
  previewReviewers: (id: string, input: ReviewerPreviewInput) =>
    post(`${path(id)}/reviewers/preview`, reviewerPreviewSchema.parse(input)),
  previewSchedule: (id: string, input: SchedulePreviewInput) =>
    post(`${path(id)}/schedule/preview`, schedulePreviewSchema.parse(input)),
};
export function planningErrorMessage(error: unknown) {
  const status = (error as { status?: number } | null)?.status;
  if (status === 401) return "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.";
  if (status === 403)
    return "Cần quyền đọc/preview của Khoa và AcademicTermGrant toàn đợt phù hợp. ADMIN không tự bỏ qua grant.";
  if (status === 404)
    return "Không tìm thấy đợt/hội đồng trong phạm vi được phép.";
  if (status === 409)
    return "Nguồn UC18, phân công hoặc PDF đã thay đổi. Tải lại dữ liệu và khởi tạo lại phương án trước khi preview.";
  if (status === 400 || status === 422)
    return "Phương án chưa hợp lệ. Kiểm tra tên, vai trò, số thành viên, mã hồ sơ và thời gian.";
  return error instanceof Error
    ? error.message
    : "Không thể tải dữ liệu hoặc kiểm tra phương án. Không dùng dữ liệu demo thay thế.";
}
