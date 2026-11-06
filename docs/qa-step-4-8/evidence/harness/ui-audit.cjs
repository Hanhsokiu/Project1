"use strict";
const fs = require("node:fs"), path = require("node:path"), { createRequire } = require("node:module");
const root = path.resolve(__dirname, "../../../.."), req = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = req("@playwright/test");
const run = fs.readFileSync(path.join(__dirname, "../latest-run.txt"), "utf8").trim();
const out = path.join(__dirname, "..", run, "ui-local"); fs.mkdirSync(out, { recursive: true });
const origin = "http://127.0.0.1:5173", apiOrigin = "http://127.0.0.1:3000";
const roles = {
  giaovu: ["/topic/review-groups", "/topic/review-groups/new", "/topic/reviews", "/topic/proposal", "/topic/dossier", "/guidance/plan", "/guidance/tasks", "/guidance/progress", "/guidance/meetings", "/guidance/notifications"],
  gv001: ["/topic/review-groups", "/topic/reviews", "/topic/proposal", "/topic/dossier", "/guidance/plan", "/guidance/tasks", "/guidance/review", "/guidance/meetings", "/guidance/notifications"],
  sv001: ["/topic/reviews", "/topic/proposal", "/topic/dossier", "/guidance/plan", "/guidance/tasks", "/guidance/meetings", "/guidance/notifications"],
  admin: ["/topic/review-groups", "/topic/proposal", "/guidance/tasks"],
};
async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const results = { startedAt: new Date().toISOString(), mockedApi: false, cases: [], pageErrors: [], consoleErrors: [], network: [], a11y: [] };
  const save = () => fs.writeFileSync(path.join(out, "ui-results.json"), JSON.stringify(results, null, 2));
  try {
    for (const [actor, routes] of Object.entries(roles)) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await context.route("**/*", r => { const u = new URL(r.request().url()); return !["http:", "https:"].includes(u.protocol) || [origin, apiOrigin].includes(u.origin) ? r.continue() : r.abort(); });
      const page = await context.newPage();
      page.on("pageerror", e => results.pageErrors.push({ actor, message: e.message }));
      page.on("console", e => { if (e.type() === "error") results.consoleErrors.push({ actor, message: e.text() }); });
      page.on("response", r => { if (r.url().startsWith(apiOrigin)) results.network.push({ actor, method: r.request().method(), path: new URL(r.url()).pathname, status: r.status(), timing: r.request().timing().responseEnd }); });
      await page.goto(origin + "/login");
      await page.locator('input[autocomplete="username"]').fill(actor);
      await page.locator('input[autocomplete="current-password"]').fill("Demo@2026");
      await page.locator('form button[type="submit"]').click(); await page.waitForURL(origin + "/");
      for (const route of routes) {
        const id = actor + route.replace(/\//g, "-");
        const begin = Date.now(); await page.goto(origin + route); await page.waitForLoadState("networkidle");
        const body = await page.locator("body").innerText();
        await page.screenshot({ path: path.join(out, id + ".png"), fullPage: true });
        results.cases.push({ actor, route, url: page.url(), kind: "desktop", elapsedMs: Date.now() - begin, body, screenshot: id + ".png", metrics: await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, unlabeledInputs: [...document.querySelectorAll('input:not([type="hidden"]),select,textarea')].filter(e => !e.getAttribute("aria-label") && !e.getAttribute("aria-labelledby") && !e.labels?.length && !e.getAttribute("title")).map(e => ({ tag: e.tagName, placeholder: e.getAttribute("placeholder") })) })) });
        if (actor === "giaovu" && route === "/topic/review-groups/new") {
          await page.locator('button[type="submit"]').click();
          await page.screenshot({ path: path.join(out, "group-native-validation.png"), fullPage: true });
          results.cases.push({ actor, route, kind: "empty-submit", invalidFields: await page.locator(":invalid").count(), alerts: await page.getByRole("alert").allTextContents(), body: await page.locator("body").innerText() });
        }
      }
      if (actor !== "admin") {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(origin + "/guidance/tasks"); await page.waitForLoadState("networkidle");
        const id = actor + "-mobile-tasks.png"; await page.screenshot({ path: path.join(out, id), fullPage: true });
        results.cases.push({ actor, route: "/guidance/tasks", kind: "mobile", screenshot: id, metrics: await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth })) });
        if (actor === "sv001") {
          await page.getByRole("button", { name: "Mở điều hướng", exact: true }).click();
          results.cases.push({ actor, kind: "mobile-navigation", expanded: await page.getByRole("button", { name: "Đóng menu", exact: true }).getAttribute("aria-expanded") });
          await page.keyboard.press("Escape");
          results.cases.push({ actor, kind: "escape-navigation", expanded: await page.getByRole("button", { name: "Mở điều hướng", exact: true }).getAttribute("aria-expanded") });
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto(origin + "/topic/proposal/qa-does-not-exist"); await page.waitForLoadState("networkidle");
        results.cases.push({ actor, kind: "nonexistent-detail", url: page.url(), alerts: await page.getByRole("alert").allTextContents(), body: await page.locator("body").innerText() });
        await page.screenshot({ path: path.join(out, actor + "-not-found.png"), fullPage: true });
      }
      await context.close(); save(); console.log("DONE UI " + actor);
    }
    const context = await browser.newContext(); const page = await context.newPage();
    await page.goto(origin + "/topic/proposal"); await page.waitForLoadState("networkidle");
    results.cases.push({ actor: "anonymous", kind: "protected-route", expected: "/login", url: page.url() }); await context.close();
  } catch (error) { results.failure = error.message; process.exitCode = 1; }
  finally { results.finishedAt = new Date().toISOString(); save(); await browser.close(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
