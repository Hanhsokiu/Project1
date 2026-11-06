const assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const fs = require("node:fs");
const path = require("node:path");
for (const line of fs
  .readFileSync(path.resolve(__dirname, "../.env"), "utf8")
  .split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const base = process.env.TEST_API_URL || "http://127.0.0.1:3010/api";
const db = new PrismaClient();
const suffix = Date.now().toString();
let checks = 0;
async function request(method, url, token, body, expected) {
  const response = await fetch(base + url, {
    method,
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body: body
      ? body instanceof FormData
        ? body
        : JSON.stringify(body)
      : undefined,
  });
  const value = await response.json();
  if (expected)
    assert.equal(
      response.status,
      expected,
      method + " " + url + " " + JSON.stringify(value),
    );
  else assert.ok(response.ok, method + " " + url + " " + JSON.stringify(value));
  assert.ok(
    !JSON.stringify(value).includes("passwordHash"),
    "Response must not expose passwordHash",
  );
  return { status: response.status, data: value.data, error: value.error };
}
async function check(name, fn) {
  await fn();
  checks++;
  console.log("PASS " + name);
}
async function main() {
  const facultyRole = await db.role.findUniqueOrThrow({
    where: { name: "FACULTY" },
  });
  const facultyAccount = await db.userAccount.create({
    data: {
      username: `step1_faculty_${suffix}`,
      passwordHash: await bcrypt.hash("Demo@2026", 4),
      status: "ACTIVE",
      mustChangePassword: false,
      userRoles: { create: { roleId: facultyRole.id } },
    },
  });
  const faculty = (
    await request("POST", "/auth/login", null, {
      username: facultyAccount.username,
      password: "Demo@2026",
    })
  ).data;
  const token = faculty.accessToken;
  let userToken;
  await check(
    "Auth rejects anonymous, wrong credentials, and invalid body",
    async () => {
      await request("GET", "/terms", null, null, 401);
      await request(
        "POST",
        "/auth/login",
        null,
        { username: "missing-" + suffix, password: "bad" },
        401,
      );
      await request("POST", "/auth/login", null, { username: "giaovu" }, 400);
      const invalidStudent = await request("POST", "/students", token, {}, 400);
      assert.ok(
        invalidStudent.error.fields.some((field) => field.path === "gpa"),
      );
      assert.ok(faculty.user.roles.includes("FACULTY"));
      assert.ok(!("passwordHash" in faculty.user));
      const refreshed = await request("POST", "/auth/refresh", null, {
        refreshToken: faculty.refreshToken,
      });
      assert.ok(refreshed.data.accessToken);
      assert.equal(refreshed.data.user.id, faculty.user.id);
      await request(
        "POST",
        "/auth/refresh",
        null,
        {
          refreshToken: faculty.accessToken,
        },
        401,
      );
    },
  );
  const programs = (await request("GET", "/training-systems", token)).data;
  const department = (await request("GET", "/departments", token)).data[0];
  const area = (await request("GET", "/research-areas", token)).data[0];
  const fixtureLecturer = (
    await request("POST", "/lecturers", token, {
      lecturerCode: `S1L${suffix}`,
      fullName: "Step1 fixture lecturer",
      departmentId: department.id,
      researchAreaIds: [area.id],
    })
  ).data;
  await db.userAccount.update({
    where: { id: fixtureLecturer.userId },
    data: {
      passwordHash: await bcrypt.hash("Demo@2026", 4),
      mustChangePassword: false,
    },
  });
  const lecturers = [fixtureLecturer];
  const students = [];
  for (const program of programs.filter((p) =>
    ["CQ", "LT", "TX"].includes(p.code),
  ))
    students.push(
      (
        await request("POST", "/students", token, {
          studentCode: `S1${suffix}${program.code}`,
          fullName: "Step1 fixture student",
          className: "QA",
          trainingSystemId: program.id,
          gpa: 3.2,
        })
      ).data,
    );
  const seededSemester = (await request("GET", "/semesters", token)).data.find(
    (s) => s.academicYear === "2026-2027" && s.semester === 1,
  );
  assert.ok(seededSemester);
  const terms = [];
  for (const program of programs.filter((p) =>
    ["CQ", "LT", "TX"].includes(p.code),
  )) {
    const input = {
      code: "HTTP-" + suffix + "-" + program.code,
      name: "Đợt kiểm thử HTTP " + program.name,
      semesterId: seededSemester.id,
      trainingSystemId: program.id,
      startDate: "2026-10-01T00:00:00+07:00",
      endDate: "2027-03-31T23:59:59+07:00",
      registrationStart: "2026-10-01T00:00:00+07:00",
      registrationEnd: "2026-11-30T23:59:59+07:00",
    };
    const term = (await request("POST", "/terms", token, input)).data;
    terms.push(term);
    assert.equal(term.phases.length, 6);
    assert.equal(term.trainingSystemId, program.id);
  }
  await check(
    "Create terms for CQ/LT/TX, filter/pagination/latest respect context",
    async () => {
      assert.equal(terms.length, 3);
      const page = (
        await request(
          "GET",
          "/terms?search=HTTP-" + suffix + "&page=1&pageSize=1",
          token,
        )
      ).data;
      assert.equal(page.total, 3);
      assert.equal(page.items.length, 1);
      for (const t of terms) {
        const latest = (
          await request(
            "GET",
            `/terms/latest?trainingSystemId=${t.trainingSystemId}&semesterId=${t.semesterId}`,
            token,
          )
        ).data;
        assert.equal(latest.id, t.id);
      }
    },
  );
  const term = terms.find((t) => t.program === "Chính quy");
  const cq = programs.find((p) => p.code === "CQ");
  const sameStudent = students.find((s) => s.trainingSystemId === cq.id);
  const otherStudent = students.find((s) => s.trainingSystemId !== cq.id);
  assert.ok(sameStudent && otherStudent);
  const roster = {
    studentIds: [sameStudent.id],
    lecturers: [{ lecturerId: lecturers[0].id, quota: 3 }],
  };
  await check(
    "Invalid dates/unknown system/duplicate code are rejected",
    async () => {
      const input = {
        code: "HTTP-BAD-" + suffix,
        name: "Đợt kiểm tra dữ liệu",
        semesterId: seededSemester.id,
        trainingSystemId: cq.id,
        startDate: "2026-10-01T00:00:00+07:00",
        endDate: "2027-03-31T23:59:59+07:00",
      };
      await request(
        "POST",
        "/terms",
        token,
        { ...input, endDate: "2026-01-01T00:00:00+07:00" },
        422,
      );
      await request(
        "POST",
        "/terms",
        token,
        { ...input, trainingSystemId: "00000000-0000-4000-8000-000000000000" },
        422,
      );
      await request(
        "POST",
        "/terms",
        token,
        { ...input, code: term.code },
        409,
      );
    },
  );
  await check(
    "Roster enforces training system and nonnegative integer quota",
    async () => {
      const wrong = await request(
        "PUT",
        `/terms/${term.id}/roster`,
        token,
        { ...roster, studentIds: [otherStudent.id] },
        422,
      );
      assert.ok(wrong.error);
      await request(
        "PUT",
        `/terms/${term.id}/roster`,
        token,
        { ...roster, lecturers: [{ lecturerId: lecturers[0].id, quota: -1 }] },
        400,
      );
      await request(
        "PUT",
        `/terms/${term.id}/roster`,
        token,
        { ...roster, lecturers: [{ lecturerId: lecturers[0].id, quota: 1.5 }] },
        400,
      );
      await request("PUT", `/terms/${term.id}/roster`, token, roster);
    },
  );
  await check(
    "Six-stage plan persists, detects overlap, and lock prevents writing",
    async () => {
      const phases = term.phases.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        start: p.start,
        end: p.end,
        locked: p.locked,
      }));
      phases[0].name = "Mở và đóng đăng ký – HTTP";
      const saved = (
        await request("PUT", `/terms/${term.id}/phases`, token, { phases })
      ).data;
      assert.equal(saved.phases[0].name, phases[0].name);
      const bad = structuredClone(phases);
      bad[1].start = bad[0].start;
      await request(
        "PUT",
        `/terms/${term.id}/phases`,
        token,
        { phases: bad },
        422,
      );
      await request("PATCH", `/terms/${term.id}/lock`, token, { locked: true });
      await request("PUT", `/terms/${term.id}/roster`, token, roster, 409);
      await request("PATCH", `/terms/${term.id}/lock`, token, {
        locked: false,
      });
    },
  );
  const code = "00" + suffix.slice(-10);
  const headers =
    "studentCode,fullName,className,cohort,trainingSystemCode,gpa,email,phone,academicEligible";
  const csv =
    headers +
    `\r\n${code},Sinh viên HTTP,CNTT K64,K64,CQ,3.21,,,true\r\n${code}X,Sinh viên thiếu GPA,CNTT K64,K64,CQ,,,,true\r\n`;
  async function preview(contents, filename = "students.csv") {
    const form = new FormData();
    form.set("termId", term.id);
    form.set("file", new Blob([contents], { type: "text/csv" }), filename);
    return (await request("POST", "/imports/students/preview", token, form))
      .data;
  }
  let job;
  await check(
    "Import preview reports row number, STRICT rolls back, VALID_ONLY commits valid rows",
    async () => {
      job = await preview(csv);
      assert.equal(job.totalRows, 2);
      assert.equal(job.invalidRows, 1);
      assert.equal(job.rows[1].rowNumber, 3);
      assert.ok(job.rows[1].errors.some((e) => e.field === "gpa"));
      const strictFailure = await request(
        "POST",
        `/imports/${job.id}/confirm`,
        token,
        { mode: "STRICT" },
        422,
      );
      assert.equal(strictFailure.error.details.invalidRows, 1);
      assert.equal(await db.student.count({ where: { studentCode: code } }), 0);
      const result = (
        await request("POST", `/imports/${job.id}/confirm`, token, {
          mode: "VALID_ONLY",
        })
      ).data;
      assert.equal(result.successRows, 1);
      assert.equal(result.status, "PARTIAL");
      const student = await db.student.findUnique({
        where: { studentCode: code },
        include: {
          user: { include: { userRoles: { include: { role: true } } } },
        },
      });
      assert.ok(student);
      assert.equal(student.user.email, null);
      assert.ok(student.user.mustChangePassword);
      assert.ok(student.user.userRoles.some((r) => r.role.name === "STUDENT"));
      assert.notEqual(student.user.passwordHash, code);
      assert.equal(student.studentCode, code);
    },
  );
  await check(
    "Imported SV must change password and cannot manage terms/import/quota",
    async () => {
      const login = (
        await request("POST", "/auth/login", null, {
          username: code,
          password: code,
        })
      ).data;
      userToken = login.accessToken;
      await request("GET", "/terms", userToken, null, 403);
      await request(
        "POST",
        "/auth/change-password",
        userToken,
        { oldPassword: code, newPassword: "bad" },
        400,
      );
      await request("POST", "/auth/change-password", userToken, {
        oldPassword: code,
        newPassword: "Student@2026",
      });
      await request("GET", "/terms", userToken);
      await request("POST", "/terms", userToken, {}, 403);
      await request("PUT", `/terms/${term.id}/roster`, userToken, roster, 403);
      await request(
        "POST",
        `/imports/${job.id}/confirm`,
        userToken,
        { mode: "VALID_ONLY" },
        403,
      );
    },
  );
  await check(
    "Reimport does not duplicate enrollment or reset changed password",
    async () => {
      const before = await db.userAccount.findUnique({
        where: { username: code },
      });
      const replay = await preview(
        headers + `\r\n${code},Sinh viên HTTP,CNTT K64,K64,CQ,3.21,,,true\r\n`,
      );
      const result = (
        await request("POST", `/imports/${replay.id}/confirm`, token, {
          mode: "STRICT",
        })
      ).data;
      assert.equal(result.skippedRows, 1);
      const after = await db.userAccount.findUnique({
        where: { username: code },
      });
      assert.equal(after.passwordHash, before.passwordHash);
      assert.equal(after.mustChangePassword, false);
      assert.equal(
        await db.termStudent.count({
          where: { termId: term.id, studentId: after.id },
        }),
        0,
      );
      const student = await db.student.findUnique({
        where: { studentCode: code },
      });
      assert.equal(
        await db.termStudent.count({
          where: { termId: term.id, studentId: student.id },
        }),
        1,
      );
      await request("POST", "/auth/login", null, {
        username: code,
        password: "Student@2026",
      });
    },
  );
  await check(
    "Lecturer cannot bypass frontend to create/import/change quota",
    async () => {
      const gv = (
        await request("POST", "/auth/login", null, {
          username: fixtureLecturer.lecturerCode.toLowerCase(),
          password: "Demo@2026",
        })
      ).data.accessToken;
      await request("POST", "/terms", gv, {}, 403);
      await request("PUT", `/terms/${term.id}/roster`, gv, roster, 403);
      await request(
        "GET",
        "/imports/students/template?format=csv",
        gv,
        null,
        403,
      );
    },
  );
  await check(
    "Server window uses lifecycle+clock+phase lock and DB data survives new HTTP read",
    async () => {
      await request("PATCH", `/terms/${term.id}/status`, token, {
        status: "OPEN_REGISTRATION",
      });
      let window = (
        await request(
          "GET",
          `/terms/${term.id}/operation-window?phaseCode=REGISTRATION`,
          token,
        )
      ).data;
      assert.equal(window.canWrite, true);
      assert.ok(window.serverNow.endsWith("Z"));
      await request("PATCH", `/terms/${term.id}/lock`, token, { locked: true });
      window = (
        await request(
          "GET",
          `/terms/${term.id}/operation-window?phaseCode=REGISTRATION`,
          token,
        )
      ).data;
      assert.equal(window.canWrite, false);
      const detail = (await request("GET", `/terms/${term.id}`, token)).data;
      assert.equal(detail.locked, true);
      assert.ok(detail.studentIds.length >= 2);
      assert.equal(detail.lecturers[0].quota, 3);
      assert.ok(
        (await db.auditLog.count({ where: { resourceId: term.id } })) > 0,
      );
    },
  );
  await check("Logout revokes access and refresh session", async () => {
    await request("POST", "/auth/logout", userToken);
    await request("GET", "/auth/me", userToken, null, 401);
    await request("POST", "/auth/logout", token);
    await request(
      "POST",
      "/auth/refresh",
      null,
      {
        refreshToken: faculty.refreshToken,
      },
      401,
    );
  });
  console.log(
    `HTTP integration complete: ${checks} groups passed. Fixtures use prefix HTTP-${suffix}; preserved for inspection.`,
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
