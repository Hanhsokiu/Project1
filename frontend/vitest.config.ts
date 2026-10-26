import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: {
    alias: { "@doan/shared": path.resolve(__dirname, "../shared/src") },
  },
  test: {
    env: {
      VITE_AUTH_API: "false",
      VITE_TERM_API: "false",
      VITE_CATALOG_API: "false",
      VITE_IMPORT_API: "false",
      VITE_REGISTRATION_API: "false",
    },
    include: ["src/**/*.test.ts", "src/**/*.spec.ts", "src/**/*.spec.tsx"],
    environment: "node",
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
