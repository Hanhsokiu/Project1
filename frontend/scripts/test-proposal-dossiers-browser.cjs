"use strict";
// Mock-only interactive Step 7 preview and browser regression. No backend/DB.
const { spawn } = require("node:child_process"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");
async function main() {
  const interactive = process.argv.includes("--interactive"),
    root = path.resolve(__dirname, ".."),
    origin = "http://127.0.0.1:50176";
  const sample = fs.readFileSync(
    path.join(root, "../backend/prisma/review/step7-sample.pdf"),
  );
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
      "50176",
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
        acceptDownloads: true,
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() =>
      localStorage.setItem("accessToken", "mock-demo-token"),
    );
    let actor = process.argv.includes("--student") ? "student" : "faculty",
      state = actor === "student" ? "FINALIZED" : "DRAFT",
      revision = actor === "student" ? 1 : 0,
      generated = false,
      missingProfile = false,
      deny = false,
      conflict = false,
      finalizes = 0,
      receipts = 0;
    const now = "2026-10-22T09:00:00Z",
      finalizationId = "demo-finalization",
      snapshot = {
        schemaVersion: 1,
        title: "Synthetic proposal 2",
        termName: "Đợt demo 2026",
        student: {
          id: "s2",
          name: "s2",
          code: "s2",
          className: "Công nghệ thông tin K63",
          majorName: "Khoa học máy tính",
          trainingSystem: "Synthetic training",
        },
        advisor: { id: "advisor", name: "advisor", department: "Bộ môn 1" },
        academicProfileRevision: 1,
        assignmentId: "demo-assignment",
        assignmentRevision: 0,
        topicRevision: 0,
        content: {
          schemaVersion: 1,
          objectives: "Mục tiêu nghiên cứu tiếng Việt",
          scope: "Phạm vi hệ thống quản lý",
          mainContents: "Nội dung đề cương chính thức",
          tools: "TypeScript và PostgreSQL",
          expectedResults: "Phần mềm và báo cáo",
          startsAt: "2026-10-01T00:00:00+07:00",
          endsAt: "2027-01-01T00:00:00+07:00",
          schedule: [
            {
              label: "Nghiên cứu và phân tích yêu cầu",
              startsAt: "2026-10-01T00:00:00+07:00",
              endsAt: "2026-11-01T00:00:00+07:00",
              deliverables: "Đề cương hoàn chỉnh",
            },
          ],
        },
      };
    const view = () => ({
      proposalId: "p2",
      title: snapshot.title,
      proposalStatus: "APPROVED",
      proposalRevision: 4 + (state === "DRAFT" ? 0 : 1),
      submittedVersionId: "demo-v2",
      submittedVersionNumber: 2,
      state,
      revision,
      readiness: missingProfile ? ["STUDENT_PROFILE_NOT_READY"] : [],
      previewSnapshot: state === "DRAFT" && !missingProfile ? snapshot : null,
      allowedActions:
        state === "DRAFT"
          ? actor === "faculty" && !missingProfile
            ? ["finalize"]
            : []
          : [
              "download",
              ...(actor === "faculty" && state === "FINALIZED"
                ? ["receive"]
                : []),
            ],
      currentFinalization:
        state === "DRAFT"
          ? null
          : {
              id: finalizationId,
              approvedVersionId: "demo-v2",
              versionNumber: 2,
              finalizedAt: now,
              finalizedByUserId: "demo-faculty",
              templateVersion: "project1-docx-individual-v1",
              pdfGeneratedAt: generated ? now : null,
              pdfChecksum: generated ? "demo-checksum" : null,
              snapshot,
            },
      receipt:
        state === "RECEIVED"
          ? {
              id: "demo-receipt",
              finalizationId,
              receivedAt: now,
              receivedByUserId: "demo-faculty",
              note: "Bản giấy demo",
            }
          : null,
      history:
        state === "DRAFT"
          ? []
          : [
              {
                id: "demo-history",
                action: "FINALIZED",
                actorId: "demo-faculty",
                createdAt: now,
              },
              ...(state === "RECEIVED"
                ? [
                    {
                      id: "demo-received",
                      action: "PHYSICAL_RECEIVED",
                      actorId: "demo-faculty",
                      createdAt: now,
                    },
                  ]
                : []),
            ],
    });
    await page.route("**/*", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (url.origin !== origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const p = url.pathname.slice(4),
        method = request.method(),
        send = (data, status = 200) =>
          route.fulfill({
            status,
            contentType: "application/json",
            body: JSON.stringify(
              status < 300
                ? { success: true, data, timestamp: now }
                : {
                    success: false,
                    error: {
                      code: status === 409 ? "REVISION_CONFLICT" : "COMMON_001",
                      message: data,
                    },
                  },
            ),
          });
      if (deny) return send("Không tìm thấy hồ sơ trong phạm vi.", 404);
      if (method === "GET" && p === "/proposal-review-options/terms")
        return send([
          { id: "t1", name: snapshot.termName, status: "IN_PROGRESS" },
        ]);
      if (method === "GET" && p === "/terms/t1/proposals")
        return send({
          data: [
            {
              id: "p2",
              termId: "t1",
              title: snapshot.title,
              studentName: "s2",
              studentCode: "s2",
              departmentId: "d1",
              departmentName: "Bộ môn 1",
              researchAreaName: null,
              status: "APPROVED",
              revision: 4,
              submittedVersionId: "demo-v2",
              versionNumber: 2,
              activeReviewId: null,
              groupName: null,
              readiness: [],
              canAssign: false,
            },
          ],
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        });
      if (method === "GET" && p === "/proposals/p2/dossier")
        return send(view());
      if (method === "GET" && p === "/proposals/p2/dossier.pdf") {
        if (
          url.searchParams.get("finalizationId") !== finalizationId ||
          !generated ||
          state === "DRAFT"
        )
          return send("PDF chưa sẵn sàng.", 409);
        return route.fulfill({
          status: 200,
          contentType: "application/pdf",
          headers: { "Cache-Control": "private, no-store" },
          body: sample,
        });
      }
      if (
        method !== "POST" ||
        ![
          "/proposals/p2/finalize",
          "/proposals/p2/dossier/pdf",
          "/proposals/p2/dossier/receipt",
        ].includes(p)
      )
        return send("API ngoài phạm vi demo bước 7.", 404);
      if (!request.headers()["idempotency-key"])
        return send("Thiếu Idempotency-Key.", 400);
      let body;
      try {
        body = request.postDataJSON();
      } catch {
        return send("JSON không hợp lệ.", 400);
      }
      if (!body) return send("Thiếu request body.", 400);
      if (
        conflict ||
        (body.expectedDossierRevision ?? body.expectedRevision) !== revision
      )
        return send("Hồ sơ đã thay đổi. Hãy tải lại.", 409);
      if (p.endsWith("/finalize")) {
        if (actor !== "faculty") return send("Không có quyền.", 404);
        if (missingProfile) return send("Chưa có lớp/ngành đã xác nhận.", 409);
        if (state !== "DRAFT" || body.approvedVersionId !== "demo-v2")
          return send("Sai bản chốt.", 409);
        state = "FINALIZED";
        revision++;
        finalizes++;
        return send(view(), 201);
      }
      if (body.finalizationId !== finalizationId || state === "DRAFT")
        return send("Sai bản chốt.", 409);
      if (p.endsWith("/pdf")) {
        generated = true;
        revision++;
        return send(view());
      }
      if (actor !== "faculty") return send("Không có quyền tiếp nhận.", 404);
      if (state !== "FINALIZED") return send("Đã tiếp nhận.", 409);
      state = "RECEIVED";
      revision++;
      receipts++;
      return send(view(), 201);
    });
    if (interactive) {
      await page.goto(origin + "/topic/dossier/p2");
      console.log(
        "Da mo Step 7 DEMO trong Edge, khong ket noi backend/database.",
      );
      console.log(
        actor === "student"
          ? "Che do SV: tai PDF cua ho so da chot."
          : "Che do Khoa: xem truoc, chot, tao/tai PDF, ghi nhan tiep nhan giay.",
      );
      console.log(
        "Du lieu va PDF mau deu la fixture; menu khac chua duoc gia lap. Dong Edge hoac Ctrl+C de dung.",
      );
      process.once("SIGINT", () => browser.close());
      process.once("SIGTERM", () => browser.close());
      await new Promise((resolve) => {
        page.once("close", resolve);
        browser.once("disconnected", resolve);
      });
      return;
    }
    await page.goto(origin + "/topic/dossier");
    await page
      .getByRole("checkbox", { name: "Chỉ đề cương đã được duyệt" })
      .check();
    await page
      .getByRole("link", { name: "Xem hồ sơ chính thức", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Xem trước nội dung in" }),
    ).toContainText("Khoa học máy tính");
    await expect(
      page.getByRole("button", {
        name: "Chốt đề cương chính thức",
        exact: true,
      }),
    ).toBeVisible();
    pass(
      "faculty queue filters approved proposals and previews confirmed student/advisor/content before finalize",
    );
    await page
      .getByRole("button", { name: "Chốt đề cương chính thức", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Đã chốt đúng phiên bản" }),
    ).toBeVisible();
    assert.equal(finalizes, 1);
    await expect(
      page.getByRole("region", { name: "Trạng thái hồ sơ" }),
    ).toContainText("Chưa tạo");
    await expect(
      page.getByRole("region", { name: "Trạng thái hồ sơ" }),
    ).toContainText("Chưa ghi nhận");
    await expect(
      page.getByRole("button", {
        name: "Chốt đề cương chính thức",
        exact: true,
      }),
    ).toHaveCount(0);
    pass(
      "finalize binds approved v2 and hides duplicate finalize; PDF and physical receipt remain separate",
    );
    actor = "student";
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: "Xác nhận đã nhận bản giấy",
        exact: true,
      }),
    ).toHaveCount(0);
    const pending = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Tải PDF để in và ký", exact: true })
      .click();
    const download = await pending;
    assert.equal(download.suggestedFilename(), "de-cuong-chinh-thuc.pdf");
    assert.equal(
      fs
        .readFileSync(await download.path())
        .subarray(0, 5)
        .toString(),
      "%PDF-",
    );
    assert.equal(receipts, 0);
    await expect(
      page.getByRole("region", { name: "Trạng thái hồ sơ" }),
    ).toContainText("Đã tạo từ snapshot đã chốt");
    await expect(
      page.getByRole("region", { name: "Trạng thái hồ sơ" }),
    ).toContainText("Chưa ghi nhận");
    pass(
      "student downloads real sample PDF via authenticated blob flow without finalize/receive controls or inferred paper receipt",
    );
    actor = "faculty";
    await page.reload();
    await page.getByLabel("Ghi chú tiếp nhận").fill("Giữ ghi chú khi xung đột");
    conflict = true;
    await page
      .getByRole("button", { name: "Xác nhận đã nhận bản giấy", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("Hồ sơ đã thay đổi");
    await expect(page.getByLabel("Ghi chú tiếp nhận")).toHaveValue(
      "Giữ ghi chú khi xung đột",
    );
    assert.equal(receipts, 0);
    pass(
      "receipt revision conflict preserves note and does not mark paper received",
    );
    conflict = false;
    await page
      .getByRole("button", { name: "Xác nhận đã nhận bản giấy", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Trạng thái hồ sơ" }),
    ).toContainText("Đã tiếp nhận bản giấy");
    await expect(
      page.getByRole("button", {
        name: "Xác nhận đã nhận bản giấy",
        exact: true,
      }),
    ).toHaveCount(0);
    assert.equal(receipts, 1);
    pass(
      "faculty receipt updates explicit received state/history once and removes receipt action",
    );
    await page.setViewportSize({ width: 375, height: 812 });
    await expect
      .poll(
        async () =>
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
      )
      .toBe(true);
    pass("dossier status, preview and actions fit mobile viewport");
    state = "DRAFT";
    revision = 0;
    missingProfile = true;
    await page.reload();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Bước 1–3 chưa cung cấp lớp/ngành" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Chốt đề cương chính thức",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Xem trước nội dung in" }),
    ).toHaveCount(0);
    pass(
      "missing producer class/major blocks finalization instead of offering invented values",
    );
    deny = true;
    await page.goto(origin + "/topic/dossier/foreign");
    await expect(page.getByRole("alert")).toContainText("Không tìm thấy hồ sơ");
    await expect(
      page.getByRole("region", { name: "Xem trước nội dung in" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Tải PDF để in và ký", exact: true }),
    ).toHaveCount(0);
    assert.deepEqual(errors, []);
    pass(
      "scope error hides dossier content/download actions and causes no unhandled page errors",
    );
    fs.writeFileSync(
      path.join(root, "../backend/prisma/review/step7-browser-results.json"),
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
    console.log(`${checks.length} Step 7 browser checks passed`);
  } finally {
    if (browser) await browser.close();
    vite.kill();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
