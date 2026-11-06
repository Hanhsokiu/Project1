'use strict';
const { prepareFixtureSessions } = require('./integration/auth-fixture.cjs');
// Step 4 HTTP integration. Explicit fresh local PG17 target only; never .env fallback.
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict'),
  crypto = require('node:crypto'),
  { spawnSync } = require('node:child_process');
const { testTarget } = require('./rehearse-pr2b.cjs');
async function main() {
  const url = testTarget(process.env.PR2B_TEST_URL);
  Object.assign(process.env, {
    DATABASE_URL: url.toString(),
    DIRECT_URL: url.toString(),
    NODE_ENV: 'test',
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    JWT_REFRESH_SECRET: crypto.randomBytes(32).toString('hex'),
  });
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const results = [];
  let app;
  function pass(name) {
    results.push({ name, result: 'PASS' });
    console.log('PASS ' + name);
  }
  try {
    const [identity] = await db.$queryRawUnsafe(
      "SELECT current_database() AS db,current_setting('server_version_num') AS version",
    );
    assert.equal(identity.db, url.pathname.slice(1));
    assert.equal(Math.floor(Number(identity.version) / 10000), 17);
    const [tables] = await db.$queryRawUnsafe(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
    );
    assert.equal(tables.n, 0, 'Fresh isolated database required');
    const backend = path.resolve(__dirname, '..');
    const deploy = spawnSync(
      process.execPath,
      [
        require.resolve('prisma/build/index.js'),
        'migrate',
        'deploy',
        '--schema',
        path.join(backend, 'prisma/schema.prisma'),
      ],
      { cwd: backend, env: process.env, encoding: 'utf8', windowsHide: true },
    );
    if (deploy.error || deploy.status !== 0)
      throw Error('Isolated migration replay failed');
    pass('active migration chain replays without reset/drop');
    const history = await db.$queryRawUnsafe(
      'SELECT migration_name,checksum,finished_at FROM public."_prisma_migrations" ORDER BY migration_name',
    );
    assert.equal(history.length, fs.readdirSync(path.join(backend,'prisma/migrations')).filter(name=>fs.existsSync(path.join(backend,'prisma/migrations',name,'migration.sql'))).length);
    for (const row of history) {
      assert(row.finished_at);
      assert.equal(
        row.checksum,
        crypto
          .createHash('sha256')
          .update(
            fs.readFileSync(
              path.join(
                backend,
                'prisma/migrations',
                row.migration_name,
                'migration.sql',
              ),
            ),
          )
          .digest('hex'),
      );
    }
    pass('migration history checksums match applied files');
    // Synthetic fixture. No official assignment, approval, receipt or files fabricated.
    for (const name of ['FACULTY', 'LECTURER', 'STUDENT', 'ADMIN'])
      await db.role.create({ data: { id: name, name } });
    const permissions = await db.permission.findMany({
      where: { resource: 'review-group' },
    });
    for (const roleId of ['FACULTY', 'LECTURER', 'STUDENT', 'ADMIN'])
      for (const p of permissions)
        if (roleId !== 'LECTURER' || p.action === 'read')
          await db.rolePermission.create({
            data: { roleId, permissionId: p.id },
          });
    for (const [id, roleId] of [
      ['f', 'FACULTY'],
      ['f2', 'FACULTY'],
      ['a', 'LECTURER'],
      ['b', 'LECTURER'],
      ['out', 'LECTURER'],
      ['off', 'LECTURER'],
      ['norole', 'STUDENT'],
      ['locked', 'LECTURER'],
      ['admin', 'ADMIN'],
      ['student', 'STUDENT'],
    ]) {
      await db.userAccount.create({
        data: {
          id,
          username: id,
          email: id + '@example.invalid',
          passwordHash: 'synthetic-not-for-login',
          status: id === 'locked' ? 'LOCKED' : 'ACTIVE',
          userRoles: { create: { roleId } },
        },
      });
    }
    await db.department.createMany({
      data: [
        { id: 'd1', code: 'D1', name: 'Bộ môn 1' },
        { id: 'd2', code: 'D2', name: 'Bộ môn 2' },
      ],
    });
    for (const id of ['t1', 't2'])
      await db.thesisTerm.create({
        data: {
          id,
          code: id,
          name: id,
          academicYear: '2026',
          semester: 1,
          status: 'DRAFT',
          startDate: new Date('2026-01-01Z'),
          endDate: new Date('2027-01-01Z'),
        },
      });
    for (const id of ['a', 'b', 'out', 'off', 'norole', 'locked'])
      await db.lecturer.create({
        data: {
          id,
          userId: id,
          lecturerCode: id,
          fullName: id,
          departmentId: id === 'b' ? 'd2' : 'd1',
          isActive: id !== 'off',
          termLecturers: { create: { termId: id === 'out' ? 't2' : 't1' } },
        },
      });
    for (const [userId, departmentId] of [
      ['f', 'd1'],
      ['f2', 'd2'],
    ])
      await db.academicTermGrant.create({
        data: {
          userId,
          termId: 't1',
          pr2bGrantDepartmentGrantId: { create: { departmentId } },
        },
      });
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
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Step4 test').addBearerAuth().build(),
    );
    assert(document.paths['/api/review-groups/{id}']);
    assert(document.components.schemas.ReviewGroupResponse.properties.members);
    pass('Swagger exposes step4 routes and response DTO');
    const base =
      'http://127.0.0.1:' + app.getHttpServer().address().port + '/api';
    const jwt = new JwtService({ secret: process.env.JWT_SECRET });
    async function request(
      actor,
      method,
      route,
      body,
      status,
      key = crypto.randomUUID(),
    ) {
      const headers = {
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      };
      if (actor)
        headers.Authorization =
          'Bearer ' + jwt.sign({ sub: actor, sid: actor, roles: ['FACULTY', 'ADMIN'] });
      const r = await fetch(base + route, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });
      const payload = await r.json();
      if (Array.isArray(status))
        assert(
          status.includes(r.status),
          `${method} ${route}: ${JSON.stringify(payload)}`,
        );
      else
        assert.equal(
          r.status,
          status,
          `${method} ${route}: ${JSON.stringify(payload)}`,
        );
      if (r.status < 300) assert.equal(payload.success, true);
      return { ...payload, httpStatus: r.status };
    }
    await request(null, 'GET', '/terms/t1/review-groups', undefined, 401);
    pass('unauthenticated API denied');
    const input = {
      name: 'Nhóm thử nghiệm',
      departmentId: 'd1',
      memberLecturerIds: ['a'],
    };
    const first = (
      await request(
        'f',
        'POST',
        '/terms/t1/review-groups',
        input,
        201,
        'create-fixed',
      )
    ).data;
    const gid = first.id;
    assert.equal(first.members[0].role, 'MEMBER');
    assert.equal(first.revision, 0);
    pass('faculty creates department/term group with valid member');
    assert.equal(
      (
        await request(
          'f',
          'POST',
          '/terms/t1/review-groups',
          input,
          201,
          'create-fixed',
        )
      ).data.id,
      gid,
    );
    assert.equal(await db.auditLog.count({ where: { resourceId: gid } }), 1);
    pass('idempotent create replays without duplicate audit');
    await request(
      'f',
      'POST',
      '/terms/t1/review-groups',
      { ...input, name: 'Changed' },
      409,
      'create-fixed',
    );
    pass('idempotency key payload conflict rejected');
    const grant = await db.academicTermGrant.findUnique({
      where: { userId_termId: { userId: 'f', termId: 't1' } },
    });
    await db.grantDepartment.deleteMany({ where: { grantId: grant.id } });
    await db.grantDepartment.create({
      data: { grantId: grant.id, departmentId: 'd2' },
    });
    await request(
      'f',
      'POST',
      '/terms/t1/review-groups',
      input,
      404,
      'create-fixed',
    );
    await db.grantDepartment.deleteMany({ where: { grantId: grant.id } });
    await db.grantDepartment.create({
      data: { grantId: grant.id, departmentId: 'd1' },
    });
    pass('cached create response cannot bypass revoked department scope');
    await request(
      'f',
      'POST',
      '/terms/t1/review-groups',
      { ...input, memberLecturerIds: ['a', 'a'] },
      400,
    );
    pass('duplicate array validation');
    await request(
      'f',
      'POST',
      '/terms/t1/review-groups',
      { ...input, decisionMaker: 'a' },
      400,
    );
    pass('unknown input fields rejected');
    for (const id of ['out', 'off', 'norole', 'locked', 'missing'])
      await request(
        'f',
        'POST',
        '/terms/t1/review-groups',
        { ...input, memberLecturerIds: [id] },
        400,
      );
    pass('cross-term inactive missing role and nonexistent members denied');
    await request(
      'f',
      'POST',
      '/terms/t1/review-groups',
      { ...input, departmentId: 'd2' },
      404,
    );
    await request('f', 'POST', '/terms/t2/review-groups', input, 404);
    pass('faculty cannot cross department or term grants');
    await request('a', 'GET', `/review-groups/${gid}`, undefined, 200);
    await request('b', 'GET', `/review-groups/${gid}`, undefined, 404);
    await request('f2', 'GET', `/review-groups/${gid}`, undefined, 404);
    pass('lecturer reads only membership and faculty only granted department');
    for (const actor of ['admin', 'student'])
      await request(actor, 'GET', `/review-groups/${gid}`, undefined, 403);
    pass(
      'ADMIN/student cannot bypass policy even with permissions and forged role claims',
    );
    await request('a', 'POST', '/terms/t1/review-groups', input, 403);
    pass('lecturer cannot manage groups');
    await request('out', 'GET', '/terms/t1/review-groups', undefined, 404);
    pass('cross-round lecturer access denied');
    const filtered = (
      await request(
        'f',
        'GET',
        '/terms/t1/review-groups?search=Nhóm&limit=1&page=1',
        undefined,
        200,
      )
    ).data;
    assert.equal(filtered.total, 1);
    assert.equal(filtered.data.length, 1);
    pass('pagination and name filter intersect scope');
    await request(
      'f',
      'GET',
      '/terms/t1/review-groups?limit=101',
      undefined,
      400,
    );
    pass('pagination bounds enforced');
    let g = (
      await request(
        'f',
        'PATCH',
        `/review-groups/${gid}`,
        { expectedRevision: 0, name: 'Đổi tên', reason: 'Sửa tên' },
        200,
      )
    ).data;
    assert.equal(g.revision, 1);
    await request(
      'f',
      'PATCH',
      `/review-groups/${gid}`,
      { expectedRevision: 0, name: 'Stale', reason: 'Cũ' },
      409,
    );
    pass('update CAS and stale revision rejection');
    g = (
      await request(
        'f',
        'POST',
        `/review-groups/${gid}/members`,
        { expectedRevision: 1, lecturerId: 'b', reason: 'Bổ sung' },
        201,
      )
    ).data;
    assert.equal(g.members.length, 2);
    pass('add valid roster member including other home department');
    await request(
      'f',
      'POST',
      `/review-groups/${gid}/members`,
      { expectedRevision: 2, lecturerId: 'b', reason: 'Lặp' },
      409,
    );
    pass('existing membership duplicate rejected');
    g = (
      await request(
        'f',
        'DELETE',
        `/review-groups/${gid}/members/a`,
        { expectedRevision: 2, reason: 'Thay đổi' },
        200,
      )
    ).data;
    await request('a', 'GET', `/review-groups/${gid}`, undefined, 404);
    assert.equal(
      (
        await request(
          'b',
          'GET',
          `/review-groups/${gid}/members`,
          undefined,
          200,
        )
      ).data.length,
      1,
    );
    pass('remove member revokes access and preserves membership history');
    assert.equal(
      await db.reviewMembershipHistory.count({ where: { groupId: gid } }),
      3,
    );
    pass('membership changes recorded append-only');
    const concurrent = await Promise.all([
      request(
        'f',
        'PATCH',
        `/review-groups/${gid}`,
        { expectedRevision: 3, name: 'Concurrent 1', reason: 'CAS' },
        [200, 409],
      ).then((r) => r.httpStatus),
      request(
        'f',
        'PATCH',
        `/review-groups/${gid}`,
        { expectedRevision: 3, name: 'Concurrent 2', reason: 'CAS' },
        [200, 409],
      ).then((r) => r.httpStatus),
    ]);
    assert.deepEqual(concurrent.sort(), [200, 409]);
    assert.equal(
      (await db.reviewGroupWorkflow.findUnique({ where: { groupId: gid } }))
        .revision,
      4,
    );
    pass('concurrent updates have one CAS winner');
    // Real audit failure rolls the preceding membership and revision writes back.
    await db.$executeRawUnsafe(
      `CREATE FUNCTION public.step4_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='UPDATE' AND NEW.resource='review-group' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      'CREATE TRIGGER step4_test_audit BEFORE INSERT ON public."AUDIT_LOG" FOR EACH ROW EXECUTE FUNCTION public.step4_fail_audit()',
    );
    await request(
      'f',
      'PATCH',
      `/review-groups/${gid}`,
      { expectedRevision: 4, memberLecturerIds: ['a'], reason: 'Rollback' },
      500,
    );
    assert.equal(
      (await db.reviewGroupWorkflow.findUnique({ where: { groupId: gid } }))
        .revision,
      4,
    );
    assert.equal(
      (
        await db.reviewGroupMember.findMany({ where: { reviewGroupId: gid } })
      )[0].lecturerId,
      'b',
    );
    pass('audit failure rolls back revision membership and history');
    await db.$executeRawUnsafe(
      'DROP TRIGGER step4_test_audit ON public."AUDIT_LOG"',
    );
    await db.$executeRawUnsafe('DROP FUNCTION public.step4_fail_audit()');
    await db.trainingSystem.create({
      data: { id: 'sys', code: 'SYS', name: 'Synthetic' },
    });
    await db.student.create({
      data: {
        id: 'sv',
        userId: 'student',
        studentCode: 'SV',
        fullName: 'Synthetic',
        trainingSystemId: 'sys',
      },
    });
    await db.topic.create({
      data: { id: 'topic', termId: 't1', title: 'Synthetic' },
    });
    await db.proposal.create({
      data: { id: 'p', topicId: 'topic', studentId: 'sv', termId: 't1' },
    });
    const review = await db.proposalReview.create({
      data: { id: 'review', proposalId: 'p', reviewGroupId: gid },
    });
    await request(
      'f',
      'PATCH',
      `/review-groups/${gid}`,
      { expectedRevision: 4, memberLecturerIds: ['a'], reason: 'Locked' },
      409,
    );
    pass('unresolved legacy review blocks membership changes');
    await db.proposalVersion.create({
      data: {
        id: 'v',
        proposalId: 'p',
        version: 1,
        content: { synthetic: true },
      },
    });
    await db.proposalReviewWorkflow.create({
      data: {
        reviewId: review.id,
        proposalId: 'p',
        versionId: 'v',
        roundNumber: 1,
        state: 'ASSIGNED',
      },
    });
    await request(
      'f',
      'POST',
      `/review-groups/${gid}/members`,
      { expectedRevision: 4, lecturerId: 'a', reason: 'Locked' },
      409,
    );
    pass('active assigned round blocks membership mutation');
    await request(
      'f',
      'DELETE',
      `/review-groups/${gid}`,
      { expectedRevision: 4, reason: 'Delete' },
      409,
    );
    assert.equal(
      await db.proposalReview.count({ where: { reviewGroupId: gid } }),
      1,
    );
    pass('assigned group deletion preserves proposal references');
    const removable = (
      await request(
        'f',
        'POST',
        '/terms/t1/review-groups',
        { name: 'Archive', departmentId: 'd1', memberLecturerIds: ['a'] },
        201,
      )
    ).data;
    await request(
      'f',
      'DELETE',
      `/review-groups/${removable.id}`,
      { expectedRevision: 0, reason: 'Không dùng' },
      200,
      'archive-key',
    );
    await request(
      'f',
      'DELETE',
      `/review-groups/${removable.id}`,
      { expectedRevision: 0, reason: 'Không dùng' },
      200,
      'archive-key',
    );
    await request('f', 'GET', `/review-groups/${removable.id}`, undefined, 404);
    assert(await db.reviewGroup.findUnique({ where: { id: removable.id } }));
    assert.equal(
      await db.reviewMembershipHistory.count({
        where: { groupId: removable.id },
      }),
      1,
    );
    pass('soft deletion and retry preserve group member history');
    await db.thesisTerm.update({
      where: { id: 't1' },
      data: { status: 'COMPLETED' },
    });
    await request(
      'f',
      'PATCH',
      `/review-groups/${gid}`,
      { expectedRevision: 4, name: 'No', reason: 'Closed' },
      409,
    );
    pass('closed term remains read-only');
    const options = (
      await request(
        'b',
        'GET',
        '/terms/t1/review-group-options',
        undefined,
        200,
      )
    ).data;
    assert.equal(options.canManage, false);
    assert.equal(options.departments.length, 0);
    assert.equal(options.lecturers.data.length, 1);
    pass('lecturer options do not expose full roster');
    fs.writeFileSync(
      path.join(backend, 'prisma/review/step4-results.json'),
      JSON.stringify(
        {
          result: 'PASS',
          postgresVersion: identity.version,
          checks: results,
          migrations: history.map((r) => ({
            name: r.migration_name,
            checksum: r.checksum,
          })),
          sharedDatabaseDDL: false,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(results.length + ' Step4 integration checks passed');
  } finally {
    if (app) await app.close();
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(
    String(e.message).replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_URL]'),
  );
  process.exitCode = 1;
});
