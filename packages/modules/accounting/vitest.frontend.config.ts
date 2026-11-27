import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 15_000,
    hookTimeout: 30_000,
    maxWorkers: 4,
    environment: "happy-dom",
    execArgv: ["--no-experimental-webstorage"],
    include: ["src/frontend/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/frontend/test/setup.ts"],
  },
});
