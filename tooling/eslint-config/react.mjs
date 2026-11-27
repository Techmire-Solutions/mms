/**
 * React preset — web apps (`apps/tenant-web`, `apps/platform-web`) and any
 * `packages/modules/*\/fe` surface that lints with a component tree.
 *
 * The rule set mirrors the historical `apps/frontend/eslint.config.js` app block
 * exactly (React 19 / hooks v7, including the React Compiler `recommended-latest`
 * rules kept at `warn` and the burn-down rules kept at `error`). Package-specific
 * rules stay in the consumer's `extensions` array, which is inserted BEFORE
 * `eslint-config-prettier` so formatting still wins last.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import globals from "globals";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginUnusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import { recommendedConfigs, SHARED_TS_RULES } from "./base.mjs";
import { boundariesConfigs, testBoundaryExemption } from "./boundaries.mjs";

/**
 * React Compiler rules shipped by `eslint-plugin-react-hooks` v7 in
 * `recommended-latest`, excluding the two governed explicitly at `error`.
 * The test-feature exemption needs these names to switch them off.
 */
export const REACT_COMPILER_RULE_NAMES = Object.freeze(
  Object.keys(pluginReactHooks.configs?.["recommended-latest"]?.rules ?? {}).filter(
    (name) => name !== "react-hooks/rules-of-hooks" && name !== "react-hooks/exhaustive-deps",
  ),
);

const REACT_COMPILER_RULES = Object.fromEntries(
  REACT_COMPILER_RULE_NAMES.map((name) => [name, "warn"]),
);

/**
 * Import specifiers a tenant app may never use. Element policies deny the
 * `apps/platform-web` package; these patterns are specifier-based so they also
 * catch the app-local `@/platform/...` alias, which no resolver can map.
 */
export const TENANT_PLATFORM_IMPORT_PATTERNS = Object.freeze([
  "*/platform",
  "*/platform/**",
  "**/platform",
  "**/platform/**",
]);

const TENANT_PLATFORM_MESSAGE =
  "apps/tenant-web must never import the platform console (`*/platform`, `@/platform/**`). " +
  "Cross-console code belongs in @mms/ui or @mms/fe-core.";

/**
 * A module has no root export: consumers must always choose an audience.
 * `no-restricted-imports` patterns treat `*` as crossing `/`, so a glob root
 * pattern would also ban the valid subpaths. Exact package names are read from
 * the workspace instead, keeping the ban self-maintaining for new modules.
 */
const MODULES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../packages/modules",
);

function moduleRootSpecifiers() {
  try {
    return fs
      .readdirSync(MODULES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const manifest = path.join(MODULES_DIR, entry.name, "package.json");
        if (!fs.existsSync(manifest)) return null;
        const { name } = JSON.parse(fs.readFileSync(manifest, "utf8"));
        return typeof name === "string" && name.startsWith("@mms/mod-") ? name : null;
      })
      .filter((name) => name !== null);
  } catch {
    return [];
  }
}

export const MODULE_ROOT_SPECIFIERS = Object.freeze(moduleRootSpecifiers());
export const MODULE_ROOT_IMPORT_PATHS = Object.freeze(
  MODULE_ROOT_SPECIFIERS.map((name) => ({
    name,
    message:
      "Import a module audience subpath (`shared`, `backend/*`, `frontend/*`); there is no module root export.",
  })),
);

/** Audience-separated module subpaths that a tenant app must never import. */
export const MODULE_PLATFORM_IMPORT_PATTERNS = Object.freeze([
  "@mms/mod-*/frontend/platform",
  "@mms/mod-*/frontend/platform/**",
]);
export const MODULE_BACKEND_IMPORT_PATTERNS = Object.freeze([
  "@mms/mod-*/backend",
  "@mms/mod-*/backend/**",
]);
export const MODULE_TENANT_IMPORT_PATTERNS = Object.freeze([
  "@mms/mod-*/frontend/tenant",
  "@mms/mod-*/frontend/tenant/**",
]);
const MODULE_AUDIENCE_MESSAGES = {
  platform: "This app may only import a module's platform frontend audience.",
  tenant: "This app may only import a module's tenant frontend audience.",
  backend: "Frontend apps must never import a module's backend audience.",
};

/**
 * `no-restricted-imports` rules for an app audience.
 *
 * Exported because an app may need more than one audience: the pre-split hybrid
 * `apps/frontend` kept `appKind: "app"` and applied
 * `audienceImportRestrictions("tenant")` to its `src/tenant/**` subtree.
 * `apps/tenant-web` and `apps/platform-web` now pass their own `appKind`
 * (`"tenant"` / `"platform"`) directly to `createReactConfig`.
 *
 * @param {"app"|"tenant"|"platform"} appKind
 * @returns {{ "no-restricted-imports": ["error", { patterns: Array<{ group: readonly string[], message: string }> }] }}
 */
export function audienceImportRestrictions(appKind = "app") {
  if (!["app", "tenant", "platform"].includes(appKind)) {
    throw new Error(
      `@mms/eslint-config: appKind must be "app", "tenant" or "platform" (got "${appKind}").`,
    );
  }

  const patterns = [];
  if (appKind === "tenant") {
    patterns.push(
      { group: TENANT_PLATFORM_IMPORT_PATTERNS, message: TENANT_PLATFORM_MESSAGE },
      { group: MODULE_PLATFORM_IMPORT_PATTERNS, message: MODULE_AUDIENCE_MESSAGES.platform },
      { group: MODULE_BACKEND_IMPORT_PATTERNS, message: MODULE_AUDIENCE_MESSAGES.backend },
    );
  } else if (appKind === "platform") {
    patterns.push(
      { group: MODULE_TENANT_IMPORT_PATTERNS, message: MODULE_AUDIENCE_MESSAGES.tenant },
      { group: MODULE_BACKEND_IMPORT_PATTERNS, message: MODULE_AUDIENCE_MESSAGES.backend },
    );
  } else {
    patterns.push({
      group: MODULE_BACKEND_IMPORT_PATTERNS,
      message: MODULE_AUDIENCE_MESSAGES.backend,
    });
  }

  return {
    "no-restricted-imports": [
      "error",
      { paths: MODULE_ROOT_IMPORT_PATHS.map((entry) => ({ ...entry })), patterns },
    ],
  };
}

/**
 * @param {object} options
 * @param {string[]} options.files              Package-relative globs to lint.
 * @param {string} [options.reactVersion]       `settings.react.version` (default "19.2").
 * @param {"app"|"tenant"|"platform"} [options.appKind]
 *   `"tenant"` additionally bans imports whose specifier contains a `platform`
 *   segment (see TENANT_PLATFORM_IMPORT_PATTERNS). `apps/tenant-web` passes
 *   `"tenant"`; `apps/platform-web` passes `"platform"`.
 * @param {object} [options.rules]              Per-package rule overrides.
 * @param {string[]} [options.ignores]          Package-relative ignore globs.
 * @param {unknown[]} [options.extensions]      Extra flat-config objects appended before prettier.
 * @param {string} [options.rootPath]           Override the monorepo root for boundaries.
 */
export function createReactConfig({
  files,
  reactVersion = "19.2",
  appKind = "app",
  rules = {},
  ignores = [],
  extensions = [],
  rootPath,
} = {}) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("@mms/eslint-config: createReactConfig requires a non-empty `files` array.");
  }
  if (!["app", "tenant", "platform"].includes(appKind)) {
    throw new Error(
      `@mms/eslint-config: appKind must be "app", "tenant" or "platform" (got "${appKind}").`,
    );
  }

  const appRules = {
    "no-useless-assignment": "off",
    "no-unused-vars": "off",
    ...SHARED_TS_RULES,
    // `unused-imports` owns unused detection in the React tree.
    "@typescript-eslint/no-unused-vars": "off",
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
    ...REACT_COMPILER_RULES,
    // Burned down to zero (hooks audit 2026-11); a new synchronous setState in an
    // effect is a regression, not debt.
    "react-hooks/set-state-in-effect": "error",
    "react-hooks/globals": "error",
    ...audienceImportRestrictions(appKind),
    ...rules,
  };

  return tseslint.config(
    ...(ignores.length > 0 ? [{ ignores }] : []),
    // Global (not file-scoped) to match the historical frontend config: the
    // recommended JS/TS sets also cover the package's own config files.
    ...recommendedConfigs(),
    ...boundariesConfigs({ rootPath }),
    {
      files,
      ...pluginReact.configs.flat.recommended,
      languageOptions: {
        globals: globals.browser,
        parserOptions: {
          ecmaVersion: "latest",
          sourceType: "module",
          ecmaFeatures: { jsx: true },
        },
      },
      settings: { react: { version: reactVersion } },
      plugins: {
        react: pluginReact,
        "react-hooks": pluginReactHooks,
        "unused-imports": pluginUnusedImports,
      },
      rules: appRules,
    },
    testBoundaryExemption,
    ...extensions,
    eslintConfigPrettier,
  );
}
