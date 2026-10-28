// Opt-in integration test. Only a newly created, isolated local database is accepted.
const assert = require("node:assert/strict");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { spawnSync } = require("node:child_process");

async function main() {
  const target = new URL(process.env.ASSIGNMENT_TEST_URL || "invalid:");
  assert(["postgres:", "postgresql:"].includes(target.protocol));
  assert(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname));
  assert(/^\/btl_assignment_worker_[a-zA-Z0-9_]+$/.test(target.pathname));
  Object.assign(process.env, {
    DATABASE_URL: target.toString(),
    DIRECT_URL: target.toString(),
    NODE_ENV: "test",
    JWT_SECRET: randomBytes(32).toString("hex"),
    JWT_REFRESH_SECRET: randomBytes(32).toString("hex"),
    EMAIL_WORKER_ENABLED: "false",
    ASSIGNMENT_WORKER_ENABLED: "true",
  });
  const { PrismaClient } = require("@prisma/client");
  const initial = new PrismaClient();
  try {
    const [tables] = await initial.$queryRawUnsafe(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
    );
    assert.equal(
      tables.n,
      0,
      "Create a new empty test database; this runner never resets a database",
    );
  } finally {
    await initial.$disconnect();
  }
  const migration = spawnSync(
    process.execPath,
    [
      require.resolve("prisma/build/index.js"),
      "migrate",
      "deploy",
      "--schema",
      path.resolve(__dirname, "../prisma/schema.prisma"),
    ],
    {
      cwd: path.resolve(__dirname, ".."),
      env: process.env,
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(
    migration.status,
    0,
    "Migration deploy failed on the isolated test database",
  );

  const { NestFactory } = require("@nestjs/core");
  const { SchedulerRegistry } = require("@nestjs/schedule");
  const { AppModule } = require("../dist/app.module");
  const { PrismaService } = require("../dist/prisma/prisma.service");
  const {
    AssignmentRepository,
  } = require("../dist/registration/repository/assignment.repository");
  const {
    AssignmentPlanService,
  } = require("../dist/registration/service/assignment-plan.service");
  const {
    AssignmentWorkerService,
  } = require("../dist/registration/service/assignment-worker.service");
  const app = await NestFactory.create(AppModule, {
    logger: false,
  });
  const scheduler = app.get(SchedulerRegistry);
  const db = app.get(PrismaService);
  const repo = app.get(AssignmentRepository);
  const service = app.get(AssignmentPlanService);
  const worker = app.get(AssignmentWorkerService);
  try {
    const system = await db.trainingSystem.create({
      data: { code: "AUTO", name: "Synthetic program" },
    });
    const department = await db.department.create({
      data: { code: "AUTO", name: "Synthetic department" },
    });
    const area = await db.researchArea.create({
      data: { name: "Synthetic assignment area" },
    });
    const actor = await db.userAccount.create({
      data: {
        username: "faculty",
        passwordHash: "synthetic-not-a-login-hash",
        status: "ACTIVE",
      },
    });
    const advisors = [];
    for (let i = 0; i < 2; i++)
      advisors.push(
        await db.lecturer.create({
          data: {
            lecturerCode: `AUTO-GV-${i}`,
            fullName: `Synthetic advisor ${i}`,
            department: { connect: { id: department.id } },
            user: {
              create: {
                username: `advisor-${i}`,
                email: `advisor-${i}@example.test`,
                passwordHash: "synthetic-not-a-login-hash",
                status: "ACTIVE",
              },
            },
            researchAreas: { create: { researchAreaId: area.id } },
          },
        }),
      );
    const students = [];
    for (let i = 0; i < 4; i++)
      students.push(
        await db.student.create({
          data: {
            studentCode: `AUTO-SV-${i}`,
            fullName: `Synthetic student ${i}`,
            className: "AUTO",
            trainingSystem: { connect: { id: system.id } },
            gpa: 3.9 - i * 0.2,
            user: {
              create: {
                username: `student-${i}`,
                email: `student-${i}@example.test`,
                phone: "0912345678",
                passwordHash: "synthetic-not-a-login-hash",
                status: "ACTIVE",
                mustChangePassword: false,
              },
            },
          },
        }),
      );

    async function term(label, options = {}) {
      const at = Date.now();
      const created = await db.thesisTerm.create({
        data: {
          code: `AUTO-${label}`,
          name: `Synthetic ${label}`,
          academicYear: "2026-2027",
          semester: 1,
          trainingSystemId: system.id,
          status: options.status || "CLOSED_REGISTRATION",
          isLocked: options.locked || false,
          startDate: new Date(at - 3600000),
          endDate: new Date(at + 86400000),
          phases: {
            create: {
              phaseName: "Assignment",
              code: "ASSIGNMENT",
              isLocked: options.phaseLocked || false,
              startDate: new Date(at + (options.startOffset ?? -60000)),
              endDate: new Date(at + (options.endOffset ?? 3600000)),
            },
          },
          termStudents: { create: students.map((s) => ({ studentId: s.id })) },
          termLecturers: {
            create: advisors.map((a) => ({ lecturerId: a.id, quota: 1 })),
          },
        },
        include: { phases: true },
      });
      if (!options.empty)
        for (const student of students.slice(0, 3))
          await db.registration.create({
            data: {
              termId: created.id,
              studentId: student.id,
              directionId: area.id,
              status: "SUBMITTED",
              submittedAt: new Date(at - 120000),
              preferences: {
                create: advisors.map((a, i) => ({
                  lecturerId: a.id,
                  preferenceOrder: i + 1,
                })),
              },
            },
          });
      return created;
    }

    const ready = await term("READY");
    const future = await term("FUTURE", { startOffset: 600000 });
    const open = await term("OPEN", { status: "OPEN_REGISTRATION" });
    const locked = await term("LOCKED", { locked: true });
    const phaseLocked = await term("PHASE-LOCKED", { phaseLocked: true });
    const expired = await term("EXPIRED", { endOffset: -1 });
    const official = await term("OFFICIAL");
    await db.assignmentPlan.create({
      data: { termId: official.id, status: "PUBLISHED" },
    });
    assert.deepEqual(
      (await repo.dueForAutomaticDraft()).map((t) => t.id),
      [ready.id],
    );
    assert.equal(await service.createAutomaticDraft(locked.id), null);

    // Lifecycle hooks run after fixtures are ready. Startup must catch up.
    await app.init();
    const saved = await db.assignmentPlan.findFirst({
      where: { termId: ready.id },
      include: { advisorAssignments: true },
    });
    assert(saved, "Startup did not create the overdue draft");
    assert.equal(saved.status, "DRAFT");
    assert.equal(saved.advisorAssignments.length, 2);
    assert(
      saved.advisorAssignments.every((a) => a.registrationId && !a.isManual),
    );
    assert.equal(
      await db.auditLog.count({
        where: {
          action: "ASSIGNMENT_AUTO_DRAFT_SAVED",
          userId: null,
          resourceId: saved.id,
        },
      }),
      1,
    );
    const manager = await service.view(ready.id, actor.id, true);
    assert.equal(manager.missingSubmissions.length, 1);
    assert.equal(
      manager.results.filter((r) => !r.assignedLecturerId).length,
      1,
    );
    assert.equal(
      (await db.thesisTerm.findUniqueOrThrow({ where: { id: ready.id } }))
        .status,
      "CLOSED_REGISTRATION",
    );
    console.log(
      "PASS startup catch-up, GPA/quota algorithm, missing submissions and system audit",
    );

    const assignment = saved.advisorAssignments[0];
    const registration = await db.registration.findUniqueOrThrow({
      where: { id: assignment.registrationId },
    });
    await service.adjust(
      ready.id,
      {
        studentId: registration.studentId,
        lecturerId: assignment.advisorId,
        reason: "Synthetic faculty adjustment",
        revision: 1,
      },
      actor.id,
    );
    const before = await db.advisorAssignment.findMany({
      where: { assignmentPlanId: saved.id },
      orderBy: { id: "asc" },
    });
    await worker.tick();
    assert.deepEqual(
      await db.advisorAssignment.findMany({
        where: { assignmentPlanId: saved.id },
        orderBy: { id: "asc" },
      }),
      before,
    );
    assert.equal(
      (await db.assignmentPlan.findUniqueOrThrow({ where: { id: saved.id } }))
        .revision,
      2,
    );
    assert.equal(
      await db.auditLog.count({
        where: { action: "ASSIGNMENT_AUTO_DRAFT_SAVED", resourceId: saved.id },
      }),
      1,
    );
    for (const blocked of [future, open, locked, phaseLocked, expired])
      assert.equal(
        await db.assignmentPlan.count({ where: { termId: blocked.id } }),
        0,
      );
    console.log(
      "PASS blocked windows, repeated runs and manual adjustment preservation",
    );

    await db.termPhase.update({
      where: { id: future.phases[0].id },
      data: { startDate: new Date(Date.now() - 1) },
    });
    // Exercise the registered interval, without calling tick or bootstrap.
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (await db.assignmentPlan.count({ where: { termId: future.id } }))
        break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.equal(
      await db.assignmentPlan.count({
        where: { termId: future.id, status: "DRAFT" },
      }),
      1,
    );
    for (const name of scheduler.getIntervals()) scheduler.deleteInterval(name);
    const racing = await term("RACE");
    const concurrent = await Promise.all([
      service.createAutomaticDraft(racing.id),
      service.createAutomaticDraft(racing.id),
    ]);
    assert.equal(concurrent.filter(Boolean).length, 1);
    assert.equal(
      await db.assignmentPlan.count({ where: { termId: racing.id } }),
      1,
    );
    const racePlan = await db.assignmentPlan.findFirstOrThrow({
      where: { termId: racing.id },
    });
    assert.equal(
      await db.auditLog.count({
        where: {
          action: "ASSIGNMENT_AUTO_DRAFT_SAVED",
          resourceId: racePlan.id,
        },
      }),
      1,
    );
    assert.equal(await db.notification.count(), 0);
    assert.equal(await db.emailOutbox.count(), 0);
    console.log(
      "PASS actual interval, concurrent creation, one draft/audit and no automatic publication/email",
    );
  } finally {
    await app.close();
  }
}
main().catch((error) => {
  console.error(
    String(error.message).replace(
      /postgres(?:ql)?:\/\/[^\s]+/gi,
      "[REDACTED_URL]",
    ),
  );
  process.exitCode = 1;
});
