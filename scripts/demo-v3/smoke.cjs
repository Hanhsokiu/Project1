"use strict";
const assert = require("node:assert/strict"),
  path = require("node:path"),
  fs = require("node:fs");
const { id, terms, participants, students, hash } = require("./definition.cjs");
async function smoke(ctx) {
  const r = await require("./runtime.cjs").runtime(),
    checks = [],
    tokens = {};
  async function token(actor) {
    if (tokens[actor]) return tokens[actor];
    const user = await r.db.userAccount.findUniqueOrThrow({
        where: { id: actor },
      }),
      response = await fetch(r.api + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user.username,
          password: ctx.cfg.accountPassword,
        }),
      }),
      data = await response.json();
    assert(response.ok, "Actual TEST authentication failed");
    return (tokens[actor] = (data.data ?? data).accessToken);
  }
  async function run(
    testId,
    uc,
    actor,
    method,
    route,
    statuses = [200],
    body,
    validate,
  ) {
    try {
      const response = await fetch(r.api + route, {
        method,
        headers: {
          ...(actor ? { Authorization: "Bearer " + (await token(actor)) } : {}),
          "Content-Type": "application/json",
          "Idempotency-Key": id("smoke/" + testId),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(90000),
      });
      assert(
        statuses.includes(response.status),
        `Expected ${statuses}, got ${response.status}`,
      );
      let data;
      if ((response.headers.get("content-type") || "").includes("json")) {
        const payload = await response.json();
        data = payload.data ?? payload;
      } else data = Buffer.from(await response.arrayBuffer());
      if (validate) await validate(data);
      checks.push({
        testId,
        uc,
        method,
        route,
        status: response.status,
        result: "PASS",
        kind: statuses.every((s) => s < 400) ? "positive" : "negative",
      });
    } catch (e) {
      checks.push({
        testId,
        uc,
        method,
        route,
        result: "FAIL",
        error: e.message,
      });
    }
  }
  try {
    const p = participants(terms[1])[0],
      other = students[0],
      student = p.student.userId,
      faculty = id("user/faculty/1"),
      admin = id("user/admin"),
      advisor = p.advisor.userId,
      proposal = id("proposal/" + p.key),
      task = id(`task/${p.key}/5`),
      sub = id(`submission/${p.key}/5/1`),
      term = terms[1].id;
    const before = await r.db.registration.findUnique({
      where: { id: id("registration/" + p.key) },
    });
    await run("UC01-P", "UC01", student, "GET", "/auth/me");
    await run("UC01-N", "UC01", null, "GET", "/auth/me", [401]);
    await run("UC02-P", "UC02", admin, "GET", "/accounts");
    await run("UC02-N", "UC02", student, "GET", "/accounts", [403]);
    await run("UC03-P", "UC03", admin, "GET", "/audit-logs");
    await run("UC03-N", "UC03", student, "GET", "/audit-logs", [403]);
    for (const [uc, route] of [
      ["UC04", "/students"],
      ["UC05", "/lecturers"],
      ["UC06", "/research-areas"],
    ]) {
      await run(uc + "-P", uc, faculty, "GET", route);
      await run(uc + "-N", uc, null, "GET", route, [401]);
    }
    await run("UC07-P", "UC07", faculty, "GET", "/terms/" + term);
    await run("UC07-N", "UC07", student, "POST", "/terms", [403], {});
    await run("UC08-P", "UC08", faculty, "GET", "/terms/" + term);
    await run(
      "UC08-N",
      "UC08",
      student,
      "PUT",
      "/terms/" + term + "/phases",
      [403],
      {},
    );
    await run(
      "UC09-P",
      "UC09",
      student,
      "GET",
      `/registrations/term/${term}/me`,
      [200],
      undefined,
      (v) => assert.equal(v.registration.status, "SUBMITTED"),
    );
    await run(
      "UC09-N",
      "UC09",
      student,
      "POST",
      `/registrations/term/${term}/me/submit`,
      [409, 422],
      {
        directionId: before.directionId,
        preferences: [{ lecturerId: p.advisor.id, preferenceOrder: 1 }],
        note: "Negative TEST: closed registration must reject",
      },
    );
    assert.deepEqual(
      await r.db.registration.findUnique({ where: { id: before.id } }),
      before,
      "Rejected registration must not mutate DB",
    );
    await run(
      "UC10-P",
      "UC10",
      student,
      "GET",
      `/assignments/term/${term}/results`,
    );
    await run(
      "UC10-N",
      "UC10",
      student,
      "POST",
      `/assignments/term/${term}/preview`,
      [403],
      { mode: "all", confirmed: true, revision: 1 },
    );
    for (const [uc, route] of [
      ["UC11", `/proposals/${proposal}/editing-context`],
      ["UC12", `/proposals/${proposal}/versions`],
      ["UC13", `/proposals/${proposal}/dossier`],
      ["UC14", `/proposals/${proposal}/guidance-plan`],
      ["UC15", `/task-submissions/${sub}`],
      ["UC16", `/task-submissions/${sub}/review-context`],
    ]) {
      const actor = uc === "UC16" ? advisor : student;
      await run(uc + "-P", uc, actor, "GET", route);
      await run(uc + "-N", uc, other.userId, "GET", route, [403, 404]);
    }
    await run(
      "PDF-DOSSIER",
      "UC13",
      student,
      "GET",
      `/proposals/${proposal}/dossier.pdf`,
      [200],
      undefined,
      (bytes) => assert.equal(bytes.subarray(0, 5).toString(), "%PDF-"),
    );
    const asset = await r.db.submissionAsset.findFirstOrThrow({
      where: { submissionId: sub },
      include: { refFileId: true },
    });
    await run(
      "FILE-REPORT",
      "UC15",
      student,
      "GET",
      `/task-submissions/${sub}/files/${asset.fileId}/download`,
      [200],
      undefined,
      (bytes) => assert.equal(hash(bytes), asset.refFileId.checksum),
    );
    await run(
      "FILE-IDOR",
      "UC15",
      other.userId,
      "GET",
      `/task-submissions/${sub}/files/${asset.fileId}/download`,
      [403, 404],
    );
    const old = terms[0],
      member = id("member/march/1"),
      oldStudent = students[0].userId;
    for (const [uc, route] of [
      ["UC17", `/proposals/${id("proposal/march/1")}/final-report`],
      ["UC18", `/defense-eligibility/${member}?termId=${old.id}`],
      ["UC19", `/defense-committees/workspace?termId=${old.id}`],
      ["UC20", `/defense-reviewers/workspace?termId=${old.id}`],
      ["UC21", `/defense-schedules/workspace?termId=${old.id}`],
      ["UC22", `/defense-reviewer-grades/options`],
      ["UC23", `/defense-committee-grades/options`],
      ["UC24", `/defense-results/${member}?termId=${old.id}`],
      ["UC25", `/defense-reports/statistics?termId=${old.id}`],
    ]) {
      const actor = uc === "UC24" ? oldStudent : faculty;
      await run(uc + "-P", uc, actor, "GET", route);
      await run(uc + "-N", uc, null, "GET", route, [401]);
    }
    ctx.save("api-smoke.json", {
      database: ctx.local.database,
      realPostgreSQL: true,
      fixtureFrontend: false,
      checks,
      status: checks.some((c) => c.result === "FAIL") ? "FAIL" : "PASS",
      limits:
        "Read/ownership/closed-state smoke; does not replace full mutation and scenario tests.",
    });
    console.log(
      JSON.stringify({
        checks: checks.length,
        pass: checks.filter((c) => c.result === "PASS").length,
        fail: checks.filter((c) => c.result === "FAIL").length,
      }),
    );
    assert(
      !checks.some((c) => c.result === "FAIL"),
      "API smoke contains failed cases; inspect api-smoke.json",
    );
  } finally {
    await r.app.close();
  }
}
module.exports = { smoke };
