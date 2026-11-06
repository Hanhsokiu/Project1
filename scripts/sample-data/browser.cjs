"use strict";
// Real browser and API reads. No route mocks or sample localStorage injection.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const {
  chromium,
  expect: baseExpect,
} = require("../../node_modules/@playwright/test");
const expect = baseExpect.configure({ timeout: 60000 });
const { id } = require("./definition.cjs");
const fixture = JSON.parse(
  fs.readFileSync(process.env.SAMPLE_MANIFEST, "utf8"),
);
const origin = process.env.SAMPLE_ORIGIN,
  out = path.join(path.dirname(process.env.SAMPLE_MANIFEST), "browser");
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const result = {
    mocked: false,
    checkedAt: new Date().toISOString(),
    checks: [],
    errors: [],
  };
  const contexts = [];
  let lastPage;
  async function open(actor, route, term) {
    // Close the previous role's tab so its polling stops before switching roles.
    // A small shared session pool must not be loaded by abandoned test tabs.
    for (const context of contexts) await context.close();
    contexts.length = 0;
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
    });
    contexts.push(context);
    const page = await context.newPage();
    lastPage = page;
    page.setDefaultTimeout(60000);
    page.on("pageerror", (e) => result.errors.push(e.message));
    page.on("response", (r) => {
      if (r.url().includes("/api/") && r.status() >= 400)
        result.errors.push(`${r.status()} ${new URL(r.url()).pathname}`);
    });
    await page.goto(origin + "/login");
    await page.locator('input[autocomplete="username"]').fill("mau18_" + actor);
    await page
      .locator('input[autocomplete="current-password"]')
      .fill(fixture.password);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(
      (url) => url.origin === origin && url.pathname === "/",
      { timeout: 60000 },
    );
    await page.goto(
      origin +
        route +
        (route.includes("?") ? "&" : "?") +
        "termId=" +
        id("term/" + term),
    );
    await expect(page.getByLabel("Đợt làm việc", { exact: true })).toHaveValue(
      id("term/" + term),
    );
    await expect(
      page.locator('[role="status"]').filter({ hasText: /^Đang tải dữ liệu/ }),
    ).toHaveCount(0);
    return page;
  }
  const pass = (name) => {
    result.checks.push(name);
    console.log("PASS " + name);
  };
  try {
    let page = await open("giaovu", "/guidance/weeks", "guidance");
    const termId = id("term/guidance"),
      periodId = fixture.guidance.periodIds[1];
    await expect(page.getByLabel("Đợt đồ án", { exact: true })).toHaveValue(
      termId,
      { timeout: 60000 },
    );
    await page.getByLabel("Tuần", { exact: true }).selectOption(periodId);
    await expect(page.locator("tbody")).toContainText("MAU18-SV12", {
      timeout: 60000,
    });
    await expect(page.locator("tbody tr")).toHaveCount(12);
    for (const label of [
      "Chờ đánh giá",
      "Cần sửa",
      "Đạt",
      "Không đạt",
      "Chưa nộp",
    ])
      await expect(page.locator("tbody")).toContainText(label);
    pass(
      "Faculty weekly screen shows 12 students and all five reporting states from PostgreSQL",
    );
    await page.screenshot({
      path: path.join(out, "01-giaovu-tuan2.png"),
      fullPage: true,
    });
    await page
      .getByLabel("Tuần", { exact: true })
      .selectOption(fixture.guidance.periodIds[0]);
    await expect(page.locator("tbody")).toContainText("Lần 2", {
      timeout: 60000,
    });
    pass("Previous week displays the second report version and late reporting");
    const sv11 = fixture.guidance.sv11;
    page = await open(
      "sv11",
      `/guidance/tasks/${sv11.taskId}/submissions`,
      "guidance",
    );
    await expect(
      page.getByRole("heading", { name: /Bài nộp|Báo cáo|Lịch sử/ }).first(),
    ).toBeVisible({ timeout: 60000 });
    await expect(page.locator("body")).toContainText("bao-cao-sv11-v1.pdf", {
      timeout: 60000,
    });
    await expect(page.locator("body")).toContainText("ma-nguon-sv11-v1.zip");
    const reportDownload = page.waitForEvent("download", { timeout: 60000 });
    await page.getByRole("button", { name: /bao-cao-sv11-v1\.pdf/ }).click();
    const downloaded = await reportDownload;
    assert.equal(downloaded.suggestedFilename(), "bao-cao-sv11-v1.pdf");
    await downloaded.saveAs(path.join(out, "downloaded-report.pdf"));
    assert.equal(
      fs
        .readFileSync(path.join(out, "downloaded-report.pdf"))
        .subarray(0, 5)
        .toString(),
      "%PDF-",
    );
    pass("Student sees their actual submitted PDF and ZIP");
    await page.screenshot({
      path: path.join(out, "02-sinhvien-bainop.png"),
      fullPage: true,
    });
    page = await open(
      "sv08",
      `/guidance/tasks/${fixture.guidance.sv08.taskId}/submissions`,
      "guidance",
    );
    await expect(
      page.getByLabel("Công việc đã thực hiện", { exact: true }),
    ).toHaveValue(
      "Đang hoàn thiện mô hình dữ liệu; đây là bản nháp chưa nộp chính thức.",
      { timeout: 60000 },
    );
    pass(
      "Student's draft is loaded from the database in a fresh authenticated browser context",
    );
    page = await open("gv03", "/guidance/weeks", "guidance");
    await expect(page.locator("tbody")).toContainText("MAU18-SV11");
    await page.getByLabel("Tuần", { exact: true }).selectOption(periodId);
    await expect(page.locator("tbody")).toContainText("MAU18-SV11", {
      timeout: 60000,
    });
    await expect(page.locator("tbody tr")).toHaveCount(3);
    await expect(page.locator("tbody")).not.toContainText("MAU18-SV12");
    pass(
      "Advisor sees only their three assigned students in the same selected term",
    );
    page = await open("giaovu", "/topic/reviews", "proposal");
    await expect(page.locator("tbody tr")).toHaveCount(12, { timeout: 60000 });
    await expect(page.locator("body")).toContainText("MAU18-SV01");
    pass(
      "Proposal review screen loads the other sample term with 12 proposals",
    );
    await page.screenshot({
      path: path.join(out, "03-decuong-xetduyet.png"),
      fullPage: true,
    });
    page = await open(
      "giaovu",
      `/terms/${id("term/registration")}/roster`,
      "registration",
    );
    await expect(page.getByLabel("Đợt làm việc", { exact: true })).toHaveValue(
      id("term/registration"),
      { timeout: 60000 },
    );
    await expect(page.locator("body")).toContainText("MAU18-SV01", {
      timeout: 60000,
    });
    await page
      .getByRole("button", { name: "Giảng viên & quota", exact: true })
      .click();
    await expect(page.locator("body")).toContainText("MAU18-GV01");
    pass("Step 1 roster uses the same sample student and lecturer catalogue");
    page = await open("giaovu", "/registration/list", "registration");
    await expect(page.getByLabel("Đợt làm việc", { exact: true })).toHaveValue(
      id("term/registration"),
      { timeout: 60000 },
    );
    await expect(page.locator("body")).toContainText("MAU18-SV09", {
      timeout: 60000,
    });
    pass("Step 2 registration screen loads the open registration sample");
    page = await open("giaovu", "/registration/result", "proposal");
    await expect(page.getByLabel("Đợt làm việc", { exact: true })).toHaveValue(
      id("term/proposal"),
      { timeout: 60000 },
    );
    await expect(page.locator("body")).toContainText("12 bản ghi");
    await expect(page.locator("tbody tr")).toHaveCount(8);
    if (!(await page.locator("tbody").textContent()).includes("MAU18-SV01"))
      await page
        .getByRole("button", { name: "Trang sau", exact: true })
        .click();
    await expect(page.locator("tbody")).toContainText("MAU18-SV01");
    pass("Step 3 official assignment results display sample students");
    page = await open("giaovu", "/topic/review-groups", "proposal");
    await expect(page.locator("tbody tr")).toHaveCount(2, { timeout: 60000 });
    await expect(page.locator("body")).toContainText("[MẪU] Nhóm xét duyệt 1");
    pass("Step 4 review groups contain the two owned groups");
    const proposalPeople = fixture.stages.proposal;
    page = await open(
      "sv01",
      `/topic/proposal/${proposalPeople[0].proposalId}`,
      "proposal",
    );
    await expect(page.getByLabel("Mục tiêu", { exact: true })).toBeEditable({
      timeout: 60000,
    });
    await expect(page.getByLabel("Mục tiêu", { exact: true })).not.toHaveValue(
      "",
    );
    pass("Step 6 student proposal has editable content in the correct term");
    page = await open(
      "giaovu",
      `/topic/dossier/${proposalPeople[10].proposalId}`,
      "proposal",
    );
    await expect(
      page.getByRole("button", {
        name: "Chốt đề cương chính thức",
        exact: true,
      }),
    ).toBeEnabled({ timeout: 60000 });
    page = await open(
      "giaovu",
      `/topic/dossier/${proposalPeople[11].proposalId}`,
      "proposal",
    );
    await expect(
      page.getByLabel("Ghi chú tiếp nhận", { exact: true }),
    ).toBeVisible({ timeout: 60000 });
    pass("Step 7 has separate ready-to-finalize and ready-to-receive dossiers");
    assert.deepEqual(result.errors, [], "Browser/API errors");
  } catch (error) {
    result.failure = error.message;
    throw error;
  } finally {
    if (lastPage)
      await lastPage
        .screenshot({ path: path.join(out, "last-screen.png"), fullPage: true })
        .catch(() => {});
    fs.writeFileSync(
      path.join(out, "result.json"),
      JSON.stringify(result, null, 2),
    );
    for (const context of contexts) await context.close();
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
