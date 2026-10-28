import { Injectable, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export const registrationInclude =
  Prisma.validator<Prisma.RegistrationInclude>()({
    preferences: { orderBy: { preferenceOrder: "asc" } },
  });
export type LoadedRegistration = Prisma.RegistrationGetPayload<{
  include: typeof registrationInclude;
}>;
export type RegistrationTx = Prisma.TransactionClient;
@Injectable()
export class RegistrationRepository {
  constructor(private readonly prisma: PrismaService) {}
  async transaction<T>(
    operation: (tx: RegistrationTx) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10000,
          timeout: 15000,
        });
      } catch (error) {
        const code = (error as { code?: string }).code;
        if ((code === "P2034" || code === "P2002") && attempt < 2) continue;
        if (code === "P2034" || code === "P2002")
          throw new ConflictException({
            error: {
              code: "CONCURRENT_UPDATE",
              message:
                "Dữ liệu vừa thay đổi hoặc email đã được sử dụng. Hãy tải lại và thử lại.",
            },
          });
        throw error;
      }
    }
  }
  student(userId: string, tx: RegistrationTx) {
    return tx.student.findUnique({
      where: { userId },
      include: { user: true },
    });
  }
  current(termId: string, studentId: string, tx: RegistrationTx) {
    return tx.registration.findUnique({
      where: { termId_studentId: { termId, studentId } },
      include: registrationInclude,
    });
  }
  list(termId: string | undefined, tx: RegistrationTx) {
    return tx.registration.findMany({
      where: { termId },
      include: registrationInclude,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
  }
  areas(tx: RegistrationTx) {
    return tx.researchArea.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  }
  async save(
    termId: string,
    studentId: string,
    data: {
      directionId: string | null;
      status: "DRAFT" | "SUBMITTED";
      note: string;
      submittedAt: Date | null;
      preferences: { lecturerId: string; preferenceOrder: number }[];
    },
    tx: RegistrationTx,
  ) {
    const { preferences, ...fields } = data;
    const registration = await tx.registration.upsert({
      where: { termId_studentId: { termId, studentId } },
      create: { termId, studentId, ...fields },
      update: fields,
    });
    await tx.registrationPref.deleteMany({
      where: { registrationId: registration.id },
    });
    if (preferences.length)
      await tx.registrationPref.createMany({
        data: preferences.map((p) => ({
          registrationId: registration.id,
          ...p,
        })),
      });
    return (await this.current(termId, studentId, tx))!;
  }
  async contact(
    userId: string,
    studentId: string,
    email: string,
    phone: string,
    tx: RegistrationTx,
  ) {
    await tx.userAccount.update({
      where: { id: userId },
      data: { email, phone },
    });
    await tx.student.update({ where: { id: studentId }, data: { phone } });
  }
  audit(userId: string, registration: LoadedRegistration, tx: RegistrationTx) {
    return tx.auditLog.create({
      data: {
        userId,
        action:
          registration.status === "SUBMITTED"
            ? "REGISTRATION_SUBMITTED"
            : "REGISTRATION_DRAFT_SAVED",
        resource: "registration",
        resourceId: registration.id,
        newValue: {
          termId: registration.termId,
          studentId: registration.studentId,
          directionId: registration.directionId,
          status: registration.status,
          submittedAt: registration.submittedAt?.toISOString() ?? null,
          preferences: registration.preferences.map((p) => ({
            lecturerId: p.lecturerId,
            preferenceOrder: p.preferenceOrder,
          })),
        },
      },
    });
  }
}
