import { httpClient } from "../../../shared/api/http-client";
import { getAccessToken } from "../../../shared/api/api-session";
import { finalReportMode } from "./config";
import {
  expectedRevisionSchema,
  finalReportContextSchema,
  finalReportSchema,
  proposalIdSchema,
} from "./contracts";

const path = (id: string) => {
  if (finalReportMode() !== "API")
    throw new Error(
      "API PDF thật yêu cầu VITE_FINAL_REPORT_API=true và VITE_AUTH_API=true.",
    );
  if (!getAccessToken())
    throw Object.assign(new Error("Vui lòng đăng nhập lại."), { status: 401 });
  return `/proposals/${encodeURIComponent(proposalIdSchema.parse(id))}`;
};
type Envelope = { data: unknown };
export const finalReportApi = {
  context: async (id: string) => {
    const result = finalReportContextSchema.parse(
      (await httpClient.get<Envelope>(`${path(id)}/final-report-context`)).data
        .data,
    );
    if (
      result.proposalId !== id.trim() ||
      result.report.proposalId !== result.proposalId
    )
      throw new Error("Context PDF không khớp hồ sơ được yêu cầu.");
    return result;
  },
  metadata: async (id: string) => {
    const result = finalReportSchema.parse(
      (await httpClient.get<Envelope>(`${path(id)}/final-report`)).data.data,
    );
    if (result.proposalId !== id.trim())
      throw new Error("Metadata PDF không khớp hồ sơ được yêu cầu.");
    return result;
  },
  upload: async (
    id: string,
    file: File,
    expectedRevision: number,
    progress?: (percent: number) => void,
  ) => {
    const url = `${path(id)}/final-report`;
    const revision = expectedRevisionSchema.parse(expectedRevision);
    if (!(file instanceof Blob))
      throw new Error("Cần chọn một tệp PDF từ thiết bị.");
    const body = new FormData();
    body.append("file", file, file.name);
    body.append("expectedRevision", String(revision));
    const response = await httpClient.put<Envelope>(url, body, {
      // The browser supplies the multipart boundary, as in Step 8.
      headers: { "Content-Type": undefined },
      onUploadProgress: (event) =>
        progress?.(
          event.total
            ? Math.min(99, Math.round((100 * event.loaded) / event.total))
            : 0,
        ),
    });
    const result = finalReportSchema.parse(response.data.data);
    if (
      result.proposalId !== id.trim() ||
      result.state !== "SUBMITTED" ||
      result.revision !== revision + 1
    )
      throw new Error(
        "Chưa xác minh được kết quả nộp PDF. Hãy tải lại dữ liệu trước khi thử tiếp.",
      );
    return result;
  },
  download: async (id: string): Promise<Blob> => {
    const response = await httpClient.get<Blob>(
      `${path(id)}/final-report/download`,
      { responseType: "blob" },
    );
    if (
      !(response.data instanceof Blob) ||
      response.data.size === 0 ||
      response.data.type.split(";")[0].toLowerCase() !== "application/pdf"
    )
      throw new Error("Máy chủ không trả về tệp PDF hợp lệ.");
    return response.data;
  },
};

/** A short-lived Blob URL only; no demo URL, storage path or persisted PDF. */
export function saveFinalReportBlob(blob: Blob) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  // This student endpoint downloads the current PDF, without a revision assertion.
  // A fixed safe filename avoids labelling newer bytes with stale metadata.
  anchor.download = "final-report.pdf";
  try {
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
}
