"use strict";
// Operate the real UI at port 5173; no mocked responses, one owned demo term.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");
const root = path.resolve(__dirname, "../.."),
  marker = path.join(root, ".cache/integration-ui/workflow-demo.json");
const fixture = JSON.parse(fs.readFileSync(marker, "utf8"));
assert.equal(fixture.code, "UI-DEMO-48-20261027");
assert(fixture.syntheticOnly && fixture.producerReady);
const origin = "http://127.0.0.1:5173",
  api = "http://127.0.0.1:3000/api";
const out = path.join(
    root,
    "docs/implementation/evidence/ui-workflow-data-2026-10-27",
  ),
  samples = path.join(root, ".cache/integration-ui/sample-files");
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(samples, { recursive: true });
const save = () => fs.writeFileSync(marker, JSON.stringify(fixture, null, 2));
async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const pages = new Map(),
    result = {
      startedAt: new Date().toISOString(),
      origin,
      api,
      termId: fixture.termId,
      mockedResponses: false,
      checks: [],
      pageErrors: [],
      serverErrors: [],
    };
  let lastPage;
  const pass = (name, actual) => {
    result.checks.push({ name, actual, result: "PASS" });
    console.log("PASS " + name);
  };
  const once = async (name, fn) => {
    if (fixture.setupActions[name]) return fixture.setupActions[name];
    const data = await fn();
    fixture.setupActions[name] = data ?? { done: true };
    save();
    return data;
  };
  async function open(actor, route) {
    let page = pages.get(actor);
    if (!page) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        acceptDownloads: true,
      });
      await context.route("**/*", (route) => {
        const u = new URL(route.request().url());
        return [origin, new URL(api).origin].includes(u.origin) ||
          !["http:", "https:"].includes(u.protocol)
          ? route.continue()
          : route.abort();
      });
      page = await context.newPage();
      pages.set(actor, page);
      page.on("pageerror", (e) => result.pageErrors.push(e.message));
      page.on("response", (r) => {
        if (r.url().startsWith(api) && r.status() >= 500)
          result.serverErrors.push({
            route: new URL(r.url()).pathname,
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
      await page.evaluate(
        (termId) =>
          sessionStorage.setItem("utc-workspace", JSON.stringify({ termId })),
        fixture.termId,
      );
    }
    lastPage = page;
    await page.goto(
      origin +
        route +
        (route.includes("?") ? "&" : "?") +
        "termId=" +
        fixture.termId,
    );
    return page;
  }
  async function command(page, route, action, method = "POST") {
    const pending = page.waitForResponse(
      (r) =>
        r.url().split("?")[0] === api + route &&
        r.request().method() === method,
    );
    await action();
    const response = await pending,
      value = await response.json();
    assert(
      response.ok(),
      route + ": " + response.status() + " " + (value.error?.message ?? ""),
    );
    return value.data;
  }
  try {
    const group = await once("group", async () => {
      const p = await open("giaovu", "/topic/review-groups/new");
      await p
        .getByLabel("Đợt tạo nhóm", { exact: true })
        .selectOption(fixture.termId);
      await p
        .getByLabel("Tên nhóm", { exact: true })
        .fill("Nhóm duyệt DEMO 4–8 · Công nghệ phần mềm");
      await p
        .getByLabel("Bộ môn", { exact: true })
        .selectOption(fixture.departmentId);
      for (const actor of ["gv003", "gv004"]) {
        const lecturer = fixture.lecturers.find((l) => l.username === actor);
        await p
          .getByRole("checkbox", { name: new RegExp(lecturer.code) })
          .check();
      }
      return command(p, "/terms/" + fixture.termId + "/review-groups", () =>
        p.getByRole("button", { name: "Tạo nhóm duyệt", exact: true }).click(),
      );
    });
    fixture.groupId = group.id;
    save();
    pass("Bước 4: tạo nhóm thật với hai thành viên roster qua UI", group.id);
    for (const person of fixture.people) {
      const review = await once("assignment-" + person.username, async () => {
        const p = await open(
          "giaovu",
          "/topic/review-assignments/" + person.proposalId,
        );
        await p.getByLabel("Nhóm nhận đề cương").selectOption(group.id);
        return command(
          p,
          "/proposals/" + person.proposalId + "/review-assignments",
          () =>
            p
              .getByRole("button", { name: "Xác nhận phân công", exact: true })
              .click(),
        );
      });
      person.reviewId = review.id;
      save();
      if (person.username === "sv002") {
        pass(
          "Bước 5: giữ hồ sơ sv002 chờ nhóm duyệt để người dùng thao tác",
          review.id,
        );
        continue;
      }
      await once("start-" + person.username, async () => {
        const p = await open("gv003", "/topic/reviews/" + review.id);
        return command(p, "/proposal-reviews/" + review.id + "/start", () =>
          p.getByRole("button", { name: /^Bắt đầu duyệt phiên bản/ }).click(),
        );
      });
      const decision =
        person.username === "sv001" ? "REVISION_REQUIRED" : "APPROVED";
      await once("decision-" + person.username, async () => {
        const p = await open("gv003", "/topic/reviews/" + review.id);
        await p.getByLabel("Kết quả chung").selectOption(decision);
        await p
          .getByLabel("Nhận xét kết luận")
          .fill(
            decision === "REVISION_REQUIRED"
              ? "Bổ sung mục tiêu đo được và kế hoạch kiểm thử. Dữ liệu demo để sinh viên chỉnh sửa, phản hồi và nộp lại."
              : "Đề cương rõ mục tiêu, đủ phạm vi và kế hoạch thực hiện; đồng ý thông qua.",
          );
        return command(p, "/proposal-reviews/" + review.id + "/decision", () =>
          p.getByRole("button", { name: "Xác nhận kết luận chung" }).click(),
        );
      });
      pass(person.username + ": lưu kết luận qua UI", decision);
    }
    const student1 = fixture.people.find((p) => p.username === "sv001"),
      student3 = fixture.people.find((p) => p.username === "sv003"),
      student4 = fixture.people.find((p) => p.username === "sv004");
    const editing = await open(
      "sv001",
      "/topic/proposal/" + student1.proposalId,
    );
    await expect(
      editing.getByLabel("Mục tiêu", { exact: true }),
    ).toBeEditable();
    await expect(
      editing.getByRole("button", { name: "Lưu nháp mới", exact: true }),
    ).toBeEnabled();
    await editing.screenshot({
      path: path.join(out, "step6-student-editable.png"),
      fullPage: true,
    });
    pass(
      "Bước 6: sv001 có dữ liệu và được phép sửa/phản hồi/nộp lại",
      student1.proposalId,
    );
    const waiting = await open(
      "giaovu",
      "/topic/dossier/" + student3.proposalId,
    );
    await expect(
      waiting.getByRole("button", {
        name: "Chốt đề cương chính thức",
        exact: true,
      }),
    ).toBeEnabled();
    await waiting.screenshot({
      path: path.join(out, "step7-ready-to-finalize.png"),
      fullPage: true,
    });
    pass(
      "Bước 7: sv003 đã duyệt, giữ nút chốt cho người dùng tự thử",
      student3.proposalId,
    );
    await once("finalize-sv004", async () => {
      const p = await open("giaovu", "/topic/dossier/" + student4.proposalId);
      return command(p, "/proposals/" + student4.proposalId + "/finalize", () =>
        p
          .getByRole("button", {
            name: "Chốt đề cương chính thức",
            exact: true,
          })
          .click(),
      );
    });
    const p = await open("sv004", "/topic/dossier/" + student4.proposalId);
    const downloading = p.waitForEvent("download");
    await p
      .getByRole("button", { name: "Tải PDF để in và ký", exact: true })
      .click();
    await (await downloading).saveAs(path.join(samples, "bao-cao-demo.pdf"));
    const pdf = fs.readFileSync(path.join(samples, "bao-cao-demo.pdf"));
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    const {
      crc32,
    } = require("../../backend/dist/guidance/submissions/submission.validator");
    function zip() {
      const name = Buffer.from("src/main.ts"),
        content = Buffer.from("export const demo = 'Project1';"),
        crc = crc32(content),
        local = Buffer.alloc(30),
        central = Buffer.alloc(46),
        end = Buffer.alloc(22);
      local.writeUInt32LE(0x04034b50);
      local.writeUInt16LE(20, 4);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(content.length, 18);
      local.writeUInt32LE(content.length, 22);
      local.writeUInt16LE(name.length, 26);
      central.writeUInt32LE(0x02014b50);
      central.writeUInt16LE(20, 6);
      central.writeUInt32LE(crc, 16);
      central.writeUInt32LE(content.length, 20);
      central.writeUInt32LE(content.length, 24);
      central.writeUInt16LE(name.length, 28);
      end.writeUInt32LE(0x06054b50);
      end.writeUInt16LE(1, 8);
      end.writeUInt16LE(1, 10);
      end.writeUInt32LE(central.length + name.length, 12);
      end.writeUInt32LE(local.length + name.length + content.length, 16);
      return Buffer.concat([local, name, content, central, name, end]);
    }
    fs.writeFileSync(path.join(samples, "source-demo.zip"), zip());
    const plan = await once("guidance-plan", async () => {
      const a = await open("gv001", "/guidance/plan/" + student4.proposalId);
      await a
        .getByLabel("Mô tả kế hoạch", { exact: true })
        .fill(
          "Kế hoạch demo: phân tích yêu cầu, thiết kế dữ liệu, xây dựng API, kiểm thử và báo cáo tiến độ.",
        );
      return command(
        a,
        "/proposals/" + student4.proposalId + "/guidance-plan",
        () =>
          a
            .getByRole("button", {
              name: "Tạo kế hoạch hướng dẫn",
              exact: true,
            })
            .click(),
      );
    });
    fixture.planId = plan.id;
    save();
    const tasks = [
      ["todo", "DEMO — Phân tích yêu cầu (chưa nộp)", null],
      ["pending", "DEMO — Thiết kế cơ sở dữ liệu (chờ đánh giá)", null],
      ["revision", "DEMO — Hoàn thiện API (cần bổ sung)", "REVISION_REQUIRED"],
      ["completed", "DEMO — Khảo sát hệ thống (đã đạt)", "PASS"],
      ["overdue", "DEMO — Báo cáo tiến độ quá hạn", null],
    ];
    const localTime = (iso) =>
      new Date(Date.parse(iso) + 7 * 3600000).toISOString().slice(0, 16);
    for (const [kind, title, decision] of tasks) {
      const task = await once("task-" + kind, async () => {
        const a = await open(
          "gv001",
          "/guidance/plan/" + student4.proposalId + "/tasks/new",
        );
        await a.getByLabel("Tên nhiệm vụ", { exact: true }).fill(title);
        await a
          .getByLabel("Mô tả nhiệm vụ", { exact: true })
          .fill(
            "Dữ liệu demo để kiểm tra giao việc, nộp bài, đánh giá và lịch sử. Chỉ thao tác trên database local.",
          );
        await a
          .getByLabel("Sản phẩm dự kiến", { exact: true })
          .fill("Báo cáo PDF và mã nguồn ZIP");
        await a
          .getByLabel("Mốc nhiệm vụ", { exact: true })
          .selectOption(fixture.periodId);
        await a
          .getByLabel("Ngày bắt đầu", { exact: true })
          .fill(
            localTime(
              kind === "overdue" ? fixture.overdueStart : fixture.taskStart,
            ),
          );
        await a
          .getByLabel("Hạn hoàn thành", { exact: true })
          .fill(
            localTime(
              kind === "overdue" ? fixture.overdueDue : fixture.taskDue,
            ),
          );
        return command(a, "/guidance-plans/" + plan.id + "/tasks", () =>
          a.getByRole("button", { name: "Giao nhiệm vụ", exact: true }).click(),
        );
      });
      if (["todo", "overdue"].includes(kind)) continue;
      const submission = await once("submission-" + kind, async () => {
        const s = await open(
          "sv004",
          "/guidance/tasks/" + task.id + "/submissions",
        );
        await s
          .getByLabel("Báo cáo PDF", { exact: true })
          .setInputFiles(path.join(samples, "bao-cao-demo.pdf"));
        await s
          .getByLabel("Mã nguồn ZIP", { exact: true })
          .setInputFiles(path.join(samples, "source-demo.zip"));
        await s
          .getByLabel("Nội dung báo cáo bổ sung")
          .fill(
            "Báo cáo demo: đã hoàn thành phân tích, mô hình dữ liệu và kiểm thử chức năng của nhiệm vụ.",
          );
        await command(s, "/tasks/" + task.id + "/submission-uploads", () =>
          s.getByRole("button", { name: "Tải file lên", exact: true }).click(),
        );
        await expect(
          s.getByRole("status").filter({ hasText: "File đã tải lên staging" }),
        ).toBeVisible();
        return command(s, "/tasks/" + task.id + "/submissions", () =>
          s.getByRole("button", { name: "Xác nhận nộp", exact: true }).click(),
        );
      });
      if (decision)
        await once("progress-review-" + kind, async () => {
          const a = await open("gv001", "/guidance/review/" + submission.id);
          await a.getByLabel("Kết quả đánh giá").selectOption(decision);
          await a
            .getByLabel("Nhận xét đánh giá")
            .fill(
              decision === "PASS"
                ? "Đã đáp ứng yêu cầu; dữ liệu demo cho nhiệm vụ hoàn thành."
                : "Cần bổ sung sơ đồ dữ liệu và minh chứng kiểm thử. Sinh viên có thể nộp lại để kiểm tra luồng.",
            );
          return command(
            a,
            "/task-submissions/" + submission.id + "/reviews",
            () =>
              a
                .getByRole("button", { name: "Ghi nhận đánh giá", exact: true })
                .click(),
          );
        });
    }
    pass(
      "Bước 8A–8C: 5 nhiệm vụ và 3 bài nộp được tạo qua giao diện thật",
      "TODO, SUBMITTED, REVISION_REQUESTED, COMPLETED và quá hạn",
    );
    await once("meeting", async () => {
      const a = await open("gv001", "/guidance/meetings?planId=" + plan.id);
      await a
        .getByLabel("Thời gian buổi hướng dẫn")
        .fill(localTime(fixture.taskStart));
      await a.getByLabel("Hình thức hướng dẫn").selectOption("ONLINE");
      await a
        .getByLabel("Địa điểm hướng dẫn")
        .fill("Buổi hướng dẫn demo local");
      await a
        .getByLabel("Nội dung trao đổi")
        .fill(
          "Đối chiếu mục tiêu, mô hình dữ liệu và kết quả kiểm thử của sinh viên.",
        );
      await a
        .getByLabel("Kết luận hướng dẫn")
        .fill(
          "Tiếp tục hoàn thiện API, bổ sung kiểm thử phân quyền và báo cáo tiến độ tuần.",
        );
      return command(a, "/guidance-plans/" + plan.id + "/meetings", () =>
        a
          .getByRole("button", { name: "Lưu buổi hướng dẫn", exact: true })
          .click(),
      );
    });
    pass("Bước 8C: lưu nhật ký buổi hướng dẫn qua UI", plan.id);
    const dashboard = await open("giaovu", "/guidance/progress");
    await expect(dashboard.locator('[data-metric="Tổng nhiệm vụ"]')).toHaveText(
      "5",
    );
    await expect(
      dashboard.locator('[data-metric="Đã hoàn thành (Đạt)"]'),
    ).toHaveText("1");
    await dashboard.screenshot({
      path: path.join(out, "after-faculty-dashboard.png"),
      fullPage: true,
    });
    pass(
      "Dashboard Khoa có thống kê thật và nghĩa vụ tuần chưa có task",
      "5 nhiệm vụ, 1 đạt",
    );
    const views = [
      ["giaovu", "/topic/review-groups", "after-step4-groups"],
      ["giaovu", "/topic/reviews", "after-step5-queue"],
      ["gv003", "/topic/reviews", "after-reviewer-queue"],
      ["sv004", "/guidance/tasks", "after-student-tasks"],
      ["gv001", "/guidance/review", "after-advisor-inbox"],
      ["sv004", "/notifications", "after-shared-inbox"],
    ];
    for (const [actor, route, name] of views) {
      const v = await open(actor, route);
      await v.waitForLoadState("networkidle");
      await v.screenshot({
        path: path.join(out, name + ".png"),
        fullPage: true,
      });
      assert(
        !/Chưa có đề cương|Chưa có nhóm duyệt|Chưa có nhiệm vụ hoặc kế hoạch phù hợp/.test(
          await v.locator("main").innerText(),
        ),
        actor + route + " unexpectedly empty",
      );
    }
    pass(
      "Danh sách nhóm/hồ sơ/tasks/inbox thật có dữ liệu",
      views.length + " màn",
    );
    assert.equal(result.pageErrors.length, 0);
    assert.equal(result.serverErrors.length, 0);
    fixture.browserComplete = true;
    fixture.completedAt = new Date().toISOString();
    save();
    result.result = "PASS";
  } catch (e) {
    result.result = "FAIL";
    result.failure = e.message;
    process.exitCode = 1;
    await lastPage
      ?.screenshot({
        path: path.join(out, "setup-failure.png"),
        fullPage: true,
      })
      .catch(() => {});
  } finally {
    result.finishedAt = new Date().toISOString();
    fs.writeFileSync(
      path.join(out, "browser-setup.json"),
      JSON.stringify(result, null, 2),
    );
    await browser.close();
    console.log("Local UI demo " + result.result);
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
