"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const {
    id,
    date,
    terms,
    participants,
    lecturers,
    hash,
  } = require("./definition.cjs"),
  assets = require("./assets.cjs");
async function seedDefense(ctx) {
  await require("./policies.cjs").seedPolicies(ctx);
  const r = await require("./runtime.cjs").runtime(),
    t = terms[0],
    people = participants(t).slice(0, 60),
    faculty = id("user/faculty/1"),
    statePath = path.join(
      ctx.local.cache,
      ctx.local.database + "-defense-actions.json",
    );
  const actions = fs.existsSync(statePath)
    ? JSON.parse(fs.readFileSync(statePath, "utf8"))
    : {};
  const save = () =>
    fs.writeFileSync(statePath, JSON.stringify(actions, null, 2) + "\n");
  async function action(key, fn) {
    if (actions[key]?.done) return actions[key].result;
    console.log("Producer " + key);
    const result = await fn(id("producer-action/" + key));
    actions[key] = { done: true, result };
    save();
    return result;
  }
  const tokens = {};
  async function request(actor, method, route, body, key) {
    const user = await r.db.userAccount.findUniqueOrThrow({
      where: { id: actor },
    });
    if (!tokens[actor]) {
      const response = await fetch(r.api + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user.username,
          password: ctx.cfg.accountPassword,
        }),
      });
      const json = await response.json();
      assert(response.ok, "Fixture login failed");
      tokens[actor] = (json.data ?? json).accessToken;
    }
    const response = await fetch(r.api + route, {
      method,
      headers: {
        Authorization: "Bearer " + tokens[actor],
        "Content-Type": "application/json",
        "Idempotency-Key":
          key || id("request/" + route + "/" + hash(body || {})),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(120000),
    });
    const result = await response.json();
    if (!response.ok)
      throw Error(
        `${method} ${route} ${response.status}: ${JSON.stringify(result.error || result)}`,
      );
    return result.data ?? result;
  }
  const get = (actor, route) => request(actor, "GET", route),
    post = (actor, route, body, key) =>
      request(actor, "POST", route, body, key);
  const advance = (value) => {
    r.clock(date(value).toISOString());
    for (const actor of Object.keys(tokens)) delete tokens[actor];
  };
  try {
    advance("2026-06-24");
    const fd = r.service(
      "guidance/final-defense/final-defense.service",
      "FinalDefenseService",
    );
    for (const p of people)
      await action("final-report/" + p.key, async (key) => {
        const proposal = id("proposal/" + p.key);
        let v = await fd.detail(p.student.userId, proposal);
        if (!v.versions.length) {
          const bytes = await assets.pdf(
            `Synthetic final thesis of DEMO-SV${p.student.n}. Implementation, evaluation and source evidence are synthetic test data.`,
            date("2026-06-24"),
          );
          v = await fd.upload(
            p.student.userId,
            proposal,
            v.revision,
            {
              buffer: bytes,
              size: bytes.length,
              originalname: `DEMO-final-${p.student.n}.pdf`,
              mimetype: "application/pdf",
              fieldname: "file",
              encoding: "7bit",
            },
            key,
          );
        }
        v = await fd.detail(p.advisor.userId, proposal);
        const reportVersionId = v.versions.at(-1).id;
        if (!v.summary)
          await fd.summarize(
            p.advisor.userId,
            proposal,
            {
              expectedRevision: v.revision,
              reportVersionId,
              comment:
                "[DEMO] Hoàn thành quá trình hướng dẫn; nhận xét tổng hợp từ dữ liệu thử nghiệm.",
              score: 8,
              criterionScores: {},
            },
            id("advisor-summary/" + p.key),
          );
        v = await fd.detail(p.advisor.userId, proposal);
        await fd.confirm(
          p.advisor.userId,
          proposal,
          {
            expectedRevision: v.revision,
            reportVersionId,
            status: "CONFIRMED",
          },
          id("advisor-confirm/" + p.key),
        );
        return { reportVersionId };
      });
    advance("2026-06-25");
    const elig = r.service(
      "defense/eligibility/eligibility.service",
      "EligibilityService",
    );
    for (const p of people)
      await action("eligibility/" + p.key, async (key) => {
        const member = id("member/" + p.key);
        let v = await elig.detail(faculty, member, t.id);
        v = await elig.reviewDossier(
          faculty,
          member,
          {
            termId: t.id,
            expectedRevision: v.revision,
            evidenceHash: v.evidenceHash,
            reason: "[DEMO] Xét hồ sơ dữ liệu tổng hợp",
            academic: {
              source: "TEST_ACADEMIC_ELIGIBILITY",
              reference:
                "SYNTHETIC DEMO ONLY; not an official academic attestation",
              outcome: "PASS",
              effectiveFrom: date(t.start).toISOString(),
              validUntil: date(t.end).toISOString(),
            },
          },
          key,
        );
        v = await elig.detail(faculty, member, t.id);
        await elig.decide(
          faculty,
          member,
          {
            termId: t.id,
            expectedRevision: v.revision,
            evidenceHash: v.evidenceHash,
            reason: "[DEMO] Đủ điều kiện từ chuỗi minh chứng TEST",
            status: "ELIGIBLE",
          },
          id("eligibility-decision/" + p.key),
        );
        return { termStudentId: member };
      });
    for (let batch = 0; batch < people.length; batch += 3)
      await action("eligibility/finalize/" + batch, async (key) => {
        const members = [];
        for (const p of people.slice(batch, batch + 3)) {
          const v = await elig.detail(faculty, id("member/" + p.key), t.id);
          members.push({
            termStudentId: v.termStudentId,
            expectedRevision: v.revision,
            evidenceHash: v.evidenceHash,
          });
        }
        return elig.finalize(
          faculty,
          {
            termId: t.id,
            reason: "[DEMO] Chốt danh sách đủ điều kiện từ API TEST",
            members,
          },
          key,
        );
      });
    // These eleven cases are independent of scheduling. Record an actual UC18
    // deferral decision, without claiming approval of the separate deferment request.
    const termBeforeDeferrals = await r.db.thesisTerm.findUniqueOrThrow({
      where: { id: t.id },
    });
    const deferrals = participants(t).slice(60, 71);
    const remainingDeferrals = deferrals.filter(
      (p) => !actions["eligibility/deferred/" + p.key]?.done,
    );
    if (
      termBeforeDeferrals.status !== "IN_PROGRESS" &&
      remainingDeferrals.length
    ) {
      ctx.save("deferral-blocker.json", {
        status: "BLOCKED",
        code: "ELIGIBILITY_BLOCKED",
        database: ctx.local.database,
        termStatus: termBeforeDeferrals.status,
        affected: remainingDeferrals.length,
        reason:
          "The preserved baseline already advanced to DEFENDING before this producer step was added. The actual service rejects reviewing this earlier phase. Never rewind term state or fabricate approval.",
      });
    }
    for (const p of termBeforeDeferrals.status === "IN_PROGRESS"
      ? deferrals
      : [])
      await action("eligibility/deferred/" + p.key, async (key) => {
        const member = id("member/" + p.key);
        let v = await elig.detail(faculty, member, t.id);
        await elig.reviewDossier(
          faculty,
          member,
          {
            termId: t.id,
            expectedRevision: v.revision,
            evidenceHash: v.evidenceHash,
            reason:
              "[DEMO] Rà soát hồ sơ chưa đủ minh chứng; không tạo chứng nhận đủ điều kiện giả.",
          },
          key,
        );
        v = await elig.detail(faculty, member, t.id);
        await elig.decide(
          faculty,
          member,
          {
            termId: t.id,
            expectedRevision: v.revision,
            evidenceHash: v.evidenceHash,
            status: "DEFERRED",
            reason:
              "[DEMO] Hoãn xét bảo vệ trước xếp lịch do chưa hoàn tất minh chứng. Không phải phê duyệt bảo lưu học vụ.",
          },
          id("eligibility-deferred-decision/" + p.key),
        );
        return { termStudentId: member, status: "DEFERRED" };
      });
    advance("2026-07-01");
    await action("term/defending", () =>
      r
        .service("term/service/term-lifecycle.service", "TermLifecycleService")
        .transition(t.id, "DEFENDING", faculty),
    );
    for (let g = 0; g < 3; g++)
      await action("committee/create/" + g, async (key) => {
        const w = await get(
          faculty,
          `/defense-committees/workspace?termId=${t.id}`,
        );
        return post(
          faculty,
          "/defense-committees",
          {
            termId: t.id,
            expectedRevision: 0,
            rosterHash: w.rosterHash,
            reason: "[DEMO] Thành lập hội đồng từ roster TEST",
            code: `DEMO-HD${g + 1}`,
            name: `Hội đồng bảo vệ mô phỏng ${g + 1}`,
            departmentId: id("department"),
            members: Array.from({ length: 4 }, (_, j) => ({
              lecturerId: lecturers[g * 4 + j].id,
              role: j === 0 ? "CHAIR" : j === 1 ? "SECRETARY" : "MEMBER",
            })),
          },
          key,
        );
      });
    await action("committee/allocate", async (key) => {
      const a = await get(
        faculty,
        `/defense-committees/allocation?termId=${t.id}`,
      );
      assert.equal(a.status, "FEASIBLE", JSON.stringify(a.reasons));
      return post(
        faculty,
        "/defense-committees/assignments",
        {
          termId: t.id,
          reason: "[DEMO] Phân hội đồng, loại xung đột GVHD",
          rosterHash: a.rosterHash,
          committees: a.committees,
          placements: a.placements,
        },
        key,
      );
    });
    for (let g = 0; g < 3; g++)
      await action("committee/finalize/" + g, async (key) => {
        const w = await get(
            faculty,
            `/defense-committees/workspace?termId=${t.id}`,
          ),
          c = w.committees.find((c) => c.code === `DEMO-HD${g + 1}`);
        return post(
          faculty,
          `/defense-committees/${c.id}/finalize`,
          {
            termId: t.id,
            expectedRevision: c.revision,
            rosterHash: w.rosterHash,
            reason: "[DEMO] Chốt hội đồng TEST đúng phạm vi",
          },
          key,
        );
      });
    await action("reviewers/allocate", async (key) => {
      const w = await get(
          faculty,
          `/defense-reviewers/workspace?termId=${t.id}`,
        ),
        placements = w.students
          .filter((s) => people.some((p) => id("member/" + p.key) === s.id))
          .map((s, i) => {
            const p = people.find((p) => id("member/" + p.key) === s.id);
            let n = 12 + (i % 6);
            if (lecturers[n].id === p.advisor.id) n = 12 + ((i + 1) % 6);
            return { ...s.binding, reviewerIds: [lecturers[n].id] };
          });
      return post(
        faculty,
        "/defense-reviewers/assignments",
        {
          termId: t.id,
          rosterHash: w.rosterHash,
          reason: "[DEMO] Phân GVPB khác GVHD và thành viên HĐ",
          placements,
        },
        key,
      );
    });
    await action("reviewers/finalize", async (key) => {
      const w = await get(
        faculty,
        `/defense-reviewers/workspace?termId=${t.id}`,
      );
      return post(
        faculty,
        "/defense-reviewers/finalize",
        {
          termId: t.id,
          rosterHash: w.rosterHash,
          reason: "[DEMO] Chốt GVPB TEST",
          members: w.students
            .filter((s) => people.some((p) => id("member/" + p.key) === s.id))
            .map((s) => s.binding),
        },
        key,
      );
    });
    await action("schedule/assign", async (key) => {
      const p = await get(
        faculty,
        `/defense-schedules/proposal?termId=${t.id}`,
      );
      assert.equal(p.status, "FEASIBLE", JSON.stringify(p.reasons));
      return post(
        faculty,
        "/defense-schedules/assignments",
        {
          termId: t.id,
          rosterHash: p.rosterHash,
          reason: "[DEMO] Lập lịch theo phòng, ca và xung đột giảng viên",
          sessions: p.sessions.map((body) => ({ id: null, body })),
        },
        key,
      );
    });
    for (const command of ["finalize", "publish"])
      await action("schedule/" + command, async (key) => {
        const w = await get(
          faculty,
          `/defense-schedules/workspace?termId=${t.id}`,
        );
        return post(
          faculty,
          "/defense-schedules/" + command,
          {
            termId: t.id,
            rosterHash: w.rosterHash,
            reason: "[DEMO] " + command + " lịch TEST",
            members: w.schedules.map((s) => ({
              id: s.id,
              expectedRevision: s.revision,
              evidenceHash: s.evidenceHash,
            })),
          },
          key,
        );
      });
    // The real producer enforces schedule windows; each student is scored at their own slot.
    const schedule = await get(
      faculty,
      `/defense-schedules/workspace?termId=${t.id}`,
    );
    ctx.save("defense-schedule.json", schedule);
    for (const p of people) {
      const assignment =
          await r.db.defenseCommitteeAssignment.findUniqueOrThrow({
            where: { termStudentId: id("member/" + p.key) },
          }),
        committeeId = assignment.committeeId,
        reviewer = await r.db.reviewerAssignment.findFirstOrThrow({
          where: { proposalId: id("proposal/" + p.key), selected: true },
        }),
        reviewerUser = (
          await r.db.lecturer.findUniqueOrThrow({
            where: { id: reviewer.reviewerId },
          })
        ).userId;
      const slot = schedule.schedules
        .flatMap((s) => s.slots || [])
        .find((s) => s.termStudentId === id("member/" + p.key));
      assert(slot, "Actual schedule slot required");
      advance(slot.startAt);
      await action("reviewer-grade/" + p.key, async (key) => {
        const member = id("member/" + p.key),
          v = await get(
            reviewerUser,
            `/defense-reviewer-grades/${member}?termId=${t.id}`,
          );
        return post(
          reviewerUser,
          `/defense-reviewer-grades/${member}/finalize`,
          {
            termId: t.id,
            expectedRevision: v.revision,
            assignmentId: v.assignment.assignmentId,
            assignmentRevision: v.assignment.revision,
            assignmentEvidenceHash: v.assignment.evidenceHash,
            reportVersionId: v.report.id,
            reportChecksum: v.report.checksum,
            policyHash: v.policyHash,
            rubricHash: v.rubricHash,
            scheduleHash: v.schedule.hash,
            totalScore: "8",
            criterionScores: Object.fromEntries(
              v.policy.rubric.criteria.map((c, i) => [
                c.id,
                ["1.6", "2.4", "0.8", "1.6", "1.6"][i],
              ]),
            ),
            comment: "[DEMO] Báo cáo và sản phẩm đáp ứng yêu cầu",
            strengths: "Có phân tích và minh chứng kiểm thử",
            weaknesses: "Cần mở rộng đánh giá hiệu năng",
            questions:
              "Vì sao chọn kiến trúc này?\nLàm thế nào kiểm tra tính đúng đắn?",
          },
          key,
        );
      });
      const members = await r.db.committeeMember.findMany({
          where: { committeeId },
          include: { lecturer: true },
        }),
        score = p.index < 3 ? 2 : 6 + (p.index % 4);
      for (const member of members)
        await action(
          `committee-grade/${p.key}/${member.lecturerId}`,
          async (key) => {
            const student = id("member/" + p.key),
              actor = member.lecturer.userId,
              v = await get(
                actor,
                `/defense-committee-grades/${student}?termId=${t.id}&committeeId=${committeeId}`,
              );
            return post(
              actor,
              `/defense-committee-grades/${student}/finalize`,
              {
                termId: t.id,
                committeeId,
                expectedRevision: v.revision,
                committeeRevision: v.committeeRevision,
                committeeEvidenceHash: v.committeeEvidenceHash,
                assignmentRevision: v.assignmentRevision,
                membershipHash: v.membershipHash,
                reportVersionId: v.report.id,
                reportChecksum: v.report.checksum,
                policyHash: v.policyHash,
                rubricHash: v.rubricHash,
                scheduleHash: v.schedule.hash,
                criterionScores: v.policy.rubric.criteria.map((c) => ({
                  criterionId: c.id,
                  score: (((score + (member.role === "CHAIR" ? 1 : 0)) * Number(c.maxScore)) / 10).toFixed(1),
                })),
                comment: "[DEMO] Phiếu chấm độc lập của " + member.role,
              },
              key,
            );
          },
        );
      const resultCommand = async (actor, actionName, key) => {
        const member = id("member/" + p.key),
          v = await get(actor, `/defense-results/${member}?termId=${t.id}`);
        return post(
          actor,
          `/defense-results/${member}/${actionName}`,
          {
            termId: t.id,
            expectedRevision: v.revision,
            policyHash: v.policyHash,
            evidenceHash: v.evidenceHash,
            reason: "[DEMO] " + actionName + " kết quả TEST",
          },
          key,
        );
      };
      for (const role of ["CHAIR", "SECRETARY"])
        await action(`result-confirm/${p.key}/${role}`, (key) =>
          resultCommand(
            members.find((m) => m.role === role).lecturer.userId,
            "confirm",
            key,
          ),
        );
      for (const command of ["finalize", "publish"])
        await action(`result-${command}/${p.key}`, (key) =>
          resultCommand(faculty, command, key),
        );
    }
    advance("2026-07-15");
    const templates = await get(
      faculty,
      `/defense-reports/templates?termId=${t.id}`,
    );
    for (const code of [
      "XLSX_TERM_RESULTS",
      "XLSX_COMMITTEE_RESULTS",
      "PDF_RESULTS",
      "PDF_MINUTES",
      "PDF_DOSSIER",
    ])
      await action("export/" + code, async (key) => {
        const committeeId = (
            await r.db.defenseCommittee.findFirstOrThrow({
              where: { termId: t.id },
            })
          ).id,
          filters = {
            termId: t.id,
            ...(code.startsWith("PDF_")
              ? { termStudentId: id("member/" + people[0].key) }
              : {}),
            ...(["XLSX_COMMITTEE_RESULTS", "PDF_MINUTES"].includes(code)
              ? { committeeId }
              : {}),
          },
          body = {
            filters,
            templateCode: code,
            templateVersion: templates.templates.find((t) => t.code === code)
              .version,
            mode: "OFFICIAL",
          },
          preview = await post(
            faculty,
            "/defense-reports/exports/preview",
            body,
          );
        assert.equal(
          preview.blockers.length,
          0,
          JSON.stringify(preview.blockers),
        );
        return post(
          faculty,
          "/defense-reports/exports",
          { ...body, expectedSnapshotHash: preview.snapshotHash },
          key,
        );
      });
    ctx.save("defense-producer-result.json", {
      status: "PASS_FOR_SUPPORTED_ONE_DECIMAL_POLICY",
      completedStudents: 60,
      policySynthetic: true,
      officialFacultyApproval: false,
      actionCount: Object.keys(actions).length,
      precisionTwoDigits: "BLOCKED",
      deferredHistory: "BLOCKED_NOT_FABRICATED",
    });
  } finally {
    r.clock(null);
    await r.app.close();
  }
}
module.exports = { seedDefense };
