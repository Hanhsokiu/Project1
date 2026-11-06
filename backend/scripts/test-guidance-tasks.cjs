"use strict";
const { prepareFixtureSessions } = require('./integration/auth-fixture.cjs');
// Step 8A real HTTP/PostgreSQL tests. Requires a new dedicated loopback DB.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict"),
  { spawnSync } = require("node:child_process");
const { testTarget } = require("./rehearse-pr2b.cjs");
async function main() {
  const url = testTarget(process.env.PR2B_TEST_URL),
    backend = path.resolve(__dirname, "..");
  Object.assign(process.env, {
    DATABASE_URL: url.toString(),
    DIRECT_URL: url.toString(),
    NODE_ENV: "test",
    JWT_SECRET: crypto.randomBytes(32).toString("hex"),
    JWT_REFRESH_SECRET: crypto.randomBytes(32).toString("hex"),
  });
  const { PrismaClient } = require("@prisma/client"),
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  let app;
  const checks = [],
    pass = (name) => {
      checks.push({ name, result: "PASS" });
      console.log("PASS " + name);
    };
  try {
    const [identity] =
      await db.$queryRaw`SELECT current_database() AS db,current_setting('server_version_num') AS version`;
    assert.equal(identity.db, url.pathname.slice(1));
    assert.equal(Math.floor(Number(identity.version) / 10000), 17);
    const [tables] =
      await db.$queryRaw`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`;
    assert.equal(tables.n, 0, "New empty isolated database required");
    const prelude = spawnSync(
      process.execPath,
      [path.join(__dirname, "test-proposal-dossiers.cjs")],
      { cwd: backend, env: process.env, encoding: "utf8", windowsHide: true },
    );
    assert.equal(
      prelude.status,
      0,
      "Step 7 producer failed: " + prelude.stdout + " " + prelude.stderr,
    );
    pass(
      "active migration chain and all Step 7/Step 5 API checks supply a real finalized dossier",
    );
    const grant = await db.academicTermGrant.findUnique({
      where: { userId_termId: { userId: "f", termId: "t1" } },
    });
    await db.grantDepartment.create({
      data: { grantId: grant.id, departmentId: "d1" },
    });
    const permissions = await db.permission.findMany({
      where: { resource: { in: ["guidance", "task"] } },
    });
    for (const roleId of ["FACULTY", "LECTURER", "STUDENT", "ADMIN"])
      for (const p of permissions) {
        const allowed =
          roleId === "ADMIN" ||
          (p.resource === "guidance" && p.action === "read") ||
          (roleId === "LECTURER" &&
            ((p.resource === "guidance" && p.action === "manage") ||
              (p.resource === "task" &&
                ["manage", "ensure-weekly"].includes(p.action)))) ||
          (roleId === "STUDENT" &&
            p.resource === "task" &&
            ["progress", "ensure-weekly"].includes(p.action));
        if (allowed)
          await db.rolePermission.upsert({
            where: { roleId_permissionId: { roleId, permissionId: p.id } },
            create: { roleId, permissionId: p.id },
            update: {},
          });
      }
    const { NestFactory } = require("@nestjs/core"),
      { ValidationPipe } = require("@nestjs/common"),
      { JwtService } = require("@nestjs/jwt"),
      { AppModule } = require("../dist/app.module");
    app = await NestFactory.create(AppModule, {
      logger: false,
      abortOnError: false,
    });
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await prepareFixtureSessions(db);
    await app.listen(0, "127.0.0.1");
    const jwt = new JwtService({ secret: process.env.JWT_SECRET }),
      base = "http://127.0.0.1:" + app.getHttpServer().address().port + "/api";
    async function req(
      actor,
      method,
      route,
      body,
      status = 200,
      key = crypto.randomUUID(),
    ) {
      const headers = {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      };
      if (actor)
        headers.Authorization =
          "Bearer " +
          jwt.sign({ sub: actor, sid: actor, roles: ["ADMIN", "FACULTY", "LECTURER"] });
      const response = await fetch(base + route, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(30000),
        }),
        payload = await response.json();
      assert(
        (Array.isArray(status) ? status : [status]).includes(response.status),
        `${method} ${route}: expected ${status}, got ${response.status}: ${JSON.stringify(payload)}`,
      );
      return {
        data: payload.data,
        code: payload.error?.code,
        status: response.status,
      };
    }
    const context = async (actor = "advisor", id = "p2") =>
      (await req(actor, "GET", `/proposals/${id}/guidance-context`)).data;
    const getTask = async (id, actor = "advisor") =>
      (await req(actor, "GET", `/tasks/${id}`)).data;
    await req(null, "GET", "/proposals/p2/guidance-context", undefined, 401);
    for (const actor of ["s1", "s9", "a", "out", "f2", "fd2", "admin"])
      await req(actor, "GET", "/proposals/p2/guidance-context", undefined, 404);
    let c = await context();
    assert(c.readiness.includes("INPUT_NOT_READY"));
    assert.equal(c.canCreate, false);
    const planInput = {
      finalizationId: c.currentFinalizationId,
      expectedDossierRevision: c.dossierRevision,
      description: "Kế hoạch hướng dẫn kiểm thử",
    };
    assert.equal(
      (
        await req(
          "advisor",
          "POST",
          "/proposals/p2/guidance-plan",
          planInput,
          409,
        )
      ).code,
      "INPUT_NOT_READY",
    );
    pass(
      "no implicit ADMIN/reviewer/cross-term/department access; missing GUIDANCE phase blocks plan creation",
    );
    const term = await db.thesisTerm.findUnique({ where: { id: "t1" } }),
      now = Date.now();
    await db.termPhase.create({
      data: {
        id: "step8a-guidance-phase",
        termId: "t1",
        phaseName: "Synthetic guidance phase",
        startDate: term.startDate,
        endDate: term.endDate,
        pr2bTermPhaseWorkflowPhaseId: {
          create: { termId: "t1", key: "GUIDANCE" },
        },
      },
    });
    const periods = [
      {
        id: "step8a-w1",
        termId: "t1",
        ordinal: 1,
        label: "Tuần 1",
        type: "WEEK",
        startsAt: term.startDate,
        endsAt: new Date(now - 3600000),
        reportDueAt: new Date(now - 7200000),
      },
      {
        id: "step8a-w2",
        termId: "t1",
        ordinal: 2,
        label: "Tuần 2",
        type: "WEEK",
        startsAt: new Date(now + 7200000),
        endsAt: term.endDate,
        reportDueAt: new Date(now + 43200000),
      },
      {
        id: "step8a-m1",
        termId: "t1",
        ordinal: 3,
        label: "Mốc phân tích",
        type: "MILESTONE",
        startsAt: term.startDate,
        endsAt: term.endDate,
      },
      {
        id: "step8a-foreign",
        termId: "t2",
        ordinal: 1,
        label: "Mốc đợt khác",
        type: "MILESTONE",
        startsAt: term.startDate,
        endsAt: term.endDate,
      },
    ];
    for (const p of periods) await db.guidancePeriod.create({ data: p });
    for (const p of periods.slice(0, 2)) {
      await db.periodRequiredStudent.create({
        data: { periodId: p.id, termStudentId: "ts2", termId: "t1" },
      });
      await db.weeklyReportObligation.create({
        data: {
          id: p.id + "-obligation",
          periodId: p.id,
          termStudentId: "ts2",
          configRevision: 0,
          configSnapshot: {
            schemaVersion: 1,
            termId: "t1",
            periodId: p.id,
            termStudentId: "ts2",
            periodRevision: 0,
            startsAt: p.startsAt.toISOString(),
            reportDueAt: p.reportDueAt.toISOString(),
            expectedDeliverables:
              "Báo cáo tiến độ và source theo cấu hình tuần",
          },
        },
      });
    }
    await db.periodRequiredStudent.create({
      data: { periodId: periods[0].id, termStudentId: "ts1", termId: "t1" },
    });
    let coverage = (await req("s2", "GET", "/terms/t1/weekly-report-coverage"))
      .data;
    assert.equal(coverage.data.length, 2);
    assert(
      coverage.data.every(
        (r) => r.missingPlan && r.missingTask && !r.canEnsure,
      ),
    );
    assert.equal(
      coverage.data.find((r) => r.periodId === periods[0].id).submissionState,
      "MISSING",
    );
    assert(coverage.data.find((r) => r.periodId === periods[0].id).isOverdue);
    assert.equal(
      coverage.data.find((r) => r.periodId === periods[1].id).submissionState,
      "NOT_DUE",
    );
    const facultyCoverage = (
      await req("f", "GET", "/terms/t1/weekly-report-coverage")
    ).data;
    assert.equal(facultyCoverage.coverageState, "NOT_CONFIGURED");
    assert(facultyCoverage.data.some((r) => r.missingObligationRecord));
    assert.equal(await db.guidancePlan.count(), 0);
    assert.equal(await db.task.count(), 0);
    pass(
      "weekly coverage detects overdue/missing obligations without plan or task; GET never creates data or false completion",
    );
    await req("f", "POST", "/proposals/p2/guidance-plan", planInput, 403);
    await req("s2", "POST", "/proposals/p2/guidance-plan", planInput, 403);
    const invalidC = await context("advisor", "p1");
    assert(invalidC.readiness.includes("DOSSIER_NOT_FINALIZED"));
    await req(
      "advisor",
      "POST",
      "/proposals/p1/guidance-plan",
      { finalizationId: c.currentFinalizationId, expectedDossierRevision: 0 },
      409,
    );
    await req(
      "advisor",
      "POST",
      "/proposals/p2/guidance-plan",
      { ...planInput, finalizationId: "foreign" },
      409,
    );
    await req(
      "advisor",
      "POST",
      "/proposals/p2/guidance-plan",
      { ...planInput, expectedDossierRevision: 0 },
      409,
    );
    pass(
      "only current official advisor creates a plan for the current finalized dossier, exact revision and finalization ID",
    );
    const contenders = await Promise.all([
      req(
        "advisor",
        "POST",
        "/proposals/p2/guidance-plan",
        planInput,
        [201, 409],
      ),
      req(
        "advisor",
        "POST",
        "/proposals/p2/guidance-plan",
        planInput,
        [201, 409],
      ),
    ]);
    assert.deepEqual(contenders.map((r) => r.status).sort(), [201, 409]);
    c = await context();
    const planId = c.plan.id;
    assert.equal(c.plan.state, "ACTIVE");
    assert.equal(await db.guidancePlan.count(), 1);
    assert.equal(
      await db.planHistory.count({ where: { planId, action: "PLAN_CREATED" } }),
      1,
    );
    const winningPlanKey = await db.idempotencyRecord.findFirst({
      where: { route: "/proposals/p2/guidance-plan" },
    });
    await req(
      "advisor",
      "POST",
      "/proposals/p2/guidance-plan",
      planInput,
      201,
      winningPlanKey.key,
    );
    assert.equal(await db.guidancePlan.count(), 1);
    pass(
      "concurrent/idempotent plan creation commits one ACTIVE plan with finalization/assignment revision and audit",
    );
    const input = {
      expectedPlanRevision: c.plan.revision,
      title: "Phân tích và thiết kế",
      description: "Mô tả nhiệm vụ ban đầu",
      expectedDeliverables: "Tài liệu và sơ đồ thiết kế",
      periodId: "step8a-m1",
      startDate: new Date(now - 3600000).toISOString(),
      dueDate: new Date(now + 3600000).toISOString(),
    };
    assert.equal(
      (
        await req(
          "advisor",
          "POST",
          `/guidance-plans/${planId}/tasks`,
          { ...input, periodId: "step8a-foreign" },
          409,
        )
      ).code,
      "PERIOD_INVALID",
    );
    assert.equal(
      (
        await req(
          "advisor",
          "POST",
          `/guidance-plans/${planId}/tasks`,
          { ...input, dueDate: term.endDate.toISOString() },
          409,
        )
      ).code,
      "DEADLINE_OUTSIDE_PHASE",
    );
    await req(
      "advisor",
      "POST",
      `/guidance-plans/${planId}/tasks`,
      { ...input, startDate: "2026-10-22T10:00" },
      400,
    );
    await req(
      "advisor",
      "POST",
      `/guidance-plans/${planId}/tasks`,
      { ...input, status: "COMPLETED" },
      400,
    );
    await req("s2", "POST", `/guidance-plans/${planId}/tasks`, input, 403);
    pass(
      "task DTO rejects timezone-less input/forged status; foreign period and exclusive phase deadline are blocked",
    );
    const taskRace = await Promise.all([
      req(
        "advisor",
        "POST",
        `/guidance-plans/${planId}/tasks`,
        input,
        [201, 409],
      ),
      req(
        "advisor",
        "POST",
        `/guidance-plans/${planId}/tasks`,
        { ...input, title: "Đồng thời" },
        [201, 409],
      ),
    ]);
    assert.deepEqual(taskRace.map((r) => r.status).sort(), [201, 409]);
    let t = taskRace.find((r) => r.status === 201).data;
    assert.equal(t.status, "TODO");
    assert.equal(t.kind, "AD_HOC");
    assert.equal(t.advisorId, "advisor");
    assert.equal(t.termStudentId, "ts2");
    assert.equal(t.periodId, input.periodId);
    assert.equal(await db.task.count(), 1);
    await assert.rejects(
      db.taskWorkflow.update({
        where: { taskId: t.id },
        data: { periodId: "step8a-foreign" },
      }),
    );
    await assert.rejects(
      db.task.update({
        where: { id: t.id },
        data: { deadline: new Date(now - 7200000) },
      }),
    );
    pass(
      "concurrent task creation uses plan CAS; DB scope/date constraints reject cross-term and inverted ranges",
    );
    const progressInput = {
        expectedRevision: t.revision,
        note: "Đã nghiên cứu yêu cầu",
      },
      progressKey = crypto.randomUUID();
    t = (
      await req(
        "s2",
        "POST",
        `/tasks/${t.id}/progress`,
        progressInput,
        200,
        progressKey,
      )
    ).data;
    assert.equal(t.status, "IN_PROGRESS");
    await req(
      "s2",
      "POST",
      `/tasks/${t.id}/progress`,
      progressInput,
      200,
      progressKey,
    );
    assert.equal(
      await db.taskProgressEvent.count({ where: { taskId: t.id } }),
      1,
    );
    await req(
      "s2",
      "POST",
      `/tasks/${t.id}/progress`,
      { expectedRevision: t.revision, note: "Xong", status: "COMPLETED" },
      400,
    );
    await req(
      "advisor",
      "POST",
      `/tasks/${t.id}/progress`,
      { expectedRevision: t.revision, note: "Thay SV" },
      403,
    );
    await req(
      "s1",
      "POST",
      `/tasks/${t.id}/progress`,
      { expectedRevision: t.revision, note: "Trái quyền" },
      404,
    );
    pass(
      "owner student starts/appends progress with idempotency; no self-completion or advisor impersonation",
    );
    for (const actor of ["s1", "s9", "a", "admin", "f2", "fd2"]) {
      await req(actor, "GET", `/tasks/${t.id}`, undefined, 404);
      await req(actor, "GET", `/tasks/plan/${planId}`, undefined, 404);
    }
    await req(null, "GET", `/tasks/plan/${planId}`, undefined, 401);
    const legacy = (await req("s2", "GET", `/tasks/plan/${planId}`)).data;
    assert(Array.isArray(legacy));
    assert.equal(legacy[0].id, t.id);
    assert(Array.isArray(legacy[0].submissions));
    pass(
      "canonical and legacy task read routes both enforce owner/advisor/faculty scope; legacy array envelope remains compatible",
    );
    const updateA = {
        expectedRevision: t.revision,
        title: "Thiết kế đã điều chỉnh",
        reason: "Làm rõ yêu cầu",
      },
      updateB = { ...updateA, title: "Xung đột" };
    const updates = await Promise.all([
      req("advisor", "PATCH", `/tasks/${t.id}`, updateA, [200, 409]),
      req("advisor", "PATCH", `/tasks/${t.id}`, updateB, [200, 409]),
    ]);
    assert.deepEqual(updates.map((r) => r.status).sort(), [200, 409]);
    t = await getTask(t.id);
    assert.equal(t.history.length, 2);
    t = (
      await req(
        "advisor",
        "PATCH",
        `/tasks/${t.id}`,
        {
          expectedRevision: t.revision,
          dueDate: new Date(now - 1800000).toISOString(),
          reason: "Điều chỉnh mốc thực tế",
        },
        200,
      )
    ).data;
    assert(t.isOverdue);
    assert.equal(t.status, "IN_PROGRESS");
    const filtered = (
      await req(
        "f",
        "GET",
        "/terms/t1/guidance-tasks?status=IN_PROGRESS&isOverdue=true&periodId=step8a-m1",
      )
    ).data;
    assert.equal(filtered.total, 1);
    assert.equal(filtered.overdueTotal, 1);
    assert.equal(filtered.data[0].id, t.id);
    assert.equal(
      (await req("s2", "GET", `/guidance-plans/${planId}/tasks?status=TODO`))
        .data.total,
      0,
    );
    await req("admin", "GET", "/terms/t1/guidance-tasks", undefined, 404);
    pass(
      "concurrent task amendments preserve history; overdue derives from deadline without replacing workflow; scoped filters work",
    );
    t = (
      await req("s2", "POST", `/tasks/${t.id}/progress`, {
        expectedRevision: t.revision,
        note: "Tiếp tục dù đã quá hạn",
      })
    ).data;
    assert(t.isOverdue);
    assert.equal(t.status, "IN_PROGRESS");
    pass("overdue alone never blocks progress while GUIDANCE remains open");
    const oldSubmission = await db.taskSubmission.create({
      data: {
        taskId: t.id,
        content: "Synthetic historical evidence; no upload endpoint",
      },
    });
    assert.equal(
      (
        await req(
          "advisor",
          "PATCH",
          `/tasks/${t.id}`,
          {
            expectedRevision: t.revision,
            title: "Sửa có bài",
            reason: "Điều chỉnh",
          },
          409,
        )
      ).code,
      "ACKNOWLEDGEMENT_REQUIRED",
    );
    t = (
      await req("advisor", "PATCH", `/tasks/${t.id}`, {
        expectedRevision: t.revision,
        title: "Sửa có bài",
        reason: "Điều chỉnh có xác nhận",
        acknowledgeExistingSubmissions: true,
      })
    ).data;
    assert.deepEqual(
      await db.taskSubmission.findUnique({ where: { id: oldSubmission.id } }),
      oldSubmission,
    );
    pass(
      "editing a task with existing evidence requires explicit acknowledgement and never changes the old submission",
    );
    coverage = (await req("s2", "GET", "/terms/t1/weekly-report-coverage"))
      .data;
    let row = coverage.data.find((r) => r.periodId === "step8a-w1");
    assert(row.canEnsure && row.missingTask && row.isOverdue);
    assert.equal(row.submissionState, "MISSING");
    const weeklyInput = {
        expectedObligationRevision: row.obligationRevision,
        expectedPlanRevision: row.planRevision,
      },
      weeklyKey = crypto.randomUUID();
    let weekly = (
      await req(
        "s2",
        "POST",
        `/weekly-report-obligations/${row.obligationId}/task`,
        weeklyInput,
        201,
        weeklyKey,
      )
    ).data;
    assert.equal(weekly.kind, "WEEKLY_REPORT");
    assert.equal(weekly.status, "TODO");
    assert(weekly.isOverdue);
    await req(
      "s2",
      "POST",
      `/weekly-report-obligations/${row.obligationId}/task`,
      weeklyInput,
      201,
      weeklyKey,
    );
    assert.equal(
      await db.taskWorkflow.count({
        where: { obligationId: row.obligationId },
      }),
      1,
    );
    assert.equal(
      (
        await req("s2", "GET", "/terms/t1/weekly-report-coverage")
      ).data.data.find((r) => r.periodId === "step8a-w1").submissionState,
      "MISSING",
    );
    assert.equal(
      (
        await req(
          "advisor",
          "PATCH",
          `/tasks/${weekly.id}`,
          {
            expectedRevision: weekly.revision,
            dueDate: input.dueDate,
            reason: "Không được lệch tuần",
          },
          409,
        )
      ).code,
      "WEEKLY_REQUIREMENT_IMMUTABLE",
    );
    await assert.rejects(
      db.task.create({
        data: {
          guidancePlanId: planId,
          title: "Duplicate weekly",
          deadline: new Date(input.dueDate),
          pr2bTaskWorkflowTaskId: {
            create: {
              planId,
              periodId: "step8a-w1",
              obligationId: row.obligationId,
              kind: "WEEKLY_REPORT",
              state: "TODO",
            },
          },
        },
      }),
    );
    pass(
      "explicit weekly materialization is unique/idempotent, uses configured dates/deliverables and never counts as a report",
    );
    weekly = (
      await req("advisor", "POST", `/tasks/${weekly.id}/cancel`, {
        expectedRevision: weekly.revision,
        reason: "Thay nhiệm vụ tuần",
      })
    ).data;
    assert.equal(weekly.status, "CANCELLED");
    assert.equal(weekly.isOverdue, false);
    row = (
      await req("s2", "GET", "/terms/t1/weekly-report-coverage")
    ).data.data.find((r) => r.periodId === "step8a-w1");
    assert(row.missingTask && row.isOverdue && row.canEnsure);
    assert.equal(row.submissionState, "MISSING");
    const replacement = (
      await req(
        "advisor",
        "POST",
        `/weekly-report-obligations/${row.obligationId}/task`,
        {
          expectedObligationRevision: row.obligationRevision,
          expectedPlanRevision: row.planRevision,
        },
        201,
      )
    ).data;
    assert.notEqual(replacement.id, weekly.id);
    assert.equal(
      await db.taskWorkflow.count({
        where: { obligationId: row.obligationId, state: { not: "CANCELLED" } },
      }),
      1,
    );
    pass(
      "cancelling weekly work preserves obligation/history and allows one replacement, without exempting missing report",
    );
    const beforeProgress = await db.taskProgressEvent.count({
      where: { taskId: replacement.id },
    });
    let ready, release;
    const held = new Promise((r) => (ready = r)),
      gate = new Promise((r) => (release = r));
    const locker = db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM public."TERM_PHASE" WHERE id='step8a-guidance-phase' FOR UPDATE`;
        ready();
        await gate;
        await tx.termPhase.update({
          where: { id: "step8a-guidance-phase" },
          data: { isLocked: true },
        });
      },
      { timeout: 20000 },
    );
    await held;
    const pending = req(
      "s2",
      "POST",
      `/tasks/${replacement.id}/progress`,
      {
        expectedRevision: replacement.revision,
        note: "Không được commit sau khóa",
      },
      409,
    );
    let waiter = false;
    for (let i = 0; i < 80; i++) {
      const rows =
        await db.$queryRaw`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%TERM_PHASE%'`;
      if (rows.length) {
        waiter = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    release();
    await locker;
    const lockedResult = await pending;
    assert(waiter, "Expected real lock contention");
    assert.equal(lockedResult.code, "TERM_003");
    assert.equal(
      await db.taskProgressEvent.count({ where: { taskId: replacement.id } }),
      beforeProgress,
    );
    await db.termPhase.update({
      where: { id: "step8a-guidance-phase" },
      data: { isLocked: false },
    });
    pass(
      "concurrent phase lock serializes with progress commit and leaves no late audit/progress write",
    );
    const meta = await db.dossierWorkflow.findFirst({
      where: { refDossierId: { proposalId: "p2" } },
    });
    await db.dossierWorkflow.update({
      where: { id: meta.id },
      data: { state: "REOPENED" },
    });
    c = await context();
    assert(c.plan.readiness.includes("DOSSIER_NOT_FINALIZED"));
    await req(
      "advisor",
      "POST",
      `/guidance-plans/${planId}/tasks`,
      { ...input, expectedPlanRevision: c.plan.revision },
      409,
    );
    await db.dossierWorkflow.update({
      where: { id: meta.id },
      data: { state: "RECEIVED" },
    });
    pass(
      "invalid/reopened dossier blocks new task mutation even when plan metadata still claims ACTIVE",
    );
    const assignment = await db.advisorAssignment.findUnique({
        where: { assignmentPlanId_registrationId: { assignmentPlanId: "plan-t1", registrationId: "reg2" } },
      }),
      planBefore = await db.guidancePlanWorkflow.findUnique({
        where: { planId },
      }),
      oldTasks = await db.task.findMany({ where: { guidancePlanId: planId } });
    await db.$transaction(async (tx) => {
      await tx.advisorAssignment.update({
        where: { id: assignment.id },
        data: { advisorId: "b" },
      });
      await tx.assignmentChange.create({
        data: {
          assignmentId: assignment.id,
          assignmentRevision: 1,
          oldAdvisorId: "advisor",
          newAdvisorId: "b",
          actorId: "f",
          effectiveAt: new Date(),
          reason: "Synthetic handover producer",
        },
      });
      await tx.guidancePlanWorkflow.update({
        where: { planId },
        data: { state: "PAUSED", revision: { increment: 1 } },
      });
    });
    await req("advisor", "GET", `/tasks/${replacement.id}`, undefined, 404);
    await req("advisor", "GET", `/tasks/plan/${planId}`, undefined, 404);
    c = await context("b");
    assert.equal(c.plan.state, "PAUSED");
    await req(
      "b",
      "POST",
      `/guidance-plans/${planId}/tasks`,
      { ...input, expectedPlanRevision: c.plan.revision },
      409,
    );
    const resumeInput = {
      expectedRevision: c.plan.revision,
      finalizationId: c.currentFinalizationId,
      expectedDossierRevision: c.dossierRevision,
      acknowledgeRebase: true,
    };
    assert.equal(
      (
        await req(
          "b",
          "POST",
          `/guidance-plans/${planId}/resume`,
          resumeInput,
          409,
        )
      ).code,
      "TOPIC_NOT_AGREED",
    );
    await db.topicWorkflow.update({
      where: { topicId: "topic2" },
      data: {
        confirmedByAdvisorId: "b",
        confirmedAssignmentRevision: 1,
        confirmedAt: new Date(),
      },
    });
    const resumed = (
      await req("b", "POST", `/guidance-plans/${planId}/resume`, resumeInput)
    ).data;
    assert.equal(resumed.state, "ACTIVE");
    assert.equal(resumed.currentAdvisorId, "b");
    assert.equal(resumed.assignmentRevision, 1);
    assert.equal(resumed.finalizationId, planBefore.finalizationId);
    assert.deepEqual(
      await db.task.findMany({ where: { guidancePlanId: planId } }),
      oldTasks,
    );
    pass(
      "handover revokes old advisor, pauses writes and requires new advisor agreement/acknowledgement without losing tasks",
    );
    await db.$executeRawUnsafe(
      `CREATE FUNCTION public.step8a_test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.resource='guidance-task' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER step8a_test_audit_failure BEFORE INSERT ON public."AUDIT_LOG" FOR EACH ROW EXECUTE FUNCTION public.step8a_test_audit_failure()`,
    );
    c = await context("b");
    const beforeTasks = await db.task.count();
    await req(
      "b",
      "POST",
      `/guidance-plans/${planId}/tasks`,
      { ...input, expectedPlanRevision: c.plan.revision },
      500,
    );
    assert.equal(await db.task.count(), beforeTasks);
    assert.equal((await context("b")).plan.revision, c.plan.revision);
    await db.$executeRawUnsafe(
      'DROP TRIGGER step8a_test_audit_failure ON public."AUDIT_LOG"',
    );
    pass(
      "audit failure rolls back task metadata, history and plan revision in the same transaction",
    );
    t = await getTask(t.id, "b");
    await req(
      "b",
      "POST",
      `/tasks/${t.id}/cancel`,
      { expectedRevision: t.revision, reason: "Hủy có bài" },
      409,
    );
    t = (
      await req("b", "POST", `/tasks/${t.id}/cancel`, {
        expectedRevision: t.revision,
        reason: "Hủy có xác nhận",
        acknowledgeExistingSubmissions: true,
      })
    ).data;
    assert.equal(t.status, "CANCELLED");
    await req(
      "s2",
      "POST",
      `/tasks/${t.id}/progress`,
      { expectedRevision: t.revision, note: "Không ghi sau hủy" },
      409,
    );
    assert.deepEqual(
      await db.taskSubmission.findUnique({ where: { id: oldSubmission.id } }),
      oldSubmission,
    );
    const histories = await db.taskHistory.findMany({
      where: { taskId: t.id },
    });
    await assert.rejects(
      db.taskHistory.update({
        where: { id: histories[0].id },
        data: { reason: "overwrite" },
      }),
    );
    const audits = await db.auditLog.findMany({
      where: { resource: "guidance-task" },
    });
    assert(
      audits.every(
        (a) =>
          a.action === "TASK_PROGRESS" ||
          Object.keys(a.newValue).every((k) =>
            ["historyHash", "action"].includes(k),
          ),
      ),
    );
    pass(
      "cancel guards preserve historical submissions; task/plan history is append-only and technical audit avoids academic text",
    );
    fs.writeFileSync(
      path.join(backend, "prisma/review/step8a-results.json"),
      JSON.stringify(
        {
          result: "PASS",
          postgresVersion: identity.version,
          checks,
          sharedDatabaseDDL: false,
          step7Prelude: true,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`${checks.length} Step 8A API checks passed`);
  } finally {
    if (app) await app.close();
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(
    "Step 8A isolated integration failed: " +
      String(e.message).replace(
        /postgres(?:ql)?:\/\/[^\s]+/gi,
        "[redacted URL]",
      ),
  );
  process.exitCode = 1;
});
