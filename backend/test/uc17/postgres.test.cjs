"use strict";
// Only the owned Docker runner may supply this target. Deliberately NOT imported
// by Vitest's unit glob. There is no skip-on-missing-URL and no .env fallback.
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const { spawnSync } = require("node:child_process");
const { randomUUID, createHash } = require("node:crypto");
const { describe, it, before, after, beforeEach } = require("node:test");
const { setTimeout: delay } = require("node:timers/promises");
const { target, assertContainer, verifyDatabase } = require("./target.cjs");
const {
  makeFixture,
  runtime,
  pdfBytes,
  file,
  putInput,
} = require("./fixture.cjs");
const {
  gate,
  waitBlocked,
  holdTerm,
  pauseStorage,
  afterDatabaseTime,
  expectSqlFailure,
} = require("./concurrency.cjs");
const targetInfo = target(process.env); // Fail BEFORE constructing any client.
const dockerEnv = { ...process.env };
delete dockerEnv.DOCKER_HOST;
delete dockerEnv.DOCKER_CONTEXT;
const inspection = spawnSync(
  "docker",
  ["--host", targetInfo.endpoint, "inspect", targetInfo.containerId],
  {
    encoding: "utf8",
    windowsHide: true,
    env: dockerEnv,
  },
);
assert.equal(
  inspection.status,
  0,
  "Owned Docker instance must remain inspectable",
);
assertContainer(JSON.parse(inspection.stdout)[0], targetInfo);
const root = process.env.UC17_TEST_PRIVATE_ROOT;
assert(
  root && path.basename(root).startsWith(`project1-uc17-${targetInfo.run}-`),
);
const { PrismaClient } = require("@prisma/client");
const clientNames = ["a", "b", "blocker", "observer"].map(
  (n) => `uc17_${targetInfo.run}_${n}`,
);
const clients = clientNames.map((name) => {
  const url = new URL(targetInfo.url);
  url.searchParams.set("connection_limit", "1");
  url.searchParams.set("application_name", name);
  return new PrismaClient({ datasources: { db: { url: url.toString() } } });
});
const [db, db2, blocker, observer] = clients;
let a, b, pdf, f;
const dist = (p) => require(`../../dist/${p}`);
const measurement = (name, values) =>
  console.log("MEASUREMENT " + JSON.stringify({ name, ...values }));
async function context(rt = a) {
  return rt.read.context(f.advisorUser, f.proposalId);
}
async function decide(input, rt = a) {
  return rt.command.put(
    f.advisorUser,
    f.proposalId,
    input || putInput(await context(rt)),
  );
}
async function rawPut(rt, input, actor = f.advisorUser) {
  const res = await fetch(
    `${rt.base}/proposals/${f.proposalId}/defense-confirmation`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${rt.jwt.sign({ sub: actor, sid: actor })}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(25000),
    },
  );
  return { status: res.status, body: await res.json() };
}
async function durable() {
  const decision = await observer.defenseConfirmation.findUnique({
    where: { proposalId: f.proposalId },
  });
  return {
    decision,
    history: decision
      ? await observer.defenseConfirmationHistory.findMany({
          where: { confirmationId: decision.id },
          orderBy: { revision: "asc" },
        })
      : [],
    audit: await observer.auditLog.findMany({
      where: { resource: "defense-confirmation", resourceId: f.proposalId },
      orderBy: { createdAt: "asc" },
    }),
  };
}

// SQL fixture for testing the FUTURE finalization lock protocol, not an API or
// academic eligibility implementation. Every roster member is retained/excluded.
async function finalizeFixture(tx, facts = f, overrides = {}) {
  const list = await tx.defenseList.findUnique({
    where: { termId: facts.termId },
  });
  const report = await tx.finalReport.findUnique({
    where: { proposalId: facts.proposalId },
    include: { fileAsset: true },
  });
  const decision = await tx.defenseConfirmation.findUnique({
    where: { proposalId: facts.proposalId },
  });
  const [clock] = await tx.$queryRaw`SELECT clock_timestamp() AS at`;
  const revision = list.revision + 1,
    at = clock.at;
  const pdfSnapshot = report?.fileAsset
    ? {
        finalReportId: report.id,
        revision: report.revision,
        checksum: report.fileAsset.checksum,
        originalName: report.fileAsset.originalName,
        sizeBytes: report.fileAsset.sizeBytes,
        submittedAt: report.submittedAt.toISOString(),
      }
    : null;
  const roster = [
    { termStudentId: facts.memberId, studentId: facts.studentId },
    { termStudentId: facts.otherMemberId, studentId: facts.otherStudentId },
  ];
  const snapshot = {
    schemaVersion: 1,
    termId: facts.termId,
    listRevision: revision,
    finalizationVersion: 1,
    finalizedAt: at.toISOString(),
    finalizedByUserId: facts.facultyUser,
    roster: { count: roster.length, members: roster },
    students: roster.map((m, i) => ({
      ...m,
      proposalId: i === 0 ? facts.proposalId : null,
      pdf: i === 0 ? pdfSnapshot : null,
      confirmation:
        i === 0 && decision
          ? {
              id: decision.id,
              revision: decision.revision,
              status: decision.status,
              advisorId: decision.advisorId,
              decidedAt: decision.decidedAt?.toISOString() || null,
              decidedByUserId: decision.decidedByUserId,
              snapshot: decision.decisionContext,
            }
          : null,
      eligibility: null,
      admitted: false,
      exclusionReasons: [
        i === 0 ? "ACADEMIC_REVIEW_NOT_IN_THIS_TEST" : "MISSING_PROPOSAL",
      ],
    })),
  };
  const { defenseListSnapshotHash } = dist(
    "common/uc18-finalization/defense-list-snapshot",
  );
  const row = await tx.defenseListFinalization.create({
    data: {
      id: randomUUID(),
      termId: facts.termId,
      version: 1,
      listRevision: revision,
      snapshotSchemaVersion: 1,
      snapshot,
      contentHash: defenseListSnapshotHash(snapshot),
      finalizedAt: at,
      finalizedByUserId: facts.facultyUser,
      ...overrides,
    },
  });
  await tx.defenseList.update({
    where: { termId: facts.termId },
    data: {
      state: "FINALIZED",
      revision,
      currentFinalizationId: row.id,
      updatedAt: at,
    },
  });
  return row;
}
async function seal() {
  return db2.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM public."THESIS_TERM" WHERE id=${f.termId} FOR UPDATE`;
      return finalizeFixture(tx);
    },
    { timeout: 15000 },
  );
}
async function readUc18() {
  return observer.$transaction((tx) => a.reader.read(f.termId, tx));
}

describe(
  "UC17 real PostgreSQL integration (owned ephemeral database only)",
  { concurrency: false, timeout: 180000 },
  () => {
    before(async () => {
      for (const client of clients) await verifyDatabase(client, targetInfo);
      const pids = await Promise.all(
        clients.map((c) => c.$queryRaw`SELECT pg_backend_pid()::int AS pid`),
      );
      assert.equal(
        new Set(pids.map((r) => r[0].pid)).size,
        4,
        "Four independent PostgreSQL connections required",
      );
      pdf = await pdfBytes();
      a = await runtime(db, root);
      b = await runtime(db2, root);
    });
    after(async () => {
      await a?.app.close();
      await b?.app.close();
      for (const client of clients) await client.$disconnect();
      // No TRUNCATE/delete of business history. Runner removes ONLY its container.
    });
    beforeEach(async () => {
      f = await makeFixture(observer);
      await a.reports.put(f.studentUser, f.proposalId, 0, file(pdf));
    });

    it("A01 full migration chain and matching SQL checksums are present", async () => {
      const dir = path.resolve(__dirname, "../../prisma/migrations");
      const expected = fs
        .readdirSync(dir)
        .filter((n) => fs.existsSync(path.join(dir, n, "migration.sql")))
        .sort();
      const rows = await observer.$queryRawUnsafe(
        'SELECT migration_name,checksum,finished_at,rolled_back_at FROM public."_prisma_migrations" ORDER BY migration_name',
      );
      assert.deepEqual(
        rows.map((r) => r.migration_name),
        expected,
      );
      for (const row of rows) {
        assert(row.finished_at && !row.rolled_back_at);
        assert.equal(
          row.checksum,
          createHash("sha256")
            .update(
              fs.readFileSync(
                path.join(dir, row.migration_name, "migration.sql"),
              ),
            )
            .digest("hex"),
        );
      }
    });
    it("A02 upgrade preserves the pre-migration legacy decision without fabricated history", async () => {
      const legacy = JSON.parse(process.env.UC17_TEST_LEGACY);
      const row = await observer.defenseConfirmation.findUnique({
        where: { id: legacy.decisionId },
      });
      assert.equal(row.status, "CONFIRMED");
      assert.equal(row.revision, 0);
      assert.equal(row.confirmedAt.toISOString(), legacy.confirmedAt);
      assert.equal(row.decisionContext, null);
      assert.equal(row.decidedByUserId, null);
      assert.equal(
        await observer.defenseConfirmationHistory.count({
          where: { confirmationId: row.id },
        }),
        0,
      );
    });
    it("A03 confirmation/history reject negative revisions, invalid contexts and missing FK actors", async () => {
      await decide();
      const { decision, history } = await durable();
      await expectSqlFailure(
        () =>
          observer.$executeRaw`UPDATE public."DEFENSE_CONFIRMATION" SET revision=-1 WHERE id=${decision.id}`,
        ["23514"],
      );
      for (const [change, code] of [
        [{ revision: 0 }, "P2004"],
        [{ decisionContext: {} }, "P2004"],
        [{ actorId: randomUUID() }, "P2003"],
        [{ advisorId: randomUUID() }, "P2003"],
      ])
        await expectSqlFailure(
          () =>
            observer.defenseConfirmationHistory.create({
              data: { ...history[0], id: randomUUID(), revision: 2, ...change },
            }),
          [code],
        );
    });
    it("A04 history revision is unique and REJECTED requires a nonblank reason", async () => {
      await decide();
      const { history } = await durable();
      await expectSqlFailure(
        () =>
          observer.defenseConfirmationHistory.create({
            data: { ...history[0], id: randomUUID() },
          }),
        ["P2002"],
      );
      await expectSqlFailure(
        () =>
          observer.defenseConfirmationHistory.create({
            data: {
              ...history[0],
              id: randomUUID(),
              revision: 2,
              status: "REJECTED",
              note: " ",
            },
          }),
        ["P2004"],
      );
    });
    it("A05 history INSERT works; UPDATE DELETE and TRUNCATE are append-only guarded", async () => {
      await decide();
      const before = await durable();
      for (const sql of [
        'UPDATE public."DEFENSE_CONFIRMATION_HISTORY" SET note=note WHERE false',
        'DELETE FROM public."DEFENSE_CONFIRMATION_HISTORY" WHERE false',
        'TRUNCATE public."DEFENSE_CONFIRMATION_HISTORY"',
      ])
        await expectSqlFailure(
          () => observer.$executeRawUnsafe(sql),
          ["23514"],
        );
      await expectSqlFailure(
        () =>
          observer.defenseConfirmation.delete({
            where: { id: before.decision.id },
          }),
        ["P2003"],
      );
      assert.deepEqual(await durable(), before);
    });
    it("A06 finalization INSERT works; UPDATE DELETE TRUNCATE and CASCADE cannot erase history", async () => {
      const row = await seal();
      for (const sql of [
        'UPDATE public."DEFENSE_LIST_FINALIZATION" SET version=version WHERE false',
        'DELETE FROM public."DEFENSE_LIST_FINALIZATION" WHERE false',
        'TRUNCATE public."DEFENSE_LIST_FINALIZATION"',
        'TRUNCATE public."DEFENSE_LIST_FINALIZATION" CASCADE',
      ])
        await expectSqlFailure(
          () => observer.$executeRawUnsafe(sql),
          ["23514", "0A000"],
        );
      assert.deepEqual(
        await observer.defenseListFinalization.findUnique({
          where: { id: row.id },
        }),
        row,
      );
    });
    it("A07 UC18 pointer must match both term and sealed revision", async () => {
      const row = await seal(),
        other = await makeFixture(observer);
      await expectSqlFailure(
        () =>
          observer.defenseList.update({
            where: { termId: other.termId },
            data: {
              state: "FINALIZED",
              revision: row.listRevision,
              currentFinalizationId: row.id,
            },
          }),
        ["P2003"],
      );
      await expectSqlFailure(
        () =>
          observer.defenseList.update({
            where: { termId: f.termId },
            data: { revision: row.listRevision + 1 },
          }),
        ["P2003"],
      );
    });
    it("A08 UC18 state metadata, positive versions, hash format and unique term/version are enforced", async () => {
      await expectSqlFailure(
        () =>
          observer.defenseList.update({
            where: { termId: f.termId },
            data: { openedAt: null },
          }),
        ["P2004"],
      );
      const row = await seal();
      for (const change of [
        { version: 0 },
        { snapshotSchemaVersion: 0 },
        { contentHash: "x".repeat(64) },
      ])
        await expectSqlFailure(
          () =>
            observer.defenseListFinalization.create({
              data: {
                ...row,
                id: randomUUID(),
                version: 2,
                listRevision: 3,
                ...change,
              },
            }),
          ["P2004"],
        );
      await expectSqlFailure(
        () =>
          observer.defenseListFinalization.create({
            data: { ...row, id: randomUUID(), listRevision: 3 },
          }),
        ["P2002"],
      );
    });
    it("B01 real JWT HTTP GET context -> download -> PUT -> decision/history, without eligibility writes", async () => {
      const base = `/proposals/${f.proposalId}`;
      const c = await a.request(
        f.advisorUser,
        "GET",
        `${base}/defense-confirmation-context`,
      );
      const identity = c.expectedContext.pdf;
      const res = await fetch(
        `${a.base}${base}/defense-confirmation/report/download?${new URLSearchParams(identity)}`,
        {
          headers: {
            Authorization: `Bearer ${a.jwt.sign({ sub: f.advisorUser, sid: f.advisorUser })}`,
          },
        },
      );
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("content-type"), "application/pdf");
      assert.match(
        res.headers.get("content-disposition"),
        /^attachment; filename="final-report.pdf"/,
      );
      assert.deepEqual(Buffer.from(await res.arrayBuffer()), pdf);
      assert(!JSON.stringify(c).match(/storageKey|filePath/));
      const result = await a.request(
        f.advisorUser,
        "PUT",
        `${base}/defense-confirmation`,
        putInput(c),
      );
      assert.equal(result.changed, true);
      assert.equal(
        (await a.request(f.studentUser, "GET", `${base}/defense-confirmation`))
          .decision.status,
        "CONFIRMED",
      );
      assert.equal(
        (
          await a.request(
            f.facultyUser,
            "GET",
            `${base}/defense-confirmation/history`,
          )
        ).items.length,
        1,
      );
      await a.request(
        f.otherStudentUser,
        "GET",
        `${base}/defense-confirmation`,
        undefined,
        404,
      );
      await a.request(
        f.otherUser,
        "GET",
        `${base}/defense-confirmation-context`,
        undefined,
        404,
      );
      await a.request(
        null,
        "GET",
        `${base}/defense-confirmation`,
        undefined,
        401,
      );
      assert.equal(
        await observer.defenseEligibility.count({
          where: { proposalId: f.proposalId },
        }),
        0,
      );
      const saved = await durable();
      assert.equal(saved.decision.revision, saved.history[0].revision);
      assert.deepEqual(
        saved.decision.decisionContext,
        saved.history[0].decisionContext,
      );
      assert.equal(saved.audit.length, 1);
      assert.equal(saved.history[0].actorId, saved.decision.decidedByUserId);
    });
    it("B02 two HTTP PUTs on independent connections overlap at the parent lock; exactly one commits", async () => {
      const input = putInput(await context()),
        held = await holdTerm(blocker, f.termId);
      const one = rawPut(a, input),
        two = rawPut(b, input);
      try {
        await waitBlocked(observer, clientNames.slice(0, 2));
      } finally {
        await held.release();
      }
      const results = await Promise.all([one, two]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      const saved = await durable();
      assert.equal(saved.decision.revision, 1);
      assert.equal(saved.history.length, 1);
      assert.equal(saved.audit.length, 1);
    });
    for (const kind of ["history", "audit"])
      it(`B03-${kind} a real database INSERT fault rolls back decision/history/audit`, async () => {
        await decide();
        const before = await durable(),
          suffix = randomUUID().replaceAll("-", "");
        const name = `uc17_it_fault_${suffix}`,
          table =
            kind === "history" ? "DEFENSE_CONFIRMATION_HISTORY" : "AUDIT_LOG";
        const condition =
          kind === "history"
            ? `NEW.actor_id='${f.advisorUser}'`
            : `NEW.resource_id='${f.proposalId}'`;
        await observer.$executeRawUnsafe(
          `CREATE FUNCTION public."${name}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'Synthetic UC17 integration fault' USING ERRCODE='23514'; END IF; RETURN NEW; END $$`,
        );
        await observer.$executeRawUnsafe(
          `CREATE TRIGGER "${name}" BEFORE INSERT ON public."${table}" FOR EACH ROW EXECUTE FUNCTION public."${name}"()`,
        );
        try {
          await assert.rejects(() =>
            decide(putInputWithReason(before, "REJECTED")),
          );
          assert.deepEqual(await durable(), before);
        } finally {
          await observer.$executeRawUnsafe(
            `DROP TRIGGER "${name}" ON public."${table}"`,
          );
          await observer.$executeRawUnsafe(`DROP FUNCTION public."${name}"()`);
        }
      });
    it("B08 concurrent updates of an existing revision have exactly one winner and matching history/audit", async () => {
      await decide();
      const input = putInput(
        await context(),
        "REJECTED",
        "Concurrent reassessment",
      );
      const held = await holdTerm(blocker, f.termId);
      const one = rawPut(a, input),
        two = rawPut(b, input);
      try {
        await waitBlocked(observer, clientNames.slice(0, 2));
      } finally {
        await held.release();
      }
      assert.deepEqual(
        (await Promise.all([one, two])).map((r) => r.status).sort(),
        [200, 409],
      );
      const saved = await durable();
      assert.equal(saved.decision.revision, 2);
      assert.deepEqual(
        saved.history.map((h) => h.revision),
        [1, 2],
      );
      assert.equal(saved.audit.length, 2);
      assert.deepEqual(
        saved.history[1].decisionContext,
        saved.decision.decisionContext,
      );
    });
    it("B04 stale revision/context cannot return changed=false", async () => {
      const c = await context(),
        input = putInput(c);
      await decide(input);
      await assert.rejects(
        () => decide(input),
        (e) => e.getStatus() === 409,
      );
      const fresh = await context();
      assert.equal((await decide(putInput(fresh))).changed, false);
      assert.equal((await durable()).history.length, 1);
    });
    it("B05 an otherwise unchanged decision cannot bypass permission, window or UNKNOWN UC18", async () => {
      await decide();
      const input = putInput(await context());
      await observer.userRole.deleteMany({ where: { userId: f.advisorUser } });
      await assert.rejects(
        () => decide(input),
        (e) => e.getStatus() === 403,
      );
      const role = await observer.role.findUnique({
        where: { name: "LECTURER" },
      });
      await observer.userRole.create({
        data: { userId: f.advisorUser, roleId: role.id },
      });
      await observer.defenseConfirmationWindow.update({
        where: { termId: f.termId },
        data: { isLocked: true },
      });
      await assert.rejects(
        () => decide(input),
        (e) => e.getStatus() === 409,
      );
      await observer.defenseConfirmationWindow.update({
        where: { termId: f.termId },
        data: { isLocked: false },
      });
      await observer.defenseList.delete({ where: { termId: f.termId } });
      await assert.rejects(
        () => decide(input),
        (e) => e.getStatus() === 409,
      );
      assert.equal((await durable()).history.length, 1);
    });
    it("B06 REJECTED clears confirmedAt and a real change appends matching immutable history", async () => {
      await decide();
      await decide(
        putInput(await context(), "REJECTED", "Synthetic reassessment"),
      );
      const state = await durable();
      assert.equal(state.decision.status, "REJECTED");
      assert.equal(state.decision.confirmedAt, null);
      assert.equal(state.decision.revision, 2);
      assert.equal(state.history.length, 2);
      assert.equal(state.audit.length, 2);
      assert.equal(state.history[1].changeReason, "Synthetic reassessment");
    });
    it("B07 new official advisor can decide; old advisor loses read/write/download after AssignmentChange", async () => {
      await decide();
      const old = await context();
      await observer.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM public."THESIS_TERM" WHERE id=${f.termId} FOR UPDATE`;
        await tx.advisorAssignment.update({
          where: { id: f.assignmentId },
          data: { advisorId: f.otherAdvisorId },
        });
        const [clock] = await tx.$queryRaw`SELECT clock_timestamp() AS at`;
        await tx.assignmentChange.create({
          data: {
            assignmentId: f.assignmentId,
            assignmentRevision: 1,
            oldAdvisorId: f.advisorId,
            newAdvisorId: f.otherAdvisorId,
            actorId: f.facultyUser,
            effectiveAt: clock.at,
            reason: "Synthetic handover",
          },
        });
      });
      await assert.rejects(
        () => context(),
        (e) => e.getStatus() === 404,
      );
      await assert.rejects(
        () => decide(putInput(old)),
        (e) => e.getStatus() === 404,
      );
      await assert.rejects(
        () =>
          a.download.download(
            f.advisorUser,
            f.proposalId,
            old.expectedContext.pdf,
          ),
        (e) => e.getStatus() === 404,
      );
      const c = await a.read.context(f.otherUser, f.proposalId);
      await a.command.put(
        f.otherUser,
        f.proposalId,
        putInput(c, "CONFIRMED", "New advisor assessment"),
      );
      const state = await durable();
      assert.equal(state.history[0].advisorId, f.advisorId);
      assert.equal(state.history[1].advisorId, f.otherAdvisorId);
    });
    it("C01 reupload of identical bytes changes revision; stale download/context conflict without altering decision", async () => {
      await decide();
      const c = await context(),
        before = await durable();
      await b.reports.put(f.studentUser, f.proposalId, 1, file(pdf));
      assert.deepEqual(await durable(), before);
      await assert.rejects(
        () =>
          a.download.download(
            f.advisorUser,
            f.proposalId,
            c.expectedContext.pdf,
          ),
        (e) => e.getStatus() === 409,
      );
      await assert.rejects(
        () => decide(putInput(c)),
        (e) => e.getStatus() === 409,
      );
      assert.equal((await context()).pdfChangedSinceDecision, true);
    });
    it("C02 PUT holds the real parent lock during PDF I/O; reupload waits, then preserves the committed old decision", async () => {
      const input = putInput(await context()),
        pause = pauseStorage(a.storage);
      const decision = decide(input);
      decision.catch(() => {});
      let upload;
      try {
        await pause.entered;
        const started = performance.now(); // Parent/key locks already held here.
        upload = b.reports.put(f.studentUser, f.proposalId, 1, file(pdf));
        upload.catch(() => {});
        await waitBlocked(observer, [clientNames[1]]);
        await delay(250);
        measurement("parent-lock-during-real-PDF-read", {
          heldLowerBoundMs: Math.round(performance.now() - started),
          injectedIoDelayMs: 250,
          pdfBytes: pdf.length,
        });
      } finally {
        pause.restore();
      }
      await decision;
      await upload;
      const state = await durable();
      assert.equal(state.decision.decisionContext.pdf.revision, 1);
      assert.equal((await context()).pdfChangedSinceDecision, true);
    });
    it("C03 upload holding the lock wins first; waiting PUT must reject its old PDF context", async () => {
      const input = putInput(await context()),
        pause = pauseStorage(b.storage, "savePrivateFinalReport");
      const upload = b.reports.put(f.studentUser, f.proposalId, 1, file(pdf));
      upload.catch(() => {});
      let result;
      try {
        await pause.entered;
        result = rawPut(a, input);
        await waitBlocked(observer, [clientNames[0]]);
      } finally {
        pause.restore();
      }
      await upload;
      assert.equal((await result).status, 409);
      assert.equal((await durable()).decision, null);
    });
    it("C04 cleanup never deletes referenced files; replaced bytes are cleaned only after commit", async () => {
      const old = await observer.finalReport.findUnique({
        where: { proposalId: f.proposalId },
        include: { fileAsset: true },
      });
      await a.reports.cleanupKey(old.fileAsset.storageKey);
      assert.deepEqual(
        await a.storage.readPrivateFinalReport(
          old.fileAsset.storageKey,
          pdf.length,
        ),
        pdf,
      );
      await a.reports.put(f.studentUser, f.proposalId, 1, file(pdf));
      assert.equal(
        await observer.fileAsset.findUnique({ where: { id: old.fileAssetId } }),
        null,
      );
      await assert.rejects(() =>
        a.storage.readPrivateFinalReport(old.fileAsset.storageKey, pdf.length),
      );
      const live = await observer.finalReport.findUnique({
        where: { proposalId: f.proposalId },
        include: { fileAsset: true },
      });
      assert.deepEqual(
        await a.storage.readPrivateFinalReport(
          live.fileAsset.storageKey,
          pdf.length,
        ),
        pdf,
      );
    });
    it("D01 waiting for the term lock past the DB deadline cannot write a decision", async () => {
      const input = putInput(await context());
      const [now] = await observer.$queryRaw`SELECT clock_timestamp() AS at`;
      const closesAt = new Date(now.at.getTime() + 1000);
      await observer.defenseConfirmationWindow.update({
        where: { termId: f.termId },
        data: { closesAt },
      });
      const held = await holdTerm(blocker, f.termId),
        result = rawPut(a, input);
      try {
        await waitBlocked(observer, [clientNames[0]]);
        await afterDatabaseTime(observer, closesAt);
      } finally {
        await held.release();
      }
      const r = await result;
      assert.equal(r.status, 409);
      assert.equal(r.body.error.code, "UC17_WINDOW_CLOSED");
      assert.equal((await durable()).decision, null);
    });
    it("D02 the database clock is rechecked after slow file I/O", async () => {
      const input = putInput(await context());
      const [now] = await observer.$queryRaw`SELECT clock_timestamp() AS at`,
        closesAt = new Date(now.at.getTime() + 1000);
      await observer.defenseConfirmationWindow.update({
        where: { termId: f.termId },
        data: { closesAt },
      });
      const pause = pauseStorage(a.storage),
        result = rawPut(a, input);
      try {
        await pause.entered;
        await afterDatabaseTime(observer, closesAt);
      } finally {
        pause.restore();
      }
      assert.equal((await result).status, 409);
      assert.equal((await durable()).decision, null);
    });
    it("D03 PostgreSQL lock_timeout cancels the blocked statement with 55P03", async () => {
      const held = await holdTerm(blocker, f.termId),
        started = performance.now();
      try {
        await expectSqlFailure(
          () =>
            db2.$transaction(async (tx) => {
              await tx.$executeRawUnsafe("SET LOCAL lock_timeout='300ms'");
              await tx.$queryRaw`SELECT id FROM public."THESIS_TERM" WHERE id=${f.termId} FOR UPDATE`;
            }),
          ["55P03"],
        );
        measurement("lock-timeout", {
          configuredMs: 300,
          observedMs: Math.round(performance.now() - started),
        });
      } finally {
        await held.release();
      }
    });
    it("D04 Prisma transaction timeout rolls back a real write", async () => {
      const action = `UC17_TEST_TIMEOUT_${randomUUID()}`,
        started = performance.now();
      let inserted = false;
      await expectSqlFailure(
        () =>
          db2.$transaction(
            async (tx) => {
              await tx.auditLog.create({
                data: {
                  userId: f.facultyUser,
                  action,
                  resource: "uc17-integration",
                  resourceId: f.proposalId,
                },
              });
              inserted = true;
              await delay(600);
              await tx.$queryRaw`SELECT 1`;
            },
            { timeout: 250 },
          ),
        ["P2028"],
      );
      assert.equal(
        inserted,
        true,
        "Rollback probe must INSERT before timing out",
      );
      assert.equal(await observer.auditLog.count({ where: { action } }), 0);
      measurement("interactive-transaction-timeout", {
        configuredMs: 250,
        observedMs: Math.round(performance.now() - started),
      });
    });
    it("D05 controlled reversed-order SQL deadlock is detected; this is not a claim of a UC17 deadlock", async () => {
      const other = await makeFixture(observer),
        first = gate(),
        second = gate(),
        started = performance.now();
      const left = db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM public."THESIS_TERM" WHERE id=${f.termId} FOR UPDATE`;
          first.release();
          await second.promise;
          await tx.$queryRaw`SELECT id FROM public."THESIS_TERM" WHERE id=${other.termId} FOR UPDATE`;
        },
        { timeout: 10000 },
      );
      const right = db2.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM public."THESIS_TERM" WHERE id=${other.termId} FOR UPDATE`;
          second.release();
          await first.promise;
          await tx.$queryRaw`SELECT id FROM public."THESIS_TERM" WHERE id=${f.termId} FOR UPDATE`;
        },
        { timeout: 10000 },
      );
      const result = await Promise.allSettled([left, right]);
      assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
      const error = result.find((r) => r.status === "rejected").reason;
      assert(error.code === "P2034" || error.meta?.code === "40P01");
      measurement("controlled-deadlock", {
        observedMs: Math.round(performance.now() - started),
        sqlState: error.meta?.code || error.code,
      });
    });
    it("E01 real reader returns UNKNOWN for unconfigured/DRAFT; DRAFT -> OPEN API establishes authoritative OPEN", async () => {
      await observer.defenseList.delete({ where: { termId: f.termId } });
      assert.equal((await readUc18()).state, "UNKNOWN");
      const route = `/terms/${f.termId}/defense-list`;
      await a.request(f.facultyUser, "POST", route, {}, 201);
      assert.equal((await readUc18()).state, "UNKNOWN");
      await a.request(f.facultyUser, "POST", `${route}/open`, {
        expectedRevision: 0,
      });
      assert.equal((await readUc18()).state, "OPEN");
      await a.request(
        f.adminUser,
        "GET",
        `/proposals/${f.proposalId}/defense-confirmation`,
        undefined,
        404,
      );
    });
    it("E02 snapshot JSONB/canonical SHA-256 round-trip verifies FINALIZED; live PDF change does not unseal it", async () => {
      await decide();
      const sealed = await seal();
      const persisted = await observer.defenseListFinalization.findUnique({
        where: { id: sealed.id },
      });
      assert.deepEqual(persisted.snapshot, sealed.snapshot);
      const { defenseListSnapshotHash } = dist(
        "common/uc18-finalization/defense-list-snapshot",
      );
      assert.equal(
        defenseListSnapshotHash(persisted.snapshot),
        persisted.contentHash,
      );
      const before = await readUc18();
      assert.equal(before.state, "FINALIZED");
      await b.reports.put(f.studentUser, f.proposalId, 1, file(pdf));
      assert.deepEqual(await readUc18(), before);
      const c = await context();
      assert.equal(c.pdfChangedSinceDecision, true);
      assert.deepEqual(
        (
          await a.download.download(
            f.advisorUser,
            f.proposalId,
            c.expectedContext.pdf,
          )
        ).bytes,
        pdf,
      );
      await assert.rejects(
        () => decide(putInput(c, "CONFIRMED", "Fresh PDF")),
        (e) => e.getStatus() === 409,
      );
    });
    it("E05 a SHA-256-shaped but incorrect stored hash returns UNKNOWN and blocks UC17", async () => {
      await db2.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM public."THESIS_TERM" WHERE id=${f.termId} FOR UPDATE`;
        await finalizeFixture(tx, f, { contentHash: "0".repeat(64) });
      });
      const state = await readUc18();
      assert.equal(state.state, "UNKNOWN");
      assert.equal(state.reason, "UC18_SNAPSHOT_HASH_MISMATCH");
      await assert.rejects(
        () => decide(),
        (e) => e.getStatus() === 409,
      );
      assert.equal((await durable()).decision, null);
    });
    it("E03 UC18 finalization fixture waits for UC17; seals the decision actually committed", async () => {
      const input = putInput(await context()),
        pause = pauseStorage(a.storage),
        decision = decide(input);
      decision.catch(() => {});
      let finalization;
      try {
        await pause.entered;
        finalization = seal();
        finalization.catch(() => {});
        await waitBlocked(observer, [clientNames[1]]);
      } finally {
        pause.restore();
      }
      await decision;
      const sealed = await finalization;
      assert.equal(sealed.snapshot.students[0].confirmation.revision, 1);
      assert.equal((await readUc18()).state, "FINALIZED");
    });
    it("E04 finalization fixture holds parent first; waiting UC17 refuses to write after FINALIZED", async () => {
      const input = putInput(await context()),
        entered = gate(),
        release = gate();
      const sealing = blocker.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM public."THESIS_TERM" WHERE id=${f.termId} FOR UPDATE`;
          await finalizeFixture(tx);
          entered.release();
          await release.promise;
        },
        { timeout: 15000 },
      );
      sealing.catch(() => {});
      await entered.promise;
      const result = rawPut(a, input);
      try {
        await waitBlocked(observer, [clientNames[0]]);
      } finally {
        release.release();
      }
      await sealing;
      const r = await result;
      assert.equal(r.status, 409);
      assert.equal(r.body.error.code, "UC18_FINALIZED");
      assert.equal((await durable()).decision, null);
    });
  },
);

function putInputWithReason(saved, status) {
  const context = {
    expectedRevision: saved.decision.revision,
    expectedContext: {
      revision: saved.decision.revision,
      assignment: saved.decision.decisionContext.assignment,
      pdf: {
        finalReportId: saved.decision.decisionContext.pdf.finalReportId,
        revision: saved.decision.decisionContext.pdf.revision,
        checksum: saved.decision.decisionContext.pdf.checksum,
      },
    },
  };
  return putInput(context, status, "Synthetic fault-injected reassessment");
}
