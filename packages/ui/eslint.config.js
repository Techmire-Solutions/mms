import { createReactConfig } from "@mms/eslint-config";

export default createReactConfig({
  files: ["src/**/*.ts", "src/**/*.tsx", "vitest.config.ts"],
  appKind: "app",
  ignores: ["dist/**"],
  extensions: [
    {
      files: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
      },
    },
  ],
});
