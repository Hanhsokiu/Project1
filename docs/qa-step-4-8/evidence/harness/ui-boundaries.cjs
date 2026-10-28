"use strict";
const fs = require("node:fs"), path = require("node:path"), { createRequire } = require("node:module");
const root = path.resolve(__dirname, "../../../.."), req = createRequire(path.join(root, "frontend/package.json")), rootReq = createRequire(path.join(root, "package.json"));
const { chromium } = req("@playwright/test");
const run = fs.readFileSync(path.join(__dirname, "../latest-run.txt"), "utf8").trim(), out = path.join(__dirname, "..", run, "ui-boundaries-final"); fs.mkdirSync(out, { recursive: true });
const origin = "http://127.0.0.1:5173";
async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const result = { startedAt: new Date().toISOString(), cases: [], a11y: [], metrics: [] };
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await context.newPage();
  async function login(actor) {
    await page.goto(origin + "/login"); await page.locator('input[autocomplete="username"]').fill(actor); await page.locator('input[autocomplete="current-password"]').fill("Demo@2026");
    await page.getByRole("button", { name: "Đăng nhập hệ thống", exact: true }).click(); await page.waitForURL(origin + "/");
  }
  async function shot(name) { await page.screenshot({ path: path.join(out, name + ".png"), fullPage: true }); return name + ".png"; }
  try {
    await page.goto(origin + "/login");
    let Axe;
    try { Axe = rootReq("@axe-core/playwright").default; } catch (e) { result.a11y.push({ status: "BLOCKED", reason: e.message }); }
    async function a11y(name) {
      if (!Axe) return;
      const data = await new Axe({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      result.a11y.push({ name, passes: data.passes.length, incomplete: data.incomplete.map(x => ({ id: x.id, impact: x.impact })), violations: data.violations.map(x => ({ id: x.id, impact: x.impact, description: x.description, help: x.help, nodes: x.nodes.map(n => ({ target: n.target, html: n.html, failureSummary: n.failureSummary })) })) });
    }
    await a11y("login"); await login("giaovu");
    await page.goto(origin + "/topic/review-groups/new");
    await page.getByLabel("Đợt tạo nhóm", { exact: true }).selectOption({ index: 1 });
    await page.getByLabel("Tên nhóm", { exact: true }).waitFor(); await page.waitForLoadState("networkidle");
    await a11y("group-create");
    const create = page.getByRole("button", { name: "Tạo nhóm duyệt", exact: true });
    const disabled = await create.isDisabled();
    if (!disabled) await create.click();
    result.cases.push({ name: "group-empty-submit", url: page.url(), submitDisabled: disabled, invalidFields: await page.locator(":invalid").count(), body: await page.locator("body").innerText(), screenshot: await shot("group-validation") });
    await page.goto(origin + "/topic/proposal/qa-does-not-exist");
    await page.getByRole("alert").first().waitFor({ timeout: 20000 });
    result.cases.push({ name: "missing-proposal-error", url: page.url(), alerts: await page.getByRole("alert").allTextContents(), screenshot: await shot("missing-proposal-error") });
    await page.goto(origin + "/guidance/tasks"); await page.waitForLoadState("networkidle"); await a11y("guidance-empty-list");
    // A delayed real response: captures loading without replacing academic data.
    await page.route("**/api/proposal-review-options/terms*", async route => { await new Promise(r => setTimeout(r, 1800)); await route.continue(); });
    await page.reload(); await page.waitForTimeout(500);
    result.cases.push({ name: "loading-state", body: await page.locator("body").innerText(), screenshot: await shot("loading-real-response") });
    await page.unrouteAll({ behavior: "wait" }); await page.waitForLoadState("networkidle");
    await context.clearCookies(); await page.evaluate(() => sessionStorage.clear()); await login("sv001");
    await page.goto(origin + "/guidance/tasks"); await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "Nhóm duyệt đề cương", exact: true }).click(); await page.waitForURL(origin + "/forbidden");
    result.cases.push({ name: "student-sidebar-ineligible-link", expected: "Sidebar should only offer permitted destinations", url: page.url(), body: await page.locator("body").innerText(), screenshot: await shot("student-sidebar-forbidden") });
    await page.goto(origin + "/guidance/tasks"); await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "Hội đồng & phản biện", exact: true }).click(); await page.waitForLoadState("networkidle");
    result.cases.push({ name: "downstream-sidebar-link", url: page.url(), body: await page.locator("body").innerText(), screenshot: await shot("downstream-404") });
    await page.goto(origin + "/guidance/tasks"); await page.waitForLoadState("networkidle");
    const token = await page.evaluate(() => sessionStorage.getItem("utc-api-access"));
    for (const route of ["/api/proposal-review-options/terms", "/api/me/notifications?page=1&limit=20"]) {
      const samples = [];
      for (let i = 0; i < 5; i++) { const begin = performance.now(), r = await fetch("http://127.0.0.1:3000" + route, { headers: { Authorization: "Bearer " + token } }); await r.arrayBuffer(); samples.push({ status: r.status, elapsedMs: Math.round((performance.now() - begin) * 100) / 100 }); }
      result.metrics.push({ route, samples, condition: "loopback, sequential 5 reads, synthetic sample DB; no load/stress test" });
    }
    await page.evaluate(() => { sessionStorage.setItem("utc-api-access", "invalid"); sessionStorage.setItem("utc-api-refresh", "invalid"); });
    await page.goto(origin + "/topic/proposal");
    await page.waitForFunction(() => !sessionStorage.getItem("utc-api-access"));
    await page.waitForTimeout(1500);
    result.cases.push({ name: "expired-session-ui", url: page.url(), body: await page.locator("body").innerText(), sessionCleared: await page.evaluate(() => !sessionStorage.getItem("utc-api-access")), screenshot: await shot("expired-session") });
  } catch (error) { result.failure = error.message; result.failureScreenshot = await shot("harness-failure").catch(() => null); process.exitCode = 1; }
  finally { result.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(result, null, 2)); await browser.close(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
