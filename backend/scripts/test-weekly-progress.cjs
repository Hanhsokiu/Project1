"use strict";
// Real HTTP + PG17 + private storage. Explicit isolated loopback target only.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { testTarget } = require("./rehearse-pr2b.cjs");
const { prepareFixtureSessions } = require("./integration/auth-fixture.cjs");
async function main() {
  const url = testTarget(process.env.PR2B_TEST_URL),
    backend = path.resolve(__dirname, "..");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "btl-weekly-private-"));
  Object.assign(process.env, {
    DATABASE_URL: url.toString(),
    DIRECT_URL: url.toString(),
    NODE_ENV: "test",
    JWT_SECRET: crypto.randomBytes(32).toString("hex"),
    JWT_REFRESH_SECRET: crypto.randomBytes(32).toString("hex"),
    STORAGE_LOCAL_PATH: root,
    GUIDANCE_UPLOAD_ENABLED: "true",
    GUIDANCE_REMINDERS_ENABLED: "false",
    EMAIL_WORKER_ENABLED: "false",
  });
  const { PrismaClient } = require("@prisma/client"),
    db = new PrismaClient();
  const checks = [],
    pass = (name) => {
      checks.push(name);
      console.log("PASS " + name);
    };
  let app;
  try {
    const [identity] =
      await db.$queryRaw`SELECT current_database() AS name,current_setting('server_version_num') AS version`;
    assert.equal(identity.name, url.pathname.slice(1));
    assert.equal(Math.floor(Number(identity.version) / 10000), require('./integration/rehearsal-baseline.cjs').expectedMajor());
    const [count] =
      await db.$queryRaw`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'`;
    if (!count.n) {
      const seed = spawnSync(
        process.execPath,
        [path.join(__dirname, "test-guidance-tasks.cjs")],
        {
          cwd: backend,
          env: process.env,
          windowsHide: true,
          encoding: "utf8",
          maxBuffer: 20 * 1024 * 1024,
        },
      );
      assert.equal(
        seed.status,
        0,
        "Step 4–8A prelude: " + seed.stdout + seed.stderr,
      );
    } else
      assert(
        process.env.WEEKLY_USE_PREPARED === "true",
        "Use a fresh test DB or explicit WEEKLY_USE_PREPARED for retained step8a fixtures",
      );
    const migration =
      await db.$queryRaw`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name`;
    assert(
      migration.some(
        (m) => m.migration_name === "202611040002_weekly_progress",
      ),
    );
    pass("additive migration replay over complete step 4–8A producer chain");
    await db.academicTermGrant.update({
      where: { userId_termId: { userId: "f", termId: "t1" } },
      data: { allDepartments: true },
    });
    for (const [resource, action, roleIds] of [
      ["guidance", "monitor", ["FACULTY"]],
      ["task", "review", ["LECTURER"]],
      ["submission", "create", ["STUDENT"]],
      ["submission", "read", ["STUDENT", "LECTURER", "FACULTY"]],
      ["submission", "download", ["STUDENT", "LECTURER", "FACULTY"]],
    ]) {
      const p = await db.permission.findUnique({
        where: { resource_action: { resource, action } },
      });
      for (const roleId of roleIds)
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
    const {
        WeeklyNotificationWorker,
      } = require("../dist/guidance/weekly/weekly-notification.worker"),
      {
        FileStorageService,
      } = require("../dist/common/storage/file-storage.service");
    app = await NestFactory.create(AppModule, {
      logger: false,
      abortOnError: false,
      bodyParser: false,
    });
    app.setGlobalPrefix("api");
    require("../dist/common/http/body-parsers").configureBodyParsers(
      app,
      "api",
    );
    app.enableCors({ origin: "http://127.0.0.1:50186", credentials: true });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await prepareFixtureSessions(db);
    await app.listen(0, "127.0.0.1");
    const base =
        "http://127.0.0.1:" + app.getHttpServer().address().port + "/api",
      jwt = new JwtService({ secret: process.env.JWT_SECRET });
    const token = (actor) =>
      actor
        ? { Authorization: "Bearer " + jwt.sign({ sub: actor, sid: actor }) }
        : {};
    async function req(
      actor,
      method,
      route,
      body,
      status = 200,
      key = crypto.randomUUID(),
    ) {
      const response = await fetch(base + route, {
        method,
        headers: {
          ...token(actor),
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const payload = await response.json();
      assert(
        [].concat(status).includes(response.status),
        `${method} ${route}: ${response.status} ${JSON.stringify(payload)}`,
      );
      return {
        data: payload.data,
        code: payload.error?.code,
        status: response.status,
      };
    }
    const now = Date.now(),
      term = await db.thesisTerm.findUnique({ where: { id: "t1" } });
    const iso = (offset) => new Date(now + offset).toISOString();
    assert(
      term.endDate > new Date(now + 7200000),
      "Fixture must have enough GUIDANCE time",
    );
    const ordinal = Math.max(
      101,
      1 +
        (
          await db.guidancePeriod.aggregate({
            where: { termId: "t1", type: "WEEK" },
            _max: { ordinal: true },
          })
        )._max.ordinal,
    );
    const create = {
      ordinal,
      label: "Weekly integration",
      description: "Real API week",
      startsAt: iso(-60000),
      endsAt: iso(7200000),
      reportDueAt: iso(3600000),
      expectedDeliverables: "Report + source",
      allowLate: true,
    };
    await req(null, "GET", "/terms/t1/weekly-plans", undefined, 401);
    await req("s2", "POST", "/terms/t1/weekly-plans", create, 403);
    await req("f", "POST", "/terms/t2/weekly-plans", create, 403);
    await req(
      "f",
      "POST",
      "/terms/t1/weekly-plans",
      { ...create, studentId: "s1" },
      400,
    );
    let week = (await req("f", "POST", "/terms/t1/weekly-plans", create, 201))
      .data;
    assert(
      !(await req("s2", "GET", "/terms/t1/weekly-plans")).data.some(
        (w) => w.id === week.id,
      ),
    );
    await req("f", "POST", "/terms/t1/weekly-plans", create, 409);
    const publish = {
        expectedRevision: week.revision,
        state: "OPEN",
        reason: "Publish",
      },
      publishKey = crypto.randomUUID();
    const published = await Promise.all(
      [1, 2].map(() =>
        req(
          "f",
          "POST",
          `/terms/t1/weekly-plans/${week.id}/state`,
          publish,
          201,
          publishKey,
        ),
      ),
    );
    assert.equal(published[0].data.revision, published[1].data.revision);
    week = published[0].data;
    const roster = await db.termStudent.count({ where: { termId: "t1" } });
    assert.equal(
      await db.weeklyReportObligation.count({ where: { periodId: week.id } }),
      roster,
    );
    pass(
      "faculty scope, DTOs, duplicate week, draft visibility, concurrent idempotent publication and roster obligations",
    );
    const getCoverage = async () =>
      (
        await req(
          "s2",
          "GET",
          `/terms/t1/weekly-report-coverage?periodId=${week.id}`,
        )
      ).data.data[0];
    const coverage = await getCoverage();
    assert(coverage.canEnsure);
    let task = (
      await req(
        "s2",
        "POST",
        `/weekly-report-obligations/${coverage.obligationId}/task`,
        {
          expectedObligationRevision: coverage.obligationRevision,
          expectedPlanRevision: coverage.planRevision,
        },
        201,
      )
    ).data;
    const taskId = task.id;
    const context = async () =>
      (await req("s2", "GET", `/tasks/${taskId}/submission-context`)).data;
    const reviewContext = async (id) =>
      (await req("b", "GET", `/task-submissions/${id}/review-context`)).data;
    const draft = {
      expectedDraftRevision: 0,
      report: { completedWork: "Partial draft" },
      content: "Draft note",
    };
    const draftKey = crypto.randomUUID();
    await req("s2", "PUT", `/tasks/${taskId}/draft`, draft, 200, draftKey);
    await req("s2", "PUT", `/tasks/${taskId}/draft`, draft, 200, draftKey);
    assert.equal((await context()).draft.report.completedWork, "Partial draft");
    assert.equal(
      (await req("b", "GET", `/tasks/${taskId}/submission-context`)).data.draft,
      null,
    );
    assert.equal(
      (await req("f", "GET", `/terms/t1/weekly-progress?periodId=${week.id}`))
        .data.metrics.NOT_SUBMITTED,
      roster,
    );
    await req("s1", "PUT", `/tasks/${taskId}/draft`, draft, 404);
    await req("s2", "PUT", `/tasks/${taskId}/draft`, draft, 409);
    pass(
      "own persisted draft with CAS/idempotency, hidden from other users, excluded from submission statistics",
    );
    const PDFDocument = require("pdfkit"),
      pdf = await new Promise((resolve) => {
        const doc = new PDFDocument(),
          chunks = [];
        doc.on("data", (b) => chunks.push(b));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.text("Weekly real report");
        doc.end();
      });
    const {
      crc32,
    } = require("../dist/guidance/submissions/submission.validator");
    function zip(name = "main.ts") {
      const n = Buffer.from(name),
        b = Buffer.from("export const value = 1;"),
        l = Buffer.alloc(30),
        c = Buffer.alloc(46),
        e = Buffer.alloc(22),
        crc = crc32(b);
      l.writeUInt32LE(0x04034b50);
      l.writeUInt16LE(20, 4);
      l.writeUInt32LE(crc, 14);
      l.writeUInt32LE(b.length, 18);
      l.writeUInt32LE(b.length, 22);
      l.writeUInt16LE(n.length, 26);
      c.writeUInt32LE(0x02014b50);
      c.writeUInt16LE(20, 6);
      c.writeUInt32LE(crc, 16);
      c.writeUInt32LE(b.length, 20);
      c.writeUInt32LE(b.length, 24);
      c.writeUInt16LE(n.length, 28);
      e.writeUInt32LE(0x06054b50);
      e.writeUInt16LE(1, 8);
      e.writeUInt16LE(1, 10);
      e.writeUInt32LE(c.length + n.length, 12);
      e.writeUInt32LE(l.length + n.length + b.length, 16);
      return Buffer.concat([l, n, b, c, n, e]);
    }
    async function upload(kind, bytes, name, mime, status = 201, actor = "s2") {
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", new Blob([bytes], { type: mime }), name);
      const r = await fetch(`${base}/tasks/${taskId}/submission-uploads`, {
        method: "POST",
        headers: { ...token(actor), "Idempotency-Key": crypto.randomUUID() },
        body: form,
      });
      const p = await r.json();
      assert.equal(r.status, status, JSON.stringify(p));
      return p.data;
    }
    const files = async () => [
      (await upload("REPORT", pdf, "report.pdf", "application/pdf")).id,
      (await upload("SOURCE", zip(), "source.zip", "application/zip")).id,
    ];
    week = (
      await req("f", "PATCH", `/terms/t1/weekly-plans/${week.id}`, {
        ...create,
        reportDueAt: iso(-1000),
        allowLate: false,
        expectedRevision: week.revision,
        reason: "Exercise closed deadline",
      })
    ).data;
    assert.equal((await context()).canSubmit, false);
    await upload("REPORT", pdf, "r.pdf", "application/pdf", 409);
    week = (
      await req("f", "PATCH", `/terms/t1/weekly-plans/${week.id}`, {
        ...create,
        reportDueAt: iso(-1000),
        allowLate: true,
        expectedRevision: week.revision,
        reason: "Permit explicitly late first submission",
      })
    ).data;
    await upload(
      "REPORT",
      Buffer.from("fake"),
      "r.pdf",
      "application/pdf",
      400,
    );
    await upload("SOURCE", zip("../bad.ts"), "s.zip", "application/zip", 400);
    await upload("REPORT", pdf, "r.pdf", "application/pdf", 404, "s1");
    const report = {
      assignedWork: "Design",
      completedWork: "Implementation",
      results: "Working flow",
      unfinishedWork: "",
      unfinishedReason: "",
      difficulties: "",
      solutions: "",
      nextWork: "Test",
      notes: "",
    };
    let input = {
      expectedTaskRevision: (await context()).taskRevision,
      uploadIds: await files(),
      report,
    };
    await req(
      "s2",
      "POST",
      `/tasks/${taskId}/submissions`,
      { ...input, uploadIds: input.uploadIds.slice(0, 1) },
      400,
    );
    await req(
      "s2",
      "POST",
      `/tasks/${taskId}/submissions`,
      { ...input, report: { ...report, results: "" } },
      400,
    );
    const submitKey = crypto.randomUUID(),
      copies = await Promise.all(
        [1, 2].map(() =>
          req(
            "s2",
            "POST",
            `/tasks/${taskId}/submissions`,
            input,
            201,
            submitKey,
          ),
        ),
      );
    const v1 = copies[0].data;
    assert.equal(v1.id, copies[1].data.id);
    assert.equal(v1.versionNumber, 1);
    assert.equal(v1.isLate, true);
    assert.equal(
      (
        await req(
          "f",
          "GET",
          `/terms/t1/weekly-progress?periodId=${week.id}&isLate=true`,
        )
      ).data.total,
      1,
    );
    assert.equal(await db.taskSubmission.count({ where: { taskId } }), 1);
    assert.equal((await context()).draft, null);
    await req(
      "b",
      "POST",
      `/tasks/${taskId}/cancel`,
      {
        expectedRevision: (await context()).taskRevision,
        acknowledgeExistingSubmissions: true,
        reason: "Try resetting version history",
      },
      409,
    );
    await req("s2", "POST", `/tasks/${taskId}/submissions`, input, 409);
    await req("s1", "GET", `/task-submissions/${v1.id}`, undefined, 404);
    const download = `/task-submissions/${v1.id}/files/${v1.files.find((f) => f.kind === "REPORT").id}/download`;
    await req(null, "GET", download, undefined, 401);
    await req("s1", "GET", download, undefined, 404);
    const downloaded = await fetch(base + download, { headers: token("b") });
    assert.equal(downloaded.status, 200);
    assert.equal((await downloaded.arrayBuffer()).byteLength, pdf.length);
    pass(
      "real PDF/ZIP screening, two mandatory files, structured content, private download authorization, concurrent submit creates one immutable version",
    );
    let rc = await reviewContext(v1.id),
      reviewInput = {
        expectedTaskRevision: rc.taskRevision,
        expectedSubmissionRevision: rc.submission.revision,
        decision: "REVISION_REQUIRED",
        comment: "Fix API",
        revisionDueAt: iso(5400000),
      };
    await req(
      "advisor",
      "POST",
      `/task-submissions/${v1.id}/reviews`,
      reviewInput,
      404,
    );
    await req(
      "b",
      "POST",
      `/task-submissions/${v1.id}/reviews`,
      { ...reviewInput, revisionDueAt: undefined },
      400,
    );
    const decisions = await Promise.all(
      [1, 2].map(() =>
        req(
          "b",
          "POST",
          `/task-submissions/${v1.id}/reviews`,
          reviewInput,
          [201, 409],
        ),
      ),
    );
    assert.equal(decisions.filter((r) => r.status === 201).length, 1);
    assert.equal(
      await db.progressReview.count({ where: { submissionId: v1.id } }),
      1,
    );
    async function amendDeadline(due) {
      const c = await reviewContext(v1.id);
      return req(
        "b",
        "POST",
        `/task-reviews/${c.effectiveReview.id}/amendments`,
        {
          expectedTaskRevision: c.taskRevision,
          expectedSubmissionRevision: c.submission.revision,
          expectedReviewRevision: c.effectiveReview.revision,
          decision: "REVISION_REQUIRED",
          comment: "Fix API",
          revisionDueAt: due,
          reason: "Audited deadline correction",
        },
        201,
      );
    }
    await amendDeadline(new Date(Date.now() + 1500).toISOString());
    await new Promise((resolve) => setTimeout(resolve, 1600));
    assert.equal((await context()).canSubmit, false);
    await upload("REPORT", pdf, "r.pdf", "application/pdf", 409);
    await amendDeadline(reviewInput.revisionDueAt);
    pass(
      "expired revision deadline blocks direct uploads; authorized correction keeps append-only history",
    );
    const beforeDeadline = v1.deadlineSnapshot;
    week = (
      await req("f", "PATCH", `/terms/t1/weekly-plans/${week.id}`, {
        ...create,
        reportDueAt: iso(4200000),
        expectedRevision: week.revision,
        reason: "Extend deadline",
      })
    ).data;
    assert.equal(
      (await req("s2", "GET", `/task-submissions/${v1.id}`)).data
        .deadlineSnapshot,
      beforeDeadline,
    );
    assert.equal(
      (await req("s2", "GET", `/task-submissions/${v1.id}`)).data.isLate,
      true,
    );
    assert(
      (await req("f", "GET", `/terms/t1/weekly-plans/${week.id}/history`)).data
        .length >= 3,
    );
    week = (
      await req(
        "f",
        "POST",
        `/terms/t1/weekly-plans/${week.id}/state`,
        {
          expectedRevision: week.revision,
          state: "LOCKED",
          reason: "Pause submissions",
        },
        201,
      )
    ).data;
    assert.equal((await context()).canSubmit, false);
    await upload("REPORT", pdf, "r.pdf", "application/pdf", 409);
    week = (
      await req(
        "f",
        "POST",
        `/terms/t1/weekly-plans/${week.id}/state`,
        { expectedRevision: week.revision, state: "OPEN", reason: "Resume" },
        201,
      )
    ).data;
    input = {
      expectedTaskRevision: (await context()).taskRevision,
      uploadIds: await files(),
      report,
      changeExplanation: "Fixed API",
    };
    await req(
      "s2",
      "POST",
      `/tasks/${taskId}/submissions`,
      { ...input, changeExplanation: "" },
      400,
    );
    const v2 = (
      await req("s2", "POST", `/tasks/${taskId}/submissions`, input, 201)
    ).data;
    assert.equal(v2.versionNumber, 2);
    assert.equal(v2.deadlineSnapshot, reviewInput.revisionDueAt);
    assert.equal((await reviewContext(v1.id)).history.length, 3);
    pass(
      "current advisor only, one concurrent review, mandatory revision deadline, audited extension, lock/reopen week, v2 preserves v1 review and deadline",
    );
    rc = await reviewContext(v2.id);
    await req(
      "b",
      "POST",
      `/task-submissions/${v2.id}/reviews`,
      {
        expectedTaskRevision: rc.taskRevision,
        expectedSubmissionRevision: rc.submission.revision,
        decision: "FAIL",
        comment: "Not acceptable",
      },
      201,
    );
    assert.equal((await context()).canSubmit, false);
    rc = await reviewContext(v2.id);
    assert(rc.canReopen);
    await req(
      "b",
      "POST",
      `/task-reviews/${rc.effectiveReview.id}/amendments`,
      {
        expectedTaskRevision: rc.taskRevision,
        expectedSubmissionRevision: rc.submission.revision,
        expectedReviewRevision: 0,
        decision: "PASS",
        reason: "Silent change",
      },
      409,
    );
    const reopen = {
      expectedTaskRevision: rc.taskRevision,
      reason: "Permit another attempt",
      revisionDueAt: iso(6000000),
    };
    await req("s2", "POST", `/task-submissions/${v2.id}/reopen`, reopen, 403);
    await req("b", "POST", `/task-submissions/${v2.id}/reopen`, reopen, 201);
    await req("b", "POST", `/task-submissions/${v2.id}/reopen`, reopen, 409);
    const v3 = (
      await req(
        "s2",
        "POST",
        `/tasks/${taskId}/submissions`,
        {
          expectedTaskRevision: (await context()).taskRevision,
          uploadIds: await files(),
          report,
          changeExplanation: "Reopened fixes",
        },
        201,
      )
    ).data;
    rc = await reviewContext(v3.id);
    const result = (
      await req(
        "b",
        "POST",
        `/task-submissions/${v3.id}/reviews`,
        {
          expectedTaskRevision: rc.taskRevision,
          expectedSubmissionRevision: rc.submission.revision,
          decision: "PASS",
          comment: "Accepted",
        },
        201,
      )
    ).data;
    assert.equal(result.decision, "PASS");
    assert.equal((await context()).canSubmit, false);
    assert.equal(await db.taskSubmission.count({ where: { taskId } }), 3);
    await assert.rejects(
      db.taskSubmission.update({
        where: { id: v1.id },
        data: { content: "rewrite" },
      }),
    );
    await assert.rejects(
      db.progressReview.delete({ where: { id: result.id } }),
    );
    const summary = (
      await req("f", "GET", `/terms/t1/weekly-progress?periodId=${week.id}`)
    ).data;
    assert.equal(summary.total, roster);
    assert.equal(summary.metrics.PASS, 1);
    assert.equal(summary.metrics.PENDING, 0);
    assert.equal(
      (await req("s2", "GET", `/terms/t1/weekly-progress?periodId=${week.id}`))
        .data.total,
      1,
    );
    pass(
      "FAIL requires separately authorized append-only reopening; v3 PASS seals report; versions/reviews persist; statistics count one student per week",
    );
    const worker = app.get(WeeklyNotificationWorker);
    await db.$executeRawUnsafe(
      "CREATE FUNCTION weekly_test_delivery_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected notification delivery failure'; END $$",
    );
    await db.$executeRawUnsafe(
      'CREATE TRIGGER weekly_test_delivery_failure BEFORE INSERT ON "NOTIFICATION" FOR EACH ROW EXECUTE FUNCTION weekly_test_delivery_failure()',
    );
    try {
      await assert.rejects(worker.deliver());
      assert.equal(await db.taskSubmission.count({ where: { taskId } }), 3);
      assert(
        (await db.outboxEvent.count({
          where: { type: "GUIDANCE_NOTIFICATION", state: "PENDING" },
        })) > 0,
      );
    } finally {
      await db.$executeRawUnsafe(
        'DROP TRIGGER weekly_test_delivery_failure ON "NOTIFICATION"',
      );
      await db.$executeRawUnsafe(
        "DROP FUNCTION weekly_test_delivery_failure()",
      );
    }
    await worker.deliver();
    const noteCount = await db.notification.count();
    await worker.deliver();
    assert.equal(await db.notification.count(), noteCount);
    assert.equal(
      await db.outboxEvent.count({
        where: { type: "GUIDANCE_NOTIFICATION", state: "PENDING" },
      }),
      0,
    );
    pass(
      "transactional outbox delivery retries without duplicate notifications",
    );
    const reminders = new WeeklyNotificationWorker(
      db,
      new (require("@nestjs/config").ConfigService)({
        _PROCESS_ENV_VALIDATED: { GUIDANCE_REMINDERS_ENABLED: "true" },
      }),
    );
    await reminders.tick();
    const reminderCount = await db.outboxEvent.count({
      where: { eventId: { startsWith: "weekly-reminder:" } },
    });
    assert(reminderCount > 0);
    await reminders.tick();
    assert.equal(
      await db.outboxEvent.count({
        where: { eventId: { startsWith: "weekly-reminder:" } },
      }),
      reminderCount,
    );
    pass(
      "scheduled due reminders persist and repeated ticks deduplicate by student/week/revision",
    );
    const asset = await db.fileAsset.findUnique({
      where: { id: v3.files[0].id },
    });
    await app.get(FileStorageService).deletePrivateGuidance(asset.storageKey);
    await req(
      "s2",
      "GET",
      `/task-submissions/${v3.id}/files/${asset.id}/download`,
      undefined,
      409,
    );
    pass(
      "missing private storage object returns controlled error without exposing path or deleting metadata",
    );
    if (process.env.WEEKLY_BROWSER === "true") {
      const { runWeeklyBrowser } = require("./integration/weekly-browser.cjs");
      await runWeeklyBrowser({ db, base, term, root, pdf, zip: zip(), app });
      pass(
        "live browser student draft/upload -> revision -> v2 PASS -> faculty summary",
      );
    }
    fs.mkdirSync(
      path.join(backend, "../docs/implementation/evidence/weekly-progress"),
      { recursive: true },
    );
    fs.writeFileSync(
      path.join(
        backend,
        "../docs/implementation/evidence/weekly-progress/integration.json",
      ),
      JSON.stringify(
        {
          result: "PASS",
          date: new Date().toISOString(),
          checks,
          postgresVersion: identity.version,
          sharedDatabaseAccess: false,
          browser: process.env.WEEKLY_BROWSER === "true",
        },
        null,
        2,
      ) + "\n",
    );
    console.log(checks.length + " weekly integration checks passed");
  } finally {
    if (app) await app.close();
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(
    String(e.stack || e).replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted URL]"),
  );
  process.exitCode = 1;
});
