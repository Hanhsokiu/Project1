"use strict";
const path = require("node:path"),
  assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function browserCheck({ root, api, marker }) {
  const port = await freePort(),
    origin = `http://127.0.0.1:${port}`;
  const vite = spawn(
    process.execPath,
    [
      path.join(root, "frontend/node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      cwd: path.join(root, "frontend"),
      windowsHide: true,
      env: { ...process.env, VITE_API_URL: api, VITE_AUTH_API: "true" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let viteError = "";
  vite.stderr.on("data", (data) => {
    viteError = (viteError + data).slice(-1000);
  });
  vite.stdout.resume();
  try {
    let ready = false;
    for (let n = 0; n < 100; n++) {
      if (vite.exitCode !== null) throw new Error("Vite stopped: " + viteError);
      try {
        if ((await fetch(origin, { signal: AbortSignal.timeout(500) })).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    assert(ready, "Sample preview did not start");
    const child = spawn(
      process.execPath,
      [path.join(__dirname, "browser.cjs")],
      {
        cwd: root,
        windowsHide: true,
        env: { ...process.env, SAMPLE_MANIFEST: marker, SAMPLE_ORIGIN: origin },
        stdio: "inherit",
      },
    );
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", resolve);
    });
    assert.equal(
      code,
      0,
      "Live sample browser checks failed; inspect browser/result.json",
    );
  } finally {
    vite.kill();
  }
}
module.exports = { browserCheck };
