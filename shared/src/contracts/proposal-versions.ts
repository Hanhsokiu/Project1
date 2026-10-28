import { z } from 'zod';
import type { GroupPage } from './review-groups';
const id = z.string().trim().min(1).max(100);
const date = z
  .string()
  .refine(
    (v) =>
      v === '' || z.string().datetime({ offset: true }).safeParse(v).success,
    'Thời gian phải có timezone ISO-8601.',
  );
const text = z.string().max(20000);
export const ProposalContentSchema = z
  .object({
    schemaVersion: z.literal(1),
    objectives: text,
    scope: text,
    mainContents: text,
    tools: text,
    expectedResults: text,
    startsAt: date,
    endsAt: date,
    schedule: z
      .array(
        z
          .object({
            label: z.string().max(255),
            startsAt: date,
            endsAt: date,
            deliverables: text,
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export const SubmittedProposalContentSchema = ProposalContentSchema.superRefine(
  (v, c) => {
    for (const key of [
      'objectives',
      'scope',
      'mainContents',
      'tools',
      'expectedResults',
      'startsAt',
      'endsAt',
    ] as const)
      if (!v[key].trim())
        c.addIssue({
          code: 'custom',
          path: [key],
          message: 'Nội dung bắt buộc khi gửi duyệt.',
        });
    const start = Date.parse(v.startsAt),
      end = Date.parse(v.endsAt);
    if (!Number.isNaN(start) && !Number.isNaN(end) && start >= end)
      c.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'Ngày kết thúc phải sau ngày bắt đầu.',
      });
    if (!v.schedule.length)
      c.addIssue({
        code: 'custom',
        path: ['schedule'],
        message: 'Cần có kế hoạch thực hiện khi gửi duyệt.',
      });
    v.schedule.forEach((s, i) => {
      const a = Date.parse(s.startsAt),
        b = Date.parse(s.endsAt);
      if (
        !s.label.trim() ||
        !s.deliverables.trim() ||
        !s.startsAt ||
        !s.endsAt ||
        a >= b ||
        a < start ||
        b > end
      )
        c.addIssue({
          code: 'custom',
          path: ['schedule', i],
          message:
            'Mốc cần tên, sản phẩm và thời gian hợp lệ trong khoảng thực hiện.',
        });
    });
  },
);
export const RevisionResponseSchema = z
  .object({
    targetType: z.enum(['COMMENT', 'DECISION']),
    targetId: id,
    text: z.string().trim().min(1).max(10000),
  })
  .strict();
export const ProposalVersionSaveSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    basedOnVersionId: id.optional(),
    content: ProposalContentSchema,
    changeSummary: z.string().trim().max(2000).optional(),
    responses: z.array(RevisionResponseSchema).max(200).optional(),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      v.responses &&
      new Set(v.responses.map((r) => `${r.targetType}:${r.targetId}`)).size !==
        v.responses.length
    )
      c.addIssue({
        code: 'custom',
        path: ['responses'],
        message: 'Một góp ý chỉ có một phản hồi trong mỗi snapshot.',
      });
  });
export const ProposalVersionSubmitSchema = z
  .object({ expectedRevision: z.number().int().nonnegative(), versionId: id })
  .strict();
export const VersionPageQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export const VersionCompareSchema = z
  .object({ fromVersionId: id, toVersionId: id })
  .strict();
export type ProposalContent = z.infer<typeof ProposalContentSchema>;
export type RevisionResponse = z.infer<typeof RevisionResponseSchema>;
export type ProposalVersionSave = z.infer<typeof ProposalVersionSaveSchema>;
export type ProposalVersionSubmit = z.infer<typeof ProposalVersionSubmitSchema>;
export type VersionPageQuery = z.infer<typeof VersionPageQuerySchema>;
export type ProposalFeedback = {
  targetType: 'COMMENT' | 'DECISION';
  targetId: string;
  reviewId: string;
  sourceVersionId: string;
  versionNumber: number;
  roundNumber: number | null;
  authorUserId: string;
  authorName: string;
  text: string;
  createdAt: string;
};
export type ProposalVersionView = {
  id: string;
  proposalId: string;
  versionNumber: number;
  state: 'DRAFT' | 'SEALED' | null;
  content: unknown;
  contentHash: string | null;
  createdAt: string;
  createdByUserId: string | null;
  authorName: string | null;
  submittedAt: string | null;
  submittedByUserId: string | null;
  basedOnVersionId: string | null;
  changeSummary: string | null;
  responses: RevisionResponse[];
  provenance: unknown;
};
export type ProposalEditorContext = {
  proposalId: string;
  topicId: string;
  termId: string;
  termStudentId: string;
  title: string;
  studentName: string;
  status: string;
  revision: number;
  workingVersionId: string | null;
  submittedVersionId: string | null;
  workingVersion: ProposalVersionView | null;
  submittedVersion: ProposalVersionView | null;
  feedback: ProposalFeedback[];
  allowedActions: Array<'save' | 'submit'>;
  readiness: string[];
  phase: { startsAt: string; endsAt: string; isLocked: boolean } | null;
};
export type ProposalVersionPage = GroupPage<ProposalVersionView>;
export type ProposalVersionMutationView = ProposalVersionView & {
  proposalRevision: number;
};
export type DataChange = {
  path: string;
  before: unknown;
  after: unknown;
  beforeExists: boolean;
  afterExists: boolean;
};
export function compareProposalData(
  before: unknown,
  after: unknown,
): DataChange[] {
  const changes: DataChange[] = [];
  function visit(
    a: unknown,
    b: unknown,
    path: string,
    aExists = true,
    bExists = true,
  ) {
    if (aExists === bExists && JSON.stringify(a) === JSON.stringify(b)) return;
    if (
      aExists &&
      bExists &&
      a !== null &&
      b !== null &&
      typeof a === 'object' &&
      typeof b === 'object' &&
      Array.isArray(a) === Array.isArray(b)
    ) {
      for (const key of [
        ...new Set([...Object.keys(a), ...Object.keys(b)]),
      ].sort())
        visit(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
          `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`,
          Object.prototype.hasOwnProperty.call(a, key),
          Object.prototype.hasOwnProperty.call(b, key),
        );
    } else
      changes.push({
        path: path || '/',
        before: aExists ? a : null,
        after: bExists ? b : null,
        beforeExists: aExists,
        afterExists: bExists,
      });
  }
  visit(before, after, '');
  return changes;
}
export const emptyProposalContent: ProposalContent = {
  schemaVersion: 1,
  objectives: '',
  scope: '',
  mainContents: '',
  tools: '',
  expectedResults: '',
  startsAt: '',
  endsAt: '',
  schedule: [],
};
