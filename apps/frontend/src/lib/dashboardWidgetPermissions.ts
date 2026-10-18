import type { ReportCollection } from "@/lib/reports/reportMetadata";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import {
  type Permission,
  SESSIONS_MODULE_MANIFEST,
  ATTENDANCE_MODULE_MANIFEST,
  ENROLLMENTS_MODULE_MANIFEST,
  HASANAT_MODULE_MANIFEST,
  FINANCE_MODULE_MANIFEST,
  STUDENTS_MODULE_MANIFEST,
  FACULTY_MODULE_MANIFEST,
  CONTACTS_MODULE_MANIFEST,
  QUESTION_BANK_MODULE_MANIFEST,
  ACCOUNTING_MODULE_MANIFEST,
  resolveAccessModuleId,
} from "@mms/shared";

/**
 * Maps report collections to Settings → System Modules keys.
 * Single source for dashboard card visibility vs enabledModules.
 */
export const DASHBOARD_COLLECTION_MODULE_ID: Partial<Record<ReportCollection, string>> = {
  sessions: SESSIONS_MODULE_MANIFEST.moduleId,
  enrollments: ENROLLMENTS_MODULE_MANIFEST.moduleId,
  attendance_records: ATTENDANCE_MODULE_MANIFEST.moduleId,
  hasanat_distributions: HASANAT_MODULE_MANIFEST.moduleId,
  finance_invoices: FINANCE_MODULE_MANIFEST.moduleId,
  students: STUDENTS_MODULE_MANIFEST.moduleId,
  faculty: FACULTY_MODULE_MANIFEST.moduleId,
  contacts: CONTACTS_MODULE_MANIFEST.moduleId,
  questions: QUESTION_BANK_MODULE_MANIFEST.moduleId,
  tests: QUESTION_BANK_MODULE_MANIFEST.moduleId,
  assessment_results: QUESTION_BANK_MODULE_MANIFEST.moduleId,
};

/** Widget ids that require the accounting module (not finance alone). */
export const DASHBOARD_ACCOUNTING_WIDGET_IDS = new Set([
  "def-card-accountant-revenue",
  "def-card-accountant-expenses",
  "def-revenue-expenses",
  "def-finance-toggle-rev",
]);

/**
 * Resolves the required read permission for a dashboard widget or card.
 */
export function getDashboardWidgetRequiredPermission(
  widget: Pick<CustomWidget, "id" | "collection" | "category" | "widgetType">,
): Permission | undefined {
  if (widget.widgetType === "hasanat-distribution") {
    return HASANAT_MODULE_MANIFEST.permissions.read;
  }
  if (widget.widgetType === "revenue-expenses") {
    return ACCOUNTING_MODULE_MANIFEST.permissions.read;
  }

  const collection = widget.collection;
  if (collection === "finance_invoices") {
    if (
      DASHBOARD_ACCOUNTING_WIDGET_IDS.has(widget.id) ||
      widget.category === ACCOUNTING_MODULE_MANIFEST.moduleId
    ) {
      return ACCOUNTING_MODULE_MANIFEST.permissions.read;
    }
    return FINANCE_MODULE_MANIFEST.permissions.read;
  }

  switch (collection) {
    case "hasanat_distributions":
      return HASANAT_MODULE_MANIFEST.permissions.read;
    case "attendance_records":
      return ATTENDANCE_MODULE_MANIFEST.permissions.read;
    case "sessions":
      return SESSIONS_MODULE_MANIFEST.permissions.read;
    case "enrollments":
      return ENROLLMENTS_MODULE_MANIFEST.permissions.read;
    case "students":
      return STUDENTS_MODULE_MANIFEST.permissions.read;
    case "faculty":
      return FACULTY_MODULE_MANIFEST.permissions.read;
    case "contacts":
      return CONTACTS_MODULE_MANIFEST.permissions.read;
    case "questions":
    case "tests":
    case "assessment_results":
      return QUESTION_BANK_MODULE_MANIFEST.permissions.read;
    default:
      return undefined;
  }
}

/**
 * Checks whether the current user has the necessary read permission to view a widget.
 */
export function isDashboardWidgetPermitted(
  widget: Pick<CustomWidget, "id" | "collection" | "category" | "widgetType">,
  can: (permission: Permission) => boolean,
): boolean {
  const permission = getDashboardWidgetRequiredPermission(widget);
  if (!permission) return true;
  return can(permission);
}

/**
 * Whether a dashboard card/widget should show given enabledModules.
 * Accounting-tagged finance cards require the accounting module.
 */
export function isDashboardWidgetModuleEnabled(
  widget: Pick<CustomWidget, "id" | "collection" | "category" | "widgetType">,
  enabledModules: Record<string, boolean | undefined>,
): boolean {
  // Manifest ids (e.g. `enrollments`) resolve to the system ids the flags are keyed by.
  const isModuleEnabled = (moduleId: string) =>
    enabledModules[resolveAccessModuleId(moduleId) ?? moduleId] !== false;

  if (widget.widgetType === "hasanat-distribution") {
    return isModuleEnabled(HASANAT_MODULE_MANIFEST.moduleId);
  }
  if (widget.widgetType === "revenue-expenses") {
    return isModuleEnabled(ACCOUNTING_MODULE_MANIFEST.moduleId);
  }

  const collection = widget.collection;

  if (collection === "finance_invoices") {
    if (
      DASHBOARD_ACCOUNTING_WIDGET_IDS.has(widget.id) ||
      widget.category === ACCOUNTING_MODULE_MANIFEST.moduleId
    ) {
      return isModuleEnabled(ACCOUNTING_MODULE_MANIFEST.moduleId);
    }
    return isModuleEnabled(FINANCE_MODULE_MANIFEST.moduleId);
  }

  const moduleId = DASHBOARD_COLLECTION_MODULE_ID[collection];
  if (!moduleId) return true;
  return isModuleEnabled(moduleId);
}

/**
 * Checks whether a widget is allowed (both module is enabled and user is permitted).
 */
export function isDashboardWidgetAllowed(
  widget: Pick<CustomWidget, "id" | "collection" | "category" | "widgetType">,
  enabledModules: Record<string, boolean | undefined>,
  can?: (permission: Permission) => boolean,
): boolean {
  if (!isDashboardWidgetModuleEnabled(widget, enabledModules)) {
    return false;
  }
  if (can && !isDashboardWidgetPermitted(widget, can)) {
    return false;
  }
  return true;
}
