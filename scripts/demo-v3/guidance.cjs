"use strict";
const {
    id,
    date,
    plus,
    terms,
    participants,
    hash,
  } = require("./definition.cjs"),
  files = require("./assets.cjs");
async function seedGuidance(ctx) {
  const policy = ctx.local.req(
    "./dist/guidance/submissions/submission-policy",
  ).approvedSubmissionPolicy;
  for (const t of terms) {
    await ctx.phase("weekly-periods-" + t.key, async (tx) => {
      for (let w = 1; w <= t.weeks; w++) {
        const at = date(t.guidance[0]),
          startsAt = plus(at, (w - 1) * 7),
          endsAt = plus(at, w * 7),
          due = new Date(endsAt.getTime() - 3600000);
        await ctx.put(tx, "guidancePeriod", {
          id: id(`period/${t.key}/${w}`),
          termId: t.id,
          ordinal: w,
          label: `Tuần ${w} · ${["Phân tích yêu cầu", "Thiết kế dữ liệu", "Phát triển chức năng", "Tích hợp hệ thống", "Kiểm thử và báo cáo", "Hoàn thiện sản phẩm"][(w - 1) % 6]}`,
          description:
            "Kế hoạch mô phỏng, báo cáo và source được sinh thật trên storage TEST.",
          type: "WEEK",
          state: "OPEN",
          startsAt,
          endsAt,
          reportDueAt: due,
          expectedDeliverables:
            "Báo cáo PDF, mã nguồn ZIP và minh chứng kiểm thử",
          allowLate: true,
          publishedAt: at,
          revision: 1,
          createdByUserId: id("user/faculty/1"),
          updatedByUserId: id("user/faculty/1"),
          createdAt: at,
          updatedAt: at,
        });
      }
      await ctx.put(tx, "guidancePeriod", {
        id: id("milestone/" + t.key),
        termId: t.id,
        ordinal: 50,
        label: "Mốc đánh giá tiến độ giữa kỳ (DEMO)",
        type: "MILESTONE",
        state: "OPEN",
        startsAt: date(t.guidance[0]),
        endsAt: date(t.guidance[1]),
        revision: 1,
        createdAt: date(t.guidance[0]),
        updatedAt: date(t.guidance[0]),
      });
    });
    for (const p of participants(t))
      await ctx.phase("weekly-guidance-" + p.key, async (tx) => {
        const { key, student: s, advisor: a } = p,
          planId = id("guidance-plan/" + key),
          proposalId = id("proposal/" + key),
          at = date(t.guidance[0]);
        const early = p.requestedOutcome === "DEFER_BEFORE_SCHEDULE",
          paused = t.key === "march" && p.index >= 60,
          weeks = early ? 4 : t.weeks;
        await ctx.put(tx, "guidancePlan", {
          id: planId,
          proposalId,
          advisorId: a.id,
          description:
            "Kế hoạch hướng dẫn DEMO V3, dữ liệu tổng hợp có chuỗi minh chứng.",
          createdAt: at,
          updatedAt: at,
        });
        await ctx.put(tx, "guidancePlanWorkflow", {
          id: id("guidance-plan-workflow/" + key),
          planId,
          proposalId,
          finalizationId: id("finalization/" + key),
          assignmentId: id("assignment/" + key),
          assignmentRevision: 0,
          state: paused ? "PAUSED" : "ACTIVE",
          revision: paused ? 2 : 1,
          createdAt: at,
          updatedAt: paused ? plus(at, weeks * 7) : at,
        });
        for (const action of ["CREATED", ...(paused ? ["PAUSED"] : [])]) {
          const time = action === "CREATED" ? at : plus(at, weeks * 7);
          await ctx.put(tx, "planHistory", {
            id: id(`plan-history/${key}/${action}`),
            planId,
            actorId: a.userId,
            action,
            reason:
              action === "PAUSED"
                ? "[DEMO] Tạm dừng hướng dẫn; chờ xử lý đề nghị hoãn, chưa khẳng định đã được duyệt bảo lưu."
                : "[DEMO] Tạo kế hoạch từ hồ sơ đã chốt",
            snapshot: {
              synthetic: true,
              assignmentId: id("assignment/" + key),
              assignmentRevision: 0,
              finalizationId: id("finalization/" + key),
            },
            createdAt: time,
            updatedAt: time,
          });
        }
        if (paused)
          await ctx.put(tx, "defermentRequest", {
            id: id("deferment/" + key),
            proposalId,
            reason:
              "[DEMO] Đề nghị hoãn vì chưa hoàn thành điều kiện; chờ quyết định qua producer xét bảo vệ.",
            status: "PENDING",
            requestedAt: plus(at, weeks * 7),
            updatedAt: plus(at, weeks * 7),
          });
        for (let w = 1; w <= weeks; w++) {
          const wk = `${key}/${w}`,
            periodId = id(`period/${t.key}/${w}`),
            memberId = id("member/" + key),
            obligationId = id("obligation/" + wk),
            taskId = id("task/" + wk),
            startsAt = plus(at, (w - 1) * 7),
            endsAt = plus(at, w * 7),
            due = new Date(endsAt.getTime() - 3600000);
          const latest = t.key === "october" && w === 5,
            state =
              w === 6 && t.key === "october"
                ? "FUTURE"
                : latest
                  ? p.latest
                  : "PASS";
          await ctx.put(tx, "periodRequiredStudent", {
            id: id("required/" + wk),
            periodId,
            termStudentId: memberId,
            termId: t.id,
            createdAt: at,
            updatedAt: at,
          });
          const config = {
            schemaVersion: 1,
            periodId,
            termStudentId: memberId,
            termId: t.id,
            periodRevision: 1,
            startsAt: startsAt.toISOString(),
            reportDueAt: due.toISOString(),
            expectedDeliverables:
              "Báo cáo PDF, mã nguồn ZIP và minh chứng kiểm thử",
          };
          ctx.local
            .req("@doan/shared")
            .WeeklyObligationConfigSchema.parse(config);
          await ctx.put(tx, "weeklyReportObligation", {
            id: obligationId,
            periodId,
            termStudentId: memberId,
            planId,
            configRevision: 1,
            configSnapshot: config,
            revision: 1,
            createdAt: at,
            updatedAt: at,
          });
          await ctx.put(tx, "task", {
            id: taskId,
            guidancePlanId: planId,
            title: `Tuần ${w}: ${state === "FUTURE" ? "Công việc tiếp theo" : "Báo cáo tiến độ và mã nguồn"}`,
            description:
              "Thực hiện công việc theo kế hoạch; nêu kết quả, khó khăn và nhiệm vụ tiếp theo.",
            deadline: due,
            status: "TODO",
            createdAt: startsAt,
            updatedAt: startsAt,
          });
          await ctx.put(tx, "taskWorkflow", {
            id: id("task-workflow/" + wk),
            taskId,
            planId,
            periodId,
            obligationId,
            state: "TODO",
            kind: "WEEKLY_REPORT",
            startsAt,
            expectedDeliverables: config.expectedDeliverables,
            completionCriteria:
              "Có PDF và source hợp lệ; được GVHD đánh giá Đạt.",
            requirements: { synthetic: true, REPORT: true, SOURCE: true },
            nextSubmissionNumber: 1,
            revision: 1,
            createdByUserId: a.userId,
            assignedAdvisorId: a.id,
            createdAt: startsAt,
            updatedAt: startsAt,
          });
          await tx.weeklyReportObligation.update({
            where: { id: obligationId },
            data: { currentTaskId: taskId },
          });
          await ctx.put(tx, "taskHistory", {
            id: id("task-history/create/" + wk),
            taskId,
            actorId: a.userId,
            reason: "[DEMO] Giao báo cáo tuần",
            snapshot: {
              synthetic: true,
              fromState: null,
              toState: "TODO",
              periodId,
              obligationId,
            },
            createdAt: startsAt,
            updatedAt: startsAt,
          });
          if (["OVERDUE", "FUTURE"].includes(state)) continue;
          const resubmit = w === 2 && p.index % 7 === 0,
            versions = resubmit ? 2 : 1;
          for (let v = 1; v <= versions; v++) {
            const sk = `${wk}/${v}`,
              submissionId = id("submission/" + sk),
              late = p.index % 9 === 0 && w === 3,
              submittedAt = resubmit
                ? plus(startsAt, v + 1)
                : new Date(due.getTime() + (late ? 1800000 : -86400000)),
              reviewedAt = new Date(submittedAt.getTime() + 1800000),
              decision =
                v < versions
                  ? (p.index % 14 === 0 ? "FAIL" : "REVISION_REQUIRED")
                  : state === "PENDING_REVIEW"
                    ? null
                    : state === "REVISION_REQUIRED"
                      ? state
                      : "PASS";
            await ctx.put(tx, "taskSubmission", {
              id: submissionId,
              taskId,
              content: `[DEMO] Báo cáo tuần ${w}, bản ${v}. Kết quả và mã nguồn tổng hợp, không có dữ liệu cá nhân thật.`,
              createdAt: submittedAt,
            });
            const report = {
              assignedWork: "Phân tích và triển khai chức năng theo kế hoạch",
              completedWork:
                "Đã hoàn thành phần phát triển và cập nhật tài liệu",
              results: "Có báo cáo PDF, mã nguồn ZIP và kết quả kiểm thử",
              unfinishedWork:
                decision === "REVISION_REQUIRED" ? "Bổ sung kiểm thử biên" : "",
              unfinishedReason:
                decision === "REVISION_REQUIRED"
                  ? "Cần làm rõ tiêu chí đánh giá"
                  : "",
              difficulties: "Không có trở ngại ngoài phạm vi mô phỏng",
              solutions: "Đối chiếu yêu cầu và chạy lại kiểm thử",
              nextWork: "Hoàn thiện và kiểm thử phần tiếp theo",
              notes: "DỮ LIỆU TỔNG HỢP DEMO V3",
            };
            const links = [];
            for (const kind of [
              "REPORT",
              "SOURCE",
              ...(p.index % 10 === 0 ? ["EVIDENCE"] : []),
            ]) {
              const bytes =
                kind === "SOURCE"
                  ? files.zip(
                      `// UTC DEMO V3 synthetic source\nexport const progress = {student: ${s.n}, week: ${w}, version: ${v}};\n`,
                    )
                  : await files.pdf(
                      `Synthetic student DEMO-SV${s.n}. Week ${w}. Version ${v}. Kind ${kind}. Completed: requirements, implementation and tests. Next: regression tests.`,
                      submittedAt,
                    );
              links.push(
                await files.asset(ctx, tx, {
                  key: sk + "/" + kind,
                  kind,
                  bytes,
                  actor: s.userId,
                  at: submittedAt,
                  taskId,
                  submissionId,
                }),
              );
            }
            await ctx.put(tx, "submissionWorkflow", {
              id: id("submission-workflow/" + sk),
              submissionId,
              taskId,
              versionNumber: v,
              state: "SUBMITTED",
              submittedAt,
              submittedByUserId: s.userId,
              deadlineSnapshot: resubmit ? plus(startsAt, 5) : due,
              isLate: late,
              reportContent: report,
              changeExplanation:
                v > 1 ? "Đã bổ sung minh chứng và sửa theo góp ý" : null,
              filePolicySnapshot: policy,
              contextSnapshot: {
                schemaVersion: 1,
                synthetic: true,
                termId: t.id,
                termStudentId: memberId,
                studentId: s.id,
                proposalId,
                topicId: id("topic/" + key),
                planId,
                periodId,
                advisorId: a.id,
                assignmentId: id("assignment/" + key),
                assignmentRevision: 0,
                finalizationId: id("finalization/" + key),
                files: links.map(({ assetId, uploadId, ...f }) => ({
                  fileId: assetId,
                  uploadId,
                  ...f,
                })),
              },
              revision: 1,
              createdAt: submittedAt,
              updatedAt: submittedAt,
            });
            if (v > 1)
              await tx.submissionWorkflow.update({
                where: { submissionId: id(`submission/${wk}/${v - 1}`) },
                data: { state: "SUPERSEDED" },
              });
            await tx.taskWorkflow.update({
              where: { taskId },
              data: {
                currentSubmissionId: submissionId,
                nextSubmissionNumber: v + 1,
                state: "SUBMITTED",
                revision: { increment: 1 },
              },
            });
            await tx.task.update({
              where: { id: taskId },
              data: { status: "SUBMITTED", updatedAt: submittedAt },
            });
            if (decision) {
              const reviewId = id("progress-review/" + sk);
              await ctx.put(tx, "progressReview", {
                id: reviewId,
                submissionId,
                reviewerUserId: a.userId,
                decision,
                state: "RECORDED",
                comment:
                  decision === "PASS"
                    ? "[DEMO] Đã đối chiếu nội dung và minh chứng; đạt yêu cầu."
                    : "[DEMO] Cần bổ sung kiểm thử biên và mô tả kết quả.",
                assignmentRevision: 0,
                recordedAt: reviewedAt,
                revisionDueAt:
                  decision === "REVISION_REQUIRED"
                    ? plus(startsAt, latest ? 10 : 5)
                    : null,
                revision: 1,
                createdAt: reviewedAt,
                updatedAt: reviewedAt,
              });
              await tx.submissionWorkflow.update({
                where: { submissionId },
                data: {
                  state: "REVIEWED",
                  effectiveReviewId: reviewId,
                  revision: 2,
                },
              });
              await tx.taskWorkflow.update({
                where: { taskId },
                data: {
                  state:
                    decision === "PASS" ? "COMPLETED" : "REVISION_REQUESTED",
                  revision: { increment: 1 },
                },
              });
            }
            await ctx.put(tx, "taskHistory", {
              id: id("task-history/submitted/" + sk),
              taskId,
              actorId: s.userId,
              reason: "[DEMO] Nộp báo cáo có file thực",
              snapshot: {
                synthetic: true,
                submissionId,
                versionNumber: v,
                fromState: v > 1 ? "REVISION_REQUESTED" : "TODO",
                toState: "SUBMITTED",
              },
              createdAt: submittedAt,
              updatedAt: submittedAt,
            });
            if (decision)
              await ctx.put(tx, "taskHistory", {
                id: id("task-history/reviewed/" + sk),
                taskId,
                actorId: a.userId,
                reason: "[DEMO] Nhận xét đúng GVHD và phiên bản",
                snapshot: {
                  synthetic: true,
                  submissionId,
                  reviewId: id("progress-review/" + sk),
                  decision,
                  fromState: "SUBMITTED",
                  toState:
                    decision === "PASS" ? "COMPLETED" : "REVISION_REQUESTED",
                },
                createdAt: reviewedAt,
                updatedAt: reviewedAt,
              });
          }
          await ctx.put(tx, "taskProgressEvent", {
            id: id("task-progress/" + wk),
            taskId,
            actorId: s.userId,
            note: "[DEMO] Cập nhật tiến độ thực hiện trước khi nộp báo cáo",
            createdAt: plus(startsAt, 1),
            updatedAt: plus(startsAt, 1),
          });
        }
        const meetingAt = plus(at, 14),
          meetingId = id("meeting/" + key);
        await ctx.put(tx, "guidanceMeeting", {
          id: meetingId,
          guidancePlanId: planId,
          meetingDate: meetingAt,
          location: "Phòng làm việc mô phỏng / trực tuyến",
          summary:
            "[DEMO] Thảo luận thiết kế và kế hoạch kiểm thử; không phải cuộc họp thật.",
          createdAt: meetingAt,
        });
        await ctx.put(tx, "meetingWorkflow", {
          id: id("meeting-workflow/" + key),
          meetingId,
          authorUserId: a.userId,
          mode: "ONLINE",
          discussion: "Đối chiếu yêu cầu và phạm vi",
          conclusion: "Bổ sung tiêu chí kiểm thử",
          revision: 1,
          createdAt: meetingAt,
          updatedAt: meetingAt,
        });
        await ctx.put(tx, "meetingHistory", {
          id: id("meeting-history/" + key),
          meetingId,
          actorId: a.userId,
          reason: "[DEMO] Lịch sử tổng hợp",
          snapshot: { synthetic: true, meetingId },
          createdAt: meetingAt,
          updatedAt: meetingAt,
        });
        const evaluatedAt = plus(at, 21),
          evaluationId = id("evaluation/" + key);
        await ctx.put(tx, "phaseEvaluation", {
          id: evaluationId,
          guidancePlanId: planId,
          phaseName: "Đánh giá giữa kỳ (DEMO)",
          score: "7.0",
          comment: "[DEMO] Đạt tiến độ, tiếp tục hoàn thiện kiểm thử.",
          evaluatedAt,
          createdAt: evaluatedAt,
        });
        await ctx.put(tx, "evaluationWorkflow", {
          id: id("evaluation-workflow/" + key),
          evaluationId,
          planId,
          milestoneId: id("milestone/" + t.key),
          evaluatorUserId: a.userId,
          criteriaSnapshot: {
            synthetic: true,
            criteria: [{ key: "progress", maxScore: 10 }],
          },
          criterionScores: { progress: 7 },
          revision: 1,
          createdAt: evaluatedAt,
          updatedAt: evaluatedAt,
        });
        await ctx.put(tx, "evaluationHistory", {
          id: id("evaluation-history/" + key),
          evaluationId,
          actorId: a.userId,
          reason: "[DEMO] Đánh giá giữa kỳ từ tiến độ đã có",
          snapshot: { synthetic: true, score: "7.0" },
          createdAt: evaluatedAt,
          updatedAt: evaluatedAt,
        });
      });
  }
}
module.exports = { seedGuidance };
