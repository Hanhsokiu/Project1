import { beforeEach, describe, expect, it } from "vitest";
import { gradingFixture } from "./grading.test-fixtures";
import { hashJson } from "./grading.policy";
import { Prisma } from "@prisma/client";
describe("Grading source chain and evidence, no legacy promotion", () => {
  let f: Awaited<ReturnType<typeof gradingFixture>>;
  beforeEach(async () => {
    f = await gradingFixture();
    await f.configure();
  });
  it("inbox uses the sealed UC20 assignment and committee relation, not lecturer role", async () => {
    expect(
      (await f.service.inbox("reviewer-user", "term", "REVIEWER")).items.map(
        (x) => x.proposalId,
      ),
    ).toEqual(["proposal"]);
    expect(
      (await f.service.inbox("stranger-user", "term", "REVIEWER")).items,
    ).toEqual([]);
    expect(
      (await f.service.inbox("chair-user", "term", "COMMITTEE")).items,
    ).toHaveLength(1);
  });
  it.each([
    "unknown-uc18",
    "open-uc18",
    "uc20-draft",
    "pointer",
    "hash",
    "schedule-pointer",
  ])("rejects %s", async (fault) => {
    if (fault === "unknown-uc18")
      f.base.state.list.currentFinalizationId = "missing";
    if (fault === "open-uc18") {
      f.base.state.list.state = "OPEN";
      f.base.state.list.currentFinalizationId = null;
    }
    if (fault === "uc20-draft")
      f.base.state.stages.find((s) => s.stage === "REVIEWERS")!.state = "DRAFT";
    if (fault === "pointer")
      f.base.state.stages.find(
        (s) => s.stage === "REVIEWERS",
      )!.upstreamArtifactId = "other";
    if (fault === "hash")
      f.base.state.artifacts.find((a) => a.stage === "REVIEWERS")!.contentHash =
        "0".repeat(64);
    if (fault === "schedule-pointer")
      f.base.state.stages.find((s) => s.stage === "SCHEDULE")!.revision++;
    await expect(f.context("chair-user", "COMMITTEE")).rejects.toMatchObject({
      status: 409,
    });
  });
  it("bytes and checksum must verify, not only metadata", async () => {
    f.base.storage.readPrivateFinalReport.mockResolvedValue(
      Buffer.from("broken PDF"),
    );
    expect((await f.context()).blockers).toContain("PDF_NOT_VERIFIED");
    await expect(f.save()).rejects.toMatchObject({ status: 409 });
  });
  it("does not read a file asset belonging to a different student", async () => {
    f.base.base.f.f.report.fileAsset!.createdByUserId = "other";
    const before = f.base.storage.readPrivateFinalReport.mock.calls.length;
    expect((await f.context()).canSave).toBe(false);
    expect(f.base.storage.readPrivateFinalReport.mock.calls.length).toBe(
      before,
    );
  });
  it("not-found proposal does not create a draft", async () => {
    f.session.proposal.mockResolvedValue(null as never);
    await expect(f.context()).rejects.toMatchObject({ status: 404 });
    expect(f.state.sheets).toHaveLength(0);
  });
  it("schema-valid, rehashed wrong source is still denied by cross-artifact linkage", async () => {
    const row = f.base.state.artifacts.find((a) => a.stage === "REVIEWERS")!,
      snapshot = structuredClone(row.snapshot) as { source: { id: string } };
    snapshot.source.id = "other-finalization";
    row.snapshot = snapshot;
    row.contentHash = hashJson(snapshot);
    await expect(f.context()).rejects.toMatchObject({ status: 409 });
  });
  it("term-scoped roster removal blocks a current assigned lecturer", async () => {
    f.session.roster.mockResolvedValue(null as never);
    expect((await f.context()).canSave).toBe(false);
  });
  it("scope must match live department, no ADMIN bypass for read-results", async () => {
    f.grant.allDepartments = false;
    f.grant.pr2bGrantDepartmentGrantId = [{ departmentId: "outside" }];
    f.actors.get("faculty-user")!.userRoles[0].role.name = "ADMIN";
    const p = await f.service.preview("faculty-user", "term");
    expect(p.items).toEqual([]);
  });
  it("UNKNOWN advisor grade cannot become verified through a legacy numeric score", async () => {
    f.base.base.f.f.evaluations[0].score = new Prisma.Decimal(10);
    expect(
      (await f.service.preview("faculty-user", "term")).items[0].blockers,
    ).toContain("ADVISOR_GRADE_UNKNOWN_OR_STALE");
  });
  it("a new academic evidence revision or roster change makes command evidence stale", async () => {
    f.base.state.evidence[0].revision++;
    expect((await f.context()).blockers).toContain("ACADEMIC_SOURCE_STALE");
    f.base.base.f.data.members.push({
      ...f.base.base.f.data.members[0],
      id: "extra-member",
      studentId: "extra-student",
    });
    expect((await f.context()).blockers).toContain("UC18_ROSTER_CHANGED");
  });
  it.each(["actor", "snapshot", "pending", "proposal"])(
    "current UC17 %s mismatch blocks grading despite an unchanged revision",
    async (fault) => {
      const d = f.base.base.f.f.decision!;
      if (fault === "actor") d.decidedByUserId = "other";
      if (fault === "snapshot")
        d.decisionContext = {
          schemaVersion: 1,
          assignment: { assignmentId: "other", revision: 0 },
          pdf: null,
        };
      if (fault === "pending") d.status = "PENDING";
      if (fault === "proposal") d.proposalId = "other";
      expect((await f.context()).blockers).toContain("UC17_SOURCE_STALE");
      await expect(f.save()).rejects.toMatchObject({ status: 409 });
    },
  );
});
