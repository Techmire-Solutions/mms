/**
 * Node/TypeScript preset — `apps/api`, `packages/{contracts,db,be-core}`,
 * `packages/modules/<slice>/be`, `e2e` and the shared tooling scripts.
 *
 * Usage: `createNodeConfig({ files, parserOptions, rules })` with package-relative
 * globs; see README.md for a complete example and the option table.
 */
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import { recommendedConfigs, SHARED_TS_RULES, globalsFor } from "./base.mjs";
import { boundariesConfigs, testBoundaryExemption } from "./boundaries.mjs";

/**
 * @param {object} options
 * @param {string[]} options.files            Package-relative globs to lint.
 * @param {"node"|"browser"|"browser+node"} [options.globals]
 * @param {object} [options.parserOptions]    Extra parser options (e.g. typed `project`).
 * @param {object} [options.rules]            Per-package rule overrides (win over defaults).
 * @param {string[]} [options.ignores]        Package-relative ignore globs.
 * @param {unknown[]} [options.extensions]    Extra flat-config objects appended before prettier.
 * @param {string} [options.rootPath]         Override the monorepo root for boundaries.
 */
export function createNodeConfig({
  files,
  globals: runtime = "node",
  parserOptions = {},
  rules = {},
  ignores = [],
  extensions = [],
  rootPath,
} = {}) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("@mms/eslint-config: createNodeConfig requires a non-empty `files` array.");
  }

  return tseslint.config(
    ...(ignores.length > 0 ? [{ ignores }] : []),
    ...boundariesConfigs({ rootPath }),
    {
      files,
      extends: recommendedConfigs(),
      languageOptions: {
        globals: globalsFor(runtime),
        parserOptions: {
          ecmaVersion: 2022,
          sourceType: "module",
          ...parserOptions,
        },
      },
      rules: { ...SHARED_TS_RULES, ...rules },
    },
    testBoundaryExemption,
    ...extensions,
    eslintConfigPrettier,
  );
}
