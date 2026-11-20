import { StudentDirectoryOptionsSchema, StudentDirectoryPageSchema, type StudentDirectoryQuery } from "@doan/shared";
import { httpClient } from "../../../shared/api/http-client";
import { studentItem } from "../../../shared/data/snapshot-api";

export async function loadStudentDirectoryPage(query: StudentDirectoryQuery, signal?: AbortSignal) {
  const response = await httpClient.get("/students/directory", { params: query, signal });
  const parsed = StudentDirectoryPageSchema.safeParse(response.data.data);
  if (!parsed.success || parsed.data.page !== query.page || parsed.data.pageSize !== query.pageSize)
    throw new Error("Danh sách sinh viên chưa đầy đủ. Vui lòng thử tải lại.");
  return { ...parsed.data, items: parsed.data.items.map(item => studentItem(item)) };
}

export async function loadStudentDirectoryOptions(signal?: AbortSignal) {
  const response = await httpClient.get("/students/directory-options", { signal });
  const parsed = StudentDirectoryOptionsSchema.safeParse(response.data.data);
  if (!parsed.success) throw new Error("Chưa tải được thống kê và danh sách lớp. Vui lòng thử lại.");
  return parsed.data;
}
