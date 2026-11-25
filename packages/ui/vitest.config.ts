import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 15_000,
    hookTimeout: 30_000,
    maxWorkers: 4,
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    execArgv: ["--no-experimental-webstorage"],
    include: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
  },
});
