import { test, expect } from "./fixtures";

test("login renders with the Vietnamese document title", async ({ page }) => {
  const response = await page.goto("/login");
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle(/UTC GPMS/);
  await expect(
    page.getByRole("heading", { name: "Chào mừng trở lại!" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Đăng nhập hệ thống" }),
  ).toBeEnabled();
});
test("password visibility and help dialog work without an API", async ({
  page,
}) => {
  await page.goto("/login");
  const password = page.getByPlaceholder("Nhập mật khẩu");
  await expect(password).toHaveAttribute("type", "password");
  await page
    .getByRole("button", { name: "Hiện mật khẩu", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Quên mật khẩu?" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Đã hiểu", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("anonymous protected navigation redirects to login", async ({ page }) => {
  await page.goto("/grading/reviewer");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Chào mừng trở lại!" }),
  ).toBeVisible();
});
test("an unknown protected route still requires authentication", async ({
  page,
}) => {
  await page.goto("/browser-route-that-does-not-exist");
  await expect(
    page.getByRole("heading", { name: "Chào mừng trở lại!" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
test("test Vite server rejects unmocked API without forwarding to the backend", async ({
  request,
}) => {
  // APIRequestContext deliberately bypasses browser routing: verify server guard.
  const response = await request.get("/api/__browser_isolation_probe");
  expect(response.status()).toBe(503);
  expect((await response.json()).error.code).toBe("E2E_UNMOCKED_API");
});
