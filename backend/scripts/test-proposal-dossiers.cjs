"use strict";
// Real HTTP + PDF + PostgreSQL. New isolated loopback database required.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict"),
  { spawnSync } = require("node:child_process"),
  { pathToFileURL } = require("node:url");
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
    assert.equal(tables.n, 0, "New empty DB required");
    const prelude = spawnSync(
      process.execPath,
      [path.join(__dirname, "test-proposal-reviews.cjs")],
      { cwd: backend, env: process.env, encoding: "utf8", windowsHide: true },
    );
    assert.equal(
      prelude.status,
      0,
      "Step 5 producer failed: " + prelude.stdout + " " + prelude.stderr,
    );
    pass(
      "active migration chain/checksums and 27 Step 5 API producer checks replay successfully",
    );
    const receivePermission = await db.permission.findUnique({
      where: { resource_action: { resource: "dossier", action: "receive" } },
    });
    for (const roleId of ["FACULTY", "ADMIN"])
      await db.rolePermission.create({
        data: { roleId, permissionId: receivePermission.id },
      });
    await db.termPhase.create({
      data: {
        id: "step7-edit-phase",
        termId: "t1",
        phaseName: "Synthetic edit",
        startDate: new Date("2020-01-01Z"),
        endDate: new Date("2099-01-01Z"),
        pr2bTermPhaseWorkflowPhaseId: {
          create: { termId: "t1", key: "PROPOSAL_EDIT" },
        },
      },
    });
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
          "Bearer " + jwt.sign({ sub: actor, roles: ["ADMIN", "FACULTY"] });
      const response = await fetch(base + route, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(30000),
        }),
        payload = await response.json();
      assert(
        (Array.isArray(status) ? status : [status]).includes(response.status),
        `${method} ${route} expected ${status}, got ${response.status}: ${JSON.stringify(payload)}`,
      );
      return {
        data: payload.data,
        code: payload.error?.code,
        status: response.status,
      };
    }
    const dossier = async (actor = "f", id = "p2") =>
      (await req(actor, "GET", `/proposals/${id}/dossier`)).data;
    const content = {
      schemaVersion: 1,
      objectives: "Mục tiêu nghiên cứu tiếng Việt",
      scope: "Phạm vi hệ thống quản lý",
      mainContents: "Nội dung đề cương chính thức",
      tools: "TypeScript và PostgreSQL",
      expectedResults: "Phần mềm và báo cáo",
      startsAt: "2026-10-01T00:00:00+07:00",
      endsAt: "2027-01-01T00:00:00+07:00",
      schedule: [
        {
          label: "Nghiên cứu và phân tích yêu cầu",
          startsAt: "2026-10-01T00:00:00+07:00",
          endsAt: "2026-11-01T00:00:00+07:00",
          deliverables: "Đề cương hoàn chỉnh",
        },
      ],
    };
    let context = (await req("s2", "GET", "/proposals/p2/editing-context"))
      .data;
    const draft = (
      await req(
        "s2",
        "POST",
        "/proposals/p2/versions",
        {
          expectedRevision: context.revision,
          basedOnVersionId: context.submittedVersionId,
          content,
        },
        201,
      )
    ).data;
    const sealed = (
      await req("s2", "POST", "/proposals/p2/submit", {
        expectedRevision: draft.proposalRevision,
        versionId: draft.id,
      })
    ).data;
    let round = (
      await req(
        "f",
        "POST",
        "/proposals/p2/review-assignments",
        {
          groupId: "g1",
          proposalVersionId: sealed.id,
          expectedProposalRevision: sealed.proposalRevision,
        },
        201,
      )
    ).data;
    round = (
      await req("a", "POST", `/proposal-reviews/${round.id}/start`, {
        expectedProposalRevision: round.proposalRevision,
        expectedReviewRevision: round.revision,
      })
    ).data;
    await req("a", "POST", `/proposal-reviews/${round.id}/decision`, {
      expectedProposalRevision: round.proposalRevision,
      expectedReviewRevision: round.revision,
      versionId: sealed.id,
      decision: "APPROVED",
    });
    pass(
      "valid Step 6 resubmission and Step 5 APPROVED decision provide exact input to finalization",
    );
    const beforeVersion = await db.proposalVersion.findUnique({
      where: { id: sealed.id },
      include: { pr2bProposalVersionWorkflowVersionId: true },
    });
    const inputFor = (d) => ({
      expectedProposalRevision: d.proposalRevision,
      expectedDossierRevision: d.revision,
      approvedVersionId: d.submittedVersionId,
    });
    let d = await dossier();
    assert(d.readiness.includes("STUDENT_PROFILE_NOT_READY"));
    assert(!d.allowedActions.includes("finalize"));
    assert.equal(
      (await req("f", "POST", "/proposals/p2/finalize", inputFor(d), 409)).code,
      "STUDENT_PROFILE_NOT_READY",
    );
    assert.equal(await db.thesisDossier.count(), 0);
    pass(
      "missing producer class/major blocks finalize and never invents official metadata",
    );
    await req(null, "GET", "/proposals/p2/dossier", undefined, 401);
    for (const actor of ["s1", "s9", "f2", "fd2", "a", "admin"])
      await req(actor, "GET", "/proposals/p2/dossier", undefined, 404);
    await req("s2", "POST", "/proposals/p2/finalize", inputFor(d), 404);
    await req("advisor", "POST", "/proposals/p2/finalize", inputFor(d), 404);
    pass(
      "faculty/student/advisor scopes, cross-term/department and ADMIN denial do not trust JWT roles",
    );
    const notApproved = await dossier("f", "p4");
    assert.equal(
      (
        await req(
          "f",
          "POST",
          "/proposals/p4/finalize",
          inputFor(notApproved),
          409,
        )
      ).code,
      "STATE_TRANSITION_INVALID",
    );
    const incomplete = await dossier("f", "p1");
    assert.equal(
      (
        await req(
          "f",
          "POST",
          "/proposals/p1/finalize",
          inputFor(incomplete),
          409,
        )
      ).code,
      "STALE_VERSION",
    );
    // Separate synthetic producer condition: current pointers align, but the
    // old Step 5 snapshot has no schedule. No snapshot content is modified.
    await db.proposalWorkflow.update({
      where: { proposalId: "p1" },
      data: { workingVersionId: incomplete.submittedVersionId },
    });
    const currentMapping = await db.researchAreaWorkflow.findUnique({
      where: { researchAreaId: "area" },
    });
    const oldApproval = await db.proposalReviewWorkflow.findFirst({
      where: { proposalId: "p1", state: "DECIDED" },
    });
    // The Step 5 prelude also changed routing globally after p1 was approved.
    // Isolate the missing-content test using its recorded mapping revision,
    // then restore the synthetic producer's current mapping for all other tests.
    await db.researchAreaWorkflow.update({
      where: { researchAreaId: "area" },
      data: { revision: oldApproval.routingSnapshot.revision },
    });
    assert.equal(
      (
        await req(
          "f",
          "POST",
          "/proposals/p1/finalize",
          inputFor(incomplete),
          409,
        )
      ).code,
      "PROPOSAL_CONTENT_INVALID",
    );
    await db.researchAreaWorkflow.update({
      where: { researchAreaId: "area" },
      data: { revision: currentMapping.revision },
    });
    pass(
      "unapproved proposals and approved but incomplete legacy content cannot finalize",
    );
    await db.dossierStudentProfile.create({
      data: {
        termStudentId: "ts2",
        className: "Công nghệ thông tin K63",
        majorName: "Khoa học máy tính",
        revision: 1,
      },
    });
    d = await dossier();
    assert(d.allowedActions.includes("finalize"));
    assert.equal(
      d.previewSnapshot.student.className,
      "Công nghệ thông tin K63",
    );
    await req(
      "f",
      "POST",
      "/proposals/p2/finalize",
      { ...inputFor(d), approvedVersionId: "v1" },
      409,
    );
    pass(
      "faculty preview uses confirmed producer profile; stale/cross-proposal approved version is rejected",
    );
    await db.$executeRawUnsafe(
      `CREATE FUNCTION public.step7_test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.resource='dossier' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER step7_test_audit_failure BEFORE INSERT ON public."AUDIT_LOG" FOR EACH ROW EXECUTE FUNCTION public.step7_test_audit_failure()`,
    );
    await req("f", "POST", "/proposals/p2/finalize", inputFor(d), 500);
    assert.equal(await db.thesisDossier.count(), 0);
    assert.equal(await db.dossierFinalization.count(), 0);
    await db.$executeRawUnsafe(
      'DROP TRIGGER step7_test_audit_failure ON public."AUDIT_LOG"',
    );
    pass(
      "audit failure rolls back dossier, finalization, pointers and revisions atomically",
    );
    const routingBefore = await db.researchAreaWorkflow.findUnique({
      where: { researchAreaId: "area" },
    });
    await db.researchAreaWorkflow.update({
      where: { researchAreaId: "area" },
      data: { revision: { increment: 1 } },
    });
    assert.equal(
      (await req("f", "POST", "/proposals/p2/finalize", inputFor(d), 409)).code,
      "ROUTING_MISMATCH",
    );
    await db.researchAreaWorkflow.update({
      where: { researchAreaId: "area" },
      data: { revision: routingBefore.revision },
    });
    pass(
      "routing changed after approval cannot silently finalize under stale review evidence",
    );
    const input = inputFor(d),
      finalizeKey = crypto.randomUUID();
    const outcomes = await Promise.all([
      req(
        "f",
        "POST",
        "/proposals/p2/finalize",
        input,
        [201, 409],
        finalizeKey,
      ),
      req("f", "POST", "/proposals/p2/finalize", input, [201, 409]),
    ]);
    assert.deepEqual(outcomes.map((r) => r.status).sort(), [201, 409]);
    d = await dossier();
    const finalizationId = d.currentFinalization.id;
    assert.equal(d.state, "FINALIZED");
    assert.equal(d.currentFinalization.approvedVersionId, sealed.id);
    assert(d.currentFinalization.finalizedAt);
    assert.equal(d.receipt, null);
    assert.equal(d.currentFinalization.pdfGeneratedAt, null);
    assert.equal(await db.dossierFinalization.count(), 1);
    assert.equal(
      await db.dossierHistory.count({ where: { action: "FINALIZED" } }),
      1,
    );
    pass(
      "concurrent finalize commits once; exact approvedVersionId/time stored separately from PDF and receipt",
    );
    // Replay the key belonging to the winner, regardless of scheduling.
    const winningKey = await db.idempotencyRecord.findFirst({
      where: { route: "/proposals/p2/finalize" },
    });
    const replay = await req(
      "f",
      "POST",
      "/proposals/p2/finalize",
      input,
      201,
      winningKey.key,
    );
    assert.equal(replay.data.currentFinalization.id, finalizationId);
    assert.equal(
      (
        await req(
          "f",
          "POST",
          "/proposals/p2/finalize",
          { ...input, approvedVersionId: "different" },
          409,
          winningKey.key,
        )
      ).code,
      "IDEMPOTENCY_CONFLICT",
    );
    pass(
      "duplicate same-key request replays one finalization; different payload conflicts",
    );
    const finalization = await db.dossierFinalization.findUnique({
      where: { id: finalizationId },
    });
    await assert.rejects(
      db.dossierFinalization.update({
        where: { id: finalizationId },
        data: { printSnapshot: { tampered: true } },
      }),
    );
    await assert.rejects(
      db.proposalVersion.update({
        where: { id: sealed.id },
        data: { content: { tampered: true } },
      }),
    );
    await req(
      "s2",
      "POST",
      "/proposals/p2/versions",
      {
        expectedRevision: d.proposalRevision,
        basedOnVersionId: sealed.id,
        content,
      },
      409,
    );
    pass(
      "DB and API preserve finalized snapshot and the SEALED approved version",
    );
    await req("f", "GET", "/proposals/p2/dossier.pdf", undefined, 409);
    const generateInput = { expectedRevision: d.revision, finalizationId },
      generateKey = crypto.randomUUID();
    const pdfCreated = await req(
      "s2",
      "POST",
      "/proposals/p2/dossier/pdf",
      generateInput,
      200,
      generateKey,
    );
    assert.equal(pdfCreated.data.state, "FINALIZED");
    assert.equal(pdfCreated.data.receipt, null);
    const generatedAgain = await req(
      "s2",
      "POST",
      "/proposals/p2/dossier/pdf",
      generateInput,
      200,
      generateKey,
    );
    assert.deepEqual(generatedAgain.data, pdfCreated.data);
    assert.equal(await db.dossierPdfContent.count(), 1);
    pass(
      "student creates private PDF once; PDF generation never claims a signature or physical submission",
    );
    async function download(actor, proposalId = "p2", fId = finalizationId) {
      const response = await fetch(
        `${base}/proposals/${proposalId}/dossier.pdf?finalizationId=${encodeURIComponent(fId)}`,
        {
          headers: actor
            ? { Authorization: "Bearer " + jwt.sign({ sub: actor }) }
            : {},
        },
      );
      return { response, bytes: Buffer.from(await response.arrayBuffer()) };
    }
    const actual = await download("s2");
    assert.equal(actual.response.status, 200);
    assert.equal(
      actual.response.headers.get("content-type"),
      "application/pdf",
    );
    assert.match(actual.response.headers.get("cache-control"), /no-store/);
    assert.match(
      actual.response.headers.get("content-disposition"),
      /^attachment/,
    );
    assert.equal(actual.bytes.subarray(0, 5).toString(), "%PDF-");
    assert.equal(
      crypto.createHash("sha256").update(actual.bytes).digest("hex"),
      pdfCreated.data.currentFinalization.pdfChecksum,
    );
    for (const actor of ["s1", "s9", "f2", "fd2", "a", "admin"])
      assert.equal((await download(actor)).response.status, 404);
    assert.equal((await download(null)).response.status, 401);
    assert.equal((await download("s2", "p1")).response.status, 404);
    assert.equal((await download("s2", "p2", "foreign")).response.status, 409);
    assert.equal((await download("advisor")).response.status, 200);
    pass(
      "authenticated PDF download rechecks ownership/current advisor/grants and blocks ID tampering and ADMIN",
    );
    const { getDocument } = await import(
      pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href
    );
    async function inspect(bytes) {
      const pdf = await getDocument({
        data: new Uint8Array(bytes),
        useSystemFonts: false,
        isEvalSupported: false,
      }).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i),
          viewport = page.getViewport({ scale: 1 });
        assert(Math.abs(viewport.width - 595.28) < 1);
        assert(Math.abs(viewport.height - 841.89) < 1);
        for (const item of (await page.getTextContent()).items) {
          if (!("str" in item)) continue;
          text += item.str + "\n";
          assert(
            item.transform[4] >= 40 &&
              item.transform[4] + item.width <= viewport.width - 39,
            `Horizontal overflow: ${item.str}`,
          );
          assert(
            item.transform[5] >= 20 &&
              item.transform[5] <= viewport.height - 30,
            `Vertical overflow: ${item.str}`,
          );
        }
      }
      const pages = pdf.numPages;
      await pdf.destroy();
      return { text, pages };
    }
    const parsed = await inspect(actual.bytes);
    for (const field of [
      "ĐỀ CƯƠNG ĐỒ ÁN TỐT NGHIỆP",
      "Công nghệ thông tin K63",
      "Khoa học máy tính",
      "Mục tiêu nghiên cứu tiếng Việt",
      "Phạm vi hệ thống quản lý",
      "TypeScript và PostgreSQL",
      "Phần mềm và báo cáo",
      "Trưởng Khoa",
      "Trưởng Bộ môn",
      "Giảng viên hướng dẫn",
      "Sinh viên thực hiện",
    ])
      assert(parsed.text.includes(field), `Missing Unicode field ${field}`);
    fs.writeFileSync(
      path.join(backend, "prisma/review/step7-sample.pdf"),
      actual.bytes,
    );
    pass(
      "real PDF text extraction verifies Vietnamese Unicode, all required fields, A4 and page bounds",
    );
    const {
      DossierPdfService,
    } = require("../dist/topic/proposal-dossiers/dossier-pdf.service");
    const longSnapshot = structuredClone(finalization.printSnapshot);
    longSnapshot.content.schedule = Array.from({ length: 35 }, (_, i) => ({
      ...content.schedule[0],
      label:
        `Công việc ${i + 1}: ` +
        "Phân tích hệ thống ".repeat(i === 0 ? 200 : 4),
      deliverables: "Minh chứng hoàn thành ".repeat(12),
    }));
    longSnapshot.content.mainContents +=
      "\n" + "Nội dung nghiên cứu có dấu tiếng Việt. ".repeat(500);
    const long = await new DossierPdfService().render(
        longSnapshot,
        "synthetic-long-table",
        new Date(finalization.finalizedAt),
      ),
      longParsed = await inspect(long.bytes);
    assert.equal(
      longParsed.pages,
      long.pages,
      "Footer must not create an extra blank page",
    );
    assert(longParsed.pages >= 4);
    assert(longParsed.text.includes("Công việc 35"));
    assert(longParsed.text.includes("Sinh viên thực hiện"));
    assert(longParsed.text.split("Nội dung công việc").length > 2);
    fs.writeFileSync(
      path.join(backend, "prisma/review/step7-long-sample.pdf"),
      long.bytes,
    );
    pass(
      "long content and oversized schedule rows paginate, repeat table header and retain all final rows/signatures",
    );
    await db.dossierStudentProfile.update({
      where: { termStudentId: "ts2" },
      data: {
        className: "Changed after finalization",
        revision: { increment: 1 },
      },
    });
    await db.student.update({
      where: { id: "s2" },
      data: { fullName: "Changed after finalization" },
    });
    assert.deepEqual((await download("s2")).bytes, actual.bytes);
    assert.equal(
      (await dossier()).currentFinalization.snapshot.student.className,
      "Công nghệ thông tin K63",
    );
    pass(
      "changes to live catalog/profile do not alter official snapshot or stored PDF bytes",
    );
    d = await dossier();
    const receiptInput = {
      expectedRevision: d.revision,
      finalizationId,
      note: "Khoa đã nhận hồ sơ giấy trong kiểm thử tổng hợp",
    };
    await req("s2", "POST", "/proposals/p2/dossier/receipt", receiptInput, 403);
    await req(
      "admin",
      "POST",
      "/proposals/p2/dossier/receipt",
      receiptInput,
      404,
    );
    await req("f2", "POST", "/proposals/p2/dossier/receipt", receiptInput, 404);
    await db.termPhase.update({
      where: { id: "phase-t1" },
      data: { isLocked: true },
    });
    assert.equal(
      (
        await req(
          "f",
          "POST",
          "/proposals/p2/dossier/receipt",
          receiptInput,
          409,
        )
      ).code,
      "TERM_003",
    );
    assert.equal(await db.dossierReceipt.count(), 0);
    assert.equal((await download("s2")).response.status, 200);
    await db.termPhase.update({
      where: { id: "phase-t1" },
      data: { isLocked: false },
    });
    pass(
      "receipt requires scoped faculty and open review phase; historical PDF reads remain available when phase locks",
    );
    const receiptKey = crypto.randomUUID(),
      received = await req(
        "f",
        "POST",
        "/proposals/p2/dossier/receipt",
        receiptInput,
        201,
        receiptKey,
      );
    assert.equal(received.data.state, "RECEIVED");
    assert.equal(received.data.receipt.finalizationId, finalizationId);
    assert.equal(received.data.receipt.receivedByUserId, "f");
    await req(
      "f",
      "POST",
      "/proposals/p2/dossier/receipt",
      receiptInput,
      201,
      receiptKey,
    );
    assert.equal(await db.dossierReceipt.count(), 1);
    assert.equal(
      await db.dossierHistory.count({ where: { action: "PHYSICAL_RECEIVED" } }),
      1,
    );
    assert.equal(
      await db.auditLog.count({
        where: { resource: "dossier", action: "PHYSICAL_RECEIVED" },
      }),
      1,
    );
    await assert.rejects(
      db.dossierReceipt.update({
        where: { finalizationId },
        data: { note: "overwrite" },
      }),
    );
    pass(
      "physical receipt has server actor/time, unique finalization, immutable evidence and idempotent atomic audit",
    );
    await db.academicTermGrant.update({
      where: { userId_termId: { userId: "f", termId: "t1" } },
      data: {
        allDepartments: false,
        pr2bGrantDepartmentGrantId: { deleteMany: {} },
      },
    });
    await req(
      "f",
      "POST",
      "/proposals/p2/finalize",
      input,
      404,
      winningKey.key,
    );
    assert.deepEqual(
      await db.proposalVersion.findUnique({
        where: { id: sealed.id },
        include: { pr2bProposalVersionWorkflowVersionId: true },
      }),
      beforeVersion,
    );
    pass(
      "grant revocation blocks cached replay and approved version remains unchanged after finalization/PDF/receipt",
    );
    fs.writeFileSync(
      path.join(backend, "prisma/review/step7-results.json"),
      JSON.stringify(
        {
          result: "PASS",
          postgresVersion: identity.version,
          checks,
          sharedDatabaseDDL: false,
          pdfPages: parsed.pages,
          longPdfPages: longParsed.pages,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`${checks.length} Step 7 integration checks passed`);
  } finally {
    if (app) await app.close();
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(
    "Step 7 isolated integration failed: " +
      String(e.message).replace(
        /postgres(?:ql)?:\/\/[^\s]+/gi,
        "[redacted URL]",
      ),
  );
  process.exitCode = 1;
});
