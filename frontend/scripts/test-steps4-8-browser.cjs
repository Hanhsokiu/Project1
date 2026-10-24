"use strict";
// Started by backend live-E2E runner. Credentials are ephemeral stdin, never files/logs.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { chromium, expect } = require("@playwright/test");
const { once } = require("node:events");
async function main() {
  let input = ""; for await (const chunk of process.stdin) input += chunk;
  const cfg = JSON.parse(input), parsed = new URL(cfg.api);
  assert.equal(parsed.hostname, "127.0.0.1"); assert.equal(parsed.protocol, "http:");
  const root = path.resolve(__dirname, ".."), origin = "http://127.0.0.1:50180";
  const vite = spawn(process.execPath, [path.join(path.dirname(require.resolve("vite/package.json")), "bin/vite.js"), "--host", "127.0.0.1", "--port", "50180", "--strictPort"], { cwd: root, env: { ...process.env, VITE_API_URL: cfg.api, VITE_REVIEW_GROUP_DEMO: "false" }, stdio: "ignore", windowsHide: true });
  const checks = [], errors = [], requests = [], pages = new Map();
  let browser, lastPage, result = "FAIL", failure;
  const startedAt = new Date().toISOString();
  const pass = name => { checks.push({ name, result: "PASS" }); console.log("PASS " + name); };
  try {
    let ready = false;
    for (let i = 0; i < 150; i++) { try { if ((await fetch(origin)).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); }
    assert(ready, "Vite failed to start on isolated port 50180");
    browser = await chromium.launch({ channel: "msedge", headless: true });
    async function open(actor, route) {
      let page = pages.get(actor);
      if (!page) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
        await context.route("**/*", route => {
          const u = new URL(route.request().url());
          return [origin, parsed.origin].includes(u.origin) || !["http:", "https:"].includes(u.protocol) ? route.continue() : route.abort();
        }); // Traffic guard only: never fulfill/mutate responses.
        page = await context.newPage(); pages.set(actor, page);
        page.on("pageerror", e => errors.push(e.message));
        page.on("response", r => { if (r.url().startsWith(cfg.api)) requests.push({ actor, method: r.request().method(), path: new URL(r.url()).pathname, status: r.status() }); });
        await page.goto(origin + "/login");
        await page.getByLabel("Mã sinh viên / Tên đăng nhập", { exact: true }).fill("qa-" + actor);
        await page.getByLabel("Mật khẩu", { exact: true }).fill(cfg.password);
        await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
        await expect(page).toHaveURL(origin + "/");
      }
      lastPage = page; await page.goto(origin + route); return page;
    }
    async function command(page, suffix, method, action) {
      const pending = page.waitForResponse(r => r.url().split("?")[0].endsWith(suffix) && r.request().method() === method);
      await action(); const response = await pending;
      const data = await response.json();
      assert(response.ok(), method + " " + suffix + " returned " + response.status() + " " + JSON.stringify(data));
      return data.data;
    }
    async function readAs(actor, route, statuses = [200]) {
      const login = await fetch(cfg.api + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "qa-" + actor, password: cfg.password }) });
      assert.equal(login.status, 201); const auth = await login.json();
      const response = await fetch(cfg.api + route, { headers: { Authorization: "Bearer " + (auth.accessToken ?? auth.data?.accessToken) } });
      assert(statuses.includes(response.status), actor + " GET " + route + " unexpected " + response.status);
      return response;
    }
    let f = await open("faculty", "/topic/review-groups/new");
    await f.getByLabel("Đợt tạo nhóm", { exact: true }).selectOption("qa-t1");
    await f.getByLabel("Tên nhóm", { exact: true }).fill("Nhóm QA xuyên suốt 4–8");
    await f.getByLabel("Bộ môn", { exact: true }).selectOption("qa-d");
    await f.getByRole("checkbox", { name: /Nguyễn Thị Duyệt/ }).check();
    const group = await command(f, "/terms/qa-t1/review-groups", "POST", () => f.getByRole("button", { name: "Tạo nhóm duyệt", exact: true }).click());
    await expect(f.getByRole("heading", { name: group.name, exact: true })).toBeVisible();
    pass("Khoa logs in and creates real review group with eligible roster member");
    async function assign() {
      f = await open("faculty", "/topic/review-assignments/p-student?termId=qa-t1");
      await f.getByLabel("Nhóm nhận đề cương").selectOption(group.id);
      return command(f, "/proposals/p-student/review-assignments", "POST", () => f.getByRole("button", { name: "Xác nhận phân công", exact: true }).click());
    }
    const r1 = await assign();
    pass("Khoa confirms assignment to the group created in step 4, exact sealed v1");
    let r = await open("reviewer", "/topic/reviews/" + r1.id);
    await command(r, "/proposal-reviews/" + r1.id + "/start", "POST", () => r.getByRole("button", { name: "Bắt đầu duyệt phiên bản 1" }).click());
    await r.getByLabel("Kết quả chung").selectOption("REVISION_REQUIRED");
    await r.getByLabel("Nhận xét kết luận").fill("Bổ sung mục tiêu và kiểm thử tích hợp tiếng Việt");
    await command(r, "/proposal-reviews/" + r1.id + "/decision", "POST", () => r.getByRole("button", { name: "Xác nhận kết luận chung" }).click());
    await expect(r.getByText("Đã lưu kết luận chung.", { exact: true })).toBeVisible();
    pass("Assigned reviewer starts v1 and records one common REVISION_REQUIRED decision");
    let s = await open("student", "/topic/proposal/p-student");
    await s.getByLabel("Mục tiêu", { exact: true }).fill("Mục tiêu đã sửa: kiểm thử tích hợp toàn bộ hệ thống");
    const responseField = s.locator('textarea[aria-label^="Phản hồi DECISION"]');
    await expect(responseField).toHaveCount(1); await responseField.fill("Đã bổ sung mục tiêu và kiểm thử theo yêu cầu");
    await s.getByLabel("Tóm tắt thay đổi").fill("Hoàn thiện mục tiêu sau vòng 1");
    const v2 = await command(s, "/proposals/p-student/versions", "POST", () => s.getByRole("button", { name: "Lưu nháp mới", exact: true }).click());
    assert.equal(v2.versionNumber, 2);
    await expect(s.getByText("Đã lưu snapshot v2. Chưa gửi duyệt.", { exact: true })).toBeVisible();
    await command(s, "/proposals/p-student/submit", "POST", () => s.getByRole("button", { name: "Gửi duyệt lại", exact: true }).click());
    pass("Student logs in, responds to v1 feedback, saves immutable v2 and resubmits");
    const r2 = await assign(); assert.notEqual(r2.id, r1.id); assert.equal(r2.versionId, v2.id);
    r = await open("reviewer", "/topic/reviews/" + r2.id);
    await command(r, "/proposal-reviews/" + r2.id + "/start", "POST", () => r.getByRole("button", { name: "Bắt đầu duyệt phiên bản 2" }).click());
    await r.getByLabel("Kết quả chung").selectOption("APPROVED");
    await command(r, "/proposal-reviews/" + r2.id + "/decision", "POST", () => r.getByRole("button", { name: "Xác nhận kết luận chung" }).click());
    pass("Khoa assigns v2 to a new round; reviewer approves exact current v2");
    f = await open("faculty", "/topic/dossier/p-student");
    const dossier = await command(f, "/proposals/p-student/finalize", "POST", () => f.getByRole("button", { name: "Chốt đề cương chính thức", exact: true }).click());
    assert.equal(dossier.currentFinalization.approvedVersionId, v2.id);
    assert.equal(dossier.receipt, null);
    pass("Khoa finalizes approved v2 with real class/major profile; no implied paper receipt");
    s = await open("student", "/topic/dossier/p-student");
    const downloaded = s.waitForEvent("download");
    await s.getByRole("button", { name: "Tải PDF để in và ký", exact: true }).click();
    const download = await downloaded;
    await download.saveAs(path.join(cfg.evidence, "live-finalized.pdf"));
    const pdf = fs.readFileSync(path.join(cfg.evidence, "live-finalized.pdf"));
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    await expect(s.getByRole("region", { name: "Trạng thái hồ sơ" })).not.toContainText("Đã tiếp nhận bản giấy");
    pass("Student securely generates/downloads real finalized PDF; download does not mark signed/received");
    let a = await open("advisor", "/guidance/plan/p-student");
    const plan = await command(a, "/proposals/p-student/guidance-plan", "POST", () => a.getByRole("button", { name: "Tạo kế hoạch hướng dẫn", exact: true }).click());
    await expect(a.getByRole("link", { name: "Giao nhiệm vụ mới", exact: true })).toBeVisible();
    await a.getByRole("link", { name: "Giao nhiệm vụ mới", exact: true }).click();
    await a.getByLabel("Tên nhiệm vụ", { exact: true }).fill("Nhiệm vụ QA toàn luồng");
    await a.getByLabel("Mô tả nhiệm vụ", { exact: true }).fill("Kiểm thử tích hợp trên dữ liệu thật");
    await a.getByLabel("Sản phẩm dự kiến", { exact: true }).fill("Báo cáo PDF và source ZIP");
    await a.getByLabel("Mốc nhiệm vụ", { exact: true }).selectOption("qa-m1");
    const local = iso => new Date(Date.parse(iso) + 7 * 3600000).toISOString().slice(0, 16);
    await a.getByLabel("Ngày bắt đầu", { exact: true }).fill(local(cfg.startDate));
    await a.getByLabel("Hạn hoàn thành", { exact: true }).fill(local(cfg.dueDate));
    const task = await command(a, "/guidance-plans/" + plan.id + "/tasks", "POST", () => a.getByRole("button", { name: "Giao nhiệm vụ", exact: true }).click());
    pass("Current official advisor creates guidance plan and assigns dated task through UI");
    const { crc32 } = require("../../backend/dist/guidance/submissions/submission.validator");
    function zip() {
      const n = Buffer.from("src/main.ts"), b = Buffer.from("export const qa = true;"), crc = crc32(b), l = Buffer.alloc(30), c = Buffer.alloc(46), e = Buffer.alloc(22);
      l.writeUInt32LE(0x04034b50); l.writeUInt16LE(20, 4); l.writeUInt32LE(crc, 14); l.writeUInt32LE(b.length, 18); l.writeUInt32LE(b.length, 22); l.writeUInt16LE(n.length, 26);
      c.writeUInt32LE(0x02014b50); c.writeUInt16LE(20, 6); c.writeUInt32LE(crc, 16); c.writeUInt32LE(b.length, 20); c.writeUInt32LE(b.length, 24); c.writeUInt16LE(n.length, 28);
      e.writeUInt32LE(0x06054b50); e.writeUInt16LE(1, 8); e.writeUInt16LE(1, 10); e.writeUInt32LE(c.length + n.length, 12); e.writeUInt32LE(l.length + n.length + b.length, 16);
      return Buffer.concat([l, n, b, c, n, e]);
    }
    async function submit(number) {
      s = await open("student", "/guidance/tasks/" + task.id + "/submissions");
      await s.getByLabel("Báo cáo PDF", { exact: true }).setInputFiles({ name: "bao-cao.pdf", mimeType: "application/pdf", buffer: pdf });
      await s.getByLabel("Mã nguồn ZIP", { exact: true }).setInputFiles({ name: "source.zip", mimeType: "application/zip", buffer: zip() });
      await s.getByLabel("Nội dung báo cáo bổ sung").fill("Báo cáo lần " + number);
      await command(s, "/tasks/" + task.id + "/submission-uploads", "POST", () => s.getByRole("button", { name: "Tải file lên", exact: true }).click());
      await expect(s.getByRole("status").filter({ hasText: "File đã tải lên staging" })).toBeVisible();
      const sub = await command(s, "/tasks/" + task.id + "/submissions", "POST", () => s.getByRole("button", { name: "Xác nhận nộp", exact: true }).click());
      await expect(s.getByText("Lần nộp " + number + " · Hiện hành")).toBeVisible(); return sub;
    }
    const sub1 = await submit(1); pass("Student uploads real PDF/ZIP to private storage and commits immutable submission v1");
    a = await open("advisor", "/guidance/review/" + sub1.id);
    await a.getByLabel("Kết quả đánh giá").selectOption("REVISION_REQUIRED");
    await a.getByLabel("Nhận xét đánh giá").fill("Cần bổ sung kết quả kiểm thử tích hợp");
    await command(a, "/task-submissions/" + sub1.id + "/reviews", "POST", () => a.getByRole("button", { name: "Ghi nhận đánh giá", exact: true }).click());
    s = await open("student", "/guidance/review/" + sub1.id);
    await expect(s.getByText("Yêu cầu chỉnh sửa: Cần bổ sung kết quả kiểm thử tích hợp", { exact: true })).toBeVisible();
    pass("Advisor requests revision on submission v1; student sees exact reviewer feedback");
    const sub2 = await submit(2); assert.notEqual(sub2.id, sub1.id);
    a = await open("advisor", "/guidance/review/" + sub2.id);
    await a.getByLabel("Kết quả đánh giá").selectOption("PASS");
    await command(a, "/task-submissions/" + sub2.id + "/reviews", "POST", () => a.getByRole("button", { name: "Ghi nhận đánh giá", exact: true }).click());
    await expect(a.getByRole("heading", { name: /Đạt · Kết luận/ })).toBeVisible();
    pass("Student resubmits v2; advisor PASS completes task while v1/review history remains");
    f = await open("faculty", "/guidance/progress?termId=qa-t1");
    await expect(f.locator('[data-metric="Tổng nhiệm vụ"]')).toHaveText("1");
    await expect(f.locator('[data-metric="Đã hoàn thành (Đạt)"]')).toHaveText("1");
    await f.getByLabel("Lọc GVHD", { exact: true }).selectOption("advisor");
    await expect(f.getByText("Nghĩa vụ báo cáo tuần (kể cả chưa có task)")).toBeVisible();
    await f.screenshot({ path: path.join(cfg.evidence, "live-faculty-dashboard.png"), fullPage: true });
    pass("Khoa sees real completion metrics and independent weekly obligation without a manual task");
    for (const route of ["/students", "/lecturers", "/terms", "/terms/qa-t1", "/registrations/term/qa-t1", "/topics/term/qa-t1"]) {
      const response = await readAs("faculty", route), body = await response.json();
      assert.equal(body.success, true); assert(body.data);
      if (["/students", "/lecturers"].includes(route)) assert(Array.isArray(body.data.data) && body.data.total >= 3);
      if (["/terms", "/registrations/term/qa-t1", "/topics/term/qa-t1"].includes(route)) assert(Array.isArray(body.data) && body.data.length >= 2);
    }
    pass("Existing step 1–3 student/lecturer/term/registration/topic read APIs retain envelopes and data after full flow");
    for (const actor of ["student2", "student3", "outsider", "foreign", "admin"])
      for (const route of ["/proposals/p-student", "/tasks/" + task.id, "/task-submissions/" + sub2.id + "/review-context"])
        await readAs(actor, route, [403, 404]);
    await readAs("outsider", "/review-groups/" + group.id, [404]);
    await readAs("outsider", "/proposal-reviews/" + r2.id, [404]);
    await readAs("faculty2", "/terms/qa-t1/guidance-dashboard", [404]);
    const bad = await open("student2", "/guidance/review/" + sub2.id);
    await expect(bad.getByRole("alert").first()).toBeVisible();
    await expect(bad.getByRole("button", { name: "Ghi nhận đánh giá", exact: true })).toHaveCount(0);
    pass("Live cross-student/round/review-group and ADMIN access denied by server; UI hides foreign content");
    await a.setViewportSize({ width: 375, height: 812 });
    await a.goto(origin + "/guidance/review/" + sub1.id);
    await expect(a.getByText("Đây là bản nộp cũ.", { exact: false })).toBeVisible();
    await expect(a.getByRole("button", { name: "Sửa đánh giá có lý do", exact: true })).toHaveCount(0);
    assert(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await a.screenshot({ path: path.join(cfg.evidence, "live-stale-version-mobile.png"), fullPage: true });
    assert.deepEqual(errors, []); assert(requests.length > 30);
    pass("Old submission is read-only on mobile; no unhandled React errors in real role sessions");
    result = "PASS";
  } catch (e) {
    failure = e.message; console.error("FAIL " + failure); process.exitCode = 1;
    if (lastPage) await lastPage.screenshot({ path: path.join(cfg.evidence, "live-failure.png"), fullPage: true }).catch(() => {});
  } finally {
    fs.writeFileSync(path.join(cfg.evidence, "live-browser.json"), JSON.stringify({ result, startedAt, finishedAt: new Date().toISOString(), mockedApi: false, sharedDatabaseAccess: false, checks, pageErrors: errors, requests, ...(failure ? { failure } : {}) }, null, 2) + "\n");
    if (browser) await browser.close();
    vite.kill(); await Promise.race([once(vite, "exit"), new Promise(r => setTimeout(r, 3000))]);
  }
}
main().catch(() => { console.error("FAIL live browser setup; run through backend test:integration:steps4-8:e2e"); process.exitCode = 1; });
