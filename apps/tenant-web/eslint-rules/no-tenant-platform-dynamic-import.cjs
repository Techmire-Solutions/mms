/**
 * Tenant console guard: forbid dynamic `import()` / `require()` of platform
 * console code.
 *
 * `no-restricted-imports` (the static-specifier ban in
 * `@mms/eslint-config`'s tenant audience) only inspects `ImportDeclaration`,
 * `ExportNamedDeclaration` and `ExportAllDeclaration`, so `import("@/platform/…")`
 * would slip through. This rule covers the remaining dynamic forms. It matches a
 * `platform` path segment only, so `@/lib/branding/platformBrandingStore` is not
 * a false positive.
 */
const PLATFORM_SEGMENT = /(^|\/)platform(\/|$)/;

function literalString(node) {
  return node && typeof node.value === "string" ? node.value : null;
}

module.exports = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      noPlatformImport:
        "The tenant console must not dynamically import platform console code ({{specifier}}). " +
        "Cross-console code belongs in @mms/ui or @mms/fe-core.",
    },
  },
  create(context) {
    function check(node, specifier) {
      if (typeof specifier !== "string" || !PLATFORM_SEGMENT.test(specifier)) return;
      context.report({ node, messageId: "noPlatformImport", data: { specifier } });
    }

    return {
      ImportExpression: (node) => check(node.source, literalString(node.source)),
      CallExpression: (node) => {
        if (node.callee?.type !== "Identifier" || node.callee.name !== "require") return;
        check(node.arguments[0], literalString(node.arguments[0]));
      },
    };
  },
};
