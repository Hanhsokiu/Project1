"use strict";
// Persistent, isolated UI workspace. Never consumes DATABASE_URL from .env.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const cp = require("node:child_process");
const net = require("node:net");
const root = path.resolve(__dirname, "..");
const cache = path.join(root, ".cache", "integration-ui");
const stateFile = path.join(cache, "config.json");
const port = 55451;
fs.mkdirSync(cache, { recursive: true });
let config;
if (fs.existsSync(stateFile))
  config = JSON.parse(fs.readFileSync(stateFile, "utf8"));
else {
  const bin =
    process.env.BTL_POSTGRES_BIN ||
    path.join(
      process.env.LOCALAPPDATA || "",
      "Temp",
      "btl-pr2b-pg17",
      "pgsql",
      "bin",
    );
  if (!fs.existsSync(path.join(bin, "pg_ctl.exe")))
    throw new Error(
      "Set BTL_POSTGRES_BIN to the directory containing PostgreSQL 17 binaries.",
    );
  config = { bin, password: crypto.randomBytes(24).toString("hex") };
  fs.writeFileSync(stateFile, JSON.stringify(config), {
    flag: "wx",
    mode: 0o600,
  });
}
const data = path.join(cache, "data");
const url = `postgresql://btl_ui:${config.password}@127.0.0.1:${port}/btl_integration_ui`;
const env = {
  ...process.env,
  DATABASE_URL: url,
  DIRECT_URL: url,
  EMAIL_WORKER_ENABLED: "false",
  PORT: "3000",
  NODE_ENV: "development",
  FRONTEND_URL: "http://127.0.0.1:5173,http://localhost:5173",
  STORAGE_LOCAL_PATH: path.join(cache, "uploads"),
};
function run(exe, args, options = {}) {
  const r = cp.spawnSync(exe, args, {
    cwd: root,
    env,
    windowsHide: true,
    stdio: "inherit",
    ...options,
  });
  if (r.error || r.status !== 0)
    throw new Error("Local UI command failed: " + path.basename(exe));
}
function pg(name, args, options = {}) {
  run(path.join(config.bin, name + ".exe"), args, options);
}
function node(module, args) {
  run(process.execPath, [
    require.resolve(module, { paths: [path.join(root, "backend")] }),
    ...args,
  ]);
}
function start() {
  if (!fs.existsSync(path.join(data, "PG_VERSION"))) {
    const passwordFile = path.join(cache, "init-password");
    fs.writeFileSync(passwordFile, config.password, { mode: 0o600 });
    try {
      pg(
        "initdb",
        [
          "-D",
          data,
          "-U",
          "btl_ui",
          "--auth=scram-sha-256",
          "--pwfile=" + passwordFile,
          "--encoding=UTF8",
          "--locale=C",
        ],
        { stdio: "ignore" },
      );
    } finally {
      fs.unlinkSync(passwordFile);
    }
  }
  const status = cp.spawnSync(
    path.join(config.bin, "pg_ctl.exe"),
    ["-D", data, "status"],
    { windowsHide: true, stdio: "ignore" },
  );
  if (status.status !== 0)
    pg(
      "pg_ctl",
      [
        "-D",
        data,
        "-l",
        path.join(cache, "postgres.log"),
        "-o",
        `-p ${port} -h 127.0.0.1`,
        "-w",
        "start",
      ],
      { stdio: "ignore" },
    );
  const check = cp.spawnSync(
    path.join(config.bin, "psql.exe"),
    [
      "-X",
      "-At",
      "-h",
      "127.0.0.1",
      "-p",
      String(port),
      "-U",
      "btl_ui",
      "-d",
      "postgres",
      "-c",
      "SELECT 1 FROM pg_database WHERE datname='btl_integration_ui'",
    ],
    {
      env: { ...env, PGPASSWORD: config.password },
      encoding: "utf8",
      windowsHide: true,
    },
  );
  if (check.error || check.status !== 0)
    throw new Error("Local database identity check failed.");
  if (check.stdout.trim() !== "1")
    pg(
      "createdb",
      [
        "-h",
        "127.0.0.1",
        "-p",
        String(port),
        "-U",
        "btl_ui",
        "btl_integration_ui",
      ],
      { env: { ...env, PGPASSWORD: config.password } },
    );
}
const devLock = path.join(cache, "dev.lock");
function running(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === "EPERM"; }
}
function listening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const done = (value) => { socket.destroy(); resolve(value); };
    socket.setTimeout(1500);
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.once("timeout", () => done(true));
  });
}
async function dev() {
  // Atomic lock prevents two launchers from starting watchers concurrently.
  for (;;) {
    try {
      fs.writeFileSync(devLock, String(process.pid), { flag: "wx" });
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const pid = Number(fs.readFileSync(devLock, "utf8").trim());
      if (running(pid)) {
        console.log("Local UI is already running or starting. Open http://127.0.0.1:5173 (API: http://127.0.0.1:3000/api). No second instance started.");
        return;
      }
      fs.unlinkSync(devLock);
    }
  }
  try {
    const ports = [3000, 5173];
    const occupied = (await Promise.all(ports.map(listening)))
      .map((busy, index) => busy ? ports[index] : null).filter(Boolean);
    if (occupied.length) {
      // Also recognize the background launcher created before locks were added.
      const legacy = path.join(cache, "dev.pid");
      const legacyPid = fs.existsSync(legacy)
        ? Number(fs.readFileSync(legacy, "utf8").trim()) : 0;
      if (occupied.length === 2 && running(legacyPid)) {
        console.log("Local UI is already running. Open http://127.0.0.1:5173 (API: http://127.0.0.1:3000/api). No second instance started.");
        return;
      }
      throw new Error(`Port(s) ${occupied.join(", ")} already in use. Stop the existing dev session with Ctrl+C in its terminal before running pnpm ui:dev. No watchers were started.`);
    }
    start();
    run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["dev"], {
      shell: process.platform === "win32",
    });
  } finally {
    if (fs.existsSync(devLock) && fs.readFileSync(devLock, "utf8").trim() === String(process.pid))
      fs.unlinkSync(devLock);
  }
}
async function main() {
const action = process.argv[2] || "dev";
if (action === "dev") return dev();
if (action === "stop") {
  pg("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"], { stdio: "ignore" });
  console.log("Stopped local UI database; data retained.");
} else {
  start();
  if (action === "prepare") {
    node("prisma/build/index.js", [
      "migrate",
      "deploy",
      "--schema",
      path.join(root, "backend/prisma/schema.prisma"),
    ]);
    run(process.execPath, [path.join(root, "backend/prisma/seed.cjs")]);
    console.log("Local UI database prepared. Supabase was not modified.");
  } else if (action === "backend")
    run(process.execPath, [path.join(root, "backend/dist/main.js")]);
  else throw new Error("Use prepare, dev, backend or stop.");
}
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
