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
  // Students: restore / bulk-trash are delete-permission operations and the GR backfill is Setup
  // data. Left to the HTTP-method default they resolved to `write`, so the module gate 403'd a
  // role that legitimately held `students.delete` (or setup-write) without `students.write`.
  {
    methods: ["DELETE"],
    pattern: /^\/api\/students\/:id$/,
    action: "delete",
    onlyModules: ["students"],
  },
  {
    methods: ["POST"],
    pattern: /^\/api\/students\/(bulk-delete|bulk-restore)$|^\/api\/students\/:id\/restore$/,
    action: "delete",
    onlyModules: ["students"],
  },
  {
    methods: ["POST"],
    pattern: /^\/api\/students\/migrate-gr-numbers$/,
    action: "setupWrite",
    onlyModules: ["students"],
  },
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
  // Lean picker: any role that can read students/faculty/workshops may resolve a
  // person to link. The handler owns that finer gate (`canUseContactPicker`).
  {
    methods: ["GET"],
    pattern: /^\/api\/contacts\/picker(\/|$)/,
    action: "availability",
    onlyModules: ["contacts"],
  },
  // Messaging log restore rolls the handler's own canRestoreMessagingLogs check;
  // still gate module grant + enablement.
  {
    methods: ["POST"],
    pattern: /^\/api\/messaging\/logs\/restore$/,
    action: "availability",
    onlyModules: ["messaging"],
  },
  // Clearing logs is the handler-owned `messaging.clearLogs` capability (the
  // manifest has no `delete` permission, so the method default `write` would 403 a
  // role that legitimately holds clearLogs without write).
  {
    methods: ["DELETE"],
    pattern: /^\/api\/messaging\/logs$/,
    action: "availability",
    onlyModules: ["messaging"],
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
    // Messaging defines no `export` permission, so the action would fall back to
    // `read` while the handler requires `messaging.write`; method default (write)
    // is the correct gate here.
    exceptModules: ["messaging"],
  },
  // Academic catalogs (session categories / programs / subjects) are Sessions setup data.
  {
    methods: ["PUT", "DELETE", "POST"],
    pattern: /^\/api\/sessions\/catalogs\/:catalog\/:id(\/restore)?$/,
    action: "setupWrite",
    onlyModules: ["sessions"],
  },
  // Academic calendar (holidays / make-up days) is Attendance setup data.
  {
    methods: ["PUT", "DELETE", "POST"],
    pattern: /^\/api\/attendance\/calendar\/:id(\/restore)?$/,
    action: "setupWrite",
    onlyModules: ["attendance"],
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
