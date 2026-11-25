import { createNodeConfig } from "@mms/eslint-config";

export default createNodeConfig({
  ignores: ["dist/**"],
  files: ["src/**/*.ts"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: import.meta.dirname,
  },
  rules: {
    // Type-aware rules: catch unhandled/misused promises (real bug sources).
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
  },
  extensions: [
    {
      // Tests may use `any` for mocks; the norm guards shipping source only
      // (mirrors the test-file exemption in scripts/check-code-norms.mjs).
      files: ["src/__tests__/**/*.ts"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
      },
    },
  ],
});
