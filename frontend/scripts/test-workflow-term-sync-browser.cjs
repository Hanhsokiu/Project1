'use strict';
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
      ],
      locked: false,
      mustChangePassword: false,
    };
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
      if (p === '/auth/me') return send(user);
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
      if (
        [
          '/proposal-review-options/terms',
          '/review-group-options/terms',
        ].includes(p)
      ) {
        if (delayTermResponse)
          await new Promise((resolve) => setTimeout(resolve, 250));
        // Keep the old term first so a default-to-first regression is observable.
        return send(rows.map(({ id, name, status }) => ({ id, name, status })));
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
      const list = /^\/terms\/([^/]+)\/(proposals|review-groups)$/.exec(p);
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
      ).toHaveText('Đợt Khoa vừa tạo');
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
    await page.getByLabel('Đợt đồ án', { exact: true }).selectOption('new');
    await expect(page.getByLabel('Đợt làm việc')).toHaveValue('new');
    console.log('PASS Header and page term selectors stay synchronized');
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
