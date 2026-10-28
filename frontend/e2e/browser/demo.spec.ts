import { test, expect, signInFixture } from "./fixtures";

test("authenticated demo user sees404 and a recovery link for unknown routes", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Quản trị viên", exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/browser-route-that-does-not-exist");
  await expect(
    page.getByRole("heading", { name: "404 · Không tìm thấy trang" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Về tổng quan" }),
  ).toHaveAttribute("href", "/");
});

test("demo login uses only ephemeral browser data, never an API", async ({
  page,
  network,
}) => {
  await page.goto("/login");
  await expect(
    page.getByText("KHÔNG GIAN DEMO · BƯỚC 1–3", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Quản trị viên", exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("main h1").first()).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("utc-thesis-session")),
  ).toBe("admin");
  expect(
    await page.evaluate(() => sessionStorage.getItem("utc-api-access")),
  ).toBe(null);
  expect(network.requests).toEqual([]);
});
test("demo invalid credentials are validated locally", async ({
  page,
  network,
}) => {
  await page.goto("/login");
  await page
    .getByPlaceholder("Ví dụ: 221230001 hoặc gv001")
    .fill("browser-nonexistent-account");
  await page.getByPlaceholder("Nhập mật khẩu").fill("test-only");
  await page.getByRole("button", { name: "Đăng nhập hệ thống" }).click();
  await expect(
    page.getByText("Tên đăng nhập hoặc mật khẩu không đúng.", { exact: true }),
  ).toBeVisible();
  expect(network.requests).toEqual([]);
});
test("an API session alone does not authenticate demo mode", async ({
  page,
  network,
}) => {
  await signInFixture(page);
  await page.goto("/terms");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("button", { name: "Quản trị viên", exact: true }),
  ).toBeVisible();
  expect(network.requests).toEqual([]);
});
test("mobile demo navigation opens and follows a permitted route", async ({
  page,
  network,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Quản trị viên", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mở điều hướng", exact: true })
    .click();
  await expect(page.locator("aside.sidebar")).toHaveClass(/open/);
  await page
    .getByRole("navigation", { name: "Điều hướng chính" })
    .getByRole("link", { name: "Sinh viên", exact: true })
    .click();
  await expect(page).toHaveURL(/\/catalog\/students$/);
  await expect(page.locator("aside.sidebar")).not.toHaveClass(/open/);
  await expect(page.locator("main h1").first()).toBeVisible();
  expect(network.requests).toEqual([]);
});
