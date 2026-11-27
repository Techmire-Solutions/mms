/**
 * `@mms/eslint-config` — the monorepo's shared ESLint surface.
 *
 * - `createNodeConfig`  → Node/TypeScript packages (API, contracts, db, be-core, e2e).
 * - `createReactConfig` → web apps and React packages (tenant-web, platform-web, ui, fe-core).
 * - `audienceImportRestrictions` → per-audience import bans for an app or module
 *   audience (`apps/tenant-web`, `apps/platform-web`).
 * - `boundaries*`       → the architecture policy SSOT (also importable on its own).
 *
 * Every factory returns a flat-config array in this order: ignores → boundaries
 * settings/rule → the package's file scope → test exemption → caller extensions →
 * `eslint-config-prettier` (always last).
 */
export { createNodeConfig } from "./node.mjs";
export {
  audienceImportRestrictions,
  createReactConfig,
  REACT_COMPILER_RULE_NAMES,
  TENANT_PLATFORM_IMPORT_PATTERNS,
} from "./react.mjs";
export {
  BOUNDARIES_RULE,
  ELEMENT_DESCRIPTORS,
  POLICIES,
  TEST_GLOBS,
  boundariesConfigs,
  boundariesRuleOptions,
  boundariesSettings,
  boundariesPluginRef,
  findRepoRoot,
  testBoundaryExemption,
} from "./boundaries.mjs";
export { SHARED_TS_RULES, globalsFor, recommendedConfigs } from "./base.mjs";
