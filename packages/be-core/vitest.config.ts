import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@mms/be-core": path.resolve(import.meta.dirname, "./src/index.ts"),
      "@mms/be-core/auth": path.resolve(import.meta.dirname, "./src/auth/index.ts"),
      "@mms/be-core/rbac": path.resolve(import.meta.dirname, "./src/rbac/index.ts"),
      "@mms/be-core/logger": path.resolve(import.meta.dirname, "./src/logger/index.ts"),
      "@mms/be-core/telemetry": path.resolve(import.meta.dirname, "./src/telemetry/index.ts"),
      "@mms/be-core/http": path.resolve(import.meta.dirname, "./src/http/index.ts"),
      "@mms/be-core/redis": path.resolve(import.meta.dirname, "./src/redis/index.ts"),
      "@mms/be-core/queues": path.resolve(import.meta.dirname, "./src/queues/index.ts"),
      "@mms/be-core/realtime": path.resolve(import.meta.dirname, "./src/realtime/index.ts"),
      "@mms/be-core/transports": path.resolve(import.meta.dirname, "./src/transports/index.ts"),
      "@mms/be-core/testing": path.resolve(import.meta.dirname, "./src/testing/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
  },
});
