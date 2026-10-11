import type { ModuleAction } from "@mms/shared";

interface ModuleRouteActionRule {
  readonly methods: readonly string[];
  readonly pattern: RegExp;
  readonly action: ModuleAction;
  /** Restricts the rule to these modules. */
  readonly onlyModules?: readonly string[];
  /** Modules whose matching routes keep the method default (they gate more finely in-handler). */
  readonly exceptModules?: readonly string[];
}

const ALL_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"] as const;

/**
 * Single registry of module routes whose required action differs from the HTTP
 * method default (GET/HEAD/OPTIONS → read, everything else → write). Matched
 * against the registered route URL, so it covers ts-rest contract routes that
 * cannot carry per-route Fastify config. Hand-written routes may instead set
 * `config.moduleAction`, which wins over this table.
 */
export const MODULE_ROUTE_ACTION_RULES: readonly ModuleRouteActionRule[] = [
  // Handler-owned permissions (grant + enablement still enforced here):
  // personal dashboard prefs/widgets (setupWrite|customize; summary filtered per module),
  // the staff activity log (analytics.view), and self-service edits of the caller's own contact.
  {
    methods: ALL_METHODS,
    pattern: /^\/api\/dashboard\//,
    action: "availability",
    onlyModules: ["dashboard"],
  },
  {
    methods: ALL_METHODS,
    pattern: /\/users\/activity(\/|$)/,
    action: "availability",
    onlyModules: ["users"],
  },
  {
    methods: ["PUT", "PATCH"],
    pattern: /^\/api\/contacts\/:id$/,
    action: "availability",
    onlyModules: ["contacts"],
  },
  {
    methods: ["PUT"],
    pattern: /\/(field-config|preferences|config\/fields|config\/preferences|lookups\/:kind)$/,
    action: "setupWrite",
    exceptModules: ["dashboard"],
  },
  { methods: ["POST"], pattern: /\/setup-audit$/, action: "setupWrite" },
  {
    methods: ["POST"],
    pattern: /\/(export|export\/csv|export\/vcf|export-audit)$/,
    action: "export",
  },
  { methods: ["POST", "DELETE"], pattern: /\/saved-reports(\/:id(\/run)?)?$/, action: "read" },
  {
    methods: ["POST"],
    pattern: /\/(widget-aggregates|resolve|duplicate-check|identity-match|duplicates\/scan)$/,
    action: "read",
  },
];

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Required action for a module route; the most demanding method wins for multi-method routes. */
export function resolveModuleRouteAction(
  methods: string | readonly string[],
  url: string,
  moduleId: string,
  declared?: ModuleAction,
): ModuleAction {
  if (declared) return declared;
  const list = (Array.isArray(methods) ? methods : [methods]).map((m) => String(m).toUpperCase());
  const mutating = list.find((m) => !READ_METHODS.has(m));
  const method = mutating ?? list[0] ?? "GET";
  const rule = MODULE_ROUTE_ACTION_RULES.find(
    (r) =>
      r.methods.includes(method) &&
      r.pattern.test(url) &&
      (!r.onlyModules || r.onlyModules.includes(moduleId)) &&
      !(r.exceptModules ?? []).includes(moduleId),
  );
  if (rule) return rule.action;
  return mutating ? "write" : "read";
}
