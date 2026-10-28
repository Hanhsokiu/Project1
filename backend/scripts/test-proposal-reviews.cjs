'use strict';
const { prepareFixtureSessions } = require('./integration/auth-fixture.cjs');
// Destructive fixtures/DDL are restricted to a NEW loopback btl_pr2b_* test DB.
// Never loads backend/.env or accepts a shared/production target.
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict'),
  crypto = require('node:crypto'),
  { spawnSync } = require('node:child_process');
const { testTarget } = require('./rehearse-pr2b.cjs');
const backend = path.resolve(__dirname, '..');
const canonical = (v) =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, x[k]]),
        )
      : x,
  );
async function main() {
  const url = testTarget(process.env.PR2B_TEST_URL);
  Object.assign(process.env, {
    DATABASE_URL: url.toString(),
    DIRECT_URL: url.toString(),
    NODE_ENV: 'test',
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    JWT_REFRESH_SECRET: crypto.randomBytes(32).toString('hex'),
  });
  const { PrismaClient } = require('@prisma/client'),
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const checks = [];
  const pass = (name) => {
    checks.push({ name, result: 'PASS' });
    console.log('PASS ' + name);
  };
  let app;
  try {
    const [identity] =
      await db.$queryRaw`SELECT current_database() AS db,current_setting('server_version_num') AS version`;
    assert.equal(identity.db, url.pathname.slice(1));
    assert.equal(Math.floor(Number(identity.version) / 10000), 17);
    const [empty] =
      await db.$queryRaw`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`;
    assert.equal(empty.n, 0, 'Fresh isolated empty database required');
    const deploy = spawnSync(
      process.execPath,
      [
        require.resolve('prisma/build/index.js'),
        'migrate',
        'deploy',
        '--schema',
        path.join(backend, 'prisma/schema.prisma'),
      ],
      { cwd: backend, env: process.env, windowsHide: true, encoding: 'utf8' },
    );
    assert.equal(
      deploy.status,
      0,
      'Migration replay on dedicated database failed',
    );
    const history =
      await db.$queryRaw`SELECT migration_name,checksum,finished_at FROM public."_prisma_migrations" ORDER BY migration_name`;
    assert.equal(
      history.length,
      fs
        .readdirSync(path.join(backend, 'prisma/migrations'))
        .filter((n) =>
          fs.existsSync(
            path.join(backend, 'prisma/migrations', n, 'migration.sql'),
          ),
        ).length,
    );
    for (const r of history) {
      assert(r.finished_at);
      assert.equal(
        r.checksum,
        crypto
          .createHash('sha256')
          .update(
            fs.readFileSync(
              path.join(
                backend,
                'prisma/migrations',
                r.migration_name,
                'migration.sql',
              ),
            ),
          )
          .digest('hex'),
      );
    }
    pass('active migration chain replays with matching history/checksums');
    for (const name of ['FACULTY', 'LECTURER', 'STUDENT', 'ADMIN'])
      await db.role.create({ data: { id: name, name } });
    const permissions = await db.permission.findMany({
      where: { resource: { in: ['proposal', 'review-group'] } },
    });
    for (const roleId of ['FACULTY', 'LECTURER', 'STUDENT', 'ADMIN'])
      for (const p of permissions) {
        if (
          roleId === 'LECTURER' &&
          (p.action === 'assign' || p.action === 'manage')
        )
          continue;
        await db.rolePermission.create({
          data: { roleId, permissionId: p.id },
        });
      }
    for (const [id, roleId] of [
      ['f', 'FACULTY'],
      ['f2', 'FACULTY'],
      ['fd2', 'FACULTY'],
      ['a', 'LECTURER'],
      ['b', 'LECTURER'],
      ['advisor', 'LECTURER'],
      ['out', 'LECTURER'],
      ['outsider', 'LECTURER'],
      ['admin', 'ADMIN'],
      ...Array.from({ length: 9 }, (_, i) => ['s' + (i + 1), 'STUDENT']),
    ])
      await db.userAccount.create({
        data: {
          id,
          username: id,
          email: id + '@example.invalid',
          passwordHash: 'test-fixture-not-for-login',
          status: 'ACTIVE',
          userRoles: { create: { roleId } },
        },
      });
    await db.department.createMany({
      data: [
        { id: 'd1', code: 'D1', name: 'Bộ môn 1' },
        { id: 'd2', code: 'D2', name: 'Bộ môn 2' },
      ],
    });
    const now = Date.now(),
      start = new Date(now - 86400000),
      end = new Date(now + 86400000);
    for (const id of ['t1', 't2']) {
      await db.thesisTerm.create({
        data: {
          id,
          code: id,
          name: id,
          academicYear: '2026',
          semester: 1,
          status: 'IN_PROGRESS',
          startDate: start,
          endDate: end,
        },
      });
      await db.termPhase.create({
        data: {
          id: 'phase-' + id,
          termId: id,
          phaseName: 'Synthetic proposal review',
          startDate: start,
          endDate: end,
          pr2bTermPhaseWorkflowPhaseId: {
            create: { termId: id, key: 'PROPOSAL_REVIEW' },
          },
        },
      });
    }
    for (const id of ['a', 'b', 'advisor', 'out', 'outsider'])
      await db.lecturer.create({
        data: {
          id,
          userId: id,
          lecturerCode: id,
          fullName: id,
          departmentId: 'd1',
          termLecturers: { create: { termId: id === 'out' ? 't2' : 't1' } },
        },
      });
    await db.termLecturer.create({
      data: { termId: 't2', lecturerId: 'advisor' },
    });
    for (const [userId, termId, departmentId] of [
      ['f', 't1', 'd1'],
      ['f2', 't2', 'd1'],
      ['fd2', 't1', 'd2'],
    ])
      await db.academicTermGrant.create({
        data: {
          userId,
          termId,
          pr2bGrantDepartmentGrantId: { create: { departmentId } },
        },
      });
    await db.trainingSystem.create({
      data: { id: 'training', code: 'T', name: 'Synthetic training' },
    });
    await db.researchArea.create({
      data: {
        id: 'area',
        name: 'Synthetic specialty',
        pr2bResearchAreaWorkflowResearchAreaId: {
          create: { departmentId: 'd1' },
        },
      },
    });
    await db.lecturerArea.create({
      data: { lecturerId: 'a', researchAreaId: 'area' },
    });
    for (const termId of ['t1', 't2']) {
      await db.assignmentPlan.create({
        data: {
          id: 'plan-' + termId,
          termId,
          status: 'FINALIZED',
          pr2bAssignmentPlanWorkflowPlanId: {
            create: {
              finalizedAt: new Date(now - 10000),
              finalizedByUserId: 'f',
            },
          },
        },
      });
      await db.termWorkflow.create({
        data: { termId, officialAssignmentPlanId: 'plan-' + termId },
      });
    }
    for (const [id, termId, departmentId, ids] of [
      ['g1', 't1', 'd1', ['a', 'b', 'advisor']],
      ['g2', 't1', 'd1', ['a']],
      ['gout', 't2', 'd1', ['out']],
      ['gd2', 't1', 'd2', ['b']],
    ])
      await db.reviewGroup.create({
        data: {
          id,
          termId,
          name: id,
          members: { create: ids.map((lecturerId) => ({ lecturerId })) },
          pr2bReviewGroupWorkflowGroupId: { create: { departmentId } },
        },
      });
    const content = {
      schemaVersion: 1,
      objectives: 'Synthetic objective',
      scope: 'Synthetic scope',
      mainContents: 'Synthetic content',
      tools: 'Tool',
      expectedResults: 'Result',
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      schedule: [],
    };
    async function version(proposalId, id, n) {
      return db.proposalVersion.create({
        data: {
          id,
          proposalId,
          version: n,
          content,
          pr2bProposalVersionWorkflowVersionId: {
            create: {
              state: 'SEALED',
              contentSchemaVersion: 1,
              contentHash: crypto
                .createHash('sha256')
                .update(canonical(content))
                .digest('hex'),
              createdByUserId: 's' + proposalId.slice(1),
              submittedByUserId: 's' + proposalId.slice(1),
              submittedAt: new Date(now - 5000),
            },
          },
        },
      });
    }
    for (let i = 1; i <= 9; i++) {
      const id = 's' + i,
        termId = i === 9 ? 't2' : 't1',
        advisorId = 'advisor';
      await db.student.create({
        data: {
          id,
          userId: id,
          studentCode: id,
          fullName: id,
          trainingSystemId: 'training',
        },
      });
      await db.termStudent.create({
        data: { id: 'ts' + i, termId, studentId: id },
      });
      await db.registration.create({
        data: {
          id: 'reg' + i,
          termId,
          studentId: id,
          advisorAssignments: {
            create: { assignmentPlanId: 'plan-' + termId, advisorId },
          },
        },
      });
      await db.topic.create({
        data: {
          id: 'topic' + i,
          termId,
          researchAreaId: 'area',
          title: 'Synthetic proposal ' + i,
          pr2bTopicWorkflowTopicId: {
            create: {
              termId,
              termStudentId: 'ts' + i,
              confirmedTopicRevision: 0,
              confirmedAssignmentRevision: 0,
              confirmedByAdvisorId: advisorId,
              confirmedAt: new Date(now - 8000),
            },
          },
        },
      });
      await db.proposal.create({
        data: {
          id: 'p' + i,
          topicId: 'topic' + i,
          termId,
          studentId: id,
          status: 'SUBMITTED',
        },
      });
      await version('p' + i, 'v' + i, 1);
      await db.proposalWorkflow.create({
        data: {
          proposalId: 'p' + i,
          submittedVersionId: 'v' + i,
          workingVersionId: 'v' + i,
          submissionKind: 'INITIAL',
          nextReviewRound: 1,
          nextVersionNumber: 2,
        },
      });
    }
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
    const { SwaggerModule, DocumentBuilder } = require('@nestjs/swagger');
    const swagger = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Step 5').addBearerAuth().build(),
    );
    assert(swagger.paths['/api/proposal-reviews/{id}/decision']);
    pass('Swagger exposes step 5 assignment/decision endpoints');
    const base =
        'http://127.0.0.1:' + app.getHttpServer().address().port + '/api',
      jwt = new JwtService({ secret: process.env.JWT_SECRET });
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
      const r = await fetch(base + route, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(30000),
        }),
        payload = await r.json();
      assert(
        (Array.isArray(status) ? status : [status]).includes(r.status),
        `${method} ${route}: expected ${status}, got ${r.status}: ${JSON.stringify(payload)}`,
      );
      return {
        status: r.status,
        data: payload.data,
        code: payload.error?.code,
      };
    }
    const assign = (p, groupId = 'g1', extra = {}) =>
      req(
        'f',
        'POST',
        `/proposals/${p}/review-assignments`,
        {
          groupId,
          proposalVersionId: 'v' + p.slice(1),
          expectedProposalRevision: 0,
          ...extra,
        },
        201,
      );
    const revisions = (r) => ({
      expectedProposalRevision: r.proposalRevision,
      expectedReviewRevision: r.revision,
    });
    const beginReview = (r, actor = 'a') =>
      req(actor, 'POST', `/proposal-reviews/${r.id}/start`, revisions(r));
    await req(null, 'GET', '/terms/t1/proposals', undefined, 401);
    for (const actor of ['admin'])
      await req(actor, 'GET', '/terms/t1/proposals', undefined, 404);
    await req('f2', 'GET', '/terms/t1/proposals', undefined, 404);
    await req('fd2', 'GET', '/proposals/p1', undefined, 404);
    pass(
      '401, ADMIN deny despite permission and forged claims, cross-term/department isolation',
    );
    const candidates = (
      await req('f', 'GET', '/proposals/p1/review-candidates')
    ).data;
    assert.deepEqual(
      candidates.map((g) => g.id),
      ['g1', 'g2'],
    );
    assert.equal(candidates[0].specialtyMatchCount, 1);
    assert.equal(await db.proposalReview.count(), 0);
    pass(
      'specialty candidates are advisory, scoped and have no assignment side effects',
    );
    await req(
      'f',
      'POST',
      '/proposals/p1/review-assignments',
      { groupId: 'gout', proposalVersionId: 'v1', expectedProposalRevision: 0 },
      409,
    );
    await req(
      'f',
      'POST',
      '/proposals/p1/review-assignments',
      { groupId: 'gd2', proposalVersionId: 'v1', expectedProposalRevision: 0 },
      409,
    );
    pass('cross-term and wrong-department group assignment rejected');
    // A higher draft exists; the reviewed version remains the SEALED submission.
    await db.proposalVersion.create({
      data: {
        id: 'draft1',
        proposalId: 'p1',
        version: 2,
        content: { draft: true },
        pr2bProposalVersionWorkflowVersionId: { create: { state: 'DRAFT' } },
      },
    });
    await db.proposalWorkflow.update({
      where: { proposalId: 'p1' },
      data: { workingVersionId: 'draft1' },
    });
    const key = crypto.randomUUID(),
      body = {
        groupId: 'g1',
        proposalVersionId: 'v1',
        expectedProposalRevision: 0,
      };
    let r1 = (
      await req('f', 'POST', '/proposals/p1/review-assignments', body, 201, key)
    ).data;
    assert.equal(r1.versionId, 'v1');
    assert.equal(r1.assignedByUserId, 'f');
    assert.equal(
      (
        await req(
          'f',
          'POST',
          '/proposals/p1/review-assignments',
          body,
          201,
          key,
        )
      ).data.id,
      r1.id,
    );
    await req(
      'f',
      'POST',
      '/proposals/p1/review-assignments',
      { ...body, groupId: 'g2' },
      409,
      key,
    );
    await req(
      'f',
      'POST',
      '/proposals/p1/review-assignments',
      { ...body, expectedProposalRevision: 1 },
      409,
    );
    assert.equal(
      await db.proposalReview.count({ where: { proposalId: 'p1' } }),
      1,
    );
    pass(
      'assignment binds submitted version, actor, history, idempotency and duplicate-active guard',
    );
    for (const actor of ['out', 'outsider', 'admin', 'f2'])
      await req(actor, 'GET', `/proposal-reviews/${r1.id}`, undefined, 404);
    await req('b', 'GET', `/proposal-reviews/${r1.id}`);
    await req(
      'f',
      'POST',
      `/proposal-reviews/${r1.id}/start`,
      revisions(r1),
      403,
    );
    pass(
      'only assigned roster members or academic owners/advisors read; faculty cannot review as faculty',
    );
    await req('advisor', 'GET', `/proposal-reviews/${r1.id}`);
    await req('s1', 'GET', `/proposal-reviews/${r1.id}`);
    const studentList = (await req('s1', 'GET', '/terms/t1/proposals')).data;
    assert.equal(studentList.total, 1);
    assert.equal(studentList.data[0].id, 'p1');
    const advisorList = (await req('advisor', 'GET', '/terms/t1/proposals'))
      .data;
    assert.equal(advisorList.total, 8);
    assert(advisorList.data.every((p) => p.canAssign === false));
    await req('s2', 'GET', `/proposal-reviews/${r1.id}`, undefined, 404);
    await req(
      'advisor',
      'POST',
      `/proposal-reviews/${r1.id}/start`,
      revisions(r1),
      404,
    );
    await req(
      's1',
      'POST',
      `/proposal-reviews/${r1.id}/start`,
      revisions(r1),
      404,
    );
    await req(
      'advisor',
      'POST',
      `/proposal-reviews/${r1.id}/comments`,
      { expectedReviewRevision: 0, versionId: 'v1', text: 'Self review' },
      404,
    );
    pass(
      'owner/current advisor read scoped evidence but cannot comment or decide as reviewers',
    );
    await req(
      'a',
      'POST',
      `/proposal-reviews/${r1.id}/decision`,
      { ...revisions(r1), versionId: 'v1', decision: 'APPROVED' },
      409,
    );
    pass('decision before explicit start is an invalid transition');
    r1 = (
      await req(
        'a',
        'POST',
        `/proposal-reviews/${r1.id}/comments`,
        {
          expectedReviewRevision: r1.revision,
          versionId: 'v1',
          text: 'Nhận xét thành viên A',
        },
        201,
      )
    ).data;
    r1 = (await beginReview(r1)).data;
    assert.equal(r1.proposalStatus, 'UNDER_REVIEW');
    r1 = (
      await req(
        'b',
        'POST',
        `/proposal-reviews/${r1.id}/comments`,
        {
          expectedReviewRevision: r1.revision,
          versionId: 'v1',
          text: 'Nhận xét thành viên B',
        },
        201,
      )
    ).data;
    assert.equal(r1.comments.length, 2);
    pass('valid assign → comments by multiple members → explicit start flow');
    const decisionPayload = {
      ...revisions(r1),
      versionId: 'v1',
      decision: 'APPROVED',
    };
    const concurrent = await Promise.all(
      ['a', 'b'].map((actor) =>
        req(
          actor,
          'POST',
          `/proposal-reviews/${r1.id}/decision`,
          decisionPayload,
          [200, 409],
        ),
      ),
    );
    assert.equal(concurrent.filter((x) => x.status === 200).length, 1);
    assert.equal(
      await db.proposalReviewDecision.count({ where: { reviewId: r1.id } }),
      1,
    );
    assert.equal(
      (await db.proposal.findUnique({ where: { id: 'p1' } })).status,
      'APPROVED',
    );
    assert.equal(await db.thesisDossier.count(), 0);
    const decided = (await req('a', 'GET', `/proposal-reviews/${r1.id}`)).data;
    assert.equal(decided.decision.versionId, 'v1');
    assert.equal(decided.allowedActions.length, 0);
    pass(
      'concurrent decisions commit exactly once; APPROVED never finalizes a dossier',
    );
    await req(
      'a',
      'POST',
      `/proposal-reviews/${r1.id}/comments`,
      {
        expectedReviewRevision: decided.revision,
        versionId: 'v1',
        text: 'Late comment',
      },
      409,
    );
    pass('decided rounds reject later comments/decisions');
    let r2 = (await assign('p2')).data;
    r2 = (await beginReview(r2)).data;
    await req(
      'a',
      'POST',
      `/proposal-reviews/${r2.id}/decision`,
      { ...revisions(r2), versionId: 'v2', decision: 'REVISION_REQUIRED' },
      400,
    );
    const decisionKey = crypto.randomUUID(),
      revisionBody = {
        ...revisions(r2),
        versionId: 'v2',
        decision: 'REVISION_REQUIRED',
        comment: 'Bổ sung phạm vi',
      };
    const returned = (
      await req(
        'a',
        'POST',
        `/proposal-reviews/${r2.id}/decision`,
        revisionBody,
        200,
        decisionKey,
      )
    ).data;
    assert.equal(returned.proposalStatus, 'REVISION_REQUESTED');
    assert.equal(returned.decision.decision, 'REVISION_REQUIRED');
    assert.equal(
      (await db.proposalReview.findUnique({ where: { id: r2.id } })).decision,
      'REVISION_REQUESTED',
    );
    assert.equal(
      (
        await req(
          'a',
          'POST',
          `/proposal-reviews/${r2.id}/decision`,
          revisionBody,
          200,
          decisionKey,
        )
      ).data.id,
      r2.id,
    );
    assert.equal(
      await db.outboxEvent.count({ where: { aggregateId: 'p2' } }),
      1,
    );
    pass(
      'revision-required needs comment, preserves canonical result and legacy state, replay emits one outbox event',
    );
    await db.userAccount.update({
      where: { id: 'a' },
      data: { status: 'LOCKED' },
    });
    await req(
      'a',
      'POST',
      `/proposal-reviews/${r2.id}/decision`,
      revisionBody,
      403,
      decisionKey,
    );
    await db.userAccount.update({
      where: { id: 'a' },
      data: { status: 'ACTIVE' },
    });
    pass('revoked account cannot replay cached academic response');
    let r3 = (await assign('p3')).data;
    r3 = (await beginReview(r3)).data;
    await version('p3', 'v3new', 2);
    await db.proposalWorkflow.update({
      where: { proposalId: 'p3' },
      data: { submittedVersionId: 'v3new', revision: { increment: 1 } },
    });
    const stale = await req(
      'a',
      'POST',
      `/proposal-reviews/${r3.id}/decision`,
      { ...revisions(r3), versionId: 'v3', decision: 'APPROVED' },
      409,
    );
    assert.equal(stale.code, 'STALE_VERSION');
    assert.equal(
      await db.proposalReviewDecision.count({ where: { reviewId: r3.id } }),
      0,
    );
    const inbox = (
      await req('a', 'GET', '/terms/t1/proposals?status=UNDER_REVIEW')
    ).data.data.find((p) => p.id === 'p3');
    assert.equal(inbox.submittedVersionId, 'v3');
    const old = (await req('a', 'GET', `/proposal-reviews/${r3.id}`)).data;
    assert.equal(old.versionId, 'v3');
    assert(!old.allowedActions.includes('decide'));
    pass(
      'new submitted version blocks stale decision and never leaks the unassigned content to reviewer',
    );
    let r4 = (await assign('p4')).data;
    r4 = (await beginReview(r4)).data;
    const reassigned = (
      await req(
        'f',
        'POST',
        '/proposals/p4/review-assignments',
        {
          groupId: 'g2',
          proposalVersionId: 'v4',
          expectedProposalRevision: r4.proposalRevision,
          replacesReviewId: r4.id,
          expectedReviewRevision: r4.revision,
          reason: 'Điều chỉnh nhóm',
        },
        201,
      )
    ).data;
    const previous = (await req('f', 'GET', `/proposal-reviews/${r4.id}`)).data;
    assert.equal(previous.state, 'SUPERSEDED');
    assert.equal(previous.supersededByReviewId, reassigned.id);
    assert.equal(reassigned.roundNumber, 2);
    assert.equal(reassigned.proposalStatus, 'SUBMITTED');
    const rounds = (await req('f', 'GET', '/proposals/p4/review-history')).data;
    assert.equal(rounds.length, 2);
    await req('b', 'GET', `/proposal-reviews/${reassigned.id}`, undefined, 404);
    pass(
      'reassignment atomically supersedes prior round with reason and preserves scoped history',
    );
    await db.proposalWorkflow.update({
      where: { proposalId: 'p6' },
      data: { nextReviewRound: null },
    });
    const missing = await req(
      'f',
      'POST',
      '/proposals/p6/review-assignments',
      { groupId: 'g1', proposalVersionId: 'v6', expectedProposalRevision: 0 },
      409,
    );
    assert.equal(missing.code, 'INPUT_NOT_READY');
    assert.equal(
      await db.proposalReview.count({ where: { proposalId: 'p6' } }),
      0,
    );
    pass('missing producer counter fails closed, never guessed/backfilled');
    await db.termPhase.update({
      where: { id: 'phase-t1' },
      data: { isLocked: true },
    });
    const locked = await req(
      'f',
      'POST',
      '/proposals/p5/review-assignments',
      { groupId: 'g1', proposalVersionId: 'v5', expectedProposalRevision: 0 },
      409,
    );
    assert.equal(locked.code, 'TERM_003');
    await db.termPhase.update({
      where: { id: 'phase-t1' },
      data: { isLocked: false },
    });
    pass('locked phase blocks assignment');
    // Inject failure on audit INSERT: all business rows and replay/outbox must roll back.
    await db.$executeRawUnsafe(
      `CREATE FUNCTION step5_test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.resource='proposal-review' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      'CREATE TRIGGER step5_test_fail_audit BEFORE INSERT ON public."AUDIT_LOG" FOR EACH ROW EXECUTE FUNCTION step5_test_fail_audit()',
    );
    await req(
      'f',
      'POST',
      '/proposals/p7/review-assignments',
      { groupId: 'g1', proposalVersionId: 'v7', expectedProposalRevision: 0 },
      500,
    );
    assert.equal(
      await db.proposalReview.count({ where: { proposalId: 'p7' } }),
      0,
    );
    assert.equal(
      (await db.proposalWorkflow.findUnique({ where: { proposalId: 'p7' } }))
        .revision,
      0,
    );
    await db.$executeRawUnsafe(
      'DROP TRIGGER step5_test_fail_audit ON public."AUDIT_LOG"',
    );
    await db.$executeRawUnsafe('DROP FUNCTION step5_test_fail_audit()');
    pass(
      'audit failure rolls back assignment, revisions and idempotency atomically',
    );
    // Real parallel assignment contenders use the same expected proposal revision.
    const assignments = await Promise.all(
      ['g1', 'g2'].map((groupId) =>
        req(
          'f',
          'POST',
          '/proposals/p8/review-assignments',
          { groupId, proposalVersionId: 'v8', expectedProposalRevision: 0 },
          [201, 409],
        ),
      ),
    );
    assert.equal(assignments.filter((x) => x.status === 201).length, 1);
    assert.equal(
      await db.proposalReviewWorkflow.count({
        where: { proposalId: 'p8', state: { in: ['ASSIGNED', 'IN_REVIEW'] } },
      }),
      1,
    );
    pass('concurrent assignments create exactly one active round');
    const review2 = (
      await req(
        'f2',
        'POST',
        '/proposals/p9/review-assignments',
        {
          groupId: 'gout',
          proposalVersionId: 'v9',
          expectedProposalRevision: 0,
        },
        201,
      )
    ).data;
    await req('a', 'GET', `/proposal-reviews/${review2.id}`, undefined, 404);
    await req('out', 'GET', `/proposal-reviews/${review2.id}`);
    pass('second term review remains isolated from first-term reviewer');
    assert.equal(await db.guidancePlan.count(), 0);
    assert.equal(await db.task.count(), 0);
    assert.equal(await db.thesisDossier.count(), 0);
    pass(
      'step 5 does not implement/fabricate dossier, guidance or task workflows',
    );
    // A producer closes the phase while an assignment waits for its row.
    let releasePhase, phaseLocked;
    const release = new Promise((resolve) => {
      releasePhase = resolve;
    });
    const ready = new Promise((resolve) => {
      phaseLocked = resolve;
    });
    const blocker = db.$transaction(
      async (tx) => {
        await tx.termPhase.update({
          where: { id: 'phase-t1' },
          data: { isLocked: true },
        });
        phaseLocked();
        await release;
      },
      { timeout: 15000 },
    );
    await ready;
    const pending = req(
      'f',
      'POST',
      '/proposals/p5/review-assignments',
      { groupId: 'g1', proposalVersionId: 'v5', expectedProposalRevision: 0 },
      409,
    );
    try {
      let blocked = false;
      for (let i = 0; i < 100; i++) {
        const [waiter] =
          await db.$queryRaw`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%TERM_PHASE%'`;
        if (waiter.n) {
          blocked = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert(blocked, 'Expected real transaction lock contention');
    } finally {
      releasePhase();
    }
    await blocker;
    assert.equal((await pending).code, 'TERM_003');
    assert.equal(
      await db.proposalReview.count({ where: { proposalId: 'p5' } }),
      0,
    );
    await db.termPhase.update({
      where: { id: 'phase-t1' },
      data: { isLocked: false },
    });
    pass(
      'phase lock racing with assignment commits first and prevents the blocked assignment',
    );
    const commentRound = (await assign('p5')).data;
    const commentsRace = await Promise.all(
      ['a', 'b'].map((actor) =>
        req(
          actor,
          'POST',
          `/proposal-reviews/${commentRound.id}/comments`,
          {
            expectedReviewRevision: commentRound.revision,
            versionId: 'v5',
            text: 'Concurrent ' + actor,
          },
          [201, 409],
        ),
      ),
    );
    assert.equal(commentsRace.filter((r) => r.status === 201).length, 1);
    assert.equal(
      await db.reviewComment.count({ where: { reviewId: commentRound.id } }),
      1,
    );
    pass('concurrent comments honor review revision and reject stale append');
    await db.assignmentPlan.update({
      where: { id: 'plan-t1' },
      data: { status: 'PUBLISHED' },
    });
    assert.equal(
      (await req('f', 'GET', '/proposals/p7/review-candidates', undefined, 409))
        .code,
      'INPUT_NOT_READY',
    );
    await db.assignmentPlan.update({
      where: { id: 'plan-t1' },
      data: { status: 'FINALIZED' },
    });
    await db.topicWorkflow.update({
      where: { topicId: 'topic7' },
      data: { confirmedTopicRevision: 1 },
    });
    assert.equal(
      (await req('f', 'GET', '/proposals/p7/review-candidates', undefined, 409))
        .code,
      'TOPIC_NOT_AGREED',
    );
    pass(
      'PUBLISHED is not official and obsolete Topic agreement never enables assignment',
    );
    await db.researchAreaWorkflow.update({
      where: { researchAreaId: 'area' },
      data: { revision: { increment: 1 } },
    });
    const beforeRouting = (
      await req('a', 'GET', `/proposal-reviews/${commentRound.id}`)
    ).data;
    assert.equal(
      (
        await req(
          'a',
          'POST',
          `/proposal-reviews/${commentRound.id}/start`,
          revisions(beforeRouting),
          409,
        )
      ).code,
      'ROUTING_MISMATCH',
    );
    const routingRound = (
      await req(
        'f',
        'POST',
        '/proposals/p5/review-assignments',
        {
          groupId: 'g1',
          proposalVersionId: 'v5',
          expectedProposalRevision: beforeRouting.proposalRevision,
          replacesReviewId: beforeRouting.id,
          expectedReviewRevision: beforeRouting.revision,
          reason: 'Xác nhận routing cập nhật',
        },
        201,
      )
    ).data;
    await beginReview(routingRound);
    pass(
      'routing revision change requires explicit faculty reassignment before review can continue',
    );
    const malformedRound = await db.proposalReview.findFirst({
      where: { proposalId: 'p8' },
    });
    const malformedVersion = await db.proposalVersion.create({
      data: {
        proposalId: 'p8',
        version: 2,
        content: { malformedLegacy: true },
        pr2bProposalVersionWorkflowVersionId: { create: { state: 'DRAFT' } },
      },
    });
    // Intentionally malformed external-producer fixture; never unseal a snapshot.
    await db.proposalReviewWorkflow.update({
      where: { reviewId: malformedRound.id },
      data: { versionId: malformedVersion.id },
    });
    assert.equal(
      (
        await req(
          'a',
          'GET',
          `/proposal-reviews/${malformedRound.id}`,
          undefined,
          409,
        )
      ).code,
      'INPUT_NOT_READY',
    );
    pass(
      'malformed legacy review pointing to an unsealed version never exposes draft content',
    );
    fs.writeFileSync(
      path.join(backend, 'prisma/review/step5-results.json'),
      JSON.stringify(
        {
          result: 'PASS',
          postgresVersion: identity.version,
          migrations: history.map((r) => r.migration_name),
          checks,
          sharedDatabaseDDL: false,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(`${checks.length} step 5 integration checks passed`);
  } finally {
    if (app) await app.close();
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(
    'Step 5 isolated integration failed: ' +
      String(e.message).replace(
        /postgres(?:ql)?:\/\/[^\s]+/gi,
        '[redacted URL]',
      ),
  );
  process.exitCode = 1;
});
