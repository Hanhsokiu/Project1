import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { DefenseConfirmationSession } from "./defense-confirmation.repository";
import { confirmationError } from "./defense-confirmation.dto";

export class DefenseConfirmationWriteSession extends DefenseConfirmationSession {
  constructor(private readonly commandDb: Prisma.TransactionClient) {
    super(commandDb);
  }
  proposalTerm(proposalId: string) {
    // Locator only; all authoritative proposal/assignment facts are reloaded
    // after the parent lock. Never acquire another term lock after child locks.
    return this.commandDb.proposal.findUnique({
      where: { id: proposalId },
      select: { termId: true },
    });
  }
  async lock(termId: string, _groupIds: string[], proposalId: string) {
    await this.commandDb
      .$queryRaw`SELECT id FROM public."THESIS_TERM" WHERE id=${termId} FOR UPDATE`;
    await this.commandDb
      .$queryRaw`SELECT term_id FROM public."DEFENSE_CONFIRMATION_WINDOW" WHERE term_id=${termId} FOR UPDATE`;
    await this.commandDb
      .$queryRaw`SELECT term_id FROM public."DEFENSE_LIST" WHERE term_id=${termId} FOR UPDATE`;
    await this.commandDb
      .$queryRaw`SELECT id FROM public."PROPOSAL" WHERE id=${proposalId} FOR UPDATE`;
    await this.commandDb
      .$queryRaw`SELECT id FROM public."DEFENSE_CONFIRMATION" WHERE proposal_id=${proposalId} FOR UPDATE`;
  }
  async lockPdfKey(key: string) {
    await this.commandDb
      .$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
  }
  async now() {
    // transaction_timestamp() would include time spent waiting for a row lock.
    const [row] = await this.commandDb.$queryRaw<
      Array<{ at: Date }>
    >`SELECT clock_timestamp() AS at`;
    return row.at;
  }
  createDecision(data: Prisma.DefenseConfirmationUncheckedCreateInput) {
    return this.commandDb.defenseConfirmation.create({ data });
  }
  updateDecision(
    id: string,
    proposalId: string,
    revision: number,
    data: Prisma.DefenseConfirmationUncheckedUpdateManyInput,
  ) {
    return this.commandDb.defenseConfirmation.updateMany({
      where: { id, proposalId, revision },
      data,
    });
  }
  appendHistory(data: Prisma.DefenseConfirmationHistoryUncheckedCreateInput) {
    return this.commandDb.defenseConfirmationHistory.create({ data });
  }
  async notifyFaculty(
    proposalId: string,
    termId: string,
    revision: number,
    status: string,
  ) {
    const proposal = await this.proposal(proposalId);
    if (
      !proposal ||
      proposal.termId !== termId ||
      proposal.topic.termId !== termId
    )
      confirmationError(409, "UC17_CONTEXT_CHANGED", "Hồ sơ vừa thay đổi.");
    const departmentId =
      proposal.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
        ?.departmentId;
    const recipients = await this.commandDb.userAccount.findMany({
      where: {
        status: "ACTIVE",
        mustChangePassword: false,
        AND: [
          { userRoles: { some: { role: { name: "FACULTY" } } } },
          {
            userRoles: {
              some: {
                role: {
                  rolePermissions: {
                    some: {
                      permission: {
                        resource: "defense-confirmation",
                        action: "read",
                      },
                    },
                  },
                },
              },
            },
          },
        ],
        pr2bAcademicTermGrantUserId: {
          some: {
            termId,
            OR: [
              { allDepartments: true },
              ...(departmentId
                ? [{ pr2bGrantDepartmentGrantId: { some: { departmentId } } }]
                : []),
            ],
          },
        },
      },
      select: { id: true },
    });
    if (recipients.length)
      await this.commandDb.notification.createMany({
        data: recipients.map((user) => ({
          userId: user.id,
          termId,
          title: "Cập nhật xác nhận bảo vệ UC17",
          // No student name, PDF identity, private note or evidence in a notification.
          body: `GVHD đã ${status === "CONFIRMED" ? "đồng ý" : "từ chối"} cho bảo vệ (revision ${revision}). Mở hồ sơ để xem theo quyền hiện hành.`,
          link: `/guidance/defense-confirm?proposalId=${encodeURIComponent(proposalId)}&view=FACULTY`,
        })),
      });
  }
}

@Injectable()
export class DefenseConfirmationCommandRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async write<T>(
    operation: (
      s: DefenseConfirmationWriteSession,
      tx: Prisma.TransactionClient,
    ) => Promise<T>,
  ) {
    try {
      return await this.prisma.$transaction(
        (tx) => operation(new DefenseConfirmationWriteSession(tx), tx),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: 10000,
          timeout: 15000,
        },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (["P2002", "P2034"].includes(error.code))
          confirmationError(
            409,
            "REVISION_CONFLICT",
            "Quyết định/context vừa thay đổi; hãy tải lại.",
          );
        if (
          ["P2021", "P2022"].includes(error.code) ||
          (error.code === "P2010" &&
            ["42P01", "42703"].includes(String(error.meta?.code)))
        )
          confirmationError(
            503,
            "UC17_STORAGE_UNAVAILABLE",
            "Nguồn dữ liệu UC17/UC18 chưa sẵn sàng.",
          );
      }
      throw error;
    }
  }
}
