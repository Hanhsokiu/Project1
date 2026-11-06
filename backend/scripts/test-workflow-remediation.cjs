"use strict";
// Supplemental assertions on a successful, synthetic live-E2E database only.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client"),
  bcrypt = require("bcryptjs");
const root = path.resolve(__dirname, "../.."),
  evidence = path.join(
    root,
    "docs/implementation/evidence/integration-ui-fixes-2026-10-27",
  );
async function main() {
  const run = fs
    .readFileSync(path.join(evidence, "latest-run.txt"), "utf8")
    .trim();
  const flow = JSON.parse(
    fs.readFileSync(path.join(evidence, run, "live-e2e/live-e2e.json"), "utf8"),
  );
  assert.equal(
    flow.result,
    "PASS",
    "Successful live E2E required before supplemental checks",
  );
  assert(/^btl_pr2b_audit_[a-z0-9_]+$/.test(flow.database));
  const out = path.join(evidence, run, "remediation-" + Date.now());
  fs.mkdirSync(out, { recursive: true });
  const cfg = JSON.parse(
    fs.readFileSync(
      path.join(root, ".cache/integration-ui/config.json"),
      "utf8",
    ),
  );
  const url = `postgresql://btl_ui:${cfg.password}@127.0.0.1:55451/${flow.database}`;
  Object.assign(process.env, {
    DATABASE_URL: url,
    DIRECT_URL: url,
    NODE_ENV: "test",
    EMAIL_WORKER_ENABLED: "false",
    JWT_SECRET: crypto.randomBytes(32).toString("hex"),
    JWT_REFRESH_SECRET: crypto.randomBytes(32).toString("hex"),
    STORAGE_LOCAL_PATH: path.join(out, "private"),
  });
  const db = new PrismaClient({ datasources: { db: { url } } }),
    result = {
      startedAt: new Date().toISOString(),
      database: flow.database,
      syntheticOnly: true,
      checks: [],
      traffic: [],
    };
  let app;
  const pass = (name, actual) => {
    result.checks.push({ name, actual, result: "PASS" });
    console.log("PASS " + name);
  };
  try {
    const initial = await db.notification.groupBy({
      by: ["title"],
      _count: { _all: true },
    });
    const count = (title) =>
      initial.find((x) => x.title === title)?._count._all ?? 0;
    assert.equal(count("Kết quả xét duyệt đề cương"), 4);
    assert.equal(count("Đề cương được nộp xét duyệt"), 1);
    assert.equal(count("Nhiệm vụ hướng dẫn mới"), 1);
    assert.equal(count("Bài nộp hướng dẫn mới"), 2);
    assert.equal(count("Cập nhật đánh giá báo cáo"), 2);
    const notices = await db.notification.findMany({
      select: { userId: true, title: true, termId: true, link: true },
    });
    assert.equal(notices.length, 10);
    assert(
      notices.every((n) => n.termId === "qa-t1" && n.link?.startsWith("/")),
    );
    assert.equal(notices.filter((n) => n.userId === "student").length, 5);
    assert.equal(notices.filter((n) => n.userId === "advisor").length, 5);
    pass(
      "live workflow delivers all ten notices to the exact student/advisor recipients",
      notices,
    );
    // Ephemeral credentials only for these owned synthetic test accounts.
    const password = "Fix!" + crypto.randomBytes(18).toString("hex"),
      hash = await bcrypt.hash(password, 4);
    for (const id of ["faculty", "reviewer", "student2", "advisor"])
      await db.userAccount.update({
        where: { id },
        data: { passwordHash: hash },
      });
    const { NestFactory } = require("@nestjs/core"),
      { ValidationPipe } = require("@nestjs/common"),
      { AppModule } = require("../dist/app.module");
    const {
      configureBodyParsers,
      PROPOSAL_VERSION_JSON_LIMIT,
    } = require("../dist/common/http/body-parsers");
    const {
      GlobalExceptionHandler,
    } = require("../dist/common/exception/global-exception.handler");
    app = await NestFactory.create(AppModule, {
      bodyParser: false,
      logger: false,
    });
    app.setGlobalPrefix("api");
    app.enableCors({ origin: "http://127.0.0.1:50181", credentials: true });
    configureBodyParsers(app);
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new GlobalExceptionHandler());
    await app.listen(0, "127.0.0.1");
    const api = `http://127.0.0.1:${app.getHttpServer().address().port}/api`,
      tokens = {};
    for (const actor of ["faculty", "reviewer", "student2", "advisor"]) {
      const r = await fetch(api + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "qa-" + actor, password }),
      });
      assert.equal(r.status, 201);
      tokens[actor] = (await r.json()).data.accessToken;
    }
    async function command(actor, route, body, key, expected = 201) {
      const r = await fetch(api + route, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + tokens[actor],
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify(body),
      });
      const value = await r.json();
      result.traffic.push({ actor, route, status: r.status });
      assert.equal(
        r.status,
        expected,
        route + " " + JSON.stringify(value).slice(0, 500),
      );
      return value.data;
    }
    const group = await db.reviewGroup.findFirstOrThrow({
      where: { termId: "qa-t1" },
    });
    const assigned = await command(
      "faculty",
      "/proposals/p-student2/review-assignments",
      {
        groupId: group.id,
        proposalVersionId: "v1-student2",
        expectedProposalRevision: 0,
      },
      "qa-fix-assign",
    );
    async function revisions() {
      const p = await db.proposalWorkflow.findUniqueOrThrow({
          where: { proposalId: "p-student2" },
        }),
        r = await db.proposalReviewWorkflow.findUniqueOrThrow({
          where: { reviewId: assigned.id },
        });
      return {
        expectedProposalRevision: p.revision,
        expectedReviewRevision: r.revision,
      };
    }
    await command(
      "reviewer",
      `/proposal-reviews/${assigned.id}/start`,
      await revisions(),
      "qa-fix-start",
      200,
    );
    const decision = {
      ...(await revisions()),
      versionId: "v1-student2",
      decision: "REVISION_REQUIRED",
      comment: "Synthetic revision request",
    };
    const beforeDecision = await db.notification.count();
    await command(
      "reviewer",
      `/proposal-reviews/${assigned.id}/decision`,
      decision,
      "qa-fix-decision",
      200,
    );
    await command(
      "reviewer",
      `/proposal-reviews/${assigned.id}/decision`,
      decision,
      "qa-fix-decision",
      200,
    );
    assert.equal(await db.notification.count(), beforeDecision + 2);
    pass(
      "replayed common proposal decision delivers one notice per recipient",
      "two notices, no duplicates",
    );
    const { ProposalVersionSaveSchema } = require("@doan/shared"),
      wf = await db.proposalWorkflow.findUniqueOrThrow({
        where: { proposalId: "p-student2" },
      }),
      v1 = await db.proposalVersion.findUniqueOrThrow({
        where: { id: "v1-student2" },
      });
    const input = {
      expectedRevision: wf.revision,
      content: {
        ...v1.content,
        ...Object.fromEntries(
          [
            "objectives",
            "scope",
            "mainContents",
            "tools",
            "expectedResults",
          ].map((k) => [k, "đ".repeat(11000)]),
        ),
      },
    };
    assert(ProposalVersionSaveSchema.safeParse(input).success);
    const bytes = Buffer.byteLength(JSON.stringify(input)),
      beforeVersions = await db.proposalVersion.count();
    await command(
      "student2",
      "/proposals/p-student2/versions",
      input,
      "qa-fix-large",
    );
    assert.equal(await db.proposalVersion.count(), beforeVersions + 1);
    pass(
      "authenticated schema-valid UTF-8 proposal above 100 KiB saves through the production parser",
      { bytes, status: 201, versionsAdded: 1 },
    );
    const tooLarge = await fetch(api + "/proposals/p-student2/versions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + tokens.student2,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: "x".repeat(PROPOSAL_VERSION_JSON_LIMIT),
      }),
    });
    assert.equal(tooLarge.status, 413);
    assert.equal((await tooLarge.json()).error.code, "PAYLOAD_TOO_LARGE");
    assert.equal(await db.proposalVersion.count(), beforeVersions + 1);
    pass(
      "proposal hard cap returns a redacted 413 and appends no partial version",
      "32 MiB scoped cap",
    );
    const plan = await db.guidancePlan.findFirstOrThrow(),
      planWorkflow = await db.guidancePlanWorkflow.findUniqueOrThrow({
        where: { planId: plan.id },
      }),
      period = await db.guidancePeriod.findUniqueOrThrow({
        where: { id: "qa-m1" },
      });
    const task = {
      expectedPlanRevision: planWorkflow.revision,
      title: "Synthetic notification rollback",
      expectedDeliverables: "Synthetic report",
      periodId: period.id,
      startDate: new Date(period.startsAt.getTime() + 60000).toISOString(),
      dueDate: new Date(period.endsAt.getTime() - 60000).toISOString(),
    };
    const state = async () => ({
      tasks: await db.task.count(),
      notices: await db.notification.count(),
      revision: (
        await db.guidancePlanWorkflow.findUniqueOrThrow({
          where: { planId: plan.id },
        })
      ).revision,
    });
    const before = await state();
    await db.$executeRawUnsafe(
      `CREATE FUNCTION public.qa_notice_rollback() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.key='qa-notice-rollback' THEN RAISE EXCEPTION 'synthetic failure after notification'; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      'CREATE TRIGGER qa_notice_rollback BEFORE INSERT ON public."IDEMPOTENCY_RECORD" FOR EACH ROW EXECUTE FUNCTION public.qa_notice_rollback()',
    );
    try {
      await command(
        "advisor",
        `/guidance-plans/${plan.id}/tasks`,
        task,
        "qa-notice-rollback",
        500,
      );
      assert.deepEqual(await state(), before);
    } finally {
      await db.$executeRawUnsafe(
        'DROP TRIGGER qa_notice_rollback ON public."IDEMPOTENCY_RECORD"',
      );
      await db.$executeRawUnsafe("DROP FUNCTION public.qa_notice_rollback()");
    }
    pass(
      "failure after notification insertion rolls task, revision and notice back together",
      before,
    );
    await command(
      "advisor",
      `/guidance-plans/${plan.id}/tasks`,
      task,
      "qa-notice-success",
    );
    await command(
      "advisor",
      `/guidance-plans/${plan.id}/tasks`,
      task,
      "qa-notice-success",
    );
    const after = await state();
    assert.equal(after.tasks, before.tasks + 1);
    assert.equal(after.notices, before.notices + 1);
    pass(
      "task request replay never duplicates its student notification",
      after,
    );
    const obligation = await db.weeklyReportObligation.findUniqueOrThrow({
      where: { id: "qa-obligation" },
    });
    const weeklyBody = {
      expectedObligationRevision: obligation.revision,
      expectedPlanRevision: after.revision,
    };
    const weekly = await command(
      "advisor",
      "/weekly-report-obligations/qa-obligation/task",
      weeklyBody,
      "qa-fix-weekly",
    );
    await command(
      "advisor",
      "/weekly-report-obligations/qa-obligation/task",
      weeklyBody,
      "qa-fix-weekly",
    );
    const currentObligation = await db.weeklyReportObligation.findUniqueOrThrow(
      { where: { id: "qa-obligation" } },
    );
    await command(
      "advisor",
      "/weekly-report-obligations/qa-obligation/task",
      {
        expectedObligationRevision: currentObligation.revision,
        expectedPlanRevision: (await state()).revision,
      },
      "qa-fix-weekly-existing",
    );
    const weeklyNotices = await db.notification.findMany({
      where: { title: "Nhiệm vụ báo cáo tuần" },
    });
    assert.equal(weeklyNotices.length, 1);
    assert.equal(weeklyNotices[0].userId, "student");
    assert.equal(weeklyNotices[0].link, `/guidance/tasks/${weekly.id}`);
    assert.equal(
      await db.taskWorkflow.count({ where: { obligationId: "qa-obligation" } }),
      1,
    );
    pass(
      "weekly task materialization and retries deliver exactly one scoped student notice",
      "one task, one notice across three requests",
    );
    const { spawn } = require("node:child_process");
    const child = spawn(
      process.execPath,
      [path.join(root, "frontend/scripts/test-large-proposal.cjs")],
      { cwd: root, stdio: ["pipe", "inherit", "inherit"], windowsHide: true },
    );
    const exit = new Promise((resolve, reject) => {
      child.once("exit", resolve);
      child.once("error", reject);
    });
    child.stdin.end(JSON.stringify({ api, password, out }));
    assert.equal(await exit, 0, "Large proposal browser regression failed");
    assert.equal(await db.proposalVersion.count(), beforeVersions + 2);
    pass(
      "large UTF-8 draft saves in real browser and survives reload",
      "201; one additional immutable version",
    );
    result.result = "PASS";
  } catch (e) {
    result.result = "FAIL";
    result.failure = String(e.message).replace(
      /postgres(?:ql)?:\/\/\S+/g,
      "[REDACTED]",
    );
    process.exitCode = 1;
  } finally {
    if (app) await app.close();
    await db.$disconnect();
    result.finishedAt = new Date().toISOString();
    fs.writeFileSync(
      path.join(out, "results.json"),
      JSON.stringify(result, null, 2),
    );
    console.log(out + " " + result.result);
  }
}
main().catch((e) => {
  console.error(
    String(e.message).replace(/postgres(?:ql)?:\/\/\S+/g, "[REDACTED]"),
  );
  process.exitCode = 1;
});
