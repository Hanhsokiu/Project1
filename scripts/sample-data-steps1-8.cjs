"use strict";
// Additive fixture for the database actually configured in backend/.env.
// No migrations, resets, role changes, or updates to existing business rows.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, ".."),
  backend = path.join(root, "backend"),
  req = createRequire(path.join(backend, "package.json"));
const {
  namespace,
  id,
  day,
  students,
  lecturers,
  terms,
  topics,
  phases,
  week,
} = require("./sample-data/definition.cjs");
const { runtimeDatabaseUrl } = req("./dist/prisma/connection-url");
const env = {};
for (const line of fs
  .readFileSync(path.join(backend, ".env"), "utf8")
  .split(/\r?\n/)) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
}
const rawUrl = process.env.DATABASE_URL || env.DATABASE_URL;
assert(rawUrl, "backend/.env must define DATABASE_URL");
const target = new URL(rawUrl);
// Ignore passwords and pooling options when identifying a database.
const fingerprint = crypto
  .createHash("sha256")
  .update(
    [
      target.hostname,
      target.port,
      target.pathname,
      decodeURIComponent(target.username),
    ].join("/"),
  )
  .digest("hex")
  .slice(0, 16);
const cache = path.join(root, ".cache", "sample-data-steps1-8", fingerprint),
  marker = path.join(cache, "access.json");
const { PrismaClient } = req("@prisma/client");
const db = new PrismaClient({
  datasources: { db: { url: runtimeDatabaseUrl(rawUrl) } },
});
const termIds = terms.map((t) => id("term/" + t.key));
let fixture, app, api;
const tokens = {};
function save() {
  fs.mkdirSync(cache, { recursive: true });
  const temporary = marker + ".tmp";
  fs.writeFileSync(temporary, JSON.stringify(fixture, null, 2), {
    mode: 0o600,
  });
  fs.renameSync(temporary, marker);
}
async function request(actor, method, route, body, key) {
  const response = await fetch(api + route, {
    method,
    signal: AbortSignal.timeout(90000),
    headers: {
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(tokens[actor] ? { Authorization: "Bearer " + tokens[actor] } : {}),
      "Idempotency-Key": key || crypto.randomUUID(),
    },
    ...(body !== undefined
      ? { body: body instanceof FormData ? body : JSON.stringify(body) }
      : {}),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(
      `${method} ${route}: ${response.status} ${JSON.stringify(result.error || result)}`,
    );
    error.apiCode = result.error?.code;
    error.httpStatus = response.status;
    throw error;
  }
  return result.data;
}
// Persist exact requests before sending, so idempotent endpoints can replay after
// a lost response. Legacy topic endpoints additionally reconcile their DB state.
async function action(key, actor, method, route, body) {
  const existing = fixture.actions[key];
  if (existing?.done) return existing.result;
  const intent = existing || {
    actor,
    method,
    route,
    body,
    key: id("action/" + key),
  };
  fixture.actions[key] = intent;
  save();
  let result;
  for (let attempt = 0; ; attempt++) {
    try {
      result = await request(
        intent.actor,
        intent.method,
        intent.route,
        intent.body,
        intent.key,
      );
      break;
    } catch (error) {
      const transport = ["TimeoutError", "AbortError", "TypeError"].includes(
        error.name,
      );
      const replaySafe =
        /^\/(proposals|proposal-reviews|guidance-plans|weekly-report-obligations|tasks|task-submissions)\//.test(
          intent.route,
        ) || /\/weekly-plans/.test(intent.route);
      const serialization = error.apiCode === "REVISION_CONFLICT";
      if ((!transport && !serialization) || !replaySafe || attempt >= 2) {
        console.error(`Sample action failed: ${key}: ${error.message}`);
        throw new Error(`${key}: ${error.message}`);
      }
      console.log(
        `Retrying saved idempotent action ${key} after connection timeout.`,
      );
    }
  }
  fixture.actions[key] = { ...intent, done: true, result };
  save();
  return result;
}
async function startApi(authenticate = true) {
  for (const [key, value] of Object.entries(env))
    if (process.env[key] === undefined) process.env[key] = value;
  process.env.DATABASE_URL = rawUrl;
  process.env.EMAIL_WORKER_ENABLED = "false";
  process.env.GUIDANCE_REMINDERS_ENABLED = "false";
  process.chdir(backend);
  req("reflect-metadata");
  const { NestFactory } = req("@nestjs/core");
  const { AppModule } = req("./dist/app.module");
  app = await NestFactory.create(AppModule, {
    logger: false,
    bodyParser: false,
    abortOnError: false,
  });
  if (!authenticate) {
    const { ReviewGroupExceptionFilter } = req(
      "./dist/topic/review-groups/review-group.errors",
    );
    const catchError = ReviewGroupExceptionFilter.prototype.catch;
    ReviewGroupExceptionFilter.prototype.catch = function (error, host) {
      if (!error?.getStatus || error.getStatus() >= 500) {
        const message = String(error?.message || error).replace(
          /postgres(?:ql)?:\/\/[^\s"']+/gi,
          "[redacted]",
        );
        console.error(
          `Sample browser request error: ${error?.code || error?.name} ${message.slice(-500)}`,
        );
      }
      return catchError.call(this, error, host);
    };
    const { PrismaService } = req("./dist/prisma/prisma.service");
    app.get(PrismaService).$use(async (params, next) => {
      try {
        return await next(params);
      } catch (error) {
        console.error(
          `Sample browser database error: ${params.model || "transaction"}.${params.action} ${error.code || error.name}`,
        );
        throw error;
      }
    });
  }
  // Its bootstrap hook normally scans ALL terms. Disable it before app.init.
  const { AssignmentSchedulerService } = req(
    "./dist/registration/service/assignment-scheduler.service",
  );
  const scheduler = app.get(AssignmentSchedulerService);
  scheduler.onApplicationBootstrap = async () => {};
  scheduler.tick = async () => {};
  const { configureBodyParsers } = req("./dist/common/http/body-parsers");
  const { GlobalExceptionHandler } = req(
    "./dist/common/exception/global-exception.handler",
  );
  const { ValidationPipe } = req("@nestjs/common");
  configureBodyParsers(app, "api");
  app.setGlobalPrefix("api");
  app.enableCors({ origin: /^http:\/\/127\.0\.0\.1:\d+$/, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionHandler());
  await app.listen(0, "127.0.0.1");
  const { SchedulerRegistry } = req("@nestjs/schedule");
  const registry = app.get(SchedulerRegistry);
  for (const name of registry.getIntervals()) registry.deleteInterval(name);
  for (const name of registry.getTimeouts()) registry.deleteTimeout(name);
  for (const job of registry.getCronJobs().values()) job.stop();
  api = (await app.getUrl()) + "/api";
  if (!authenticate) return;
  for (const person of fixture.accounts) {
    const login = await request(person.key, "POST", "/auth/login", {
      username: person.username,
      password: fixture.password,
    });
    tokens[person.key] = login.accessToken;
  }
}
async function metadata() {
  if (fixture.metadataReady) return;
  const semester = await db.academicSemester.findFirst({
    where: {
      academicYear: "2026-2027",
      semester: 1,
      startDate: { lte: new Date(fixture.anchor - 61 * day) },
      endDate: { gte: new Date(fixture.anchor + 131 * day) },
    },
  });
  assert(
    semester,
    "Create a valid semester covering sample term dates before running this fixture",
  );
  await db.thesisTerm.updateMany({
    where: { id: { in: termIds }, code: { in: terms.map((t) => t.code) } },
    data: { semesterId: semester.id },
  });
  for (const p of fixture.accounts)
    await db.userAccount.updateMany({
      where: { id: p.id, username: p.username, displayName: null },
      data: { displayName: p.name },
    });
  fixture.semesterId = semester.id;
  fixture.metadataReady = true;
  save();
}
async function plan() {
  const roles = await db.role.findMany({
    include: { rolePermissions: { include: { permission: true } } },
  });
  const names = roles.map((r) => r.name);
  for (const name of ["FACULTY", "LECTURER", "STUDENT"])
    assert(
      names.includes(name),
      `Missing standard role ${name}; run normal reviewed setup first`,
    );
  for (const [name, required] of Object.entries({
    FACULTY: [
      "term:roster",
      "term:plan",
      "term:transition",
      "proposal:assign",
      "proposal:finalize",
      "dossier:receive",
      "guidance:monitor",
    ],
    LECTURER: [
      "proposal:review",
      "proposal:comment",
      "guidance:manage",
      "task:review",
    ],
    STUDENT: [
      "proposal:edit",
      "proposal:submit",
      "task:ensure-weekly",
      "submission:create",
    ],
  })) {
    const granted = roles
      .find((r) => r.name === name)
      .rolePermissions.map(
        (p) => p.permission.resource + ":" + p.permission.action,
      );
    for (const p of required)
      assert(
        granted.includes(p),
        `Standard ${name} role is missing ${p}; use normal reviewed migrations, seed does not change global roles`,
      );
  }
  const collisions = await db.thesisTerm.findMany({
    where: { code: { in: terms.map((t) => t.code) } },
    select: { id: true, code: true },
  });
  for (const t of collisions)
    assert(
      termIds.includes(t.id) && fs.existsSync(marker),
      "Unowned sample term collision: " + t.code,
    );
  console.log(
    JSON.stringify(
      {
        mode: "plan",
        namespace,
        targetFingerprint: fingerprint,
        existingAccounts: await db.userAccount.count(),
        existingTerms: await db.thesisTerm.count(),
        semesters: await db.academicSemester.findMany({
          select: {
            id: true,
            academicYear: true,
            semester: true,
            startDate: true,
            endDate: true,
          },
        }),
        sampleAlreadyStarted: fs.existsSync(marker),
        terms: terms.map((t) => ({ code: t.code, name: t.name })),
        additions: { students: 12, lecturers: 4, faculty: 1 },
        credentialsFile: path.relative(root, marker),
      },
      null,
      2,
    ),
  );
  return roles;
}
async function baseline(roles) {
  if (fixture.baselineReady) return;
  if (!fixture.preserved) {
    fixture.preserved = [];
    for (const model of [
      "thesisTerm",
      "termPhase",
      "termStudent",
      "registration",
      "assignmentPlan",
      "topic",
      "proposal",
      "student",
      "lecturer",
      "department",
      "trainingSystem",
      "researchArea",
      "rolePermission",
    ]) {
      const rows = await db[model].findMany();
      // rolePermission has a compound key, handled by a sorted full-table hash.
      fixture.preserved.push({
        model,
        ids: rows.map((r) => r.id).filter(Boolean),
        count: rows.length,
        hash: crypto
          .createHash("sha256")
          .update(JSON.stringify(rows.map((r) => JSON.stringify(r)).sort()))
          .digest("hex"),
      });
    }
    save();
  }
  const hash = await req("bcryptjs").hash(fixture.password, 12);
  const at = fixture.anchor;
  const accounts = [
    { key: "giaovu", name: "Giáo vụ · Bộ dữ liệu mẫu", role: "FACULTY" },
    ...lecturers.map((p) => ({ ...p, role: "LECTURER" })),
    ...students.map((p) => ({ ...p, role: "STUDENT" })),
  ].map((p) => ({ ...p, id: id("user/" + p.key), username: "mau18_" + p.key }));
  // One transaction: a failed preflight must not leave half-created users.
  await db.$transaction(
    async (tx) => {
      for (const p of accounts) {
        assert.equal(
          await tx.userAccount.count({
            where: {
              OR: [
                { id: p.id },
                { username: p.username },
                { email: p.username + "@example.invalid" },
              ],
            },
          }),
          0,
          "Account collision: " + p.username,
        );
      }
      await tx.department.create({
        data: {
          id: id("department"),
          code: namespace,
          name: "[MẪU 1–8] Bộ môn Công nghệ phần mềm",
        },
      });
      await tx.trainingSystem.create({
        data: {
          id: id("training"),
          code: namespace,
          name: "[MẪU 1–8] Chính quy",
        },
      });
      await tx.researchArea.create({
        data: {
          id: id("area"),
          name: "[MẪU 1–8] Phát triển hệ thống thông tin",
          description:
            "Dữ liệu giả lập để kiểm tra toàn bộ quy trình bước 1–8.",
          pr2bResearchAreaWorkflowResearchAreaId: {
            create: { departmentId: id("department") },
          },
        },
      });
      for (const p of accounts)
        await tx.userAccount.create({
          data: {
            id: p.id,
            username: p.username,
            email: p.username + "@example.invalid",
            phone: "0900000000",
            passwordHash: hash,
            status: "ACTIVE",
            mustChangePassword: false,
            userRoles: {
              create: { roleId: roles.find((r) => r.name === p.role).id },
            },
          },
        });
      for (const p of lecturers)
        await tx.lecturer.create({
          data: {
            id: id(p.key),
            userId: id("user/" + p.key),
            lecturerCode: p.code,
            fullName: p.name,
            departmentId: id("department"),
            academicDegree: "DOCTOR",
            academicRank: "NONE",
            maxStudents: 6,
            phone: "0900000000",
            researchAreas: { create: { researchAreaId: id("area") } },
          },
        });
      for (const [i, p] of students.entries())
        await tx.student.create({
          data: {
            id: id(p.key),
            userId: id("user/" + p.key),
            studentCode: p.code,
            fullName: p.name,
            trainingSystemId: id("training"),
            className: i < 6 ? "CNTT-K64A (Mẫu)" : "CNTT-K64B (Mẫu)",
            majorName: "Công nghệ phần mềm",
            cohort: "K64",
            gpa: (2.6 + i * 0.1).toFixed(2),
            phone: "0900000000",
            academicEligible: true,
          },
        });
      const facultyUsers = await tx.userAccount.findMany({
        where: {
          status: "ACTIVE",
          userRoles: { some: { role: { name: "FACULTY" } } },
        },
        select: { id: true },
      });
      const { defaultTermParameters } = req(
        "./dist/term/validator/term-configuration.validator",
      );
      for (const t of terms) {
        const termId = id("term/" + t.key);
        await tx.thesisTerm.create({
          data: {
            id: termId,
            code: t.code,
            name: t.name,
            academicYear: "2026-2027",
            semester: 1,
            trainingSystemId: id("training"),
            startDate: new Date(at - 61 * day),
            endDate: new Date(at + 131 * day),
            status:
              t.key === "registration"
                ? "OPEN_REGISTRATION"
                : "CLOSED_REGISTRATION",
          },
        });
        const phasePlan = phases(
          at,
          t.key === "registration" ? "REGISTRATION" : "ASSIGNMENT",
        );
        for (const p of phasePlan) {
          const key = {
            PROPOSAL: "PROPOSAL_EDIT",
            PROPOSAL_REVIEW: "PROPOSAL_REVIEW",
            WEEKLY: "GUIDANCE",
          }[p.code];
          await tx.termPhase.create({
            data: {
              id: id(`${t.key}/phase/${p.code}`),
              termId,
              code: p.code,
              phaseName: p.name,
              startDate: new Date(p.start),
              endDate: new Date(p.end),
              ...(key
                ? { pr2bTermPhaseWorkflowPhaseId: { create: { termId, key } } }
                : {}),
            },
          });
        }
        for (const [key, value] of Object.entries(defaultTermParameters))
          await tx.termParameter.create({
            data: { termId, key, value: String(value) },
          });
        for (const p of facultyUsers)
          await tx.academicTermGrant.create({
            data: { userId: p.id, termId, allDepartments: true },
          });
        for (const p of lecturers)
          await tx.termLecturer.create({
            data: { termId, lecturerId: id(p.key), quota: 3 },
          });
        if (t.key !== "registration")
          await tx.assignmentPlan.create({
            data: { id: id(t.key + "/assignment"), termId },
          });
        for (const [i, p] of students.entries()) {
          await tx.termStudent.create({
            data: {
              id: id(`${t.key}/member/${p.key}`),
              termId,
              studentId: id(p.key),
              pr2bDossierStudentProfile: {
                create: {
                  className: i < 6 ? "CNTT-K64A (Mẫu)" : "CNTT-K64B (Mẫu)",
                  majorName: "Công nghệ phần mềm",
                },
              },
            },
          });
          if (t.key === "registration" && i < 4) continue;
          const submitted = t.key !== "registration" || i >= 8;
          await tx.registration.create({
            data: {
              id: id(`${t.key}/reg/${p.key}`),
              termId,
              studentId: id(p.key),
              directionId: id("area"),
              status: submitted ? "SUBMITTED" : "DRAFT",
              ...(submitted ? { submittedAt: new Date(at - 3 * day) } : {}),
              preferences: {
                create: [
                  { lecturerId: id(p.advisor), preferenceOrder: 1 },
                  {
                    lecturerId: id(lecturers[(i + 1) % 4].key),
                    preferenceOrder: 2,
                  },
                ],
              },
              ...(t.key === "registration"
                ? {}
                : {
                    advisorAssignments: {
                      create: {
                        assignmentPlanId: id(t.key + "/assignment"),
                        advisorId: id(p.advisor),
                      },
                    },
                  }),
            },
          });
        }
      }
    },
    { timeout: 120000, maxWait: 15000 },
  );
  fixture.accounts = accounts;
  fixture.baselineReady = true;
  save();
  console.log(
    "Created 17 synthetic accounts and 3 isolated sample terms; existing users retained.",
  );
}
async function advance(t, stage) {
  return action(
    `${t.key}/phase/${stage}`,
    "giaovu",
    "PUT",
    `/terms/${id("term/" + t.key)}/phases`,
    {
      phases: phases(fixture.anchor, stage).map((p) => ({
        ...p,
        id: id(`${t.key}/phase/${p.code}`),
      })),
    },
  );
}
async function assignments(t) {
  const termId = id("term/" + t.key);
  if (!fixture.actions[t.key + "/quota/approve"]?.done) {
    const term = await db.thesisTerm.findUniqueOrThrow({
      where: { id: termId },
    });
    const preview = await action(
      t.key + "/quota/preview",
      "giaovu",
      "POST",
      `/terms/${termId}/quotas/preview`,
      {
        revision: term.quotaPolicy?.revision || 0,
        settings: {
          basis: "ROSTER",
          defaultLimit: 6,
          factors: {
            MASTER: 0.75,
            DOCTOR: 1,
            ASSOCIATE_PROFESSOR: 1,
            PROFESSOR: 1,
          },
        },
        limits: [],
      },
    );
    await action(
      t.key + "/quota/approve",
      "giaovu",
      "POST",
      `/terms/${termId}/quotas/approve`,
      {
        revision: preview.revision,
        members: preview.members.map((m) => ({
          lecturerId: m.lecturerId,
          quota: m.suggestedQuota,
          reason: "Phân bổ đều 3 sinh viên/giảng viên cho bộ mẫu.",
        })),
      },
    );
  }
  if (t.key === "registration") return;
  let plan = await db.assignmentPlan.findUniqueOrThrow({
    where: { id: id(t.key + "/assignment") },
  });
  if (plan.status === "DRAFT")
    await action(
      t.key + "/publish",
      "giaovu",
      "POST",
      `/assignments/term/${termId}/publish`,
      { revision: plan.revision },
    );
  plan = await db.assignmentPlan.findUniqueOrThrow({ where: { id: plan.id } });
  if (plan.status === "PUBLISHED")
    await action(
      t.key + "/finalize-assignments",
      "giaovu",
      "POST",
      `/assignments/term/${termId}/finalize`,
      { revision: plan.revision },
    );
  const term = await db.thesisTerm.findUniqueOrThrow({ where: { id: termId } });
  if (term.status !== "IN_PROGRESS")
    await action(
      t.key + "/in-progress",
      "giaovu",
      "PATCH",
      `/terms/${termId}/status`,
      { status: "IN_PROGRESS" },
    );
  await advance(t, "PROPOSAL");
}
function content(i) {
  const start = new Date(fixture.anchor - 14 * day).toISOString(),
    end = new Date(fixture.anchor + 90 * day).toISOString();
  return {
    schemaVersion: 1,
    objectives: `Xây dựng ứng dụng ${topics[i].toLowerCase()} có phân quyền, tìm kiếm và thống kê; đánh giá bằng các tình huống nghiệp vụ cụ thể.`,
    scope:
      "Ứng dụng web cho một đơn vị, hỗ trợ quản trị viên và người dùng; sử dụng dữ liệu giả lập, không chứa dữ liệu cá nhân thật.",
    mainContents:
      "Khảo sát yêu cầu; mô hình hóa nghiệp vụ; thiết kế cơ sở dữ liệu và giao diện; xây dựng API; kiểm thử chức năng, phân quyền và toàn vẹn dữ liệu; triển khai thử nghiệm.",
    tools: "React, TypeScript, NestJS, Prisma, PostgreSQL, Playwright và Git",
    expectedResults:
      "Ứng dụng chạy được; báo cáo PDF; mã nguồn ZIP; tài liệu cài đặt, sử dụng và kết quả kiểm thử.",
    startsAt: start,
    endsAt: end,
    schedule: [
      {
        label: "Khảo sát và phân tích",
        startsAt: start,
        endsAt: new Date(fixture.anchor + 7 * day).toISOString(),
        deliverables: "Đặc tả yêu cầu và mô hình dữ liệu",
      },
      {
        label: "Xây dựng và kiểm thử",
        startsAt: new Date(fixture.anchor + 7 * day).toISOString(),
        endsAt: end,
        deliverables: "Ứng dụng, báo cáo và mã nguồn",
      },
    ],
  };
}
async function proposal(t, p, i) {
  const termId = id("term/" + t.key),
    key = `${t.key}/${p.key}`;
  let proposal = await db.proposal.findFirst({
    where: { termId, studentId: id(p.key) },
    include: { versions: true, topic: true },
  });
  if (!proposal) {
    const c = content(i);
    const result = await action(
      key + "/topic",
      p.key,
      "PUT",
      `/topics/term/${termId}/student/${id(p.key)}/draft`,
      {
        expectedVersion: 0,
        content: {
          title: "[MẪU] " + topics[i],
          objectives: c.objectives,
          scope: c.scope,
          technology: c.tools,
          expected: c.expectedResults,
          plan: [{ week: "1–12", content: c.mainContents }],
        },
      },
    );
    proposal = await db.proposal.findUniqueOrThrow({
      where: { id: result.id },
      include: { versions: true, topic: true },
    });
  }
  if (!proposal.topic.advisorAgreed)
    await action(
      key + "/agree",
      p.advisor,
      "POST",
      `/topics/${proposal.id}/agree`,
      {
        agreed: true,
        expectedVersion: Math.max(...proposal.versions.map((v) => v.version)),
      },
    );
  let workflow = await db.proposalWorkflow.findUnique({
    where: { proposalId: proposal.id },
  });
  if (!workflow)
    await action(
      key + "/handoff",
      p.key,
      "POST",
      `/topics/${proposal.id}/prepare-workflow`,
    );
  workflow = await db.proposalWorkflow.findUniqueOrThrow({
    where: { proposalId: proposal.id },
  });
  // Replace the initial converted version with a complete schema-v1 proposal.
  const version = await action(
    key + "/version",
    p.key,
    "POST",
    `/proposals/${proposal.id}/versions`,
    {
      expectedRevision: workflow.revision,
      content: content(i),
      changeSummary: "Đề cương đầy đủ của bộ mẫu bước 1–8.",
    },
  );
  if (!(t.key === "proposal" && i < 2)) {
    workflow = await db.proposalWorkflow.findUniqueOrThrow({
      where: { proposalId: proposal.id },
    });
    await action(
      key + "/submit",
      p.key,
      "POST",
      `/proposals/${proposal.id}/submit`,
      { expectedRevision: workflow.revision, versionId: version.id },
    );
  }
  return { ...p, proposalId: proposal.id, versionId: version.id };
}
async function review(t, p, i, groups) {
  const key = `${t.key}/${p.key}`,
    proposalId = p.proposalId;
  if (t.key === "proposal" && i < 4) return;
  let workflow = await db.proposalWorkflow.findUniqueOrThrow({
    where: { proposalId },
  });
  const group = ["gv01", "gv02"].includes(p.advisor) ? groups[1] : groups[0];
  const reviewer = ["gv01", "gv02"].includes(p.advisor) ? "gv03" : "gv01";
  const assignment = await action(
    key + "/review-assign",
    "giaovu",
    "POST",
    `/proposals/${proposalId}/review-assignments`,
    {
      groupId: group.id,
      proposalVersionId: p.versionId,
      expectedProposalRevision: workflow.revision,
    },
  );
  p.reviewId = assignment.id;
  if (t.key === "proposal" && i < 6) return;
  let context = assignment;
  context = await action(
    key + "/review-start",
    reviewer,
    "POST",
    `/proposal-reviews/${assignment.id}/start`,
    {
      expectedProposalRevision: context.proposalRevision,
      expectedReviewRevision: context.revision,
    },
  );
  context = await action(
    key + "/review-comment",
    reviewer,
    "POST",
    `/proposal-reviews/${assignment.id}/comments`,
    {
      expectedReviewRevision: context.revision,
      versionId: p.versionId,
      text: "Mục tiêu rõ ràng. Cần chú ý tiêu chí kiểm thử, phân quyền truy cập và chỉ số đánh giá kết quả.",
    },
  );
  if (t.key === "proposal" && i < 8) return;
  await action(
    key + "/review-decision",
    reviewer,
    "POST",
    `/proposal-reviews/${assignment.id}/decision`,
    {
      expectedProposalRevision: context.proposalRevision,
      expectedReviewRevision: context.revision,
      versionId: p.versionId,
      decision:
        t.key === "proposal" && i < 10 ? "REVISION_REQUIRED" : "APPROVED",
      comment:
        t.key === "proposal" && i < 10
          ? "Bổ sung sơ đồ dữ liệu, phạm vi chức năng và kế hoạch kiểm thử trước khi nộp lại."
          : "Đề cương đáp ứng yêu cầu về mục tiêu, nội dung, phạm vi và kế hoạch thực hiện.",
    },
  );
  if (t.key === "proposal") return;
  const dossier = await request(
    "giaovu",
    "GET",
    `/proposals/${proposalId}/dossier`,
  );
  const ready = await action(
    key + "/dossier-finalize",
    "giaovu",
    "POST",
    `/proposals/${proposalId}/finalize`,
    {
      expectedProposalRevision: dossier.proposalRevision,
      expectedDossierRevision: dossier.revision,
      approvedVersionId: p.versionId,
      templateVersion: "project1-docx-individual-v1",
    },
  );
  if (i < 7) return;
  await action(
    key + "/dossier-receive",
    "giaovu",
    "POST",
    `/proposals/${proposalId}/dossier/receipt`,
    {
      expectedRevision: ready.revision,
      finalizationId: ready.currentFinalization.id,
      note: "Đã đối chiếu hồ sơ mẫu, đủ thông tin sinh viên, giảng viên và đề cương được duyệt.",
    },
  );
}
async function proposalStage(t) {
  if (fixture.stages[t.key]) return fixture.stages[t.key];
  await assignments(t);
  const termId = id("term/" + t.key),
    groups = [];
  for (let n = 0; n < 2; n++)
    groups.push(
      await action(
        `${t.key}/group/${n}`,
        "giaovu",
        "POST",
        `/terms/${termId}/review-groups`,
        {
          name: `[MẪU] Nhóm xét duyệt ${n + 1}`,
          departmentId: id("department"),
          memberLecturerIds: lecturers
            .slice(n * 2, n * 2 + 2)
            .map((p) => id(p.key)),
        },
      ),
    );
  const people = [];
  for (const [i, p] of students.entries()) {
    const person = await proposal(t, p, i);
    await review(t, person, i, groups);
    people.push(person);
    console.log(`${t.code}: ${p.code} prepared (${i + 1}/12).`);
  }
  fixture.stages[t.key] = people;
  save();
  return people;
}
async function main() {
  const mode = process.argv.includes("--browser")
    ? "browser"
    : process.argv.includes("--apply")
      ? "apply"
      : process.argv.includes("--verify")
        ? "verify"
        : "plan";
  const roles = await plan();
  if (mode === "plan") return;
  if (mode === "apply")
    assert.equal(
      process.argv[process.argv.indexOf("--target-fingerprint") + 1],
      fingerprint,
      "Use --target-fingerprint from sample:plan to select the configured database explicitly.",
    );
  if (fs.existsSync(marker)) {
    fixture = JSON.parse(fs.readFileSync(marker, "utf8"));
    assert.equal(fixture.namespace, namespace);
    assert.equal(fixture.targetFingerprint, fingerprint);
  } else {
    assert.equal(mode, "apply", "No sample manifest exists yet");
    fixture = {
      namespace,
      targetFingerprint: fingerprint,
      anchor: Date.now(),
      password: "Mau18!" + crypto.randomBytes(9).toString("hex"),
      actions: {},
      stages: {},
      createdAt: new Date().toISOString(),
    };
    save();
  }
  if (mode === "browser") {
    assert(
      fixture.complete,
      "Finish sample:create before checking the browser",
    );
    await startApi(false);
    const { browserCheck } = require("./sample-data/preview.cjs");
    return browserCheck({ root, api, marker });
  }
  if (mode === "verify" || fixture.complete) {
    if (mode === "apply") await metadata();
    const { verify } = require("./sample-data/verify.cjs");
    return verify(db, fixture, root, cache);
  }
  await baseline(roles);
  await metadata();
  await startApi();
  await assignments(terms[0]);
  // Both domains use Serializable transactions. Keep writes sequential even
  // across terms to avoid predicate-lock conflicts on a small shared database.
  await proposalStage(terms[1]);
  const people = await proposalStage(terms[2]);
  await advance(terms[2], "WEEKLY");
  const { guidance } = require("./sample-data/guidance.cjs");
  await guidance({ db, fixture, request, action, save, people, req, backend });
  for (const original of fixture.preserved) {
    const rows = await db[original.model].findMany(
      original.model === "rolePermission"
        ? {}
        : { where: { id: { in: original.ids } } },
    );
    const digest = crypto
      .createHash("sha256")
      .update(JSON.stringify(rows.map((r) => JSON.stringify(r)).sort()))
      .digest("hex");
    assert.equal(
      digest,
      original.hash,
      `Existing ${original.model} changed during preparation; investigate concurrent edits. Sample did not target these rows.`,
    );
  }
  fixture.preservedVerifiedAt = new Date().toISOString();
  fixture.complete = true;
  fixture.completedAt = new Date().toISOString();
  const { verify } = require("./sample-data/verify.cjs");
  await verify(db, fixture, root, cache);
  save();
}
main()
  .catch((error) => {
    // Never dump Prisma errors containing a connection string or credentials.
    const message = String(error.message || error).replace(
      /postgres(?:ql)?:\/\/[^\s"']+/gi,
      "[database URL redacted]",
    );
    console.error(message.slice(0, 2500));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (app) await app.close();
    await db.$disconnect();
  });
