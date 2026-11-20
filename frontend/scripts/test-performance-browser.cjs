"use strict";
// Real-auth UI with isolated API fixtures. Never contacts Render or Supabase.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

async function main() {
  const root = path.resolve(__dirname, "..");
  process.chdir(root);
  const output = path.resolve(root, "../docs/performance/evidence/2026-11-20-phase3");
  fs.mkdirSync(output, { recursive: true });
  Object.assign(process.env, { VITE_AUTH_API: "true", VITE_API_URL: "/api", VITE_DEMO_MODE: "false" });
  const { createServer } = await import("vite");
  const server = await createServer({ root, mode: "test", server: { host: "127.0.0.1", port: 50194, strictPort: true } });
  const origin = "http://127.0.0.1:50194", checks = [], errors = [], results = [];
  let browser;
  const pass = (name) => { checks.push(name); console.log("PASS " + name); };
  try {
    await server.listen();
    const { createSeed } = await server.ssrLoadModule("/src/shared/data/seed.ts");
    const db = createSeed(true);
    const terms = ["term-a", "term-b"].map((id, index) => ({
      ...db.terms[0], id, code: index ? "DATN-B" : "DATN-A", name: index ? "Đợt B" : "Đợt A",
      assignmentPublished: false,
    }));
    const students = db.students.map(s => ({
      id: s.id, studentCode: s.code, fullName: s.name, className: s.className,
      gpa: s.gpa, academicEligible: s.eligible, email: s.email, phone: s.phone,
      trainingSystemId: db.catalogs.find(c => c.kind === "program" && c.name === s.program)?.id || "program",
      trainingSystem: { name: s.program },
    }));
    const lecturers = db.lecturers.map(l => ({
      id: l.id, lecturerCode: l.code, fullName: l.name, isActive: true,
      email: l.email, phone: l.phone, departmentId: l.departmentId, maxStudents: l.quota,
      researchAreas: l.directionIds.map(id => ({ id, name: db.catalogs.find(c => c.id === id)?.name || id })),
    }));
    browser = await chromium.launch({ channel: "msedge", headless: true });
    async function session(role) {
      let actor = { ...db.accounts.find(a => a.roles.includes(role)), roles: [role],
        permissions: ["audit:read", "term:read", "catalog:manage", "student:read"],
        profileComplete: true, mustChangePassword: false,
      };
      if (role === "FACULTY") actor.permissions = ["term:read", "catalog:manage", "student:read"];
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
      await context.addInitScript(user => {
        sessionStorage.setItem("utc-api-user", JSON.stringify(user));
        sessionStorage.setItem("utc-api-access", "fixture-" + user.id);
      }, actor);
      const page = await context.newPage(), requests = [], modules = [];
      let failAudit = true;
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/*", async route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (!url.pathname.startsWith("/api/")) {
          modules.push(url.pathname);
          return route.continue();
        }
        const p = url.pathname.slice(4), method = route.request().method();
        requests.push({ path: p, method });
        const send = (data, status = 200) => route.fulfill({ status, contentType: "application/json",
          body: JSON.stringify({ success: status === 200, data,
            ...(status === 200 ? {} : { error: { message: "Nhật ký tạm thời không tải được" } }) }) });
        if (p === "/auth/me") return send(actor);
        if (p === "/auth/profile" && method === "PATCH") {
          actor = { ...actor, ...route.request().postDataJSON() };
          return send(actor);
        }
        if (p === "/terms") return send({ items: terms, total: terms.length });
        if (p === "/semesters") return send([]);
        const kind = { "/training-systems": "program", "/departments": "department", "/research-areas": "direction" }[p];
        if (kind) return send(db.catalogs.filter(c => c.kind === kind).map(c => ({ ...c, isActive: c.active })));
        if (p === "/notifications/me") return send([]);
        if (p === "/accounts") return send({ items: db.accounts.map(a => ({ ...a, password: "" })), total: db.accounts.length });
        if (p === "/students") return send({ items: students, total: students.length });
        if (p === "/lecturers") return send({ items: lecturers, total: lecturers.length });
        if (p === "/audit-logs") {
          if (failAudit) { failAudit = false; return send(null, 503); }
          return send({ items: [{ id: "audit-a", at: "2026-11-20T05:00:00Z", actor: "Giáo vụ", action: "UPDATE", detail: "Bản ghi API thật của fixture" }], total: 1 });
        }
        if (/^\/assignments\/term\/term-[ab]\/plan$/.test(p))
          return send({ plan: null, assignments: [], results: [], missingSubmissions: [] });
        if (/^\/registrations\/term\/term-[ab]$/.test(p)) return send({ items: [], stats: { total: 0, draft: 0, submitted: 0 } });
        if (/^\/notifications\/outbox\/term\/term-[ab]$/.test(p)) return send([]);
        errors.push("Unexpected API: " + method + " " + p);
        return send(null, 500);
      });
      return { context, page, requests, modules };
    }
    const admin = await session("ADMIN");
    const page = admin.page;
    await page.goto(origin + "/profile");
    await expect(page.getByRole("heading", { name: "Thông tin cá nhân", exact: true })).toBeVisible();
    assert(!admin.requests.some(r => /students|lecturers|accounts|audit-logs|registrations|assignments|outbox/.test(r.path)));
    assert(!admin.modules.some(p => /^\/src\/features\/(defense|review-groups|guidance-tasks|proposal-versions|proposal-reviews|proposal-dossiers)\//.test(p)), "Unopened business screens must not load their page modules");
    pass("profile opens without bulk directories and without downloading unopened workflow/defense pages");
    admin.requests.length = 0;
    const form = page.locator("form");
    await form.getByLabel("Họ và tên", { exact: true }).fill("Quản trị đã cập nhật");
    await form.getByLabel("Email", { exact: true }).fill("admin@example.test");
    await form.getByRole("textbox", { name: /^Số điện thoại/ }).fill("0912345678");
    await form.getByRole("button", { name: /Lưu/ }).click();
    await expect(page.getByText("Đã lưu thay đổi", { exact: true })).toBeVisible();
    await expect(page.locator(".sidebar-footer")).toContainText("Quản trị đã cập nhật");
    assert(!admin.requests.some(r => /students|lecturers|accounts|audit-logs|registrations|assignments|outbox/.test(r.path)));
    pass("profile save reconciles the scoped shell without returning to a full snapshot");

    admin.requests.length = 0;
    await page.locator('.sidebar a[href="/admin/roles"]').click();
    await expect(page.getByRole("heading", { name: "Vai trò & phân quyền", exact: true })).toBeVisible();
    assert(admin.requests.some(r => r.path === "/accounts"));
    assert(!admin.requests.some(r => /students|lecturers|audit-logs|registrations|assignments|outbox/.test(r.path)));
    pass("role matrix keeps account statistics and skips unrelated academic records");

    admin.requests.length = 0;
    await page.locator('.sidebar a[href="/admin/audit-logs"]').click();
    await expect(page.getByText("Nhật ký tạm thời không tải được", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Thử lại", exact: true }).click();
    await expect(page.getByText("Bản ghi API thật của fixture", { exact: true })).toBeVisible();
    assert(!admin.requests.some(r => /students|lecturers|accounts|registrations|assignments|outbox/.test(r.path)));
    pass("audit screen exposes a real API error, retries and loads only audit records");

    admin.requests.length = 0;
    await page.goto(origin + "/terms/term-b/parameters");
    await expect(page.getByRole("heading", { name: /Tham số/ })).toBeVisible();
    await expect(page.locator(".term-picker")).toHaveValue("term-b");
    assert(!admin.requests.some(r => /students|lecturers|accounts|audit-logs|registrations|assignments|outbox/.test(r.path)));
    pass("direct term-parameter URL resolves the right term without loading its unrelated workflow");
    results.push({ role: "ADMIN", paths: admin.requests });

    const faculty = await session("FACULTY");
    await faculty.page.goto(origin + "/");
    await expect(faculty.page.getByRole("heading", { name: /^Xin chào/ })).toBeVisible();
    await expect(faculty.page.locator(".term-picker")).toHaveValue("term-a");
    await faculty.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(faculty.requests.filter(r => r.path === "/assignments/term/term-a/plan").length, 1,
      "Nested DataBoundary and initial workspace selection must share one scoped snapshot");
    assert(!faculty.requests.some(r => r.path.includes("/term/term-b") || r.path === "/registrations" || r.path === "/accounts" || r.path === "/audit-logs"));
    pass("dashboard and nested boundary share one read, fetching workflows for the active term only");
    faculty.requests.length = 0;
    await faculty.page.locator(".term-picker").selectOption("term-b");
    await expect(faculty.page).toHaveURL(/termId=term-b/);
    await expect(faculty.page.locator(".dashboard-overview")).toContainText("DATN-B");
    assert(faculty.requests.some(r => r.path === "/assignments/term/term-b/plan"));
    assert(!faculty.requests.some(r => r.path.includes("/term/term-a")));
    pass("term switch changes query identity and loads the new term without reloading previous-term workflows");

    const accessibility = await new AxeBuilder({ page: faculty.page }).analyze();
    fs.writeFileSync(path.join(output, "accessibility.json"), JSON.stringify(accessibility.violations, null, 2));
    assert.equal(accessibility.violations.length, 0);
    for (const width of [320, 375, 768, 1440]) {
      await faculty.page.setViewportSize({ width, height: 1000 });
      await expect.poll(() => faculty.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await faculty.page.screenshot({ path: path.join(output, "dashboard-" + width + ".png"), fullPage: true });
    }
    pass("scoped dashboard fits four viewport sizes and has no axe violations");
    assert.deepEqual(errors, []);
    results.push({ role: "FACULTY", paths: faculty.requests });
  } finally {
    fs.writeFileSync(path.join(output, "result.json"), JSON.stringify({ status: checks.length === 8 && !errors.length ? "PASS" : "FAIL", checks, errors, results }, null, 2));
    if (browser) await browser.close();
    await server.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
