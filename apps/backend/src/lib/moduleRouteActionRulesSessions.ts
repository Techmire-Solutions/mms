import type { ModuleAction } from "@mms/shared";

/**
 * Sessions route-action rules, split from `moduleRouteActionRules.ts` for the 300-line band.
 *
 * Archive/restore and the bulk-archive job are `sessions.delete` operations; lifecycle, rollover,
 * completion, bulk-status and timetable-import handlers all require `sessions.manage` (beyond
 * write); academic catalogs are Sessions setup data. Left to the HTTP-method default these
 * resolved to `write`, under-classifying a structural operation at the module gate.
 */
export interface SessionsRouteActionRule {
  readonly methods: readonly string[];
  readonly pattern: RegExp;
  readonly action: ModuleAction;
  readonly onlyModules: readonly ["sessions"];
}

export const SESSIONS_MODULE_ROUTE_ACTION_RULES: readonly SessionsRouteActionRule[] = [
  // Sessions archive/restore are `sessions.delete` operations (the handlers already require
  // `canDeleteCollection`). Without these the method default resolved DELETE/POST to `write`,
  // so an enrollment-writer role could archive sessions.
  {
    methods: ["DELETE"],
    pattern: /^\/api\/sessions\/:id$/,
    action: "delete",
    onlyModules: ["sessions"],
  },
  {
    methods: ["POST"],
    pattern: /^\/api\/sessions\/(bulk-delete|bulk-restore)$|^\/api\/sessions\/:id\/restore$/,
    action: "delete",
    onlyModules: ["sessions"],
  },
  {
    methods: ["POST"],
    pattern: /^\/api\/sessions\/bulk-archive\/jobs$/,
    action: "delete",
    onlyModules: ["sessions"],
  },
  {
    methods: ["POST"],
    pattern:
      /^\/api\/sessions\/bulk-status(\/jobs)?$|^\/api\/sessions\/:id\/(cancel|postpone|rollover(\/preview)?|completion\/(evaluate|certificates)|timetable\/import)$/,
    action: "manage",
    onlyModules: ["sessions"],
  },
  // Academic catalogs (session categories / programs / subjects) are Sessions setup data.
  {
    methods: ["PUT", "DELETE", "POST"],
    pattern: /^\/api\/sessions\/catalogs\/:catalog\/:id(\/restore)?$/,
    action: "setupWrite",
    onlyModules: ["sessions"],
  },
];
