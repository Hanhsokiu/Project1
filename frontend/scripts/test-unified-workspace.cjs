"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");
const root = path.resolve(__dirname, "../.."),
  origin = "http://127.0.0.1:5173";
const out = path.join(
  root,
  "docs/implementation/evidence/integration-ui-fixes-2026-10-27/ui-" +
    Date.now(),
);
fs.mkdirSync(out, { recursive: true });
async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const result = {
    startedAt: new Date().toISOString(),
    cases: [],
    violations: [],
    pageErrors: [],
    networkErrors: [],
  };
  let lastPage;
  const pass = (name, actual) =>
    result.cases.push({ name, actual, result: "PASS" });
  try {
    for (const [actor, route] of [
      ["giaovu", "/topic/review-groups"],
      ["gv001", "/guidance/tasks"],
      ["sv001", "/topic/proposal"],
    ]) {
      const context = await browser.newContext({
          viewport: { width: 1440, height: 1000 },
        }),
        page = await context.newPage();
      lastPage = page;
      page.on("pageerror", (e) => result.pageErrors.push(e.message));
      page.on("response", (r) => {
        if (r.url().includes(":3000/api") && r.status() >= 500)
          result.networkErrors.push({
            path: new URL(r.url()).pathname,
            status: r.status(),
          });
      });
      await page.goto(origin + "/login");
      await page.locator('input[autocomplete="username"]').fill(actor);
      await page
        .locator('input[autocomplete="current-password"]')
        .fill("Demo@2026");
      await page.locator('form button[type="submit"]').click();
      await page.waitForURL(origin + "/");
      if (actor === "giaovu") {
        await page.goto(origin + "/terms");
        await page.locator(".sidebar").waitFor();
        await page.waitForLoadState("networkidle");
        await page.screenshot({
          path: path.join(out, "step1-3-reference.png"),
          fullPage: true,
        });
      }
      await page.goto(origin + route);
      await page.locator(".workflow-content").waitFor();
      await page.waitForLoadState("networkidle");
      assert.equal(await page.locator(".sidebar").count(), 1);
      assert.equal(await page.locator(".rg-sidebar").count(), 0);
      assert.equal(
        await page
          .locator(
            'nav a[href="/defense/committee"],nav a[href="/grading/results"],nav a[href="/topic/draft"],nav a[href="/topic/overview"],nav a[href="/guidance/notifications"]',
          )
          .count(),
        0,
      );
      assert.equal(
        await page.locator('nav a[href="/notifications"]').count(),
        1,
      );
      if (actor === "sv001")
        assert.equal(
          await page.locator('nav a[href="/topic/review-groups"]').count(),
          0,
        );
      pass(
        actor +
          " uses one shared shell and a role-filtered menu without duplicate entries",
        page.url(),
      );
      await page.screenshot({
        path: path.join(out, actor + "-desktop.png"),
        fullPage: true,
      });
      const { default: AxeBuilder } = require(
        path.join(root, "node_modules/@axe-core/playwright"),
      );
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      result.violations.push({
        actor,
        route,
        items: axe.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            html: n.html,
            summary: n.failureSummary,
          })),
        })),
      });
      if (actor === "giaovu") {
        await page.goto(origin + "/topic/review-groups/new");
        await page
          .getByLabel("Đợt tạo nhóm", { exact: true })
          .selectOption({ index: 1 });
        await page.waitForLoadState("networkidle");
        const formAxe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        result.violations.push({
          actor,
          route: "group-form",
          items: formAxe.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              html: n.html,
              summary: n.failureSummary,
            })),
          })),
        });
      }
      await page.goto(origin + "/notifications");
      await expect(
        page.getByRole("heading", { name: "Trung tâm thông báo", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Thông báo nhận được", exact: true }),
      ).toBeVisible();
      pass(
        actor + " can open the single shared notification inbox",
        page.url(),
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(origin + "/guidance/tasks");
      await page.waitForLoadState("networkidle");
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page
        .getByRole("button", { name: "Mở điều hướng", exact: true })
        .click();
      await expect(page.locator(".sidebar")).toHaveClass(/open/);
      await page.keyboard.press("Escape");
      await expect(page.locator(".sidebar")).not.toHaveClass(/open/);
      pass(
        actor + " mobile viewport and Escape navigation",
        "390px, no horizontal document overflow",
      );
      await page.screenshot({
        path: path.join(out, actor + "-mobile.png"),
        fullPage: true,
      });
      if (actor === "sv001") {
        await page.evaluate(() => {
          sessionStorage.setItem("utc-api-access", "invalid");
          sessionStorage.setItem("utc-api-refresh", "invalid");
        });
        await page.goto(origin + "/topic/proposal");
        await page.waitForURL(origin + "/login");
        await expect(
          page.locator('input[autocomplete="username"]'),
        ).toBeVisible();
        pass(
          "401 and failed refresh redirect immediately to login",
          page.url(),
        );
      }
      await context.close();
    }
    assert.equal(result.pageErrors.length, 0);
    assert.equal(result.networkErrors.length, 0);
    result.result = result.violations.some((x) => x.items.length)
      ? "FAIL_A11Y"
      : "PASS";
    if (result.result !== "PASS") process.exitCode = 1;
  } catch (e) {
    result.result = "FAIL";
    result.failure = e.message;
    await lastPage
      ?.screenshot({ path: path.join(out, "failure.png"), fullPage: true })
      .catch(() => {});
    process.exitCode = 1;
  } finally {
    result.finishedAt = new Date().toISOString();
    fs.writeFileSync(
      path.join(out, "results.json"),
      JSON.stringify(result, null, 2),
    );
    await browser.close();
    console.log(out + " " + result.result);
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
