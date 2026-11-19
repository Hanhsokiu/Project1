import type {
  ReportExport,
  ReportExportMetadata,
  ReportFilter,
  ReportOptions,
  ReportPreview,
  ReportRequest,
  ReportStatistics,
  ReportTemplate,
} from "@doan/shared";
import type { WorkflowTerm } from "../../../shared/hooks/use-workflow-terms";
import { httpClient } from "../../../shared/api/http-client";
type Envelope<T> = { data: T };
const root = "/defense-reports";
export type ExportHistory = Pick<
  ReportExportMetadata,
  | "id"
  | "templateCode"
  | "templateVersion"
  | "mode"
  | "status"
  | "createdAt"
  | "count"
>;
export const reportingKeys = {
  options: (actorScope: string, f: Partial<ReportFilter>) =>
    ["defense-report-options", actorScope, f] as const,
  templates: (actorScope: string, f: ReportFilter) =>
    ["defense-report-templates", actorScope, f] as const,
  statistics: (actorScope: string, f: ReportFilter) =>
    ["defense-report-statistics", actorScope, f] as const,
  history: (actorScope: string, f: ReportFilter) =>
    ["defense-report-history", actorScope, f] as const,
};
export const reportingApi = {
  options: async (f: Partial<ReportFilter>) =>
    (
      await httpClient.get<
        Envelope<Omit<ReportOptions, "terms"> & { terms: WorkflowTerm[] }>
      >(root + "/options", { params: f })
    ).data.data,
  templates: async (f: ReportFilter) =>
    (
      await httpClient.get<
        Envelope<{ templates: ReportTemplate[]; blockers: string[] }>
      >(root + "/templates", { params: f })
    ).data.data,
  statistics: async (f: ReportFilter) =>
    (
      await httpClient.get<Envelope<ReportStatistics>>(root + "/statistics", {
        params: f,
      })
    ).data.data,
  preview: async (b: ReportRequest) =>
    (
      await httpClient.post<Envelope<ReportPreview>>(
        root + "/exports/preview",
        b,
      )
    ).data.data,
  create: async (b: ReportExport, key: string) =>
    (
      await httpClient.post<Envelope<ReportExportMetadata>>(
        root + "/exports",
        b,
        { headers: { "Idempotency-Key": key } },
      )
    ).data.data,
  history: async (f: ReportFilter) =>
    (
      await httpClient.get<Envelope<ExportHistory[]>>(root + "/exports", {
        params: f,
      })
    ).data.data,
  detail: async (id: string) =>
    (
      await httpClient.get<
        Envelope<ReportExportMetadata & { current: boolean; expired: boolean }>
      >(root + "/exports/" + encodeURIComponent(id))
    ).data.data,
  download: async (id: string, key: string) => {
    try {
      return (
        await httpClient.post<Blob>(
          root + "/exports/" + encodeURIComponent(id) + "/download",
          {},
          { responseType: "blob", headers: { "Idempotency-Key": key } },
        )
      ).data;
    } catch (e) {
      const error = e as { response?: { data?: unknown } };
      if (error.response?.data instanceof Blob) {
        try {
          const payload = JSON.parse(await error.response.data.text());
          error.response.data = payload;
        } catch {
          /* Preserve the safe generic HTTP error. */
        }
      }
      throw e;
    }
  },
};
export function saveReportBlob(blob: Blob, filename: string) {
  if (!/^uc25-[A-Z_]+-[a-f0-9-]{36}\.(xlsx|pdf)$/.test(filename))
    throw Error("Tên bản xuất không hợp lệ.");
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
