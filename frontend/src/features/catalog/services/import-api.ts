import { httpClient } from "../../../shared/api/http-client";
import { apiData } from "../../../shared/data/snapshot-api";
export interface ImportJobDto {
  id: string;
  termId: string | null;
  fileName: string;
  status: "VALIDATED" | "DONE" | "PARTIAL";
  totalRows: number;
  validRows: number;
  invalidRows: number;
  successRows: number;
  errorRows: number;
  skippedRows: number;
  canConfirm: boolean;
  mode?: "STRICT" | "VALID_ONLY" | null;
  rows: {
    rowNumber: number;
    values: {
      studentCode: string;
      fullName: string;
      className: string;
      cohort?: string;
      trainingSystemCode?: string;
      gpa: number | null;
      email?: string;
      phone?: string;
    };
    action: string;
    status: string;
    errors: { field: string; code: string; message: string }[];
  }[];
}
export const importApi = {
  async preview(file: File, termId: string) {
    const body = new FormData();
    body.append("file", file);
    body.append("termId", termId);
    const response = await httpClient.post<{ data: ImportJobDto }>(
      "/imports/students/preview",
      body,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return response.data.data;
  },
  confirm: (id: string, mode: "STRICT" | "VALID_ONLY") =>
    apiData<ImportJobDto>("POST", `/imports/${id}/confirm`, { mode }),
  get: (id: string) => apiData<ImportJobDto>("GET", `/imports/${id}`),
  async template(format: "csv" | "xlsx") {
    const response = await httpClient.get(
      `/imports/students/template?format=${format}`,
      { responseType: "blob" },
    );
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mau-sinh-vien.${format}`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
