import { describe, it, expect, vi } from "vitest";
import { HttpException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  ProposalReviewValidator,
  reviewHash,
} from "./proposal-review.validator";
import { ProposalReviewService } from "./proposal-review.service";
import {
  ProposalReviewRepository,
  ProposalReviewSession,
  ReviewPrincipal,
  ReviewProposal,
  ReviewRecord,
} from "./proposal-review.repository";
import {
  AssignReviewSchema,
  ReviewDecisionSchema,
  ReviewCommentSchema,
  ReviewQuerySchema,
} from "@doan/shared";
const v = new ProposalReviewValidator();
describe("Step 5 database serialization retries", () => {
  const serializationError = () =>
    new Prisma.PrismaClientKnownRequestError("Serialization conflict", {
      code: "P2010",
      clientVersion: "5.22.0",
      meta: { code: "40001" },
    });
  it("retries raw row-lock serialization errors and succeeds", async () => {
    const transaction = vi
      .fn()
      .mockRejectedValueOnce(serializationError())
      .mockResolvedValue("committed");
    const repo = new ProposalReviewRepository({
      $transaction: transaction,
    } as never);
    await expect(repo.transaction(async () => "committed", true)).resolves.toBe(
      "committed",
    );
    expect(transaction).toHaveBeenCalledTimes(2);
  });
  it("bounds retries and returns an actionable conflict instead of an internal error", async () => {
    const transaction = vi.fn().mockRejectedValue(serializationError());
    const repo = new ProposalReviewRepository({
      $transaction: transaction,
    } as never);
    await expect(
      repo.transaction(async () => "unreachable", true),
    ).rejects.toMatchObject({
      response: { error: { code: "REVISION_CONFLICT" } },
    });
    expect(transaction).toHaveBeenCalledTimes(3);
  });
});
function user(role = "FACULTY", action = "read"): ReviewPrincipal {
  return {
    id: "u",
    status: "ACTIVE",
    userRoles: [
      {
        role: {
          name: role,
          rolePermissions: [{ permission: { resource: "proposal", action } }],
        },
      },
    ],
  } as unknown as ReviewPrincipal;
}
const failure = (fn: () => unknown, code: string) => {
  try {
    fn();
    throw Error("Expected rejection");
  } catch (e) {
    expect(e).toBeInstanceOf(HttpException);
    expect((e as HttpException).getResponse()).toMatchObject({
      error: { code },
    });
  }
};
function proposal(): ReviewProposal {
  return {
    id: "p",
    studentId: "student",
    topic: {
      termId: "term",
      pr2bTopicWorkflowTopicId: {
        termStudentId: "ts",
        termId: "term",
        revision: 0,
        refTermStudentId: { termId: "term", studentId: "student" },
        confirmedAt: new Date(),
        confirmedByAdvisorId: "advisor",
        confirmedTopicRevision: 0,
        confirmedAssignmentRevision: 0,
      },
      researchArea: {
        pr2bResearchAreaWorkflowResearchAreaId: { departmentId: "d" },
      },
    },
    student: { userId: "studentUser" },
    reviews: [],
    pr2bProposalWorkflowProposalId: {
      revision: 0,
      submittedVersionId: "version",
      submissionKind: "INITIAL",
      refSubmittedVersionId: {
        id: "version",
        proposalId: "p",
        content: { objectives: "test" },
        pr2bProposalVersionWorkflowVersionId: {
          state: "SEALED",
          contentSchemaVersion: 1,
          contentHash: reviewHash({ objectives: "test" }),
          submittedAt: new Date(Date.now() - 1000),
          submittedByUserId: "studentUser",
        },
      },
    },
  } as unknown as ReviewProposal;
}
describe("Step 5 strict shared DTOs", () => {
  it("accepts opaque IDs and a confirmed reassign contract", () => {
    expect(
      AssignReviewSchema.safeParse({
        groupId: "legacy-group",
        proposalVersionId: "v",
        expectedProposalRevision: 0,
      }).success,
    ).toBe(true);
    expect(
      AssignReviewSchema.safeParse({
        groupId: "g",
        proposalVersionId: "v",
        expectedProposalRevision: 1,
        replacesReviewId: "r",
        expectedReviewRevision: 0,
        reason: "Điều chỉnh",
      }).success,
    ).toBe(true);
  });
  it("rejects incomplete reassign, injected actor and invalid pagination", () => {
    expect(
      AssignReviewSchema.safeParse({
        groupId: "g",
        proposalVersionId: "v",
        expectedProposalRevision: 0,
        replacesReviewId: "r",
      }).success,
    ).toBe(false);
    expect(
      ReviewCommentSchema.safeParse({
        expectedReviewRevision: 0,
        versionId: "v",
        text: "OK",
        authorUserId: "forged",
      }).success,
    ).toBe(false);
    expect(ReviewQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });
  it("accepts APPROVED and revision-required with a comment", () => {
    for (const decision of ["APPROVED", "REVISION_REQUIRED"])
      expect(
        ReviewDecisionSchema.safeParse({
          expectedProposalRevision: 0,
          expectedReviewRevision: 0,
          versionId: "v",
          decision,
          comment: "OK",
        }).success,
      ).toBe(true);
  });
  it("rejects empty revision comment and unsupported rejection/vote/criteria", () => {
    for (const decision of ["REVISION_REQUIRED", "REJECTED", "FAIL"])
      expect(
        ReviewDecisionSchema.safeParse({
          expectedProposalRevision: 0,
          expectedReviewRevision: 0,
          versionId: "v",
          decision,
        }).success,
      ).toBe(false);
    expect(
      ReviewCommentSchema.safeParse({
        expectedReviewRevision: 0,
        versionId: "v",
        text: "OK",
        criteria: [],
      }).success,
    ).toBe(false);
  });
});
describe("Step 5 business validators", () => {
  it("requires active account; ADMIN does not inherit faculty permission", () => {
    expect(v.principal(user())).toBeDefined();
    expect(v.role(user("ADMIN", "assign"), "FACULTY", "assign")).toBe(false);
    failure(() => v.principal({ ...user(), status: "LOCKED" }), "AUTH_002");
  });
  it("rejects missing account and permission mixed from a different role", () => {
    failure(() => v.principal(null), "AUTH_003");
    const mixed = user();
    mixed.userRoles.push(...user("ADMIN", "review").userRoles);
    expect(v.role(mixed, "FACULTY", "review")).toBe(false);
  });
  it("accepts matching revision and valid state; rejects stale/state bypass", () => {
    v.revision(2, 2);
    v.state(["IN_REVIEW"], "IN_REVIEW");
    failure(() => v.revision(2, 1), "REVISION_CONFLICT");
    failure(
      () => v.state(["IN_REVIEW"], "ASSIGNED"),
      "STATE_TRANSITION_INVALID",
    );
  });
  it("requires same-term ownership without guessing a student", () => {
    const p = proposal();
    expect(v.ownership(p).termStudentId).toBe("ts");
    p.topic.pr2bTopicWorkflowTopicId!.refTermStudentId!.studentId = "other";
    failure(() => v.ownership(p), "INPUT_NOT_READY");
  });
  it("uses explicit research-area routing, not advisor department", () => {
    const p = proposal();
    expect(v.routing(p).departmentId).toBe("d");
    p.topic.researchArea!.pr2bResearchAreaWorkflowResearchAreaId!.departmentId =
      null;
    failure(() => v.routing(p), "ROUTING_NOT_CONFIGURED");
  });
  it("accepts open phase, rejects locked and term mismatch", async () => {
    const phase = {
      refPhaseId: {
        termId: "t",
        isLocked: false,
        startDate: new Date(0),
        endDate: new Date("9999-01-01Z"),
      },
    };
    const s = {
      term: vi.fn().mockResolvedValue({ status: "IN_PROGRESS" }),
      phase: vi.fn().mockResolvedValue(phase),
    } as unknown as ProposalReviewSession;
    await expect(v.phase(s, "t")).resolves.toBeDefined();
    phase.refPhaseId.isLocked = true;
    await expect(v.phase(s, "t")).rejects.toMatchObject({
      response: { error: { code: "TERM_003" } },
    });
    phase.refPhaseId.isLocked = false;
    await expect(v.phase(s, "other")).rejects.toMatchObject({
      response: { error: { code: "INPUT_NOT_READY" } },
    });
  });
  it("does not write before phase starts or at exact exclusive end", async () => {
    const phase = {
      refPhaseId: {
        termId: "t",
        isLocked: false,
        startDate: new Date(Date.now() + 100000),
        endDate: new Date("9999-01-01Z"),
      },
    };
    const s = {
      term: vi.fn().mockResolvedValue({ status: "IN_PROGRESS" }),
      phase: vi.fn().mockResolvedValue(phase),
    } as unknown as ProposalReviewSession;
    await expect(v.phase(s, "t")).rejects.toMatchObject({
      response: { error: { code: "TERM_003" } },
    });
    phase.refPhaseId.startDate = new Date(0);
    phase.refPhaseId.endDate = new Date(0);
    await expect(v.phase(s, "t")).rejects.toMatchObject({
      response: { error: { code: "TERM_003" } },
    });
  });
  it.each([
    [-1, false],
    [0, true],
    [999, true],
    [1000, false],
    [1001, false],
  ])(
    "enforces [start, end) at exact boundary offset %d ms",
    async (offset, allowed) => {
      const start = new Date("2026-10-28T02:00:00.000Z");
      const s = {
        term: vi.fn().mockResolvedValue({ status: "IN_PROGRESS" }),
        phase: vi.fn().mockResolvedValue({
          refPhaseId: {
            termId: "t",
            isLocked: false,
            startDate: start,
            endDate: new Date(start.getTime() + 1000),
          },
        }),
      } as unknown as ProposalReviewSession;
      vi.useFakeTimers();
      try {
        vi.setSystemTime(start.getTime() + offset);
        if (allowed) await expect(v.phase(s, "t")).resolves.toBeDefined();
        else
          await expect(v.phase(s, "t")).rejects.toMatchObject({
            response: { error: { code: "TERM_003" } },
          });
      } finally {
        vi.useRealTimers();
      }
    },
  );
  it("requires a SEALED submitted version, correct hash and current agreement", async () => {
    const validator = new ProposalReviewValidator();
    vi.spyOn(validator, "advisor").mockResolvedValue({
      assignment: { advisorId: "advisor" },
      revision: 0,
    } as never);
    const s = {} as ProposalReviewSession,
      p = proposal();
    await expect(validator.submitted(s, p, "version")).resolves.toBeDefined();
    await expect(validator.submitted(s, p, "different")).rejects.toMatchObject({
      response: { error: { code: "STALE_VERSION" } },
    });
    p.pr2bProposalWorkflowProposalId!.refSubmittedVersionId!.pr2bProposalVersionWorkflowVersionId!.contentHash =
      "tampered";
    await expect(validator.submitted(s, p, "version")).rejects.toMatchObject({
      response: { error: { code: "STALE_VERSION" } },
    });
  });
  it("rejects draft submission or obsolete topic agreement", async () => {
    const validator = new ProposalReviewValidator();
    vi.spyOn(validator, "advisor").mockResolvedValue({
      assignment: { advisorId: "advisor" },
      revision: 0,
    } as never);
    const s = {} as ProposalReviewSession,
      p = proposal(),
      meta =
        p.pr2bProposalWorkflowProposalId!.refSubmittedVersionId!
          .pr2bProposalVersionWorkflowVersionId!;
    meta.state = "DRAFT";
    await expect(validator.submitted(s, p)).rejects.toMatchObject({
      response: { error: { code: "INPUT_NOT_READY" } },
    });
    meta.state = "SEALED";
    p.topic.pr2bTopicWorkflowTopicId!.confirmedAssignmentRevision = 9;
    await expect(validator.submitted(s, p)).rejects.toMatchObject({
      response: { error: { code: "TOPIC_NOT_AGREED" } },
    });
  });
  it("accepts active round, rejects legacy and immutable decided round", () => {
    const r = {
      pr2bProposalReviewWorkflowReviewId: {
        state: "IN_REVIEW",
        versionId: "v",
        roundNumber: 1,
      },
    } as ReviewRecord;
    expect(v.active(r).state).toBe("IN_REVIEW");
    r.pr2bProposalReviewWorkflowReviewId!.state = "DECIDED";
    failure(() => v.active(r), "REVIEW_ALREADY_DECIDED");
    r.pr2bProposalReviewWorkflowReviewId = null;
    failure(() => v.active(r), "INPUT_NOT_READY");
  });
});
describe("Step 5 service authorization", () => {
  it("faculty term list comes from explicit academic grants", async () => {
    const s = {
      principal: vi.fn().mockResolvedValue(user()),
      grants: vi
        .fn()
        .mockResolvedValue([{ termId: "t", allDepartments: true }]),
      terms: vi.fn().mockResolvedValue([{ id: "t" }]),
    };
    const repo = {
      transaction: async (fn: (s: unknown) => unknown) => fn(s),
    } as unknown as ProposalReviewRepository;
    const service = new ProposalReviewService(repo, v);
    await expect(service.terms("u")).resolves.toEqual([{ id: "t" }]);
    expect(s.terms).toHaveBeenCalledWith({ id: { in: ["t"] } });
  });
  it("ADMIN with granted permission gets no academic terms and cannot assign", async () => {
    const s = {
      principal: vi.fn().mockResolvedValue(user("ADMIN", "assign")),
      grants: vi.fn(),
      terms: vi.fn().mockResolvedValue([]),
      proposal: vi.fn().mockResolvedValue(proposal()),
    };
    const repo = {
      transaction: async (fn: (s: unknown) => unknown) => fn(s),
    } as unknown as ProposalReviewRepository;
    const service = new ProposalReviewService(repo, v);
    await expect(service.terms("u")).resolves.toEqual([]);
    await expect(
      service.assign(
        "u",
        "p",
        { groupId: "g", proposalVersionId: "v", expectedProposalRevision: 0 },
        "test",
      ),
    ).rejects.toMatchObject({ response: { error: { code: "COMMON_001" } } });
    expect(s.grants).not.toHaveBeenCalled();
  });
});
