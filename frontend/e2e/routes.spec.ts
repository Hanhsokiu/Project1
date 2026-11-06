import { test, expect, type Page } from '@playwright/test';
import { routeManifest } from '../src/app/router/route-manifest';
import { createSeed } from '../src/shared/data/seed';
import type { Role } from '../src/shared/data/types';

const roles: { role: Role; accountId: string }[] = [
  { role: 'ADMIN', accountId: 'admin' },
  { role: 'FACULTY', accountId: 'khoa' },
  { role: 'LECTURER', accountId: 'gv1' },
  { role: 'STUDENT', accountId: 'sv1' },
];
const viewports = [
  { label: 'desktop', width: 1440, height: 1000 },
  { label: 'mobile 375', width: 375, height: 812 },
];
const concretePath = (path: string) => path.replace(':id', 'dot1');

async function setDemo(page: Page, accountId?: string, requirePasswordChange = false) {
  const db = createSeed();
  const account = db.accounts.find(a => a.id === accountId);
  if (account) account.mustChangePassword = requirePasswordChange;
  await page.addInitScript(({ fixture, actorId }) => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('utc-thesis-demo-v1', JSON.stringify(fixture));
    sessionStorage.setItem('utc-workspace', JSON.stringify({ termId: 'dot1', studentId: 'sv1' }));
    if (actorId) sessionStorage.setItem('utc-thesis-session', actorId);
  }, { fixture: db, actorId: accountId });
}

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  return errors;
}

async function expectNoPageOverflow(page: Page, path: string) {
  const bounds = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(bounds.document, `Document overflow at ${path}: ${JSON.stringify(bounds)}`).toBeLessThanOrEqual(bounds.viewport + 1);
  expect(bounds.body, `Body overflow at ${path}: ${JSON.stringify(bounds)}`).toBeLessThanOrEqual(bounds.viewport + 1);
}

for (const viewport of viewports) {
  test.describe(viewport.label, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const { role, accountId } of roles) {
      const routes = routeManifest.filter(route => route.roles.includes(role));
      test(`${role}: all ${routes.length} permitted routes render without errors or overflow`, async ({ page }, testInfo) => {
        test.setTimeout(180_000);
        const browserErrors = collectBrowserErrors(page);
        await setDemo(page, accountId);
        const checked: { path: string; heading: string }[] = [];
        for (const route of routes) {
          const path = concretePath(route.path);
          await test.step(`${path} · ${route.title}`, async () => {
            const response = await page.goto(path);
            expect(response?.ok(), `HTTP response for ${path}`).toBeTruthy();
            await expect.poll(() => new URL(page.url()).pathname).toBe(path);
            await expect(page.locator('main h1').first()).toBeVisible({ timeout: 15_000 });
            await expect(page.getByRole('heading', { name: /Không thể mở trang|403 ·|404 ·/ })).toHaveCount(0);
            await expect(page.getByText('Trang đang sẵn sàng tích hợp logic nghiệp vụ.', { exact: true })).toHaveCount(0);
            await page.waitForLoadState('networkidle');
            await expectNoPageOverflow(page, path);
            const heading = (await page.locator('main h1').first().textContent()) || '';
            checked.push({ path, heading });
          });
        }
        await testInfo.attach(`routes-${role}-${viewport.label}.json`, { body: JSON.stringify(checked, null, 2), contentType: 'application/json' });
        expect(browserErrors, `Browser errors for ${role} on ${viewport.label}`).toEqual([]);
      });
    }

    test('unauthenticated protected route redirects to login and rejects invalid credentials', async ({ page }) => {
      const browserErrors = collectBrowserErrors(page);
      await setDemo(page);
      await page.goto('/terms');
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole('heading', { name: 'Chào mừng trở lại!' })).toBeVisible();
      await page.getByLabel('Tên đăng nhập / Mã định danh').fill('invalid-user');
      await page.getByLabel('Mật khẩu', { exact: false }).first().fill('Invalid@2026');
      await page.getByRole('button', { name: 'Đăng nhập hệ thống' }).click();
      await expect(page.getByText('Tên đăng nhập hoặc mật khẩu không đúng.', { exact: true })).toBeVisible();
      await expectNoPageOverflow(page, '/login');
      expect(browserErrors).toEqual([]);
    });

    test('a student receives 403 for administrative routes and 404 for an unknown path', async ({ page }) => {
      const browserErrors = collectBrowserErrors(page);
      await setDemo(page, 'sv1');
      await page.goto('/admin/accounts');
      await expect(page).toHaveURL(/\/forbidden$/);
      await expect(page.getByRole('heading', { name: '403 · Không đủ quyền' })).toBeVisible();
      await expectNoPageOverflow(page, '/forbidden');
      await page.goto('/route-does-not-exist');
      await expect(page.getByRole('heading', { name: '404 · Không tìm thấy trang' })).toBeVisible();
      await expectNoPageOverflow(page, '/route-does-not-exist');
      expect(browserErrors).toEqual([]);
    });
  });
}

test('first-login account must change its password before accessing registration', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await setDemo(page, 'sv1', true);
  await page.goto('/registration');
  await expect(page).toHaveURL(/\/change-password$/);
  await expect(page.locator('main h1').first()).toBeVisible();
  await expect(page.getByText('Bạn cần đổi mật khẩu mặc định trước khi sử dụng chức năng nghiệp vụ.', { exact: false })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('mobile menu opens, navigates and closes after navigation', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await setDemo(page, 'khoa');
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.getByRole('button', { name: 'Mở điều hướng' }).click();
  await expect(page.locator('aside.sidebar')).toHaveClass(/open/);
  await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Sinh viên', exact: true }).click();
  await expect(page).toHaveURL(/\/catalog\/students$/);
  await expect(page.locator('aside.sidebar')).not.toHaveClass(/open/);
  await expectNoPageOverflow(page, '/catalog/students');
});
