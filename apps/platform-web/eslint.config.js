import globals from "globals";
import { createReactConfig, REACT_COMPILER_RULE_NAMES } from "@mms/eslint-config";

// Transitional: `apps/platform-web` still carries a few shared shell files while
// the platform/tenant split is finalized, so it keeps `appKind: "app"`.
export default createReactConfig({
  appKind: "app",
  files: ["src/**/*.{ts,tsx}"],
  ignores: ["dist/**", "public/**"],
  extensions: [
    {
      // Custom rule files and scripts are CommonJS tooling, not browser code.
      files: ["eslint-rules/**/*.cjs", "scripts/**/*.{js,cjs,mjs}"],
      languageOptions: { globals: globals.node },
      rules: { "@typescript-eslint/no-require-imports": "off" },
    },
    {
      files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
      rules: {
        // Tests are not run through the React Compiler transform; harnesses
        // assign module-scope probe variables inside components deliberately.
        ...Object.fromEntries(REACT_COMPILER_RULE_NAMES.map((rule) => [rule, "off"])),
        "react-hooks/globals": "off",
      },
    },
  ],
});
