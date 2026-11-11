import type { ModuleAction } from "@mms/shared";

/**
 * Examinations route-action rules, split from `moduleRouteActionRules.ts` for the 300-line band.
 *
 * The method default maps every mutation to `write`; these rules move the controller actions
 * (trash/restore, moderation, publish/unlock, overrides, exam definition, the attendance gate and
 * the exams CSV import) to `delete`, and the export surfaces to `read`. Handlers enforce the same
 * predicates.
 */

export interface ExaminationsRouteActionRule {
  readonly methods: readonly string[];
  readonly pattern: RegExp;
  readonly action: ModuleAction;
  readonly onlyModules?: readonly string[];
}

export const EXAMINATIONS_MODULE_ROUTE_ACTION_RULES: readonly ExaminationsRouteActionRule[] = [
  // Examinations: trash/restore are `examinations.delete` operations (the method default made them
  // `write`, so a delete-only role could not trash while any writer could). Publication is a
  // lifecycle action and the CSV export is a read — its handler already requires `canRead`, but the
  // module gate demanded `write`.
  {
    methods: ["DELETE"],
    pattern: /^\/api\/examinations\/exams\/:id$/,
    action: "delete",
    onlyModules: ["examination"],
  },
  {
    methods: ["POST"],
    pattern:
      /^\/api\/examinations\/exams\/(bulk-delete|bulk-restore)$|^\/api\/examinations\/exams\/:id\/restore$/,
    action: "delete",
    onlyModules: ["examination"],
  },
  {
    methods: ["POST"],
    pattern: /^\/api\/examinations\/exams\/:id\/(results-finalization|moderation)$/,
    // Publishing, unlocking and moderating are controller actions; the handlers enforce the same.
    action: "delete",
    onlyModules: ["examination"],
  },
  {
    methods: ["PUT"],
    pattern: /^\/api\/examinations\/exams\/bulk$/,
    // Creating/editing an exam defines the scoring frame and status for every student.
    action: "delete",
    onlyModules: ["examination"],
  },
  {
    methods: ["PUT"],
    pattern: /^\/api\/examinations\/exams\/:id\/attendance-gate$/,
    // The attendance threshold decides who may be graded; a controller setting.
    action: "delete",
    onlyModules: ["examination"],
  },
  {
    methods: ["POST"],
    pattern: /^\/api\/examinations\/import$/,
    // The exams CSV import can create/modify scoring frames.
    action: "delete",
    onlyModules: ["examination"],
  },
  {
    methods: ["POST"],
    pattern: /^\/api\/examinations\/exams\/:id\/eligibility-overrides(\/:studentId\/revoke)?$/,
    // Granting or revoking an override is an administrative decision; the handlers enforce the same.
    action: "delete",
    onlyModules: ["examination"],
  },
  {
    methods: ["POST"],
    pattern: /^\/api\/examinations\/(export\/csv|export-audit)$/,
    action: "read",
    onlyModules: ["examination"],
  },
  {
    methods: ["POST"],
    pattern: /^\/api\/examinations\/exams\/:id\/results\/export$/,
    action: "read",
    onlyModules: ["examination"],
  },
];
