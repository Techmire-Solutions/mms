import { createNodeConfig, createReactConfig } from "@mms/eslint-config";

export default [
  ...createNodeConfig({
    files: ["src/shared/**/*.ts", "src/backend/**/*.ts", "*.config.ts"],
    globals: "node",
    rules: { "@typescript-eslint/no-explicit-any": "off" },
    ignores: ["dist/**"],
    extensions: [
      {
        files: ["src/**/*.test.ts", "src/**/__tests__/**/*.ts"],
        rules: { "@typescript-eslint/no-explicit-any": "off" },
      },
    ],
  }),
  {
    files: ["src/backend/**", "src/shared/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  ...createReactConfig({
    files: ["src/frontend/**/*.ts", "src/frontend/**/*.tsx"],
    appKind: "app",
    ignores: ["dist/**"],
    extensions: [
      {
        files: ["src/frontend/**/*.test.ts", "src/frontend/**/*.test.tsx"],
        rules: { "@typescript-eslint/no-explicit-any": "off", "react-hooks/globals": "off" },
      },
    ],
  }),
];
