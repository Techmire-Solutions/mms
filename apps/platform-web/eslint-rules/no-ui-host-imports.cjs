const path = require("node:path");
const baseline = require("./ui-host-imports-baseline.json");

function sourcePath(filename, source) {
  if (source.startsWith("@/")) return `src/${source.slice(2)}`;
  if (source.startsWith("."))
    return path.posix.normalize(path.posix.join(path.posix.dirname(filename), source));
  return source;
}

function isHostDependency(target) {
  return (
    /^src\/(tenant|platform)\//.test(target) ||
    /^src\/lib\/(db(?:\/|$|[A-Z])|apiClient$|contexts\/(AuthContext|TenantContext)$)/.test(
      target,
    ) ||
    target === "@tanstack/react-query" ||
    /^src\/hooks\/useLive(Collection|Object)$/.test(target)
  );
}

module.exports = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      boundary:
        "Shared UI may not import {{target}}. Inject data/actions or compose a tenant/platform adapter.",
      stale:
        "Remove the resolved UI boundary exception for {{target}} from ui-host-imports-baseline.json.",
    },
  },
  create(context) {
    const filename = context.filename.replace(/\\/g, "/").split("/src/").at(-1);
    const relative = `src/${filename}`;
    // Shared-UI tier: primitives (ui), composites (app), engines (common), and the
    // feature-shaped component libs carved out of ui/.
    if (
      !/^src\/components\/(ui|common|app|reports|template-editor|messageComposer|contact-action|sequence-numbering)\//.test(
        relative,
      ) ||
      /\.(test|spec)\./.test(relative)
    )
      return {};
    const allowed = new Set(baseline[relative] ?? []);
    const observed = new Set();
    function check(node, source) {
      if (typeof source !== "string") return;
      const target = sourcePath(relative, source)
        .replace(/\.(tsx?|jsx?)$/, "")
        .replace(/\/index$/, "");
      if (!isHostDependency(target)) return;
      observed.add(target);
      if (!allowed.has(target)) context.report({ node, messageId: "boundary", data: { target } });
    }
    return {
      ImportDeclaration: (node) => check(node, node.source.value),
      ExportNamedDeclaration: (node) => {
        if (node.source) check(node, node.source.value);
      },
      ExportAllDeclaration: (node) => check(node, node.source.value),
      ImportExpression: (node) => check(node, node.source.value),
      CallExpression: (node) => {
        if (node.callee.name === "require") check(node, node.arguments[0]?.value);
      },
      "Program:exit": (node) => {
        for (const target of allowed) {
          if (!observed.has(target)) context.report({ node, messageId: "stale", data: { target } });
        }
      },
    };
  },
};
