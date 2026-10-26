import { Injectable, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { termInclude } from "../../term/repository/term.repository";
export type WorkflowTx = Prisma.TransactionClient;
const contact = { select: { email: true, phone: true, status: true } } as const;
export const assignmentRegistrationInclude =
  Prisma.validator<Prisma.RegistrationInclude>()({
    preferences: { orderBy: { preferenceOrder: "asc" } },
    direction: true,
    student: { include: { user: contact, trainingSystem: true } },
  });
export type AssignmentRegistration = Prisma.RegistrationGetPayload<{
  include: typeof assignmentRegistrationInclude;
}>;
export const planInclude = Prisma.validator<Prisma.AssignmentPlanInclude>()({
  advisorAssignments: {
    orderBy: { registrationId: "asc" },
    include: {
      registration: { include: assignmentRegistrationInclude },
      advisor: { include: { user: contact } },
    },
  },
});
export type LoadedPlan = Prisma.AssignmentPlanGetPayload<{
  include: typeof planInclude;
}>;
@Injectable()
export class AssignmentRepository {
  constructor(private readonly prisma: PrismaService) {}
  async transaction<T>(operation: (tx: WorkflowTx) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++)
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10000,
          timeout: 20000,
        });
      } catch (error) {
        const code = (error as { code?: string }).code;
        if ((code === "P2034" || code === "P2002") && attempt < 3) continue;
        if (code === "P2034" || code === "P2002")
          throw new ConflictException(
            "Dữ liệu vừa thay đổi. Hãy tải lại phương án.",
          );
        throw error;
      }
  }
  term(id: string, tx: WorkflowTx) {
    return tx.thesisTerm.findUnique({ where: { id }, include: termInclude });
  }
  registrations(termId: string, tx: WorkflowTx) {
    return tx.registration.findMany({
      where: { termId },
      include: assignmentRegistrationInclude,
      orderBy: [{ student: { studentCode: "asc" } }, { id: "asc" }],
    });
  }
  plans(termId: string, tx: WorkflowTx) {
    return tx.assignmentPlan.findMany({
      where: { termId },
      include: planInclude,
      orderBy: { createdAt: "desc" },
    });
  }
  actor(userId: string, tx: WorkflowTx) {
    return tx.userAccount.findUniqueOrThrow({
      where: { id: userId },
      select: {
        student: { select: { id: true } },
        lecturer: { select: { id: true } },
        userRoles: { select: { role: { select: { name: true } } } },
      },
    });
  }
  savePlan(
    id: string | undefined,
    data: Prisma.AssignmentPlanUncheckedCreateInput,
    tx: WorkflowTx,
  ) {
    return id
      ? tx.assignmentPlan.update({ where: { id }, data })
      : tx.assignmentPlan.create({ data });
  }
  async replaceAssignments(
    planId: string,
    rows: {
      registrationId: string;
      advisorId: string;
      isManual: boolean;
      note: string;
    }[],
    tx: WorkflowTx,
  ) {
    await tx.advisorAssignment.deleteMany({
      where: { assignmentPlanId: planId },
    });
    if (rows.length)
      await tx.advisorAssignment.createMany({
        data: rows.map((r) => ({ ...r, assignmentPlanId: planId })),
      });
  }
  async publish(plan: LoadedPlan, userId: string, tx: WorkflowTx) {
    await tx.assignmentPlan.update({
      where: { id: plan.id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        revision: { increment: 1 },
      },
    });
    await tx.thesisTerm.update({
      where: { id: plan.termId },
      data: { status: "IN_PROGRESS" },
    });
    const grouped = new Map<string, typeof plan.advisorAssignments>();
    for (const a of plan.advisorAssignments) {
      grouped.set(a.advisorId, [...(grouped.get(a.advisorId) ?? []), a]);
      await tx.notification.create({
        data: {
          termId: plan.termId,
          userId: a.registration.student.userId,
          title: "Kết quả phân công GVHD",
          body: `GVHD: ${a.advisor.fullName}. Hãy liên hệ để thống nhất đề tài.`,
          link: "/registration/result",
        },
      });
    }
    const term = await this.term(plan.termId, tx);
    for (const [advisorId, rows] of grouped) {
      const advisor = rows[0].advisor;
      await tx.emailOutbox.upsert({
        where: { eventKey: `assignment:${plan.id}:${advisorId}` },
        update: {},
        create: {
          eventKey: `assignment:${plan.id}:${advisorId}`,
          termId: plan.termId,
          userId: advisor.userId,
          recipient: advisor.user.email,
          subject: `Phân công GVHD — ${term!.name}`,
          payload: {
            lecturerName: advisor.fullName,
            termName: term!.name,
            students: rows.map((a) => ({
              studentCode: a.registration.student.studentCode,
              fullName: a.registration.student.fullName,
              className: a.registration.student.className,
              email: a.registration.student.user.email,
              phone:
                a.registration.student.user.phone ??
                a.registration.student.phone,
              direction: a.registration.direction?.name ?? "",
            })),
          },
        },
      });
      await tx.notification.create({
        data: {
          termId: plan.termId,
          userId: advisor.userId,
          title: "Sinh viên được giao hướng dẫn",
          body: `Được giao ${rows.length} sinh viên trong đợt ${term!.name}.`,
          link: "/registration/result",
        },
      });
    }
    await this.audit(
      userId,
      "ASSIGNMENT_PUBLISHED",
      plan.id,
      {
        termId: plan.termId,
        revision: plan.revision,
        quotas: term!.termLecturers.map((l) => ({
          lecturerId: l.lecturerId,
          quota: l.quota,
        })),
        assignments: plan.advisorAssignments.map((a) => ({
          studentId: a.registration.studentId,
          registrationId: a.registrationId,
          advisorId: a.advisorId,
          gpa: Number(a.registration.student.gpa),
          directionId: a.registration.directionId,
          submittedAt: a.registration.submittedAt,
          note: a.note,
        })),
      },
      tx,
    );
  }
  audit(
    userId: string,
    action: string,
    resourceId: string,
    data: unknown,
    tx: WorkflowTx,
    old?: unknown,
  ) {
    return tx.auditLog.create({
      data: {
        userId,
        action,
        resource: "assignment",
        resourceId,
        newValue: JSON.parse(JSON.stringify(data)),
        ...(old ? { oldValue: JSON.parse(JSON.stringify(old)) } : {}),
      },
    });
  }
}
