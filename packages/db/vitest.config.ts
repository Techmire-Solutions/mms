import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      // Most specific first: `@mms/db` is a prefix of the subpath entries.
      { find: "@mms/db/client", replacement: path.resolve(import.meta.dirname, "./src/client.ts") },
      {
        find: "@mms/db/context",
        replacement: path.resolve(import.meta.dirname, "./src/context.ts"),
      },
      { find: "@mms/db/schema", replacement: path.resolve(import.meta.dirname, "./src/schema.ts") },
      {
        find: "@mms/db/migrations",
        replacement: path.resolve(import.meta.dirname, "./src/migrations.ts"),
      },
      {
        find: "@mms/db/testing",
        replacement: path.resolve(import.meta.dirname, "./src/testing.ts"),
      },
      { find: "@mms/db", replacement: path.resolve(import.meta.dirname, "./src/index.ts") },
    ],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
