import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include:
      process.env.GPMS_INTEGRATION === "1"
        ? ["src/**/*.integration.spec.ts"]
        : ["src/**/*.spec.ts"],
    exclude:
      process.env.GPMS_INTEGRATION === "1"
        ? []
        : ["src/**/*.integration.spec.ts"],
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
