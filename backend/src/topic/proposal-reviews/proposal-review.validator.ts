import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { groupError } from '../review-groups/review-group.errors';
import type {
  ReviewPrincipal,
  ReviewProposal,
  ReviewRecord,
  ProposalReviewSession,
} from './proposal-review.repository';
export const canonicalReviewJson = (value: unknown): string =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
export const reviewHash = (value: unknown) =>
  createHash('sha256').update(canonicalReviewJson(value)).digest('hex');
@Injectable()
export class ProposalReviewValidator {
  principal(user: ReviewPrincipal | null) {
    if (!user) groupError(401, 'AUTH_003', 'Không xác định được tài khoản.');
    if (user.status !== 'ACTIVE')
      groupError(403, 'AUTH_002', 'Tài khoản không hoạt động.');
    return user;
  }
  role(user: ReviewPrincipal, role: string, action: string) {
    return user.userRoles.some(
      (r) =>
        r.role.name === role &&
        r.role.rolePermissions.some(
          (p) =>
            p.permission.resource === 'proposal' &&
            p.permission.action === action,
        ),
    );
  }
  revision(actual: number, expected: number) {
    if (actual !== expected)
      groupError(
        409,
        'REVISION_CONFLICT',
        'Dữ liệu đã thay đổi. Hãy tải lại trước khi gửi.',
      );
  }
  state(allowed: string[], actual: string) {
    if (!allowed.includes(actual))
      groupError(
        409,
        'STATE_TRANSITION_INVALID',
        'Trạng thái hiện tại không cho phép thao tác.',
      );
  }
  ownership(p: ReviewProposal) {
    const owner = p.topic.pr2bTopicWorkflowTopicId;
    if (
      !owner?.termStudentId ||
      owner.termId !== p.topic.termId ||
      owner.refTermStudentId?.termId !== p.topic.termId ||
      owner.refTermStudentId.studentId !== p.studentId
    )
      groupError(
        409,
        'INPUT_NOT_READY',
        'Chưa có ownership TermStudent hợp lệ từ bước 1–3.',
      );
    return owner;
  }
  async advisor(s: ProposalReviewSession, p: ReviewProposal) {
    this.ownership(p);
    const term = await s.term(p.topic.termId),
      registration = await s.advisor(p.topic.termId, p.studentId);
    const assignment = registration?.advisorAssignment;
    const plan = assignment?.assignmentPlan;
    const meta = plan?.pr2bAssignmentPlanWorkflowPlanId;
    const latest = assignment?.pr2bAssignmentChangeAssignmentId[0];
    if (
      !assignment ||
      !plan ||
      plan.status !== 'FINALIZED' ||
      plan.termId !== p.topic.termId ||
      term?.pr2bTermWorkflowTermId?.officialAssignmentPlanId !== plan.id ||
      !meta?.finalizedAt ||
      !meta.finalizedByUserId ||
      meta.finalizedAt > new Date() ||
      !assignment.advisor.isActive ||
      !(await s.roster(p.topic.termId, assignment.advisorId)) ||
      (latest &&
        (latest.effectiveAt > new Date() ||
          latest.newAdvisorId !== assignment.advisorId))
    )
      groupError(
        409,
        'INPUT_NOT_READY',
        'Thiếu phân công GVHD chính thức FINALIZED hoặc lịch sử bàn giao hợp lệ.',
      );
    return { assignment, revision: latest?.assignmentRevision ?? 0 };
  }
  async submitted(
    s: ProposalReviewSession,
    p: ReviewProposal,
    versionId?: string,
  ) {
    const owner = this.ownership(p),
      context = await this.advisor(s, p);
    const workflow = p.pr2bProposalWorkflowProposalId;
    const version = workflow?.refSubmittedVersionId,
      meta = version?.pr2bProposalVersionWorkflowVersionId;
    if (versionId && workflow?.submittedVersionId !== versionId)
      groupError(
        409,
        'STALE_VERSION',
        'Phiên bản đang xét không còn là phiên bản đã nộp hiện hành.',
      );
    if (
      !workflow ||
      !version ||
      version.proposalId !== p.id ||
      meta?.state !== 'SEALED' ||
      meta.contentSchemaVersion !== 1 ||
      !meta.contentHash ||
      !meta.submittedAt ||
      meta.submittedAt > new Date() ||
      meta.submittedByUserId !== p.student.userId ||
      !workflow.submissionKind
    )
      groupError(
        409,
        'INPUT_NOT_READY',
        'Chưa có phiên bản SEALED và metadata nộp hợp lệ.',
      );
    if (reviewHash(version.content) !== meta.contentHash)
      groupError(
        409,
        'STALE_VERSION',
        'Nội dung phiên bản đã nộp không khớp hash.',
      );
    if (
      owner.confirmedAt === null ||
      owner.confirmedByAdvisorId !== context.assignment.advisorId ||
      owner.confirmedTopicRevision !== owner.revision ||
      owner.confirmedAssignmentRevision !== context.revision
    )
      groupError(
        409,
        'TOPIC_NOT_AGREED',
        'Đề tài cần GVHD xác nhận đúng revision hiện hành.',
      );
    return { workflow, version, meta, ...context };
  }
  routing(p: ReviewProposal) {
    const mapping =
      p.topic.researchArea?.pr2bResearchAreaWorkflowResearchAreaId;
    if (!mapping?.departmentId)
      groupError(
        409,
        'ROUTING_NOT_CONFIGURED',
        'Chưa cấu hình hướng đề tài → bộ môn.',
      );
    return mapping;
  }
  async phase(s: ProposalReviewSession, termId: string) {
    const term = await s.term(termId),
      phase = await s.phase(termId),
      now = new Date();
    if (!term || !['CLOSED_REGISTRATION', 'IN_PROGRESS'].includes(term.status))
      groupError(409, 'TERM_003', 'Đợt không cho phép xét duyệt.');
    if (!phase || phase.refPhaseId.termId !== termId)
      groupError(
        409,
        'INPUT_NOT_READY',
        'Chưa cấu hình phase PROPOSAL_REVIEW.',
      );
    if (
      phase.refPhaseId.isLocked ||
      now < phase.refPhaseId.startDate ||
      now >= phase.refPhaseId.endDate
    )
      groupError(
        409,
        'TERM_003',
        'Phase duyệt chưa mở, đã khóa hoặc đã hết hạn.',
      );
    return phase;
  }
  active(r: ReviewRecord) {
    const w = r.pr2bProposalReviewWorkflowReviewId;
    if (!w?.state || !w.versionId || !w.roundNumber)
      groupError(
        409,
        'INPUT_NOT_READY',
        'Vòng legacy cần đối soát, không tự gán trạng thái.',
      );
    if (r.pr2bProposalReviewDecisionReviewId || w.state === 'DECIDED')
      groupError(
        409,
        'REVIEW_ALREADY_DECIDED',
        'Vòng duyệt đã có kết luận chung.',
      );
    this.state(['ASSIGNED', 'IN_REVIEW'], w.state);
    return w;
  }
}
