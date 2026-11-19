"use strict";
// Actual repository frontend, real local API; no fixtures, env files or Demo mode.
const path = require("node:path"),
  { pathToFileURL } = require("node:url"),
  { root, backend, req, sanitizedEnvironment } = require("./local.cjs");
async function main() {
  const keep = sanitizedEnvironment();
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, keep, {
    VITE_AUTH_API: "true",
    VITE_API_URL: "/api",
    VITE_DEMO_MODE: "false",
  });
  const frontend = path.join(root, "frontend"),
    frontReq = require("node:module").createRequire(
      path.join(frontend, "package.json"),
    );
  const vite = await import(pathToFileURL(frontReq.resolve("vite")).href),
    react = (
      await import(pathToFileURL(frontReq.resolve("@vitejs/plugin-react")).href)
    ).default;
  const server = await (vite.createServer || vite.default.createServer)({
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
        "@doan/shared": path.join(root, "shared/src"),
      },
    },
    server: {
      host: "127.0.0.1",
      port: 5183,
      strictPort: true,
      proxy: {
        "/api": { target: "http://127.0.0.1:3083", changeOrigin: true },
      },
    },
  });
  await server.listen();
  console.log("Actual API frontend TEST: http://127.0.0.1:5183/login");
}
if (require.main === module)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
