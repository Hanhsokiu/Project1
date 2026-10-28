import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { sealAccountPassword } from "../../auth/security/password-vault";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import type {
  CatalogQuery,
  LecturerInput,
  ReferenceKind,
  StudentInput,
} from "../dto/catalog.dto";
export const studentInclude = {
  trainingSystem: true,
  user: { select: { email: true } },
  termStudents: { select: { termId: true } },
} satisfies Prisma.StudentInclude;
export const lecturerInclude = {
  department: true,
  title: true,
  user: { select: { email: true } },
  researchAreas: { include: { researchArea: true } },
} satisfies Prisma.LecturerInclude;
@Injectable()
export class CatalogRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}
  async students(q: CatalogQuery) {
    const where: Prisma.StudentWhereInput = {
      ...(q.search
        ? {
            OR: [
              { fullName: { contains: q.search, mode: "insensitive" } },
              { studentCode: { contains: q.search, mode: "insensitive" } },
              { user: { email: { contains: q.search, mode: "insensitive" } } },
            ],
          }
        : {}),
      ...(q.trainingSystemId ? { trainingSystemId: q.trainingSystemId } : {}),
      ...(q.termId ? { termStudents: { some: { termId: q.termId } } } : {}),
      ...(q.className ? { className: q.className } : {}),
      ...(q.academicEligible !== undefined
        ? { academicEligible: q.academicEligible }
        : {}),
      ...(q.isActive !== undefined ? { isActive: q.isActive } : {}),
    };
    return Promise.all([
      this.prisma.student.findMany({
        where,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: studentInclude,
        orderBy: [{ studentCode: "asc" }],
      }),
      this.prisma.student.count({ where }),
    ]);
  }
  student(id: string) {
    return this.prisma.student.findUnique({
      where: { id },
      include: studentInclude,
    });
  }
  async lecturers(q: CatalogQuery) {
    const where: Prisma.LecturerWhereInput = {
      ...(q.search
        ? {
            OR: [
              { fullName: { contains: q.search, mode: "insensitive" } },
              { lecturerCode: { contains: q.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(q.departmentId ? { departmentId: q.departmentId } : {}),
      ...(q.researchAreaId
        ? { researchAreas: { some: { researchAreaId: q.researchAreaId } } }
        : {}),
      ...(q.termId ? { termLecturers: { some: { termId: q.termId } } } : {}),
      ...(q.isActive !== undefined ? { isActive: q.isActive } : {}),
    };
    return Promise.all([
      this.prisma.lecturer.findMany({
        where,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: lecturerInclude,
        orderBy: { lecturerCode: "asc" },
      }),
      this.prisma.lecturer.count({ where }),
    ]);
  }
  lecturer(id: string) {
    return this.prisma.lecturer.findUnique({
      where: { id },
      include: lecturerInclude,
    });
  }
  studentReferences(input: Partial<StudentInput>) {
    return Promise.all([
      input.trainingSystemId
        ? this.prisma.trainingSystem.findUnique({
            where: { id: input.trainingSystemId },
          })
        : null,
      input.email
        ? this.prisma.userAccount.findUnique({ where: { email: input.email } })
        : null,
    ]);
  }
  lecturerReferences(input: Partial<LecturerInput>) {
    return Promise.all([
      input.departmentId
        ? this.prisma.department.findUnique({
            where: { id: input.departmentId },
          })
        : null,
      input.titleId
        ? this.prisma.titleConfig.findUnique({ where: { id: input.titleId } })
        : null,
      input.researchAreaIds
        ? this.prisma.researchArea.findMany({
            where: { id: { in: input.researchAreaIds } },
          })
        : [],
      input.email
        ? this.prisma.userAccount.findUnique({ where: { email: input.email } })
        : null,
    ]);
  }
  role(name: string) {
    return this.prisma.role.findUnique({ where: { name } });
  }
  saveStudent(
    id: string | undefined,
    input: Partial<StudentInput>,
    actorId: string,
    passwordHash?: string,
    roleId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const old = id
        ? await tx.student.findUnique({
            where: { id },
            include: { user: { select: { email: true } } },
          })
        : null;
      const { email, phone, ...fields } = input;
      let saved: Prisma.StudentGetPayload<{ include: typeof studentInclude }>;
      if (id) {
        if (!old) throw new Error("STUDENT_NOT_FOUND");
        const effectiveEmail = email?.trim() || undefined;
        await tx.userAccount.update({
          where: { id: old.userId },
          data: {
            ...(input.studentCode ? { username: input.studentCode } : {}),
            ...(input.fullName ? { displayName: input.fullName } : {}),
            ...(effectiveEmail ? { email: effectiveEmail } : {}),
          },
        });
        saved = await tx.student.update({
          where: { id },
          data: { ...fields, ...(phone ? { phone } : {}) },
          include: studentInclude,
        });
      } else
        saved = await tx.student.create({
          data: {
            studentCode: input.studentCode!,
            fullName: input.fullName!,
            className: input.className!,
            cohort: input.cohort || "",
            trainingSystem: { connect: { id: input.trainingSystemId! } },
            gpa: input.gpa!,
            academicEligible: input.academicEligible ?? true,
            isActive: input.isActive ?? true,
            phone: phone || null,
            user: {
              create: {
                username: input.studentCode!,
                displayName: input.fullName!,
                email: email || null,
                passwordHash: passwordHash!,
                passwordCiphertext: sealAccountPassword(input.studentCode!),
                status: "ACTIVE" as const,
                mustChangePassword: true,
                userRoles: { create: { roleId: roleId! } },
              },
            },
          },
          include: studentInclude,
        });
      await this.audit.log(
        {
          userId: actorId,
          action: id ? "STUDENT_UPDATED" : "STUDENT_CREATED",
          resource: "student",
          resourceId: saved.id,
          oldValue: old
            ? {
                studentCode: old.studentCode,
                fullName: old.fullName,
                trainingSystemId: old.trainingSystemId,
                gpa: String(old.gpa),
              }
            : undefined,
          newValue: {
            studentCode: saved.studentCode,
            fullName: saved.fullName,
            trainingSystemId: saved.trainingSystemId,
            gpa: String(saved.gpa),
          },
        },
        tx,
      );
      return saved;
    });
  }
  saveLecturer(
    id: string | undefined,
    input: Partial<LecturerInput>,
    actorId: string,
    passwordHash?: string,
    roleId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const old = id ? await tx.lecturer.findUnique({ where: { id } }) : null;
      const { email, researchAreaIds, phone, ...fields } = input;
      let saved: Prisma.LecturerGetPayload<{ include: typeof lecturerInclude }>;
      if (id) {
        if (!old) throw new Error("LECTURER_NOT_FOUND");
        await tx.userAccount.update({
          where: { id: old.userId },
          data: {
            ...(input.fullName ? { displayName: input.fullName } : {}),
            ...(email ? { email } : {}),
          },
        });
        if (researchAreaIds) {
          await tx.lecturerArea.deleteMany({ where: { lecturerId: id } });
          await tx.lecturerArea.createMany({
            data: researchAreaIds.map((researchAreaId) => ({
              lecturerId: id,
              researchAreaId,
            })),
          });
        }
        saved = await tx.lecturer.update({
          where: { id },
          data: { ...fields, ...(phone ? { phone } : {}) },
          include: lecturerInclude,
        });
      } else
        saved = await tx.lecturer.create({
          data: {
            lecturerCode: input.lecturerCode!,
            fullName: input.fullName!,
            department: { connect: { id: input.departmentId! } },
            ...(input.titleId
              ? { title: { connect: { id: input.titleId } } }
              : {}),
            maxStudents: input.maxStudents ?? 5,
            isActive: input.isActive ?? true,
            phone: phone || null,
            researchAreas: {
              create: (researchAreaIds || []).map((researchAreaId) => ({
                researchAreaId,
              })),
            },
            user: {
              create: {
                username: input.lecturerCode!.toLowerCase(),
                displayName: input.fullName!,
                email: email || null,
                passwordHash: passwordHash!,
                passwordCiphertext: sealAccountPassword("Default@2026"),
                status: "ACTIVE" as const,
                mustChangePassword: true,
                userRoles: { create: { roleId: roleId! } },
              },
            },
          },
          include: lecturerInclude,
        });
      await this.audit.log(
        {
          userId: actorId,
          action: id ? "LECTURER_UPDATED" : "LECTURER_CREATED",
          resource: "lecturer",
          resourceId: saved.id,
          newValue: {
            lecturerCode: saved.lecturerCode,
            fullName: saved.fullName,
            maxStudents: saved.maxStudents,
            researchAreaIds,
          },
        },
        tx,
      );
      return saved;
    });
  }
  studentTerms(id: string) {
    return this.prisma.termStudent.findMany({
      where: { studentId: id },
      include: { term: true },
    });
  }
  lecturerAssignments(id: string) {
    return this.prisma.advisorAssignment.count({ where: { advisorId: id } });
  }
  references(kind: ReferenceKind) {
    if (kind === "departments")
      return this.prisma.department.findMany({ orderBy: { code: "asc" } });
    if (kind === "training-systems")
      return this.prisma.trainingSystem.findMany({ orderBy: { code: "asc" } });
    return this.prisma.researchArea.findMany({ orderBy: { name: "asc" } });
  }
  async saveReference(
    kind: ReferenceKind,
    id: string | undefined,
    input: {
      name: string;
      code?: string;
      description?: string | null;
      isActive?: boolean;
    },
    actorId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      let saved;
      if (kind === "departments") {
        saved = id
          ? await tx.department.update({
              where: { id },
              data: {
                name: input.name,
                ...(input.code ? { code: input.code } : {}),
              },
            })
          : await tx.department.create({
              data: { name: input.name, code: input.code! },
            });
      } else if (kind === "training-systems") {
        saved = id
          ? await tx.trainingSystem.update({
              where: { id },
              data: {
                name: input.name,
                ...(input.code ? { code: input.code } : {}),
              },
            })
          : await tx.trainingSystem.create({
              data: { name: input.name, code: input.code! },
            });
      } else
        saved = id
          ? await tx.researchArea.update({
              where: { id },
              data: {
                name: input.name,
                description: input.description,
                isActive: input.isActive,
              },
            })
          : await tx.researchArea.create({
              data: {
                name: input.name,
                description: input.description,
                isActive: input.isActive,
              },
            });
      await this.audit.log(
        {
          userId: actorId,
          action: id ? "CATALOG_UPDATED" : "CATALOG_CREATED",
          resource: kind,
          resourceId: saved.id,
          newValue: input,
        },
        tx,
      );
      return saved;
    });
  }
}
