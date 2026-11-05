import { describe, expect, it, vi } from "vitest";
import { WeeklyService } from "./weekly.service";
import { WeeklyRepository, WeeklySession } from "./weekly.repository";
import { GuidanceValidator } from "../tasks/guidance.validator";
import { ProposalReviewValidator } from "../../topic/proposal-reviews/proposal-review.validator";
import { SubmissionService } from "../submissions/submission.service";

function fixture(role: "FACULTY" | "LECTURER" | "STUDENT") {
  const periods = [1, 2, 3].map((n) => ({
    id: `w${n}`,
    state: "OPEN",
    label: `Week ${n}`,
    startsAt: new Date(`2026-11-0${n}T00:00:00Z`),
    endsAt: new Date("2026-11-10T00:00:00Z"),
    reportDueAt: new Date("2026-11-09T00:00:00Z"),
  }));
  const pairs = periods.flatMap((period) =>
    [1, 2].map((n) => ({
      refPeriodId: period,
      refTermStudentId: {
        id: `ts${n}`,
        studentId: `s${n}`,
        student: { fullName: `Student ${n}`, studentCode: `S${n}` },
        pr2bTopicWorkflowTermStudentId: {
          refTopicId: {
            title: `Topic ${n}`,
            proposals: [
              {
                id: `p${n}`,
                studentId: `s${n}`,
                topic: {
                  researchArea: {
                    pr2bResearchAreaWorkflowResearchAreaId: {
                      departmentId: "d",
                    },
                  },
                },
              },
            ],
          },
        },
      },
    })),
  );
  const session = {
    principal: vi
      .fn()
      .mockResolvedValue({
        id: "u",
        student: role === "STUDENT" ? { id: "s1", isActive: true } : null,
        lecturer: role === "LECTURER" ? { id: "l1", isActive: true } : null,
      }),
    term: vi.fn().mockResolvedValue({ id: "t", status: "IN_PROGRESS" }),
    grants: vi
      .fn()
      .mockResolvedValue(
        role === "FACULTY"
          ? [{ allDepartments: true, pr2bGrantDepartmentGrantId: [] }]
          : [],
      ),
    roster: vi.fn().mockResolvedValue({ lecturerId: "l1" }),
    weeklyDb: {
      termStudent: { findUnique: vi.fn().mockResolvedValue({ id: "ts1" }) },
    },
    coveragePairs: vi.fn().mockResolvedValue(pairs),
    obligations: vi
      .fn()
      .mockImplementation(async (ts: string) =>
        periods.map((p) => ({
          id: `${ts}/${p.id}`,
          periodId: p.id,
          currentTaskId: null,
        })),
      ),
    planFor: vi.fn().mockResolvedValue(null),
    taskCount: vi.fn().mockResolvedValue(0),
  };
  const advisor = vi
    .fn()
    .mockImplementation(async (_s: unknown, p: { id: string }) => ({
      assignment: {
        advisorId: p.id === "p1" ? "l1" : "l2",
        advisor: { fullName: "Advisor" },
      },
    }));
  const review = { principal: (u: unknown) => u, advisor };
  const guidance = {
    role: (_u: unknown, expected: string) => expected === role,
  };
  const repo = {
    transaction: async (work: (s: WeeklySession) => unknown) =>
      work(session as unknown as WeeklySession),
  };
  const service = new WeeklyService(
    repo as unknown as WeeklyRepository,
    guidance as unknown as GuidanceValidator,
    review as unknown as ProposalReviewValidator,
    {} as SubmissionService,
  );
  return { service, session, advisor };
}

describe("weekly summary over multiple weeks", () => {
  it("counts each student per week but resolves shared contexts once per request", async () => {
    const { service, session, advisor } = fixture("FACULTY");
    const result = await service.summary("u", "t", { page: 1, limit: 100 });
    expect(result.total).toBe(6);
    expect(result.metrics.NOT_SUBMITTED).toBe(6);
    expect(advisor).toHaveBeenCalledTimes(2);
    expect(session.obligations).toHaveBeenCalledTimes(2);
    expect(session.planFor).toHaveBeenCalledTimes(2);
    await service.summary("u", "t", { page: 1, limit: 100 });
    expect(advisor).toHaveBeenCalledTimes(4); // No cross-request stale cache.
  });
  it("keeps the advisor scope when reusing a student's context across weeks", async () => {
    const { service, session } = fixture("LECTURER");
    const result = await service.summary("u", "t", { page: 1, limit: 100 });
    expect(result.total).toBe(3);
    expect(result.data.every((r) => r.studentId === "s1")).toBe(true);
    expect(session.obligations).toHaveBeenCalledTimes(1);
  });
  it("skips other students before loading their private report context", async () => {
    const { service, session, advisor } = fixture("STUDENT");
    const result = await service.summary("u", "t", { page: 1, limit: 100 });
    expect(result.total).toBe(3);
    expect(result.data.every((r) => r.studentId === "s1")).toBe(true);
    expect(advisor).toHaveBeenCalledTimes(1);
    expect(session.obligations).toHaveBeenCalledTimes(1);
    expect(session.obligations).toHaveBeenCalledWith("ts1");
  });
  it("applies week filters and pagination before returning metrics", async () => {
    const { service } = fixture("FACULTY");
    const result = await service.summary("u", "t", {
      page: 1,
      limit: 1,
      periodId: "w2",
    });
    expect(result.total).toBe(2);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].periodId).toBe("w2");
    expect(result.metrics.NOT_SUBMITTED).toBe(2);
  });
});
