"use strict";
// Isolated API fixtures only. This test never connects to the deployed API/DB.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

async function main() {
  const root = path.resolve(__dirname, "..");
  process.chdir(root);
  const output = path.resolve(root, "../docs/performance/evidence/2026-11-19-phase2");
  fs.mkdirSync(output, { recursive: true });
  Object.assign(process.env, { VITE_AUTH_API: "true", VITE_API_URL: "/api", VITE_DEMO_MODE: "false" });
  const { createServer } = await import("vite");
  const server = await createServer({ root, server: { host: "127.0.0.1", port: 50193, strictPort: true } });
  let browser;
  const checks = [], requests = [], errors = [];
  const pass = (message) => { checks.push(message); console.log("PASS " + message); };
  let releaseBatch;
  const batchGate = new Promise((resolve) => { releaseBatch = resolve; });
  try {
    await server.listen();
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    let actor = { id: "faculty-a", username: "faculty", name: "Giáo vụ", email: "", phone: "", roles: ["FACULTY"], permissions: ["student:read", "catalog:manage", "term:read", "notification:own"], mustChangePassword: false, locked: false };
    const students = Array.from({ length: 120 }, (_, i) => ({
      id: `student-${i + 1}`, studentCode: String(i + 1).padStart(6, "0"), fullName: `Sinh viên ${i + 1}`,
      className: i < 100 ? "CNTT-A" : "LOP CUOI", majorName: "Công nghệ thông tin",
      trainingSystemId: i === 119 ? "program-2" : "program-1",
      trainingSystem: { id: i === 119 ? "program-2" : "program-1", name: i === 119 ? "Chất lượng cao" : "Chính quy" },
      gpa: i === 0 ? null : 3.2, academicEligible: i !== 1, email: `sv${i + 1}@example.test`, phone: "",
    }));
    const term = { id: "term-a", code: "DATN-A", name: "Đợt A", semester: "Học kỳ I", program: "Chính quy", status: "DRAFT", start: "2026-09-01", end: "2027-03-01", registrationStart: "2026-09-01", registrationEnd: "2026-09-30", locked: false, studentIds: students.slice(0, 3).map((s) => s.id), lecturers: [], phases: [], parameters: {}, assignmentPublished: false, resultsPublished: false };
    let failedSecond = false;
    let writes = 0;
    await page.addInitScript((user) => {
      sessionStorage.setItem("utc-api-user", JSON.stringify(user));
      sessionStorage.setItem("utc-api-access", "fixture-token-a");
    }, actor);
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== "http://127.0.0.1:50193") return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const p = url.pathname.slice(4), method = route.request().method();
      requests.push({ path: p, page: url.searchParams.get("page"), method });
      const send = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ success: status === 200, data, ...(status === 200 ? {} : { error: { message: "Lỗi tải lô sau" } }) }) });
      if (p === "/auth/me") return send(actor);
      if (p === "/terms") return send({ items: [term], total: 1 });
      if (p === "/semesters") return send([{ id: "semester", academicYear: "2026-2027", semester: 1, name: "Học kỳ I" }]);
      if (p === "/training-systems") return send([{ id: "program-1", name: "Chính quy" }, { id: "program-2", name: "Chất lượng cao" }]);
      if (p === "/departments" || p === "/notifications/me") return send([]);
      if (p === "/students") {
        const batch = Number(url.searchParams.get("page"));
        assert.equal(url.searchParams.get("pageSize"), "100");
        if (batch === 2 && actor.id === "faculty-a") {
          await batchGate;
          if (!failedSecond) { failedSecond = true; return send(null, 503); }
        }
        const rows = actor.id === "faculty-a" ? students : [{ ...students[0], id: "other-student", studentCode: "NEW001", fullName: "Sinh viên phiên mới" }];
        return send({ items: rows.slice((batch - 1) * 100, batch * 100), total: rows.length, page: batch, pageSize: 100 });
      }
      if (p.startsWith("/students/") && method === "PATCH") {
        const student = students.find((s) => s.id === p.split("/").at(-1));
        Object.assign(student, route.request().postDataJSON());
        writes++;
        return send(student);
      }
      throw new Error("Unexpected API dependency: " + method + " " + p);
    });

    await page.goto("http://127.0.0.1:50193/catalog/students");
    const table = page.getByRole("table", { name: "Danh sách sinh viên" });
    await expect(table.getByText("000001", { exact: true })).toBeVisible();
    await expect(page.locator(".table-count")).toHaveText("120 bản ghi");
    await expect(page.locator(".stat-card").filter({ hasText: "Đủ điều kiện học vụ" }).locator("strong")).toHaveText("Đang tải…");
    assert(!requests.some((r) => /lecturers|accounts|audit-logs|assignments|registrations|topics|outbox/.test(r.path)));
    await page.screenshot({ path: path.join(output, "first-batch-desktop.png"), fullPage: true });
    pass("first batch is visible while the second is blocked; full server total and no unrelated snapshot APIs");

    // The last four records in batch 1 are not presented as a complete 8-row page.
    for (let i = 0; i < 12; i++) await page.getByRole("button", { name: "Trang sau", exact: true }).click();
    await expect(page.getByText("Đang tải đầy đủ kết quả…", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Trang trước", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Trang trước", exact: true }).click();
    await expect(table.getByText("000089", { exact: true })).toBeVisible();
    pass("batch boundary waits for a full page and still permits navigating back");

    await page.getByLabel("Tìm kiếm", { exact: true }).fill("LOP CUOI");
    await expect(page.getByText("Đang tải đầy đủ kết quả…", { exact: true })).toBeVisible();
    await expect(page.getByText("Không tìm thấy kết quả", { exact: true })).toHaveCount(0);
    releaseBatch();
    await expect(page.getByText("Lỗi tải lô sau", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Thử tải lại", exact: true }).click();
    await expect(page.locator(".table-count")).toHaveText("20 bản ghi");
    await expect(table.getByText("000101", { exact: true })).toBeVisible();
    await expect(page.locator(".stat-card").filter({ hasText: "Đủ điều kiện học vụ" }).locator("strong")).toHaveText("118");
    await expect(page.locator(".stat-card").filter({ hasText: "Chưa đủ điều kiện" }).locator("strong")).toHaveText("2");
    pass("late-batch class search waits for complete data, retries real errors, and excludes null GPA from eligibility");

    await page.getByRole("checkbox", { name: /^Chọn dòng/ }).first().check();
    await page.getByRole("button", { name: "Trang sau", exact: true }).click();
    await page.getByRole("checkbox", { name: /^Chọn dòng/ }).first().check();
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Xuất 2 sinh viên", exact: true }).click();
    const file = await downloaded;
    const filePath = path.join(output, "selected-students.xlsx");
    await file.saveAs(filePath);
    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    assert.equal(workbook.worksheets[0].rowCount, 3);
    assert.deepEqual([workbook.worksheets[0].getRow(2).getCell(1).value, workbook.worksheets[0].getRow(3).getCell(1).value], ["000101", "000109"]);
    pass("selection and Excel export preserve records selected across pages");

    await page.getByLabel("Tìm kiếm", { exact: true }).fill("");
    const openFilters = async () => {
      if (!(await page.getByLabel("Lọc điều kiện").isVisible())) await page.getByLabel("Mở bộ lọc").click();
    };
    await openFilters();
    await page.getByLabel("Lọc điều kiện").selectOption("NO");
    await expect(page.locator(".table-count")).toHaveText("2 bản ghi");
    await page.getByLabel("Lọc điều kiện").selectOption("");
    await page.getByLabel("Lọc lớp").selectOption("LOP CUOI");
    await expect(page.locator(".table-count")).toHaveText("20 bản ghi");
    await page.getByLabel("Lọc lớp").selectOption("");
    await page.getByLabel("Lọc hệ đào tạo").selectOption({ label: "Chất lượng cao" });
    await expect(page.locator(".table-count")).toHaveText("1 bản ghi");
    await page.getByLabel("Lọc hệ đào tạo").selectOption("");
    await page.getByLabel("Phạm vi sinh viên").selectOption("term");
    await expect(page.locator(".table-count")).toHaveText("3 bản ghi");
    await page.getByRole("button", { name: "Đặt lại bộ lọc", exact: true }).click();
    await expect(page.locator(".table-count")).toHaveText("120 bản ghi");
    await page.getByLabel("Sắp xếp danh sách").selectOption("name:desc");
    await expect(table.getByText("000120", { exact: true })).toBeVisible();
    await page.getByLabel("Sắp xếp danh sách").selectOption("");
    pass("class/program/eligibility/term filters, reset and sorting keep full-directory semantics");

    await table.getByRole("button", { name: "Cập nhật", exact: true }).nth(2).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Họ và tên", { exact: true }).fill("Sinh viên đã cập nhật");
    await dialog.getByRole("button", { name: "Lưu sinh viên", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(table.getByText("Sinh viên đã cập nhật", { exact: true })).toBeVisible();
    assert.equal(writes, 1);
    pass("API student edit preserves the existing form and updates the scoped directory after save");

    const axe = await new AxeBuilder({ page }).analyze();
    fs.writeFileSync(path.join(output, "accessibility.json"), JSON.stringify(axe.violations, null, 2));
    assert.deepEqual(axe.violations.map((v) => ({ id: v.id, impact: v.impact })), []);
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      await page.screenshot({ path: path.join(output, `students-${width}.png`), fullPage: true, animations: "disabled" });
      const layout = await page.evaluate(() => ({
        width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        overflowing: [...document.querySelectorAll("main *")].filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 20).map((el) => ({ tag: el.tagName, className: el.className, right: el.getBoundingClientRect().right })),
      }));
      assert(layout.scrollWidth <= width + 1, JSON.stringify(layout));
    }
    await table.getByRole("button", { name: "Cập nhật", exact: true }).first().click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    pass("student page has no axe violations, fits four viewports and supports dialog Escape");

    actor = { ...actor, id: "faculty-b", name: "Giáo vụ phiên mới" };
    await page.evaluate(async (user) => {
      const { setApiUser, setTokens } = await import("/src/shared/api/api-session.ts");
      setTokens("fixture-token-b");
      setApiUser(user);
    }, actor);
    await expect(table.getByText("NEW001", { exact: true })).toBeVisible();
    await expect(table.getByText("Sinh viên đã cập nhật", { exact: true })).toHaveCount(0);
    assert(!requests.some((r) => /lecturers|accounts|audit-logs|assignments|registrations|topics|outbox/.test(r.path)));
    assert.deepEqual(errors, []);
    pass("account switch discards the previous directory without browser errors");
    fs.writeFileSync(path.join(output, "result.json"), JSON.stringify({ result: "PASS", mockedApiFixtures: true, databaseAccess: false, checks, requests, pageErrors: errors }, null, 2));
  } finally {
    releaseBatch();
    await browser?.close();
    await server.close();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
