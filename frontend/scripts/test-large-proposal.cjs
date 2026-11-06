"use strict";
// Authenticated browser regression against the caller's isolated, real Nest API.
// Secrets arrive on stdin and are never written to evidence.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { spawn } = require("node:child_process"),
  { once } = require("node:events");
const { chromium, expect } = require("@playwright/test");
async function main() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const cfg = JSON.parse(input),
    api = new URL(cfg.api);
  assert.equal(api.hostname, "127.0.0.1");
  assert.equal(api.protocol, "http:");
  const origin = "http://127.0.0.1:50181",
    root = path.resolve(__dirname, "..");
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
      "50181",
      "--strictPort",
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        VITE_API_URL: cfg.api,
        VITE_REVIEW_GROUP_DEMO: "false",
      },
      stdio: "ignore",
      windowsHide: true,
    },
  );
  let browser;
  try {
    let ready = false;
    for (let i = 0; i < 150; i++) {
      try {
        if ((await fetch(origin)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(ready, "Isolated Vite must be ready");
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      return [origin, api.origin].includes(url.origin) ||
        !["http:", "https:"].includes(url.protocol)
        ? route.continue()
        : route.abort();
    });
    await page.goto(origin + "/login");
    await page.getByLabel(/Tên đăng nhập \/ Mã định danh/).fill("qa-student2");
    await page.getByLabel(/^Mật khẩu/).fill(cfg.password);
    await page
      .getByRole("button", { name: "Đăng nhập hệ thống", exact: true })
      .click();
    await expect(page).toHaveURL(origin + "/");
    await page.goto(origin + "/topic/proposal/p-student2");
    // All five fields are already valid 11,000-character Vietnamese values from
    // the API regression. Edit the objective to exercise real dirty/save flow.
    await page.getByLabel("Mục tiêu", { exact: true }).fill("á".repeat(11000));
    const pending = page.waitForResponse(
      (r) =>
        r.url() === cfg.api + "/proposals/p-student2/versions" &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Lưu nháp mới", exact: true })
      .click();
    const response = await pending,
      bytes = Buffer.byteLength(response.request().postData());
    assert(bytes > 100 * 1024);
    assert.equal(response.status(), 201);
    await page.reload();
    await expect(page.getByLabel("Mục tiêu", { exact: true })).toHaveValue(
      "á".repeat(11000),
    );
    assert.equal(errors.length, 0);
    await page.screenshot({
      path: path.join(cfg.out, "large-proposal-saved.png"),
      fullPage: true,
    });
    fs.writeFileSync(
      path.join(cfg.out, "large-proposal-ui.json"),
      JSON.stringify(
        {
          result: "PASS",
          bytes,
          status: 201,
          reloadPreserved: true,
          mockedResponses: false,
          pageErrors: errors,
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS browser saves and reloads a valid UTF-8 proposal above 100 KiB",
    );
  } finally {
    if (browser) await browser.close();
    const ended = once(vite, "exit");
    if (vite.exitCode === null) {
      vite.kill();
      await ended;
    }
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
