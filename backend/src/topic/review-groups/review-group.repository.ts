import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { groupError } from './review-group.errors';

const groupInclude = {
  members: true,
  pr2bReviewGroupWorkflowGroupId: { include: { refDepartmentId: true } },
  reviews: {
    select: {
      id: true,
      pr2bProposalReviewWorkflowReviewId: { select: { state: true } },
    },
  },
} satisfies Prisma.ReviewGroupInclude;
export type GroupRecord = Prisma.ReviewGroupGetPayload<{
  include: typeof groupInclude;
}>;
const principalInclude = {
  userRoles: {
    include: {
      role: { include: { rolePermissions: { include: { permission: true } } } },
    },
  },
  lecturer: true,
} satisfies Prisma.UserAccountInclude;
export type GroupPrincipal = Prisma.UserAccountGetPayload<{
  include: typeof principalInclude;
}>;

export class ReviewGroupSession {
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
  async lockTerm(termId: string) {
    await this.tx
      .$queryRaw`SELECT id FROM public."THESIS_TERM" WHERE id=${termId} FOR UPDATE`;
  }
  async lockGroup(id: string) {
    await this.tx
      .$queryRaw`SELECT id FROM public."REVIEW_GROUP" WHERE id=${id} FOR UPDATE`;
  }
  term(id: string) {
    return this.tx.thesisTerm.findUnique({ where: { id } });
  }
  terms(where: Prisma.ThesisTermWhereInput) {
    return this.tx.thesisTerm.findMany({
      where,
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
      select: { id: true, name: true, status: true },
    });
  }
  roster(termId: string, lecturerId: string) {
    return this.tx.termLecturer.findUnique({
      where: { termId_lecturerId: { termId, lecturerId } },
    });
  }
  group(id: string) {
    return this.tx.reviewGroup.findUnique({
      where: { id },
      include: groupInclude,
    });
  }
  groups(where: Prisma.ReviewGroupWhereInput, skip: number, take: number) {
    return this.tx.reviewGroup.findMany({
      where,
      include: groupInclude,
      skip,
      take,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  }
  count(where: Prisma.ReviewGroupWhereInput) {
    return this.tx.reviewGroup.count({ where });
  }
  memberTerms(lecturerId: string) {
    return this.tx.reviewGroup.findMany({
      where: {
        members: { some: { lecturerId } },
        pr2bReviewGroupWorkflowGroupId: {
          is: { archivedAt: null, departmentId: { not: null } },
        },
      },
      distinct: ['termId'],
      select: { termId: true },
    });
  }
  departments(where: Prisma.DepartmentWhereInput) {
    return this.tx.department.findMany({
      where,
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }
  lecturers(where: Prisma.LecturerWhereInput, skip?: number, take?: number) {
    return this.tx.lecturer.findMany({
      where,
      skip,
      take,
      include: {
        user: { include: { userRoles: { include: { role: true } } } },
      },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    });
  }
  lecturerCount(where: Prisma.LecturerWhereInput) {
    return this.tx.lecturer.count({ where });
  }
  create(termId: string, name: string, departmentId: string) {
    return this.tx.reviewGroup.create({
      data: {
        termId,
        name,
        pr2bReviewGroupWorkflowGroupId: { create: { departmentId } },
      },
    });
  }
  rename(id: string, name: string) {
    return this.tx.reviewGroup.update({ where: { id }, data: { name } });
  }
  advance(groupId: string, revision: number, archivedAt?: Date) {
    return this.tx.reviewGroupWorkflow.updateMany({
      where: { groupId, revision },
      data: { revision: { increment: 1 }, archivedAt },
    });
  }
  add(groupId: string, lecturerIds: string[]) {
    return this.tx.reviewGroupMember.createMany({
      data: lecturerIds.map((lecturerId) => ({
        reviewGroupId: groupId,
        lecturerId,
      })),
    });
  }
  remove(groupId: string, lecturerIds: string[]) {
    return this.tx.reviewGroupMember.deleteMany({
      where: { reviewGroupId: groupId, lecturerId: { in: lecturerIds } },
    });
  }
  history(
    groupId: string,
    actorId: string,
    lecturerIds: string[],
    action: string,
    reason?: string,
  ) {
    return this.tx.reviewMembershipHistory.createMany({
      data: lecturerIds.map((lecturerId) => ({
        groupId,
        actorId,
        lecturerId,
        action,
        reason,
      })),
    });
  }
  audit(
    userId: string,
    resourceId: string,
    action: string,
    oldValue: Prisma.InputJsonValue,
    newValue: Prisma.InputJsonValue,
  ) {
    return this.tx.auditLog.create({
      data: {
        userId,
        resourceId,
        resource: 'review-group',
        action,
        oldValue,
        newValue,
      },
    });
  }
  replay(actorId: string, method: string, route: string, key: string) {
    return this.tx.idempotencyRecord.findUnique({
      where: { actorId_method_route_key: { actorId, method, route, key } },
    });
  }
  remember(
    actorId: string,
    method: string,
    route: string,
    key: string,
    payloadHash: string,
    result: Prisma.InputJsonValue,
  ) {
    return this.tx.idempotencyRecord.create({
      data: {
        actorId,
        method,
        route,
        key,
        payloadHash,
        result,
        expiresAt: new Date('9999-12-31T00:00:00Z'),
      },
    });
  }
}
@Injectable()
export class ReviewGroupRepository {
  constructor(private readonly prisma: PrismaService) {}
  async transaction<T>(
    work: (session: ReviewGroupSession) => Promise<T>,
    mutation = false,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(
          (tx) => work(new ReviewGroupSession(tx)),
          {
            isolationLevel: mutation ? 'Serializable' : 'RepeatableRead',
            timeout: 15000,
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
            'Dữ liệu đã thay đổi. Hãy tải lại trước khi chỉnh sửa.',
          );
        }
        throw e;
      }
    }
  }
}
