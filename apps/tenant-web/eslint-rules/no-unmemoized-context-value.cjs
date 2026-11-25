/**
 * MMS React rule — ban inline object literals as a context Provider `value`.
 *
 * `<XContext.Provider value={{ a, b }}>` allocates a new object on every render,
 * so every `useContext(XContext)` consumer re-renders whenever the provider
 * re-renders — the render-cascade bug class fixed for TranslationContext /
 * TenantContext / DirectionProvider. Memoize the value (e.g. `useMemo`) or pass
 * a stable value.
 *
 * Scope note: only the inline-literal shape is checked. `value={someIdentifier}`
 * would need data-flow analysis to tell whether the identifier is stable, so it
 * is intentionally not flagged.
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Bans inline object literals as a React context Provider `value` (unstable identity → render cascades)",
    },
    schema: [],
    messages: {
      inlineValue:
        "`<{{provider}}>` receives an inline object literal as its `value`, creating a new object every render and re-rendering all consumers. Memoize it (e.g. `useMemo`) or pass a stable value.",
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (!node.name || node.name.name !== "value") return;
        const opening = node.parent;
        if (!opening || opening.type !== "JSXOpeningElement") return;

        const tag = opening.name;
        if (
          !tag ||
          tag.type !== "JSXMemberExpression" ||
          !tag.property ||
          tag.property.name !== "Provider"
        ) {
          return;
        }

        const container = node.value;
        if (!container || container.type !== "JSXExpressionContainer") return;
        const expression = container.expression;
        if (expression && expression.type === "ObjectExpression") {
          context.report({
            node,
            messageId: "inlineValue",
            data: { provider: (tag.object && tag.object.name) || "Context" },
          });
        }
      },
    };
  },
};
