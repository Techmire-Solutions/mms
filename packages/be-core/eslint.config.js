import { createNodeConfig } from "@mms/eslint-config";

export default createNodeConfig({
  files: ["src/**/*.ts", "vitest.config.ts"],
  globals: "node",
  ignores: ["dist/**"],
});
