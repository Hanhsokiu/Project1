const { resolve } = require("node:path");
const mode = process.env.GPMS_BROWSER_MODE;
if (!["api", "demo"].includes(mode))
  throw new Error("An explicit safe browser mode is required.");
// Override all existing flags; do not edit or rely on developer .env files.
const enabled = mode === "api" ? "true" : "false";
Object.assign(process.env, {
  VITE_API_URL: "/api",
  VITE_AUTH_API: enabled,
  VITE_TERM_API: enabled,
  VITE_CATALOG_API: enabled,
  VITE_IMPORT_API: enabled,
  VITE_REGISTRATION_API: enabled,
  VITE_DEFENSE_CONFIRMATION_API: enabled,
  VITE_FINAL_REPORT_API: enabled,
  VITE_DEFENSE_LIST_API: enabled,
  VITE_DEFENSE_PLANNING_API: enabled,
  VITE_GRADING_API: enabled,
  VITE_DEMO_MODE: mode === "demo" ? "true" : "false",
});
(async () => {
  const { createServer } = await import("vite");
  const server = await createServer({
    root: resolve(__dirname, ".."),
    mode: `e2e-${mode}`,
    server: { host: "127.0.0.1", port: 5173, strictPort: true },
    plugins: [
      {
        name: "browser-tests-never-proxy-to-backend",
        configureServer(vite) {
          // Before Vite's proxy: missing browser mocks cannot reach any backend.
          vite.middlewares.use("/api", (_request, response) => {
            response.statusCode = 503;
            response.setHeader("Content-Type", "application/json");
            response.end(
              JSON.stringify({
                error: {
                  code: "E2E_UNMOCKED_API",
                  message:
                    "This isolated frontend server does not forward API requests.",
                },
              }),
            );
          });
        },
      },
    ],
  });
  await server.listen();
  server.printUrls();
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
