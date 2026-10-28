'use strict';
// Actual Edge UI with mock API, no backend or database access.
const { spawn } = require('node:child_process'),
  fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
async function main() {
  const root = path.resolve(__dirname, '..'),
    origin = 'http://127.0.0.1:50174',
    vite = spawn(
      process.execPath,
      [
        path.join(
          path.dirname(require.resolve('vite/package.json')),
          'bin/vite.js',
        ),
        '--host',
        '127.0.0.1',
        '--port',
        '50174',
        '--strictPort',
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          VITE_API_URL: '/api',
          VITE_REVIEW_GROUP_DEMO: 'true',
        },
        stdio: 'ignore',
        windowsHide: true,
      },
    );
  let browser;
  const checks = [],
    pass = (name) => {
      checks.push({ name, result: 'PASS' });
      console.log('PASS ' + name);
    };
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(origin)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(ready, 'Vite failed to start');
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    await page.addInitScript(() =>
      localStorage.setItem('accessToken', 'mock-token'),
    );
    let faculty = true,
      assigned = false,
      state = 'ASSIGNED',
      proposalStatus = 'SUBMITTED',
      proposalRevision = 0,
      reviewRevision = 0,
      decision = null,
      conflict = false,
      deny = false,
      assignments = 0;
    const comments = [];
    const content = {
      schemaVersion: 1,
      objectives: 'Mục tiêu demo',
      scope: 'Phạm vi demo',
      mainContents: 'Nội dung demo',
      tools: 'Công cụ demo',
      expectedResults: 'Kết quả demo',
      startsAt: '2026-01-01Z',
      endsAt: '2027-01-01Z',
      schedule: [],
    };
    const summary = () => ({
      id: 'p1',
      termId: 't1',
      title: 'Đề cương demo Step 5',
      studentName: 'Sinh viên demo',
      studentCode: 'SV01',
      departmentId: 'd1',
      departmentName: 'Công nghệ phần mềm',
      researchAreaName: 'Kỹ nghệ phần mềm',
      status: proposalStatus,
      revision: proposalRevision,
      submittedVersionId: 'v1',
      versionNumber: 1,
      activeReviewId: assigned ? 'r1' : null,
      groupName: assigned ? 'Nhóm demo' : null,
      readiness: [],
      canAssign: faculty,
    });
    const view = () => ({
      id: 'r1',
      proposalId: 'p1',
      termId: 't1',
      title: 'Đề cương demo Step 5',
      studentName: 'Sinh viên demo',
      studentCode: 'SV01',
      proposalStatus,
      proposalRevision,
      revision: reviewRevision,
      state,
      roundNumber: 1,
      groupId: 'g1',
      groupName: 'Nhóm demo',
      versionId: 'v1',
      versionNumber: 1,
      version: {
        content,
        contentHash: 'demo-hash',
        submittedAt: '2026-10-21T08:00:00Z',
        submittedByUserId: 'student',
      },
      assignedByUserId: 'faculty',
      assignedAt: '2026-10-21T09:00:00Z',
      startedByUserId: state === 'ASSIGNED' ? null : 'reviewer',
      startedAt: null,
      routingSnapshot: { departmentId: 'd1' },
      phaseSnapshot: {},
      supersededByReviewId: null,
      comments,
      decision,
      allowedActions: faculty
        ? state === 'DECIDED'
          ? []
          : ['assign']
        : state === 'ASSIGNED'
          ? ['start', 'comment']
          : state === 'IN_REVIEW'
            ? ['comment', 'decide']
            : [],
    });
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      const p = url.pathname.slice(4),
        method = route.request().method(),
        send = (data, status = 200) =>
          route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify(
              status < 300
                ? { success: true, data, timestamp: new Date().toISOString() }
                : {
                    success: false,
                    error: {
                      code: status === 409 ? 'REVISION_CONFLICT' : 'COMMON_001',
                      message: data,
                    },
                  },
            ),
          });
      if (deny) return send('Không tìm thấy hồ sơ trong phạm vi.', 404);
      if (p === '/proposal-review-options/terms')
        return send([
          { id: 't1', name: 'Đợt demo 2026', status: 'IN_PROGRESS' },
        ]);
      if (p === '/terms/t1/proposal-review-options')
        return send({
          term: { id: 't1', name: 'Đợt demo 2026', status: 'IN_PROGRESS' },
          departments: faculty
            ? [{ id: 'd1', name: 'Công nghệ phần mềm' }]
            : [],
          canAssign: faculty,
          phase: {
            startsAt: '2020-01-01Z',
            endsAt: '2099-01-01Z',
            isLocked: false,
          },
        });
      if (p === '/terms/t1/proposals') {
        const status = url.searchParams.get('status'),
          data = !status || status === proposalStatus ? [summary()] : [];
        return send({
          data,
          total: data.length,
          page: 1,
          limit: 20,
          totalPages: data.length ? 1 : 0,
        });
      }
      if (p === '/proposals/p1')
        return send({
          ...summary(),
          version: {
            id: 'v1',
            versionNumber: 1,
            content,
            contentHash: 'demo-hash',
            submittedAt: '2026-10-21T08:00:00Z',
          },
        });
      if (p === '/proposals/p1/review-candidates')
        return send([
          {
            id: 'g1',
            name: 'Nhóm demo',
            memberCount: 2,
            eligibleReviewerCount: 2,
            specialtyMatchCount: 1,
            activeReviewCount: 0,
            explanation: 'Chỉ tham khảo',
          },
        ]);
      if (p === '/proposals/p1/review-history')
        return send(assigned ? [view()] : []);
      if (p === '/proposal-reviews/r1' && method === 'GET') return send(view());
      const body = route.request().postDataJSON();
      assert(route.request().headers()['idempotency-key']);
      if (conflict) return send('Dữ liệu đã thay đổi. Hãy tải lại.', 409);
      if (p === '/proposals/p1/review-assignments') {
        assert.equal(body.groupId, 'g1');
        assert.equal(body.proposalVersionId, 'v1');
        assert.equal(body.expectedProposalRevision, proposalRevision);
        assignments++;
        assigned = true;
        proposalRevision++;
        return send(view(), 201);
      }
      assert.equal(body.expectedReviewRevision, reviewRevision);
      if (p === '/proposal-reviews/r1/start') {
        assert.equal(body.expectedProposalRevision, proposalRevision);
        state = 'IN_REVIEW';
        proposalStatus = 'UNDER_REVIEW';
        reviewRevision++;
        proposalRevision++;
        return send(view());
      }
      if (p === '/proposal-reviews/r1/comments') {
        assert.equal(body.versionId, 'v1');
        comments.push({
          id: 'c' + comments.length,
          versionId: 'v1',
          authorUserId: 'reviewer',
          authorName: 'Giảng viên demo',
          createdAt: new Date().toISOString(),
          text: body.text,
        });
        reviewRevision++;
        return send(view(), 201);
      }
      if (p === '/proposal-reviews/r1/decision') {
        assert.equal(body.expectedProposalRevision, proposalRevision);
        assert.equal(body.versionId, 'v1');
        if (body.decision === 'REVISION_REQUIRED') assert(body.comment);
        decision = {
          id: 'dec1',
          versionId: 'v1',
          decision: body.decision,
          comment: body.comment ?? null,
          decidedByUserId: 'reviewer',
          deciderName: 'Giảng viên demo',
          decidedAt: new Date().toISOString(),
        };
        state = 'DECIDED';
        proposalStatus =
          body.decision === 'APPROVED' ? 'APPROVED' : 'REVISION_REQUESTED';
        reviewRevision++;
        proposalRevision++;
        return send(view());
      }
      return send('Unexpected mock request', 404);
    });
    await page.goto(origin + '/topic/reviews');
    await expect(
      page.getByText('Đề cương demo Step 5', { exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Hồ sơ / phân công' }).click();
    await expect(page.getByLabel('Nhóm nhận đề cương')).toHaveValue('');
    assert.equal(assignments, 0);
    pass('faculty queue and specialty candidates never auto select/assign');
    await page
      .getByRole('button', { name: 'Xác nhận phân công', exact: true })
      .click();
    assert.equal(assignments, 0);
    await page.getByLabel('Nhóm nhận đề cương').selectOption('g1');
    await page
      .getByRole('button', { name: 'Xác nhận phân công', exact: true })
      .click();
    await expect(
      page.getByText('Đã xác nhận phân công nhóm duyệt.'),
    ).toBeVisible();
    assert.equal(assignments, 1);
    pass('explicit faculty selection confirms the assigned SEALED version');
    faculty = false;
    await page.goto(origin + '/topic/reviews/r1');
    await expect(
      page.getByRole('button', { name: 'Bắt đầu duyệt phiên bản 1' }),
    ).toBeVisible();
    await expect(page.getByText('Khoa điều chỉnh phân công →')).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Bắt đầu duyệt phiên bản 1' })
      .click();
    await expect(
      page.getByRole('button', { name: 'Xác nhận kết luận chung' }),
    ).toBeVisible();
    pass('reviewer start is explicit and faculty controls are absent');
    await page
      .getByLabel('Nội dung nhận xét')
      .fill('Nhận xét nhiều thành viên được giữ riêng');
    await page
      .getByRole('button', { name: 'Lưu nhận xét', exact: true })
      .click();
    await expect(
      page.getByText('Nhận xét nhiều thành viên được giữ riêng', {
        exact: true,
      }),
    ).toBeVisible();
    pass('member comment is separate from the common decision');
    await page.getByLabel('Kết quả chung').selectOption('REVISION_REQUIRED');
    await page.getByRole('button', { name: 'Xác nhận kết luận chung' }).click();
    assert.equal(decision, null);
    pass('revision-required cannot submit without comment');
    await page
      .getByLabel('Nhận xét kết luận')
      .fill('Bổ sung phạm vi nghiên cứu');
    conflict = true;
    await page.getByRole('button', { name: 'Xác nhận kết luận chung' }).click();
    await expect(page.getByRole('alert')).toContainText('Dữ liệu đã thay đổi');
    await expect(page.getByLabel('Nhận xét kết luận')).toHaveValue(
      'Bổ sung phạm vi nghiên cứu',
    );
    pass('409 conflict preserves the pending conclusion text');
    conflict = false;
    await page.getByRole('button', { name: 'Xác nhận kết luận chung' }).click();
    await expect(
      page.getByText('Đã lưu kết luận chung.', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Xác nhận kết luận chung' }),
    ).toHaveCount(0);
    assert.equal(decision.decision, 'REVISION_REQUIRED');
    pass('revision decision becomes immutable and removes mutation controls');
    state = 'IN_REVIEW';
    proposalStatus = 'UNDER_REVIEW';
    decision = null;
    await page.goto(origin + '/topic/reviews/r1');
    await page.getByRole('button', { name: 'Xác nhận kết luận chung' }).click();
    await expect(
      page.getByText('Đã lưu kết luận chung.', { exact: true }),
    ).toBeVisible();
    assert.equal(decision.decision, 'APPROVED');
    pass('approval follows the same single-decision UI flow');
    await page.setViewportSize({ width: 375, height: 812 });
    await expect
      .poll(async () => (await page.locator('.rg-sidebar').boundingBox()).x)
      .toBeLessThanOrEqual(-259);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    pass('mobile detail has no horizontal page overflow');
    deny = true;
    await page.goto(origin + '/topic/reviews/r1');
    await expect(page.getByRole('alert').first()).toContainText(
      'Không tìm thấy hồ sơ',
    );
    await expect(page.getByText('Mục tiêu demo', { exact: true })).toHaveCount(
      0,
    );
    pass('out-of-scope error renders without proposal content');
    fs.writeFileSync(
      path.resolve(root, '../backend/prisma/review/step5-browser-results.json'),
      JSON.stringify(
        {
          result: 'PASS',
          mockedApi: true,
          sharedDatabaseAccess: false,
          checks,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(`${checks.length} Step 5 browser checks passed`);
  } finally {
    if (browser) await browser.close();
    vite.kill();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
