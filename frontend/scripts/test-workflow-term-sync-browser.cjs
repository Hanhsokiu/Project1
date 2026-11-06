'use strict';
const { openFilter } = require('./workflow-browser-session.cjs');
// Runs the actual UI against in-memory API fixtures; never connects to a database.
const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const path = require('node:path');

async function main() {
  const root = path.resolve(__dirname, '..');
  process.chdir(root);
  Object.assign(process.env, {
    VITE_API_URL: '/api',
    VITE_AUTH_API: 'true',
    VITE_TERM_API: 'true',
    VITE_CATALOG_API: 'false',
    VITE_IMPORT_API: 'false',
    VITE_REGISTRATION_API: 'false',
  });
  const { createServer } = await import('vite');
  const server = await createServer({
    root,
    server: { host: '127.0.0.1', port: 50186, strictPort: true },
  });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [],
      unexpected = [],
      listRequests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const user = {
      id: 'faculty',
      username: 'faculty',
      name: 'Giáo vụ Khoa',
      email: '',
      phone: '',
      roles: ['FACULTY'],
      permissions: [
        'proposal:read',
        'proposal:assign',
        'review-group:read',
        'review-group:manage',
        'guidance:read',
        'guidance:monitor',
      ],
      locked: false,
      mustChangePassword: false,
    };
    let actor = user;
    await page.addInitScript((user) => {
      if (!sessionStorage.getItem('utc-api-user')) {
        sessionStorage.setItem('utc-api-user', JSON.stringify(user));
        sessionStorage.setItem('utc-api-access', 'mock-token');
        sessionStorage.setItem(
          'utc-workspace',
          JSON.stringify({ termId: 'old' }),
        );
      }
    }, user);
    const term = (id, name) => ({
      id,
      name,
      code: id.toUpperCase(),
      status: 'DRAFT',
      semester: '2026-2027 / Học kỳ 1',
      program: 'Chính quy',
      start: '2026-10-01',
      end: '2027-03-01',
      registrationStart: '2026-10-01T08:00:00+07:00',
      registrationEnd: '2026-10-15T17:00:00+07:00',
      locked: false,
      studentIds: [],
      lecturers: [],
      phases: [],
      parameters: { passing_gpa_threshold: 2 },
      assignmentPublished: false,
      resultsPublished: false,
    });
    const rows = [term('old', 'Đợt cũ')];
    let creates = 0,
      delayTermResponse = false;
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://127.0.0.1:50186') return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      const request = route.request(),
        p = url.pathname.slice(4);
      const send = (data) =>
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data }),
        });
      if (p === '/auth/me') return send(actor);
      if (p === '/terms' && request.method() === 'POST') {
        creates++;
        const body = request.postDataJSON();
        rows.push({ ...term('new', body.name), code: body.code });
        return send(rows.at(-1));
      }
      if (p === '/terms') return send({ items: rows, total: rows.length });
      if (p === '/semesters')
        return send([
          {
            id: 'semester',
            name: '2026-2027 / Học kỳ 1',
            academicYear: '2026-2027',
            semester: 1,
          },
        ]);
      if (p === '/training-systems')
        return send([{ id: 'program', name: 'Chính quy', code: 'CQ' }]);
      if (p === '/notifications/me') return send([]);
      if (['/students', '/lecturers', '/registrations'].includes(p))
        return send({ items: [], total: 0 });
      if (['/departments', '/research-areas'].includes(p) || p.startsWith('/notifications/outbox/term/')) return send([]);
      if (/^\/assignments\/term\/[^/]+\/(plan|results)$/.test(p)) return send({ plan: null, assignments: [] });
      if (p === '/weekly-plans/options') return send(rows.map((r) => ({ ...r, canManage: true })));
      if (p === '/tasks/direct') return send({ id: 'direct', termId: 'new', planId: 'plan', proposalId: 'proposal', title: 'Nhiệm vụ thuộc đợt mới', status: 'TODO', dueDate: '2027-03-01T00:00:00Z', allowedActions: [], progress: [], history: [], isOverdue: false, hasSubmissions: false });
      const weekly = /^\/terms\/([^/]+)\/(weekly-plans|weekly-progress)$/.exec(p);
      if (weekly) {
        listRequests.push({ termId: weekly[1], kind: weekly[2] });
        return send(weekly[2] === 'weekly-plans' ? [] : { data: [], total: 0, page: 1, totalPages: 0, metrics: { NOT_SUBMITTED: 0, PENDING: 0, PASS: 0, FAIL: 0, REVISION_REQUIRED: 0, LATE: 0 } });
      }
      if (
        [
          '/proposal-review-options/terms',
          '/review-group-options/terms',
        ].includes(p)
      ) {
        if (delayTermResponse)
          await new Promise((resolve) => setTimeout(resolve, 250));
        // Keep the old term first so a default-to-first regression is observable.
        return send(rows.map(({ id, name, status, code, program }) => ({ id, name, status, code, trainingSystem: { name: program } })));
      }
      const options =
        /^\/terms\/([^/]+)\/(proposal-review-options|review-group-options)$/.exec(
          p,
        );
      if (options)
        return send({
          term: rows.find((row) => row.id === options[1]),
          departments: [],
          phase: null,
          canAssign: true,
          canManage: true,
          lecturers: { data: [], total: 0, page: 1, limit: 20, totalPages: 0 },
        });
      if (/^\/terms\/[^/]+\/guidance-periods$/.test(p)) return send([]);
      if (/^\/terms\/[^/]+\/weekly-report-coverage$/.test(p)) return send({ coverageState: 'READY', data: [], total: 0, page: 1, totalPages: 0 });
      const list = /^\/terms\/([^/]+)\/(proposals|review-groups|guidance-tasks)$/.exec(p);
      if (list) {
        listRequests.push({ termId: list[1], kind: list[2] });
        return send({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
      }
      unexpected.push(p);
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: 'Unexpected mocked route' },
        }),
      });
    });
    const origin = 'http://127.0.0.1:50186';
    const openTerms = async () => {
      const group = page.getByRole('button', { name: 'Danh mục & kế hoạch', exact: true });
      if (await group.getAttribute('aria-expanded') !== 'true') await group.click();
      await page.getByRole('link', { name: 'Kỳ học & đợt đồ án', exact: true }).click();
    };
    await page.goto(origin + '/topic/reviews');
    await expect(page.getByLabel('Đợt xét duyệt')).toHaveValue('old');
    // Warm the shared proposal list cache before creating a new term.
    await openTerms();
    await expect(
      page.getByRole('heading', { name: 'Kỳ học & đợt đồ án', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Tạo đợt mới' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Mã đợt', { exact: true }).fill('DATN-NEW');
    await dialog
      .getByLabel('Tên đợt', { exact: true })
      .fill('Đợt Khoa vừa tạo');
    await dialog.getByRole('button', { name: 'Lưu đợt đồ án' }).click();
    await expect(page).toHaveURL(/\/terms\/new$/);
    assert.equal(creates, 1);
    await expect(page.getByLabel('Đợt làm việc')).toHaveValue('new');
    console.log('PASS Create term through faculty UI and select it');
    const selectWorkflow = async (name, label) => {
      const group = page.getByRole('button', {
        name: 'Đề cương & xét duyệt',
        exact: true,
      });
      if ((await group.getAttribute('aria-expanded')) !== 'true')
        await group.click();
      await page.getByRole('link', { name, exact: true }).click();
      await expect(page.getByLabel(label, { exact: true })).toHaveValue('new');
      await expect(
        page.getByLabel(label, { exact: true }).locator('option[value="new"]'),
      ).toHaveText('DATN-NEW · Đợt Khoa vừa tạo · Chính quy');
      await expect(page.getByLabel('Đợt làm việc')).toHaveValue('new');
    };
    await selectWorkflow('Phân công & xét duyệt', 'Đợt xét duyệt');
    await selectWorkflow('Tra cứu đề cương', 'Đợt đề cương');
    await selectWorkflow('Chốt hồ sơ & nhận bản giấy', 'Đợt hồ sơ');
    await selectWorkflow('Nhóm duyệt đề cương', 'Đợt đồ án');
    console.log(
      'PASS New term appears and remains selected across all proposal/review pages',
    );
    await page.getByLabel('Đợt làm việc').selectOption('old');
    await expect(page.getByLabel('Đợt đồ án', { exact: true })).toHaveValue(
      'old',
    );
    await openFilter(page, 'Đợt đồ án');
    await page.getByLabel('Đợt đồ án', { exact: true }).selectOption('new');
    await expect(page.getByLabel('Đợt làm việc')).toHaveValue('new');
    console.log('PASS Header and page term selectors stay synchronized');
    await page.goto(origin + '/guidance/weeks?termId=new');
    await expect(page.getByLabel('Đợt làm việc')).toHaveValue('new');
    await expect(page.getByLabel('Đợt đồ án', { exact: true })).toHaveValue('new');
    const headerLabel = await page.getByLabel('Đợt làm việc').locator('option:checked').textContent();
    await expect(page.getByLabel('Đợt đồ án', { exact: true }).locator('option:checked')).toHaveText(headerLabel);
    await page.getByLabel('Đợt làm việc').selectOption('old');
    await expect(page.getByLabel('Đợt đồ án', { exact: true })).toHaveValue('old');
    await page.getByLabel('Đợt đồ án', { exact: true }).selectOption('new');
    await expect(page.getByLabel('Đợt làm việc')).toHaveValue('new');
    await page.reload();
    await expect(page.getByLabel('Đợt làm việc')).toHaveValue('new');
    await expect(page.getByLabel('Đợt đồ án', { exact: true })).toHaveValue('new');
    assert(listRequests.some((r) => r.kind === 'weekly-progress' && r.termId === 'old'));
    assert(listRequests.some((r) => r.kind === 'weekly-progress' && r.termId === 'new'));
    console.log('PASS Weekly header, page, API requests and reload share the selected term');
    // Re-enter with no term URL and a stale cache; wait for the fresh scope list.
    delayTermResponse = true;
    await openTerms();
    rows.push(term('later', 'Đợt vừa cập nhật ở tab khác'));
    await page.evaluate(async () => {
      const { router } = await import('/src/app/router/routes.tsx');
      const { setWorkspaceSelection } = await import('/src/shared/data/store.ts');
      setWorkspaceSelection({ termId: 'later' });
      await router.navigate('/topic/proposal?search=giu-bo-loc');
    });
    await expect(page.getByLabel('Đợt đề cương')).toHaveValue('later');
    await expect(page.getByLabel('Đợt làm việc')).toHaveValue('later');
    await expect(page).toHaveURL(/search=giu-bo-loc/);
    // Compare the same term identity in the ordinary dashboard and workflow shell.
    await page.goto(origin + '/?termId=new');
    await expect(page.getByLabel('Đợt làm việc').locator('option:checked')).toHaveText('DATN-NEW · Đợt Khoa vừa tạo · Chính quy');
    actor = { ...user, id: 'lecturer', roles: ['LECTURER'], lecturerId: 'lecturer-profile', permissions: ['proposal:read', 'guidance:read', 'task:review', 'submission:read'] };
    await page.evaluate(async (actor) => {
      const { setApiUser, setTokens } = await import('/src/shared/api/api-session.ts');
      setTokens('lecturer-token');
      setApiUser(actor);
    }, actor);
    await page.goto(origin + '/guidance/weeks?termId=new');
    await expect(page.getByLabel('Đợt làm việc')).toHaveValue('new');
    await expect(page.getByLabel('Đợt làm việc').locator('option:checked')).toHaveText('DATN-NEW · Đợt Khoa vừa tạo · Chính quy');
    await expect(page.getByLabel('Đợt đồ án', { exact: true })).toHaveValue('new');
    console.log('PASS Dashboard and lecturer workflow use the same term identity after account switch');
    await page.evaluate(async () => {
      const { setWorkspaceSelection } = await import('/src/shared/data/store.ts');
      setWorkspaceSelection({ termId: 'old' });
    });
    await page.goto(origin + '/guidance/tasks/direct');
    await expect(page.getByRole('heading', { name: 'Nhiệm vụ thuộc đợt mới' })).toBeVisible();
    await expect(page.getByLabel('Đợt làm việc')).toHaveValue('new');
    await expect(page).toHaveURL(/termId=new/);
    await page.getByLabel('Đợt làm việc').selectOption('old');
    await expect(page).toHaveURL(/\/guidance\/tasks\?termId=old/);
    console.log('PASS Direct task link restores its actual term; switching term leaves the old task detail');
    assert(
      listRequests.some(
        (request) => request.termId === 'new' && request.kind === 'proposals',
      ),
    );
    assert(
      listRequests.some(
        (request) =>
          request.termId === 'new' && request.kind === 'review-groups',
      ),
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpected, []);
    console.log(
      'PASS Missing term URL uses the saved term and preserves search; no browser errors',
    );
  } finally {
    await browser?.close();
    await server.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
