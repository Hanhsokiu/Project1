import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import type {
  ConfirmMode,
  StudentImportRow,
  LecturerImportRow,
} from "../dto/catalog.dto";
import { CatalogInputValidator } from "../validator/catalog.validator";
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export class ImportUnitOfWork {
  constructor(
    private readonly db: Prisma.TransactionClient,
    private readonly audit: AuditService,
  ) {}
  job(id: string) {
    return this.db.importJob.findUnique({ where: { id } });
  }
  async context(termId: string, codes: string[], emails: string[]) {
    const [term, students, accounts] = await Promise.all([
      this.db.thesisTerm.findUnique({
        where: { id: termId },
        include: { trainingSystem: true, parameters: true },
      }),
      this.db.student.findMany({
        where: { studentCode: { in: codes } },
        include: {
          termStudents: { where: { termId } },
          user: { select: { email: true } },
        },
      }),
      this.db.userAccount.findMany({
        where: { OR: [{ username: { in: codes } }, { email: { in: emails } }] },
        select: { id: true, username: true, email: true },
      }),
    ]);
    return { term, students, accounts };
  }
  async apply(row: StudentImportRow, termId: string, trainingSystemId: string) {
    const v = row.values;
    if (row.action === "CREATE") {
      const student = await this.db.student.create({
        data: {
          studentCode: v.studentCode,
          fullName: v.fullName,
          className: v.className,
          majorName: v.majorName || "",
          cohort: v.cohort,
          trainingSystem: { connect: { id: trainingSystemId } },
          gpa: v.gpa!,
          academicEligible: v.academicEligible,
          phone: v.phone,
          user: {
            create: {
              username: v.studentCode,
              passwordHash: await bcrypt.hash(v.studentCode, 12),
              displayName: v.fullName,
              email: v.email,
              status: "ACTIVE" as const,
              mustChangePassword: true,
              userRoles: { create: { role: { connect: { name: "STUDENT" } } } },
            },
          },
          termStudents: { create: { termId } },
        },
      });
      return student.id;
    }
    CatalogInputValidator.exists(row.studentId, "Sinh viên không tồn tại.");
    const existing = await this.db.student.findUnique({
      where: {
        id: row.studentId,
        studentCode: v.studentCode,
        trainingSystemId,
      },
    });
    CatalogInputValidator.exists(existing, "Sinh viên không tồn tại.");
    await this.db.userAccount.update({
      where: { id: existing.userId },
      data: {
        displayName: v.fullName,
        ...(v.email ? { email: v.email } : {}),
      },
    });
    const student = await this.db.student.update({
      where: { id: existing.id },
      data: {
        fullName: v.fullName,
        className: v.className,
        ...(v.majorName ? { majorName: v.majorName } : {}),
        ...(v.cohort ? { cohort: v.cohort } : {}),
        gpa: v.gpa!,
        academicEligible: v.academicEligible,
        ...(v.phone ? { phone: v.phone } : {}),
      },
    });
    await this.db.termStudent.create({
      data: { termId, studentId: student.id },
    });
    return student.id;
  }
  async lecturerContext(codes: string[], emails: string[]) {
    const [lecturers, accounts, departments, areas] = await Promise.all([
      this.db.lecturer.findMany({ where: { lecturerCode: { in: codes } } }),
      this.db.userAccount.findMany({
        where: { OR: [{ username: { in: codes } }, { email: { in: emails } }] },
        select: { id: true, username: true, email: true },
      }),
      this.db.department.findMany(),
      this.db.researchArea.findMany({ where: { isActive: true } }),
    ]);
    return { lecturers, accounts, departments, areas };
  }
  async applyLecturer(
    row: LecturerImportRow,
    context: Awaited<ReturnType<ImportUnitOfWork["lecturerContext"]>>,
  ) {
    const v = row.values;
    const department = context.departments.find(
      (d) => d.code === v.departmentCode,
    )!;
    const areaIds = v.researchAreas.map(
      (name) => context.areas.find((a) => a.name === name)!.id,
    );
    const fields = {
      fullName: v.fullName,
      departmentId: department.id,
      maxStudents: v.maxStudents!,
      ...(v.phone ? { phone: v.phone } : {}),
    };
    if (row.action === "CREATE") {
      return (
        await this.db.lecturer.create({
          data: {
            fullName: fields.fullName,
            maxStudents: fields.maxStudents,
            ...(v.phone ? { phone: v.phone } : {}),
            department: { connect: { id: department.id } },
            lecturerCode: v.lecturerCode,
            user: {
              create: {
                username: v.lecturerCode,
                passwordHash: await bcrypt.hash(v.lecturerCode, 12),
                displayName: v.fullName,
                email: v.email,
                status: "ACTIVE" as const,
                mustChangePassword: true,
                userRoles: {
                  create: { role: { connect: { name: "LECTURER" } } },
                },
              },
            },
            researchAreas: {
              create: areaIds.map((researchAreaId) => ({ researchAreaId })),
            },
          },
        })
      ).id;
    }
    const existing = context.lecturers.find((l) => l.id === row.lecturerId)!;
    await this.db.userAccount.update({
      where: { id: existing.userId },
      data: {
        displayName: v.fullName,
        ...(v.email ? { email: v.email } : {}),
      },
    });
    await this.db.lecturerArea.deleteMany({
      where: { lecturerId: existing.id },
    });
    await this.db.lecturer.update({
      where: { id: existing.id },
      data: {
        ...fields,
        researchAreas: {
          create: areaIds.map((researchAreaId) => ({ researchAreaId })),
        },
      },
    });
    return existing.id;
  }
  async finish(
    id: string,
    rows: (StudentImportRow | LecturerImportRow)[],
    mode: ConfirmMode,
    actorId: string,
  ) {
    const errorRows = rows.filter((r) => r.status === "ERROR").length;
    const skippedRows = rows.filter((r) => r.status === "SKIPPED").length;
    const successRows = rows.filter((r) => r.status === "IMPORTED").length;
    const job = await this.db.importJob.update({
      where: { id },
      data: {
        rows: json(rows),
        mode,
        status: errorRows ? "PARTIAL" : "DONE",
        successRows,
        errorRows,
        errorReport: json(
          rows
            .filter((r) => r.errors.length)
            .map((r) => ({ rowNumber: r.rowNumber, errors: r.errors })),
        ),
        confirmedAt: new Date(),
        completedAt: new Date(),
      },
    });
    await this.audit.log(
      {
        userId: actorId,
        action: `${job.type}_IMPORT_CONFIRMED`,
        resource: "import",
        resourceId: id,
        newValue: {
          termId: job.termId,
          mode,
          totalRows: rows.length,
          successRows,
          errorRows,
          skippedRows,
        },
      },
      this.db,
    );
    return job;
  }
}
@Injectable()
export class ImportRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}
  unit() {
    return new ImportUnitOfWork(this.prisma, this.audit);
  }
  job(id: string) {
    return this.unit().job(id);
  }
  context(termId: string, codes: string[], emails: string[]) {
    return this.unit().context(termId, codes, emails);
  }
  lecturerContext(codes: string[], emails: string[]) {
    return this.unit().lecturerContext(codes, emails);
  }
  createPreview(input: {
    termId?: string;
    type?: "STUDENT" | "LECTURER";
    createdBy: string;
    fileName: string;
    fileHash: string;
    rows: (StudentImportRow | LecturerImportRow)[];
  }) {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.importJob.create({
        data: {
          type: input.type || "STUDENT",
          termId: input.termId,
          createdBy: input.createdBy,
          fileName: input.fileName,
          fileHash: input.fileHash,
          filePath: "",
          rows: json(input.rows),
          status: "VALIDATED",
          totalRows: input.rows.length,
          errorRows: input.rows.filter((r) => r.errors.length).length,
          errorReport: json(
            input.rows
              .filter((r) => r.errors.length)
              .map((r) => ({ rowNumber: r.rowNumber, errors: r.errors })),
          ),
        },
      });
      await this.audit.log(
        {
          userId: input.createdBy,
          action: `${job.type}_IMPORT_PREVIEWED`,
          resource: "import",
          resourceId: job.id,
          newValue: {
            termId: input.termId,
            fileName: input.fileName,
            totalRows: job.totalRows,
            errorRows: job.errorRows,
          },
        },
        tx,
      );
      return job;
    });
  }
  async serializable<T>(
    callback: (unit: ImportUnitOfWork) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(
          (tx) => callback(new ImportUnitOfWork(tx, this.audit)),
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 10000,
            timeout: 30000,
          },
        );
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? error.code
            : "";
        if (!["P2034", "P2002"].includes(String(code))) throw error;
        if (attempt === 2)
          throw new ConflictException(
            "Dữ liệu import vừa thay đổi bởi thao tác khác. Vui lòng kiểm tra lại bản xem trước.",
          );
      }
    }
    throw new ConflictException("Không xác nhận được import");
  }
}
