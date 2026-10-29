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
import directApiClientRule from "./eslint-rules/no-direct-api-client.cjs";
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
// (`recommended-latest`). `set-state-in-effect` was burned down to zero on
// 2026-10-29 (128 → 0, one documented disable in `useIdleTimer`, which owns its
// deadline in refs) and is now gated at `error` — do not reintroduce it.
// The remaining rules stay `warn` (each fix changes render semantics and has not
// been triaged): a no-cache `eslint .` reports `refs` (45), `immutability` (11),
// `incompatible-library` (13), `purity` (4), `preserve-manual-memoization` (4),
// `use-memo` (3), `static-components` (2). `rules-of-hooks` and
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
        rules: {
          "no-cross-feature-imports": boundaryImports,
          "no-ui-host-imports": uiHostImports,
          "no-direct-api-client": directApiClientRule,
        },
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
        "error",
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
      // Burned down to zero (one documented disable in `useIdleTimer`). A new
      // synchronous `setState` in an effect is a regression: derive during render,
      // lazy-initialise, or move the work to the event that causes it.
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/globals": "error",
      "no-restricted-syntax": [
        "error",
        {
          // `print:bg-white` is the legitimate exception: print output must be
          // white regardless of the active theme.
          selector: "Literal[value=/(?<!print:)\\bbg-white\\b/]",
          message: "Prefer bg-card or SURFACE tokens over bg-white.",
        },
        {
          // Raw Tailwind palette utilities (e.g. bg-gray-500, text-zinc-800)
          // bypass the semantic token layer and break under runtime branding and
          // dark mode. Use SEMANTIC_* (lib/ui/semanticTone.ts) or the tokens
          // declared in index.css @theme. Sanctioned exception: ThemeModeSelector's
          // literal mode-preview swatches — see the colour-source block below.
          selector:
            "Literal[value=/\\b(bg|text|border|ring|outline|divide|from|via|to|fill|stroke|decoration|placeholder|caret|accent|shadow)-(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]/]",
          message:
            "Use semantic tokens (SEMANTIC_* / bg-primary / text-muted-foreground) instead of raw Tailwind palette utilities.",
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
    // Tenant + platform modules must use the typed ts-rest client; the raw
    // apiFetch/apiJson transport is only sanctioned in `src/lib/**` + `src/hooks/**`
    // (auth, integrations, uploads, db sync, background jobs) — see the rule header.
    // Two platform infrastructure files are likewise sanctioned and ignored here:
    //   - PlatformAuthContext: the platform auth/session context (its tenant twin
    //     `src/lib/contexts/AuthContext.tsx` uses the raw transport and is outside
    //     this rule's scope by living in `src/lib`).
    //   - PlatformSystemMaintenance: a `/ready` probe that needs `cache: "no-store"`,
    //     which the contract client does not expose.
    // The baseline (eslint-rules/direct-api-client-baseline.json) is now empty — every
    // module surface is migrated; new raw-transport module files fail this rule.
    files: [
      "src/tenant/features/**/*.{ts,tsx}",
      "src/tenant/hooks/**/*.{ts,tsx}",
      "src/platform/**/*.{ts,tsx}",
    ],
    ignores: [
      "src/platform/lib/PlatformAuthContext.tsx",
      "src/platform/components/PlatformSystemMaintenance.tsx",
    ],
    rules: {
      "mms-boundary/no-direct-api-client": "error",
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      // Tests are not run through the React Compiler transform.
      ...Object.fromEntries(Object.keys(reactCompilerRules).map((rule) => [rule, "off"])),
      // Fixtures legitimately use literal colours.
      "no-restricted-syntax": "off",
      // Test harnesses wrap components with inline provider values deliberately.
      "mms-react/no-unmemoized-context-value": "off",
    },
  },
  {
    // Colour-source modules: the sanctioned homes for literal palette values
    // (print design tokens, the editor's colour swatches, and the theme-mode
    // preview swatches which must render literal light/dark regardless of the
    // active brand token set).
    files: [
      "src/lib/ui/printTemplateStyles.ts",
      "src/components/template-editor/templateEditorTypographyUtils.ts",
      "src/tenant/features/settings/components/ThemeModeSelector.tsx",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    // Static accessibility checks — complements the E2E axe sweep
    // (e2e/tests/a11y/*) by catching obvious issues before runtime.
    // Test files render real components but are not shipped UI, so they are
    // exempt (mirrors the test-exemption block above). A no-cache `eslint .`
    // reports 146 jsx-a11y findings (31 in test files → exempt); the
    // behaviour-neutral rules we have fully triaged (role-supports-aria-props,
    // role-has-required-aria-props, no-redundant-roles,
    // control-has-associated-label, aria-role) are gated at `error`. The
    // remaining interaction rules stay at `warn`: they were examined and the
    // backlog is correct patterns the rules over-flag (listbox `role="option"`,
    // `onClick={stopPropagation}` guards, pointer-only backdrops/dropzones/
    // resize handles, conditional-role elements that already set
    // role/tabIndex/onKeyDown, clickable rows with a keyboard alternative) —
    // see ADR-017, which records this split and requires E2E verification
    // before promoting any interaction rule.
    // Measure with `--no-cache` — the eslint `--cache` can hide warnings seeded
    // by an earlier `--quiet` run.
    files: ["src/**/*.tsx"],
    ignores: ["**/*.test.tsx", "**/*.spec.tsx"],
    plugins: { "jsx-a11y": pluginJsxA11y },
    rules: {
      ...Object.fromEntries(
        Object.keys(pluginJsxA11y.flatConfigs.recommended.rules ?? {}).map((rule) => [
          rule,
          "warn",
        ]),
      ),
      // Promoted to `error` after triage — semantics-only, no UX change.
      "jsx-a11y/role-supports-aria-props": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/no-redundant-roles": "error",
      "jsx-a11y/control-has-associated-label": "error",
      "jsx-a11y/aria-role": "error",
      // Deprecated by the plugin in favour of `label-has-associated-control`.
      "jsx-a11y/label-has-for": "off",
    },
  },
  eslintConfigPrettier,
);
