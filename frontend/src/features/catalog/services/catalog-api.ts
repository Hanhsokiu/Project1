import { apiData, getStep1Resources } from "../../../shared/data/snapshot-api";
import type {
  CatalogItem,
  Lecturer,
  Student,
} from "../../../shared/data/types";
import { vietnamInstant } from "../../term/services/term-api";

export type CatalogApiInput = Omit<CatalogItem, "id"> & {
  id?: string;
  academicYear?: string;
  semesterNumber?: number;
  startDate?: string;
  endDate?: string;
};
export const catalogApi = {
  saveStudent(input: Omit<Student, "id"> & { id?: string }) {
    const system = getStep1Resources()?.programs.find(
      (p) => p.name === input.program,
    );
    if (!system) throw new Error("Hệ đào tạo không tồn tại trên hệ thống.");
    return apiData(
      input.id ? "PATCH" : "POST",
      input.id ? `/students/${input.id}` : "/students",
      {
        studentCode: input.code,
        fullName: input.name,
        className: input.className,
        majorName: input.majorName?.trim() || undefined,
        trainingSystemId: system.id,
        gpa: input.gpa,
        academicEligible: input.eligible,
        email: input.email || null,
        phone: input.phone || null,
      },
    );
  },
  saveLecturer(input: Omit<Lecturer, "id"> & { id?: string }) {
    return apiData(
      input.id ? "PATCH" : "POST",
      input.id ? `/lecturers/${input.id}` : "/lecturers",
      {
        lecturerCode: input.code,
        fullName: input.name,
        departmentId: input.departmentId,
        email: input.email || null,
        phone: input.phone || null,
        maxStudents: input.quota,
        researchAreaIds: input.directionIds,
      },
    );
  },
  saveItem(input: CatalogApiInput) {
    if (input.kind === "semester") {
      if (input.id)
        throw new Error(
          "Kỳ học đã tạo được giữ nguyên. Hãy tạo kỳ học mới khi cần.",
        );
      if (
        !input.academicYear ||
        !input.semesterNumber ||
        !input.startDate ||
        !input.endDate
      )
        throw new Error("Nhập năm học, số học kỳ, ngày bắt đầu và kết thúc.");
      return apiData("POST", "/semesters", {
        academicYear: input.academicYear,
        semester: input.semesterNumber,
        name: input.name,
        startDate: vietnamInstant(input.startDate),
        endDate: vietnamInstant(input.endDate, true),
      });
    }
    const endpoint = {
      department: "/departments",
      program: "/training-systems",
      direction: "/research-areas",
    }[input.kind];
    return apiData(
      input.id ? "PATCH" : "POST",
      input.id ? `${endpoint}/${input.id}` : endpoint,
      input.kind === "direction"
        ? { name: input.name }
        : { code: input.code, name: input.name },
    );
  },
};
