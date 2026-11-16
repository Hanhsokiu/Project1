"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  cp = require("node:child_process");
const { pathToFileURL } = require("node:url"),
  local = require("./local.cjs");
async function main() {
  const cfg = local.configuration(),
    env = local.sanitizedEnvironment({
      DATABASE_URL: local.connection(cfg),
      DIRECT_URL: local.connection(cfg),
      NODE_ENV: "test",
    }),
    checks = [];
  function run(name, exe, args, cwd) {
    const r = cp.spawnSync(exe, args, {
      cwd,
      env,
      encoding: "utf8",
      windowsHide: true,
      timeout: 180000,
      maxBuffer: 8 * 1024 * 1024,
    });
    checks.push({
      name,
      command: [path.relative(local.root, exe), ...args],
      status: !r.error && r.status === 0 ? "PASS" : "FAIL",
      exitCode: r.status,
    });
    if (r.error || r.status !== 0)
      throw Error(name + " failed (details suppressed)");
  }
  const dir = path.join(local.cache, "schema-check");
  fs.mkdirSync(dir, { recursive: true });
  const provider = path
    .join(
      path.dirname(local.req.resolve("@prisma/client/package.json")),
      "generator-build/index.js",
    )
    .replaceAll("\\", "/");
  const source = fs
    .readFileSync(path.join(local.backend, "prisma/schema.prisma"), "utf8")
    .replace(
      'provider = "prisma-client-js"',
      `provider = "${provider}"\n  output = "../generated-client"`,
    );
  const schema = path.join(dir, "schema.prisma");
  fs.writeFileSync(schema, source);
  try {
    run("shared build", process.execPath, [local.req.resolve("typescript/bin/tsc"), "-p", path.join(local.root,"shared/tsconfig.json")], local.cache);
    for (const action of ["validate", "generate"])
      run(
        "prisma " + action,
        process.execPath,
        [
          local.req.resolve("prisma/build/index.js"),
          action,
          "--schema",
          schema,
        ],
        local.cache,
      );
    run(
      "backend production build",
      process.execPath,
      [local.req.resolve("typescript/bin/tsc"), "-p", "tsconfig.build.json"],
      local.backend,
    );
    const frontend = path.join(local.root, "frontend"),
      req = require("node:module").createRequire(
        path.join(frontend, "package.json"),
      );
    const keep = local.sanitizedEnvironment();
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, keep, {
      NODE_ENV: "production",
      VITE_AUTH_API: "true",
      VITE_API_URL: "/api",
      VITE_DEMO_MODE: "false",
    });
    const m = await import(pathToFileURL(req.resolve("vite")).href),
      react = (
        await import(pathToFileURL(req.resolve("@vitejs/plugin-react")).href)
      ).default;
    await (m.build || m.default.build)({
      root: frontend,
      configFile: false,
      envDir: false,
      plugins: [react()],
      resolve: {
        alias: {
          "@": path.join(frontend, "src"),
          "@shared": path.join(frontend, "src/shared"),
          "@features": path.join(frontend, "src/features"),
          "@app": path.join(frontend, "src/app"),
          "@doan/shared": path.join(local.root, "shared/src"),
        },
      },
      build: {
        outDir: path.join(local.cache, "frontend-build"),
        emptyOutDir: false,
      },
    });
    checks.push({
      name: "frontend Vite build, API mode, no env files",
      status: "PASS",
    });
  } finally {
    fs.writeFileSync(
      path.join(local.root, "docs/demo-data-v3/evidence/build-checks.json"),
      JSON.stringify({ checks, productionConnected: false }, null, 2),
    );
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
