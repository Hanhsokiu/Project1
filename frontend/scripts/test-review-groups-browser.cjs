'use strict';
// Browser UI smoke with fully mocked API. Never starts/connects a backend/DB.
const { spawn } = require('node:child_process'),
  path = require('node:path'),
  fs = require('node:fs'),
  assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
async function main() {
  const interactive = process.argv.includes('--interactive');
  const selfTest = process.argv.includes('--self-test');
  const screenshot = process.argv.includes('--screenshot');
  const root = path.resolve(__dirname, '..'),
    origin = 'http://127.0.0.1:50173';
  const vite = spawn(
    process.execPath,
    [
      path.join(
        path.dirname(require.resolve('vite/package.json')),
        'bin/vite.js',
      ),
      '--host',
      '127.0.0.1',
      '--port',
      '50173',
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
  const checks = [];
  const pass = (name) => {
    checks.push({ name, result: 'PASS' });
    console.log('PASS ' + name);
  };
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        const r = await fetch(origin);
        if (r.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(ready, 'Vite did not start');
    browser = await chromium.launch({
      channel: 'msedge',
      headless: !interactive || selfTest,
    });
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    await page.addInitScript(() =>
      localStorage.setItem('accessToken', 'mock-browser-token'),
    );
    let group = null,
      canManage = true,
      conflict = false,
      deny = false,
      creates = 0;
    const requests = [];
    const groups = new Map();
    const lecturers = [
      {
        id: 'a',
        fullName: 'Nguyễn An',
        lecturerCode: 'GV01',
        departmentId: 'd1',
      },
      {
        id: 'b',
        fullName: 'Trần Bình',
        lecturerCode: 'GV02',
        departmentId: 'd1',
      },
    ];
    await page.route('**/*', async (route) => {
      const u = new URL(route.request().url());
      if (u.origin !== origin) return route.abort();
      if (!u.pathname.startsWith('/api/')) return route.continue();
      const req = route.request(),
        method = req.method(),
        p = u.pathname.slice(4);
      requests.push({ method, path: p });
      const send = (data, status = 200) =>
        route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(
            status < 300
              ? { success: true, data, timestamp: new Date().toISOString() }
              : {
                  success: false,
                  error: { code: 'TEST_ERROR', message: data },
                },
          ),
        });
      const view = (value = group) => ({ ...value, canManage });
      if (deny) return send('Không tìm thấy nhóm trong phạm vi.', 404);
      if (p === '/review-group-options/terms')
        return send([{ id: 't1', name: 'Đợt đồ án 2026', status: 'DRAFT' }]);
      if (p === '/terms/t1/review-group-options') {
        const search = u.searchParams.get('search') || '';
        const list = lecturers.filter(
          (l) =>
            !search || l.fullName.toLowerCase().includes(search.toLowerCase()),
        );
        return send({
          term: { id: 't1', name: 'Đợt đồ án 2026', status: 'DRAFT' },
          canManage,
          departments: [{ id: 'd1', name: 'Công nghệ phần mềm' }],
          lecturers: {
            data: list,
            total: list.length,
            page: 1,
            limit: 20,
            totalPages: 1,
          },
        });
      }
      if (p === '/terms/t1/review-groups' && method === 'GET') {
        const search = (u.searchParams.get('search') || '').toLowerCase();
        const list = [...groups.values()].filter((g) =>
          g.name.toLowerCase().includes(search),
        );
        const pageNumber = Number(u.searchParams.get('page') || 1);
        const limit = Number(u.searchParams.get('limit') || 20);
        return send({
          data: list
            .slice((pageNumber - 1) * limit, pageNumber * limit)
            .map(view),
          total: list.length,
          page: pageNumber,
          limit,
          totalPages: Math.ceil(list.length / limit),
        });
      }
      if (p === '/terms/t1/review-groups' && method === 'POST') {
        const body = req.postDataJSON();
        assert(req.headers()['idempotency-key']);
        creates++;
        group = {
          id: 'g' + creates,
          termId: 't1',
          departmentId: 'd1',
          departmentName: 'Công nghệ phần mềm',
          name: body.name,
          revision: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          activeReviewCount: 0,
          members: lecturers
            .filter((l) => body.memberLecturerIds.includes(l.id))
            .map((l) => ({
              lecturerId: l.id,
              fullName: l.fullName,
              lecturerCode: l.lecturerCode,
              role: 'MEMBER',
            })),
        };
        groups.set(group.id, group);
        return send(view(), 201);
      }
      const groupMatch = /^\/review-groups\/([^/]+)$/.exec(p);
      if (groupMatch) group = groups.get(groupMatch[1]) || null;
      if (groupMatch && method === 'GET')
        return group ? send(view()) : send('Không tìm thấy nhóm.', 404);
      if (groupMatch && method === 'PATCH') {
        if (!group) return send('Không tìm thấy nhóm.', 404);
        if (conflict) return send('Dữ liệu đã thay đổi. Hãy tải lại.', 409);
        const body = req.postDataJSON();
        assert.equal(body.expectedRevision, group.revision);
        assert(body.reason);
        assert(req.headers()['idempotency-key']);
        group = {
          ...group,
          name: body.name,
          revision: group.revision + 1,
          members: lecturers
            .filter((l) => body.memberLecturerIds.includes(l.id))
            .map((l) => ({
              lecturerId: l.id,
              fullName: l.fullName,
              lecturerCode: l.lecturerCode,
              role: 'MEMBER',
            })),
        };
        groups.set(group.id, group);
        return send(view());
      }
      if (groupMatch && method === 'DELETE') {
        if (!group) return send('Không tìm thấy nhóm.', 404);
        const result = view();
        assert(req.postDataJSON().reason);
        groups.delete(group.id);
        group = null;
        return send(result);
      }
      return send('Unexpected mocked API request', 403);
    });
    if ((interactive && !selfTest) || screenshot) {
      for (const [index, name] of [
        'Nhóm demo — Công nghệ phần mềm',
        'Nhóm demo — Hệ thống thông tin',
      ].entries()) {
        const id = 'g' + (index + 1);
        groups.set(id, {
          id,
          termId: 't1',
          departmentId: 'd1',
          departmentName: 'Công nghệ phần mềm',
          name,
          revision: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          activeReviewCount: 0,
          members: lecturers
            .slice(0, index + 1)
            .map((l) => ({
              lecturerId: l.id,
              fullName: l.fullName,
              lecturerCode: l.lecturerCode,
              role: 'MEMBER',
            })),
        });
      }
      creates = groups.size;
    }
    if (screenshot) {
      const directory = path.join(
        require('node:os').tmpdir(),
        'btl-step4-template',
      );
      fs.mkdirSync(directory, { recursive: true });
      await page.goto(origin + '/topic/review-groups');
      await expect(
        page.getByRole('link', {
          name: 'Nhóm demo — Công nghệ phần mềm',
          exact: true,
        }),
      ).toBeVisible();
      await page.screenshot({
        path: path.join(directory, 'step4-desktop.png'),
        fullPage: true,
      });
      await page.setViewportSize({ width: 375, height: 812 });
      await expect
        .poll(async () => (await page.locator('.rg-sidebar').boundingBox()).x)
        .toBeLessThanOrEqual(-259);
      await page.screenshot({
        path: path.join(directory, 'step4-mobile.png'),
        fullPage: true,
      });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      );
      await page.getByRole('button', { name: 'Mở điều hướng' }).click();
      await expect(
        page.getByRole('button', { name: 'Đóng menu', exact: true }),
      ).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Escape');
      await expect(
        page.getByRole('button', { name: 'Mở điều hướng' }),
      ).toHaveAttribute('aria-expanded', 'false');
      console.log('Screenshots: ' + directory);
      return;
    }
    if (interactive && !selfTest) {
      process.once('SIGINT', () => browser.close());
      process.once('SIGTERM', () => browser.close());
      await page.goto(origin + '/topic/review-groups');
      console.log(
        'Da mo giao dien Step 4 trong Edge. Du lieu DEMO, khong dung database.',
      );
      console.log(
        'Chon dot, tao nhom, chon thanh vien, sua/xoa nhom. Du lieu mat khi dong preview.',
      );
      console.log(
        'Dung cua so Edge vua mo (API mock chi ap dung o cua so nay). Dong cua so hoac Ctrl+C de dung.',
      );
      await new Promise((resolve) => {
        page.once('close', resolve);
        browser.once('disconnected', resolve);
      });
      return;
    }
    await page.goto(origin + '/topic/review-groups');
    await expect(
      page.getByText('Chưa có nhóm duyệt', { exact: true }),
    ).toBeVisible();
    pass('empty list and scoped term selector');
    await page.getByRole('link', { name: '+ Tạo nhóm', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Tạo nhóm duyệt', exact: true }),
    ).toBeVisible();
    await page.goto(origin + '/topic/review-groups/new');
    await page.getByLabel('Đợt tạo nhóm', { exact: true }).selectOption('t1');
    await expect(page.getByLabel('Tên nhóm', { exact: true })).toBeVisible();
    pass('create page allows an explicit scoped term selection');
    await page
      .getByRole('button', { name: 'Tạo nhóm duyệt', exact: true })
      .click();
    assert.equal(creates, 0);
    pass('required form fields prevent submission');
    await page.getByLabel('Tên nhóm', { exact: true }).fill('Nhóm duyệt A');
    await page.getByLabel('Bộ môn', { exact: true }).selectOption('d1');
    await page.getByRole('checkbox').first().check();
    await page
      .getByRole('button', { name: 'Tạo nhóm duyệt', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Nhóm duyệt A', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Đã lưu nhóm duyệt thành công.')).toBeVisible();
    assert.equal(group.members.length, 1);
    pass('create group with selected member and success feedback');
    await page
      .getByRole('link', { name: 'Chỉnh sửa nhóm', exact: true })
      .click();
    await page.getByLabel('Tìm giảng viên', { exact: true }).fill('Bình');
    await expect(page.getByRole('checkbox')).toHaveCount(1);
    await page.getByRole('checkbox').check();
    await page
      .getByLabel('Lý do thay đổi', { exact: true })
      .fill('Bổ sung thành viên');
    await page
      .getByRole('button', { name: 'Lưu thay đổi', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Nhóm duyệt A', exact: true }),
    ).toBeVisible();
    assert.equal(group.members.length, 2);
    pass('search does not discard previously selected members');
    await page
      .getByRole('link', { name: 'Chỉnh sửa nhóm', exact: true })
      .click();
    await page.getByLabel('Tên nhóm', { exact: true }).fill('Tên đang sửa');
    await page.getByLabel('Lý do thay đổi', { exact: true }).fill('Đổi tên');
    conflict = true;
    await page
      .getByRole('button', { name: 'Lưu thay đổi', exact: true })
      .click();
    await expect(page.getByRole('alert')).toContainText('Dữ liệu đã thay đổi');
    await expect(page.getByLabel('Tên nhóm', { exact: true })).toHaveValue(
      'Tên đang sửa',
    );
    pass('revision conflict is visible and preserves user input');
    conflict = false;
    canManage = false;
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(origin + '/topic/review-groups/g1');
    await expect(
      page.getByRole('heading', { name: 'Nhóm duyệt A', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Chỉnh sửa nhóm', exact: true }),
    ).toHaveCount(0);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    pass(
      'lecturer read-only detail and mobile viewport have no horizontal page overflow',
    );
    canManage = true;
    await page.reload();
    await page.getByRole('button', { name: 'Xóa nhóm', exact: true }).click();
    await page.getByLabel('Lý do xóa', { exact: true }).fill('Không sử dụng');
    await page
      .getByRole('button', { name: 'Xác nhận xóa', exact: true })
      .click();
    await expect(
      page.getByText('Chưa có nhóm duyệt', { exact: true }),
    ).toBeVisible();
    pass('archive confirmation requires reason and returns to list');
    deny = true;
    await page.goto(origin + '/topic/review-groups/g1');
    await expect(page.getByRole('alert')).toContainText(
      'Không tìm thấy nhóm trong phạm vi',
    );
    pass('scope error renders without exposing group data');
    fs.writeFileSync(
      path.join(root, '../backend/prisma/review/step4-browser-results.json'),
      JSON.stringify(
        {
          result: 'PASS',
          browser: 'installed Microsoft Edge via Playwright',
          mockedAPI: true,
          checks,
          apiRequests: requests.length,
          sharedDatabaseDDL: false,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(checks.length + ' browser smoke checks passed');
  } finally {
    if (browser) await browser.close();
    vite.kill();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
