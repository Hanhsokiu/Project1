import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import type { ConfirmMode, StudentImportRow } from "../dto/catalog.dto";
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
    const [term, students, accounts, role] = await Promise.all([
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
      this.db.role.findUnique({ where: { name: "STUDENT" } }),
    ]);
    return { term, students, accounts, role };
  }
  async apply(
    row: StudentImportRow,
    termId: string,
    trainingSystemId: string,
    roleId: string,
    passwordHash?: string,
  ) {
    const v = row.values;
    let student;
    if (row.studentId) {
      const existing = await this.db.student.findUniqueOrThrow({
        where: { id: row.studentId },
      });
      await this.db.userAccount.update({
        where: { id: existing.userId },
        data: {
          displayName: v.fullName,
          ...(v.email ? { email: v.email } : {}),
        },
      });
      student = await this.db.student.update({
        where: { id: existing.id },
        data: {
          fullName: v.fullName,
          className: v.className,
          ...(v.majorName ? {majorName:v.majorName} : {}),
          ...(v.cohort ? { cohort: v.cohort } : {}),
          gpa: v.gpa!,
          academicEligible: v.academicEligible,
          ...(v.phone ? { phone: v.phone } : {}),
        },
      });
    } else
      student = await this.db.student.create({
        data: {
          studentCode: v.studentCode,
          fullName: v.fullName,
          className: v.className,
          majorName: v.majorName ?? "",
          cohort: v.cohort,
          trainingSystem: { connect: { id: trainingSystemId } },
          gpa: v.gpa!,
          academicEligible: v.academicEligible,
          isActive: true,
          phone: v.phone,
          user: {
            create: {
              username: v.studentCode,
              displayName: v.fullName,
              email: v.email,
              passwordHash: passwordHash!,
              status: "ACTIVE" as const,
              mustChangePassword: true,
              userRoles: { create: { roleId } },
            },
          },
        },
      });
    await this.db.termStudent.create({
      data: { termId, studentId: student.id },
    });
    return student.id;
  }
  async finish(
    id: string,
    rows: StudentImportRow[],
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
        action: "STUDENT_IMPORT_CONFIRMED",
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
  createPreview(input: {
    termId: string;
    createdBy: string;
    fileName: string;
    fileHash: string;
    rows: StudentImportRow[];
  }) {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.importJob.create({
        data: {
          type: "STUDENT",
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
          action: "STUDENT_IMPORT_PREVIEWED",
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
