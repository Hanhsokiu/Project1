"use strict";
// Isolated API fixtures. SQL and real HTTP guards have a separate PostgreSQL suite.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
async function main() {
  const root = path.resolve(__dirname, "..");
  process.chdir(root);
  const output = path.resolve(root, "../docs/performance/evidence/2026-11-20-phase3/student-directory");
  fs.mkdirSync(output, { recursive: true });
  Object.assign(process.env, { VITE_AUTH_API: "true", VITE_API_URL: "/api", VITE_DEMO_MODE: "false" });
  const { createServer } = await import("vite");
  const server = await createServer({ root, mode: "test", server: { host: "127.0.0.1", port: 50193, strictPort: true } });
  let browser, releaseSecond, releaseOptions;
  const secondGate = new Promise(resolve => { releaseSecond = resolve; });
  const optionsGate = new Promise(resolve => { releaseOptions = resolve; });
  const checks = [], requests = [], errors = [];
  const pass = message => { checks.push(message); console.log("PASS " + message); };
  try {
    await server.listen();
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    let actor = { id: "faculty-a", username: "faculty", name: "Giáo vụ", email: "", phone: "", roles: ["FACULTY"], permissions: ["student:read", "catalog:manage", "term:read", "notification:own"], mustChangePassword: false, locked: false };
    const students = Array.from({ length: 120 }, (_, i) => ({
      id: `student-${i + 1}`, studentCode: String(i + 1).padStart(6, "0"), fullName: `Sinh viên ${i + 1}`,
      className: i < 100 ? "CNTT-A" : "LOP CUOI", majorName: "Công nghệ thông tin",
      trainingSystemId: i === 119 ? "program-2" : "program-1",
      trainingSystem: { id: i === 119 ? "program-2" : "program-1", code: i === 119 ? "CLC" : "CQ", name: i === 119 ? "Chất lượng cao" : "Chính quy" },
      gpa: i === 0 ? null : 3.2, academicEligible: i !== 1, email: `sv${i + 1}@example.test`, phone: "",
    }));
    const term = { id: "term-a", code: "DATN-A", name: "Đợt A", semester: "Học kỳ I", program: "Chính quy", status: "DRAFT", start: "2026-09-01", end: "2027-03-01", registrationStart: "2026-09-01", registrationEnd: "2026-09-30", locked: false, studentIds: students.slice(0, 3).map(s => s.id), lecturers: [], phases: [], parameters: {}, assignmentPublished: false, resultsPublished: false };
    const eligible = s => s.academicEligible && s.gpa !== null && s.gpa >= 0 && s.gpa <= 4;
    let failedSecond = false, writes = 0;
    await page.addInitScript(user => {
      sessionStorage.setItem("utc-api-user", JSON.stringify(user));
      sessionStorage.setItem("utc-api-access", "fixture-token-a");
    }, actor);
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin !== "http://127.0.0.1:50193") return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const p = url.pathname.slice(4), method = route.request().method(), q = url.searchParams;
      requests.push({ path: p, query: Object.fromEntries(q), method });
      const send = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ success: status === 200, data, ...(status === 200 ? {} : { error: { message: "Lỗi tải trang sau" } }) }) });
      const all = actor.id === "faculty-a" ? students : [{ ...students[0], id: "other-student", studentCode: "NEW001", fullName: "Sinh viên phiên mới" }];
      if (p === "/auth/me") return send(actor);
      if (p === "/terms") return send({ items: [term], total: 1 });
      if (p === "/semesters") return send([{ id: "semester", academicYear: "2026-2027", semester: 1, name: "Học kỳ I" }]);
      if (p === "/training-systems") return send([{ id: "program-1", name: "Chính quy" }, { id: "program-2", name: "Chất lượng cao" }]);
      if (p === "/departments" || p === "/notifications/me") return send([]);
      if (p === "/students/directory-options") {
        await optionsGate;
        const count = all.filter(eligible).length;
        return send({ total: all.length, eligible: count, ineligible: all.length - count, classes: [...new Set(all.map(s => s.className))] });
      }
      if (p === "/students/directory") {
        const number = Number(q.get("page")), size = Number(q.get("pageSize"));
        assert.equal(size, 8);
        if (number === 2 && !q.get("search") && !failedSecond) {
          await secondGate;
          failedSecond = true;
          return send(null, 503);
        }
        let rows = all.filter(s => (!q.get("search") || `${s.studentCode} ${s.fullName} ${s.email} ${s.className}`.toLocaleLowerCase("vi").includes(q.get("search").toLocaleLowerCase("vi"))) &&
          (!q.get("trainingSystemId") || s.trainingSystemId === q.get("trainingSystemId")) &&
          (!q.get("className") || s.className === q.get("className")) &&
          (!q.get("termId") || term.studentIds.includes(s.id)) &&
          (!q.get("academicCondition") || eligible(s) === (q.get("academicCondition") === "eligible")));
        const field = q.get("sortBy") === "name" ? "fullName" : q.get("sortBy") === "gpa" ? "gpa" : "studentCode";
        rows.sort((a, b) => {
          const x = a[field], y = b[field];
          const order = x === null ? -1 : y === null ? 1 : typeof x === "number" ? x - y : String(x).localeCompare(String(y), "vi", { numeric: true });
          return order * (q.get("sortDirection") === "desc" ? -1 : 1) || a.studentCode.localeCompare(b.studentCode);
        });
        return send({ items: rows.slice((number - 1) * size, number * size), total: rows.length, page: number, pageSize: size, totalPages: Math.ceil(rows.length / size) });
      }
      if (p.startsWith("/students/") && method === "PATCH") {
        const student = students.find(s => s.id === p.split("/").at(-1));
        Object.assign(student, route.request().postDataJSON());
        writes++;
        return send(student);
      }
      throw new Error("Unexpected API dependency: " + method + " " + p);
    });
    await page.goto("http://127.0.0.1:50193/catalog/students");
    const table = page.getByRole("table", { name: "Danh sách sinh viên" });
    const count = page.locator(".table-count");
    const stat = label => page.locator(".stat-card").filter({ hasText: label }).locator("strong");
    await expect(table.getByText("000001", { exact: true })).toBeVisible();
    await expect(table.locator("tbody tr")).toHaveCount(8);
    await expect(count).toHaveText("120 bản ghi");
    await expect(stat("Đủ điều kiện học vụ")).toHaveText("Đang tải…");
    assert.deepEqual(requests.filter(r => r.path === "/students/directory").map(r => r.query.page), ["1"]);
    assert(!requests.some(r => r.path === "/students" || /lecturers|accounts|audit-logs|assignments|registrations|topics|outbox/.test(r.path)));
    releaseOptions();
    await expect(stat("Đủ điều kiện học vụ")).toHaveText("118");
    await expect(stat("Chưa đủ điều kiện")).toHaveText("2");
    pass("first screen requests exactly one 8-row server page; independent aggregate includes all 120 students");
    await page.getByRole("button", { name: "Trang sau", exact: true }).click();
    await expect(page.getByText("Đang tải trang 2", { exact: true })).toBeVisible();
    await expect(table.locator("tbody tr")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Trang trước", exact: true })).toBeEnabled();
    await expect(page.getByText("Không tìm thấy kết quả", { exact: true })).toHaveCount(0);
    releaseSecond();
    await expect(page.getByText("Lỗi tải trang sau", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Thử tải lại", exact: true }).click();
    await expect(table.getByText("000009", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Trang trước", exact: true }).click();
    await expect(table.getByText("000001", { exact: true })).toBeVisible();
    pass("pending/error pages do not display stale rows or false empty results; retry and back navigation work");
    const search = page.getByLabel("Tìm kiếm", { exact: true });
    await search.fill("LOP CUOI");
    await expect(count).toHaveText("20 bản ghi");
    await expect(table.getByText("000101", { exact: true })).toBeVisible();
    await expect(stat("Đủ điều kiện học vụ")).toHaveText("118");
    assert(requests.some(r => r.path === "/students/directory" && r.query.search === "LOP CUOI" && r.query.page === "1"));
    pass("search reaches students outside the initial page while global statistics remain exact");
    await page.getByRole("checkbox", { name: /^Chọn dòng/ }).first().check();
    await page.getByRole("button", { name: "Trang sau", exact: true }).click();
    await expect(table.getByText("000109", { exact: true })).toBeVisible();
    await page.getByRole("checkbox", { name: /^Chọn dòng/ }).first().check();
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Xuất 2 sinh viên", exact: true }).click();
    const filePath = path.join(output, "selected-students.xlsx");
    await (await downloaded).saveAs(filePath);
    const workbook = new (require("exceljs").Workbook)();
    await workbook.xlsx.readFile(filePath);
    assert.equal(workbook.worksheets[0].rowCount, 3);
    assert.deepEqual([2, 3].map(row => workbook.worksheets[0].getRow(row).getCell(1).value), ["000101", "000109"]);
    pass("selection and Excel export preserve students chosen across separate server pages");
    await search.fill("");
    await expect(count).toHaveText("120 bản ghi");
    const openFilters = async () => { if (!(await page.getByLabel("Lọc điều kiện").isVisible())) await page.getByLabel("Mở bộ lọc").click(); };
    await openFilters();
    await page.getByLabel("Lọc điều kiện").selectOption("NO");
    await expect(count).toHaveText("2 bản ghi");
    await page.getByLabel("Lọc điều kiện").selectOption("");
    await page.getByLabel("Lọc lớp").selectOption("LOP CUOI");
    await expect(count).toHaveText("20 bản ghi");
    await page.getByLabel("Lọc lớp").selectOption("");
    await page.getByLabel("Lọc hệ đào tạo").selectOption({ label: "Chất lượng cao" });
    await expect(count).toHaveText("1 bản ghi");
    await page.getByLabel("Lọc hệ đào tạo").selectOption("");
    await page.getByLabel("Phạm vi sinh viên").selectOption("term");
    await expect(count).toHaveText("3 bản ghi");
    await page.getByRole("button", { name: "Đặt lại bộ lọc", exact: true }).click();
    await expect(count).toHaveText("120 bản ghi");
    await page.getByLabel("Sắp xếp danh sách").selectOption("name:desc");
    await expect(table.getByText("000120", { exact: true })).toBeVisible();
    assert(requests.some(r => r.query.sortBy === "name" && r.query.sortDirection === "desc"));
    await page.getByLabel("Sắp xếp danh sách").selectOption("");
    await expect(table.getByText("000001", { exact: true })).toBeVisible();
    pass("eligibility/class/program/term filters and sorting are sent to server, reset returns to first page");
    await table.getByRole("button", { name: "Cập nhật", exact: true }).nth(2).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Họ và tên", { exact: true }).fill("Sinh viên đã cập nhật");
    await dialog.getByRole("button", { name: "Lưu sinh viên", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(table.getByText("Sinh viên đã cập nhật", { exact: true })).toBeVisible();
    assert.equal(writes, 1);
    pass("existing student edit persists through API and refreshes current server page");
    const axe = await new AxeBuilder({ page }).analyze();
    fs.writeFileSync(path.join(output, "accessibility.json"), JSON.stringify(axe.violations, null, 2));
    assert.deepEqual(axe.violations.map(v => ({ id: v.id, impact: v.impact })), []);
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      await page.screenshot({ path: path.join(output, `students-${width}.png`), fullPage: true, animations: "disabled" });
    }
    await table.getByRole("button", { name: "Cập nhật", exact: true }).first().click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    pass("zero axe violations, four responsive widths and dialog Escape support");
    await page.getByRole("checkbox", { name: /^Chọn dòng/ }).first().check();
    await expect(page.getByRole("button", { name: "Xuất 1 sinh viên", exact: true })).toBeVisible();
    actor = { ...actor, id: "faculty-b", name: "Giáo vụ phiên mới" };
    await page.evaluate(async user => {
      const { setApiUser, setTokens } = await import("/src/shared/api/api-session.ts");
      setTokens("fixture-token-b"); setApiUser(user);
    }, actor);
    await expect(table.getByText("NEW001", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Thao tác với dòng đã chọn" })).toHaveCount(0);
    await expect(table.getByText("Sinh viên đã cập nhật", { exact: true })).toHaveCount(0);
    assert.deepEqual(errors, []);
    pass("account switch clears cached directory and selected rows without browser errors");
    fs.writeFileSync(path.join(output, "result.json"), JSON.stringify({ result: "PASS", mockedApiFixtures: true, databaseAccess: false, checks, requests, pageErrors: errors }, null, 2));
  } finally {
    releaseSecond(); releaseOptions();
    await browser?.close(); await server.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
