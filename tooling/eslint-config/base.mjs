/**
 * Shared ESLint skeleton for every MMS package: the `@eslint/js` + typescript-eslint
 * recommended sets plus the repository's TypeScript rule defaults.
 *
 * Rule intent (do not weaken per-package without an ADR):
 * - `no-explicit-any` — zero explicit `any` in shipping source (the code-norms
 *   ratchet measures the same thing).
 * - `consistent-type-imports` — `verbatimModuleSyntax` requires type-only imports
 *   to be marked; inline style keeps the diff small.
 * - `no-unused-vars` — `_`-prefixed params/vars are the sanctioned ignore.
 */
import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

/** Repository TypeScript rule defaults (packages may override per surface). */
export const SHARED_TS_RULES = Object.freeze({
  "@typescript-eslint/no-unused-vars": [
    "error",
    { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
  ],
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/ban-ts-comment": ["error", { "ts-expect-error": "allow-with-description" }],
  "@typescript-eslint/consistent-type-imports": [
    "error",
    { prefer: "type-imports", fixStyle: "inline-type-imports", disallowTypeAnnotations: false },
  ],
});

/** Recommended rule sets shared by every package. */
export function recommendedConfigs() {
  return [pluginJs.configs.recommended, ...tseslint.configs.recommended];
}

/**
 * Runtime globals for a package.
 * `browser+node` is for `@mms/contracts`, consumed by both the SPA and the API.
 */
export function globalsFor(runtime = "node") {
  if (runtime === "browser") return globals.browser;
  if (runtime === "browser+node") return { ...globals.browser, ...globals.node };
  return globals.node;
}
