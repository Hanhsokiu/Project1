import { Injectable } from '@nestjs/common';
import type { ProposalFeedback, RevisionResponse } from '@doan/shared';
import { SubmittedProposalContentSchema } from '@doan/shared';
import { groupError } from '../review-groups/review-group.errors';
import {
  ProposalReviewValidator,
  reviewHash,
} from '../proposal-reviews/proposal-review.validator';
import type { ReviewProposal } from '../proposal-reviews/proposal-review.repository';
import type {
  ProposalVersionSession,
  VersionRecord,
} from './proposal-version.repository';
@Injectable()
export class ProposalVersionValidator {
  constructor(private readonly review: ProposalReviewValidator) {}
  async phase(s: ProposalVersionSession, termId: string) {
    const term = await s.term(termId),
      phase = await s.editPhase(termId),
      now = new Date();
    if (!term || !['CLOSED_REGISTRATION', 'IN_PROGRESS'].includes(term.status))
      groupError(409, 'TERM_003', 'Đợt không cho phép sửa/gửi đề cương.');
    if (!phase || phase.refPhaseId.termId !== termId)
      groupError(409, 'INPUT_NOT_READY', 'Chưa cấu hình phase PROPOSAL_EDIT.');
    if (
      phase.refPhaseId.isLocked ||
      now < phase.refPhaseId.startDate ||
      now >= phase.refPhaseId.endDate
    )
      groupError(
        409,
        'TERM_003',
        'Phase chỉnh sửa chưa mở, đã khóa hoặc hết hạn.',
      );
    return phase;
  }
  async editable(s: ProposalVersionSession, p: ReviewProposal) {
    const dossier = await s.dossier(p.id),
      d = dossier?.pr2bDossierWorkflowDossierId;
    if (
      dossier &&
      (!d ||
        !['DRAFT', 'REOPENED'].includes(d.state ?? '') ||
        d.currentFinalizationId ||
        dossier.pr2bDossierFinalizationDossierId.some((f) => !f.supersededAt))
    )
      groupError(
        409,
        'DOSSIER_LOCKED',
        'Hồ sơ đã chốt hoặc legacy chưa đối soát; không được sửa trực tiếp.',
      );
    this.review.state(['DRAFT', 'REVISION_REQUESTED'], p.status);
    if (
      p.reviews.some(
        (r) =>
          !r.pr2bProposalReviewWorkflowReviewId?.state ||
          ['ASSIGNED', 'IN_REVIEW'].includes(
            r.pr2bProposalReviewWorkflowReviewId.state,
          ),
      )
    )
      groupError(
        409,
        'ACTIVE_REVIEW_EXISTS',
        'Còn vòng duyệt hoạt động hoặc legacy chưa đối soát.',
      );
  }
  base(
    p: ReviewProposal,
    working: VersionRecord | null,
    submitted: VersionRecord | null,
    basedOnVersionId?: string,
  ) {
    if (
      p.status === 'REVISION_REQUESTED' &&
      submitted?.pr2bProposalVersionWorkflowVersionId?.state !== 'SEALED'
    )
      groupError(
        409,
        'INPUT_NOT_READY',
        'Phiên bản bị trả sửa phải là snapshot SEALED có chứng cứ.',
      );
    const expected =
      p.status === 'REVISION_REQUESTED'
        ? submitted?.id
        : (working?.id ?? submitted?.id);
    if (basedOnVersionId !== undefined && basedOnVersionId !== expected)
      groupError(
        409,
        'STALE_VERSION',
        'Bản làm việc đã đổi; hãy tải lại trước khi lưu.',
      );
    return p.status === 'REVISION_REQUESTED'
      ? submitted
      : (working ?? submitted);
  }
  returned(
    p: ReviewProposal,
    decisions: Array<{ versionId: string; decision: string }>,
  ) {
    if (
      p.status === 'REVISION_REQUESTED' &&
      !decisions.some(
        (d) =>
          d.versionId ===
            p.pr2bProposalWorkflowProposalId?.submittedVersionId &&
          d.decision === 'REVISION_REQUIRED',
      )
    )
      groupError(
        409,
        'INPUT_NOT_READY',
        'Thiếu quyết định Yêu cầu sửa gắn đúng phiên bản đã nộp.',
      );
  }
  responses(responses: RevisionResponse[], feedback: ProposalFeedback[]) {
    if (
      new Set(responses.map((r) => `${r.targetType}:${r.targetId}`)).size !==
        responses.length ||
      responses.some(
        (r) =>
          !feedback.some(
            (f) => f.targetType === r.targetType && f.targetId === r.targetId,
          ),
      )
    )
      groupError(
        400,
        'FEEDBACK_SCOPE_INVALID',
        'Phản hồi phải gắn đúng góp ý đã lưu của đề cương, không trùng mục.',
      );
  }
  content(version: VersionRecord) {
    const result = SubmittedProposalContentSchema.safeParse(version.content);
    if (!result.success)
      groupError(
        400,
        'PROPOSAL_CONTENT_INVALID',
        result.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
      );
    const meta = version.pr2bProposalVersionWorkflowVersionId;
    if (
      meta?.state !== 'DRAFT' ||
      meta.contentSchemaVersion !== 1 ||
      !meta.createdByUserId ||
      reviewHash(version.content) !== meta.contentHash
    )
      groupError(409, 'STALE_VERSION', 'Snapshot nháp hoặc hash không hợp lệ.');
    return result.data;
  }
}
