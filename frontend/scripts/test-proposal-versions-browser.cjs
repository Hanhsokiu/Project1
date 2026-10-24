"use strict";
// Mock-only Edge preview and browser tests. No backend/DB connection.
const { spawn } = require("node:child_process"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");
async function main() {
  const interactive = process.argv.includes("--interactive"),
    root = path.resolve(__dirname, ".."),
    origin = "http://127.0.0.1:50175";
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
      "50175",
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
    assert(ready, "Vite did not start");
    browser = await chromium.launch({
      channel: "msedge",
      headless: !interactive,
    });
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const unsupported = "API này không nằm trong bản demo bước 6.";
    await page.addInitScript(() =>
      localStorage.setItem("accessToken", "mock-preview-token"),
    );
    let actor = process.argv.includes("--advisor") ? "advisor" : "student",
      status = "REVISION_REQUESTED",
      revision = 3,
      workingId = "v1",
      submittedId = "v1",
      conflict = false,
      deny = false,
      saves = 0,
      submits = 0;
    const content = {
      schemaVersion: 1,
      objectives: "Mục tiêu cũ",
      scope: "Phạm vi cũ",
      mainContents: "Nội dung demo",
      tools: "Công nghệ demo",
      expectedResults: "Kết quả demo",
      startsAt: "2026-10-01T00:00:00+07:00",
      endsAt: "2027-01-01T00:00:00+07:00",
      schedule: [
        {
          label: "Nghiên cứu",
          startsAt: "2026-10-01T00:00:00+07:00",
          endsAt: "2026-11-01T00:00:00+07:00",
          deliverables: "Đề cương",
        },
      ],
    };
    const versions = new Map([
      [
        "v1",
        {
          id: "v1",
          proposalId: "p1",
          versionNumber: 1,
          state: "SEALED",
          content: structuredClone(content),
          contentHash: "demo-v1",
          createdAt: "2026-10-20T02:00:00Z",
          createdByUserId: "student",
          authorName: "Sinh viên demo",
          submittedAt: "2026-10-20T03:00:00Z",
          submittedByUserId: "student",
          basedOnVersionId: null,
          changeSummary: null,
          responses: [],
          provenance: null,
        },
      ],
    ]);
    const feedback = [
      {
        targetType: "DECISION",
        targetId: "d1",
        reviewId: "r1",
        sourceVersionId: "v1",
        versionNumber: 1,
        roundNumber: 1,
        authorUserId: "reviewer",
        authorName: "GV nhóm duyệt demo",
        text: "Bổ sung mục tiêu và phạm vi nghiên cứu",
        createdAt: "2026-10-21T09:00:00Z",
      },
    ];
    const context = () => ({
      proposalId: "p1",
      topicId: "topic1",
      termId: "t1",
      termStudentId: "ts1",
      title: "Đề cương demo chỉnh sửa",
      studentName: "Sinh viên demo",
      status,
      revision,
      workingVersionId: workingId,
      submittedVersionId: submittedId,
      workingVersion: versions.get(workingId),
      submittedVersion: versions.get(submittedId),
      feedback,
      allowedActions: ["DRAFT", "REVISION_REQUESTED"].includes(status)
        ? [
            "save",
            ...(actor === "student" &&
            status === "DRAFT" &&
            versions.get(workingId).state === "DRAFT"
              ? ["submit"]
              : []),
          ]
        : [],
      readiness: [],
      phase: {
        startsAt: "2020-01-01Z",
        endsAt: "2099-01-01Z",
        isLocked: false,
      },
    });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const p = url.pathname.slice(4),
        method = route.request().method(),
        send = (data, status = 200) =>
          route.fulfill({
            status,
            contentType: "application/json",
            body: JSON.stringify(
              status < 300
                ? { success: true, data, timestamp: new Date().toISOString() }
                : {
                    success: false,
                    error: {
                      code: status === 409 ? "REVISION_CONFLICT" : "COMMON_001",
                      message: data,
                    },
                  },
            ),
          });
      if (deny) return send("Không tìm thấy đề cương trong phạm vi.", 404);
      if (method === "GET" && p === "/proposal-review-options/terms")
        return send([
          { id: "t1", name: "Đợt demo 2026", status: "IN_PROGRESS" },
        ]);
      if (method === "GET" && p === "/terms/t1/proposals")
        return send({
          data: [
            {
              id: "p1",
              termId: "t1",
              title: "Đề cương demo chỉnh sửa",
              studentName: "Sinh viên demo",
              studentCode: "SV01",
              departmentId: null,
              departmentName: null,
              researchAreaName: null,
              status,
              revision,
              submittedVersionId: submittedId,
              versionNumber: versions.get(submittedId).versionNumber,
              activeReviewId: null,
              groupName: null,
              readiness: [],
              canAssign: false,
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        });
      if (method === "GET" && p === "/proposals/p1/editing-context")
        return send(context());
      if (method === "GET" && p === "/proposals/p1/versions/compare") {
        const a = versions.get(url.searchParams.get("fromVersionId")),
          b = versions.get(url.searchParams.get("toVersionId")),
          changes = [];
        if (!a || !b) return send("Không tìm thấy phiên bản", 404);
        for (const key of Object.keys(a.content))
          if (JSON.stringify(a.content[key]) !== JSON.stringify(b.content[key]))
            changes.push({
              path: "/content/" + key,
              before: a.content[key],
              after: b.content[key],
              beforeExists: true,
              afterExists: true,
            });
        if (JSON.stringify(a.responses) !== JSON.stringify(b.responses))
          changes.push({
            path: "/responses",
            before: a.responses,
            after: b.responses,
            beforeExists: true,
            afterExists: true,
          });
        return send({ fromVersionId: a.id, toVersionId: b.id, changes });
      }
      if (p === "/proposals/p1/versions" && method === "GET") {
        const data = [...versions.values()].sort(
          (a, b) => b.versionNumber - a.versionNumber,
        );
        return send({
          data,
          total: data.length,
          page: 1,
          limit: 20,
          totalPages: 1,
        });
      }
      const vMatch = /^\/proposals\/p1\/versions\/([^/]+)$/.exec(p);
      if (method === "GET" && vMatch)
        return versions.has(vMatch[1])
          ? send(versions.get(vMatch[1]))
          : send("Không tìm thấy phiên bản", 404);
      // Other sidebar modules are outside this demo. Never forward their API
      // requests or treat an unsupported GET as a write requiring a key/body.
      const save = method === "POST" && p === "/proposals/p1/versions",
        submit = method === "POST" && p === "/proposals/p1/submit";
      if (!save && !submit) return send(unsupported, 404);
      if (!route.request().headers()["idempotency-key"]?.trim())
        return send("Thiếu Idempotency-Key.", 400);
      let body;
      try {
        body = route.request().postDataJSON();
      } catch {
        return send("Request JSON không hợp lệ.", 400);
      }
      if (
        !body ||
        Array.isArray(body) ||
        !Number.isInteger(body.expectedRevision)
      )
        return send("Request phải có expectedRevision hợp lệ.", 400);
      if (conflict)
        return send("Có người khác đã lưu đề cương. Hãy tải lại.", 409);
      if (body.expectedRevision !== revision)
        return send("Có người khác đã lưu đề cương. Hãy tải lại.", 409);
      if (save) {
        if (!["DRAFT", "REVISION_REQUESTED"].includes(status))
          return send("Trạng thái hiện tại không cho phép lưu nháp.", 409);
        const baseId =
          status === "REVISION_REQUESTED" ? submittedId : workingId;
        if (body.basedOnVersionId != null && body.basedOnVersionId !== baseId)
          return send("Phiên bản nền đã thay đổi. Hãy tải lại.", 409);
        if (
          !body.content ||
          typeof body.content !== "object" ||
          Array.isArray(body.content) ||
          (body.responses != null && !Array.isArray(body.responses))
        )
          return send("Nội dung snapshot không hợp lệ.", 400);
        saves++;
        const n = versions.size + 1,
          id = "v" + n;
        const value = {
          id,
          proposalId: "p1",
          versionNumber: n,
          state: "DRAFT",
          content: structuredClone(body.content),
          contentHash: "demo-" + id,
          createdAt: new Date().toISOString(),
          createdByUserId: actor,
          authorName: actor === "advisor" ? "GVHD demo" : "Sinh viên demo",
          submittedAt: null,
          submittedByUserId: null,
          basedOnVersionId: baseId,
          changeSummary: body.changeSummary ?? null,
          responses: structuredClone(
            body.responses ?? versions.get(workingId).responses,
          ),
          provenance: null,
        };
        versions.set(id, value);
        workingId = id;
        revision++;
        status = "DRAFT";
        return send({ ...value, proposalRevision: revision }, 201);
      }
      if (submit) {
        if (actor !== "student") return send("Chỉ SV được gửi duyệt.", 403);
        if (
          status !== "DRAFT" ||
          body.versionId !== workingId ||
          versions.get(workingId).state !== "DRAFT"
        )
          return send("Phiên bản hoặc trạng thái gửi duyệt không hợp lệ.", 409);
        submits++;
        const sealed = {
          ...versions.get(workingId),
          state: "SEALED",
          submittedAt: new Date().toISOString(),
          submittedByUserId: actor,
        };
        versions.set(workingId, sealed);
        submittedId = workingId;
        status = "SUBMITTED";
        revision++;
        return send({ ...sealed, proposalRevision: revision });
      }
    });
    if (interactive) {
      process.once("SIGINT", () => browser.close());
      process.once("SIGTERM", () => browser.close());
      await page.goto(origin + "/topic/proposal/p1");
      console.log(
        "Da mo Step 6 trong Edge voi du lieu DEMO; khong ket noi backend/database.",
      );
      console.log(
        "Sua de cuong, phan hoi gop y, luu nhap, so sanh, xem lich su va gui duyet lai. Dong Edge hoac Ctrl+C de dung.",
      );
      console.log(
        actor === "advisor"
          ? "Che do GVHD: duoc luu nhap, khong duoc gui thay SV."
          : "Che do SV: duoc luu nhap va gui duyet lai.",
      );
      console.log(
        "Chi API buoc 6 duoc gia lap; cac muc khac co the hien loi ngoai pham vi demo. Quay lai De cuong & phien ban de tiep tuc.",
      );
      await new Promise((resolve) => {
        page.once("close", resolve);
        browser.once("disconnected", resolve);
      });
      return;
    }
    await page.goto(origin + "/topic/proposal");
    await page
      .getByRole("link", { name: "Phân công & xét duyệt", exact: true })
      .click();
    await expect(page.getByRole("alert").first()).toContainText(unsupported);
    await expect(
      page.getByRole("heading", { name: "Unexpected Application Error!" }),
    ).toHaveCount(0);
    await page
      .getByRole("link", { name: "Đề cương & phiên bản", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Mở đề cương & lịch sử" }),
    ).toBeVisible();
    assert.deepEqual(pageErrors, []);
    pass(
      "review queue navigation handles unsupported demo options without a render crash and can return to editor list",
    );
    await page
      .getByRole("link", { name: "Nhóm duyệt đề cương", exact: true })
      .click();
    await expect(page.getByRole("alert").first()).toContainText(unsupported);
    await page
      .getByRole("link", { name: "Đề cương & phiên bản", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Mở đề cương & lịch sử" }),
    ).toBeVisible();
    pass(
      "unsupported sidebar API returns a demo error; navigation back still works",
    );
    const request = (apiPath, options) =>
      page.evaluate(
        async ({ apiPath, options }) => {
          const response = await fetch("/api" + apiPath, options);
          return { status: response.status, body: await response.json() };
        },
        { apiPath, options },
      );
    for (const options of [undefined, { method: "POST" }]) {
      const response = await request("/unsupported-demo-endpoint", options);
      assert.equal(response.status, 404);
      assert.equal(response.body.error.message, unsupported);
    }
    assert.equal((await request("/proposals/p1/submit")).status, 404);
    pass(
      "unsupported reads/writes never enter mutation validation or reach a backend",
    );
    assert.equal(
      (await request("/proposals/p1/versions", { method: "POST" })).status,
      400,
    );
    const headers = {
      "Content-Type": "application/json",
      "Idempotency-Key": "demo-regression-key",
    };
    assert.equal(
      (
        await request("/proposals/p1/versions", {
          method: "POST",
          headers,
          body: "{",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request("/proposals/p1/versions", {
          method: "POST",
          headers,
          body: JSON.stringify({ expectedRevision: revision - 1 }),
        })
      ).status,
      409,
    );
    assert.equal(saves, 0);
    assert.equal(submits, 0);
    assert.equal(revision, 3);
    pass(
      "missing idempotency key, invalid JSON and stale revision return errors without stopping preview",
    );
    assert.equal(
      (
        await request(
          "/proposals/p1/versions/compare?fromVersionId=missing&toVersionId=v1",
        )
      ).status,
      404,
    );
    pass(
      "unknown comparison version returns 404 without crashing the route handler",
    );
    await page.getByRole("link", { name: "Mở đề cương & lịch sử" }).click();
    await expect(page.getByLabel("Mục tiêu", { exact: true })).toHaveValue(
      "Mục tiêu cũ",
    );
    await expect(
      page.getByText("Bổ sung mục tiêu và phạm vi nghiên cứu", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Gửi duyệt lại", exact: true }),
    ).toHaveCount(0);
    pass(
      "returned v1 loads with exact feedback and no submit before a new snapshot is saved",
    );
    await page
      .getByLabel("Mục tiêu", { exact: true })
      .fill("Mục tiêu đã chỉnh sửa");
    await page
      .getByLabel("Phản hồi DECISION d1", { exact: true })
      .fill("Đã bổ sung theo góp ý");
    await page.getByLabel("Tóm tắt thay đổi").fill("Điều chỉnh mục tiêu");
    await page
      .getByRole("button", { name: "Lưu nháp mới", exact: true })
      .click();
    await expect(
      page.getByText("Đã lưu snapshot v2. Chưa gửi duyệt.", { exact: true }),
    ).toBeVisible();
    assert.equal(versions.get("v1").content.objectives, "Mục tiêu cũ");
    assert.equal(versions.get("v2").responses[0].targetId, "d1");
    pass("save creates v2 with response/summary, preserving v1");
    await page.getByLabel("Bản trước", { exact: true }).selectOption("v1");
    await page.getByLabel("Bản sau", { exact: true }).selectOption("v2");
    await expect(
      page.getByText("/content/objectives", { exact: true }),
    ).toBeVisible();
    pass("comparison displays actual changed field path and values");
    await page
      .getByRole("link", { name: "Phiên bản v1 · SEALED", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Đang xem phiên bản lịch sử v1 — chỉ đọc",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Lưu nháp mới", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("link", { name: "Trở lại bản làm việc", exact: true })
      .click();
    pass("historical version is rendered as read-only without edit controls");
    await page
      .getByRole("button", { name: "Gửi duyệt lại", exact: true })
      .click();
    await expect(
      page.getByText(
        "Đã gửi duyệt phiên bản v2. Snapshot đã SEALED; chờ Khoa phân nhóm.",
        { exact: true },
      ),
    ).toBeVisible();
    assert.equal(versions.get("v2").state, "SEALED");
    assert.equal(submits, 1);
    await expect(
      page.getByRole("button", { name: "Lưu nháp mới", exact: true }),
    ).toHaveCount(0);
    pass(
      "student submits exactly v2; sealed/submitted state hides editing controls",
    );
    status = "REVISION_REQUESTED";
    revision++;
    // Simulate a reviewer returning the proposal in another session. Re-enter
    // through SPA links so QueryClient survives; page.goto would hide stale cache.
    await page.getByRole("link", { name: "← Danh sách đề cương", exact: true }).click();
    await page.getByRole("link", { name: "Mở đề cương & lịch sử" }).click();
    await expect(page.getByRole("button", { name: "Lưu nháp mới", exact: true })).toBeVisible();
    pass("SPA re-entry observes external revision request instead of five-minute cached submitted state");
    await page
      .getByLabel("Mục tiêu", { exact: true })
      .fill("Bản sửa chưa lưu do conflict");
    conflict = true;
    await page
      .getByRole("button", { name: "Lưu nháp mới", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("Có người khác đã lưu");
    await expect(page.getByLabel("Mục tiêu", { exact: true })).toHaveValue(
      "Bản sửa chưa lưu do conflict",
    );
    assert.equal(saves, 1);
    pass("concurrent edit conflict preserves unsaved form content");
    conflict = false;
    await page.getByLabel("Phạm vi", { exact: true }).fill("");
    await page
      .getByRole("button", { name: "Lưu nháp mới", exact: true })
      .click();
    await expect(
      page.getByText("Đã lưu snapshot v3. Chưa gửi duyệt.", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Gửi duyệt lại", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("scope");
    assert.equal(submits, 1);
    pass(
      "incomplete draft can save but frontend blocks resubmission until content is valid",
    );
    actor = "advisor";
    await page.goto(origin + "/topic/proposal/p1");
    await expect(
      page.getByRole("button", { name: "Lưu nháp mới", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Gửi duyệt lại", exact: true }),
    ).toHaveCount(0);
    pass("advisor can save but cannot submit as student");
    await page.setViewportSize({ width: 375, height: 812 });
    await expect
      .poll(async () => (await page.locator(".rg-sidebar").boundingBox()).x)
      .toBeLessThanOrEqual(-259);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    pass("mobile editor and history have no horizontal page overflow");
    deny = true;
    await page.goto(origin + "/topic/proposal/p1");
    await expect(page.getByRole("alert").first()).toContainText(
      "Không tìm thấy đề cương",
    );
    await expect(page.getByLabel("Mục tiêu", { exact: true })).toHaveCount(0);
    pass("scope error hides all editor content");
    assert.deepEqual(
      pageErrors,
      [],
      "Browser must not have unhandled application errors",
    );
    fs.writeFileSync(
      path.resolve(root, "../backend/prisma/review/step6-browser-results.json"),
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
    console.log(`${checks.length} Step 6 browser checks passed`);
  } finally {
    if (browser) await browser.close();
    vite.kill();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
