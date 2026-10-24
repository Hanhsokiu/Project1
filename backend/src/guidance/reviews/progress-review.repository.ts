import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SubmissionSession } from "../submissions/submission.repository";
import { groupError } from "../../topic/review-groups/review-group.errors";
const reviewInclude = {
  refReviewerUserId: {
    select: { username: true, lecturer: { select: { fullName: true } } },
  },
} satisfies Prisma.ProgressReviewInclude;
export type ProgressReviewRecord = Prisma.ProgressReviewGetPayload<{
  include: typeof reviewInclude;
}>;
const meetingInclude = {
  pr2bMeetingWorkflowMeetingId: true,
  pr2bMeetingHistoryMeetingId: {
    orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
  },
} satisfies Prisma.GuidanceMeetingInclude;
export type MeetingRecord = Prisma.GuidanceMeetingGetPayload<{
  include: typeof meetingInclude;
}>;
export class ProgressSession extends SubmissionSession {
  constructor(private readonly progressDb: Prisma.TransactionClient) {
    super(progressDb);
  }
  reviews(submissionId: string) {
    return this.progressDb.progressReview.findMany({
      where: { submissionId },
      include: reviewInclude,
      orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
    });
  }
  progressReview(id: string) {
    return this.progressDb.progressReview.findUnique({
      where: { id },
      include: reviewInclude,
    });
  }
  addReview(data: Prisma.ProgressReviewUncheckedCreateInput) {
    return this.progressDb.progressReview.create({
      data,
      include: reviewInclude,
    });
  }
  async supersedeReview(id: string, revision: number) {
    const result = await this.progressDb.progressReview.updateMany({
      where: { id, revision, state: "RECORDED" },
      data: { state: "SUPERSEDED", revision: { increment: 1 } },
    });
    if (result.count !== 1)
      groupError(409, "REVISION_CONFLICT", "Đánh giá đã thay đổi.");
  }
  async reviewSubmission(
    submissionId: string,
    revision: number,
    effectiveReviewId: string,
  ) {
    const r = await this.progressDb.submissionWorkflow.updateMany({
      where: { submissionId, revision },
      data: {
        state: "REVIEWED",
        effectiveReviewId,
        revision: { increment: 1 },
      },
    });
    if (r.count !== 1)
      groupError(409, "REVISION_CONFLICT", "Bài nộp đã thay đổi.");
  }
  async notify(data: Prisma.NotificationUncheckedCreateInput) {
    return this.progressDb.notification.create({ data });
  }
  termPlanIds(termId: string) {
    return this.progressDb.$queryRaw<
      Array<{ id: string }>
    >`SELECT gp.id FROM public."GUIDANCE_PLAN" gp JOIN public."PROPOSAL" p ON p.id=gp.proposal_id JOIN public."TOPIC" t ON t.id=p.topic_id WHERE t.term_id=${termId} ORDER BY gp.id`;
  }
  monitorTasks(planId: string) {
    return this.progressDb.task.findMany({
      where: { guidancePlanId: planId },
      include: {
        _count: { select: { submissions: true } },
        pr2bTaskWorkflowTaskId: {
          include: {
            refPeriodId: true,
            refCurrentSubmissionId: {
              include: {
                pr2bSubmissionWorkflowSubmissionId: {
                  include: { refEffectiveReviewId: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ deadline: "asc" }, { id: "asc" }],
    });
  }
  meeting(id: string) {
    return this.progressDb.guidanceMeeting.findUnique({
      where: { id },
      include: meetingInclude,
    });
  }
  meetings(planId: string, skip: number, take: number) {
    return this.progressDb.guidanceMeeting.findMany({
      where: { guidancePlanId: planId },
      include: meetingInclude,
      skip,
      take,
      orderBy: [{ meetingDate: "desc" }, { id: "desc" }],
    });
  }
  meetingCount(planId: string) {
    return this.progressDb.guidanceMeeting.count({
      where: { guidancePlanId: planId },
    });
  }
  addMeeting(data: Prisma.GuidanceMeetingUncheckedCreateInput) {
    return this.progressDb.guidanceMeeting.create({
      data,
      include: meetingInclude,
    });
  }
  updateMeeting(id: string, data: Prisma.GuidanceMeetingUncheckedUpdateInput) {
    return this.progressDb.guidanceMeeting.update({ where: { id }, data });
  }
  async advanceMeeting(
    meetingId: string,
    revision: number,
    data: Prisma.MeetingWorkflowUncheckedUpdateManyInput,
  ) {
    const r = await this.progressDb.meetingWorkflow.updateMany({
      where: { meetingId, revision },
      data: { ...data, revision: { increment: 1 } },
    });
    if (r.count !== 1)
      groupError(409, "REVISION_CONFLICT", "Nhật ký đã thay đổi.");
  }
  meetingHistory(data: Prisma.MeetingHistoryUncheckedCreateInput) {
    return this.progressDb.meetingHistory.create({ data });
  }
  async lockMeeting(id: string) {
    await this.progressDb
      .$queryRaw`SELECT id FROM public."GUIDANCE_MEETING" WHERE id=${id} FOR UPDATE`;
  }
}
@Injectable()
export class ProgressRepository {
  constructor(private readonly prisma: PrismaService) {}
  async transaction<T>(
    work: (s: ProgressSession) => Promise<T>,
    mutation = false,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++)
      try {
        return await this.prisma.$transaction(
          (tx) => work(new ProgressSession(tx)),
          {
            isolationLevel: mutation ? "Serializable" : "RepeatableRead",
            timeout: 30000,
          },
        );
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          (["P2034", "P2002"].includes(e.code) ||
            (e.code === "P2010" &&
              ["40001", "40P01"].includes(String(e.meta?.code))))
        ) {
          if (attempt < 2) continue;
          groupError(
            409,
            "REVISION_CONFLICT",
            "Dữ liệu đã thay đổi; tải lại trước khi gửi.",
          );
        }
        throw e;
      }
  }
}
