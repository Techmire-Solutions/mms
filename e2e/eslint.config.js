import { createNodeConfig } from "@mms/eslint-config";

export default createNodeConfig({
  ignores: ["node_modules/**", "playwright-report/**", "test-results/**", "blob-report/**"],
  files: ["tests/**/*.ts", "helpers/**/*.ts", "scripts/**/*.ts", "playwright.config.ts"],
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/ban-ts-comment": "off",
  },
});
