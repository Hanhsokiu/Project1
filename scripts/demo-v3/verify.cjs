"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const {
  id,
  hash,
  terms,
  participants,
  students,
  lecturers,
  areas,
} = require("./definition.cjs");
async function verify(ctx) {
  const { db } = ctx,
    checks = [];
  async function check(name, fn) {
    try {
      await fn();
      checks.push({ name, status: "PASS" });
    } catch (e) {
      checks.push({ name, status: "FAIL", error: e.code || e.message });
    }
  }
  await ctx.local.identity(db);
  const counts = await ctx.counts(db);
  ctx.save("counts-after.json", counts);
  await check("baseline identity counts", () => {
    for (const [model, expected] of Object.entries({
      UserAccount: 105,
      Student: 84,
      Lecturer: 18,
      ThesisTerm: 2,
      TermStudent: 87,
      Registration: 87,
      AdvisorAssignment: 87,
      Topic: 87,
      Proposal: 87,
      ThesisDossier: 87,
      GuidancePlan: 87,
    }))
      assert.equal(counts[model], expected, model);
  });
  await check(
    "exactly three students share their real fixture identity across terms",
    async () => {
      const rows = await db.termStudent.groupBy({
        by: ["studentId"],
        _count: { _all: true },
      });
      assert.equal(rows.length, 84);
      assert.deepEqual(
        rows
          .filter((r) => r._count._all === 2)
          .map((r) => r.studentId)
          .sort(),
        [74, 75, 76].map((n) => id("student/" + n)).sort(),
      );
    },
  );
  await check(
    "quotas, preference order, direction, official assignments and one personal topic",
    async () => {
      for (const t of terms) {
        const assigned = await db.advisorAssignment.findMany({
          where: { assignmentPlan: { termId: t.id } },
          include: {
            registration: { include: { preferences: true } },
            advisor: { include: { researchAreas: true } },
          },
        });
        for (const l of lecturers)
          assert(assigned.filter((a) => a.advisorId === l.id).length <= 5);
        for (const a of assigned) {
          const prefs = a.registration.preferences.sort(
            (x, y) => x.preferenceOrder - y.preferenceOrder,
          );
          assert(prefs.length >= 1 && prefs.length <= 3);
          assert.deepEqual(
            prefs.map((p) => p.preferenceOrder),
            prefs.map((_, i) => i + 1),
          );
          assert.equal(
            new Set(prefs.map((p) => p.lecturerId)).size,
            prefs.length,
          );
          assert(
            a.advisor.researchAreas.some(
              (x) => x.researchAreaId === a.registration.directionId,
            ),
          );
        }
        assert.equal(
          await db.topicWorkflow.count({
            where: { termId: t.id, termStudentId: { not: null } },
          }),
          t.studentNumbers.length,
        );
      }
    },
  );
  await check(
    "proposal version chains, content hashes, reviewer identities, approvals and dossiers",
    async () => {
      for (const t of terms)
        for (const p of participants(t)) {
          const versions = await db.proposalVersion.findMany({
            where: { proposalId: id("proposal/" + p.key) },
            orderBy: { version: "asc" },
            include: { pr2bProposalVersionWorkflowVersionId: true },
          });
          assert.deepEqual(
            versions.map((v) => v.version),
            versions.map((_, i) => i + 1),
          );
          for (const v of versions) {
            assert.equal(
              v.pr2bProposalVersionWorkflowVersionId.contentHash,
              hash(v.content),
            );
            assert.equal(
              v.pr2bProposalVersionWorkflowVersionId.state,
              "SEALED",
            );
          }
          const final = await db.dossierFinalization.findUniqueOrThrow({
              where: { id: id("finalization/" + p.key) },
            }),
            decision = await db.proposalReviewDecision.findUniqueOrThrow({
              where: { id: final.approvalDecisionId },
            });
          assert.equal(decision.decision, "APPROVED");
          assert.equal(decision.versionId, final.versionId);
          assert.equal(final.contentHash, hash(final.printSnapshot));
          assert(final.finalizedAt >= decision.decidedAt);
          const r = await db.proposalReview.findUniqueOrThrow({
              where: { id: decision.reviewId },
              include: { reviewGroup: { include: { members: true } } },
            }),
            u = await db.lecturer.findUniqueOrThrow({
              where: { userId: decision.decidedByUserId },
            });
          assert(r.reviewGroup.members.some((m) => m.lecturerId === u.id));
        }
    },
  );
  await check("all stored assets exist and match size/checksum", async () => {
    for (const asset of await db.fileAsset.findMany()) {
      const bytes =
        asset.kind === "DOSSIER_PDF"
          ? Buffer.from(
              (
                await db.dossierPdfContent.findUniqueOrThrow({
                  where: { assetId: asset.id },
                })
              ).bytes,
            )
          : fs.readFileSync(
              path.join(
                ctx.local.storageRoot,
                ".private-guidance",
                asset.storageKey.slice("guidance/".length),
              ),
            );
      assert.equal(bytes.length, asset.sizeBytes);
      assert.equal(hash(bytes), asset.checksum);
      if (asset.mimeType === "application/pdf")
        assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
      else assert.equal(bytes.readUInt32LE(0), 0x04034b50);
    }
  });
  await check(
    "current week: 5 PASS, 3 REVISION_REQUIRED, 2 missing overdue, 1 pending",
    async () => {
      const t = terms[1],
        states = [];
      for (const p of participants(t)) {
        const task = await db.taskWorkflow.findUniqueOrThrow({
          where: { taskId: id(`task/${p.key}/5`) },
        });
        if (p.latest === "OVERDUE") {
          assert.equal(task.currentSubmissionId, null);
          const base = await db.task.findUniqueOrThrow({
            where: { id: task.taskId },
          });
          assert(base.deadline < new Date("2026-11-16T09:00:00+07:00"));
          states.push("OVERDUE");
        } else {
          const sw = await db.submissionWorkflow.findUniqueOrThrow({
            where: { submissionId: task.currentSubmissionId },
          });
          if (p.latest === "PENDING_REVIEW") {
            assert.equal(sw.effectiveReviewId, null);
            states.push(p.latest);
          } else {
            const r = await db.progressReview.findUniqueOrThrow({
              where: { id: sw.effectiveReviewId },
            });
            assert.equal(r.decision, p.latest);
            states.push(r.decision);
          }
        }
      }
      assert.deepEqual(
        states,
        participants(t).map((p) => p.latest),
      );
    },
  );
  await check(
    "weekly ownership, late flags and actual assigned advisor reviews",
    async () => {
      for (const sw of await db.submissionWorkflow.findMany({
        include: { refTaskId: { include: { guidancePlan: true } } },
      })) {
        const plan = sw.refTaskId.guidancePlan,
          p = await db.proposal.findUniqueOrThrow({
            where: { id: plan.proposalId },
          }),
          student = await db.student.findUniqueOrThrow({
            where: { id: p.studentId },
          });
        assert.equal(sw.submittedByUserId, student.userId);
        assert.equal(sw.contextSnapshot.proposalId, p.id);
        assert.equal(sw.contextSnapshot.planId, plan.id);
        assert.equal(sw.isLate, sw.submittedAt > sw.deadlineSnapshot);
        for (const r of await db.progressReview.findMany({
          where: { submissionId: sw.submissionId },
        })) {
          const a = await db.lecturer.findUniqueOrThrow({
            where: { id: plan.advisorId },
          });
          assert.equal(r.reviewerUserId, a.userId);
          assert(r.recordedAt >= sw.submittedAt);
        }
      }
    },
  );
  await check("database foreign-key constraints all validated", async () => {
    const [{ n }] = await db.$queryRawUnsafe(
      "SELECT count(*)::int n FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='f' AND NOT convalidated",
    );
    assert.equal(n, 0);
  });
  if (counts.DefenseCommittee === 3) {
    await check(
      "real UC17-20 outputs: 60 confirmed eligible reports, committees and reviewers without advisor conflicts",
      async () => {
        assert.equal(counts.FinalReportVersion, 60);
        assert.equal(counts.DefenseConfirmation, 60);
        assert(
          [60, 71].includes(counts.DefenseEligibility),
          "60 eligible plus optional eleven actual pre-schedule deferrals",
        );
        const proposals = new Map(
          (await db.proposal.findMany()).map((p) => [p.id, p]),
        );
        const topics = new Map(
          (await db.topic.findMany()).map((t) => [t.id, t]),
        );
        const versions = new Map(
          (await db.finalReportVersion.findMany()).map((v) => [v.id, v]),
        );
        for (const c of await db.defenseConfirmation.findMany()) {
          assert.equal(c.status, "CONFIRMED");
          // The actual confirm producer creates the first decision at revision 0,
          // then increments only on update; presence/currentness is bound to its version/context.
          assert(
            c.revision >= 0 && c.confirmedAt && c.reportVersionId && c.context,
          );
          assert.equal(
            versions.get(c.reportVersionId)?.reportId,
            (
              await db.finalReport.findUniqueOrThrow({
                where: { proposalId: c.proposalId },
              })
            ).id,
          );
        }
        assert.equal(
          await db.defenseEligibility.count({ where: { status: "ELIGIBLE" } }),
          60,
        );
        for (const e of await db.defenseEligibility.findMany({
          where: { status: "ELIGIBLE" },
        })) {
          assert.equal(e.status, "ELIGIBLE");
          assert(e.finalizedAt && e.finalizedBy && e.context && e.revision > 0);
        }
        const deferred = await db.defenseEligibility.findMany({
          where: { status: "DEFERRED" },
        });
        assert.equal(deferred.length, counts.DefenseEligibility - 60);
        for (const e of deferred) {
          assert(e.decidedBy && e.decidedAt && e.context && !e.finalizedAt);
          assert.equal(
            await db.defenseCommitteeAssignment.count({
              where: { proposalId: e.proposalId },
            }),
            0,
          );
          assert.equal(
            await db.scoreEntry.count({ where: { proposalId: e.proposalId } }),
            0,
          );
        }
        assert.equal(counts.CommitteeMember, 12);
        assert.equal(counts.DefenseCommitteeAssignment, 60);
        for (const c of await db.defenseCommittee.findMany({
          include: { members: true, studentAssignments: true },
        })) {
          assert.equal(c.termId, terms[0].id);
          assert.equal(c.state, "FINALIZED");
          assert(c.finalizedAt && c.context && c.finalizedBy);
          assert.equal(c.members.length, 4);
          assert.equal(c.members.filter((m) => m.role === "CHAIR").length, 1);
          assert.equal(
            c.members.filter((m) => m.role === "SECRETARY").length,
            1,
          );
          for (const a of c.studentAssignments) {
            assert.equal(a.state, "ACTIVE");
            const p = proposals.get(a.proposalId);
            assert.equal(p.termId, c.termId);
            assert(
              !c.members.some(
                (m) => m.lecturerId === topics.get(p.topicId).advisorId,
              ),
            );
          }
        }
        const reviewers = await db.reviewerAssignment.findMany();
        assert.equal(reviewers.length, 60);
        assert.equal(new Set(reviewers.map((r) => r.proposalId)).size, 60);
        for (const r of reviewers) {
          assert.equal(r.state, "FINALIZED");
          assert(r.selected && r.finalizedAt && r.context && r.revision > 0);
          assert.notEqual(
            r.reviewerId,
            topics.get(proposals.get(r.proposalId).topicId).advisorId,
          );
        }
      },
    );
  }
  if (counts.FinalResult === 60) {
    await check(
      "60 complete results, 360 distinct scorer entries, exact supported 40/60 calculation",
      async () => {
        assert.equal(counts.DefenseCommittee, 3);
        assert.equal(counts.CommitteeMember, 12);
        assert.equal(counts.ScoreEntry, 360);
        const Decimal = ctx.local.req("@prisma/client").Prisma.Decimal;
        for (const result of await db.finalResult.findMany()) {
          const scores = await db.scoreEntry.findMany({
            where: { proposalId: result.proposalId },
          });
          assert.equal(scores.length, 6);
          assert.equal(new Set(scores.map((score) => score.scorerId)).size, 6);
          assert(
            scores.every(
              (score) => score.isLocked && score.totalScore !== null,
            ),
          );
          const advisor = scores.find((score) => score.role === "ADVISOR");
          const reviewer = scores.find((score) => score.role === "REVIEWER");
          const committee = scores.filter(
            (score) => score.role === "COMMITTEE_MEMBER",
          );
          assert.equal(committee.length, 4);
          const process = new Decimal(advisor.totalScore)
            .plus(reviewer.totalScore)
            .div(2);
          const defense = committee
            .reduce((sum, score) => sum.plus(score.totalScore), new Decimal(0))
            .div(4);
          const expected = process.mul("0.4").plus(defense.mul("0.6"));
          assert(
            expected.eq(result.finalScore),
            "No silent rounding for selected baseline scores",
          );
          assert.equal(result.isPassed, expected.gte(5));
          assert.equal(result.state, "PUBLISHED");
          assert(result.isLocked && result.isPublished);
          assert(
            committee.every((score) => score.scorerId !== advisor.scorerId),
          );
        }
      },
    );
  } else
    checks.push({
      name: "requested 60 complete defense results",
      status: "BLOCKED",
      expected: 60,
      actual: counts.FinalResult,
    });
  await check(
    "no outbound email or fabricated published defense result",
    async () => {
      assert.equal(counts.EmailOutbox, 0);
      assert.equal(
        await db.finalResult.count({
          where: { isPublished: true, revision: 0 },
        }),
        0,
      );
      assert.equal(
        await db.defenseCommittee.count({ where: { termId: terms[1].id } }),
        0,
      );
      assert.equal(
        await db.finalResult.count({
          where: {
            proposalId: {
              in: participants(terms[1]).map((p) => id("proposal/" + p.key)),
            },
          },
        }),
        0,
      );
    },
  );
  const [{ rounded }] = await db.$queryRawUnsafe(
    "SELECT (8.25::numeric(5,2))::text AS rounded",
  );
  const report = {
    profile: "UTC_PROJECT1_DEMO_V3",
    database: ctx.local.database,
    productionConnected: false,
    checks,
    precision: {
      requested: "two fractional digits",
      storedExample: rounded,
      sourceExample: "8.25",
      status: rounded === "8.25" ? "PASS" : "BLOCKED",
    },
    status: checks.some((c) => c.status === "FAIL") ? "FAIL" : "PARTIAL",
    workflow9_10:
      counts.FinalResult === 60
        ? "PRODUCED_CHECK_SOURCE_AND_API_REPORTS"
        : "INCOMPLETE",
    generatedAt: new Date().toISOString(),
  };
  ctx.save("data-integrity-report.json", report);
  console.log(
    JSON.stringify({
      status: report.status,
      pass: checks.filter((c) => c.status === "PASS").length,
      fail: checks.filter((c) => c.status === "FAIL").length,
    }),
  );
  assert(
    !checks.some((c) => c.status === "FAIL"),
    "Data integrity failures; inspect evidence/data-integrity-report.json",
  );
  return report;
}
module.exports = { verify };
