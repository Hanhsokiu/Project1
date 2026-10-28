import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import type {
  GroupCreate,
  GroupUpdate,
  GroupMutation,
  GroupQuery,
  ReviewGroupView,
} from '@doan/shared';
import {
  ReviewGroupRepository,
  ReviewGroupSession,
  GroupPrincipal,
  GroupRecord,
} from './review-group.repository';
import { ReviewGroupValidator } from './review-group.validator';
import { groupError } from './review-group.errors';

const page = <T>(data: T[], total: number, q: GroupQuery) => ({
  data,
  total,
  page: q.page,
  limit: q.limit,
  totalPages: Math.ceil(total / q.limit),
});
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.keys(v)
          .sort()
          .reduce<Record<string, unknown>>((o, k) => {
            o[k] = v[k];
            return o;
          }, {})
      : v,
  );
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

@Injectable()
export class ReviewGroupService {
  constructor(
    private readonly repo: ReviewGroupRepository,
    private readonly validator: ReviewGroupValidator,
  ) {}
  private role(user: GroupPrincipal, role: string, action: string) {
    return user.userRoles.some(
      (r) =>
        r.role.name === role &&
        r.role.rolePermissions.some(
          (p) =>
            p.permission.resource === 'review-group' &&
            p.permission.action === action,
        ),
    );
  }
  private async access(
    s: ReviewGroupSession,
    user: GroupPrincipal,
    termId: string,
    action: 'read' | 'manage',
  ) {
    const grants = this.role(user, 'FACULTY', action)
      ? await s.grants(user.id, termId)
      : [];
    const grant = grants[0];
    const departments =
      grant?.pr2bGrantDepartmentGrantId.map((d) => d.departmentId) ?? [];
    const lecturerId =
      action === 'read' &&
      this.role(user, 'LECTURER', 'read') &&
      user.lecturer?.isActive &&
      (await s.roster(termId, user.lecturer.id))
        ? user.lecturer.id
        : undefined;
    if (!grant?.allDepartments && !departments.length && !lecturerId)
      groupError(
        404,
        'COMMON_001',
        'Không tìm thấy đợt trong phạm vi truy cập.',
      );
    return {
      all: !!grant?.allDepartments,
      departments,
      lecturerId,
      faculty: !!grant && (!!grant.allDepartments || departments.length > 0),
    };
  }
  private async scope(
    s: ReviewGroupSession,
    user: GroupPrincipal,
    termId: string,
    action: 'read' | 'manage',
    departmentId?: string,
  ) {
    const a = await this.access(s, user, termId, action);
    const clauses: Prisma.ReviewGroupWhereInput[] = [];
    if (a.faculty)
      clauses.push({
        pr2bReviewGroupWorkflowGroupId: {
          is: { departmentId: a.all ? { not: null } : { in: a.departments } },
        },
      });
    if (a.lecturerId)
      clauses.push({ members: { some: { lecturerId: a.lecturerId } } });
    return {
      termId,
      OR: clauses,
      pr2bReviewGroupWorkflowGroupId: {
        is: { archivedAt: null, departmentId: departmentId ?? { not: null } },
      },
    } satisfies Prisma.ReviewGroupWhereInput;
  }
  private async visible(
    s: ReviewGroupSession,
    user: GroupPrincipal,
    group: GroupRecord | null,
    action: 'read' | 'manage',
    includeArchived = false,
  ) {
    if (
      !group?.pr2bReviewGroupWorkflowGroupId?.departmentId ||
      (!includeArchived && group.pr2bReviewGroupWorkflowGroupId.archivedAt)
    )
      groupError(404, 'COMMON_001', 'Không tìm thấy nhóm duyệt.');
    const a = await this.access(s, user, group.termId, action);
    if (
      !(
        a.faculty &&
        (a.all ||
          a.departments.includes(
            group.pr2bReviewGroupWorkflowGroupId.departmentId,
          ))
      ) &&
      !(
        action === 'read' &&
        a.lecturerId &&
        group.members.some((m) => m.lecturerId === a.lecturerId)
      )
    )
      groupError(404, 'COMMON_001', 'Không tìm thấy nhóm duyệt.');
    return group;
  }
  private async view(
    s: ReviewGroupSession,
    group: GroupRecord,
    user: GroupPrincipal,
  ): Promise<ReviewGroupView> {
    const workflow = group.pr2bReviewGroupWorkflowGroupId!;
    const lecturers = await s.lecturers({
      id: { in: group.members.map((m) => m.lecturerId) },
    });
    const grants = this.role(user, 'FACULTY', 'manage')
      ? await s.grants(user.id, group.termId)
      : [];
    const grant = grants[0];
    return {
      id: group.id,
      termId: group.termId,
      name: group.name,
      departmentId: workflow.departmentId!,
      departmentName: workflow.refDepartmentId?.name ?? '',
      revision: workflow.revision,
      createdAt: group.createdAt.toISOString(),
      updatedAt: workflow.updatedAt.toISOString(),
      activeReviewCount: group.reviews.filter(
        (r) =>
          !r.pr2bProposalReviewWorkflowReviewId?.state ||
          ['ASSIGNED', 'IN_REVIEW'].includes(
            r.pr2bProposalReviewWorkflowReviewId.state,
          ),
      ).length,
      canManage:
        !!grant &&
        (grant.allDepartments ||
          grant.pr2bGrantDepartmentGrantId.some(
            (d) => d.departmentId === workflow.departmentId,
          )),
      members: lecturers.map((l) => ({
        lecturerId: l.id,
        fullName: l.fullName,
        lecturerCode: l.lecturerCode,
        role: 'MEMBER',
      })),
    };
  }
  async terms(userId: string) {
    return this.repo.transaction(async (s) => {
      const user = this.validator.principal(await s.principal(userId), 'read');
      const grants = this.role(user, 'FACULTY', 'read')
        ? await s.grants(user.id)
        : [];
      const ids = grants
        .filter((g) => g.allDepartments || g.pr2bGrantDepartmentGrantId.length)
        .map((g) => g.termId);
      const where: Prisma.ThesisTermWhereInput = { OR: [{ id: { in: ids } }] };
      if (this.role(user, 'LECTURER', 'read') && user.lecturer?.isActive)
        where.OR!.push({
          termLecturers: { some: { lecturerId: user.lecturer.id } },
          id: {
            in: (await s.memberTerms(user.lecturer.id)).map((g) => g.termId),
          },
        });
      return s.terms(where);
    });
  }
  async options(userId: string, termId: string, q: GroupQuery) {
    return this.repo.transaction(async (s) => {
      const user = this.validator.principal(await s.principal(userId), 'read');
      const a = await this.access(s, user, termId, 'read');
      const term = await s.term(termId);
      if (!term) groupError(404, 'COMMON_001', 'Không tìm thấy đợt.');
      const canManage = a.faculty && this.role(user, 'FACULTY', 'manage');
      const departments = a.faculty
        ? await s.departments({ id: a.all ? undefined : { in: a.departments } })
        : [];
      const where: Prisma.LecturerWhereInput = {
        isActive: true,
        termLecturers: { some: { termId } },
        user: {
          status: 'ACTIVE',
          userRoles: { some: { role: { name: 'LECTURER' } } },
        },
        id: canManage ? undefined : (user.lecturer?.id ?? ''),
        fullName: q.search
          ? { contains: q.search, mode: 'insensitive' }
          : undefined,
      };
      const list = await s.lecturers(where, (q.page - 1) * q.limit, q.limit);
      return {
        term: { id: term.id, name: term.name, status: term.status },
        canManage,
        departments,
        lecturers: page(
          list.map((l) => ({
            id: l.id,
            fullName: l.fullName,
            lecturerCode: l.lecturerCode,
            departmentId: l.departmentId,
          })),
          await s.lecturerCount(where),
          q,
        ),
      };
    });
  }
  async list(userId: string, termId: string, q: GroupQuery) {
    return this.repo.transaction(async (s) => {
      const user = this.validator.principal(await s.principal(userId), 'read');
      const where = {
        ...(await this.scope(s, user, termId, 'read', q.departmentId)),
        name: q.search
          ? { contains: q.search, mode: 'insensitive' as const }
          : undefined,
      };
      const rows = await s.groups(where, (q.page - 1) * q.limit, q.limit);
      return page(
        await Promise.all(rows.map((g) => this.view(s, g, user))),
        await s.count(where),
        q,
      );
    });
  }
  async detail(userId: string, id: string) {
    return this.repo.transaction(async (s) => {
      const user = this.validator.principal(await s.principal(userId), 'read');
      return this.view(
        s,
        await this.visible(s, user, await s.group(id), 'read'),
        user,
      );
    });
  }
  private async eligible(s: ReviewGroupSession, termId: string, ids: string[]) {
    const lecturers = await s.lecturers({
      id: { in: ids },
      isActive: true,
      termLecturers: { some: { termId } },
      user: {
        status: 'ACTIVE',
        userRoles: { some: { role: { name: 'LECTURER' } } },
      },
    });
    this.validator.eligible(
      ids,
      lecturers.map((l) => l.id),
    );
  }
  async mutate(
    userId: string,
    target: { termId?: string; id?: string; lecturerId?: string },
    kind: 'create' | 'update' | 'add' | 'remove' | 'archive',
    body:
      | GroupCreate
      | GroupUpdate
      | GroupMutation
      | (GroupMutation & { lecturerId: string }),
    key: string,
    route: string,
    method: string,
  ) {
    if (!key || key.length > 200 || !/^[\w.-]+$/.test(key))
      groupError(400, 'COMMON_003', 'Thiếu hoặc sai Idempotency-Key.');
    const hash = createHash('sha256').update(canonical(body)).digest('hex');
    return this.repo.transaction(async (s) => {
      const user = this.validator.principal(
        await s.principal(userId),
        'manage',
      );
      const existing = target.id
        ? await this.visible(s, user, await s.group(target.id), 'manage', true)
        : null;
      const termId = existing?.termId ?? target.termId!;
      const access = await this.access(s, user, termId, 'manage');
      // Re-check the create target scope BEFORE returning any cached response.
      if (
        kind === 'create' &&
        !access.all &&
        !access.departments.includes((body as GroupCreate).departmentId)
      )
        groupError(404, 'COMMON_001', 'Không tìm thấy bộ môn trong phạm vi.');
      await s.lockTerm(termId);
      if (existing) await s.lockGroup(existing.id);
      const previous = await s.replay(user.id, method, route, key);
      if (previous) {
        if (previous.payloadHash !== hash)
          groupError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'Khóa gửi lại được dùng với nội dung khác.',
          );
        return previous.result as unknown as ReviewGroupView;
      }
      const term = await s.term(termId);
      if (!term) groupError(404, 'COMMON_001', 'Không tìm thấy đợt.');
      this.validator.mutable(term.status);
      let groupId: string;
      let oldValue: unknown = {};
      if (kind === 'create') {
        const input = body as GroupCreate;
        if (!access.all && !access.departments.includes(input.departmentId))
          groupError(404, 'COMMON_001', 'Không tìm thấy bộ môn trong phạm vi.');
        if (!(await s.departments({ id: input.departmentId })).length)
          groupError(400, 'MEMBER_INELIGIBLE', 'Bộ môn không tồn tại.');
        await this.eligible(s, termId, input.memberLecturerIds);
        groupId = (await s.create(termId, input.name, input.departmentId)).id;
        await s.add(groupId, input.memberLecturerIds);
        await s.history(groupId, user.id, input.memberLecturerIds, 'ADDED');
      } else {
        const group = await this.visible(
          s,
          user,
          await s.group(existing!.id),
          'manage',
        );
        groupId = group.id;
        oldValue = {
          name: group.name,
          revision: group.pr2bReviewGroupWorkflowGroupId!.revision,
          memberLecturerIds: group.members.map((m) => m.lecturerId),
        };
        const input = body as GroupUpdate & { lecturerId?: string };
        const oldIds = group.members.map((m) => m.lecturerId);
        let desired = input.memberLecturerIds;
        if (kind === 'add') {
          if (oldIds.includes(input.lecturerId!))
            groupError(409, 'COMMON_002', 'Giảng viên đã thuộc nhóm.');
          desired = [...oldIds, input.lecturerId!];
        }
        if (kind === 'remove') {
          if (!oldIds.includes(target.lecturerId!))
            groupError(404, 'COMMON_001', 'Không tìm thấy thành viên.');
          desired = oldIds.filter((id) => id !== target.lecturerId);
        }
        if (kind === 'archive' && group.reviews.length)
          groupError(
            409,
            'GROUP_IN_USE',
            'Nhóm đã liên kết đề cương; không thể xóa.',
          );
        if (desired) {
          this.validator.membershipEditable(group);
          await this.eligible(s, termId, desired);
        }
        const changed = await s.advance(
          groupId,
          input.expectedRevision,
          kind === 'archive' ? new Date() : undefined,
        );
        if (changed.count !== 1)
          groupError(
            409,
            'REVISION_CONFLICT',
            'Dữ liệu đã thay đổi. Hãy tải lại trước khi chỉnh sửa.',
          );
        if (input.name !== undefined) await s.rename(groupId, input.name);
        if (desired) {
          const added = desired.filter((id) => !oldIds.includes(id));
          const removed = oldIds.filter((id) => !desired!.includes(id));
          await s.add(groupId, added);
          await s.remove(groupId, removed);
          await s.history(groupId, user.id, added, 'ADDED', input.reason);
          await s.history(groupId, user.id, removed, 'REMOVED', input.reason);
        }
      }
      const result = await this.view(s, (await s.group(groupId))!, user);
      await s.audit(
        user.id,
        groupId,
        kind.toUpperCase(),
        json(oldValue),
        json({
          name: result.name,
          revision: result.revision,
          departmentId: result.departmentId,
          memberLecturerIds: result.members.map((m) => m.lecturerId),
          reason: 'reason' in body ? body.reason : null,
          archived: kind === 'archive',
        }),
      );
      await s.remember(user.id, method, route, key, hash, json(result));
      return result;
    }, true);
  }
}
