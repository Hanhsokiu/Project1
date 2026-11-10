import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ReviewerGradeCommandSchema,
  ReviewerGradeQuerySchema,
} from "@doan/shared";
import {
  createReviewerGradeFixture,
  reviewerActor,
} from "../../../test/reviewer-grade.fixture";
import { ids } from "../../../test/final-defense.fixture";
import { memberId } from "../../../test/eligibility.fixture";
import { ReviewerGradeValidator } from "./reviewer-grade.validator";
let f: Awaited<ReturnType<typeof createReviewerGradeFixture>>;
beforeEach(async () => {
  f = await createReviewerGradeFixture();
});
const fail = (p: Promise<unknown>, status = 409) =>
  expect(p).rejects.toMatchObject({ status });
const list = (actor = reviewerActor) =>
  f.service.list(actor, ReviewerGradeQuerySchema.parse({ termId: ids.term }));
describe("UC22 current assignment, privacy and independent score workflow", () => {
  it("exact rational rubric accepts recurring fractions only when the final total is exactly representable", async () => {
    f.policy.scoreStep = "0.1";
    f.policy.rubric = {
      version: "TEST_ONLY_FRACTIONS",
      calculation: "WEIGHTED_NORMALIZED_10_EXACT",
      criteria: [
        { id: "a", name: "A", maxScore: "3", step: "1", weight: "0.5" },
        { id: "b", name: "B", maxScore: "3", step: "1", weight: "0.5" },
      ],
    };
    const b = {
      ...(await f.body()),
      totalScore: "5",
      criterionScores: { a: "1", b: "2" },
    };
    await f.service.command(reviewerActor, memberId, b, "exact", "save");
    await fail(
      f.service.command(
        reviewerActor,
        memberId,
        {
          ...b,
          expectedRevision: 1,
          totalScore: "3.3",
          criterionScores: { a: "1", b: "1" },
        },
        "rounded",
        "save",
      ),
      400,
    );
  });
  it("new PDF submission invalidates a finalized grade without deleting or transferring it", async () => {
    await f.command("finalize");
    const old = f.state.scores[0].reportVersionId;
    const { syntheticFile } =
      await import("../../../test/final-defense.fixture");
    await f.f.service.upload(
      ids.student,
      ids.proposal,
      f.f.state.report!.revision,
      syntheticFile(),
      "new-pdf",
    );
    expect((await f.detail()).state).toBe("STALE");
    expect(f.state.scores[0].reportVersionId).toBe(old);
    expect(f.state.events).toHaveLength(1);
    await fail(
      f.service.effectiveInSession(
        f.session,
        reviewerActor,
        ids.term,
        memberId,
        "l4",
        1,
      ),
    );
  });
  it("does not read UC21 schema when schedule is not required", async () => {
    const spy = vi.spyOn(f.session, "scReady");
    f.sc.control.schema = false;
    expect((await f.detail()).blockers).toEqual([]);
    await f.command();
    expect(spy).not.toHaveBeenCalled();
  });
  it("filters scoped rows before paging and preserves the authorized total", async () => {
    await f.command();
    const q = ReviewerGradeQuerySchema.parse({
      termId: ids.term,
      search: "SYNTHETIC",
      state: "DRAFT",
      page: 2,
      limit: 1,
    });
    const result = await f.service.list(reviewerActor, q);
    expect(result.total).toBe(1);
    expect(result.items).toEqual([]);
    expect(
      (
        await f.service.list(reviewerActor, {
          ...q,
          page: 1,
          search: "outside",
        })
      ).total,
    ).toBe(0);
  });
  it("reports policy/schema precision incompatibility clearly", async () => {
    f.policy.scoreStep = "0.01";
    expect((await f.detail()).blockers).toContain(
      "SCORE_PRECISION_UNSUPPORTED",
    );
    await fail(f.command());
  });
  it("deadline is checked against the configured phase at command time", async () => {
    const b = await f.body(),
      t = (await f.session.windowTerm(ids.term))!;
    vi.spyOn(f.session, "windowTerm").mockResolvedValue({
      ...t,
      phases: t.phases.map((p) =>
        p.code === "FINAL" ? { ...p, endDate: new Date("2020-01-01") } : p,
      ),
    });
    await fail(
      f.service.command(reviewerActor, memberId, b, "expired", "save"),
    );
  });
  it("publication alone does not stale a grade when UC22 does not require publication", async () => {
    const id = (await f.sc.save()).sessions[0].id;
    await f.sc.transition(id, "finalize");
    f.policy.schedule.required = true;
    await f.command("finalize");
    await f.sc.transition(id, "publish");
    expect((await f.detail()).state).toBe("FINALIZED");
    expect(
      (
        await f.service.effectiveInSession(
          f.session,
          reviewerActor,
          ids.term,
          memberId,
          "l4",
          1,
        )
      ).effectiveStatus,
    ).toBe("CURRENT");
  });
  it("closing the grading window blocks edits but retains a finalized current grade for downstream", async () => {
    const id = (await f.sc.save()).sessions[0].id;
    await f.sc.transition(id, "finalize");
    f.policy.schedule = {
      required: true,
      requirePublished: false,
      window: { opensMinutesBefore: 0, closesMinutesAfter: 0 },
    };
    const schedule = (await f.detail()).schedule!,
      clock = vi
        .spyOn(Date, "now")
        .mockReturnValue(new Date(schedule.startAt).getTime() + 1000);
    try {
      await f.command("finalize");
      clock.mockReturnValue(new Date(schedule.endAt).getTime() + 1000);
      const v = await f.detail();
      expect(v.blockers).toContain("GRADING_WINDOW_CLOSED");
      expect(v.state).toBe("FINALIZED");
      expect(
        (
          await f.service.effectiveInSession(
            f.session,
            reviewerActor,
            ids.term,
            memberId,
            "l4",
            1,
          )
        ).effectiveStatus,
      ).toBe("CURRENT");
    } finally {
      clock.mockRestore();
    }
  });
  it("official reviewer reads own list/PDF and GET creates nothing", async () => {
    const before = JSON.stringify(f.state);
    expect((await list()).items).toHaveLength(1);
    const v = await f.detail();
    expect(v.state).toBe("NONE");
    expect(v.blockers).toEqual([]);
    expect(
      (
        await f.service.download(
          reviewerActor,
          memberId,
          ids.term,
          v.report!.id,
        )
      ).bytes
        .subarray(0, 5)
        .toString(),
    ).toBe("%PDF-");
    expect(JSON.stringify(f.state)).toBe(before);
  });
  it("draft update and finalize retain audit, report binding and effective downstream", async () => {
    await f.command();
    expect((await f.detail()).state).toBe("DRAFT");
    await fail(
      f.service.effectiveInSession(
        f.session,
        reviewerActor,
        ids.term,
        memberId,
        "l4",
        1,
      ),
    );
    await f.command();
    expect((await f.detail()).revision).toBe(2);
    await f.command("finalize");
    const ef = await f.service.effectiveInSession(
      f.session,
      reviewerActor,
      ids.term,
      memberId,
      "l4",
      3,
    );
    expect(ef.totalScore).toBe("8");
    expect(ef.assignment.lecturerId).toBe("l4");
    expect(ef.locked).toBe(true);
    expect(ef.releaseStatus).toBe("WITHHELD");
    expect((await f.detail()).history).toHaveLength(3);
    await fail(f.command());
  });
  it.each([ids.student, ids.lecturer, ids.admin, ids.outsider])(
    "rejects unassigned/academic bypass %s",
    async (actor) => {
      f.permit(actor, ["read", "save", "finalize", "download"]);
      const b = await f.body();
      await fail(
        f.service.command(actor, memberId, b, "no", "save"),
        actor === ids.admin || actor === ids.student ? 403 : 404,
      );
    },
  );
  it.each(["DRAFT", "LEGACY", "STALE", "UC18", "UC19"])(
    "does not trust raw assignment %s",
    async (kind) => {
      if (kind === "DRAFT") f.rw.state.rows[0].state = "DRAFT";
      if (kind === "LEGACY") f.rw.state.rows[0].revision = 0;
      if (kind === "STALE") f.rw.policy.version = "changed";
      if (kind === "UC18") f.rw.cc.eligibility.policy.version = "changed";
      if (kind === "UC19") f.rw.cc.policy.version = "changed";
      const page = await list();
      expect(page.items).toEqual([]);
      expect(page.blockers).toContain("REVIEWER_NOT_CURRENT");
      await fail(f.detail());
    },
  );
  it("revalidates source in caller transaction, never opens nested UC20 read", async () => {
    const spy = vi.spyOn(f.rw.service, "effectiveInSession"),
      nested = vi.spyOn(f.rw.repo, "read");
    await f.command();
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls.every((c) => c[0] === f.session)).toBe(true);
    expect(nested).not.toHaveBeenCalled();
  });
  it("revoking persisted source reader rights fails closed", async () => {
    f.users.get(ids.faculty)!.userRoles[0].role.rolePermissions = [];
    await fail(f.detail());
  });
  it("stale finalized grades keep history and leave official downstream", async () => {
    await f.command("finalize");
    f.rw.policy.version = "changed";
    const v = await f.detail();
    expect(v.state).toBe("STALE");
    expect(v.score!.totalScore).toBe("8");
    expect(v.permissions.download).toBe(false);
    await fail(
      f.service.effectiveInSession(
        f.session,
        reviewerActor,
        ids.term,
        memberId,
        "l4",
        1,
      ),
    );
    expect(f.state.scores).toHaveLength(1);
  });
  it("two reviewers have independent grades and cannot request another's score", async () => {
    f = await createReviewerGradeFixture(["l4", "l5"]);
    await f.command();
    await f.command("finalize", "reviewer-l5");
    expect(f.state.scores.map((s) => s.scorerId).sort()).toEqual(["l4", "l5"]);
    await fail(f.service.detail(reviewerActor, memberId, ids.term, "l5"), 404);
    expect((await list()).items).toHaveLength(1);
  });
  it("faculty grants and separate score/comment permissions redact content", async () => {
    await f.command("finalize");
    let v = await f.detail(ids.faculty, "l4");
    expect(v.score).toBeNull();
    expect(v.feedback).toBeNull();
    expect(v.history).toEqual([]);
    f.permit(ids.faculty, ["score-read"]);
    v = await f.detail(ids.faculty, "l4");
    expect(v.score!.totalScore).toBe("8");
    expect(v.feedback).toBeNull();
    f.permit(ids.faculty, ["comment-read"]);
    expect((await f.detail(ids.faculty, "l4")).feedback!.comment).toContain(
      "TEST_ONLY",
    );
    f.f.control.facultyDepartment = "other";
    await fail(f.detail(ids.faculty, "l4"), 404);
  });
  it("does not expose grades to a student even with grading permissions", async () => {
    await f.command();
    f.permit(ids.student, ["read", "score-read", "comment-read"]);
    await fail(list(ids.student), 403);
  });
  it("does not overwrite advisor grade or create results/committee/weekly scores", async () => {
    const before = JSON.stringify(f.f.state.score);
    await f.command("finalize");
    expect(JSON.stringify(f.f.state.score)).toBe(before);
    expect(f.state.scores.every((s) => s.role === "REVIEWER")).toBe(true);
    expect(Object.keys(f.state).sort()).toEqual([
      "events",
      "replays",
      "scores",
    ]);
  });
  it.each(["missing", "not-ready", "checksum", "unreadable", "kind", "owner"])(
    "blocks invalid PDF %s",
    async (kind) => {
      const b = await f.body();
      if (kind === "missing") f.f.state.report!.versions = [];
      if (kind === "not-ready")
        f.f.state.report!.versions[0].fileAsset.state = "QUARANTINED";
      if (kind === "checksum") f.control.corrupt = true;
      if (kind === "unreadable") f.control.storageFailure = true;
      if (kind === "kind")
        f.f.state.report!.versions[0].fileAsset.kind = "SOURCE";
      if (kind === "owner")
        f.rw.cc.eligibility.control.ownerStudent = "another";
      await fail(
        f.service.command(reviewerActor, memberId, b, "bad-pdf", "finalize"),
        kind === "owner" ? 404 : 409,
      );
    },
  );
  it("rejects PDF version/checksum changed since form opened", async () => {
    const b = await f.body();
    b.reportVersionId = "old-version";
    await fail(f.service.command(reviewerActor, memberId, b, "old", "save"));
    b.reportVersionId = (await f.body()).reportVersionId;
    b.reportChecksum = "f".repeat(64);
    await fail(f.service.command(reviewerActor, memberId, b, "old2", "save"));
  });
  it("rejects wrong term/member, expected assignment revision and hashes", async () => {
    const b = await f.body();
    await fail(
      f.service.command(reviewerActor, "missing", b, "a", "save"),
      404,
    );
    await fail(
      f.service.command(
        reviewerActor,
        memberId,
        { ...b, termId: "other" },
        "b",
        "save",
      ),
      404,
    );
    for (const patch of [
      { assignmentId: "other" },
      { assignmentRevision: 999 },
      { assignmentEvidenceHash: "f".repeat(64) },
      { policyHash: "e".repeat(64) },
      { rubricHash: "d".repeat(64) },
    ])
      await fail(
        f.service.command(
          reviewerActor,
          memberId,
          { ...b, ...patch },
          "binding",
          "save",
        ),
      );
  });
  it.each(["11", "-1", "8.1", "8.25"])(
    "rejects invalid/range/step/precision %s",
    async (totalScore) => {
      const b = { ...(await f.body()), totalScore };
      if (totalScore === "-1")
        expect(ReviewerGradeCommandSchema.safeParse(b).success).toBe(false);
      else
        await expect(
          f.service.command(reviewerActor, memberId, b, "bad", "save"),
        ).rejects.toMatchObject({ status: 400 });
    },
  );
  it("requires feedback/score on finalize, permits incomplete draft and draft-disabled policy", async () => {
    const b = { ...(await f.body()), comment: "", totalScore: null };
    await f.service.command(reviewerActor, memberId, b, "draft", "save");
    await fail(
      f.service.command(
        reviewerActor,
        memberId,
        { ...b, expectedRevision: 1 },
        "final",
        "finalize",
      ),
      400,
    );
    f.policy.draftAllowed = false;
    await fail(f.command());
  });
  it("validates rubric exact totals, all criteria, unknown criteria and source metadata", async () => {
    f.policy.rubric = {
      version: "TEST_ONLY_RUBRIC",
      calculation: "WEIGHTED_NORMALIZED_10_EXACT",
      criteria: [
        {
          id: "r1",
          name: "TEST_ONLY",
          maxScore: "10",
          weight: "1",
          step: "0.5",
        },
      ],
    };
    const b = { ...(await f.body()), criterionScores: { r1: "8" } };
    await f.service.command(reviewerActor, memberId, b, "rubric", "save");
    await fail(
      f.service.command(
        reviewerActor,
        memberId,
        { ...b, expectedRevision: 1, criterionScores: {} },
        "missing",
        "finalize",
      ),
      400,
    );
    await fail(
      f.service.command(
        reviewerActor,
        memberId,
        { ...b, expectedRevision: 1, totalScore: "9" },
        "total",
        "finalize",
      ),
      400,
    );
    await fail(
      f.service.command(
        reviewerActor,
        memberId,
        { ...b, expectedRevision: 1, criterionScores: { r1: "8", bad: "1" } },
        "unknown",
        "save",
      ),
      400,
    );
    f.control.rubricMismatch = true;
    await fail(f.command());
  });
  it("rejects unsupported precision/weight policies without defaults", async () => {
    const v = new ReviewerGradeValidator();
    expect(
      v.policy(JSON.stringify({ ...f.policy, scoreStep: "0.01" })),
    ).toBeNull();
    f.policy.rubric = {
      version: "TEST_ONLY",
      calculation: "WEIGHTED_NORMALIZED_10_EXACT",
      criteria: [
        { id: "r", name: "T", weight: "0.9", maxScore: "10", step: "1" },
      ],
    };
    expect(v.policy(JSON.stringify(f.policy))).toBeNull();
  });
  it("policy/rubric change marks previous grade stale and blocks silent rebind", async () => {
    await f.command();
    f.policy.version = "different";
    expect((await f.detail()).state).toBe("STALE");
    await fail(f.command());
  });
  it("schedule optional is not a blocker, required missing fails closed", async () => {
    expect((await f.detail()).schedule).toBeNull();
    f.policy.schedule.required = true;
    expect((await f.detail()).blockers).toContain(
      "UC21_CURRENT_SCHEDULE_REQUIRED",
    );
    await fail(f.command());
  });
  it("uses finalized current UC21 schedule in same session when required", async () => {
    const created = await f.sc.save(),
      id = created.sessions[0].id;
    await f.sc.transition(id, "finalize");
    f.policy.schedule.required = true;
    const spy = vi.spyOn(f.sc.service, "effectiveInSession");
    const v = await f.detail();
    expect(v.schedule?.id).toBe(id);
    expect(v.blockers).toEqual([]);
    await f.command();
    expect(spy.mock.calls.every((c) => c[0] === f.session)).toBe(true);
  });
  it("UC21 publication/window requirements are explicit", async () => {
    const id = (await f.sc.save()).sessions[0].id;
    await f.sc.transition(id, "finalize");
    f.policy.schedule = {
      required: true,
      requirePublished: true,
      window: null,
    };
    expect((await f.detail()).blockers).toContain("UC21_PUBLISHED_REQUIRED");
    f.policy.schedule.requirePublished = false;
    f.policy.schedule.window = { opensMinutesBefore: 0, closesMinutesAfter: 0 };
    expect((await f.detail()).blockers).toContain("GRADING_WINDOW_CLOSED");
  });
  it.each(["locked", "phase", "flag", "policy", "schema"])(
    "write gate %s fails closed",
    async (gate) => {
      const b = await f.body();
      if (gate === "locked") f.f.control.locked = true;
      if (gate === "phase") f.f.term.status = "COMPLETED";
      if (gate === "flag") f.control.writes = false;
      if (gate === "policy") f.control.approved = false;
      if (gate === "schema") f.control.schema = false;
      await fail(
        f.service.command(reviewerActor, memberId, b, "gated", "save"),
      );
      expect(f.state.scores).toHaveLength(0);
    },
  );
  it("idempotency replays once, different body conflicts and concurrent revision has one winner", async () => {
    const b = await f.body(),
      result = await f.service.command(
        reviewerActor,
        memberId,
        b,
        "key",
        "save",
      );
    expect(
      await f.service.command(reviewerActor, memberId, b, "key", "save"),
    ).toEqual(result);
    await fail(
      f.service.command(
        reviewerActor,
        memberId,
        { ...b, comment: "different" },
        "key",
        "save",
      ),
    );
    const next = await f.body(),
      out = await Promise.allSettled([
        f.service.command(reviewerActor, memberId, next, "one", "save"),
        f.service.command(reviewerActor, memberId, next, "two", "save"),
      ]);
    expect(out.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(f.state.events).toHaveLength(2);
  });
  it.each(["auditFailure", "rememberFailure"] as const)(
    "rolls back score/details/audit/key on %s",
    async (gate) => {
      f.control[gate] = true;
      await expect(f.command()).rejects.toThrow();
      expect(f.state.scores).toEqual([]);
      expect(f.state.events).toEqual([]);
      expect(f.state.replays.size).toBe(0);
    },
  );
  it("legacy unverified score is preserved and cannot be adopted", async () => {
    await f.command();
    f.state.scores[0].context = null;
    expect((await f.detail()).state).toBe("LEGACY_UNVERIFIED");
    await fail(f.command());
    expect(f.state.scores).toHaveLength(1);
  });
});
