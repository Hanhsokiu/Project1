import "reflect-metadata";
import { beforeEach, describe, expect, it } from "vitest";
import { ProposalReviewValidator } from "../../topic/proposal-reviews/proposal-review.validator";
import { FinalReportValidator } from "../final-reports/final-report.validator";
import {
  SubmissionValidator,
  digest,
} from "../submissions/submission.validator";
import { DefenseConfirmationValidator } from "./defense-confirmation.validator";
import {
  at,
  bytes,
  earlier,
  fixture,
} from "./defense-confirmation.test-fixtures";

export const validator = () =>
  new DefenseConfirmationValidator(
    new ProposalReviewValidator(),
    new FinalReportValidator(),
    new SubmissionValidator(),
  );
let f: ReturnType<typeof fixture>, v: DefenseConfirmationValidator;
beforeEach(() => {
  f = fixture();
  v = validator();
});
const official = () =>
  v.official(f.proposal, f.term, f.registration, f.roster, at);

describe("UC17 official advisor and reader identity", () => {
  it("accepts active permitted current official advisor", () => {
    expect(v.principal(f.user, f.user.id)).toBe(f.user);
    expect(official()).toMatchObject({
      state: "OFFICIAL",
      advisorId: "advisor",
      revision: 0,
    });
    expect(() => v.advisorAccess(f.user, official())).not.toThrow();
  });
  it.each(["INACTIVE", "LOCKED"])("rejects account status %s", (status) => {
    f.user.status = status as typeof f.user.status;
    expect(() => v.principal(f.user, f.user.id)).toThrow();
  });
  it("rejects mismatched principal ID, absent user, forced password change and inactive lecturer", () => {
    expect(() => v.principal(null, "advisor-user")).toThrow();
    expect(() => v.principal(f.user, "other-user")).toThrow();
    f.user.mustChangePassword = true;
    expect(() => v.principal(f.user, f.user.id)).toThrow();
    f.user.mustChangePassword = false;
    f.user.lecturer!.isActive = false;
    expect(() => v.principal(f.user, f.user.id)).toThrow();
  });
  it("role LECTURER alone is insufficient", () => {
    f.user.userRoles[0].role.rolePermissions = [];
    expect(() => v.principal(f.user, f.user.id)).toThrow();
  });
  it("wrong lecturer or old advisor cannot access context", () => {
    f.user.lecturer!.id = "previous-advisor";
    expect(() => v.advisorAccess(f.user, official())).toThrow();
  });
  it.each(["DRAFT", "PUBLISHED"])(
    "rejects unofficial assignment status %s",
    (status) => {
      f.registration.advisorAssignment!.assignmentPlan.status =
        status as "DRAFT";
      expect(official().state).toBe("NOT_READY");
    },
  );
  it("rejects absent official pointer, missing finalization actor and future finalization", () => {
    f.term.pr2bTermWorkflowTermId!.officialAssignmentPlanId = null;
    expect(official().state).toBe("NOT_READY");
    f = fixture();
    f.registration.advisorAssignment!.assignmentPlan.pr2bAssignmentPlanWorkflowPlanId!.finalizedByUserId =
      null;
    expect(official().state).toBe("NOT_READY");
    f = fixture();
    f.registration.advisorAssignment!.assignmentPlan.pr2bAssignmentPlanWorkflowPlanId!.finalizedAt =
      new Date("2030-01-01Z");
    expect(official().state).toBe("NOT_READY");
  });
  it("rejects absent roster or ownership, and cross-term/student registration", () => {
    expect(v.official(f.proposal, f.term, f.registration, null, at).state).toBe(
      "NOT_READY",
    );
    f.registration.studentId = "other";
    expect(official().state).toBe("NOT_READY");
    f = fixture();
    f.proposal.termId = "other";
    expect(official().state).toBe("NOT_READY");
    f = fixture();
    f.proposal.topic.pr2bTopicWorkflowTopicId = null;
    expect(official().state).toBe("NOT_READY");
  });
  it("reads effective reassignment revision and rejects an inconsistent/future change", () => {
    const a = f.registration.advisorAssignment!;
    a.pr2bAssignmentChangeAssignmentId = [
      {
        assignmentId: a.id,
        newAdvisorId: a.advisorId,
        assignmentRevision: 2,
        effectiveAt: earlier,
      },
    ] as typeof a.pr2bAssignmentChangeAssignmentId;
    expect(official()).toMatchObject({ state: "OFFICIAL", revision: 2 });
    a.pr2bAssignmentChangeAssignmentId[0].newAdvisorId = "other";
    expect(official().state).toBe("NOT_READY");
    a.pr2bAssignmentChangeAssignmentId[0].newAdvisorId = a.advisorId;
    a.pr2bAssignmentChangeAssignmentId[0].effectiveAt = new Date("2030-01-01Z");
    expect(official().state).toBe("NOT_READY");
  });
});

describe("UC17 current PDF and decision snapshots", () => {
  const pdf = () =>
    v.pdfBytes(
      v.pdfMetadata(f.report, f.proposal.id, "student-user", at),
      bytes,
    );
  it("verifies PDF metadata and bytes using the existing validator", () => {
    expect(v.pdfBytes(pdf(), bytes)).toMatchObject({
      state: "READY",
      snapshot: f.snapshot.pdf,
    });
  });
  it("metadata alone is UNVERIFIED until actual bytes have passed validation", () => {
    const metadata = v.pdfMetadata(f.report, f.proposal.id, "student-user", at);
    expect(metadata.state).toBe("UNVERIFIED");
    expect(v.pdfBytes(metadata, bytes).state).toBe("READY");
  });
  it("distinguishes missing PDF from legacy path without reading that path", () => {
    expect(v.pdfMetadata(null, "proposal", "student-user", at).state).toBe(
      "NOT_SUBMITTED",
    );
    f.report.fileAssetId = null;
    f.report.filePath = "private/legacy.pdf";
    const result = pdf();
    expect(result.state).toBe("LEGACY");
    expect(JSON.stringify(result)).not.toContain("private/legacy.pdf");
  });
  it.each([
    "missing-asset",
    "wrong-owner",
    "wrong-proposal",
    "unsafe-key",
    "unsafe-name",
    "mime",
    "future-submission",
    "revision-zero",
  ])("rejects PDF metadata: %s", (problem) => {
    if (problem === "missing-asset") f.report.fileAsset = null;
    if (problem === "wrong-owner")
      f.report.fileAsset!.createdByUserId = "other-user";
    if (problem === "wrong-proposal") f.report.proposalId = "other";
    if (problem === "unsafe-key")
      f.report.fileAsset!.storageKey = "../../escape";
    if (problem === "unsafe-name")
      f.report.fileAsset!.originalName = "../report.pdf";
    if (problem === "mime") f.report.fileAsset!.mimeType = "text/plain";
    if (problem === "future-submission")
      f.report.submittedAt = new Date("2030-01-01Z");
    if (problem === "revision-zero") f.report.revision = 0;
    expect(pdf().state).toBe("INVALID");
  });
  it("rejects checksum mismatch and malicious PDF content even with matching hash", () => {
    expect(v.pdfBytes(pdf(), Buffer.from("corrupted"))).toMatchObject({
      state: "INVALID",
      snapshot: null,
    });
    const malicious = Buffer.from(
      "%PDF-1.7\n/JavaScript evil\n/Type /Catalog\nstartxref\n0\n%%EOF\n",
    );
    const manifest = pdf();
    manifest.snapshot!.checksum = digest(malicious);
    manifest.snapshot!.sizeBytes = malicious.length;
    expect(v.pdfBytes(manifest, malicious).state).toBe("INVALID");
  });
  it("validates a current decision and strips unexpected storage fields", () => {
    f.decision.decisionContext = {
      ...f.snapshot,
      storageKey: "private",
      pdf: { ...f.snapshot.pdf!, filePath: "secret" },
    };
    const result = v.decision(f.decision, at);
    expect(result.state).toBe("RECORDED");
    expect(result.snapshot).toEqual(f.snapshot);
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("legacy CONFIRMED without a snapshot stays unverifiable", () => {
    f.decision.revision = 0;
    f.decision.decisionContext = null;
    const d = v.decision(f.decision, at);
    expect(d).toMatchObject({ state: "LEGACY", snapshot: null, revision: 0 });
    expect(v.changed(d, pdf(), official())).toMatchObject({
      pdfChangedSinceDecision: null,
      advisorChangedSinceDecision: null,
      confirmationApplicableToCurrentContext: null,
    });
  });
  it("represents absent and uninitialized PENDING decisions", () => {
    expect(v.decision(null, at).state).toBe("ABSENT");
    Object.assign(f.decision, {
      revision: 0,
      status: "PENDING",
      confirmedAt: null,
      decisionContext: null,
    });
    expect(v.decision(f.decision, at).state).toBe("PENDING");
  });
  it("rejects malformed/missing snapshot for a new decision", () => {
    f.decision.decisionContext = { schemaVersion: 99 };
    expect(v.decision(f.decision, at).state).toBe("INVALID");
  });
  it("requires confirmedAt only for CONFIRMED and rejection note for REJECTED", () => {
    f.decision.confirmedAt = null;
    expect(v.decision(f.decision, at).state).toBe("INVALID");
    Object.assign(f.decision, {
      status: "REJECTED",
      note: "Lý do",
      confirmedAt: null,
      decisionContext: { ...f.snapshot, pdf: null },
    });
    expect(v.decision(f.decision, at).state).toBe("RECORDED");
    f.decision.confirmedAt = at;
    expect(v.decision(f.decision, at).state).toBe("INVALID");
    f.decision.confirmedAt = null;
    f.decision.note = "   ";
    expect(v.decision(f.decision, at).state).toBe("INVALID");
  });
  it("same checksum but a new PDF revision invalidates applicability without altering decision", () => {
    const d = v.decision(f.decision, at);
    f.report.revision++;
    expect(v.changed(d, pdf(), official())).toMatchObject({
      pdfChangedSinceDecision: true,
      advisorChangedSinceDecision: false,
      confirmationApplicableToCurrentContext: false,
    });
    expect(f.decision.status).toBe("CONFIRMED");
    expect(d.snapshot!.pdf!.revision).toBe(1);
  });
  it("matching PDF/assignment is applicable; changed advisor or assignment revision is not", () => {
    const d = v.decision(f.decision, at),
      a = official();
    expect(v.changed(d, pdf(), a).confirmationApplicableToCurrentContext).toBe(
      true,
    );
    if (a.state !== "OFFICIAL") throw new Error("fixture");
    a.revision++;
    expect(v.changed(d, pdf(), a).advisorChangedSinceDecision).toBe(true);
    a.revision = 0;
    a.advisorId = "new-advisor";
    expect(v.changed(d, pdf(), a).advisorChangedSinceDecision).toBe(true);
  });
  it("does not treat a different actor as the current advisor's valid confirmation", () => {
    f.decision.decidedByUserId = "unrelated-user";
    expect(
      v.changed(v.decision(f.decision, at), pdf(), official())
        .confirmationApplicableToCurrentContext,
    ).toBe(false);
  });
  it("rejects unsafe historical PDF name and impossible snapshot date", () => {
    f.snapshot.pdf!.originalName = "../report.pdf";
    expect(v.decision(f.decision, at).state).toBe("INVALID");
    f.snapshot.pdf!.originalName = "report.pdf";
    f.snapshot.pdf!.submittedAt = "2026-02-30T00:00:00Z";
    expect(v.decision(f.decision, at).state).toBe("INVALID");
  });
  it("explicit rejected-without-PDF snapshot distinguishes a later upload", () => {
    Object.assign(f.decision, {
      status: "REJECTED",
      confirmedAt: null,
      decisionContext: { ...f.snapshot, pdf: null },
    });
    const d = v.decision(f.decision, at);
    expect(
      v.changed(
        d,
        v.pdfMetadata(null, "proposal", "student-user", at),
        official(),
      ).pdfChangedSinceDecision,
    ).toBe(false);
    expect(v.changed(d, pdf(), official()).pdfChangedSinceDecision).toBe(true);
  });
});

describe("UC17 independent window and authoritative UC18 gate", () => {
  it("opens at opensAt inclusively and closes at closesAt exclusively", () => {
    expect(v.window(f.term, f.window, f.window.opensAt).state).toBe("OPEN");
    expect(v.window(f.term, f.window, f.window.closesAt).state).toBe("CLOSED");
  });
  it("does not infer a missing window from term or FINAL phase", () => {
    expect(v.window(f.term, null, at).state).toBe("NOT_CONFIGURED");
  });
  it("rejects locked window or locked/completed term", () => {
    f.window.isLocked = true;
    expect(v.window(f.term, f.window, at).state).toBe("LOCKED");
    f.window.isLocked = false;
    f.term.isLocked = true;
    expect(v.window(f.term, f.window, at).state).toBe("TERM_LOCKED");
    f.term.isLocked = false;
    f.term.status = "COMPLETED";
    expect(v.window(f.term, f.window, at).state).toBe("TERM_LOCKED");
  });
  it("rejects future window and invalid/outside-term dates", () => {
    expect(v.window(f.term, f.window, new Date("2026-10-01Z")).state).toBe(
      "NOT_OPEN",
    );
    f.window.closesAt = new Date("2030-01-01Z");
    expect(v.window(f.term, f.window, at).state).toBe("INVALID");
    f.window.closesAt = f.window.opensAt;
    expect(v.window(f.term, f.window, at).state).toBe("INVALID");
  });
  it("OPEN permits the UC18 gate only in the matching term", () => {
    expect(
      v.uc18(
        { state: "OPEN", scope: "TERM", termId: "term", revision: 0 },
        "term",
      ),
    ).toEqual([]);
    expect(
      v.uc18(
        { state: "OPEN", scope: "TERM", termId: "another", revision: 0 },
        "term",
      )[0].code,
    ).toBe("UC18_SCOPE_INVALID");
  });
  it("FINALIZED blocks UC17 without inspecting ELIGIBLE", () => {
    expect(
      v.uc18(
        {
          state: "FINALIZED",
          scope: "TERM",
          termId: "term",
          revision: 1,
          finalizedAt: at.toISOString(),
          finalizedByUserId: "faculty",
        },
        "term",
      )[0].code,
    ).toBe("UC18_FINALIZED");
  });
  it("UNKNOWN and invalid OPEN revision block future writes", () => {
    expect(
      v.uc18(
        {
          state: "UNKNOWN",
          scope: "TERM",
          termId: "term",
          reason: "missing-source",
        },
        "term",
      )[0].code,
    ).toBe("UC18_FINALIZATION_UNKNOWN");
    expect(
      v.uc18(
        { state: "OPEN", scope: "TERM", termId: "term", revision: -1 },
        "term",
      )[0].code,
    ).toBe("UC18_FINALIZATION_UNKNOWN");
  });
});
