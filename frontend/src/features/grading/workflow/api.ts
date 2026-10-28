import {
  gradingHistoryQuerySchema,
  gradingPdfIdentitySchema,
  gradingPolicyInputSchema,
  gradingSaveSchema,
  workflowCommandSchema,
  type GradeContext,
  type GradingKind,
  type GradingPolicy,
  type GradingCommand,
  type GradingPolicyInput,
  type GradingSave,
  type GradingInbox,
  type AggregateView,
  type PublishedGrade,
} from "@doan/shared";
import { httpClient } from "../../../shared/api/http-client";
import { getAccessToken } from "../../../shared/api/api-session";
export function gradingMode() {
  if (import.meta.env.VITE_GRADING_API !== "true") return "DEMO";
  return import.meta.env.VITE_AUTH_API === "true" ? "API" : "CONFIG_ERROR";
}
export function gradingRoot(termId: string) {
  if (gradingMode() !== "API")
    throw new Error(
      "API chấm điểm yêu cầu VITE_GRADING_API=true và VITE_AUTH_API=true.",
    );
  if (!getAccessToken())
    throw Object.assign(new Error("Vui lòng đăng nhập lại."), { status: 401 });
  if (!termId.trim() || termId.length > 36)
    throw new Error("Đợt không hợp lệ.");
  return `/terms/${encodeURIComponent(termId)}`;
}
const config = { timeout: 75000 };
// 401 keeps using the shared JWT refresh interceptor. Other binary error bodies
// must be decoded explicitly to retain their backend error code.
async function privateGradingBlob(path: string, params: object) {
  const response = await httpClient.get<Blob>(path, {
    ...config,
    params,
    responseType: "blob",
    validateStatus: (status) => status !== 401,
  });
  if (response.status >= 400) {
    let body: { error?: { code?: string; message?: string } } = {};
    if (response.data instanceof Blob && response.data.size <= 1024 * 1024) {
      try {
        const decoded = JSON.parse(await response.data.text());
        if (decoded && typeof decoded === "object" && !Array.isArray(decoded))
          body = decoded;
      } catch {
        /* Not JSON. */
      }
    }
    throw Object.assign(
      new Error(body.error?.message ?? "Không tải được tệp riêng tư."),
      {
        status: response.status,
        code: body.error?.code,
      },
    );
  }
  return response.data;
}
const detail = (termId: string, proposalId: string, kind: GradingKind) => {
  if (!proposalId.trim() || proposalId.length > 36)
    throw new Error("Hồ sơ không hợp lệ.");
  return `${gradingRoot(termId)}/grading/proposals/${encodeURIComponent(proposalId)}/${kind}`;
};
type CommandResult = {
  changed: boolean;
  revision: number;
  expectedContext: string;
};
export type PolicyView = {
  termId: string;
  configured: boolean;
  revision: number;
  config: GradingPolicy | null;
  expectedContext: string;
  needsApproval: string[];
};
export type GradeHistory = {
  items: {
    revision: number;
    state: string;
    recordedAt: string;
    actorUserId: string;
    integrity: string;
    draft: GradeContext["grade"]["draft"];
    total: number | null;
  }[];
  nextRevision: number | null;
};
export const gradingApi = {
  summary: async (termId: string) =>
    (
      await httpClient.get<{
        data: {
          scopedProposals: number;
          admitted: number;
          committees: number;
          reviewerAssignments: number;
          publishedSlots: number;
          publishedResults: number;
          passed: number;
        };
      }>(`${gradingRoot(termId)}/official-reports/summary`, config)
    ).data.data,
  inbox: async (termId: string, kind: GradingKind) =>
    (
      await httpClient.get<{ data: GradingInbox }>(
        `${gradingRoot(termId)}/grading/inbox`,
        { ...config, params: { kind } },
      )
    ).data.data,
  context: async (termId: string, proposalId: string, kind: GradingKind) =>
    (
      await httpClient.get<{ data: GradeContext }>(
        detail(termId, proposalId, kind),
        config,
      )
    ).data.data,
  save: async (
    termId: string,
    proposalId: string,
    kind: GradingKind,
    input: GradingSave,
  ) =>
    (
      await httpClient.put<{ data: CommandResult }>(
        `${detail(termId, proposalId, kind)}/draft`,
        gradingSaveSchema.parse(input),
        config,
      )
    ).data.data,
  seal: async (
    termId: string,
    proposalId: string,
    kind: GradingKind,
    input: GradingCommand,
  ) =>
    (
      await httpClient.post<{ data: CommandResult }>(
        `${detail(termId, proposalId, kind)}/seal`,
        workflowCommandSchema.parse(input),
        config,
      )
    ).data.data,
  history: async (
    termId: string,
    proposalId: string,
    kind: GradingKind,
    afterRevision = 0,
  ) =>
    (
      await httpClient.get<{ data: GradeHistory }>(
        `${detail(termId, proposalId, kind)}/history`,
        {
          ...config,
          params: gradingHistoryQuerySchema.parse({ afterRevision, limit: 25 }),
        },
      )
    ).data.data,
  policy: async (termId: string) =>
    (
      await httpClient.get<{ data: PolicyView }>(
        `${gradingRoot(termId)}/grading/policy`,
        config,
      )
    ).data.data,
  configure: async (termId: string, input: GradingPolicyInput) =>
    (
      await httpClient.put<{ data: CommandResult }>(
        `${gradingRoot(termId)}/grading/policy`,
        gradingPolicyInputSchema.parse(input),
        config,
      )
    ).data.data,
  preview: async (termId: string) =>
    (
      await httpClient.get<{
        data: {
          termId: string;
          items: AggregateView[];
          needsApproval: boolean;
        };
      }>(`${gradingRoot(termId)}/grading/results/preview`, config)
    ).data.data,
  resultCommand: async (
    termId: string,
    proposalId: string,
    publish: boolean,
    input: GradingCommand,
  ) =>
    (
      await httpClient.post<{ data: CommandResult }>(
        `${gradingRoot(termId)}/grading/results/${encodeURIComponent(proposalId)}/${publish ? "publish" : "seal"}`,
        workflowCommandSchema.parse(input),
        config,
      )
    ).data.data,
  myResults: async (termId: string) =>
    (
      await httpClient.get<{
        data: { termId: string; items: PublishedGrade[] };
      }>(`${gradingRoot(termId)}/grading/my-results`, config)
    ).data.data,
  download: async (
    termId: string,
    proposalId: string,
    kind: GradingKind,
    identity: unknown,
  ) =>
    privateGradingBlob(
      `${detail(termId, proposalId, kind)}/report`,
      gradingPdfIdentitySchema.parse(identity),
    ),
  export: async (
    termId: string,
    kind: "RESULTS" | "REVIEWERS" | "SCHEDULE",
    format: "XLSX" | "PDF",
    filters: { committeeKey?: string; className?: string } = {},
  ) =>
    privateGradingBlob(`${gradingRoot(termId)}/official-reports/export`, {
      kind,
      format,
      ...filters,
    }),
};
export function gradingBlockerText(code: string) {
  const messages: Record<string, string> = {
    CALCULATION_POLICY_NEEDS_APPROVAL:
      "Chưa duyệt quorum và quy tắc làm tròn; chưa được tính/công bố điểm cuối.",
    ADVISOR_GRADE_UNKNOWN_OR_STALE:
      "Chưa có điểm GVHD cuối cùng đã xác minh cho đúng PDF và phân công.",
    COUNCIL_RESULT_CONFIRMATION_NEEDS_APPROVAL:
      "Chưa có xác nhận tập thể có thẩm quyền cho đúng các phiếu chấm.",
    GRADING_WINDOW_CLOSED:
      "Mốc chấm chưa mở, hết hạn, bị khóa hoặc chưa được cấu hình.",
    GRADING_TERM_CLOSED: "Trạng thái đợt không cho phép ghi điểm.",
    GRADING_NOT_IN_DEFENSE_SESSION: "Chưa ở buổi bảo vệ chính thức của hồ sơ.",
    GRADING_RESULT_NEEDS_APPROVAL:
      "Chưa thể chốt/công bố: thiếu policy hoặc nguồn điểm/xác nhận chính thức đã duyệt.",
    GRADING_SOURCE_REQUIRED:
      "Thiếu nguồn chính thức, PDF đã xác minh hoặc rubric.",
    GRADING_UC18_REQUIRED: "Danh sách UC18 chưa được chốt hợp lệ.",
    GRADING_OFFICIAL_SOURCE_REQUIRED:
      "Phân công hội đồng/phản biện/lịch chưa chốt hoặc không nhất quán.",
    GRADING_SHEET_SEALED:
      "Phiếu đã chốt; sửa sau chốt cần quy trình và quyền được duyệt.",
    REPORT_TEMPLATE_NOT_CONFIGURED:
      "Chưa có mẫu biểu chuẩn được cấu hình; chưa thể xuất biên bản để ký.",
    REPORT_NO_DATA: "Không có dữ liệu chính thức trong phạm vi hoặc bộ lọc.",
    RUBRIC_NOT_CONFIGURED: "Chưa có rubric Hội đồng được cấu hình.",
    GRADE_LEGACY_OR_INVALID:
      "Phiếu legacy hoặc bằng chứng không đủ xác minh; không dùng làm điểm chính thức.",
    GRADING_PARAMETERS_UNVERIFIED:
      "Thiếu tham số trọng số/ngưỡng đạt của đợt đã xác minh. Không dùng mặc định.",
    CALCULATION_PARAMETER_PROFILE_UNSUPPORTED:
      "Tham số của đợt khác scheme tính điểm đã duyệt; cần đối soát policy trước khi tính/công bố.",
  };
  if (messages[code]) return `${code} — ${messages[code]}`;
  if (code.startsWith("MISSING_SEALED_"))
    return `Thiếu phiếu đã chốt: ${code.split(":")[1] ?? code}.`;
  if (code.startsWith("STALE_GRADE:"))
    return `Nguồn của phiếu đã thay đổi: ${code.split(":")[1]}.`;
  return code;
}
export function gradingErrorText(error: unknown) {
  const e = error as { status?: number; message?: string; code?: string };
  if (e.code && gradingBlockerText(e.code) !== e.code)
    return `${e.status ? `${e.status} — ` : ""}${gradingBlockerText(e.code)}`;
  if (e.status === 409)
    return "409 — Nguồn, revision hoặc điều kiện đã đổi. Tải và xem lại dữ liệu trước khi thử tiếp.";
  if (e.status === 403)
    return "403 — Không có permission, grant hoặc phân công phù hợp.";
  if (e.status === 401)
    return "401 — Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.";
  if (e.status === 503)
    return "503 — Schema hoặc nguồn chấm điểm chưa sẵn sàng. Không có dữ liệu demo thay thế.";
  return `${e.status ? `${e.status} — ` : ""}${e.message || "Không kết nối được máy chủ."}`;
}
export function savePrivateDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
