import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { DefenseConfirmationSession } from "../../guidance/defense-confirmations/defense-confirmation.repository";
import { proposalInclude } from "../../topic/proposal-reviews/proposal-review.repository";
import { reportInclude } from "../../guidance/final-reports/final-report.repository";

export class DefenseReviewSession extends DefenseConfirmationSession {
  constructor(private readonly reviewDb: Prisma.TransactionClient) {
    super(reviewDb);
  }
  members(termId: string, studentId?: string) {
    return this.reviewDb.termStudent.findMany({
      where: { termId, studentId },
      include: { student: true },
      orderBy: [{ student: { studentCode: "asc" } }, { id: "asc" }],
    });
  }
  dossiers(termId: string, studentId?: string) {
    return this.reviewDb.proposal.findMany({
      where: { termId, studentId },
      include: {
        ...proposalInclude,
        defenseConfirmation: true,
        finalReport: { include: reportInclude },
      },
    });
  }
  assignments(termId: string) {
    return this.reviewDb.registration.findMany({
      where: { termId },
      include: {
        term: { select: { pr2bTermWorkflowTermId: true } },
        advisorAssignments: {
          where: { assignmentPlan: { status: "FINALIZED" } },
          include: {
            advisor: true,
            assignmentPlan: {
              include: { pr2bAssignmentPlanWorkflowPlanId: true },
            },
            pr2bAssignmentChangeAssignmentId: {
              orderBy: { assignmentRevision: "desc" },
              take: 1,
            },
          },
        },
      },
    });
  }
  lecturerRoster(termId: string) {
    return this.reviewDb.termLecturer.findMany({ where: { termId } });
  }
}

@Injectable()
export class DefenseReviewRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  read<T>(
    work: (s: DefenseReviewSession, tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return this.prisma.$transaction(
      (tx) => work(new DefenseReviewSession(tx), tx),
      {
        isolationLevel: "RepeatableRead",
        maxWait: 10000,
        timeout: 15000,
      },
    );
  }
}
