const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
for (const line of fs
  .readFileSync(path.resolve(__dirname, "../.env"), "utf8")
  .split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const db = new PrismaClient();
const base = process.env.TEST_API_URL || "http://127.0.0.1:3010/api";
const stamp = Date.now().toString();
const password = "StepTwo@2026"; // Synthetic fixture password only.
let checks = 0;
async function req(method, url, token, body, expected) {
  const response = await fetch(base + url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = await response.json();
  assert.ok(!JSON.stringify(value).includes("passwordHash"));
  if (expected)
    assert.equal(
      response.status,
      expected,
      `${method} ${url}: ${JSON.stringify(value)}`,
    );
  else assert.ok(response.ok, `${method} ${url}: ${JSON.stringify(value)}`);
  return { status: response.status, ...value };
}
async function check(label, fn) {
  await fn();
  checks++;
  console.log("PASS " + label);
}
async function main() {
  const role = await db.role.findUniqueOrThrow({ where: { name: "FACULTY" } });
  const manager = await db.userAccount.create({
    data: {
      username: `step2_faculty_${stamp}`,
      passwordHash: await bcrypt.hash(password, 4),
      status: "ACTIVE",
      mustChangePassword: false,
      userRoles: { create: { roleId: role.id } },
    },
  });
  const faculty = (
    await req("POST", "/auth/login", null, {
      username: manager.username,
      password,
    })
  ).data;
  const token = faculty.accessToken;
  const systems = (await req("GET", "/training-systems", token)).data;
  const cq = systems.find((s) => s.code === "CQ"),
    txSystem = systems.find((s) => s.code === "TX");
  const department = (await req("GET", "/departments", token)).data[0];
  const area = (
    await req("POST", "/research-areas", token, {
      name: `Step2 direction ${stamp}`,
    })
  ).data;
  const wrongArea = (
    await req("POST", "/research-areas", token, {
      name: `Step2 other ${stamp}`,
    })
  ).data;
  const lecturers = [];
  for (let i = 0; i < 4; i++)
    lecturers.push(
      (
        await req("POST", "/lecturers", token, {
          lecturerCode: `S2L${stamp}${i}`,
          fullName: `Step2 Lecturer ${i}`,
          departmentId: department.id,
          researchAreaIds: [i === 2 ? wrongArea.id : area.id],
          maxStudents: 0,
        })
      ).data,
    );
  const students = [];
  for (let i = 0; i < 3; i++)
    students.push(
      (
        await req("POST", "/students", token, {
          studentCode: `00${stamp}${i}`,
          fullName: `Step2 Student ${i}`,
          className: "Step2 fixture",
          trainingSystemId: cq.id,
          gpa: 3.5,
        })
      ).data,
    );
  const time = Date.now();
  const term = await db.thesisTerm.create({
    data: {
      code: `STEP2-${stamp}`,
      name: `Step2 fixture ${stamp}`,
      academicYear: "2026-2027",
      semester: 1,
      trainingSystemId: cq.id,
      status: "OPEN_REGISTRATION",
      startDate: new Date(time - 86400000),
      endDate: new Date(time + 86400000),
      phases: {
        create: {
          code: "REGISTRATION",
          phaseName: "Registration fixture",
          startDate: new Date(time - 3600000),
          endDate: new Date(time + 3600000),
        },
      },
      termStudents: {
        create: students.slice(0, 2).map((s) => ({ studentId: s.id })),
      },
      termLecturers: {
        create: lecturers
          .slice(0, 3)
          .map((l) => ({ lecturerId: l.id, quota: 0 })),
      },
    },
    include: { phases: true },
  });
  const route = `/registrations/term/${term.id}`;
  const valid = {
    email: `s2_${stamp}@example.test`,
    phone: "0912345678",
    directionId: area.id,
    preferences: [
      { lecturerId: lecturers[0].id, preferenceOrder: 1 },
      { lecturerId: lecturers[1].id, preferenceOrder: 2 },
    ],
    note: "API fixture",
  };
  const login = (i, pw = students[i].studentCode) =>
    req("POST", "/auth/login", null, {
      username: students[i].studentCode,
      password: pw,
    });
  let studentToken = (await login(0)).data.accessToken;
  await check(
    "default password is hashed and business API is blocked",
    async () => {
      const user = await db.userAccount.findUniqueOrThrow({
        where: { id: students[0].userId },
      });
      assert.notEqual(user.passwordHash, students[0].studentCode);
      assert.ok(
        await bcrypt.compare(students[0].studentCode, user.passwordHash),
      );
      assert.equal(
        (await req("POST", route + "/me/submit", studentToken, valid, 403))
          .error.code,
        "PASSWORD_CHANGE_REQUIRED",
      );
      await req("GET", "/auth/me", studentToken);
      await req("POST", "/auth/change-password", studentToken, {
        oldPassword: students[0].studentCode,
        newPassword: password,
      });
    },
  );
  await check(
    "changed password still requires server contact; request contact cannot bypass onboarding",
    async () => {
      await req(
        "POST",
        route + "/me/submit",
        studentToken,
        { ...valid, email: `s2_${stamp}@example.test`, phone: "0912345678" },
        403,
      );
      await req("PATCH", "/auth/profile", studentToken, {
        name: "Step2 Student Zero",
        email: `s2_${stamp}@example.test`,
      });
      await req("POST", route + "/me/submit", studentToken, valid, 403);
      const profile = (
        await req("PATCH", "/auth/profile", studentToken, {
          name: "Step2 Student Zero",
          email: `s2_${stamp}@example.test`,
          phone: "0912345678",
        })
      ).data;
      assert.equal(profile.profileComplete, true);
      const student = await db.student.findUniqueOrThrow({
        where: { id: students[0].id },
        include: { user: true },
      });
      assert.equal(student.phone, student.user.phone);
    },
  );
  await check(
    "empty drafts are allowed, incomplete submissions rejected",
    async () => {
      const draft = (await req("PUT", route + "/me/draft", studentToken, {}))
        .data;
      assert.equal(draft.status, "DRAFT");
      assert.equal(draft.directionId, null);
      assert.equal(draft.submittedAt, null);
      await req("POST", route + "/me/submit", studentToken, {}, 422);
    },
  );
  await check(
    "roster, system, academic eligibility, current GPA and missing GPA validation",
    async () => {
      for (const data of [
        { trainingSystemId: txSystem.id },
        { gpa: 1.5 },
        { academicEligible: false },
        { isActive: false },
      ]) {
        await db.student.update({ where: { id: students[0].id }, data });
        await req("POST", route + "/me/submit", studentToken, valid, 422);
        await db.student.update({
          where: { id: students[0].id },
          data: {
            trainingSystemId: cq.id,
            gpa: 3.5,
            academicEligible: true,
            isActive: true,
          },
        });
      }
      await db.termStudent.delete({
        where: {
          termId_studentId: { termId: term.id, studentId: students[0].id },
        },
      });
      await req("POST", route + "/me/submit", studentToken, valid, 422);
      await db.termStudent.create({
        data: { termId: term.id, studentId: students[0].id },
      });
      await req(
        "POST",
        "/students",
        token,
        {
          studentCode: `MISSING${stamp}`,
          fullName: "Missing GPA fixture",
          className: "S2",
          trainingSystemId: cq.id,
        },
        400,
      );
    },
  );
  await check(
    "malformed choices, two directions, excess preferences, duplicates and gaps rejected",
    async () => {
      for (const body of [
        { ...valid, directionId: [area.id, wrongArea.id] },
        { ...valid, preferences: Array(4).fill(valid.preferences[0]) },
        { ...valid, studentId: students[1].id },
        {
          ...valid,
          preferences: [{ lecturerId: lecturers[0].id, preferenceOrder: 4 }],
        },
      ])
        await req("POST", route + "/me/submit", studentToken, body, 400);
      for (const preferences of [
        [
          valid.preferences[0],
          { lecturerId: lecturers[0].id, preferenceOrder: 2 },
        ],
        [{ lecturerId: lecturers[0].id, preferenceOrder: 2 }],
        [{ lecturerId: lecturers[2].id, preferenceOrder: 1 }],
        [{ lecturerId: lecturers[3].id, preferenceOrder: 1 }],
      ])
        await req(
          "POST",
          route + "/me/submit",
          studentToken,
          { ...valid, preferences },
          422,
        );
      await db.lecturer.update({
        where: { id: lecturers[0].id },
        data: { isActive: false },
      });
      await req("POST", route + "/me/submit", studentToken, valid, 422);
      await db.lecturer.update({
        where: { id: lecturers[0].id },
        data: { isActive: true },
      });
      await req("PATCH", `/research-areas/${area.id}`, token, {
        isActive: false,
      });
      await req("POST", route + "/me/submit", studentToken, valid, 422);
      await req("PATCH", `/research-areas/${area.id}`, token, {
        isActive: true,
      });
      await db.termParameter.create({
        data: { termId: term.id, key: "max_preferences", value: "1" },
      });
      await req("POST", route + "/me/submit", studentToken, valid, 422);
      await db.termParameter.update({
        where: { termId_key: { termId: term.id, key: "max_preferences" } },
        data: { value: "3" },
      });
    },
  );
  let registrationId;
  await check(
    "submit and simultaneous resubmit create one current registration; quota zero is informational",
    async () => {
      const saved = (
        await req("POST", route + "/me/submit", studentToken, valid)
      ).data;
      registrationId = saved.id;
      assert.equal(saved.status, "SUBMITTED");
      assert.ok(saved.submittedAt);
      const results = await Promise.all(
        [1, 2].map(() =>
          req("POST", route + "/me/submit", studentToken, valid),
        ),
      );
      assert.ok(results.every((r) => r.data.id === registrationId));
      assert.equal(
        await db.registration.count({
          where: { termId: term.id, studentId: students[0].id },
        }),
        1,
      );
      const current = (await req("GET", route + "/me", studentToken)).data;
      assert.deepEqual(current.registration.preferences, valid.preferences);
      assert.equal(current.window.canWrite, true);
      assert.ok(
        await db.auditLog.count({
          where: {
            resourceId: registrationId,
            action: "REGISTRATION_SUBMITTED",
          },
        }),
      );
    },
  );
  await check(
    "contact conflict rolls back registration, preferences and audit",
    async () => {
      await db.userAccount.update({
        where: { id: students[1].userId },
        data: { email: `taken_${stamp}@example.test` },
      });
      const before = await db.registration.findUnique({
        where: { id: registrationId },
        include: { preferences: true },
      });
      const audits = await db.auditLog.count({
        where: { resourceId: registrationId },
      });
      await req(
        "POST",
        route + "/me/submit",
        studentToken,
        {
          ...valid,
          email: `taken_${stamp}@example.test`,
          note: "MUST ROLLBACK",
        },
        409,
      );
      assert.deepEqual(
        await db.registration.findUnique({
          where: { id: registrationId },
          include: { preferences: true },
        }),
        before,
      );
      assert.equal(
        await db.auditLog.count({ where: { resourceId: registrationId } }),
        audits,
      );
    },
  );
  await check(
    "server time, phase/term locks and published assignment prevent writes",
    async () => {
      const phaseId = term.phases[0].id;
      for (const data of [
        { startDate: new Date(Date.now() + 60000) },
        { endDate: new Date(Date.now()) },
        { isLocked: true },
      ]) {
        await db.termPhase.update({ where: { id: phaseId }, data });
        await req("POST", route + "/me/submit", studentToken, valid, 409);
        await db.termPhase.update({
          where: { id: phaseId },
          data: {
            startDate: new Date(time - 3600000),
            endDate: new Date(time + 3600000),
            isLocked: false,
          },
        });
      }
      await db.thesisTerm.update({
        where: { id: term.id },
        data: { isLocked: true },
      });
      await req("PUT", route + "/me/draft", studentToken, {}, 409);
      await db.thesisTerm.update({
        where: { id: term.id },
        data: { isLocked: false },
      });
      const plan = await db.assignmentPlan.create({
        data: { termId: term.id, status: "PUBLISHED" },
      });
      await req("POST", route + "/me/submit", studentToken, valid, 409);
      await db.assignmentPlan.update({
        where: { id: plan.id },
        data: { status: "DRAFT" },
      });
    },
  );
  await check(
    "student A cannot read or write B by changing path, body or query; other roles rejected",
    async () => {
      let other = (await login(1)).data.accessToken;
      await req("POST", "/auth/change-password", other, {
        oldPassword: students[1].studentCode,
        newPassword: password,
      });
      await req("PATCH", "/auth/profile", other, {
        name: "Step2 Student One",
        email: `taken_${stamp}@example.test`,
        phone: "0912345678",
      });
      assert.equal(
        (await req("GET", route + `/me?studentId=${students[0].id}`, other))
          .data.registration,
        null,
      );
      await req(
        "POST",
        route + "/me/submit",
        other,
        { ...valid, studentId: students[0].id },
        400,
      );
      await req("GET", route, studentToken, undefined, 403);
      await req("GET", "/registrations", studentToken, undefined, 403);
      await req(
        "GET",
        `/registrations/${registrationId}`,
        other,
        undefined,
        404,
      );
      await req("PUT", `/registrations/${registrationId}`, other, valid, 404);
      await req("POST", route + "/me/submit", token, valid, 403);
      await req("GET", route, null, undefined, 401);
      const ownInput = { ...valid, email: `taken_${stamp}@example.test` };
      const concurrent = await Promise.all(
        [1, 2].map(() => req("POST", route + "/me/submit", other, ownInput)),
      );
      assert.equal(concurrent[0].data.id, concurrent[1].data.id);
      assert.equal(
        await db.registration.count({
          where: { termId: term.id, studentId: students[1].id },
        }),
        1,
      );
    },
  );
  await check(
    "logout/login and separate faculty session see the same PostgreSQL record",
    async () => {
      await req("POST", "/auth/logout", studentToken);
      await req("GET", "/auth/me", studentToken, undefined, 401);
      studentToken = (await login(0, password)).data.accessToken;
      assert.equal(
        (await req("GET", route + "/me", studentToken)).data.registration.id,
        registrationId,
      );
      const secondFaculty = (
        await req("POST", "/auth/login", null, {
          username: manager.username,
          password,
        })
      ).data;
      const list = (await req("GET", route, secondFaculty.accessToken)).data;
      assert.equal(list.stats.submitted, 2);
      assert.ok(list.items.some((r) => r.id === registrationId));
    },
  );
  await check(
    "PostgreSQL enforces lecturer FK, unique lecturer and order CHECK",
    async () => {
      for (const pref of [
        { lecturerId: lecturers[0].id, preferenceOrder: 3 },
        { lecturerId: lecturers[2].id, preferenceOrder: 4 },
        {
          lecturerId: "00000000-0000-4000-8000-000000000000",
          preferenceOrder: 3,
        },
      ]) {
        await assert.rejects(
          db.registrationPref.create({ data: { registrationId, ...pref } }),
        );
      }
    },
  );
  fs.mkdirSync(path.resolve(__dirname, "../../.cache"), { recursive: true });
  fs.writeFileSync(
    path.resolve(__dirname, "../../.cache/step2-fixture.json"),
    JSON.stringify(
      {
        termId: term.id,
        termCode: term.code,
        studentCode: students[0].studentCode,
        studentId: students[0].id,
        newStudentCode: students[2].studentCode,
        facultyUsername: manager.username,
        directionId: area.id,
        lecturerIds: lecturers.map((l) => l.id),
        registrationId,
      },
      null,
      2,
    ),
  );
  console.log(
    `${checks} Step 2 HTTP/PostgreSQL checks passed. Fixture retained for reload/restart/browser verification.`,
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
