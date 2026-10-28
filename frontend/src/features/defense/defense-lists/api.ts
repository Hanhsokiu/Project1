import { httpClient } from "../../../shared/api/http-client";
import { getAccessToken } from "../../../shared/api/api-session";
import type {
  ReviewRow,
  ReviewTerm,
} from "../../guidance/defense-confirmations/types";
export function defenseListMode(): "DEMO" | "API" | "CONFIGURATION_ERROR" {
  if (import.meta.env.VITE_DEFENSE_LIST_API !== "true") return "DEMO";
  return import.meta.env.VITE_AUTH_API === "true"
    ? "API"
    : "CONFIGURATION_ERROR";
}
export type ListState = {
  configured: boolean;
  state: "DRAFT" | "OPEN" | "FINALIZED" | null;
  revision: number | null;
  openedAt: string | null;
  uc18: { state: string; reason?: string };
};
export type Preview = {
  termId: string;
  scope: "TERM" | "DEPARTMENTS";
  rosterCompleteForTerm: boolean;
  rosterCount: number;
  admittedCount: number;
  total: number;
  page: number;
  limit: number;
  items: (ReviewRow & {
    evidence: {
      result: string;
      admitted: false;
      officialEligibility: "UNKNOWN";
      reasons: string[];
    };
  })[];
  uc18: { state: string };
  capabilities: {
    canManage: boolean;
    canFinalize: boolean;
    canReopen: boolean;
  };
  blockers: { code: string; message: string }[];
  notice: string;
};
function path(termId?: string) {
  if (defenseListMode() !== "API")
    throw new Error(
      "UC18 API cần VITE_DEFENSE_LIST_API=true và VITE_AUTH_API=true.",
    );
  if (!getAccessToken())
    throw Object.assign(new Error("Vui lòng đăng nhập lại."), { status: 401 });
  if (termId !== undefined && (!termId.trim() || termId.length > 36))
    throw new Error("Đợt không hợp lệ.");
  return `/terms/${encodeURIComponent(termId || "")}/defense-list`;
}
const read = async <T>(url: string, params?: object) =>
  (await httpClient.get<{ data: T }>(url, { params })).data.data;
export const defenseListApi = {
  terms: () => {
    path();
    return read<{ items: ReviewTerm[] }>("/defense-lists/terms");
  },
  state: (id: string) => read<ListState>(path(id)),
  preview: (id: string, page = 1, result = "ALL") =>
    read<Preview>(`${path(id)}/preview`, { page, limit: 25, result }),
  create: async (id: string) =>
    (await httpClient.post<{ data: ListState }>(path(id), {})).data.data,
  open: async (id: string, expectedRevision: number) => {
    const url = `${path(id)}/open`;
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0)
      throw new Error("Revision không hợp lệ; hãy tải lại dữ liệu.");
    return (
      await httpClient.post<{ data: ListState }>(url, { expectedRevision })
    ).data.data;
  },
};
