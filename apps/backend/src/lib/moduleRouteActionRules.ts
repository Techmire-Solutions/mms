import type { ModuleAction } from "@mms/shared";
import { EXAMINATIONS_MODULE_ROUTE_ACTION_RULES } from "./moduleRouteActionRulesExaminations.js";

/**
 * Single registry of module routes whose required action differs from the HTTP-method default.
 * Split from `moduleRouteActions.ts` for the 300-line band.
 */

export interface ModuleRouteActionRule {
  readonly methods: readonly string[];
  readonly pattern: RegExp;
  readonly action: ModuleAction;
  /** Restricts the rule to these modules. */
  readonly onlyModules?: readonly string[];
  /** Modules whose matching routes keep the method default (they gate more finely in-handler). */
  readonly exceptModules?: readonly string[];
}

const ALL_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"] as const;

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
  // Enrollments: trash/restore is `enrollments.delete` (not write), and the administrative
  // operations (drops/transfers/re-admissions/suspensions/bulk-end) are `enrollments.manage`.
  // Left to the HTTP-method default they resolved to `write`, so a registrar-only role was
  // blocked at the module gate while a teacher could drop a student.
  {
    methods: ["DELETE"],
    pattern: /^\/api\/enrollments\/[^/]+$/,
    action: "delete",
    onlyModules: ["enrollment"],
  },
  {
    methods: ["POST"],
    pattern:
      /^\/api\/enrollments\/(bulk-delete|bulk-restore)$|^\/api\/enrollments\/[^/]+\/restore$/,
    action: "delete",
    onlyModules: ["enrollment"],
  },
  {
    methods: ["POST"],
    pattern:
      /^\/api\/enrollments\/(bulk-end)$|^\/api\/enrollments\/[^/]+\/(transfer|withdraw|readmit|suspend)$/,
    action: "manage",
    onlyModules: ["enrollment"],
  },
  ...EXAMINATIONS_MODULE_ROUTE_ACTION_RULES,
  // Workshops: restore and bulk-trash are `workshops.delete` operations in the handlers. The method
  // default (`write`, for POST) would let a writer past the module gate only to 403 in the handler.
  {
    methods: ["POST"],
    pattern: /^\/api\/workshops\/(:id\/restore|bulk-delete)$/,
    action: "delete",
    onlyModules: ["workshops"],
  },
  // Faculty: archive/restore are `faculty.delete` operations. The handlers
  // already require `canDeleteCollection("faculty")`, so the method default
  // (`write`) wrongly 403'd a delete-only role. Registered on the canonical,
  // `/api/tenant` and `/api/v1/tenant` prefixes.
  {
    methods: ["DELETE"],
    pattern: /^\/api\/(tenant\/|v1\/tenant\/)?faculty\/[^/]+$/,
    action: "delete",
    onlyModules: ["faculty"],
  },
  {
    methods: ["POST"],
    pattern: /^\/api\/(tenant\/|v1\/tenant\/)?faculty\/(:id\/restore|bulk-delete|bulk-restore)$/,
    action: "delete",
    onlyModules: ["faculty"],
  },
  // Catalog archive/restore (departments, designations) and assignment removal
  // require delete + setup-write in the handlers; the delete action is the
  // stricter module-gate requirement.
  {
    methods: ["DELETE"],
    pattern: /^\/api\/faculty\/(departments|designations)\/:id$/,
    action: "delete",
    onlyModules: ["faculty"],
  },
  {
    methods: ["POST"],
    pattern: /^\/api\/faculty\/(departments|designations)\/:id\/restore$/,
    action: "delete",
    onlyModules: ["faculty"],
  },
  {
    methods: ["DELETE"],
    pattern: /^\/api\/faculty\/[^/]+\/assignments\/:id$/,
    action: "delete",
    onlyModules: ["faculty"],
  },
  // Tasks: archive/restore are `tasks.delete` operations in the handlers. The
  // status route is handler-owned because it accepts `tasks.write` OR
  // `tasks.complete`.
  {
    methods: ["DELETE"],
    pattern: /^\/api\/tasks\/:id$/,
    action: "delete",
    onlyModules: ["tasks"],
  },
  {
    methods: ["POST"],
    pattern: /^\/api\/tasks\/(bulk-delete|bulk-restore)$|^\/api\/tasks\/:id\/restore$/,
    action: "delete",
    onlyModules: ["tasks"],
  },
  {
    methods: ["PATCH", "POST"],
    pattern: /^\/api\/tasks\/:id\/status$|^\/api\/tasks\/bulk-status$/,
    action: "availability",
    onlyModules: ["tasks"],
  },
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
  // Handler-owned permissions (grant + enablement still enforced here):
  // workspace-shared dashboard prefs/widgets (setupWrite|customize; the summary
  // is filtered per module by the caller's permissions), the staff activity log
  // (analytics.view), and self-service edits of the caller's own contact.
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
  // Contacts archive/restore are `contacts.delete` operations: the handlers
  // already require `canDeleteContacts`, so the method default (`write`) wrongly
  // 403'd a custom role holding only `contacts.delete`. Mirrors students/faculty/tasks.
  {
    methods: ["DELETE"],
    pattern: /^\/api\/contacts\/:id$/,
    action: "delete",
    onlyModules: ["contacts"],
  },
  {
    methods: ["POST"],
    pattern: /^\/api\/contacts\/(bulk-delete|bulk-restore)$|^\/api\/contacts\/:id\/restore$/,
    action: "delete",
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
  // Deciding an excuse rewrites historical attendance evidence: require the module's delete-level
  // permission, not merely write (the handler re-checks the same permission).
  {
    methods: ["POST"],
    pattern: /^\/api\/attendance\/leaves\/:id\/review$/,
    action: "delete",
    onlyModules: ["attendance"],
  },
  // Reopening a submitted roster day is likewise an override of the day lock.
  {
    methods: ["POST"],
    pattern: /^\/api\/attendance\/days\/:classId\/:date\/reopen$/,
    action: "delete",
    onlyModules: ["attendance"],
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
