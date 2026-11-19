import { beforeEach, describe, expect, it } from "vitest";
import {
  createFinalDefenseFixture,
  ids,
  syntheticFile,
  syntheticPolicy,
} from "../../../test/final-defense.fixture";
import {
  AdvisorConfirmationSchema,
  FinalDefensePolicySchema,
  FinalDefenseQuerySchema,
} from "@doan/shared";
import { FinalDefenseValidator } from "./final-defense.validator";

let f: ReturnType<typeof createFinalDefenseFixture>;
beforeEach(() => {
  f = createFinalDefenseFixture();
});
const fail = (code: string) => ({ response: { error: { code } } });
async function upload(revision = 0, key = "pdf-1") {
  await f.service.upload(
    ids.student,
    ids.proposal,
    revision,
    syntheticFile(),
    key,
  );
  return f.state.report!.versions[0].id;
}
async function summary(
  reportVersionId: string,
  expectedRevision = 1,
  score = 8,
  key = "review-1",
) {
  return f.service.summarize(
    ids.lecturer,
    ids.proposal,
    {
      expectedRevision,
      reportVersionId,
      score,
      comment: "Nhận xét synthetic",
      criterionScores: {},
    },
    key,
  );
}
async function confirm(reportVersionId: string, expectedRevision = 2) {
  return f.service.confirm(
    ids.lecturer,
    ids.proposal,
    { expectedRevision, reportVersionId, status: "CONFIRMED" },
    "decide-1",
  );
}
describe("UC17 integrated guidance workflow with synthetic transaction/storage adapters", () => {
  it("shows scoped UC14–UC16 progress without turning unfinished tasks into an automatic rejection", async () => {
    f.users.get(ids.lecturer)!.userRoles[0].role.rolePermissions.push({
      permission: { resource: "guidance", action: "read" },
    } as never);
    f.session.progressEvidence = async () => ({
      advisorId: "official-advisor",
      pr2bGuidancePlanWorkflowPlanId: {
        assignmentId: "assignment",
        assignmentRevision: 0,
        state: "ACTIVE",
      },
      tasks: [
        {
          deadline: new Date(0),
          pr2bTaskWorkflowTaskId: {
            state: "COMPLETED",
            refCurrentSubmissionId: null,
          },
        },
        {
          deadline: new Date(0),
          pr2bTaskWorkflowTaskId: {
            state: "TODO",
            refCurrentSubmissionId: null,
          },
        },
      ],
    });
    const version = await upload();
    await summary(version);
    await confirm(version);
    const detail = await f.service.detail(ids.lecturer, ids.proposal);
    expect(detail.progress).toMatchObject({
      currentAssignment: true,
      activeTasks: 2,
      completed: 1,
      overdue: 1,
    });
    expect(detail.status).toBe("CONFIRMED");
    const student = await f.service.detail(ids.student, ids.proposal);
    expect(student.progress).toBeNull();
    expect(student.progressBlocker).toBe("GUIDANCE_READ_PERMISSION_REQUIRED");
  });
  it("returns per-action blockers and does not enable review before a final PDF exists", async () => {
    const advisor = await f.service.detail(ids.lecturer, ids.proposal);
    expect(advisor.permissions.review).toBe(false);
    expect(advisor.actionBlockers.review).toContain("FINAL_PDF_REQUIRED");
    expect(advisor.actionBlockers.decide).toContain("ADVISOR_SUMMARY_REQUIRED");
    f.control.writes = false;
    const student = await f.service.detail(ids.student, ids.proposal);
    expect(student.actionBlockers.upload).toContain("UC17_NOT_ENABLED");
    expect(student.actionBlockers.decide).not.toContain(
      "ADVISOR_SUMMARY_REQUIRED",
    );
  });
  it("preserves rubric scores for the authorized advisor to reload", async () => {
    f.policy.rubric = [
      { key: "work", label: "Synthetic", maxScore: 10, weight: 1 },
    ];
    const version = await upload();
    await f.service.summarize(
      ids.lecturer,
      ids.proposal,
      {
        expectedRevision: 1,
        reportVersionId: version,
        score: 8,
        comment: "Synthetic rubric",
        criterionScores: { work: 8 },
      },
      "rubric-review",
    );
    expect(
      (await f.service.detail(ids.lecturer, ids.proposal)).summary
        ?.criterionScores,
    ).toEqual({ work: 8 });
    expect(
      (await f.service.detail(ids.student, ids.proposal)).summary,
    ).toBeNull();
  });
  it("GET does not create a report, decision, score, audit or idempotency row", async () => {
    const v = await f.service.detail(ids.student, ids.proposal);
    expect(v.versions).toEqual([]);
    expect(v.summary).toBeNull();
    expect(f.state.report).toBeNull();
    expect(f.state.events).toHaveLength(0);
    expect(f.state.replay.size).toBe(0);
  });
  it("keeps baseline reads usable and writes explicit when migration is absent", async () => {
    f.control.schemaReady = false;
    const v = await f.service.detail(ids.student, ids.proposal);
    expect(v.blockers).toContain("UC17_SCHEMA_REQUIRED");
    expect(v.permissions.upload).toBe(false);
    await expect(upload()).rejects.toMatchObject(fail("UC17_SCHEMA_REQUIRED"));
    expect(f.bytes.size).toBe(0);
  });
  it("defaults to blocked writes until approval and rejects missing policy", async () => {
    f.control.writes = false;
    await expect(upload()).rejects.toMatchObject(fail("UC17_NOT_ENABLED"));
    f.control.writes = true;
    f.control.approved = false;
    await expect(upload()).rejects.toMatchObject(fail("UC17_POLICY_REQUIRED"));
    expect(f.state.report).toBeNull();
  });
  it("rejects a student from another proposal and an unrelated advisor", async () => {
    f.users.get(ids.student)!.student!.id = "other-student";
    await expect(
      f.service.detail(ids.student, ids.proposal),
    ).rejects.toMatchObject(fail("COMMON_001"));
    await expect(
      f.service.detail(ids.outsider, ids.proposal),
    ).rejects.toMatchObject(fail("COMMON_001"));
  });
  it("does not promote ADMIN to an academic actor", async () => {
    await expect(
      f.service.detail(ids.admin, ids.proposal),
    ).rejects.toMatchObject(fail("COMMON_001"));
    await expect(
      f.service.list(ids.admin, { termId: ids.term, page: 1, limit: 20 }),
    ).rejects.toMatchObject(fail("AUTH_004"));
  });
  it("requires a matching term/student/topic owner and current official assignment plan", async () => {
    f.p.topic.pr2bTopicWorkflowTopicId!.refTermStudentId!.termId = "wrong-term";
    await expect(upload()).rejects.toMatchObject(fail("INPUT_NOT_READY"));
    f.p.topic.pr2bTopicWorkflowTopicId!.refTermStudentId!.termId = ids.term;
    f.term.pr2bTermWorkflowTermId.officialAssignmentPlanId = "obsolete-plan";
    await expect(upload()).rejects.toMatchObject(fail("INPUT_NOT_READY"));
  });
  it("checks faculty department grants and never returns out-of-term totals", async () => {
    f.control.facultyDepartment = "wrong-department";
    await expect(
      f.service.detail(ids.faculty, ids.proposal),
    ).rejects.toMatchObject(fail("COMMON_001"));
    expect(
      (
        await f.service.list(ids.faculty, {
          termId: ids.term,
          page: 1,
          limit: 20,
        })
      ).total,
    ).toBe(0);
    expect(
      (
        await f.service.list(ids.lecturer, {
          termId: ids.faculty,
          page: 1,
          limit: 20,
        })
      ).total,
    ).toBe(0);
  });
  it("uses the FINAL time window and respects a locked term", async () => {
    f.control.locked = true;
    await expect(upload()).rejects.toMatchObject(fail("TERM_003"));
    f.control.locked = false;
    f.term.phases[0].endDate = new Date(0);
    await expect(upload()).rejects.toMatchObject(fail("TERM_003"));
  });
  it("persists PDF → advisor summary → independent confirmation and reloads the same data", async () => {
    const version = await upload();
    await summary(version);
    await confirm(version);
    const v = await f.service.detail(ids.lecturer, ids.proposal);
    expect(v.status).toBe("CONFIRMED");
    expect(v.revision).toBe(3);
    expect(v.summary).toMatchObject({
      score: 8,
      comment: "Nhận xét synthetic",
      current: true,
    });
    expect(v.versions[0].id).toBe(version);
    expect(v.history).toHaveLength(4);
    expect(
      (await f.service.download(ids.lecturer, ids.proposal, version)).bytes,
    ).toEqual(syntheticFile().buffer);
  });
  it("hides score, comments, rejection reasons and audit from students and faculty independently", async () => {
    const version = await upload();
    await summary(version);
    await f.service.confirm(
      ids.lecturer,
      ids.proposal,
      {
        expectedRevision: 2,
        reportVersionId: version,
        status: "REJECTED",
        reason: "Lý do riêng",
      },
      "reject-1",
    );
    for (const id of [ids.student, ids.faculty]) {
      const v = await f.service.detail(id, ids.proposal);
      expect(v.status).toBe("REJECTED");
      expect(v.summary).toBeNull();
      expect(v.decision).not.toHaveProperty("reason");
      expect(v.history).toEqual([]);
    }
    f.users.get(ids.student)!.userRoles[0].role.rolePermissions.push({
      permission: {
        resource: "defense-confirmation",
        action: "comment-read",
      },
    } as never);
    const partial = await f.service.detail(ids.student, ids.proposal);
    expect(partial.summary?.comment).toBe("Nhận xét synthetic");
    expect(partial.summary).not.toHaveProperty("score");
    expect(partial.decision).not.toHaveProperty("reason");
  });
  it("cannot submit review or decision as a student even with a valid proposal id", async () => {
    const version = await upload();
    await expect(
      f.service.summarize(
        ids.student,
        ids.proposal,
        {
          expectedRevision: 1,
          reportVersionId: version,
          score: 8,
          comment: "X",
          criterionScores: {},
        },
        "student-review",
      ),
    ).rejects.toMatchObject(fail("AUTH_004"));
  });
  it("validates score step and requires summary without inventing a passing-score threshold", async () => {
    const version = await upload();
    await expect(confirm(version, 1)).rejects.toMatchObject(
      fail("ADVISOR_SUMMARY_REQUIRED"),
    );
    await expect(summary(version, 1, 7.3)).rejects.toMatchObject(
      fail("SCORE_INVALID"),
    );
    await summary(version, 1, 0);
    await confirm(version);
    expect(f.state.decision?.status).toBe("CONFIRMED");
  });
  it("requires rejection reasons and rejects injected actors/status fields", () => {
    expect(
      AdvisorConfirmationSchema.safeParse({
        expectedRevision: 0,
        reportVersionId: ids.proposal,
        status: "REJECTED",
        reason: " ",
      }).success,
    ).toBe(false);
    expect(
      AdvisorConfirmationSchema.safeParse({
        expectedRevision: 0,
        reportVersionId: ids.proposal,
        status: "CONFIRMED",
        advisorId: ids.outsider,
      }).success,
    ).toBe(false);
  });
  it("replays exactly once and rejects payload changes under the same idempotency key", async () => {
    const version = await upload();
    expect(await summary(version)).toEqual({ revision: 2 });
    const events = f.state.events.length;
    expect(await summary(version)).toEqual({ revision: 2 });
    expect(f.state.events).toHaveLength(events);
    expect(f.state.report?.revision).toBe(2);
    await expect(summary(version, 1, 9)).rejects.toMatchObject(
      fail("IDEMPOTENCY_CONFLICT"),
    );
    await f.service.upload(
      ids.student,
      ids.proposal,
      0,
      syntheticFile(),
      "pdf-1",
    );
    expect(f.bytes.size).toBe(1);
  });
  it("detects concurrent stale writes and rolls back score changes if audit fails", async () => {
    const version = await upload();
    const outcomes = await Promise.allSettled([
      summary(version, 1, 8, "review-a"),
      summary(version, 1, 9, "review-b"),
    ]);
    expect(outcomes.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    f.control.eventFailure = true;
    await expect(summary(version, 2, 9, "review-c")).rejects.toThrow(
      "Synthetic audit failure",
    );
    expect(f.state.report?.revision).toBe(2);
    expect(Number(f.state.score?.totalScore)).toBe(8);
  });
  it("retains old PDF versions and invalidates a previous decision after an approved replacement", async () => {
    const v1 = await upload();
    await summary(v1);
    await confirm(v1);
    const v2 = await upload(3, "pdf-2");
    const detail = await f.service.detail(ids.lecturer, ids.proposal);
    expect(v2).not.toBe(v1);
    expect(detail.versions.map((v) => v.sequence)).toEqual([2, 1]);
    expect(detail.summary?.current).toBe(false);
    expect(detail.permissions.decide).toBe(false);
    expect(detail.status).toBe("STALE");
    expect(
      (await f.service.download(ids.student, ids.proposal, v1)).bytes,
    ).toEqual(syntheticFile().buffer);
    await expect(summary(v1, 4, 8, "old-pdf")).rejects.toMatchObject(
      fail("STALE_VERSION"),
    );
  });
  it("blocks PDF replacement if approved policy requires it, and detects policy/topic changes", async () => {
    f.policy.replacementAfterDecision = "BLOCK";
    const version = await upload();
    await summary(version);
    await confirm(version);
    await expect(upload(3, "pdf-blocked")).rejects.toMatchObject(
      fail("REPORT_LOCKED"),
    );
    f.policy.version = "synthetic-only-v2";
    expect((await f.service.detail(ids.student, ids.proposal)).status).toBe(
      "STALE",
    );
    f.p.topic.pr2bTopicWorkflowTopicId!.revision++;
    expect(
      (await f.service.detail(ids.lecturer, ids.proposal)).summary?.current,
    ).toBe(false);
  });
  it("retains durable quarantine ownership when storage fails; retry cannot overwrite bytes", async () => {
    f.control.storageFailure = true;
    await expect(upload()).rejects.toThrow("Synthetic storage failure");
    expect(f.state.assets.size).toBe(1);
    expect([...f.state.assets.values()][0].state).toBe("QUARANTINED");
    expect(f.state.report?.versions).toEqual([]);
    f.control.storageFailure = false;
    await expect(upload()).rejects.toMatchObject(fail("UPLOAD_PENDING"));
    expect(f.bytes.size).toBe(0);
  });
  it("rejects non-PDF, unsafe names, weekly/unknown asset ids, foreign downloads and checksum tampering", async () => {
    await expect(
      f.service.upload(
        ids.student,
        ids.proposal,
        0,
        { ...syntheticFile(), originalname: "../weekly.pdf" },
        "unsafe",
      ),
    ).rejects.toMatchObject(fail("FILE_NAME_INVALID"));
    await expect(
      f.service.upload(
        ids.student,
        ids.proposal,
        0,
        { ...syntheticFile(), mimetype: "text/plain" },
        "wrong-mime",
      ),
    ).rejects.toMatchObject(fail("FILE_TYPE_INVALID"));
    const version = await upload();
    await expect(
      f.service.download(ids.outsider, ids.proposal, version),
    ).rejects.toMatchObject(fail("COMMON_001"));
    await expect(
      f.service.download(ids.student, ids.proposal, ids.outsider),
    ).rejects.toMatchObject(fail("COMMON_001"));
    const storageKey = f.state.report!.versions[0].fileAsset.storageKey;
    f.bytes.set(storageKey, Buffer.from("tampered"));
    await expect(
      f.service.download(ids.student, ids.proposal, version),
    ).rejects.toMatchObject(fail("FILE_INTEGRITY_FAILED"));
  });
});
describe("versioned score configuration", () => {
  it("accepts imported B1–B8 VARCHAR ids as well as UUID ids", () => {
    expect(
      FinalDefenseQuerySchema.parse({ termId: "term-imported-2026" }).termId,
    ).toBe("term-imported-2026");
  });
  it("requires an approved policy and rejects precision unsupported by the existing score table", () => {
    const v = new FinalDefenseValidator();
    expect(v.policy(null)).toBeNull();
    expect(
      v.policy(JSON.stringify({ ...syntheticPolicy, scoreStep: 0.01 })),
    ).toBeNull();
    expect(
      FinalDefensePolicySchema.safeParse({
        ...syntheticPolicy,
        rubric: [{ key: "x", label: "X", maxScore: 10, weight: 0.4 }],
      }).success,
    ).toBe(false);
  });
  it("checks every rubric criterion and exact weighted score without implicit rounding", () => {
    const v = new FinalDefenseValidator(),
      policy = {
        ...syntheticPolicy,
        rubric: [{ key: "work", label: "Work", maxScore: 10, weight: 1 }],
      };
    const body = {
      expectedRevision: 0,
      reportVersionId: ids.proposal,
      score: 8,
      comment: "Synthetic",
      criterionScores: { work: 8 },
    };
    expect(() => v.summary(body, policy)).not.toThrow();
    expect(() => v.summary({ ...body, score: 9 }, policy)).toThrow();
    expect(() => v.summary({ ...body, criterionScores: {} }, policy)).toThrow();
  });
});
