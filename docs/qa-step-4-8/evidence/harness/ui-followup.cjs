"use strict";
const fs = require("node:fs"), path = require("node:path"), { createRequire } = require("node:module");
const root = path.resolve(__dirname, "../../../.."), req = createRequire(path.join(root, "frontend/package.json")), { chromium } = req("@playwright/test");
const run = fs.readFileSync(path.join(__dirname, "../latest-run.txt"), "utf8").trim(), out = path.join(__dirname, "..", run, "ui-followup"); fs.mkdirSync(out, { recursive: true });
async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true }), context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await context.newPage();
  const result = { startedAt: new Date().toISOString(), cases: [] }, origin = "http://127.0.0.1:5173";
  const capture = async name => { await page.screenshot({ path: path.join(out, name + ".png"), fullPage: true }); result.cases.push({ name, url: page.url(), body: await page.locator("body").innerText(), screenshot: name + ".png" }); };
  try {
    await page.goto(origin + "/login"); await page.locator('input[autocomplete="username"]').fill("sv001"); await page.locator('input[autocomplete="current-password"]').fill("Demo@2026"); await page.locator('form button[type="submit"]').click(); await page.waitForURL(origin + "/");
    await page.goto(origin + "/guidance/tasks"); await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "Nhóm duyệt đề cương", exact: true }).click(); await page.getByText("403 · Không đủ quyền", { exact: true }).waitFor(); await capture("student-forbidden-stable");
    await page.goBack(); await page.waitForLoadState("networkidle"); await capture("back-to-tasks");
    await page.getByRole("link", { name: "Hội đồng & phản biện", exact: true }).click(); await page.getByText("404 · Không tìm thấy trang", { exact: true }).waitFor(); await capture("downstream-404-stable");
    await page.goBack(); await page.waitForLoadState("networkidle"); await page.reload(); await page.waitForLoadState("networkidle"); await capture("refresh-tasks");
    await page.evaluate(() => { sessionStorage.setItem("utc-api-access", "invalid"); sessionStorage.setItem("utc-api-refresh", "invalid"); });
    await page.goto(origin + "/topic/proposal"); await page.waitForFunction(() => !sessionStorage.getItem("utc-api-access")); await page.waitForTimeout(10000); await capture("expired-session-after-10s");
    result.cases.push({ name: "expired-session-recovery-controls", loginLinks: await page.locator('a[href="/login"]').count(), buttons: await page.getByRole("button").allTextContents(), sessionCleared: await page.evaluate(() => !sessionStorage.getItem("utc-api-access")) });
  } catch (e) { result.failure = e.message; process.exitCode = 1; }
  finally { result.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(result, null, 2)); await browser.close(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
