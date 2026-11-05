"use strict";
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");

// Real browser, real login, real API and private files; no request interception.
exports.runWeeklyBrowser = async function ({ db, base, pdf, zip }) {
  const root = path.resolve(__dirname, "../../.."),
    origin = "http://127.0.0.1:50186";
  const evidence = path.join(
    root,
    "docs/implementation/evidence/weekly-progress",
  );
  fs.mkdirSync(evidence, { recursive: true });
  const vite = spawn(
    process.execPath,
    [
      path.join(root, "frontend/node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      "50186",
      "--strictPort",
    ],
    {
      cwd: path.join(root, "frontend"),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, VITE_AUTH_API: "true", VITE_API_URL: base },
    },
  );
  let logs = "",
    browser;
  vite.stdout.on("data", (b) => (logs += b));
  vite.stderr.on("data", (b) => (logs += b));
  const errors = [],
    pages = [];
  try {
    for (let i = 0; ; i++) {
      try {
        if ((await fetch(origin)).ok) break;
      } catch {}
      if (i > 120 || vite.exitCode !== null)
        throw Error("Vite unavailable: " + logs);
      await new Promise((r) => setTimeout(r, 250));
    }
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const password = crypto.randomBytes(20).toString("hex") + "A1!";
    const passwordHash = await require("bcryptjs").hash(password, 10);
    async function login(id) {
      const account = await db.userAccount.update({
        where: { id },
        data: { passwordHash, mustChangePassword: false },
      });
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      const page = await context.newPage();
      pages.push(page);
      page.setDefaultTimeout(20000);
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => {
        if (r.url().startsWith(base) && r.status() >= 500)
          errors.push(`${r.status()} ${new URL(r.url()).pathname}`);
      });
      page.on("dialog", (d) =>
        d.accept(
          d.type() === "prompt"
            ? "Công bố tuần kiểm thử trình duyệt"
            : undefined,
        ),
      );
      await page.goto(origin + "/login");
      await page
        .getByPlaceholder("Ví dụ: 221230001 hoặc gv001")
        .fill(account.username);
      await page.getByPlaceholder("Nhập mật khẩu").fill(password);
      await page
        .getByRole("button", { name: "Đăng nhập hệ thống", exact: true })
        .click();
      await page.waitForURL((u) => !u.pathname.includes("login"));
      return page;
    }
    async function mutation(page, suffix, action, method = "POST") {
      const pending = page.waitForResponse(
        (r) => r.url().endsWith(suffix) && r.request().method() === method,
      );
      await action();
      const response = await pending;
      const body = await response.json();
      assert(
        response.ok(),
        `${method} ${suffix}: ${response.status()} ${JSON.stringify(body)}`,
      );
      return body.data;
    }
    const faculty = await login("f"),
      lecturer = await login("b"),
      student = await login("s2");
    const now = Date.now(),
      local = (offset) =>
        new Date(now + offset + 7 * 3600000).toISOString().slice(0, 16);
    await faculty.goto(origin + "/guidance/weeks?termId=t1");
    await faculty
      .getByRole("button", { name: "Tạo tuần", exact: true })
      .click();
    const ordinal =
      1 +
      (
        await db.guidancePeriod.aggregate({
          where: { termId: "t1", type: "WEEK" },
          _max: { ordinal: true },
        })
      )._max.ordinal;
    await faculty.locator('[name="ordinal"]').fill(String(ordinal));
    const label = `Browser weekly flow ${ordinal}`;
    await faculty.locator('[name="label"]').fill(label);
    await faculty
      .locator('textarea[name="description"]')
      .fill("Kế hoạch kiểm thử trình duyệt thật");
    await faculty.locator('[name="startsAt"]').fill(local(-120000));
    await faculty.locator('[name="endsAt"]').fill(local(7200000));
    await faculty.locator('[name="reportDueAt"]').fill(local(3600000));
    const week = await mutation(faculty, "/terms/t1/weekly-plans", () =>
      faculty
        .getByRole("button", { name: "Lưu kế hoạch tuần", exact: true })
        .click(),
    );
    const article = faculty.locator("article").filter({ hasText: label });
    await mutation(faculty, `/terms/t1/weekly-plans/${week.id}/state`, () =>
      article.getByRole("button", { name: "Công bố / mở tuần" }).click(),
    );

    await lecturer.goto(origin + "/guidance/plan/p2/tasks/new");
    await lecturer
      .getByLabel("Tên nhiệm vụ", { exact: true })
      .fill("Browser assigned implementation");
    await lecturer
      .getByLabel("Tiêu chí hoàn thành", { exact: true })
      .fill("API hoạt động và có kiểm thử");
    await lecturer.getByLabel("Ưu tiên", { exact: true }).selectOption("1");
    await lecturer
      .getByLabel("Mô tả nhiệm vụ", { exact: true })
      .fill("Hoàn thiện báo cáo tuần");
    await lecturer
      .getByLabel("Sản phẩm dự kiến", { exact: true })
      .fill("Báo cáo và mã nguồn");
    await lecturer
      .getByLabel("Mốc nhiệm vụ", { exact: true })
      .selectOption(week.id);
    await lecturer
      .getByLabel("Ngày bắt đầu", { exact: true })
      .fill(local(-60000));
    await lecturer
      .getByLabel("Hạn hoàn thành", { exact: true })
      .fill(local(3600000));
    await lecturer
      .locator("form")
      .getByRole("button", { name: /Giao nhiệm vụ|Lưu nhiệm vụ/ })
      .click();
    await lecturer.waitForURL(/\/guidance\/tasks\/[^/]+\?saved=created/);

    await student.goto(origin + "/guidance/tasks?termId=t1");
    const task = await mutation(student, "/task", () =>
      student
        .getByRole("button", { name: `Tạo nhiệm vụ cho ${label}`, exact: true })
        .click(),
    );
    const reportUrl = origin + `/guidance/tasks/${task.id}/submissions`;
    async function fillReport() {
      for (const [label, value] of [
        ["Công việc được giao", "Xây dựng API"],
        ["Công việc đã thực hiện", "Đã triển khai API"],
        ["Kết quả đạt được", "Kiểm thử thành công"],
        ["Dự kiến công việc tiếp theo", "Hoàn thiện giao diện"],
      ])
        await student.getByLabel(label, { exact: true }).fill(value);
    }
    async function submit() {
      await student
        .getByLabel("Báo cáo PDF", { exact: true })
        .setInputFiles({
          name: "report.pdf",
          mimeType: "application/pdf",
          buffer: pdf,
        });
      await student
        .getByLabel("Mã nguồn ZIP", { exact: true })
        .setInputFiles({
          name: "source.zip",
          mimeType: "application/zip",
          buffer: zip,
        });
      await student
        .getByRole("button", { name: "Tải file lên", exact: true })
        .click();
      await expect(
        student.getByRole("button", { name: "Xác nhận nộp", exact: true }),
      ).toBeEnabled();
      return mutation(student, `/tasks/${task.id}/submissions`, () =>
        student
          .getByRole("button", { name: "Xác nhận nộp", exact: true })
          .click(),
      );
    }
    async function review(submission, decision) {
      await lecturer.goto(origin + `/guidance/review/${submission.id}`);
      await lecturer
        .getByLabel("Kết quả đánh giá", { exact: true })
        .selectOption(decision);
      await lecturer
        .getByLabel("Nhận xét đánh giá", { exact: true })
        .fill(
          decision === "PASS" ? "Đã đạt yêu cầu" : "Bổ sung kiểm thử giao diện",
        );
      if (decision === "REVISION_REQUIRED")
        await lecturer
          .getByLabel("Hạn sửa", { exact: true })
          .fill(local(5400000));
      await mutation(
        lecturer,
        `/task-submissions/${submission.id}/reviews`,
        () =>
          lecturer
            .getByRole("button", { name: "Ghi nhận đánh giá", exact: true })
            .click(),
      );
    }
    await student.goto(reportUrl);
    await fillReport();
    await mutation(
      student,
      `/tasks/${task.id}/draft`,
      () =>
        student.getByRole("button", { name: "Lưu nháp", exact: true }).click(),
      "PUT",
    );
    await student.reload();
    await expect(
      student.getByLabel("Công việc đã thực hiện", { exact: true }),
    ).toHaveValue("Đã triển khai API");
    const v1 = await submit();
    await review(v1, "REVISION_REQUIRED");
    await student.goto(reportUrl);
    await fillReport();
    await student
      .getByLabel("Giải trình thay đổi", { exact: true })
      .fill("Đã bổ sung kiểm thử giao diện");
    const v2 = await submit();
    assert.equal(v2.versionNumber, 2);
    await review(v2, "PASS");
    await student.goto(reportUrl);
    await expect(
      student.getByRole("button", { name: "Xác nhận nộp", exact: true }),
    ).toHaveCount(0);
    await faculty.goto(origin + "/guidance/weeks?termId=t1");
    await faculty.getByLabel("Tuần", { exact: true }).selectOption(week.id);
    await expect(faculty.getByText(/Đạt: 1/)).toBeVisible();
    await faculty.screenshot({
      path: path.join(evidence, "faculty-summary.png"),
      fullPage: true,
    });
    await student.screenshot({
      path: path.join(evidence, "student-history.png"),
      fullPage: true,
    });
    assert.equal(
      await db.taskSubmission.count({ where: { taskId: task.id } }),
      2,
    );
    assert.equal(
      await db.progressReview.count({
        where: { submissionId: { in: [v1.id, v2.id] } },
      }),
      2,
    );
    assert.deepEqual(errors, []);
  } catch (e) {
    for (let i = 0; i < pages.length; i++)
      await pages[i]
        .screenshot({
          path: path.join(evidence, `failure-${i}.png`),
          fullPage: true,
        })
        .catch(() => {});
    throw e;
  } finally {
    await browser?.close();
    vite.kill();
  }
};
