import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { reviewFixture } from "./defense-review.test-fixtures";
import { reviewQuerySchema, previewQuerySchema } from "./defense-review.dto";

const inbox = (f: ReturnType<typeof reviewFixture>, query: object = {}) =>
  f.service.inbox(
    "advisor-user",
    reviewQuerySchema.parse({ termId: "term", ...query }),
  );
const preview = (f: ReturnType<typeof reviewFixture>) =>
  f.service.preview("advisor-user", "term", previewQuerySchema.parse({}));
describe("UC17 official inbox / UC18 roster preview", () => {
  it("lists only current official assignments with paginated decision filter and warning-only progress", async () => {
    const f = reviewFixture();
    const response = await inbox(f, { status: "CONFIRMED" });
    expect(response.total).toBe(1);
    expect(response.items[0]).toMatchObject({
      proposalId: "proposal",
      status: "CONFIRMED",
      progress: { summary: { incomplete: 1 } },
    });
    expect(JSON.stringify(response)).not.toMatch(
      /storageKey|filePath|checksum|decisionContext/,
    );
    expect((await inbox(f, { status: "PENDING" })).total).toBe(0);
  });
  it.each(["PUBLISHED", "DRAFT"])(
    "does not use a %s plan as official",
    async (status) => {
      const f = reviewFixture();
      f.f.registration.advisorAssignment!.assignmentPlan.status =
        status as "PUBLISHED";
      expect((await inbox(f)).total).toBe(0);
    },
  );
  it.each(["wrong-term", "wrong-pointer", "advisor-changed", "future-change"])(
    "excludes inconsistent/old assignments: %s",
    async (kind) => {
      const f = reviewFixture();
      const a = f.f.registration.advisorAssignment!;
      if (kind === "wrong-term") a.assignmentPlan.termId = "other-term";
      if (kind === "wrong-pointer")
        f.f.term.pr2bTermWorkflowTermId!.officialAssignmentPlanId =
          "other-plan";
      if (kind === "advisor-changed") {
        a.advisorId = "other-advisor";
        a.advisor.userId = "other-user";
        f.f.roster.lecturerId = "other-advisor";
      }
      if (kind === "future-change")
        a.pr2bAssignmentChangeAssignmentId.push({
          assignmentId: a.id,
          assignmentRevision: 1,
          newAdvisorId: a.advisorId,
          effectiveAt: new Date("2099-01-01Z"),
        } as never);
      expect((await inbox(f)).total).toBe(0);
    },
  );
  it("rejects missing permission or inactive principal before reading roster", async () => {
    const f = reviewFixture();
    f.f.user.userRoles[0].role.rolePermissions = [];
    await expect(inbox(f)).rejects.toMatchObject({ status: 403 });
    expect(f.s.members).not.toHaveBeenCalled();
    f.f.user.status = "DISABLED" as never;
    await expect(inbox(f)).rejects.toMatchObject({ status: 403 });
  });
  it("requires guidance read permission for the official advisor inbox", async () => {
    const f = reviewFixture();
    f.f.user.userRoles[0].role.rolePermissions =
      f.f.user.userRoles[0].role.rolePermissions.filter(
        (p) => p.permission.resource !== "guidance",
      );
    await expect(inbox(f)).rejects.toMatchObject({ status: 403 });
  });
  it("student inbox is own roster only and does not read progress", async () => {
    const f = reviewFixture();
    f.f.user.userRoles[0].role.name = "STUDENT";
    f.f.user.student = { ...f.f.proposal.student };
    f.f.user.id = "student-user";
    f.data.members.push({
      ...f.data.members[0],
      id: "other-member",
      studentId: "other-student",
    });
    const response = await f.service.inbox(
      "student-user",
      reviewQuerySchema.parse({ termId: "term", view: "STUDENT" }),
    );
    expect(response.total).toBe(1);
    expect(response.items[0].progress).toBeNull();
    expect(f.s.planFor).not.toHaveBeenCalled();
    expect(f.s.members).toHaveBeenCalledWith("term", "student");
  });
  it.each(["ADMIN", "FACULTY"])(
    "%s does not bypass term grant",
    async (role) => {
      const f = reviewFixture();
      f.faculty();
      f.f.user.userRoles[0].role.name = role;
      f.grant.termId = "other-term";
      await expect(inbox(f, { view: "FACULTY" })).rejects.toMatchObject({
        status: 403,
      });
      await expect(preview(f)).rejects.toMatchObject({ status: 403 });
    },
  );
  it("department preview omits unrouteable/out-of-scope students and marks partial coverage", async () => {
    const f = reviewFixture();
    f.faculty(false);
    f.grant.pr2bGrantDepartmentGrantId.push({ departmentId: "dept" });
    const response = await preview(f);
    expect(response).toMatchObject({
      rosterCompleteForTerm: false,
      scope: "DEPARTMENTS",
      rosterCount: 0,
      capabilities: { canManage: false, canFinalize: false, canReopen: false },
    });
  });
  it("full-term preview retains students with no Proposal/PDF/decision", async () => {
    const f = reviewFixture();
    f.faculty();
    f.data.proposals = [];
    const response = await preview(f);
    expect(response.rosterCount).toBe(1);
    expect(response.items[0]).toMatchObject({
      proposalId: null,
      evidence: { admitted: false, officialEligibility: "UNKNOWN" },
    });
    expect(response.items[0].evidence.reasons).toEqual(
      expect.arrayContaining([
        "PROPOSAL_MISSING",
        "PDF_MISSING",
        "ADVISOR_DECISION_PENDING",
        "ACADEMIC_SOURCE_NOT_VERIFIED",
      ]),
    );
    expect(f.uc18.read).toHaveBeenCalledWith("term", f.tx);
  });
  it("does not consider CONFIRMED or a default academicEligible flag sufficient to admit", async () => {
    const f = reviewFixture();
    f.faculty();
    const response = await preview(f);
    expect(response.admittedCount).toBe(0);
    expect(response.items[0].evidence.reasons).toContain(
      "ACADEMIC_SOURCE_NOT_VERIFIED",
    );
    expect(response.blockers.map((b) => b.code)).toContain(
      "METADATA_PREVIEW_ONLY",
    );
  });
  it("same-checksum reupload with a new revision marks evidence STALE without changing UC17", async () => {
    const f = reviewFixture();
    f.faculty();
    f.data.proposals[0].finalReport.revision++;
    const response = await preview(f);
    expect(response.items[0].pdfChangedSinceDecision).toBe(true);
    expect(response.items[0].evidence.reasons).toContain("PDF_EVIDENCE_STALE");
    expect(f.f.decision.revision).toBe(1);
  });
  it("legacy decision is UNKNOWN, not a confirmed decision in status filters", async () => {
    const f = reviewFixture();
    f.data.proposals[0].defenseConfirmation.revision = 0;
    f.data.proposals[0].defenseConfirmation.decisionContext = null;
    expect((await inbox(f, { status: "CONFIRMED" })).total).toBe(0);
    expect(
      (await inbox(f, { status: "UNKNOWN" })).items[0].decision.state,
    ).toBe("LEGACY");
  });
  it("rejects spoofed actor and unbounded/invalid filters", () => {
    expect(
      reviewQuerySchema.safeParse({ termId: "term", actorId: "other-user" })
        .success,
    ).toBe(false);
    expect(
      reviewQuerySchema.safeParse({ termId: "term", limit: 101 }).success,
    ).toBe(false);
    expect(previewQuerySchema.safeParse({ result: "ELIGIBLE" }).success).toBe(
      false,
    );
  });
});
