import { z } from 'zod';
import type { GroupPage } from './review-groups';
const id = z.string().trim().min(1).max(100);
const revision = z.number().int().nonnegative();
export const ReviewQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(255).optional(),
    departmentId: id.optional(),
    groupId: id.optional(),
    status: z
      .enum([
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'REVISION_REQUESTED',
        'APPROVED',
        'REJECTED',
      ])
      .optional(),
    unassigned: z.enum(['true', 'false']).optional(),
  })
  .strict();
export const AssignReviewSchema = z
  .object({
    groupId: id,
    proposalVersionId: id,
    expectedProposalRevision: revision,
    replacesReviewId: id.optional(),
    expectedReviewRevision: revision.optional(),
    reason: z.string().trim().min(1).max(2000).optional(),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      (v.replacesReviewId !== undefined ||
        v.expectedReviewRevision !== undefined ||
        v.reason !== undefined) &&
      (!v.replacesReviewId ||
        v.expectedReviewRevision === undefined ||
        !v.reason)
    )
      c.addIssue({
        code: 'custom',
        message: 'Phân lại cần vòng cũ, revision và lý do.',
      });
  });
export const ReviewStartSchema = z
  .object({
    expectedProposalRevision: revision,
    expectedReviewRevision: revision,
  })
  .strict();
export const ReviewCommentSchema = z
  .object({
    expectedReviewRevision: revision,
    versionId: id,
    text: z.string().trim().min(1).max(10000),
  })
  .strict();
export const ReviewDecisionSchema = ReviewStartSchema.extend({
  versionId: id,
  decision: z.enum(['APPROVED', 'REVISION_REQUIRED']),
  comment: z.string().trim().max(10000).optional(),
}).superRefine((v, c) => {
  if (v.decision === 'REVISION_REQUIRED' && !v.comment)
    c.addIssue({
      code: 'custom',
      path: ['comment'],
      message: 'Yêu cầu sửa phải có nhận xét.',
    });
});
export type ReviewQuery = z.infer<typeof ReviewQuerySchema>;
export type AssignReview = z.infer<typeof AssignReviewSchema>;
export type ReviewStart = z.infer<typeof ReviewStartSchema>;
export type ReviewCommentInput = z.infer<typeof ReviewCommentSchema>;
export type ReviewDecisionInput = z.infer<typeof ReviewDecisionSchema>;
export type ProposalReviewSummary = {
  id: string;
  termId: string;
  title: string;
  studentName: string;
  studentCode: string;
  departmentId: string | null;
  departmentName: string | null;
  researchAreaName: string | null;
  status: string;
  revision: number | null;
  submittedVersionId: string | null;
  versionNumber: number | null;
  activeReviewId: string | null;
  groupName: string | null;
  readiness: string[];
  canAssign: boolean;
};
export type ReviewCandidate = {
  id: string;
  name: string;
  memberCount: number;
  eligibleReviewerCount: number;
  specialtyMatchCount: number;
  activeReviewCount: number;
  explanation: string;
};
export type ProposalReviewView = {
  id: string;
  proposalId: string;
  termId: string;
  title: string;
  studentName: string;
  studentCode: string;
  proposalStatus: string;
  proposalRevision: number;
  revision: number;
  state: string;
  roundNumber: number;
  groupId: string;
  groupName: string;
  versionId: string;
  versionNumber: number;
  version: {
    content: unknown;
    contentHash: string | null;
    submittedAt: string | null;
    submittedByUserId: string | null;
  };
  assignedByUserId: string | null;
  assignedAt: string | null;
  startedByUserId: string | null;
  startedAt: string | null;
  routingSnapshot: unknown;
  phaseSnapshot: unknown;
  supersededByReviewId: string | null;
  comments: Array<{
    id: string;
    versionId: string;
    authorUserId: string;
    authorName: string;
    createdAt: string;
    text: string;
  }>;
  decision: {
    id: string;
    versionId: string;
    decision: 'APPROVED' | 'REVISION_REQUIRED';
    comment: string | null;
    decidedByUserId: string;
    deciderName: string;
    decidedAt: string;
  } | null;
  allowedActions: Array<'start' | 'comment' | 'decide' | 'assign'>;
};
export type ProposalReviewPage = GroupPage<ProposalReviewSummary>;
