import { httpClient } from "../../../shared/api/http-client";
import { apiData } from "../../../shared/data/snapshot-api";
export type ImportKind = "student" | "lecturer";
const jobPath = (id: string, kind: ImportKind) =>
  kind === "student" ? `/imports/${id}` : `/imports/lecturers/${id}`;
export interface ImportJobDto {
  id: string;
  type: "STUDENT" | "LECTURER";
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
      studentCode?: string;
      lecturerCode?: string;
      fullName: string;
      className?: string;
      departmentCode?: string;
      researchAreas?: string[];
      maxStudents?: number | null;
      cohort?: string;
      trainingSystemCode?: string;
      gpa?: number | null;
      email?: string;
      phone?: string;
    };
    action: string;
    status: string;
    errors: { field: string; code: string; message: string }[];
  }[];
}
export const importApi = {
  async preview(file: File, termId: string, kind: ImportKind = "student") {
    const body = new FormData();
    body.append("file", file);
    body.append("termId", termId);
    const response = await httpClient.post<{ data: ImportJobDto }>(
      `/imports/${kind === "student" ? "students" : "lecturers"}/preview`,
      body,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return response.data.data;
  },
  confirm: (
    id: string,
    mode: "STRICT" | "VALID_ONLY",
    kind: ImportKind = "student",
  ) => apiData<ImportJobDto>("POST", `${jobPath(id, kind)}/confirm`, { mode }),
  get: (id: string, kind: ImportKind = "student") =>
    apiData<ImportJobDto>("GET", jobPath(id, kind)),
  async template(format: "csv" | "xlsx", kind: ImportKind = "student") {
    const response = await httpClient.get(
      `/imports/${kind === "student" ? "students" : "lecturers"}/template?format=${format}`,
      { responseType: "blob" },
    );
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mau-${kind === "student" ? "sinh-vien" : "giang-vien"}.${format}`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
