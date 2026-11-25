import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 15_000,
    hookTimeout: 30_000,
    maxWorkers: 4,
    environment: "node",
    include: ["src/shared/**/*.test.ts", "src/backend/**/*.test.ts"],
    exclude: ["src/backend/__tests__/db-integration/**"],
  },
});
