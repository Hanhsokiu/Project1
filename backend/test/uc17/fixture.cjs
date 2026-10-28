"use strict";
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { assertVerifiedClient } = require("./target.cjs");
const id = () => randomUUID();
const code = () => randomUUID().slice(0, 8);

async function makeFixture(db, { legacy = false, configured = true } = {}) {
  assertVerifiedClient(db);
  const roles = {};
  for (const [name, permissions] of Object.entries({
    LECTURER: [
      "guidance:read",
      "defense-confirmation:read",
      "defense-confirmation:decide",
    ],
    STUDENT: [
      "submission:read",
      "submission:create",
      "submission:download",
      "defense-confirmation:read",
    ],
    FACULTY: [
      "defense-list:read",
      "defense-list:manage",
      "defense-confirmation:read",
    ],
    ADMIN: ["defense-confirmation:read"],
  })) {
    const r = await db.role.upsert({
      where: { name },
      create: { id: id(), name },
      update: {},
    });
    roles[name] = r.id;
    for (const permission of permissions) {
      const [resource, action] = permission.split(":");
      const p = await db.permission.upsert({
        where: { resource_action: { resource, action } },
        create: { id: id(), resource, action },
        update: {},
      });
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: r.id, permissionId: p.id } },
        create: { roleId: r.id, permissionId: p.id },
        update: {},
      });
    }
  }
  async function account(role) {
    const userId = id();
    await db.userAccount.create({
      data: {
        id: userId,
        username: `uc17_${code()}`,
        email: `${userId}@example.invalid`,
        displayName: "UC17 synthetic user",
        passwordHash: "fixture-no-password-login",
        status: "ACTIVE",
        mustChangePassword: false,
        userRoles: { create: { roleId: roles[role] } },
      },
    });
    await db.loginSession.create({
      data: {
        id: userId,
        userId,
        refreshToken: id(),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    return userId;
  }
  const advisorUser = await account("LECTURER"),
    otherUser = await account("LECTURER"),
    facultyUser = await account("FACULTY"),
    studentUser = await account("STUDENT"),
    otherStudentUser = await account("STUDENT"),
    adminUser = await account("ADMIN");
  const departmentId = id(),
    trainingSystemId = id(),
    advisorId = id(),
    otherAdvisorId = id();
  await db.department.create({
    data: { id: departmentId, code: code(), name: "UC17 synthetic department" },
  });
  await db.trainingSystem.create({
    data: {
      id: trainingSystemId,
      code: code(),
      name: "UC17 synthetic training",
    },
  });
  for (const [lecturerId, userId] of [
    [advisorId, advisorUser],
    [otherAdvisorId, otherUser],
  ])
    await db.lecturer.create({
      data: {
        id: lecturerId,
        userId,
        departmentId,
        lecturerCode: code(),
        fullName: "Synthetic advisor",
      },
    });
  const studentId = id(),
    otherStudentId = id();
  for (const [sid, userId] of [
    [studentId, studentUser],
    [otherStudentId, otherStudentUser],
  ])
    await db.student.create({
      data: {
        id: sid,
        userId,
        trainingSystemId,
        studentCode: code(),
        fullName: "Synthetic student",
      },
    });
  const termId = id(),
    memberId = id(),
    otherMemberId = id(),
    assignmentId = id(),
    planId = id(),
    proposalId = id();
  const now = new Date(),
    earlier = new Date(now.getTime() - 3600000);
  await db.thesisTerm.create({
    data: {
      id: termId,
      code: code(),
      name: "UC17 isolated integration",
      academicYear: "2026-2027",
      semester: 1,
      trainingSystemId,
      status: "IN_PROGRESS",
      startDate: new Date(now.getTime() - 86400000),
      endDate: new Date(now.getTime() + 86400000),
    },
  });
  await db.termStudent.createMany({
    data: [
      { id: memberId, termId, studentId },
      { id: otherMemberId, termId, studentId: otherStudentId },
    ],
  });
  await db.termLecturer.createMany({
    data: [
      { termId, lecturerId: advisorId },
      { termId, lecturerId: otherAdvisorId },
    ],
  });
  const registration = await db.registration.create({
    data: {
      id: id(),
      termId,
      studentId,
      status: "SUBMITTED",
      submittedAt: earlier,
    },
  });
  await db.assignmentPlan.create({
    data: { id: planId, termId, status: "FINALIZED", publishedAt: earlier },
  });
  await db.assignmentPlanWorkflow.create({
    data: { planId, finalizedAt: earlier, finalizedByUserId: facultyUser },
  });
  await db.termWorkflow.create({
    data: { termId, officialAssignmentPlanId: planId },
  });
  await db.advisorAssignment.create({
    data: {
      id: assignmentId,
      assignmentPlanId: planId,
      registrationId: registration.id,
      advisorId,
    },
  });
  const topicId = id();
  await db.topic.create({
    data: { id: topicId, termId, title: "UC17 synthetic thesis" },
  });
  await db.topicWorkflow.create({
    data: { topicId, termId, termStudentId: memberId },
  });
  await db.proposal.create({
    data: { id: proposalId, topicId, termId, studentId, status: "APPROVED" },
  });
  const facts = {
    termId,
    proposalId,
    studentId,
    studentUser,
    otherStudentId,
    otherStudentUser,
    memberId,
    otherMemberId,
    advisorId,
    advisorUser,
    otherAdvisorId,
    otherUser,
    facultyUser,
    adminUser,
    assignmentId,
    planId,
  };
  if (legacy) {
    const decisionId = id();
    await db.$executeRaw`INSERT INTO public."DEFENSE_CONFIRMATION"
      (id,proposal_id,advisor_id,status,note,confirmed_at) VALUES
      (${decisionId},${proposalId},${advisorId},'CONFIRMED','Synthetic legacy decision',${earlier})`;
    return { ...facts, decisionId, confirmedAt: earlier.toISOString() };
  }
  for (const model of [
    db.finalReportSubmissionWindow,
    db.defenseConfirmationWindow,
  ])
    await model.create({
      data: {
        termId,
        opensAt: earlier,
        closesAt: new Date(now.getTime() + 3600000),
        isLocked: false,
        revision: 1,
      },
    });
  await db.academicTermGrant.create({
    data: { termId, userId: facultyUser, allDepartments: true },
  });
  if (configured)
    await db.defenseList.create({
      data: {
        termId,
        state: "OPEN",
        revision: 1,
        openedAt: now,
        openedByUserId: facultyUser,
        createdAt: now,
        updatedAt: now,
      },
    });
  return facts;
}

async function pdfBytes() {
  const PDFDocument = require("pdfkit");
  return new Promise((resolve) => {
    const chunks = [],
      pdf = new PDFDocument({ compress: false });
    pdf.on("data", (b) => chunks.push(b));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.text("UC17 isolated synthetic thesis PDF");
    pdf.end();
  });
}

async function runtime(db, privateRoot) {
  assertVerifiedClient(db);
  require("reflect-metadata");
  const { Test } = require("@nestjs/testing"),
    { ConfigModule } = require("@nestjs/config");
  const { APP_GUARD, Reflector } = require("@nestjs/core"),
    { JwtService } = require("@nestjs/jwt");
  const { ValidationPipe } = require("@nestjs/common");
  const dist = (p) => require(`../../dist/${p}`);
  const { PrismaModule } = dist("prisma/prisma.module"),
    { PrismaService } = dist("prisma/prisma.service");
  const { CommonModule } = dist("common/common.module");
  const { DefenseConfirmationModule } = dist(
    "guidance/defense-confirmations/defense-confirmation.module",
  );
  const { FinalReportModule } = dist(
    "guidance/final-reports/final-report.module",
  );
  const { DefenseListModule } = dist(
    "defense/defense-lists/defense-list.module",
  );
  const { JwtAuthGuard } = dist("common/security/jwt-auth.guard");
  const { PermissionsGuard } = dist("common/security/permissions.guard");
  const { UserAccountRepository } = dist(
    "auth/repository/user-account.repository",
  );
  const { RbacService } = dist("auth/service/rbac.service");
  const { GlobalExceptionHandler } = dist(
    "common/exception/global-exception.handler",
  );
  const jwt = new JwtService({
      secret: "uc17-isolated-integration-only-secret",
    }),
    users = new UserAccountRepository(db);
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [
          () => ({
            STORAGE_LOCAL_PATH: privateRoot,
            FINAL_REPORT_MAX_FILE_BYTES: 20971520,
          }),
        ],
      }),
      PrismaModule,
      CommonModule,
      DefenseConfirmationModule,
      FinalReportModule,
      DefenseListModule,
    ],
    providers: [
      {
        provide: APP_GUARD,
        useValue: new JwtAuthGuard(new Reflector(), jwt, users),
      },
      {
        provide: APP_GUARD,
        useValue: new PermissionsGuard(new Reflector(), new RbacService(users)),
      },
    ],
  })
    .overrideProvider(PrismaService)
    .useValue(db)
    .compile();
  const app = module.createNestApplication({ logger: false });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionHandler());
  await app.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${app.getHttpServer().address().port}/api`;
  async function request(actor, method, route, body, expected = 200) {
    const headers = actor
      ? { Authorization: `Bearer ${jwt.sign({ sub: actor, sid: actor })}` }
      : {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(base + route, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });
    const payload = await response.json();
    assert.equal(
      response.status,
      expected,
      `${method} ${route}: ${JSON.stringify(payload)}`,
    );
    return payload.data;
  }
  return {
    app,
    module,
    base,
    jwt,
    request,
    command: module.get(
      dist(
        "guidance/defense-confirmations/defense-confirmation-command.service",
      ).DefenseConfirmationCommandService,
    ),
    read: module.get(
      dist("guidance/defense-confirmations/defense-confirmation-read.service")
        .DefenseConfirmationReadService,
    ),
    download: module.get(
      dist("guidance/defense-confirmations/defense-confirmation-report.service")
        .DefenseConfirmationReportService,
    ),
    reports: module.get(
      dist("guidance/final-reports/final-report.service").FinalReportService,
    ),
    storage: module.get(
      dist("common/storage/file-storage.service").FileStorageService,
    ),
    reader: module.get(
      dist("common/contracts/uc18-finalization.port").Uc18FinalizationReader,
    ),
  };
}

function file(bytes) {
  return {
    originalname: "Thesis final.pdf",
    mimetype: "application/pdf",
    size: bytes.length,
    buffer: bytes,
  };
}
function putInput(context, status = "CONFIRMED", changeReason) {
  return {
    status,
    expectedRevision: context.expectedRevision,
    expectedContext: context.expectedContext,
    ...(status === "REJECTED" ? { note: "Synthetic rejection reason" } : {}),
    ...(changeReason ? { changeReason } : {}),
  };
}
module.exports = { makeFixture, runtime, pdfBytes, file, putInput };
