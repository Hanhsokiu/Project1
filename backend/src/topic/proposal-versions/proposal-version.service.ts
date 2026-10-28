import { HttpException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { compareProposalData, RevisionResponseSchema } from '@doan/shared';
import type {
  ProposalVersionSave,
  ProposalVersionSubmit,
  ProposalVersionView,
  ProposalVersionMutationView,
  ProposalEditorContext,
  ProposalFeedback,
  RevisionResponse,
  VersionPageQuery,
} from '@doan/shared';
import {
  ProposalVersionRepository,
  ProposalVersionSession,
  VersionRecord,
} from './proposal-version.repository';
import { ProposalVersionValidator } from './proposal-version.validator';
import {
  ProposalReviewValidator,
  reviewHash,
} from '../proposal-reviews/proposal-review.validator';
import type {
  ReviewPrincipal,
  ReviewProposal,
} from '../proposal-reviews/proposal-review.repository';
import { groupError } from '../review-groups/review-group.errors';
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
@Injectable()
export class ProposalVersionService {
  constructor(
    private readonly repo: ProposalVersionRepository,
    private readonly validator: ProposalVersionValidator,
    private readonly review: ProposalReviewValidator,
  ) {}
  private async writer(
    s: ProposalVersionSession,
    u: ReviewPrincipal,
    p: ReviewProposal,
    action: 'edit' | 'submit' | 'read',
  ) {
    if (
      this.review.role(u, 'STUDENT', action) &&
      u.student?.isActive &&
      u.student.id === p.studentId
    ) {
      this.review.ownership(p);
      return true;
    }
    if (
      action !== 'submit' &&
      this.review.role(u, 'LECTURER', action) &&
      u.lecturer?.isActive
    ) {
      const registration = await s.advisor(p.topic.termId, p.studentId);
      if (registration?.advisorAssignment?.advisorId === u.lecturer.id) {
        await this.review.advisor(s, p);
        return true;
      }
    }
    return false;
  }
  private async scope(
    s: ProposalVersionSession,
    u: ReviewPrincipal,
    p: ReviewProposal,
  ): Promise<string[] | null> {
    if (await this.writer(s, u, p, 'read')) return null;
    const department =
      p.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId
        ?.departmentId;
    if (department && this.review.role(u, 'FACULTY', 'read')) {
      const [g] = await s.grants(u.id, p.topic.termId);
      if (
        g &&
        (g.allDepartments ||
          g.pr2bGrantDepartmentGrantId.some(
            (d) => d.departmentId === department,
          ))
      )
        return null;
    }
    if (
      this.review.role(u, 'LECTURER', 'read') &&
      u.lecturer?.isActive &&
      (await s.roster(p.topic.termId, u.lecturer.id))
    ) {
      const ids = p.reviews
        .filter(
          (r) =>
            r.reviewGroup.termId === p.topic.termId &&
            r.reviewGroup.members.some((m) => m.lecturerId === u.lecturer!.id),
        )
        .map((r) => r.pr2bProposalReviewWorkflowReviewId?.versionId)
        .filter((id): id is string => !!id);
      if (ids.length) {
        const ctx = await this.review.advisor(s, p);
        if (ctx.assignment.advisorId !== u.lecturer.id) return ids;
      }
    }
    groupError(404, 'COMMON_001', 'Không tìm thấy đề cương trong phạm vi.');
  }
  private async load(
    s: ProposalVersionSession,
    userId: string,
    proposalId: string,
  ) {
    const user = this.review.principal(await s.principal(userId)),
      p = await s.proposal(proposalId);
    if (!p) groupError(404, 'COMMON_001', 'Không tìm thấy đề cương.');
    return { user, p };
  }
  private view(v: VersionRecord): ProposalVersionView {
    const meta = v.pr2bProposalVersionWorkflowVersionId;
    const parsed = RevisionResponseSchema.array().safeParse(
      meta?.revisionResponses ?? [],
    );
    if (!parsed.success)
      groupError(
        409,
        'INPUT_NOT_READY',
        'Metadata phản hồi legacy cần đối soát.',
      );
    return {
      id: v.id,
      proposalId: v.proposalId,
      versionNumber: v.version,
      content: v.content,
      state: meta?.state ?? null,
      contentHash: meta?.contentHash ?? null,
      createdAt: v.createdAt.toISOString(),
      createdByUserId: meta?.createdByUserId ?? null,
      authorName: meta?.refCreatedByUserId?.username ?? null,
      submittedAt: meta?.submittedAt?.toISOString() ?? null,
      submittedByUserId: meta?.submittedByUserId ?? null,
      basedOnVersionId: meta?.basedOnVersionId ?? null,
      changeSummary: meta?.changeSummary ?? null,
      responses: parsed.data,
      provenance: meta?.provenance ?? null,
    };
  }
  private async visibleVersion(
    s: ProposalVersionSession,
    p: ReviewProposal,
    id: string,
    visibleIds: string[] | null,
  ) {
    if (visibleIds && !visibleIds.includes(id))
      groupError(404, 'COMMON_001', 'Phiên bản ngoài phạm vi.');
    const v = await s.version(id);
    if (!v || v.proposalId !== p.id)
      groupError(404, 'COMMON_001', 'Không tìm thấy phiên bản.');
    if (
      visibleIds &&
      v.pr2bProposalVersionWorkflowVersionId?.state !== 'SEALED'
    )
      groupError(404, 'COMMON_001', 'Không tìm thấy phiên bản đã phân.');
    return v;
  }
  private async feedback(
    s: ProposalVersionSession,
    p: ReviewProposal,
    visibleIds: string[] | null,
  ): Promise<ProposalFeedback[]> {
    const result: ProposalFeedback[] = [];
    for (const r of await s.history(p.id)) {
      const w = r.pr2bProposalReviewWorkflowReviewId,
        version = w?.refVersionId;
      if (
        !w?.versionId ||
        !version ||
        version.pr2bProposalVersionWorkflowVersionId?.state !== 'SEALED' ||
        (visibleIds && !visibleIds.includes(version.id))
      )
        continue;
      for (const c of r.pr2bReviewCommentReviewId)
        result.push({
          targetType: 'COMMENT',
          targetId: c.id,
          reviewId: r.id,
          sourceVersionId: version.id,
          versionNumber: version.version,
          roundNumber: w.roundNumber,
          authorUserId: c.authorUserId,
          authorName: c.refAuthorUserId.username,
          text: c.text,
          createdAt: c.createdAt.toISOString(),
        });
      const d = r.pr2bProposalReviewDecisionReviewId;
      if (d?.decision === 'REVISION_REQUIRED')
        result.push({
          targetType: 'DECISION',
          targetId: d.id,
          reviewId: r.id,
          sourceVersionId: version.id,
          versionNumber: version.version,
          roundNumber: w.roundNumber,
          authorUserId: d.decidedByUserId,
          authorName: d.refDecidedByUserId.username,
          text: d.comment ?? '',
          createdAt: d.decidedAt.toISOString(),
        });
    }
    return result.sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) ||
        a.targetId.localeCompare(b.targetId),
    );
  }
  async context(userId: string, proposalId: string) {
    return this.repo.transaction(async (s) => {
      const { user, p } = await this.load(s, userId, proposalId),
        visible = await this.scope(s, user, p),
        w = p.pr2bProposalWorkflowProposalId;
      if (!w)
        groupError(
          409,
          'INPUT_NOT_READY',
          'Producer cần khởi tạo ProposalWorkflow, không tự suy dữ liệu legacy.',
        );
      const working =
        w.workingVersionId && (!visible || visible.includes(w.workingVersionId))
          ? await this.visibleVersion(s, p, w.workingVersionId, visible)
          : null;
      const submitted =
        w.submittedVersionId &&
        (!visible || visible.includes(w.submittedVersionId))
          ? await this.visibleVersion(s, p, w.submittedVersionId, visible)
          : null;
      const readiness: string[] = [],
        allowedActions: ProposalEditorContext['allowedActions'] = [];
      try {
        if (await this.writer(s, user, p, 'edit')) {
          await this.validator.phase(s, p.topic.termId);
          await this.validator.editable(s, p);
          if (!w.nextVersionNumber || !w.nextReviewRound)
            groupError(
              409,
              'INPUT_NOT_READY',
              'Thiếu counter phiên bản/vòng từ producer.',
            );
          allowedActions.push('save');
          if (
            p.status === 'DRAFT' &&
            working?.pr2bProposalVersionWorkflowVersionId?.state === 'DRAFT' &&
            (await this.writer(s, user, p, 'submit'))
          )
            allowedActions.push('submit');
        }
      } catch (e) {
        if (!(e instanceof HttpException)) throw e;
        const body = e.getResponse() as { error?: { code?: string } };
        readiness.push(body.error?.code ?? 'INPUT_NOT_READY');
      }
      const phase = await s.editPhase(p.topic.termId);
      return {
        proposalId: p.id,
        topicId: p.topicId,
        termId: p.topic.termId,
        termStudentId: p.topic.pr2bTopicWorkflowTopicId?.termStudentId ?? '',
        title: p.topic.title,
        studentName: p.student.fullName,
        status: p.status,
        revision: w.revision,
        workingVersionId: working?.id ?? null,
        submittedVersionId: submitted?.id ?? null,
        workingVersion: working ? this.view(working) : null,
        submittedVersion: submitted ? this.view(submitted) : null,
        feedback: await this.feedback(s, p, visible),
        allowedActions,
        readiness,
        phase: phase
          ? {
              startsAt: phase.refPhaseId.startDate.toISOString(),
              endsAt: phase.refPhaseId.endDate.toISOString(),
              isLocked: phase.refPhaseId.isLocked,
            }
          : null,
      } satisfies ProposalEditorContext;
    });
  }
  async list(userId: string, proposalId: string, q: VersionPageQuery) {
    return this.repo.transaction(async (s) => {
      const { user, p } = await this.load(s, userId, proposalId),
        visible = await this.scope(s, user, p);
      const rows = await s.versions(
          p.id,
          visible,
          (q.page - 1) * q.limit,
          q.limit,
        ),
        total = await s.versionCount(p.id, visible);
      const data: ProposalVersionView[] = [];
      for (const row of rows) {
        if (visible) await this.visibleVersion(s, p, row.id, visible);
        data.push(this.view(row));
      }
      return {
        data,
        total,
        page: q.page,
        limit: q.limit,
        totalPages: Math.ceil(total / q.limit),
      };
    });
  }
  async detail(userId: string, proposalId: string, id: string) {
    return this.repo.transaction(async (s) => {
      const { user, p } = await this.load(s, userId, proposalId),
        scope = await this.scope(s, user, p);
      return this.view(await this.visibleVersion(s, p, id, scope));
    });
  }
  async compare(userId: string, proposalId: string, from: string, to: string) {
    return this.repo.transaction(async (s) => {
      const { user, p } = await this.load(s, userId, proposalId),
        scope = await this.scope(s, user, p),
        a = this.view(await this.visibleVersion(s, p, from, scope)),
        b = this.view(await this.visibleVersion(s, p, to, scope));
      return {
        fromVersionId: a.id,
        toVersionId: b.id,
        changes: compareProposalData(
          { content: a.content, responses: a.responses },
          { content: b.content, responses: b.responses },
        ),
      };
    });
  }
  async save(
    userId: string,
    proposalId: string,
    input: ProposalVersionSave,
    key: string,
  ) {
    return this.command(
      userId,
      proposalId,
      'edit',
      `/proposals/${proposalId}/versions`,
      input,
      key,
      async (s, u, p) => {
        await this.validator.editable(s, p);
        const w = p.pr2bProposalWorkflowProposalId;
        if (!w?.nextVersionNumber || w.nextVersionNumber < 1)
          groupError(
            409,
            'INPUT_NOT_READY',
            'Thiếu counter nextVersionNumber, không tự backfill.',
          );
        this.review.revision(w.revision, input.expectedRevision);
        const working = w.workingVersionId
            ? await this.visibleVersion(s, p, w.workingVersionId, null)
            : null,
          submitted = w.submittedVersionId
            ? await this.visibleVersion(s, p, w.submittedVersionId, null)
            : null;
        const base = this.validator.base(
          p,
          working,
          submitted,
          input.basedOnVersionId,
        );
        if (w.nextVersionNumber <= (base?.version ?? 0))
          groupError(
            409,
            'INPUT_NOT_READY',
            'Counter phiên bản không nhất quán; cần producer đối soát.',
          );
        const rounds = await s.history(p.id);
        this.validator.returned(
          p,
          rounds
            .map((r) => r.pr2bProposalReviewDecisionReviewId)
            .filter((d): d is NonNullable<typeof d> => !!d),
        );
        const responses: RevisionResponse[] =
          input.responses ?? (base ? this.view(base).responses : []);
        this.validator.responses(responses, await this.feedback(s, p, null));
        const version = await s.addVersion({
          proposalId: p.id,
          version: w.nextVersionNumber,
          content: json(input.content),
          pr2bProposalVersionWorkflowVersionId: {
            create: {
              state: 'DRAFT',
              contentSchemaVersion: 1,
              contentHash: reviewHash(input.content),
              createdByUserId: u.id,
              basedOnVersionId: base?.id,
              changeSummary: input.changeSummary || null,
              revisionResponses: json(responses),
            },
          },
        });
        const changed = await s.advance(p.id, w.revision, {
          nextVersionNumber: { increment: 1 },
          workingVersionId: version.id,
        });
        if (changed.count !== 1)
          groupError(
            409,
            'REVISION_CONFLICT',
            'Đề cương đã được người khác sửa.',
          );
        await s.status(p.id, 'DRAFT');
        await s.versionAudit(
          u.id,
          p.id,
          'VERSION_SAVED',
          json({
            workingVersionId: w.workingVersionId,
            status: p.status,
            revision: w.revision,
          }),
          json({
            versionId: version.id,
            basedOnVersionId: base?.id ?? null,
            contentHash: reviewHash(input.content),
            changedPaths: compareProposalData(
              base?.content ?? null,
              input.content,
            ).map((d) => d.path),
            responseTargets: responses.map((r) => ({
              targetType: r.targetType,
              targetId: r.targetId,
            })),
          }),
        );
        return { ...this.view(version), proposalRevision: w.revision + 1 };
      },
    );
  }
  async submit(
    userId: string,
    proposalId: string,
    input: ProposalVersionSubmit,
    key: string,
  ) {
    return this.command(
      userId,
      proposalId,
      'submit',
      `/proposals/${proposalId}/submit`,
      input,
      key,
      async (s, u, p) => {
        await this.validator.editable(s, p);
        this.review.state(['DRAFT'], p.status);
        const w = p.pr2bProposalWorkflowProposalId;
        if (!w?.nextReviewRound || w.nextReviewRound < 1)
          groupError(
            409,
            'INPUT_NOT_READY',
            'Thiếu counter vòng duyệt từ producer.',
          );
        this.review.revision(w.revision, input.expectedRevision);
        if (w.workingVersionId !== input.versionId)
          groupError(
            409,
            'STALE_VERSION',
            'Chỉ được gửi bản làm việc hiện hành đã lưu.',
          );
        const version = await this.visibleVersion(s, p, input.versionId, null);
        this.validator.content(version);
        const context = await this.review.advisor(s, p),
          topic = this.review.ownership(p);
        if (
          !topic.confirmedAt ||
          topic.confirmedByAdvisorId !== context.assignment.advisorId ||
          topic.confirmedTopicRevision !== topic.revision ||
          topic.confirmedAssignmentRevision !== context.revision
        )
          groupError(
            409,
            'TOPIC_NOT_AGREED',
            'GVHD cần xác nhận đề tài đúng revision/phân công hiện hành.',
          );
        this.review.routing(p);
        const now = new Date(),
          sealed = await s.seal(version.id, u.id, now);
        if (sealed.count !== 1)
          groupError(
            409,
            'STALE_VERSION',
            'Phiên bản không còn là nháp có thể gửi.',
          );
        const kind = w.submittedVersionId ? 'RESUBMISSION' : 'INITIAL';
        const updated = await s.advance(p.id, w.revision, {
          submittedVersionId: version.id,
          submissionKind: kind,
        });
        if (updated.count !== 1)
          groupError(409, 'REVISION_CONFLICT', 'Đề cương đã thay đổi.');
        await s.status(p.id, 'SUBMITTED');
        await s.versionAudit(
          u.id,
          p.id,
          'VERSION_SUBMITTED',
          json({
            submittedVersionId: w.submittedVersionId,
            revision: w.revision,
          }),
          json({
            versionId: version.id,
            submissionKind: kind,
            contentHash:
              version.pr2bProposalVersionWorkflowVersionId!.contentHash,
          }),
        );
        await s.outbox({
          eventId: randomUUID(),
          aggregateId: p.id,
          type: 'PROPOSAL_VERSION_SUBMITTED',
          payload: json({
            proposalId: p.id,
            termId: p.topic.termId,
            versionId: version.id,
            submissionKind: kind,
            studentUserId: u.id,
            advisorUserId: context.assignment.advisor.userId,
          }),
        });
        return {
          ...this.view((await s.version(version.id))!),
          proposalRevision: w.revision + 1,
        };
      },
    );
  }
  private async command(
    userId: string,
    proposalId: string,
    action: 'edit' | 'submit',
    route: string,
    input: unknown,
    key: string,
    work: (
      s: ProposalVersionSession,
      u: ReviewPrincipal,
      p: ReviewProposal,
    ) => Promise<ProposalVersionMutationView>,
  ) {
    if (!key || key.length > 200 || !/^[\w.-]+$/.test(key))
      groupError(400, 'COMMON_003', 'Thiếu hoặc sai Idempotency-Key.');
    return this.repo.transaction(async (s) => {
      let { user, p } = await this.load(s, userId, proposalId);
      if (!(await this.writer(s, user, p, action)))
        groupError(
          404,
          'COMMON_001',
          'Không tìm thấy đề cương có quyền chỉnh sửa/gửi.',
        );
      await s.lock(p.topic.termId, [], p.id);
      ({ user, p } = await this.load(s, userId, proposalId));
      if (!(await this.writer(s, user, p, action)))
        groupError(404, 'COMMON_001', 'Quyền chỉnh sửa không còn hiệu lực.');
      const hash = reviewHash(input),
        old = await s.replay(user.id, route, key);
      if (old) {
        if (old.payloadHash !== hash)
          groupError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'Khóa gửi lại có payload khác.',
          );
        return old.result as unknown as ProposalVersionMutationView;
      }
      await this.validator.phase(s, p.topic.termId);
      const result = await work(s, user, p);
      await this.validator.phase(s, p.topic.termId);
      await s.remember(user.id, route, key, hash, json(result));
      return result;
    }, true);
  }
}
