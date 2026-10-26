import type { Prisma } from "@prisma/client";
import {
  lecturerInclude,
  studentInclude,
} from "../repository/catalog.repository";
export function studentDto(
  s: Prisma.StudentGetPayload<{ include: typeof studentInclude }>,
) {
  return {
    id: s.id,
    userId: s.userId,
    studentCode: s.studentCode,
    fullName: s.fullName,
    className: s.className,
    cohort: s.cohort,
    gpa: s.gpa === null ? null : Number(s.gpa),
    academicEligible: s.academicEligible,
    isActive: s.isActive,
    trainingSystemId: s.trainingSystemId,
    trainingSystem: s.trainingSystem,
    email: s.user.email,
    phone: s.phone,
    termIds: s.termStudents.map((t) => t.termId),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}
export function lecturerDto(
  l: Prisma.LecturerGetPayload<{ include: typeof lecturerInclude }>,
) {
  return {
    id: l.id,
    userId: l.userId,
    lecturerCode: l.lecturerCode,
    fullName: l.fullName,
    departmentId: l.departmentId,
    department: l.department,
    titleId: l.titleId,
    title: l.title,
    email: l.user.email,
    phone: l.phone,
    maxStudents: l.maxStudents,
    isActive: l.isActive,
    researchAreas: l.researchAreas.map((a) => a.researchArea),
    researchAreaIds: l.researchAreas.map((a) => a.researchAreaId),
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  };
}
export function pageDto<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
) {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
