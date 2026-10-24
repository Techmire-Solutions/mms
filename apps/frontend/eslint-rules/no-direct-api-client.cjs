/**
 * MMS FE boundary rule — tenant modules must use the typed ts-rest client.
 *
 * The tenant surface is being converged onto `@/lib/api` (`tsrClient` /
 * `apiContract`). The raw transport (`apiFetch` / `apiJson` from
 * `@/lib/apiClient`) is retained only for non-contract surfaces (auth/session,
 * integrations, uploads, db sync, background jobs, websocket) that live under
 * `src/lib/**` and `src/hooks/**`.
 *
 * This rule is applied to `src/tenant/features/**`, `src/tenant/hooks/**` and
 * `src/platform/**`. The files that still legitimately reach for the raw transport are enumerated
 * in `direct-api-client-baseline.json`. Anything not in the baseline is an
 * error (no new hand-rolled call sites), and a baselined file that no longer
 * imports the transport is reported stale so the list only shrinks.
 *
 * Importing the `ApiError` class is fine — only the transport functions are
 * banned, so files that use `apiContract` and throw `ApiError` are unaffected.
 */
const baseline = require("./direct-api-client-baseline.json");
const BASELINE = new Set(baseline);

const API_CLIENT_SOURCE = "@/lib/apiClient";
const TRANSPORT_NAMES = new Set(["apiFetch", "apiJson"]);

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Bans raw apiFetch/apiJson transport in tenant and platform modules (use ts-rest)",
    },
    messages: {
      direct:
        "`{{from}}` imports the raw `{{name}}` transport from `@/lib/apiClient`. Tenant and platform modules must use the ts-rest client (`tsrClient`/`apiContract` from `@/lib/api`). If no contract route exists yet, keep the file on direct-api-client-baseline.json.",
      stale:
        "`{{file}}` no longer imports the raw apiClient transport — remove it from direct-api-client-baseline.json.",
    },
  },
  create(context) {
    const filename = context.filename.replace(/\\/g, "/");
    const relative = filename.includes("/src/")
      ? `src/${filename.split("/src/").at(-1)}`
      : filename;
    if (/\.(test|spec)\./.test(filename)) return {};

    const inBaseline = BASELINE.has(relative);
    let sawTransport = false;

    const check = (node, source) => {
      if (source !== API_CLIENT_SOURCE) return;
      const names = [];
      for (const spec of node.specifiers) {
        if (
          spec.type === "ImportSpecifier" &&
          spec.imported &&
          TRANSPORT_NAMES.has(spec.imported.name)
        ) {
          names.push(spec.imported.name);
        }
      }
      if (names.length === 0) return;
      sawTransport = true;
      if (inBaseline) return;
      for (const name of names) {
        context.report({ node, messageId: "direct", data: { from: relative, name } });
      }
    };

    return {
      ImportDeclaration(node) {
        check(node, node.source.value);
      },
      "Program:exit"(node) {
        if (inBaseline && !sawTransport) {
          context.report({ node, messageId: "stale", data: { file: relative } });
        }
      },
    };
  },
};
