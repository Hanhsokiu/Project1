import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProposalReviewSession } from '../proposal-reviews/proposal-review.repository';
import { groupError } from '../review-groups/review-group.errors';
const include = {
  pr2bProposalVersionWorkflowVersionId: {
    include: { refCreatedByUserId: { select: { username: true } } },
  },
} satisfies Prisma.ProposalVersionInclude;
export type VersionRecord = Prisma.ProposalVersionGetPayload<{
  include: typeof include;
}>;
export class ProposalVersionSession extends ProposalReviewSession {
  constructor(private readonly local: Prisma.TransactionClient) {
    super(local);
  }
  version(id: string) {
    return this.local.proposalVersion.findUnique({ where: { id }, include });
  }
  versions(
    proposalId: string,
    visibleIds: string[] | null,
    skip: number,
    take: number,
  ) {
    return this.local.proposalVersion.findMany({
      where: { proposalId, id: visibleIds ? { in: visibleIds } : undefined },
      include,
      orderBy: [{ version: 'desc' }, { id: 'desc' }],
      skip,
      take,
    });
  }
  versionCount(proposalId: string, visibleIds: string[] | null) {
    return this.local.proposalVersion.count({
      where: { proposalId, id: visibleIds ? { in: visibleIds } : undefined },
    });
  }
  editPhase(termId: string) {
    return this.local.termPhaseWorkflow.findUnique({
      where: { termId_key: { termId, key: 'PROPOSAL_EDIT' } },
      include: { refPhaseId: true },
    });
  }
  dossier(proposalId: string) {
    return this.local.thesisDossier.findUnique({
      where: { proposalId },
      include: {
        pr2bDossierWorkflowDossierId: true,
        pr2bDossierFinalizationDossierId: true,
      },
    });
  }
  addVersion(data: Prisma.ProposalVersionUncheckedCreateInput) {
    return this.local.proposalVersion.create({ data, include });
  }
  workflow(proposalId: string) {
    return this.local.proposalWorkflow.findUnique({ where: { proposalId } });
  }
  advance(
    proposalId: string,
    revision: number,
    data: Prisma.ProposalWorkflowUncheckedUpdateManyInput,
  ) {
    return this.local.proposalWorkflow.updateMany({
      where: { proposalId, revision },
      data: { ...data, revision: { increment: 1 } },
    });
  }
  seal(versionId: string, userId: string, now: Date) {
    return this.local.proposalVersionWorkflow.updateMany({
      where: { versionId, state: 'DRAFT', submittedAt: null },
      data: {
        state: 'SEALED',
        submittedAt: now,
        submittedByUserId: userId,
        revision: { increment: 1 },
      },
    });
  }
  versionAudit(
    userId: string,
    proposalId: string,
    action: string,
    oldValue: Prisma.InputJsonValue,
    newValue: Prisma.InputJsonValue,
  ) {
    return this.local.auditLog.create({
      data: {
        userId,
        resource: 'proposal-version',
        resourceId: proposalId,
        action,
        oldValue,
        newValue,
      },
    });
  }
}
@Injectable()
export class ProposalVersionRepository {
  constructor(private readonly prisma: PrismaService) {}
  async transaction<T>(
    work: (s: ProposalVersionSession) => Promise<T>,
    mutation = false,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++)
      try {
        return await this.prisma.$transaction(
          (tx) => work(new ProposalVersionSession(tx)),
          {
            isolationLevel: mutation ? 'Serializable' : 'RepeatableRead',
            timeout: 20000,
          },
        );
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          (['P2034', 'P2002'].includes(e.code) ||
            (e.code === 'P2010' &&
              ['40001', '40P01'].includes(String(e.meta?.code))))
        ) {
          if (attempt < 2) continue;
          groupError(
            409,
            'REVISION_CONFLICT',
            'Dữ liệu đã thay đổi. Hãy tải lại.',
          );
        }
        throw e;
      }
  }
}
