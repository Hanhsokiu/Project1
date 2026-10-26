import { describe, it, expect, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import {
  ProposalContentSchema,
  SubmittedProposalContentSchema,
  ProposalVersionSaveSchema,
  compareProposalData,
  emptyProposalContent,
} from '@doan/shared';
import {
  ProposalReviewValidator,
  reviewHash,
} from '../proposal-reviews/proposal-review.validator';
import type { ReviewProposal } from '../proposal-reviews/proposal-review.repository';
import { ProposalVersionValidator } from './proposal-version.validator';
import { ProposalVersionService } from './proposal-version.service';
import type {
  ProposalVersionRepository,
  ProposalVersionSession,
  VersionRecord,
} from './proposal-version.repository';
const review = new ProposalReviewValidator(),
  validator = new ProposalVersionValidator(review);
const content = {
  ...emptyProposalContent,
  objectives: 'Mục tiêu',
  scope: 'Phạm vi',
  mainContents: 'Nội dung',
  tools: 'Công cụ',
  expectedResults: 'Kết quả',
  startsAt: '2026-10-01T00:00:00+07:00',
  endsAt: '2026-12-01T00:00:00+07:00',
  schedule: [
    {
      label: 'Mốc 1',
      startsAt: '2026-10-01T00:00:00+07:00',
      endsAt: '2026-11-01T00:00:00+07:00',
      deliverables: 'Sản phẩm',
    },
  ],
};
const fail = (fn: () => unknown, code: string) => {
  try {
    fn();
    throw Error('Expected failure');
  } catch (e) {
    expect(e).toBeInstanceOf(HttpException);
    expect((e as HttpException).getResponse()).toMatchObject({
      error: { code },
    });
  }
};
const p = (status = 'DRAFT') =>
  ({
    id: 'p',
    topic: { termId: 't' },
    status,
    reviews: [],
    pr2bProposalWorkflowProposalId: { submittedVersionId: 'v1' },
  }) as unknown as ReviewProposal;
describe('Step 6 shared content and snapshot contract', () => {
  it('accepts incomplete draft and complete submission', () => {
    expect(ProposalContentSchema.safeParse(emptyProposalContent).success).toBe(
      true,
    );
    expect(SubmittedProposalContentSchema.safeParse(content).success).toBe(
      true,
    );
  });
  it('rejects incomplete submission and invalid dates', () => {
    expect(
      SubmittedProposalContentSchema.safeParse(emptyProposalContent).success,
    ).toBe(false);
    expect(
      SubmittedProposalContentSchema.safeParse({
        ...content,
        endsAt: content.startsAt,
      }).success,
    ).toBe(false);
    expect(
      ProposalContentSchema.safeParse({ ...content, startsAt: '2026-10-01' })
        .success,
    ).toBe(false);
  });
  it('validates schedule bounds without inventing weekly/overlap policy', () => {
    expect(
      SubmittedProposalContentSchema.safeParse({
        ...content,
        schedule: [content.schedule[0], content.schedule[0]],
      }).success,
    ).toBe(true);
    expect(
      SubmittedProposalContentSchema.safeParse({
        ...content,
        schedule: [{ ...content.schedule[0], endsAt: '2027-01-01T00:00:00Z' }],
      }).success,
    ).toBe(false);
  });
  it('rejects duplicate feedback and injected actors', () => {
    const r = { targetType: 'DECISION', targetId: 'd', text: 'Đã sửa' };
    expect(
      ProposalVersionSaveSchema.safeParse({
        expectedRevision: 0,
        content,
        responses: [r],
      }).success,
    ).toBe(true);
    expect(
      ProposalVersionSaveSchema.safeParse({
        expectedRevision: 0,
        content,
        responses: [r, r],
      }).success,
    ).toBe(false);
    expect(
      ProposalVersionSaveSchema.safeParse({
        expectedRevision: 0,
        content,
        createdByUserId: 'forged',
      }).success,
    ).toBe(false);
  });
  it('compares actual nested values, array inserts and escapes path keys', () => {
    const changes = compareProposalData(
      { objectives: 'A', schedule: [], 'a/b': 1 },
      { objectives: 'B', schedule: [{ label: 'M1' }], 'a/b': 2 },
    );
    expect(changes.map((c) => c.path)).toEqual([
      '/a~1b',
      '/objectives',
      '/schedule/0',
    ]);
    expect(changes.find((c) => c.path === '/schedule/0')?.beforeExists).toBe(
      false,
    );
  });
  it('does not report object-key order as a content change and keeps null distinct from removal', () => {
    expect(compareProposalData({ b: 2, a: 1 }, { a: 1, b: 2 })).toEqual([]);
    expect(compareProposalData({ a: null }, {})).toEqual([
      {
        path: '/a',
        before: null,
        after: null,
        beforeExists: true,
        afterExists: false,
      },
    ]);
  });
});
describe('Step 6 business validators', () => {
  it('accepts owner snapshot base and rejects stale or cross-version base', () => {
    const working = { id: 'v2' } as VersionRecord,
      submitted = {
        id: 'v1',
        pr2bProposalVersionWorkflowVersionId: { state: 'SEALED' },
      } as VersionRecord;
    expect(validator.base(p(), working, submitted, 'v2')).toBe(working);
    expect(
      validator.base(p('REVISION_REQUESTED'), working, submitted, 'v1'),
    ).toBe(submitted);
    fail(() => validator.base(p(), working, submitted, 'v1'), 'STALE_VERSION');
  });
  it('supports first draft and a server-derived current base without guessing ownership', () => {
    expect(validator.base(p(), null, null)).toBe(null);
    expect(validator.base(p(), { id: 'v2' } as VersionRecord, null)?.id).toBe(
      'v2',
    );
    fail(() => validator.base(p(), null, null, 'other'), 'STALE_VERSION');
  });
  it('requires the actual revision decision for the submitted version', () => {
    validator.returned(p('REVISION_REQUESTED'), [
      { versionId: 'v1', decision: 'REVISION_REQUIRED' },
    ]);
    fail(
      () =>
        validator.returned(p('REVISION_REQUESTED'), [
          { versionId: 'other', decision: 'REVISION_REQUIRED' },
        ]),
      'INPUT_NOT_READY',
    );
  });
  it('does not infer a revision request from legacy text or APPROVED decision', () => {
    validator.returned(p(), []);
    fail(
      () =>
        validator.base(
          p('REVISION_REQUESTED'),
          null,
          {
            id: 'v1',
            pr2bProposalVersionWorkflowVersionId: { state: 'DRAFT' },
          } as VersionRecord,
          'v1',
        ),
      'INPUT_NOT_READY',
    );
    fail(
      () =>
        validator.returned(p('REVISION_REQUESTED'), [
          { versionId: 'v1', decision: 'APPROVED' },
        ]),
      'INPUT_NOT_READY',
    );
  });
  it('accepts feedback in the proposal and rejects unknown/cross-proposal targets', () => {
    const feedback = [{ targetType: 'DECISION', targetId: 'd' }] as never;
    validator.responses(
      [{ targetType: 'DECISION', targetId: 'd', text: 'OK' }],
      feedback,
    );
    fail(
      () =>
        validator.responses(
          [{ targetType: 'COMMENT', targetId: 'd', text: 'OK' }],
          feedback,
        ),
      'FEEDBACK_SCOPE_INVALID',
    );
  });
  it('allows no response without inventing a mandatory-response policy; rejects duplicates', () => {
    validator.responses([], []);
    const item = { targetType: 'COMMENT' as const, targetId: 'c', text: 'OK' };
    fail(
      () =>
        validator.responses([item, item], [
          { targetType: 'COMMENT', targetId: 'c' },
        ] as never),
      'FEEDBACK_SCOPE_INVALID',
    );
  });
  it('allows DRAFT and revision save, denies APPROVED and active review', async () => {
    const s = {
      dossier: vi.fn().mockResolvedValue(null),
    } as unknown as ProposalVersionSession;
    await expect(validator.editable(s, p())).resolves.toBeUndefined();
    await expect(
      validator.editable(s, p('REVISION_REQUESTED')),
    ).resolves.toBeUndefined();
    await expect(validator.editable(s, p('APPROVED'))).rejects.toMatchObject({
      response: { error: { code: 'STATE_TRANSITION_INVALID' } },
    });
    const pending = p();
    pending.reviews = [
      { pr2bProposalReviewWorkflowReviewId: { state: 'ASSIGNED' } },
    ] as never;
    await expect(validator.editable(s, pending)).rejects.toMatchObject({
      response: { error: { code: 'ACTIVE_REVIEW_EXISTS' } },
    });
  });
  it('does not let a DRAFT flag bypass finalized or unknown legacy dossier', async () => {
    for (const dossier of [
      {
        pr2bDossierWorkflowDossierId: { state: 'FINALIZED' },
        pr2bDossierFinalizationDossierId: [],
      },
      { pr2bDossierWorkflowDossierId: null },
    ]) {
      const s = {
        dossier: vi.fn().mockResolvedValue(dossier),
      } as unknown as ProposalVersionSession;
      await expect(validator.editable(s, p())).rejects.toMatchObject({
        response: { error: { code: 'DOSSIER_LOCKED' } },
      });
    }
  });
  it('allows reopened dossier only without an effective finalization', async () => {
    const dossier = {
      pr2bDossierWorkflowDossierId: {
        state: 'REOPENED',
        currentFinalizationId: null,
      },
      pr2bDossierFinalizationDossierId: [] as Array<{
        supersededAt: Date | null;
      }>,
    };
    const s = {
      dossier: vi.fn().mockResolvedValue(dossier),
    } as unknown as ProposalVersionSession;
    await expect(validator.editable(s, p())).resolves.toBeUndefined();
    dossier.pr2bDossierFinalizationDossierId.push({ supersededAt: null });
    await expect(validator.editable(s, p())).rejects.toMatchObject({
      response: { error: { code: 'DOSSIER_LOCKED' } },
    });
  });
  it('validates draft hash before sealing and rejects already sealed content', () => {
    const version = {
      content,
      pr2bProposalVersionWorkflowVersionId: {
        state: 'DRAFT',
        createdByUserId: 'u',
        contentSchemaVersion: 1,
        contentHash: reviewHash(content),
      },
    } as unknown as VersionRecord;
    expect(validator.content(version)).toEqual(content);
    version.pr2bProposalVersionWorkflowVersionId!.contentHash = 'tampered';
    fail(() => validator.content(version), 'STALE_VERSION');
    version.pr2bProposalVersionWorkflowVersionId!.state = 'SEALED';
    fail(() => validator.content(version), 'STALE_VERSION');
  });
  it('accepts edit phase only in the explicit open term interval', async () => {
    const phase = {
      refPhaseId: {
        termId: 't',
        startDate: new Date(0),
        endDate: new Date('2099-01-01Z'),
        isLocked: false,
      },
    };
    const s = {
      term: vi.fn().mockResolvedValue({ status: 'IN_PROGRESS' }),
      editPhase: vi.fn().mockResolvedValue(phase),
    } as unknown as ProposalVersionSession;
    await expect(validator.phase(s, 't')).resolves.toBeDefined();
    phase.refPhaseId.isLocked = true;
    await expect(validator.phase(s, 't')).rejects.toMatchObject({
      response: { error: { code: 'TERM_003' } },
    });
  });
  it('rejects missing edit mapping and a closed term', async () => {
    const s = {
      term: vi.fn().mockResolvedValue({ status: 'IN_PROGRESS' }),
      editPhase: vi.fn().mockResolvedValue(null),
    };
    await expect(
      validator.phase(s as unknown as ProposalVersionSession, 't'),
    ).rejects.toMatchObject({
      response: { error: { code: 'INPUT_NOT_READY' } },
    });
    s.term.mockResolvedValue({ status: 'COMPLETED' });
    await expect(
      validator.phase(s as unknown as ProposalVersionSession, 't'),
    ).rejects.toMatchObject({ response: { error: { code: 'TERM_003' } } });
  });
});
describe('Step 6 service action/role separation', () => {
  it.each(['FACULTY', 'ADMIN'])(
    'does not grant %s edit merely because permission exists',
    async (role) => {
      const user = {
        id: 'u',
        status: 'ACTIVE',
        userRoles: [
          {
            role: {
              name: role,
              rolePermissions: [
                { permission: { resource: 'proposal', action: 'edit' } },
              ],
            },
          },
        ],
      };
      const s = {
        principal: vi.fn().mockResolvedValue(user),
        proposal: vi.fn().mockResolvedValue(p()),
      };
      const repo = {
        transaction: async (fn: (s: unknown) => unknown) => fn(s),
      } as unknown as ProposalVersionRepository;
      await expect(
        new ProposalVersionService(repo, validator, review).save(
          'u',
          'p',
          { expectedRevision: 0, content },
          'test',
        ),
      ).rejects.toMatchObject({ response: { error: { code: 'COMMON_001' } } });
    },
  );
});
