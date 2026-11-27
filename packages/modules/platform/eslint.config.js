import { createNodeConfig, createReactConfig } from "@mms/eslint-config";

export default [
  ...createNodeConfig({
    files: ["src/shared/**/*.ts", "src/backend/**/*.ts", "*.config.ts"],
    globals: "node",
    ignores: ["dist/**"],
    extensions: [
      {
        files: ["src/**/*.test.ts", "src/**/__tests__/**/*.ts"],
        rules: { "@typescript-eslint/no-explicit-any": "off" },
      },
    ],
  }),
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
  // Platform console module: dynamic port bindings + console route/service doubles are
  // intentionally untyped at the boundary. Last config wins.
  {
    files: ["src/backend/platform/**/*.ts", "src/backend/__tests__/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
];
