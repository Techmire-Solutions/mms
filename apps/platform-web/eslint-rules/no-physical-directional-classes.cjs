/**
 * MMS BiDi Design System Rule — Enforce logical CSS properties.
 *
 * Disallows physical directional Tailwind utilities (pl-*, pr-*, ml-*, mr-*,
 * text-left, text-right, border-l-*, border-r-*, rounded-l-*, rounded-r-*)
 * and mandates BiDi logical equivalents (ps-*, pe-*, ms-*, me-*, text-start,
 * text-end, border-s-*, border-e-*, rounded-s-*, rounded-e-*).
 *
 * Two entry points are checked, because class strings reach the DOM by two
 * routes:
 *   1. `className="…"` / `className={"…"}` / `` className={`…`} `` attributes.
 *   2. Class-composing calls — `cn("…", cond && "…")`, `clsx(…)`, `cva(…)`.
 *
 * (2) was missing for a long time. It is the idiomatic style in this codebase, so
 * the rule reported clean on files that were nothing but `cn()` calls — a guard
 * that could not see the pattern it was written to police.
 * A match must be a WHOLE utility token: not preceded by a word character or
 * another `-`. Tailwind utilities are hyphen-joined, so a plain `\b` matched the
 * `right-2` inside `slide-in-from-right-2` (a Radix/shadcn enter animation, which
 * is legitimately physical) and reported false positives the moment the rule
 * started reading `cn()` arguments. The lookbehind/lookahead pair keeps
 * `md:right-0` and `hover:text-left` matching while excluding longer tokens.
 */
const PHYSICAL_DIRECTIONAL_PATTERN =
  /(?<![\w-])(?:(?:after:|before:)?(left|right)-(?:\d+(?:\/\d+)?|full|auto|px)|(text-(?:left|right))|((?:p|m)[lr]-(?:\d+(?:\.\d+)?|auto|px))|((?:border|rounded)-[lr](?:-[a-zA-Z0-9_/]+)?))(?![\w-])/g;

/** Functions that compose Tailwind class strings. */
const CLASS_COMPOSERS = new Set(["cn", "clsx", "classNames", "cva", "twMerge", "tv"]);

/** Last path segment of a callee, e.g. `utils.cn` -> `cn`. */
function calleeName(callee) {
  if (!callee) return null;
  if (callee.type === "Identifier") return callee.name;
  if (callee.type === "MemberExpression" && callee.property && callee.property.name) {
    return callee.property.name;
  }
  return null;
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforces logical CSS utility classes over physical directional ones for BiDi compatibility",
    },
    messages: {
      useLogicalClass:
        "Physical directional class `{{className}}` is banned in MMS. Use logical equivalent (`ps-*`, `pe-*`, `ms-*`, `me-*`, `text-start`, `text-end`, `border-s-*`, `border-e-*`).",
    },
  },
  create(context) {
    /**
     * Composer calls already walked by the `className` attribute handler.
     *
     * `className={cn("pl-4")}` is reachable from two visitors — the attribute
     * handler recurses into the expression, and the CallExpression visitor
     * matches `cn` — which reported every class twice. Attribute visitors run
     * before their children, so marking here lets the CallExpression visitor skip
     * what the attribute already covered, while still catching `cn()` calls that
     * appear outside JSX (module-level class constants, `cva` definitions).
     */
    const handledComposerCalls = new WeakSet();

    function checkStringLiteral(node, value) {
      if (typeof value !== "string") return;
      let match;
      PHYSICAL_DIRECTIONAL_PATTERN.lastIndex = 0;
      while ((match = PHYSICAL_DIRECTIONAL_PATTERN.exec(value)) !== null) {
        context.report({
          node,
          messageId: "useLogicalClass",
          data: { className: match[0] },
        });
      }
    }

    /**
     * Recurses an expression, reporting any banned class in the string literals
     * and template quasis it contains. Handles the shapes class composers take in
     * practice: `cn("a", cond && "b", isX ? "c" : "d")`.
     */
    function checkExpression(node) {
      if (!node || typeof node !== "object") return;
      switch (node.type) {
        case "Literal":
          checkStringLiteral(node, node.value);
          break;
        case "TemplateLiteral":
          for (const quasi of node.quasis) {
            checkStringLiteral(quasi, quasi.value.raw);
          }
          break;
        case "LogicalExpression":
          checkExpression(node.left);
          checkExpression(node.right);
          break;
        case "ConditionalExpression":
          checkExpression(node.consequent);
          checkExpression(node.alternate);
          break;
        case "ArrayExpression":
          for (const element of node.elements) checkExpression(element);
          break;
        case "CallExpression":
          if (CLASS_COMPOSERS.has(calleeName(node.callee))) {
            handledComposerCalls.add(node);
          }
          for (const arg of node.arguments) checkExpression(arg);
          break;
        case "ObjectExpression":
          for (const property of node.properties) {
            if (property.type !== "Property") continue;
            // Both positions can hold the class string, and which one depends on
            // the composer:
            //   cva(…) variant map  -> { sm: "pl-4" }   (value)
            //   clsx/cn object form -> { "pl-4": isOn } (key)
            // Checking both is safe: cva variant names never look like a
            // directional utility.
            checkExpression(property.value);
            checkExpression(property.key);
          }
          break;
        default:
          break;
      }
    }

    return {
      JSXAttribute(node) {
        if (!node.name || node.name.name !== "className") return;
        if (!node.value) return;
        if (node.value.type === "Literal") {
          checkStringLiteral(node.value, node.value.value);
        } else if (node.value.type === "JSXExpressionContainer") {
          checkExpression(node.value.expression);
        }
      },
      CallExpression(node) {
        if (!CLASS_COMPOSERS.has(calleeName(node.callee))) return;
        // Already walked as part of a `className` expression.
        if (handledComposerCalls.has(node)) return;
        for (const arg of node.arguments) checkExpression(arg);
      },
    };
  },
};
