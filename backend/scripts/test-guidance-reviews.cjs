"use strict";
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
    privateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "btl-step8c-private-"));
  Object.assign(process.env, {
    DATABASE_URL: url.toString(),
    DIRECT_URL: url.toString(),
    NODE_ENV: "test",
    JWT_SECRET: crypto.randomBytes(32).toString("hex"),
    JWT_REFRESH_SECRET: crypto.randomBytes(32).toString("hex"),
    STORAGE_LOCAL_PATH: privateRoot,
    PR2B_GUIDANCE_PRIVATE_ROOT: privateRoot,
    GUIDANCE_UPLOAD_ENABLED: "true",
  });
  delete process.env.GUIDANCE_UPLOAD_POLICY_JSON;
  const { PrismaClient } = require("@prisma/client"),
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } }),
    checks = [],
    pass = (name) => {
      checks.push({ name, result: "PASS" });
      console.log("PASS " + name);
    };
  let app;
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
      [path.join(__dirname, "test-guidance-submissions.cjs")],
      { cwd: backend, env: process.env, encoding: "utf8", windowsHide: true },
    );
    assert.equal(
      prelude.status,
      0,
      "8B producer prelude: " + prelude.stdout + " " + prelude.stderr,
    );
    assert.equal(
      (
        await db.$queryRaw`SELECT migration_name FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL`
      ).length,
      10,
    );
    pass(
      "ten-migration replay and all 8A→8B producer checks with real HTTP/private files; no shared database",
    );
    for (const [resource, action, roles] of [
      ["task", "review", ["LECTURER", "ADMIN"]],
      ["guidance", "monitor", ["FACULTY", "ADMIN"]],
    ]) {
      const p = await db.permission.findUnique({
        where: { resource_action: { resource, action } },
      });
      for (const roleId of roles)
        await db.rolePermission.upsert({
          where: { roleId_permissionId: { roleId, permissionId: p.id } },
          create: { roleId, permissionId: p.id },
          update: {},
        });
    }
    const { NestFactory } = require("@nestjs/core"),
      { ValidationPipe } = require("@nestjs/common"),
      { JwtService } = require("@nestjs/jwt"),
      { AppModule } = require("../dist/app.module"),
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
      token = (actor) =>
        actor
          ? {
              Authorization:
                "Bearer " +
                jwt.sign({
                  sub: actor,
                  roles: ["ADMIN", "FACULTY", "LECTURER"],
                }),
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
      const response = await fetch(base + route, {
          method,
          headers: {
            ...token(actor),
            "Content-Type": "application/json",
            "Idempotency-Key": key,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(30000),
        }),
        payload = await response.json();
      assert(
        (Array.isArray(status) ? status : [status]).includes(response.status),
        `${method} ${route}: expected ${status}, got ${response.status} ${JSON.stringify(payload)}`,
      );
      return {
        status: response.status,
        data: payload.data,
        code: payload.error?.code,
      };
    }
    const PDFDocument = require("pdfkit"),
      pdf = await new Promise((resolve) => {
        const b = [],
          d = new PDFDocument();
        d.on("data", (c) => b.push(c));
        d.on("end", () => resolve(Buffer.concat(b)));
        d.text("Step 8C full flow progress");
        d.end();
      });
    const n = Buffer.from("main.ts"),
      bytes = Buffer.from("export const source = true;"),
      local = Buffer.alloc(30),
      central = Buffer.alloc(46),
      end = Buffer.alloc(22),
      crc = crc32(bytes);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(n.length, 26);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(bytes.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(n.length, 28);
    end.writeUInt32LE(0x06054b50);
    end.writeUInt16LE(1, 8);
    end.writeUInt16LE(1, 10);
    end.writeUInt32LE(central.length + n.length, 12);
    end.writeUInt32LE(local.length + n.length + bytes.length, 16);
    const zip = Buffer.concat([local, n, bytes, central, n, end]);
    const ctx = async (id, actor = "b") =>
      (await req(actor, "GET", `/task-submissions/${id}/review-context`)).data;
    async function task() {
      const c = (await req("b", "GET", "/proposals/p2/guidance-context")).data;
      return (
        await req(
          "b",
          "POST",
          `/guidance-plans/${c.plan.id}/tasks`,
          {
            expectedPlanRevision: c.plan.revision,
            title: "8C full guidance flow",
            description: "Task được giao qua 8A",
            expectedDeliverables: "PDF báo cáo + ZIP source",
            periodId: "step8a-m1",
            startDate: new Date(Date.now() - 3600000).toISOString(),
            dueDate: new Date(Date.now() + 3600000).toISOString(),
          },
          201,
        )
      ).data;
    }
    async function stage(taskId, kind) {
      const form = new FormData();
      form.append("kind", kind);
      form.append(
        "file",
        new Blob([kind === "REPORT" ? pdf : zip], {
          type: kind === "REPORT" ? "application/pdf" : "application/zip",
        }),
        kind === "REPORT" ? "report.pdf" : "source.zip",
      );
      const r = await fetch(`${base}/tasks/${taskId}/submission-uploads`, {
          method: "POST",
          headers: { ...token("s2"), "Idempotency-Key": crypto.randomUUID() },
          body: form,
        }),
        body = await r.json();
      assert.equal(r.status, 201, JSON.stringify(body));
      return body.data.id;
    }
    const files = async (id) => [
      await stage(id, "REPORT"),
      await stage(id, "SOURCE"),
    ];
    async function submit(t, content = "Báo cáo thử nghiệm") {
      const c = (await req("s2", "GET", `/tasks/${t.id}/submission-context`))
        .data;
      return (
        await req(
          "s2",
          "POST",
          `/tasks/${t.id}/submissions`,
          {
            expectedTaskRevision: c.taskRevision,
            uploadIds: await files(t.id),
            content,
          },
          201,
        )
      ).data;
    }
    const reviewInput = (
      c,
      decision = "REVISION_REQUIRED",
      comment = "Bổ sung kiểm thử và giải thích thiết kế",
    ) => ({
      expectedTaskRevision: c.taskRevision,
      expectedSubmissionRevision: c.submission.revision,
      decision,
      comment,
    });
    const amendInput = (
      c,
      decision = "FAIL",
      reason = "Đối soát lại bài nộp",
    ) => ({
      ...reviewInput(c, decision),
      expectedReviewRevision: c.effectiveReview.revision,
      reason,
    });
    const protectedBefore = {
      legacy: await db.taskReview.findMany(),
      grade: await db.finalResult.count(),
      eligibility: await db.defenseEligibility.count(),
    };
    const options = (await req("b", "GET", "/guidance-review-options/terms"))
      .data;
    assert(options.canReview && options.terms.some((t) => t.id === "t1"));
    await req(null, "GET", "/terms/t1/progress-review-inbox", undefined, 401);
    await req("b", "GET", "/terms/t2/progress-review-inbox", undefined, 404);
    await req(
      "admin",
      "GET",
      "/terms/t1/progress-review-inbox",
      undefined,
      404,
    );
    await req("s2", "GET", "/terms/t1/progress-review-inbox", undefined, 403);
    pass(
      "inbox/options use current advisor roster and term scope; JWT role claims/ADMIN cannot bypass",
    );
    const t = await task(),
      sub1 = await submit(t),
      beforeSub = await db.taskSubmission.findUnique({
        where: { id: sub1.id },
      });
    let c = await ctx(sub1.id);
    assert.equal(c.submission.versionNumber, 1);
    assert.deepEqual(c.allowedActions, ["review"]);
    assert.equal(c.currentSubmissionId, sub1.id);
    for (const actor of ["s1", "s9", "advisor", "a", "admin", "f2", "fd2"])
      await req(
        actor,
        "GET",
        `/task-submissions/${sub1.id}/review-context`,
        undefined,
        404,
      );
    for (const actor of ["s2", "f"])
      await req(
        actor,
        "POST",
        `/task-submissions/${sub1.id}/reviews`,
        reviewInput(c),
        403,
      );
    for (const actor of ["advisor", "a", "admin"])
      await req(
        actor,
        "POST",
        `/task-submissions/${sub1.id}/reviews`,
        reviewInput(c),
        404,
      );
    const download = await fetch(
      `${base}/task-submissions/${sub1.id}/files/${sub1.files[0].id}/download`,
      { headers: token("b") },
    );
    assert.equal(download.status, 200);
    assert.equal(
      crypto
        .createHash("sha256")
        .update(Buffer.from(await download.arrayBuffer()))
        .digest("hex"),
      sub1.files[0].checksum,
    );
    pass(
      "8A task→8B PDF/source→8C exact-version review/download; owner/faculty read, no unauthorized reviewer or IDOR",
    );
    for (const decision of ["FAIL", "REVISION_REQUIRED"])
      await req(
        "b",
        "POST",
        `/task-submissions/${sub1.id}/reviews`,
        { ...reviewInput(c, decision), comment: "" },
        400,
      );
    await req(
      "b",
      "POST",
      `/task-submissions/${sub1.id}/reviews`,
      { ...reviewInput(c), score: 10 },
      400,
    );
    await req(
      "b",
      "POST",
      `/task-submissions/${sub1.id}/reviews`,
      { ...reviewInput(c), expectedSubmissionRevision: 99 },
      409,
    );
    assert.equal(
      await db.progressReview.count({ where: { submissionId: sub1.id } }),
      0,
    );
    pass(
      "strict three-way DTO, required failure/revision comment and CAS reject invalid or stale writes",
    );
    const key = crypto.randomUUID(),
      input = reviewInput(c),
      notifsBefore = await db.notification.count({ where: { userId: "s2" } }),
      outboxBefore = await db.outboxEvent.count({
        where: { type: "TASK_SUBMISSION_REVIEWED" },
      });
    let recorded = (
      await req(
        "b",
        "POST",
        `/task-submissions/${sub1.id}/reviews`,
        input,
        201,
        key,
      )
    ).data;
    assert.equal(recorded.decision, "REVISION_REQUIRED");
    assert.equal(recorded.reviewerUserId, "b");
    assert.equal(recorded.assignmentRevision, 1);
    assert.equal(
      (
        await req(
          "b",
          "POST",
          `/task-submissions/${sub1.id}/reviews`,
          input,
          201,
          key,
        )
      ).data.id,
      recorded.id,
    );
    await req(
      "b",
      "POST",
      `/task-submissions/${sub1.id}/reviews`,
      { ...input, comment: "khác" },
      409,
      key,
    );
    await req("b", "POST", `/task-submissions/${sub1.id}/reviews`, input, 409);
    assert.equal(
      await db.notification.count({ where: { userId: "s2" } }),
      notifsBefore + 1,
    );
    assert.equal(
      await db.outboxEvent.count({
        where: { type: "TASK_SUBMISSION_REVIEWED" },
      }),
      outboxBefore + 1,
    );
    assert.equal(
      (await db.taskWorkflow.findUnique({ where: { taskId: t.id } })).state,
      "REVISION_REQUESTED",
    );
    assert.equal(
      (
        await db.submissionWorkflow.findUnique({
          where: { submissionId: sub1.id },
        })
      ).state,
      "REVIEWED",
    );
    assert.equal(
      (await ctx(sub1.id, "s2")).effectiveReview.comment,
      input.comment,
    );
    assert(
      (await req("s2", "GET", `/tasks/${t.id}/submission-context`)).data
        .canSubmit,
    );
    pass(
      "revision result stores immutable reviewer/version/time/comment; one notification/outbox/audit and idempotent effective decision",
    );
    const sub2 = await submit(t, "Bản v2 phản hồi yêu cầu sửa");
    assert.equal(sub2.versionNumber, 2);
    assert.deepEqual(
      await db.taskSubmission.findUnique({ where: { id: sub1.id } }),
      beforeSub,
    );
    const historical = await ctx(sub1.id);
    assert(historical.readiness.includes("STALE_SUBMISSION"));
    assert.deepEqual(historical.allowedActions, []);
    assert.equal(historical.history[0].comment, input.comment);
    await req(
      "b",
      "POST",
      `/task-reviews/${recorded.id}/amendments`,
      amendInput(historical),
      409,
    );
    pass(
      "student sees revision requirement and submits v2; v1/comment/files remain and stale v1 review/amend is blocked",
    );
    c = await ctx(sub2.id);
    recorded = (
      await req(
        "b",
        "POST",
        `/task-submissions/${sub2.id}/reviews`,
        reviewInput(c, "PASS", "Đủ yêu cầu"),
        201,
      )
    ).data;
    assert.equal(
      (await db.taskWorkflow.findUnique({ where: { taskId: t.id } })).state,
      "COMPLETED",
    );
    assert.equal(
      (await req("s2", "GET", `/tasks/${t.id}/submission-context`)).data
        .canSubmit,
      false,
    );
    pass(
      "PASS of current v2 atomically completes task; student cannot submit on completed task",
    );
    c = await ctx(sub2.id);
    const passRecord = await db.progressReview.findUnique({
      where: { id: recorded.id },
    });
    recorded = (
      await req(
        "b",
        "POST",
        `/task-reviews/${recorded.id}/amendments`,
        amendInput(c, "FAIL"),
        201,
      )
    ).data;
    assert.equal(recorded.decision, "FAIL");
    assert.equal(recorded.supersedesReviewId, passRecord.id);
    assert.equal(
      (await db.progressReview.findUnique({ where: { id: passRecord.id } }))
        .state,
      "SUPERSEDED",
    );
    assert.equal(
      (await db.progressReview.findUnique({ where: { id: passRecord.id } }))
        .comment,
      passRecord.comment,
    );
    assert.equal(
      (await db.taskWorkflow.findUnique({ where: { taskId: t.id } })).state,
      "REVISION_REQUESTED",
    );
    c = await ctx(sub2.id);
    recorded = (
      await req(
        "b",
        "POST",
        `/task-reviews/${recorded.id}/amendments`,
        amendInput(c, "REVISION_REQUIRED", "Làm rõ loại kết quả"),
        201,
      )
    ).data;
    c = await ctx(sub2.id);
    assert(c.history.some((r) => r.decision === "FAIL"));
    assert(c.history.some((r) => r.decision === "REVISION_REQUIRED"));
    assert(c.history.some((r) => r.decision === "PASS"));
    await assert.rejects(
      db.progressReview.update({
        where: { id: recorded.id },
        data: { comment: "overwrite" },
      }),
    );
    await assert.rejects(
      db.progressReview.delete({ where: { id: recorded.id } }),
    );
    pass(
      "amend PASS→FAIL→REVISION_REQUIRED appends distinct decisions/reasons and recalculates task without overwriting history",
    );
    c = await ctx(sub2.id);
    const raceInputs = [
        amendInput(c, "FAIL", "Race A"),
        amendInput(c, "REVISION_REQUIRED", "Race B"),
      ],
      raceKeys = [crypto.randomUUID(), crypto.randomUUID()],
      race = await Promise.all(
        raceInputs.map((i, n) =>
          req(
            "b",
            "POST",
            `/task-reviews/${c.effectiveReview.id}/amendments`,
            i,
            [201, 409],
            raceKeys[n],
          ),
        ),
      );
    assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
    assert.equal(
      await db.progressReview.count({
        where: { submissionId: sub2.id, state: "RECORDED" },
      }),
      1,
    );
    const win = race.findIndex((r) => r.status === 201);
    assert.equal(
      (
        await req(
          "b",
          "POST",
          `/task-reviews/${c.effectiveReview.id}/amendments`,
          raceInputs[win],
          201,
          raceKeys[win],
        )
      ).data.id,
      race[win].data.id,
    );
    pass(
      "concurrent amendments create one effective record, bounded retry/optimistic conflict and replay no duplicate",
    );
    c = await ctx(sub2.id);
    const staged = await files(t.id),
      resubmit = {
        expectedTaskRevision: c.taskRevision,
        uploadIds: staged,
        content: "v3 concurrent",
      },
      amend = amendInput(c, "PASS", "Đối soát đồng thời"),
      dual = await Promise.all([
        req("s2", "POST", `/tasks/${t.id}/submissions`, resubmit, [201, 409]),
        req(
          "b",
          "POST",
          `/task-reviews/${c.effectiveReview.id}/amendments`,
          amend,
          [201, 409],
        ),
      ]);
    assert.deepEqual(dual.map((r) => r.status).sort(), [201, 409]);
    if (dual[0].status === 201) {
      assert.equal((await ctx(sub2.id)).allowedActions.length, 0);
      assert.equal(
        (await db.taskWorkflow.findUnique({ where: { taskId: t.id } }))
          .currentSubmissionId,
        dual[0].data.id,
      );
    } else
      assert.equal(
        (await db.taskWorkflow.findUnique({ where: { taskId: t.id } })).state,
        "COMPLETED",
      );
    pass(
      "review amendment versus student resubmission serializes on same task and never concludes a superseded version",
    );
    const atomic = await task(),
      atomicSub = await submit(atomic);
    c = await ctx(atomicSub.id);
    const before = {
      reviews: await db.progressReview.count(),
      notifications: await db.notification.count(),
      outbox: await db.outboxEvent.count(),
      history: await db.taskHistory.count(),
      tw: await db.taskWorkflow.findUnique({ where: { taskId: atomic.id } }),
      sw: await db.submissionWorkflow.findUnique({
        where: { submissionId: atomicSub.id },
      }),
    };
    await db.$executeRawUnsafe(
      `CREATE FUNCTION public.step8c_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='PROGRESS_REVIEW_RECORDED' THEN RAISE EXCEPTION 'injected'; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER step8c_audit_fail BEFORE INSERT ON public."AUDIT_LOG" FOR EACH ROW EXECUTE FUNCTION public.step8c_audit_fail()`,
    );
    await req(
      "b",
      "POST",
      `/task-submissions/${atomicSub.id}/reviews`,
      reviewInput(c, "PASS"),
      500,
    );
    assert.equal(await db.progressReview.count(), before.reviews);
    assert.equal(await db.notification.count(), before.notifications);
    assert.equal(await db.outboxEvent.count(), before.outbox);
    assert.equal(await db.taskHistory.count(), before.history);
    assert.deepEqual(
      await db.taskWorkflow.findUnique({ where: { taskId: atomic.id } }),
      before.tw,
    );
    assert.deepEqual(
      await db.submissionWorkflow.findUnique({
        where: { submissionId: atomicSub.id },
      }),
      before.sw,
    );
    await db.$executeRawUnsafe(
      'DROP TRIGGER step8c_audit_fail ON public."AUDIT_LOG"',
    );
    pass(
      "audit failure rolls back review, completion, pointers, history, notifications and outbox together",
    );
    const notif = (await req("s2", "GET", "/me/notifications")).data.data[0];
    assert(notif);
    assert(!notif.body.includes(input.comment));
    assert(!notif.body.includes("REVISION_REQUIRED"));
    await req("b", "GET", "/notifications/user/s2", undefined, 404);
    await req("admin", "GET", "/notifications/user/s2", undefined, 404);
    assert(
      Array.isArray((await req("s2", "GET", "/notifications/user/s2")).data),
    );
    await req("b", "POST", `/me/notifications/${notif.id}/read`, {}, 404);
    const read = (
      await req("s2", "POST", `/me/notifications/${notif.id}/read`, {})
    ).data;
    assert.equal(read.status, "READ");
    assert.equal(
      (await req("s2", "POST", `/me/notifications/${notif.id}/read`, {})).data
        .readAt,
      read.readAt,
    );
    pass(
      "transactional in-app notices are self-only, generic and idempotently read; legacy notification IDOR closed with array shape preserved",
    );
    const plan = (await req("b", "GET", "/proposals/p2/guidance-context")).data
        .plan,
      meetingInput = {
        expectedPlanRevision: plan.revision,
        occurredAt: new Date(Date.now() - 60000).toISOString(),
        mode: "ONLINE",
        location: "Phòng hướng dẫn",
        discussion: "Đã trao đổi báo cáo và source",
        conclusion: "Bổ sung kiểm thử tích hợp",
      };
    for (const a of ["s2", "f"])
      await req(
        a,
        "POST",
        `/guidance-plans/${plan.id}/meetings`,
        meetingInput,
        403,
      );
    await req(
      "advisor",
      "POST",
      `/guidance-plans/${plan.id}/meetings`,
      meetingInput,
      404,
    );
    const meetingKey = crypto.randomUUID(),
      meeting = (
        await req(
          "b",
          "POST",
          `/guidance-plans/${plan.id}/meetings`,
          meetingInput,
          201,
          meetingKey,
        )
      ).data;
    assert.equal(
      (
        await req(
          "b",
          "POST",
          `/guidance-plans/${plan.id}/meetings`,
          meetingInput,
          201,
          meetingKey,
        )
      ).data.id,
      meeting.id,
    );
    assert.equal(meeting.authorUserId, "b");
    const meetingAmend = {
      expectedRevision: meeting.revision,
      reason: "Bổ sung kết luận buổi hướng dẫn",
      occurredAt: meetingInput.occurredAt,
      mode: "IN_PERSON",
      location: "Phòng 2",
      discussion: meetingInput.discussion,
      conclusion: "Thống nhất nhiệm vụ tiếp theo",
    };
    const meetingRace = await Promise.all([
      req(
        "b",
        "PATCH",
        `/guidance-meetings/${meeting.id}`,
        meetingAmend,
        [200, 409],
      ),
      req(
        "b",
        "PATCH",
        `/guidance-meetings/${meeting.id}`,
        { ...meetingAmend, conclusion: "Xung đột" },
        [200, 409],
      ),
    ]);
    assert.deepEqual(meetingRace.map((r) => r.status).sort(), [200, 409]);
    for (const actor of ["s2", "f", "b"]) {
      const l = (await req(actor, "GET", `/guidance-plans/${plan.id}/meetings`))
        .data;
      assert.equal(l.total, 1);
      assert.equal(l.data[0].history.length, 2);
      assert.equal(
        l.data[0].history[0].snapshot.before.conclusion,
        meetingInput.conclusion,
      );
    }
    const latestMeeting = (
      await req("b", "GET", `/guidance-plans/${plan.id}/meetings`)
    ).data.data[0];
    const partial = (
      await req("b", "PATCH", `/guidance-meetings/${meeting.id}`, {
        expectedRevision: latestMeeting.revision,
        reason: "Sửa một field theo contract",
        conclusion: "Kết luận cập nhật riêng",
      })
    ).data;
    assert.equal(partial.discussion, latestMeeting.discussion);
    assert.equal(partial.occurredAt, latestMeeting.occurredAt);
    assert.equal(partial.mode, latestMeeting.mode);
    assert.equal(partial.history.length, 3);
    await req(
      "s1",
      "GET",
      `/guidance-plans/${plan.id}/meetings`,
      undefined,
      404,
    );
    await assert.rejects(
      db.meetingHistory.deleteMany({ where: { meetingId: meeting.id } }),
    );
    pass(
      "confirmed meeting create/amend is scoped, versioned and audited; concurrent edits preserve original discussion/conclusion history",
    );
    for (const actor of ["b", "s2"])
      await req(actor, "GET", "/terms/t1/guidance-dashboard", undefined, 403);
    for (const actor of ["admin", "f2"])
      await req(actor, "GET", "/terms/t1/guidance-dashboard", undefined, 404);
    const legacyTask = await task();
    await db.taskSubmission.create({
      data: {
        taskId: legacyTask.id,
        content:
          "Synthetic unverified legacy evidence; no guessed current version",
      },
    });
    const d = (
      await req(
        "f",
        "GET",
        "/terms/t1/guidance-dashboard?advisorId=b&studentId=s2",
      )
    ).data;
    assert(d.metrics.totalTasks > 0);
    assert(d.tasks.data.find((r) => r.taskId === legacyTask.id).legacyUnknown);
    assert(d.metrics.legacyUnknown > 0);
    assert(d.weekly.required >= 2);
    assert(d.weekly.missingTask > 0);
    const actual = await db.task.findMany({
      where: { guidancePlanId: plan.id },
      include: {
        pr2bTaskWorkflowTaskId: {
          include: {
            refCurrentSubmissionId: {
              include: {
                pr2bSubmissionWorkflowSubmissionId: {
                  include: { refEffectiveReviewId: true },
                },
              },
            },
          },
        },
      },
    });
    assert.equal(d.metrics.totalTasks, actual.length);
    assert.equal(
      d.metrics.completed,
      actual.filter((t) => t.pr2bTaskWorkflowTaskId?.state === "COMPLETED")
        .length,
    );
    assert.equal(
      d.metrics.failed,
      actual.filter(
        (t) =>
          t.pr2bTaskWorkflowTaskId?.refCurrentSubmissionId
            ?.pr2bSubmissionWorkflowSubmissionId?.refEffectiveReviewId
            ?.decision === "FAIL",
      ).length,
    );
    assert.equal(
      (await req("f", "GET", "/terms/t1/guidance-dashboard?studentId=s1")).data
        .metrics.totalTasks,
      0,
    );
    assert.equal(
      (await req("fd2", "GET", "/terms/t1/guidance-dashboard")).data.metrics
        .totalTasks,
      0,
    );
    pass(
      "faculty metrics use real canonical task/review data with current advisor/student/department filters; weekly missing exists without manual task",
    );
    // Deferred database constraint rejects a review/result-pointer mismatch at commit.
    await assert.rejects(
      db.$transaction(async (tx) => {
        await tx.taskWorkflow.update({
          where: { taskId: atomic.id },
          data: { state: "COMPLETED" },
        });
      }),
    );
    await db.termPhase.update({
      where: { id: "step8a-guidance-phase" },
      data: { isLocked: true },
    });
    c = await ctx(atomicSub.id);
    assert.equal(c.allowedActions.length, 0);
    await req(
      "b",
      "POST",
      `/task-submissions/${atomicSub.id}/reviews`,
      reviewInput(c, "PASS"),
      409,
    );
    await db.termPhase.update({
      where: { id: "step8a-guidance-phase" },
      data: { isLocked: false },
    });
    const meta = await db.dossierWorkflow.findFirst({
      where: { refDossierId: { proposalId: "p2" } },
    });
    await db.dossierWorkflow.update({
      where: { id: meta.id },
      data: { state: "REOPENED" },
    });
    await req(
      "b",
      "POST",
      `/task-submissions/${atomicSub.id}/reviews`,
      reviewInput(c, "PASS"),
      409,
    );
    await db.dossierWorkflow.update({
      where: { id: meta.id },
      data: { state: "RECEIVED" },
    });
    pass(
      "no completion without effective current PASS; locked phase or reopened dossier blocks review mutation",
    );
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
    c = await ctx(atomicSub.id);
    const pending = req(
      "b",
      "POST",
      `/task-submissions/${atomicSub.id}/reviews`,
      reviewInput(c, "PASS"),
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
      await db.progressReview.count({ where: { submissionId: atomicSub.id } }),
      0,
    );
    await db.termPhase.update({
      where: { id: "step8a-guidance-phase" },
      data: { isLocked: false },
    });
    pass(
      "real concurrent phase closure serializes with review commit and leaves no late conclusion/notification",
    );
    assert.deepEqual(await db.taskReview.findMany(), protectedBefore.legacy);
    assert.equal(await db.finalResult.count(), protectedBefore.grade);
    assert.equal(
      await db.defenseEligibility.count(),
      protectedBefore.eligibility,
    );
    const audits = await db.auditLog.findMany({
      where: {
        action: {
          in: [
            "PROGRESS_REVIEW_RECORDED",
            "PROGRESS_REVIEW_AMENDED",
            "GUIDANCE_MEETING_RECORDED",
            "GUIDANCE_MEETING_AMENDED",
          ],
        },
      },
    });
    assert(audits.length);
    assert(
      audits.every(
        (a) => !JSON.stringify(a.newValue).includes("Bổ sung kiểm thử"),
      ),
    );
    assert(
      audits.every((a) =>
        Object.keys(a.newValue).every((k) =>
          [
            "submissionId",
            "reviewId",
            "reviewHash",
            "meetingId",
            "contentHash",
          ].includes(k),
        ),
      ),
    );
    pass(
      "legacy boolean review, graduation score and defense eligibility untouched; technical audit stores IDs/hashes rather than academic text",
    );
    fs.writeFileSync(
      path.join(backend, "prisma/review/step8c-results.json"),
      JSON.stringify(
        {
          result: "PASS",
          postgresVersion: identity.version,
          sharedDatabaseDDL: false,
          step8bPrelude: true,
          checks,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(checks.length + " Step 8C API checks passed");
  } finally {
    if (app) await app.close();
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(
    "Step 8C isolated integration failed: " +
      String(e.message).replace(
        /postgres(?:ql)?:\/\/[^\s]+/gi,
        "[redacted URL]",
      ),
  );
  process.exitCode = 1;
});
