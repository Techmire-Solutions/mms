import { createNodeConfig } from "@mms/eslint-config";

// @mms/contracts is consumed by both the React app (browser) and the
// Fastify backend (node), so globals from both runtimes are valid here.
export default createNodeConfig({
  ignores: ["dist/**"],
  files: ["src/**/*.ts"],
  globals: "browser+node",
  extensions: [
    {
      // Tests may use `any` for mocks; the norm guards shipping source only
      // (mirrors the test-file exemption in scripts/check-code-norms.mjs).
      files: ["src/**/*.test.ts", "src/**/*.spec.ts", "src/**/__tests__/**/*.ts"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
      },
    },
  ],
});
