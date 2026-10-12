/**
 * MMS FE boundary rule — importer-aware feature isolation (two modes).
 *
 * 1. Feature → feature: files inside `src/tenant/features/{module}/**` may not
 *    import another feature module's internals (`@/tenant/features/{other}/**`).
 *    Cross-module hooks/data go through `@/tenant/hooks/collections/*` facades;
 *    shared chrome lives in `components/ui` / `lib/` / `@mms/shared`. `reports`
 *    and `settings` are sanctioned cross-cutting feature targets.
 *
 * 2. Shared layer → feature: files in the non-feature layers (`src/hooks/**`,
 *    non-`ui`/`common` `src/components/**`, non-`collections` `src/tenant/hooks/**`,
 *    non-`routing` `src/lib/**`, `src/tenant/components/**`) may not import a
 *    feature internal — they must consume the module's
 *    `@/tenant/hooks/collections/*` facade. `reports`/`settings` are sanctioned
 *    here too, and a handful of sanctioned bridges are listed in
 *    `feature-internal-imports-baseline.json` (with a `stale` check so resolved
 *    exceptions must be deleted).
 *
 * Core `no-restricted-imports` cannot express this because it matches only the
 * import source, not the importing file — intra-module imports would also match.
 */
const baseline = require("./feature-internal-imports-baseline.json");

const FEATURE_FILE = /src[/\\]tenant[/\\]features[/\\]([^/\\]+)[/\\]/;
const FEATURE_TARGET = /^@[/\\]tenant[/\\]features[/\\]([^/\\]+)(?:[/\\]|$)/;
const SHARED_FEATURES = new Set(["reports", "settings"]);

/** Shared-layer importers (relative to `src/`) that must route through facades. */
const SHARED_LAYER_IMPORTERS = [
  /^src\/hooks\//,
  /^src\/components\/(?!ui\/|common\/)/,
  /^src\/tenant\/hooks\/(?!collections\/)/,
  /^src\/lib\/(?!routing\/)/,
  /^src\/tenant\/components\//,
];

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Bans direct imports of feature internals (cross-feature and shared-layer)",
    },
    messages: {
      crossFeature:
        "`{{from}}` may not import `@/tenant/features/{{target}}/...` directly (features are isolated). Route hooks/data through `@/tenant/hooks/collections/*`, or extract shared chrome to `components/ui` / logic to `lib/` / `@mms/shared`.",
      sharedLayer:
        "Shared-layer file `{{from}}` may not import `@/tenant/features/{{target}}/...`. Consume the module's `@/tenant/hooks/collections/*` facade, or extract shared logic to `lib/` / `@mms/shared`.",
      stale:
        "Remove the resolved feature-internal exception for `{{target}}` from feature-internal-imports-baseline.json.",
    },
  },
  create(context) {
    const filename = context.filename.replace(/\\/g, "/");
    const relative = filename.includes("/src/")
      ? `src/${filename.split("/src/").at(-1)}`
      : filename;
    const isTest = /\.(test|spec)\./.test(filename);

    const selfModule = FEATURE_FILE.exec(filename)?.[1];
    const isSharedLayer =
      !selfModule && SHARED_LAYER_IMPORTERS.some((pattern) => pattern.test(relative));
    if (!selfModule && !isSharedLayer) return {};

    const allowed = new Set(baseline[relative] ?? []);
    const observed = new Set();

    const check = (node, source) => {
      if (typeof source !== "string") return;
      const target = FEATURE_TARGET.exec(source)?.[1];
      if (!target) return;
      if (selfModule) {
        if (target !== selfModule && !SHARED_FEATURES.has(target)) {
          context.report({
            node,
            messageId: "crossFeature",
            data: { from: selfModule, target },
          });
        }
        return;
      }
      if (isTest || SHARED_FEATURES.has(target)) return;
      observed.add(target);
      if (allowed.has(target)) return;
      context.report({ node, messageId: "sharedLayer", data: { from: relative, target } });
    };

    return {
      ImportDeclaration(node) {
        check(node, node.source.value);
      },
      ImportExpression(node) {
        if (node.source && node.source.type === "Literal") {
          check(node, node.source.value);
        }
      },
      "Program:exit"(node) {
        if (!isSharedLayer || isTest) return;
        for (const target of allowed) {
          if (!observed.has(target)) {
            context.report({ node, messageId: "stale", data: { target } });
          }
        }
      },
    };
  },
};
