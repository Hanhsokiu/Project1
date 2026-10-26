import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { groupError } from "../review-groups/review-group.errors";

const principalInclude = {
  userRoles: {
    include: {
      role: { include: { rolePermissions: { include: { permission: true } } } },
    },
  },
  lecturer: true,
  student: true,
} satisfies Prisma.UserAccountInclude;
export type ReviewPrincipal = Prisma.UserAccountGetPayload<{
  include: typeof principalInclude;
}>;
export const proposalInclude = {
  student: true,
  topic: {
    include: {
      pr2bTopicWorkflowTopicId: { include: { refTermStudentId: true } },
      researchArea: {
        include: {
          pr2bResearchAreaWorkflowResearchAreaId: {
            include: { refDepartmentId: true },
          },
        },
      },
    },
  },
  pr2bProposalWorkflowProposalId: {
    include: {
      refSubmittedVersionId: {
        include: { pr2bProposalVersionWorkflowVersionId: true },
      },
    },
  },
  reviews: {
    include: {
      reviewGroup: {
        include: { members: true, pr2bReviewGroupWorkflowGroupId: true },
      },
      pr2bProposalReviewWorkflowReviewId: {
        include: { refVersionId: { select: { version: true } } },
      },
    },
  },
} satisfies Prisma.ProposalInclude;
export type ReviewProposal = Prisma.ProposalGetPayload<{
  include: typeof proposalInclude;
}>;
const reviewInclude = {
  proposal: { include: proposalInclude },
  reviewGroup: {
    include: { members: true, pr2bReviewGroupWorkflowGroupId: true },
  },
  pr2bProposalReviewWorkflowReviewId: {
    include: {
      refVersionId: { include: { pr2bProposalVersionWorkflowVersionId: true } },
    },
  },
  pr2bProposalReviewDecisionReviewId: {
    include: { refDecidedByUserId: { select: { username: true } } },
  },
  pr2bReviewCommentReviewId: {
    include: { refAuthorUserId: { select: { username: true } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.ProposalReviewInclude;
export type ReviewRecord = Prisma.ProposalReviewGetPayload<{
  include: typeof reviewInclude;
}>;
export class ProposalReviewSession {
  constructor(private readonly tx: Prisma.TransactionClient) {}
  principal(id: string) {
    return this.tx.userAccount.findUnique({
      where: { id },
      include: principalInclude,
    });
  }
  grants(userId: string, termId?: string) {
    return this.tx.academicTermGrant.findMany({
      where: { userId, termId },
      include: { pr2bGrantDepartmentGrantId: true },
    });
  }
  term(id: string) {
    return this.tx.thesisTerm.findUnique({
      where: { id },
      include: { pr2bTermWorkflowTermId: true },
    });
  }
  terms(where: Prisma.ThesisTermWhereInput) {
    return this.tx.thesisTerm.findMany({
      where,
      select: { id: true, name: true, status: true },
      orderBy: [{ startDate: "desc" }, { id: "asc" }],
    });
  }
  departments(ids?: string[]) {
    return this.tx.department.findMany({
      where: { id: ids ? { in: ids } : undefined },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }
  roster(termId: string, lecturerId: string) {
    return this.tx.termLecturer.findUnique({
      where: { termId_lecturerId: { termId, lecturerId } },
    });
  }
  memberTerms(lecturerId: string) {
    return this.tx.reviewGroup.findMany({
      where: {
        members: { some: { lecturerId } },
        pr2bReviewGroupWorkflowGroupId: { is: { archivedAt: null } },
      },
      select: { termId: true },
    });
  }
  studentTerms(studentId: string) {
    return this.tx.termStudent.findMany({
      where: { studentId },
      select: { termId: true },
    });
  }
  async advisorTerms(lecturerId: string) {
    const rows = await this.tx.registration.findMany({
      where: {
        advisorAssignments: {
          some: {
            advisorId: lecturerId,
            assignmentPlan: {
              status: "FINALIZED",
              pr2bAssignmentPlanWorkflowPlanId: {
                is: {
                  finalizedAt: { not: null },
                  finalizedByUserId: { not: null },
                },
              },
            },
          },
        },
      },
      select: {
        termId: true,
        advisorAssignments: {
          where: {
            advisorId: lecturerId,
            assignmentPlan: { status: "FINALIZED" },
          },
          select: { assignmentPlanId: true },
        },
        term: { select: { pr2bTermWorkflowTermId: true } },
      },
    });
    return rows.map((row) => ({
      ...row,
      advisorAssignment:
        row.advisorAssignments.find(
          (a) =>
            a.assignmentPlanId ===
            row.term.pr2bTermWorkflowTermId?.officialAssignmentPlanId,
        ) ?? null,
    }));
  }
  proposal(id: string) {
    return this.tx.proposal.findUnique({
      where: { id },
      include: proposalInclude,
    });
  }
  proposals(where: Prisma.ProposalWhereInput, skip: number, take: number) {
    return this.tx.proposal.findMany({
      where,
      include: proposalInclude,
      skip,
      take,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
  }
  count(where: Prisma.ProposalWhereInput) {
    return this.tx.proposal.count({ where });
  }
  review(id: string) {
    return this.tx.proposalReview.findUnique({
      where: { id },
      include: reviewInclude,
    });
  }
  history(proposalId: string) {
    return this.tx.proposalReview.findMany({
      where: { proposalId },
      include: reviewInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }
  phase(termId: string) {
    return this.tx.termPhaseWorkflow.findUnique({
      where: { termId_key: { termId, key: "PROPOSAL_REVIEW" } },
      include: { refPhaseId: true },
    });
  }
  async advisor(termId: string, studentId: string) {
    const row = await this.tx.registration.findUnique({
      where: { termId_studentId: { termId, studentId } },
      include: {
        term: { select: { pr2bTermWorkflowTermId: true } },
        advisorAssignments: {
          where: {
            assignmentPlan: { status: { in: ["PUBLISHED", "FINALIZED"] } },
          },
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
    return row
      ? {
          ...row,
          advisorAssignment:
            row.advisorAssignments.find(
              (a) =>
                a.assignmentPlanId ===
                row.term.pr2bTermWorkflowTermId?.officialAssignmentPlanId,
            ) ??
            (row.advisorAssignments.length === 1
              ? row.advisorAssignments[0]
              : null),
        }
      : null;
  }
  group(id: string) {
    return this.tx.reviewGroup.findUnique({
      where: { id },
      include: { members: true, pr2bReviewGroupWorkflowGroupId: true },
    });
  }
  groups(termId: string, departmentId: string) {
    return this.tx.reviewGroup.findMany({
      where: {
        termId,
        pr2bReviewGroupWorkflowGroupId: {
          is: { departmentId, archivedAt: null },
        },
      },
      include: {
        members: true,
        reviews: { include: { pr2bProposalReviewWorkflowReviewId: true } },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  }
  lecturers(termId: string, ids: string[]) {
    return this.tx.lecturer.findMany({
      where: {
        id: { in: ids },
        isActive: true,
        termLecturers: { some: { termId } },
        user: {
          status: "ACTIVE",
          userRoles: { some: { role: { name: "LECTURER" } } },
        },
      },
      include: { researchAreas: true },
    });
  }
  async lock(termId: string, groupIds: string[], proposalId: string) {
    // Shared with step 4; phase/roster/handover producers must acquire term first.
    await this.tx
      .$queryRaw`SELECT id FROM public."THESIS_TERM" WHERE id=${termId} FOR UPDATE`;
    for (const id of [...new Set(groupIds)].sort())
      await this.tx
        .$queryRaw`SELECT id FROM public."REVIEW_GROUP" WHERE id=${id} FOR UPDATE`;
    await this.tx
      .$queryRaw`SELECT id FROM public."PROPOSAL" WHERE id=${proposalId} FOR UPDATE`;
    // Also conflict with existing producer writes that lock their own rows.
    await this.tx
      .$queryRaw`SELECT id FROM public."TERM_PHASE" WHERE term_id=${termId} FOR UPDATE`;
    await this.tx
      .$queryRaw`SELECT a.id FROM public."ADVISOR_ASSIGNMENT" a JOIN public."REGISTRATION" r ON r.id=a.registration_id WHERE r.term_id=${termId} FOR UPDATE OF a`;
  }
  advanceProposal(
    proposalId: string,
    revision: number,
    data: Prisma.ProposalWorkflowUpdateManyMutationInput,
  ) {
    return this.tx.proposalWorkflow.updateMany({
      where: { proposalId, revision },
      data: { ...data, revision: { increment: 1 } },
    });
  }
  advanceReview(
    reviewId: string,
    revision: number,
    data: Prisma.ProposalReviewWorkflowUncheckedUpdateManyInput,
  ) {
    return this.tx.proposalReviewWorkflow.updateMany({
      where: { reviewId, revision },
      data: { ...data, revision: { increment: 1 } },
    });
  }
  status(id: string, status: Prisma.ProposalUpdateInput["status"]) {
    return this.tx.proposal.update({ where: { id }, data: { status } });
  }
  createReview(data: Prisma.ProposalReviewCreateInput) {
    return this.tx.proposalReview.create({ data });
  }
  comment(data: Prisma.ReviewCommentUncheckedCreateInput) {
    return this.tx.reviewComment.create({ data });
  }
  decision(data: Prisma.ProposalReviewDecisionUncheckedCreateInput) {
    return this.tx.proposalReviewDecision.create({ data });
  }
  mirrorDecision(
    id: string,
    decision: string,
    comment: string | null,
    reviewedAt: Date,
  ) {
    return this.tx.proposalReview.update({
      where: { id },
      data: { decision, comment, reviewedAt },
    });
  }
  audit(
    userId: string,
    id: string,
    action: string,
    oldValue: Prisma.InputJsonValue,
    newValue: Prisma.InputJsonValue,
  ) {
    return this.tx.auditLog.create({
      data: {
        userId,
        resource: "proposal-review",
        resourceId: id,
        action,
        oldValue,
        newValue,
      },
    });
  }
  outbox(data: Prisma.OutboxEventUncheckedCreateInput) {
    return this.tx.outboxEvent.create({ data });
  }
  replay(actorId: string, route: string, key: string) {
    return this.tx.idempotencyRecord.findUnique({
      where: {
        actorId_method_route_key: { actorId, method: "POST", route, key },
      },
    });
  }
  remember(
    actorId: string,
    route: string,
    key: string,
    payloadHash: string,
    result: Prisma.InputJsonValue,
  ) {
    return this.tx.idempotencyRecord.create({
      data: {
        actorId,
        method: "POST",
        route,
        key,
        payloadHash,
        result,
        expiresAt: new Date("9999-12-31Z"),
      },
    });
  }
}
@Injectable()
export class ProposalReviewRepository {
  constructor(private readonly prisma: PrismaService) {}
  async transaction<T>(
    work: (s: ProposalReviewSession) => Promise<T>,
    mutation = false,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++)
      try {
        return await this.prisma.$transaction(
          (tx) => work(new ProposalReviewSession(tx)),
          {
            isolationLevel: mutation ? "Serializable" : "RepeatableRead",
            timeout: 20000,
          },
        );
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          (["P2034", "P2002"].includes(e.code) ||
            (e.code === "P2010" &&
              ["40001", "40P01"].includes(String(e.meta?.code))))
        ) {
          if (attempt < 2) continue;
          groupError(
            409,
            "REVISION_CONFLICT",
            "Dữ liệu đã thay đổi. Hãy tải lại.",
          );
        }
        throw e;
      }
  }
}
