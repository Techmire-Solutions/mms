import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@mms/fe-core/backgroundJobs/startServerModuleCsvImport": path.resolve(
        import.meta.dirname,
        "./src/backgroundJobs/startServerModuleCsvImport.ts",
      ),
      "@mms/fe-core/hooks/useModuleColumnLayout": path.resolve(
        import.meta.dirname,
        "./src/hooks/useModuleColumnLayout.ts",
      ),
      "@mms/fe-core/auth/useUiStateStore": path.resolve(
        import.meta.dirname,
        "./src/auth/useUiStateStore.ts",
      ),
      "@mms/fe-core/auth/AuthContext": path.resolve(
        import.meta.dirname,
        "./src/auth/AuthContext.tsx",
      ),
      "@mms/fe-core/storage/dbStorageCore": path.resolve(
        import.meta.dirname,
        "./src/storage/dbStorageCore.ts",
      ),
      "@mms/fe-core/api/tsRest": path.resolve(import.meta.dirname, "./src/api/tsRest.ts"),
      "@mms/fe-core/api/client": path.resolve(import.meta.dirname, "./src/api/client.ts"),
      "@mms/fe-core/api/download": path.resolve(import.meta.dirname, "./src/api/download.ts"),
      "@mms/fe-core/reporting/clientErrorReporting": path.resolve(
        import.meta.dirname,
        "./src/reporting/clientErrorReporting.ts",
      ),
      "@mms/fe-core/api": path.resolve(import.meta.dirname, "./src/api/index.ts"),
      "@mms/fe-core/notify": path.resolve(import.meta.dirname, "./src/notify.ts"),
      "@mms/fe-core/query": path.resolve(import.meta.dirname, "./src/query/index.ts"),
      "@mms/fe-core/auth": path.resolve(import.meta.dirname, "./src/auth/index.ts"),
      "@mms/fe-core/tenant": path.resolve(import.meta.dirname, "./src/tenant/index.ts"),
      "@mms/fe-core/forms": path.resolve(import.meta.dirname, "./src/forms/index.ts"),
      "@mms/fe-core/i18n": path.resolve(import.meta.dirname, "./src/i18n/index.ts"),
      "@mms/fe-core/config": path.resolve(import.meta.dirname, "./src/config/index.ts"),
      "@mms/fe-core/testing": path.resolve(import.meta.dirname, "./src/testing/index.ts"),
      "@mms/fe-core/hooks": path.resolve(import.meta.dirname, "./src/hooks/index.ts"),
      "@mms/fe-core/ui": path.resolve(import.meta.dirname, "./src/ui"),
      "@mms/fe-core/components": path.resolve(import.meta.dirname, "./src/components/index.ts"),
      "@mms/fe-core": path.resolve(import.meta.dirname, "./src/index.ts"),
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    execArgv: ["--no-experimental-webstorage"],
    include: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
  },
});
