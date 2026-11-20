import { httpClient } from "../../../shared/api/http-client";
import { studentItem, type StudentDto } from "../../../shared/data/snapshot-api";
import type { Student } from "../../../shared/data/types";

export const STUDENT_BATCH_SIZE = 100;
export interface StudentDirectoryPage {
  items: Student[];
  total: number;
  page: number;
}

export async function loadStudentDirectoryPage(page: number, signal?: AbortSignal): Promise<StudentDirectoryPage> {
  const response = await httpClient.get<{ data: {
    items: StudentDto[]; total: number;
  } }>("/students", { params: { page, pageSize: STUDENT_BATCH_SIZE }, signal });
  const data = response.data.data;
  if (!Array.isArray(data.items) || !Number.isInteger(data.total) || data.total < 0 ||
      data.items.length > STUDENT_BATCH_SIZE || (!data.items.length && (page - 1) * STUDENT_BATCH_SIZE < data.total))
    throw new Error("Danh sách sinh viên chưa đầy đủ. Vui lòng thử tải lại.");
  return { items: data.items.map((item) => studentItem(item)), total: data.total, page };
}

export function studentDirectoryState(pages: StudentDirectoryPage[]) {
  const students = pages.flatMap((page) => page.items);
  const total = pages[0]?.total ?? null;
  const changed = total !== null && (
    pages.some((page) => page.total !== total) ||
    new Set(students.map((student) => student.id)).size !== students.length ||
    students.length > total ||
    (pages.length * STUDENT_BATCH_SIZE >= total && students.length !== total)
  );
  return {
    students,
    total: changed ? null : total,
    complete: total !== null && students.length === total && !changed,
    error: changed ? new Error("Danh sách vừa thay đổi trong lúc tải. Vui lòng tải lại để xem đầy đủ thống kê và bộ lọc.") : null,
  };
}
