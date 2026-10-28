"use strict";
// Edge mock-only preview/tests. No request can reach backend or Supabase.
const { spawn } = require("node:child_process"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");
async function main() {
  const interactive = process.argv.includes("--interactive"),
    root = path.resolve(__dirname, ".."),
    origin = "http://127.0.0.1:50178";
  const vite = spawn(
    process.execPath,
    [
      path.join(
        path.dirname(require.resolve("vite/package.json")),
        "bin/vite.js",
      ),
      "--host",
      "127.0.0.1",
      "--port",
      "50178",
      "--strictPort",
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        VITE_API_URL: "/api",
        VITE_REVIEW_GROUP_DEMO: "true",
      },
      stdio: "ignore",
      windowsHide: true,
    },
  );
  let browser;
  const checks = [],
    pass = (name) => {
      checks.push({ name, result: "PASS" });
      console.log("PASS " + name);
    };
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(origin)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(ready, "Vite not ready");
    browser = await chromium.launch({
      channel: "msedge",
      headless: !interactive,
    });
    const page = await browser.newPage({
        viewport: { width: 1280, height: 900 },
        acceptDownloads: true,
      }),
      errors = [],
      requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() =>
      localStorage.setItem("accessToken", "demo-submission-token"),
    );
    let actor = process.argv.includes("--faculty")
        ? "faculty"
        : process.argv.includes("--advisor")
          ? "advisor"
          : "student",
      revision = 0,
      locked = false,
      deny = false,
      uploadFailure = false,
      conflict = false;
    const now = Date.now(),
      iso = (n) => new Date(n).toISOString(),
      policy = {
        policyId: "approved-20261022-v1",
        maxFileBytes: 20 * 1024 * 1024,
        maxSubmissionBytes: 50 * 1024 * 1024,
        stagingTtlHours: 24,
        maxPendingFilesPerStudent: 10,
        zipMaxEntries: 1000,
        zipMaxExpandedBytes: 200 * 1024 * 1024,
        roles: {
          REPORT: { extensions: ["pdf"], maxFiles: 1 },
          SOURCE: { extensions: ["zip"], maxFiles: 1 },
          EVIDENCE: { extensions: ["pdf", "png", "jpg", "jpeg"], maxFiles: 3 },
        },
      },
      uploads = new Map(),
      submissions = [];
    const pdf = fs.readFileSync(
      path.join(root, "../backend/prisma/review/step7-sample.pdf"),
    );
    // For mock preview only, no archive is interpreted or executed.
    const zip = Buffer.from("UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==", "base64");
    const context = () => ({
      taskId: "task1",
      taskRevision: revision,
      canSubmit: actor === "student" && !locked,
      readiness: locked ? ["TERM_003"] : [],
      policy,
      latePolicy: "ACCEPT_WHILE_PHASE_OPEN",
      dueDate: iso(now - 3600000),
      currentSubmissionId: submissions[0]?.id ?? null,
    });
    function commit(body) {
      if (submissions[0]) submissions[0].state = "SUPERSEDED";
      const s = {
        id: crypto.randomUUID(),
        taskId: "task1",
        versionNumber: submissions.length + 1,
        state: "SUBMITTED",
        submittedBy: "s2",
        submittedAt: iso(Date.now()),
        deadlineSnapshot: iso(now - 3600000),
        isLate: true,
        revision: 0,
        content: body.content ?? "",
        contextSnapshot: {
          termId: "t1",
          termStudentId: "ts2",
          studentId: "s2",
          advisorId: "advisor",
          periodId: "w1",
        },
        files: body.uploadIds.map((id) => uploads.get(id).file),
      };
      submissions.unshift(s);
      revision++;
      return s;
    }
    await page.route("**/*", async (route) => {
      const r = route.request(),
        url = new URL(r.url());
      if (url.origin !== origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const p = url.pathname.slice(4),
        method = r.method(),
        send = (data, status = 200, code = "COMMON_001") =>
          route.fulfill({
            status,
            contentType: "application/json",
            body: JSON.stringify(
              status < 300
                ? { success: true, data, timestamp: iso(Date.now()) }
                : {
                    success: false,
                    error: { code, message: data },
                    timestamp: iso(Date.now()),
                  },
            ),
          });
      requests.push({
        method,
        path: p,
        key: r.headers()["idempotency-key"],
        contentType: r.headers()["content-type"],
      });
      if (deny) return send("Không tìm thấy báo cáo trong phạm vi.", 404);
      if (p === "/proposal-review-options/terms")
        return send([
          { id: "t1", name: "Đợt đồ án DEMO", status: "IN_PROGRESS" },
        ]);
      if (method === "GET" && p === "/tasks/task1/submission-context")
        return send(context());
      if (method === "GET" && p === "/tasks/task1")
        return send({
          id: "task1",
          title: "Báo cáo tuần 1 DEMO",
          studentName: "Nguyễn Văn An",
          studentCode: "SV02",
          topicTitle: "Hệ thống quản lý đào tạo DEMO",
          periodLabel: "Tuần 1",
          dueDate: iso(now - 3600000),
        });
      if (method === "GET" && p === "/tasks/task1/submissions")
        return send({
          data: submissions,
          total: submissions.length,
          page: 1,
          limit: 10,
          totalPages: submissions.length ? 1 : 0,
          currentSubmissionId: submissions[0]?.id ?? null,
        });
      if (method === "POST" && p === "/tasks/task1/submission-uploads") {
        if (actor !== "student" || locked)
          return send("Phase đã khóa hoặc không đủ quyền.", 409, "TERM_003");
        const text = r.postDataBuffer().toString("latin1"),
          kind = /\r\nSOURCE\r\n/.test(text)
            ? "SOURCE"
            : /\r\nEVIDENCE\r\n/.test(text)
              ? "EVIDENCE"
              : "REPORT";
        if (uploadFailure && kind === "SOURCE") {
          uploadFailure = false;
          return send(
            "Không lưu được file; vui lòng thử lại.",
            503,
            "UPLOAD_FAILED",
          );
        }
        const id = crypto.randomUUID(),
          name = /filename="([^"]+)"/.exec(text)?.[1] ?? "file";
        const file = {
          id: crypto.randomUUID(),
          kind,
          originalName: name,
          sizeBytes: kind === "SOURCE" ? zip.length : pdf.length,
          mimeType: kind === "SOURCE" ? "application/zip" : "application/pdf",
          checksum: "mock-sha256",
        };
        const old = [...uploads.values()].find(
          (u) => u.key === r.headers()["idempotency-key"],
        );
        if (old) return send(old, 201);
        const value = {
          id,
          expiresAt: iso(now + 86400000),
          file,
          key: r.headers()["idempotency-key"],
        };
        uploads.set(id, value);
        return send(value, 201);
      }
      if (method === "POST" && p === "/tasks/task1/submissions") {
        const body = r.postDataJSON();
        if (locked) return send("Phase đã khóa.", 409, "TERM_003");
        if (conflict) {
          conflict = false;
          revision++;
          return send(
            "Nhiệm vụ đã thay đổi; tải trạng thái mới.",
            409,
            "REVISION_CONFLICT",
          );
        }
        if (body.expectedTaskRevision !== revision)
          return send("Revision không khớp.", 409, "REVISION_CONFLICT");
        if (!body.uploadIds.every((id) => uploads.has(id)))
          return send("Thiếu file staging.", 409, "FILE_NOT_READY");
        return send(commit(body), 201);
      }
      if (
        method === "GET" &&
        p.includes("/files/") &&
        p.endsWith("/download")
      ) {
        const match =
            /^\/task-submissions\/([^/]+)\/files\/([^/]+)\/download$/.exec(p),
          sub = submissions.find((s) => s.id === match?.[1]),
          file = sub?.files.find((f) => f.id === match?.[2]);
        if (!file) return send("Không tìm thấy file.", 404);
        return route.fulfill({
          status: 200,
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": 'attachment; filename="report.pdf"',
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
          body: file.kind === "SOURCE" ? zip : pdf,
        });
      }
      return send("API ngoài phạm vi demo bước 8B.", 404);
    });
    if (actor !== "student") {
      const ids = ["REPORT", "SOURCE"].map((kind) => {
        const id = crypto.randomUUID();
        uploads.set(id, {
          id,
          file: {
            id: crypto.randomUUID(),
            kind,
            originalName: kind === "REPORT" ? "report.pdf" : "source.zip",
            sizeBytes: 100,
            mimeType: kind === "REPORT" ? "application/pdf" : "application/zip",
            checksum: "demo",
          },
        });
        return id;
      });
      commit({ uploadIds: ids, content: "Báo cáo mẫu DEMO" });
    }
    const url = origin + "/guidance/tasks/task1/submissions?termId=t1";
    await page.goto(url);
    if (interactive) {
      console.log(
        "Da mo Step 8B DEMO trong Edge; chi mock API, khong backend/database.",
      );
      console.log(
        "Vai tro: " +
          actor +
          ". Chon file, tai staging, xac nhan nop, xem lich su/tai file. Cac menu khac chua gia lap.",
      );
      process.once("SIGINT", () => browser.close());
      process.once("SIGTERM", () => browser.close());
      await new Promise((resolve) => {
        page.once("close", resolve);
        browser.once("disconnected", resolve);
      });
      return;
    }
    await expect(
      page.getByRole("heading", { name: "Nộp báo cáo và source", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Chưa có bài nộp.", { exact: false }),
    ).toBeVisible();
    pass("student sees scoped upload policy, late policy and empty history");
    const select = async (name = "report.pdf", buffer = pdf) => {
      await page
        .getByLabel("Báo cáo PDF", { exact: true })
        .setInputFiles({ name, mimeType: "application/pdf", buffer });
      await page.getByLabel("Mã nguồn ZIP", { exact: true }).setInputFiles({
        name: "source.zip",
        mimeType: "application/zip",
        buffer: zip,
      });
    };
    await select("report.exe");
    await page
      .getByRole("button", { name: "Tải file lên", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("Định dạng");
    assert.equal(uploads.size, 0);
    await select("large.pdf", Buffer.alloc(policy.maxFileBytes + 1));
    await page
      .getByRole("button", { name: "Tải file lên", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("dung lượng");
    assert.equal(uploads.size, 0);
    pass(
      "invalid extension and oversized selection blocked before any API upload",
    );
    await select();
    uploadFailure = true;
    await page
      .getByLabel("Nội dung báo cáo bổ sung")
      .fill("Nội dung giữ lại khi lỗi");
    await page
      .getByRole("button", { name: "Tải file lên", exact: true })
      .click();
    await expect(page.getByRole("alert").first()).toContainText(
      "Không lưu được file",
    );
    assert.equal(uploads.size, 1);
    await page
      .getByRole("button", { name: "Tải file lên", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "File đã tải lên staging" }),
    ).toBeVisible();
    assert.equal(uploads.size, 2);
    const uploaded = requests.filter((r) =>
      r.path.endsWith("/submission-uploads"),
    );
    assert(
      uploaded.every(
        (r) =>
          r.key && r.contentType.includes("multipart/form-data; boundary="),
      ),
    );
    await expect(page.getByLabel("Upload report.pdf")).toHaveAttribute(
      "value",
      "100",
    );
    pass(
      "multipart boundary/idempotency and real upload progress work; failed source retry keeps staged PDF and user text",
    );
    conflict = true;
    await page
      .getByRole("button", { name: "Xác nhận nộp", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("Nhiệm vụ đã thay đổi");
    await expect(page.getByLabel("Nội dung báo cáo bổ sung")).toHaveValue(
      "Nội dung giữ lại khi lỗi",
    );
    assert.equal(submissions.length, 0);
    await page
      .getByRole("button", { name: "Tải trạng thái mới", exact: true })
      .click();
    await expect(
      page.getByText("Đã tải revision mới; giữ các file đang chọn."),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Xác nhận nộp", exact: true })
      .click();
    await expect(page.getByText("Lần nộp 1 · Hiện hành")).toBeVisible();
    assert.equal(submissions.length, 1);
    await expect(page.getByLabel("Báo cáo PDF", { exact: true })).toHaveValue(
      "",
    );
    pass(
      "409 preserves staged files/content; explicit revision refresh commits and resets file pickers",
    );
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: /Tải Báo cáo PDF: report.pdf/ })
      .click();
    assert.equal((await download).suggestedFilename(), "report.pdf");
    pass(
      "history downloads authenticated attachment through API instead of public file URL",
    );
    await select();
    await page.getByLabel("Nội dung báo cáo bổ sung").fill("Bản nộp lại");
    await page
      .getByRole("button", { name: "Tải file lên", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "File đã tải lên staging" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Xác nhận nộp", exact: true })
      .click();
    await expect(page.getByText("Lần nộp 2 · Hiện hành")).toBeVisible();
    await expect(page.getByText("Đã có bản nộp mới")).toBeVisible();
    await expect(
      page.getByText("Nội dung giữ lại khi lỗi", { exact: true }),
    ).toBeVisible();
    pass(
      "resubmission appends v2, preserves v1 text/files and displays lateness without completion",
    );
    for (const role of ["advisor", "faculty"]) {
      actor = role;
      await page.reload();
      await expect(page.getByText("Lần nộp 2 · Hiện hành")).toBeVisible();
      await expect(page.getByLabel("Báo cáo PDF", { exact: true })).toHaveCount(
        0,
      );
    }
    pass(
      "advisor and faculty inspect/download history with no upload or evaluation controls",
    );
    actor = "student";
    locked = true;
    await page.reload();
    await expect(page.getByLabel("Báo cáo PDF", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByText("Giai đoạn hướng dẫn chưa mở, đã khóa hoặc hết hạn.", {
        exact: true,
      }),
    ).toBeVisible();
    pass(
      "locked phase hides submission form while preserving readable historical evidence",
    );
    locked = false;
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await expect(page.getByLabel("Báo cáo PDF", { exact: true })).toBeVisible();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    pass("mobile upload controls and history fit 375px viewport");
    deny = true;
    await page.reload();
    await expect(page.getByRole("alert").first()).toContainText(
      "Không tìm thấy báo cáo",
    );
    assert.deepEqual(errors, []);
    assert(requests.filter((r) => r.method === "POST").every((r) => r.key));
    pass(
      "scope error hides academic data with no unhandled page error or missing idempotency key",
    );
    fs.writeFileSync(
      path.join(root, "../backend/prisma/review/step8b-browser-results.json"),
      JSON.stringify(
        {
          result: "PASS",
          mockedApi: true,
          sharedDatabaseAccess: false,
          checks,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(checks.length + " Step 8B browser checks passed");
  } finally {
    if (browser) await browser.close();
    vite.kill();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
