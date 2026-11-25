import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@mms/db": path.resolve(import.meta.dirname, "./src/index.ts"),
      "@mms/db/context": path.resolve(import.meta.dirname, "./src/context.ts"),
      "@mms/db/schema": path.resolve(import.meta.dirname, "./src/schema.ts"),
      "@mms/db/testing": path.resolve(import.meta.dirname, "./src/testing.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
