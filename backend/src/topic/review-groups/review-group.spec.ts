import { describe, expect, it, vi } from 'vitest';
import { ReviewGroupValidator } from './review-group.validator';
import { ReviewGroupService } from './review-group.service';
import type {
  GroupPrincipal,
  GroupRecord,
  ReviewGroupRepository,
  ReviewGroupSession,
} from './review-group.repository';
import {
  GroupCreateSchema,
  GroupUpdateSchema,
  GroupQuerySchema,
} from '@doan/shared';

const roles = (name = 'FACULTY', actions = ['read', 'manage']) => [
  {
    role: {
      name,
      rolePermissions: actions.map((action) => ({
        permission: { resource: 'review-group', action },
      })),
    },
  },
];
const user = (extra = {}) =>
  ({
    id: 'faculty',
    status: 'ACTIVE',
    lecturer: null,
    userRoles: roles(),
    ...extra,
  }) as unknown as GroupPrincipal;
const group = (state?: string) =>
  ({
    id: 'group',
    name: 'Nhóm 1',
    termId: 'term',
    createdAt: new Date(),
    members: [],
    reviews: state ? [{ pr2bProposalReviewWorkflowReviewId: { state } }] : [],
    pr2bReviewGroupWorkflowGroupId: {
      departmentId: 'dept',
      revision: 0,
      archivedAt: null,
      updatedAt: new Date(),
      refDepartmentId: { name: 'Bộ môn' },
    },
  }) as unknown as GroupRecord;
const validator = new ReviewGroupValidator();
describe('ReviewGroupValidator', () => {
  it('accepts faculty permission and lecturer read membership role', () => {
    expect(validator.principal(user(), 'manage').id).toBe('faculty');
    expect(
      validator.principal(
        user({ userRoles: roles('LECTURER', ['read']) }),
        'read',
      ),
    ).toBeTruthy();
  });
  it.each(['ADMIN', 'STUDENT', 'COMMITTEE'])(
    'denies %s even with academic permission',
    (name) => {
      expect(() =>
        validator.principal(user({ userRoles: roles(name) }), 'manage'),
      ).toThrow();
    },
  );
  it('does not combine ADMIN action with unrelated FACULTY role', () => {
    expect(() =>
      validator.principal(
        user({ userRoles: [...roles('ADMIN'), ...roles('FACULTY', [])] }),
        'manage',
      ),
    ).toThrow();
  });
  it('denies missing/inactive user or missing action', () => {
    expect(() => validator.principal(null, 'read')).toThrow();
    expect(() =>
      validator.principal(user({ status: 'LOCKED' }), 'read'),
    ).toThrow();
    expect(() =>
      validator.principal(
        user({ userRoles: roles('FACULTY', ['read']) }),
        'manage',
      ),
    ).toThrow();
  });
  it.each(['DRAFT', 'CLOSED_REGISTRATION', 'IN_PROGRESS'])(
    'allows group preparation at %s',
    (status) => expect(() => validator.mutable(status)).not.toThrow(),
  );
  it.each(['OPEN_REGISTRATION', 'CANCELLED', 'COMPLETED', 'DEFENDING'])(
    'blocks mutation at %s',
    (status) => expect(() => validator.mutable(status)).toThrow(),
  );
  it('allows resolved rounds and denies active or unknown legacy rounds', () => {
    expect(() => validator.membershipEditable(group('DECIDED'))).not.toThrow();
    expect(() =>
      validator.membershipEditable(group('SUPERSEDED')),
    ).not.toThrow();
    expect(() => validator.membershipEditable(group('ASSIGNED'))).toThrow();
    expect(() => validator.membershipEditable(group('IN_REVIEW'))).toThrow();
    expect(() =>
      validator.membershipEditable({
        ...group(),
        reviews: [{ pr2bProposalReviewWorkflowReviewId: null }],
      } as unknown as GroupRecord),
    ).toThrow();
  });
  it('accepts eligible unique members; denies missing and duplicate members', () => {
    expect(() => validator.eligible(['a'], ['a'])).not.toThrow();
    expect(() => validator.eligible([], [])).not.toThrow();
    expect(() => validator.eligible(['a'], [])).toThrow();
    expect(() => validator.eligible(['a', 'a'], ['a'])).toThrow();
  });
});
describe('ReviewGroupService', () => {
  function setup(overrides = {}) {
    const record = group();
    const s = {
      principal: vi.fn().mockResolvedValue(user()),
      grants: vi
        .fn()
        .mockResolvedValue([
          {
            allDepartments: false,
            pr2bGrantDepartmentGrantId: [{ departmentId: 'dept' }],
          },
        ]),
      lockTerm: vi.fn(),
      lockGroup: vi.fn(),
      replay: vi.fn(),
      term: vi.fn().mockResolvedValue({ status: 'DRAFT' }),
      departments: vi.fn().mockResolvedValue([{ id: 'dept' }]),
      lecturers: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'group' }),
      group: vi.fn().mockResolvedValue(record),
      add: vi.fn(),
      remove: vi.fn(),
      history: vi.fn(),
      audit: vi.fn(),
      remember: vi.fn(),
      advance: vi.fn().mockResolvedValue({ count: 1 }),
      ...overrides,
    };
    const repo = {
      transaction: (fn: (session: ReviewGroupSession) => unknown) =>
        fn(s as unknown as ReviewGroupSession),
    } as unknown as ReviewGroupRepository;
    return { service: new ReviewGroupService(repo, validator), s };
  }
  it('creates within scope and records history/audit/idempotency in transaction session', async () => {
    const { service, s } = setup();
    const result = await service.mutate(
      'faculty',
      { termId: 'term' },
      'create',
      { name: 'Nhóm', departmentId: 'dept', memberLecturerIds: [] },
      'key',
      '/groups',
      'POST',
    );
    expect(result.id).toBe('group');
    expect(s.audit).toHaveBeenCalledOnce();
    expect(s.remember).toHaveBeenCalledOnce();
  });
  it('denies cross-department create before writing', async () => {
    const { service, s } = setup();
    await expect(
      service.mutate(
        'faculty',
        { termId: 'term' },
        'create',
        { name: 'Nhóm', departmentId: 'other', memberLecturerIds: [] },
        'key',
        '/groups',
        'POST',
      ),
    ).rejects.toThrow();
    expect(s.create).not.toHaveBeenCalled();
  });
  it('rejects stale revision and does not write audit', async () => {
    const { service, s } = setup({
      advance: vi.fn().mockResolvedValue({ count: 0 }),
    });
    await expect(
      service.mutate(
        'faculty',
        { id: 'group' },
        'update',
        { name: 'Mới', expectedRevision: 8, reason: 'Đổi tên' },
        'key',
        '/groups/group',
        'PATCH',
      ),
    ).rejects.toThrow();
    expect(s.audit).not.toHaveBeenCalled();
  });
  it('replays identical request without creating/auditing again', async () => {
    const { createHash } = await import('crypto');
    const input = { name: 'Nhóm', departmentId: 'dept', memberLecturerIds: [] };
    const payloadHash = createHash('sha256')
      .update(
        JSON.stringify({
          departmentId: 'dept',
          memberLecturerIds: [],
          name: 'Nhóm',
        }),
      )
      .digest('hex');
    const { service, s } = setup({
      replay: vi.fn().mockResolvedValue({ payloadHash, result: { id: 'old' } }),
    });
    expect(
      (
        await service.mutate(
          'faculty',
          { termId: 'term' },
          'create',
          input,
          'key',
          '/groups',
          'POST',
        )
      ).id,
    ).toBe('old');
    expect(s.create).not.toHaveBeenCalled();
    expect(s.audit).not.toHaveBeenCalled();
  });
});
describe('Review group DTO validation', () => {
  it('supports opaque IDs and trims names', () =>
    expect(
      GroupCreateSchema.parse({
        name: ' Nhóm ',
        departmentId: 'dept-cnpm',
        memberLecturerIds: ['gv-a'],
      }).name,
    ).toBe('Nhóm'));
  it('rejects duplicate members, unknown fields and empty names', () => {
    for (const input of [
      { name: '', departmentId: 'd', memberLecturerIds: [] },
      { name: 'N', departmentId: 'd', memberLecturerIds: ['a', 'a'] },
      {
        name: 'N',
        departmentId: 'd',
        memberLecturerIds: [],
        decisionMaker: 'a',
      },
    ])
      expect(GroupCreateSchema.safeParse(input).success).toBe(false);
  });
  it('requires reason/revision for updates and bounds pagination', () => {
    expect(
      GroupUpdateSchema.safeParse({
        name: 'N',
        expectedRevision: 0,
        reason: '',
      }).success,
    ).toBe(false);
    expect(
      GroupUpdateSchema.safeParse({
        departmentId: 'd',
        expectedRevision: 0,
        reason: 'R',
      }).success,
    ).toBe(false);
    expect(GroupQuerySchema.parse({})).toMatchObject({ page: 1, limit: 20 });
    expect(GroupQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});
