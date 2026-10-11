import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginUnusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";
import boundaryImports from "./eslint-rules/no-cross-feature-imports.cjs";
import uiHostImports from "./eslint-rules/no-ui-host-imports.cjs";
import directionalRule from "./eslint-rules/no-physical-directional-classes.cjs";
import eslintConfigPrettier from "eslint-config-prettier/flat";

const appFiles = [
  "src/components/**/*.{ts,tsx}",
  "src/pages/**/*.{ts,tsx}",
  "src/hooks/**/*.{ts,tsx}",
  "src/lib/**/*.{ts,tsx}",
  "src/providers/**/*.{ts,tsx}",
  "src/tenant/**/*.{ts,tsx}",
  "src/platform/**/*.{ts,tsx}",
  "src/common/**/*.{ts,tsx}",
];

export default tseslint.config(
  {
    ignores: ["dist/**", "public/**"],
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["eslint-rules/**/*.cjs", "scripts/**/*.{js,cjs,mjs}"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: appFiles,
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "19.2" },
    },
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "unused-imports": pluginUnusedImports,
      "mms-boundary": {
        rules: { "no-cross-feature-imports": boundaryImports, "no-ui-host-imports": uiHostImports },
      },
      "mms-bidi": { rules: { "no-physical-directional-classes": directionalRule } },
    },
    rules: {
      "no-useless-assignment": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-expect-error": "allow-with-description" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
          disallowTypeAnnotations: false,
        },
      ],
      "mms-boundary/no-cross-feature-imports": "error",
      "mms-boundary/no-ui-host-imports": "error",
      "mms-bidi/no-physical-directional-classes": "error",
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "error",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/no-unknown-property": ["error", { ignore: ["cmdk-input-wrapper", "toast-close"] }],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-restricted-syntax": [
        "warn",
        {
          selector: "Literal[value=/\\bbg-white\\b/]",
          message: "Prefer bg-card or SURFACE tokens over bg-white.",
        },
        {
          selector: "Literal[value=/text-\\[#/]",
          message: "Prefer semantic text tokens over arbitrary hex in className.",
        },
        {
          selector: "Literal[value=/#ef4444|#047857|#f59e0b/]",
          message: "Use branding palette or semanticTone tokens instead of hardcoded hex.",
        },
        {
          selector: "Literal[value=/\\btext-\\[1[01]px\\]/]",
          message:
            "Use the micro-typography scale: text-4xs (10px), text-3xs (11px) or text-2xs (12px).",
        },
        {
          selector: "Literal[value=/\\bmin-h-\\[44px\\]/]",
          message: "Use min-h-11 for 44px touch floor target.",
        },
        {
          selector: "Literal[value=/\\b[hw]-\\[\\d+px\\]/]",
          message:
            "Use semantic width/height tokens or spacing scale instead of arbitrary pixel values.",
        },
      ],
    },
  },
  {
    // Tests may use `any` for mocks; the norm guards shipping source only
    // (mirrors the test-file exemption in scripts/check-code-norms.mjs).
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  eslintConfigPrettier,
);
