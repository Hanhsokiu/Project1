import type { Prisma } from "@prisma/client";
import { ContactValidator } from "../validator/contact.validator";
export const identityInclude = {
  userRoles: {
    include: {
      role: { include: { rolePermissions: { include: { permission: true } } } },
    },
  },
  student: { include: { trainingSystem: true } },
  lecturer: { include: { researchAreas: true } },
} satisfies Prisma.UserAccountInclude;
export type Identity = Prisma.UserAccountGetPayload<{
  include: typeof identityInclude;
}>;
export function accountDto(user: Identity) {
  return {
    id: user.id,
    username: user.username,
    name:
      user.displayName ||
      user.student?.fullName ||
      user.lecturer?.fullName ||
      user.username,
    email: user.email,
    phone: user.phone || user.student?.phone || user.lecturer?.phone || "",
    roles: user.userRoles.map((r) => r.role.name),
    permissions: [
      ...new Set(
        user.userRoles.flatMap((r) =>
          r.role.rolePermissions.map(
            (p) => `${p.permission.resource}:${p.permission.action}`,
          ),
        ),
      ),
    ],
    mustChangePassword: user.mustChangePassword,
    profileComplete:
      !user.mustChangePassword &&
      ContactValidator.complete(
        user.email,
        user.phone || user.student?.phone || user.lecturer?.phone,
      ),
    studentId: user.student?.id,
    lecturerId: user.lecturer?.id,
    locked: user.status === "LOCKED",
    student: user.student
      ? {
          id: user.student.id,
          code: user.student.studentCode,
          name: user.student.fullName,
          className: user.student.className,
          cohort: user.student.cohort,
          program: user.student.trainingSystem.name,
          trainingSystemId: user.student.trainingSystemId,
          gpa: user.student.gpa === null ? null : Number(user.student.gpa),
          phone: user.student.phone || "",
          email: user.email || "",
          eligible: user.student.academicEligible,
        }
      : undefined,
    lecturer: user.lecturer
      ? {
          id: user.lecturer.id,
          code: user.lecturer.lecturerCode,
          name: user.lecturer.fullName,
          departmentId: user.lecturer.departmentId,
          directionIds: user.lecturer.researchAreas.map(
            (a) => a.researchAreaId,
          ),
          quota: user.lecturer.maxStudents,
          email: user.email || "",
          phone: user.lecturer.phone || "",
        }
      : undefined,
  };
}
