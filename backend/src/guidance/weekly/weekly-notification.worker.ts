import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { reviewHash } from "../../topic/proposal-reviews/proposal-review.validator";

@Injectable()
export class WeeklyNotificationWorker {
  private running = false;
  private readonly logger = new Logger(WeeklyNotificationWorker.name);
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {}
  @Interval(60000)
  async tick() {
    if (
      this.running ||
      this.config.get("GUIDANCE_REMINDERS_ENABLED", "true") === "false"
    )
      return;
    this.running = true;
    try {
      const now = new Date(),
        horizon = new Date(now.getTime() + 24 * 3600000);
      const phases = await this.db.termPhaseWorkflow.findMany({
        where: {
          key: "GUIDANCE",
          refPhaseId: {
            isLocked: false,
            startDate: { lte: now },
            endDate: { gt: now },
          },
        },
        include: { refPhaseId: true },
      });
      const activeTerms = new Set(
        phases
          .filter((p) => p.refPhaseId.termId === p.termId)
          .map((p) => p.termId),
      );
      const obligations = await this.db.weeklyReportObligation.findMany({
        where: {
          refPeriodId: {
            state: "OPEN",
            startsAt: { lte: now },
            reportDueAt: { lte: horizon },
            refTermId: {
              status: "IN_PROGRESS",
              isLocked: false,
              endDate: { gt: now },
            },
          },
        },
        include: {
          refPeriodId: true,
          refTermStudentId: { include: { student: true } },
          refCurrentTaskId: { include: { pr2bTaskWorkflowTaskId: true } },
        },
      });
      for (const o of obligations) {
        if (!activeTerms.has(o.refPeriodId.termId)) continue;
        if (o.refCurrentTaskId?.pr2bTaskWorkflowTaskId?.currentSubmissionId)
          continue;
        const p = o.refPeriodId,
          due = p.reportDueAt!;
        const eventId = `weekly-reminder:${o.id}:${p.revision}:${now > due ? "overdue" : "due"}`;
        await this.enqueue(eventId, p.id, {
          userId: o.refTermStudentId.student.userId,
          termId: p.termId,
          title:
            now > due ? "Quá hạn báo cáo tuần" : "Báo cáo tuần sắp đến hạn",
          body: "Bạn chưa nộp báo cáo chính thức. Mở kế hoạch tuần để kiểm tra hạn nộp.",
          link: `/guidance/weeks?termId=${p.termId}`,
        });
      }
      const revisions = await this.db.progressReview.findMany({
        where: {
          state: "RECORDED",
          decision: "REVISION_REQUIRED",
          revisionDueAt: { gt: now, lte: horizon },
          pr2bSubmissionWorkflowEffectiveReviewId: {
            is: {
              state: "REVIEWED",
              refTaskId: {
                pr2bTaskWorkflowTaskId: {
                  is: {
                    state: "REVISION_REQUESTED",
                    refPeriodId: { is: { state: "OPEN" } },
                  },
                },
              },
            },
          },
        },
        include: {
          pr2bSubmissionWorkflowEffectiveReviewId: {
            include: {
              refTaskId: {
                include: { guidancePlan: true, pr2bTaskWorkflowTaskId: true },
              },
            },
          },
        },
      });
      for (const r of revisions) {
        const sw = r.pr2bSubmissionWorkflowEffectiveReviewId!;
        if (
          sw.refTaskId.pr2bTaskWorkflowTaskId?.currentSubmissionId !==
          sw.submissionId
        )
          continue;
        const p = await this.db.proposal.findUnique({
          where: { id: sw.refTaskId.guidancePlan.proposalId },
          include: { student: true, topic: true },
        });
        if (!p || !activeTerms.has(p.topic.termId)) continue;
        const term = await this.db.thesisTerm.findUnique({
          where: { id: p.topic.termId },
        });
        if (!term || term.isLocked || term.status !== "IN_PROGRESS") continue;
        await this.enqueue(`revision-reminder:${r.id}`, sw.taskId, {
          userId: p.student.userId,
          termId: p.topic.termId,
          title: "Sắp hết hạn sửa báo cáo",
          body: "Kiểm tra nhận xét của GVHD và nộp phiên bản sửa trước hạn.",
          link: `/guidance/tasks/${sw.taskId}/submissions`,
        });
      }
      const reopened = await this.db.guidanceReopen.findMany({
        where: { revisionDueAt: { gt: now, lte: horizon } },
        include: {
          submission: {
            include: {
              task: {
                include: {
                  pr2bTaskWorkflowTaskId: { include: { refPeriodId: true } },
                  guidancePlan: true,
                },
              },
            },
          },
        },
      });
      for (const r of reopened) {
        const task = r.submission.task,
          tw = task.pr2bTaskWorkflowTaskId;
        if (
          tw?.currentSubmissionId !== r.submissionId ||
          tw.state !== "REVISION_REQUESTED" ||
          tw.refPeriodId?.state !== "OPEN"
        )
          continue;
        const p = await this.db.proposal.findUnique({
          where: { id: task.guidancePlan.proposalId },
          include: { student: true, topic: { include: { term: true } } },
        });
        if (
          !p ||
          !activeTerms.has(p.topic.termId) ||
          p.topic.term.isLocked ||
          p.topic.term.status !== "IN_PROGRESS"
        )
          continue;
        await this.enqueue(`reopen-reminder:${r.id}`, task.id, {
          userId: p.student.userId,
          termId: p.topic.termId,
          title: "Sắp hết hạn nộp lại báo cáo",
          body: "Báo cáo đã được mở lại. Nộp phiên bản sửa trước hạn mới.",
          link: `/guidance/tasks/${task.id}/submissions`,
        });
      }
      await this.deliver();
    } catch {
      this.logger.warn("Weekly notifications deferred; scheduler will retry.");
    } finally {
      this.running = false;
    }
  }
  private enqueue(
    eventId: string,
    aggregateId: string,
    payload: Prisma.InputJsonValue,
  ) {
    return this.db.outboxEvent.upsert({
      where: { eventId },
      create: { eventId, aggregateId, type: "GUIDANCE_NOTIFICATION", payload },
      update: {},
    });
  }
  async deliver() {
    for (let i = 0; i < 100; i++) {
      const delivered = await this.db.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{ id: string; eventId: string; payload: Prisma.JsonValue }>
        >`
          SELECT id, "eventId", payload FROM "OUTBOX_EVENT" WHERE type='GUIDANCE_NOTIFICATION' AND state='PENDING'
          ORDER BY "createdAt", id FOR UPDATE SKIP LOCKED LIMIT 1`;
        const row = rows[0];
        if (!row) return false;
        const p = row.payload as {
          id?: string;
          userId: string;
          termId: string;
          title: string;
          body: string;
          link: string;
        };
        // Deterministic key + atomic delivery prevents duplicates after process/network failures.
        const id = p.id ?? reviewHash(row.eventId).slice(0, 32);
        await tx.notification.upsert({
          where: { id },
          create: {
            id,
            userId: p.userId,
            termId: p.termId,
            title: p.title,
            body: p.body,
            link: p.link,
          },
          update: {},
        });
        await tx.outboxEvent.update({
          where: { id: row.id },
          data: { state: "DELIVERED", attempts: { increment: 1 } },
        });
        return true;
      });
      if (!delivered) break;
    }
  }
}
