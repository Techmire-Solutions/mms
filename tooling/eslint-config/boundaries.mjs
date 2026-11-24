/**
 * MMS architectural boundaries — the single source of truth enforced by
 * `eslint-plugin-boundaries` for every workspace package.
 *
 * Target topology (see `docs/monorepo-migration-plan.md`):
 *
 *   apps/*                         → tenant-web / platform-web / api
 *   packages/modules/*             → vertical domain slices
 *   packages/{contracts,db,be-core,fe-core,ui}
 *   tooling/*                      → shared configs
 *   e2e                            → Playwright only
 *
 * Dependency direction (strictly one-way; the `default: "disallow"` below makes
 * anything not listed here a lint error):
 *
 *   apps      → any packages/* + packages/modules/* + tooling/*   (never another app)
 *   modules   → contracts, db, be-core, fe-core, ui, tooling/*     (never apps, never another module)
 *   fe-core   → contracts, ui, tooling/*
 *   be-core   → contracts, db, tooling/*
 *   db        → contracts, tooling/*
 *   ui        → contracts, tooling/*
 *   contracts → tooling/*
 *   e2e       → contracts
 *   tooling   → tooling/*
 *
 * Why element descriptors are ordered: `@boundaries/elements` assigns the FIRST
 * matching descriptor to a file, walking the full path. `packages/modules/*`
 * must therefore be declared before any broader `packages/*`-style pattern.
 */
import fs from "node:fs";
import path from "node:path";
import boundariesPlugin from "eslint-plugin-boundaries";

/**
 * `eslint-plugin-boundaries` ships CommonJS (`exports.default = plugin`), so an
 * ESM default import may yield either the plugin object or a namespace wrapper
 * depending on the loader. Resolve defensively and fail loudly if the shape
 * changes — a silently empty `rules` object would disable every policy.
 */
const plugin = boundariesPlugin?.default ?? boundariesPlugin;
if (!plugin?.rules?.dependencies) {
  throw new Error(
    "@mms/eslint-config: eslint-plugin-boundaries did not expose a `dependencies` rule. " +
      "Refusing to load a config that would silently enforce nothing.",
  );
}

/** Root of the monorepo (the directory that owns `pnpm-workspace.yaml`). */
export function findRepoRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `@mms/eslint-config: could not find pnpm-workspace.yaml above "${start}". ` +
          "Run ESLint from inside the repository.",
      );
    }
    dir = parent;
  }
}

/** Element descriptors, most specific first (first match wins). */
export const ELEMENT_DESCRIPTORS = Object.freeze([
  { type: "contracts", pattern: "packages/contracts" },
  { type: "db", pattern: "packages/db" },
  { type: "be-core", pattern: "packages/be-core" },
  { type: "fe-core", pattern: "packages/fe-core" },
  { type: "ui", pattern: "packages/ui" },
  { type: "module-shared", pattern: "packages/modules/*/src/shared/**", capture: ["module"] },
  { type: "module-backend", pattern: "packages/modules/*/src/backend/**", capture: ["module"] },
  {
    type: "module-fe-components",
    pattern: "packages/modules/*/src/frontend/components/**",
    capture: ["module"],
  },
  {
    type: "module-fe-tenant",
    pattern: "packages/modules/*/src/frontend/tenant/**",
    capture: ["module"],
  },
  {
    type: "module-fe-platform",
    pattern: "packages/modules/*/src/frontend/platform/**",
    capture: ["module"],
  },
  { type: "modules", pattern: "packages/modules/*", capture: ["module"] },
  { type: "app", pattern: "apps/*", capture: ["app"] },
  { type: "tooling", pattern: "tooling/*", capture: ["tool"] },
  { type: "e2e", pattern: "e2e" },
]);

const MODULE_SHARED_TARGETS = ["contracts", "tooling"];
const MODULE_BACKEND_TARGETS = ["contracts", "db", "be-core", "tooling", "module-shared"];
const MODULE_FE_TARGETS = [
  "contracts",
  "fe-core",
  "ui",
  "tooling",
  "module-shared",
  "module-fe-components",
];
const MODULE_FE_COMPONENT_TARGETS = ["contracts", "fe-core", "ui", "tooling", "module-shared"];

const allow = (from, types) => ({
  from: { element: from },
  allow: { to: { element: { types } } },
});

/**
 * Policies. Anything not matched by an `allow` policy is a violation because the
 * rule's `default` is `"disallow"`.
 */
export const POLICIES = Object.freeze([
  // Apps choose an audience. The current `apps/frontend` is transitional (both
  // consoles in one bundle) and may import both FE audiences, never a backend.
  {
    from: { element: { type: "app", captured: { app: "backend" } } },
    allow: {
      to: {
        element: {
          types: ["contracts", "db", "be-core", "tooling", "module-backend", "module-shared"],
        },
      },
    },
  },
  {
    from: { element: { type: "app", captured: { app: "tenant-web" } } },
    allow: {
      to: {
        element: {
          types: ["contracts", "fe-core", "ui", "tooling", "module-fe-tenant", "module-shared"],
        },
      },
    },
  },
  {
    from: { element: { type: "app", captured: { app: "platform-web" } } },
    allow: {
      to: {
        element: {
          types: ["contracts", "fe-core", "ui", "tooling", "module-fe-platform", "module-shared"],
        },
      },
    },
  },
  {
    from: { element: { type: "app", captured: { app: "frontend" } } },
    allow: {
      to: {
        element: {
          types: [
            "contracts",
            "fe-core",
            "ui",
            "tooling",
            "module-fe-tenant",
            "module-fe-platform",
            "module-shared",
          ],
        },
      },
    },
  },
  allow({ type: "module-shared" }, MODULE_SHARED_TARGETS),
  allow({ type: "module-backend" }, MODULE_BACKEND_TARGETS),
  allow({ type: "module-fe-components" }, MODULE_FE_COMPONENT_TARGETS),
  allow({ type: "module-fe-tenant" }, MODULE_FE_TARGETS),
  allow({ type: "module-fe-platform" }, MODULE_FE_TARGETS),
  allow({ type: "fe-core" }, ["contracts", "ui", "tooling"]),
  allow({ type: "be-core" }, ["contracts", "db", "tooling"]),
  allow({ type: "db" }, ["contracts", "tooling"]),
  allow({ type: "ui" }, ["contracts", "tooling"]),
  allow({ type: "contracts" }, ["tooling"]),
  allow({ type: "e2e" }, ["contracts"]),
  allow({ type: "tooling" }, ["tooling"]),
  {
    // App→app is already denied by omission above; this policy exists to give the
    // tenant console a precise message the moment `apps/platform-web` appears.
    from: { element: { type: "app", captured: { app: "tenant-web" } } },
    disallow: { to: { element: { type: "app", captured: { app: "platform-web" } } } },
    message:
      "apps/tenant-web must never import the platform console (apps/platform-web). " +
      "Tenant and platform chrome share only @mms/ui and @mms/fe-core.",
  },
]);

/** Settings every consumer must apply once (root path + elements + ignore list). */
export function boundariesSettings({ rootPath } = {}) {
  return {
    "boundaries/root-path": rootPath ?? findRepoRoot(),
    "boundaries/ignore": ["**/dist/**", "**/node_modules/**"],
    "boundaries/elements": ELEMENT_DESCRIPTORS,
    // The plugin resolves dependency specifiers through eslint-module-utils.
    // Its default (Node CJS) resolver only tries .js/.json/.node, so TypeScript
    // sources and `.tsx` imports would resolve to `null` and be skipped as
    // unknown — silently disabling enforcement. Register the real extensions.
    "import/resolver": {
      node: {
        extensions: [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".json"],
      },
    },
  };
}

/** Options for `boundaries/dependencies`. */
export function boundariesRuleOptions() {
  return { default: "disallow", policies: POLICIES };
}

export const BOUNDARIES_RULE = "boundaries/dependencies";

/**
 * Config objects that register the plugin, its settings and the rule.
 * Flat config resolves `boundaries/*` rules only against a `plugins` entry in
 * the same file's config chain, so the plugin object is part of this block.
 * Consumers prepend these to their flat config.
 */
export function boundariesConfigs({ rootPath, severity = "error" } = {}) {
  const base = {
    plugins: { boundaries: plugin },
    settings: boundariesSettings({ rootPath }),
  };
  const rule = severity === "off" ? "off" : [severity, boundariesRuleOptions()];
  return [{ ...base, rules: { [BOUNDARIES_RULE]: rule } }];
}

/** File globs that must be exempt from dependency policies (tests cross elements). */
export const TEST_GLOBS = Object.freeze([
  "**/*.test.ts",
  "**/*.test.tsx",
  "**/*.spec.ts",
  "**/*.spec.tsx",
  "**/__tests__/**/*.ts",
  "**/__tests__/**/*.tsx",
]);

/** Turn policies off for test files (they legitimately import across elements). */
export const testBoundaryExemption = Object.freeze({
  files: TEST_GLOBS,
  // The plugin must stay registered here too: flat config validates every
  // `plugin/rule` key against the plugins available for that file.
  plugins: Object.freeze({ boundaries: plugin }),
  rules: Object.freeze({ [BOUNDARIES_RULE]: "off" }),
});

/** Exposed for the verification script / future policy tests. */
export const boundariesPluginRef = plugin;
