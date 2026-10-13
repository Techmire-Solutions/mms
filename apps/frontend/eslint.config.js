import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginUnusedImports from "eslint-plugin-unused-imports";
import pluginJsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";
import boundaryImports from "./eslint-rules/no-cross-feature-imports.cjs";
import uiHostImports from "./eslint-rules/no-ui-host-imports.cjs";
import directionalRule from "./eslint-rules/no-physical-directional-classes.cjs";
import contextValueRule from "./eslint-rules/no-unmemoized-context-value.cjs";
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

// React Compiler lint rules shipped by eslint-plugin-react-hooks v7
// (`recommended-latest`). Landed as `warn` for triage — `rules-of-hooks` and
// `exhaustive-deps` stay governed by the explicit `error` entries below.
const reactCompilerRules = Object.fromEntries(
  Object.keys(pluginReactHooks.configs?.["recommended-latest"]?.rules ?? {})
    .filter(
      (name) => name !== "react-hooks/rules-of-hooks" && name !== "react-hooks/exhaustive-deps",
    )
    .map((name) => [name, "warn"]),
);

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
      "mms-react": { rules: { "no-unmemoized-context-value": contextValueRule } },
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
      "mms-react/no-unmemoized-context-value": "error",
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
      "react-hooks/exhaustive-deps": "error",
      ...reactCompilerRules,
      "no-restricted-syntax": [
        "error",
        {
          // `print:bg-white` is the legitimate exception: print output must be
          // white regardless of the active theme.
          selector: "Literal[value=/(?<!print:)\\bbg-white\\b/]",
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
      // Fixtures legitimately use literal colours.
      "no-restricted-syntax": "off",
      // Test harnesses wrap components with inline provider values deliberately.
      "mms-react/no-unmemoized-context-value": "off",
    },
  },
  {
    // Colour-source modules: the sanctioned homes for literal palette values
    // (print design tokens and the editor's colour swatches).
    files: [
      "src/lib/ui/printTemplateStyles.ts",
      "src/components/template-editor/templateEditorTypographyUtils.ts",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    // Static accessibility checks — complements the E2E axe sweep
    // (e2e/tests/a11y/*) by catching obvious issues before runtime.
    // Kept at `warn`: a no-cache `eslint .` currently reports 146 jsx-a11y
    // findings (no-autofocus, click-events-have-key-events, no-redundant-roles,
    // control-has-associated-label, …). Ratchet to `error` once that backlog is
    // triaged. Measure with `--no-cache` — the eslint `--cache` can hide
    // warnings seeded by an earlier `--quiet` run.
    files: ["src/**/*.tsx"],
    plugins: { "jsx-a11y": pluginJsxA11y },
    rules: {
      ...Object.fromEntries(
        Object.keys(pluginJsxA11y.flatConfigs.recommended.rules ?? {}).map((rule) => [
          rule,
          "warn",
        ]),
      ),
      // Deprecated by the plugin in favour of `label-has-associated-control`.
      "jsx-a11y/label-has-for": "off",
    },
  },
  eslintConfigPrettier,
);
