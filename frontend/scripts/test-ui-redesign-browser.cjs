"use strict";
// UI fixtures exist only in isolated browser contexts; no backend or database is used.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

async function main() {
  const root = path.resolve(__dirname, "..");
  const output = path.resolve(root, "../.cache/ui-modern-20261104/browser");
  fs.mkdirSync(output, { recursive: true });
  process.chdir(root);
  Object.assign(process.env, {
    VITE_API_URL: "/api", VITE_AUTH_API: "false", VITE_TERM_API: "false",
    VITE_CATALOG_API: "false", VITE_IMPORT_API: "false", VITE_REGISTRATION_API: "false", VITE_DEMO_MODE: "false",
  });
  const { createServer } = await import("vite");
  const server = await createServer({ root, mode: "test", server: { host: "127.0.0.1", port: 50188, strictPort: true } });
  const checks = [], errors = [], network = [];
  const pass = name => { checks.push(name); console.log("PASS " + name); };
  let browser, activePage;
  try {
    await server.listen();
    const { createSeed } = await server.ssrLoadModule("/src/shared/data/seed.ts");
    const db = createSeed(true);
    db.accounts.forEach(account => { account.mustChangePassword = false; });
    if (!db.accounts.some(account => account.roles.includes("COMMITTEE"))) db.accounts.push({
      ...db.accounts.find(account => account.roles.includes("LECTURER")),
      id: "committee-ui-check", username: "committee-ui-check", roles: ["COMMITTEE"],
    });
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const origin = "http://127.0.0.1:50188";
    async function contextFor(role) {
      const actor = db.accounts.find(account => account.roles.includes(role));
      assert(actor, "Missing UI fixture for " + role);
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
      await context.addInitScript(({ data, id }) => {
        localStorage.setItem("utc-thesis-demo-v1", JSON.stringify(data));
        sessionStorage.setItem("utc-thesis-session", id);
        sessionStorage.setItem("utc-workspace", JSON.stringify({ termId: data.terms[0].id }));
      }, { data: db, id: actor.id });
      await context.route(origin + "/api/**", route => { network.push(route.request().url()); return route.abort(); });
      const page = await context.newPage();
      page.on("pageerror", error => { errors.push(error.message); console.error("PAGE ERROR " + error.message); });
      return { context, page, actor };
    }
    const { context: adminContext, page } = await contextFor("ADMIN");
    activePage = page;
    await page.goto(origin + "/admin/accounts");
    await expect(page.getByRole("heading", { name: "Tài khoản người dùng", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Thu gọn thanh điều hướng", exact: true }).click();
    await expect(page.locator(".sidebar")).toHaveCSS("width", "72px");
    await page.reload();
    await expect(page.locator(".sidebar")).toHaveCSS("width", "72px");
    await page.getByRole("button", { name: "Mở rộng thanh điều hướng", exact: true }).click();
    pass("desktop sidebar collapses, preserves preference and expands");
    await expect(page.getByRole("navigation", { name: "Đường dẫn trang" })).toContainText("Tài khoản");
    pass("compact header renders breadcrumb and account controls");
    const more = page.getByRole("button", { name: /^Thao tác cho/ }).nth(1);
    await more.focus(); await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menu")).toBeVisible();
    await expect(page.getByRole("menuitem").first()).toBeFocused();
    await page.keyboard.press("End"); await expect(page.getByRole("menuitem").last()).toBeFocused();
    await page.keyboard.press("Escape"); await expect(more).toBeFocused();
    await more.click(); await page.getByRole("menuitem", { name: /Đặt lại mật khẩu/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Hủy", exact: true }).click();
    pass("row menu supports arrows, End, Escape and opens existing confirmation");
    await page.getByRole("button", { name: "Thêm tài khoản", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveClass(/modal-wide/);
    const cancel = page.getByRole("dialog").getByRole("button", { name: "Hủy", exact: true });
    const save = page.getByRole("dialog").getByRole("button", { name: "Lưu tài khoản", exact: true });
    assert((await cancel.boundingBox()).x < (await save.boundingBox()).x);
    await cancel.click();
    pass("complex account form uses a drawer with Cancel before Save");
    await page.getByLabel("Tìm kiếm", { exact: true }).fill("no-matching-account-ui-check");
    await expect(page.getByText("Không tìm thấy kết quả", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Xóa tìm kiếm", exact: true }).first().click();
    await page.getByLabel("Mở bộ lọc").click();
    await page.getByLabel("Lọc vai trò", { exact: true }).selectOption("LECTURER");
    await expect(page.getByLabel("Mở bộ lọc")).toContainText("1");
    await page.getByLabel("Lọc vai trò", { exact: true }).selectOption("");
    await page.getByRole("button", { name: "Đóng bộ lọc", exact: true }).click();
    await page.getByLabel("Sắp xếp danh sách").selectOption("person:desc");
    await page.getByRole("checkbox", { name: /^Chọn dòng/ }).first().check();
    await expect(page.getByRole("region", { name: "Thao tác với dòng đã chọn" })).toContainText("Đã chọn 1");
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Xuất 1 tài khoản", exact: true }).click();
    const download = await downloading;
    assert(download.suggestedFilename().endsWith(".xlsx"));
    await download.saveAs(path.join(output, "selected-accounts.xlsx"));
    pass("search, empty state, advanced filters, sorting, selection and Excel export work");
    const accessibility = await new AxeBuilder({ page }).analyze();
    fs.writeFileSync(path.join(output, "accessibility.json"), JSON.stringify(accessibility.violations, null, 2));
    assert.deepEqual(accessibility.violations.map(violation => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map(node => node.target) })), []);
    pass("account page passes automated accessibility checks");
    if (process.argv.includes("--accessibility-only")) return;
    const termId = db.terms[0].id;
    const routes = ["/", "/admin/accounts", "/admin/roles", "/admin/audit-logs", "/catalog/students", "/catalog/lecturers", "/catalog/import", "/catalog/reference", "/terms", `/terms/${termId}`, `/terms/${termId}/roster`, `/terms/${termId}/phases`, `/terms/${termId}/parameters`, "/registration/list", "/registration/assignment", "/registration/manual", "/registration/result", "/topic/my", "/topic/overview", "/report/export", "/profile", "/notifications"];
    for (const width of [1440, 834, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of routes) {
        await page.goto(origin + route);
        await expect(page.locator("main")).toBeVisible();
        await expect(page.locator("main").getByRole("heading", { level: 1 }).first()).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        if (overflow) {
          await page.screenshot({ path: path.join(output, `overflow-${width}-${route.replace(/\W/g, "-")}.png`), fullPage: true });
          throw Error(`Horizontal page overflow at ${width}px: ${route}`);
        }
      }
      await page.goto(origin + "/admin/accounts");
      await page.screenshot({ path: path.join(output, `admin-accounts-${width}.png`), fullPage: true });
      pass(`22 existing screens render without page overflow at ${width}px`);
    }
    await page.getByRole("button", { name: "Mở điều hướng", exact: true }).click();
    await expect(page.locator(".sidebar.open")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Mở điều hướng", exact: true })).toBeFocused();
    pass("mobile navigation opens and Escape restores focus");
    await page.getByRole("button", { name: "Thêm tài khoản", exact: true }).click();
    const mobileDialog = page.getByRole("dialog");
    await expect(mobileDialog).toBeVisible();
    const mobileSave = mobileDialog.getByRole("button", { name: "Lưu tài khoản", exact: true });
    await mobileSave.scrollIntoViewIfNeeded();
    const mobileSaveBox = await mobileSave.boundingBox();
    assert(mobileSaveBox.x >= 0 && mobileSaveBox.x + mobileSaveBox.width <= 390);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Thêm tài khoản", exact: true })).toBeFocused();
    pass("mobile drawer keeps Save visible and Escape restores the opener");
    for (const width of [1440, 834, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const screen of ["eligibility", "reviewers", "committees", "schedule", "minutes", "deferments", "rubric", "scores", "results", "guidance-plan", "task-board", "task-review", "meetings"]) {
        await page.goto(origin + "/scripts/ui-redesign-fixture.html?screen=" + screen);
        await expect(page.locator("main").getByRole("heading", { level: 1 }).first()).toBeVisible();
        if (!(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))) {
          await page.screenshot({ path: path.join(output, `component-overflow-${screen}-${width}.png`), fullPage: true });
          throw Error(`Existing component ${screen} overflows at ${width}px`);
        }
      }
      pass(`13 existing defense, grading and guidance components fit ${width}px`);
    }
    await adminContext.close();
    for (const role of ["FACULTY", "LECTURER", "STUDENT", "COMMITTEE"]) {
      const { context, page: rolePage } = await contextFor(role);
      const screens = role === "FACULTY" ? ["/", "/terms", "/catalog/students"] : role === "STUDENT" ? ["/", "/registration", "/topic/my", "/topic/draft", "/guidance/final-report", "/guidance/defense-confirm"] : role === "LECTURER" ? ["/", "/topic/my", "/catalog/lecturers"] : ["/", "/notifications", "/profile"];
      for (const width of [1440, 834, 390]) {
        await rolePage.setViewportSize({ width, height: 1000 });
        for (const screen of screens) {
          await rolePage.goto(origin + screen);
          await expect(rolePage.locator("main")).toBeVisible();
          await expect(rolePage.locator("main").getByRole("heading", { level: 1 }).first()).toBeVisible();
          assert(await rolePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${role} overflow at ${width}: ${screen}`);
        }
      }
      await rolePage.goto(origin + "/");
      await rolePage.setViewportSize({ width: 1440, height: 1000 });
      await rolePage.screenshot({ path: path.join(output, role.toLowerCase() + "-dashboard.png"), fullPage: true });
      await expect(rolePage.locator('.sidebar a[href="/admin/accounts"]')).toHaveCount(0);
      pass(`${role} dashboard, screens and navigation permissions verified at three widths`);
      await context.close();
    }
    assert.deepEqual(errors, []); assert.deepEqual(network, []);
    fs.writeFileSync(path.join(output, "result.json"), JSON.stringify({ result: "PASS", mockedUiFixtures: true, backendAccess: false, checks, pageErrors: errors }, null, 2));
    console.log(`${checks.length} UI checks passed; artifacts: ${output}`);
  } catch (error) {
    if (activePage && !activePage.isClosed()) {
      await activePage.screenshot({ path: path.join(output, "failure.png"), fullPage: true });
      console.error((await activePage.locator("body").innerText()).slice(0, 1800));
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
