'use strict';
const { prepareFixtureSessions } = require('./integration/auth-fixture.cjs');
// Step 6 real HTTP/PostgreSQL integration. Explicit NEW loopback database only.
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto'),
  assert = require('node:assert/strict'),
  { spawnSync } = require('node:child_process');
const { testTarget } = require('./rehearse-pr2b.cjs');
async function main() {
  const url = testTarget(process.env.PR2B_TEST_URL),
    backend = path.resolve(__dirname, '..');
  Object.assign(process.env, {
    DATABASE_URL: url.toString(),
    DIRECT_URL: url.toString(),
    NODE_ENV: 'test',
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    JWT_REFRESH_SECRET: crypto.randomBytes(32).toString('hex'),
  });
  const { PrismaClient } = require('@prisma/client'),
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  let app;
  const checks = [],
    pass = (name) => {
      checks.push({ name, result: 'PASS' });
      console.log('PASS ' + name);
    };
  try {
    const [identity] =
      await db.$queryRaw`SELECT current_database() AS db,current_setting('server_version_num') AS version`;
    assert.equal(identity.db, url.pathname.slice(1));
    assert.equal(Math.floor(Number(identity.version) / 10000), 17);
    const [tables] =
      await db.$queryRaw`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`;
    assert.equal(tables.n, 0, 'New empty isolated database required');
    // Reuse the actual Step 5 flow as producer: p2 has an immutable v1 and a
    // real REVISION_REQUIRED decision. No production data or fake approvals.
    const previous = spawnSync(
      process.execPath,
      [path.join(__dirname, 'test-proposal-reviews.cjs')],
      { cwd: backend, env: process.env, encoding: 'utf8', windowsHide: true },
    );
    assert.equal(
      previous.status,
      0,
      'Step 5 prelude failed: ' + previous.stdout + ' ' + previous.stderr,
    );
    pass(
      'active migration replay and all 27 Step 5 real HTTP checks run as the producer prelude',
    );
    const { NestFactory } = require('@nestjs/core'),
      { ValidationPipe } = require('@nestjs/common'),
      { JwtService } = require('@nestjs/jwt'),
      { AppModule } = require('../dist/app.module');
    app = await NestFactory.create(AppModule, {
      logger: false,
      abortOnError: false,
    });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await prepareFixtureSessions(db);
    await app.listen(0, '127.0.0.1');
    const { SwaggerModule, DocumentBuilder } = require('@nestjs/swagger'),
      swagger = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().setTitle('Step 6').addBearerAuth().build(),
      );
    assert(swagger.paths['/api/proposals/{proposalId}/versions']);
    assert(swagger.paths['/api/proposals/{proposalId}/submit']);
    const jwt = new JwtService({ secret: process.env.JWT_SECRET }),
      base = 'http://127.0.0.1:' + app.getHttpServer().address().port + '/api';
    async function req(
      actor,
      method,
      route,
      body,
      status = 200,
      key = crypto.randomUUID(),
    ) {
      const headers = {
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      };
      if (actor)
        headers.Authorization =
          'Bearer ' + jwt.sign({ sub: actor, sid: actor, roles: ['ADMIN', 'FACULTY'] });
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
    const ctx = async (actor = 's2') =>
      (await req(actor, 'GET', '/proposals/p2/editing-context')).data;
    const content = {
      schemaVersion: 1,
      objectives: 'Mục tiêu chỉnh sửa v2',
      scope: 'Phạm vi đã bổ sung',
      mainContents: 'Nội dung đề cương',
      tools: 'Công cụ',
      expectedResults: 'Kết quả',
      startsAt: '2026-10-01T00:00:00+07:00',
      endsAt: '2027-01-01T00:00:00+07:00',
      schedule: [
        {
          label: 'Mốc 1',
          startsAt: '2026-10-01T00:00:00+07:00',
          endsAt: '2026-11-01T00:00:00+07:00',
          deliverables: 'Đề cương hoàn chỉnh',
        },
      ],
    };
    let current = await ctx();
    assert.equal(current.status, 'REVISION_REQUESTED');
    assert(current.readiness.includes('INPUT_NOT_READY'));
    await req(null, 'GET', '/proposals/p2/versions', undefined, 401);
    await req('admin', 'GET', '/proposals/p2/versions', undefined, 404);
    await req('s1', 'GET', '/proposals/p2/versions', undefined, 404);
    await req('s9', 'GET', '/proposals/p2/versions', undefined, 404);
    pass('version reads enforce JWT, owner/term scope and no ADMIN wildcard');
    await req(
      's2',
      'POST',
      '/proposals/p2/versions',
      { expectedRevision: current.revision, content },
      409,
    );
    pass(
      'missing PROPOSAL_EDIT mapping fails closed without creating a version',
    );
    await db.termPhase.create({
      data: {
        id: 'step6-edit-phase',
        termId: 't1',
        phaseName: 'Synthetic edit phase',
        startDate: new Date('2020-01-01Z'),
        endDate: new Date('2099-01-01Z'),
        pr2bTermPhaseWorkflowPhaseId: {
          create: { termId: 't1', key: 'PROPOSAL_EDIT' },
        },
      },
    });
    current = await ctx();
    assert(current.allowedActions.includes('save'));
    const v1 = current.submittedVersionId,
      oldVersion = await db.proposalVersion.findUnique({
        where: { id: v1 },
        include: { pr2bProposalVersionWorkflowVersionId: true },
      }),
      oldReview = await db.proposalReviewDecision.findFirst({
        where: { versionId: v1 },
      });
    const feedback = current.feedback.find((f) => f.targetType === 'DECISION');
    assert(feedback);
    const response = {
      targetType: 'DECISION',
      targetId: feedback.targetId,
      text: 'Đã bổ sung phạm vi theo yêu cầu',
    };
    const saveBody = {
      expectedRevision: current.revision,
      basedOnVersionId: v1,
      content,
      changeSummary: 'Bổ sung phạm vi theo nhóm duyệt',
      responses: [response],
    };
    for (const actor of ['f', 'admin', 's1', 's9'])
      await req(actor, 'POST', '/proposals/p2/versions', saveBody, 404);
    await db.assignmentPlan.update({
      where: { id: 'plan-t1' },
      data: { status: 'PUBLISHED' },
    });
    assert.equal(
      (await req('advisor', 'POST', '/proposals/p2/versions', saveBody, 409))
        .code,
      'INPUT_NOT_READY',
    );
    await db.assignmentPlan.update({
      where: { id: 'plan-t1' },
      data: { status: 'FINALIZED' },
    });
    pass(
      'only SV/current official GVHD edit; PUBLISHED never grants advisor rights',
    );
    await req(
      's2',
      'POST',
      '/proposals/p2/versions',
      { ...saveBody, createdByUserId: 'forged' },
      400,
    );
    await req(
      's2',
      'POST',
      '/proposals/p2/versions',
      { ...saveBody, responses: [response, response] },
      400,
    );
    const foreignComment = await db.reviewComment.findFirst({
      where: { versionId: 'v1' },
    });
    assert(foreignComment);
    assert.equal(
      (
        await req(
          's2',
          'POST',
          '/proposals/p2/versions',
          {
            ...saveBody,
            responses: [
              {
                targetType: 'COMMENT',
                targetId: foreignComment.id,
                text: 'Cross proposal',
              },
            ],
          },
          400,
        )
      ).code,
      'FEEDBACK_SCOPE_INVALID',
    );
    pass(
      'strict DTO and feedback references reject forged actor, duplicate and cross-proposal response',
    );
    const key = crypto.randomUUID(),
      v2 = (
        await req('s2', 'POST', '/proposals/p2/versions', saveBody, 201, key)
      ).data;
    assert.equal(v2.versionNumber, 2);
    assert.equal(v2.state, 'DRAFT');
    assert.equal(v2.createdByUserId, 's2');
    assert.equal(v2.basedOnVersionId, v1);
    assert.deepEqual(v2.responses, [response]);
    assert.equal((await ctx()).status, 'DRAFT');
    assert.deepEqual(
      await db.proposalVersion.findUnique({
        where: { id: v1 },
        include: { pr2bProposalVersionWorkflowVersionId: true },
      }),
      oldVersion,
    );
    assert.deepEqual(
      await db.proposalReviewDecision.findFirst({ where: { versionId: v1 } }),
      oldReview,
    );
    pass(
      'create v2 from returned v1, preserve v1/decision exactly, record editor/time/summary/response',
    );
    const beforeReplay = await db.auditLog.count({
      where: { resource: 'proposal-version' },
    });
    assert.equal(
      (await req('s2', 'POST', '/proposals/p2/versions', saveBody, 201, key))
        .data.id,
      v2.id,
    );
    assert.equal(
      await db.proposalVersion.count({ where: { proposalId: 'p2' } }),
      2,
    );
    assert.equal(
      await db.auditLog.count({ where: { resource: 'proposal-version' } }),
      beforeReplay,
    );
    await req(
      's2',
      'POST',
      '/proposals/p2/versions',
      { ...saveBody, changeSummary: 'Different' },
      409,
      key,
    );
    pass('save idempotency replays one snapshot and never duplicates audit');
    await db.userAccount.update({
      where: { id: 's2' },
      data: { status: 'LOCKED' },
    });
    await req('s2', 'POST', '/proposals/p2/versions', saveBody, 403, key);
    await db.userAccount.update({
      where: { id: 's2' },
      data: { status: 'ACTIVE' },
    });
    pass('account revocation is checked before returning cached snapshot');
    await req('a', 'GET', `/proposals/p2/versions/${v2.id}`, undefined, 404);
    await req(
      'a',
      'GET',
      `/proposals/p2/versions/compare?fromVersionId=${v1}&toVersionId=${v2.id}`,
      undefined,
      404,
    );
    assert.equal(
      (await req('a', 'GET', '/proposals/p2/versions')).data.total,
      1,
    );
    await req('f', 'GET', `/proposals/p2/versions/${v2.id}`);
    await req('s2', 'GET', '/proposals/p2/versions/v1', undefined, 404);
    pass(
      'reviewer cannot read/compare draft or another proposal; faculty scoped reads remain available',
    );
    const changes = (
      await req(
        's2',
        'GET',
        `/proposals/p2/versions/compare?fromVersionId=${v1}&toVersionId=${v2.id}`,
      )
    ).data.changes;
    assert(changes.some((c) => c.path === '/content/objectives'));
    assert(changes.some((c) => c.path.startsWith('/responses/')));
    pass('real JSON comparison includes content and revision responses');
    async function rejected(fn) {
      let failed = false;
      try {
        await fn();
      } catch {
        failed = true;
      }
      assert(failed, 'Immutable database guard should reject direct mutation');
    }
    await rejected(() =>
      db.proposalVersion.update({
        where: { id: v1 },
        data: { content: { tampered: true } },
      }),
    );
    await rejected(() =>
      db.proposalVersion.update({
        where: { id: v2.id },
        data: { content: { tampered: true } },
      }),
    );
    await rejected(() =>
      db.proposalVersionWorkflow.update({
        where: { versionId: v2.id },
        data: { revisionResponses: [] },
      }),
    );
    pass(
      'database rejects rewriting old and new snapshot payloads or response metadata',
    );
    await req(
      'advisor',
      'POST',
      '/proposals/p2/submit',
      { expectedRevision: v2.proposalRevision, versionId: v2.id },
      404,
    );
    await req(
      's2',
      'POST',
      '/proposals/p2/submit',
      { expectedRevision: v2.proposalRevision, versionId: v1 },
      409,
    );
    const submitKey = crypto.randomUUID(),
      submitBody = { expectedRevision: v2.proposalRevision, versionId: v2.id },
      submitted = (
        await req(
          's2',
          'POST',
          '/proposals/p2/submit',
          submitBody,
          200,
          submitKey,
        )
      ).data;
    assert.equal(submitted.state, 'SEALED');
    assert.equal(submitted.submittedByUserId, 's2');
    assert.equal((await ctx()).status, 'SUBMITTED');
    assert.equal(
      (await db.proposalWorkflow.findUnique({ where: { proposalId: 'p2' } }))
        .submissionKind,
      'RESUBMISSION',
    );
    assert.equal(
      (
        await req(
          's2',
          'POST',
          '/proposals/p2/submit',
          submitBody,
          200,
          submitKey,
        )
      ).data.id,
      v2.id,
    );
    assert.equal(
      await db.outboxEvent.count({
        where: { aggregateId: 'p2', type: 'PROPOSAL_VERSION_SUBMITTED' },
      }),
      1,
    );
    pass(
      'only student submits current v2, seals immutable snapshot and records RESUBMISSION once',
    );
    await rejected(() =>
      db.proposalVersionWorkflow.update({
        where: { versionId: v2.id },
        data: { state: 'DRAFT' },
      }),
    );
    await req(
      's2',
      'POST',
      '/proposals/p2/versions',
      {
        ...saveBody,
        expectedRevision: submitted.proposalRevision,
        basedOnVersionId: v2.id,
      },
      409,
    );
    pass('submitted and sealed snapshots cannot be edited or unsealed');
    const oldRound = (
      await req('a', 'GET', `/proposal-reviews/${oldReview.reviewId}`)
    ).data;
    assert.equal(oldRound.versionId, v1);
    assert.equal(oldRound.decision.versionId, v1);
    let round = (
      await req(
        'f',
        'POST',
        '/proposals/p2/review-assignments',
        {
          groupId: 'g1',
          proposalVersionId: v2.id,
          expectedProposalRevision: submitted.proposalRevision,
        },
        201,
      )
    ).data;
    assert.equal(round.roundNumber, 2);
    assert.equal(round.versionId, v2.id);
    round = (
      await req('a', 'POST', `/proposal-reviews/${round.id}/start`, {
        expectedProposalRevision: round.proposalRevision,
        expectedReviewRevision: round.revision,
      })
    ).data;
    round = (
      await req('a', 'POST', `/proposal-reviews/${round.id}/decision`, {
        expectedProposalRevision: round.proposalRevision,
        expectedReviewRevision: round.revision,
        versionId: v2.id,
        decision: 'REVISION_REQUIRED',
        comment: 'Cần bổ sung công cụ',
      })
    ).data;
    assert.equal(round.decision.versionId, v2.id);
    pass(
      'Step 5 reviews v2 in a new round while old reviewer comments/decision remain linked to v1',
    );
    current = await ctx();
    const incomplete = (
      await req(
        's2',
        'POST',
        '/proposals/p2/versions',
        {
          expectedRevision: current.revision,
          basedOnVersionId: v2.id,
          content: { ...content, tools: '' },
        },
        201,
      )
    ).data;
    assert.equal(
      (
        await req(
          's2',
          'POST',
          '/proposals/p2/submit',
          {
            expectedRevision: incomplete.proposalRevision,
            versionId: incomplete.id,
          },
          400,
        )
      ).code,
      'PROPOSAL_CONTENT_INVALID',
    );
    assert.equal(
      (
        await db.proposalVersionWorkflow.findUnique({
          where: { versionId: incomplete.id },
        })
      ).state,
      'DRAFT',
    );
    pass(
      'incomplete draft saves successfully but cannot be submitted or partially sealed',
    );
    let draft = (
      await req(
        'advisor',
        'POST',
        '/proposals/p2/versions',
        {
          expectedRevision: incomplete.proposalRevision,
          basedOnVersionId: incomplete.id,
          content,
          changeSummary: 'GVHD bổ sung công cụ',
        },
        201,
      )
    ).data;
    assert.equal(draft.createdByUserId, 'advisor');
    assert(draft.responses.some((r) => r.targetId === feedback.targetId));
    pass(
      'current official advisor appends a new snapshot and inherits prior response evidence',
    );
    await db.topicWorkflow.update({
      where: { topicId: 'topic2' },
      data: { confirmedAssignmentRevision: 999 },
    });
    assert.equal(
      (
        await req(
          's2',
          'POST',
          '/proposals/p2/submit',
          { expectedRevision: draft.proposalRevision, versionId: draft.id },
          409,
        )
      ).code,
      'TOPIC_NOT_AGREED',
    );
    await db.topicWorkflow.update({
      where: { topicId: 'topic2' },
      data: { confirmedAssignmentRevision: 0 },
    });
    pass(
      'stale Topic agreement blocks submission without inventing advisor confirmation',
    );
    const raceBody = {
      expectedRevision: draft.proposalRevision,
      basedOnVersionId: draft.id,
      content,
    };
    const race = await Promise.all(
      ['s2', 'advisor'].map((actor) =>
        req(
          actor,
          'POST',
          '/proposals/p2/versions',
          {
            ...raceBody,
            content: { ...content, objectives: 'Concurrent ' + actor },
          },
          [201, 409],
        ),
      ),
    );
    assert.equal(race.filter((r) => r.status === 201).length, 1);
    draft = race.find((r) => r.status === 201).data;
    assert.equal(draft.versionNumber, 5);
    assert.equal((await ctx()).workingVersionId, draft.id);
    pass(
      'concurrent SV/GVHD edits produce one CAS winner without overwriting the other snapshot',
    );
    const numberBefore = await db.proposalVersion.count({
        where: { proposalId: 'p2' },
      }),
      workflowBefore = await db.proposalWorkflow.findUnique({
        where: { proposalId: 'p2' },
      });
    await db.$executeRawUnsafe(
      `CREATE FUNCTION step6_test_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.resource='proposal-version' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      'CREATE TRIGGER step6_test_audit_fail BEFORE INSERT ON public."AUDIT_LOG" FOR EACH ROW EXECUTE FUNCTION step6_test_audit_fail()',
    );
    await req(
      's2',
      'POST',
      '/proposals/p2/versions',
      {
        expectedRevision: draft.proposalRevision,
        basedOnVersionId: draft.id,
        content,
      },
      500,
    );
    assert.equal(
      await db.proposalVersion.count({ where: { proposalId: 'p2' } }),
      numberBefore,
    );
    assert.deepEqual(
      await db.proposalWorkflow.findUnique({ where: { proposalId: 'p2' } }),
      workflowBefore,
    );
    await db.$executeRawUnsafe(
      'DROP TRIGGER step6_test_audit_fail ON public."AUDIT_LOG"',
    );
    await db.$executeRawUnsafe('DROP FUNCTION step6_test_audit_fail()');
    pass(
      'audit failure rolls back snapshot, pointer, counter and revision atomically',
    );
    let unlock, ready;
    const release = new Promise((r) => {
        unlock = r;
      }),
      locked = new Promise((r) => {
        ready = r;
      });
    const lock = db.$transaction(
      async (tx) => {
        await tx.termPhase.update({
          where: { id: 'step6-edit-phase' },
          data: { isLocked: true },
        });
        ready();
        await release;
      },
      { timeout: 15000 },
    );
    await locked;
    const pending = req(
      's2',
      'POST',
      '/proposals/p2/versions',
      {
        expectedRevision: draft.proposalRevision,
        basedOnVersionId: draft.id,
        content,
      },
      409,
    );
    try {
      let waiting = false;
      for (let i = 0; i < 100; i++) {
        const [r] =
          await db.$queryRaw`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%TERM_PHASE%'`;
        if (r.n) {
          waiting = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 20));
      }
      assert(waiting, 'Expected actual edit-phase lock contention');
    } finally {
      unlock();
    }
    await lock;
    assert.equal((await pending).code, 'TERM_003');
    assert.equal(
      await db.proposalVersion.count({ where: { proposalId: 'p2' } }),
      numberBefore,
    );
    await db.termPhase.update({
      where: { id: 'step6-edit-phase' },
      data: { isLocked: false },
    });
    pass(
      'concurrent phase closure blocks a waiting save and preserves the last snapshot',
    );
    const assignment = await db.advisorAssignment.findUnique({
      where: { assignmentPlanId_registrationId: { assignmentPlanId: 'plan-t1', registrationId: 'reg7' } },
    });
    await db.advisorAssignment.update({
      where: { id: assignment.id },
      data: { advisorId: 'b' },
    });
    await db.assignmentChange.create({
      data: {
        assignmentId: assignment.id,
        assignmentRevision: 1,
        effectiveAt: new Date(),
        oldAdvisorId: 'advisor',
        newAdvisorId: 'b',
        actorId: 'f',
        reason: 'Synthetic handover for scope test',
      },
    });
    await req(
      'advisor',
      'POST',
      '/proposals/p7/versions',
      { expectedRevision: 0, content },
      404,
    );
    await req('b', 'GET', '/proposals/p7/editing-context');
    pass(
      'advisor handover revokes old advisor edit access and does not auto-confirm Topic for the new advisor',
    );
    const final = (
      await req('s2', 'POST', '/proposals/p2/submit', {
        expectedRevision: draft.proposalRevision,
        versionId: draft.id,
      })
    ).data;
    let last = (
      await req(
        'f',
        'POST',
        '/proposals/p2/review-assignments',
        {
          groupId: 'g1',
          proposalVersionId: final.id,
          expectedProposalRevision: final.proposalRevision,
        },
        201,
      )
    ).data;
    last = (
      await req('a', 'POST', `/proposal-reviews/${last.id}/start`, {
        expectedProposalRevision: last.proposalRevision,
        expectedReviewRevision: last.revision,
      })
    ).data;
    await req('a', 'POST', `/proposal-reviews/${last.id}/decision`, {
      expectedProposalRevision: last.proposalRevision,
      expectedReviewRevision: last.revision,
      versionId: final.id,
      decision: 'APPROVED',
    });
    current = await ctx();
    assert(!current.allowedActions.includes('save'));
    await req(
      's2',
      'POST',
      '/proposals/p2/versions',
      {
        expectedRevision: current.revision,
        basedOnVersionId: final.id,
        content,
      },
      409,
    );
    pass(
      'APPROVED proposal is read-only and Step 6 never reopens/finalizes it',
    );
    // Independent malformed producer fixture demonstrates dossier lock cannot
    // be bypassed just by changing a Proposal status. No dossier API is added.
    await db.thesisDossier.create({
      data: {
        proposalId: 'p2',
        pr2bDossierWorkflowDossierId: { create: { state: 'FINALIZED' } },
      },
    });
    await db.proposal.update({
      where: { id: 'p2' },
      data: { status: 'DRAFT' },
    });
    assert.equal(
      (
        await req(
          's2',
          'POST',
          '/proposals/p2/versions',
          {
            expectedRevision: current.revision,
            basedOnVersionId: final.id,
            content,
          },
          409,
        )
      ).code,
      'DOSSIER_LOCKED',
    );
    pass(
      'finalized dossier blocks direct edits even if Proposal status is inconsistent',
    );
    assert.deepEqual(
      await db.proposalVersion.findUnique({
        where: { id: v1 },
        include: { pr2bProposalVersionWorkflowVersionId: true },
      }),
      oldVersion,
    );
    assert.deepEqual(
      await db.proposalReviewDecision.findFirst({ where: { versionId: v1 } }),
      oldReview,
    );
    pass(
      'v1 payload, metadata, reviewer and decision are preserved after every revision cycle',
    );
    fs.writeFileSync(
      path.join(backend, 'prisma/review/step6-results.json'),
      JSON.stringify(
        {
          result: 'PASS',
          postgresVersion: identity.version,
          checks,
          step5Prelude: true,
          sharedDatabaseDDL: false,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(`${checks.length} Step 6 integration checks passed`);
  } finally {
    if (app) await app.close();
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(
    'Step 6 isolated integration failed: ' +
      String(e.message).replace(
        /postgres(?:ql)?:\/\/[^\s]+/gi,
        '[redacted URL]',
      ),
  );
  process.exitCode = 1;
});
