/* Real HTTP + PostgreSQL fixtures. No reset, no seed overwrite, no external email. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
for (const l of fs
  .readFileSync(path.resolve(__dirname, "../.env"), "utf8")
  .split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const db = new PrismaClient(),
  base = process.env.TEST_API_URL || "http://127.0.0.1:3010/api",
  password = "StepThree@2026",
  stamp = String(Date.now());
let checks = 0;
async function req(method, url, token, body, expected) {
  const r = await fetch(base + url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const v = await r.json();
  assert.ok(!JSON.stringify(v).includes("passwordHash"));
  if (expected > 0)
    assert.equal(r.status, expected, `${method} ${url}: ${JSON.stringify(v)}`);
  else if (expected !== -1)
    assert.ok(r.ok, `${method} ${url}: ${JSON.stringify(v)}`);
  return { status: r.status, ...v };
}
async function check(name, fn) {
  await fn();
  console.log("PASS " + name);
  checks++;
}
async function login(username) {
  return (await req("POST", "/auth/login", null, { username, password })).data
    .accessToken;
}
async function main() {
  const role = await db.role.findUniqueOrThrow({ where: { name: "FACULTY" } });
  const manager = await db.userAccount.create({
    data: {
      username: `s3_faculty_${stamp}`,
      passwordHash: await bcrypt.hash(password, 4),
      status: "ACTIVE",
      mustChangePassword: false,
      userRoles: { create: { roleId: role.id } },
    },
  });
  const token = await login(manager.username);
  const system = (await req("GET", "/training-systems", token)).data.find(
      (s) => s.code === "CQ",
    ),
    department = (await req("GET", "/departments", token)).data[0];
  const area = (
    await req("POST", "/research-areas", token, {
      name: `Hướng kiểm thử Bước 3 ${stamp}`,
    })
  ).data;
  const lecturers = [];
  for (let i = 0; i < 4; i++) {
    const l = (
      await req("POST", "/lecturers", token, {
        lecturerCode: `S3L${stamp}${i}`,
        fullName: `Giảng viên ${["X", "Y", "Z", "T"][i]}`,
        departmentId: department.id,
        researchAreaIds: [area.id],
        maxStudents: 0,
      })
    ).data;
    await db.userAccount.update({
      where: { id: l.userId },
      data: {
        passwordHash: await bcrypt.hash(password, 4),
        mustChangePassword: false,
        email: `s3_l${stamp}_${i}@example.test`,
        phone: "0912345678",
      },
    });
    lecturers.push(l);
  }
  const students = [];
  for (let i = 0; i < 4; i++) {
    const s = (
      await req("POST", "/students", token, {
        studentCode: `S3S${stamp}${i}`,
        fullName: `Sinh viên ${["A", "B", "C", "N"][i]}`,
        className: "Kiểm thử tiếng Việt",
        cohort: "K63",
        trainingSystemId: system.id,
        gpa: [4, 3.8, 3, 3.2][i],
      })
    ).data;
    await db.userAccount.update({
      where: { id: s.userId },
      data: {
        passwordHash: await bcrypt.hash(password, 4),
        mustChangePassword: false,
        email: `s3_s${stamp}_${i}@example.test`,
        phone: "0912345678",
      },
    });
    students.push(s);
  }
  const time = Date.now();
  const term = await db.thesisTerm.create({
    data: {
      code: `STEP3-${stamp}`,
      name: `Bước 3 kiểm thử ${stamp}`,
      academicYear: "2026-2027",
      semester: 1,
      trainingSystemId: system.id,
      status: "OPEN_REGISTRATION",
      startDate: new Date(time - 86400000),
      endDate: new Date(time + 86400000),
      phases: {
        create: ["REGISTRATION", "ASSIGNMENT", "PROPOSAL"].map((code) => ({
          code,
          phaseName: code,
          startDate: new Date(time - 3600000),
          endDate: new Date(time + 7200000),
        })),
      },
      termStudents: { create: students.map((s) => ({ studentId: s.id })) },
      termLecturers: {
        create: lecturers.map((l, i) => ({
          lecturerId: l.id,
          quota: i < 2 ? 1 : 0,
        })),
      },
    },
  });
  const studentTokens = await Promise.all(
      students.map((s) => login(s.studentCode)),
    ),
    lecturerTokens = await Promise.all(
      lecturers.map((l) => login(l.lecturerCode.toLowerCase())),
    );
  const fixture = {
    termId: term.id,
    directionId: area.id,
    facultyUsername: manager.username,
    studentCodes: students.map((s) => s.studentCode),
    studentIds: students.map((s) => s.id),
    lecturerCodes: lecturers.map((l) => l.lecturerCode.toLowerCase()),
    lecturerIds: lecturers.map((l) => l.id),
  };
  const route = `/assignments/term/${term.id}`;
  const run = async (all = false) => {
    const c = (await req("GET", route + "/plan", token)).data;
    const options = {
      revision: c.plan?.revision ?? 0,
      mode: all ? "all" : "remaining",
      confirmed: all,
    };
    const preview = (await req("POST", route + "/preview", token, options))
      .data;
    return (
      await req("PUT", route + "/draft", token, {
        ...options,
        inputHash: preview.inputHash,
      })
    ).data;
  };
  if (process.argv.includes("--browser-fixture")) {
    await db.termLecturer.updateMany({
      where: { termId: term.id },
      data: { quota: 3 },
    });
    fs.writeFileSync(
      path.resolve(__dirname, "../../.cache/step3-browser-fixture.json"),
      JSON.stringify(fixture, null, 2),
    );
    console.log(
      "Created fresh browser fixture; registrations will be submitted by Chrome.",
    );
    return;
  }
  await check(
    "real Step2 student submissions stored with direction, GPA and ordered preferences",
    async () => {
      for (let i = 0; i < 3; i++) {
        const prefs = [[0], [0, 1], [1]][i];
        await req(
          "POST",
          `/registrations/term/${term.id}/me/submit`,
          studentTokens[i],
          {
            directionId: area.id,
            preferences: prefs.map((n, j) => ({
              lecturerId: lecturers[n].id,
              preferenceOrder: j + 1,
            })),
            note: "Bước 3 dùng đăng ký thật",
          },
        );
      }
      assert.equal(
        await db.registration.count({
          where: { termId: term.id, status: "SUBMITTED" },
        }),
        3,
      );
    },
  );
  await check(
    "registration must close, assignment window and term lock enforce server-side",
    async () => {
      await req("POST", route + "/preview", token, { revision: 0 }, 409);
      await req("PATCH", `/terms/${term.id}/status`, token, {
        status: "CLOSED_REGISTRATION",
      });
      await db.termPhase.update({
        where: { termId_code: { termId: term.id, code: "ASSIGNMENT" } },
        data: { isLocked: true },
      });
      await req("POST", route + "/preview", token, { revision: 0 }, 409);
      await db.termPhase.update({
        where: { termId_code: { termId: term.id, code: "ASSIGNMENT" } },
        data: { isLocked: false },
      });
      await db.thesisTerm.update({
        where: { id: term.id },
        data: { isLocked: true },
      });
      await req("POST", route + "/preview", token, { revision: 0 }, 409);
      await db.thesisTerm.update({
        where: { id: term.id },
        data: { isLocked: false },
      });
    },
  );
  let plan;
  await check(
    "round regression A→X C→Y; B unassigned, missing submission N shown separately",
    async () => {
      plan = await run();
      const assignment = (code) =>
        plan.assignments.find((a) => a.studentId === students[code].id);
      assert.equal(assignment(0).lecturerId, lecturers[0].id);
      assert.equal(assignment(2).lecturerId, lecturers[1].id);
      assert.equal(assignment(1), undefined);
      assert.equal(plan.missingSubmissions[0].studentId, students[3].id);
      await req(
        "POST",
        route + "/publish",
        token,
        { revision: plan.plan.revision },
        422,
      );
    },
  );
  await check(
    "draft rerun does not double count loads, preview creates no plan writes",
    async () => {
      const before = await db.assignmentPlan.count({
        where: { termId: term.id },
      });
      plan = await run(true);
      assert.equal(plan.assignments.length, 2);
      assert.equal(
        await db.assignmentPlan.count({ where: { termId: term.id } }),
        before,
      );
    },
  );
  await check(
    "direct student/lecturer draft access blocked and no cross-user notification API",
    async () => {
      for (const t of [studentTokens[0], lecturerTokens[0]]) {
        await req("GET", route + "/plan", t, undefined, 403);
        await req("GET", route + "/results", t, undefined, 403);
      }
      await req(
        "GET",
        `/notifications/user/${manager.id}`,
        studentTokens[0],
        undefined,
        404,
      );
    },
  );
  await check(
    "remaining-only allocation uses new quota and fills B→Z",
    async () => {
      await db.termLecturer.update({
        where: {
          termId_lecturerId: { termId: term.id, lecturerId: lecturers[2].id },
        },
        data: { quota: 1 },
      });
      plan = await run();
      assert.equal(
        plan.assignments.find((a) => a.studentId === students[1].id).lecturerId,
        lecturers[2].id,
      );
    },
  );
  await check(
    "concurrent manual requests respect quota and optimistic revision; preservation and audit",
    async () => {
      await db.termLecturer.update({
        where: {
          termId_lecturerId: { termId: term.id, lecturerId: lecturers[3].id },
        },
        data: { quota: 1 },
      });
      const results = await Promise.all(
        [0, 2].map((i) =>
          req(
            "PUT",
            route + "/manual",
            token,
            {
              studentId: students[i].id,
              lecturerId: lecturers[3].id,
              reason: "Điều chỉnh để kiểm thử tranh chấp",
              revision: plan.plan.revision,
            },
            -1,
          ),
        ),
      );
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      plan = (await req("GET", route + "/plan", token)).data;
      assert.equal(
        plan.assignments.filter((a) => a.lecturerId === lecturers[3].id).length,
        1,
      );
      const manual = plan.assignments.find((a) => a.manual);
      plan = await run();
      assert.equal(
        plan.assignments.find((a) => a.studentId === manual.studentId).manual,
        true,
      );
      assert.ok(
        await db.auditLog.count({
          where: { resourceId: plan.plan.id, action: "ASSIGNMENT_MANUAL" },
        }),
      );
    },
  );
  await check(
    "manual assignment revalidates quota, activity, specialty, reason and backend permission",
    async () => {
      const input = {
        studentId: students[1].id,
        lecturerId: lecturers[0].id,
        reason: "Lý do đủ độ dài kiểm thử",
        revision: plan.plan.revision,
      };
      await req("PUT", route + "/manual", studentTokens[0], input, 403);
      await req("PUT", route + "/manual", token, { ...input, reason: "" }, 400);
      // Y is either full or was freed by the preceding adjustment. Set only this fixture's T quota to zero.
      await db.termLecturer.update({
        where: {
          termId_lecturerId: { termId: term.id, lecturerId: lecturers[3].id },
        },
        data: { quota: 0 },
      });
      await req(
        "PUT",
        route + "/manual",
        token,
        { ...input, lecturerId: lecturers[3].id },
        422,
      );
      await db.termLecturer.update({
        where: {
          termId_lecturerId: { termId: term.id, lecturerId: lecturers[3].id },
        },
        data: { quota: 1 },
      });
      await db.lecturer.update({
        where: { id: lecturers[3].id },
        data: { isActive: false },
      });
      await req(
        "PUT",
        route + "/manual",
        token,
        { ...input, lecturerId: lecturers[3].id },
        422,
      );
      await db.lecturer.update({
        where: { id: lecturers[3].id },
        data: { isActive: true },
      });
      const other = await db.researchArea.create({
        data: { name: `S3 wrong direction ${stamp}` },
      });
      await db.lecturerArea.update({
        where: {
          lecturerId_researchAreaId: {
            lecturerId: lecturers[3].id,
            researchAreaId: area.id,
          },
        },
        data: { researchAreaId: other.id },
      });
      await req(
        "PUT",
        route + "/manual",
        token,
        { ...input, lecturerId: lecturers[3].id },
        422,
      );
      await db.lecturerArea.update({
        where: {
          lecturerId_researchAreaId: {
            lecturerId: lecturers[3].id,
            researchAreaId: other.id,
          },
        },
        data: { researchAreaId: area.id },
      });
    },
  );
  await check("stale previews cannot overwrite a newer draft", async () => {
    const options = {
      revision: plan.plan.revision,
      mode: "remaining",
      confirmed: false,
    };
    const preview = (await req("POST", route + "/preview", token, options))
      .data;
    await run();
    await req(
      "PUT",
      route + "/draft",
      token,
      { ...options, inputHash: preview.inputHash },
      409,
    );
    plan = (await req("GET", route + "/plan", token)).data;
  });
  await check(
    "concurrent publish is idempotent with one official plan and one outbox per advisor",
    async () => {
      const results = await Promise.all([
        req("POST", route + "/publish", token, {
          revision: plan.plan.revision,
        }),
        req("POST", route + "/publish", token, {
          revision: plan.plan.revision,
        }),
      ]);
      assert.ok(results.every((r) => r.status === 201));
      plan = results[0].data;
      assert.equal(
        await db.assignmentPlan.count({
          where: { termId: term.id, status: "PUBLISHED" },
        }),
        1,
      );
      assert.equal(
        await db.emailOutbox.count({ where: { termId: term.id } }),
        new Set(plan.assignments.map((a) => a.lecturerId)).size,
      );
      assert.equal(
        (await db.thesisTerm.findUniqueOrThrow({ where: { id: term.id } }))
          .status,
        "IN_PROGRESS",
      );
      await req(
        "POST",
        route + "/preview",
        token,
        { revision: plan.plan.revision },
        409,
      );
    },
  );
  await check(
    "after publication each student and lecturer sees only their own assignments",
    async () => {
      for (let i = 0; i < 3; i++) {
        const view = (await req("GET", route + "/results", studentTokens[i]))
          .data;
        assert.equal(view.assignments.length, 1);
        assert.equal(view.assignments[0].studentId, students[i].id);
      }
      for (let i = 0; i < 4; i++) {
        const view = (await req("GET", route + "/results", lecturerTokens[i]))
          .data;
        assert.ok(
          view.assignments.every((a) => a.lecturerId === lecturers[i].id),
        );
      }
    },
  );
  const sid = students[0].id,
    advisorId = plan.assignments.find((a) => a.studentId === sid).lecturerId,
    advisorIndex = lecturers.findIndex((l) => l.id === advisorId),
    topicRoute = `/topics/term/${term.id}/student/${sid}`;
  await check(
    "in-app read state is persisted separately from SMTP, with owner-only write",
    async () => {
      const items = (await req("GET", "/notifications/me", studentTokens[0]))
        .data;
      const item = items.find((n) => n.termId === term.id);
      assert.ok(item);
      assert.equal(item.status, "UNREAD");
      await req(
        "PATCH",
        `/notifications/${item.id}/read`,
        studentTokens[1],
        undefined,
        404,
      );
      await req("PATCH", `/notifications/${item.id}/read`, studentTokens[0]);
      assert.equal(
        (await db.notification.findUniqueOrThrow({ where: { id: item.id } }))
          .status,
        "READ",
      );
    },
  );
  const content = {
    title: "Hệ thống quản lý đồ án tiếng Việt",
    objectives: "Số hóa quy trình đăng ký và phân công",
    scope: "Nội dung và phạm vi quản lý đồ án cá nhân",
    technology: "React, NestJS, PostgreSQL",
    expected: "Hệ thống chạy thật và dữ liệu có truy vết",
    plan: [
      { week: "1–3", content: "Khảo sát và phân tích yêu cầu" },
      { week: "4–8", content: "Lập trình và kiểm thử hệ thống" },
    ],
  };
  let topic;
  await check(
    "proposal writes require official ownership, current advisor and PROPOSAL window",
    async () => {
      await req(
        "PUT",
        `/topics/term/${term.id}/student/${students[3].id}/draft`,
        studentTokens[3],
        { content, expectedVersion: 0 },
        403,
      );
      await req(
        "PUT",
        topicRoute + "/draft",
        studentTokens[1],
        { content, expectedVersion: 0 },
        403,
      );
      await req(
        "PUT",
        topicRoute + "/draft",
        lecturerTokens[(advisorIndex + 1) % 4],
        { content, expectedVersion: 0 },
        403,
      );
      await db.termPhase.update({
        where: { termId_code: { termId: term.id, code: "PROPOSAL" } },
        data: { isLocked: true },
      });
      await req(
        "PUT",
        topicRoute + "/draft",
        studentTokens[0],
        { content, expectedVersion: 0 },
        409,
      );
      await db.termPhase.update({
        where: { termId_code: { termId: term.id, code: "PROPOSAL" } },
        data: { isLocked: false, endDate: new Date(Date.now() - 1000) },
      });
      await req(
        "PUT",
        topicRoute + "/draft",
        studentTokens[0],
        { content, expectedVersion: 0 },
        409,
      );
      await db.termPhase.update({
        where: { termId_code: { termId: term.id, code: "PROPOSAL" } },
        data: { endDate: new Date(Date.now() + 7200000) },
      });
      topic = (
        await req("PUT", topicRoute + "/draft", studentTokens[0], {
          content,
          expectedVersion: 0,
        })
      ).data;
      await req(
        "POST",
        topicRoute + "/submit",
        studentTokens[0],
        { content, expectedVersion: 1 },
        409,
      );
    },
  );
  await check(
    "advisor edits, bilateral agreement, resubmission preserves immutable prior version",
    async () => {
      topic = (
        await req("PUT", topicRoute + "/draft", lecturerTokens[advisorIndex], {
          content: { ...content, scope: content.scope + " — bổ sung" },
          expectedVersion: 1,
        })
      ).data;
      assert.equal(topic.studentAgreed, false);
      await req(
        "POST",
        `/topics/${topic.id}/agree`,
        lecturerTokens[advisorIndex],
        { agreed: true, expectedVersion: 2 },
      );
      const submittedContent = {
        ...content,
        scope: content.scope + " — bổ sung",
      };
      topic = (
        await req("POST", topicRoute + "/submit", studentTokens[0], {
          content: submittedContent,
          expectedVersion: 2,
        })
      ).data;
      assert.equal(topic.status, "SUBMITTED");
      assert.equal(topic.studentAgreed, true);
      const before = await db.proposalVersion.findUniqueOrThrow({
        where: { proposalId_version: { proposalId: topic.id, version: 3 } },
      });
      topic = (
        await req("PUT", topicRoute + "/draft", studentTokens[0], {
          content: { ...content, title: "Đề tài sửa đổi cần thống nhất lại" },
          expectedVersion: 3,
        })
      ).data;
      assert.equal(topic.status, "DRAFT");
      assert.equal(topic.advisorAgreed, false);
      assert.deepEqual(
        await db.proposalVersion.findUniqueOrThrow({
          where: { id: before.id },
        }),
        before,
      );
      await req(
        "POST",
        topicRoute + "/submit",
        studentTokens[0],
        {
          content: { ...content, title: "Đề tài sửa đổi cần thống nhất lại" },
          expectedVersion: 4,
        },
        409,
      );
    },
  );
  await check(
    "PDF comes from saved version 3 with Vietnamese font, not current draft",
    async () => {
      const r = await fetch(
        base + `/topics/${topic.id}/versions/3/pdf?degree=engineer`,
        { headers: { Authorization: `Bearer ${studentTokens[0]}` } },
      );
      assert.equal(
        r.status,
        200,
        await (r.ok ? Promise.resolve("") : r.text()),
      );
      const bytes = Buffer.from(await r.arrayBuffer());
      assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
      assert.ok(bytes.length > 15000);
      const parsed = await require("pdf-parse/lib/pdf-parse.js")(bytes);
      const text = parsed.text.normalize("NFC");
      for (const expected of [
        content.title,
        content.objectives,
        "bổ sung",
        "Kế hoạch thực hiện",
        "Giảng viên hướng dẫn",
        "BẢN NHÁP",
      ])
        assert.ok(text.includes(expected), `PDF text missing ${expected}`);
      assert.ok(!text.includes("Đề tài sửa đổi cần thống nhất lại"));
      fs.mkdirSync(
        path.resolve(__dirname, "../../docs/implementation/step3-evidence"),
        { recursive: true },
      );
      fs.writeFileSync(
        path.resolve(
          __dirname,
          "../../docs/implementation/step3-evidence/de-cuong-v3.pdf",
        ),
        bytes,
      );
      fs.writeFileSync(
        path.resolve(
          __dirname,
          "../../docs/implementation/step3-evidence/de-cuong-v3.txt",
        ),
        text,
      );
      await req(
        "GET",
        `/topics/${topic.id}/versions/3/pdf`,
        studentTokens[1],
        undefined,
        403,
      );
    },
  );
  await check(
    "finalized dossier cannot be edited, another term can retain history for same student",
    async () => {
      await db.thesisDossier.create({
        data: { proposalId: topic.id, status: "APPROVED" },
      });
      await req(
        "PUT",
        topicRoute + "/draft",
        studentTokens[0],
        { content, expectedVersion: 4 },
        409,
      );
      const other = await db.thesisTerm.create({
        data: {
          code: `S3-HISTORY-${stamp}`,
          name: "History fixture",
          academicYear: "2026-2027",
          semester: 2,
          startDate: new Date(),
          endDate: new Date(Date.now() + 86400000),
        },
      });
      const otherTopic = await db.topic.create({
        data: { termId: other.id, title: "Hồ sơ lịch sử fixture" },
      });
      await db.proposal.create({
        data: { termId: other.id, studentId: sid, topicId: otherTopic.id },
      });
      assert.equal(await db.proposal.count({ where: { studentId: sid } }), 2);
    },
  );
  await check(
    "MailHog receives actual SMTP messages with assigned student list",
    async () => {
      let events = [];
      for (let i = 0; i < 30; i++) {
        events = await db.emailOutbox.findMany({ where: { termId: term.id } });
        if (events.every((e) => e.status === "SENT")) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      assert.ok(
        events.every((e) => e.status === "SENT"),
        events.map((e) => e.lastError).join(";"),
      );
      const mail = await (
        await fetch((process.env.MAILHOG_API_URL || "http://127.0.0.1:8025") + "/api/v2/messages?limit=100")
      ).json();
      const matched = mail.items.filter((m) =>
        events.some((e) =>
          (m.Content.Headers["Message-ID"] ?? []).some((id) =>
            id.includes(e.id),
          ),
        ),
      );
      assert.equal(matched.length, events.length);
      for (const m of matched) {
        assert.ok(m.Content.Body.includes("S3S"));
      }
      fs.writeFileSync(
        path.resolve(
          __dirname,
          "../../docs/implementation/step3-evidence/mailhog.json",
        ),
        JSON.stringify(
          {
            termId: term.id,
            outbox: events.map((e) => ({
              id: e.id,
              status: e.status,
              attempts: e.attempts,
              messageId: e.messageId,
              sentAt: e.sentAt,
            })),
            messages: matched,
          },
          null,
          2,
        ),
      );
    },
  );
  fixture.topicId = topic.id;
  fs.writeFileSync(
    path.resolve(__dirname, "../../.cache/step3-fixture.json"),
    JSON.stringify(fixture, null, 2),
  );
  console.log(
    `${checks} real HTTP/PostgreSQL groups passed. Fixtures retained, no existing records removed.`,
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
