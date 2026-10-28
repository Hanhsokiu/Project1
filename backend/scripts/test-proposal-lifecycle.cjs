"use strict";
// Real HTTP/PG17 regression. Refuses existing databases; never loads a shared .env.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict"),
  { spawnSync } = require("node:child_process");
const { testTarget } = require("./rehearse-pr2b.cjs"),
  { seedSteps48 } = require("./integration/seed-steps4-8.cjs"),
  { prepareFixtureSessions } = require("./integration/auth-fixture.cjs");
async function main() {
  const url = testTarget(process.env.PR2B_TEST_URL),
    backend = path.resolve(__dirname, "..");
  Object.assign(process.env, {
    DATABASE_URL: url.toString(),
    DIRECT_URL: url.toString(),
    NODE_ENV: "test",
    JWT_SECRET: crypto.randomBytes(32).toString("hex"),
    JWT_REFRESH_SECRET: crypto.randomBytes(32).toString("hex"),
    EMAIL_WORKER_ENABLED: "false",
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
    const [identity] = await db.$queryRawUnsafe(
      "SELECT current_database() AS db,current_setting('server_version_num') AS version",
    );
    assert.equal(identity.db, url.pathname.slice(1));
    assert.equal(Math.floor(Number(identity.version) / 10000), 17);
    const [tables] = await db.$queryRawUnsafe(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
    );
    assert.equal(tables.n, 0, "Fresh empty database required");
    const migration = spawnSync(
      process.execPath,
      [require.resolve("prisma/build/index.js"), "migrate", "deploy"],
      { cwd: backend, env: process.env, encoding: "utf8", windowsHide: true },
    );
    assert.equal(migration.status, 0, "Migration failed: " + migration.stderr);
    const fixture = await seedSteps48(db, url.toString());
    await db.reviewGroup.create({
      data: {
        id: "qa-g1",
        termId: "qa-t1",
        name: "Lifecycle QA",
        members: {
          create: [{ lecturerId: "reviewer" }, { lecturerId: "advisor" }],
        },
        pr2bReviewGroupWorkflowGroupId: { create: { departmentId: "qa-d" } },
      },
    });
    await prepareFixtureSessions(db);
    const permission = await db.permission.findUniqueOrThrow({
      where: { resource_action: { resource: "proposal", action: "reopen" } },
    });
    assert(
      await db.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: "FACULTY",
            permissionId: permission.id,
          },
        },
      }),
    );
    assert.equal(
      await db.rolePermission.count({
        where: { roleId: "ADMIN", permissionId: permission.id },
      }),
      0,
    );
    pass("fresh migration grants explicit reopen capability only to FACULTY");
    const { NestFactory } = require("@nestjs/core"),
      { ValidationPipe } = require("@nestjs/common"),
      { JwtService } = require("@nestjs/jwt"),
      { AppModule } = require("../dist/app.module"),
      {
        GlobalExceptionHandler,
      } = require("../dist/common/exception/global-exception.handler"),
      { configureBodyParsers } = require("../dist/common/http/body-parsers");
    app = await NestFactory.create(AppModule, {
      logger: false,
      abortOnError: false,
      bodyParser: false,
    });
    configureBodyParsers(app, "api");
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new GlobalExceptionHandler());
    await app.listen(0, "127.0.0.1");
    const { SwaggerModule, DocumentBuilder } = require("@nestjs/swagger"),
      swagger = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().addBearerAuth().build(),
      );
    for (const route of ["withdraw", "return-to-draft", "reopen"])
      assert(swagger.paths["/api/proposals/{proposalId}/" + route]?.post);
    pass("all three lifecycle POST endpoints appear in OpenAPI");
    const base =
        "http://127.0.0.1:" + app.getHttpServer().address().port + "/api",
      jwt = new JwtService({ secret: process.env.JWT_SECRET });
    async function req(
      actor,
      method,
      route,
      body,
      status = 200,
      key = crypto.randomUUID(),
    ) {
      const headers = { "Content-Type": "application/json" };
      if (key !== false) headers["Idempotency-Key"] = key;
      if (actor)
        headers.Authorization =
          "Bearer " +
          jwt.sign({ sub: actor, sid: actor, roles: ["ADMIN", "FACULTY"] });
      const response = await fetch(base + route, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(30000),
        }),
        payload = await response.json();
      assert(
        (Array.isArray(status) ? status : [status]).includes(response.status),
        method +
          " " +
          route +
          " expected " +
          status +
          " got " +
          response.status +
          " " +
          JSON.stringify(payload),
      );
      return { status: response.status, ...payload };
    }
    const ctx = async (actor = "student", p = "p-student") =>
      (await req(actor, "GET", "/proposals/" + p + "/editing-context")).data;
    const input = (c) => ({
      expectedProposalRevision: c.revision,
      versionId: c.submittedVersionId,
      ...(c.lifecycle.reviewId
        ? {
            reviewId: c.lifecycle.reviewId,
            expectedReviewRevision: c.lifecycle.reviewRevision,
          }
        : {}),
    });
    async function snap() {
      const data = {};
      for (const model of [
        "proposal",
        "proposalWorkflow",
        "proposalVersion",
        "proposalVersionWorkflow",
        "proposalReview",
        "proposalReviewWorkflow",
        "reviewComment",
        "proposalReviewDecision",
        "thesisDossier",
        "dossierWorkflow",
        "dossierFinalization",
        "dossierReceipt",
        "dossierHistory",
        "guidancePlan",
        "guidancePlanWorkflow",
        "planHistory",
        "task",
        "taskWorkflow",
        "taskProgressEvent",
        "taskSubmission",
        "progressReview",
        "auditLog",
        "outboxEvent",
        "notification",
        "idempotencyRecord",
      ])
        data[model] = await db[model].findMany({ orderBy: { id: "asc" } });
      return data;
    }
    async function assign(p = "p-student") {
      const c = await ctx(p === "p-student2" ? "student2" : "student", p);
      return (
        await req(
          "faculty",
          "POST",
          "/proposals/" + p + "/review-assignments",
          {
            groupId: "qa-g1",
            proposalVersionId: c.submittedVersionId,
            expectedProposalRevision: c.revision,
          },
          201,
        )
      ).data;
    }
    const start = async (v) =>
      (
        await req("reviewer", "POST", "/proposal-reviews/" + v.id + "/start", {
          expectedProposalRevision: v.proposalRevision,
          expectedReviewRevision: v.revision,
        })
      ).data;
    const comment = async (v) =>
      (
        await req(
          "reviewer",
          "POST",
          "/proposal-reviews/" + v.id + "/comments",
          {
            expectedReviewRevision: v.revision,
            versionId: v.versionId,
            text: "Giữ nguyên góp ý sau khi dừng vòng.",
          },
          201,
        )
      ).data;
    const approve = async (v) =>
      (
        await req(
          "reviewer",
          "POST",
          "/proposal-reviews/" + v.id + "/decision",
          {
            expectedProposalRevision: v.proposalRevision,
            expectedReviewRevision: v.revision,
            versionId: v.versionId,
            decision: "APPROVED",
          },
        )
      ).data;
    async function saveSubmit(actor = "student", p = "p-student") {
      let c = await ctx(actor, p);
      const v = (
        await req(
          actor,
          "POST",
          "/proposals/" + p + "/versions",
          {
            expectedRevision: c.revision,
            basedOnVersionId: c.workingVersionId,
            content: {
              ...fixture.content,
              objectives: "Chỉnh sửa sau vòng đời " + c.revision,
            },
          },
          201,
        )
      ).data;
      await req(actor, "POST", "/proposals/" + p + "/submit", {
        expectedRevision: v.proposalRevision,
        versionId: v.id,
      });
      return v;
    }
    let c = await ctx();
    const beforeReads = await snap();
    assert.deepEqual(c.lifecycle.allowedActions, ["withdraw"]);
    assert.deepEqual((await ctx("faculty")).lifecycle.allowedActions, []);
    assert.deepEqual((await ctx("advisor")).lifecycle.allowedActions, []);
    await ctx();
    assert.deepEqual(await snap(), beforeReads);
    pass("GET capabilities are scoped and read-only; owner alone may withdraw");
    for (const actor of [
      null,
      "advisor",
      "reviewer",
      "faculty",
      "faculty2",
      "student2",
      "admin",
      "unprivileged",
    ])
      await req(
        actor,
        "POST",
        "/proposals/p-student/withdraw",
        input(c),
        actor === null ? 401 : [403, 404],
      );
    assert.deepEqual(await snap(), beforeReads);
    pass(
      "JWT claims do not bypass owner/role/grant checks; denials have no writes",
    );
    for (const body of [
      { ...input(c), status: "DRAFT" },
      { ...input(c), createdByUserId: "faculty" },
      { ...input(c), expectedProposalRevision: -1 },
      { ...input(c), expectedProposalRevision: "0" },
      { ...input(c), reviewId: "x" },
      { ...input(c), reason: " " },
      { ...input(c), reason: "x".repeat(2001) },
    ])
      await req("student", "POST", "/proposals/p-student/withdraw", body, 400);
    for (const key of [false, "bad key!", "x".repeat(201)])
      await req(
        "student",
        "POST",
        "/proposals/p-student/withdraw",
        input(c),
        400,
        key,
      );
    assert.deepEqual(await snap(), beforeReads);
    pass(
      "strict schemas reject injection, invalid revisions, unpaired review CAS, reasons and request keys",
    );
    const phase = await db.termPhase.findUniqueOrThrow({
      where: { id: "qa-t1-PROPOSAL_EDIT" },
    });
    for (const mode of ["future", "expired", "locked"]) {
      try {
        await db.termPhase.update({
          where: { id: phase.id },
          data:
            mode === "locked"
              ? { isLocked: true }
              : mode === "future"
                ? { startDate: new Date(Date.now() + 60000) }
                : { endDate: new Date(Date.now() - 60000) },
        });
        assert.deepEqual((await ctx()).lifecycle.allowedActions, []);
        await req(
          "student",
          "POST",
          "/proposals/p-student/withdraw",
          input(c),
          409,
        );
      } finally {
        await db.termPhase.update({
          where: { id: phase.id },
          data: {
            startDate: phase.startDate,
            endDate: phase.endDate,
            isLocked: phase.isLocked,
          },
        });
      }
    }
    assert.deepEqual(await snap(), beforeReads);
    pass(
      "future/expired/locked edit phase hides actions and blocks commands without writes",
    );
    const original = await db.proposalVersion.findUniqueOrThrow({
        where: { id: c.submittedVersionId },
        include: { pr2bProposalVersionWorkflowVersionId: true },
      }),
      withdrawKey = crypto.randomUUID(),
      withdrawInput = input(c);
    let result = (
      await req(
        "student",
        "POST",
        "/proposals/p-student/withdraw",
        withdrawInput,
        200,
        withdrawKey,
      )
    ).data;
    assert.equal(result.status, "DRAFT");
    assert.equal(
      await db.proposalVersion.count({ where: { proposalId: "p-student" } }),
      1,
    );
    assert.deepEqual(
      await db.proposalVersion.findUnique({
        where: { id: original.id },
        include: { pr2bProposalVersionWorkflowVersionId: true },
      }),
      original,
    );
    assert.deepEqual((await ctx()).allowedActions, ["save"]);
    pass(
      "unassigned withdrawal preserves SEALED v1 and requires an appended draft before submit",
    );
    let unchanged = await snap();
    assert.deepEqual(
      (
        await req(
          "student",
          "POST",
          "/proposals/p-student/withdraw",
          withdrawInput,
          200,
          withdrawKey,
        )
      ).data,
      result,
    );
    await req(
      "student",
      "POST",
      "/proposals/p-student/withdraw",
      { ...withdrawInput, reason: "Khác payload" },
      409,
      withdrawKey,
    );
    assert.deepEqual(await snap(), unchanged);
    pass(
      "same-key withdrawal replays once; changed payload conflicts without duplicate evidence",
    );
    const submitPermission = await db.permission.findUniqueOrThrow({
        where: { resource_action: { resource: "proposal", action: "submit" } },
      }),
      binding = { roleId: "STUDENT", permissionId: submitPermission.id };
    try {
      await db.rolePermission.delete({
        where: { roleId_permissionId: binding },
      });
      await req(
        "student",
        "POST",
        "/proposals/p-student/withdraw",
        withdrawInput,
        403,
        withdrawKey,
      );
    } finally {
      await db.rolePermission.create({ data: binding });
    }
    assert.deepEqual(await snap(), unchanged);
    pass("current permission checked before cached withdrawal result");
    await saveSubmit();
    let round = await comment(await assign()),
      assigned = round;
    c = await ctx();
    unchanged = await snap();
    await req(
      "student",
      "POST",
      "/proposals/p-student/withdraw",
      { ...input(c), expectedReviewRevision: c.lifecycle.reviewRevision - 1 },
      409,
    );
    await req(
      "student",
      "POST",
      "/proposals/p-student/withdraw",
      { ...input(c), versionId: "v1-student" },
      409,
    );
    await req(
      "student",
      "POST",
      "/proposals/p-student/withdraw",
      { ...input(c), expectedProposalRevision: c.revision - 1 },
      409,
    );
    assert.deepEqual(await snap(), unchanged);
    pass(
      "stale proposal/version/review revisions reject withdrawal atomically",
    );
    await req("student", "POST", "/proposals/p-student/withdraw", input(c));
    const history = (
      await req("student", "GET", "/proposals/p-student/review-history")
    ).data;
    assert.equal(history[0].state, "SUPERSEDED");
    assert.deepEqual(history[0].comments, assigned.comments);
    assert.equal(history[0].decision, null);
    await req(
      "reviewer",
      "POST",
      "/proposal-reviews/" + round.id + "/start",
      {
        expectedProposalRevision: round.proposalRevision,
        expectedReviewRevision: round.revision,
      },
      409,
    );
    pass(
      "assigned withdrawal supersedes round, preserves comments and blocks later review start",
    );
    await saveSubmit();
    round = await comment(await start(await assign()));
    c = await ctx("faculty");
    assert.deepEqual(c.lifecycle.allowedActions, ["return-to-draft"]);
    const returned = {
      ...input(c),
      reason: "Khoa trả nháp để hoàn thiện phạm vi.",
    };
    unchanged = await snap();
    for (const reason of [undefined, "", "   ", "x".repeat(2001)])
      await req(
        "faculty",
        "POST",
        "/proposals/p-student/return-to-draft",
        { ...returned, reason },
        400,
      );
    for (const actor of ["student", "advisor", "reviewer", "faculty2", "admin"])
      await req(
        actor,
        "POST",
        "/proposals/p-student/return-to-draft",
        returned,
        [403, 404],
      );
    assert.deepEqual(await snap(), unchanged);
    pass(
      "only granted faculty can return IN_REVIEW; nonblank bounded reason is mandatory",
    );
    const returnKey = crypto.randomUUID();
    await req(
      "faculty",
      "POST",
      "/proposals/p-student/return-to-draft",
      returned,
      200,
      returnKey,
    );
    let oldRound = (
      await req("faculty", "GET", "/proposal-reviews/" + round.id)
    ).data;
    assert.equal(oldRound.state, "SUPERSEDED");
    assert.deepEqual(oldRound.comments, round.comments);
    assert.equal(oldRound.decision, null);
    unchanged = await snap();
    await req(
      "reviewer",
      "POST",
      "/proposal-reviews/" + round.id + "/decision",
      {
        expectedProposalRevision: round.proposalRevision,
        expectedReviewRevision: round.revision,
        versionId: round.versionId,
        decision: "APPROVED",
      },
      409,
    );
    await req(
      "faculty",
      "POST",
      "/proposals/p-student/return-to-draft",
      returned,
      200,
      returnKey,
    );
    assert.deepEqual(await snap(), unchanged);
    pass(
      "return-to-draft ends review without inventing a decision; replay does not duplicate evidence",
    );
    await saveSubmit();
    round = await approve(await start(await assign()));
    c = await ctx("faculty");
    assert.deepEqual(c.lifecycle.allowedActions, ["reopen"]);
    const reopen = {
      expectedProposalRevision: c.revision,
      versionId: c.submittedVersionId,
      reason: "Mở lại để sửa kế hoạch.",
    };
    unchanged = await snap();
    for (const actor of ["student", "advisor", "reviewer", "faculty2", "admin"])
      await req(
        actor,
        "POST",
        "/proposals/p-student/reopen",
        reopen,
        [403, 404],
      );
    for (const reason of [undefined, "", "   "])
      await req(
        "faculty",
        "POST",
        "/proposals/p-student/reopen",
        { ...reopen, reason },
        400,
      );
    assert.deepEqual(await snap(), unchanged);
    pass("approved reopen requires faculty reopen permission/grant and reason");
    const pointers = await db.proposalWorkflow.findUniqueOrThrow({
      where: { proposalId: "p-student" },
    });
    try {
      await db.proposalWorkflow.update({
        where: { proposalId: "p-student" },
        data: { workingVersionId: original.id },
      });
      const bad = await ctx("faculty");
      assert.deepEqual(bad.lifecycle.allowedActions, []);
      const preserved = await snap();
      assert.equal(
        (
          await req(
            "faculty",
            "POST",
            "/proposals/p-student/reopen",
            reopen,
            409,
          )
        ).error.code,
        "STALE_VERSION",
      );
      assert.deepEqual(await snap(), preserved);
    } finally {
      await db.proposalWorkflow.update({
        where: { proposalId: "p-student" },
        data: {
          workingVersionId: pointers.workingVersionId,
          updatedAt: pointers.updatedAt,
        },
      });
    }
    pass(
      "inconsistent working/submitted pointers fail closed without discarding a snapshot",
    );
    const agreement = await db.topicWorkflow.findUniqueOrThrow({
      where: { topicId: "topic-student" },
    });
    try {
      await db.topicWorkflow.update({
        where: { topicId: "topic-student" },
        data: { confirmedAt: null },
      });
      await req("faculty", "POST", "/proposals/p-student/reopen", reopen);
      assert.equal((await ctx()).status, "DRAFT");
      await saveSubmitBlockedByAgreement();
    } finally {
      await db.topicWorkflow.update({
        where: { topicId: "topic-student" },
        data: { confirmedAt: agreement.confirmedAt },
      });
    }
    async function saveSubmitBlockedByAgreement() {
      const state = await ctx();
      const draft = (
        await req(
          "student",
          "POST",
          "/proposals/p-student/versions",
          {
            expectedRevision: state.revision,
            basedOnVersionId: state.workingVersionId,
            content: fixture.content,
          },
          201,
        )
      ).data;
      assert.equal(
        (
          await req(
            "student",
            "POST",
            "/proposals/p-student/submit",
            { expectedRevision: draft.proposalRevision, versionId: draft.id },
            409,
          )
        ).error.code,
        "TOPIC_NOT_AGREED",
      );
    }
    pass(
      "reopen remains possible after agreement invalidation; re-submit still requires renewed agreement",
    );
    c = await ctx();
    await req("student", "POST", "/proposals/p-student/submit", {
      expectedRevision: c.revision,
      versionId: c.workingVersionId,
    });
    round = await approve(await start(await assign()));
    let dossier = (await req("faculty", "GET", "/proposals/p-student/dossier"))
      .data;
    dossier = (
      await req(
        "faculty",
        "POST",
        "/proposals/p-student/finalize",
        {
          expectedProposalRevision: dossier.proposalRevision,
          expectedDossierRevision: dossier.revision,
          approvedVersionId: dossier.submittedVersionId,
        },
        201,
      )
    ).data;
    dossier = (
      await req(
        "faculty",
        "POST",
        "/proposals/p-student/dossier/receipt",
        {
          expectedRevision: dossier.revision,
          finalizationId: dossier.currentFinalization.id,
        },
        201,
      )
    ).data;
    dossier = (
      await req("student", "POST", "/proposals/p-student/dossier/pdf", {
        expectedRevision: dossier.revision,
        finalizationId: dossier.currentFinalization.id,
      })
    ).data;
    const historicalPdf = async (
      actor = "student",
      query = "?finalizationId=" + dossier.currentFinalization.id,
    ) => {
      const r = await fetch(base + "/proposals/p-student/dossier.pdf" + query, {
        headers: actor
          ? { Authorization: "Bearer " + jwt.sign({ sub: actor, sid: actor }) }
          : {},
      });
      return {
        status: r.status,
        bytes: Buffer.from(await r.arrayBuffer()),
        disposition: r.headers.get("content-disposition"),
        state: r.headers.get("x-dossier-status"),
      };
    };
    const firstPdf = await historicalPdf();
    assert.equal(firstPdf.status, 200);
    const finalization = await db.dossierFinalization.findUniqueOrThrow({
        where: { id: dossier.currentFinalization.id },
      }),
      receipts = await db.dossierReceipt.findMany();
    let plan = (
      await req(
        "advisor",
        "POST",
        "/proposals/p-student/guidance-plan",
        {
          finalizationId: finalization.id,
          expectedDossierRevision: dossier.revision,
          description: "Kế hoạch trước mở lại",
        },
        201,
      )
    ).data;
    const task = (
      await req(
        "advisor",
        "POST",
        "/guidance-plans/" + plan.id + "/tasks",
        {
          expectedPlanRevision: plan.revision,
          title: "Giữ nhiệm vụ và tiến độ",
          expectedDeliverables: "Báo cáo kiểm thử",
          periodId: "qa-m1",
          startDate: new Date(Date.now() + 60000).toISOString(),
          dueDate: new Date(Date.now() + 1800000).toISOString(),
        },
        201,
      )
    ).data;
    await req("student", "POST", "/tasks/" + task.id + "/progress", {
      expectedRevision: task.revision,
      note: "Tiến độ trước khi mở lại",
    });
    pass(
      "real approval/finalization/receipt/guidance/task/progress establish downstream evidence",
    );
    c = await ctx("faculty");
    const fullReopen = {
      expectedProposalRevision: c.revision,
      versionId: c.submittedVersionId,
      expectedDossierRevision: c.lifecycle.dossierRevision,
      reason: "Thay đổi phạm vi sau khi nhận bản giấy.",
    };
    unchanged = await snap();
    await req(
      "faculty",
      "POST",
      "/proposals/p-student/reopen",
      {
        ...fullReopen,
        expectedDossierRevision: fullReopen.expectedDossierRevision - 1,
      },
      409,
    );
    await req(
      "faculty",
      "POST",
      "/proposals/p-student/reopen",
      { ...fullReopen, expectedDossierRevision: undefined },
      409,
    );
    assert.deepEqual(await snap(), unchanged);
    pass("dossier CAS is mandatory when reopening an existing dossier");
    await db.$executeRawUnsafe(
      `CREATE FUNCTION qa_lifecycle_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='PROPOSAL_REOPENED' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      'CREATE TRIGGER qa_lifecycle_audit_failure BEFORE INSERT ON public."AUDIT_LOG" FOR EACH ROW EXECUTE FUNCTION qa_lifecycle_audit_failure()',
    );
    try {
      await req(
        "faculty",
        "POST",
        "/proposals/p-student/reopen",
        fullReopen,
        500,
      );
      assert.deepEqual(await snap(), unchanged);
    } finally {
      await db.$executeRawUnsafe(
        'DROP TRIGGER qa_lifecycle_audit_failure ON public."AUDIT_LOG"',
      );
      await db.$executeRawUnsafe("DROP FUNCTION qa_lifecycle_audit_failure()");
    }
    pass(
      "audit fault rolls back proposal/review/dossier/finalization/plan/history/outbox atomically",
    );
    const editPhase = await db.termPhase.findUniqueOrThrow({
      where: { id: "qa-t1-PROPOSAL_EDIT" },
    });
    await db.termPhase.update({
      where: { id: editPhase.id },
      data: { isLocked: true },
    });
    assert.deepEqual((await ctx("faculty")).lifecycle.allowedActions, [
      "reopen",
    ]);
    const reopenTerm = await db.thesisTerm.findUniqueOrThrow({
      where: { id: "qa-t1" },
    });
    try {
      for (const status of ["COMPLETED", "CANCELLED", "DEFENDING"]) {
        await db.thesisTerm.update({
          where: { id: reopenTerm.id },
          data: { status },
        });
        assert.deepEqual((await ctx("faculty")).lifecycle.allowedActions, []);
        await req(
          "faculty",
          "POST",
          "/proposals/p-student/reopen",
          fullReopen,
          409,
        );
      }
    } finally {
      await db.thesisTerm.update({
        where: { id: reopenTerm.id },
        data: { status: reopenTerm.status, updatedAt: reopenTerm.updatedAt },
      });
    }
    const fullKey = crypto.randomUUID(),
      otherKey = crypto.randomUUID(),
      race = await Promise.all([
        req(
          "faculty",
          "POST",
          "/proposals/p-student/reopen",
          fullReopen,
          [200, 409],
          fullKey,
        ),
        req(
          "faculty",
          "POST",
          "/proposals/p-student/reopen",
          fullReopen,
          [200, 409],
          otherKey,
        ),
      ]);
    assert.deepEqual(race.map((x) => x.status).sort(), [200, 409]);
    assert.equal((await ctx()).status, "DRAFT");
    const lockedStudent = await ctx();
    assert.deepEqual(lockedStudent.allowedActions, []);
    await req(
      "student",
      "POST",
      "/proposals/p-student/versions",
      {
        expectedRevision: lockedStudent.revision,
        basedOnVersionId: lockedStudent.workingVersionId,
        content: fixture.content,
      },
      409,
    );
    await db.termPhase.update({
      where: { id: editPhase.id },
      data: { isLocked: editPhase.isLocked },
    });
    pass(
      "faculty reopen bypasses locked edit phase; ended/defending terms and student editing remain blocked",
    );
    assert.equal(
      (
        await db.dossierWorkflow.findUnique({
          where: { dossierId: finalization.dossierId },
        })
      ).state,
      "REOPENED",
    );
    assert.equal(
      (await db.guidancePlanWorkflow.findUnique({ where: { planId: plan.id } }))
        .state,
      "PAUSED",
    );
    assert.deepEqual(await db.dossierReceipt.findMany(), receipts);
    const superseded = await db.dossierFinalization.findUniqueOrThrow({
      where: { id: finalization.id },
    });
    assert(superseded.supersededAt);
    for (const key of Object.keys(finalization).filter(
      (k) => !["supersededAt", "reason", "updatedAt"].includes(k),
    ))
      assert.deepEqual(superseded[key], finalization[key]);
    for (const model of [
      "task",
      "taskWorkflow",
      "taskProgressEvent",
      "taskSubmission",
      "progressReview",
      "proposalVersion",
      "proposalVersionWorkflow",
      "proposalReviewDecision",
      "reviewComment",
    ])
      assert.deepEqual((await snap())[model], unchanged[model]);
    pass(
      "concurrent reopen has one winner; preserves immutable finalization/receipt/reviews/tasks/progress and pauses plan",
    );
    const winnerKey = race[0].status === 200 ? fullKey : otherKey;
    const archived = await historicalPdf(
      "student",
      "?finalizationId=" + finalization.id,
    );
    assert.equal(archived.status, 200);
    assert.deepEqual(archived.bytes, firstPdf.bytes);
    assert.equal(archived.state, "SUPERSEDED");
    assert.match(archived.disposition, /da-thay-the/);
    assert.equal((await historicalPdf("student", "")).status, 409);
    assert.equal(
      (await historicalPdf("student2", "?finalizationId=" + finalization.id))
        .status,
      404,
    );
    assert.equal(
      (await historicalPdf("reviewer", "?finalizationId=" + finalization.id))
        .status,
      404,
    );
    const archivalView = (
      await req("student", "GET", "/proposals/p-student/dossier")
    ).data;
    assert(
      archivalView.finalizations.find((f) => f.id === finalization.id)
        .supersededAt,
    );
    assert.equal(
      archivalView.finalizations.find((f) => f.id === finalization.id).receipt
        .id,
      receipts[0].id,
    );
    pass(
      "after reopen explicit historical PDF and receipt remain readable in scope; no default current PDF",
    );
    {
      const stable = await snap();
      await req(
        "faculty",
        "POST",
        "/proposals/p-student/reopen",
        fullReopen,
        200,
        winnerKey,
      );
      assert.deepEqual(await snap(), stable);
      await req(
        "faculty",
        "POST",
        "/proposals/p-student/reopen",
        { ...fullReopen, reason: "Nội dung gửi lại khác" },
        409,
        winnerKey,
      );
      const grant = await db.academicTermGrant.findFirstOrThrow({
        where: { userId: "faculty", termId: "qa-t1" },
      });
      const departments = await db.grantDepartment.findMany({
        where: { grantId: grant.id },
      });
      try {
        await db.grantDepartment.deleteMany({ where: { grantId: grant.id } });
        await req(
          "faculty",
          "POST",
          "/proposals/p-student/reopen",
          fullReopen,
          404,
          winnerKey,
        );
      } finally {
        await db.grantDepartment.createMany({ data: departments });
      }
      assert.deepEqual(await snap(), stable);
    }
    pass(
      "reopen replay is exactly once; different payload conflicts and revoked academic grant cannot read cache",
    );
    const paused = (
      await req("advisor", "GET", "/proposals/p-student/guidance-context")
    ).data;
    assert.equal(paused.plan.state, "PAUSED");
    await req(
      "advisor",
      "POST",
      "/guidance-plans/" + plan.id + "/tasks",
      {
        expectedPlanRevision: paused.plan.revision,
        title: "Không được tạo khi pause",
        expectedDeliverables: "Báo cáo",
        periodId: "qa-m1",
        startDate: new Date(Date.now() + 60000).toISOString(),
        dueDate: new Date(Date.now() + 1800000).toISOString(),
      },
      409,
    );
    pass(
      "guidance remains readable but paused mutations are blocked after reopen",
    );
    await saveSubmit();
    round = await approve(await start(await assign()));
    dossier = (await req("faculty", "GET", "/proposals/p-student/dossier"))
      .data;
    dossier = (
      await req(
        "faculty",
        "POST",
        "/proposals/p-student/finalize",
        {
          expectedProposalRevision: dossier.proposalRevision,
          expectedDossierRevision: dossier.revision,
          approvedVersionId: dossier.submittedVersionId,
        },
        201,
      )
    ).data;
    assert.notEqual(dossier.currentFinalization.id, finalization.id);
    const archivedAgain = await historicalPdf(
      "student",
      "?finalizationId=" + finalization.id,
    );
    assert.equal(archivedAgain.status, 200);
    assert.deepEqual(archivedAgain.bytes, firstPdf.bytes);
    assert.equal(dossier.receipt, null);
    assert.equal(dossier.currentFinalization.pdfGeneratedAt, null);
    const immutableOld = dossier.finalizations.find(
      (f) => f.id === finalization.id,
    );
    assert(immutableOld.supersededAt);
    assert.equal(immutableOld.receipt.id, receipts[0].id);
    pass(
      "after refinalization old PDF is unchanged and old receipt is never transferred to the new version",
    );
    assert.equal(
      (await db.guidancePlanWorkflow.findUnique({ where: { planId: plan.id } }))
        .state,
      "PAUSED",
    );
    plan = (
      await req("advisor", "POST", "/guidance-plans/" + plan.id + "/resume", {
        expectedRevision: paused.plan.revision,
        expectedDossierRevision: dossier.revision,
        finalizationId: dossier.currentFinalization.id,
        acknowledgeRebase: true,
      })
    ).data;
    assert.equal(plan.state, "ACTIVE");
    assert.equal(
      (await db.guidancePlanWorkflow.findUnique({ where: { planId: plan.id } }))
        .finalizationId,
      dossier.currentFinalization.id,
    );
    assert.deepEqual(await db.dossierReceipt.findMany(), receipts);
    pass(
      "save/re-submit/new approval/re-finalize retains old evidence; only explicit advisor rebase resumes plan",
    );
    let raceRound = await assign("p-student2"),
      raceContext = await ctx("student2", "p-student2");
    const raceResult = await Promise.all([
      req(
        "student2",
        "POST",
        "/proposals/p-student2/withdraw",
        input(raceContext),
        [200, 409],
      ),
      req(
        "reviewer",
        "POST",
        "/proposal-reviews/" + raceRound.id + "/start",
        {
          expectedProposalRevision: raceRound.proposalRevision,
          expectedReviewRevision: raceRound.revision,
        },
        [200, 409],
      ),
    ]);
    assert.deepEqual(raceResult.map((x) => x.status).sort(), [200, 409]);
    const p2 = await ctx("student2", "p-student2");
    assert(["DRAFT", "UNDER_REVIEW"].includes(p2.status));
    pass("withdraw versus reviewer start serializes to one valid transition");
    // Explicit legacy producer fixture in a separate term; real approval is still created through HTTP.
    await db.reviewGroup.create({
      data: {
        id: "qa-g2",
        termId: "qa-t2",
        name: "Legacy boundary",
        members: {
          create: [{ lecturerId: "foreign" }, { lecturerId: "advisor" }],
        },
        pr2bReviewGroupWorkflowGroupId: { create: { departmentId: "qa-d" } },
      },
    });
    const third = await ctx("student3", "p-student3");
    let legacyRound = (
      await req(
        "faculty2",
        "POST",
        "/proposals/p-student3/review-assignments",
        {
          groupId: "qa-g2",
          proposalVersionId: third.submittedVersionId,
          expectedProposalRevision: third.revision,
        },
        201,
      )
    ).data;
    legacyRound = (
      await req(
        "foreign",
        "POST",
        "/proposal-reviews/" + legacyRound.id + "/start",
        {
          expectedProposalRevision: legacyRound.proposalRevision,
          expectedReviewRevision: legacyRound.revision,
        },
      )
    ).data;
    await req(
      "foreign",
      "POST",
      "/proposal-reviews/" + legacyRound.id + "/decision",
      {
        expectedProposalRevision: legacyRound.proposalRevision,
        expectedReviewRevision: legacyRound.revision,
        versionId: legacyRound.versionId,
        decision: "APPROVED",
      },
    );
    await db.thesisDossier.create({
      data: {
        proposalId: "p-student3",
        pr2bDossierWorkflowDossierId: { create: { state: "FINALIZED" } },
      },
    });
    const legacyContext = await ctx("faculty2", "p-student3");
    assert.deepEqual(legacyContext.lifecycle.allowedActions, []);
    const legacyState = await snap();
    await req(
      "faculty2",
      "POST",
      "/proposals/p-student3/reopen",
      {
        expectedProposalRevision: legacyContext.revision,
        versionId: legacyContext.submittedVersionId,
        expectedDossierRevision: 0,
        reason: "Không tự chữa dữ liệu legacy",
      },
      409,
    );
    assert.deepEqual(await snap(), legacyState);
    pass(
      "legacy finalized dossier without evidenced current finalization is read-only and never backfilled",
    );
    assert.deepEqual(
      await db.proposalVersion.findUnique({
        where: { id: original.id },
        include: { pr2bProposalVersionWorkflowVersionId: true },
      }),
      original,
    );
    assert.equal(
      await db.proposalReviewDecision.count({
        where: { reviewId: assigned.id },
      }),
      0,
    );
    pass(
      "original SEALED source and superseded review evidence remain unchanged across lifecycle cycles",
    );
    const destination = process.env.QA_RUN_DIR
      ? path.join(process.env.QA_RUN_DIR, "lifecycle-results.json")
      : path.join(backend, "prisma/review/step6-lifecycle-results.json");
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(
      destination,
      JSON.stringify(
        {
          result: "PASS",
          database: identity.db,
          postgresVersion: identity.version,
          checks,
          sharedDatabaseModified: false,
        },
        null,
        2,
      ),
    );
    console.log(checks.length + " lifecycle integration groups passed");
  } finally {
    if (app) await app.close();
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(
    "Lifecycle integration failed: " +
      String(e.message).replace(
        /postgres(?:ql)?:\/\/[^\s]+/gi,
        "[redacted URL]",
      ),
  );
  process.exitCode = 1;
});
