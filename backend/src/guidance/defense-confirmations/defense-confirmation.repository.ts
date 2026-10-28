import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ProgressSession } from "../reviews/progress-review.repository";
import { reportInclude } from "../final-reports/final-report.repository";
import { confirmationError } from "./defense-confirmation.dto";

const publicPeople = {
  decidedBy: { select: { id: true, displayName: true } },
  advisor: { select: { id: true, fullName: true } },
} satisfies Prisma.DefenseConfirmationInclude;
export type DefenseConfirmationReadRecord =
  Prisma.DefenseConfirmationGetPayload<{ include: typeof publicPeople }>;
const historyPeople = {
  actor: { select: { id: true, displayName: true } },
  advisor: { select: { id: true, fullName: true } },
} satisfies Prisma.DefenseConfirmationHistoryInclude;
export type DefenseConfirmationHistoryRecord =
  Prisma.DefenseConfirmationHistoryGetPayload<{
    include: typeof historyPeople;
  }>;

/** Reuse the existing ownership, assignment and progress queries. Only SELECTs
 * are added here; this reader never initializes a decision or configuration.
 */
export class DefenseConfirmationSession extends ProgressSession {
  constructor(private readonly contextDb: Prisma.TransactionClient) {
    super(contextDb);
  }
  async now() {
    const [row] = await this.contextDb.$queryRaw<Array<{ at: Date }>>`
      SELECT transaction_timestamp() AS at`;
    return row.at;
  }
  window(termId: string) {
    return this.contextDb.defenseConfirmationWindow.findUnique({
      where: { termId },
    });
  }
  currentDecision(proposalId: string) {
    return this.contextDb.defenseConfirmation.findUnique({
      where: { proposalId },
    });
  }
  decisionRecord(proposalId: string) {
    return this.contextDb.defenseConfirmation.findUnique({
      where: { proposalId },
      include: publicPeople,
    });
  }
  decisionHistory(proposalId: string, afterRevision: number, limit: number) {
    return this.contextDb.defenseConfirmationHistory.findMany({
      where: { confirmation: { proposalId }, revision: { gt: afterRevision } },
      include: historyPeople,
      orderBy: [{ revision: "asc" }, { id: "asc" }],
      take: limit + 1,
    });
  }
  report(proposalId: string) {
    return this.contextDb.finalReport.findUnique({
      where: { proposalId },
      include: reportInclude,
    });
  }
  evaluations(planId: string) {
    return this.contextDb.phaseEvaluation.findMany({
      where: { guidancePlanId: planId },
      include: { pr2bEvaluationWorkflowEvaluationId: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }
  taskProgress(planId: string) {
    return this.contextDb.taskProgressEvent.findMany({
      where: { refTaskId: { guidancePlanId: planId } },
      select: {
        id: true,
        taskId: true,
        note: true,
        actorId: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }
}

@Injectable()
export class DefenseConfirmationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async read<T>(
    operation: (
      session: DefenseConfirmationSession,
      tx: Prisma.TransactionClient,
    ) => Promise<T>,
  ) {
    try {
      return await this.prisma.$transaction(
        (tx) => operation(new DefenseConfirmationSession(tx), tx),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
          maxWait: 10000,
          timeout: 15000,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2021", "P2022"].includes(error.code)
      )
        confirmationError(
          503,
          "UC17_STORAGE_UNAVAILABLE",
          "Nguồn dữ liệu UC17 chưa sẵn sàng.",
        );
      throw error;
    }
  }
}
