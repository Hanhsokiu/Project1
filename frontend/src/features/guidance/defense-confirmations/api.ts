import { httpClient } from "../../../shared/api/http-client";
import { getAccessToken } from "../../../shared/api/api-session";
import { defenseConfirmationMode } from "./config";
import { decisionInputSchema, pdfIdentitySchema } from "./validation";
import type {
  ConfirmationContext,
  DecisionInput,
  DecisionResponse,
  DecisionResult,
  HistoryResponse,
  PdfIdentity,
  InboxResponse,
  ReviewTerm,
} from "./types";

type Envelope<T> = { data: T };
function requireApi() {
  if (defenseConfirmationMode() !== "API")
    throw new Error(
      "UC17 API thật yêu cầu VITE_DEFENSE_CONFIRMATION_API=true và VITE_AUTH_API=true.",
    );
  if (!getAccessToken())
    throw Object.assign(new Error("Vui lòng đăng nhập lại."), { status: 401 });
}
const path = (proposalId: string) => {
  requireApi();
  if (!proposalId.trim() || proposalId.length > 36)
    throw new Error("Mã hồ sơ không hợp lệ.");
  return `/proposals/${encodeURIComponent(proposalId)}`;
};
const read = async <T>(url: string, params?: object) =>
  (await httpClient.get<Envelope<T>>(url, { params })).data.data;

export const defenseConfirmationApi = {
  terms: () => {
    requireApi();
    return read<{ items: ReviewTerm[] }>("/defense-confirmations/terms");
  },
  inbox: (params: {
    termId: string;
    view: InboxResponse["view"];
    status: string;
    page: number;
  }) => {
    requireApi();
    return read<InboxResponse>("/defense-confirmations/inbox", {
      ...params,
      limit: 25,
    });
  },
  context: (id: string) =>
    read<ConfirmationContext>(`${path(id)}/defense-confirmation-context`),
  decision: (id: string) =>
    read<DecisionResponse>(`${path(id)}/defense-confirmation`),
  history: (id: string, afterRevision?: number) =>
    read<HistoryResponse>(`${path(id)}/defense-confirmation/history`, {
      afterRevision,
      limit: 50,
    }),
  put: async (id: string, input: DecisionInput) => {
    const url = `${path(id)}/defense-confirmation`;
    const body = decisionInputSchema.parse(input);
    return (await httpClient.put<Envelope<DecisionResult>>(url, body)).data
      .data;
  },
  download: async (id: string, identity: PdfIdentity): Promise<Blob> => {
    const url = `${path(id)}/defense-confirmation/report/download`;
    const params = pdfIdentitySchema.parse(identity);
    const response = await httpClient.get<Blob>(url, {
      params,
      responseType: "blob",
    });
    if (
      !(response.data instanceof Blob) ||
      response.data.size === 0 ||
      response.data.type.split(";")[0].toLowerCase() !== "application/pdf"
    )
      throw new Error("Máy chủ không trả về tệp PDF hợp lệ.");
    return response.data;
  },
};

export function saveReportBlob(blob: Blob, originalName: string) {
  const basename = originalName.split(/[\\/]/).pop() || "";
  const name = Array.from(basename, (char) =>
    char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? "_" : char,
  )
    .join("")
    .replace(/[<>:"|?*]/g, "_")
    .slice(0, 150);
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = name?.toLowerCase().endsWith(".pdf")
    ? name
    : "final-report.pdf";
  try {
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
}
