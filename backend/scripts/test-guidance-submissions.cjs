"use strict";
// Real HTTP + private filesystem + PostgreSQL. Only a new isolated loopback DB.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict"),
  { spawnSync } = require("node:child_process");
const { testTarget } = require("./rehearse-pr2b.cjs");
async function main() {
  const url = testTarget(process.env.PR2B_TEST_URL),
    backend = path.resolve(__dirname, ".."),
    privateRoot =
      process.env.PR2B_GUIDANCE_PRIVATE_ROOT ||
      fs.mkdtempSync(path.join(os.tmpdir(), "btl-step8b-private-"));
  if (process.env.PR2B_GUIDANCE_PRIVATE_ROOT) {
    assert.equal(
      path.dirname(path.resolve(privateRoot)).toLowerCase(),
      path.resolve(os.tmpdir()).toLowerCase(),
    );
    assert(path.basename(privateRoot).startsWith("btl-step8c-private-"));
    assert(
      fs.lstatSync(privateRoot).isDirectory() &&
        !fs.lstatSync(privateRoot).isSymbolicLink(),
    );
  }
  Object.assign(process.env, {
    DATABASE_URL: url.toString(),
    DIRECT_URL: url.toString(),
    NODE_ENV: "test",
    JWT_SECRET: crypto.randomBytes(32).toString("hex"),
    JWT_REFRESH_SECRET: crypto.randomBytes(32).toString("hex"),
    STORAGE_LOCAL_PATH: privateRoot,
    GUIDANCE_UPLOAD_ENABLED: "true",
  });
  delete process.env.GUIDANCE_UPLOAD_POLICY_JSON;
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
    const [empty] =
      await db.$queryRaw`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`;
    assert.equal(empty.n, 0);
    const prelude = spawnSync(
      process.execPath,
      [path.join(__dirname, "test-guidance-tasks.cjs")],
      { cwd: backend, env: process.env, encoding: "utf8", windowsHide: true },
    );
    assert.equal(
      prelude.status,
      0,
      "8A producer prelude: " + prelude.stdout + " " + prelude.stderr,
    );
    const history =
      await db.$queryRaw`SELECT migration_name FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL`;
    assert.equal(
      history.length,
      fs
        .readdirSync(path.join(backend, "prisma/migrations"))
        .filter((n) =>
          fs.existsSync(
            path.join(backend, "prisma/migrations", n, "migration.sql"),
          ),
        ).length,
    );
    pass(
      "active migration chain replays with all Step 8A/7/5 real producer checks; only private loopback DB",
    );
    // Roles in producer prelude are created after migration: bootstrap action grants explicitly.
    const permissions = await db.permission.findMany({
      where: { resource: "submission" },
    });
    for (const roleId of ["FACULTY", "LECTURER", "STUDENT", "ADMIN"])
      for (const p of permissions)
        if (roleId === "ADMIN" || roleId === "STUDENT" || p.action !== "create")
          await db.rolePermission.upsert({
            where: { roleId_permissionId: { roleId, permissionId: p.id } },
            create: { roleId, permissionId: p.id },
            update: {},
          });
    const { NestFactory } = require("@nestjs/core"),
      { ValidationPipe } = require("@nestjs/common"),
      { JwtService } = require("@nestjs/jwt"),
      { ConfigService } = require("@nestjs/config"),
      { AppModule } = require("../dist/app.module"),
      {
        SubmissionService,
      } = require("../dist/guidance/submissions/submission.service"),
      {
        FileStorageService,
      } = require("../dist/common/storage/file-storage.service"),
      { crc32 } = require("../dist/guidance/submissions/submission.validator");
    app = await NestFactory.create(AppModule, {
      logger: false,
      abortOnError: false,
    });
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.listen(0, "127.0.0.1");
    const base =
        "http://127.0.0.1:" + app.getHttpServer().address().port + "/api",
      jwt = new JwtService({ secret: process.env.JWT_SECRET }),
      service = app.get(SubmissionService),
      storage = app.get(FileStorageService),
      config = app.get(ConfigService);
    const token = (actor) =>
      actor
        ? {
            Authorization:
              "Bearer " +
              jwt.sign({ sub: actor, roles: ["ADMIN", "FACULTY", "LECTURER"] }),
          }
        : {};
    async function req(
      actor,
      method,
      route,
      body,
      status = 200,
      key = crypto.randomUUID(),
    ) {
      const r = await fetch(base + route, {
          method,
          headers: {
            ...token(actor),
            "Content-Type": "application/json",
            "Idempotency-Key": key,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(30000),
        }),
        payload = await r.json();
      assert(
        (Array.isArray(status) ? status : [status]).includes(r.status),
        `${method} ${route}: ${r.status} ${JSON.stringify(payload)}`,
      );
      return {
        status: r.status,
        data: payload.data,
        code: payload.error?.code,
      };
    }
    const PDFDocument = require("pdfkit");
    const pdf = await new Promise((resolve) => {
      const chunks = [],
        doc = new PDFDocument();
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.text("Real progress report fixture");
      doc.end();
    });
    function zip(name = "src/main.ts") {
      const n = Buffer.from(name),
        b = Buffer.from("export const source = true;"),
        crc = crc32(b),
        local = Buffer.alloc(30),
        central = Buffer.alloc(46),
        end = Buffer.alloc(22);
      local.writeUInt32LE(0x04034b50);
      local.writeUInt16LE(20, 4);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(b.length, 18);
      local.writeUInt32LE(b.length, 22);
      local.writeUInt16LE(n.length, 26);
      central.writeUInt32LE(0x02014b50);
      central.writeUInt16LE(20, 6);
      central.writeUInt32LE(crc, 16);
      central.writeUInt32LE(b.length, 20);
      central.writeUInt32LE(b.length, 24);
      central.writeUInt16LE(n.length, 28);
      end.writeUInt32LE(0x06054b50);
      end.writeUInt16LE(1, 8);
      end.writeUInt16LE(1, 10);
      end.writeUInt32LE(central.length + n.length, 12);
      end.writeUInt32LE(local.length + n.length + b.length, 16);
      return Buffer.concat([local, n, b, central, n, end]);
    }
    async function upload(
      actor,
      taskId,
      kind = "REPORT",
      bytes = pdf,
      name = "report.pdf",
      mime = "application/pdf",
      status = 201,
      key = crypto.randomUUID(),
    ) {
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", new Blob([bytes], { type: mime }), name);
      const r = await fetch(`${base}/tasks/${taskId}/submission-uploads`, {
          method: "POST",
          headers: { ...token(actor), "Idempotency-Key": key },
          body: form,
          signal: AbortSignal.timeout(30000),
        }),
        payload = await r.json();
      assert(
        (Array.isArray(status) ? status : [status]).includes(r.status),
        `Upload ${actor}: ${r.status} ${JSON.stringify(payload)}`,
      );
      return {
        status: r.status,
        data: payload.data,
        code: payload.error?.code,
      };
    }
    async function newTask(due = Date.now() + 3600000) {
      const c = (await req("b", "GET", "/proposals/p2/guidance-context")).data;
      return (
        await req(
          "b",
          "POST",
          `/guidance-plans/${c.plan.id}/tasks`,
          {
            expectedPlanRevision: c.plan.revision,
            title: "Báo cáo source kiểm thử",
            expectedDeliverables: "Báo cáo và mã nguồn",
            periodId: "step8a-m1",
            startDate: new Date(Date.now() - 7200000).toISOString(),
            dueDate: new Date(due).toISOString(),
          },
          201,
        )
      ).data;
    }
    const t = await newTask();
    const context = async (id) =>
      (await req("s2", "GET", `/tasks/${id}/submission-context`)).data;
    await upload(null, t.id, "REPORT", pdf, "r.pdf", "application/pdf", 401);
    for (const actor of ["s1", "s9", "admin"])
      await upload(actor, t.id, "REPORT", pdf, "r.pdf", "application/pdf", 404);
    for (const actor of ["b", "f"])
      await upload(actor, t.id, "REPORT", pdf, "r.pdf", "application/pdf", 403);
    assert.equal(await db.guidanceSubmissionUpload.count(), 0);
    assert((await context(t.id)).canSubmit);
    pass(
      "unauthorized/non-owner/ADMIN/advisor/faculty upload rejected before staging metadata or IO",
    );
    for (const args of [
      ["REPORT", Buffer.from("fake"), "r.pdf", "application/pdf"],
      ["REPORT", pdf, "r.exe", "application/pdf"],
      ["REPORT", pdf, "r.pdf", "text/plain"],
      ["SOURCE", zip("../bad"), "s.zip", "application/zip"],
      ["REPORT", pdf, "CON.pdf", "application/pdf"],
    ])
      await upload("s2", t.id, ...args, 400);
    await upload(
      "s2",
      t.id,
      "REPORT",
      Buffer.alloc(20 * 1024 * 1024 + 1),
      "large.pdf",
      "application/pdf",
      413,
    );
    assert.equal(await db.guidanceSubmissionUpload.count(), 0);
    pass(
      "extension, MIME, content, unsafe ZIP paths/filename and oversized multipart rejected without orphan intent",
    );
    const stageKey = crypto.randomUUID(),
      r1 = (
        await upload(
          "s2",
          t.id,
          "REPORT",
          pdf,
          "Báo cáo.pdf",
          "application/pdf",
          201,
          stageKey,
        )
      ).data;
    assert.equal(
      (
        await upload(
          "s2",
          t.id,
          "REPORT",
          pdf,
          "Báo cáo.pdf",
          "application/pdf",
          201,
          stageKey,
        )
      ).data.id,
      r1.id,
    );
    await upload(
      "s2",
      t.id,
      "REPORT",
      pdf,
      "other.pdf",
      "application/pdf",
      409,
      stageKey,
    );
    const source1 = (
      await upload("s2", t.id, "SOURCE", zip(), "source.zip", "application/zip")
    ).data;
    assert.equal(await db.taskSubmission.count({ where: { taskId: t.id } }), 0);
    assert(!JSON.stringify(r1).includes("storageKey"));
    assert.equal(r1.file.originalName, "Báo cáo.pdf");
    assert(!JSON.stringify(r1).includes(privateRoot));
    const publicAttempt = await fetch(
      base.replace("/api", "") + "/uploads/.private-guidance/" + r1.id,
      { headers: token("s2") },
    );
    assert.equal(publicAttempt.status, 404);
    pass(
      "READY private staging is idempotent, has no public URL/path and does not create a submission",
    );
    const commitKey = crypto.randomUUID(),
      input = {
        expectedTaskRevision: t.revision,
        uploadIds: [r1.id, source1.id],
        content: "Nội dung tuần 1",
      };
    await req("s1", "POST", `/tasks/${t.id}/submissions`, input, 404);
    await req(
      "s2",
      "POST",
      `/tasks/${t.id}/submissions`,
      { ...input, ownerId: "s1" },
      400,
    );
    const sub = (
      await req(
        "s2",
        "POST",
        `/tasks/${t.id}/submissions`,
        input,
        201,
        commitKey,
      )
    ).data;
    assert.equal(sub.versionNumber, 1);
    assert.equal(sub.isLate, false);
    assert.equal(sub.files.length, 2);
    assert.equal(sub.state, "SUBMITTED");
    assert.equal(
      (
        await req(
          "s2",
          "POST",
          `/tasks/${t.id}/submissions`,
          input,
          201,
          commitKey,
        )
      ).data.id,
      sub.id,
    );
    assert.equal(await db.taskSubmission.count({ where: { taskId: t.id } }), 1);
    assert.equal(sub.contextSnapshot.advisorId, "b");
    assert.equal(sub.contextSnapshot.termId, "t1");
    pass(
      "owner commits report+source atomically with version, actor/time, official advisor/term and policy snapshot; idempotent replay",
    );
    for (const actor of ["s2", "b", "f"]) {
      const list = (await req(actor, "GET", `/tasks/${t.id}/submissions`)).data;
      assert.equal(list.total, 1);
      const r = await fetch(
        `${base}/task-submissions/${sub.id}/files/${sub.files[0].id}/download`,
        { headers: token(actor) },
      );
      assert.equal(r.status, 200);
      assert.match(r.headers.get("content-disposition"), /^attachment/);
      assert.equal(r.headers.get("x-content-type-options"), "nosniff");
      assert.equal(r.headers.get("cache-control"), "private, no-store");
      const bytes = Buffer.from(await r.arrayBuffer());
      assert.equal(
        crypto.createHash("sha256").update(bytes).digest("hex"),
        sub.files[0].checksum,
      );
    }
    for (const actor of ["s1", "s9", "advisor", "a", "admin", "f2", "fd2"]) {
      await req(actor, "GET", `/task-submissions/${sub.id}`, undefined, 404);
      const r = await fetch(
        `${base}/task-submissions/${sub.id}/files/${sub.files[0].id}/download`,
        { headers: token(actor) },
      );
      assert.equal(r.status, 404);
    }
    await req(
      "s2",
      "GET",
      `/task-submissions/${sub.id}/files/${crypto.randomUUID()}/download`,
      undefined,
      404,
    );
    pass(
      "student/current advisor/scoped faculty can download attachments; cross-student/term/department/reviewer/old advisor/ADMIN denied",
    );
    const before = await db.taskSubmission.findUnique({
        where: { id: sub.id },
        include: { pr2bSubmissionAssetSubmissionId: true },
      }),
      r2 = (await upload("s2", t.id)).data,
      source2 = (
        await upload("s2", t.id, "SOURCE", zip(), "v2.zip", "application/zip")
      ).data,
      c = await context(t.id),
      in2 = {
        expectedTaskRevision: c.taskRevision,
        uploadIds: [r2.id, source2.id],
        content: "Bản nộp lại",
      };
    const race = await Promise.all([
      req("s2", "POST", `/tasks/${t.id}/submissions`, in2, [201, 409]),
      req("s2", "POST", `/tasks/${t.id}/submissions`, in2, [201, 409]),
    ]);
    assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
    assert.equal(race.find((r) => r.status === 201).data.versionNumber, 2);
    assert.deepEqual(
      await db.taskSubmission.findUnique({
        where: { id: sub.id },
        include: { pr2bSubmissionAssetSubmissionId: true },
      }),
      before,
    );
    assert.equal(
      (
        await db.submissionWorkflow.findUnique({
          where: { submissionId: sub.id },
        })
      ).state,
      "SUPERSEDED",
    );
    await assert.rejects(
      db.taskSubmission.update({
        where: { id: sub.id },
        data: { content: "overwrite" },
      }),
    );
    await assert.rejects(
      db.submissionWorkflow.update({
        where: { submissionId: sub.id },
        data: { isLate: true },
      }),
    );
    await assert.rejects(
      db.submissionAsset.deleteMany({ where: { submissionId: sub.id } }),
    );
    await assert.rejects(
      db.fileAsset.update({
        where: { id: sub.files[0].id },
        data: { checksum: "fake" },
      }),
    );
    pass(
      "concurrent resubmission commits one v2; v1 bytes/content/links preserved, old state SUPERSEDED and DB immutability guards hold",
    );
    const other = await newTask();
    await req(
      "s2",
      "POST",
      `/tasks/${other.id}/submissions`,
      { expectedTaskRevision: other.revision, uploadIds: [r1.id, source1.id] },
      404,
    );
    pass(
      "staged/committed assets cannot be replayed onto a different task or student",
    );
    const lateTask = await newTask(Date.now() - 1000),
      lr = (await upload("s2", lateTask.id)).data,
      ls = (
        await upload(
          "s2",
          lateTask.id,
          "SOURCE",
          zip(),
          "late.zip",
          "application/zip",
        )
      ).data;
    const late = (
      await req(
        "s2",
        "POST",
        `/tasks/${lateTask.id}/submissions`,
        { expectedTaskRevision: lateTask.revision, uploadIds: [lr.id, ls.id] },
        201,
      )
    ).data;
    assert.equal(late.isLate, true);
    assert(Date.parse(late.submittedAt) > Date.parse(late.deadlineSnapshot));
    pass(
      "deadline passed does not lock submission while phase open; server captures isLate/deadline snapshot",
    );
    const pair = async (id) => [
      (await upload("s2", id)).data.id,
      (await upload("s2", id, "SOURCE", zip(), "code.zip", "application/zip"))
        .data.id,
    ];
    const atomic = await newTask(),
      files = await pair(atomic.id),
      atomicInput = { expectedTaskRevision: atomic.revision, uploadIds: files };
    await db.$executeRawUnsafe(
      `CREATE FUNCTION public.step8b_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='SUBMISSION_COMMITTED' THEN RAISE EXCEPTION 'injected'; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER step8b_fail_audit BEFORE INSERT ON public."AUDIT_LOG" FOR EACH ROW EXECUTE FUNCTION public.step8b_fail_audit()`,
    );
    await req(
      "s2",
      "POST",
      `/tasks/${atomic.id}/submissions`,
      atomicInput,
      500,
    );
    assert.equal(
      await db.taskSubmission.count({ where: { taskId: atomic.id } }),
      0,
    );
    assert.equal((await context(atomic.id)).taskRevision, atomic.revision);
    assert.equal(
      await db.guidanceSubmissionUpload.count({
        where: { id: { in: files }, state: "READY" },
      }),
      2,
    );
    await db.$executeRawUnsafe(
      'DROP TRIGGER step8b_fail_audit ON public."AUDIT_LOG"',
    );
    pass(
      "audit/metadata failure rolls back submission, current pointer, version counter, links and file claims together",
    );
    await db.termPhase.update({
      where: { id: "step8a-guidance-phase" },
      data: { isLocked: true },
    });
    await req(
      "s2",
      "POST",
      `/tasks/${atomic.id}/submissions`,
      atomicInput,
      409,
    );
    await upload(
      "s2",
      atomic.id,
      "REPORT",
      pdf,
      "blocked.pdf",
      "application/pdf",
      409,
    );
    await db.termPhase.update({
      where: { id: "step8a-guidance-phase" },
      data: { isLocked: false },
    });
    assert.equal(
      await db.taskSubmission.count({ where: { taskId: atomic.id } }),
      0,
    );
    pass(
      "locked GUIDANCE phase rejects both upload and uncommitted READY staging; no partial submission",
    );
    // Actual phase lock race, not a sequential flag test.
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
      `/tasks/${atomic.id}/submissions`,
      atomicInput,
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
    await pending;
    assert(waiter);
    assert.equal(
      await db.taskSubmission.count({ where: { taskId: atomic.id } }),
      0,
    );
    await db.termPhase.update({
      where: { id: "step8a-guidance-phase" },
      data: { isLocked: false },
    });
    pass(
      "real concurrent phase closure serializes against submission commit and rejects upload started before lock",
    );
    const oldSave = storage.savePrivateGuidance.bind(storage);
    storage.savePrivateGuidance = async () => {
      throw Error("injected IO");
    };
    await upload(
      "s2",
      atomic.id,
      "REPORT",
      pdf,
      "io.pdf",
      "application/pdf",
      503,
    );
    storage.savePrivateGuidance = oldSave;
    const expired = await db.guidanceSubmissionUpload.findFirst({
      where: { taskId: atomic.id, state: "EXPIRED" },
    });
    assert(expired);
    assert.equal(expired.assetId, null);
    assert.equal(
      await db.taskSubmission.count({ where: { taskId: atomic.id } }),
      0,
    );
    pass(
      "storage failure leaves no READY metadata/submission and retains recoverable expired intent",
    );
    const beforeAssets = await db.fileAsset.count(),
      failedReadyKey = crypto.randomUUID();
    await db.$executeRawUnsafe(
      `CREATE OR REPLACE FUNCTION public.step8b_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='SUBMISSION_UPLOAD_READY' THEN RAISE EXCEPTION 'injected'; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER step8b_fail_audit BEFORE INSERT ON public."AUDIT_LOG" FOR EACH ROW EXECUTE FUNCTION public.step8b_fail_audit()`,
    );
    await upload(
      "s2",
      atomic.id,
      "REPORT",
      pdf,
      "ready-failure.pdf",
      "application/pdf",
      503,
      failedReadyKey,
    );
    await db.$executeRawUnsafe(
      'DROP TRIGGER step8b_fail_audit ON public."AUDIT_LOG"',
    );
    const failedReady = await db.guidanceSubmissionUpload.findUnique({
      where: {
        actorId_taskId_requestKey: {
          actorId: "s2",
          taskId: atomic.id,
          requestKey: failedReadyKey,
        },
      },
    });
    assert.equal(failedReady.state, "EXPIRED");
    assert(failedReady.cleanedAt);
    assert.equal(failedReady.assetId, null);
    assert.equal(await db.fileAsset.count(), beforeAssets);
    assert(
      !fs.existsSync(
        path.join(privateRoot, ".private-guidance", failedReady.id),
      ),
    );
    pass(
      "metadata failure after writing bytes rolls back FileAsset and removes private orphan while retaining cleanup intent",
    );
    await db.guidanceSubmissionUpload.updateMany({
      where: { id: { in: files } },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await service.cleanup();
    assert.equal(
      await db.guidanceSubmissionUpload.count({
        where: {
          id: { in: files },
          state: "EXPIRED",
          cleanedAt: { not: null },
        },
      }),
      2,
    );
    for (const id of files)
      assert(!fs.existsSync(path.join(privateRoot, ".private-guidance", id)));
    await req(
      "s2",
      "POST",
      `/tasks/${atomic.id}/submissions`,
      atomicInput,
      409,
    );
    const committedBefore = await db.guidanceSubmissionUpload.count({
      where: { state: "COMMITTED" },
    });
    await service.cleanup();
    assert.equal(
      await db.guidanceSubmissionUpload.count({
        where: { state: "COMMITTED" },
      }),
      committedBefore,
    );
    pass(
      "expired unclaimed staging is quarantined/cleaned; committed files survive sweeps and expired references cannot submit",
    );
    const remaining = (
      await req("s2", "GET", "/terms/t1/weekly-report-coverage")
    ).data.data.find((r) => r.periodId === "step8a-w1");
    const weeklyFiles = await pair(remaining.currentTaskId),
      wc = await context(remaining.currentTaskId);
    await req(
      "s2",
      "POST",
      `/tasks/${remaining.currentTaskId}/submissions`,
      { expectedTaskRevision: wc.taskRevision, uploadIds: weeklyFiles },
      201,
    );
    const covered = (
      await req("s2", "GET", "/terms/t1/weekly-report-coverage")
    ).data.data.find((r) => r.periodId === "step8a-w1");
    assert.equal(covered.submissionState, "SUBMITTED");
    assert.equal(
      (
        await db.taskWorkflow.findUnique({
          where: { taskId: remaining.currentTaskId },
        })
      ).state,
      "SUBMITTED",
    );
    assert.equal(await db.progressReview.count(), 0);
    pass(
      "weekly obligation coverage consumes real submission pointer; no PASS/completion/evaluation is fabricated",
    );
    const disabled = await newTask();
    config.set("_PROCESS_ENV_VALIDATED.GUIDANCE_UPLOAD_ENABLED", "false");
    assert.equal((await context(disabled.id)).canSubmit, false);
    await upload(
      "s2",
      disabled.id,
      "REPORT",
      pdf,
      "off.pdf",
      "application/pdf",
      409,
    );
    config.set("_PROCESS_ENV_VALIDATED.GUIDANCE_UPLOAD_ENABLED", "true");
    const meta = await db.dossierWorkflow.findFirst({
      where: { refDossierId: { proposalId: "p2" } },
    });
    await db.dossierWorkflow.update({
      where: { id: meta.id },
      data: { state: "REOPENED" },
    });
    await upload(
      "s2",
      disabled.id,
      "REPORT",
      pdf,
      "invalid.pdf",
      "application/pdf",
      409,
    );
    await db.dossierWorkflow.update({
      where: { id: meta.id },
      data: { state: "RECEIVED" },
    });
    pass(
      "explicit disabled policy and invalid/reopened dossier block upload without inventing missing ownership/finalization",
    );
    fs.writeFileSync(
      path.join(backend, "prisma/review/step8b-results.json"),
      JSON.stringify(
        {
          result: "PASS",
          postgresVersion: identity.version,
          sharedDatabaseDDL: false,
          privateFilesystem: true,
          step8aPrelude: true,
          checks,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(checks.length + " Step 8B API checks passed");
  } finally {
    if (app) await app.close();
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(
    "Step 8B isolated integration failed: " +
      String(e.message).replace(
        /postgres(?:ql)?:\/\/[^\s]+/gi,
        "[redacted URL]",
      ),
  );
  process.exitCode = 1;
});
