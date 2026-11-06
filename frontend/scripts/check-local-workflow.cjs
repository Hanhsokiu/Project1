"use strict";
// Read-only checks of populated screens on the user's actual local UI.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");
const { default: AxeBuilder } = require(
  path.resolve(__dirname, "../../node_modules/@axe-core/playwright"),
);
const root = path.resolve(__dirname, "../..");
const fixture = JSON.parse(
  fs.readFileSync(
    path.join(root, ".cache/integration-ui/workflow-demo.json"),
    "utf8",
  ),
);
assert.equal(fixture.code, "UI-DEMO-48-20261027");
assert(fixture.browserComplete);
const origin = "http://127.0.0.1:5173",
  out = path.join(
    root,
    "docs/implementation/evidence/ui-workflow-data-2026-10-27/check-" +
      Date.now(),
  );
fs.mkdirSync(out, { recursive: true });
async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true }),
    pages = new Map();
  const result = {
    startedAt: new Date().toISOString(),
    origin,
    termId: fixture.termId,
    readOnly: true,
    checks: [],
    axe: [],
    pageErrors: [],
    httpErrors: [],
  };
  let lastPage;
  const pass = (name, actual) => {
    result.checks.push({ name, actual, result: "PASS" });
    console.log("PASS " + name);
  };
  async function open(actor, route) {
    let page = pages.get(actor);
    if (!page) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      page = await context.newPage();
      pages.set(actor, page);
      page.on("pageerror", (e) => result.pageErrors.push(e.message));
      page.on("response", (r) => {
        if (r.url().includes(":3000/api") && r.status() >= 400)
          result.httpErrors.push({
            actor,
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
    }
    lastPage = page;
    await page.goto(
      origin +
        route +
        (route.includes("?") ? "&" : "?") +
        "termId=" +
        fixture.termId,
    );
    await page.waitForLoadState("networkidle");
    return page;
  }
  async function axe(page, name) {
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    result.axe.push({
      name,
      violations: scan.violations.map((v) => ({
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
  const person = (name) => fixture.people.find((p) => p.username === name);
  try {
    let p = await open("giaovu", "/topic/review-groups");
    await expect(p.locator(".rg-group-cell").first()).toContainText(
      "Nhóm duyệt DEMO",
    );
    await expect(
      p.getByRole("link", { name: "+ Tạo nhóm", exact: true }),
    ).toBeVisible();
    pass("Nhóm duyệt có dữ liệu và có thao tác tạo nhóm", fixture.groupId);
    await axe(p, "step4-populated-list");
    p = await open(
      "giaovu",
      "/topic/review-groups/" + fixture.groupId + "/edit",
    );
    await expect(p.getByLabel("Tên nhóm", { exact: true })).toHaveValue(
      "Nhóm duyệt DEMO 4–8 · Công nghệ phần mềm",
    );
    await axe(p, "step4-populated-editor");
    p = await open("giaovu", "/topic/reviews");
    await expect(p.locator("tbody tr")).toHaveCount(4);
    await p
      .getByLabel("Trạng thái đề cương", { exact: true })
      .selectOption("SUBMITTED");
    await expect(p.locator("tbody tr")).toHaveCount(1);
    await expect(p.locator("tbody")).toContainText("chờ nhóm duyệt");
    await p.getByLabel("Trạng thái đề cương", { exact: true }).selectOption("");
    await expect(p.locator("tbody tr")).toHaveCount(4);
    pass(
      "Bộ lọc xét duyệt trả đúng 1 hồ sơ chờ duyệt, bỏ lọc có 4 hồ sơ",
      "4 → 1 → 4",
    );
    p = await open("gv003", "/topic/reviews/" + person("sv002").reviewId);
    await expect(
      p.getByRole("button", { name: /^Bắt đầu duyệt phiên bản/ }),
    ).toBeEnabled();
    pass(
      "gv003 mở đúng vòng chờ duyệt và có nút bắt đầu",
      person("sv002").reviewId,
    );
    await axe(p, "step5-ready-review");
    p = await open("sv001", "/topic/proposal/" + person("sv001").proposalId);
    await expect(p.getByLabel("Mục tiêu", { exact: true })).toBeEditable();
    await expect(
      p.locator('textarea[aria-label^="Phản hồi DECISION"]'),
    ).toHaveCount(1);
    await expect(
      p.getByRole("button", { name: "Lưu nháp mới", exact: true }),
    ).toBeEnabled();
    pass(
      "sv001 có nội dung, phản hồi kết luận và được lưu bản sửa",
      "REVISION_REQUIRED",
    );
    await axe(p, "step6-revision-editor");
    p = await open("sv002", "/topic/proposal/" + person("sv002").proposalId);
    await expect(p.getByLabel("Mục tiêu", { exact: true })).toBeDisabled();
    pass(
      "sv002 không sửa trực tiếp bản SEALED đang chờ duyệt",
      "read-only as required",
    );
    p = await open("giaovu", "/topic/dossier/" + person("sv003").proposalId);
    await expect(
      p.getByRole("button", { name: "Chốt đề cương chính thức", exact: true }),
    ).toBeEnabled();
    pass(
      "sv003 sẵn sàng chốt, không chốt hộ người dùng",
      person("sv003").proposalId,
    );
    await axe(p, "step7-ready-finalization");
    p = await open("giaovu", "/topic/dossier/" + person("sv004").proposalId);
    await expect(
      p.getByRole("button", { name: "Xác nhận đã nhận bản giấy", exact: true }),
    ).toBeEnabled();
    pass(
      "sv004 có bản chốt/PDF và thao tác tiếp nhận giấy vẫn chưa bị tiêu thụ",
      "FINALIZED, receipt absent",
    );
    await axe(p, "step7-finalized-receipt");
    p = await open("sv004", "/guidance/tasks");
    for (const kind of ["todo", "pending", "revision", "completed", "overdue"])
      await expect(
        p.getByRole("heading", {
          name: fixture.setupActions["task-" + kind].title,
          exact: true,
        }),
      ).toBeVisible();
    await expect(
      p.getByRole("heading", { name: "Nghĩa vụ báo cáo tuần", exact: true }),
    ).toBeVisible();
    await expect(
      p.getByRole("button", { name: /^Tạo nhiệm vụ cho Tuần demo:/ }),
    ).toBeEnabled();
    pass(
      "sv004 thấy đủ 5 nhiệm vụ và phần báo cáo tuần",
      "5 task states; weekly task can be created",
    );
    await axe(p, "step8-populated-tasks");
    await p
      .getByLabel("Đợt làm việc", { exact: true })
      .selectOption(fixture.preservedTermId);
    // Both task list and weekly coverage can render this empty-state heading.
    await expect(
      p
        .getByRole("heading", {
          name: "Chưa có nhiệm vụ hoặc kế hoạch phù hợp",
          exact: true,
        })
        .first(),
    ).toBeVisible();
    await expect(
      p.getByRole("heading", {
        name: fixture.setupActions["task-todo"].title,
        exact: true,
      }),
    ).toHaveCount(0);
    await p
      .getByLabel("Đợt làm việc", { exact: true })
      .selectOption(fixture.termId);
    await expect(
      p.getByRole("heading", {
        name: fixture.setupActions["task-todo"].title,
        exact: true,
      }),
    ).toBeVisible();
    pass(
      "Đổi đợt ở header thực sự đổi dữ liệu và quay lại được",
      "old empty → demo populated",
    );
    await p.setViewportSize({ width: 390, height: 844 });
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Populated mobile task screen overflows",
    );
    await p.screenshot({
      path: path.join(out, "student-populated-mobile.png"),
      fullPage: true,
    });
    await p.setViewportSize({ width: 1440, height: 1000 });
    pass("Danh sách có dữ liệu không tràn ngang trên mobile", "390px");
    p = await open(
      "sv004",
      "/guidance/tasks/" +
        fixture.setupActions["task-revision"].id +
        "/submissions",
    );
    await expect(p.getByLabel("Báo cáo PDF", { exact: true })).toBeEnabled();
    await expect(p.getByLabel("Mã nguồn ZIP", { exact: true })).toBeEnabled();
    pass(
      "Task cần sửa mở được form upload/nộp lại thật",
      "PDF and ZIP enabled",
    );
    await axe(p, "step8-resubmission-form");
    p = await open(
      "gv001",
      "/guidance/review/" + fixture.setupActions["submission-pending"].id,
    );
    await expect(p.getByLabel("Kết quả đánh giá")).toBeEnabled();
    await expect(
      p.getByRole("button", { name: "Ghi nhận đánh giá", exact: true }),
    ).toBeEnabled();
    pass(
      "GVHD có bài chờ đánh giá và form đánh giá thao tác được",
      "pending submission",
    );
    await axe(p, "step8-advisor-review");
    p = await open("gv001", "/guidance/meetings?planId=" + fixture.planId);
    // The same snapshot also appears inside collapsed history. Check the current
    // meeting's direct paragraph, not the duplicated immutable history content.
    await expect(
      p.locator("article > p").filter({
        hasText:
          "Nội dung: Đối chiếu mục tiêu, mô hình dữ liệu và kết quả kiểm thử của sinh viên.",
      }),
    ).toBeVisible();
    pass("Nhật ký đã lưu hiển thị đúng trong kế hoạch", fixture.planId);
    await axe(p, "step8-meeting");
    p = await open("sv004", "/notifications");
    await expect(
      p.getByRole("heading", { name: "Trung tâm thông báo", exact: true }),
    ).toBeVisible();
    await expect(
      p.getByText("Nhiệm vụ hướng dẫn mới", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      p.getByRole("link", { name: "Mở hồ sơ", exact: true }).first(),
    ).toBeVisible();
    pass(
      "Hộp thư chung có notice nghiệp vụ và link mở hồ sơ",
      "non-empty shared inbox",
    );
    await axe(p, "shared-populated-notifications");
    p = await open("giaovu", "/guidance/progress");
    await expect(p.locator('[data-metric="Tổng nhiệm vụ"]')).toHaveText("5");
    await expect(p.locator('[data-metric="Đã hoàn thành (Đạt)"]')).toHaveText(
      "1",
    );
    await axe(p, "step8-populated-dashboard");
    pass(
      "Dashboard có 5 nhiệm vụ và số liệu các trạng thái đúng",
      "5 total, 1 completed",
    );
    await p.screenshot({
      path: path.join(out, "dashboard.png"),
      fullPage: true,
    });
    assert.equal(result.pageErrors.length, 0);
    assert.equal(result.httpErrors.length, 0);
    result.result = result.axe.some((s) => s.violations.length)
      ? "FAIL_A11Y"
      : "PASS";
    if (result.result !== "PASS") process.exitCode = 1;
  } catch (e) {
    result.result = "FAIL";
    result.failure = e.message;
    process.exitCode = 1;
    await lastPage
      ?.screenshot({ path: path.join(out, "failure.png"), fullPage: true })
      .catch(() => {});
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
