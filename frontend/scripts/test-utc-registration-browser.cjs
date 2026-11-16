"use strict";
// Isolated HTTP fixtures, never integration evidence. No real account or database.
const { chromium, expect } = require("@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const root = path.resolve(__dirname, "..");
  const output = process.env.UI_EVIDENCE_DIR
    ? path.resolve(process.env.UI_EVIDENCE_DIR)
    : path.resolve(root, "../docs/ui-redesign/evidence/system-rollout");
  fs.mkdirSync(output, { recursive: true });
  process.chdir(root);
  Object.assign(process.env, {
    VITE_API_URL: "/api", VITE_AUTH_API: "true", VITE_TERM_API: "true",
    VITE_CATALOG_API: "true", VITE_REGISTRATION_API: "true", VITE_DEMO_MODE: "false",
  });
  const { createServer } = await import("vite");
  const server = await createServer({ root, mode: "test", server: { host: "127.0.0.1", port: 50189, strictPort: true } });
  let browser;
  const checks = [], unexpected = [], errors = [], writes = [];
  const pass = (name) => { checks.push(name); console.log("PASS " + name); };
  try {
    await server.listen();
    const { createSeed } = await server.ssrLoadModule("/src/shared/data/seed.ts");
    const seed = createSeed(true);
    const student = seed.students[0];
    const actor = { ...seed.accounts.find(a => a.studentId === student.id), mustChangePassword: false, profileComplete: true, student };
    delete actor.password;
    const termId = "11111111-1111-4111-8111-111111111111";
    const directionId = "22222222-2222-4222-8222-222222222222";
    const lecturers = seed.lecturers.slice(0, 3).map((l, i) => ({
      ...l, id: `33333333-3333-4333-8333-33333333333${i}`, fullName: l.name,
      lecturerCode: l.code, isActive: true, researchAreas: [{ id: directionId }],
    }));
    const term = { ...seed.terms[0], id: termId, status: "OPEN_REGISTRATION", locked: false,
      registrationStart: "2026-01-01", registrationEnd: "2099-12-31", studentIds: [student.id],
      lecturers: lecturers.map(l => ({ lecturerId: l.id, quota: 3 })), assignmentPublished: false,
      parameters: { ...seed.terms[0].parameters, max_preferences: 3 },
    };
    let row = { id: "isolated-registration", termId, studentId: student.id, directionId,
      preferences: [{ lecturerId: lecturers[0].id, preferenceOrder: 1 }], status: "DRAFT",
      note: "", legacyStatus: null, submittedAt: null, updatedAt: "2026-11-01T00:00:00Z" };
    let failWrite = false, readClosed = false, releaseWrite;
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("pageerror", e => errors.push(e.message));
    await page.addInitScript(({ actor, termId }) => {
      sessionStorage.setItem("utc-api-user", JSON.stringify(actor));
      sessionStorage.setItem("utc-api-access", "isolated-test-not-a-credential");
      sessionStorage.setItem("utc-workspace", JSON.stringify({ termId }));
    }, { actor, termId });
    const origin = "http://127.0.0.1:50189";
    await page.route("**/*", async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.origin !== origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      const p = url.pathname.slice(4);
      const send = data => route.fulfill({ json: { success: true, data } });
      if (p === "/auth/me") return send(actor);
      if (p === "/terms") return send({ items: [term], total: 1 });
      if (p === "/semesters" || p === "/departments" || p === "/notifications/me" || p.startsWith("/notifications/outbox/term/")) return send([]);
      if (p === "/training-systems") return send([{ id: "program", name: term.program }]);
      if (p === "/research-areas") return send([{ id: directionId, name: "Hướng kiểm thử cô lập", active: true }]);
      if (p === "/lecturers") return send({ items: lecturers, total: lecturers.length });
      if (p === "/students") return send({ items: [], total: 0 });
      if (p.startsWith("/assignments/term/")) return send({ plan: null, assignments: [], results: [] });
      if (p.startsWith("/topics/term/")) return send([]);
      if (p === `/registrations/term/${termId}/me`) return send({ registration: row,
        directions: [{ id: directionId, name: "Hướng kiểm thử cô lập" }], lecturerIds: lecturers.map(l => l.id),
        window: { canWrite: !readClosed, reason: readClosed ? "Đăng ký đã khóa" : null, serverNow: new Date().toISOString(), endAt: "2099-12-31T00:00:00Z" },
      });
      if (p === `/registrations/term/${termId}/me/draft` || p === `/registrations/term/${termId}/me/submit`) {
        const body = req.postDataJSON();
        writes.push({ method: req.method(), path: p, preferences: body.preferences });
        await new Promise(resolve => { releaseWrite = resolve; });
        if (failWrite) return route.fulfill({ status: 409, json: { success: false, error: { message: "Cổng vừa đóng (kiểm thử cô lập)" } } });
        row = { ...row, ...body, status: p.endsWith("/submit") ? "SUBMITTED" : "DRAFT", updatedAt: new Date().toISOString(), submittedAt: p.endsWith("/submit") ? new Date().toISOString() : row.submittedAt };
        return send(row);
      }
      unexpected.push(p);
      return route.fulfill({ status: 404, json: { success: false, message: "Unexpected isolated route" } });
    });
    await page.goto(origin + "/registration?termId=" + termId);
    const save = page.getByRole("button", { name: "Lưu nháp", exact: true });
    await expect(save).toBeEnabled();
    await page.setViewportSize({ width: 390, height: 844 });
    const email = page.getByRole("textbox", { name: "Email liên hệ *", exact: true });
    if (!await email.isVisible())
      await page.getByRole('button', { name: 'Mở rộng Thông tin liên hệ', exact: true }).click();
    await email.fill("invalid-email");
    await page.getByRole("button", { name: "Thu gọn Thông tin liên hệ", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(email).toBeHidden();
    await save.click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(email).toBeVisible();
    await expect(email).toHaveValue("invalid-email");
    assert.equal(writes.length, 0);
    pass("mobile keyboard disclosure retains values and validation reveals the fields without writing");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("textbox", { name: "Email liên hệ *", exact: true }).fill("student@example.test");
    await page.getByRole("textbox", { name: "Số điện thoại *", exact: true }).fill("0912345678");
    const note = page.getByRole("textbox", { name: "Ghi chú / Kinh nghiệm đã làm việc cùng GV", exact: true });
    await expect(note).toBeHidden();
    await page.locator('.registration-note summary').focus();
    await page.keyboard.press('Enter');
    await expect(note).toBeVisible();
    await note.fill('Ghi chú kiểm thử cô lập');
    await page.locator('.registration-note summary').click();
    await expect(note).toBeHidden();
    await page.locator('.registration-note summary').click();
    await expect(note).toHaveValue('Ghi chú kiểm thử cô lập');
    pass('optional note opens by keyboard and retains content across disclosure');
    await page.getByRole("combobox", { name: "Thêm nguyện vọng 2" }).selectOption(lecturers[1].id);
    await page.getByRole("button", { name: "Nâng NV2", exact: true }).click();
    // Freeze a real running animation so cancellation is independent of machine load.
    const motion = await page.locator('.registration-preferences').evaluateHandle(list => {
      const animation = [...list.querySelectorAll('.preference-row')].flatMap(row => row.getAnimations()).find(animation => animation.playState === 'running');
      animation?.pause();
      return animation;
    });
    assert.equal(await motion.evaluate(animation => animation?.playState), 'paused', 'Expected a real in-flight reorder animation');
    await expect(page.locator('#registration-preference-' + lecturers[1].id)).toBeFocused();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => motion.evaluate(animation => animation?.playState)).toBe('idle');
    await motion.dispose();
    await page.getByRole('button', { name: 'Nâng NV2', exact: true }).click();
    assert.equal(await page.locator('.preference-row').evaluateAll(rows => rows.flatMap(row => row.getAnimations()).length), 0, 'Reduced motion must skip reorder animation');
    await expect(page.locator('#registration-preference-' + lecturers[0].id)).toBeFocused();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByRole('button', { name: 'Nâng NV2', exact: true }).click();
    pass('reorder animates real position changes, retains focus, cancels in-flight motion and skips new animation with reduced motion');
    await page.evaluate(() => document.fonts.ready);
    const draftSize = await save.boundingBox();
    const submitSize = await page.getByRole('button', { name: 'Nộp đăng ký', exact: true }).boundingBox();
    await save.click();
    await expect.poll(() => writes.length).toBe(1);
    await expect(save).toBeDisabled();
    await expect(page.getByRole("textbox", { name: "Email liên hệ *", exact: true })).toBeDisabled();
    const pendingSize = await save.boundingBox();
    const pendingSubmitSize = await page.getByRole('button', { name: 'Nộp đăng ký', exact: true }).boundingBox();
    assert(Math.abs(submitSize.width - pendingSubmitSize.width) < 1 && Math.abs(submitSize.height - pendingSubmitSize.height) < 1, 'Loading must not change submit button size');
    assert(Math.abs(draftSize.width - pendingSize.width) < 1 && Math.abs(draftSize.height - pendingSize.height) < 1, 'Loading must not change the draft button size: ' + JSON.stringify({ draftSize, pendingSize }));
    assert.equal(writes[0].method, "PUT");
    assert.deepEqual(writes[0].preferences.map(p => p.lecturerId), [lecturers[1].id, lecturers[0].id]);
    await page.screenshot({ path: path.join(output, "isolated-draft-pending.png"), animations: "disabled" });
    releaseWrite();
    await expect(page.getByRole("status").filter({ hasText: "Đã lưu bản nháp đăng ký." })).toBeVisible();
    pass("draft PUT preserves reordered preferences, disables fields while pending, shows success");
    await page.getByRole("button", { name: "Nộp đăng ký", exact: true }).click();
    const confirmSize = await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).boundingBox();
    await page.getByRole("dialog").getByRole("button", { name: "Xác nhận", exact: true }).click();
    await expect.poll(() => writes.length).toBe(2);
    await expect(page.getByRole("dialog").getByRole("button", { name: "Đang xử lý…", exact: true })).toBeDisabled();
    const pendingConfirmSize = await page.getByRole('dialog').getByRole('button', { name: 'Đang xử lý…', exact: true }).boundingBox();
    assert(Math.abs(confirmSize.width - pendingConfirmSize.width) < 1 && Math.abs(confirmSize.height - pendingConfirmSize.height) < 1, 'Confirmation label must not shift the pending button size');
    assert.equal(writes[1].method, "POST");
    releaseWrite();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".registration-status .badge")).toHaveText("Đã nộp");
    await expect(page.getByRole("status").filter({ hasText: "Đăng ký đã được ghi nhận." })).toBeVisible();
    pass("submit confirmation POST shows pending, closes on success and refreshes saved status");
    failWrite = true;
    await save.click();
    await expect.poll(() => writes.length).toBe(3);
    releaseWrite();
    await expect(page.getByRole("alert")).toContainText("Cổng vừa đóng");
    await expect(save).toBeEnabled();
    await expect(page.locator(".registration-status .badge")).toHaveText("Đã nộp");
    pass("HTTP failure shows error, restores controls, preserves saved submitted status");
    readClosed = true;
    await page.reload();
    await expect(page.getByRole("status").filter({ hasText: "Đăng ký đã khóa" })).toBeVisible();
    await expect(save).toBeDisabled();
    await expect(page.getByRole("button", { name: "Nộp đăng ký", exact: true })).toBeDisabled();
    pass("server closed window disables both save and submit");
    assert.deepEqual(unexpected, []);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, "isolated-write-checks.json"), JSON.stringify({ at: new Date().toISOString(), result: "PASS", isolatedHttpFixtures: true, realBackendAccess: false, checks, writes, unexpected, errors }, null, 2));
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
