import {
  academicEvidenceCommandSchema,
  workflowCommandSchema,
  workflowPolicyCommandSchema,
  workflowReopenSchema,
  stageSaveSchema,
  scheduleAmendSchema,
  type AcademicEvidenceInput,
  type DefenseStage,
  type DefenseWorkflowContext,
  type WorkflowCommand,
  type WorkflowPolicyInput,
  type StageSaveInput,
  type PublishedDefenseSchedule,
  type DefenseWorkflowHistory,
} from "@doan/shared";
import { httpClient } from "../../../shared/api/http-client";
import { getAccessToken } from "../../../shared/api/api-session";
export function officialWorkflowEnabled() {
  return (
    import.meta.env.VITE_AUTH_API === "true" &&
    (import.meta.env.VITE_DEFENSE_LIST_API === "true" ||
      import.meta.env.VITE_DEFENSE_PLANNING_API === "true")
  );
}
function root(termId: string) {
  if (!officialWorkflowEnabled())
    throw new Error(
      "Workflow thật yêu cầu feature flag UC18/UC19–21 và JWT auth.",
    );
  if (!getAccessToken())
    throw Object.assign(new Error("Vui lòng đăng nhập lại."), { status: 401 });
  if (!termId.trim() || termId.length > 36)
    throw new Error("Đợt không hợp lệ.");
  return `/terms/${encodeURIComponent(termId)}`;
}
export type WorkflowResult = {
  changed: boolean;
  revision: number;
  expectedContext: string;
  artifactId?: string;
  version?: number;
};
const post = async (url: string, body: unknown) =>
  (
    await httpClient.post<{ data: WorkflowResult }>(url, body, {
      timeout: 75000,
    })
  ).data.data;
export const workflowApi = {
  artifacts: async (id: string) =>
    (
      await httpClient.get<{ data: DefenseWorkflowHistory }>(
        `${root(id)}/defense-workflow/history`,
      )
    ).data.data,
  context: async (id: string) =>
    (
      await httpClient.get<{ data: DefenseWorkflowContext }>(
        `${root(id)}/defense-workflow`,
        { timeout: 75000 },
      )
    ).data.data,
  configure: async (id: string, input: WorkflowPolicyInput) =>
    (
      await httpClient.put<{ data: WorkflowResult }>(
        `${root(id)}/defense-list/workflow-policy`,
        workflowPolicyCommandSchema.parse(input),
        { timeout: 75000 },
      )
    ).data.data,
  academic: async (id: string, input: AcademicEvidenceInput) =>
    post(
      `${root(id)}/defense-list/academic-evidence`,
      academicEvidenceCommandSchema.parse(input),
    ),
  history: async (id: string, memberId: string) =>
    (
      await httpClient.get<{
        data: {
          items: {
            id: string;
            revision: number;
            verdict: string;
            sourceReference: string;
            note: string;
            verifiedAt: string;
            integrity: string;
          }[];
        };
      }>(
        `${root(id)}/defense-list/academic-evidence/${encodeURIComponent(memberId)}`,
      )
    ).data.data,
  finalizeList: async (id: string, input: WorkflowCommand) =>
    post(
      `${root(id)}/defense-list/finalize`,
      workflowCommandSchema.parse(input),
    ),
  reopen: async (id: string, input: WorkflowCommand & { reason: string }) =>
    post(`${root(id)}/defense-list/reopen`, workflowReopenSchema.parse(input)),
  save: async (id: string, stage: DefenseStage, input: StageSaveInput) =>
    (
      await httpClient.put<{ data: WorkflowResult }>(
        `${root(id)}/defense-workflow/${stage}/draft`,
        stageSaveSchema.parse(input),
        { timeout: 75000 },
      )
    ).data.data,
  seal: async (id: string, stage: DefenseStage, input: WorkflowCommand) =>
    post(
      `${root(id)}/defense-workflow/${stage}/finalize`,
      workflowCommandSchema.parse(input),
    ),
  publish: async (id: string, input: WorkflowCommand) =>
    post(
      `${root(id)}/defense-workflow/SCHEDULE/publish`,
      workflowCommandSchema.parse(input),
    ),
  amend: async (id: string, input: StageSaveInput & { reason: string }) =>
    post(
      `${root(id)}/defense-workflow/SCHEDULE/amend`,
      scheduleAmendSchema.parse(input),
    ),
  published: async (id: string) =>
    (
      await httpClient.get<{ data: PublishedDefenseSchedule }>(
        `${root(id)}/defense-schedule/published`,
      )
    ).data.data,
};
export function workflowError(error: unknown) {
  const e = error as { status?: number; message?: string };
  if (e.status === 409)
    return `Nguồn/revision đã thay đổi hoặc mốc không cho phép. Tải lại và xem dữ liệu trước khi thử lại. ${e.message ?? ""}`;
  if (e.status === 403)
    return "Không có permission hoặc grant đúng phạm vi đợt. ADMIN không tự được bỏ qua grant.";
  if (e.status === 401)
    return "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.";
  if (e.status === 503)
    return "Schema hoặc nguồn chính thức chưa sẵn sàng. Không có dữ liệu nào được giả lập lưu thành công.";
  return (
    e.message ||
    "Không xác định được kết quả thao tác. Hãy tải lại backend trước khi thử lại."
  );
}
