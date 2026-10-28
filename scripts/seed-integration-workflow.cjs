"use strict";
// Add one owned synthetic term to the UI database. Keep existing terms and work.
// Academic transitions use the real API; only producer configuration is seeded.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto"),
  { spawn } = require("node:child_process");
const { PrismaClient } = require("../backend/node_modules/@prisma/client");
const root = path.resolve(__dirname, ".."),
  cache = path.join(root, ".cache/integration-ui");
const marker = path.join(cache, "workflow-demo.json"),
  code = "UI-DEMO-48-20261027";
const cfg = JSON.parse(
  fs.readFileSync(path.join(cache, "config.json"), "utf8"),
);
const sample = JSON.parse(
  fs.readFileSync(path.join(cache, "sample.json"), "utf8"),
);
const url = `postgresql://btl_ui:${cfg.password}@127.0.0.1:55451/btl_integration_ui`;
const db = new PrismaClient({ datasources: { db: { url } } }),
  api = "http://127.0.0.1:3000/api";
const token = {},
  log = [];
async function request(actor, method, route, body) {
  const response = await fetch(api + route, {
    method,
    signal: AbortSignal.timeout(30000),
    headers: {
      "Content-Type": "application/json",
      ...(token[actor] ? { Authorization: "Bearer " + token[actor] } : {}),
      "Idempotency-Key": crypto.randomUUID(),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const value = await response.json();
  assert(
    response.ok,
    `${method} ${route}: ${response.status} ${value.error?.code ?? ""} ${value.error?.message ?? ""}`,
  );
  if (route !== "/auth/login")
    log.push({ actor, method, route, status: response.status });
  return value.data;
}
const save = (fixture) =>
  fs.writeFileSync(marker, JSON.stringify(fixture, null, 2));
async function legacyDigest() {
  const id = sample.termId;
  const rows = await Promise.all([
    db.thesisTerm.findUnique({ where: { id } }),
    db.termStudent.findMany({ where: { termId: id }, orderBy: { id: "asc" } }),
    db.termLecturer.findMany({
      where: { termId: id },
      orderBy: { lecturerId: "asc" },
    }),
    db.registration.findMany({ where: { termId: id }, orderBy: { id: "asc" } }),
    db.topic.findMany({ where: { termId: id }, orderBy: { id: "asc" } }),
    db.assignmentPlan.findMany({
      where: { termId: id },
      orderBy: { id: "asc" },
    }),
  ]);
  return crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}
async function main() {
  const [identity] = await db.$queryRaw`SELECT current_database() AS name`;
  assert.equal(identity.name, "btl_integration_ui");
  assert(sample.scopeConfigured, "Run pnpm ui:sample first");
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      if (
        (await fetch(api + "/health", { signal: AbortSignal.timeout(1000) })).ok
      ) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert(ready, "Start pnpm ui:dev and wait for the API to be ready");
  for (const actor of ["giaovu", "gv001", "sv001", "sv002", "sv003", "sv004"])
    token[actor] = (
      await request(actor, "POST", "/auth/login", {
        username: actor,
        password: "Demo@2026",
      })
    ).accessToken;
  await request("giaovu", "GET", "/terms/" + sample.termId);
  const before = await legacyDigest();
  let fixture = fs.existsSync(marker)
    ? JSON.parse(fs.readFileSync(marker, "utf8"))
    : null;
  if (!fixture) {
    assert.equal(
      await db.thesisTerm.count({ where: { code } }),
      0,
      "Existing term not owned by fixture marker; refuse overwrite",
    );
    const now = Date.now(),
      start = new Date(now - 86400000),
      end = new Date(now + 90 * 86400000);
    const faculty = await db.userAccount.findUniqueOrThrow({
      where: { username: "giaovu" },
    });
    const students = await db.student.findMany({
      where: { id: { in: sample.studentIds } },
      include: { user: true },
    });
    const lecturers = await db.lecturer.findMany({
      where: { id: { in: sample.lecturerIds } },
      include: { user: true },
    });
    const advisor = lecturers.find((l) => l.user.username === "gv001");
    assert(advisor && students.length === 4 && lecturers.length === 4);
    const ids = await db.$transaction(async (tx) => {
      const term = await tx.thesisTerm.create({
        data: {
          code,
          name: "DEMO 4–8 · Hồ sơ, xét duyệt và hướng dẫn",
          academicYear: "2026-2027",
          semester: 1,
          trainingSystemId: students[0].trainingSystemId,
          status: "CLOSED_REGISTRATION",
          startDate: start,
          endDate: end,
        },
      });
      for (const [phaseCode, key, name] of [
        ["ASSIGNMENT", null, "Công bố phân công mẫu"],
        ["PROPOSAL", "PROPOSAL_EDIT", "Soạn đề cương mẫu"],
        ["PROPOSAL_REVIEW", "PROPOSAL_REVIEW", "Xét duyệt đề cương mẫu"],
        ["WEEKLY", "GUIDANCE", "Hướng dẫn và báo cáo mẫu"],
      ])
        await tx.termPhase.create({
          data: {
            termId: term.id,
            code: phaseCode,
            phaseName: name,
            startDate: start,
            endDate: end,
            ...(key
              ? {
                  pr2bTermPhaseWorkflowPhaseId: {
                    create: { termId: term.id, key },
                  },
                }
              : {}),
          },
        });
      await tx.academicTermGrant.create({
        data: {
          userId: faculty.id,
          termId: term.id,
          pr2bGrantDepartmentGrantId: {
            create: { departmentId: advisor.departmentId },
          },
        },
      });
      for (const lecturer of lecturers)
        await tx.termLecturer.create({
          data: { termId: term.id, lecturerId: lecturer.id, quota: 5 },
        });
      const plan = await tx.assignmentPlan.create({
        data: { termId: term.id },
      });
      const people = [];
      for (const student of students.sort((a, b) =>
        a.user.username.localeCompare(b.user.username),
      )) {
        const member = await tx.termStudent.create({
          data: {
            termId: term.id,
            studentId: student.id,
            pr2bDossierStudentProfile: {
              create: {
                className: student.className || "Công nghệ thông tin K63",
                majorName: "Công nghệ phần mềm",
              },
            },
          },
        });
        const registration = await tx.registration.create({
          data: {
            termId: term.id,
            studentId: student.id,
            directionId: sample.directionId,
            status: "SUBMITTED",
            submittedAt: new Date(),
            preferences: {
              create: { lecturerId: advisor.id, preferenceOrder: 1 },
            },
            advisorAssignments: {
              create: { assignmentPlanId: plan.id, advisorId: advisor.id },
            },
          },
        });
        people.push({
          username: student.user.username,
          studentId: student.id,
          userId: student.userId,
          termStudentId: member.id,
          registrationId: registration.id,
        });
      }
      const period = await tx.guidancePeriod.create({
        data: {
          termId: term.id,
          ordinal: 1,
          type: "MILESTONE",
          label: "Mốc demo: phân tích, phát triển và kiểm thử",
          startsAt: start,
          endsAt: end,
        },
      });
      const weekly = await tx.guidancePeriod.create({
        data: {
          termId: term.id,
          ordinal: 2,
          type: "WEEK",
          label: "Tuần demo: báo cáo tiến độ và mã nguồn",
          startsAt: new Date(now - 3600000),
          endsAt: new Date(now + 7 * 86400000),
          reportDueAt: new Date(now + 7 * 86400000),
        },
      });
      const owner = people.find((p) => p.username === "sv004");
      await tx.periodRequiredStudent.create({
        data: {
          termId: term.id,
          termStudentId: owner.termStudentId,
          periodId: weekly.id,
        },
      });
      const obligation = await tx.weeklyReportObligation.create({
        data: {
          periodId: weekly.id,
          termStudentId: owner.termStudentId,
          configRevision: 0,
          configSnapshot: {
            schemaVersion: 1,
            termId: term.id,
            periodId: weekly.id,
            termStudentId: owner.termStudentId,
            periodRevision: 0,
            startsAt: weekly.startsAt.toISOString(),
            reportDueAt: weekly.reportDueAt.toISOString(),
            expectedDeliverables:
              "Báo cáo PDF, mã nguồn ZIP và kết quả kiểm thử",
          },
        },
      });
      return {
        termId: term.id,
        assignmentPlanId: plan.id,
        departmentId: advisor.departmentId,
        periodId: period.id,
        obligationId: obligation.id,
        people,
        lecturers: lecturers.map((l) => ({
          id: l.id,
          username: l.user.username,
          name: l.fullName,
          code: l.lecturerCode,
        })),
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        taskStart: new Date(now - 1800000).toISOString(),
        taskDue: new Date(now + 30 * 86400000).toISOString(),
        overdueStart: new Date(now - 12 * 3600000).toISOString(),
        overdueDue: new Date(now - 3600000).toISOString(),
      };
    });
    fixture = {
      version: 1,
      syntheticOnly: true,
      code,
      ...ids,
      setupActions: {},
      createdAt: new Date().toISOString(),
      preservedTermId: sample.termId,
      preservedTermDigest: before,
    };
    save(fixture);
    console.log(
      "Created one additional synthetic UI term; existing term retained.",
    );
  }
  const term = await db.thesisTerm.findUniqueOrThrow({
    where: { id: fixture.termId },
  });
  assert.equal(term.code, code);
  await request("giaovu", "GET", "/terms/" + fixture.termId);
  if (!fixture.producerReady) {
    let plan = await db.assignmentPlan.findUniqueOrThrow({
      where: { id: fixture.assignmentPlanId },
    });
    if (plan.status === "DRAFT")
      await request(
        "giaovu",
        "POST",
        `/assignments/term/${fixture.termId}/publish`,
        { revision: plan.revision },
      );
    plan = await db.assignmentPlan.findUniqueOrThrow({
      where: { id: fixture.assignmentPlanId },
    });
    if (plan.status === "PUBLISHED")
      await request(
        "giaovu",
        "POST",
        `/assignments/term/${fixture.termId}/finalize`,
        { revision: plan.revision },
      );
    const labels = [
      "cần chỉnh sửa",
      "chờ nhóm duyệt",
      "chờ Khoa chốt",
      "theo dõi hướng dẫn",
    ];
    for (const [i, person] of fixture.people.entries()) {
      if (person.submitted) continue;
      let proposal = await db.proposal.findFirst({
        where: { termId: fixture.termId, studentId: person.studentId },
        include: { versions: true, pr2bProposalWorkflowProposalId: true },
      });
      if (!proposal) {
        const content = {
          title: `[DEMO 4–8] Quản lý đồ án — ${labels[i]}`,
          objectives:
            "Xây dựng hệ thống quản lý hướng dẫn đồ án có phân quyền và lịch sử xử lý.",
          scope:
            "Đăng ký, đề cương, xét duyệt và theo dõi hướng dẫn trong một đợt đồ án.",
          technology: "React, NestJS, Prisma, PostgreSQL",
          expected:
            "Ứng dụng hoạt động, báo cáo kiểm thử và tài liệu hướng dẫn sử dụng.",
          plan: [
            {
              week: "1–4",
              content: "Phân tích, thiết kế, phát triển và kiểm thử",
            },
          ],
        };
        const saved = await request(
          person.username,
          "PUT",
          `/topics/term/${fixture.termId}/student/${person.studentId}/draft`,
          { content, expectedVersion: 0 },
        );
        person.proposalId = saved.id;
        save(fixture);
        proposal = await db.proposal.findUniqueOrThrow({
          where: { id: saved.id },
          include: { versions: true, pr2bProposalWorkflowProposalId: true },
        });
      }
      person.proposalId = proposal.id;
      if (!proposal.pr2bProposalWorkflowProposalId) {
        const topic = await db.topic.findUniqueOrThrow({
          where: { id: proposal.topicId },
        });
        if (!topic.advisorAgreed)
          await request("gv001", "POST", `/topics/${proposal.id}/agree`, {
            agreed: true,
            expectedVersion: Math.max(
              ...proposal.versions.map((v) => v.version),
            ),
          });
        await request(
          person.username,
          "POST",
          `/topics/${proposal.id}/prepare-workflow`,
        );
      }
      let workflow = await db.proposalWorkflow.findUniqueOrThrow({
        where: { proposalId: proposal.id },
      });
      if (!workflow.submittedVersionId) {
        const content = {
          schemaVersion: 1,
          objectives:
            "Thiết kế và xây dựng phần mềm quản lý hướng dẫn đồ án tốt nghiệp, hỗ trợ quy trình có kiểm soát và truy vết.",
          scope:
            "Một khoa, một đợt đồ án; phân quyền giáo vụ, sinh viên, GVHD và nhóm duyệt.",
          mainContents:
            "Khảo sát quy trình; thiết kế dữ liệu; phát triển API và giao diện; kiểm thử chức năng và phân quyền; hoàn thiện tài liệu.",
          tools: "React, TypeScript, NestJS, Prisma, PostgreSQL và Playwright",
          expectedResults:
            "Mã nguồn, cơ sở dữ liệu, báo cáo PDF, bộ kiểm thử và hướng dẫn sử dụng.",
          startsAt: fixture.startsAt,
          endsAt: fixture.endsAt,
          schedule: [
            {
              label: "Phân tích, phát triển và kiểm thử",
              startsAt: fixture.startsAt,
              endsAt: fixture.endsAt,
              deliverables: "Ứng dụng, báo cáo PDF và mã nguồn ZIP",
            },
          ],
        };
        const version = await request(
          person.username,
          "POST",
          `/proposals/${proposal.id}/versions`,
          {
            expectedRevision: workflow.revision,
            content,
            changeSummary: "Dữ liệu demo đầy đủ sau bàn giao bước 3",
          },
        );
        workflow = await db.proposalWorkflow.findUniqueOrThrow({
          where: { proposalId: proposal.id },
        });
        await request(
          person.username,
          "POST",
          `/proposals/${proposal.id}/submit`,
          { expectedRevision: workflow.revision, versionId: version.id },
        );
        person.submittedVersionId = version.id;
      } else person.submittedVersionId = workflow.submittedVersionId;
      person.submitted = true;
      save(fixture);
    }
    fixture.producerReady = true;
    save(fixture);
  }
  assert.equal(
    await legacyDigest(),
    before,
    "Original UI term changed unexpectedly",
  );
  if (!fixture.browserComplete) {
    const child = spawn(
      process.execPath,
      [path.join(root, "frontend/scripts/prepare-ui-workflow-browser.cjs")],
      { cwd: root, stdio: "inherit", windowsHide: true },
    );
    const exit = await new Promise((resolve, reject) => {
      child.once("exit", resolve);
      child.once("error", reject);
    });
    assert.equal(
      exit,
      0,
      "Browser setup incomplete; existing data retained. Read evidence before retry.",
    );
    fixture = JSON.parse(fs.readFileSync(marker, "utf8"));
  }
  assert.equal(await legacyDigest(), before);
  const out = path.join(
    root,
    "docs/implementation/evidence/ui-workflow-data-2026-10-27",
  );
  fs.mkdirSync(out, { recursive: true });
  const reportName = fs.existsSync(path.join(out, "producer.json"))
    ? "producer-check-" + Date.now() + ".json"
    : "producer.json";
  fs.writeFileSync(
    path.join(out, reportName),
    JSON.stringify(
      {
        termId: fixture.termId,
        code,
        syntheticOnly: true,
        originalTermPreserved: true,
        originalTermDigest: before,
        createdByApi: log,
        completedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log("Demo ready in the SAME UI database at http://127.0.0.1:5173");
  console.log(`Select term: ${term.name} (${code})`);
}
main()
  .catch((e) => {
    console.error(
      String(e.message).replace(/postgres(?:ql)?:\/\/\S+/g, "[REDACTED]"),
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
